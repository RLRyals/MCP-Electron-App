/**
 * App-level settings module (issue #181).
 *
 * A small local JSON-file-in-userData store for renderer-facing settings
 * that aren't tied to any single plugin or wizard -- same persistence
 * pattern as setup-wizard.ts's wizard state and updater.ts's system
 * metadata (fs-extra readJson/writeJson against a file under
 * app.getPath('userData')), exposed to the renderer via the generic
 * registerHandler / preload.ts IPC pattern used throughout this app.
 *
 * Currently holds just `currentUser`: the identity the kanban board treats
 * as "me" for the Mine filter, actor attribution, comment authorship, and
 * assign-to-me. See src/types/identity.ts for the shape and default.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { logWithCategory, LogCategory } from './logger';
import { CurrentUserSetting, DEFAULT_CURRENT_USER } from '../types/identity';

interface AppSettings {
  currentUser?: CurrentUserSetting;
}

/**
 * Get the path to the app settings file.
 */
function getSettingsPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'app-settings.json');
}

/**
 * Load app settings, returning an empty object if the file doesn't exist
 * or can't be read.
 */
async function loadSettings(): Promise<AppSettings> {
  try {
    const settingsPath = getSettingsPath();

    if (!await fs.pathExists(settingsPath)) {
      return {};
    }

    return await fs.readJson(settingsPath);
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error loading app settings', error);
    return {};
  }
}

/**
 * Save app settings.
 */
async function saveSettings(settings: AppSettings): Promise<void> {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);

  await fs.ensureDir(dir);
  await fs.writeJson(settingsPath, settings, { spaces: 2 });

  logWithCategory('info', LogCategory.SYSTEM, 'App settings saved');
}

/**
 * Get the configured current-user identity, falling back to the default
 * ('rebecca') when no setting has been saved yet.
 */
export async function getCurrentUser(): Promise<CurrentUserSetting> {
  const settings = await loadSettings();
  return settings.currentUser || DEFAULT_CURRENT_USER;
}

/**
 * Set the current-user identity.
 */
export async function setCurrentUser(user: CurrentUserSetting): Promise<{ success: boolean }> {
  if (!user?.id || !user.id.trim()) {
    throw new Error('currentUser.id is required');
  }

  const settings = await loadSettings();
  settings.currentUser = {
    id: user.id.trim(),
    displayName: (user.displayName || user.id).trim(),
  };
  await saveSettings(settings);

  logWithCategory('info', LogCategory.SYSTEM, `Current user identity set to '${settings.currentUser.id}'`);
  return { success: true };
}
