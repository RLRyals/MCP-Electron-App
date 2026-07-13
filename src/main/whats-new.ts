/**
 * What's New Module (bead mea-1j9)
 *
 * Decides when the post-update "What's New" panel should appear and fetches
 * its content. Two entry points:
 *
 *   - `getStartupWhatsNew()`  -- called once after the renderer loads. If the
 *     running app version differs from the persisted `lastSeenVersion`
 *     (app-settings.ts), fetch the GitHub release notes for the RUNNING
 *     version and return them so the renderer can show the panel once.
 *   - `getCurrentReleaseNotes()` -- on-demand from Settings ("What's New"
 *     button); always returns notes when available, ignoring lastSeenVersion.
 *
 * Offline-graceful by design (acceptance criterion): a failed notes fetch
 * logs quietly and returns null -- never a crash, never a blocking dialog.
 * `lastSeenVersion` is only advanced when the notes were actually shown (the
 * renderer calls `markVersionSeen`) or when no release exists for the running
 * version (a permanent state -- retrying every launch would be noise).
 */

import { app } from 'electron';
import { logWithCategory, LogCategory } from './logger';
import { APP_REPO } from './app-updater';
import { fetchLatestRelease, fetchReleaseByTag } from './release-notes';
import * as appSettings from './app-settings';

export interface WhatsNewPayload {
  version: string;
  title: string;
  /** Release notes body (GitHub-flavored markdown). */
  notes?: string;
  releaseUrl?: string;
  publishedAt?: string;
}

function toPayload(version: string, release: {
  name?: string;
  body?: string;
  htmlUrl?: string;
  publishedAt?: string;
}): WhatsNewPayload {
  return {
    version,
    title: release.name || `FictionLab ${version}`,
    notes: release.body,
    releaseUrl: release.htmlUrl,
    publishedAt: release.publishedAt,
  };
}

/**
 * Startup check: returns the What's New payload exactly when the panel
 * should be shown, otherwise null. Never throws.
 */
export async function getStartupWhatsNew(
  getCurrentVersion: () => string = () => app.getVersion()
): Promise<WhatsNewPayload | null> {
  const currentVersion = getCurrentVersion();

  try {
    const lastSeen = await appSettings.getLastSeenVersion();

    if (!lastSeen) {
      // First run (or an install that predates this feature): baseline
      // silently so the NEXT update shows its notes.
      await appSettings.setLastSeenVersion(currentVersion);
      return null;
    }

    if (lastSeen === currentVersion) {
      return null;
    }

    const result = await fetchReleaseByTag(APP_REPO, `v${currentVersion}`);

    if (result.status === 'ok' && result.release) {
      // Shown once per version: the renderer calls markVersionSeen after
      // actually displaying the panel.
      return toPayload(currentVersion, result.release);
    }

    if (result.status === 'not-found') {
      // No release published for the running version (e.g. a dev build).
      // Permanent state -- mark seen so we don't re-check every launch.
      logWithCategory('info', LogCategory.SYSTEM,
        `No GitHub release found for v${currentVersion}; skipping What's New.`);
      await appSettings.setLastSeenVersion(currentVersion);
      return null;
    }

    // Transient failure (offline, rate limit): quiet fallback, keep
    // lastSeenVersion untouched so the panel gets another chance next launch.
    logWithCategory('warn', LogCategory.SYSTEM,
      `What's New notes fetch failed (will retry next launch): ${result.error}`);
    return null;
  } catch (error: any) {
    logWithCategory('warn', LogCategory.SYSTEM,
      `What's New startup check failed: ${error?.message || error}`);
    return null;
  }
}

/**
 * Record that the What's New panel for `version` was shown.
 */
export async function markVersionSeen(version: string): Promise<{ success: boolean }> {
  return appSettings.setLastSeenVersion(version);
}

/**
 * On-demand notes (Settings -> "What's New"): the release for the running
 * version when it exists, otherwise the latest published release. Returns
 * null when neither is available. Never throws.
 */
export async function getCurrentReleaseNotes(
  getCurrentVersion: () => string = () => app.getVersion()
): Promise<WhatsNewPayload | null> {
  const currentVersion = getCurrentVersion();

  try {
    let result = await fetchReleaseByTag(APP_REPO, `v${currentVersion}`);

    if (result.status !== 'ok' || !result.release) {
      result = await fetchLatestRelease(APP_REPO);
    }

    if (result.status === 'ok' && result.release) {
      const tagVersion = result.release.tagName.replace(/^v/i, '');
      return toPayload(tagVersion, result.release);
    }

    return null;
  } catch (error: any) {
    logWithCategory('warn', LogCategory.SYSTEM,
      `What's New on-demand fetch failed: ${error?.message || error}`);
    return null;
  }
}
