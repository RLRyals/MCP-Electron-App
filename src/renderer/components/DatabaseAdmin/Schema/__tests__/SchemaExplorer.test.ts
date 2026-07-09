/**
 * Tests for SchemaExplorer (Issue #129: Database Schema Explorer UI).
 *
 * SchemaExplorer existed as unwired scaffolding before this issue (see PR #200's
 * audit). These tests guard the fixes made to actually wire it up correctly:
 *
 *  - db_list_tables returns an array of table *objects*
 *    (`{ name, schema, type, column_count, size_human }`), not bare name
 *    strings -- the original scaffolding treated each entry as if it were
 *    already a string, so every per-table lookup broke silently.
 *  - The live database has real tables outside the "public" schema (e.g.
 *    "fictionlab"). The explorer must label/group tables by the schema the
 *    backend actually reports, never assume "public".
 *  - Record counts, search/filter, view-mode toggle, and schema caching
 *    (acceptance criteria from the issue).
 */

import { SchemaExplorer } from '../SchemaExplorer';
import { databaseService } from '../../../../services/databaseService';

jest.mock('../../../../services/databaseService', () => ({
  databaseService: {
    listTables: jest.fn(),
    getCount: jest.fn(),
    getSchema: jest.fn(),
    getRelationships: jest.fn(),
    queryRecords: jest.fn(),
  },
}));

const mockedDatabaseService = databaseService as jest.Mocked<typeof databaseService>;

/** A realistic db_list_tables response spanning both a "public" legacy table
 *  and a "fictionlab" (the real, actively-used schema) table. */
const LIST_TABLES_RESPONSE = {
  success: true,
  data: {
    success: true,
    count: 2,
    total_in_database: 2,
    tables: [
      {
        name: 'authors',
        schema: 'public',
        type: 'BASE TABLE',
        comment: null,
        column_count: 5,
        size_bytes: 8192,
        size_human: '8 KB',
        is_whitelisted: true,
      },
      {
        name: 'fictionlab.workflow_definitions',
        schema: 'fictionlab',
        type: 'BASE TABLE',
        comment: null,
        column_count: 12,
        size_bytes: 16384,
        size_human: '16 KB',
        is_whitelisted: true,
      },
    ],
  },
};

describe('SchemaExplorer', () => {
  let explorer: SchemaExplorer;

  beforeEach(() => {
    document.body.innerHTML = '<div id="schema-root"></div>';
    mockedDatabaseService.listTables.mockResolvedValue(LIST_TABLES_RESPONSE as any);
    mockedDatabaseService.getCount.mockImplementation(async (table: string) => {
      return table === 'authors' ? 42 : 7;
    });
    mockedDatabaseService.getSchema.mockResolvedValue({
      success: true,
      data: { table: 'authors', columns: [], constraints: {}, indexes: [] },
    } as any);
    // Real shape: db_get_relationships is scoped to ONE table and returns
    // { table, depth, parents, children } -- see RelationshipMapper.getRelationships
    // in MCP-Writing-Servers. There is no bulk "all relationships" tool.
    mockedDatabaseService.getRelationships.mockResolvedValue({
      success: true,
      data: {
        table: 'fictionlab.workflow_definitions',
        depth: 1,
        parents: [],
        children: [],
      },
    } as any);
    explorer = new SchemaExplorer();
  });

  afterEach(() => {
    explorer.destroy();
    document.body.innerHTML = '';
  });

  describe('loading tables', () => {
    it('displays all tables returned by the backend', async () => {
      await explorer.initialize('schema-root');

      const items = document.querySelectorAll('.table-list-item');
      expect(items).toHaveLength(2);
    });

    it('groups tables by their real database schema instead of assuming public', async () => {
      await explorer.initialize('schema-root');

      const badges = Array.from(document.querySelectorAll('.schema-group .schema-badge')).map(
        (el) => el.textContent
      );
      expect(badges.sort()).toEqual(['fictionlab', 'public']);
    });

    it('displays the short table name (without schema prefix) in the sidebar', async () => {
      await explorer.initialize('schema-root');

      const names = Array.from(document.querySelectorAll('.table-list-item .table-name')).map(
        (el) => el.textContent
      );
      expect(names).toContain('authors');
      expect(names).toContain('workflow_definitions');
      // The qualified prefix should not leak into the displayed short name.
      expect(names).not.toContain('fictionlab.workflow_definitions');
    });

    it('keeps the fully-qualified name in data-table so downstream lookups stay correct', async () => {
      await explorer.initialize('schema-root');

      const qualifiedItem = document.querySelector('[data-table="fictionlab.workflow_definitions"]');
      expect(qualifiedItem).not.toBeNull();
    });

    it('fetches and displays an accurate record count per table', async () => {
      await explorer.initialize('schema-root');

      expect(document.body.textContent).toContain('42 rows');
      expect(document.body.textContent).toContain('7 rows');
    });

    it('shows column counts and human-readable size from db_list_tables', async () => {
      await explorer.initialize('schema-root');

      expect(document.body.textContent).toContain('5 cols');
      expect(document.body.textContent).toContain('8 KB');
    });
  });

  describe('selecting a table', () => {
    it('requests the schema using the fully-qualified table name (not "[object Object]")', async () => {
      await explorer.initialize('schema-root');

      const item = document.querySelector('[data-table="fictionlab.workflow_definitions"]') as HTMLElement;
      item.click();
      await flushPromises();

      expect(mockedDatabaseService.getSchema).toHaveBeenCalledWith(
        expect.objectContaining({ table: 'fictionlab.workflow_definitions' })
      );
    });
  });

  describe('search/filter', () => {
    it('filters the visible tables by short name', async () => {
      await explorer.initialize('schema-root');

      const searchInput = document.getElementById('schema-search-input') as HTMLInputElement;
      searchInput.value = 'workflow';
      searchInput.dispatchEvent(new Event('input'));

      const items = document.querySelectorAll('.table-list-item');
      expect(items).toHaveLength(1);
      expect(items[0].getAttribute('data-table')).toBe('fictionlab.workflow_definitions');
    });

    it('filters by schema name so searching "fictionlab" surfaces that whole group', async () => {
      await explorer.initialize('schema-root');

      const searchInput = document.getElementById('schema-search-input') as HTMLInputElement;
      searchInput.value = 'fictionlab';
      searchInput.dispatchEvent(new Event('input'));

      const items = document.querySelectorAll('.table-list-item');
      expect(items).toHaveLength(1);
      expect(items[0].getAttribute('data-table')).toBe('fictionlab.workflow_definitions');
    });
  });

  describe('view mode toggle', () => {
    it('toggles the ERD panel active', async () => {
      await explorer.initialize('schema-root');

      const erdBtn = document.getElementById('view-erd') as HTMLElement;
      erdBtn.click();
      await flushPromises();

      expect(document.getElementById('view-erd')!.classList.contains('active')).toBe(true);
      expect(document.getElementById('schema-erd-panel')!.classList.contains('active')).toBe(true);
    });

    it('requests relationships scoped to the selected table (db_get_relationships takes no bulk mode)', async () => {
      await explorer.initialize('schema-root');

      const item = document.querySelector('[data-table="fictionlab.workflow_definitions"]') as HTMLElement;
      item.click();
      await flushPromises();

      const erdBtn = document.getElementById('view-erd') as HTMLElement;
      erdBtn.click();
      await flushPromises();

      expect(mockedDatabaseService.getRelationships).toHaveBeenCalledWith('fictionlab.workflow_definitions');
    });

    it('renders the focus table plus its related tables in the ERD, derived from parents/children', async () => {
      mockedDatabaseService.getRelationships.mockResolvedValueOnce({
        success: true,
        data: {
          table: 'fictionlab.workflow_definitions',
          depth: 1,
          parents: [{ column: 'created_by', references_table: 'authors', references_column: 'id' }],
          children: [],
        },
      } as any);

      await explorer.initialize('schema-root');

      const item = document.querySelector('[data-table="fictionlab.workflow_definitions"]') as HTMLElement;
      item.click();
      await flushPromises();

      const erdBtn = document.getElementById('view-erd') as HTMLElement;
      erdBtn.click();
      await flushPromises();

      const nodes = document.querySelectorAll('#schema-erd-panel .table-node');
      const nodeNames = Array.from(nodes).map((n) => n.getAttribute('data-table'));
      expect(nodeNames).toContain('fictionlab.workflow_definitions');
      expect(nodeNames).toContain('authors');
      expect(document.querySelector('#schema-erd-panel .relationship-line')).not.toBeNull();
    });
  });

  describe('caching', () => {
    it('does not re-fetch schema for an already-selected table', async () => {
      await explorer.initialize('schema-root');

      const item = document.querySelector('[data-table="authors"]') as HTMLElement;
      item.click();
      await flushPromises();
      item.click();
      await flushPromises();

      expect(mockedDatabaseService.getSchema).toHaveBeenCalledTimes(1);
    });

    it('reports cache stats reflecting the loaded tables', async () => {
      await explorer.initialize('schema-root');
      expect(explorer.getCacheStats().tableCount).toBe(2);
    });

    it('clears the cache on refresh and reloads tables', async () => {
      await explorer.initialize('schema-root');
      mockedDatabaseService.listTables.mockClear();

      const refreshBtn = document.getElementById('schema-refresh-btn') as HTMLElement;
      refreshBtn.click();
      await flushPromises();

      expect(mockedDatabaseService.listTables).toHaveBeenCalledTimes(1);
    });
  });
});

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
