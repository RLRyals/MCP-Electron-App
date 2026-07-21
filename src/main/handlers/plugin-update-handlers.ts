/**
 * Plugin Update Handlers
 *
 * IPC handlers for managing and updating plugins from local folders.
 */

import { ipcMain, app, dialog, shell, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { logWithCategory, LogCategory } from '../logger';
import { pluginManager } from '../plugin-manager';
import {
  updatePluginInPlace,
  validatePluginUpdateSource,
  PluginUpdateError,
} from '../plugin-update-swap';

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
 * Show a message box, with or without an owning window.
 *
 * Electron's `dialog.showMessageBox` has distinct 1-arg and 2-arg
 * overloads; calling the 2-arg form with `undefined` as the window is not
 * the same as calling the 1-arg form, so this picks the right one instead
 * of just casting `window as any`.
 */
function showMessageBox(
  window: Electron.BrowserWindow | undefined,
  options: Electron.MessageBoxOptions
): Promise<Electron.MessageBoxReturnValue> {
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
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
        // Skip update-swap bookkeeping directories (see plugin-update-swap.ts).
        // `.includes(...)` (not `.endsWith(...)`) so a human-renamed rollback
        // copy like `<id>.bak-0.1.1` is still recognized as a `.bak` sibling
        // (mea-4yh); dot-prefixed folders are skipped too.
        if (
          entry.name.startsWith('.') ||
          entry.name.includes('.bak') ||
          entry.name.includes('.staging') ||
          entry.name.includes('.backup-')
        ) {
          continue;
        }

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

  // Update an already-installed plugin from a local folder (issue #182).
  //
  // v1 boundary: this never hot-reloads the running plugin -- it only
  // validates + atomically swaps the files on disk (with .bak rollback on
  // failure), then offers a single prompted restart. If the user declines
  // the restart, the new files are on disk but the old code stays running
  // in memory until FictionLab is restarted (same as before this handler
  // ran, just without the old uninstall/reinstall dance).
  ipcMain.handle('plugin:update-from-folder', async (event, pluginId: string, folderPath?: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Update plugin ${pluginId} from folder`);
    try {
      const pluginsDir = getPluginsDirectory();

      let sourcePath = folderPath;
      if (!sourcePath) {
        const result = await dialog.showOpenDialog({
          title: `Select Updated ${pluginId} Plugin Folder`,
          message: 'Select the folder containing the updated plugin.json',
          properties: ['openDirectory'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, cancelled: true };
        }
        sourcePath = result.filePaths[0];
      }

      const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;

      // Validate before touching anything: id must match, version must be
      // strictly greater (semver). Refuse with a clear message otherwise.
      let manifest: { id: string; name?: string; version: string };
      let currentVersion: string | null;
      try {
        const validation = await validatePluginUpdateSource(pluginsDir, pluginId, sourcePath);
        manifest = validation.manifest;
        currentVersion = validation.currentVersion;
      } catch (error: any) {
        if (error instanceof PluginUpdateError) {
          logWithCategory('warn', LogCategory.SYSTEM, `Update refused for ${pluginId}: ${error.message}`);
          return { success: false, refused: true, code: error.code, message: error.message };
        }
        throw error;
      }

      // Confirm with the user, showing current -> new version.
      const confirmation = await showMessageBox(window, {
        type: 'question',
        buttons: ['Update', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Confirm Plugin Update',
        message: `Update ${manifest.name || pluginId}?`,
        detail: `${currentVersion ?? 'unknown'}  →  ${manifest.version}`,
      });

      if (confirmation.response !== 0) {
        return { success: false, cancelled: true };
      }

      // Atomic swap: extract already happened (folder select), verify
      // structure already happened (validation above); now swap the
      // directory in with a .bak of the previous version for rollback.
      await updatePluginInPlace(pluginsDir, pluginId, sourcePath);

      logWithCategory('info', LogCategory.SYSTEM, `Plugin ${pluginId} updated ${currentVersion ?? 'unknown'} -> ${manifest.version}`);

      // One restart, prompted -- no uninstall step, no double restart.
      const restart = await showMessageBox(window, {
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update Complete',
        message: `Restart FictionLab to load ${manifest.name || pluginId} v${manifest.version}`,
      });

      if (restart.response === 0) {
        app.relaunch();
        app.exit(0);
      }

      return {
        success: true,
        version: manifest.version,
        previousVersion: currentVersion,
        restarting: restart.response === 0,
        message:
          restart.response === 0
            ? `Updated to v${manifest.version}. Restarting FictionLab...`
            : `Updated to v${manifest.version}. Restart FictionLab whenever you're ready to load it.`,
      };
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
