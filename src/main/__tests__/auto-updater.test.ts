/**
 * Unit tests for src/main/auto-updater.ts (bead mea-hbi).
 *
 * Verifies the packaged-vs-dev guard (every entry point must no-op when
 * `app.isPackaged` is false, since dev builds have no app-update.yml), the
 * startup + 6h recurring check wiring, and that a downloaded update pushes
 * the version to the renderer over the documented IPC channel.
 */

const mockAutoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  logger: null as any,
  on: jest.fn(),
  checkForUpdatesAndNotify: jest.fn().mockResolvedValue(null),
  quitAndInstall: jest.fn(),
};

let isPackaged = true;

jest.mock('electron', () => ({
  app: {
    get isPackaged() {
      return isPackaged;
    },
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
  },
}));

jest.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));

jest.mock('../logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  LogCategory: { SYSTEM: 'SYSTEM' },
  logWithCategory: jest.fn(),
}));

import { BrowserWindow } from 'electron';
import * as autoUpdaterModule from '../auto-updater';

describe('auto-updater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    isPackaged = true;
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([]);
    autoUpdaterModule.stopAutoUpdater();
  });

  afterEach(() => {
    autoUpdaterModule.stopAutoUpdater();
    jest.useRealTimers();
  });

  it('does nothing on init when the app is not packaged (dev build)', () => {
    isPackaged = false;

    autoUpdaterModule.initAutoUpdater();

    expect(mockAutoUpdater.on).not.toHaveBeenCalled();
    expect(mockAutoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });

  it('checkForUpdates() is a no-op when not packaged', () => {
    isPackaged = false;

    autoUpdaterModule.checkForUpdates();

    expect(mockAutoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });

  it('wires up event handlers and checks immediately on init when packaged', () => {
    autoUpdaterModule.initAutoUpdater();

    expect(mockAutoUpdater.autoDownload).toBe(true);
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
    expect(mockAutoUpdater.checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);

    const registeredEvents = mockAutoUpdater.on.mock.calls.map((call) => call[0]);
    expect(registeredEvents).toEqual(
      expect.arrayContaining(['error', 'checking-for-update', 'update-available', 'update-not-available', 'update-downloaded'])
    );
  });

  it('is idempotent -- a second initAutoUpdater() call does not re-register handlers', () => {
    autoUpdaterModule.initAutoUpdater();
    const firstCallCount = mockAutoUpdater.on.mock.calls.length;
    autoUpdaterModule.initAutoUpdater();

    expect(mockAutoUpdater.on.mock.calls.length).toBe(firstCallCount);
  });

  it('runs a recurring check every 6 hours after init', () => {
    autoUpdaterModule.initAutoUpdater();
    expect(mockAutoUpdater.checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(6 * 60 * 60 * 1000);
    expect(mockAutoUpdater.checkForUpdatesAndNotify).toHaveBeenCalledTimes(2);
  });

  it('sends the downloaded version to the main window on update-downloaded', () => {
    const send = jest.fn();
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([{ webContents: { send } }]);

    autoUpdaterModule.initAutoUpdater();

    const handler = mockAutoUpdater.on.mock.calls.find((call) => call[0] === 'update-downloaded')?.[1];
    expect(handler).toBeDefined();
    handler({ version: '1.2.3' });

    expect(send).toHaveBeenCalledWith('app-updater:update-downloaded', { version: '1.2.3' });
  });

  it('quitAndInstall() delegates to electron-updater', () => {
    autoUpdaterModule.quitAndInstall();
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});
