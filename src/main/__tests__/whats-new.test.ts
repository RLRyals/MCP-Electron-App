/**
 * Unit tests for src/main/whats-new.ts (bead mea-1j9).
 *
 * Covers the show-once-per-version state machine around lastSeenVersion:
 * first-run baselining, same-version no-op, changed-version fetch, the
 * not-found (dev build) permanent skip, and the offline-graceful transient
 * error path (acceptance criterion: update succeeded but notes fetch failed
 * -> quiet fallback, no crash, retried next launch).
 */

jest.mock('electron', () => ({
  app: { getVersion: jest.fn(() => '0.3.0') },
}));

jest.mock('../logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  LogCategory: { SYSTEM: 'SYSTEM' },
  logWithCategory: jest.fn(),
}));

jest.mock('../app-settings', () => ({
  getLastSeenVersion: jest.fn(),
  setLastSeenVersion: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../release-notes', () => ({
  fetchLatestRelease: jest.fn(),
  fetchReleaseByTag: jest.fn(),
}));

import { getStartupWhatsNew, markVersionSeen, getCurrentReleaseNotes } from '../whats-new';
import * as appSettings from '../app-settings';
import { fetchLatestRelease, fetchReleaseByTag } from '../release-notes';

const mockGetLastSeen = appSettings.getLastSeenVersion as jest.Mock;
const mockSetLastSeen = appSettings.setLastSeenVersion as jest.Mock;
const mockFetchByTag = fetchReleaseByTag as jest.Mock;
const mockFetchLatest = fetchLatestRelease as jest.Mock;

const RELEASE_030 = {
  tagName: 'v0.3.0',
  name: 'FictionLab v0.3.0',
  body: '- feat: what a feature (#42)',
  htmlUrl: 'https://github.com/RLRyals/MCP-Electron-App/releases/tag/v0.3.0',
  publishedAt: '2026-07-13T00:00:00Z',
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('getStartupWhatsNew', () => {
  it('baselines silently on first run (no lastSeenVersion) without showing', async () => {
    mockGetLastSeen.mockResolvedValue(undefined);

    const result = await getStartupWhatsNew(() => '0.3.0');

    expect(result).toBeNull();
    expect(mockSetLastSeen).toHaveBeenCalledWith('0.3.0');
    expect(mockFetchByTag).not.toHaveBeenCalled();
  });

  it('returns null without fetching when the version was already seen', async () => {
    mockGetLastSeen.mockResolvedValue('0.3.0');

    const result = await getStartupWhatsNew(() => '0.3.0');

    expect(result).toBeNull();
    expect(mockFetchByTag).not.toHaveBeenCalled();
    expect(mockSetLastSeen).not.toHaveBeenCalled();
  });

  it('returns the release notes payload after an update (version changed)', async () => {
    mockGetLastSeen.mockResolvedValue('0.2.0');
    mockFetchByTag.mockResolvedValue({ status: 'ok', release: RELEASE_030 });

    const result = await getStartupWhatsNew(() => '0.3.0');

    expect(mockFetchByTag).toHaveBeenCalledWith('RLRyals/MCP-Electron-App', 'v0.3.0');
    expect(result).toEqual({
      version: '0.3.0',
      title: 'FictionLab v0.3.0',
      notes: '- feat: what a feature (#42)',
      releaseUrl: 'https://github.com/RLRyals/MCP-Electron-App/releases/tag/v0.3.0',
      publishedAt: '2026-07-13T00:00:00Z',
    });
    // NOT marked seen here -- the renderer marks it after actually showing
    // the panel, so a failed render still gets another chance.
    expect(mockSetLastSeen).not.toHaveBeenCalled();
  });

  it('marks seen and stays quiet when no release exists for the running version (dev build)', async () => {
    mockGetLastSeen.mockResolvedValue('0.2.0');
    mockFetchByTag.mockResolvedValue({ status: 'not-found' });

    const result = await getStartupWhatsNew(() => '0.3.0');

    expect(result).toBeNull();
    expect(mockSetLastSeen).toHaveBeenCalledWith('0.3.0');
  });

  it('degrades quietly on a transient fetch error WITHOUT marking seen (retries next launch)', async () => {
    mockGetLastSeen.mockResolvedValue('0.2.0');
    mockFetchByTag.mockResolvedValue({ status: 'error', error: 'offline' });

    const result = await getStartupWhatsNew(() => '0.3.0');

    expect(result).toBeNull();
    expect(mockSetLastSeen).not.toHaveBeenCalled();
  });

  it('never throws even when settings access fails', async () => {
    mockGetLastSeen.mockRejectedValue(new Error('disk error'));

    await expect(getStartupWhatsNew(() => '0.3.0')).resolves.toBeNull();
  });
});

describe('markVersionSeen', () => {
  it('persists the version via app-settings', async () => {
    const result = await markVersionSeen('0.3.0');

    expect(mockSetLastSeen).toHaveBeenCalledWith('0.3.0');
    expect(result).toEqual({ success: true });
  });
});

describe('getCurrentReleaseNotes', () => {
  it('returns the release for the running version when it exists', async () => {
    mockFetchByTag.mockResolvedValue({ status: 'ok', release: RELEASE_030 });

    const result = await getCurrentReleaseNotes(() => '0.3.0');

    expect(result?.version).toBe('0.3.0');
    expect(result?.notes).toBe('- feat: what a feature (#42)');
    expect(mockFetchLatest).not.toHaveBeenCalled();
  });

  it('falls back to the latest release when the running version has none', async () => {
    mockFetchByTag.mockResolvedValue({ status: 'not-found' });
    mockFetchLatest.mockResolvedValue({ status: 'ok', release: { ...RELEASE_030, tagName: 'v0.2.9' } });

    const result = await getCurrentReleaseNotes(() => '0.3.0');

    expect(result?.version).toBe('0.2.9');
    expect(mockFetchLatest).toHaveBeenCalled();
  });

  it('returns null (never throws) when nothing is available', async () => {
    mockFetchByTag.mockResolvedValue({ status: 'not-found' });
    mockFetchLatest.mockResolvedValue({ status: 'not-found' });

    const result = await getCurrentReleaseNotes(() => '0.3.0');

    expect(result).toBeNull();
  });
});
