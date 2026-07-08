/**
 * Plugin Update Swap (issue #182)
 *
 * Pure filesystem logic for updating an already-installed plugin in place:
 * validate -> atomic swap with .bak rollback -> (caller prompts for restart).
 *
 * Deliberately has NO dependency on Electron (no `app`, `dialog`, `ipcMain`)
 * so it can be unit tested against real temp directories without mocking
 * the whole Electron module. The IPC handler in
 * `handlers/plugin-update-handlers.ts` is a thin wrapper around this module
 * that adds the file-picker, confirm dialog, and restart prompt.
 *
 * v1 boundaries (see GitHub issue #182):
 * - No hot reload of main-process plugin code. A successful swap only
 *   updates the files on disk; the running process keeps using whatever it
 *   already loaded into memory until the user restarts.
 * - At most one prompted restart (handled by the caller, not here).
 * - Downgrade or id-mismatch is refused before any file is touched.
 * - A crash mid-swap must leave a working plugin (old or new, never a
 *   corrupt half) -- see `recoverPluginsDirectory()`.
 *
 * v2 candidates (do not build now): checking a configured GitHub-releases
 * feed per plugin id for one-click updates; renderer-only hot-swap.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as semver from 'semver';

/** Suffix used for the pre-swap backup of the previous plugin directory. */
const BAK_SUFFIX = '.bak';
/** Suffix used for the staged copy of the new plugin bundle before swap-in. */
const STAGING_SUFFIX = '.staging';

export type PluginUpdateErrorCode =
  | 'NOT_INSTALLED'
  | 'INVALID_MANIFEST'
  | 'ID_MISMATCH'
  | 'DOWNGRADE';

/**
 * Thrown when an update is refused before any file has been touched.
 */
export class PluginUpdateError extends Error {
  code: PluginUpdateErrorCode;

  constructor(code: PluginUpdateErrorCode, message: string) {
    super(message);
    this.name = 'PluginUpdateError';
    this.code = code;
  }
}

export interface MinimalPluginManifest {
  id: string;
  name?: string;
  version: string;
  entry?: { main?: string };
  [key: string]: unknown;
}

export interface PluginUpdateValidation {
  /** Manifest read from the new bundle (sourcePath). */
  manifest: MinimalPluginManifest;
  /** Version currently installed, or null if it couldn't be read/parsed. */
  currentVersion: string | null;
}

function pluginDirPath(pluginsDir: string, pluginId: string): string {
  return path.join(pluginsDir, pluginId);
}

function bakDirPath(pluginsDir: string, pluginId: string): string {
  return path.join(pluginsDir, `${pluginId}${BAK_SUFFIX}`);
}

function stagingDirPath(pluginsDir: string, pluginId: string): string {
  return path.join(pluginsDir, `${pluginId}${STAGING_SUFFIX}`);
}

/**
 * Read and lightly validate a plugin manifest from a directory. Returns
 * null (never throws) if the directory doesn't exist or the manifest is
 * missing/unreadable/unparsable/missing an id -- used for health checks
 * where "not a valid plugin" just means "not usable", not an error.
 */
export async function readPluginManifestSafe(
  dirPath: string
): Promise<MinimalPluginManifest | null> {
  try {
    const manifestPath = path.join(dirPath, 'plugin.json');
    if (!(await fs.pathExists(manifestPath))) {
      return null;
    }
    const manifest = await fs.readJson(manifestPath);
    if (!manifest || typeof manifest.id !== 'string' || !manifest.id) {
      return null;
    }
    return manifest as MinimalPluginManifest;
  } catch {
    return null;
  }
}

/**
 * Validate a candidate update bundle against the currently installed
 * plugin. Refuses (throws PluginUpdateError) before any file on disk is
 * touched when:
 * - the plugin isn't currently installed (use Install instead of Update)
 * - the new bundle has no readable plugin.json / id / valid semver version
 * - the new bundle's id doesn't match the installed plugin's id
 * - the new bundle's entry point is missing
 * - the new bundle's version is not strictly greater than the installed one
 */
export async function validatePluginUpdateSource(
  pluginsDir: string,
  pluginId: string,
  sourcePath: string
): Promise<PluginUpdateValidation> {
  const installedManifest = await readPluginManifestSafe(
    pluginDirPath(pluginsDir, pluginId)
  );
  if (!installedManifest) {
    throw new PluginUpdateError(
      'NOT_INSTALLED',
      `Plugin "${pluginId}" is not currently installed. Use Install instead of Update.`
    );
  }

  const manifestPath = path.join(sourcePath, 'plugin.json');
  if (!(await fs.pathExists(manifestPath))) {
    throw new PluginUpdateError(
      'INVALID_MANIFEST',
      'Selected folder does not contain a plugin.json manifest.'
    );
  }

  let newManifest: MinimalPluginManifest;
  try {
    newManifest = await fs.readJson(manifestPath);
  } catch (error: any) {
    throw new PluginUpdateError(
      'INVALID_MANIFEST',
      `plugin.json could not be parsed: ${error.message}`
    );
  }

  if (!newManifest || !newManifest.id) {
    throw new PluginUpdateError(
      'INVALID_MANIFEST',
      'plugin.json is missing a required "id" field.'
    );
  }

  if (newManifest.id !== pluginId) {
    throw new PluginUpdateError(
      'ID_MISMATCH',
      `Plugin id mismatch: installed plugin is "${pluginId}", selected bundle is "${newManifest.id}". Refusing to update.`
    );
  }

  if (!newManifest.version || !semver.valid(newManifest.version)) {
    throw new PluginUpdateError(
      'INVALID_MANIFEST',
      `plugin.json has an invalid "version" (must be semver): ${newManifest.version}`
    );
  }

  if (!newManifest.entry || !newManifest.entry.main) {
    throw new PluginUpdateError(
      'INVALID_MANIFEST',
      'plugin.json is missing a required "entry.main" field.'
    );
  }

  const entryPath = path.join(sourcePath, newManifest.entry.main);
  if (!(await fs.pathExists(entryPath))) {
    throw new PluginUpdateError(
      'INVALID_MANIFEST',
      `Selected bundle is missing its entry point: ${newManifest.entry.main}`
    );
  }

  const currentVersion =
    installedManifest.version && semver.valid(installedManifest.version)
      ? installedManifest.version
      : null;

  if (currentVersion && !semver.gt(newManifest.version, currentVersion)) {
    throw new PluginUpdateError(
      'DOWNGRADE',
      `Refusing to update: installed version ${currentVersion} is not older than selected version ${newManifest.version}.`
    );
  }

  return { manifest: newManifest, currentVersion };
}

/**
 * Filesystem operations `performPluginSwap` depends on, overridable for
 * fault-injection tests (e.g. simulating a crash between the two renames
 * that make up the swap). Defaults to the real fs-extra implementations.
 */
export interface SwapFsDeps {
  rename?: (src: string, dest: string) => Promise<void>;
}

/**
 * Perform the atomic swap. Assumes validation has already passed (or the
 * caller has otherwise decided the swap should proceed).
 *
 * Sequence:
 * 1. Copy sourcePath into a staging directory next to the plugin (same
 *    volume as pluginsDir, so the swap renames below are atomic).
 * 2. Remove any stale `.bak` directory from a previous run.
 * 3. Rename the current plugin directory to `.bak` (atomic).
 * 4. Rename the staging directory into place as the new plugin directory
 *    (atomic). If this fails, the `.bak` is renamed back so the previous
 *    version keeps working -- a failed update rolls back automatically.
 *
 * The `.bak` directory is intentionally NOT deleted here; per issue #182
 * it's cleaned up by `recoverPluginsDirectory()` on the next successful
 * app launch, so a working plugin (old or new) is always recoverable if
 * the process is killed mid-swap.
 */
export async function performPluginSwap(
  pluginsDir: string,
  pluginId: string,
  sourcePath: string,
  deps: SwapFsDeps = {}
): Promise<void> {
  const rename = deps.rename ?? ((src: string, dest: string) => fs.rename(src, dest));
  const pluginPath = pluginDirPath(pluginsDir, pluginId);
  const bakPath = bakDirPath(pluginsDir, pluginId);
  const stagingPath = stagingDirPath(pluginsDir, pluginId);

  await fs.remove(stagingPath);
  await fs.copy(sourcePath, stagingPath);

  await fs.remove(bakPath);

  const hadExisting = await fs.pathExists(pluginPath);
  if (hadExisting) {
    await rename(pluginPath, bakPath);
  }

  try {
    await rename(stagingPath, pluginPath);
  } catch (error) {
    // Roll back: restore the previous version so we never leave the
    // plugin directory missing or corrupt.
    if (hadExisting) {
      await fs.rename(bakPath, pluginPath).catch(() => {
        /* best effort -- recoverPluginsDirectory() will retry on next launch */
      });
    }
    throw error;
  }
}

/**
 * Validate then atomically swap in one call. Convenience wrapper used by
 * the IPC handler.
 */
export async function updatePluginInPlace(
  pluginsDir: string,
  pluginId: string,
  sourcePath: string
): Promise<PluginUpdateValidation> {
  const validation = await validatePluginUpdateSource(
    pluginsDir,
    pluginId,
    sourcePath
  );
  await performPluginSwap(pluginsDir, pluginId, sourcePath);
  return validation;
}

export interface RecoveryReport {
  /** Plugin ids whose swap was completed (staging -> live) on this pass. */
  completed: string[];
  /** Plugin ids whose swap was rolled back (.bak -> live) on this pass. */
  rolledBack: string[];
  /** Plugin ids whose stale .bak was cleaned up after a healthy launch. */
  cleaned: string[];
}

/**
 * Repair any interrupted swap and clean up backups from completed ones.
 * Meant to run once at app startup, before plugin discovery/loading.
 *
 * For every `<id>` with a `.bak` and/or `.staging` sibling directory:
 * - live missing, staging healthy            -> complete the swap forward
 * - live missing, staging missing/unhealthy, bak healthy -> roll back
 * - live healthy, bak present                -> swap already succeeded on
 *   a previous run; this is "the next successful launch" -- clean up .bak
 *   (and any stale staging left over)
 * - live unhealthy (corrupt), bak healthy     -> roll back
 *
 * Never throws; this must not block startup. Best-effort logging is left
 * to the caller (this module doesn't depend on the app logger).
 */
export async function recoverPluginsDirectory(
  pluginsDir: string
): Promise<RecoveryReport> {
  const report: RecoveryReport = { completed: [], rolledBack: [], cleaned: [] };

  if (!(await fs.pathExists(pluginsDir))) {
    return report;
  }

  let entries: fs.Dirent[];
  try {
    entries = await fs.readdir(pluginsDir, { withFileTypes: true });
  } catch {
    return report;
  }

  const pluginIds = new Set<string>();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.endsWith(BAK_SUFFIX)) {
      pluginIds.add(entry.name.slice(0, -BAK_SUFFIX.length));
    } else if (entry.name.endsWith(STAGING_SUFFIX)) {
      pluginIds.add(entry.name.slice(0, -STAGING_SUFFIX.length));
    }
  }

  for (const pluginId of pluginIds) {
    try {
      await recoverOnePlugin(pluginsDir, pluginId, report);
    } catch {
      // Best-effort: leave this plugin's directories untouched rather than
      // risk making things worse; a future launch can retry.
    }
  }

  return report;
}

async function recoverOnePlugin(
  pluginsDir: string,
  pluginId: string,
  report: RecoveryReport
): Promise<void> {
  const pluginPath = pluginDirPath(pluginsDir, pluginId);
  const bakPath = bakDirPath(pluginsDir, pluginId);
  const stagingPath = stagingDirPath(pluginsDir, pluginId);

  const liveManifest = await readPluginManifestSafe(pluginPath);
  const stagingManifest = await readPluginManifestSafe(stagingPath);
  const bakManifest = await readPluginManifestSafe(bakPath);

  if (!liveManifest) {
    // Live plugin directory is missing or corrupt -- try to recover it.
    if (stagingManifest) {
      // Crash happened between "move old -> .bak" and "move staging -> live".
      // Finish the forward swap; leave .bak for cleanup on the launch after this one.
      await fs.remove(pluginPath).catch(() => {});
      await fs.rename(stagingPath, pluginPath);
      report.completed.push(pluginId);
      return;
    }
    if (bakManifest) {
      // No usable staging copy -- roll back to the last known-good version.
      await fs.remove(pluginPath).catch(() => {});
      await fs.rename(bakPath, pluginPath);
      report.rolledBack.push(pluginId);
      return;
    }
    // Neither staging nor bak is usable; nothing safe to do.
    return;
  }

  // Live plugin directory is healthy.
  if (bakManifest) {
    // The swap that produced this live directory already succeeded (on this
    // run or an earlier one) -- this is "the next successful launch".
    await fs.remove(bakPath).catch(() => {});
    report.cleaned.push(pluginId);
  } else if (await fs.pathExists(bakPath)) {
    // Unhealthy leftover .bak (shouldn't normally happen) -- clear it too.
    await fs.remove(bakPath).catch(() => {});
    report.cleaned.push(pluginId);
  }

  if (stagingManifest || (await fs.pathExists(stagingPath))) {
    // Stale staging dir from a validation that never reached the swap, or a
    // swap that already completed -- safe to discard either way since live
    // is healthy.
    await fs.remove(stagingPath).catch(() => {});
  }
}
