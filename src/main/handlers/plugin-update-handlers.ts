/**
 * Plugin Update Handlers
 *
 * IPC handlers for managing and updating plugins from local folders.
 */

import { ipcMain, app, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { logWithCategory, LogCategory } from '../logger';
import { pluginManager } from '../plugin-manager';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  path: string;
}

/**
 * Get the plugins directory path
 */
function getPluginsDirectory(): string {
  return path.join(app.getPath('userData'), 'plugins');
}

/**
 * Recursively delete a directory, handling Windows long path issues
 */
async function safeRemoveDir(dirPath: string): Promise<void> {
  try {
    await fs.remove(dirPath);
  } catch (error: any) {
    if (error.code === 'ENOTEMPTY' || error.code === 'EPERM') {
      logWithCategory('warn', LogCategory.SYSTEM, `Standard remove failed, trying shell delete: ${error.message}`);
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        if (process.platform === 'win32') {
          await execAsync(`rmdir /s /q "${dirPath}"`, { timeout: 30000 });
        } else {
          await execAsync(`rm -rf "${dirPath}"`, { timeout: 30000 });
        }
      } catch (shellError: any) {
        logWithCategory('warn', LogCategory.SYSTEM, `Shell delete also failed: ${shellError.message}`);
      }
    } else {
      throw error;
    }
  }
}

/**
 * Extract a zip file
 */
async function extractZip(zipPath: string, destPath: string): Promise<void> {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  await fs.ensureDir(destPath);

  if (process.platform === 'win32') {
    // Use PowerShell on Windows
    await execAsync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`,
      { timeout: 60000 }
    );
  } else {
    // Use unzip on Unix
    await execAsync(`unzip -o "${zipPath}" -d "${destPath}"`, { timeout: 60000 });
  }
}

/**
 * Register plugin update handlers
 */
export function registerPluginUpdateHandlers() {
  // List installed plugins with their info
  ipcMain.handle('plugin:list-installed', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: List installed plugins');
    try {
      const pluginsDir = getPluginsDirectory();
      const plugins: PluginInfo[] = [];

      if (!await fs.pathExists(pluginsDir)) {
        return plugins;
      }

      const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.includes('.backup-')) continue;

        const pluginPath = path.join(pluginsDir, entry.name);
        const manifestPath = path.join(pluginPath, 'plugin.json');

        if (await fs.pathExists(manifestPath)) {
          try {
            const manifest = await fs.readJson(manifestPath);
            plugins.push({
              id: manifest.id || entry.name,
              name: manifest.name || entry.name,
              version: manifest.version || 'unknown',
              description: manifest.description || '',
              path: pluginPath,
            });
          } catch (error: any) {
            logWithCategory('warn', LogCategory.SYSTEM, `Failed to read plugin manifest: ${entry.name}`, { error: error.message });
          }
        }
      }

      logWithCategory('info', LogCategory.SYSTEM, `Found ${plugins.length} installed plugins`);
      return plugins;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Failed to list installed plugins', { error: error.message });
      throw error;
    }
  });

  // Update plugin from a local folder
  ipcMain.handle('plugin:update-from-folder', async (_event, pluginId: string, folderPath?: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Update plugin ${pluginId} from folder`);
    try {
      const pluginsDir = getPluginsDirectory();
      const pluginPath = path.join(pluginsDir, pluginId);

      let sourcePath = folderPath;
      if (!sourcePath) {
        const result = await dialog.showOpenDialog({
          title: `Select ${pluginId} Plugin Folder`,
          message: 'Select the plugin folder (containing plugin.json)',
          properties: ['openDirectory'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, cancelled: true };
        }
        sourcePath = result.filePaths[0];
      }

      const manifestPath = path.join(sourcePath, 'plugin.json');
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('Selected folder does not contain plugin.json');
      }

      const manifest = await fs.readJson(manifestPath);
      if (manifest.id !== pluginId) {
        throw new Error(`Plugin ID mismatch: expected "${pluginId}", found "${manifest.id}"`);
      }

      try {
        await pluginManager.deactivatePlugin(pluginId);
      } catch (e) {
        // Plugin might not be active
      }

      const backupPath = path.join(pluginsDir, `${pluginId}.backup-${Date.now()}`);
      if (await fs.pathExists(pluginPath)) {
        await fs.move(pluginPath, backupPath);
      }

      await fs.copy(sourcePath, pluginPath, { overwrite: true });
      await setupBundledDependencies(pluginPath);

      try {
        await safeRemoveDir(backupPath);
      } catch (e) {
        // Non-fatal
      }

      try {
        await pluginManager.reloadPlugin(pluginId);
      } catch (e: any) {
        logWithCategory('warn', LogCategory.SYSTEM, 'Failed to reload plugin', { error: e.message });
      }

      return { success: true, message: 'Plugin updated. Restart FictionLab to apply changes.', version: manifest.version };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to update plugin ${pluginId} from folder`, { error: error.message });
      throw error;
    }
  });

  // Open plugin folder in file explorer
  ipcMain.handle('plugin:open-folder', async (_event, pluginId: string) => {
    const pluginPath = path.join(getPluginsDirectory(), pluginId);
    if (await fs.pathExists(pluginPath)) {
      await shell.openPath(pluginPath);
      return { success: true };
    }
    throw new Error('Plugin folder not found');
  });

  // Uninstall a plugin
  ipcMain.handle('plugin:uninstall', async (_event, pluginId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Uninstall plugin ${pluginId}`);
    try {
      try {
        await pluginManager.deactivatePlugin(pluginId);
      } catch (e) {
        // Plugin might not be active
      }

      const pluginsDir = getPluginsDirectory();
      const pluginPath = path.join(pluginsDir, pluginId);

      if (await fs.pathExists(pluginPath)) {
        await safeRemoveDir(pluginPath);
        logWithCategory('info', LogCategory.SYSTEM, `Plugin ${pluginId} uninstalled`);
        return { success: true };
      } else {
        throw new Error('Plugin not found');
      }
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to uninstall plugin ${pluginId}`, { error: error.message });
      throw error;
    }
  });

  // Get plugin directory path
  ipcMain.handle('plugin:get-path', async (_event, pluginId: string) => {
    return path.join(getPluginsDirectory(), pluginId);
  });

  logWithCategory('info', LogCategory.SYSTEM, 'Plugin update handlers registered');
}

/**
 * Setup bundled dependencies for a plugin
 */
async function setupBundledDependencies(pluginPath: string): Promise<void> {
  const bundledPath = path.join(pluginPath, 'bundled');
  const nodeModulesPath = path.join(pluginPath, 'node_modules');

  if (!await fs.pathExists(bundledPath)) {
    return;
  }

  logWithCategory('info', LogCategory.SYSTEM, 'Setting up bundled dependencies...');

  try {
    const bundledEntries = await fs.readdir(bundledPath, { withFileTypes: true });

    for (const entry of bundledEntries) {
      if (!entry.isDirectory()) continue;

      const bundledPkgPath = path.join(bundledPath, entry.name, 'package.json');
      if (await fs.pathExists(bundledPkgPath)) {
        const bundledPkg = await fs.readJson(bundledPkgPath);
        const pkgName = bundledPkg.name || entry.name;

        let targetPath: string;
        if (pkgName.startsWith('@')) {
          const [scope, name] = pkgName.split('/');
          await fs.ensureDir(path.join(nodeModulesPath, scope));
          targetPath = path.join(nodeModulesPath, scope, name);
        } else {
          await fs.ensureDir(nodeModulesPath);
          targetPath = path.join(nodeModulesPath, pkgName);
        }

        await fs.copy(path.join(bundledPath, entry.name), targetPath, { overwrite: true });
        logWithCategory('info', LogCategory.SYSTEM, `Linked bundled dependency: ${pkgName}`);
      }
    }
  } catch (error: any) {
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to setup bundled dependencies:', error);
  }
}
