/**
 * Plugin Update Handlers
 *
 * IPC handlers for checking and updating plugins from GitHub releases.
 */

import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { logWithCategory, LogCategory } from '../logger';
import { pluginManager } from '../plugin-manager';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  path: string;
  hasUpdate?: boolean;
  latestVersion?: string;
  githubRepo?: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
  zipball_url: string;
  tarball_url: string;
}

// Known plugin GitHub repositories
const PLUGIN_REPOS: Record<string, string> = {
  'fictionlab-workflow': 'RLRyals/fictionlab-workflow',
};

/**
 * Get the plugins directory path
 */
function getPluginsDirectory(): string {
  return path.join(app.getPath('userData'), 'plugins');
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
              githubRepo: PLUGIN_REPOS[manifest.id] || manifest.repository,
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

  // Check for plugin updates from GitHub
  ipcMain.handle('plugin:check-update', async (_event, pluginId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Check update for plugin ${pluginId}`);
    try {
      const repo = PLUGIN_REPOS[pluginId];
      if (!repo) {
        return { hasUpdate: false, error: 'No GitHub repository configured for this plugin' };
      }

      // Get current version
      const pluginsDir = getPluginsDirectory();
      const manifestPath = path.join(pluginsDir, pluginId, 'plugin.json');

      let currentVersion = '0.0.0';
      if (await fs.pathExists(manifestPath)) {
        const manifest = await fs.readJson(manifestPath);
        currentVersion = manifest.version || '0.0.0';
      }

      // Check GitHub for latest release
      const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'FictionLab-App',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No releases yet, check commits instead
          const commitsResponse = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'FictionLab-App',
            },
          });

          if (commitsResponse.ok) {
            const commits = await commitsResponse.json();
            if (commits.length > 0) {
              return {
                hasUpdate: true, // Assume update available if no release tracking
                latestVersion: 'latest',
                currentVersion,
                message: 'Updates available from main branch',
              };
            }
          }
          return { hasUpdate: false, currentVersion };
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release: GitHubRelease = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, '');

      // Simple version comparison
      const hasUpdate = latestVersion !== currentVersion;

      return {
        hasUpdate,
        latestVersion,
        currentVersion,
        releaseName: release.name,
        publishedAt: release.published_at,
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to check update for ${pluginId}`, { error: error.message });
      return { hasUpdate: false, error: error.message };
    }
  });

  // Update/reinstall plugin from GitHub
  ipcMain.handle('plugin:update-from-github', async (_event, pluginId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Update plugin ${pluginId} from GitHub`);
    try {
      const repo = PLUGIN_REPOS[pluginId];
      if (!repo) {
        throw new Error('No GitHub repository configured for this plugin');
      }

      const pluginsDir = getPluginsDirectory();
      const pluginPath = path.join(pluginsDir, pluginId);
      const tempDir = path.join(os.tmpdir(), `fictionlab-plugin-${pluginId}-${Date.now()}`);

      // Step 1: Clone/download from GitHub
      logWithCategory('info', LogCategory.SYSTEM, `Cloning ${repo} to temp directory...`);
      await fs.ensureDir(tempDir);

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Clone the repository
      await execAsync(`git clone --depth 1 https://github.com/${repo}.git .`, {
        cwd: tempDir,
        timeout: 120000,
      });

      // Step 2: Build the plugin if needed
      const packageJsonPath = path.join(tempDir, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        logWithCategory('info', LogCategory.SYSTEM, 'Installing dependencies and building...');

        try {
          await execAsync('npm install', { cwd: tempDir, timeout: 180000 });
        } catch (e: any) {
          logWithCategory('warn', LogCategory.SYSTEM, 'npm install failed, continuing...', { error: e.message });
        }

        try {
          await execAsync('npm run build', { cwd: tempDir, timeout: 180000 });
        } catch (e: any) {
          logWithCategory('warn', LogCategory.SYSTEM, 'npm run build failed, continuing...', { error: e.message });
        }
      }

      // Step 3: Find the built plugin directory
      // For fictionlab-workflow, the plugin is in packages/workflow-plugin/dist
      let sourcePluginDir = tempDir;

      // Check for monorepo structure
      const workflowPluginDist = path.join(tempDir, 'packages', 'workflow-plugin', 'dist');
      const workflowPluginRoot = path.join(tempDir, 'packages', 'workflow-plugin');

      if (await fs.pathExists(path.join(workflowPluginDist, 'plugin.json'))) {
        sourcePluginDir = workflowPluginDist;
      } else if (await fs.pathExists(path.join(workflowPluginRoot, 'plugin.json'))) {
        sourcePluginDir = workflowPluginRoot;
      } else if (await fs.pathExists(path.join(tempDir, 'dist', 'plugin.json'))) {
        sourcePluginDir = path.join(tempDir, 'dist');
      }

      // Verify plugin.json exists in source
      const sourceManifestPath = path.join(sourcePluginDir, 'plugin.json');
      if (!await fs.pathExists(sourceManifestPath)) {
        throw new Error(`Plugin manifest not found at ${sourceManifestPath}`);
      }

      // Step 4: Deactivate existing plugin if active
      try {
        await pluginManager.deactivatePlugin(pluginId);
      } catch (e) {
        // Plugin might not be active
      }

      // Step 5: Backup existing plugin
      const backupPath = path.join(pluginsDir, `${pluginId}.backup-${Date.now()}`);
      if (await fs.pathExists(pluginPath)) {
        logWithCategory('info', LogCategory.SYSTEM, `Backing up existing plugin to ${backupPath}`);
        await fs.move(pluginPath, backupPath);
      }

      // Step 6: Copy new plugin
      logWithCategory('info', LogCategory.SYSTEM, `Installing plugin to ${pluginPath}`);
      await fs.copy(sourcePluginDir, pluginPath, { overwrite: true });

      // Step 7: Setup bundled dependencies (like workflow-runner)
      const bundledPath = path.join(pluginPath, 'bundled');
      const nodeModulesPath = path.join(pluginPath, 'node_modules');

      if (await fs.pathExists(bundledPath)) {
        logWithCategory('info', LogCategory.SYSTEM, 'Setting up bundled dependencies...');
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
      }

      // Step 8: Clean up
      await fs.remove(tempDir);

      // Remove backup if update was successful
      if (await fs.pathExists(backupPath)) {
        await fs.remove(backupPath);
      }

      // Step 9: Reload/activate the plugin
      try {
        await pluginManager.reloadPlugin(pluginId);
      } catch (e: any) {
        logWithCategory('warn', LogCategory.SYSTEM, 'Failed to reload plugin, restart may be required', { error: e.message });
      }

      logWithCategory('info', LogCategory.SYSTEM, `Plugin ${pluginId} updated successfully`);
      return { success: true, message: 'Plugin updated successfully. Restart FictionLab to apply changes.' };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to update plugin ${pluginId}`, { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Uninstall a plugin
  ipcMain.handle('plugin:uninstall', async (_event, pluginId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Uninstall plugin ${pluginId}`);
    try {
      // Deactivate first
      try {
        await pluginManager.deactivatePlugin(pluginId);
      } catch (e) {
        // Plugin might not be active
      }

      const pluginsDir = getPluginsDirectory();
      const pluginPath = path.join(pluginsDir, pluginId);

      if (await fs.pathExists(pluginPath)) {
        await fs.remove(pluginPath);
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
    const pluginsDir = getPluginsDirectory();
    return path.join(pluginsDir, pluginId);
  });

  logWithCategory('info', LogCategory.SYSTEM, 'Plugin update handlers registered');
}
