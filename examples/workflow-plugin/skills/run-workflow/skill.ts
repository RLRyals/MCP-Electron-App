/**
 * FictionLab Workflow Runner - Claude Code Skill
 *
 * Executes FictionLab workflows from any IDE via IPC socket connection.
 * Connects to FictionLab Electron app's workflow-runner plugin.
 *
 * IMPORTANT: FictionLab app must be running for this skill to work.
 */

import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

/**
 * Workflow execution options
 */
interface WorkflowExecutionOptions {
  workflowId: string;
  version?: string;
  workspaceRoot?: string;
  initialVariables?: Record<string, any>;
  userId?: number;
  seriesId?: number;
}

/**
 * Workflow execution result
 */
interface WorkflowExecutionResult {
  success: boolean;
  instanceId?: string;
  status?: 'completed' | 'failed' | 'running';
  outputs?: Record<string, any>;
  completedNodes?: string[];
  failedNode?: string;
  error?: string;
}

/**
 * IPC request/response interfaces
 */
interface IPCRequest {
  method: string;
  params?: any;
}

interface IPCResponse {
  success?: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Get platform-specific IPC socket path
 */
function getIPCSocketPath(): string {
  if (process.platform === 'win32') {
    // Windows: Use named pipe
    return '\\\\.\\pipe\\fictionlab-workflow-runner';
  } else {
    // Mac/Linux: Use Unix domain socket
    return '/tmp/fictionlab-workflow-runner.sock';
  }
}

/**
 * Execute workflow via IPC connection to FictionLab
 */
async function executeWorkflowViaIPC(
  method: string,
  params?: any,
  timeoutMs: number = 600000 // 10 minutes default
): Promise<IPCResponse> {
  return new Promise((resolve, reject) => {
    const socketPath = getIPCSocketPath();
    const socket = net.createConnection(socketPath);

    let buffer = '';
    let timeoutHandle: NodeJS.Timeout;
    let resolved = false;

    // Set timeout
    timeoutHandle = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        reject(new Error(`Workflow execution timeout after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    // Handle connection
    socket.on('connect', () => {
      console.log('[FictionLab Skill] Connected to FictionLab IPC server');

      const request: IPCRequest = { method, params };
      socket.write(JSON.stringify(request) + '\n');
    });

    // Handle data
    socket.on('data', (data) => {
      buffer += data.toString();

      // Process complete JSON messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const response: IPCResponse = JSON.parse(line);

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutHandle);
            socket.end();
            resolve(response);
          }
        } catch (error) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutHandle);
            socket.destroy();
            reject(new Error(`Invalid JSON response: ${line}`));
          }
        }
      }
    });

    // Handle errors
    socket.on('error', (err: NodeJS.ErrnoException) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutHandle);

        if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
          reject(
            new Error(
              'FictionLab app is not running. Please start FictionLab and try again.'
            )
          );
        } else {
          reject(new Error(`IPC connection error: ${err.message}`));
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
 * Main skill handler
 */
export default {
  name: 'run-workflow',
  description: 'Execute FictionLab workflows from your IDE',

  async execute(args: string[]): Promise<void> {
    try {
      // Parse arguments
      const command = args[0];

      if (!command) {
        console.log(`
FictionLab Workflow Runner

Usage:
  list                    List all available workflows
  get <workflow-id>       Get workflow definition
  execute <workflow-id>   Execute a workflow

Examples:
  list
  get 12-phase-novel-pipeline
  execute 12-phase-novel-pipeline

Options:
  --version <version>     Workflow version (default: latest)
  --workspace <path>      Workspace root directory (default: current directory)
  --variables <json>      Initial variables as JSON string

Full example:
  execute 12-phase-novel-pipeline \\
    --workspace /path/to/project \\
    --variables '{"genre":"Urban Fantasy","targetWordCount":80000}'
        `);
        return;
      }

      switch (command) {
        case 'list':
          await handleListWorkflows();
          break;

        case 'get':
          await handleGetWorkflow(args[1], args);
          break;

        case 'execute':
          await handleExecuteWorkflow(args[1], args);
          break;

        default:
          console.error(`Unknown command: ${command}`);
          console.log('Run without arguments to see usage.');
      }
    } catch (error) {
      console.error('Skill execution error:', error);
      throw error;
    }
  }
};

/**
 * List all available workflows
 */
async function handleListWorkflows(): Promise<void> {
  console.log('Fetching workflows from FictionLab...\n');

  const response = await executeWorkflowViaIPC('workflow:list', {
    filters: {}
  });

  if (response.error) {
    throw new Error(`Failed to list workflows: ${response.error}`);
  }

  const workflows = response as any;

  if (!workflows || workflows.length === 0) {
    console.log('No workflows found.');
    return;
  }

  console.log(`Found ${workflows.length} workflow(s):\n`);

  for (const workflow of workflows) {
    console.log(`  ${workflow.id} (v${workflow.version})`);
    console.log(`    ${workflow.description || 'No description'}`);
    console.log(`    Nodes: ${workflow.nodeCount || 'N/A'}`);
    console.log('');
  }
}

/**
 * Get workflow definition
 */
async function handleGetWorkflow(workflowId: string, args: string[]): Promise<void> {
  if (!workflowId) {
    throw new Error('Workflow ID is required. Usage: get <workflow-id>');
  }

  const version = getArgValue(args, '--version') || 'latest';

  console.log(`Fetching workflow: ${workflowId} (v${version})...\n`);

  const response = await executeWorkflowViaIPC('workflow:get', {
    id: workflowId,
    version: version
  });

  if (response.error) {
    throw new Error(`Failed to get workflow: ${response.error}`);
  }

  console.log('Workflow Definition:');
  console.log(JSON.stringify(response, null, 2));
}

/**
 * Execute a workflow
 */
async function handleExecuteWorkflow(workflowId: string, args: string[]): Promise<void> {
  if (!workflowId) {
    throw new Error('Workflow ID is required. Usage: execute <workflow-id>');
  }

  const version = getArgValue(args, '--version');
  const workspace = getArgValue(args, '--workspace') || process.cwd();
  const variablesStr = getArgValue(args, '--variables');

  let initialVariables: Record<string, any> = {};
  if (variablesStr) {
    try {
      initialVariables = JSON.parse(variablesStr);
    } catch (error) {
      throw new Error('Invalid --variables JSON. Must be valid JSON object.');
    }
  }

  const options: WorkflowExecutionOptions = {
    workflowId,
    version,
    workspaceRoot: workspace,
    initialVariables
  };

  console.log('Executing workflow...');
  console.log(`  Workflow: ${workflowId}`);
  console.log(`  Version: ${version || 'latest'}`);
  console.log(`  Workspace: ${workspace}`);
  if (Object.keys(initialVariables).length > 0) {
    console.log(`  Variables: ${JSON.stringify(initialVariables)}`);
  }
  console.log('');

  // Execute with 10-minute timeout
  const response = await executeWorkflowViaIPC(
    'workflow:execute',
    {
      workflowId: options.workflowId,
      options: {
        version: options.version,
        workspaceRoot: options.workspaceRoot,
        initialVariables: options.initialVariables
      }
    },
    600000 // 10 minutes
  );

  if (response.error) {
    throw new Error(`Workflow execution failed: ${response.error}`);
  }

  const result = response as WorkflowExecutionResult;

  console.log('\n' + '='.repeat(70));
  console.log('WORKFLOW EXECUTION RESULT');
  console.log('='.repeat(70));

  if (result.success) {
    console.log('Status: SUCCESS');
    console.log(`Instance ID: ${result.instanceId}`);

    if (result.completedNodes && result.completedNodes.length > 0) {
      console.log(`\nCompleted Nodes (${result.completedNodes.length}):`);
      for (const nodeId of result.completedNodes) {
        console.log(`  - ${nodeId}`);
      }
    }

    if (result.outputs && Object.keys(result.outputs).length > 0) {
      console.log('\nOutput Variables:');
      for (const [key, value] of Object.entries(result.outputs)) {
        const preview = typeof value === 'string' && value.length > 100
          ? value.substring(0, 100) + '...'
          : JSON.stringify(value);
        console.log(`  ${key}: ${preview}`);
      }
    }
  } else {
    console.log('Status: FAILED');
    console.log(`Instance ID: ${result.instanceId || 'N/A'}`);

    if (result.failedNode) {
      console.log(`Failed Node: ${result.failedNode}`);
    }

    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
  }

  console.log('='.repeat(70) + '\n');
}

/**
 * Helper: Get argument value by flag
 */
function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}
