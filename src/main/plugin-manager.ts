/**
 * Plugin Manager
 *
 * High-level API for managing the plugin system.
 * Integrates plugin registry, loader, and database connection.
 */

import { app, BrowserWindow, Menu, MenuItem as ElectronMenuItem, dialog } from 'electron';
import * as path from 'path';
import { logWithCategory, LogCategory } from './logger';
import { PluginRegistry } from './plugin-registry';
import { getDatabasePool, initializeDatabasePool } from './database-connection';
import { getBaseMenuTemplate } from './index';
import { recoverPluginsDirectory } from './plugin-update-swap';
import {
  PluginState,
  PluginNotification,
  PluginMenuItem,
} from '../types/plugin-api';

/**
 * Plugin Manager Class
 *
 * Singleton that manages the entire plugin system
 */
class PluginManager {
  private registry: PluginRegistry | null = null;
  private mainWindow: BrowserWindow | null = null;
  private pluginMenu: ElectronMenuItem | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the plugin system
   *
   * Should be called after the database is available
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logWithCategory('warn', LogCategory.SYSTEM, 'Plugin manager already initialized');
      return;
    }

    logWithCategory('info', LogCategory.SYSTEM, 'Initializing plugin manager...');

    try {
      // Repair any plugin update swap interrupted by a crash/kill (issue
      // #182), and clean up `.bak` copies left over from an update that
      // completed successfully on a previous run. Must run before
      // discovery so the loader never sees a half-swapped plugin.
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');
      try {
        const recovery = await recoverPluginsDirectory(pluginsDir);
        if (recovery.completed.length || recovery.rolledBack.length || recovery.cleaned.length) {
          logWithCategory('info', LogCategory.SYSTEM, 'Plugin update recovery pass:', recovery);
        }
      } catch (error: any) {
        logWithCategory('warn', LogCategory.SYSTEM, 'Plugin update recovery pass failed (continuing):', error);
      }

      // Ensure database pool is initialized
      await initializeDatabasePool();
      const dbPool = getDatabasePool();

      // Create plugin registry
      this.registry = new PluginRegistry({
        databasePool: dbPool,
        autoActivate: true,
        skipDependencyChecks: false,
      });

      // Set up event listeners
      this.setupEventListeners();

      // Discover and load plugins
      await this.registry.discoverAndLoadAll();

      this.initialized = true;

      logWithCategory('info', LogCategory.SYSTEM, 'Plugin manager initialized successfully');

      // Show initialization summary
      const stats = this.registry.getStatistics();
      logWithCategory('info', LogCategory.SYSTEM,
        `Plugin summary: ${stats.total} total, ${stats.active} active, ${stats.error} errors`
      );

    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Failed to initialize plugin manager:', error);
      throw error;
    }
  }

  /**
   * Set the main window reference
   *
   * Used for showing notifications and dialogs
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    logWithCategory('debug', LogCategory.SYSTEM, 'Plugin manager: main window reference set');
  }

  /**
   * Check if the main window is still valid for IPC communication
   */
  private isWindowValid(): boolean {
    return this.mainWindow !== null &&
           !this.mainWindow.isDestroyed() &&
           this.mainWindow.webContents &&
           !this.mainWindow.webContents.isDestroyed();
  }

  /**
   * Set up event listeners for plugin events
   */
  private setupEventListeners(): void {
    if (!this.registry) {
      return;
    }

    this.registry.on('plugin-loaded', (pluginId: string, plugin: PluginState) => {
      logWithCategory('info', LogCategory.SYSTEM, `Plugin loaded: ${pluginId} v${plugin.manifest.version}`);
    });

    this.registry.on('plugin-activated', (pluginId: string, plugin: PluginState) => {
      logWithCategory('info', LogCategory.SYSTEM, `Plugin activated: ${pluginId}`);

      // Update plugin menu
      this.updatePluginMenu();

      // Notify renderer of plugin state change (check window is still valid)
      if (this.isWindowValid()) {
        this.mainWindow!.webContents.send('plugin-state-changed', { pluginId, state: 'activated' });
      }
    });

    this.registry.on('plugin-deactivated', (pluginId: string) => {
      logWithCategory('info', LogCategory.SYSTEM, `Plugin deactivated: ${pluginId}`);

      // Update plugin menu
      this.updatePluginMenu();

      // Notify renderer of plugin state change (check window is still valid)
      if (this.isWindowValid()) {
        this.mainWindow!.webContents.send('plugin-state-changed', { pluginId, state: 'deactivated' });
      }
    });

    this.registry.on('plugin-error', (pluginId: string, error: Error) => {
      logWithCategory('error', LogCategory.SYSTEM, `Plugin error (${pluginId}):`, error);

      // Show error notification to user (check window is still valid)
      if (this.isWindowValid()) {
        dialog.showMessageBox(this.mainWindow!, {
          type: 'error',
          title: 'Plugin Error',
          message: `Plugin ${pluginId} encountered an error`,
          detail: error.message,
        });
      }
    });

    this.registry.on('menu-item-registered', (pluginId: string, item: PluginMenuItem) => {
      logWithCategory('debug', LogCategory.SYSTEM, `Plugin ${pluginId} registered menu item: ${item.label}`);
      this.updatePluginMenu();
    });

    this.registry.on('notification', (pluginId: string, notification: PluginNotification) => {
      this.showPluginNotification(pluginId, notification);
    });
  }

  /**
   * Show a notification from a plugin
   */
  private showPluginNotification(pluginId: string, notification: PluginNotification): void {
    if (!this.isWindowValid()) {
      return;
    }

    // Map notification type to dialog type
    const dialogType = notification.type === 'success' || notification.type === 'info'
      ? 'info'
      : notification.type;

    dialog.showMessageBox(this.mainWindow!, {
      type: dialogType,
      title: notification.title || `Plugin: ${pluginId}`,
      message: notification.message,
    });
  }

  /**
   * Update the Plugins menu with items from all active plugins
   */
  private updatePluginMenu(): void {
    if (!this.registry) {
      return;
    }

    const activePlugins = this.registry.getPluginsByStatus('active');

    // Build plugin menu items
    const pluginMenuItems: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Manage Plugins',
        click: () => {
          this.openPluginManager();
        },
      },
      { type: 'separator' },
    ];

    // Add items from each active plugin
    logWithCategory('info', LogCategory.SYSTEM, `Building menu for ${activePlugins.length} active plugins`);

    for (const plugin of activePlugins) {
      logWithCategory('info', LogCategory.SYSTEM, `Checking plugin ${plugin.id} for menu items...`);

      if (plugin.manifest.ui?.menuItems) {
        logWithCategory('info', LogCategory.SYSTEM, `Plugin ${plugin.id} has ${plugin.manifest.ui.menuItems.length} menu items`);

        for (const menuItem of plugin.manifest.ui.menuItems) {
          pluginMenuItems.push({
            label: menuItem.label,
            submenu: menuItem.submenu?.map(sub => {
              if (typeof sub === 'string') {
                return { label: sub };
              } else {
                return {
                  label: sub.label,
                  accelerator: sub.accelerator,
                  click: () => {
                    logWithCategory('debug', LogCategory.SYSTEM,
                      `Plugin menu action: ${plugin.id} - ${sub.action}`
                    );

                    // Handle plugin menu action
                    this.handlePluginMenuAction(plugin.id, sub.action || '');
                  },
                };
              }
            }),
          });
        }
      } else {
        logWithCategory('info', LogCategory.SYSTEM, `Plugin ${plugin.id} has no menu items (ui: ${!!plugin.manifest.ui})`);
      }
    }

    // If no active plugins, show a message
    if (activePlugins.length === 0) {
      pluginMenuItems.push({
        label: 'No plugins loaded',
        enabled: false,
      });
    }

    // Rebuild the full menu from the base template every time rather than
    // reading back Menu.getApplicationMenu().items. That base template is
    // plain MenuItemConstructorOptions (never live MenuItem instances), so
    // click handlers on every submenu survive the rebuild, and rebuilding
    // from source each time makes repeated calls idempotent — no
    // accumulation of stale/duplicate Plugins menus.
    const baseTemplate = getBaseMenuTemplate();
    const viewMenuIndex = baseTemplate.findIndex(item => item.label === 'View');
    const insertIndex = viewMenuIndex !== -1 ? viewMenuIndex + 1 : baseTemplate.length;

    const fullTemplate: Electron.MenuItemConstructorOptions[] = [
      ...baseTemplate.slice(0, insertIndex),
      {
        label: 'Plugins',
        submenu: pluginMenuItems,
      },
      ...baseTemplate.slice(insertIndex),
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(fullTemplate));

    logWithCategory('debug', LogCategory.SYSTEM, 'Plugin menu updated');
  }

  /**
   * Open the plugin manager UI
   */
  private openPluginManager(): void {
    if (!this.isWindowValid()) {
      logWithCategory('warn', LogCategory.SYSTEM, 'Cannot open plugin manager: no valid window');
      return;
    }

    // Send message to renderer to show plugin manager
    this.mainWindow!.webContents.send('show-plugin-manager');

    logWithCategory('debug', LogCategory.SYSTEM, 'Opening plugin manager UI');
  }

  /**
   * Handle a menu action from a plugin
   */
  private async handlePluginMenuAction(pluginId: string, action: string): Promise<void> {
    if (!this.registry) {
      return;
    }

    logWithCategory('info', LogCategory.SYSTEM, `Handling plugin action: ${pluginId} -> ${action}`);

    // Send message to renderer to invoke the plugin's IPC handler
    // The renderer will call electronAPI.invoke(channelName)
    const channelName = `plugin:${pluginId}:${action}`;

    try {
      if (this.isWindowValid()) {
        // Send event to renderer to invoke the handler
        this.mainWindow!.webContents.send('plugin-action', {
          pluginId,
          action,
          channelName
        });

        logWithCategory('debug', LogCategory.SYSTEM, `Sent plugin action to renderer: ${channelName}`);
      }
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Plugin action ${channelName} failed:`, error);

      // Show error notification
      if (this.isWindowValid()) {
        this.mainWindow!.webContents.send('show-notification', {
          type: 'error',
          message: `Plugin action failed: ${error.message}`,
        });
      }
    }
  }

  /**
   * Get plugin statistics
   */
  getStatistics() {
    if (!this.registry) {
      return null;
    }

    return this.registry.getStatistics();
  }

  /**
   * Get the plugin registry
   */
  getRegistry(): PluginRegistry | null {
    return this.registry;
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): PluginState[] {
    if (!this.registry) {
      return [];
    }

    return this.registry.getAllPlugins();
  }

  /**
   * Get a specific plugin
   */
  getPlugin(pluginId: string): PluginState | undefined {
    if (!this.registry) {
      return undefined;
    }

    return this.registry.getPlugin(pluginId);
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId: string): Promise<void> {
    if (!this.registry) {
      throw new Error('Plugin manager not initialized');
    }

    await this.registry.activatePlugin(pluginId);
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    if (!this.registry) {
      throw new Error('Plugin manager not initialized');
    }

    await this.registry.deactivatePlugin(pluginId);
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginId: string): Promise<void> {
    if (!this.registry) {
      throw new Error('Plugin manager not initialized');
    }

    await this.registry.reloadPlugin(pluginId);
  }

  /**
   * Clean up the plugin system
   *
   * Should be called before app quits
   */
  async cleanup(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logWithCategory('info', LogCategory.SYSTEM, 'Cleaning up plugin manager...');

    if (this.registry) {
      await this.registry.cleanup();
    }

    this.initialized = false;
    this.mainWindow = null;

    logWithCategory('info', LogCategory.SYSTEM, 'Plugin manager cleaned up');
  }

  /**
   * Import a plugin from a local directory
   * 
   * @param sourcePath Path to the plugin directory to import
   * @returns The imported plugin ID
   */
  async importPlugin(sourcePath: string): Promise<string> {
    logWithCategory('info', LogCategory.SYSTEM, `Importing plugin from ${sourcePath}...`);
    
    // Lazy load fs-extra and path to avoid circular deps or startup cost
    const fs = require('fs-extra');
    const path = require('path');
    
    try {
      // 1. Validate source
      if (!await fs.pathExists(sourcePath)) {
        throw new Error(`Source path does not exist: ${sourcePath}`);
      }
      
      const manifestPath = path.join(sourcePath, 'plugin.json');
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('No plugin.json found in source directory');
      }
      
      const manifest = await fs.readJson(manifestPath);
      if (!manifest.id) {
        throw new Error('Plugin manifest missing ID');
      }
      
      // 2. Determine destination
      // Using app.getPath('userData') directly as we know that's where loader looks
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');
      const destPath = path.join(pluginsDir, manifest.id);
      
      // 3. Copy plugin
      logWithCategory('info', LogCategory.SYSTEM, `Copying plugin to ${destPath}...`);
      await fs.copy(sourcePath, destPath, { overwrite: true });

      // 3.5. Setup bundled dependencies and install external dependencies if needed
      const nodeModulesPath = path.join(destPath, 'node_modules');
      const packageJsonPath = path.join(destPath, 'package.json');
      const bundledPath = path.join(destPath, 'bundled');

      // First, link any bundled dependencies into node_modules
      // This handles packages like @fictionlab/workflow-runner that are bundled with the plugin
      if (await fs.pathExists(bundledPath)) {
        logWithCategory('info', LogCategory.SYSTEM, `Setting up bundled dependencies...`);
        try {
          const bundledEntries = await fs.readdir(bundledPath, { withFileTypes: true });

          for (const entry of bundledEntries) {
            if (entry.isDirectory()) {
              const bundledPkgPath = path.join(bundledPath, entry.name, 'package.json');

              if (await fs.pathExists(bundledPkgPath)) {
                const bundledPkg = await fs.readJson(bundledPkgPath);
                const pkgName = bundledPkg.name || entry.name;

                // Determine target path in node_modules (handles scoped packages like @fictionlab/workflow-runner)
                let targetPath: string;
                if (pkgName.startsWith('@')) {
                  const [scope, name] = pkgName.split('/');
                  const scopePath = path.join(nodeModulesPath, scope);
                  await fs.ensureDir(scopePath);
                  targetPath = path.join(scopePath, name);
                } else {
                  await fs.ensureDir(nodeModulesPath);
                  targetPath = path.join(nodeModulesPath, pkgName);
                }

                // Copy bundled package to node_modules (more reliable than symlinks on Windows)
                const bundledSrcPath = path.join(bundledPath, entry.name);
                await fs.copy(bundledSrcPath, targetPath, { overwrite: true });

                logWithCategory('info', LogCategory.SYSTEM, `Linked bundled dependency: ${pkgName}`);
              }
            }
          }
        } catch (error: any) {
          logWithCategory('error', LogCategory.SYSTEM, `Failed to setup bundled dependencies:`, error);
          // Continue - the plugin might still work
        }
      }

      // Then install any external dependencies if needed
      if (await fs.pathExists(packageJsonPath)) {
        // Check if package.json has dependencies that need installing
        const packageJson = await fs.readJson(packageJsonPath);
        const hasDependencies = packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0;

        if (hasDependencies) {
          logWithCategory('info', LogCategory.SYSTEM, `Installing plugin dependencies...`);
          try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            // Run npm install in the plugin directory
            await execAsync('npm install --omit=dev', {
              cwd: destPath,
              timeout: 120000 // 2 minute timeout
            });

            logWithCategory('info', LogCategory.SYSTEM, `Plugin dependencies installed successfully`);
          } catch (error: any) {
            logWithCategory('error', LogCategory.SYSTEM, `Failed to install plugin dependencies:`, error);
            // Don't throw - try to load anyway in case dependencies are optional
          }
        }
      }

      // 4. Load the new plugin
      if (this.registry) {
        // Only load this specific plugin instead of re-discovering all plugins
        // This avoids "already loaded" errors for existing plugins
        await this.registry.loadPlugin(destPath, { force: false });

        // Activate the plugin if auto-activate is enabled
        if (this.registry['options']?.autoActivate) {
          await this.registry.activatePlugin(manifest.id);
        }
      }

      return manifest.id;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Failed to import plugin:', error);
      throw error;
    }
  }

  /**
   * Check if plugin system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const pluginManager = new PluginManager();
