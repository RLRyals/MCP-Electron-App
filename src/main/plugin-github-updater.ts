/**
 * Plugin GitHub Updater (bead mea-6tt)
 *
 * BRAT-style update checking + install for plugins distributed as GitHub
 * Releases, including from a PRIVATE repo (RLRyals/fictionlab-workflow)
 * accessed via a fine-grained PAT stored as GITHUB_PLUGINS_TOKEN in .env
 * (see env-config.ts). Deliberately Electron-light -- the network/version
 * logic here takes plain injectable params so it unit-tests the same way
 * release-notes.ts does, without mocking `electron` or `app`.
 *
 * Builds entirely on the shared release-fetch module (release-notes.ts,
 * bead mea-1j9) for every GitHub API call -- no duplicate fetch logic here.
 *
 * Flow:
 *   1. `checkPluginUpdate()` -- resolve where this plugin's releases live
 *      (manifest-declared `updateSource`, falling back to
 *      `KNOWN_PLUGIN_UPDATE_SOURCES` for already-shipped plugins), fetch the
 *      latest release, compare versions, find the asset matching this
 *      plugin's `assetPattern`.
 *   2. `checkPluginDependencies()` -- a pure, synchronous gate run against
 *      the *downloaded* candidate's manifest (its dependencies may differ
 *      from what's currently installed) before any swap happens.
 *   3. `downloadAndInstallPluginUpdate()` -- download the matched asset,
 *      extract it (reusing `extractZip` from utils/zip-extract.ts), run the
 *      dependency gate, then hand off to plugin-update-swap.ts's
 *      `updatePluginInPlace()` -- the same atomic validate+swap path the
 *      local-folder updater (issue #182) already uses and this module does
 *      not reimplement.
 *
 * Security:
 *   - The token is never logged (only a boolean "token present" and, for
 *     UI display, its last 4 characters -- see `maskToken`).
 *   - `redactSecret()` strips any literal occurrence of the token out of a
 *     message before it is logged or returned to a caller, and
 *     `stripCredentialedUrl()` additionally scrubs auth-bearing URL
 *     patterns (belt-and-suspenders; GitHub's API surface used here never
 *     embeds the token in a URL, but a future asset host might).
 *   - `beads`/`bd` is Rebecca's dev-side issue tracker, not a plugin
 *     runtime dependency. This module has exactly one thing it ever
 *     installs -- the downloaded plugin bundle itself, via
 *     `updatePluginInPlace()` -- and the dependency gate below is
 *     validate-only: it BLOCKS with an actionable message, it never
 *     auto-installs a missing dependency (plugin, MCP server, or anything
 *     else).
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as semver from 'semver';
import {
  fetchLatestReleaseForPrefix,
  downloadReleaseAsset,
  ReleaseFetchOptions,
  ReleaseInfo,
  ReleaseAssetInfo,
} from './release-notes';
import { extractZip } from './utils/zip-extract';
import {
  updatePluginInPlace,
  readPluginManifestSafe,
  PluginUpdateError,
  MinimalPluginManifest,
} from './plugin-update-swap';

// ---------------------------------------------------------------------------
// Known update sources
// ---------------------------------------------------------------------------

export interface PluginUpdateSource {
  /** GitHub "owner/repo". */
  repo: string;
  /** `*`-wildcard pattern matched against release asset filenames. */
  assetPattern: string;
  /** True when `repo` requires GITHUB_PLUGINS_TOKEN to read releases at all. */
  private?: boolean;
  /**
   * Prefix of this plugin's release tags (e.g. `workflow-plugin-`) in a repo
   * that publishes one GitHub Release per plugin (bead mea-ecp). When set,
   * `checkPluginUpdate` resolves the latest release by walking
   * `/repos/{repo}/releases` for the first non-draft, non-prerelease tag
   * starting with this prefix instead of the repo-wide `/releases/latest`,
   * and strips it before comparing versions. Omit for repos that still cut
   * one release per repo.
   */
  tagPrefix?: string;
}

/**
 * Fallback update sources for plugins that were shipped before the
 * manifest-declared `updateSource` field existed. A plugin whose manifest
 * *does* declare `updateSource` always wins (see `resolveUpdateSource`) --
 * this map only fills the gap for already-installed fictionlab-workflow /
 * fictionlab-kanban / fictionlab-agent-factory copies. fictionlab-workflow
 * publishes one GitHub Release per plugin (`workflow-plugin-vX.Y.Z`,
 * `kanban-plugin-vX.Y.Z`, `agent-factory-plugin-vX.Y.Z`), hence `tagPrefix`
 * on every entry here (bead mea-ecp).
 */
export const KNOWN_PLUGIN_UPDATE_SOURCES: Record<string, PluginUpdateSource> = {
  'fictionlab-workflow': {
    repo: 'RLRyals/fictionlab-workflow',
    assetPattern: 'fictionlab-workflow-*.zip',
    private: true,
    tagPrefix: 'workflow-plugin-',
  },
  'fictionlab-kanban': {
    repo: 'RLRyals/fictionlab-workflow',
    assetPattern: 'fictionlab-kanban-*.zip',
    private: true,
    tagPrefix: 'kanban-plugin-',
  },
  'fictionlab-agent-factory': {
    repo: 'RLRyals/fictionlab-workflow',
    assetPattern: 'fictionlab-agent-factory-*.zip',
    private: true,
    tagPrefix: 'agent-factory-plugin-',
  },
};

export function resolveUpdateSource(
  pluginId: string,
  manifest: MinimalPluginManifest | null
): PluginUpdateSource | null {
  const declared = (manifest as any)?.updateSource;
  const known = KNOWN_PLUGIN_UPDATE_SOURCES[pluginId];

  if (declared && typeof declared.repo === 'string' && typeof declared.assetPattern === 'string') {
    // Manifest values win for repo/assetPattern/private (unchanged
    // precedence). tagPrefix is the one field that falls back to the
    // known-plugin table when the manifest omits it -- the manifest on an
    // already-installed plugin can predate bead mea-ecp, in which case the
    // table is the only place the correct prefix is known. See mea-4w7:
    // dropping straight to `undefined` here caused fetchLatestReleaseForPrefix
    // to fall back to the repo-wide /releases/latest for a multi-plugin repo,
    // and normalizeVersion to leave the raw tag name unstripped.
    return {
      repo: declared.repo,
      assetPattern: declared.assetPattern,
      private: !!declared.private,
      tagPrefix: typeof declared.tagPrefix === 'string' ? declared.tagPrefix : known?.tagPrefix,
    };
  }
  return known ?? null;
}

// ---------------------------------------------------------------------------
// Token masking / redaction
// ---------------------------------------------------------------------------

/**
 * Last-4 mask for UI display. Never returns anything longer than 4 visible
 * characters; the caller is expected to render it as "•••• <last4>".
 */
export function maskToken(token?: string | null): string | undefined {
  if (!token) return undefined;
  const trimmed = token.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}

/**
 * Remove every literal occurrence of `secret` from `message`. Used before
 * logging or surfacing any error that might have interpolated raw fetch
 * error text.
 */
export function redactSecret(message: string, secret?: string | null): string {
  if (!message) return message;
  if (!secret || !secret.trim()) return message;
  return message.split(secret).join('[REDACTED]');
}

/**
 * Strip credentials embedded in a URL (e.g. `https://user:pass@host/...` or
 * `?token=...` / `?access_token=...` query params) out of a message before
 * it is logged. Defense in depth: none of this module's own GitHub API
 * calls put the token in a URL (it's always an Authorization header), but
 * an upstream error message (network library, proxy) could.
 */
export function stripCredentialedUrl(message: string): string {
  if (!message) return message;
  return message
    .replace(/:\/\/([^:/@\s]+):([^@\s]+)@/g, '://$1:[REDACTED]@')
    .replace(/([?&])(token|access_token|api[_-]?key)=[^&\s]+/gi, '$1$2=[REDACTED]');
}

function sanitizeMessage(message: string, token?: string | null): string {
  return stripCredentialedUrl(redactSecret(message, token));
}

// ---------------------------------------------------------------------------
// Asset matching
// ---------------------------------------------------------------------------

/** Convert a `*`-wildcard pattern into an anchored, case-insensitive RegExp. */
function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split('*')
    .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`, 'i');
}

export function findMatchingAsset(
  assets: ReleaseAssetInfo[] | undefined,
  assetPattern: string
): ReleaseAssetInfo | undefined {
  if (!assets || assets.length === 0) return undefined;
  const regex = patternToRegExp(assetPattern);
  return assets.find((asset) => regex.test(asset.name || ''));
}

// ---------------------------------------------------------------------------
// Version compare
// ---------------------------------------------------------------------------

/**
 * Strip a source's `tagPrefix` (if any), then a leading "v"/"V", so both
 * plain `v1.2.3` tags and per-plugin tags like `workflow-plugin-v1.2.0`
 * compare against plain semver.
 */
export function normalizeVersion(version: string, tagPrefix?: string): string {
  let trimmed = (version || '').trim();
  if (tagPrefix && trimmed.startsWith(tagPrefix)) {
    trimmed = trimmed.slice(tagPrefix.length);
  }
  return trimmed.replace(/^v/i, '');
}

// ---------------------------------------------------------------------------
// Update check
// ---------------------------------------------------------------------------

export type PluginUpdateCheckStatus =
  | 'up-to-date'
  | 'update-available'
  | 'no-update-source'
  | 'token-required'
  | 'no-releases'
  | 'no-matching-asset'
  | 'error';

export interface PluginUpdateCheckResult {
  status: PluginUpdateCheckStatus;
  pluginId: string;
  currentVersion?: string;
  latestVersion?: string;
  release?: ReleaseInfo;
  asset?: ReleaseAssetInfo;
  source?: PluginUpdateSource;
  error?: string;
}

export interface CheckPluginUpdateParams {
  pluginId: string;
  pluginsDir: string;
  /** GITHUB_PLUGINS_TOKEN, if configured. Never logged. */
  token?: string;
  fetchFn?: ReleaseFetchOptions['fetchFn'];
  /** Injectable for tests; defaults to reading plugin.json off disk. */
  readInstalledManifest?: (pluginPath: string) => Promise<MinimalPluginManifest | null>;
}

/**
 * Check whether a newer release is available for an installed plugin.
 * Never throws -- every failure path resolves to a first-class status so
 * the caller (IPC handler / UI) can render a clean message.
 */
export async function checkPluginUpdate(
  params: CheckPluginUpdateParams
): Promise<PluginUpdateCheckResult> {
  const { pluginId, pluginsDir, token } = params;
  const readManifest = params.readInstalledManifest ?? readPluginManifestSafe;

  const installedManifest = await readManifest(path.join(pluginsDir, pluginId));
  const currentVersion = installedManifest?.version;

  const source = resolveUpdateSource(pluginId, installedManifest);
  if (!source) {
    return { status: 'no-update-source', pluginId, currentVersion };
  }

  if (source.private && !token) {
    return { status: 'token-required', pluginId, currentVersion, source };
  }

  const result = await fetchLatestReleaseForPrefix(source.repo, source.tagPrefix, { token, fetchFn: params.fetchFn });

  if (result.status === 'not-found') {
    return { status: 'no-releases', pluginId, currentVersion, source };
  }

  if (result.status === 'error' || !result.release) {
    return {
      status: 'error',
      pluginId,
      currentVersion,
      source,
      error: sanitizeMessage(result.error || 'Unknown error fetching latest release.', token),
    };
  }

  const release = result.release;
  const latestVersion = normalizeVersion(release.tagName, source.tagPrefix);

  let isNewer: boolean;
  if (!currentVersion) {
    // No installed version to compare against -- there is nothing installed
    // yet, so any release counts as available.
    isNewer = true;
  } else if (semver.valid(latestVersion) && semver.valid(currentVersion)) {
    isNewer = semver.gt(latestVersion, currentVersion);
  } else {
    // Fail safe: an unparseable version on either side must NOT be reported
    // as an update. The previous `latestVersion !== currentVersion` fallback
    // treated any unparseable tag (e.g. a raw "agent-factory-plugin-v0.1.1"
    // left unstripped by a missing tagPrefix) as "newer", forever offering a
    // phantom same-version update. A missed update is recoverable by
    // reinstalling; a false positive destroys trust in the whole pane. See
    // mea-4w7.
    isNewer = false;
    console.warn(
      `[plugin-github-updater] Could not compare versions for plugin "${pluginId}": ` +
        `raw tag "${release.tagName}" normalized to "${latestVersion}", installed version "${currentVersion}". ` +
        'At least one side is not valid semver; treating as up-to-date to avoid a false-positive update prompt.'
    );
  }

  if (!isNewer) {
    return { status: 'up-to-date', pluginId, currentVersion, latestVersion, release, source };
  }

  const asset = findMatchingAsset(release.assets, source.assetPattern);
  if (!asset) {
    return {
      status: 'no-matching-asset',
      pluginId,
      currentVersion,
      latestVersion,
      release,
      source,
      error: `Release ${release.tagName} has no asset matching pattern "${source.assetPattern}".`,
    };
  }

  return {
    status: 'update-available',
    pluginId,
    currentVersion,
    latestVersion,
    release,
    asset,
    source,
  };
}

// ---------------------------------------------------------------------------
// Dependency gate (runs against the DOWNLOADED candidate's manifest, before
// any file is swapped into place)
// ---------------------------------------------------------------------------

export interface LoadedPluginRef {
  id: string;
  version: string;
}

export interface DependencyGateOptions {
  /** Running app version (e.g. `app.getVersion()`). */
  appVersion: string;
  /** Currently loaded/installed plugins, for `dependencies.plugins` checks. */
  loadedPlugins: LoadedPluginRef[];
  /**
   * Names of currently-running services/containers, for
   * `dependencies.mcpServers` checks (best-effort substring match against
   * declared server ids -- see mcp-system.ts's `getSystemStatus()` for the
   * real source). Omit to skip the MCP-server check entirely (e.g. when the
   * caller can't cheaply determine this).
   */
  runningServiceNames?: string[];
}

export interface DependencyGateResult {
  ok: boolean;
  /** Human-readable, actionable reasons the install is blocked. Empty when ok. */
  blockers: string[];
}

/**
 * Validate a candidate plugin manifest's declared requirements against the
 * current app/plugin/service state. Pure and synchronous by design: it only
 * ever returns a verdict + reasons, it never installs, starts, or modifies
 * anything -- including, explicitly, beads/bd, which is never a plugin
 * dependency this app understands or acts on.
 */
export function checkPluginDependencies(
  manifest: MinimalPluginManifest,
  options: DependencyGateOptions
): DependencyGateResult {
  const blockers: string[] = [];
  const deps = (manifest as any)?.dependencies as
    | { mcpServers?: Array<string | { id: string; version?: string }>; plugins?: Array<string | { id: string; version?: string }>; fictionlabApi?: string }
    | undefined;
  const fictionLabVersion = (manifest as any)?.fictionLabVersion as string | undefined;

  if (fictionLabVersion) {
    if (!semver.validRange(fictionLabVersion)) {
      blockers.push(`Plugin declares an invalid required app version range: "${fictionLabVersion}".`);
    } else if (!semver.satisfies(options.appVersion, fictionLabVersion)) {
      blockers.push(
        `Requires FictionLab ${fictionLabVersion}, but this app is running ${options.appVersion}. Update FictionLab first.`
      );
    }
  }

  if (deps?.plugins?.length) {
    const loadedById = new Map(options.loadedPlugins.map((p) => [p.id, p.version]));
    for (const dep of deps.plugins) {
      const depId = typeof dep === 'string' ? dep : dep.id;
      const depVersionRange = typeof dep === 'object' ? dep.version : undefined;
      const installedVersion = loadedById.get(depId);

      if (!installedVersion) {
        blockers.push(`Requires plugin "${depId}", which is not installed. Install it first.`);
      } else if (depVersionRange && !semver.satisfies(installedVersion, depVersionRange)) {
        blockers.push(
          `Requires plugin "${depId}" ${depVersionRange}, but ${installedVersion} is installed. Update "${depId}" first.`
        );
      }
    }
  }

  if (deps?.mcpServers?.length && options.runningServiceNames) {
    const running = options.runningServiceNames.map((n) => n.toLowerCase());
    for (const dep of deps.mcpServers) {
      const depId = typeof dep === 'string' ? dep : dep.id;
      const isRunning = running.some((name) => name.includes(depId.toLowerCase()));
      if (!isRunning) {
        blockers.push(`Requires MCP server "${depId}" to be running. Start it first (Settings → Services).`);
      }
    }
  }

  return { ok: blockers.length === 0, blockers };
}

// ---------------------------------------------------------------------------
// Download + install
// ---------------------------------------------------------------------------

export interface DownloadAndInstallParams {
  pluginId: string;
  pluginsDir: string;
  asset: ReleaseAssetInfo;
  source: PluginUpdateSource;
  token?: string;
  fetchFn?: ReleaseFetchOptions['fetchFn'];
  dependencyGate: DependencyGateOptions;
  /** Injectable temp-dir root for tests; defaults to os.tmpdir(). */
  tmpRoot?: string;
  /** Injectable zip extraction for tests; defaults to the real extractZip. */
  extract?: (zipPath: string, destPath: string) => Promise<void>;
}

export type PluginInstallOutcome =
  | { status: 'installed'; validation: { manifest: MinimalPluginManifest; currentVersion: string | null } }
  | { status: 'dependency-blocked'; blockers: string[] }
  | { status: 'download-failed'; error: string }
  | { status: 'refused'; code: PluginUpdateError['code']; message: string };

/**
 * Download the matched release asset, extract it, gate it on its declared
 * dependencies, and -- only if the gate passes -- hand off to
 * `updatePluginInPlace()` for the same atomic validate+swap path the
 * local-folder updater uses. Never throws for expected failure modes
 * (download error, dependency block, refused swap); only an unexpected
 * filesystem error propagates.
 */
export async function downloadAndInstallPluginUpdate(
  params: DownloadAndInstallParams
): Promise<PluginInstallOutcome> {
  const { pluginId, pluginsDir, asset, source, token } = params;
  const extract = params.extract ?? extractZip;
  const tmpRoot = params.tmpRoot ?? os.tmpdir();

  if (typeof asset.id !== 'number') {
    return {
      status: 'download-failed',
      error: 'Release asset is missing its numeric id; cannot download.',
    };
  }

  const downloadResult = await downloadReleaseAsset(source.repo, asset.id, {
    token,
    fetchFn: params.fetchFn,
  });

  if (downloadResult.status !== 'ok' || !downloadResult.data) {
    return {
      status: 'download-failed',
      error: sanitizeMessage(downloadResult.error || 'Failed to download release asset.', token),
    };
  }

  const workDir = await fs.mkdtemp(path.join(tmpRoot, `fictionlab-plugin-update-${pluginId}-`));
  try {
    const zipPath = path.join(workDir, asset.name || 'plugin-update.zip');
    await fs.writeFile(zipPath, downloadResult.data);

    const extractedDir = path.join(workDir, 'extracted');
    await extract(zipPath, extractedDir);

    // A release zip may either contain plugin.json at its root, or wrap
    // everything in a single top-level folder (common for GitHub's
    // "Source code" style archives and hand-built release zips alike).
    // Resolve to whichever level actually has plugin.json.
    const candidateDir = await resolvePluginRoot(extractedDir);

    const candidateManifest = await readPluginManifestSafe(candidateDir);
    if (!candidateManifest) {
      return {
        status: 'download-failed',
        error: 'Downloaded plugin bundle does not contain a valid plugin.json.',
      };
    }

    const gate = checkPluginDependencies(candidateManifest, params.dependencyGate);
    if (!gate.ok) {
      return { status: 'dependency-blocked', blockers: gate.blockers };
    }

    try {
      const validation = await updatePluginInPlace(pluginsDir, pluginId, candidateDir);
      return { status: 'installed', validation };
    } catch (error: any) {
      if (error instanceof PluginUpdateError) {
        return { status: 'refused', code: error.code, message: error.message };
      }
      throw error;
    }
  } finally {
    await fs.remove(workDir).catch(() => {
      /* best effort -- OS temp cleanup will eventually reclaim this */
    });
  }
}

/** Find the directory (extractedDir itself, or its sole child) containing plugin.json. */
async function resolvePluginRoot(extractedDir: string): Promise<string> {
  if (await fs.pathExists(path.join(extractedDir, 'plugin.json'))) {
    return extractedDir;
  }

  try {
    const entries = await fs.readdir(extractedDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    if (dirs.length === 1) {
      const nested = path.join(extractedDir, dirs[0].name);
      if (await fs.pathExists(path.join(nested, 'plugin.json'))) {
        return nested;
      }
    }
  } catch {
    // fall through -- readPluginManifestSafe on extractedDir will report "invalid"
  }

  return extractedDir;
}
