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

    this.registry.on('menu-item-registered', (pluginId: string, item: MenuItem) => {
      logWithCategory('debug', LogCategory.SYSTEM, `Plugin ${pluginId} registered menu item: ${item.label}`);
      this.updatePluginMenu();
    });

    this.registry.on('notification', (pluginId: string, notification: Notification) => {
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
    for (const plugin of activePlugins) {
      if (plugin.manifest.ui?.menuItems) {
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
                    // Send action to plugin
                    logWithCategory('debug', LogCategory.SYSTEM,
                      `Plugin menu action: ${plugin.id} - ${sub.action}`
                    );
                  },
                };
              }
            }),
          });
        }
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
        ...menu.items.slice(0, insertIndex).map(item => ({
          label: item.label,
          submenu: item.submenu,
        })),
        {
          label: 'Plugins',
          submenu: pluginMenuItems,
        },
        ...menu.items.slice(insertIndex).map(item => ({
          label: item.label,
          submenu: item.submenu,
        })),
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
          return {
            label: item.label,
            submenu: item.submenu,
          };
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
   * Get plugin statistics
   */
  getStatistics() {
    if (!this.registry) {
      return null;
    }

    return this.registry.getStatistics();
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
   * Check if plugin system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const pluginManager = new PluginManager();
