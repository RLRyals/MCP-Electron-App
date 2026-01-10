#!/usr/bin/env node

/**
 * FictionLab IPC Client for Claude Desktop
 *
 * Cross-platform IPC client that connects to FictionLab app.
 * Works on both Windows (named pipe) and Mac (Unix socket).
 *
 * Platform Detection:
 * - Windows: Named pipe at \\.\pipe\fictionlab-workflow-runner
 * - Mac: Unix socket at /tmp/fictionlab-workflow-runner.sock
 *
 * Usage:
 *   node ipc-client.js list
 *   node ipc-client.js get <workflow-id>
 *   node ipc-client.js execute <workflow-id> [options]
 */

const net = require('net');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Platform-specific socket path detection
function getSocketPath() {
  // Detect actual platform (not WSL-translated)
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows: Use named pipe
    return '\\\\.\\pipe\\fictionlab-workflow-runner';
  } else if (platform === 'darwin') {
    // Mac: Use Unix socket in /tmp
    return '/tmp/fictionlab-workflow-runner.sock';
  } else {
    // Linux/WSL: Try Unix socket (though Claude Desktop doesn't run on Linux yet)
    return '/tmp/fictionlab-workflow-runner.sock';
  }
}

/**
 * Send IPC request to FictionLab and return response
 */
function sendIPCRequest(method, params = {}, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const socketPath = getSocketPath();

    // Debug: Show what we're connecting to
    const platformName = process.platform === 'win32' ? 'Windows' :
                         process.platform === 'darwin' ? 'Mac' : 'Linux';
    console.log(`[FictionLab Client] Platform: ${platformName}`);
    console.log(`[FictionLab Client] Socket: ${socketPath}`);
    console.log(`[FictionLab Client] Connecting to FictionLab...\n`);

    const socket = net.createConnection(socketPath);

    let buffer = '';
    let resolved = false;
    let timeoutHandle;

    // Set timeout
    timeoutHandle = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        reject(new Error(`Request timeout after ${timeoutMs / 1000} seconds`));
      }
    }, timeoutMs);

    // Handle successful connection
    socket.on('connect', () => {
      console.log('[FictionLab Client] Connected successfully\n');

      // Send request as JSON
      const request = { method, params };
      socket.write(JSON.stringify(request) + '\n');
    });

    // Handle incoming data
    socket.on('data', (data) => {
      buffer += data.toString();

      // Try to parse complete JSON messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const response = JSON.parse(line);

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutHandle);
            socket.end();
            resolve(response);
          }
        } catch (parseError) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutHandle);
            socket.destroy();
            reject(new Error(`Invalid JSON response: ${line}`));
          }
        }
      }
    });

    // Handle connection errors
    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutHandle);

        // Provide helpful error messages
        if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
          const instructions = process.platform === 'win32'
            ? 'On Windows, check that FictionLab.exe is running.'
            : 'On Mac, check that FictionLab.app is running.';

          reject(new Error(
            `Cannot connect to FictionLab.\n\n` +
            `FictionLab app is not running or IPC server not started.\n` +
            `${instructions}\n\n` +
            `Steps to fix:\n` +
            `1. Launch FictionLab app\n` +
            `2. Check Services tab - Docker containers should be running\n` +
            `3. Check Plugins tab - Workflow plugin should be active\n` +
            `4. Look for console message: "IPC Server Listening on ${socketPath}"`
          ));
        } else if (err.code === 'EPIPE') {
          reject(new Error('Connection closed unexpectedly. FictionLab may have crashed.'));
        } else {
          reject(new Error(`IPC connection error: ${err.message} (code: ${err.code})`));
        }
      }
    });

    // Handle connection close
    socket.on('end', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutHandle);
        reject(new Error('Connection closed before receiving response'));
      }
    });
  });
}

/**
 * Parse optional arguments from command line
 */
function parseOptions(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--workspace' && args[i + 1]) {
      options.workspaceRoot = args[i + 1];
      i++;
    } else if (args[i] === '--variables' && args[i + 1]) {
      try {
        options.initialVariables = JSON.parse(args[i + 1]);
      } catch (e) {
        console.error('Error: --variables must be valid JSON');
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--version' && args[i + 1]) {
      options.version = args[i + 1];
      i++;
    }
  }

  return options;
}

/**
 * Command: list - List all workflows
 */
async function handleList() {
  console.log('Fetching workflows from FictionLab...\n');

  const response = await sendIPCRequest('workflow:list', {});

  if (response.error) {
    throw new Error(`Failed to list workflows: ${response.error}`);
  }

  // Response is the array of workflows
  const workflows = Array.isArray(response) ? response : [];

  if (workflows.length === 0) {
    console.log('No workflows found.');
    console.log('\nTo add workflows:');
    console.log('1. Open FictionLab app');
    console.log('2. Go to Workflows tab');
    console.log('3. Import or create workflow definitions');
    return;
  }

  console.log(`Found ${workflows.length} workflow(s):\n`);
  console.log('='.repeat(70) + '\n');

  workflows.forEach((wf, i) => {
    console.log(`${i + 1}. ${wf.name || wf.id}`);
    console.log(`   ID: ${wf.id}`);
    console.log(`   Version: ${wf.version || 'latest'}`);
    if (wf.description) {
      console.log(`   Description: ${wf.description}`);
    }
    if (wf.tags && wf.tags.length > 0) {
      console.log(`   Tags: ${wf.tags.join(', ')}`);
    }
    console.log('');
  });

  console.log('='.repeat(70));
  console.log('\nTo execute a workflow, use:');
  console.log('  node ipc-client.js execute <workflow-id>');
}

/**
 * Command: get - Get workflow definition
 */
async function handleGet() {
  const workflowId = args[1];

  if (!workflowId) {
    console.error('Error: Workflow ID is required');
    console.log('Usage: node ipc-client.js get <workflow-id>');
    process.exit(1);
  }

  const options = parseOptions(args.slice(2));
  const version = options.version || 'latest';

  console.log(`Fetching workflow: ${workflowId} (${version})...\n`);

  const response = await sendIPCRequest('workflow:get', {
    id: workflowId,
    version: version
  });

  if (response.error) {
    throw new Error(`Failed to get workflow: ${response.error}`);
  }

  console.log('Workflow Definition:');
  console.log('='.repeat(70));
  console.log(JSON.stringify(response, null, 2));
  console.log('='.repeat(70));
}

/**
 * Command: execute - Execute workflow
 */
async function handleExecute() {
  const workflowId = args[1];

  if (!workflowId) {
    console.error('Error: Workflow ID is required');
    console.log('Usage: node ipc-client.js execute <workflow-id> [options]');
    console.log('\nOptions:');
    console.log('  --workspace <path>      Project directory (default: current directory)');
    console.log('  --variables <json>      Initial variables as JSON');
    console.log('  --version <version>     Workflow version (default: latest)');
    console.log('\nExample:');
    console.log('  node ipc-client.js execute 12-phase-novel-pipeline \\');
    console.log('    --workspace "C:/Users/Author/MyNovel" \\');
    console.log('    --variables \'{"genre":"Urban Fantasy"}\'');
    process.exit(1);
  }

  const options = parseOptions(args.slice(2));

  // Default workspace to current directory
  if (!options.workspaceRoot) {
    options.workspaceRoot = process.cwd();
  }

  console.log('Executing workflow...');
  console.log('='.repeat(70));
  console.log(`Workflow ID: ${workflowId}`);
  console.log(`Version: ${options.version || 'latest'}`);
  console.log(`Workspace: ${options.workspaceRoot}`);
  if (options.initialVariables) {
    console.log(`Variables: ${JSON.stringify(options.initialVariables, null, 2)}`);
  }
  console.log('='.repeat(70) + '\n');

  console.log('⏳ Workflow executing... (this may take several minutes)\n');

  const response = await sendIPCRequest('workflow:execute', {
    workflowId: workflowId,
    options: options
  }, 600000); // 10-minute timeout

  if (response.error) {
    throw new Error(`Workflow execution failed: ${response.error}`);
  }

  // Display results
  console.log('\n' + '='.repeat(70));
  console.log('WORKFLOW EXECUTION RESULT');
  console.log('='.repeat(70) + '\n');

  if (response.success) {
    console.log('✅ Status: SUCCESS\n');
    console.log(`Instance ID: ${response.instanceId || 'N/A'}`);

    if (response.completedNodes && response.completedNodes.length > 0) {
      console.log(`\nCompleted Nodes (${response.completedNodes.length}):`);
      response.completedNodes.forEach(nodeId => {
        console.log(`  ✓ ${nodeId}`);
      });
    }

    if (response.outputs && Object.keys(response.outputs).length > 0) {
      console.log('\nOutput Variables:');
      Object.entries(response.outputs).forEach(([key, value]) => {
        const preview = typeof value === 'string' && value.length > 150
          ? value.substring(0, 150) + '...'
          : JSON.stringify(value);
        console.log(`  ${key}: ${preview}`);
      });
    }
  } else {
    console.log('❌ Status: FAILED\n');
    console.log(`Instance ID: ${response.instanceId || 'N/A'}`);

    if (response.failedNode) {
      console.log(`\nFailed at node: ${response.failedNode}`);
    }

    if (response.error) {
      console.log(`\nError: ${response.error}`);
    }

    console.log('\nTroubleshooting:');
    console.log('1. Check FictionLab console for detailed error messages');
    console.log('2. Verify workflow definition is correct');
    console.log('3. Check Docker services are running (Services tab)');
    console.log('4. Review failed node configuration');
  }

  console.log('\n' + '='.repeat(70));
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Show usage if no command
    if (!command) {
      console.log(`
FictionLab Workflow Runner - Claude Desktop Client

Usage:
  node ipc-client.js list                    List all available workflows
  node ipc-client.js get <workflow-id>       Get workflow definition
  node ipc-client.js execute <workflow-id>   Execute a workflow

Options (for execute command):
  --workspace <path>      Project directory (default: current directory)
  --variables <json>      Initial variables as JSON string
  --version <version>     Workflow version (default: latest)

Examples:
  # List workflows
  node ipc-client.js list

  # Get workflow details
  node ipc-client.js get 12-phase-novel-pipeline

  # Execute workflow
  node ipc-client.js execute 12-phase-novel-pipeline

  # Execute with options
  node ipc-client.js execute 12-phase-novel-pipeline \\
    --workspace "C:/Users/Author/MyNovel" \\
    --variables '{"genre":"Urban Fantasy","targetWordCount":80000}'

Platform Support:
  - Windows: Connects via named pipe (\\\\.\\pipe\\fictionlab-workflow-runner)
  - Mac: Connects via Unix socket (/tmp/fictionlab-workflow-runner.sock)

Prerequisites:
  1. FictionLab app must be running
  2. Docker services active (Services tab)
  3. Workflow plugin enabled (Plugins tab)
`);
      process.exit(0);
    }

    // Route to command handler
    switch (command) {
      case 'list':
        await handleList();
        break;

      case 'get':
        await handleGet();
        break;

      case 'execute':
        await handleExecute();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run without arguments to see usage.');
        process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run main function
main();
