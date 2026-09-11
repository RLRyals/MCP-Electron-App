/**
 * Unit tests for the auto re-import staleness check (mea-ov6).
 * Covers the version-comparison decision (reimport only when disk is
 * strictly newer) and that a guard refusal from the import path is
 * surfaced rather than retried with force.
 */

jest.mock('../folder-importer');

import { FolderImporter } from '../folder-importer';
import { checkAndReimportWorkflow, checkAndReimportAllWorkflows } from '../reimport-check';

const MockedFolderImporter = FolderImporter as jest.MockedClass<typeof FolderImporter>;

function makeClient(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    getWorkflowImportSource: jest.fn().mockResolvedValue('/repo/workflows/my-flow'),
    getWorkflowDefinition: jest.fn().mockResolvedValue({ workflow_id: 'my-flow', version: '1.9.1' }),
    getWorkflowDefinitions: jest.fn().mockResolvedValue([{ workflow_id: 'my-flow', version: '1.9.1' }]),
    ...overrides,
  } as any;
}

describe('checkAndReimportWorkflow', () => {
  beforeEach(() => {
    MockedFolderImporter.mockClear();
  });

  it('returns no-source when the workflow has no recorded import source', async () => {
    const client = makeClient({ getWorkflowImportSource: jest.fn().mockResolvedValue(null) });

    const result = await checkAndReimportWorkflow('my-flow', client);

    expect(result.status).toBe('no-source');
    expect(MockedFolderImporter).not.toHaveBeenCalled();
  });

  it('does nothing when disk version is the same as the DB version', async () => {
    MockedFolderImporter.prototype.getFolderVersion = jest.fn().mockResolvedValue('1.9.1');
    const client = makeClient();

    const result = await checkAndReimportWorkflow('my-flow', client);

    expect(result.status).toBe('up-to-date');
    expect(MockedFolderImporter.prototype.importFromFolder).not.toHaveBeenCalled();
  });

  it('does nothing when disk version is lower than the DB version (never auto-forces)', async () => {
    MockedFolderImporter.prototype.getFolderVersion = jest.fn().mockResolvedValue('1.8.0');
    const client = makeClient();

    const result = await checkAndReimportWorkflow('my-flow', client);

    expect(result.status).toBe('up-to-date');
    expect(MockedFolderImporter.prototype.importFromFolder).not.toHaveBeenCalled();
  });

  it('re-imports through the guarded path when disk is strictly newer', async () => {
    MockedFolderImporter.prototype.getFolderVersion = jest.fn().mockResolvedValue('1.11.0');
    MockedFolderImporter.prototype.importFromFolder = jest.fn().mockResolvedValue({
      success: true,
      workflowId: 'my-flow',
      version: '1.11.0',
      message: 'Imported',
    });
    const client = makeClient();

    const result = await checkAndReimportWorkflow('my-flow', client);

    expect(MockedFolderImporter.prototype.importFromFolder).toHaveBeenCalledWith('/repo/workflows/my-flow');
    expect(result.status).toBe('reimported');
    expect(result.previousVersion).toBe('1.9.1');
    expect(result.diskVersion).toBe('1.11.0');
  });

  it('surfaces a guard refusal instead of retrying with force', async () => {
    MockedFolderImporter.prototype.getFolderVersion = jest.fn().mockResolvedValue('1.11.0');
    MockedFolderImporter.prototype.importFromFolder = jest.fn().mockResolvedValue({
      success: false,
      message: 'Refusing to import my-flow: incoming version 1.11.0 would overwrite existing version 1.9.1 with different content.',
    });
    const client = makeClient();

    const result = await checkAndReimportWorkflow('my-flow', client);

    expect(result.status).toBe('refused');
    expect(result.message).toMatch(/Refusing to import/);
    // Only ever called once -- never re-called with force=true.
    expect(MockedFolderImporter.prototype.importFromFolder).toHaveBeenCalledTimes(1);
  });
});

describe('checkAndReimportWorkflow - worktree remap (mea-38o)', () => {
  beforeEach(() => {
    MockedFolderImporter.mockClear();
  });

  it('falls back to the canonical repo path when the recorded worktree path no longer exists', async () => {
    const worktreePath = 'C:\\github\\FictionLab-Downloads-worktrees\\fld-6qs\\workflows\\book-formatting';
    const canonicalPath = 'C:\\github\\FictionLab-Downloads\\workflows\\book-formatting';

    MockedFolderImporter.prototype.getFolderVersion = jest.fn().mockImplementation((p: string) => {
      if (p === canonicalPath) return Promise.resolve('1.11.0');
      return Promise.resolve(null); // worktree path is gone
    });
    MockedFolderImporter.prototype.importFromFolder = jest.fn().mockResolvedValue({
      success: true,
      workflowId: 'book-formatting',
      version: '1.11.0',
      message: 'Imported',
    });

    const client = makeClient({
      getWorkflowImportSource: jest.fn().mockResolvedValue(worktreePath),
      getWorkflowDefinition: jest.fn().mockResolvedValue({ workflow_id: 'book-formatting', version: '1.9.1' }),
    });

    const result = await checkAndReimportWorkflow('book-formatting', client);

    expect(result.status).toBe('reimported');
    expect(MockedFolderImporter.prototype.importFromFolder).toHaveBeenCalledWith(canonicalPath);
  });

  it('reports an error when neither the recorded path nor its canonical remap are readable', async () => {
    const worktreePath = 'C:\\github\\FictionLab-Downloads-worktrees\\fld-6qs\\workflows\\book-formatting';
    MockedFolderImporter.prototype.getFolderVersion = jest.fn().mockResolvedValue(null);
    MockedFolderImporter.prototype.importFromFolder = jest.fn();
    const client = makeClient({ getWorkflowImportSource: jest.fn().mockResolvedValue(worktreePath) });

    const result = await checkAndReimportWorkflow('book-formatting', client);

    expect(result.status).toBe('error');
    expect(result.message).toContain(worktreePath);
    expect(MockedFolderImporter.prototype.importFromFolder).not.toHaveBeenCalled();
  });

  it('does not attempt a remap for a recorded path that is not inside a dispatch worktree', async () => {
    MockedFolderImporter.prototype.getFolderVersion = jest.fn().mockResolvedValue(null);
    const client = makeClient({ getWorkflowImportSource: jest.fn().mockResolvedValue('/repo/workflows/my-flow') });

    const result = await checkAndReimportWorkflow('my-flow', client);

    expect(result.status).toBe('error');
    // Only the one, non-worktree path should ever have been probed.
    expect(MockedFolderImporter.prototype.getFolderVersion).toHaveBeenCalledTimes(1);
    expect(MockedFolderImporter.prototype.getFolderVersion).toHaveBeenCalledWith('/repo/workflows/my-flow');
  });
});

describe('checkAndReimportAllWorkflows', () => {
  beforeEach(() => {
    MockedFolderImporter.mockClear();
    jest.useRealTimers();
  });

  it('only returns actionable results, skipping up-to-date/no-source workflows', async () => {
    MockedFolderImporter.prototype.getFolderVersion = jest.fn().mockResolvedValue('1.11.0');
    MockedFolderImporter.prototype.importFromFolder = jest.fn().mockResolvedValue({
      success: true,
      workflowId: 'stale-flow',
      version: '1.11.0',
      message: 'Imported',
    });

    const client = makeClient({
      getWorkflowDefinitions: jest.fn().mockResolvedValue([
        { workflow_id: 'stale-flow', version: '1.9.1' },
        { workflow_id: 'no-source-flow', version: '1.0.0' },
      ]),
      getWorkflowImportSource: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(id === 'stale-flow' ? '/repo/workflows/stale-flow' : null)
        ),
      getWorkflowDefinition: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve({ workflow_id: id, version: id === 'stale-flow' ? '1.9.1' : '1.0.0' })
        ),
    });

    const results = await checkAndReimportAllWorkflows(client, { force: true });

    expect(results).toHaveLength(1);
    expect(results[0].workflowId).toBe('stale-flow');
    expect(results[0].status).toBe('reimported');
  });

  it('reports an unreadable recorded source path once per session, then suppresses it on later automatic checks (mea-38o)', async () => {
    MockedFolderImporter.prototype.getFolderVersion = jest.fn().mockResolvedValue(null);

    const client = makeClient({
      getWorkflowDefinitions: jest.fn().mockResolvedValue([{ workflow_id: 'broken-source-flow', version: '1.0.0' }]),
      getWorkflowImportSource: jest.fn().mockResolvedValue('/repo/workflows/broken-source-flow'),
      getWorkflowDefinition: jest.fn().mockResolvedValue({ workflow_id: 'broken-source-flow', version: '1.0.0' }),
    });

    const nowSpy = jest.spyOn(Date, 'now');

    // First automatic check: surfaces the error.
    nowSpy.mockReturnValue(1_000_000);
    const first = await checkAndReimportAllWorkflows(client, { force: true });
    expect(first).toHaveLength(1);
    expect(first[0].status).toBe('error');

    // A later automatic (non-force) check, well past the cooldown window,
    // must not re-surface the same unreadable-path error again.
    nowSpy.mockReturnValue(1_000_000 + 61_000);
    const second = await checkAndReimportAllWorkflows(client);
    expect(second).toHaveLength(0);

    // An explicit forced check (the user clicking "check for updates") still
    // surfaces current state.
    nowSpy.mockReturnValue(1_000_000 + 122_000);
    const third = await checkAndReimportAllWorkflows(client, { force: true });
    expect(third).toHaveLength(1);
    expect(third[0].status).toBe('error');

    nowSpy.mockRestore();
  });
});
