import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { pluginManager } from '../plugin-manager';
import { logWithCategory, LogCategory } from '../logger';

/**
 * Get the path to bundled example plugins
 */
function getBundledPluginsPath(): string {
  if (app.isPackaged) {
    // In packaged app, example plugins are in resources/example-plugins
    return path.join(process.resourcesPath, 'example-plugins');
  } else {
    // In development, use the examples directory directly
    return path.join(__dirname, '..', '..', '..', 'examples');
  }
}

/**
 * Register bundled plugins handlers
 */
export function registerBundledPluginsHandlers() {
  // List bundled example plugins
  ipcMain.handle('bundled-plugins:list', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: List bundled plugins request');
    try {
      const bundledPath = getBundledPluginsPath();

      if (!fs.existsSync(bundledPath)) {
        logWithCategory('warn', LogCategory.SYSTEM, `Bundled plugins path not found: ${bundledPath}`);
        return [];
      }

      const entries = await fs.readdir(bundledPath, { withFileTypes: true });
      const plugins = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginJsonPath = path.join(bundledPath, entry.name, 'plugin.json');

          if (fs.existsSync(pluginJsonPath)) {
            try {
              const pluginJson = await fs.readJson(pluginJsonPath);
              plugins.push({
                id: pluginJson.id || entry.name,
                name: pluginJson.name || entry.name,
                description: pluginJson.description || 'No description',
                version: pluginJson.version || '1.0.0',
                icon: pluginJson.icon || '🔌',
                bundledPath: path.join(bundledPath, entry.name),
                installed: false // Will check if already installed
              });
            } catch (error: any) {
              logWithCategory('warn', LogCategory.SYSTEM, `Failed to read plugin.json for ${entry.name}`, { error: error.message });
            }
          }
        }
      }

      // Check which plugins are already installed
      const installedPlugins = pluginManager.getAllPlugins();
      const installedIds = installedPlugins.map(p => p.id);

      plugins.forEach(plugin => {
        plugin.installed = installedIds.includes(plugin.id);
      });

      logWithCategory('info', LogCategory.SYSTEM, `IPC: Found ${plugins.length} bundled plugins`);
      return plugins;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'IPC: List bundled plugins failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Install a bundled example plugin
  ipcMain.handle('bundled-plugins:install', async (event, pluginId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Install bundled plugin request for ${pluginId}`);
    try {
      const bundledPath = getBundledPluginsPath();

      // Find the directory that contains this plugin ID
      let sourcePath: string | null = null;

      if (fs.existsSync(bundledPath)) {
        const entries = await fs.readdir(bundledPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginJsonPath = path.join(bundledPath, entry.name, 'plugin.json');

            if (fs.existsSync(pluginJsonPath)) {
              try {
                const pluginJson = await fs.readJson(pluginJsonPath);
                if (pluginJson.id === pluginId) {
                  sourcePath = path.join(bundledPath, entry.name);
                  break;
                }
              } catch (error) {
                // Skip invalid plugin.json files
                continue;
              }
            }
          }
        }
      }

      if (!sourcePath || !fs.existsSync(sourcePath)) {
        throw new Error(`Bundled plugin not found: ${pluginId}`);
      }

      logWithCategory('info', LogCategory.SYSTEM, `IPC: Found bundled plugin at: ${sourcePath}`);

      // Use the existing plugin import functionality
      const id = await pluginManager.importPlugin(sourcePath);
      logWithCategory('info', LogCategory.SYSTEM, `IPC: Install bundled plugin success, ID: ${id}`);
      return id;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'IPC: Install bundled plugin failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Get bundled plugins path (for debugging)
  ipcMain.handle('bundled-plugins:get-path', async () => {
    const bundledPath = getBundledPluginsPath();
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Bundled plugins path: ${bundledPath}`);
    return bundledPath;
  });
}
