/**
 * Batch Delete Component
 * Handles bulk delete operations: filter-based record selection, a preview
 * of affected records before anything is removed, and a confirmation step
 * that states the exact record count. Mirrors BatchUpdate's where-condition
 * builder so the three batch operations (Insert/Update/Delete) share the
 * same interaction model.
 *
 * Transaction support: db_batch_delete (src/main/database-admin.ts ->
 * MCP-Writing-Servers) executes each condition set as a single statement on
 * the server. If the call fails, none of the matched records are removed --
 * this component treats the whole preview set as "failed" (no partial
 * credit) so the UI never implies a partial delete happened.
 */

import { databaseService, BatchDeleteParams, QueryParams } from '../../../services/databaseService.js';

export interface BatchDeleteResult {
  success: boolean;
  deleted: number;
  failed: number;
  errors: Array<{ condition: any; error: string }>;
  totalProcessed: number;
}

export interface BatchDeleteOptions {
  onComplete?: (result: BatchDeleteResult) => void;
  onError?: (error: string) => void;
}

export class BatchDelete {
  private container: HTMLElement | null = null;
  private options: BatchDeleteOptions;
  private currentTable: string = '';
  private tableColumns: string[] = [];
  private selectedRecords: any[] = [];
  private selectedTotalCount: number = 0;
  private hasPreviewed: boolean = false;

  constructor(containerId: string, options: BatchDeleteOptions = {}) {
    this.options = { ...options };
    this.container = document.getElementById(containerId);
  }

  /**
   * Render the batch delete interface
   */
  public render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="batch-delete">
        <div class="batch-delete-header">
          <h3>Bulk Delete</h3>
          <div class="delete-warning-banner">
            Deletions are permanent. Always preview the affected records before executing.
          </div>
        </div>

        <div class="batch-delete-table-selector">
          <label for="batch-delete-table">Target Table:</label>
          <select id="batch-delete-table" class="form-select">
            <option value="">Select a table...</option>
          </select>
          <button id="batch-delete-refresh-tables" class="action-button secondary small">Refresh</button>
        </div>

        <div class="batch-delete-content">
          <div class="batch-delete-section">
            <h4>Step 1: Filter Records to Delete</h4>
            <div class="where-conditions">
              <div id="delete-where-conditions-list"></div>
              <button id="add-delete-where-condition" class="action-button secondary small">Add Condition</button>
              <button id="preview-delete-selection" class="action-button secondary">Preview Affected Records</button>
            </div>
            <div id="delete-selection-preview" class="selection-preview"></div>
          </div>
        </div>

        <div class="batch-delete-actions">
          <button id="batch-delete-execute" class="action-button danger" disabled>
            Delete Records
          </button>
          <button id="batch-delete-cancel" class="action-button secondary">
            Cancel
          </button>
        </div>

        <div id="batch-delete-progress" class="batch-progress" style="display: none;">
          <div class="progress-header">
            <span id="delete-progress-status">Processing...</span>
          </div>
          <div class="progress-bar">
            <div id="delete-progress-fill" class="progress-fill"></div>
          </div>
        </div>

        <div id="batch-delete-results" class="batch-results" style="display: none;"></div>
      </div>
    `;

    this.attachEventListeners();
    this.loadTables();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const tableSelect = document.getElementById('batch-delete-table') as HTMLSelectElement;
    tableSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.handleTableChange(target.value);
    });

    const refreshButton = document.getElementById('batch-delete-refresh-tables');
    refreshButton?.addEventListener('click', () => this.loadTables());

    const addWhereButton = document.getElementById('add-delete-where-condition');
    addWhereButton?.addEventListener('click', () => this.addWhereCondition());

    const previewButton = document.getElementById('preview-delete-selection');
    previewButton?.addEventListener('click', () => this.previewSelection());

    const executeButton = document.getElementById('batch-delete-execute');
    executeButton?.addEventListener('click', () => this.executeDelete());

    const cancelButton = document.getElementById('batch-delete-cancel');
    cancelButton?.addEventListener('click', () => this.cancel());
  }

  /**
   * Load available tables
   */
  private async loadTables(): Promise<void> {
    try {
      const result = await databaseService.listTables();

      if (result.success && result.data) {
        const tables = result.data.tables || result.data;
        this.updateTableSelector(Array.isArray(tables) ? tables : []);
      } else {
        this.options.onError?.('Failed to load tables');
      }
    } catch (error: any) {
      this.options.onError?.(`Error loading tables: ${error.message}`);
    }
  }

  /**
   * Update table selector dropdown
   */
  private updateTableSelector(tables: string[]): void {
    const tableSelect = document.getElementById('batch-delete-table') as HTMLSelectElement;
    if (!tableSelect) return;

    tableSelect.innerHTML = '<option value="">Select a table...</option>' +
      tables.map(table => `<option value="${table}">${table}</option>`).join('');
  }

  /**
   * Handle table selection change
   */
  private async handleTableChange(tableName: string): Promise<void> {
    this.currentTable = tableName;
    this.selectedRecords = [];
    this.selectedTotalCount = 0;
    this.hasPreviewed = false;
    this.disableExecuteButton();

    const previewDiv = document.getElementById('delete-selection-preview');
    if (previewDiv) previewDiv.innerHTML = '';

    if (!tableName) {
      this.tableColumns = [];
      this.renderWhereConditions();
      return;
    }

    try {
      const result = await databaseService.listColumns(tableName);

      if (result.success && result.data) {
        const columns = result.data.columns || result.data;
        this.tableColumns = Array.isArray(columns)
          ? columns.map((col: any) => typeof col === 'string' ? col : col.name)
          : [];

        this.renderWhereConditions();
      }
    } catch (error: any) {
      this.options.onError?.(`Error loading columns: ${error.message}`);
    }
  }

  /**
   * Add a filter (where) condition row
   */
  private addWhereCondition(): void {
    if (this.tableColumns.length === 0) return;

    const conditionsList = document.getElementById('delete-where-conditions-list');
    if (!conditionsList) return;

    const conditionId = `delete-where-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

    const conditionHtml = `
      <div class="condition-row" id="${conditionId}">
        <select class="condition-column">
          <option value="">Select column...</option>
          ${this.tableColumns.map(col => `<option value="${col}">${col}</option>`).join('')}
        </select>
        <select class="condition-operator">
          <option value="=">=</option>
          <option value="!=">!=</option>
          <option value=">">></option>
          <option value="<"><</option>
          <option value=">=">>=</option>
          <option value="<="><=</option>
          <option value="LIKE">LIKE</option>
        </select>
        <input type="text" class="condition-value" placeholder="Value">
        <button class="delete-condition-button" data-id="${conditionId}">×</button>
      </div>
    `;

    conditionsList.insertAdjacentHTML('beforeend', conditionHtml);

    const deleteButton = conditionsList.querySelector(`[data-id="${conditionId}"]`);
    deleteButton?.addEventListener('click', () => {
      document.getElementById(conditionId)?.remove();
      this.invalidatePreview();
    });

    conditionsList.querySelectorAll('.condition-column, .condition-operator, .condition-value').forEach(input => {
      input.addEventListener('input', () => this.invalidatePreview());
      input.addEventListener('change', () => this.invalidatePreview());
    });
  }

  /**
   * Render the (empty-state) hint for the conditions list
   */
  private renderWhereConditions(): void {
    const conditionsList = document.getElementById('delete-where-conditions-list');
    if (!conditionsList) return;

    conditionsList.innerHTML = '<div class="where-hint">Add conditions to filter which records will be deleted (leave empty to target every row in the table).</div>';
  }

  /**
   * Collect filter conditions from the UI
   */
  private collectWhereConditions(): Record<string, any> {
    const conditions: Record<string, any> = {};
    const rows = document.querySelectorAll('#delete-where-conditions-list .condition-row');

    rows.forEach(row => {
      const column = (row.querySelector('.condition-column') as HTMLSelectElement)?.value;
      const value = (row.querySelector('.condition-value') as HTMLInputElement)?.value;

      if (column && value) {
        conditions[column] = value;
      }
    });

    return conditions;
  }

  /**
   * A change to the filter conditions invalidates any prior preview, so the
   * user can't execute a delete against a selection that no longer matches
   * what's on screen.
   */
  private invalidatePreview(): void {
    this.hasPreviewed = false;
    this.disableExecuteButton();
  }

  /**
   * Preview affected records (and total count) before deleting
   */
  private async previewSelection(): Promise<void> {
    const previewDiv = document.getElementById('delete-selection-preview');
    if (!previewDiv || !this.currentTable) return;

    const conditions = this.collectWhereConditions();

    try {
      const params: QueryParams = {
        table: this.currentTable,
        where: Object.keys(conditions).length > 0 ? conditions : undefined,
        limit: 100,
      };

      const result = await databaseService.queryRecords(params);

      if (result.success && result.data) {
        const records = result.data.data || [];
        const totalCount = result.data.totalCount ?? records.length;

        this.selectedRecords = records;
        this.selectedTotalCount = totalCount;
        this.hasPreviewed = true;

        previewDiv.innerHTML = `
          <div class="preview-info">
            <strong>${totalCount} record(s) will be deleted</strong>
            ${totalCount > records.length ? ` (showing first ${records.length})` : ''}
          </div>
          ${this.renderRecordsTable(records.slice(0, 10))}
          ${records.length > 10 ? `<div class="preview-more">... and ${records.length - 10} more records in preview</div>` : ''}
        `;

        this.updateExecuteButtonState();
      } else {
        this.hasPreviewed = false;
        previewDiv.innerHTML = `<div class="preview-error">Error: ${result.error || 'Failed to query records'}</div>`;
        this.disableExecuteButton();
      }
    } catch (error: any) {
      this.hasPreviewed = false;
      previewDiv.innerHTML = `<div class="preview-error">Error: ${this.escapeHtml(error.message)}</div>`;
      this.disableExecuteButton();
    }
  }

  /**
   * Render a read-only preview table of matched records
   */
  private renderRecordsTable(records: any[]): string {
    if (records.length === 0) {
      return '<div class="empty-preview">No records match this filter</div>';
    }

    const columns = Object.keys(records[0]);

    return `
      <div class="preview-table-wrapper">
        <table class="preview-table">
          <thead>
            <tr>${columns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${records.map(record => `
              <tr>
                ${columns.map(col => `<td>${this.escapeHtml(String(record[col] ?? ''))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Enable the execute button once a preview has run and matched at least
   * one record.
   */
  private updateExecuteButtonState(): void {
    const executeButton = document.getElementById('batch-delete-execute') as HTMLButtonElement;
    if (!executeButton) return;
    executeButton.disabled = !this.hasPreviewed || this.selectedTotalCount === 0;
  }

  private disableExecuteButton(): void {
    const executeButton = document.getElementById('batch-delete-execute') as HTMLButtonElement;
    if (executeButton) executeButton.disabled = true;
  }

  /**
   * Confirm (stating the exact record count) and execute the delete
   */
  private async executeDelete(): Promise<void> {
    if (!this.hasPreviewed) {
      alert('Please preview the affected records first.');
      return;
    }

    const conditions = this.collectWhereConditions();

    if (!confirm(
      `Are you sure you want to delete ${this.selectedTotalCount} record(s) from "${this.currentTable}"? This cannot be undone.`
    )) {
      return;
    }

    await this.performBatchDelete(conditions);
  }

  /**
   * Perform batch delete with progress tracking
   */
  private async performBatchDelete(conditions: Record<string, any>): Promise<void> {
    const progressDiv = document.getElementById('batch-delete-progress');
    const resultsDiv = document.getElementById('batch-delete-results');
    const statusSpan = document.getElementById('delete-progress-status');
    const progressFill = document.getElementById('delete-progress-fill');

    if (progressDiv) progressDiv.style.display = 'block';
    if (resultsDiv) resultsDiv.style.display = 'none';
    if (statusSpan) statusSpan.textContent = `Deleting ${this.selectedTotalCount} record(s)...`;
    if (progressFill) progressFill.style.width = '20%';

    const totalProcessed = this.selectedTotalCount;

    try {
      const params: BatchDeleteParams = {
        table: this.currentTable,
        conditions: [conditions],
      };

      const result = await databaseService.batchDelete(params);

      if (progressFill) progressFill.style.width = '100%';

      if (result.success) {
        if (statusSpan) statusSpan.textContent = 'Complete!';

        const finalResult: BatchDeleteResult = {
          success: true,
          deleted: totalProcessed,
          failed: 0,
          errors: [],
          totalProcessed,
        };

        this.showResults(finalResult);
        this.options.onComplete?.(finalResult);
        this.hasPreviewed = false;
        this.disableExecuteButton();
      } else {
        if (statusSpan) statusSpan.textContent = 'Failed';

        // The delete either never started or was rolled back server-side --
        // no partial credit is given.
        const finalResult: BatchDeleteResult = {
          success: false,
          deleted: 0,
          failed: totalProcessed,
          errors: [{
            condition: conditions,
            error: `${result.error || 'Delete failed'} -- transaction rolled back, no records were deleted.`,
          }],
          totalProcessed,
        };

        this.showResults(finalResult);
        this.options.onComplete?.(finalResult);
      }
    } catch (error: any) {
      if (statusSpan) statusSpan.textContent = 'Failed';

      const finalResult: BatchDeleteResult = {
        success: false,
        deleted: 0,
        failed: totalProcessed,
        errors: [{
          condition: conditions,
          error: `${error.message} -- transaction rolled back, no records were deleted.`,
        }],
        totalProcessed,
      };

      this.showResults(finalResult);
      this.options.onError?.(`Batch delete failed: ${error.message}`);
    }
  }

  /**
   * Show delete results
   */
  private showResults(result: BatchDeleteResult): void {
    const resultsDiv = document.getElementById('batch-delete-results');
    if (!resultsDiv) return;

    resultsDiv.style.display = 'block';

    resultsDiv.innerHTML = `
      <div class="batch-results-summary ${result.success ? 'success' : 'partial'}">
        <h4>${result.success ? 'Deleted successfully' : 'Delete failed'}</h4>
        <div class="results-stats">
          <div class="stat">
            <span class="stat-label">Total Processed:</span>
            <span class="stat-value">${result.totalProcessed}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Successfully Deleted:</span>
            <span class="stat-value success">${result.deleted}</span>
          </div>
          ${result.failed > 0 ? `
          <div class="stat">
            <span class="stat-label">Failed:</span>
            <span class="stat-value error">${result.failed}</span>
          </div>
          ` : ''}
        </div>
        ${result.errors.length > 0 ? `
        <div class="results-errors">
          <h5>Errors:</h5>
          <ul>
            ${result.errors.map(err => `<li>${this.escapeHtml(err.error)}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Cancel and reset
   */
  private cancel(): void {
    this.selectedRecords = [];
    this.selectedTotalCount = 0;
    this.hasPreviewed = false;

    const conditionsList = document.getElementById('delete-where-conditions-list');
    if (conditionsList) this.renderWhereConditions();

    const previewDiv = document.getElementById('delete-selection-preview');
    if (previewDiv) previewDiv.innerHTML = '';

    const resultsDiv = document.getElementById('batch-delete-results');
    if (resultsDiv) resultsDiv.style.display = 'none';

    const progressDiv = document.getElementById('batch-delete-progress');
    if (progressDiv) progressDiv.style.display = 'none';

    this.disableExecuteButton();
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
}
