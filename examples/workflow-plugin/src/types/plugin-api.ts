/**
 * FictionLab Plugin API Type Definitions
 *
 * This file defines the complete API surface that plugins can use to interact
 * with the FictionLab host application.
 */

import { IpcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Plugin Manifest
 *
 * Defines metadata and configuration for a FictionLab plugin.
 * This is loaded from plugin.json in the plugin directory.
 */
export interface PluginManifest {
  /** Unique plugin identifier (lowercase, alphanumeric with hyphens) */
  id: string;

  /** Human-readable plugin name */
  name: string;

  /** Semantic version (semver) */
  version: string;

  /** Short description of plugin functionality */
  description: string;

  /** Plugin author name or organization */
  author: string;

  /** Minimum FictionLab version required (semver range) */
  fictionLabVersion: string;

  /** Plugin type classification */
  pluginType: 'execution-engine' | 'client' | 'reporting' | 'utility' | 'integration';

  /** Entry points for plugin code */
  entry: {
    /** Main process entry point (relative to plugin directory) */
    main: string;

    /** Renderer process bundle (optional, relative to plugin directory) */
    renderer?: string;
  };

  /** Permissions requested by the plugin */
  permissions: PluginPermissions;

  /** Dependencies on other plugins or services */
  dependencies?: {
    /** MCP servers required by this plugin */
    mcpServers?: Array<string | { id: string; version: string }>;

    /** Other plugins required */
    plugins?: Array<string | { id: string; version: string }>;

    /** FictionLab API version */
    fictionlabApi?: string;
  };

  /** UI integration points */
  ui?: PluginUIConfig;

  /** MCP integration configuration */
  mcpIntegration?: {
    [serverId: string]: {
      required: boolean;
      endpoint?: string;
    };
  };

  /** Plugin-specific configuration schema */
  configSchema?: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      default?: any;
      description?: string;
      required?: boolean;
    };
  };
}

/**
 * Plugin Permissions
 *
 * Defines what resources and APIs the plugin can access
 */
export interface PluginPermissions {
  /** Access to PostgreSQL database */
  database?: boolean | string[]; // true for full access, or array of schema names

  /** Access to MCP servers (array of server IDs) */
  mcp?: string[];

  /** File system access */
  fileSystem?: boolean | 'readonly';

  /** Network access */
  network?: boolean;

  /** Ability to spawn child processes */
  childProcesses?: boolean;

  /** Access to Docker API */
  docker?: boolean;

  /** Access to clipboard */
  clipboard?: boolean;

  /** Ability to show native dialogs */
  dialogs?: boolean;
}

/**
 * Plugin UI Configuration
 *
 * Defines how the plugin integrates with FictionLab's UI
 */
export interface PluginUIConfig {
  /** Main view component identifier */
  mainView?: string;

  /** Menu items to add */
  menuItems?: Array<{
    label: string;
    submenu?: Array<string | { label: string; accelerator?: string; action: string }>;
  }>;

  /** Sidebar widget component */
  sidebarWidget?: string;

  /** Settings panel component */
  settingsPanel?: string;

  /** Status bar items */
  statusBarItems?: Array<{
    id: string;
    position: 'left' | 'right';
    priority?: number;
  }>;
}

/**
 * Plugin Context
 *
 * Provided to plugins during activation. Gives access to FictionLab services.
 */
export interface PluginContext {
  /** Core services provided by FictionLab */
  services: PluginServices;

  /** Workspace information */
  workspace: WorkspaceInfo;

  /** IPC communication interface */
  ipc: PluginIPC;

  /** UI integration interface */
  ui: PluginUI;

  /** Plugin metadata */
  plugin: PluginMetadata;

  /** Configuration storage */
  config: PluginConfigStorage;

  /** Logger instance for this plugin */
  logger: PluginLogger;
}

/**
 * Plugin Services
 *
 * Core FictionLab services available to plugins
 */
export interface PluginServices {
  /** PostgreSQL database access */
  database: FictionLabDatabase;

  /** MCP server connection manager */
  mcp: MCPConnectionManager;

  /** File system operations */
  fileSystem: FileSystemService;

  /** Docker management (if permission granted) */
  docker?: DockerService;

  /** Environment configuration */
  environment: EnvironmentService;
}

/**
 * FictionLab Database Service
 *
 * Provides access to the PostgreSQL database with permission enforcement
 */
export interface FictionLabDatabase {
  /**
   * Execute a SQL query
   * @param sql SQL query string
   * @param params Query parameters (prevents SQL injection)
   * @returns Query results
   */
  query<T = any>(sql: string, params?: any[]): Promise<T>;

  /**
   * Execute multiple queries in a transaction
   * @param callback Callback that receives a transaction client
   */
  transaction(callback: (client: any) => Promise<void>): Promise<void>;

  /**
   * Get the underlying connection pool (advanced usage)
   */
  pool: any; // pg.Pool instance

  /**
   * Create a schema for this plugin (if not exists)
   * Schema name will be `plugin_[plugin_id]`
   */
  createPluginSchema(): Promise<void>;

  /**
   * Get the plugin's schema name
   */
  getPluginSchema(): string;
}

/**
 * MCP Connection Manager
 *
 * Manages connections to MCP servers
 */
export interface MCPConnectionManager {
  /**
   * Get the endpoint URL for an MCP server
   * @param serverId Server identifier (e.g., 'workflow-manager', 'book-planning')
   * @returns Server endpoint URL
   */
  getEndpoint(serverId: string): string | null;

  /**
   * Call an MCP tool on a server
   * @param serverId Server identifier
   * @param toolName Tool to invoke
   * @param args Tool arguments
   * @returns Tool execution result
   */
  callTool<T = any>(serverId: string, toolName: string, args: Record<string, any>): Promise<T>;

  /**
   * Check if an MCP server is running
   * @param serverId Server identifier
   * @returns true if server is healthy
   */
  isServerRunning(serverId: string): Promise<boolean>;

  /**
   * List all available MCP servers
   * @returns Array of server IDs
   */
  listServers(): Promise<string[]>;

  /**
   * Get MCP server metadata
   * @param serverId Server identifier
   * @returns Server metadata including tools available
   */
  getServerInfo(serverId: string): Promise<MCPServerInfo | null>;
}

/**
 * MCP Server Information
 */
export interface MCPServerInfo {
  id: string;
  name: string;
  endpoint: string;
  status: 'running' | 'stopped' | 'error';
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: any;
  }>;
}

/**
 * File System Service
 *
 * Provides file system operations with permission enforcement
 */
export interface FileSystemService {
  /**
   * Read a file
   * @param path File path (absolute or relative to workspace)
   * @returns File contents as string
   */
  readFile(path: string): Promise<string>;

  /**
   * Write a file
   * @param path File path
   * @param content Content to write
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * Check if a path exists
   * @param path Path to check
   * @returns true if exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Create a directory
   * @param path Directory path
   * @param recursive Create parent directories if needed
   */
  mkdir(path: string, recursive?: boolean): Promise<void>;

  /**
   * Read directory contents
   * @param path Directory path
   * @returns Array of file/directory names
   */
  readdir(path: string): Promise<string[]>;

  /**
   * Delete a file or directory
   * @param path Path to delete
   * @param recursive Delete recursively (for directories)
   */
  delete(path: string, recursive?: boolean): Promise<void>;

  /**
   * Get file stats
   * @param path File path
   * @returns File stats
   */
  stat(path: string): Promise<FileStats>;
}

/**
 * File Statistics
 */
export interface FileStats {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  created: Date;
  modified: Date;
}

/**
 * Docker Service
 *
 * Provides Docker management capabilities (requires permission)
 */
export interface DockerService {
  /**
   * List Docker containers
   * @param all Include stopped containers
   * @returns Array of containers
   */
  listContainers(all?: boolean): Promise<DockerContainer[]>;

  /**
   * Get container logs
   * @param containerId Container ID or name
   * @param tail Number of lines to return
   * @returns Container logs
   */
  getContainerLogs(containerId: string, tail?: number): Promise<string>;

  /**
   * Check if Docker is available
   * @returns true if Docker is accessible
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Docker Container Information
 */
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: 'running' | 'stopped' | 'paused' | 'exited';
  ports?: Array<{ internal: number; external?: number }>;
}

/**
 * Environment Service
 *
 * Provides access to environment configuration
 */
export interface EnvironmentService {
  /**
   * Get an environment variable
   * @param key Variable name
   * @returns Variable value or undefined
   */
  get(key: string): string | undefined;

  /**
   * Get the user data directory
   * @returns Path to user data directory
   */
  getUserDataPath(): string;

  /**
   * Get the app version
   * @returns FictionLab version
   */
  getAppVersion(): string;

  /**
   * Check if app is in development mode
   * @returns true if in development
   */
  isDevelopment(): boolean;
}

/**
 * Workspace Information
 */
export interface WorkspaceInfo {
  /** Workspace root directory */
  root: string;

  /** Workspace configuration */
  config: Record<string, any>;

  /** Get plugin's data directory */
  getPluginDataPath(): string;
}

/**
 * Plugin IPC Interface
 *
 * Allows plugins to register IPC handlers and communicate with renderer
 */
export interface PluginIPC {
  /**
   * Register an IPC handler
   * Channel name will be automatically prefixed with `plugin:[plugin-id]:`
   * @param channel Channel name (without prefix)
   * @param handler Handler function
   */
  handle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any): void;

  /**
   * Send a message to renderer
   * @param channel Channel name
   * @param args Arguments to send
   */
  send(channel: string, ...args: any[]): void;

  /**
   * Remove an IPC handler
   * @param channel Channel name (without prefix)
   */
  removeHandler(channel: string): void;

  /**
   * Get the full channel name with plugin prefix
   * @param channel Short channel name
   * @returns Full channel name with prefix
   */
  getChannelName(channel: string): string;
}

/**
 * Plugin UI Interface
 *
 * Allows plugins to interact with FictionLab's UI
 */
export interface PluginUI {
  /**
   * Register a menu item
   * @param item Menu item configuration
   */
  registerMenuItem(item: PluginMenuItem): void;

  /**
   * Remove a menu item
   * @param itemId Menu item ID
   */
  removeMenuItem(itemId: string): void;

  /**
   * Show a plugin view
   * @param viewId View identifier
   */
  showView(viewId: string): void;

  /**
   * Show a notification
   * @param notification Notification configuration
   */
  showNotification(notification: PluginNotification): void;

  /**
   * Show a dialog
   * @param options Dialog options
   * @returns Dialog result
   */
  showDialog(options: DialogOptions): Promise<DialogResult>;

  /**
   * Update status bar item
   * @param itemId Item identifier
   * @param content New content
   */
  updateStatusBarItem(itemId: string, content: string): void;
}

/**
 * Plugin Menu Item
 */
export interface PluginMenuItem {
  id: string;
  label: string;
  click?: () => void;
  submenu?: PluginMenuItem[];
  accelerator?: string;
  role?: string;
  type?: 'normal' | 'separator' | 'checkbox' | 'radio';
  enabled?: boolean;
  visible?: boolean;
}

/**
 * Plugin Notification
 */
export interface PluginNotification {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  title?: string;
  duration?: number; // milliseconds, 0 for persistent
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

/**
 * Dialog Options
 */
export interface DialogOptions {
  type: 'info' | 'warning' | 'error' | 'question';
  title: string;
  message: string;
  detail?: string;
  buttons?: string[];
  defaultId?: number;
  cancelId?: number;
}

/**
 * Dialog Result
 */
export interface DialogResult {
  response: number; // Index of clicked button
  checkboxChecked?: boolean;
}

/**
 * Plugin Metadata
 */
export interface PluginMetadata {
  /** Plugin ID */
  id: string;

  /** Plugin version */
  version: string;

  /** Plugin data directory */
  dataPath: string;

  /** Plugin installation directory */
  installPath: string;

  /** Plugin manifest */
  manifest: PluginManifest;
}

/**
 * Plugin Configuration Storage
 *
 * Persistent configuration storage for plugins
 */
export interface PluginConfigStorage {
  /**
   * Get a configuration value
   * @param key Configuration key
   * @param defaultValue Default value if not set
   * @returns Configuration value
   */
  get<T = any>(key: string, defaultValue?: T): T;

  /**
   * Set a configuration value
   * @param key Configuration key
   * @param value Value to store
   */
  set(key: string, value: any): Promise<void>;

  /**
   * Check if a key exists
   * @param key Configuration key
   * @returns true if exists
   */
  has(key: string): boolean;

  /**
   * Delete a configuration key
   * @param key Configuration key
   */
  delete(key: string): Promise<void>;

  /**
   * Get all configuration
   * @returns All configuration as object
   */
  all(): Record<string, any>;

  /**
   * Clear all configuration
   */
  clear(): Promise<void>;
}

/**
 * Plugin Logger
 *
 * Logger instance for plugins with proper prefixing
 */
export interface PluginLogger {
  /**
   * Log info message
   * @param message Message or format string
   * @param args Format arguments
   */
  info(message: string, ...args: any[]): void;

  /**
   * Log warning message
   * @param message Message or format string
   * @param args Format arguments
   */
  warn(message: string, ...args: any[]): void;

  /**
   * Log error message
   * @param message Message or error object
   * @param args Additional arguments
   */
  error(message: string | Error, ...args: any[]): void;

  /**
   * Log debug message (only in development)
   * @param message Message or format string
   * @param args Format arguments
   */
  debug(message: string, ...args: any[]): void;
}

/**
 * Plugin Interface
 *
 * Main interface that plugins must implement
 */
export interface FictionLabPlugin {
  /** Plugin ID (must match manifest) */
  readonly id: string;

  /** Plugin name (must match manifest) */
  readonly name: string;

  /** Plugin version (must match manifest) */
  readonly version: string;

  /**
   * Called when plugin is activated
   * @param context Plugin context with access to services
   */
  onActivate(context: PluginContext): Promise<void>;

  /**
   * Called when plugin is deactivated
   * Plugins should clean up resources here
   */
  onDeactivate(): Promise<void>;

  /**
   * Optional: Called when configuration changes
   * @param config New configuration
   */
  onConfigChange?(config: Record<string, any>): Promise<void>;
}

/**
 * Plugin State
 *
 * Internal state tracking for loaded plugins
 */
export interface PluginState {
  /** Plugin ID */
  id: string;

  /** Plugin instance */
  instance: FictionLabPlugin;

  /** Plugin manifest */
  manifest: PluginManifest;

  /** Plugin context */
  context: PluginContext;

  /** Activation status */
  status: 'loading' | 'active' | 'inactive' | 'error';

  /** Error if status is 'error' */
  error?: Error;

  /** Load time */
  loadedAt: Date;

  /** IPC channels registered by this plugin */
  ipcChannels: string[];

  /** Menu items registered by this plugin */
  menuItems: string[];
}

/**
 * Plugin Discovery Result
 */
export interface PluginDiscoveryResult {
  /** Plugin directory path */
  path: string;

  /** Plugin manifest */
  manifest: PluginManifest;

  /** Validation errors (if any) */
  errors?: string[];

  /** Whether plugin is valid */
  valid: boolean;
}

/**
 * Plugin Load Options
 */
export interface PluginLoadOptions {
  /** Skip permission validation */
  skipPermissionCheck?: boolean;

  /** Skip dependency resolution */
  skipDependencyCheck?: boolean;

  /** Force reload if already loaded */
  force?: boolean;
}

/**
 * Plugin Error Types
 */
export enum PluginErrorType {
  MANIFEST_INVALID = 'MANIFEST_INVALID',
  MANIFEST_NOT_FOUND = 'MANIFEST_NOT_FOUND',
  ENTRY_POINT_NOT_FOUND = 'ENTRY_POINT_NOT_FOUND',
  ENTRY_POINT_INVALID = 'ENTRY_POINT_INVALID',
  ACTIVATION_FAILED = 'ACTIVATION_FAILED',
  DEACTIVATION_FAILED = 'DEACTIVATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DEPENDENCY_MISSING = 'DEPENDENCY_MISSING',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  ALREADY_LOADED = 'ALREADY_LOADED',
  NOT_LOADED = 'NOT_LOADED',
}

/**
 * Plugin Error
 */
export class PluginError extends Error {
  constructor(
    public readonly type: PluginErrorType,
    public readonly pluginId: string,
    message: string,
    public readonly details?: any
  ) {
    super(`[Plugin: ${pluginId}] ${message}`);
    this.name = 'PluginError';
  }
}
