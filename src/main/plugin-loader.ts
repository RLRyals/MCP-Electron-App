/**
 * Plugin Loader
 *
 * Discovers, validates, and loads FictionLab plugins.
 * Handles plugin lifecycle (activation/deactivation) and dependency resolution.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { app } from 'electron';
import { logWithCategory, LogCategory } from './logger';
import {
  PluginManifest,
  FictionLabPlugin,
  PluginDiscoveryResult,
  PluginLoadOptions,
  PluginError,
  PluginErrorType,
  PluginState,
} from '../types/plugin-api';
import * as semver from 'semver';

/**
 * Plugin Loader Class
 *
 * Manages plugin discovery, loading, and lifecycle
 */
export class PluginLoader {
  private pluginsDirectory: string;
  private appVersion: string;

  constructor() {
    this.pluginsDirectory = path.join(app.getPath('userData'), 'plugins');
    this.appVersion = app.getVersion();

    // Ensure plugins directory exists
    fs.ensureDirSync(this.pluginsDirectory);

    logWithCategory('info', LogCategory.SYSTEM, `Plugin loader initialized. Plugins directory: ${this.pluginsDirectory}`);
  }

  /**
   * Get the plugins directory path
   */
  getPluginsDirectory(): string {
    return this.pluginsDirectory;
  }

  /**
   * Discover all plugins in the plugins directory
   *
   * Scans for plugin.json files and validates them
   */
  async discoverPlugins(): Promise<PluginDiscoveryResult[]> {
    logWithCategory('info', LogCategory.SYSTEM, 'Discovering plugins...');

    const results: PluginDiscoveryResult[] = [];

    try {
      const entries = await fs.readdir(this.pluginsDirectory, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const pluginPath = path.join(this.pluginsDirectory, entry.name);
        const manifestPath = path.join(pluginPath, 'plugin.json');

        // Check if plugin.json exists
        if (!(await fs.pathExists(manifestPath))) {
          logWithCategory('debug', LogCategory.SYSTEM, `Skipping ${entry.name}: no plugin.json found`);
          continue;
        }

        // Load and validate manifest
        const discoveryResult = await this.loadAndValidateManifest(pluginPath, manifestPath);
        results.push(discoveryResult);

        if (discoveryResult.valid) {
          logWithCategory('info', LogCategory.SYSTEM, `Discovered plugin: ${discoveryResult.manifest.id} v${discoveryResult.manifest.version}`);
        } else {
          logWithCategory('warn', LogCategory.SYSTEM, `Invalid plugin at ${pluginPath}:`, discoveryResult.errors);
        }
      }

      logWithCategory('info', LogCategory.SYSTEM, `Discovered ${results.length} plugins (${results.filter(r => r.valid).length} valid)`);

      return results;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error discovering plugins:', error);
      return [];
    }
  }

  /**
   * Load and validate a plugin manifest
   */
  private async loadAndValidateManifest(
    pluginPath: string,
    manifestPath: string
  ): Promise<PluginDiscoveryResult> {
    const errors: string[] = [];

    try {
      // Load manifest
      const manifestContent = await fs.readJson(manifestPath);
      const manifest = manifestContent as PluginManifest;

      // Validate required fields
      if (!manifest.id) {
        errors.push('Missing required field: id');
      } else if (!/^[a-z0-9-]+$/.test(manifest.id)) {
        errors.push('Invalid id: must be lowercase alphanumeric with hyphens');
      }

      if (!manifest.name) {
        errors.push('Missing required field: name');
      }

      if (!manifest.version) {
        errors.push('Missing required field: version');
      } else if (!semver.valid(manifest.version)) {
        errors.push(`Invalid version: ${manifest.version} (must be valid semver)`);
      }

      if (!manifest.description) {
        errors.push('Missing required field: description');
      }

      if (!manifest.author) {
        errors.push('Missing required field: author');
      }

      if (!manifest.fictionLabVersion) {
        errors.push('Missing required field: fictionLabVersion');
      } else if (!semver.validRange(manifest.fictionLabVersion)) {
        errors.push(`Invalid fictionLabVersion: ${manifest.fictionLabVersion} (must be valid semver range)`);
      }

      if (!manifest.pluginType) {
        errors.push('Missing required field: pluginType');
      }

      if (!manifest.entry || !manifest.entry.main) {
        errors.push('Missing required field: entry.main');
      }

      if (!manifest.permissions) {
        errors.push('Missing required field: permissions');
      }

      // Validate FictionLab version compatibility
      if (manifest.fictionLabVersion && !semver.satisfies(this.appVersion, manifest.fictionLabVersion)) {
        errors.push(
          `FictionLab version mismatch: plugin requires ${manifest.fictionLabVersion}, but running ${this.appVersion}`
        );
      }

      // Check if entry point exists
      if (manifest.entry?.main) {
        const entryPath = path.join(pluginPath, manifest.entry.main);
        if (!(await fs.pathExists(entryPath))) {
          errors.push(`Entry point not found: ${manifest.entry.main}`);
        }
      }

      return {
        path: pluginPath,
        manifest,
        errors: errors.length > 0 ? errors : undefined,
        valid: errors.length === 0,
      };
    } catch (error: any) {
      errors.push(`Failed to load manifest: ${error.message}`);
      return {
        path: pluginPath,
        manifest: {} as PluginManifest,
        errors,
        valid: false,
      };
    }
  }

  /**
   * Load a plugin from disk
   *
   * @param pluginPath Path to plugin directory
   * @param options Load options
   * @returns Plugin instance
   */
  async loadPlugin(
    pluginPath: string,
    options: PluginLoadOptions = {}
  ): Promise<FictionLabPlugin> {
    logWithCategory('info', LogCategory.SYSTEM, `Loading plugin from ${pluginPath}...`);

    // Load and validate manifest
    const manifestPath = path.join(pluginPath, 'plugin.json');
    const discoveryResult = await this.loadAndValidateManifest(pluginPath, manifestPath);

    if (!discoveryResult.valid && !options.skipPermissionCheck) {
      throw new PluginError(
        PluginErrorType.MANIFEST_INVALID,
        discoveryResult.manifest.id || 'unknown',
        `Invalid plugin manifest: ${discoveryResult.errors?.join(', ')}`
      );
    }

    const manifest = discoveryResult.manifest;

    // Load entry point
    const entryPath = path.join(pluginPath, manifest.entry.main);

    try {
      // Clear require cache for hot reloading
      if (options.force && require.cache[entryPath]) {
        delete require.cache[entryPath];
      }

      // Load the plugin module
      const pluginModule = require(entryPath);

      // Get the plugin instance (could be default export or named export)
      let pluginInstance: FictionLabPlugin;

      if (pluginModule.default) {
        // ES6 default export
        if (typeof pluginModule.default === 'function') {
          pluginInstance = new pluginModule.default();
        } else {
          pluginInstance = pluginModule.default;
        }
      } else {
        // CommonJS or named export
        const PluginClass = pluginModule[manifest.id] || pluginModule.Plugin || pluginModule;
        if (typeof PluginClass === 'function') {
          pluginInstance = new PluginClass();
        } else {
          pluginInstance = PluginClass;
        }
      }

      // Validate plugin instance
      if (!pluginInstance || typeof pluginInstance !== 'object') {
        throw new PluginError(
          PluginErrorType.ENTRY_POINT_INVALID,
          manifest.id,
          'Plugin entry point must export a FictionLabPlugin instance'
        );
      }

      if (typeof pluginInstance.onActivate !== 'function') {
        throw new PluginError(
          PluginErrorType.ENTRY_POINT_INVALID,
          manifest.id,
          'Plugin must implement onActivate() method'
        );
      }

      if (typeof pluginInstance.onDeactivate !== 'function') {
        throw new PluginError(
          PluginErrorType.ENTRY_POINT_INVALID,
          manifest.id,
          'Plugin must implement onDeactivate() method'
        );
      }

      // Validate plugin ID matches manifest
      if (pluginInstance.id !== manifest.id) {
        throw new PluginError(
          PluginErrorType.ENTRY_POINT_INVALID,
          manifest.id,
          `Plugin ID mismatch: manifest says '${manifest.id}', plugin says '${pluginInstance.id}'`
        );
      }

      logWithCategory('info', LogCategory.SYSTEM, `Loaded plugin: ${manifest.id} v${manifest.version}`);

      return pluginInstance;
    } catch (error: any) {
      if (error instanceof PluginError) {
        throw error;
      }

      throw new PluginError(
        PluginErrorType.ENTRY_POINT_NOT_FOUND,
        manifest.id,
        `Failed to load plugin entry point: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Validate plugin dependencies
   *
   * @param manifest Plugin manifest
   * @param loadedPlugins Currently loaded plugins
   * @returns Validation errors or null if valid
   */
  validateDependencies(
    manifest: PluginManifest,
    loadedPlugins: Map<string, PluginState>
  ): string[] | null {
    const errors: string[] = [];

    // Check plugin dependencies
    if (manifest.dependencies?.plugins) {
      for (const dep of manifest.dependencies.plugins) {
        const depId = typeof dep === 'string' ? dep : dep.id;
        const depVersion = typeof dep === 'object' ? dep.version : undefined;

        const loadedPlugin = loadedPlugins.get(depId);
        if (!loadedPlugin) {
          errors.push(`Missing required plugin: ${depId}`);
        } else if (depVersion && !semver.satisfies(loadedPlugin.manifest.version, depVersion)) {
          errors.push(
            `Plugin version mismatch: ${depId} requires ${depVersion}, but ${loadedPlugin.manifest.version} is loaded`
          );
        }
      }
    }

    // Check MCP server dependencies (would need to verify servers are available)
    if (manifest.dependencies?.mcpServers) {
      // This would need integration with mcp-system.ts to check server availability
      // For now, just log a warning
      logWithCategory('debug', LogCategory.SYSTEM,
        `Plugin ${manifest.id} requires MCP servers: ${manifest.dependencies.mcpServers.join(', ')}`
      );
    }

    return errors.length > 0 ? errors : null;
  }

  /**
   * Sort plugins by dependencies
   *
   * Ensures plugins are loaded in the correct order
   *
   * @param discoveryResults Discovered plugins
   * @returns Sorted plugin paths
   */
  sortByDependencies(discoveryResults: PluginDiscoveryResult[]): PluginDiscoveryResult[] {
    const sorted: PluginDiscoveryResult[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    // Build dependency map
    const depMap = new Map<string, string[]>();
    const resultMap = new Map<string, PluginDiscoveryResult>();

    for (const result of discoveryResults) {
      if (!result.valid) continue;

      const pluginId = result.manifest.id;
      resultMap.set(pluginId, result);

      const deps: string[] = [];
      if (result.manifest.dependencies?.plugins) {
        for (const dep of result.manifest.dependencies.plugins) {
          const depId = typeof dep === 'string' ? dep : dep.id;
          deps.push(depId);
        }
      }
      depMap.set(pluginId, deps);
    }

    // Topological sort using DFS
    const visit = (pluginId: string) => {
      if (visited.has(pluginId)) return;
      if (visiting.has(pluginId)) {
        logWithCategory('warn', LogCategory.SYSTEM, `Circular dependency detected for plugin: ${pluginId}`);
        return;
      }

      visiting.add(pluginId);

      const deps = depMap.get(pluginId) || [];
      for (const depId of deps) {
        if (depMap.has(depId)) {
          visit(depId);
        }
      }

      visiting.delete(pluginId);
      visited.add(pluginId);

      const result = resultMap.get(pluginId);
      if (result) {
        sorted.push(result);
      }
    };

    for (const pluginId of depMap.keys()) {
      visit(pluginId);
    }

    // Add invalid plugins at the end (won't be loaded but included for completeness)
    for (const result of discoveryResults) {
      if (!result.valid) {
        sorted.push(result);
      }
    }

    return sorted;
  }

  /**
   * Create a plugin state object
   */
  createPluginState(
    pluginId: string,
    instance: FictionLabPlugin,
    manifest: PluginManifest,
    context: any // PluginContext from plugin-context.ts
  ): PluginState {
    return {
      id: pluginId,
      instance,
      manifest,
      context,
      status: 'loading',
      loadedAt: new Date(),
      ipcChannels: [],
      menuItems: [],
    };
  }

  /**
   * Unload a plugin from memory
   *
   * Clears the require cache for the plugin module
   */
  unloadPlugin(pluginPath: string, manifest: PluginManifest): void {
    const entryPath = path.join(pluginPath, manifest.entry.main);

    if (require.cache[entryPath]) {
      delete require.cache[entryPath];
      logWithCategory('info', LogCategory.SYSTEM, `Unloaded plugin module: ${manifest.id}`);
    }
  }
}
