/**
 * Unit tests for src/main/app-updater.ts (issue #213).
 *
 * Covers the two load-bearing pieces: the local semver-ish `compareVersions`
 * helper (no dependency, per the issue), and the `no-releases` branch of
 * `checkForAppUpdate` -- the 404-from-GitHub-Releases path that is NOT an
 * error and is, as of 2026-07-10, the only path that will actually run in
 * production (the repo has zero published releases). `fetch` is mocked so
 * these run offline and deterministically.
 */

jest.mock('electron', () => ({
  app: { getVersion: jest.fn(() => '0.1.0') },
}));

jest.mock('../logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  LogCategory: { SYSTEM: 'SYSTEM' },
  logWithCategory: jest.fn(),
}));

import { checkForAppUpdate, compareVersions } from '../app-updater';

describe('compareVersions', () => {
  it.each([
    ['1.2.3', '1.2.3', 0],
    ['1.2.4', '1.2.3', 1],
    ['1.2.3', '1.2.4', -1],
    ['2.0.0', '1.9.9', 1],
    ['1.9.9', '2.0.0', -1],
    ['1.3.0', '1.2.9', 1],
  ])('compareVersions(%s, %s) === %i', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  it('strips a leading "v" from either argument', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3', 'v1.2.3')).toBe(0);
    expect(compareVersions('v2.0.0', 'v1.0.0')).toBe(1);
  });

  it('treats missing/non-numeric segments as 0 rather than throwing', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.2.3-beta', '1.2.3')).toBe(0);
  });
});

describe('checkForAppUpdate', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('returns status "no-releases" (not an error) on a 404 from the releases API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }) as any;

    const result = await checkForAppUpdate(() => '0.1.0');

    expect(result).toEqual({ status: 'no-releases', currentVersion: '0.1.0' });
    expect(result.error).toBeUndefined();
  });

  it('passes a User-Agent header (required by the GitHub API)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
    global.fetch = fetchMock as any;

    await checkForAppUpdate(() => '0.1.0');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/RLRyals/MCP-Electron-App/releases/latest',
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': 'MCP-Electron-App' }),
      })
    );
  });

  it('returns "update-available" when the latest tag is newer than the current version', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v0.2.0',
        html_url: 'https://github.com/RLRyals/MCP-Electron-App/releases/tag/v0.2.0',
        body: 'Release notes here',
        published_at: '2026-07-01T00:00:00Z',
        assets: [{ name: 'FictionLab-Setup.exe', browser_download_url: 'https://example.com/setup.exe', size: 12345 }],
      }),
    }) as any;

    const result = await checkForAppUpdate(() => '0.1.0');

    expect(result.status).toBe('update-available');
    expect(result.latestVersion).toBe('0.2.0');
    expect(result.releaseUrl).toBe('https://github.com/RLRyals/MCP-Electron-App/releases/tag/v0.2.0');
    expect(result.releaseNotes).toBe('Release notes here');
    expect(result.assets).toEqual([
      { name: 'FictionLab-Setup.exe', downloadUrl: 'https://example.com/setup.exe', size: 12345 },
    ]);
  });

  it('returns "up-to-date" when the latest tag equals the current version', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: 'v0.1.0' }),
    }) as any;

    const result = await checkForAppUpdate(() => '0.1.0');

    expect(result.status).toBe('up-to-date');
    expect(result.latestVersion).toBe('0.1.0');
  });

  it('returns a graceful "error" status (never throws) on a network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    const result = await checkForAppUpdate(() => '0.1.0');

    expect(result.status).toBe('error');
    expect(result.currentVersion).toBe('0.1.0');
    expect(result.error).toMatch(/network down/);
  });

  it('returns a rate-limit-specific error message on a 403', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' }) as any;

    const result = await checkForAppUpdate(() => '0.1.0');

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/rate limit/i);
  });
});
