/**
 * DataGrid Component
 * Displays query results with sorting, inline editing, pagination, and export capabilities
 */

import { databaseService, QueryParams } from '../../../services/databaseService.js';

export interface DataGridColumn {
  name: string;
  type?: string;
  sortable?: boolean;
  editable?: boolean;
}

export interface DataGridRow {
  [key: string]: any;
}

export interface DataGridEvents {
  onRowEdit?: (rowIndex: number, updatedData: DataGridRow) => void;
  onRowDelete?: (rowIndex: number, rowData: DataGridRow) => void;
  onPageChange?: (page: number) => void;
}

export class DataGrid {
  private container: HTMLElement;
  private events: DataGridEvents;
  private tableName: string = '';
  private columns: DataGridColumn[] = [];
  private data: DataGridRow[] = [];
  private selectedRows: Set<number> = new Set();
  private editingCell: { row: number; column: string } | null = null;
  private sortColumn: string | null = null;
  private sortDirection: 'ASC' | 'DESC' = 'ASC';
  private currentPage: number = 1;
  private pageSize: number = 100;
  private totalRecords: number = 0;

  constructor(container: HTMLElement, events: DataGridEvents = {}) {
    this.container = container;
    this.events = events;
  }

  /**
   * Load data into the grid
   */
  public async loadData(tableName: string, queryParams: QueryParams): Promise<void> {
    this.tableName = tableName;

    try {
      const result = await databaseService.queryRecords(queryParams);

      if (result.success && result.data) {
        this.data = result.data.data || result.data || [];
        this.totalRecords = result.data.totalCount || this.data.length;

        // Extract columns from data
        if (this.data.length > 0) {
          const firstRow = this.data[0];
          this.columns = Object.keys(firstRow).map(key => ({
            name: key,
            sortable: true,
            editable: true,
          }));
        } else {
          this.columns = [];
        }

        this.render();
      } else {
        this.showError(result.error || 'Failed to load data');
      }
    } catch (error: any) {
      this.showError(`Error loading data: ${error.message}`);
    }
  }

  /**
   * Render the data grid
   */
  public render(): void {
    this.container.innerHTML = `
      <div class="data-grid">
        ${this.renderToolbar()}
        ${this.renderTable()}
        ${this.renderPagination()}
        ${this.renderRecordForm()}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render toolbar with actions
   */
  private renderToolbar(): string {
    const selectedCount = this.selectedRows.size;

    return `
      <div class="data-grid-toolbar">
        <div class="toolbar-left">
          <button id="refresh-grid" class="toolbar-button" title="Refresh data">
            🔄 Refresh
          </button>
          <button id="insert-record" class="toolbar-button" title="Insert new record">
            ➕ Insert
          </button>
          ${selectedCount > 0 ? `
            <button id="delete-selected" class="toolbar-button danger" title="Delete selected rows">
              🗑️ Delete (${selectedCount})
            </button>
          ` : ''}
        </div>
        <div class="toolbar-right">
          <button id="export-csv" class="toolbar-button" title="Export to CSV">
            📄 CSV
          </button>
          <button id="export-json" class="toolbar-button" title="Export to JSON">
            📋 JSON
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render data table
   */
  private renderTable(): string {
    if (this.data.length === 0) {
      return `
        <div class="data-grid-empty">
          No data to display. Execute a query to see results.
        </div>
      `;
    }

    return `
      <div class="data-grid-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="checkbox-column">
                <input type="checkbox" id="select-all-rows" />
              </th>
              <th class="row-number-column">#</th>
              ${this.columns.map(col => this.renderColumnHeader(col)).join('')}
              <th class="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.data.map((row, index) => this.renderRow(row, index)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render column header
   */
  private renderColumnHeader(column: DataGridColumn): string {
    const isSorted = this.sortColumn === column.name;
    const sortIcon = isSorted
      ? (this.sortDirection === 'ASC' ? '▲' : '▼')
      : '';

    return `
      <th
        class="sortable-column ${isSorted ? 'sorted' : ''}"
        data-column="${this.escapeHtml(column.name)}"
      >
        ${this.escapeHtml(column.name)} ${sortIcon}
      </th>
    `;
  }

  /**
   * Render a single row
   */
  private renderRow(row: DataGridRow, index: number): string {
    const isSelected = this.selectedRows.has(index);

    return `
      <tr class="${isSelected ? 'selected' : ''}" data-row="${index}">
        <td class="checkbox-column">
          <input type="checkbox" class="row-checkbox" data-row="${index}" ${isSelected ? 'checked' : ''} />
        </td>
        <td class="row-number-column">${index + 1}</td>
        ${this.columns.map(col => this.renderCell(row, col, index)).join('')}
        <td class="actions-column">
          <button class="action-button-small edit-row" data-row="${index}" title="Edit row">✏️</button>
          <button class="action-button-small delete-row" data-row="${index}" title="Delete row">🗑️</button>
        </td>
      </tr>
    `;
  }

  /**
   * Render a single cell
   */
  private renderCell(row: DataGridRow, column: DataGridColumn, rowIndex: number): string {
    const value = row[column.name];
    const displayValue = this.formatCellValue(value);
    const isEditing = this.editingCell?.row === rowIndex && this.editingCell?.column === column.name;

    if (isEditing) {
      return `
        <td class="editing-cell" data-row="${rowIndex}" data-column="${this.escapeHtml(column.name)}">
          <input
            type="text"
            class="cell-editor"
            value="${this.escapeHtml(String(value || ''))}"
            data-row="${rowIndex}"
            data-column="${this.escapeHtml(column.name)}"
            autofocus
          />
        </td>
      `;
    }

    return `
      <td
        class="data-cell ${column.editable ? 'editable' : ''}"
        data-row="${rowIndex}"
        data-column="${this.escapeHtml(column.name)}"
        title="${this.escapeHtml(String(value || ''))}"
      >
        ${displayValue}
      </td>
    `;
  }

  /**
   * Format cell value for display
   */
  private formatCellValue(value: any): string {
    if (value === null || value === undefined) {
      return '<span class="null-value">NULL</span>';
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (typeof value === 'object') {
      return this.escapeHtml(JSON.stringify(value));
    }

    const strValue = String(value);
    if (strValue.length > 50) {
      return this.escapeHtml(strValue.substring(0, 50)) + '...';
    }

    return this.escapeHtml(strValue);
  }

  /**
   * Render pagination controls
   */
  private renderPagination(): string {
    const totalPages = Math.ceil(this.totalRecords / this.pageSize);
    const hasMultiplePages = totalPages > 1;

    return `
      <div class="data-grid-pagination">
        <div class="pagination-info">
          Showing ${this.data.length} of ${this.totalRecords.toLocaleString()} records
        </div>
        ${hasMultiplePages ? `
          <div class="pagination-controls">
            <button
              id="first-page"
              class="pagination-button"
              ${this.currentPage === 1 ? 'disabled' : ''}
            >⏮️</button>
            <button
              id="prev-page"
              class="pagination-button"
              ${this.currentPage === 1 ? 'disabled' : ''}
            >◀️</button>
            <span class="page-indicator">
              Page ${this.currentPage} of ${totalPages}
            </span>
            <button
              id="next-page"
              class="pagination-button"
              ${this.currentPage >= totalPages ? 'disabled' : ''}
            >▶️</button>
            <button
              id="last-page"
              class="pagination-button"
              ${this.currentPage >= totalPages ? 'disabled' : ''}
            >⏭️</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render record form for insert/edit
   */
  private renderRecordForm(): string {
    return `
      <div id="record-form-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="record-form-title">Insert Record</h3>
            <button class="modal-close" id="close-record-form">✕</button>
          </div>
          <div class="modal-body">
            <form id="record-form">
              <div id="record-form-fields"></div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="action-button secondary" id="cancel-record-form">Cancel</button>
            <button class="action-button primary" id="save-record-form">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Refresh button
    const refreshBtn = this.container.querySelector('#refresh-grid');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refresh());
    }

    // Insert button
    const insertBtn = this.container.querySelector('#insert-record');
    if (insertBtn) {
      insertBtn.addEventListener('click', () => this.showInsertForm());
    }

    // Delete selected button
    const deleteSelectedBtn = this.container.querySelector('#delete-selected');
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', () => this.deleteSelected());
    }

    // Export buttons
    const exportCsvBtn = this.container.querySelector('#export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => this.exportToCsv());
    }

    const exportJsonBtn = this.container.querySelector('#export-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this.exportToJson());
    }

    // Select all checkbox
    const selectAllCheckbox = this.container.querySelector('#select-all-rows') as HTMLInputElement;
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        this.toggleSelectAll((e.target as HTMLInputElement).checked);
      });
    }

    // Row checkboxes
    const rowCheckboxes = this.container.querySelectorAll('.row-checkbox');
    rowCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const rowIndex = parseInt((e.target as HTMLElement).getAttribute('data-row')!);
        this.toggleRowSelection(rowIndex);
      });
    });

    // Sortable columns
    const sortableColumns = this.container.querySelectorAll('.sortable-column');
    sortableColumns.forEach(header => {
      header.addEventListener('click', (e) => {
        const columnName = (e.target as HTMLElement).getAttribute('data-column');
        if (columnName) {
          this.sortByColumn(columnName);
        }
      });
    });

    // Editable cells
    const editableCells = this.container.querySelectorAll('.data-cell.editable');
    editableCells.forEach(cell => {
      cell.addEventListener('dblclick', (e) => {
        const rowIndex = parseInt((e.target as HTMLElement).getAttribute('data-row')!);
        const columnName = (e.target as HTMLElement).getAttribute('data-column')!;
        this.startCellEdit(rowIndex, columnName);
      });
    });

    // Cell editor
    const cellEditor = this.container.querySelector('.cell-editor');
    if (cellEditor) {
      cellEditor.addEventListener('blur', () => this.saveCellEdit());
      cellEditor.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          this.saveCellEdit();
        } else if ((e as KeyboardEvent).key === 'Escape') {
          this.cancelCellEdit();
        }
      });
    }

    // Edit/Delete row buttons
    const editButtons = this.container.querySelectorAll('.edit-row');
    editButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const rowIndex = parseInt((e.target as HTMLElement).getAttribute('data-row')!);
        this.showEditForm(rowIndex);
      });
    });

    const deleteButtons = this.container.querySelectorAll('.delete-row');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const rowIndex = parseInt((e.target as HTMLElement).getAttribute('data-row')!);
        this.deleteRow(rowIndex);
      });
    });

    // Pagination buttons
    this.attachPaginationListeners();

    // Record form listeners
    this.attachRecordFormListeners();
  }

  /**
   * Attach pagination event listeners
   */
  private attachPaginationListeners(): void {
    const firstPageBtn = this.container.querySelector('#first-page');
    if (firstPageBtn) {
      firstPageBtn.addEventListener('click', () => this.goToPage(1));
    }

    const prevPageBtn = this.container.querySelector('#prev-page');
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
    }

    const nextPageBtn = this.container.querySelector('#next-page');
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
    }

    const lastPageBtn = this.container.querySelector('#last-page');
    if (lastPageBtn) {
      const totalPages = Math.ceil(this.totalRecords / this.pageSize);
      lastPageBtn.addEventListener('click', () => this.goToPage(totalPages));
    }
  }

  /**
   * Attach record form event listeners
   */
  private attachRecordFormListeners(): void {
    const closeBtn = this.container.querySelector('#close-record-form');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeRecordForm());
    }

    const cancelBtn = this.container.querySelector('#cancel-record-form');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeRecordForm());
    }

    const saveBtn = this.container.querySelector('#save-record-form');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveRecordForm());
    }
  }

  // ===================
  // Selection Methods
  // ===================

  private toggleSelectAll(checked: boolean): void {
    if (checked) {
      this.data.forEach((_, index) => this.selectedRows.add(index));
    } else {
      this.selectedRows.clear();
    }
    this.render();
  }

  private toggleRowSelection(rowIndex: number): void {
    if (this.selectedRows.has(rowIndex)) {
      this.selectedRows.delete(rowIndex);
    } else {
      this.selectedRows.add(rowIndex);
    }
    this.render();
  }

  // ===================
  // Sorting Methods
  // ===================

  private sortByColumn(columnName: string): void {
    if (this.sortColumn === columnName) {
      this.sortDirection = this.sortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.sortColumn = columnName;
      this.sortDirection = 'ASC';
    }

    this.data.sort((a, b) => {
      const aVal = a[columnName];
      const bVal = b[columnName];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;

      return this.sortDirection === 'ASC' ? comparison : -comparison;
    });

    this.render();
  }

  // ===================
  // Edit Methods
  // ===================

  private startCellEdit(rowIndex: number, columnName: string): void {
    this.editingCell = { row: rowIndex, column: columnName };
    this.render();
  }

  private saveCellEdit(): void {
    if (!this.editingCell) return;

    const editor = this.container.querySelector('.cell-editor') as HTMLInputElement;
    if (editor) {
      const newValue = editor.value;
      const { row, column } = this.editingCell;
      this.data[row][column] = newValue;

      // Trigger update event
      if (this.events.onRowEdit) {
        this.events.onRowEdit(row, this.data[row]);
      }
    }

    this.editingCell = null;
    this.render();
  }

  private cancelCellEdit(): void {
    this.editingCell = null;
    this.render();
  }

  private showEditForm(rowIndex: number): void {
    const row = this.data[rowIndex];
    this.showRecordForm('Edit Record', row, rowIndex);
  }

  private showInsertForm(): void {
    const emptyRow: DataGridRow = {};
    this.columns.forEach(col => {
      emptyRow[col.name] = '';
    });
    this.showRecordForm('Insert Record', emptyRow, null);
  }

  private showRecordForm(title: string, data: DataGridRow, editIndex: number | null): void {
    const modal = this.container.querySelector('#record-form-modal') as HTMLElement;
    const titleElement = this.container.querySelector('#record-form-title') as HTMLElement;
    const fieldsContainer = this.container.querySelector('#record-form-fields') as HTMLElement;

    if (!modal || !titleElement || !fieldsContainer) return;

    titleElement.textContent = title;

    fieldsContainer.innerHTML = this.columns.map(col => `
      <div class="form-field">
        <label>${this.escapeHtml(col.name)}:</label>
        <input
          type="text"
          name="${this.escapeHtml(col.name)}"
          value="${this.escapeHtml(String(data[col.name] || ''))}"
          class="form-input"
        />
      </div>
    `).join('');

    modal.style.display = 'flex';
    modal.setAttribute('data-edit-index', String(editIndex));
  }

  private closeRecordForm(): void {
    const modal = this.container.querySelector('#record-form-modal') as HTMLElement;
    if (modal) {
      modal.style.display = 'none';
    }
  }

  private async saveRecordForm(): Promise<void> {
    const modal = this.container.querySelector('#record-form-modal') as HTMLElement;
    const editIndex = modal?.getAttribute('data-edit-index');
    const isEdit = editIndex !== null && editIndex !== 'null';

    const formData: DataGridRow = {};
    const inputs = this.container.querySelectorAll('#record-form .form-input') as NodeListOf<HTMLInputElement>;

    inputs.forEach(input => {
      const fieldName = input.name;
      formData[fieldName] = input.value;
    });

    try {
      if (isEdit) {
        // Update existing record
        const rowIndex = parseInt(editIndex);
        await this.updateRecord(rowIndex, formData);
      } else {
        // Insert new record
        await this.insertRecord(formData);
      }

      this.closeRecordForm();
      this.refresh();
    } catch (error: any) {
      alert(`Error saving record: ${error.message}`);
    }
  }

  // ===================
  // CRUD Operations
  // ===================

  private async insertRecord(data: DataGridRow): Promise<void> {
    const result = await databaseService.insertRecord({
      table: this.tableName,
      data,
      returnRecord: true,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to insert record');
    }
  }

  private async updateRecord(rowIndex: number, data: DataGridRow): Promise<void> {
    const oldData = this.data[rowIndex];

    const result = await databaseService.updateRecords({
      table: this.tableName,
      data,
      where: oldData,
      returnRecords: true,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to update record');
    }
  }

  private async deleteRow(rowIndex: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this record?')) {
      return;
    }

    const rowData = this.data[rowIndex];

    try {
      const result = await databaseService.deleteRecords({
        table: this.tableName,
        where: rowData,
      });

      if (result.success) {
        this.data.splice(rowIndex, 1);
        this.render();
      } else {
        alert(`Error deleting record: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error deleting record: ${error.message}`);
    }
  }

  private async deleteSelected(): Promise<void> {
    if (this.selectedRows.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${this.selectedRows.size} record(s)?`)) {
      return;
    }

    const rowsToDelete = Array.from(this.selectedRows).map(index => this.data[index]);

    try {
      const result = await databaseService.batchDelete({
        table: this.tableName,
        conditions: rowsToDelete,
      });

      if (result.success) {
        this.refresh();
      } else {
        alert(`Error deleting records: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error deleting records: ${error.message}`);
    }
  }

  // ===================
  // Export Methods
  // ===================

  private exportToCsv(): void {
    if (this.data.length === 0) return;

    const headers = this.columns.map(col => col.name);
    const csvRows = [headers.join(',')];

    this.data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        const escaped = String(value || '').replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    this.downloadFile(csvContent, `${this.tableName}_export.csv`, 'text/csv');
  }

  private exportToJson(): void {
    if (this.data.length === 0) return;

    const jsonContent = JSON.stringify(this.data, null, 2);
    this.downloadFile(jsonContent, `${this.tableName}_export.json`, 'application/json');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ===================
  // Pagination Methods
  // ===================

  private goToPage(page: number): void {
    this.currentPage = page;

    if (this.events.onPageChange) {
      this.events.onPageChange(page);
    }
  }

  // ===================
  // Utility Methods
  // ===================

  private refresh(): void {
    // Trigger a refresh by re-executing the last query
    // This would be handled by the parent CRUDPanel
    this.render();
  }

  private showError(message: string): void {
    this.container.innerHTML = `
      <div class="data-grid-error">
        <div class="error-icon">⚠️</div>
        <div class="error-message">${this.escapeHtml(message)}</div>
      </div>
    `;
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Get current data
   */
  public getData(): DataGridRow[] {
    return this.data;
  }

  /**
   * Clear the grid
   */
  public clear(): void {
    this.data = [];
    this.columns = [];
    this.selectedRows.clear();
    this.render();
  }
}
