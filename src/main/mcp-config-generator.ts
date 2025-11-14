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
 * Get the MCP Writing Servers repository path
 */
function getMCPWritingServersPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'repositories', 'mcp-writing-servers');
}

/**
 * Get the path to the generated mcp-config.json file
 * This file will be mounted as a volume in Docker
 * Path: ${MCP_WRITING_SERVERS_DIR}/mcp-config/mcp-config.json
 */
export function getMCPConfigPath(): string {
  const mcpServersDir = getMCPWritingServersPath();
  // Docker mounts ${MCP_WRITING_SERVERS_DIR}/mcp-config:/config
  const configDir = path.join(mcpServersDir, 'mcp-config');
  return path.join(configDir, 'mcp-config.json');
}

/**
 * MCP server port mappings
 * These ports match the docker-compose.yml configuration
 */
const MCP_SERVER_PORTS: { [key: string]: number } = {
  'book-planning': 3001,
  'series-planning': 3002,
  'chapter-planning': 3003,
  'character-planning': 3004,
  'scene': 3005,
  'core-continuity': 3006,
  'review': 3007,
  'reporting': 3008,
  'author': 3009
};

/**
 * Generate MCP config file for TypingMind Connector
 * This creates a configuration file that lists all MCP servers with their endpoints
 *
 * The architecture uses Docker networking where each MCP server runs on its own port
 * within the mcp-writing-servers container. The MCP Connector accesses them via
 * http://mcp-writing-servers:${port}/ using the internal Docker network.
 *
 * This function generates a config file compatible with TypingMind's recommendation.
 */
export async function generateMCPConfig(): Promise<{ success: boolean; configPath?: string; error?: string }> {
  logWithCategory('info', LogCategory.SYSTEM, 'Generating MCP configuration file...');

  try {
    // Build the configuration object with predefined servers
    // Using the Docker container hostname for internal network access
    const mcpConfig: MCPConfigFile = {
      mcpServers: {
        'book-planning': {
          url: 'http://mcp-writing-servers:3001/'
        },
        'series-planning': {
          url: 'http://mcp-writing-servers:3002/'
        },
        'chapter-planning': {
          url: 'http://mcp-writing-servers:3003/'
        },
        'character-planning': {
          url: 'http://mcp-writing-servers:3004/'
        },
        'scene': {
          url: 'http://mcp-writing-servers:3005/'
        },
        'core-continuity': {
          url: 'http://mcp-writing-servers:3006/'
        },
        'review': {
          url: 'http://mcp-writing-servers:3007/'
        },
        'reporting': {
          url: 'http://mcp-writing-servers:3008/'
        },
        'author': {
          url: 'http://mcp-writing-servers:3009/'
        }
      }
    };

    // Log each configured server
    for (const [serverName, config] of Object.entries(mcpConfig.mcpServers)) {
      logWithCategory('info', LogCategory.SYSTEM, `Added MCP server: ${serverName} -> ${config.url}`);
    }

    logWithCategory('info', LogCategory.SYSTEM, `Configured ${Object.keys(mcpConfig.mcpServers).length} MCP server(s)`);

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
