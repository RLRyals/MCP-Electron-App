/**
 * SchemaExplorer Component
 * Main container for database schema exploration
 *
 * Features:
 * - Table list with search/filter
 * - Schema caching for performance
 * - Integration with TableDetails and RelationshipDiagram
 * - Record counts and metadata display
 */

import { databaseService, DatabaseOperationResult } from '../../../services/databaseService.js';
import { TableDetails } from './TableDetails.js';
import { RelationshipDiagram } from './RelationshipDiagram.js';
import { parseQualifiedTableName } from './schema-utils.js';

export { parseQualifiedTableName };

export interface TableMetadata {
  /** Table name as returned by the backend -- schema-qualified for non-public
   *  schemas (e.g. "fictionlab.workflow_definitions"), bare for public (e.g. "authors"). */
  name: string;
  /** Actual Postgres schema this table lives in ("public", "fictionlab", ...).
   *  Always read from the backend -- never assumed. */
  dbSchema: string;
  tableType?: string;
  comment?: string | null;
  recordCount?: number;
  columnCount?: number;
  sizeHuman?: string;
  lastUpdated?: string;
  /** Detailed schema info (columns/constraints/indexes) from db_get_schema, lazily loaded + cached. */
  schema?: any;
  relationships?: any[];
}

export interface SchemaCache {
  tables: Map<string, TableMetadata>;
  /** db_get_relationships is scoped to a single table (returns that table's
   *  parents/children) -- there is no bulk "every relationship" tool -- so
   *  the cache is keyed per table rather than holding one flat list. */
  relationshipsByTable: Map<string, any[]>;
  lastRefresh: Date;
}

export type ViewMode = 'table-details' | 'erd';

export class SchemaExplorer {
  private container: HTMLElement | null = null;
  private tableDetails: TableDetails | null = null;
  private relationshipDiagram: RelationshipDiagram | null = null;
  private cache: SchemaCache;
  private searchTerm: string = '';
  private selectedTable: string | null = null;
  private viewMode: ViewMode = 'table-details';
  private isLoading: boolean = false;

  constructor() {
    this.cache = {
      tables: new Map(),
      relationshipsByTable: new Map(),
      lastRefresh: new Date(),
    };
  }

  /**
   * Initialize the schema explorer
   */
  public async initialize(containerId: string): Promise<void> {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    // Render the structure
    this.render();

    // Initialize sub-components
    this.tableDetails = new TableDetails();
    await this.tableDetails.initialize('schema-table-details-panel');

    this.relationshipDiagram = new RelationshipDiagram();
    await this.relationshipDiagram.initialize('schema-erd-panel');

    // Attach event listeners
    this.attachEventListeners();

    // Load initial data
    await this.loadTables();

    console.log('SchemaExplorer initialized');
  }

  /**
   * Render the schema explorer structure
   */
  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="schema-explorer">
        ${this.renderHeader()}
        <div class="schema-content">
          ${this.renderSidebar()}
          ${this.renderMainPanel()}
        </div>
      </div>
    `;
  }

  /**
   * Render header with view mode toggle
   */
  private renderHeader(): string {
    return `
      <div class="schema-header">
        <h3>Database Schema Explorer</h3>
        <div class="schema-actions">
          <button id="schema-refresh-btn" class="action-button secondary" title="Refresh schema">
            Refresh
          </button>
          <div class="view-mode-toggle">
            <button id="view-table-details" class="view-toggle-btn ${this.viewMode === 'table-details' ? 'active' : ''}" title="Table Details View">
              Table View
            </button>
            <button id="view-erd" class="view-toggle-btn ${this.viewMode === 'erd' ? 'active' : ''}" title="Entity-Relationship Diagram">
              ERD
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render sidebar with table list
   */
  private renderSidebar(): string {
    return `
      <div class="schema-sidebar">
        <div class="table-search">
          <input
            type="text"
            id="schema-search-input"
            class="search-input"
            placeholder="Search tables..."
            value="${this.escapeHtml(this.searchTerm)}"
          />
        </div>
        <div class="table-list" id="schema-table-list">
          ${this.renderTableList()}
        </div>
      </div>
    `;
  }

  /**
   * Render table list items, grouped by their actual database schema.
   *
   * The MCP database-admin server backs onto a Postgres instance with more
   * than one schema in active use (e.g. "fictionlab" alongside the legacy
   * "public" schema). db_list_tables reports each table's real schema --
   * we group and label by that reported value rather than assuming every
   * table lives in "public".
   */
  private renderTableList(): string {
    if (this.isLoading) {
      return '<div class="loading-message">Loading tables...</div>';
    }

    const tables = Array.from(this.cache.tables.values());

    if (tables.length === 0) {
      return '<div class="empty-message">No tables found</div>';
    }

    const filtered = this.filterTables(tables);

    if (filtered.length === 0) {
      return '<div class="empty-message">No tables match search</div>';
    }

    // Group by the schema the backend actually reported for each table.
    const bySchema = new Map<string, TableMetadata[]>();
    for (const table of filtered) {
      const group = bySchema.get(table.dbSchema) || [];
      group.push(table);
      bySchema.set(table.dbSchema, group);
    }

    const schemaNames = Array.from(bySchema.keys()).sort();

    return schemaNames.map(schemaName => `
      <div class="schema-group" data-schema="${this.escapeHtml(schemaName)}">
        <div class="schema-group-header">
          <span class="schema-badge schema-badge-${this.escapeHtml(schemaName)}">${this.escapeHtml(schemaName)}</span>
          <span class="schema-group-count">${bySchema.get(schemaName)!.length} table${bySchema.get(schemaName)!.length === 1 ? '' : 's'}</span>
        </div>
        ${bySchema.get(schemaName)!.map(table => this.renderTableListItem(table)).join('')}
      </div>
    `).join('');
  }

  /**
   * Render a single table's sidebar entry
   */
  private renderTableListItem(table: TableMetadata): string {
    const { shortName } = parseQualifiedTableName(table.name);

    return `
      <div class="table-list-item ${this.selectedTable === table.name ? 'selected' : ''}"
           data-table="${this.escapeHtml(table.name)}">
        <div class="table-item-header">
          <span class="table-icon">📊</span>
          <span class="table-name">${this.escapeHtml(shortName)}</span>
        </div>
        <div class="table-item-meta">
          ${table.recordCount !== undefined ? `<span class="record-count">${table.recordCount} rows</span>` : ''}
          ${table.columnCount !== undefined ? `<span class="column-count">${table.columnCount} cols</span>` : ''}
          ${table.sizeHuman ? `<span class="table-size">${this.escapeHtml(table.sizeHuman)}</span>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render main panel
   */
  private renderMainPanel(): string {
    return `
      <div class="schema-main-panel">
        <div id="schema-table-details-panel" class="schema-panel ${this.viewMode === 'table-details' ? 'active' : ''}">
          <!-- TableDetails component will render here -->
        </div>
        <div id="schema-erd-panel" class="schema-panel ${this.viewMode === 'erd' ? 'active' : ''}">
          <!-- RelationshipDiagram component will render here -->
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Refresh button
    const refreshBtn = document.getElementById('schema-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.handleRefresh());
    }

    // View mode toggle
    const tableDetailsBtn = document.getElementById('view-table-details');
    if (tableDetailsBtn) {
      tableDetailsBtn.addEventListener('click', () => this.setViewMode('table-details'));
    }

    const erdBtn = document.getElementById('view-erd');
    if (erdBtn) {
      erdBtn.addEventListener('click', () => this.setViewMode('erd'));
    }

    // Search input
    const searchInput = document.getElementById('schema-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = (e.target as HTMLInputElement).value;
        this.updateTableList();
      });
    }
  }

  /**
   * Load tables from database.
   *
   * db_list_tables returns an array of table *objects*
   * (`{ name, schema, type, comment, column_count, size_bytes, size_human }`),
   * not bare strings -- `name` is only schema-qualified for non-public
   * schemas. Each object's own `schema` field is preserved into the cache so
   * the UI can label tables by their real schema instead of assuming public.
   */
  private async loadTables(): Promise<void> {
    this.isLoading = true;
    this.updateTableList();

    try {
      const result = await databaseService.listTables();

      if (result.success && result.data) {
        const rawTables = result.data.tables || result.data;
        const tableInfos = Array.isArray(rawTables) ? rawTables : [];

        // Load metadata for each table
        for (const tableInfo of tableInfos) {
          this.loadTableMetadata(tableInfo);
        }

        // Row counts require a separate query per table -- fetch them
        // concurrently so a large table list doesn't serialize N round trips.
        await Promise.all(tableInfos.map((tableInfo: any) => this.loadRecordCount(this.tableInfoName(tableInfo))));

        console.log(`Loaded ${tableInfos.length} tables`);
      } else {
        console.error('Failed to load tables:', result.error);
      }
    } catch (error: any) {
      console.error('Error loading tables:', error.message);
    } finally {
      this.isLoading = false;
      this.updateTableList();
    }
  }

  /**
   * Extract the table name from either a raw table-info object or a plain string
   * (defensive: tolerates a server returning bare name strings).
   */
  private tableInfoName(tableInfo: any): string {
    return typeof tableInfo === 'string' ? tableInfo : tableInfo?.name;
  }

  /**
   * Store the metadata db_list_tables already gave us for a single table.
   * Merges onto any existing cache entry so a previously-loaded detailed
   * schema (from db_get_schema) survives a table-list refresh.
   */
  private loadTableMetadata(tableInfo: any): void {
    const name = this.tableInfoName(tableInfo);
    if (!name) return;

    const existing = this.cache.tables.get(name);
    const dbSchema = tableInfo?.schema || parseQualifiedTableName(name).dbSchema;

    const metadata: TableMetadata = {
      ...existing,
      name,
      dbSchema,
      tableType: tableInfo?.type,
      comment: tableInfo?.comment ?? null,
      columnCount: tableInfo?.column_count,
      sizeHuman: tableInfo?.size_human,
      lastUpdated: new Date().toISOString(),
    };

    this.cache.tables.set(name, metadata);
  }

  /**
   * Fetch and store the accurate row count for a single table (via a cheap
   * COUNT query -- see databaseService.getCount()).
   */
  private async loadRecordCount(tableName: string): Promise<void> {
    if (!tableName) return;

    try {
      const recordCount = await databaseService.getCount(tableName);
      const existing = this.cache.tables.get(tableName);
      if (existing) {
        existing.recordCount = recordCount;
        this.cache.tables.set(tableName, existing);
        this.updateTableList();
      }
    } catch (error: any) {
      console.error(`Error loading record count for ${tableName}:`, error.message);
    }
  }

  /**
   * Load schema for a table (with caching)
   */
  private async loadTableSchema(tableName: string): Promise<any> {
    const cached = this.cache.tables.get(tableName);

    // Return cached schema if available
    if (cached?.schema) {
      return cached.schema;
    }

    try {
      const result = await databaseService.getSchema({
        table: tableName,
        includeConstraints: true,
        includeIndexes: true,
      });

      if (result.success && result.data) {
        // Update cache
        const metadata = this.cache.tables.get(tableName) || {
          name: tableName,
          dbSchema: parseQualifiedTableName(tableName).dbSchema,
        };
        metadata.schema = result.data;
        this.cache.tables.set(tableName, metadata);

        return result.data;
      }
    } catch (error: any) {
      console.error(`Error loading schema for ${tableName}:`, error.message);
    }

    return null;
  }

  /**
   * Load relationships for a single table (with caching).
   *
   * db_get_relationships is scoped to ONE table -- it returns that table's
   * `parents` (tables it holds foreign keys to) and `children` (tables that
   * hold a foreign key back to it), not a whole-database relationship list;
   * there is no bulk "all relationships" tool. `table` is also a required
   * argument server-side, so this must always be called with a real table name.
   */
  private async loadRelationships(tableName: string): Promise<any[]> {
    if (!tableName) return [];

    const cached = this.cache.relationshipsByTable.get(tableName);
    if (cached) {
      return cached;
    }

    try {
      const result = await databaseService.getRelationships(tableName);

      if (result.success && result.data) {
        const relationships = this.parseTableRelationships(tableName, result.data);
        this.cache.relationshipsByTable.set(tableName, relationships);
        return relationships;
      }
    } catch (error: any) {
      console.error(`Error loading relationships for ${tableName}:`, error.message);
    }

    return [];
  }

  /**
   * Convert db_get_relationships' `{ parents, children }` shape (see
   * RelationshipMapper.getRelationships in MCP-Writing-Servers) into the
   * flat `{ from, to }` list RelationshipDiagram renders.
   *  - parents: this table holds the foreign key ("from" = this table)
   *  - children: the other table holds the foreign key ("from" = that table)
   */
  private parseTableRelationships(tableName: string, data: any): any[] {
    const relationships: any[] = [];

    for (const parent of data.parents || []) {
      relationships.push({
        from: { table: tableName, column: parent.column },
        to: { table: parent.references_table, column: parent.references_column },
        type: 'one-to-many',
      });
    }

    for (const child of data.children || []) {
      relationships.push({
        from: { table: child.table, column: child.column },
        to: { table: tableName, column: child.references_column },
        type: 'one-to-many',
      });
    }

    return relationships;
  }

  /**
   * Collect the schemas needed to render an ERD focused on `focusTable`:
   * the focus table itself plus every table directly related to it (its
   * db_get_relationships parents/children). Deliberately scoped rather than
   * loading every table's schema -- with dozens of tables in the database
   * that would mean dozens of extra db_get_schema round trips just to draw
   * one table's neighborhood.
   */
  private async buildErdSchemas(focusTable: string, relationships: any[]): Promise<Map<string, any>> {
    const relatedTableNames = new Set<string>([focusTable]);
    for (const rel of relationships) {
      if (rel.from?.table) relatedTableNames.add(rel.from.table);
      if (rel.to?.table) relatedTableNames.add(rel.to.table);
    }

    const tableSchemas = new Map<string, any>();
    for (const name of relatedTableNames) {
      const schema = await this.loadTableSchema(name);
      if (schema) {
        tableSchemas.set(name, schema);
      }
    }

    return tableSchemas;
  }

  /**
   * Filter tables based on search term.
   * Matches against the full qualified name (e.g. "fictionlab.workflow_definitions"),
   * the short table name, and the schema name -- so searching "fictionlab" surfaces
   * that whole group and searching a bare table name still works regardless of schema.
   */
  private filterTables(tables: TableMetadata[]): TableMetadata[] {
    if (!this.searchTerm) {
      return tables;
    }

    const term = this.searchTerm.toLowerCase();
    return tables.filter(table => {
      const { shortName } = parseQualifiedTableName(table.name);
      return (
        table.name.toLowerCase().includes(term) ||
        shortName.toLowerCase().includes(term) ||
        table.dbSchema.toLowerCase().includes(term)
      );
    });
  }

  /**
   * Update table list display
   */
  private updateTableList(): void {
    const tableList = document.getElementById('schema-table-list');
    if (tableList) {
      tableList.innerHTML = this.renderTableList();
      this.attachTableListeners();
    }
  }

  /**
   * Attach click listeners to table items
   */
  private attachTableListeners(): void {
    const tableList = document.getElementById('schema-table-list');
    if (!tableList) return;

    const items = tableList.querySelectorAll('.table-list-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const tableName = item.getAttribute('data-table');
        if (tableName) {
          this.selectTable(tableName);
        }
      });
    });
  }

  /**
   * Select a table and display its details
   */
  private async selectTable(tableName: string): Promise<void> {
    this.selectedTable = tableName;
    this.updateTableList();

    // Load schema for this table
    const schema = await this.loadTableSchema(tableName);

    if (this.viewMode === 'table-details' && this.tableDetails) {
      await this.tableDetails.displayTable(tableName, schema);
    } else if (this.viewMode === 'erd' && this.relationshipDiagram) {
      const relationships = await this.loadRelationships(tableName);
      const tableSchemas = await this.buildErdSchemas(tableName, relationships);
      await this.relationshipDiagram.displayDiagram(tableSchemas, relationships, tableName);
    }
  }

  /**
   * Set view mode
   */
  private async setViewMode(mode: ViewMode): Promise<void> {
    this.viewMode = mode;

    // Update button states
    const tableDetailsBtn = document.getElementById('view-table-details');
    const erdBtn = document.getElementById('view-erd');

    if (tableDetailsBtn && erdBtn) {
      tableDetailsBtn.classList.toggle('active', mode === 'table-details');
      erdBtn.classList.toggle('active', mode === 'erd');
    }

    // Update panel visibility
    const tableDetailsPanel = document.getElementById('schema-table-details-panel');
    const erdPanel = document.getElementById('schema-erd-panel');

    if (tableDetailsPanel && erdPanel) {
      tableDetailsPanel.classList.toggle('active', mode === 'table-details');
      erdPanel.classList.toggle('active', mode === 'erd');
    }

    // If switching to ERD and we have a selected table, display it
    if (mode === 'erd' && this.selectedTable && this.relationshipDiagram) {
      const relationships = await this.loadRelationships(this.selectedTable);
      const tableSchemas = await this.buildErdSchemas(this.selectedTable, relationships);
      await this.relationshipDiagram.displayDiagram(tableSchemas, relationships, this.selectedTable);
    } else if (mode === 'table-details' && this.selectedTable && this.tableDetails) {
      const schema = await this.loadTableSchema(this.selectedTable);
      await this.tableDetails.displayTable(this.selectedTable, schema);
    }
  }

  /**
   * Handle refresh button click
   */
  private async handleRefresh(): Promise<void> {
    // Clear cache
    this.cache = {
      tables: new Map(),
      relationshipsByTable: new Map(),
      lastRefresh: new Date(),
    };

    // Reload tables
    await this.loadTables();

    // If a table was selected, reselect it
    if (this.selectedTable) {
      await this.selectTable(this.selectedTable);
    }
  }

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { tableCount: number; lastRefresh: Date } {
    return {
      tableCount: this.cache.tables.size,
      lastRefresh: this.cache.lastRefresh,
    };
  }

  /**
   * Destroy the schema explorer
   */
  public destroy(): void {
    if (this.tableDetails) {
      this.tableDetails.destroy();
    }
    if (this.relationshipDiagram) {
      this.relationshipDiagram.destroy();
    }
    this.cache.tables.clear();
    this.cache.relationshipsByTable.clear();
    console.log('SchemaExplorer destroyed');
  }
}

/**
 * Create and initialize a schema explorer
 */
export async function createSchemaExplorer(containerId: string): Promise<SchemaExplorer> {
  const explorer = new SchemaExplorer();
  await explorer.initialize(containerId);
  return explorer;
}
