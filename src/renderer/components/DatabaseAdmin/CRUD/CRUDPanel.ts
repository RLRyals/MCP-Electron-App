/**
 * CRUDPanel Component
 * Main container for CRUD operations, coordinates TableSelector, QueryBuilder, and DataGrid
 */

import { TableSelector } from './TableSelector.js';
import { QueryBuilder } from './QueryBuilder.js';
import { DataGrid } from './DataGrid.js';
import { QueryParams } from '../../../services/databaseService.js';

export interface CRUDPanelEvents {
  onStatusChange?: (message: string, type: 'info' | 'success' | 'error') => void;
}

export class CRUDPanel {
  private container: HTMLElement;
  private events: CRUDPanelEvents;
  private tableSelector: TableSelector | null = null;
  private queryBuilder: QueryBuilder | null = null;
  private dataGrid: DataGrid | null = null;
  private currentTable: string | null = null;
  private lastQuery: QueryParams | null = null;

  constructor(container: HTMLElement, events: CRUDPanelEvents = {}) {
    this.container = container;
    this.events = events;
  }

  /**
   * Initialize the CRUD panel
   */
  public async initialize(): Promise<void> {
    this.render();
    await this.initializeComponents();
  }

  /**
   * Render the main panel structure
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="crud-panel">
        <div class="crud-panel-header">
          <h3>CRUD Operations</h3>
          <div class="crud-panel-description">
            Select a table, build queries visually, and manage your data
          </div>
        </div>

        <div class="crud-panel-body">
          <!-- Table Selector Section -->
          <div class="crud-section table-selector-section">
            <div id="table-selector-container"></div>
          </div>

          <!-- Query Builder Section -->
          <div class="crud-section query-builder-section">
            <div id="query-builder-container"></div>
          </div>

          <!-- Data Grid Section -->
          <div class="crud-section data-grid-section">
            <div id="data-grid-container"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Initialize child components
   */
  private async initializeComponents(): Promise<void> {
    // Initialize Table Selector
    const tableSelectorContainer = this.container.querySelector('#table-selector-container') as HTMLElement;
    if (tableSelectorContainer) {
      this.tableSelector = new TableSelector(tableSelectorContainer, {
        onTableSelect: (tableName) => this.handleTableSelect(tableName),
        onTablesLoaded: (tables) => {
          this.emitStatus(`Loaded ${tables.length} tables`, 'success');
        },
      });
      await this.tableSelector.initialize();
    }

    // Initialize Query Builder
    const queryBuilderContainer = this.container.querySelector('#query-builder-container') as HTMLElement;
    if (queryBuilderContainer) {
      this.queryBuilder = new QueryBuilder(queryBuilderContainer, {
        onExecute: (params) => this.handleQueryExecute(params),
        onQueryChange: (params) => {
          // Optional: handle query changes for validation
        },
      });
      // Query builder will be initialized when a table is selected
    }

    // Initialize Data Grid
    const dataGridContainer = this.container.querySelector('#data-grid-container') as HTMLElement;
    if (dataGridContainer) {
      this.dataGrid = new DataGrid(dataGridContainer, {
        onRowEdit: (rowIndex, updatedData) => this.handleRowEdit(rowIndex, updatedData),
        onRowDelete: (rowIndex, rowData) => this.handleRowDelete(rowIndex, rowData),
        onPageChange: (page) => this.handlePageChange(page),
      });
    }
  }

  // ===================
  // Event Handlers
  // ===================

  /**
   * Handle table selection
   */
  private async handleTableSelect(tableName: string): Promise<void> {
    this.currentTable = tableName;
    this.emitStatus(`Selected table: ${tableName}`, 'info');

    // Initialize query builder with the selected table
    if (this.queryBuilder) {
      await this.queryBuilder.initialize(tableName);
      this.emitStatus('Query builder ready', 'success');
    }

    // Clear the data grid
    if (this.dataGrid) {
      this.dataGrid.clear();
    }

    // Execute a default query to show initial data
    await this.executeDefaultQuery(tableName);
  }

  /**
   * Execute default query for a table
   */
  private async executeDefaultQuery(tableName: string): Promise<void> {
    const defaultParams: QueryParams = {
      table: tableName,
      limit: 100,
      offset: 0,
    };

    await this.executeQuery(defaultParams);
  }

  /**
   * Handle query execution from Query Builder
   */
  private async handleQueryExecute(params: QueryParams): Promise<void> {
    await this.executeQuery(params);
  }

  /**
   * Execute a query and display results
   */
  private async executeQuery(params: QueryParams): Promise<void> {
    if (!this.currentTable || !this.dataGrid) {
      console.error('[CRUDPanel] Cannot execute query - missing table or grid', {
        currentTable: this.currentTable,
        hasDataGrid: !!this.dataGrid
      });
      this.emitStatus('No table selected', 'error');
      return;
    }

    try {
      console.log('[CRUDPanel] Executing query:', params);
      this.emitStatus('Executing query...', 'info');
      this.lastQuery = params;

      await this.dataGrid.loadData(this.currentTable, params);

      const resultCount = this.dataGrid.getData().length;
      console.log('[CRUDPanel] Query complete, rows:', resultCount);
      this.emitStatus(`Query executed successfully. ${resultCount} rows returned.`, 'success');
    } catch (error: any) {
      console.error('[CRUDPanel] Query failed:', error);
      this.emitStatus(`Query failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle row edit
   */
  private async handleRowEdit(rowIndex: number, updatedData: any): Promise<void> {
    try {
      this.emitStatus(`Updating row ${rowIndex + 1}...`, 'info');
      // The DataGrid handles the actual update via databaseService
      this.emitStatus('Row updated successfully', 'success');
    } catch (error: any) {
      this.emitStatus(`Update failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle row delete
   */
  private async handleRowDelete(rowIndex: number, rowData: any): Promise<void> {
    try {
      this.emitStatus(`Deleting row ${rowIndex + 1}...`, 'info');
      // The DataGrid handles the actual delete via databaseService
      this.emitStatus('Row deleted successfully', 'success');
    } catch (error: any) {
      this.emitStatus(`Delete failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle page change
   */
  private async handlePageChange(page: number): Promise<void> {
    if (!this.lastQuery) return;

    // Update offset based on page
    const limit = this.lastQuery.limit || 100;
    const offset = (page - 1) * limit;

    const updatedQuery = {
      ...this.lastQuery,
      offset,
    };

    await this.executeQuery(updatedQuery);
  }

  // ===================
  // Public Methods
  // ===================

  /**
   * Refresh the current view
   */
  public async refresh(): Promise<void> {
    if (this.currentTable) {
      // Refresh table selector
      if (this.tableSelector) {
        await this.tableSelector.refresh();
      }

      // Re-execute last query
      if (this.lastQuery) {
        await this.executeQuery(this.lastQuery);
      }
    }
  }

  /**
   * Get current selected table
   */
  public getCurrentTable(): string | null {
    return this.currentTable;
  }

  /**
   * Select a specific table programmatically
   */
  public async selectTable(tableName: string): Promise<void> {
    if (this.tableSelector) {
      this.tableSelector.selectTable(tableName);
      await this.handleTableSelect(tableName);
    }
  }

  /**
   * Execute a custom query
   */
  public async executeCustomQuery(params: QueryParams): Promise<void> {
    await this.executeQuery(params);
  }

  /**
   * Export current data
   */
  public exportData(format: 'csv' | 'json'): void {
    if (!this.dataGrid) return;

    if (format === 'csv') {
      // DataGrid handles the export
      const exportBtn = this.container.querySelector('#export-csv') as HTMLButtonElement;
      if (exportBtn) exportBtn.click();
    } else if (format === 'json') {
      const exportBtn = this.container.querySelector('#export-json') as HTMLButtonElement;
      if (exportBtn) exportBtn.click();
    }
  }

  // ===================
  // Utility Methods
  // ===================

  /**
   * Emit status message to parent
   */
  private emitStatus(message: string, type: 'info' | 'success' | 'error'): void {
    if (this.events.onStatusChange) {
      this.events.onStatusChange(message, type);
    }
  }

  /**
   * Destroy the CRUD panel
   */
  public destroy(): void {
    this.tableSelector = null;
    this.queryBuilder = null;
    this.dataGrid = null;
    this.currentTable = null;
    this.lastQuery = null;
  }
}

/**
 * Create and initialize a CRUD panel
 */
export async function createCRUDPanel(container: HTMLElement, events: CRUDPanelEvents = {}): Promise<CRUDPanel> {
  const panel = new CRUDPanel(container, events);
  await panel.initialize();
  return panel;
}
