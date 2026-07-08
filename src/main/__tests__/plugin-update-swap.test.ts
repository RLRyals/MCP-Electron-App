/**
 * Unit tests for the plugin update swap/rollback/validation logic
 * (GitHub issue #182).
 *
 * These exercise real temp directories on disk (no Electron, no mocked
 * fs-extra) since the whole point of this module is to be correct about
 * actual filesystem rename/copy semantics.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  validatePluginUpdateSource,
  performPluginSwap,
  updatePluginInPlace,
  recoverPluginsDirectory,
  readPluginManifestSafe,
  PluginUpdateError,
} from '../plugin-update-swap';

let workDir: string;
let pluginsDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-update-swap-'));
  pluginsDir = path.join(workDir, 'plugins');
  await fs.ensureDir(pluginsDir);
});

afterEach(async () => {
  await fs.remove(workDir);
});

/** Write a minimal installed plugin directory `<pluginsDir>/<id>`. */
async function writeInstalledPlugin(
  id: string,
  version: string,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const dir = path.join(pluginsDir, id);
  await fs.ensureDir(dir);
  await fs.writeJson(path.join(dir, 'plugin.json'), {
    id,
    name: `Plugin ${id}`,
    version,
    description: 'test plugin',
    author: 'test',
    fictionLabVersion: '*',
    pluginType: 'utility',
    entry: { main: 'index.js' },
    permissions: [],
    ...overrides,
  });
  await fs.writeFile(path.join(dir, 'index.js'), 'module.exports = {};');
  return dir;
}

/** Write a candidate update bundle in its own temp source directory. */
async function writeSourceBundle(
  id: string,
  version: string,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-update-source-'));
  await fs.writeJson(path.join(dir, 'plugin.json'), {
    id,
    name: `Plugin ${id}`,
    version,
    description: 'test plugin',
    author: 'test',
    fictionLabVersion: '*',
    pluginType: 'utility',
    entry: { main: 'index.js' },
    permissions: [],
    ...overrides,
  });
  await fs.writeFile(path.join(dir, 'index.js'), `module.exports = { version: '${version}' };`);
  return dir;
}

describe('validatePluginUpdateSource', () => {
  it('refuses when the plugin is not currently installed', async () => {
    const source = await writeSourceBundle('kanban', '1.1.0');

    await expect(
      validatePluginUpdateSource(pluginsDir, 'kanban', source)
    ).rejects.toMatchObject({ code: 'NOT_INSTALLED' });
  });

  it('refuses an id mismatch before touching any files', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await writeSourceBundle('other-plugin', '2.0.0');

    await expect(
      validatePluginUpdateSource(pluginsDir, 'kanban', source)
    ).rejects.toMatchObject({ code: 'ID_MISMATCH' });

    // Nothing should have been touched.
    const installed = await readPluginManifestSafe(path.join(pluginsDir, 'kanban'));
    expect(installed?.version).toBe('1.0.0');
  });

  it('refuses a downgrade', async () => {
    await writeInstalledPlugin('kanban', '2.0.0');
    const source = await writeSourceBundle('kanban', '1.9.0');

    await expect(
      validatePluginUpdateSource(pluginsDir, 'kanban', source)
    ).rejects.toMatchObject({ code: 'DOWNGRADE' });
  });

  it('refuses a same-version "update"', async () => {
    await writeInstalledPlugin('kanban', '2.0.0');
    const source = await writeSourceBundle('kanban', '2.0.0');

    await expect(
      validatePluginUpdateSource(pluginsDir, 'kanban', source)
    ).rejects.toMatchObject({ code: 'DOWNGRADE' });
  });

  it('refuses an invalid semver version in the new bundle', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await writeSourceBundle('kanban', 'not-a-version');

    await expect(
      validatePluginUpdateSource(pluginsDir, 'kanban', source)
    ).rejects.toMatchObject({ code: 'INVALID_MANIFEST' });
  });

  it('refuses a bundle missing its entry point', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await writeSourceBundle('kanban', '1.1.0');
    await fs.remove(path.join(source, 'index.js'));

    await expect(
      validatePluginUpdateSource(pluginsDir, 'kanban', source)
    ).rejects.toMatchObject({ code: 'INVALID_MANIFEST' });
  });

  it('refuses a bundle with no plugin.json at all', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-update-empty-'));

    await expect(
      validatePluginUpdateSource(pluginsDir, 'kanban', source)
    ).rejects.toMatchObject({ code: 'INVALID_MANIFEST' });

    await fs.remove(source);
  });

  it('accepts a strictly greater version and reports current -> new', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await writeSourceBundle('kanban', '1.1.0');

    const result = await validatePluginUpdateSource(pluginsDir, 'kanban', source);

    expect(result.currentVersion).toBe('1.0.0');
    expect(result.manifest.version).toBe('1.1.0');
  });
});

describe('performPluginSwap', () => {
  it('replaces the plugin directory contents and keeps a .bak of the old version', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await writeSourceBundle('kanban', '1.1.0');

    await performPluginSwap(pluginsDir, 'kanban', source);

    const live = await readPluginManifestSafe(path.join(pluginsDir, 'kanban'));
    expect(live?.version).toBe('1.1.0');

    const bak = await readPluginManifestSafe(path.join(pluginsDir, 'kanban.bak'));
    expect(bak?.version).toBe('1.0.0');
  });

  it('never leaves the plugin directory missing, even if the final rename fails', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await writeSourceBundle('kanban', '1.1.0');
    const pluginPath = path.join(pluginsDir, 'kanban');

    // Inject a rename that fails only for the second (staging -> live) step,
    // simulating a crash/error right in the middle of the swap.
    const fakeRename = jest.fn(async (src: string, dest: string) => {
      if (dest === pluginPath && src.includes('.staging')) {
        throw new Error('simulated crash during swap-in');
      }
      await fs.rename(src, dest);
    });

    await expect(
      performPluginSwap(pluginsDir, 'kanban', source, { rename: fakeRename })
    ).rejects.toThrow('simulated crash during swap-in');

    // Rolled back: the old version must still be there and loadable.
    const live = await readPluginManifestSafe(pluginPath);
    expect(live?.version).toBe('1.0.0');
  });

  it('installs cleanly when there is no pre-existing plugin directory', async () => {
    const source = await writeSourceBundle('brand-new', '1.0.0');

    await performPluginSwap(pluginsDir, 'brand-new', source);

    const live = await readPluginManifestSafe(path.join(pluginsDir, 'brand-new'));
    expect(live?.version).toBe('1.0.0');
    expect(await fs.pathExists(path.join(pluginsDir, 'brand-new.bak'))).toBe(false);
  });
});

describe('updatePluginInPlace', () => {
  it('validates then swaps in one call', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await writeSourceBundle('kanban', '3.0.0');

    const result = await updatePluginInPlace(pluginsDir, 'kanban', source);

    expect(result.currentVersion).toBe('1.0.0');
    expect(result.manifest.version).toBe('3.0.0');

    const live = await readPluginManifestSafe(path.join(pluginsDir, 'kanban'));
    expect(live?.version).toBe('3.0.0');
  });

  it('touches nothing when validation fails', async () => {
    await writeInstalledPlugin('kanban', '2.0.0');
    const source = await writeSourceBundle('kanban', '1.0.0'); // downgrade

    await expect(
      updatePluginInPlace(pluginsDir, 'kanban', source)
    ).rejects.toBeInstanceOf(PluginUpdateError);

    const live = await readPluginManifestSafe(path.join(pluginsDir, 'kanban'));
    expect(live?.version).toBe('2.0.0');
    expect(await fs.pathExists(path.join(pluginsDir, 'kanban.bak'))).toBe(false);
  });
});

describe('recoverPluginsDirectory', () => {
  it('is a no-op when there is nothing to recover', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');

    const report = await recoverPluginsDirectory(pluginsDir);

    expect(report).toEqual({ completed: [], rolledBack: [], cleaned: [] });
    const live = await readPluginManifestSafe(path.join(pluginsDir, 'kanban'));
    expect(live?.version).toBe('1.0.0');
  });

  it('cleans up a stale .bak after a successful swap (the "next successful launch")', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await writeSourceBundle('kanban', '1.1.0');
    await performPluginSwap(pluginsDir, 'kanban', source);

    expect(await fs.pathExists(path.join(pluginsDir, 'kanban.bak'))).toBe(true);

    const report = await recoverPluginsDirectory(pluginsDir);

    expect(report.cleaned).toEqual(['kanban']);
    expect(await fs.pathExists(path.join(pluginsDir, 'kanban.bak'))).toBe(false);
    const live = await readPluginManifestSafe(path.join(pluginsDir, 'kanban'));
    expect(live?.version).toBe('1.1.0');
  });

  it('completes an interrupted forward swap: live missing, staging present', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await writeSourceBundle('kanban', '2.0.0');

    // Simulate a crash between "old -> .bak" and "staging -> live":
    // manually reproduce that intermediate disk state instead of calling
    // performPluginSwap (which would complete normally).
    const pluginPath = path.join(pluginsDir, 'kanban');
    const bakPath = path.join(pluginsDir, 'kanban.bak');
    const stagingPath = path.join(pluginsDir, 'kanban.staging');
    await fs.copy(source, stagingPath);
    await fs.rename(pluginPath, bakPath);
    // pluginPath now does not exist -- exactly the crash window.

    const report = await recoverPluginsDirectory(pluginsDir);

    expect(report.completed).toEqual(['kanban']);
    const live = await readPluginManifestSafe(pluginPath);
    expect(live?.version).toBe('2.0.0');
    // .bak is left for cleanup on the *next* successful launch, not this one.
    expect(await fs.pathExists(bakPath)).toBe(true);
    expect(await fs.pathExists(stagingPath)).toBe(false);

    // And the launch after that finishes the job.
    const secondReport = await recoverPluginsDirectory(pluginsDir);
    expect(secondReport.cleaned).toEqual(['kanban']);
    expect(await fs.pathExists(bakPath)).toBe(false);
  });

  it('rolls back when live is missing and there is no usable staging copy', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const pluginPath = path.join(pluginsDir, 'kanban');
    const bakPath = path.join(pluginsDir, 'kanban.bak');

    // Simulate a crash right after "old -> .bak" with no staging ever
    // having been produced (e.g. the copy step itself never completed).
    await fs.rename(pluginPath, bakPath);

    const report = await recoverPluginsDirectory(pluginsDir);

    expect(report.rolledBack).toEqual(['kanban']);
    const live = await readPluginManifestSafe(pluginPath);
    expect(live?.version).toBe('1.0.0');
    expect(await fs.pathExists(bakPath)).toBe(false);
  });

  it('rolls back when the live directory is corrupt but .bak is healthy', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const pluginPath = path.join(pluginsDir, 'kanban');
    const bakPath = path.join(pluginsDir, 'kanban.bak');

    // Corrupt the live plugin.json, and leave a healthy .bak beside it.
    await fs.copy(pluginPath, bakPath);
    await fs.writeFile(path.join(pluginPath, 'plugin.json'), '{ this is not json');

    const report = await recoverPluginsDirectory(pluginsDir);

    expect(report.rolledBack).toEqual(['kanban']);
    const live = await readPluginManifestSafe(pluginPath);
    expect(live?.version).toBe('1.0.0');
  });

  it('discards a stale staging directory left over from a validation that never swapped', async () => {
    await writeInstalledPlugin('kanban', '1.0.0');
    const source = await writeSourceBundle('kanban', '1.1.0');
    const stagingPath = path.join(pluginsDir, 'kanban.staging');
    await fs.copy(source, stagingPath);
    // No .bak, live is untouched and healthy.

    const report = await recoverPluginsDirectory(pluginsDir);

    expect(report).toEqual({ completed: [], rolledBack: [], cleaned: [] });
    expect(await fs.pathExists(stagingPath)).toBe(false);
    const live = await readPluginManifestSafe(path.join(pluginsDir, 'kanban'));
    expect(live?.version).toBe('1.0.0');
  });

  it('is safe to call on an empty or missing plugins directory', async () => {
    const missingDir = path.join(workDir, 'does-not-exist');
    await expect(recoverPluginsDirectory(missingDir)).resolves.toEqual({
      completed: [],
      rolledBack: [],
      cleaned: [],
    });

    await expect(recoverPluginsDirectory(pluginsDir)).resolves.toEqual({
      completed: [],
      rolledBack: [],
      cleaned: [],
    });
  });
});
