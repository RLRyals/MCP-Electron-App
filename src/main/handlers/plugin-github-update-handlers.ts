/**
 * Plugin GitHub Update Handlers (bead mea-6tt)
 *
 * IPC surface for the BRAT-style plugin updater: check installed plugins
 * against their GitHub Releases (public or private via GITHUB_PLUGINS_TOKEN)
 * and install an available update through the same atomic swap path the
 * local-folder updater (issue #182 / plugin-update-handlers.ts) already
 * uses. All GitHub-fetch and dependency-gate logic lives in
 * `plugin-github-updater.ts`; this file is the thin Electron-facing wrapper
 * (dialogs, IPC registration, .env token plumbing) around it.
 *
 * Token handling: GITHUB_PLUGINS_TOKEN is read from env-config.ts (same
 * storage as every other .env-backed setting) and is NEVER included in any
 * IPC response other than `plugin-updates:get-token-status`, which returns
 * only a boolean + the last 4 characters -- never the token itself.
 */

import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import { logWithCategory, LogCategory } from '../logger';
import * as envConfig from '../env-config';
import { pluginManager } from '../plugin-manager';
import {
  checkPluginUpdate,
  downloadAndInstallPluginUpdate,
  maskToken,
  type LoadedPluginRef,
} from '../plugin-github-updater';

function getPluginsDirectory(): string {
  return path.join(app.getPath('userData'), 'plugins');
}

function showMessageBox(
  window: Electron.BrowserWindow | undefined,
  options: Electron.MessageBoxOptions
): Promise<Electron.MessageBoxReturnValue> {
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
}

/**
 * Best-effort list of currently running service/container names, for the
 * dependency gate's mcpServers check. Never throws -- an inability to
 * determine what's running just means that part of the gate is skipped
 * rather than blocking every install.
 */
async function getRunningServiceNames(): Promise<string[] | undefined> {
  try {
    const { getSystemStatus } = await import('../mcp-system');
    const status = await getSystemStatus();
    return status.containers?.map((c) => c.name).filter(Boolean) ?? [];
  } catch (error: any) {
    logWithCategory('warn', LogCategory.SYSTEM, `Could not determine running services for dependency gate: ${error?.message || error}`);
    return undefined;
  }
}

function getLoadedPluginRefs(): LoadedPluginRef[] {
  return pluginManager.getAllPlugins().map((p) => ({ id: p.id, version: p.manifest.version }));
}

export function registerPluginGithubUpdateHandlers() {
  // Token status for the masked UI display -- last 4 chars only, never the
  // full token.
  ipcMain.handle('plugin-updates:get-token-status', async () => {
    const config = await envConfig.loadEnvConfig();
    const last4 = maskToken(config.GITHUB_PLUGINS_TOKEN);
    return { configured: !!last4, last4 };
  });

  // Set/replace/clear GITHUB_PLUGINS_TOKEN. Never logged.
  ipcMain.handle('plugin-updates:set-token', async (_event, token: string) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Set GITHUB_PLUGINS_TOKEN (value not logged)');
    const config = await envConfig.loadEnvConfig();
    config.GITHUB_PLUGINS_TOKEN = (token || '').trim();
    const result = await envConfig.saveEnvConfig(config);
    return { success: result.success, error: result.error, last4: maskToken(config.GITHUB_PLUGINS_TOKEN) };
  });

  // Check a single installed plugin against its GitHub release feed.
  ipcMain.handle('plugin-updates:check', async (_event, pluginId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Check GitHub update for plugin ${pluginId}`);
    const config = await envConfig.loadEnvConfig();
    const result = await checkPluginUpdate({
      pluginId,
      pluginsDir: getPluginsDirectory(),
      token: config.GITHUB_PLUGINS_TOKEN || undefined,
    });
    // Strip the asset's GitHub API `id` bookkeeping isn't sensitive, but do
    // not echo the token back under any circumstance -- `result` never
    // contains it (checkPluginUpdate only accepts it, never returns it).
    return result;
  });

  // Download + dependency-gate + atomically swap in an available update.
  ipcMain.handle('plugin-updates:install', async (event, pluginId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Install GitHub update for plugin ${pluginId}`);
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const config = await envConfig.loadEnvConfig();
    const token = config.GITHUB_PLUGINS_TOKEN || undefined;

    const check = await checkPluginUpdate({
      pluginId,
      pluginsDir: getPluginsDirectory(),
      token,
    });

    if (check.status !== 'update-available' || !check.asset || !check.source) {
      return { success: false, status: check.status, error: check.error };
    }

    const runningServiceNames = await getRunningServiceNames();

    const outcome = await downloadAndInstallPluginUpdate({
      pluginId,
      pluginsDir: getPluginsDirectory(),
      asset: check.asset,
      source: check.source,
      token,
      dependencyGate: {
        appVersion: app.getVersion(),
        loadedPlugins: getLoadedPluginRefs(),
        runningServiceNames,
      },
    });

    if (outcome.status === 'dependency-blocked') {
      logWithCategory('warn', LogCategory.SYSTEM, `Update for ${pluginId} blocked by dependency gate: ${outcome.blockers.join('; ')}`);
      return { success: false, status: 'dependency-blocked', blockers: outcome.blockers };
    }

    if (outcome.status === 'download-failed') {
      logWithCategory('error', LogCategory.SYSTEM, `Update download failed for ${pluginId}: ${outcome.error}`);
      return { success: false, status: 'download-failed', error: outcome.error };
    }

    if (outcome.status === 'refused') {
      logWithCategory('warn', LogCategory.SYSTEM, `Update for ${pluginId} refused: ${outcome.message}`);
      return { success: false, status: 'refused', code: outcome.code, message: outcome.message };
    }

    logWithCategory('info', LogCategory.SYSTEM, `Plugin ${pluginId} updated to ${outcome.validation.manifest.version} via GitHub release`);

    const restart = await showMessageBox(window, {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Complete',
      message: `Restart FictionLab to load ${outcome.validation.manifest.name || pluginId} v${outcome.validation.manifest.version}`,
    });

    if (restart.response === 0) {
      app.relaunch();
      app.exit(0);
    }

    return {
      success: true,
      status: 'installed',
      version: outcome.validation.manifest.version,
      previousVersion: outcome.validation.currentVersion,
      restarting: restart.response === 0,
    };
  });

  logWithCategory('info', LogCategory.SYSTEM, 'Plugin GitHub update handlers registered');
}
