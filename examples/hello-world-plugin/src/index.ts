/**
 * Hello World Plugin
 *
 * A simple example plugin demonstrating the FictionLab plugin API.
 * This plugin shows how to:
 * - Implement the FictionLabPlugin interface
 * - Register IPC handlers
 * - Show notifications
 * - Access plugin configuration
 * - Use the logger
 */

import { FictionLabPlugin, PluginContext } from '../../../src/types/plugin-api';

/**
 * Hello World Plugin Class
 */
export default class HelloWorldPlugin implements FictionLabPlugin {
  readonly id = 'hello-world';
  readonly name = 'Hello World Plugin';
  readonly version = '1.0.0';

  private context: PluginContext | null = null;
  private clickCount: number = 0;

  /**
   * Called when the plugin is activated
   */
  async onActivate(context: PluginContext): Promise<void> {
    this.context = context;

    // Log activation
    context.logger.info('Hello World plugin is activating!');

    // Load click count from config
    this.clickCount = context.config.get('clickCount', 0);
    context.logger.debug(`Previous click count: ${this.clickCount}`);

    // Register IPC handlers
    this.registerHandlers(context);

    // Register menu items
    this.registerMenuItems(context);

    // Show welcome notification
    context.ui.showNotification({
      type: 'success',
      message: 'Hello World plugin activated successfully!',
      title: 'Plugin Activated',
      duration: 3000,
    });

    context.logger.info('Hello World plugin activated');
  }

  /**
   * Called when the plugin is deactivated
   */
  async onDeactivate(): Promise<void> {
    if (!this.context) {
      return;
    }

    this.context.logger.info('Hello World plugin is deactivating...');

    // Save click count to config
    await this.context.config.set('clickCount', this.clickCount);

    // Show goodbye notification
    this.context.ui.showNotification({
      type: 'info',
      message: 'Goodbye from Hello World plugin!',
      title: 'Plugin Deactivated',
      duration: 2000,
    });

    this.context.logger.info('Hello World plugin deactivated');
    this.context = null;
  }

  /**
   * Register IPC handlers
   */
  private registerHandlers(context: PluginContext): void {
    // Handler: Get plugin info
    context.ipc.handle('get-info', async () => {
      return {
        id: this.id,
        name: this.name,
        version: this.version,
        clickCount: this.clickCount,
        message: 'Hello from the Hello World plugin!',
      };
    });

    // Handler: Say hello
    context.ipc.handle('say-hello', async (_event, name?: string) => {
      this.clickCount++;

      const greeting = name
        ? `Hello, ${name}! Nice to meet you.`
        : 'Hello, World!';

      context.logger.info(`Say hello called (${this.clickCount} times total)`);

      // Show notification
      context.ui.showNotification({
        type: 'info',
        message: greeting,
        title: 'Greeting',
        duration: 3000,
      });

      return {
        success: true,
        message: greeting,
        clickCount: this.clickCount,
      };
    });

    // Handler: Get statistics
    context.ipc.handle('get-stats', async () => {
      const appVersion = context.services.environment.getAppVersion();
      const isDev = context.services.environment.isDevelopment();
      const dataPath = context.workspace.getPluginDataPath();

      return {
        appVersion,
        isDevelopment: isDev,
        pluginDataPath: dataPath,
        clickCount: this.clickCount,
        uptime: process.uptime(),
      };
    });

    // Handler: Test file system (readonly)
    context.ipc.handle('test-filesystem', async () => {
      try {
        const dataPath = context.workspace.getPluginDataPath();

        // Check if data directory exists
        const exists = await context.services.fileSystem.exists(dataPath);

        // Read directory contents
        let files: string[] = [];
        if (exists) {
          files = await context.services.fileSystem.readdir(dataPath);
        }

        return {
          success: true,
          dataPath,
          exists,
          files,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Handler: Reset click count
    context.ipc.handle('reset-count', async () => {
      const oldCount = this.clickCount;
      this.clickCount = 0;
      await context.config.set('clickCount', 0);

      context.logger.info(`Click count reset from ${oldCount} to 0`);

      context.ui.showNotification({
        type: 'success',
        message: `Click count reset from ${oldCount} to 0`,
        title: 'Counter Reset',
        duration: 2000,
      });

      return {
        success: true,
        oldCount,
        newCount: this.clickCount,
      };
    });

    context.logger.debug('IPC handlers registered');
  }

  /**
   * Register menu items
   */
  private registerMenuItems(context: PluginContext): void {
    context.ui.registerMenuItem({
      id: 'hello-world-main',
      label: 'Hello World',
      submenu: [
        {
          id: 'hello-show-message',
          label: 'Show Hello Message',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => {
            this.showHelloMessage();
          },
        },
        {
          id: 'hello-about',
          label: 'About Plugin',
          click: () => {
            this.showAbout();
          },
        },
        {
          id: 'hello-separator',
          type: 'separator',
        },
        {
          id: 'hello-reset',
          label: 'Reset Counter',
          click: () => {
            this.resetCounter();
          },
        },
      ],
    });

    context.logger.debug('Menu items registered');
  }

  /**
   * Show hello message
   */
  private showHelloMessage(): void {
    if (!this.context) {
      return;
    }

    this.clickCount++;

    this.context.ui.showNotification({
      type: 'success',
      message: `Hello from the plugin! (Click #${this.clickCount})`,
      title: 'Hello World',
      duration: 3000,
    });

    this.context.logger.info(`Hello message shown (click #${this.clickCount})`);
  }

  /**
   * Show about dialog
   */
  private showAbout(): void {
    if (!this.context) {
      return;
    }

    this.context.ui.showDialog({
      type: 'info',
      title: 'About Hello World Plugin',
      message: `${this.name} v${this.version}`,
      detail: [
        'A simple example plugin demonstrating the FictionLab plugin API.',
        '',
        `Total clicks: ${this.clickCount}`,
        `FictionLab version: ${this.context.services.environment.getAppVersion()}`,
        `Plugin data path: ${this.context.workspace.getPluginDataPath()}`,
      ].join('\n'),
      buttons: ['OK'],
    });

    this.context.logger.info('About dialog shown');
  }

  /**
   * Reset counter
   */
  private async resetCounter(): Promise<void> {
    if (!this.context) {
      return;
    }

    const oldCount = this.clickCount;
    this.clickCount = 0;
    await this.context.config.set('clickCount', 0);

    this.context.ui.showNotification({
      type: 'info',
      message: `Counter reset from ${oldCount} to 0`,
      title: 'Counter Reset',
      duration: 2000,
    });

    this.context.logger.info(`Counter reset from ${oldCount} to 0`);
  }
}

// Export the plugin class as default
module.exports = HelloWorldPlugin;
