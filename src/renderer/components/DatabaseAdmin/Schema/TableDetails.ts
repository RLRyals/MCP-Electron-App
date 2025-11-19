/**
 * TableDetails Component
 * Displays detailed information about a database table
 *
 * Features:
 * - Column information (name, type, nullable, default, constraints)
 * - Primary keys and foreign keys
 * - Indexes
 * - Sample data preview
 */

import { databaseService } from '../../../services/databaseService';

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default?: any;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignKeyRef?: {
    table: string;
    column: string;
  };
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export class TableDetails {
  private container: HTMLElement | null = null;
  private currentTable: string | null = null;
  private currentSchema: any = null;
  private sampleData: any[] = [];
  private sampleDataLimit: number = 10;

  constructor() {}

  /**
   * Initialize the table details component
   */
  public async initialize(containerId: string): Promise<void> {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    this.renderEmptyState();
    console.log('TableDetails initialized');
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="table-details-empty">
        <div class="empty-icon">📋</div>
        <h4>No Table Selected</h4>
        <p>Select a table from the list to view its details</p>
      </div>
    `;
  }

  /**
   * Display table details
   */
  public async displayTable(tableName: string, schema: any): Promise<void> {
    if (!this.container) return;

    this.currentTable = tableName;
    this.currentSchema = schema;

    // Load sample data
    await this.loadSampleData(tableName);

    this.render();
  }

  /**
   * Load sample data for the table
   */
  private async loadSampleData(tableName: string): Promise<void> {
    try {
      const result = await databaseService.queryRecords({
        table: tableName,
        limit: this.sampleDataLimit,
      });

      if (result.success && result.data?.data) {
        this.sampleData = result.data.data;
      } else {
        this.sampleData = [];
      }
    } catch (error: any) {
      console.error(`Error loading sample data for ${tableName}:`, error.message);
      this.sampleData = [];
    }
  }

  /**
   * Render the table details
   */
  private render(): void {
    if (!this.container || !this.currentTable) return;

    this.container.innerHTML = `
      <div class="table-details">
        ${this.renderHeader()}
        ${this.renderTabs()}
        <div class="table-details-content">
          ${this.renderColumnsTab()}
          ${this.renderKeysTab()}
          ${this.renderIndexesTab()}
          ${this.renderSampleDataTab()}
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.showTab('columns');
  }

  /**
   * Render header
   */
  private renderHeader(): string {
    return `
      <div class="table-details-header">
        <h4>${this.escapeHtml(this.currentTable || '')}</h4>
        <div class="table-stats">
          ${this.currentSchema?.columns?.length ? `
            <span class="stat-item">
              <strong>${this.currentSchema.columns.length}</strong> columns
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render tabs
   */
  private renderTabs(): string {
    return `
      <div class="table-details-tabs">
        <button class="tab-button active" data-tab="columns">Columns</button>
        <button class="tab-button" data-tab="keys">Keys</button>
        <button class="tab-button" data-tab="indexes">Indexes</button>
        <button class="tab-button" data-tab="sample-data">Sample Data</button>
      </div>
    `;
  }

  /**
   * Render columns tab
   */
  private renderColumnsTab(): string {
    if (!this.currentSchema?.columns || this.currentSchema.columns.length === 0) {
      return `
        <div class="tab-content" data-tab="columns">
          <div class="empty-message">No column information available</div>
        </div>
      `;
    }

    const columns = this.currentSchema.columns;

    return `
      <div class="tab-content" data-tab="columns">
        <table class="details-table">
          <thead>
            <tr>
              <th>Column Name</th>
              <th>Data Type</th>
              <th>Nullable</th>
              <th>Default</th>
              <th>Constraints</th>
            </tr>
          </thead>
          <tbody>
            ${columns.map((col: any) => this.renderColumnRow(col)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render a single column row
   */
  private renderColumnRow(column: any): string {
    const constraints: string[] = [];

    if (column.isPrimaryKey || column.primary_key) {
      constraints.push('<span class="badge badge-primary">PRIMARY KEY</span>');
    }

    if (column.isForeignKey || column.foreign_key) {
      constraints.push('<span class="badge badge-info">FOREIGN KEY</span>');
    }

    if (column.unique) {
      constraints.push('<span class="badge badge-secondary">UNIQUE</span>');
    }

    if (column.autoIncrement || column.auto_increment) {
      constraints.push('<span class="badge badge-secondary">AUTO INCREMENT</span>');
    }

    return `
      <tr>
        <td><strong>${this.escapeHtml(column.name || '')}</strong></td>
        <td><code>${this.escapeHtml(column.type || '')}</code></td>
        <td>${column.nullable ? 'Yes' : 'No'}</td>
        <td>${column.default !== null && column.default !== undefined ? this.escapeHtml(String(column.default)) : '-'}</td>
        <td>${constraints.join(' ')}</td>
      </tr>
    `;
  }

  /**
   * Render keys tab
   */
  private renderKeysTab(): string {
    const primaryKeys = this.getPrimaryKeys();
    const foreignKeys = this.getForeignKeys();

    return `
      <div class="tab-content" data-tab="keys" style="display: none;">
        <div class="keys-section">
          <h5>Primary Keys</h5>
          ${primaryKeys.length > 0 ? `
            <ul class="key-list">
              ${primaryKeys.map(key => `
                <li><code>${this.escapeHtml(key)}</code></li>
              `).join('')}
            </ul>
          ` : '<div class="empty-message">No primary keys defined</div>'}
        </div>

        <div class="keys-section">
          <h5>Foreign Keys</h5>
          ${foreignKeys.length > 0 ? `
            <table class="details-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>References</th>
                </tr>
              </thead>
              <tbody>
                ${foreignKeys.map(fk => `
                  <tr>
                    <td><code>${this.escapeHtml(fk.column)}</code></td>
                    <td><code>${this.escapeHtml(fk.references)}</code></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="empty-message">No foreign keys defined</div>'}
        </div>
      </div>
    `;
  }

  /**
   * Render indexes tab
   */
  private renderIndexesTab(): string {
    const indexes = this.getIndexes();

    return `
      <div class="tab-content" data-tab="indexes" style="display: none;">
        ${indexes.length > 0 ? `
          <table class="details-table">
            <thead>
              <tr>
                <th>Index Name</th>
                <th>Columns</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              ${indexes.map(idx => `
                <tr>
                  <td><strong>${this.escapeHtml(idx.name)}</strong></td>
                  <td><code>${this.escapeHtml(idx.columns.join(', '))}</code></td>
                  <td>${idx.unique ? '<span class="badge badge-info">UNIQUE</span>' : '<span class="badge badge-secondary">INDEX</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div class="empty-message">No indexes defined</div>'}
      </div>
    `;
  }

  /**
   * Render sample data tab
   */
  private renderSampleDataTab(): string {
    if (this.sampleData.length === 0) {
      return `
        <div class="tab-content" data-tab="sample-data" style="display: none;">
          <div class="empty-message">No sample data available</div>
        </div>
      `;
    }

    const columns = Object.keys(this.sampleData[0]);

    return `
      <div class="tab-content" data-tab="sample-data" style="display: none;">
        <div class="sample-data-info">
          Showing first ${this.sampleData.length} rows
        </div>
        <div class="table-scroll">
          <table class="details-table sample-data-table">
            <thead>
              <tr>
                ${columns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${this.sampleData.map(row => `
                <tr>
                  ${columns.map(col => `
                    <td>${this.formatCellValue(row[col])}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Format cell value for display
   */
  private formatCellValue(value: any): string {
    if (value === null || value === undefined) {
      return '<span class="null-value">NULL</span>';
    }

    if (typeof value === 'object') {
      return `<code>${this.escapeHtml(JSON.stringify(value))}</code>`;
    }

    const str = String(value);
    if (str.length > 100) {
      return this.escapeHtml(str.substring(0, 100)) + '...';
    }

    return this.escapeHtml(str);
  }

  /**
   * Get primary keys from schema
   */
  private getPrimaryKeys(): string[] {
    if (!this.currentSchema?.columns) return [];

    return this.currentSchema.columns
      .filter((col: any) => col.isPrimaryKey || col.primary_key)
      .map((col: any) => col.name);
  }

  /**
   * Get foreign keys from schema
   */
  private getForeignKeys(): Array<{ column: string; references: string }> {
    if (!this.currentSchema?.columns) return [];

    const foreignKeys: Array<{ column: string; references: string }> = [];

    for (const col of this.currentSchema.columns) {
      if (col.isForeignKey || col.foreign_key) {
        const ref = col.foreignKeyRef || col.foreign_key_ref || {};
        foreignKeys.push({
          column: col.name,
          references: `${ref.table || '?'}.${ref.column || '?'}`,
        });
      }
    }

    // Also check constraints if available
    if (this.currentSchema.constraints) {
      for (const constraint of this.currentSchema.constraints) {
        if (constraint.type === 'FOREIGN KEY' || constraint.constraintType === 'FOREIGN KEY') {
          foreignKeys.push({
            column: constraint.column || constraint.columnName || '?',
            references: `${constraint.referencedTable || '?'}.${constraint.referencedColumn || '?'}`,
          });
        }
      }
    }

    return foreignKeys;
  }

  /**
   * Get indexes from schema
   */
  private getIndexes(): IndexInfo[] {
    if (!this.currentSchema?.indexes) return [];

    return this.currentSchema.indexes.map((idx: any) => ({
      name: idx.name || idx.indexName || 'unnamed',
      columns: Array.isArray(idx.columns) ? idx.columns : [idx.column || idx.columnName || '?'],
      unique: idx.unique || idx.isUnique || false,
    }));
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const tabButtons = this.container?.querySelectorAll('.tab-button');
    if (!tabButtons) return;

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        if (tabName) {
          this.showTab(tabName);
        }
      });
    });
  }

  /**
   * Show a specific tab
   */
  private showTab(tabName: string): void {
    if (!this.container) return;

    // Update button states
    const buttons = this.container.querySelectorAll('.tab-button');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Update content visibility
    const contents = this.container.querySelectorAll('.tab-content');
    contents.forEach(content => {
      const contentTab = content.getAttribute('data-tab');
      if (contentTab === tabName) {
        (content as HTMLElement).style.display = 'block';
      } else {
        (content as HTMLElement).style.display = 'none';
      }
    });
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
   * Destroy the component
   */
  public destroy(): void {
    this.currentTable = null;
    this.currentSchema = null;
    this.sampleData = [];
    console.log('TableDetails destroyed');
  }
}
