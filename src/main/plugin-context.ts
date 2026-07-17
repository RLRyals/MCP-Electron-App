/**
 * Plugin Context Implementation
 *
 * Provides the runtime context that plugins receive during activation.
 * Wraps FictionLab services with permission enforcement and plugin-specific APIs.
 */

import { app, ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Pool, PoolClient } from 'pg';
import axios from 'axios';
import { PersistentMCPClient } from './workflow/persistent-mcp-client';
import { recordHandler, unrecordHandler } from './ipc-registry';

// Singleton instance of PersistentMCPClient for workflow-manager stdio communication
let workflowMCPClient: PersistentMCPClient | null = null;
let workflowMCPClientStartPromise: Promise<void> | null = null;

/**
 * Get or create the singleton PersistentMCPClient for workflow-manager
 * Uses stdio for low-latency communication per architecture spec
 */
async function getWorkflowMCPClient(): Promise<PersistentMCPClient> {
  if (workflowMCPClient && workflowMCPClient.isReady()) {
    return workflowMCPClient;
  }

  if (workflowMCPClientStartPromise) {
    await workflowMCPClientStartPromise;
    if (workflowMCPClient) {
      return workflowMCPClient;
    }
  }

  workflowMCPClient = new PersistentMCPClient();
  workflowMCPClientStartPromise = workflowMCPClient.start();

  try {
    await workflowMCPClientStartPromise;
    logWithCategory('info', LogCategory.SYSTEM, 'PersistentMCPClient started for workflow-manager stdio communication');
    return workflowMCPClient;
  } catch (error: any) {
    workflowMCPClient = null;
    workflowMCPClientStartPromise = null;
    throw error;
  }
}

// Singleton instance of PersistentMCPClient for kanban-server stdio communication.
// Same stdio-first treatment workflow-manager gets (S11 §4a / GH issue #179 §2:
// "give kanban the same stdio treatment workflow-manager gets... rather than the
// HTTP /api/tool-call branch"). A second singleton pair, mirroring
// workflowMCPClient/getWorkflowMCPClient() above, rather than generalizing a
// shared cache keyed by serverId -- called out in the issue as an acceptable v1
// shortcut ("a minimally-duplicated second PersistentMCPClient instance").
let kanbanMCPClient: PersistentMCPClient | null = null;
let kanbanMCPClientStartPromise: Promise<void> | null = null;

/**
 * Get or create the singleton PersistentMCPClient for kanban-server.
 * Uses stdio for low-latency communication, same as workflow-manager.
 */
async function getKanbanMCPClient(): Promise<PersistentMCPClient> {
  if (kanbanMCPClient && kanbanMCPClient.isReady()) {
    return kanbanMCPClient;
  }

  if (kanbanMCPClientStartPromise) {
    await kanbanMCPClientStartPromise;
    if (kanbanMCPClient) {
      return kanbanMCPClient;
    }
  }

  kanbanMCPClient = new PersistentMCPClient('kanban-server');
  kanbanMCPClientStartPromise = kanbanMCPClient.start();

  try {
    await kanbanMCPClientStartPromise;
    logWithCategory('info', LogCategory.SYSTEM, 'PersistentMCPClient started for kanban-server stdio communication');
    return kanbanMCPClient;
  } catch (error: any) {
    kanbanMCPClient = null;
    kanbanMCPClientStartPromise = null;
    throw error;
  }
}

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
  PluginMenuItem,
  PluginNotification,
  DialogOptions,
  DialogResult,
  PluginError,
  PluginErrorType,
  WorkflowService,
  WorkflowImportResult,
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
  onMenuItemRegister?: (pluginId: string, item: PluginMenuItem) => void,
  onNotification?: (notification: PluginNotification) => void
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
    workflow: createWorkflowService(pluginId, permissions),
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
  // Handle both array format (mcp: ["server1", "server2"])
  // and object format (mcp: { enabled: true, servers: ["server1"] })
  let allowedServers: string[] = [];
  if (Array.isArray(permissions.mcp)) {
    allowedServers = permissions.mcp;
  } else if (permissions.mcp && typeof permissions.mcp === 'object') {
    const mcpConfig = permissions.mcp as any;
    if (mcpConfig.enabled && Array.isArray(mcpConfig.servers)) {
      allowedServers = mcpConfig.servers;
    }
  }

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
        'outline': 3013,
        'kanban': 3015,
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
      // Check permission first
      if (!allowedServers.includes(serverId)) {
        throw new PluginError(
          PluginErrorType.PERMISSION_DENIED,
          pluginId,
          `MCP server '${serverId}' not permitted. Allowed servers: ${allowedServers.join(', ')}`
        );
      }

      // Use stdio (PersistentMCPClient) for workflow-manager - per architecture spec
      if (serverId === 'workflow-manager') {
        try {
          // Fix for MCP server bug: when version is 'latest', omit it entirely
          // The server incorrectly concatenates "id vlatest" instead of treating them separately
          let fixedArgs = args;
          if (toolName === 'get_workflow_definition' && args.version === 'latest') {
            fixedArgs = { ...args };
            delete fixedArgs.version;
            logWithCategory('debug', LogCategory.SYSTEM,
              `Removed 'latest' version from get_workflow_definition call to avoid MCP server bug`);
          }

          logWithCategory('info', LogCategory.SYSTEM,
            `Plugin ${pluginId} calling workflow-manager tool via stdio: ${toolName}`, fixedArgs);

          const client = await getWorkflowMCPClient();
          const result = await client.callTool(toolName, fixedArgs);

          logWithCategory('info', LogCategory.SYSTEM,
            `Plugin ${pluginId} workflow-manager result for ${toolName}:`,
            `type=${typeof result}, isArray=${Array.isArray(result)}, value=${JSON.stringify(result).substring(0, 300)}`);

          return result as T;
        } catch (error: any) {
          logWithCategory('error', LogCategory.SYSTEM,
            `Plugin ${pluginId} workflow-manager stdio error:`, error);
          throw new Error(`Failed to call MCP tool ${toolName} on ${serverId}: ${error.message}`);
        }
      }

      // Use stdio (PersistentMCPClient) for kanban-server -- same treatment as
      // workflow-manager (S11 §4a / GH issue #179 §2: the proven path, rather
      // than the HTTP /api/tool-call branch).
      if (serverId === 'kanban') {
        try {
          logWithCategory('info', LogCategory.SYSTEM,
            `Plugin ${pluginId} calling kanban-server tool via stdio: ${toolName}`, args);

          const client = await getKanbanMCPClient();
          const result = await client.callTool(toolName, args);

          return result as T;
        } catch (error: any) {
          logWithCategory('error', LogCategory.SYSTEM,
            `Plugin ${pluginId} kanban-server stdio error:`, error);
          throw new Error(`Failed to call MCP tool ${toolName} on ${serverId}: ${error.message}`);
        }
      }

      // Use HTTP for all other MCP servers
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
      // For workflow-manager, check if the PersistentMCPClient is ready
      if (serverId === 'workflow-manager') {
        try {
          const client = await getWorkflowMCPClient();
          return client.isReady();
        } catch {
          return false;
        }
      }

      // For kanban, same stdio ready-check as workflow-manager
      if (serverId === 'kanban') {
        try {
          const client = await getKanbanMCPClient();
          return client.isReady();
        } catch {
          return false;
        }
      }

      // For other servers, use HTTP health check
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
      // For workflow-manager, use stdio client
      if (serverId === 'workflow-manager') {
        try {
          const client = await getWorkflowMCPClient();
          const running = client.isReady();
          return {
            id: serverId,
            name: serverId,
            endpoint: 'stdio',
            status: running ? 'running' : 'stopped',
            tools: [], // Tools list not available via stdio without additional protocol
          };
        } catch (error) {
          return {
            id: serverId,
            name: serverId,
            endpoint: 'stdio',
            status: 'error',
          };
        }
      }

      // For kanban, same stdio client shape as workflow-manager
      if (serverId === 'kanban') {
        try {
          const client = await getKanbanMCPClient();
          const running = client.isReady();
          return {
            id: serverId,
            name: serverId,
            endpoint: 'stdio',
            status: running ? 'running' : 'stopped',
            tools: [],
          };
        } catch (error) {
          return {
            id: serverId,
            name: serverId,
            endpoint: 'stdio',
            status: 'error',
          };
        }
      }

      // For other servers, use HTTP
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
 * Creates workflow service
 *
 * Provides workflow import/delete operations through the plugin API
 * instead of requiring plugins to import internal modules directly
 */
function createWorkflowService(
  pluginId: string,
  permissions: PluginPermissions
): WorkflowService | undefined {
  // Check if plugin has MCP permission for workflow-manager
  const hasMcpPermission = Array.isArray(permissions.mcp)
    ? permissions.mcp.includes('workflow-manager')
    : permissions.mcp && typeof permissions.mcp === 'object' &&
      (permissions.mcp as any).enabled &&
      Array.isArray((permissions.mcp as any).servers) &&
      (permissions.mcp as any).servers.includes('workflow-manager');

  if (!hasMcpPermission) {
    return undefined;
  }

  // Lazy import to avoid circular dependencies
  const getFolderImporter = async () => {
    const { FolderImporter } = await import('./workflow/folder-importer');
    return new FolderImporter();
  };

  return {
    async importFromFolder(
      folderPath: string,
      customId?: string,
      customName?: string
    ): Promise<WorkflowImportResult> {
      try {
        logWithCategory('info', LogCategory.SYSTEM,
          `Plugin ${pluginId} importing workflow from: ${folderPath}`);

        const importer = await getFolderImporter();
        const result = await importer.importFromFolder(folderPath, customId, customName);

        return {
          success: true,
          workflowId: result.workflowId,
          message: result.message,
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.SYSTEM,
          `Plugin ${pluginId} workflow import failed:`, error);

        return {
          success: false,
          error: error.message,
        };
      }
    },

    async deleteWorkflow(workflowId: string): Promise<void> {
      try {
        logWithCategory('info', LogCategory.SYSTEM,
          `Plugin ${pluginId} deleting workflow: ${workflowId}`);

        const client = await getWorkflowMCPClient();
        await client.callTool('delete_workflow_definition', { id: workflowId });
      } catch (error: any) {
        logWithCategory('error', LogCategory.SYSTEM,
          `Plugin ${pluginId} workflow delete failed:`, error);
        throw error;
      }
    },

    async getImportSource(workflowId: string): Promise<string | null> {
      try {
        const client = await getWorkflowMCPClient();
        const result = await client.callTool('get_workflow_import_source', { id: workflowId });
        return result?.sourcePath || null;
      } catch (error: any) {
        logWithCategory('warn', LogCategory.SYSTEM,
          `Plugin ${pluginId} could not get import source for ${workflowId}:`, error.message);
        return null;
      }
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
      recordHandler(fullChannel, '', `plugin:${pluginId}`);
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
      unrecordHandler(fullChannel);
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
  onMenuItemRegister?: (pluginId: string, item: PluginMenuItem) => void,
  onNotification?: (notification: PluginNotification) => void
): PluginUI {
  const registeredMenuItems: string[] = [];

  return {
    registerMenuItem(item: PluginMenuItem): void {
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
      // Ask the renderer's ViewRouter to navigate to the view. Broadcast to
      // every window (same idiom the plugins' own update push channels use);
      // renderer.ts listens on 'plugin:show-view'.
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
          win.webContents.send('plugin:show-view', { pluginId, viewId });
        }
      });
    },

    showNotification(notification: PluginNotification): void {
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
      return config[key] !== undefined ? config[key] : (defaultValue as T);
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
        const additionalArgs: any[] = [message, ...args];
        logWithCategory('error', LogCategory.SYSTEM, `${prefix} ${message.message}`, ...additionalArgs);
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
