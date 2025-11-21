/**
 * TableSelector Component
 * Provides table selection interface with search and record count display
 */

import { databaseService } from '../../../services/databaseService.js';

export interface TableInfo {
  name: string;
  recordCount?: number;
}

export interface TableSelectorEvents {
  onTableSelect?: (tableName: string) => void;
  onTablesLoaded?: (tables: TableInfo[]) => void;
}

export class TableSelector {
  private container: HTMLElement;
  private tables: TableInfo[] = [];
  private filteredTables: TableInfo[] = [];
  private selectedTable: string | null = null;
  private events: TableSelectorEvents;
  private searchTerm: string = '';

  constructor(container: HTMLElement, events: TableSelectorEvents = {}) {
    this.container = container;
    this.events = events;
  }

  /**
   * Initialize the table selector
   */
  public async initialize(): Promise<void> {
    await this.loadTables();
    this.render();
    this.attachEventListeners();
  }

  /**
   * Load tables from database
   */
  private async loadTables(): Promise<void> {
    try {
      const result = await databaseService.listTables();

      if (result.success && result.data) {
        const tablesData = result.data.tables || result.data;
        // Extract table names from table objects
        this.tables = Array.isArray(tablesData)
          ? tablesData.map((t: any) => ({
              name: typeof t === 'string' ? t : t.name
            }))
          : [];

        this.filteredTables = [...this.tables];

        // Load record counts asynchronously
        this.loadRecordCounts();

        if (this.events.onTablesLoaded) {
          this.events.onTablesLoaded(this.tables);
        }
      }
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  }

  /**
   * Load record counts for all tables
   */
  private async loadRecordCounts(): Promise<void> {
    const promises = this.tables.map(async (table) => {
      try {
        const count = await databaseService.getCount(table.name);
        table.recordCount = count;
      } catch (error) {
        console.error(`Error loading count for ${table.name}:`, error);
        table.recordCount = undefined;
      }
    });

    await Promise.all(promises);
    this.render();
  }

  /**
   * Render the table selector
   */
  public render(): void {
    this.container.innerHTML = `
      <div class="table-selector">
        <div class="table-selector-header">
          <h4>Select Table</h4>
          <button id="refresh-tables" class="icon-button" title="Refresh tables">
            🔄
          </button>
        </div>

        <div class="table-search">
          <input
            type="text"
            id="table-search-input"
            class="search-input"
            placeholder="Search tables..."
            value="${this.escapeHtml(this.searchTerm)}"
          />
        </div>

        <div class="table-dropdown">
          <select id="table-select" class="table-select">
            <option value="">-- Select a table --</option>
            ${this.renderTableOptions()}
          </select>
        </div>

        ${this.renderTableList()}

        ${this.selectedTable ? this.renderTableInfo() : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render table options for dropdown
   */
  private renderTableOptions(): string {
    return this.filteredTables.map(table => {
      const selected = table.name === this.selectedTable ? 'selected' : '';
      const count = table.recordCount !== undefined
        ? ` (${table.recordCount.toLocaleString()} records)`
        : '';

      return `<option value="${this.escapeHtml(table.name)}" ${selected}>
        ${this.escapeHtml(table.name)}${count}
      </option>`;
    }).join('');
  }

  /**
   * Render table list view
   */
  private renderTableList(): string {
    if (this.filteredTables.length === 0) {
      return `
        <div class="table-list-empty">
          ${this.searchTerm ? 'No tables match your search' : 'No tables available'}
        </div>
      `;
    }

    return `
      <div class="table-list">
        ${this.filteredTables.map(table => this.renderTableItem(table)).join('')}
      </div>
    `;
  }

  /**
   * Render a single table item
   */
  private renderTableItem(table: TableInfo): string {
    const isSelected = table.name === this.selectedTable;
    const count = table.recordCount !== undefined
      ? table.recordCount.toLocaleString()
      : '...';

    return `
      <div
        class="table-item ${isSelected ? 'selected' : ''}"
        data-table="${this.escapeHtml(table.name)}"
      >
        <div class="table-item-icon">📊</div>
        <div class="table-item-content">
          <div class="table-item-name">${this.escapeHtml(table.name)}</div>
          <div class="table-item-count">${count} records</div>
        </div>
      </div>
    `;
  }

  /**
   * Render selected table information
   */
  private renderTableInfo(): string {
    const table = this.tables.find(t => t.name === this.selectedTable);
    if (!table) return '';

    return `
      <div class="selected-table-info">
        <div class="info-label">Selected Table:</div>
        <div class="info-value">${this.escapeHtml(table.name)}</div>
        ${table.recordCount !== undefined ? `
          <div class="info-label">Total Records:</div>
          <div class="info-value">${table.recordCount.toLocaleString()}</div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Search input
    const searchInput = this.container.querySelector('#table-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch((e.target as HTMLInputElement).value);
      });
    }

    // Table dropdown
    const selectElement = this.container.querySelector('#table-select') as HTMLSelectElement;
    if (selectElement) {
      selectElement.addEventListener('change', (e) => {
        const tableName = (e.target as HTMLSelectElement).value;
        if (tableName) {
          this.selectTable(tableName);
        }
      });
    }

    // Table list items
    const tableItems = this.container.querySelectorAll('.table-item');
    tableItems.forEach(item => {
      item.addEventListener('click', () => {
        const tableName = item.getAttribute('data-table');
        if (tableName) {
          this.selectTable(tableName);
        }
      });
    });

    // Refresh button
    const refreshBtn = this.container.querySelector('#refresh-tables');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refresh();
      });
    }
  }

  /**
   * Handle search input
   */
  private handleSearch(term: string): void {
    this.searchTerm = term.toLowerCase();

    if (this.searchTerm === '') {
      this.filteredTables = [...this.tables];
    } else {
      this.filteredTables = this.tables.filter(table =>
        table.name.toLowerCase().includes(this.searchTerm)
      );
    }

    this.render();
  }

  /**
   * Select a table
   */
  public selectTable(tableName: string): void {
    this.selectedTable = tableName;
    this.render();

    if (this.events.onTableSelect) {
      this.events.onTableSelect(tableName);
    }
  }

  /**
   * Get selected table name
   */
  public getSelectedTable(): string | null {
    return this.selectedTable;
  }

  /**
   * Get all tables
   */
  public getTables(): TableInfo[] {
    return this.tables;
  }

  /**
   * Refresh tables list
   */
  public async refresh(): Promise<void> {
    this.selectedTable = null;
    await this.loadTables();
    this.render();
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
