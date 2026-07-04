import { app, ipcMain } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import { logWithCategory, LogCategory } from '../logger';

/**
 * The plugin ID for the FictionLab workflow plugin (installed under
 * {userData}/plugins/{id}, same convention used by PluginManager.importPlugin()
 * and PluginLoader.setupBundledDependencies()).
 */
const WORKFLOW_PLUGIN_ID = 'fictionlab-workflow';

export interface GenrePack {
  id: string;
  name: string;
}

/**
 * Minimal shape of @fictionlab/workflow-runner's ResourceCopier that this
 * handler depends on. Kept narrow so tests can supply a fake implementation
 * without needing the real package installed.
 */
export interface GenrePackScanner {
  getResourcesPath(): string;
  listAvailableGenrePacks(): Promise<string[]>;
}

/**
 * Dynamically load the ResourceCopier that ships with the FictionLab workflow
 * plugin. The plugin is installed at {userData}/plugins/fictionlab-workflow
 * (see PluginManager.importPlugin) and, when activated, resolves
 * @fictionlab/workflow-runner out of its own node_modules (copied there by
 * PluginLoader.setupBundledDependencies / PluginManager's bundled-dependency
 * setup). We reuse that exact resolution instead of hardcoding any
 * dev-machine path so this works the same way in a packaged install.
 */
export function loadGenrePackScanner(pluginDir: string): GenrePackScanner | null {
  try {
    const modulePath = path.join(pluginDir, 'node_modules', '@fictionlab', 'workflow-runner');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ResourceCopier } = require(modulePath);
    if (typeof ResourceCopier !== 'function') {
      return null;
    }
    return new ResourceCopier();
  } catch {
    return null;
  }
}

/**
 * List genre packs available to the "Create New Project" dialog.
 *
 * Resolves the workflow plugin's ResourceCopier the same way it is reached
 * at workflow-run time (workflow-executor.ts -> ResourceCopier.copyResourcesToProject),
 * then reuses ResourceCopier.getResourcesPath()/listAvailableGenrePacks() so the
 * path-resolution logic is never duplicated here.
 *
 * Any failure (plugin not installed, resources directory missing, unreadable
 * manifest, etc.) is handled gracefully by logging a warning and returning an
 * empty list -- the dialog should show only "None", never an error.
 */
export async function listGenrePacks(
  loadScanner: (pluginDir: string) => GenrePackScanner | null = loadGenrePackScanner
): Promise<GenrePack[]> {
  const pluginDir = path.join(app.getPath('userData'), 'plugins', WORKFLOW_PLUGIN_ID);

  const scanner = loadScanner(pluginDir);
  if (!scanner) {
    logWithCategory(
      'warn',
      LogCategory.SYSTEM,
      `Genre packs: could not load ResourceCopier from workflow plugin at ${pluginDir}. ` +
        'Is the fictionlab-workflow plugin installed? Returning empty list.'
    );
    return [];
  }

  let resourcesPath: string;
  try {
    resourcesPath = scanner.getResourcesPath();
  } catch (error: any) {
    logWithCategory(
      'warn',
      LogCategory.SYSTEM,
      `Genre packs: could not locate resources directory (${error?.message || error}). Returning empty list.`
    );
    return [];
  }

  let packIds: string[];
  try {
    packIds = await scanner.listAvailableGenrePacks();
  } catch (error: any) {
    logWithCategory('warn', LogCategory.SYSTEM, `Genre packs: scan failed (${error?.message || error}). Returning empty list.`);
    return [];
  }

  if (!packIds || packIds.length === 0) {
    logWithCategory('debug', LogCategory.SYSTEM, 'Genre packs: none found (empty or missing genre-packs directory).');
    return [];
  }

  const packs: GenrePack[] = [];
  for (const id of packIds) {
    const manifestPath = path.join(resourcesPath, 'genre-packs', id, 'manifest.json');
    let name = id;
    try {
      const manifest = await fs.readJson(manifestPath);
      if (manifest && typeof manifest.name === 'string' && manifest.name.trim()) {
        name = manifest.name;
      }
    } catch (error: any) {
      logWithCategory(
        'warn',
        LogCategory.SYSTEM,
        `Genre packs: failed to read manifest for '${id}' (${error?.message || error}). Falling back to id as name.`
      );
    }
    packs.push({ id, name });
  }

  logWithCategory('info', LogCategory.SYSTEM, `Genre packs: found ${packs.length} (${packs.map((p) => p.id).join(', ')}).`);
  return packs;
}

/**
 * Register the project:list-genre-packs IPC handler.
 */
export function registerGenrePackHandlers(): void {
  ipcMain.handle('project:list-genre-packs', async () => {
    logWithCategory('debug', LogCategory.SYSTEM, 'IPC: Listing genre packs');
    try {
      return await listGenrePacks();
    } catch (error: any) {
      // Defensive: listGenrePacks() already handles its own failure modes,
      // but never let this handler throw and surface an error dialog to the
      // Create Project UI -- an empty list just means "None" is shown.
      logWithCategory('error', LogCategory.SYSTEM, `IPC: Listing genre packs failed unexpectedly: ${error?.message || error}`);
      return [];
    }
  });
}
