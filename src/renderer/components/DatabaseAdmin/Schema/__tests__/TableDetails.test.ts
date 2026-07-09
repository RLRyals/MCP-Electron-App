/**
 * Tests for TableDetails (Issue #129: Database Schema Explorer UI).
 *
 * Covers the acceptance criteria this component is responsible for: column
 * list with types/constraints, primary/foreign keys highlighted, indexes,
 * and a sample data preview -- plus the schema-accuracy fix: the header
 * must label a table with its *real* database schema (e.g. "fictionlab"),
 * never assume "public".
 */

import { TableDetails } from '../TableDetails';
import { databaseService } from '../../../../services/databaseService';

jest.mock('../../../../services/databaseService', () => ({
  databaseService: {
    queryRecords: jest.fn(),
  },
}));

const mockedDatabaseService = databaseService as jest.Mocked<typeof databaseService>;

/**
 * Shaped exactly like a real db_get_schema response (see
 * MCP-Writing-Servers/src/mcps/database-admin-server/handlers/schema-handlers.js
 * handleGetSchema/_groupConstraints): column objects carry no PK/FK flags at
 * all -- that lives only in the grouped `constraints` object. Using the real
 * shape here (rather than an idealized one) is what caught the
 * "constraints is not iterable" crash in the original scaffolding.
 */
const SAMPLE_SCHEMA = {
  table: 'fictionlab.workflow_definitions',
  columns: [
    { name: 'workflow_id', type: 'uuid', nullable: false, default: null },
    { name: 'name', type: 'character varying', nullable: false, default: null },
    { name: 'created_by', type: 'uuid', nullable: true, default: null },
  ],
  constraints: {
    primary_key: [{ name: 'workflow_definitions_pkey', column: 'workflow_id' }],
    foreign_key: [{ name: 'workflow_definitions_created_by_fkey', column: 'created_by' }],
    unique: [],
    check: [],
  },
  indexes: [{ name: 'workflow_definitions_pkey', columns: ['workflow_id'], unique: true }],
};

describe('TableDetails', () => {
  let details: TableDetails;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="details-root"></div>';
    mockedDatabaseService.queryRecords.mockResolvedValue({
      success: true,
      data: { data: [{ workflow_id: '1', name: 'demo', created_by: null }] },
    } as any);
    details = new TableDetails();
    await details.initialize('details-root');
  });

  afterEach(() => {
    details.destroy();
    document.body.innerHTML = '';
  });

  it('shows an empty state before a table is selected', () => {
    expect(document.querySelector('.table-details-empty')).not.toBeNull();
  });

  describe('after displaying a schema-qualified table', () => {
    beforeEach(async () => {
      await details.displayTable('fictionlab.workflow_definitions', SAMPLE_SCHEMA);
    });

    it('labels the header with the real schema, not "public"', () => {
      const badge = document.querySelector('.table-details-header .schema-badge');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('fictionlab');
      expect(badge!.className).toContain('schema-badge-fictionlab');
    });

    it('shows only the short table name in the title', () => {
      const heading = document.querySelector('.table-details-header h4');
      expect(heading!.textContent).toBe('workflow_definitions');
    });

    it('renders columns with primary/foreign key badges resolved from grouped constraints', () => {
      const rows = document.querySelectorAll('.tab-content[data-tab="columns"] tbody tr');
      expect(rows).toHaveLength(3);
      expect(document.querySelector('.badge-primary')!.textContent).toBe('PRIMARY KEY');
      expect(document.querySelector('.badge-info')!.textContent).toBe('FOREIGN KEY');
    });

    it('lists primary/foreign keys in the Keys tab without crashing on the grouped constraints shape', () => {
      const keysBtn = document.querySelector('[data-tab="keys"]') as HTMLElement;
      keysBtn.click();

      const keysContent = document.querySelector('.tab-content[data-tab="keys"]')!;
      expect(keysContent.textContent).toContain('workflow_id');
      expect(keysContent.textContent).toContain('created_by');
    });

    it('reports honestly when the server does not provide an FK reference target, rather than inventing one', () => {
      const keysBtn = document.querySelector('[data-tab="keys"]') as HTMLElement;
      keysBtn.click();

      const keysContent = document.querySelector('.tab-content[data-tab="keys"]')!;
      expect(keysContent.textContent).toContain('(target not reported by server)');
      expect(keysContent.textContent).not.toContain('?.?');
    });

    it('renders the sample data preview', () => {
      const sampleTab = document.querySelector('.tab-content[data-tab="sample-data"]')!;
      expect(sampleTab.textContent).toContain('demo');
    });

    it('switches tabs on click', () => {
      const keysBtn = document.querySelector('[data-tab="keys"]') as HTMLElement;
      keysBtn.click();

      const keysContent = document.querySelector('.tab-content[data-tab="keys"]') as HTMLElement;
      const columnsContent = document.querySelector('.tab-content[data-tab="columns"]') as HTMLElement;
      expect(keysContent.style.display).toBe('block');
      expect(columnsContent.style.display).toBe('none');
    });
  });

  describe('a bare (unqualified) table name', () => {
    it('labels the header as "public"', async () => {
      await details.displayTable('authors', { ...SAMPLE_SCHEMA, table: 'authors' });

      const badge = document.querySelector('.table-details-header .schema-badge');
      expect(badge!.textContent).toBe('public');
    });
  });
});
