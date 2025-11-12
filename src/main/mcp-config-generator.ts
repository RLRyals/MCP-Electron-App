/**
 * MCP Config Generator Module
 * Generates mcp-config.json for TypingMind Connector based on discovered MCP servers
 * Implements the TypingMind recommended configuration approach
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { logWithCategory, LogCategory } from './logger';
import * as envConfig from './env-config';
import { discoverMCPServers } from './typingmind-auto-config';

/**
 * MCP Server configuration for a single server
 */
export interface MCPServerConfig {
  command?: string;
  args?: string[];
  env?: {
    [key: string]: string;
  };
  url?: string; // URL for HTTP/SSE mode
}

/**
 * MCP Servers configuration object (TypingMind format)
 */
export interface MCPConfigFile {
  mcpServers: {
    [serverName: string]: MCPServerConfig;
  };
}

/**
 * Get the path to the generated mcp-config.json file
 * This file will be mounted as a volume in Docker
 */
export function getMCPConfigPath(): string {
  const userDataPath = app.getPath('userData');
  // Store in a config directory for clarity
  const configDir = path.join(userDataPath, 'config');
  return path.join(configDir, 'mcp-config.json');
}

/**
 * Generate MCP config file for TypingMind Connector
 * This creates a configuration file that lists all MCP servers with their endpoints
 *
 * The current architecture uses HTTP/SSE where each MCP server is accessed via
 * a URL endpoint (e.g., http://localhost:3000/book-planning-server)
 *
 * This function generates a config file compatible with TypingMind's recommendation
 * while maintaining compatibility with the existing HTTP/SSE architecture.
 */
export async function generateMCPConfig(): Promise<{ success: boolean; configPath?: string; error?: string }> {
  logWithCategory('info', LogCategory.SYSTEM, 'Generating MCP configuration file...');

  try {
    // Discover all available MCP servers
    const servers = await discoverMCPServers();

    if (servers.length === 0) {
      logWithCategory('warn', LogCategory.SYSTEM, 'No MCP servers discovered. Config file will be empty.');
    }

    // Load environment configuration to get the HTTP/SSE port
    const config = await envConfig.loadEnvConfig();
    const httpSsePort = config.HTTP_SSE_PORT || 3000;

    // Build the configuration object
    const mcpConfig: MCPConfigFile = {
      mcpServers: {}
    };

    // Add each discovered server with its URL endpoint
    // In the HTTP/SSE architecture, all servers are accessed through the same port
    // with different path endpoints (e.g., /book-planning-server)
    for (const serverName of servers) {
      mcpConfig.mcpServers[serverName] = {
        url: `http://localhost:${httpSsePort}/${serverName}`
      };
      logWithCategory('info', LogCategory.SYSTEM, `Added MCP server: ${serverName} -> http://localhost:${httpSsePort}/${serverName}`);
    }

    // Always include author-server (it has a special endpoint)
    if (!mcpConfig.mcpServers['author-server']) {
      mcpConfig.mcpServers['author-server'] = {
        url: `http://localhost:${httpSsePort}/author-server`
      };
      logWithCategory('info', LogCategory.SYSTEM, `Added MCP server: author-server -> http://localhost:${httpSsePort}/author-server`);
    }

    // Ensure the config directory exists
    const configPath = getMCPConfigPath();
    const configDir = path.dirname(configPath);
    await fs.ensureDir(configDir);

    // Write the config file
    await fs.writeJson(configPath, mcpConfig, { spaces: 2 });
    logWithCategory('info', LogCategory.SYSTEM, `MCP config file generated at: ${configPath}`);
    logWithCategory('info', LogCategory.SYSTEM, `This file will be mounted in Docker as a volume`);

    return {
      success: true,
      configPath: configPath
    };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error generating MCP config file', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

/**
 * Load the current MCP config file
 */
export async function loadMCPConfig(): Promise<MCPConfigFile | null> {
  const configPath = getMCPConfigPath();

  try {
    if (!await fs.pathExists(configPath)) {
      logWithCategory('info', LogCategory.SYSTEM, 'MCP config file not found');
      return null;
    }

    const config: MCPConfigFile = await fs.readJson(configPath);
    logWithCategory('info', LogCategory.SYSTEM, `Loaded MCP config with ${Object.keys(config.mcpServers).length} server(s)`);
    return config;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error loading MCP config file', error);
    return null;
  }
}

/**
 * Validate MCP config file
 * Ensures the config file has the correct structure
 */
export function validateMCPConfig(config: any): { valid: boolean; error?: string } {
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

    const sc = serverConfig as MCPServerConfig;

    // Server must have either a URL or a command
    if (!sc.url && !sc.command) {
      return { valid: false, error: `Server "${serverName}" must have either "url" or "command"` };
    }
  }

  return { valid: true };
}

/**
 * Get configuration instructions for TypingMind
 * Returns formatted instructions for manual setup
 */
export async function getMCPConfigInstructions(): Promise<string> {
  const config = await envConfig.loadEnvConfig();
  const configPath = getMCPConfigPath();
  const mcpConfig = await loadMCPConfig();

  const serverCount = mcpConfig ? Object.keys(mcpConfig.mcpServers).length : 0;
  const serverList = mcpConfig ? Object.keys(mcpConfig.mcpServers).join(', ') : 'None';

  const instructions = `
TypingMind MCP Connector Setup Instructions
===========================================

## Step 1: Verify MCP Config File
Location: ${configPath}
Servers configured: ${serverCount}
Available servers: ${serverList}

## Step 2: Configure TypingMind
1. Open TypingMind in your browser at: http://localhost:${config.TYPING_MIND_PORT}
2. Go to Settings → Advanced Settings → Model Context Protocol
3. Select: "Remote Server"
4. Enter the following:
   - Server URL: http://localhost:${config.MCP_CONNECTOR_PORT}
   - Authentication Token: ${config.MCP_AUTH_TOKEN.substring(0, 16)}...

## Step 3: Connect and Test
1. Click "Connect" in TypingMind
2. You should see "✓ Connected"
3. Go to the Plugins tab
4. All ${serverCount} MCP servers should appear automatically

## Configuration File Format
The mcp-config.json follows the TypingMind recommended format:
{
  "mcpServers": {
    "server-name": {
      "url": "http://localhost:3000/server-name"
    }
  }
}

## Troubleshooting
- If connection fails, check that Docker containers are running
- Verify the MCP Connector port (${config.MCP_CONNECTOR_PORT}) is accessible
- Check Docker logs for any errors
- Ensure the auth token matches in both .env and TypingMind

For more help, check the application logs.
`;

  return instructions.trim();
}
