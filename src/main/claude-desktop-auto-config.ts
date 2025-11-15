/**
 * Claude Desktop Auto-Configuration Module
 * Automatically configures Claude Desktop with MCP server settings for seamless integration
 *
 * Generates claude_desktop_config.json at platform-specific locations:
 * - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
 * - Windows: %APPDATA%\Claude\claude_desktop_config.json
 * - Linux: ~/.config/Claude/claude_desktop_config.json
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import * as os from 'os';
import { logWithCategory, LogCategory } from './logger';
import * as envConfig from './env-config';

/**
 * MCP Server configuration for stdio mode (Claude Desktop format)
 */
export interface ClaudeDesktopMCPServerConfig {
  command: string;
  args: string[];
  env?: {
    [key: string]: string;
  };
}

/**
 * Claude Desktop configuration file format
 */
export interface ClaudeDesktopConfig {
  mcpServers: {
    [serverName: string]: ClaudeDesktopMCPServerConfig;
  };
}

/**
 * Auto-configuration result
 */
export interface AutoConfigResult {
  success: boolean;
  message: string;
  config?: ClaudeDesktopConfig;
  configPath?: string;
  error?: string;
}

/**
 * MCP server definitions
 * These are the 9 MCP servers that will be configured
 */
const MCP_SERVERS = [
  { name: 'book-planning-server', displayName: 'Book Planning', port: 3001 },
  { name: 'series-planning-server', displayName: 'Series Planning', port: 3002 },
  { name: 'chapter-planning-server', displayName: 'Chapter Planning', port: 3003 },
  { name: 'character-planning-server', displayName: 'Character Planning', port: 3004 },
  { name: 'scene-server', displayName: 'Scene', port: 3005 },
  { name: 'core-continuity-server', displayName: 'Core Continuity', port: 3006 },
  { name: 'review-server', displayName: 'Review', port: 3007 },
  { name: 'reporting-server', displayName: 'Reporting', port: 3008 },
  { name: 'author-server', displayName: 'Author', port: 3009 },
];

/**
 * Get platform-specific Claude Desktop config directory
 */
export function getClaudeDesktopConfigDir(): string {
  const platform = process.platform;
  const homeDir = os.homedir();

  switch (platform) {
    case 'darwin': // macOS
      return path.join(homeDir, 'Library', 'Application Support', 'Claude');

    case 'win32': // Windows
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      return path.join(appData, 'Claude');

    case 'linux': // Linux
      const configHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
      return path.join(configHome, 'Claude');

    default:
      // Fallback to a generic location
      logWithCategory('warn', LogCategory.SYSTEM, `Unknown platform: ${platform}, using fallback config path`);
      return path.join(homeDir, '.claude');
  }
}

/**
 * Get the full path to the Claude Desktop configuration file
 */
export function getClaudeDesktopConfigPath(): string {
  return path.join(getClaudeDesktopConfigDir(), 'claude_desktop_config.json');
}

/**
 * Get the path to Node.js executable
 * Uses the same Node.js that is running Electron
 */
function getNodePath(): string {
  // For Electron, process.execPath points to the Electron binary
  // We need to find the Node.js binary instead

  // Check if we're in development or production
  if (process.env.NODE_ENV === 'development' || app.isPackaged === false) {
    // In development, use the system Node.js
    return process.platform === 'win32' ? 'node.exe' : 'node';
  }

  // In production, Node.js should be available in the system PATH
  // or we can use the Electron's Node.js
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

/**
 * Build Claude Desktop configuration for all MCP servers
 * Uses stdio protocol via TCP bridge (port 8888)
 */
export function buildClaudeDesktopConfig(): ClaudeDesktopConfig {
  logWithCategory('info', LogCategory.SYSTEM, 'Building Claude Desktop configuration for stdio protocol...');

  const nodePath = getNodePath();
  const config: ClaudeDesktopConfig = {
    mcpServers: {}
  };

  // For Claude Desktop, we use the stdio adapter approach
  // Each server gets configured to connect via stdio over TCP using socat or similar
  // The bridge service (Task 4.2) runs on port 8888 and forwards to the appropriate MCP server

  // Option 1: Using npx to run a stdio bridge for each server
  // This assumes the stdio adapter is available as an npm package or locally

  // Option 2: Using TCP-to-stdio bridge (simpler for users)
  // We'll use this approach as it requires less setup from users

  for (const server of MCP_SERVERS) {
    config.mcpServers[server.displayName] = {
      command: nodePath,
      args: [
        '-e',
        // Inline Node.js script that connects to the TCP bridge and forwards stdio
        `
const net = require('net');
const readline = require('readline');

const client = net.createConnection({ port: 8888, host: 'localhost' }, () => {
  console.error('Connected to MCP bridge for ${server.displayName}');
});

// Forward stdin to TCP socket
process.stdin.on('data', (data) => {
  client.write(data);
});

// Forward TCP socket to stdout
client.on('data', (data) => {
  process.stdout.write(data);
});

client.on('error', (err) => {
  console.error('Bridge connection error:', err.message);
  process.exit(1);
});

client.on('end', () => {
  console.error('Bridge connection closed');
  process.exit(0);
});

process.on('SIGTERM', () => {
  client.end();
  process.exit(0);
});
        `.trim()
      ],
      env: {
        MCP_SERVER: server.name.replace('-server', ''),
        MCP_SERVER_PORT: server.port.toString()
      }
    };
  }

  logWithCategory('info', LogCategory.SYSTEM, `Configured ${Object.keys(config.mcpServers).length} MCP servers for Claude Desktop`);

  return config;
}

/**
 * Generate and save Claude Desktop configuration file
 */
export async function autoConfigureClaudeDesktop(): Promise<AutoConfigResult> {
  logWithCategory('info', LogCategory.SYSTEM, 'Auto-configuring Claude Desktop...');

  try {
    // Build the configuration
    const config = buildClaudeDesktopConfig();

    // Get the config file path
    const configPath = getClaudeDesktopConfigPath();
    const configDir = path.dirname(configPath);

    logWithCategory('info', LogCategory.SYSTEM, `Config path: ${configPath}`);

    // Check if directory exists, create if needed
    try {
      await fs.ensureDir(configDir);
      logWithCategory('info', LogCategory.SYSTEM, `Config directory ensured: ${configDir}`);
    } catch (error) {
      logWithCategory('error', LogCategory.SYSTEM, 'Failed to create config directory', error);
      return {
        success: false,
        message: `Failed to create config directory: ${configDir}`,
        error: `Permission denied or invalid path: ${error}`,
      };
    }

    // Check for existing configuration
    let existingConfig: ClaudeDesktopConfig | null = null;
    if (await fs.pathExists(configPath)) {
      try {
        existingConfig = await fs.readJson(configPath);
        logWithCategory('info', LogCategory.SYSTEM, 'Found existing Claude Desktop config, will merge');
      } catch (error) {
        logWithCategory('warn', LogCategory.SYSTEM, 'Existing config file is invalid, will overwrite', error);
      }
    }

    // Merge configurations if there's an existing one
    let finalConfig: ClaudeDesktopConfig;
    if (existingConfig && existingConfig.mcpServers) {
      finalConfig = {
        mcpServers: {
          ...existingConfig.mcpServers,
          ...config.mcpServers
        }
      };
      logWithCategory('info', LogCategory.SYSTEM, 'Merged with existing configuration');
    } else {
      finalConfig = config;
    }

    // Write the configuration file
    try {
      await fs.writeJson(configPath, finalConfig, { spaces: 2 });
      logWithCategory('info', LogCategory.SYSTEM, `Claude Desktop config written to: ${configPath}`);
    } catch (error) {
      logWithCategory('error', LogCategory.SYSTEM, 'Failed to write config file', error);
      return {
        success: false,
        message: 'Failed to write configuration file',
        error: `File write error: ${error}`,
      };
    }

    // Verify the file was written correctly
    try {
      const writtenConfig = await fs.readJson(configPath);
      const isValid = validateClaudeDesktopConfig(writtenConfig);

      if (!isValid.valid) {
        logWithCategory('error', LogCategory.SYSTEM, 'Written config is invalid', isValid.error);
        return {
          success: false,
          message: 'Configuration validation failed',
          error: isValid.error,
        };
      }
    } catch (error) {
      logWithCategory('error', LogCategory.SYSTEM, 'Failed to verify written config', error);
      return {
        success: false,
        message: 'Failed to verify configuration',
        error: String(error),
      };
    }

    const serverCount = Object.keys(finalConfig.mcpServers).length;
    const mcpServerCount = Object.keys(config.mcpServers).length;

    logWithCategory('info', LogCategory.SYSTEM, `Claude Desktop auto-configuration complete: ${mcpServerCount} MCP servers configured`);

    return {
      success: true,
      message: `Claude Desktop configured successfully with ${mcpServerCount} MCP servers. Total servers in config: ${serverCount}`,
      config: finalConfig,
      configPath: configPath,
    };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error auto-configuring Claude Desktop', error);
    return {
      success: false,
      message: 'Failed to auto-configure Claude Desktop',
      error: String(error),
    };
  }
}

/**
 * Load current Claude Desktop configuration
 */
export async function loadClaudeDesktopConfig(): Promise<ClaudeDesktopConfig | null> {
  const configPath = getClaudeDesktopConfigPath();

  try {
    if (!await fs.pathExists(configPath)) {
      logWithCategory('info', LogCategory.SYSTEM, 'No Claude Desktop config found');
      return null;
    }

    const config: ClaudeDesktopConfig = await fs.readJson(configPath);
    logWithCategory('info', LogCategory.SYSTEM, 'Loaded Claude Desktop configuration');
    return config;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error loading Claude Desktop config', error);
    return null;
  }
}

/**
 * Check if Claude Desktop is properly configured
 */
export async function isClaudeDesktopConfigured(): Promise<boolean> {
  const config = await loadClaudeDesktopConfig();

  if (!config || !config.mcpServers) {
    return false;
  }

  // Check if at least some of our MCP servers are configured
  const ourServers = MCP_SERVERS.map(s => s.displayName);
  const configuredServers = Object.keys(config.mcpServers);

  // Check if at least one of our servers is in the config
  const hasOurServers = ourServers.some(serverName =>
    configuredServers.includes(serverName)
  );

  return hasOurServers;
}

/**
 * Validate Claude Desktop configuration
 */
export function validateClaudeDesktopConfig(config: any): { valid: boolean; error?: string } {
  if (!config) {
    return { valid: false, error: 'Config is null or undefined' };
  }

  if (!config.mcpServers) {
    return { valid: false, error: 'Config missing "mcpServers" property' };
  }

  if (typeof config.mcpServers !== 'object') {
    return { valid: false, error: '"mcpServers" must be an object' };
  }

  // Validate each server entry
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    if (typeof serverConfig !== 'object' || serverConfig === null) {
      return { valid: false, error: `Server "${serverName}" config must be an object` };
    }

    const sc = serverConfig as ClaudeDesktopMCPServerConfig;

    // Server must have a command for stdio mode
    if (!sc.command) {
      return { valid: false, error: `Server "${serverName}" must have a "command" property` };
    }

    // Args should be an array if present
    if (sc.args && !Array.isArray(sc.args)) {
      return { valid: false, error: `Server "${serverName}" args must be an array` };
    }
  }

  return { valid: true };
}

/**
 * Reset Claude Desktop configuration
 * Removes only the MCP servers we added, keeps other servers intact
 */
export async function resetClaudeDesktopConfig(): Promise<{ success: boolean; error?: string }> {
  const configPath = getClaudeDesktopConfigPath();

  try {
    if (!await fs.pathExists(configPath)) {
      logWithCategory('info', LogCategory.SYSTEM, 'No Claude Desktop config to reset');
      return { success: true };
    }

    const config = await loadClaudeDesktopConfig();
    if (!config || !config.mcpServers) {
      // Just remove the file if it's invalid
      await fs.remove(configPath);
      logWithCategory('info', LogCategory.SYSTEM, 'Removed invalid Claude Desktop config');
      return { success: true };
    }

    // Remove only our MCP servers
    const ourServers = MCP_SERVERS.map(s => s.displayName);
    const newMcpServers: { [key: string]: ClaudeDesktopMCPServerConfig } = {};

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      if (!ourServers.includes(serverName)) {
        newMcpServers[serverName] = serverConfig;
      }
    }

    // If there are no servers left, remove the file
    if (Object.keys(newMcpServers).length === 0) {
      await fs.remove(configPath);
      logWithCategory('info', LogCategory.SYSTEM, 'Removed Claude Desktop config (no other servers present)');
    } else {
      // Write back the config without our servers
      const updatedConfig: ClaudeDesktopConfig = {
        mcpServers: newMcpServers
      };
      await fs.writeJson(configPath, updatedConfig, { spaces: 2 });
      logWithCategory('info', LogCategory.SYSTEM, 'Reset Claude Desktop config (kept other servers)');
    }

    return { success: true };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error resetting Claude Desktop config', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get configuration instructions for manual setup
 */
export async function getConfigurationInstructions(): Promise<string> {
  const configPath = getClaudeDesktopConfigPath();
  const config = await loadClaudeDesktopConfig();
  const platform = process.platform;

  let platformName = 'Unknown';
  switch (platform) {
    case 'darwin':
      platformName = 'macOS';
      break;
    case 'win32':
      platformName = 'Windows';
      break;
    case 'linux':
      platformName = 'Linux';
      break;
  }

  const serverCount = config ? Object.keys(config.mcpServers).length : 0;
  const ourServerCount = MCP_SERVERS.length;

  const instructions = `
Claude Desktop MCP Configuration Instructions
=============================================

Platform: ${platformName}
Config Location: ${configPath}

Auto-Configuration Status:
- Total MCP Servers: ${serverCount}
- Writing MCP Servers: ${ourServerCount}
- Config File: ${config ? '✓ Exists' : '✗ Not found'}

Setup Instructions:

1. Ensure Docker Services Are Running
   - The MCP servers must be running in Docker
   - The Claude Desktop bridge service must be running on port 8888
   - Start services: docker-compose up -d

2. Auto-Configure (Recommended)
   - Click the "Auto-Configure Claude Desktop" button in the app
   - This will create/update the config file automatically
   - All ${ourServerCount} MCP servers will be configured

3. Manual Configuration (If Needed)
   - Edit: ${configPath}
   - Follow Claude Desktop's MCP documentation
   - Each server uses stdio protocol over TCP bridge

4. Restart Claude Desktop
   - Close Claude Desktop completely
   - Reopen Claude Desktop
   - MCP servers should be available in the tools menu

Available MCP Servers:
${MCP_SERVERS.map((s, i) => `${i + 1}. ${s.displayName} (port ${s.port})`).join('\n')}

Requirements:
- Docker must be running with all MCP services
- Port 8888 must be accessible (Claude Desktop bridge)
- Node.js must be available in system PATH

Troubleshooting:
- If servers don't appear, check Docker logs: docker-compose logs
- Verify bridge is running: docker-compose ps claude-bridge
- Check Claude Desktop logs for connection errors
- Ensure config file has correct JSON format

For more help, check the application logs or documentation.
`;

  return instructions.trim();
}

/**
 * Get the current config for display in UI
 */
export async function getClaudeDesktopConfig(): Promise<ClaudeDesktopConfig | null> {
  return loadClaudeDesktopConfig();
}

/**
 * Check if the config directory has proper write permissions
 */
export async function checkConfigPermissions(): Promise<{ writable: boolean; error?: string }> {
  const configDir = getClaudeDesktopConfigDir();

  try {
    // Try to create the directory
    await fs.ensureDir(configDir);

    // Try to write a test file
    const testFile = path.join(configDir, '.write-test');
    await fs.writeFile(testFile, 'test');
    await fs.remove(testFile);

    return { writable: true };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Config directory not writable', error);
    return {
      writable: false,
      error: `Cannot write to ${configDir}: ${error}`
    };
  }
}

/**
 * Get status information about Claude Desktop configuration
 */
export async function getConfigStatus(): Promise<{
  configured: boolean;
  configPath: string;
  configExists: boolean;
  serverCount: number;
  ourServerCount: number;
  writable: boolean;
  platform: string;
}> {
  const configPath = getClaudeDesktopConfigPath();
  const config = await loadClaudeDesktopConfig();
  const permissions = await checkConfigPermissions();
  const configured = await isClaudeDesktopConfigured();

  return {
    configured,
    configPath,
    configExists: config !== null,
    serverCount: config ? Object.keys(config.mcpServers).length : 0,
    ourServerCount: MCP_SERVERS.length,
    writable: permissions.writable,
    platform: process.platform,
  };
}
