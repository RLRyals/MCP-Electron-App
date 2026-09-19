/**
 * Plugin data directory helpers (mea-1l3).
 *
 * Plugin settings used to live in `<userData>/plugins/<id>/config.json` --
 * inside the install directory that every plugin update replaces
 * (`performPluginSwap`), so each update silently reset the plugin's settings.
 *
 * Plugin data now lives in `<userData>/plugin-data/<id>/`, which the updater
 * never touches. Install path stays `<userData>/plugins/<id>/`.
 *
 * Migration rule: only `config.json` is migrated. Anything else under the
 * old location is indistinguishable from release files the plugin shipped
 * with, so it is left alone.
 *
 * No Electron dependency, so it is unit-testable against real temp dirs.
 */

import * as path from 'path';
import * as fs from 'fs-extra';

export const CONFIG_FILE = 'config.json';

/** `<userData>/plugin-data` */
export function getPluginDataRoot(userDataDir: string): string {
  return path.join(userDataDir, 'plugin-data');
}

/** `<userData>/plugin-data/<pluginId>` */
export function getPluginDataDir(userDataDir: string, pluginId: string): string {
  return path.join(getPluginDataRoot(userDataDir), pluginId);
}

/**
 * Move `legacyDir/config.json` to `dataDir/config.json` if the new location
 * has none. Returns true if a file was migrated.
 */
export async function migrateLegacyConfig(
  legacyDir: string,
  dataDir: string
): Promise<boolean> {
  const from = path.join(legacyDir, CONFIG_FILE);
  const to = path.join(dataDir, CONFIG_FILE);
  if (!(await fs.pathExists(from)) || (await fs.pathExists(to))) {
    return false;
  }
  await fs.ensureDir(dataDir);
  await fs.move(from, to);
  return true;
}

/** Synchronous variant for context creation (which is synchronous). */
export function migrateLegacyConfigSync(legacyDir: string, dataDir: string): boolean {
  const from = path.join(legacyDir, CONFIG_FILE);
  const to = path.join(dataDir, CONFIG_FILE);
  if (!fs.pathExistsSync(from) || fs.pathExistsSync(to)) {
    return false;
  }
  fs.ensureDirSync(dataDir);
  fs.moveSync(from, to);
  return true;
}

/** Remove a plugin's persisted settings (uninstall with "also remove settings"). */
export async function removePluginData(userDataDir: string, pluginId: string): Promise<void> {
  await fs.remove(getPluginDataDir(userDataDir, pluginId));
}
