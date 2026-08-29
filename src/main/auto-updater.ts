/**
 * App Auto-Updater Module (bead mea-hbi)
 *
 * Downloads and installs new FictionLab releases automatically via
 * electron-updater, instead of only linking the user to GitHub (that was
 * `app-updater.ts`'s v1 scope, issue #213). Deliberately a separate module
 * from `app-updater.ts`: that one stays as the manual "Check for Updates"
 * GitHub-Releases-API check surfaced in SetupTab, this one is the
 * background electron-updater flow (startup + every 6h check, silent
 * download, "Restart to update" prompt).
 *
 * electron-updater reads `app-update.yml` (written into the packaged app's
 * resources dir by electron-builder at build time from `build.publish` in
 * package.json) to know where to look for `latest.yml` / `latest-mac.yml` /
 * `latest-linux.yml` on GitHub Releases. That file only exists in a packaged
 * build, so every entry point here is a no-op when `app.isPackaged` is
 * false (dev / `npm start` / E2E smoke tests never call GitHub).
 */
import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import logger, { logWithCategory, LogCategory } from './logger';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export const UPDATE_DOWNLOADED_CHANNEL = 'app-updater:update-downloaded';

let initialized = false;
let checkIntervalHandle: ReturnType<typeof setInterval> | null = null;

function getTargetWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

/**
 * Wire up electron-updater's event handlers and kick off the startup check
 * + recurring 6h check. Safe to call multiple times -- only the first call
 * does anything.
 */
export function initAutoUpdater(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  if (!app.isPackaged) {
    logWithCategory('info', LogCategory.SYSTEM,
      'Skipping electron-updater init: app is not packaged (dev build has no app-update.yml).');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = logger;

  autoUpdater.on('error', (error) => {
    logger.error('electron-updater error:', error);
  });

  autoUpdater.on('checking-for-update', () => {
    logWithCategory('info', LogCategory.SYSTEM, 'electron-updater: checking for app update...');
  });

  autoUpdater.on('update-available', (info) => {
    logWithCategory('info', LogCategory.SYSTEM, `electron-updater: update available (${info.version}), downloading...`);
  });

  autoUpdater.on('update-not-available', (info) => {
    logWithCategory('info', LogCategory.SYSTEM, `electron-updater: no update available (current: ${info.version}).`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    logWithCategory('info', LogCategory.SYSTEM, `electron-updater: update ${info.version} downloaded, ready to install.`);
    const win = getTargetWindow();
    if (win) {
      win.webContents.send(UPDATE_DOWNLOADED_CHANNEL, { version: info.version });
    }
  });

  checkForUpdates();
  checkIntervalHandle = setInterval(checkForUpdates, CHECK_INTERVAL_MS);
}

/**
 * Trigger an electron-updater check (checks, and silently downloads if an
 * update is found -- `autoDownload` is true). No-op outside a packaged
 * build. Never throws -- errors are logged via the `error` event handler
 * registered in `initAutoUpdater`.
 */
export function checkForUpdates(): void {
  if (!app.isPackaged) {
    return;
  }
  autoUpdater.checkForUpdatesAndNotify().catch((error: any) => {
    logger.error('electron-updater checkForUpdatesAndNotify failed:', error);
  });
}

/**
 * Restart the app and install a downloaded update. Should only be called
 * after `UPDATE_DOWNLOADED_CHANNEL` has fired (i.e. `update-downloaded`).
 */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall();
}

/**
 * Stop the recurring 6h check (app shutdown / test teardown).
 */
export function stopAutoUpdater(): void {
  if (checkIntervalHandle) {
    clearInterval(checkIntervalHandle);
    checkIntervalHandle = null;
  }
  initialized = false;
}
