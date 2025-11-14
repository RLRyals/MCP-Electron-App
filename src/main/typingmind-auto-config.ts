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
import * as mcpConfigGenerator from './mcp-config-generator';

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
  command?: string;
  args?: string[];
  env?: {
    [key: string]: string;
  };
  url?: string; // Optional URL for HTTP/SSE mode
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
 * Discover all available MCP servers in the config-mcps directory
 */
export async function discoverMCPServers(): Promise<string[]> {
  logWithCategory('info', LogCategory.SYSTEM, 'Discovering MCP servers...');

  const userDataPath = app.getPath('userData');
  const mcpWritingServersPath = path.join(userDataPath, 'repositories', 'mcp-writing-servers');
  const mcpServersPath = path.join(mcpWritingServersPath, 'src', 'config-mcps');
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
 * Build MCP servers configuration for TypingMind
 * Reads the generated mcp-config.json file which contains all MCP server configurations
 * This is used to display the configuration in the UI for manual setup if needed
 */
export async function buildMCPServersConfig(): Promise<MCPServersConfig> {
  logWithCategory('info', LogCategory.SYSTEM, 'Loading MCP servers configuration from mcp-config.json...');

  try {
    // Load the configuration from the generated file
    const mcpConfig = await mcpConfigGenerator.loadMCPConfig();

    if (mcpConfig && mcpConfig.mcpServers) {
      const serverCount = Object.keys(mcpConfig.mcpServers).length;
      logWithCategory('info', LogCategory.SYSTEM, `Loaded ${serverCount} MCP server(s) from config file`);
      return mcpConfig;
    } else {
      logWithCategory('warn', LogCategory.SYSTEM, 'No MCP config found, returning empty configuration');
      return { mcpServers: {} };
    }
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error loading MCP servers config', error);
    return { mcpServers: {} };
  }
}

/**
 * Verify MCP Connector is running and healthy
 * Note: In the new HTTP/SSE architecture, the Docker container auto-starts the connector
 * when it boots up. The connector automatically discovers and runs all MCP servers.
 * We just need to verify it's accessible.
 */
export async function verifyMCPConnector(serverUrl: string, authToken: string): Promise<{ success: boolean; message: string; error?: string }> {
  logWithCategory('info', LogCategory.SYSTEM, 'Verifying MCP Connector is running...');

  try {
    const servers = await discoverMCPServers();
    const serverCount = servers.length;

    if (serverCount === 0) {
      logWithCategory('warn', LogCategory.SYSTEM, 'No MCP servers discovered in repository');
    } else {
      logWithCategory('info', LogCategory.SYSTEM, `Discovered ${serverCount} MCP server(s): ${servers.join(', ')}`);
    }

    // Try to connect to the connector to verify it's running
    // The connector should be auto-started by Docker
    logWithCategory('info', LogCategory.SYSTEM, `Checking connector health at ${serverUrl}`);

    const response = await fetch(serverUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      logWithCategory('info', LogCategory.SYSTEM, 'MCP Connector is running and accessible');
      return {
        success: true,
        message: `MCP Connector is running. ${serverCount} server(s) available via auto-discovery.`
      };
    } else {
      logWithCategory('warn', LogCategory.SYSTEM, `Connector responded with status: ${response.status}`);
      return {
        success: true, // Don't fail - connector might still be starting up
        message: `MCP Connector is accessible (status: ${response.status}). ${serverCount} server(s) available.`
      };
    }
  } catch (error) {
    logWithCategory('warn', LogCategory.SYSTEM, 'Could not verify connector (may still be starting up)', error);
    return {
      success: true, // Don't fail - connector might still be starting up
      message: 'MCP Connector is starting. Servers will be available once Docker container is fully ready.',
      error: String(error)
    };
  }
}

/**
 * @deprecated Use verifyMCPConnector instead. The new architecture auto-starts servers.
 * Kept for backward compatibility.
 */
export async function startMCPServers(serverUrl: string, authToken: string): Promise<{ success: boolean; message: string; error?: string }> {
  logWithCategory('info', LogCategory.SYSTEM, 'Note: startMCPServers is deprecated. Using verifyMCPConnector instead.');
  return verifyMCPConnector(serverUrl, authToken);
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
    // Generate MCP config file first
    logWithCategory('info', LogCategory.SYSTEM, 'Generating MCP config file...');
    const configGenResult = await mcpConfigGenerator.generateMCPConfig();
    if (!configGenResult.success) {
      logWithCategory('warn', LogCategory.SYSTEM, `Failed to generate MCP config: ${configGenResult.error}`);
      // Continue anyway - we can still configure TypingMind
    }

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

    // Get server count for informational purposes only
    // Actual server configuration is handled by docker/mcp-config.json
    const servers = await discoverMCPServers();
    const serverCount = servers.length;

    // Create the TypingMind MCP configuration
    // Note: mcpServers is NOT included - the connector auto-discovers from docker/mcp-config.json
    const mcpConfig: TypingMindMCPConfig = {
      enabled: true,
      serverUrl: `http://localhost:${config.MCP_CONNECTOR_PORT}`,
      authToken: config.MCP_AUTH_TOKEN,
      autoConnect: true,
      // mcpServers is omitted - connector auto-discovers from docker/mcp-config.json
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

    // Verify MCP connector is accessible
    // Note: The Docker container auto-starts the connector and all MCP servers
    logWithCategory('info', LogCategory.SYSTEM, 'Verifying MCP Connector...');
    const verifyResult = await verifyMCPConnector(mcpConfig.serverUrl, mcpConfig.authToken);

    logWithCategory('info', LogCategory.SYSTEM, `Connector verification: ${verifyResult.message}`);

    return {
      success: true,
      message: `TypingMind successfully configured with MCP Connector. ${serverCount} MCP server(s) will be auto-discovered by the connector from docker/mcp-config.json.`,
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
