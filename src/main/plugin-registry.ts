/**
 * Plugin Registry
 *
 * Manages the collection of loaded plugins and their states.
 * Provides methods for activating, deactivating, and querying plugins.
 */

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { MenuItem, Notification } from 'electron';
import { logWithCategory, LogCategory } from './logger';
import { PluginLoader } from './plugin-loader';
import { createPluginContext } from './plugin-context';
import {
  PluginState,
  PluginManifest,
  FictionLabPlugin,
  PluginError,
  PluginErrorType,
  PluginDiscoveryResult,
  PluginLoadOptions,
  PluginContext,
} from '../types/plugin-api';

/**
 * Plugin Registry Events
 */
export interface PluginRegistryEvents {
  'plugin-loaded': (pluginId: string, plugin: PluginState) => void;
  'plugin-activated': (pluginId: string, plugin: PluginState) => void;
  'plugin-deactivated': (pluginId: string) => void;
  'plugin-error': (pluginId: string, error: Error) => void;
  'menu-item-registered': (pluginId: string, item: MenuItem) => void;
  'notification': (pluginId: string, notification: Notification) => void;
}

/**
 * Plugin Registry Options
 */
export interface PluginRegistryOptions {
  /** PostgreSQL connection pool */
  databasePool: Pool;

  /** Auto-activate plugins after loading */
  autoActivate?: boolean;

  /** Skip dependency checks during loading */
  skipDependencyChecks?: boolean;
}

/**
 * Plugin Registry Class
 *
 * Central manager for all loaded plugins
 */
export class PluginRegistry extends EventEmitter {
  private plugins: Map<string, PluginState>;
  private loader: PluginLoader;
  private options: PluginRegistryOptions;

  constructor(options: PluginRegistryOptions) {
    super();
    this.plugins = new Map();
    this.loader = new PluginLoader();
    this.options = options;

    logWithCategory('info', LogCategory.SYSTEM, 'Plugin registry initialized');
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): PluginState[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): PluginState | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if a plugin is loaded
   */
  isLoaded(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Check if a plugin is active
   */
  isActive(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    return plugin?.status === 'active';
  }

  /**
   * Get plugins by status
   */
  getPluginsByStatus(status: PluginState['status']): PluginState[] {
    return Array.from(this.plugins.values()).filter(p => p.status === status);
  }

  /**
   * Discover and load all plugins
   *
   * Scans the plugins directory, loads valid plugins, and optionally activates them
   */
  async discoverAndLoadAll(): Promise<void> {
    logWithCategory('info', LogCategory.SYSTEM, 'Discovering and loading all plugins...');

    try {
      // Discover plugins
      const discoveryResults = await this.loader.discoverPlugins();

      // Filter valid plugins
      const validPlugins = discoveryResults.filter(r => r.valid);

      if (validPlugins.length === 0) {
        logWithCategory('info', LogCategory.SYSTEM, 'No valid plugins found');
        return;
      }

      // Sort by dependencies
      const sorted = this.loader.sortByDependencies(validPlugins);

      // Load each plugin
      for (const result of sorted) {
        try {
          await this.loadPlugin(result.path, {
            skipDependencyCheck: this.options.skipDependencyChecks,
          });
        } catch (error: any) {
          logWithCategory('error', LogCategory.SYSTEM, `Failed to load plugin ${result.manifest.id}:`, error);
          this.emit('plugin-error', result.manifest.id, error);
        }
      }

      // Auto-activate if configured
      if (this.options.autoActivate) {
        await this.activateAll();
      }

      logWithCategory('info', LogCategory.SYSTEM,
        `Plugin loading complete: ${this.plugins.size} plugins loaded, ${this.getPluginsByStatus('active').length} active`
      );
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error during plugin discovery:', error);
      throw error;
    }
  }

  /**
   * Load a single plugin
   *
   * @param pluginPath Path to plugin directory
   * @param options Load options
   */
  async loadPlugin(
    pluginPath: string,
    options: PluginLoadOptions = {}
  ): Promise<PluginState> {
    const instance = await this.loader.loadPlugin(pluginPath, options);
    const pluginId = instance.id;

    // Check if already loaded
    if (this.plugins.has(pluginId) && !options.force) {
      throw new PluginError(
        PluginErrorType.ALREADY_LOADED,
        pluginId,
        'Plugin is already loaded'
      );
    }

    // Load manifest
    const manifestPath = require('path').join(pluginPath, 'plugin.json');
    const manifest: PluginManifest = require('fs-extra').readJsonSync(manifestPath);

    // Validate dependencies
    if (!options.skipDependencyCheck) {
      const depErrors = this.loader.validateDependencies(manifest, this.plugins);
      if (depErrors) {
        throw new PluginError(
          PluginErrorType.DEPENDENCY_MISSING,
          pluginId,
          `Missing dependencies: ${depErrors.join(', ')}`,
          { errors: depErrors }
        );
      }
    }

    // Create plugin context
    const context = createPluginContext(
      pluginId,
      manifest,
      pluginPath,
      this.options.databasePool,
      (pid, item) => this.handleMenuItemRegistered(pid, item),
      (notification) => this.handleNotification(pluginId, notification)
    );

    // Create plugin state
    const state = this.loader.createPluginState(pluginId, instance, manifest, context);

    // Store in registry
    this.plugins.set(pluginId, state);

    logWithCategory('info', LogCategory.SYSTEM, `Plugin loaded: ${pluginId} v${manifest.version}`);
    this.emit('plugin-loaded', pluginId, state);

    return state;
  }

  /**
   * Activate a plugin
   *
   * Calls the plugin's onActivate() method
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const state = this.plugins.get(pluginId);

    if (!state) {
      throw new PluginError(
        PluginErrorType.NOT_LOADED,
        pluginId,
        'Plugin is not loaded'
      );
    }

    if (state.status === 'active') {
      logWithCategory('debug', LogCategory.SYSTEM, `Plugin ${pluginId} is already active`);
      return;
    }

    logWithCategory('info', LogCategory.SYSTEM, `Activating plugin: ${pluginId}...`);

    state.status = 'loading';

    try {
      // Call onActivate
      await state.instance.onActivate(state.context);

      state.status = 'active';
      logWithCategory('info', LogCategory.SYSTEM, `Plugin activated: ${pluginId}`);

      this.emit('plugin-activated', pluginId, state);
    } catch (error: any) {
      state.status = 'error';
      state.error = error;

      logWithCategory('error', LogCategory.SYSTEM, `Failed to activate plugin ${pluginId}:`, error);

      const pluginError = new PluginError(
        PluginErrorType.ACTIVATION_FAILED,
        pluginId,
        `Plugin activation failed: ${error.message}`,
        { originalError: error }
      );

      this.emit('plugin-error', pluginId, pluginError);

      throw pluginError;
    }
  }

  /**
   * Deactivate a plugin
   *
   * Calls the plugin's onDeactivate() method and cleans up resources
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const state = this.plugins.get(pluginId);

    if (!state) {
      throw new PluginError(
        PluginErrorType.NOT_LOADED,
        pluginId,
        'Plugin is not loaded'
      );
    }

    if (state.status !== 'active') {
      logWithCategory('debug', LogCategory.SYSTEM, `Plugin ${pluginId} is not active`);
      return;
    }

    logWithCategory('info', LogCategory.SYSTEM, `Deactivating plugin: ${pluginId}...`);

    try {
      // Call onDeactivate
      await state.instance.onDeactivate();

      // Clean up IPC handlers
      for (const channel of state.ipcChannels) {
        const { ipcMain } = require('electron');
        ipcMain.removeHandler(channel);
      }
      state.ipcChannels = [];

      // Clear menu items
      state.menuItems = [];

      state.status = 'inactive';
      logWithCategory('info', LogCategory.SYSTEM, `Plugin deactivated: ${pluginId}`);

      this.emit('plugin-deactivated', pluginId);
    } catch (error: any) {
      state.status = 'error';
      state.error = error;

      logWithCategory('error', LogCategory.SYSTEM, `Failed to deactivate plugin ${pluginId}:`, error);

      const pluginError = new PluginError(
        PluginErrorType.DEACTIVATION_FAILED,
        pluginId,
        `Plugin deactivation failed: ${error.message}`,
        { originalError: error }
      );

      this.emit('plugin-error', pluginId, pluginError);

      throw pluginError;
    }
  }

  /**
   * Reload a plugin
   *
   * Deactivates, unloads, reloads, and reactivates the plugin
   */
  async reloadPlugin(pluginId: string): Promise<void> {
    const state = this.plugins.get(pluginId);

    if (!state) {
      throw new PluginError(
        PluginErrorType.NOT_LOADED,
        pluginId,
        'Plugin is not loaded'
      );
    }

    logWithCategory('info', LogCategory.SYSTEM, `Reloading plugin: ${pluginId}...`);

    const wasActive = state.status === 'active';
    const pluginPath = state.context.plugin.installPath;

    // Deactivate if active
    if (wasActive) {
      await this.deactivatePlugin(pluginId);
    }

    // Unload from memory
    this.loader.unloadPlugin(pluginPath, state.manifest);

    // Remove from registry
    this.plugins.delete(pluginId);

    // Reload
    const newState = await this.loadPlugin(pluginPath, { force: true });

    // Reactivate if it was active before
    if (wasActive) {
      await this.activatePlugin(pluginId);
    }

    logWithCategory('info', LogCategory.SYSTEM, `Plugin reloaded: ${pluginId}`);
  }

  /**
   * Unload a plugin
   *
   * Deactivates and removes the plugin from the registry
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const state = this.plugins.get(pluginId);

    if (!state) {
      throw new PluginError(
        PluginErrorType.NOT_LOADED,
        pluginId,
        'Plugin is not loaded'
      );
    }

    logWithCategory('info', LogCategory.SYSTEM, `Unloading plugin: ${pluginId}...`);

    // Deactivate if active
    if (state.status === 'active') {
      await this.deactivatePlugin(pluginId);
    }

    // Unload from memory
    this.loader.unloadPlugin(state.context.plugin.installPath, state.manifest);

    // Remove from registry
    this.plugins.delete(pluginId);

    logWithCategory('info', LogCategory.SYSTEM, `Plugin unloaded: ${pluginId}`);
  }

  /**
   * Activate all loaded plugins
   */
  async activateAll(): Promise<void> {
    logWithCategory('info', LogCategory.SYSTEM, 'Activating all plugins...');

    const plugins = Array.from(this.plugins.values());

    for (const state of plugins) {
      if (state.status !== 'active') {
        try {
          await this.activatePlugin(state.id);
        } catch (error: any) {
          logWithCategory('error', LogCategory.SYSTEM, `Failed to activate plugin ${state.id}:`, error);
        }
      }
    }

    logWithCategory('info', LogCategory.SYSTEM,
      `Activated ${this.getPluginsByStatus('active').length} of ${plugins.length} plugins`
    );
  }

  /**
   * Deactivate all active plugins
   */
  async deactivateAll(): Promise<void> {
    logWithCategory('info', LogCategory.SYSTEM, 'Deactivating all plugins...');

    const activePlugins = this.getPluginsByStatus('active');

    for (const state of activePlugins) {
      try {
        await this.deactivatePlugin(state.id);
      } catch (error: any) {
        logWithCategory('error', LogCategory.SYSTEM, `Failed to deactivate plugin ${state.id}:`, error);
      }
    }

    logWithCategory('info', LogCategory.SYSTEM, 'All plugins deactivated');
  }

  /**
   * Get plugin statistics
   */
  getStatistics(): {
    total: number;
    active: number;
    inactive: number;
    error: number;
    loading: number;
  } {
    const plugins = Array.from(this.plugins.values());

    return {
      total: plugins.length,
      active: plugins.filter(p => p.status === 'active').length,
      inactive: plugins.filter(p => p.status === 'inactive').length,
      error: plugins.filter(p => p.status === 'error').length,
      loading: plugins.filter(p => p.status === 'loading').length,
    };
  }

  /**
   * Handle menu item registration from plugins
   */
  private handleMenuItemRegistered(pluginId: string, item: MenuItem): void {
    const state = this.plugins.get(pluginId);
    if (state) {
      state.menuItems.push(item.id);
    }

    this.emit('menu-item-registered', pluginId, item);
  }

  /**
   * Handle notification from plugins
   */
  private handleNotification(pluginId: string, notification: Notification): void {
    this.emit('notification', pluginId, notification);
  }

  /**
   * Clean up registry
   *
   * Deactivates and unloads all plugins
   */
  async cleanup(): Promise<void> {
    logWithCategory('info', LogCategory.SYSTEM, 'Cleaning up plugin registry...');

    await this.deactivateAll();

    this.plugins.clear();

    logWithCategory('info', LogCategory.SYSTEM, 'Plugin registry cleaned up');
  }
}
