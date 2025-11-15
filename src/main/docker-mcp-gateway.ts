/**
 * Docker MCP Gateway Module
 * Manages Docker Desktop MCP Toolkit integration for Claude Desktop
 *
 * The Docker MCP Gateway acts as a central router between Claude Desktop
 * and MCP servers running in Docker containers, providing secure and
 * reproducible connections.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logWithCategory, LogCategory } from './logger';

const execFileAsync = promisify(execFile);

/**
 * Gateway configuration interface
 */
export interface GatewayConfig {
  enabled: boolean;
  status: 'not_configured' | 'configured' | 'running' | 'error';
  lastChecked?: string;
  error?: string;
}

/**
 * Gateway setup result interface
 */
export interface GatewaySetupResult {
  success: boolean;
  message: string;
  error?: string;
  configPath?: string;
}

/**
 * Check if Docker MCP toolkit is available
 */
export async function isDockerMCPAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('docker', ['mcp', '--version'], {
      timeout: 5000
    });

    logWithCategory('info', LogCategory.SYSTEM, 'Docker MCP toolkit is available', { version: stdout.trim() });
    return true;
  } catch (error) {
    logWithCategory('warn', LogCategory.SYSTEM, 'Docker MCP toolkit not available', error);
    return false;
  }
}

/**
 * Check if Docker MCP Gateway is running
 */
export async function isGatewayRunning(): Promise<boolean> {
  try {
    // Check if the gateway process is running
    const { stdout } = await execFileAsync('docker', ['mcp', 'gateway', 'status'], {
      timeout: 5000
    });

    const isRunning = stdout.toLowerCase().includes('running');
    logWithCategory('info', LogCategory.SYSTEM, `Docker MCP Gateway status: ${isRunning ? 'running' : 'stopped'}`);
    return isRunning;
  } catch (error) {
    logWithCategory('warn', LogCategory.SYSTEM, 'Failed to check gateway status', error);
    return false;
  }
}

/**
 * Get Claude Desktop configuration file path
 */
export function getClaudeDesktopConfigPath(): string {
  const platform = os.platform();

  switch (platform) {
    case 'win32':
      return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'linux':
    default:
      return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
}

/**
 * Check if Claude Desktop is configured for Docker MCP
 */
export async function isClaudeDesktopConfigured(): Promise<boolean> {
  try {
    const configPath = getClaudeDesktopConfigPath();

    if (!await fs.pathExists(configPath)) {
      logWithCategory('info', LogCategory.SYSTEM, 'Claude Desktop config file does not exist');
      return false;
    }

    const config = await fs.readJson(configPath);

    // Check if MCP_DOCKER connection exists
    const hasMCPDocker = config.mcpServers && config.mcpServers.MCP_DOCKER;

    logWithCategory('info', LogCategory.SYSTEM, `Claude Desktop MCP_DOCKER configured: ${hasMCPDocker}`);
    return hasMCPDocker;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to check Claude Desktop configuration', error);
    return false;
  }
}

/**
 * Get current gateway configuration
 */
export async function getGatewayConfig(): Promise<GatewayConfig> {
  try {
    const available = await isDockerMCPAvailable();

    if (!available) {
      return {
        enabled: false,
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        error: 'Docker MCP toolkit not installed'
      };
    }

    const running = await isGatewayRunning();
    const configured = await isClaudeDesktopConfigured();

    let status: GatewayConfig['status'] = 'not_configured';
    if (configured && running) {
      status = 'running';
    } else if (configured) {
      status = 'configured';
    }

    return {
      enabled: configured,
      status,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to get gateway config', error);

    return {
      enabled: false,
      status: 'error',
      lastChecked: new Date().toISOString(),
      error: errorMsg
    };
  }
}

/**
 * Start the Docker MCP Gateway
 */
export async function startGateway(): Promise<GatewaySetupResult> {
  try {
    // Check if Docker MCP is available
    const available = await isDockerMCPAvailable();
    if (!available) {
      return {
        success: false,
        message: 'Docker MCP toolkit is not installed',
        error: 'Please install Docker Desktop with MCP Toolkit support'
      };
    }

    // Check if already running
    const running = await isGatewayRunning();
    if (running) {
      return {
        success: true,
        message: 'Docker MCP Gateway is already running'
      };
    }

    logWithCategory('info', LogCategory.SYSTEM, 'Starting Docker MCP Gateway...');

    // Start the gateway (this runs in the background)
    const { stdout, stderr } = await execFileAsync('docker', ['mcp', 'gateway', 'run'], {
      timeout: 30000
    });

    logWithCategory('info', LogCategory.SYSTEM, 'Docker MCP Gateway started', { stdout, stderr });

    // Verify it's running
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    const isRunning = await isGatewayRunning();

    if (isRunning) {
      return {
        success: true,
        message: 'Docker MCP Gateway started successfully'
      };
    } else {
      return {
        success: false,
        message: 'Gateway started but verification failed',
        error: 'The gateway process started but status check failed'
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to start Docker MCP Gateway', error);

    return {
      success: false,
      message: 'Failed to start Docker MCP Gateway',
      error: errorMsg
    };
  }
}

/**
 * Stop the Docker MCP Gateway
 */
export async function stopGateway(): Promise<GatewaySetupResult> {
  try {
    logWithCategory('info', LogCategory.SYSTEM, 'Stopping Docker MCP Gateway...');

    const { stdout, stderr } = await execFileAsync('docker', ['mcp', 'gateway', 'stop'], {
      timeout: 10000
    });

    logWithCategory('info', LogCategory.SYSTEM, 'Docker MCP Gateway stopped', { stdout, stderr });

    return {
      success: true,
      message: 'Docker MCP Gateway stopped successfully'
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to stop Docker MCP Gateway', error);

    return {
      success: false,
      message: 'Failed to stop Docker MCP Gateway',
      error: errorMsg
    };
  }
}

/**
 * Get setup instructions for Docker MCP Gateway
 */
export function getSetupInstructions(): string {
  const platform = os.platform();
  const configPath = getClaudeDesktopConfigPath();

  return `
# Docker MCP Gateway Setup Instructions

The Docker MCP Gateway provides a streamlined way to connect Claude Desktop to your MCP servers running in Docker containers.

## Prerequisites

1. **Docker Desktop** with MCP Toolkit support installed
   - Download from: https://www.docker.com/products/docker-desktop/
   - Ensure Docker Desktop is running

2. **Claude Desktop** installed
   - Download from: https://www.anthropic.com/claude
   - Install and sign in with your Anthropic account

## Setup Steps

### Step 1: Select Claude Desktop as Client

In Docker Desktop settings:
1. Open Docker Desktop
2. Go to Settings → Resources → MCP Toolkit
3. Select "Claude Desktop" as the MCP client
4. Click "Apply & Restart"

### Step 2: Restart Claude Desktop

After selecting Claude Desktop in Docker Desktop, **restart Claude Desktop** to ensure it can access the MCP Toolkit servers.

### Step 3: Start Your MCP Servers

Use the MCP Electron App to start your MCP Writing Servers:
1. Open the MCP Electron App
2. Click "Start System"
3. Wait for all services to show "healthy" status

### Step 4: Start the Docker MCP Gateway

The gateway acts as a central router between Claude Desktop and your MCP servers.

**Option A: Using this app (recommended)**
- Click the "Start Docker MCP Gateway" button in the app

**Option B: Using terminal**
\`\`\`bash
docker mcp gateway run
\`\`\`

This command will:
- Start the MCP Gateway service
- Connect to your running MCP servers
- Make them available to Claude Desktop

### Step 5: Verify the Connection

1. Open Claude Desktop
2. Go to Settings (or Preferences)
3. Look for the MCP section
4. Verify that "MCP_DOCKER" connection is listed and active

You can also check the configuration file directly:
- Location: ${configPath}
- Should contain an "MCP_DOCKER" entry in the "mcpServers" section

### Step 6: Test the Setup

In Claude Desktop, try interacting with your MCP servers:

1. Start a new conversation
2. Test with a prompt like:
   - "What MCP servers are available?"
   - "Show me my book planning outline"
   - "List my characters"

## Troubleshooting

### Gateway won't start

1. Ensure Docker Desktop is running
2. Check that your MCP servers are running (green status in the app)
3. Try stopping and restarting Docker Desktop
4. Check Docker Desktop logs for errors

### Claude Desktop doesn't see MCP_DOCKER

1. Completely close Claude Desktop (check system tray/menu bar)
2. Restart the gateway: \`docker mcp gateway stop\` then \`docker mcp gateway run\`
3. Reopen Claude Desktop
4. Wait 10-15 seconds for the connection to establish

### Services show as unavailable

1. Check that all MCP Writing Servers are running (green in the app)
2. Verify ports are not blocked by firewall
3. Check Docker container logs: \`docker logs mcp-writing-servers\`

## Manual Configuration (Alternative Method)

If the Docker MCP Gateway doesn't work, you can manually configure Claude Desktop:

1. Open: ${configPath}
2. Add your MCP servers manually (see docs/CLAUDE_DESKTOP_MANUAL_CONFIG.md)
3. Restart Claude Desktop

## Next Steps

Once connected:
- Your MCP Writing Servers are available in Claude Desktop
- All 9 servers are accessible (book-planning, series-planning, etc.)
- Data is shared with TypingMind if you have both installed
- Changes in one client appear in the other

## Resources

- Docker MCP Toolkit: https://docs.docker.com/ai/mcp-catalog-and-toolkit/
- MCP Documentation: https://modelcontextprotocol.io/
- Claude Desktop: https://www.anthropic.com/claude
`;
}

/**
 * Export gateway status for IPC
 */
export async function getGatewayStatus(): Promise<{
  available: boolean;
  running: boolean;
  configured: boolean;
  configPath: string;
}> {
  const available = await isDockerMCPAvailable();
  const running = available ? await isGatewayRunning() : false;
  const configured = available ? await isClaudeDesktopConfigured() : false;

  return {
    available,
    running,
    configured,
    configPath: getClaudeDesktopConfigPath()
  };
}
