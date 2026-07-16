/**
 * Unit tests for src/main/release-notes.ts (bead mea-1j9).
 *
 * The module is deliberately Electron-free (it is reused by app-updater.ts,
 * whats-new.ts, updater.ts, and the upcoming private-repo plugin updater,
 * bead mea-6tt), so no electron mock is needed -- just fetch/exec injection.
 * Follows the same mock-fetch pattern as app-updater.test.ts.
 */

import {
  fetchLatestRelease,
  fetchLatestReleaseForPrefix,
  fetchReleaseByTag,
  fetchCommitDelta,
  getChangeList,
  downloadReleaseAsset,
} from '../release-notes';

function okJsonResponse(body: any) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body };
}

const SAMPLE_RELEASE = {
  tag_name: 'v0.3.0',
  name: 'FictionLab v0.3.0',
  body: '## What\'s Changed\n- feat: something (#42)',
  html_url: 'https://github.com/RLRyals/MCP-Electron-App/releases/tag/v0.3.0',
  published_at: '2026-07-13T00:00:00Z',
  assets: [{ name: 'FictionLab-Setup.exe', browser_download_url: 'https://example.com/setup.exe', size: 42 }],
};

describe('fetchLatestRelease', () => {
  it('maps a successful response to status "ok" with the release fields', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse(SAMPLE_RELEASE));

    const result = await fetchLatestRelease('RLRyals/MCP-Electron-App', { fetchFn: fetchFn as any });

    expect(result.status).toBe('ok');
    expect(result.release).toEqual({
      tagName: 'v0.3.0',
      name: 'FictionLab v0.3.0',
      body: '## What\'s Changed\n- feat: something (#42)',
      htmlUrl: 'https://github.com/RLRyals/MCP-Electron-App/releases/tag/v0.3.0',
      publishedAt: '2026-07-13T00:00:00Z',
      assets: [{ name: 'FictionLab-Setup.exe', downloadUrl: 'https://example.com/setup.exe', size: 42 }],
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/RLRyals/MCP-Electron-App/releases/latest',
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': 'MCP-Electron-App' }),
      })
    );
  });

  it('returns "not-found" (a first-class state, not an error) on 404', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const result = await fetchLatestRelease('RLRyals/MCP-Electron-App', { fetchFn: fetchFn as any });

    expect(result.status).toBe('not-found');
    expect(result.error).toBeUndefined();
  });

  it('returns a rate-limit-specific error on 403', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' });

    const result = await fetchLatestRelease('RLRyals/MCP-Electron-App', { fetchFn: fetchFn as any });

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/rate limit/i);
  });

  it('returns a graceful "error" (never throws) on a network failure', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('network down'));

    const result = await fetchLatestRelease('RLRyals/MCP-Electron-App', { fetchFn: fetchFn as any });

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/network down/);
  });

  it('returns "error" when the release response has no tag_name', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse({ body: 'notes but no tag' }));

    const result = await fetchLatestRelease('RLRyals/MCP-Electron-App', { fetchFn: fetchFn as any });

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/tag_name/);
  });

  it('sends Authorization: Bearer when a token is supplied (private repos, bead mea-6tt)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse(SAMPLE_RELEASE));

    await fetchLatestRelease('RLRyals/fictionlab-workflow', { fetchFn: fetchFn as any, token: 'ghp_test' });

    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer ghp_test' }),
      })
    );
  });

  it('does NOT send an Authorization header without a token', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse(SAMPLE_RELEASE));

    await fetchLatestRelease('RLRyals/MCP-Electron-App', { fetchFn: fetchFn as any });

    const headers = fetchFn.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('fetchReleaseByTag', () => {
  it('requests the tag-specific endpoint', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse(SAMPLE_RELEASE));

    const result = await fetchReleaseByTag('RLRyals/MCP-Electron-App', 'v0.3.0', { fetchFn: fetchFn as any });

    expect(result.status).toBe('ok');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/RLRyals/MCP-Electron-App/releases/tags/v0.3.0',
      expect.anything()
    );
  });

  it('returns "not-found" when no release exists for the tag (dev builds)', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const result = await fetchReleaseByTag('RLRyals/MCP-Electron-App', 'v9.9.9', { fetchFn: fetchFn as any });

    expect(result.status).toBe('not-found');
  });
});

describe('fetchLatestReleaseForPrefix (bead mea-ecp)', () => {
  it('delegates to fetchLatestRelease when tagPrefix is falsy (backward compat)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse(SAMPLE_RELEASE));

    const result = await fetchLatestReleaseForPrefix('RLRyals/MCP-Electron-App', undefined, { fetchFn: fetchFn as any });

    expect(result.status).toBe('ok');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/RLRyals/MCP-Electron-App/releases/latest',
      expect.anything()
    );
  });

  it('picks the first non-draft, non-prerelease release matching the prefix out of a mixed-plugin list', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      okJsonResponse([
        { tag_name: 'kanban-plugin-v2.0.0', assets: [] },
        { tag_name: 'workflow-plugin-v1.5.0', assets: [] },
        { tag_name: 'agent-factory-plugin-v0.1.0', assets: [] },
      ])
    );

    const result = await fetchLatestReleaseForPrefix('RLRyals/fictionlab-workflow', 'workflow-plugin-', {
      fetchFn: fetchFn as any,
    });

    expect(result.status).toBe('ok');
    expect(result.release?.tagName).toBe('workflow-plugin-v1.5.0');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/RLRyals/fictionlab-workflow/releases?per_page=30&page=1',
      expect.anything()
    );
  });

  it('skips draft and prerelease releases even when the tag matches', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      okJsonResponse([
        { tag_name: 'workflow-plugin-v2.0.0', draft: true, assets: [] },
        { tag_name: 'workflow-plugin-v1.9.0', prerelease: true, assets: [] },
        { tag_name: 'workflow-plugin-v1.5.0', assets: [] },
      ])
    );

    const result = await fetchLatestReleaseForPrefix('RLRyals/fictionlab-workflow', 'workflow-plugin-', {
      fetchFn: fetchFn as any,
    });

    expect(result.release?.tagName).toBe('workflow-plugin-v1.5.0');
  });

  it('returns "not-found" when no release in the list matches the prefix', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      okJsonResponse([{ tag_name: 'kanban-plugin-v2.0.0', assets: [] }])
    );

    const result = await fetchLatestReleaseForPrefix('RLRyals/fictionlab-workflow', 'workflow-plugin-', {
      fetchFn: fetchFn as any,
    });

    expect(result.status).toBe('not-found');
  });

  it('paginates when the first page is full and has no match', async () => {
    const page1 = Array.from({ length: 30 }, (_, i) => ({ tag_name: `kanban-plugin-v${i}.0.0`, assets: [] }));
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(okJsonResponse(page1))
      .mockResolvedValueOnce(okJsonResponse([{ tag_name: 'workflow-plugin-v1.0.0', assets: [] }]));

    const result = await fetchLatestReleaseForPrefix('RLRyals/fictionlab-workflow', 'workflow-plugin-', {
      fetchFn: fetchFn as any,
    });

    expect(result.release?.tagName).toBe('workflow-plugin-v1.0.0');
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/RLRyals/fictionlab-workflow/releases?per_page=30&page=2',
      expect.anything()
    );
  });
});

describe('downloadReleaseAsset (bead mea-6tt)', () => {
  it('requests the asset-by-id endpoint with an octet-stream Accept header and the token', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => new TextEncoder().encode('zip-bytes').buffer,
    });

    const result = await downloadReleaseAsset('RLRyals/fictionlab-workflow', 12345, {
      token: 'ghp_test',
      fetchFn: fetchFn as any,
    });

    expect(result.status).toBe('ok');
    expect(result.data?.toString()).toBe('zip-bytes');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/RLRyals/fictionlab-workflow/releases/assets/12345',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer ghp_test',
          'Accept': 'application/octet-stream',
        }),
      })
    );
  });

  it('returns "not-found" (not an error) on a 404', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const result = await downloadReleaseAsset('RLRyals/fictionlab-workflow', 1, { fetchFn: fetchFn as any });

    expect(result.status).toBe('not-found');
  });

  it('returns a graceful "error" on a network failure', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('network down'));

    const result = await downloadReleaseAsset('RLRyals/fictionlab-workflow', 1, { fetchFn: fetchFn as any });

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/network down/);
  });
});

describe('fetchCommitDelta', () => {
  const COMPARE_BODY = {
    commits: [
      { sha: 'aaaaaaa1111111', commit: { message: 'feat: older change (#1)\n\nbody text' } },
      { sha: 'bbbbbbb2222222', commit: { message: 'fix: newer change (#2)' } },
    ],
  };

  it('maps the compare API to first-line commit summaries, newest first', async () => {
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse(COMPARE_BODY));

    const result = await fetchCommitDelta('RLRyals/MCP-Writing-Servers', 'aaaaaaa', 'bbbbbbb', { fetchFn: fetchFn as any });

    expect(result.status).toBe('ok');
    expect(result.commits).toEqual([
      { sha: 'bbbbbbb2222222', message: 'fix: newer change (#2)' },
      { sha: 'aaaaaaa1111111', message: 'feat: older change (#1)' },
    ]);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/RLRyals/MCP-Writing-Servers/compare/aaaaaaa...bbbbbbb',
      expect.anything()
    );
  });

  it('rejects invalid SHAs without making a request', async () => {
    const fetchFn = jest.fn();

    const result = await fetchCommitDelta('owner/repo', 'not a sha; rm -rf', 'bbbbbbb', { fetchFn: fetchFn as any });

    expect(result.status).toBe('error');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns a graceful error on network failure', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('offline'));

    const result = await fetchCommitDelta('owner/repo', 'aaaaaaa', 'bbbbbbb', { fetchFn: fetchFn as any });

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/offline/);
  });
});

describe('getChangeList', () => {
  const REPO = 'RLRyals/MCP-Writing-Servers';
  const DIR = '/fake/repo';
  const OLD = 'aaaaaaa1111111aaaaaaa1111111aaaaaaa11111';
  const NEW = 'bbbbbbb2222222bbbbbbb2222222bbbbbbb22222';

  it('returns no changes for a fresh install (no previous SHA)', async () => {
    const execFn = jest.fn();

    const result = await getChangeList({ repo: REPO, repoDir: DIR, previousSha: undefined, newSha: NEW }, { execFn });

    expect(result).toEqual({ previousSha: undefined, newSha: NEW });
    expect(execFn).not.toHaveBeenCalled();
  });

  it('flags upToDate with an empty change list when SHAs are identical', async () => {
    const execFn = jest.fn();

    const result = await getChangeList({ repo: REPO, repoDir: DIR, previousSha: NEW, newSha: NEW }, { execFn });

    expect(result.upToDate).toBe(true);
    expect(result.changes).toEqual([]);
    expect(execFn).not.toHaveBeenCalled();
  });

  it('uses a local git log for the change list when available', async () => {
    const execFn = jest.fn().mockResolvedValue({
      stdout: 'bbbbbbb fix: newer change (#2)\naaaaaaa feat: older change (#1)\n',
    });
    const fetchFn = jest.fn();

    const result = await getChangeList(
      { repo: REPO, repoDir: DIR, previousSha: OLD, newSha: NEW },
      { execFn, fetchFn: fetchFn as any }
    );

    expect(result.changes).toEqual([
      'bbbbbbb fix: newer change (#2)',
      'aaaaaaa feat: older change (#1)',
    ]);
    expect(execFn).toHaveBeenCalledWith(
      `git log --oneline --no-decorate ${OLD}..${NEW}`,
      { cwd: DIR }
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('falls back to the GitHub compare API when git log fails (shallow clone)', async () => {
    const execFn = jest.fn().mockRejectedValue(new Error('fatal: Invalid revision range'));
    const fetchFn = jest.fn().mockResolvedValue(okJsonResponse({
      commits: [{ sha: NEW, commit: { message: 'fix: newer change (#2)' } }],
    }));

    const result = await getChangeList(
      { repo: REPO, repoDir: DIR, previousSha: OLD, newSha: NEW },
      { execFn, fetchFn: fetchFn as any }
    );

    expect(result.changes).toEqual([`${NEW.slice(0, 7)} fix: newer change (#2)`]);
  });

  it('degrades to no change list (never throws) when both sources fail', async () => {
    const execFn = jest.fn().mockRejectedValue(new Error('no git'));
    const fetchFn = jest.fn().mockRejectedValue(new Error('offline'));

    const result = await getChangeList(
      { repo: REPO, repoDir: DIR, previousSha: OLD, newSha: NEW },
      { execFn, fetchFn: fetchFn as any }
    );

    expect(result).toEqual({ previousSha: OLD, newSha: NEW });
  });
});
