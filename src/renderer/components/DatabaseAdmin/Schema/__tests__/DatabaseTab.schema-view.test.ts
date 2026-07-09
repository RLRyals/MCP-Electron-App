/**
 * Tests for the Schema Explorer's wiring into DatabaseTab (Issue #129).
 *
 * DatabaseTab.ts is a shared container that Issues #128 (batch ops) and
 * #130 (backup UI) also wire into; this file only covers the additive
 * "Schema" quick-action button this issue introduced (mirroring the
 * pre-existing "Backups" button/view pattern) so it doesn't collide with
 * those issues' own test coverage. The real SchemaExplorer is mocked here --
 * its own behavior is covered by SchemaExplorer.test.ts.
 */

import { DatabaseTab } from '../../../DatabaseTab';
import { SchemaExplorer } from '../SchemaExplorer';

jest.mock('../SchemaExplorer', () => ({
  SchemaExplorer: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
  })),
}));

const MockedSchemaExplorer = SchemaExplorer as unknown as jest.Mock;

describe('DatabaseTab -> Schema view wiring', () => {
  let tab: DatabaseTab;
  let mockInitialize: jest.Mock;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="database-card"></div>';
    (window as any).electronAPI = {
      databaseAdmin: {
        listTables: jest.fn().mockResolvedValue({ success: true, data: { tables: [] } }),
      },
    };
    MockedSchemaExplorer.mockClear();
    tab = new DatabaseTab();
    await tab.initialize();
    // DatabaseTab constructs its SchemaExplorer once in its own constructor
    // (called above, inside `new DatabaseTab()`); grab that instance's mock.
    mockInitialize = MockedSchemaExplorer.mock.results[0].value.initialize;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a Schema quick-action button on the overview', () => {
    expect(document.getElementById('db-view-schema')).not.toBeNull();
  });

  it('switches to the schema view and mounts the schema explorer container', async () => {
    (document.getElementById('db-view-schema') as HTMLElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById('schema-explorer-container')).not.toBeNull();
    expect(mockInitialize).toHaveBeenCalledWith('schema-explorer-container');
  });

  it('returns to the overview from the schema view via the back button', async () => {
    (document.getElementById('db-view-schema') as HTMLElement).click();
    await Promise.resolve();
    await Promise.resolve();

    const backBtn = document.getElementById('back-to-overview-from-schema-btn') as HTMLElement;
    expect(backBtn).not.toBeNull();
    backBtn.click();

    expect(document.getElementById('schema-explorer-container')).toBeNull();
    expect(document.getElementById('db-manage-backups')).not.toBeNull();
  });
});
