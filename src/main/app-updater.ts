/**
 * App Updater Module (issue #213)
 *
 * Checks GitHub Releases for the MCP-Electron-App (FictionLab) repo itself,
 * as opposed to `./updater.ts` which checks the MCP-Writing-Servers repo's
 * git commits + Docker images. These are deliberately kept separate: this
 * module answers "is there a newer installer build than the one I'm
 * running", not "are my MCP servers stale".
 *
 * As of 2026-07-10 the repo has zero published releases/tags -- the GitHub
 * Releases API returns 404 for `/releases/latest` in that case, which is
 * NOT an error. It's the expected, first-class "no-releases" state that
 * will actually be hit every time this runs until the repo owner publishes
 * a `v*.*.*` tag. Callers must treat it as a normal status, not a failure.
 *
 * v1 scope: check + notify + link to the release page. No electron-updater,
 * no silent auto-download/auto-install.
 */
import { app } from 'electron';
import logger, { logWithCategory, LogCategory } from './logger';

const APP_REPO = 'RLRyals/MCP-Electron-App';
const RELEASES_LATEST_URL = `https://api.github.com/repos/${APP_REPO}/releases/latest`;

export type AppUpdateStatus = 'up-to-date' | 'update-available' | 'no-releases' | 'error';

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size?: number;
}

export interface AppUpdateCheckResult {
  status: AppUpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;
  assets?: ReleaseAsset[];
  error?: string;
}

/**
 * Strip a leading "v" (e.g. "v1.2.3" -> "1.2.3"). Also trims whitespace.
 */
function stripLeadingV(version: string): string {
  const trimmed = version.trim();
  return trimmed.startsWith('v') || trimmed.startsWith('V') ? trimmed.slice(1) : trimmed;
}

/**
 * Parse a semver-ish "x.y.z" string into its numeric parts. Non-numeric or
 * missing segments are treated as 0 so partial versions ("1.2") still
 * compare sanely instead of throwing. Pre-release/build metadata
 * (anything after '-' or '+') is dropped for comparison purposes -- this
 * repo only ever tags plain `v*.*.*` releases (see release.yml), so a
 * fuller semver-precedence implementation isn't needed.
 */
function parseVersionParts(version: string): [number, number, number] {
  const core = stripLeadingV(version).split(/[-+]/)[0];
  const parts = core.split('.').map((part) => {
    const n = parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Compare two version strings, ignoring a leading "v".
 * Returns 1 if `a` > `b`, -1 if `a` < `b`, 0 if equal.
 * Intentionally small and local -- no new dependency, per issue #213.
 */
export function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersionParts(a);
  const [bMajor, bMinor, bPatch] = parseVersionParts(b);

  if (aMajor !== bMajor) return aMajor > bMajor ? 1 : -1;
  if (aMinor !== bMinor) return aMinor > bMinor ? 1 : -1;
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1;
  return 0;
}

/**
 * Check GitHub Releases for a newer published build of this app than the
 * one currently running. Never throws -- all failure paths (network error,
 * malformed response, rate limiting) resolve to `{ status: 'error' }` so
 * callers can render a graceful message instead of an unhandled rejection.
 */
export async function checkForAppUpdate(
  getCurrentVersion: () => string = () => app.getVersion()
): Promise<AppUpdateCheckResult> {
  const currentVersion = getCurrentVersion();

  try {
    logWithCategory('info', LogCategory.SYSTEM, `Checking for FictionLab app updates (current: ${currentVersion})...`);

    const response = await fetch(RELEASES_LATEST_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MCP-Electron-App',
      },
    });

    if (response.status === 404) {
      // Expected steady-state until the first release is tagged -- not an error.
      logWithCategory('info', LogCategory.SYSTEM, 'No published releases found for the app repo yet.');
      return { status: 'no-releases', currentVersion };
    }

    if (!response.ok) {
      if (response.status === 403) {
        return {
          status: 'error',
          currentVersion,
          error: 'GitHub API rate limit exceeded. Please try again later.',
        };
      }
      return {
        status: 'error',
        currentVersion,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
      };
    }

    const release = await response.json();
    const tagName: string | undefined = release?.tag_name;

    if (!tagName) {
      return {
        status: 'error',
        currentVersion,
        error: 'Latest release response did not include a tag_name.',
      };
    }

    const latestVersion = stripLeadingV(tagName);
    const releaseUrl: string | undefined = release?.html_url;
    const releaseNotes: string | undefined = release?.body || undefined;
    const publishedAt: string | undefined = release?.published_at || undefined;
    const assets: ReleaseAsset[] | undefined = Array.isArray(release?.assets)
      ? release.assets.map((asset: any) => ({
          name: asset?.name,
          downloadUrl: asset?.browser_download_url,
          size: asset?.size,
        }))
      : undefined;

    const status: AppUpdateStatus =
      compareVersions(latestVersion, currentVersion) > 0 ? 'update-available' : 'up-to-date';

    return {
      status,
      currentVersion,
      latestVersion,
      releaseUrl,
      releaseNotes,
      publishedAt,
      assets,
    };
  } catch (error: any) {
    logger.error('Error checking for FictionLab app updates:', error);
    return {
      status: 'error',
      currentVersion,
      error: error?.message || String(error),
    };
  }
}
