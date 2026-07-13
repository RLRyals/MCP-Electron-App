/**
 * Release Notes Module (bead mea-1j9 -- "What's New" changelogs in-app)
 *
 * REUSABLE, Electron-free helpers for fetching GitHub release/changelog data.
 * Deliberately imports nothing from 'electron' so it can be unit-tested
 * standalone and reused by:
 *   - `app-updater.ts` (the FictionLab self-update check, issue #213 / PR #218)
 *   - `whats-new.ts` (the post-update "What's New" panel)
 *   - `updater.ts` (managed-repo commit deltas around the mws pull)
 *   - `plugin-github-updater.ts` (private-repo plugin updater, bead mea-6tt)
 *     -- every function takes an optional `token` for `Authorization: Bearer`
 *     access to private repos; `downloadReleaseAsset` additionally streams
 *     an asset's raw bytes via the same authenticated path.
 *
 * All functions never throw: failures resolve to `{ status: 'error' }` (or
 * the first-class `'not-found'` state) so callers can degrade gracefully --
 * an update that succeeded but whose notes fetch failed must never crash.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GITHUB_API_BASE = 'https://api.github.com';
const USER_AGENT = 'MCP-Electron-App';

export type FetchStatus = 'ok' | 'not-found' | 'error';

export interface ReleaseAssetInfo {
  name: string;
  downloadUrl: string;
  size?: number;
  /**
   * GitHub's numeric asset id. Needed to download from a PRIVATE repo:
   * `downloadUrl` (browser_download_url) redirects to a signed storage URL
   * that only works for public assets or an authenticated browser session,
   * while the `/releases/assets/{id}` API endpoint (see
   * `downloadReleaseAsset` below) accepts the same `Authorization: Bearer`
   * header as every other call in this module (bead mea-6tt).
   */
  id?: number;
}

export interface ReleaseInfo {
  tagName: string;
  name?: string;
  /** The release notes body (GitHub-flavored markdown). */
  body?: string;
  htmlUrl?: string;
  publishedAt?: string;
  assets?: ReleaseAssetInfo[];
}

export interface ReleaseFetchResult {
  status: FetchStatus;
  release?: ReleaseInfo;
  error?: string;
}

export interface ReleaseFetchOptions {
  /**
   * Optional GitHub token for private repos (bead mea-6tt). Sent as
   * `Authorization: Bearer <token>`. Never logged by this module.
   */
  token?: string;
  /** Injectable fetch for tests; defaults to global fetch. */
  fetchFn?: typeof fetch;
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': USER_AGENT,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Map a non-ok GitHub API response to a ReleaseFetchResult error/not-found.
 * 404 is a first-class state (repo has no releases / tag not published),
 * NOT an error -- see app-updater.ts's "no-releases" handling.
 */
function mapErrorResponse(response: { status: number; statusText: string }): ReleaseFetchResult {
  if (response.status === 404) {
    return { status: 'not-found' };
  }
  if (response.status === 403) {
    return {
      status: 'error',
      error: 'GitHub API rate limit exceeded. Please try again later.',
    };
  }
  return {
    status: 'error',
    error: `GitHub API error: ${response.status} ${response.statusText}`,
  };
}

function parseRelease(release: any): ReleaseFetchResult {
  const tagName: string | undefined = release?.tag_name;
  if (!tagName) {
    return { status: 'error', error: 'Release response did not include a tag_name.' };
  }

  const assets: ReleaseAssetInfo[] | undefined = Array.isArray(release?.assets)
    ? release.assets.map((asset: any) => ({
        name: asset?.name,
        downloadUrl: asset?.browser_download_url,
        size: asset?.size,
        id: typeof asset?.id === 'number' ? asset.id : undefined,
      }))
    : undefined;

  return {
    status: 'ok',
    release: {
      tagName,
      name: release?.name || undefined,
      body: release?.body || undefined,
      htmlUrl: release?.html_url || undefined,
      publishedAt: release?.published_at || undefined,
      assets,
    },
  };
}

async function fetchReleaseFromUrl(url: string, options: ReleaseFetchOptions = {}): Promise<ReleaseFetchResult> {
  const fetchFn = options.fetchFn ?? fetch;

  try {
    const response = await fetchFn(url, { headers: buildHeaders(options.token) });

    if (!response.ok) {
      return mapErrorResponse(response);
    }

    return parseRelease(await response.json());
  } catch (error: any) {
    return { status: 'error', error: error?.message || String(error) };
  }
}

/**
 * Fetch the latest published release for a repo ("owner/name").
 */
export async function fetchLatestRelease(
  repo: string,
  options: ReleaseFetchOptions = {}
): Promise<ReleaseFetchResult> {
  return fetchReleaseFromUrl(`${GITHUB_API_BASE}/repos/${repo}/releases/latest`, options);
}

/**
 * Fetch the release published for a specific tag (e.g. "v0.3.0") for a repo
 * ("owner/name"). `not-found` means no release exists for that tag -- the
 * normal state for local dev builds whose version was never tagged.
 */
export async function fetchReleaseByTag(
  repo: string,
  tag: string,
  options: ReleaseFetchOptions = {}
): Promise<ReleaseFetchResult> {
  return fetchReleaseFromUrl(
    `${GITHUB_API_BASE}/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
    options
  );
}

// ---------------------------------------------------------------------------
// Commit deltas (managed-repo updates: "what changed between old and new SHA")
// ---------------------------------------------------------------------------

export interface CommitSummary {
  sha: string;
  /** First line of the commit message. */
  message: string;
}

export interface CommitDeltaResult {
  status: FetchStatus;
  commits?: CommitSummary[];
  error?: string;
}

const SHA_PATTERN = /^[0-9a-f]{4,40}$/i;

/**
 * Fetch the commits between two SHAs via the GitHub compare API. Used as a
 * fallback when a local `git log` can't resolve the range (e.g. shallow
 * clones where the old SHA fell outside the fetched history).
 */
export async function fetchCommitDelta(
  repo: string,
  baseSha: string,
  headSha: string,
  options: ReleaseFetchOptions = {}
): Promise<CommitDeltaResult> {
  const fetchFn = options.fetchFn ?? fetch;

  if (!SHA_PATTERN.test(baseSha) || !SHA_PATTERN.test(headSha)) {
    return { status: 'error', error: 'Invalid commit SHA.' };
  }

  try {
    const url = `${GITHUB_API_BASE}/repos/${repo}/compare/${baseSha}...${headSha}`;
    const response = await fetchFn(url, { headers: buildHeaders(options.token) });

    if (!response.ok) {
      const mapped = mapErrorResponse(response);
      return { status: mapped.status, error: mapped.error };
    }

    const body = await response.json();
    const commits: CommitSummary[] = Array.isArray(body?.commits)
      ? body.commits.map((entry: any) => ({
          sha: String(entry?.sha || ''),
          message: String(entry?.commit?.message || '').split('\n')[0],
        }))
      : [];

    // Newest first, matching `git log` ordering (the compare API returns
    // oldest first).
    return { status: 'ok', commits: commits.reverse() };
  } catch (error: any) {
    return { status: 'error', error: error?.message || String(error) };
  }
}

// ---------------------------------------------------------------------------
// Release asset download (bead mea-6tt: private-repo plugin updater)
// ---------------------------------------------------------------------------

export interface AssetDownloadResult {
  status: FetchStatus;
  /** Raw asset bytes on success. */
  data?: Buffer;
  error?: string;
}

/**
 * Download a release asset by its numeric id via the GitHub API, using
 * `Accept: application/octet-stream` so GitHub streams the raw bytes
 * instead of the asset's JSON metadata. Works uniformly for public and
 * private repos (unlike `browser_download_url`, which requires either no
 * auth (public) or an authenticated browser session (private) -- the API
 * endpoint accepts the same Bearer token as every other call here).
 *
 * Never throws; failures resolve to `{ status: 'error' }` so callers can
 * show a clean message instead of an unhandled rejection. The error
 * message intentionally never includes the request URL (it carries no
 * credentials, but keeping this module's error surface URL-free avoids
 * ever having to reason about what a future asset URL might embed).
 */
export async function downloadReleaseAsset(
  repo: string,
  assetId: number,
  options: ReleaseFetchOptions = {}
): Promise<AssetDownloadResult> {
  const fetchFn = options.fetchFn ?? fetch;

  try {
    const url = `${GITHUB_API_BASE}/repos/${repo}/releases/assets/${assetId}`;
    const response = await fetchFn(url, {
      headers: {
        ...buildHeaders(options.token),
        'Accept': 'application/octet-stream',
      },
    });

    if (!response.ok) {
      const mapped = mapErrorResponse(response);
      return { status: mapped.status, error: mapped.error };
    }

    const arrayBuffer = await response.arrayBuffer();
    return { status: 'ok', data: Buffer.from(arrayBuffer) };
  } catch (error: any) {
    return { status: 'error', error: error?.message || String(error) };
  }
}

// ---------------------------------------------------------------------------
// Local-repo change list with API fallback
// ---------------------------------------------------------------------------

export interface ChangeListOptions extends ReleaseFetchOptions {
  /** Injectable exec for tests; defaults to child_process exec. */
  execFn?: (command: string, options: { cwd: string }) => Promise<{ stdout: string }>;
}

export interface ChangeListResult {
  previousSha?: string;
  newSha?: string;
  /** One line per commit ("<short-sha> <subject>"), newest first. */
  changes?: string[];
  /** True when previous and new SHA are identical (no-op update). */
  upToDate?: boolean;
}

/**
 * Compute the human-readable change list between two SHAs of a managed repo.
 * Tries a local `git log --oneline old..new` first (works offline), then
 * falls back to the GitHub compare API (handles shallow clones where the old
 * SHA is outside local history). Never throws; when both sources fail the
 * result simply omits `changes` so callers can show a quiet fallback.
 */
export async function getChangeList(params: {
  /** "owner/name", for the compare-API fallback. */
  repo: string;
  /** Local clone directory, for the git-log fast path. */
  repoDir: string;
  previousSha?: string;
  newSha: string;
}, options: ChangeListOptions = {}): Promise<ChangeListResult> {
  const { repo, repoDir, previousSha, newSha } = params;
  const execFn = options.execFn ?? execAsync;

  if (!previousSha) {
    // Fresh install -- there is no "before" to diff against.
    return { previousSha, newSha };
  }

  if (previousSha === newSha) {
    return { previousSha, newSha, upToDate: true, changes: [] };
  }

  if (SHA_PATTERN.test(previousSha) && SHA_PATTERN.test(newSha)) {
    try {
      const { stdout } = await execFn(
        `git log --oneline --no-decorate ${previousSha}..${newSha}`,
        { cwd: repoDir }
      );
      const changes = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      return { previousSha, newSha, changes };
    } catch {
      // Fall through to the compare API (e.g. shallow clone).
    }
  }

  const compared = await fetchCommitDelta(repo, previousSha, newSha, options);
  if (compared.status === 'ok' && compared.commits) {
    return {
      previousSha,
      newSha,
      changes: compared.commits.map((c) => `${c.sha.slice(0, 7)} ${c.message}`.trim()),
    };
  }

  // Quiet fallback: the update itself succeeded; we just can't list changes.
  return { previousSha, newSha };
}
