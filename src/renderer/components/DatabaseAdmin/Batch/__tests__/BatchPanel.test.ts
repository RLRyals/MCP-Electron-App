/**
 * Tests for BatchPanel (issue #128): the tabbed container wiring
 * BatchInsert / BatchUpdate / BatchDelete together, as mounted by
 * DatabaseTab's "Batch Ops" quick action.
 */

import { BatchPanel } from '../BatchPanel';

function makeMockAPI() {
  return {
    listTables: jest.fn().mockResolvedValue({ success: true, data: { tables: ['characters'] } }),
    listColumns: jest.fn().mockResolvedValue({ success: true, data: { columns: ['id', 'name'] } }),
    queryRecords: jest.fn().mockResolvedValue({ success: true, data: { data: [], totalCount: 0 } }),
    batchInsert: jest.fn().mockResolvedValue({ success: true }),
    batchUpdate: jest.fn().mockResolvedValue({ success: true }),
    batchDelete: jest.fn().mockResolvedValue({ success: true }),
  };
}

const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('BatchPanel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    (window as any).electronAPI = { databaseAdmin: makeMockAPI() };
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders three tabs with Bulk Insert active by default', () => {
    const panel = new BatchPanel();
    panel.initialize(container);

    const buttons = Array.from(container.querySelectorAll('.batch-tab-button')) as HTMLButtonElement[];
    expect(buttons.map(b => b.getAttribute('data-tab'))).toEqual(['insert', 'update', 'delete']);
    expect(buttons[0].classList.contains('active')).toBe(true);

    // The insert sub-component should have mounted its own DOM into the
    // insert tab's container (proves BatchInsert.render() actually ran).
    expect(document.getElementById('batch-insert-table')).not.toBeNull();
  });

  it('lazily mounts BatchUpdate only when its tab is first activated', async () => {
    const panel = new BatchPanel();
    panel.initialize(container);

    expect(document.getElementById('batch-update-table')).toBeNull();

    const updateTab = container.querySelector('[data-tab="update"]') as HTMLButtonElement;
    updateTab.click();
    await flushPromises();

    expect(document.getElementById('batch-update-table')).not.toBeNull();
    expect(updateTab.classList.contains('active')).toBe(true);
    expect(container.querySelector('[data-tab="insert"]')!.classList.contains('active')).toBe(false);
  });

  it('lazily mounts BatchDelete only when its tab is first activated', async () => {
    const panel = new BatchPanel();
    panel.initialize(container);

    const deleteTab = container.querySelector('[data-tab="delete"]') as HTMLButtonElement;
    deleteTab.click();
    await flushPromises();

    expect(document.getElementById('batch-delete-table')).not.toBeNull();
  });

  it('only shows the active tab content panel', async () => {
    const panel = new BatchPanel();
    panel.initialize(container);

    const deleteTab = container.querySelector('[data-tab="delete"]') as HTMLButtonElement;
    deleteTab.click();
    await flushPromises();

    expect(document.getElementById('batch-panel-insert')!.classList.contains('active')).toBe(false);
    expect(document.getElementById('batch-panel-update')!.classList.contains('active')).toBe(false);
    expect(document.getElementById('batch-panel-delete')!.classList.contains('active')).toBe(true);
  });

  it('surfaces sub-component completion messages via onStatusChange', async () => {
    const onStatusChange = jest.fn();
    const panel = new BatchPanel({ onStatusChange });
    panel.initialize(container);
    await flushPromises();

    // Drive BatchInsert to a JSON-mode insert and confirm the panel-level
    // status line reflects its onComplete callback.
    const jsonModeBtn = document.querySelector('[data-mode="json"]') as HTMLButtonElement;
    jsonModeBtn.click();
    const select = document.getElementById('batch-insert-table') as HTMLSelectElement;
    select.value = 'characters';
    select.dispatchEvent(new Event('change'));
    await flushPromises();

    const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
    textarea.value = JSON.stringify([{ name: 'Ada' }]);
    (document.getElementById('json-parse-button') as HTMLButtonElement).click();
    (document.getElementById('batch-insert-execute') as HTMLButtonElement).click();
    await flushPromises();
    await flushPromises();

    expect(onStatusChange).toHaveBeenCalledWith(
      expect.stringMatching(/inserted 1 record/i),
      'success'
    );

    const statusEl = document.getElementById('batch-panel-status')!;
    expect(statusEl.textContent).toMatch(/inserted 1 record/i);
    expect(statusEl.className).toContain('success');
  });

  it('destroy() releases sub-component references without throwing', () => {
    const panel = new BatchPanel();
    panel.initialize(container);
    expect(() => panel.destroy()).not.toThrow();
  });
});
