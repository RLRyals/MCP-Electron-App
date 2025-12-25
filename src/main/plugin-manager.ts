/**
 * Plugin Manager
 *
 * High-level API for managing the plugin system.
 * Integrates plugin registry, loader, and database connection.
 */

import { app, BrowserWindow, Menu, MenuItem as ElectronMenuItem, dialog } from 'electron';
import { logWithCategory, LogCategory } from './logger';
import { PluginRegistry } from './plugin-registry';
import { getDatabasePool, initializeDatabasePool } from './database-connection';
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
    });

    this.registry.on('plugin-deactivated', (pluginId: string) => {
      logWithCategory('info', LogCategory.SYSTEM, `Plugin deactivated: ${pluginId}`);

      // Update plugin menu
      this.updatePluginMenu();
    });

    this.registry.on('plugin-error', (pluginId: string, error: Error) => {
      logWithCategory('error', LogCategory.SYSTEM, `Plugin error (${pluginId}):`, error);

      // Show error notification to user
      if (this.mainWindow) {
        dialog.showMessageBox(this.mainWindow, {
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
    if (!this.mainWindow) {
      return;
    }

    // Map notification type to dialog type
    const dialogType = notification.type === 'success' || notification.type === 'info'
      ? 'info'
      : notification.type;

    dialog.showMessageBox(this.mainWindow, {
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

    // Get menu template
    const menu = Menu.getApplicationMenu();
    if (!menu) {
      return;
    }

    // Find or create Plugins menu
    let pluginMenuIndex = menu.items.findIndex(item => item.label === 'Plugins');

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

    // Create/update Plugins menu
    if (pluginMenuIndex === -1) {
      // Add new Plugins menu after View menu
      const viewMenuIndex = menu.items.findIndex(item => item.label === 'View');
      const insertIndex = viewMenuIndex !== -1 ? viewMenuIndex + 1 : menu.items.length;

      const newMenu = Menu.buildFromTemplate([
        ...menu.items.slice(0, insertIndex),
        {
          label: 'Plugins',
          submenu: pluginMenuItems,
        },
        ...menu.items.slice(insertIndex),
      ]);

      Menu.setApplicationMenu(newMenu);
    } else {
      // Update existing Plugins menu
      const newMenu = Menu.buildFromTemplate(
        menu.items.map((item, index) => {
          if (index === pluginMenuIndex) {
            return {
              label: 'Plugins',
              submenu: pluginMenuItems,
            };
          }
          return item;
        })
      );

      Menu.setApplicationMenu(newMenu);
    }

    logWithCategory('debug', LogCategory.SYSTEM, 'Plugin menu updated');
  }

  /**
   * Open the plugin manager UI
   */
  private openPluginManager(): void {
    if (!this.mainWindow) {
      logWithCategory('warn', LogCategory.SYSTEM, 'Cannot open plugin manager: no main window');
      return;
    }

    // Send message to renderer to show plugin manager
    this.mainWindow.webContents.send('show-plugin-manager');

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

    // Call the plugin's IPC handler directly
    const channelName = `plugin:${pluginId}:${action}`;

    try {
      // Invoke the IPC handler (this simulates what the renderer would do)
      const result = await this.mainWindow?.webContents.executeJavaScript(
        `require('electron').ipcRenderer.invoke('${channelName}')`
      );

      logWithCategory('debug', LogCategory.SYSTEM, `Plugin action ${channelName} completed:`, result);
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Plugin action ${channelName} failed:`, error);

      // Show error notification
      if (this.mainWindow) {
        this.mainWindow.webContents.send('show-notification', {
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
      
      // 4. Reload plugins
      if (this.registry) {
        // If plugin was already loaded, we might need to unload it first?
        // simple approach: discover and load all (which updates existing)
        await this.registry.discoverAndLoadAll();
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
