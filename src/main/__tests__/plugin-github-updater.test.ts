/**
 * Unit tests for src/main/plugin-github-updater.ts (bead mea-6tt).
 *
 * Follows the same mock-fetch pattern as release-notes.test.ts /
 * app-updater.test.ts for the network layer, and the same real-temp-dir
 * pattern as plugin-update-swap.test.ts for the filesystem layer (this
 * module's whole job is to hand a downloaded bundle to that proven swap
 * path, so exercising real directories catches integration mistakes a
 * mocked fs wouldn't).
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  checkPluginUpdate,
  checkPluginDependencies,
  downloadAndInstallPluginUpdate,
  findMatchingAsset,
  maskToken,
  redactSecret,
  normalizeVersion,
  resolveUpdateSource,
  KNOWN_PLUGIN_UPDATE_SOURCES,
} from '../plugin-github-updater';
import { readPluginManifestSafe } from '../plugin-update-swap';

function okJsonResponse(body: any) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body };
}

let workDir: string;
let pluginsDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-github-updater-'));
  pluginsDir = path.join(workDir, 'plugins');
  await fs.ensureDir(pluginsDir);
});

afterEach(async () => {
  await fs.remove(workDir);
});

async function writeInstalledPlugin(id: string, version: string, overrides: Record<string, unknown> = {}) {
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

const SAMPLE_ASSET = { name: 'fictionlab-kanban-1.1.0.zip', browser_download_url: 'https://example.com/a.zip', size: 10, id: 999 };

// ---------------------------------------------------------------------------
// resolveUpdateSource
// ---------------------------------------------------------------------------

describe('resolveUpdateSource', () => {
  it('falls back to the known-plugin map when the manifest has no updateSource', () => {
    const source = resolveUpdateSource('fictionlab-kanban', { id: 'fictionlab-kanban', version: '1.0.0' } as any);
    expect(source).toEqual(KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-kanban']);
  });

  it('prefers a manifest-declared updateSource over the known-plugin map, merging in the known tagPrefix when the manifest omits it (bead mea-4w7)', () => {
    // Defect 1 (mea-4w7): a manifest that declares updateSource but omits
    // tagPrefix used to short-circuit past KNOWN_PLUGIN_UPDATE_SOURCES
    // entirely, yielding tagPrefix: undefined even for a plugin the table
    // knows the correct prefix for. repo/assetPattern/private still come
    // from the manifest (unchanged precedence) -- only tagPrefix merges.
    const manifest: any = {
      id: 'fictionlab-kanban',
      version: '1.0.0',
      updateSource: { repo: 'someone/fork', assetPattern: 'custom-*.zip', private: false },
    };
    const source = resolveUpdateSource('fictionlab-kanban', manifest);
    expect(source).toEqual({
      repo: 'someone/fork',
      assetPattern: 'custom-*.zip',
      private: false,
      tagPrefix: KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-kanban'].tagPrefix,
    });
  });

  it('resolves tagPrefix from the known-plugin table when the manifest declares updateSource without one, for a plugin present in the table (the production case, bead mea-4w7)', () => {
    const manifest: any = {
      id: 'fictionlab-agent-factory',
      version: '0.1.1',
      updateSource: {
        repo: KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-agent-factory'].repo,
        assetPattern: KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-agent-factory'].assetPattern,
        private: true,
      },
    };
    const source = resolveUpdateSource('fictionlab-agent-factory', manifest);
    expect(source?.tagPrefix).toBe('agent-factory-plugin-');
  });

  it('carries a manifest-declared tagPrefix through (bead mea-ecp)', () => {
    const manifest: any = {
      id: 'fictionlab-kanban',
      version: '1.0.0',
      updateSource: { repo: 'someone/fork', assetPattern: 'custom-*.zip', private: false, tagPrefix: 'custom-plugin-' },
    };
    const source = resolveUpdateSource('fictionlab-kanban', manifest);
    expect(source?.tagPrefix).toBe('custom-plugin-');
  });

  it('returns null for a plugin with no known or declared update source', () => {
    expect(resolveUpdateSource('some-unrelated-plugin', { id: 'some-unrelated-plugin', version: '1.0.0' } as any)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findMatchingAsset / maskToken / redactSecret / normalizeVersion
// ---------------------------------------------------------------------------

describe('findMatchingAsset', () => {
  it('matches a wildcard pattern against asset names', () => {
    const assets = [
      { name: 'fictionlab-workflow-1.2.0.zip', downloadUrl: 'x', id: 1 },
      { name: 'fictionlab-kanban-1.2.0.zip', downloadUrl: 'y', id: 2 },
    ];
    expect(findMatchingAsset(assets, 'fictionlab-kanban-*.zip')?.id).toBe(2);
    expect(findMatchingAsset(assets, 'fictionlab-workflow-*.zip')?.id).toBe(1);
  });

  it('returns undefined when nothing matches', () => {
    expect(findMatchingAsset([{ name: 'other.zip', downloadUrl: 'x' }], 'fictionlab-kanban-*.zip')).toBeUndefined();
  });
});

describe('maskToken', () => {
  it('returns only the last 4 characters', () => {
    expect(maskToken('github_pat_11ABCDEFGH1234567890')).toBe('7890');
  });

  it('returns undefined for empty/missing tokens', () => {
    expect(maskToken(undefined)).toBeUndefined();
    expect(maskToken('')).toBeUndefined();
  });
});

describe('redactSecret', () => {
  it('removes every occurrence of the secret from a message', () => {
    const msg = redactSecret('fetch failed for token ghp_secret123 near ghp_secret123', 'ghp_secret123');
    expect(msg).not.toContain('ghp_secret123');
    expect(msg).toBe('fetch failed for token [REDACTED] near [REDACTED]');
  });
});

describe('normalizeVersion', () => {
  it('strips a leading v', () => {
    expect(normalizeVersion('v1.2.3')).toBe('1.2.3');
    expect(normalizeVersion('1.2.3')).toBe('1.2.3');
  });

  it('strips a tagPrefix before the leading v (per-plugin tags, bead mea-ecp)', () => {
    expect(normalizeVersion('workflow-plugin-v1.2.0', 'workflow-plugin-')).toBe('1.2.0');
    expect(normalizeVersion('kanban-plugin-v2.0.0', 'kanban-plugin-')).toBe('2.0.0');
  });

  it('is a no-op when the tagPrefix does not match', () => {
    expect(normalizeVersion('workflow-plugin-v1.2.0', 'kanban-plugin-')).toBe('workflow-plugin-v1.2.0');
  });
});

describe('KNOWN_PLUGIN_UPDATE_SOURCES tagPrefix (bead mea-ecp)', () => {
  it('declares a distinct tagPrefix for every known plugin, including fictionlab-agent-factory', () => {
    expect(KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-workflow'].tagPrefix).toBe('workflow-plugin-');
    expect(KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-kanban'].tagPrefix).toBe('kanban-plugin-');
    expect(KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-agent-factory']).toEqual({
      repo: 'RLRyals/fictionlab-workflow',
      assetPattern: 'fictionlab-agent-factory-*.zip',
      private: true,
      tagPrefix: 'agent-factory-plugin-',
    });
  });
});

// ---------------------------------------------------------------------------
// checkPluginUpdate -- token header injection / no-token public fallback /
// missing-token private error path / version compare
// ---------------------------------------------------------------------------

describe('checkPluginUpdate', () => {
  it('sends Authorization: Bearer when a token is supplied (private repo)', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '1.0.0');
    const fetchFn = jest.fn().mockResolvedValue(
      okJsonResponse([{ tag_name: 'kanban-plugin-v1.1.0', assets: [SAMPLE_ASSET] }])
    );

    await checkPluginUpdate({
      pluginId: 'fictionlab-kanban',
      pluginsDir,
      token: 'ghp_test_token',
      fetchFn: fetchFn as any,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/RLRyals/fictionlab-workflow/releases?per_page=30&page=1',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer ghp_test_token' }) })
    );
  });

  it('checks a public-repo plugin with no token (no-token public fallback)', async () => {
    await writeInstalledPlugin('public-plugin', '1.0.0', {
      updateSource: { repo: 'someone/public-repo', assetPattern: 'public-plugin-*.zip', private: false },
    });
    const fetchFn = jest.fn().mockResolvedValue(
      okJsonResponse({ tag_name: 'v2.0.0', assets: [{ name: 'public-plugin-2.0.0.zip', browser_download_url: 'x', id: 5 }] })
    );

    const result = await checkPluginUpdate({ pluginId: 'public-plugin', pluginsDir, fetchFn: fetchFn as any });

    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.not.objectContaining({ Authorization: expect.anything() }) })
    );
    expect(result.status).toBe('update-available');
    expect(result.latestVersion).toBe('2.0.0');
  });

  it('returns "token-required" for a private repo with no token, without making a network call', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '1.0.0');
    const fetchFn = jest.fn();

    const result = await checkPluginUpdate({ pluginId: 'fictionlab-kanban', pluginsDir, fetchFn: fetchFn as any });

    expect(result.status).toBe('token-required');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports "up-to-date" when the latest release is not newer than the installed version', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '1.5.0');
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse([{ tag_name: 'kanban-plugin-v1.5.0', assets: [SAMPLE_ASSET] }]));

    const result = await checkPluginUpdate({ pluginId: 'fictionlab-kanban', pluginsDir, token: 't', fetchFn: fetchFn as any });

    expect(result.status).toBe('up-to-date');
  });

  it('reports "update-available" with the matched asset when the release is newer', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '1.0.0');
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse([{ tag_name: 'kanban-plugin-v1.1.0', assets: [SAMPLE_ASSET] }]));

    const result = await checkPluginUpdate({ pluginId: 'fictionlab-kanban', pluginsDir, token: 't', fetchFn: fetchFn as any });

    expect(result.status).toBe('update-available');
    expect(result.latestVersion).toBe('1.1.0');
    expect(result.asset?.id).toBe(999);
  });

  it('reports "no-matching-asset" when the release has no asset for this plugin', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '1.0.0');
    const fetchFn = jest.fn().mockResolvedValue(
      okJsonResponse([{ tag_name: 'kanban-plugin-v1.1.0', assets: [{ name: 'fictionlab-workflow-1.1.0.zip', browser_download_url: 'x', id: 1 }] }])
    );

    const result = await checkPluginUpdate({ pluginId: 'fictionlab-kanban', pluginsDir, token: 't', fetchFn: fetchFn as any });

    expect(result.status).toBe('no-matching-asset');
  });

  it('reports "no-update-source" for a plugin with no known or declared source', async () => {
    await writeInstalledPlugin('some-unrelated-plugin', '1.0.0');

    const result = await checkPluginUpdate({ pluginId: 'some-unrelated-plugin', pluginsDir });

    expect(result.status).toBe('no-update-source');
  });

  it('resolves the correct plugin release out of a mixed-plugin release list, not the repo-wide latest (bead mea-ecp)', async () => {
    await writeInstalledPlugin('fictionlab-workflow', '1.0.0');
    // /releases/latest would be the kanban plugin (released most recently);
    // the fix must walk /releases and pick the workflow-prefixed tag instead.
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [
        { tag_name: 'kanban-plugin-v3.0.0', assets: [{ name: 'fictionlab-kanban-3.0.0.zip', browser_download_url: 'x', id: 1 }] },
        {
          tag_name: 'workflow-plugin-v1.2.0',
          assets: [{ name: 'fictionlab-workflow-1.2.0.zip', browser_download_url: 'y', id: 2 }],
        },
      ],
    });

    const result = await checkPluginUpdate({ pluginId: 'fictionlab-workflow', pluginsDir, token: 't', fetchFn: fetchFn as any });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/RLRyals/fictionlab-workflow/releases?per_page=30&page=1',
      expect.anything()
    );
    expect(result.status).toBe('update-available');
    expect(result.latestVersion).toBe('1.2.0');
    expect(result.asset?.id).toBe(2);
  });

  it('reports "up-to-date" (not a phantom update) when installed 0.1.1 and the latest release tag is the raw "agent-factory-plugin-v0.1.1", even when the installed manifest omits tagPrefix (bead mea-4w7, Rebecca\'s reported symptom)', async () => {
    await writeInstalledPlugin('fictionlab-agent-factory', '0.1.1', {
      updateSource: {
        repo: KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-agent-factory'].repo,
        assetPattern: KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-agent-factory'].assetPattern,
        private: true,
        // deliberately no tagPrefix -- the pre-mea-ecp installed-manifest shape
      },
    });
    const fetchFn = jest.fn().mockResolvedValue(
      okJsonResponse([{ tag_name: 'agent-factory-plugin-v0.1.1', assets: [{ name: 'fictionlab-agent-factory-0.1.1.zip', browser_download_url: 'x', id: 1 }] }])
    );

    const result = await checkPluginUpdate({ pluginId: 'fictionlab-agent-factory', pluginsDir, token: 't', fetchFn: fetchFn as any });

    expect(result.status).toBe('up-to-date');
    expect(result.latestVersion).toBe('0.1.1');
  });

  it('still detects a real upgrade for the same plugin/tagPrefix shape -- installed 0.1.1, release tag agent-factory-plugin-v0.2.0 -> update-available with a clean semver, never the raw tag (bead mea-4w7)', async () => {
    await writeInstalledPlugin('fictionlab-agent-factory', '0.1.1', {
      updateSource: {
        repo: KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-agent-factory'].repo,
        assetPattern: KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-agent-factory'].assetPattern,
        private: true,
      },
    });
    const fetchFn = jest.fn().mockResolvedValue(
      okJsonResponse([{ tag_name: 'agent-factory-plugin-v0.2.0', assets: [{ name: 'fictionlab-agent-factory-0.2.0.zip', browser_download_url: 'x', id: 1 }] }])
    );

    const result = await checkPluginUpdate({ pluginId: 'fictionlab-agent-factory', pluginsDir, token: 't', fetchFn: fetchFn as any });

    expect(result.status).toBe('update-available');
    expect(result.latestVersion).toBe('0.2.0');
    expect(result.latestVersion).not.toContain('agent-factory-plugin');
  });

  it('treats a double-digit patch bump as newer, not as a string-lexical regression -- installed 0.1.9, release tag ...-v0.1.10 -> update-available', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '0.1.9');
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse([{ tag_name: 'kanban-plugin-v0.1.10', assets: [SAMPLE_ASSET] }]));

    const result = await checkPluginUpdate({ pluginId: 'fictionlab-kanban', pluginsDir, token: 't', fetchFn: fetchFn as any });

    expect(result.status).toBe('update-available');
    expect(result.latestVersion).toBe('0.1.10');
  });

  it('fails safe (no update offered) and logs a warning naming the plugin/tag/normalized value when a version is unparseable on either side (bead mea-4w7)', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '1.0.0');
    // Prefix matches (so fetchLatestReleaseForPrefix's own prefix filter
    // still selects this release), but what remains after stripping the
    // prefix is not valid semver -- this must never be read as "newer".
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse([{ tag_name: 'kanban-plugin-not-a-semver', assets: [SAMPLE_ASSET] }]));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const result = await checkPluginUpdate({ pluginId: 'fictionlab-kanban', pluginsDir, token: 't', fetchFn: fetchFn as any });

      expect(result.status).toBe('up-to-date');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fictionlab-kanban')
      );
      const warnedMessage = warnSpy.mock.calls[0]?.[0] as string;
      expect(warnedMessage).toContain('kanban-plugin-not-a-semver');
      expect(warnedMessage).toContain('1.0.0');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('never includes the token in a returned error message', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '1.0.0');
    const fetchFn = jest.fn().mockRejectedValue(new Error('network failure while using token super-secret-123'));

    const result = await checkPluginUpdate({ pluginId: 'fictionlab-kanban', pluginsDir, token: 'super-secret-123', fetchFn: fetchFn as any });

    expect(result.status).toBe('error');
    expect(result.error).not.toContain('super-secret-123');
  });
});

// ---------------------------------------------------------------------------
// checkPluginDependencies -- dependency gate block
// ---------------------------------------------------------------------------

describe('checkPluginDependencies', () => {
  it('passes when every requirement is satisfied', () => {
    const manifest: any = {
      id: 'fictionlab-kanban',
      version: '1.1.0',
      fictionLabVersion: '>=0.3.0',
      dependencies: { plugins: ['fictionlab-workflow'], mcpServers: ['kanban-server'] },
    };
    const result = checkPluginDependencies(manifest, {
      appVersion: '0.3.0',
      loadedPlugins: [{ id: 'fictionlab-workflow', version: '1.0.0' }],
      runningServiceNames: ['fictionlab-kanban-server-1'],
    });
    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks on an app-version mismatch with an actionable message', () => {
    const manifest: any = { id: 'p', version: '1.0.0', fictionLabVersion: '>=99.0.0' };
    const result = checkPluginDependencies(manifest, { appVersion: '0.3.0', loadedPlugins: [] });
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toMatch(/Requires FictionLab >=99\.0\.0/);
  });

  it('blocks when a required plugin is missing', () => {
    const manifest: any = { id: 'p', version: '1.0.0', dependencies: { plugins: ['fictionlab-workflow'] } };
    const result = checkPluginDependencies(manifest, { appVersion: '0.3.0', loadedPlugins: [] });
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toMatch(/Requires plugin "fictionlab-workflow"/);
  });

  it('blocks when a required plugin is installed but at the wrong version', () => {
    const manifest: any = { id: 'p', version: '1.0.0', dependencies: { plugins: [{ id: 'fictionlab-workflow', version: '>=2.0.0' }] } };
    const result = checkPluginDependencies(manifest, {
      appVersion: '0.3.0',
      loadedPlugins: [{ id: 'fictionlab-workflow', version: '1.0.0' }],
    });
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toMatch(/>=2\.0\.0/);
  });

  it('blocks when a required MCP server is not running', () => {
    const manifest: any = { id: 'p', version: '1.0.0', dependencies: { mcpServers: ['kanban-server'] } };
    const result = checkPluginDependencies(manifest, {
      appVersion: '0.3.0',
      loadedPlugins: [],
      runningServiceNames: ['some-other-container'],
    });
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toMatch(/Requires MCP server "kanban-server"/);
  });

  it('skips the MCP-server check when runningServiceNames is not provided (never auto-installs anything)', () => {
    const manifest: any = { id: 'p', version: '1.0.0', dependencies: { mcpServers: ['kanban-server'] } };
    const result = checkPluginDependencies(manifest, { appVersion: '0.3.0', loadedPlugins: [] });
    expect(result.ok).toBe(true);
  });

  it('never treats "bd"/"beads" as an installable dependency -- it only blocks, it cannot act', () => {
    // Even if a hostile/malformed manifest declared bd as a "plugin"
    // dependency, the gate only ever compares against already-loaded
    // plugins and returns a blocker string -- it has no code path that
    // shells out or installs anything.
    const manifest: any = { id: 'p', version: '1.0.0', dependencies: { plugins: ['bd'] } };
    const result = checkPluginDependencies(manifest, { appVersion: '0.3.0', loadedPlugins: [] });
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toMatch(/Install it first/);
    // No side effects beyond the plain object return -- nothing to spy on
    // because there is no process/exec call anywhere in this function.
  });
});

// ---------------------------------------------------------------------------
// downloadAndInstallPluginUpdate -- end-to-end with a real temp dir
// ---------------------------------------------------------------------------

describe('downloadAndInstallPluginUpdate', () => {
  it('downloads, extracts, gates, and installs when the dependency gate passes', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '1.0.0');

    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => new TextEncoder().encode('fake-zip-bytes').buffer,
    });

    const extract = jest.fn().mockImplementation(async (_zipPath: string, destPath: string) => {
      await fs.ensureDir(destPath);
      await fs.writeJson(path.join(destPath, 'plugin.json'), {
        id: 'fictionlab-kanban',
        name: 'Kanban',
        version: '1.1.0',
        description: 'test',
        author: 'test',
        fictionLabVersion: '*',
        pluginType: 'utility',
        entry: { main: 'index.js' },
        permissions: [],
      });
      await fs.writeFile(path.join(destPath, 'index.js'), 'module.exports = {};');
    });

    const outcome = await downloadAndInstallPluginUpdate({
      pluginId: 'fictionlab-kanban',
      pluginsDir,
      asset: SAMPLE_ASSET as any,
      source: KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-kanban'],
      token: 't',
      fetchFn: fetchFn as any,
      extract,
      dependencyGate: { appVersion: '0.3.0', loadedPlugins: [] },
    });

    expect(outcome.status).toBe('installed');
    const installedManifest = await readPluginManifestSafe(path.join(pluginsDir, 'fictionlab-kanban'));
    expect(installedManifest?.version).toBe('1.1.0');
  });

  it('blocks the install and touches nothing on disk when the dependency gate fails', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '1.0.0');

    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => new TextEncoder().encode('fake-zip-bytes').buffer,
    });

    const extract = jest.fn().mockImplementation(async (_zipPath: string, destPath: string) => {
      await fs.ensureDir(destPath);
      await fs.writeJson(path.join(destPath, 'plugin.json'), {
        id: 'fictionlab-kanban',
        name: 'Kanban',
        version: '1.1.0',
        description: 'test',
        author: 'test',
        fictionLabVersion: '*',
        pluginType: 'utility',
        entry: { main: 'index.js' },
        permissions: [],
        dependencies: { plugins: ['fictionlab-workflow'] },
      });
      await fs.writeFile(path.join(destPath, 'index.js'), 'module.exports = {};');
    });

    const outcome = await downloadAndInstallPluginUpdate({
      pluginId: 'fictionlab-kanban',
      pluginsDir,
      asset: SAMPLE_ASSET as any,
      source: KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-kanban'],
      token: 't',
      fetchFn: fetchFn as any,
      extract,
      dependencyGate: { appVersion: '0.3.0', loadedPlugins: [] }, // fictionlab-workflow not loaded
    });

    expect(outcome.status).toBe('dependency-blocked');
    if (outcome.status === 'dependency-blocked') {
      expect(outcome.blockers[0]).toMatch(/fictionlab-workflow/);
    }

    // Installed version on disk must be untouched.
    const installedManifest = await readPluginManifestSafe(path.join(pluginsDir, 'fictionlab-kanban'));
    expect(installedManifest?.version).toBe('1.0.0');
  });

  it('reports "download-failed" without throwing when the asset fetch fails', async () => {
    await writeInstalledPlugin('fictionlab-kanban', '1.0.0');
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const outcome = await downloadAndInstallPluginUpdate({
      pluginId: 'fictionlab-kanban',
      pluginsDir,
      asset: SAMPLE_ASSET as any,
      source: KNOWN_PLUGIN_UPDATE_SOURCES['fictionlab-kanban'],
      token: 't',
      fetchFn: fetchFn as any,
      dependencyGate: { appVersion: '0.3.0', loadedPlugins: [] },
    });

    expect(outcome.status).toBe('download-failed');
  });
});
