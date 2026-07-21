/**
 * mea-4yh: belt-and-suspenders coverage for PluginLoader.discoverPlugins()'s
 * duplicate-id dedup pass. The name-based `.bak`/`.staging`/dot-prefix skip
 * (see plugin-loader-backup-dir-skip.test.ts) is the first line of defense,
 * but any two folders that both declare the same plugin id -- regardless of
 * naming -- must never both come back `valid`, or sortByDependencies' id-
 * keyed map will silently pick whichever happened to be discovered last.
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

describe('PluginLoader.discoverPlugins duplicate-id dedup', () => {
  let tmpRoot: string;
  let pluginsDir: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fictionlab-plugin-dedup-'));
    (global as any).__testUserDataDir = tmpRoot;
    pluginsDir = path.join(tmpRoot, 'plugins');
    fs.ensureDirSync(pluginsDir);
  });

  afterEach(() => {
    fs.removeSync(tmpRoot);
    delete (global as any).__testUserDataDir;
  });

  it('prefers the folder whose name exactly matches the plugin id over a differently-named sibling', async () => {
    writeManifest(path.join(pluginsDir, 'fictionlab-agent-factory'), 'fictionlab-agent-factory', '0.2.0');
    // Named differently enough to dodge the .bak/.staging/dot-prefix name filter,
    // but still declares the same id in its own plugin.json.
    writeManifest(path.join(pluginsDir, 'fictionlab-agent-factory-old-copy'), 'fictionlab-agent-factory', '0.1.1');

    const loader = new PluginLoader();
    const results = await loader.discoverPlugins();

    expect(results).toHaveLength(2);

    const valid = results.filter(r => r.valid);
    expect(valid).toHaveLength(1);
    expect(path.basename(valid[0].path)).toBe('fictionlab-agent-factory');
    expect(valid[0].manifest.version).toBe('0.2.0');

    const ignored = results.find(r => !r.valid);
    expect(ignored).toBeDefined();
    expect(path.basename(ignored!.path)).toBe('fictionlab-agent-factory-old-copy');
    expect(ignored!.errors?.some(e => e.includes('duplicate plugin id'))).toBe(true);
  });

  it('breaks ties by higher semver version when neither folder name equals the id', async () => {
    writeManifest(path.join(pluginsDir, 'copy-a'), 'fictionlab-kanban', '1.5.0');
    writeManifest(path.join(pluginsDir, 'copy-b'), 'fictionlab-kanban', '2.0.0');

    const loader = new PluginLoader();
    const results = await loader.discoverPlugins();

    const valid = results.filter(r => r.valid);
    expect(valid).toHaveLength(1);
    expect(valid[0].manifest.version).toBe('2.0.0');
    expect(path.basename(valid[0].path)).toBe('copy-b');
  });

  it('leaves non-colliding plugins untouched', async () => {
    writeManifest(path.join(pluginsDir, 'fictionlab-kanban'), 'fictionlab-kanban', '1.0.0');
    writeManifest(path.join(pluginsDir, 'fictionlab-agent-factory'), 'fictionlab-agent-factory', '1.0.0');

    const loader = new PluginLoader();
    const results = await loader.discoverPlugins();

    expect(results).toHaveLength(2);
    expect(results.every(r => r.valid)).toBe(true);
  });
});
