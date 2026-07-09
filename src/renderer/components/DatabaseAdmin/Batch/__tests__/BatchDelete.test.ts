/**
 * Tests for BatchDelete (issue #128): filter-based selection, preview of
 * affected records before deleting, confirmation naming the exact record
 * count, and transaction-rollback semantics on failure (no partial delete
 * is ever reported).
 */

import { BatchDelete } from '../BatchDelete';

interface MockDatabaseAdmin {
  listTables: jest.Mock;
  listColumns: jest.Mock;
  queryRecords: jest.Mock;
  batchDelete: jest.Mock;
}

function makeMockAPI(): MockDatabaseAdmin {
  return {
    listTables: jest.fn().mockResolvedValue({ success: true, data: { tables: ['characters'] } }),
    listColumns: jest.fn().mockResolvedValue({ success: true, data: { columns: ['id', 'name', 'status'] } }),
    queryRecords: jest.fn().mockResolvedValue({
      success: true,
      data: { data: [{ id: 1, name: 'Ada', status: 'archived' }], totalCount: 12 },
    }),
    batchDelete: jest.fn().mockResolvedValue({ success: true }),
  };
}

const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('BatchDelete', () => {
  let container: HTMLElement;
  let api: MockDatabaseAdmin;

  beforeEach(() => {
    api = makeMockAPI();
    (window as any).electronAPI = { databaseAdmin: api };

    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'batch-delete-test-container';
    document.body.appendChild(container);
  });

  function makeDelete(options: ConstructorParameters<typeof BatchDelete>[1] = {}) {
    const del = new BatchDelete('batch-delete-test-container', options);
    del.render();
    return del;
  }

  async function selectTable(tableName = 'characters'): Promise<void> {
    await flushPromises();
    const select = document.getElementById('batch-delete-table') as HTMLSelectElement;
    select.value = tableName;
    select.dispatchEvent(new Event('change'));
    await flushPromises();
  }

  function addWhereRow(column: string, value: string): void {
    (document.getElementById('add-delete-where-condition') as HTMLButtonElement).click();
    const row = document.querySelector('#delete-where-conditions-list .condition-row') as HTMLElement;
    (row.querySelector('.condition-column') as HTMLSelectElement).value = column;
    (row.querySelector('.condition-value') as HTMLInputElement).value = value;
  }

  it('keeps the delete button disabled until the affected records have been previewed', async () => {
    makeDelete();
    await selectTable();

    const executeBtn = document.getElementById('batch-delete-execute') as HTMLButtonElement;
    expect(executeBtn.disabled).toBe(true);

    addWhereRow('status', 'archived');
    (document.getElementById('preview-delete-selection') as HTMLButtonElement).click();
    await flushPromises();

    expect(executeBtn.disabled).toBe(false);
  });

  it('previews affected records showing the exact total count', async () => {
    makeDelete();
    await selectTable();
    addWhereRow('status', 'archived');
    (document.getElementById('preview-delete-selection') as HTMLButtonElement).click();
    await flushPromises();

    expect(api.queryRecords).toHaveBeenCalledWith(expect.objectContaining({
      table: 'characters',
      where: { status: 'archived' },
    }));

    const previewDiv = document.getElementById('delete-selection-preview')!;
    expect(previewDiv.innerHTML).toMatch(/12 record\(s\) will be deleted/i);
  });

  it('invalidates the preview (and re-disables execute) when a condition changes after previewing', async () => {
    makeDelete();
    await selectTable();
    addWhereRow('status', 'archived');
    (document.getElementById('preview-delete-selection') as HTMLButtonElement).click();
    await flushPromises();

    const executeBtn = document.getElementById('batch-delete-execute') as HTMLButtonElement;
    expect(executeBtn.disabled).toBe(false);

    const valueInput = document.querySelector('#delete-where-conditions-list .condition-value') as HTMLInputElement;
    valueInput.value = 'different';
    valueInput.dispatchEvent(new Event('input'));

    expect(executeBtn.disabled).toBe(true);
  });

  it('confirms naming the exact record count, then calls batchDelete on confirm', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const onComplete = jest.fn();
    makeDelete({ onComplete });
    await selectTable();

    addWhereRow('status', 'archived');
    (document.getElementById('preview-delete-selection') as HTMLButtonElement).click();
    await flushPromises();

    (document.getElementById('batch-delete-execute') as HTMLButtonElement).click();
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('12 record(s)'));
    expect(api.batchDelete).toHaveBeenCalledWith({
      table: 'characters',
      conditions: [{ status: 'archived' }],
    });
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      deleted: 12,
      failed: 0,
      totalProcessed: 12,
    }));

    confirmSpy.mockRestore();
  });

  it('does not call batchDelete if the user cancels the confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    makeDelete();
    await selectTable();
    addWhereRow('status', 'archived');
    (document.getElementById('preview-delete-selection') as HTMLButtonElement).click();
    await flushPromises();

    (document.getElementById('batch-delete-execute') as HTMLButtonElement).click();
    await flushPromises();

    expect(api.batchDelete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('reports zero partial deletes and a rollback message when the server call fails (transaction rollback)', async () => {
    api.batchDelete.mockResolvedValueOnce({ success: false, error: 'foreign key violation' });
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const onComplete = jest.fn();
    makeDelete({ onComplete });
    await selectTable();

    addWhereRow('status', 'archived');
    (document.getElementById('preview-delete-selection') as HTMLButtonElement).click();
    await flushPromises();

    (document.getElementById('batch-delete-execute') as HTMLButtonElement).click();
    await flushPromises();

    const result = onComplete.mock.calls[0][0];
    expect(result.success).toBe(false);
    expect(result.deleted).toBe(0); // no partial credit
    expect(result.failed).toBe(12);
    expect(result.errors[0].error).toMatch(/foreign key violation.*rolled back/i);

    const resultsDiv = document.getElementById('batch-delete-results')!;
    expect(resultsDiv.innerHTML).toMatch(/delete failed/i);
  });

  it('surfaces a rejected promise (network error) with the same rollback semantics', async () => {
    api.batchDelete.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const onError = jest.fn();
    const onComplete = jest.fn();
    makeDelete({ onComplete, onError });
    await selectTable();

    addWhereRow('status', 'archived');
    (document.getElementById('preview-delete-selection') as HTMLButtonElement).click();
    await flushPromises();

    (document.getElementById('batch-delete-execute') as HTMLButtonElement).click();
    await flushPromises();

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
    // onComplete is not called on the thrown-exception path -- only onError.
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('requires a preview before allowing execute even if clicked directly', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    makeDelete();
    await selectTable();
    addWhereRow('status', 'archived');

    // Never click preview -- execute button stays disabled, but exercise the
    // guard directly in case a caller enables it programmatically.
    const executeBtn = document.getElementById('batch-delete-execute') as HTMLButtonElement;
    executeBtn.disabled = false;
    executeBtn.click();
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/preview the affected records/i));
    expect(api.batchDelete).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
