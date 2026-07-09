/**
 * Tests for DatabaseTab's "Batch Ops" wiring (issue #128).
 *
 * Scoped narrowly to the batch view-switch: it does not re-test
 * BackupManager/CRUDPanel (already covered elsewhere / by sibling issues
 * #129 and #130's own suites) so it stays low-friction against concurrent
 * edits to this same shared container file.
 */

import { DatabaseTab } from '../DatabaseTab';

function makeMockAPI() {
  return {
    checkConnection: jest.fn().mockResolvedValue({ success: true }),
    listTables: jest.fn().mockResolvedValue({ success: true, data: { tables: ['characters'] } }),
    listColumns: jest.fn().mockResolvedValue({ success: true, data: { columns: ['id', 'name'] } }),
    queryRecords: jest.fn().mockResolvedValue({ success: true, data: { data: [], totalCount: 0 } }),
    batchInsert: jest.fn().mockResolvedValue({ success: true }),
    batchUpdate: jest.fn().mockResolvedValue({ success: true }),
    batchDelete: jest.fn().mockResolvedValue({ success: true }),
    getServerInfo: jest.fn().mockResolvedValue({ success: true }),
    insertRecord: jest.fn().mockResolvedValue({ success: true }),
    updateRecords: jest.fn().mockResolvedValue({ success: true }),
    deleteRecords: jest.fn().mockResolvedValue({ success: true }),
    getSchema: jest.fn().mockResolvedValue({ success: true }),
    getRelationships: jest.fn().mockResolvedValue({ success: true }),
    queryAuditLogs: jest.fn().mockResolvedValue({ success: true }),
    getAuditSummary: jest.fn().mockResolvedValue({ success: true }),
  };
}

function makeMockBackupAPI() {
  return {
    list: jest.fn().mockResolvedValue({ success: true, backups: [] }),
    create: jest.fn().mockResolvedValue({ success: true }),
    restore: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
    selectSaveLocation: jest.fn().mockResolvedValue(null),
    selectRestoreFile: jest.fn().mockResolvedValue(null),
    getDirectory: jest.fn().mockResolvedValue(''),
    openDirectory: jest.fn().mockResolvedValue(undefined),
  };
}

const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('DatabaseTab batch operations wiring (issue #128)', () => {
  let container: HTMLElement;
  let tab: DatabaseTab;

  beforeEach(async () => {
    (window as any).electronAPI = {
      databaseAdmin: makeMockAPI(),
      databaseBackup: makeMockBackupAPI(),
    };

    document.body.innerHTML = '<div id="database-card"></div>';
    container = document.getElementById('database-card')!;

    tab = new DatabaseTab();
    await tab.initialize();
    await flushPromises();
  });

  it('renders a "Batch Ops" quick action alongside the existing Backups action', () => {
    const batchBtn = document.getElementById('db-batch-operations');
    expect(batchBtn).not.toBeNull();
    expect(batchBtn!.textContent).toMatch(/batch ops/i);

    // Existing action must still be present -- confirms this is additive.
    expect(document.getElementById('db-manage-backups')).not.toBeNull();
  });

  it('switches to the Batch Operations view and mounts BatchPanel when clicked', async () => {
    const batchBtn = document.getElementById('db-batch-operations') as HTMLButtonElement;
    batchBtn.click();
    await flushPromises();

    expect(document.querySelector('.batch-panel')).not.toBeNull();
    expect(document.querySelectorAll('.batch-tab-button')).toHaveLength(3);
  });

  it('returns to the overview (table browser) via the back button', async () => {
    (document.getElementById('db-batch-operations') as HTMLButtonElement).click();
    await flushPromises();

    const backBtn = document.getElementById('back-to-overview-from-batch-btn') as HTMLButtonElement;
    expect(backBtn).not.toBeNull();
    backBtn.click();
    await flushPromises();

    expect(document.querySelector('.batch-panel')).toBeNull();
    expect(document.getElementById('database-table-list')).not.toBeNull();
  });

  it('does not disturb the Backup view wiring (sibling #130 surface stays intact)', async () => {
    (document.getElementById('db-manage-backups') as HTMLButtonElement).click();
    await flushPromises();

    expect(document.getElementById('backup-manager-container')).not.toBeNull();
  });
});
