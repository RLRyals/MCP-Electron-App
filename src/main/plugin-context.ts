/**
 * Plugin Context Implementation
 *
 * Provides the runtime context that plugins receive during activation.
 * Wraps FictionLab services with permission enforcement and plugin-specific APIs.
 */

import { app, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Pool, PoolClient } from 'pg';
import axios from 'axios';
import {
  PluginContext,
  PluginServices,
  FictionLabDatabase,
  MCPConnectionManager,
  FileSystemService,
  DockerService,
  EnvironmentService,
  WorkspaceInfo,
  PluginIPC,
  PluginUI,
  PluginMetadata,
  PluginConfigStorage,
  PluginLogger,
  PluginManifest,
  PluginPermissions,
  MCPServerInfo,
  FileStats,
  DockerContainer,
  MenuItem,
  Notification,
  DialogOptions,
  DialogResult,
  PluginError,
  PluginErrorType,
} from '../types/plugin-api';
import { logWithCategory, LogCategory } from './logger';

/**
 * Creates a plugin context for a loaded plugin
 */
export function createPluginContext(
  pluginId: string,
  manifest: PluginManifest,
  installPath: string,
  dbPool: Pool,
  onMenuItemRegister?: (pluginId: string, item: MenuItem) => void,
  onNotification?: (notification: Notification) => void
): PluginContext {
  const permissions = manifest.permissions || {};
  const dataPath = path.join(app.getPath('userData'), 'plugins', pluginId);

  // Ensure plugin data directory exists
  fs.ensureDirSync(dataPath);

  const context: PluginContext = {
    services: createPluginServices(pluginId, permissions, dbPool),
    workspace: createWorkspaceInfo(pluginId),
    ipc: createPluginIPC(pluginId),
    ui: createPluginUI(pluginId, onMenuItemRegister, onNotification),
    plugin: createPluginMetadata(pluginId, manifest, installPath, dataPath),
    config: createPluginConfigStorage(pluginId, dataPath),
    logger: createPluginLogger(pluginId),
  };

  return context;
}

/**
 * Creates plugin services with permission enforcement
 */
function createPluginServices(
  pluginId: string,
  permissions: PluginPermissions,
  dbPool: Pool
): PluginServices {
  return {
    database: createDatabaseService(pluginId, permissions, dbPool),
    mcp: createMCPConnectionManager(pluginId, permissions),
    fileSystem: createFileSystemService(pluginId, permissions),
    docker: permissions.docker ? createDockerService(pluginId) : undefined,
    environment: createEnvironmentService(),
  };
}

/**
 * Creates database service with permission enforcement
 */
function createDatabaseService(
  pluginId: string,
  permissions: PluginPermissions,
  pool: Pool
): FictionLabDatabase {
  const pluginSchema = `plugin_${pluginId.replace(/-/g, '_')}`;

  return {
    async query<T = any>(sql: string, params?: any[]): Promise<T> {
      if (!permissions.database) {
        throw new PluginError(
          PluginErrorType.PERMISSION_DENIED,
          pluginId,
          'Database access not permitted'
        );
      }

      // If permissions.database is an array, validate schema access
      if (Array.isArray(permissions.database)) {
        const allowedSchemas = permissions.database;
        const schemaMatch = sql.match(/(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_]*)\./i);

        if (schemaMatch) {
          const schema = schemaMatch[1];
          if (!allowedSchemas.includes(schema) && schema !== pluginSchema) {
            throw new PluginError(
              PluginErrorType.PERMISSION_DENIED,
              pluginId,
              `Access to schema '${schema}' not permitted. Allowed schemas: ${allowedSchemas.join(', ')}, ${pluginSchema}`
            );
          }
        }
      }

      try {
        const result = await pool.query(sql, params);
        return result.rows as T;
      } catch (error: any) {
        logWithCategory('error', LogCategory.SYSTEM, `Plugin ${pluginId} database error:`, error);
        throw error;
      }
    },

    async transaction(callback: (client: PoolClient) => Promise<void>): Promise<void> {
      if (!permissions.database) {
        throw new PluginError(
          PluginErrorType.PERMISSION_DENIED,
          pluginId,
          'Database access not permitted'
        );
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await callback(client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    pool,

    async createPluginSchema(): Promise<void> {
      if (!permissions.database) {
        throw new PluginError(
          PluginErrorType.PERMISSION_DENIED,
          pluginId,
          'Database access not permitted'
        );
      }

      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${pluginSchema}`);
      logWithCategory('info', LogCategory.SYSTEM, `Created schema ${pluginSchema} for plugin ${pluginId}`);
    },

    getPluginSchema(): string {
      return pluginSchema;
    },
  };
}

/**
 * Creates MCP connection manager
 */
function createMCPConnectionManager(
  pluginId: string,
  permissions: PluginPermissions
): MCPConnectionManager {
  const allowedServers = permissions.mcp || [];

  return {
    getEndpoint(serverId: string): string | null {
      if (!allowedServers.includes(serverId)) {
        throw new PluginError(
          PluginErrorType.PERMISSION_DENIED,
          pluginId,
          `Access to MCP server '${serverId}' not permitted. Allowed servers: ${allowedServers.join(', ')}`
        );
      }

      // Map server IDs to ports (hardcoded for now, could be dynamic)
      const serverPorts: Record<string, number> = {
        'workflow-manager': 3012,
        'book-planning': 3001,
        'series-planning': 3002,
        'chapter-planning': 3003,
        'character-planning': 3004,
        'scene': 3005,
        'core-continuity': 3006,
        'review': 3007,
        'reporting': 3008,
        'author': 3009,
      };

      const port = serverPorts[serverId];
      if (!port) {
        return null;
      }

      return `http://localhost:${port}`;
    },

    async callTool<T = any>(
      serverId: string,
      toolName: string,
      args: Record<string, any>
    ): Promise<T> {
      const endpoint = this.getEndpoint(serverId);
      if (!endpoint) {
        throw new PluginError(
          PluginErrorType.PERMISSION_DENIED,
          pluginId,
          `MCP server '${serverId}' not found or not permitted`
        );
      }

      try {
        const requestId = Date.now();
        const response = await axios.post(
          `${endpoint}/api/tool-call`,
          {
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: args,
            },
            id: requestId,
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
          }
        );

        // Handle both JSON-RPC and direct response formats
        const data = response.data;
        if (data.error) {
          throw new Error(`MCP Error: ${data.error.message}`);
        }

        // Extract result from JSON-RPC format or direct format
        const result = data.result || data;
        const content = result.content || result;

        // If content is an array with text items, extract the text
        if (Array.isArray(content) && content.length > 0 && content[0].type === 'text') {
          const textContent = content[0].text;
          try {
            return JSON.parse(textContent) as T;
          } catch {
            return textContent as T;
          }
        }

        return content as T;
      } catch (error: any) {
        logWithCategory('error', LogCategory.SYSTEM, `Plugin ${pluginId} MCP error:`, error);
        throw new Error(`Failed to call MCP tool ${toolName} on ${serverId}: ${error.message}`);
      }
    },

    async isServerRunning(serverId: string): Promise<boolean> {
      const endpoint = this.getEndpoint(serverId);
      if (!endpoint) {
        return false;
      }

      try {
        await axios.get(`${endpoint}/health`, { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    },

    async listServers(): Promise<string[]> {
      return allowedServers;
    },

    async getServerInfo(serverId: string): Promise<MCPServerInfo | null> {
      const endpoint = this.getEndpoint(serverId);
      if (!endpoint) {
        return null;
      }

      try {
        const response = await axios.post(
          `${endpoint}/api/tool-call`,
          {
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: Date.now(),
          },
          { timeout: 5000 }
        );

        const running = await this.isServerRunning(serverId);

        return {
          id: serverId,
          name: serverId,
          endpoint,
          status: running ? 'running' : 'stopped',
          tools: response.data.result?.tools || [],
        };
      } catch (error) {
        return {
          id: serverId,
          name: serverId,
          endpoint,
          status: 'error',
        };
      }
    },
  };
}

/**
 * Creates file system service with permission enforcement
 */
function createFileSystemService(
  pluginId: string,
  permissions: PluginPermissions
): FileSystemService {
  const checkPermission = (write: boolean = false) => {
    if (!permissions.fileSystem) {
      throw new PluginError(
        PluginErrorType.PERMISSION_DENIED,
        pluginId,
        'File system access not permitted'
      );
    }

    if (write && permissions.fileSystem === 'readonly') {
      throw new PluginError(
        PluginErrorType.PERMISSION_DENIED,
        pluginId,
        'File system write access not permitted (readonly mode)'
      );
    }
  };

  return {
    async readFile(filePath: string): Promise<string> {
      checkPermission(false);
      return await fs.readFile(filePath, 'utf-8');
    },

    async writeFile(filePath: string, content: string): Promise<void> {
      checkPermission(true);
      await fs.writeFile(filePath, content, 'utf-8');
    },

    async exists(filePath: string): Promise<boolean> {
      checkPermission(false);
      return await fs.pathExists(filePath);
    },

    async mkdir(filePath: string, recursive: boolean = false): Promise<void> {
      checkPermission(true);
      if (recursive) {
        await fs.ensureDir(filePath);
      } else {
        await fs.mkdir(filePath);
      }
    },

    async readdir(filePath: string): Promise<string[]> {
      checkPermission(false);
      return await fs.readdir(filePath);
    },

    async delete(filePath: string, recursive: boolean = false): Promise<void> {
      checkPermission(true);
      if (recursive) {
        await fs.remove(filePath);
      } else {
        await fs.unlink(filePath);
      }
    },

    async stat(filePath: string): Promise<FileStats> {
      checkPermission(false);
      const stats = await fs.stat(filePath);
      return {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      };
    },
  };
}

/**
 * Creates Docker service (if permitted)
 */
function createDockerService(pluginId: string): DockerService {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  return {
    async listContainers(all: boolean = false): Promise<DockerContainer[]> {
      try {
        const { stdout } = await execAsync(
          `docker ps ${all ? '-a' : ''} --format "{{json .}}"`
        );

        const lines = stdout.trim().split('\n').filter((l: string) => l);
        return lines.map((line: string) => {
          const container = JSON.parse(line);
          return {
            id: container.ID,
            name: container.Names,
            image: container.Image,
            status: container.Status,
            state: container.State,
            ports: container.Ports ? parsePorts(container.Ports) : [],
          };
        });
      } catch (error: any) {
        logWithCategory('error', LogCategory.SYSTEM, `Plugin ${pluginId} Docker error:`, error);
        return [];
      }
    },

    async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
      try {
        const { stdout } = await execAsync(`docker logs --tail ${tail} ${containerId}`);
        return stdout;
      } catch (error: any) {
        throw new Error(`Failed to get logs for container ${containerId}: ${error.message}`);
      }
    },

    async isAvailable(): Promise<boolean> {
      try {
        await execAsync('docker --version');
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Parse Docker port mappings
 */
function parsePorts(portsStr: string): Array<{ internal: number; external?: number }> {
  // Example: "0.0.0.0:5432->5432/tcp"
  const portPattern = /(?:(\d+)->)?(\d+)\/\w+/g;
  const ports: Array<{ internal: number; external?: number }> = [];
  let match;

  while ((match = portPattern.exec(portsStr)) !== null) {
    ports.push({
      internal: parseInt(match[2]),
      external: match[1] ? parseInt(match[1]) : undefined,
    });
  }

  return ports;
}

/**
 * Creates environment service
 */
function createEnvironmentService(): EnvironmentService {
  return {
    get(key: string): string | undefined {
      return process.env[key];
    },

    getUserDataPath(): string {
      return app.getPath('userData');
    },

    getAppVersion(): string {
      return app.getVersion();
    },

    isDevelopment(): boolean {
      return !app.isPackaged;
    },
  };
}

/**
 * Creates workspace info
 */
function createWorkspaceInfo(pluginId: string): WorkspaceInfo {
  const workspaceRoot = app.getPath('userData');
  const pluginDataPath = path.join(workspaceRoot, 'plugins', pluginId);

  return {
    root: workspaceRoot,
    config: {},

    getPluginDataPath(): string {
      return pluginDataPath;
    },
  };
}

/**
 * Creates plugin IPC interface
 */
function createPluginIPC(pluginId: string): PluginIPC {
  const registeredChannels: string[] = [];

  return {
    handle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any): void {
      const fullChannel = `plugin:${pluginId}:${channel}`;
      ipcMain.handle(fullChannel, handler);
      registeredChannels.push(fullChannel);
      logWithCategory('debug', LogCategory.SYSTEM, `Plugin ${pluginId} registered IPC handler: ${fullChannel}`);
    },

    send(channel: string, ...args: any[]): void {
      const fullChannel = `plugin:${pluginId}:${channel}`;
      // Would need BrowserWindow reference to send
      // This is a simplified implementation
      logWithCategory('debug', LogCategory.SYSTEM, `Plugin ${pluginId} sent IPC: ${fullChannel}`);
    },

    removeHandler(channel: string): void {
      const fullChannel = `plugin:${pluginId}:${channel}`;
      ipcMain.removeHandler(fullChannel);
      const index = registeredChannels.indexOf(fullChannel);
      if (index > -1) {
        registeredChannels.splice(index, 1);
      }
    },

    getChannelName(channel: string): string {
      return `plugin:${pluginId}:${channel}`;
    },
  };
}

/**
 * Creates plugin UI interface
 */
function createPluginUI(
  pluginId: string,
  onMenuItemRegister?: (pluginId: string, item: MenuItem) => void,
  onNotification?: (notification: Notification) => void
): PluginUI {
  const registeredMenuItems: string[] = [];

  return {
    registerMenuItem(item: MenuItem): void {
      registeredMenuItems.push(item.id);
      if (onMenuItemRegister) {
        onMenuItemRegister(pluginId, item);
      }
      logWithCategory('info', LogCategory.SYSTEM, `Plugin ${pluginId} registered menu item: ${item.label}`);
    },

    removeMenuItem(itemId: string): void {
      const index = registeredMenuItems.indexOf(itemId);
      if (index > -1) {
        registeredMenuItems.splice(index, 1);
      }
    },

    showView(viewId: string): void {
      logWithCategory('info', LogCategory.SYSTEM, `Plugin ${pluginId} requested view: ${viewId}`);
      // Implementation would show the view in the main window
    },

    showNotification(notification: Notification): void {
      if (onNotification) {
        onNotification(notification);
      }
      logWithCategory('info', LogCategory.SYSTEM, `Plugin ${pluginId} notification: ${notification.message}`);
    },

    async showDialog(options: DialogOptions): Promise<DialogResult> {
      // Would use electron.dialog
      logWithCategory('info', LogCategory.SYSTEM, `Plugin ${pluginId} dialog: ${options.title}`);
      return { response: 0 };
    },

    updateStatusBarItem(itemId: string, content: string): void {
      logWithCategory('debug', LogCategory.SYSTEM, `Plugin ${pluginId} status bar update: ${itemId} = ${content}`);
    },
  };
}

/**
 * Creates plugin metadata
 */
function createPluginMetadata(
  pluginId: string,
  manifest: PluginManifest,
  installPath: string,
  dataPath: string
): PluginMetadata {
  return {
    id: pluginId,
    version: manifest.version,
    dataPath,
    installPath,
    manifest,
  };
}

/**
 * Creates plugin configuration storage
 */
function createPluginConfigStorage(pluginId: string, dataPath: string): PluginConfigStorage {
  const configPath = path.join(dataPath, 'config.json');
  let config: Record<string, any> = {};

  // Load existing config
  if (fs.existsSync(configPath)) {
    try {
      config = fs.readJsonSync(configPath);
    } catch (error) {
      logWithCategory('warn', LogCategory.SYSTEM, `Failed to load config for plugin ${pluginId}:`, error);
    }
  }

  const saveConfig = async () => {
    await fs.writeJson(configPath, config, { spaces: 2 });
  };

  return {
    get<T = any>(key: string, defaultValue?: T): T {
      return config[key] !== undefined ? config[key] : defaultValue;
    },

    async set(key: string, value: any): Promise<void> {
      config[key] = value;
      await saveConfig();
    },

    has(key: string): boolean {
      return key in config;
    },

    async delete(key: string): Promise<void> {
      delete config[key];
      await saveConfig();
    },

    all(): Record<string, any> {
      return { ...config };
    },

    async clear(): Promise<void> {
      config = {};
      await saveConfig();
    },
  };
}

/**
 * Creates plugin logger
 */
function createPluginLogger(pluginId: string): PluginLogger {
  const prefix = `[Plugin: ${pluginId}]`;

  return {
    info(message: string, ...args: any[]): void {
      logWithCategory('info', LogCategory.SYSTEM, `${prefix} ${message}`, ...args);
    },

    warn(message: string, ...args: any[]): void {
      logWithCategory('warn', LogCategory.SYSTEM, `${prefix} ${message}`, ...args);
    },

    error(message: string | Error, ...args: any[]): void {
      if (message instanceof Error) {
        logWithCategory('error', LogCategory.SYSTEM, `${prefix} ${message.message}`, message, ...args);
      } else {
        logWithCategory('error', LogCategory.SYSTEM, `${prefix} ${message}`, ...args);
      }
    },

    debug(message: string, ...args: any[]): void {
      if (!app.isPackaged) {
        logWithCategory('debug', LogCategory.SYSTEM, `${prefix} ${message}`, ...args);
      }
    },
  };
}
