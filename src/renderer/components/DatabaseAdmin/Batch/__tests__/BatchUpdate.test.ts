/**
 * Tests for BatchUpdate (issue #128): where-condition selection, preview
 * before execution, and the confirm + execute flow against
 * databaseService.batchUpdate.
 */

import { BatchUpdate } from '../BatchUpdate';

interface MockDatabaseAdmin {
  listTables: jest.Mock;
  listColumns: jest.Mock;
  queryRecords: jest.Mock;
  batchUpdate: jest.Mock;
}

function makeMockAPI(): MockDatabaseAdmin {
  return {
    listTables: jest.fn().mockResolvedValue({ success: true, data: { tables: ['characters'] } }),
    listColumns: jest.fn().mockResolvedValue({ success: true, data: { columns: ['id', 'name', 'status'] } }),
    queryRecords: jest.fn().mockResolvedValue({
      success: true,
      data: { data: [{ id: 1, name: 'Ada', status: 'draft' }, { id: 2, name: 'Grace', status: 'draft' }], totalCount: 2 },
    }),
    batchUpdate: jest.fn().mockResolvedValue({ success: true }),
  };
}

const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('BatchUpdate', () => {
  let container: HTMLElement;
  let api: MockDatabaseAdmin;

  beforeEach(() => {
    api = makeMockAPI();
    (window as any).electronAPI = { databaseAdmin: api };

    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'batch-update-test-container';
    document.body.appendChild(container);
  });

  function makeUpdate(options: ConstructorParameters<typeof BatchUpdate>[1] = {}) {
    const update = new BatchUpdate('batch-update-test-container', options);
    update.render();
    return update;
  }

  async function selectTable(tableName = 'characters'): Promise<void> {
    await flushPromises();
    const select = document.getElementById('batch-update-table') as HTMLSelectElement;
    select.value = tableName;
    select.dispatchEvent(new Event('change'));
    await flushPromises();
  }

  function addWhereRow(column: string, value: string): void {
    (document.getElementById('add-where-condition') as HTMLButtonElement).click();
    const row = document.querySelector('#where-conditions-list .condition-row') as HTMLElement;
    (row.querySelector('.condition-column') as HTMLSelectElement).value = column;
    (row.querySelector('.condition-value') as HTMLInputElement).value = value;
  }

  function addFieldRow(column: string, value: string): void {
    (document.getElementById('add-update-field') as HTMLButtonElement).click();
    const row = document.querySelector('#update-fields-list .update-field-row') as HTMLElement;
    (row.querySelector('.update-field-column') as HTMLSelectElement).value = column;
    (row.querySelector('.update-field-value') as HTMLInputElement).value = value;
  }

  it('loads tables and, once one is selected, its columns', async () => {
    makeUpdate();
    await selectTable();

    expect(api.listTables).toHaveBeenCalledTimes(1);
    expect(api.listColumns).toHaveBeenCalledWith({ table: 'characters' });
  });

  it('previews the matching selection (record count + rows) before any update runs', async () => {
    makeUpdate();
    await selectTable();

    addWhereRow('status', 'draft');
    (document.getElementById('preview-selection') as HTMLButtonElement).click();
    await flushPromises();

    expect(api.queryRecords).toHaveBeenCalledWith(expect.objectContaining({
      table: 'characters',
      where: { status: 'draft' },
    }));

    const previewDiv = document.getElementById('selection-preview')!;
    expect(previewDiv.innerHTML).toMatch(/selected 2 record/i);
  });

  it('keeps the execute button disabled until a changes preview has been generated', async () => {
    makeUpdate();
    await selectTable();
    addWhereRow('status', 'draft');
    (document.getElementById('preview-selection') as HTMLButtonElement).click();
    await flushPromises();

    const executeBtn = document.getElementById('batch-update-execute') as HTMLButtonElement;
    expect(executeBtn.disabled).toBe(true);

    addFieldRow('status', 'published');
    (document.getElementById('preview-changes') as HTMLButtonElement).click();

    expect(executeBtn.disabled).toBe(false);
    const changesPreview = document.getElementById('changes-preview')!;
    expect(changesPreview.innerHTML).toMatch(/will update 2 record/i);
  });

  it('asks for confirmation naming the record count, then calls batchUpdate on confirm', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const onComplete = jest.fn();
    makeUpdate({ onComplete });
    await selectTable();

    addWhereRow('status', 'draft');
    (document.getElementById('preview-selection') as HTMLButtonElement).click();
    await flushPromises();

    addFieldRow('status', 'published');
    (document.getElementById('preview-changes') as HTMLButtonElement).click();

    (document.getElementById('batch-update-execute') as HTMLButtonElement).click();
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('2 record'));
    expect(api.batchUpdate).toHaveBeenCalledWith({
      table: 'characters',
      updates: [{ where: { status: 'draft' }, data: { status: 'published' } }],
    });
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ success: true, updated: 2 }));

    confirmSpy.mockRestore();
  });

  it('does not call batchUpdate if the user cancels the confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    makeUpdate();
    await selectTable();

    addWhereRow('status', 'draft');
    (document.getElementById('preview-selection') as HTMLButtonElement).click();
    await flushPromises();
    addFieldRow('status', 'published');
    (document.getElementById('preview-changes') as HTMLButtonElement).click();

    (document.getElementById('batch-update-execute') as HTMLButtonElement).click();
    await flushPromises();

    expect(api.batchUpdate).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
