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

import { databaseService, DatabaseOperationResult } from '../../../services/databaseService';
import { TableDetails } from './TableDetails';
import { RelationshipDiagram } from './RelationshipDiagram';

export interface TableMetadata {
  name: string;
  recordCount?: number;
  lastUpdated?: string;
  schema?: any;
  columns?: any[];
  relationships?: any[];
}

export interface SchemaCache {
  tables: Map<string, TableMetadata>;
  relationships: any[];
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
      relationships: [],
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
   * Render table list items
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

    return filtered.map(table => `
      <div class="table-list-item ${this.selectedTable === table.name ? 'selected' : ''}"
           data-table="${this.escapeHtml(table.name)}">
        <div class="table-item-header">
          <span class="table-icon">📊</span>
          <span class="table-name">${this.escapeHtml(table.name)}</span>
        </div>
        ${table.recordCount !== undefined ? `
          <div class="table-item-meta">
            <span class="record-count">${table.recordCount} rows</span>
          </div>
        ` : ''}
      </div>
    `).join('');
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
   * Load tables from database
   */
  private async loadTables(): Promise<void> {
    this.isLoading = true;
    this.updateTableList();

    try {
      const result = await databaseService.listTables();

      if (result.success && result.data) {
        const tables = result.data.tables || result.data;
        const tableNames = Array.isArray(tables) ? tables : [];

        // Load metadata for each table
        for (const tableName of tableNames) {
          await this.loadTableMetadata(tableName);
        }

        console.log(`Loaded ${tableNames.length} tables`);
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
   * Load metadata for a single table
   */
  private async loadTableMetadata(tableName: string): Promise<void> {
    try {
      // Get record count
      const countResult = await databaseService.getCount(tableName);

      // Store in cache
      const metadata: TableMetadata = {
        name: tableName,
        recordCount: countResult,
        lastUpdated: new Date().toISOString(),
      };

      this.cache.tables.set(tableName, metadata);
    } catch (error: any) {
      console.error(`Error loading metadata for ${tableName}:`, error.message);

      // Store basic info even if metadata fetch fails
      this.cache.tables.set(tableName, {
        name: tableName,
      });
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
        const metadata = this.cache.tables.get(tableName) || { name: tableName };
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
   * Load relationships for all tables (with caching)
   */
  private async loadRelationships(): Promise<any[]> {
    // Return cached relationships if available
    if (this.cache.relationships.length > 0) {
      return this.cache.relationships;
    }

    try {
      const result = await databaseService.getRelationships();

      if (result.success && result.data) {
        const relationships = result.data.relationships || result.data || [];
        this.cache.relationships = Array.isArray(relationships) ? relationships : [];
        return this.cache.relationships;
      }
    } catch (error: any) {
      console.error('Error loading relationships:', error.message);
    }

    return [];
  }

  /**
   * Filter tables based on search term
   */
  private filterTables(tables: TableMetadata[]): TableMetadata[] {
    if (!this.searchTerm) {
      return tables;
    }

    const term = this.searchTerm.toLowerCase();
    return tables.filter(table =>
      table.name.toLowerCase().includes(term)
    );
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
      // For ERD, we need to load all relationships
      const relationships = await this.loadRelationships();

      // Get all table schemas for ERD
      const tableSchemas = new Map<string, any>();
      for (const [name, metadata] of this.cache.tables) {
        if (!metadata.schema) {
          await this.loadTableSchema(name);
        }
        const updatedMetadata = this.cache.tables.get(name);
        if (updatedMetadata?.schema) {
          tableSchemas.set(name, updatedMetadata.schema);
        }
      }

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
      const relationships = await this.loadRelationships();

      // Get all table schemas
      const tableSchemas = new Map<string, any>();
      for (const [name, metadata] of this.cache.tables) {
        if (!metadata.schema) {
          await this.loadTableSchema(name);
        }
        const updatedMetadata = this.cache.tables.get(name);
        if (updatedMetadata?.schema) {
          tableSchemas.set(name, updatedMetadata.schema);
        }
      }

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
      relationships: [],
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
    this.cache.relationships = [];
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
