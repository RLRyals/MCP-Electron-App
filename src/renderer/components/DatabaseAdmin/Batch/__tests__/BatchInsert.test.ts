/**
 * Tests for BatchInsert (issue #128): table/column loading, JSON-paste mode,
 * the configurable batch-size input, chunked execution against
 * databaseService.batchInsert, and the acceptance criteria from the issue:
 *   - Can insert 100+ records successfully
 *   - Progress indicator shows status
 *   - Error handling per row
 *   - Transaction rollback on error (a failed batch call fails ALL rows in
 *     that batch -- no partial credit, since the server-side call is
 *     transactional).
 */

import { BatchInsert } from '../BatchInsert';

interface MockDatabaseAdmin {
  listTables: jest.Mock;
  listColumns: jest.Mock;
  batchInsert: jest.Mock;
}

function makeMockAPI(): MockDatabaseAdmin {
  return {
    listTables: jest.fn().mockResolvedValue({ success: true, data: { tables: ['characters', 'scenes'] } }),
    listColumns: jest.fn().mockResolvedValue({ success: true, data: { columns: ['id', 'name', 'age'] } }),
    batchInsert: jest.fn().mockResolvedValue({ success: true }),
  };
}

const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('BatchInsert', () => {
  let container: HTMLElement;
  let api: MockDatabaseAdmin;

  beforeEach(() => {
    api = makeMockAPI();
    (window as any).electronAPI = { databaseAdmin: api };

    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'batch-insert-test-container';
    document.body.appendChild(container);
  });

  function makeInsert(options: ConstructorParameters<typeof BatchInsert>[1] = {}) {
    const insert = new BatchInsert('batch-insert-test-container', options);
    insert.render();
    return insert;
  }

  async function selectTable(tableName = 'characters'): Promise<void> {
    await flushPromises(); // let loadTables() resolve
    const select = document.getElementById('batch-insert-table') as HTMLSelectElement;
    select.value = tableName;
    select.dispatchEvent(new Event('change'));
    await flushPromises(); // let listColumns() resolve
  }

  it('loads tables into the selector on render', async () => {
    makeInsert();
    await flushPromises();

    expect(api.listTables).toHaveBeenCalledTimes(1);
    const select = document.getElementById('batch-insert-table') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map(o => o.value);
    expect(optionValues).toEqual(['', 'characters', 'scenes']);
  });

  it('loads columns for the selected table', async () => {
    makeInsert();
    await selectTable('characters');

    expect(api.listColumns).toHaveBeenCalledWith({ table: 'characters' });
  });

  it('parses a JSON array pasted into the JSON mode textarea', async () => {
    makeInsert();
    await selectTable();

    // Switch to JSON mode
    const jsonModeBtn = document.querySelector('[data-mode="json"]') as HTMLButtonElement;
    jsonModeBtn.click();

    const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
    textarea.value = JSON.stringify([{ name: 'Ada' }, { name: 'Grace' }]);

    const parseBtn = document.getElementById('json-parse-button') as HTMLButtonElement;
    parseBtn.click();

    const resultDiv = document.getElementById('json-parse-result')!;
    expect(resultDiv.innerHTML).toMatch(/successfully parsed 2 records/i);

    const executeBtn = document.getElementById('batch-insert-execute') as HTMLButtonElement;
    expect(executeBtn.disabled).toBe(false);
  });

  it('respects the batch-size input, chunking 250 records into 100/100/50', async () => {
    makeInsert({ batchSize: 100 });
    await selectTable();

    const jsonModeBtn = document.querySelector('[data-mode="json"]') as HTMLButtonElement;
    jsonModeBtn.click();

    const records = Array.from({ length: 250 }, (_, i) => ({ name: `Row ${i}` }));
    const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
    textarea.value = JSON.stringify(records);
    (document.getElementById('json-parse-button') as HTMLButtonElement).click();

    (document.getElementById('batch-insert-execute') as HTMLButtonElement).click();
    await flushPromises();
    await flushPromises();

    expect(api.batchInsert).toHaveBeenCalledTimes(3);
    expect(api.batchInsert.mock.calls[0][0].records).toHaveLength(100);
    expect(api.batchInsert.mock.calls[1][0].records).toHaveLength(100);
    expect(api.batchInsert.mock.calls[2][0].records).toHaveLength(50);
  });

  it('can insert 100+ records successfully and reports the final count via onComplete', async () => {
    const onComplete = jest.fn();
    makeInsert({ onComplete });
    await selectTable();

    const jsonModeBtn = document.querySelector('[data-mode="json"]') as HTMLButtonElement;
    jsonModeBtn.click();

    const records = Array.from({ length: 150 }, (_, i) => ({ name: `Row ${i}` }));
    const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
    textarea.value = JSON.stringify(records);
    (document.getElementById('json-parse-button') as HTMLButtonElement).click();
    (document.getElementById('batch-insert-execute') as HTMLButtonElement).click();

    await flushPromises();
    await flushPromises();

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      inserted: 150,
      failed: 0,
      totalProcessed: 150,
    }));
  });

  it('reports progress via onProgress as batches are processed', async () => {
    const onProgress = jest.fn();
    makeInsert({ onProgress, batchSize: 50 });
    await selectTable();

    const jsonModeBtn = document.querySelector('[data-mode="json"]') as HTMLButtonElement;
    jsonModeBtn.click();
    const records = Array.from({ length: 100 }, (_, i) => ({ name: `Row ${i}` }));
    const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
    textarea.value = JSON.stringify(records);
    (document.getElementById('json-parse-button') as HTMLButtonElement).click();
    (document.getElementById('batch-insert-execute') as HTMLButtonElement).click();

    await flushPromises();
    await flushPromises();

    expect(onProgress).toHaveBeenCalledWith(0, 100);
    expect(onProgress).toHaveBeenCalledWith(50, 100);

    const progressText = document.getElementById('progress-text')!;
    expect(progressText.textContent).toBe('100 / 100');
  });

  it('handles per-row errors without partial credit when a batch call fails (transaction rollback)', async () => {
    api.batchInsert
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'constraint violation' });

    const onComplete = jest.fn();
    makeInsert({ onComplete, batchSize: 50 });
    await selectTable();

    const jsonModeBtn = document.querySelector('[data-mode="json"]') as HTMLButtonElement;
    jsonModeBtn.click();
    const records = Array.from({ length: 100 }, (_, i) => ({ name: `Row ${i}` }));
    const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
    textarea.value = JSON.stringify(records);
    (document.getElementById('json-parse-button') as HTMLButtonElement).click();
    (document.getElementById('batch-insert-execute') as HTMLButtonElement).click();

    await flushPromises();
    await flushPromises();

    const result = onComplete.mock.calls[0][0];
    expect(result.success).toBe(false);
    expect(result.inserted).toBe(50); // first batch succeeded
    expect(result.failed).toBe(50); // second batch failed entirely -- no partial rows
    expect(result.errors).toHaveLength(50);
    expect(result.errors[0].error).toBe('constraint violation');
  });

  it('applies column mapping before inserting', async () => {
    makeInsert();
    await selectTable(); // columns: id, name, age

    const jsonModeBtn = document.querySelector('[data-mode="json"]') as HTMLButtonElement;
    jsonModeBtn.click();
    const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
    textarea.value = JSON.stringify([{ full_name: 'Ada', years: 30 }]);
    (document.getElementById('json-parse-button') as HTMLButtonElement).click();

    // Map full_name -> name, years -> age
    const nameMapSelect = document.querySelector('[data-source="full_name"]') as HTMLSelectElement;
    nameMapSelect.value = 'name';
    nameMapSelect.dispatchEvent(new Event('change'));

    const yearsMapSelect = document.querySelector('[data-source="years"]') as HTMLSelectElement;
    yearsMapSelect.value = 'age';
    yearsMapSelect.dispatchEvent(new Event('change'));

    (document.getElementById('batch-insert-execute') as HTMLButtonElement).click();
    await flushPromises();

    expect(api.batchInsert).toHaveBeenCalledWith(expect.objectContaining({
      table: 'characters',
      records: [{ name: 'Ada', age: 30 }],
    }));
  });

  it('the batch-size input overrides the constructor default', async () => {
    makeInsert({ batchSize: 100 });
    await selectTable();

    const batchSizeInput = document.getElementById('batch-insert-batch-size') as HTMLInputElement;
    batchSizeInput.value = '10';

    const jsonModeBtn = document.querySelector('[data-mode="json"]') as HTMLButtonElement;
    jsonModeBtn.click();
    const records = Array.from({ length: 25 }, (_, i) => ({ name: `Row ${i}` }));
    const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
    textarea.value = JSON.stringify(records);
    (document.getElementById('json-parse-button') as HTMLButtonElement).click();
    (document.getElementById('batch-insert-execute') as HTMLButtonElement).click();

    await flushPromises();
    await flushPromises();

    // 25 records / batch size 10 = 3 calls (10, 10, 5)
    expect(api.batchInsert).toHaveBeenCalledTimes(3);
  });
});
