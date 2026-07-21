/**
 * Regression test for the "stale backup plugin shadows the real install"
 * failure mode reported alongside the renderer boot crash: a machine whose
 * `%APPDATA%/fictionlab/plugins` directory contained both the real
 * `fictionlab-workflow` install and a leftover
 * `fictionlab-workflow.backup-<timestamp>` directory (the old, pre-#182
 * ad-hoc backup naming, predating `plugin-update-swap.ts`'s `.bak`/
 * `.staging` convention) reportedly had discovery pick the STALE backup
 * over the real install.
 *
 * Status as of this test: `PluginLoader.discoverPlugins()` (src/main/
 * plugin-loader.ts) already skips `.bak`, `.staging`, AND the older
 * `.backup-<timestamp>` naming -- see the guard added in commit 3577e6a
 * ("feat(plugins): wire update-in-place into the Update button and startup
 * (#182)"), which predates and is unrelated to the renderer-boot-crash fix
 * in this same PR. This test did not exist before; it locks in that
 * already-correct behavior with a concrete repro of the exact reported
 * layout (a `fictionlab-workflow` dir plus a `fictionlab-workflow.backup-
 * 1769903090229` sibling) so a future change can't silently regress it.
 *
 * If this test ever fails, the failure is in `discoverPlugins()`'s skip
 * list, not in the renderer boot path fixed elsewhere in this PR.
 */

import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => (global as any).__testUserDataDir),
    getVersion: jest.fn(() => '1.0.0'),
  },
}));

// Imported after the electron mock so the constructor's `app.getPath('userData')`
// call resolves to our temp directory.
import { PluginLoader } from '../plugin-loader';

function writeManifest(dir: string, id: string, version: string): void {
  fs.ensureDirSync(dir);
  fs.writeJsonSync(path.join(dir, 'plugin.json'), {
    id,
    name: id,
    version,
    description: 'test fixture',
    author: 'test',
    fictionLabVersion: '^1.0.0',
    pluginType: 'feature',
    entry: { main: 'index.js' },
    permissions: [],
  });
  fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');
}

describe('PluginLoader.discoverPlugins skips update-swap bookkeeping directories', () => {
  let tmpRoot: string;
  let pluginsDir: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fictionlab-plugin-discovery-'));
    (global as any).__testUserDataDir = tmpRoot;
    pluginsDir = path.join(tmpRoot, 'plugins');
    fs.ensureDirSync(pluginsDir);
  });

  afterEach(() => {
    fs.removeSync(tmpRoot);
    delete (global as any).__testUserDataDir;
  });

  it('discovers the real install and ignores a stale `.backup-<timestamp>` sibling (the exact reported layout)', async () => {
    writeManifest(path.join(pluginsDir, 'fictionlab-workflow'), 'fictionlab-workflow', '1.2.0');
    writeManifest(
      path.join(pluginsDir, 'fictionlab-workflow.backup-1769903090229'),
      'fictionlab-workflow',
      '1.1.0'
    );

    const loader = new PluginLoader();
    const results = await loader.discoverPlugins();

    expect(results).toHaveLength(1);
    expect(results[0].manifest.id).toBe('fictionlab-workflow');
    expect(results[0].manifest.version).toBe('1.2.0');
    expect(results[0].path).not.toMatch(/\.backup-/);
  });

  it('also ignores `.bak` and `.staging` swap-bookkeeping directories', async () => {
    writeManifest(path.join(pluginsDir, 'fictionlab-kanban'), 'fictionlab-kanban', '2.0.0');
    writeManifest(path.join(pluginsDir, 'fictionlab-kanban.bak'), 'fictionlab-kanban', '1.0.0');
    writeManifest(path.join(pluginsDir, 'fictionlab-kanban.staging'), 'fictionlab-kanban', '2.1.0');

    const loader = new PluginLoader();
    const results = await loader.discoverPlugins();

    expect(results).toHaveLength(1);
    expect(results[0].manifest.version).toBe('2.0.0');
  });

  it('ignores a human-renamed `.bak-<version>` rollback folder (mea-4yh concrete incident)', async () => {
    // Exact reported layout: updating fictionlab-agent-factory to v0.2.0 left
    // a rollback folder named `fictionlab-agent-factory.bak-0.1.1` (the old
    // `.bak` renamed with the version for clarity) beside the canonical
    // install. The pre-mea-4yh filter only matched an EXACT `.bak` suffix,
    // so this versioned variant slipped through and got discovered as a
    // duplicate-id plugin, which then won the id-keyed dependency sort.
    writeManifest(
      path.join(pluginsDir, 'fictionlab-agent-factory'),
      'fictionlab-agent-factory',
      '0.2.0'
    );
    writeManifest(
      path.join(pluginsDir, 'fictionlab-agent-factory.bak-0.1.1'),
      'fictionlab-agent-factory',
      '0.1.1'
    );

    const loader = new PluginLoader();
    const results = await loader.discoverPlugins();

    expect(results).toHaveLength(1);
    expect(results[0].manifest.version).toBe('0.2.0');
  });

  it('does not discover a dot-prefixed sibling folder even with a valid plugin.json', async () => {
    writeManifest(path.join(pluginsDir, 'fictionlab-kanban'), 'fictionlab-kanban', '2.0.0');
    writeManifest(path.join(pluginsDir, '.fictionlab-kanban.staging-tmp'), 'fictionlab-kanban', '2.1.0');

    const loader = new PluginLoader();
    const results = await loader.discoverPlugins();

    expect(results).toHaveLength(1);
    expect(results[0].manifest.version).toBe('2.0.0');
  });

  it('does not discover a plugin at all when only a backup copy exists (no phantom fallback)', async () => {
    writeManifest(
      path.join(pluginsDir, 'fictionlab-workflow.backup-1769903090229'),
      'fictionlab-workflow',
      '1.1.0'
    );

    const loader = new PluginLoader();
    const results = await loader.discoverPlugins();

    expect(results).toHaveLength(0);
  });
});
