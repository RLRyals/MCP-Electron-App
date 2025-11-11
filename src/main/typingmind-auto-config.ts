/**
 * TypingMind Auto-Configuration Module
 * Automatically configures TypingMind with MCP Connector settings for users
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { logWithCategory, LogCategory } from './logger';
import * as envConfig from './env-config';
import * as typingMindDownloader from './typingmind-downloader';

/**
 * TypingMind MCP configuration interface
 */
export interface TypingMindMCPConfig {
  enabled: boolean;
  serverUrl: string;
  authToken: string;
  autoConnect: boolean;
  mcpServers?: MCPServersConfig;
}

/**
 * MCP Server configuration for a single server
 */
export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: {
    [key: string]: string;
  };
}

/**
 * MCP Servers configuration object
 */
export interface MCPServersConfig {
  mcpServers: {
    [serverName: string]: MCPServerConfig;
  };
}

/**
 * Auto-configuration result
 */
export interface AutoConfigResult {
  success: boolean;
  message: string;
  config?: TypingMindMCPConfig;
  error?: string;
}

/**
 * Get the path to the TypingMind config file
 */
function getTypingMindConfigPath(): string {
  // Store config in a persistent location within the app's user data
  return path.join(app.getPath('userData'), 'typingmind-mcp-config.json');
}

/**
 * Get the MCP Writing Servers repository path
 */
function getMCPWritingServersPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'repositories', 'mcp-writing-servers');
}

/**
 * Discover all available MCP servers in the config-mcps directory
 */
export async function discoverMCPServers(): Promise<string[]> {
  logWithCategory('info', LogCategory.SYSTEM, 'Discovering MCP servers...');

  const mcpServersPath = path.join(getMCPWritingServersPath(), 'src', 'config-mcps');
  const servers: string[] = [];

  try {
    if (!await fs.pathExists(mcpServersPath)) {
      logWithCategory('warn', LogCategory.SYSTEM, `MCP servers directory not found: ${mcpServersPath}`);
      return servers;
    }

    const entries = await fs.readdir(mcpServersPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const indexPath = path.join(mcpServersPath, entry.name, 'index.js');
        if (await fs.pathExists(indexPath)) {
          servers.push(entry.name);
          logWithCategory('info', LogCategory.SYSTEM, `Found MCP server: ${entry.name}`);
        }
      }
    }

    logWithCategory('info', LogCategory.SYSTEM, `Discovered ${servers.length} MCP server(s)`);
    return servers;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error discovering MCP servers', error);
    return servers;
  }
}

/**
 * Build MCP servers configuration JSON with correct paths for all platforms
 * Works on Windows, Mac, and Linux
 */
export async function buildMCPServersConfig(): Promise<MCPServersConfig> {
  logWithCategory('info', LogCategory.SYSTEM, 'Building MCP servers configuration...');

  const servers = await discoverMCPServers();

  // Load environment config to build DATABASE_URL for the container
  const envConf = await envConfig.loadEnvConfig();

  // Build the DATABASE_URL as it appears inside the Docker container
  // The container uses the container name for the postgres host
  const containerName = 'mcp-writing-db'; // Default from docker-compose
  const databaseUrl = `postgresql://${envConf.POSTGRES_USER}:${envConf.POSTGRES_PASSWORD}@${containerName}:${envConf.POSTGRES_PORT}/${envConf.POSTGRES_DB}`;

  const config: MCPServersConfig = {
    mcpServers: {}
  };

  for (const serverName of servers) {
    // All MCP servers run inside the mcp-writing-system Docker container
    // The MCP Connector doesn't pass environment variables to child processes,
    // so we must explicitly provide them in the configuration
    const containerPath = `/app/src/config-mcps/${serverName}/index.js`;

    config.mcpServers[serverName] = {
      command: 'node',
      args: [containerPath],
      env: {
        // Database connection (using container's internal network)
        DATABASE_URL: databaseUrl,
        POSTGRES_HOST: containerName,
        POSTGRES_PORT: String(envConf.POSTGRES_PORT),
        POSTGRES_DB: envConf.POSTGRES_DB,
        POSTGRES_USER: envConf.POSTGRES_USER,
        POSTGRES_PASSWORD: envConf.POSTGRES_PASSWORD,
        // Server configuration
        NODE_ENV: 'development'
      }
    };

    logWithCategory('info', LogCategory.SYSTEM, `Added server config: ${serverName} -> node ${containerPath}`);
  }

  return config;
}

/**
 * Start MCP servers via the MCP Connector /start endpoint
 */
export async function startMCPServers(serverUrl: string, authToken: string): Promise<{ success: boolean; message: string; error?: string }> {
  logWithCategory('info', LogCategory.SYSTEM, 'Starting MCP servers via connector...');

  try {
    const serversConfig = await buildMCPServersConfig();

    if (Object.keys(serversConfig.mcpServers).length === 0) {
      return {
        success: false,
        message: 'No MCP servers found to configure',
        error: 'NO_SERVERS_FOUND'
      };
    }

    logWithCategory('info', LogCategory.SYSTEM, `Calling ${serverUrl}/start with ${Object.keys(serversConfig.mcpServers).length} servers`);

    const response = await fetch(`${serverUrl}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(serversConfig)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logWithCategory('error', LogCategory.SYSTEM, `Failed to start MCP servers: ${response.status} ${errorText}`);
      return {
        success: false,
        message: `Failed to start MCP servers: ${response.statusText}`,
        error: errorText
      };
    }

    await response.json();
    logWithCategory('info', LogCategory.SYSTEM, 'MCP servers started successfully');

    return {
      success: true,
      message: `Successfully started ${Object.keys(serversConfig.mcpServers).length} MCP server(s)`
    };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error starting MCP servers', error);
    return {
      success: false,
      message: 'Failed to start MCP servers',
      error: String(error)
    };
  }
}

/**
 * Load current TypingMind MCP configuration
 */
export async function loadTypingMindConfig(): Promise<TypingMindMCPConfig | null> {
  const configPath = getTypingMindConfigPath();

  try {
    if (!await fs.pathExists(configPath)) {
      logWithCategory('info', LogCategory.SYSTEM, 'No TypingMind MCP config found');
      return null;
    }

    const config: TypingMindMCPConfig = await fs.readJson(configPath);
    logWithCategory('info', LogCategory.SYSTEM, 'Loaded TypingMind MCP configuration');
    return config;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error loading TypingMind config', error);
    return null;
  }
}

/**
 * Save TypingMind MCP configuration
 */
export async function saveTypingMindConfig(config: TypingMindMCPConfig): Promise<{ success: boolean; error?: string }> {
  const configPath = getTypingMindConfigPath();

  try {
    // Ensure directory exists
    const dir = path.dirname(configPath);
    if (!await fs.pathExists(dir)) {
      await fs.mkdirs(dir);
    }

    await fs.writeJson(configPath, config, { spaces: 2 });
    logWithCategory('info', LogCategory.SYSTEM, 'Saved TypingMind MCP configuration');

    return { success: true };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error saving TypingMind config', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Automatically configure TypingMind with current MCP Connector settings
 * This creates a configuration file that can be imported or used by TypingMind
 */
export async function autoConfigureTypingMind(): Promise<AutoConfigResult> {
  logWithCategory('info', LogCategory.SYSTEM, 'Auto-configuring TypingMind with MCP Connector settings...');

  try {
    // Check if TypingMind is installed
    const isInstalled = await typingMindDownloader.isInstalled();
    if (!isInstalled) {
      return {
        success: false,
        message: 'TypingMind is not installed. Please install TypingMind first.',
        error: 'TYPING_MIND_NOT_INSTALLED',
      };
    }

    // Load current environment configuration
    const config = await envConfig.loadEnvConfig();

    // Validate that we have the required settings
    if (!config.MCP_AUTH_TOKEN || config.MCP_AUTH_TOKEN.trim() === '') {
      return {
        success: false,
        message: 'MCP Auth Token is not configured. Please complete environment setup first.',
        error: 'MISSING_AUTH_TOKEN',
      };
    }

    // Build MCP servers configuration
    const serversConfig = await buildMCPServersConfig();

    // Create the TypingMind MCP configuration
    const mcpConfig: TypingMindMCPConfig = {
      enabled: true,
      serverUrl: `http://localhost:${config.MCP_CONNECTOR_PORT}`,
      authToken: config.MCP_AUTH_TOKEN,
      autoConnect: true,
      mcpServers: serversConfig,
    };

    // Save the configuration
    const saveResult = await saveTypingMindConfig(mcpConfig);
    if (!saveResult.success) {
      return {
        success: false,
        message: 'Failed to save TypingMind configuration',
        error: saveResult.error,
      };
    }

    logWithCategory('info', LogCategory.SYSTEM, `TypingMind auto-configured with MCP Connector at ${mcpConfig.serverUrl}`);

    // Start MCP servers via the connector
    logWithCategory('info', LogCategory.SYSTEM, 'Starting MCP servers...');
    const serversResult = await startMCPServers(mcpConfig.serverUrl, mcpConfig.authToken);

    if (!serversResult.success) {
      logWithCategory('warn', LogCategory.SYSTEM, `Failed to start MCP servers: ${serversResult.message}`);
      // Don't fail the whole configuration, just warn the user
      return {
        success: true,
        message: `TypingMind configured, but failed to start MCP servers: ${serversResult.message}. You may need to start them manually.`,
        config: mcpConfig,
      };
    }

    logWithCategory('info', LogCategory.SYSTEM, `MCP servers started: ${serversResult.message}`);

    return {
      success: true,
      message: `TypingMind successfully configured with MCP Connector and ${Object.keys(serversConfig.mcpServers).length} MCP servers`,
      config: mcpConfig,
    };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error auto-configuring TypingMind', error);
    return {
      success: false,
      message: 'Failed to auto-configure TypingMind',
      error: String(error),
    };
  }
}

/**
 * Set custom TypingMind MCP configuration (for manual override)
 * @param serverUrl Custom server URL (e.g., http://localhost:3000)
 * @param authToken Custom auth token
 */
export async function setCustomTypingMindConfig(
  serverUrl: string,
  authToken: string
): Promise<AutoConfigResult> {
  logWithCategory('info', LogCategory.SYSTEM, `Setting custom TypingMind config: ${serverUrl}`);

  try {
    // Validate inputs
    if (!serverUrl || !serverUrl.startsWith('http')) {
      return {
        success: false,
        message: 'Invalid server URL. Must start with http:// or https://',
        error: 'INVALID_URL',
      };
    }

    if (!authToken || authToken.trim() === '') {
      return {
        success: false,
        message: 'Auth token is required',
        error: 'MISSING_AUTH_TOKEN',
      };
    }

    // Create the configuration
    const mcpConfig: TypingMindMCPConfig = {
      enabled: true,
      serverUrl: serverUrl.trim(),
      authToken: authToken.trim(),
      autoConnect: true,
    };

    // Save the configuration
    const saveResult = await saveTypingMindConfig(mcpConfig);
    if (!saveResult.success) {
      return {
        success: false,
        message: 'Failed to save custom TypingMind configuration',
        error: saveResult.error,
      };
    }

    logWithCategory('info', LogCategory.SYSTEM, `Custom TypingMind config saved: ${mcpConfig.serverUrl}`);

    return {
      success: true,
      message: 'Custom TypingMind configuration saved successfully',
      config: mcpConfig,
    };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error setting custom TypingMind config', error);
    return {
      success: false,
      message: 'Failed to set custom configuration',
      error: String(error),
    };
  }
}

/**
 * Generate configuration instructions for manual setup
 * Returns user-friendly instructions for configuring TypingMind manually
 */
export async function getConfigurationInstructions(): Promise<string> {
  const config = await envConfig.loadEnvConfig();
  const mcpConfig = await loadTypingMindConfig();
  const servers = await discoverMCPServers();

  const serverUrl = mcpConfig?.serverUrl || `http://localhost:${config.MCP_CONNECTOR_PORT}`;
  const authToken = mcpConfig?.authToken || config.MCP_AUTH_TOKEN;

  // Mask the auth token for display (show only first 16 characters)
  const displayToken = authToken ? `${authToken.substring(0, 16)}...` : 'Not configured';

  const instructions = `
TypingMind MCP Connector Setup Instructions
===========================================

1. Open TypingMind in your browser at: http://localhost:${config.TYPING_MIND_PORT}

2. Navigate to Settings → MCP Integration (or similar)

3. Enter the following configuration:

   Server URL: ${serverUrl}
   Auth Token: ${displayToken}

   (Copy the full token from the configuration dialog or .env file)

4. Click "Connect" or "Save" to establish the connection

5. You should now be able to use MCP tools within TypingMind!

Auto-Configuration Status:
- Configuration file saved at: ${getTypingMindConfigPath()}
- MCP Servers discovered: ${servers.length}
- Available servers: ${servers.join(', ')}
- Server URL: ${serverUrl}
- Auth Token: ${authToken ? '✓ Configured' : '✗ Not configured'}

Need help? Check the logs or restart the application.
`;

  return instructions.trim();
}

/**
 * Check if TypingMind is properly configured
 */
export async function isTypingMindConfigured(): Promise<boolean> {
  const config = await loadTypingMindConfig();
  return config !== null && config.enabled && !!config.authToken && !!config.serverUrl;
}

/**
 * Reset TypingMind configuration
 */
export async function resetTypingMindConfig(): Promise<{ success: boolean; error?: string }> {
  const configPath = getTypingMindConfigPath();

  try {
    if (await fs.pathExists(configPath)) {
      await fs.remove(configPath);
      logWithCategory('info', LogCategory.SYSTEM, 'TypingMind configuration reset');
    }
    return { success: true };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error resetting TypingMind config', error);
    return { success: false, error: String(error) };
  }
}
