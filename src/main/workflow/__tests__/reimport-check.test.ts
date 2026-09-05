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
});
