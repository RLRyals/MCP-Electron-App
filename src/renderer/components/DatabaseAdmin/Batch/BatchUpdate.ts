/**
 * Batch Update Component
 * Handles bulk update operations with record selection and preview
 */

import { databaseService, BatchUpdateParams, QueryParams } from '../../../services/databaseService';

export interface BatchUpdateResult {
  success: boolean;
  updated: number;
  failed: number;
  errors: Array<{ condition: any; error: string }>;
  totalProcessed: number;
}

export interface BatchUpdateOptions {
  onProgress?: (progress: number, total: number) => void;
  onComplete?: (result: BatchUpdateResult) => void;
  onError?: (error: string) => void;
  batchSize?: number;
}

interface UpdateOperation {
  where: Record<string, any>;
  data: Record<string, any>;
  preview?: any;
}

export class BatchUpdate {
  private container: HTMLElement | null = null;
  private options: BatchUpdateOptions;
  private currentTable: string = '';
  private tableColumns: string[] = [];
  private selectedRecords: any[] = [];
  private updateOperations: UpdateOperation[] = [];
  private whereConditions: Record<string, any> = {};
  private updateData: Record<string, any> = {};
  private readonly DEFAULT_BATCH_SIZE = 50;

  constructor(containerId: string, options: BatchUpdateOptions = {}) {
    this.options = {
      batchSize: this.DEFAULT_BATCH_SIZE,
      ...options,
    };
    this.container = document.getElementById(containerId);
  }

  /**
   * Render the batch update interface
   */
  public render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="batch-update">
        <div class="batch-update-header">
          <h3>Bulk Update</h3>
        </div>

        <div class="batch-update-table-selector">
          <label for="batch-update-table">Target Table:</label>
          <select id="batch-update-table" class="form-select">
            <option value="">Select a table...</option>
          </select>
          <button id="batch-update-refresh-tables" class="action-button secondary small">Refresh</button>
        </div>

        <div class="batch-update-content">
          <div class="batch-update-section">
            <h4>Step 1: Select Records to Update</h4>
            <div class="where-conditions">
              <div id="where-conditions-list"></div>
              <button id="add-where-condition" class="action-button secondary small">Add Condition</button>
              <button id="preview-selection" class="action-button secondary">Preview Selection</button>
            </div>
            <div id="selection-preview" class="selection-preview"></div>
          </div>

          <div class="batch-update-section">
            <h4>Step 2: Specify Update Values</h4>
            <div class="update-fields">
              <div id="update-fields-list"></div>
              <button id="add-update-field" class="action-button secondary small">Add Field</button>
            </div>
          </div>

          <div class="batch-update-section">
            <h4>Step 3: Preview Changes</h4>
            <button id="preview-changes" class="action-button secondary">Generate Preview</button>
            <div id="changes-preview" class="changes-preview"></div>
          </div>
        </div>

        <div class="batch-update-actions">
          <button id="batch-update-execute" class="action-button primary" disabled>
            Execute Update
          </button>
          <button id="batch-update-cancel" class="action-button secondary">
            Cancel
          </button>
        </div>

        <div id="batch-update-progress" class="batch-progress" style="display: none;">
          <div class="progress-header">
            <span id="update-progress-status">Processing...</span>
            <span id="update-progress-text">0 / 0</span>
          </div>
          <div class="progress-bar">
            <div id="update-progress-fill" class="progress-fill"></div>
          </div>
        </div>

        <div id="batch-update-results" class="batch-results" style="display: none;"></div>
      </div>
    `;

    this.attachEventListeners();
    this.loadTables();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Table selector
    const tableSelect = document.getElementById('batch-update-table') as HTMLSelectElement;
    tableSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.handleTableChange(target.value);
    });

    // Refresh tables
    const refreshButton = document.getElementById('batch-update-refresh-tables');
    refreshButton?.addEventListener('click', () => this.loadTables());

    // Where conditions
    const addWhereButton = document.getElementById('add-where-condition');
    addWhereButton?.addEventListener('click', () => this.addWhereCondition());

    const previewSelectionButton = document.getElementById('preview-selection');
    previewSelectionButton?.addEventListener('click', () => this.previewSelection());

    // Update fields
    const addFieldButton = document.getElementById('add-update-field');
    addFieldButton?.addEventListener('click', () => this.addUpdateField());

    // Preview changes
    const previewChangesButton = document.getElementById('preview-changes');
    previewChangesButton?.addEventListener('click', () => this.previewChanges());

    // Execute and cancel
    const executeButton = document.getElementById('batch-update-execute');
    executeButton?.addEventListener('click', () => this.executeUpdate());

    const cancelButton = document.getElementById('batch-update-cancel');
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
    const tableSelect = document.getElementById('batch-update-table') as HTMLSelectElement;
    if (!tableSelect) return;

    tableSelect.innerHTML = '<option value="">Select a table...</option>' +
      tables.map(table => `<option value="${table}">${table}</option>`).join('');
  }

  /**
   * Handle table selection change
   */
  private async handleTableChange(tableName: string): Promise<void> {
    this.currentTable = tableName;
    this.whereConditions = {};
    this.updateData = {};
    this.selectedRecords = [];

    if (!tableName) {
      this.tableColumns = [];
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
        this.renderUpdateFields();
      }
    } catch (error: any) {
      this.options.onError?.(`Error loading columns: ${error.message}`);
    }
  }

  /**
   * Add where condition
   */
  private addWhereCondition(): void {
    if (this.tableColumns.length === 0) return;

    const conditionsList = document.getElementById('where-conditions-list');
    if (!conditionsList) return;

    const conditionId = `where-${Date.now()}`;

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

    // Attach delete listener
    const deleteButton = document.querySelector(`[data-id="${conditionId}"]`);
    deleteButton?.addEventListener('click', () => {
      document.getElementById(conditionId)?.remove();
    });
  }

  /**
   * Render where conditions
   */
  private renderWhereConditions(): void {
    const conditionsList = document.getElementById('where-conditions-list');
    if (!conditionsList) return;

    conditionsList.innerHTML = '<div class="where-hint">Add conditions to filter records to update (leave empty to update all)</div>';
  }

  /**
   * Add update field
   */
  private addUpdateField(): void {
    if (this.tableColumns.length === 0) return;

    const fieldsList = document.getElementById('update-fields-list');
    if (!fieldsList) return;

    const fieldId = `field-${Date.now()}`;

    const fieldHtml = `
      <div class="update-field-row" id="${fieldId}">
        <select class="update-field-column">
          <option value="">Select column...</option>
          ${this.tableColumns.map(col => `<option value="${col}">${col}</option>`).join('')}
        </select>
        <span class="field-equals">=</span>
        <input type="text" class="update-field-value" placeholder="New value">
        <button class="delete-field-button" data-id="${fieldId}">×</button>
      </div>
    `;

    fieldsList.insertAdjacentHTML('beforeend', fieldHtml);

    // Attach delete listener
    const deleteButton = document.querySelector(`button[data-id="${fieldId}"]`);
    deleteButton?.addEventListener('click', () => {
      document.getElementById(fieldId)?.remove();
    });
  }

  /**
   * Render update fields
   */
  private renderUpdateFields(): void {
    const fieldsList = document.getElementById('update-fields-list');
    if (!fieldsList) return;

    fieldsList.innerHTML = '<div class="update-hint">Specify which columns to update and their new values</div>';
  }

  /**
   * Preview record selection
   */
  private async previewSelection(): Promise<void> {
    const previewDiv = document.getElementById('selection-preview');
    if (!previewDiv || !this.currentTable) return;

    // Collect where conditions
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
        const totalCount = result.data.totalCount || records.length;

        this.selectedRecords = records;

        previewDiv.innerHTML = `
          <div class="preview-info">
            <strong>Selected ${totalCount} record(s)</strong>
            ${totalCount > 100 ? ' (showing first 100)' : ''}
          </div>
          ${this.renderRecordsTable(records.slice(0, 10))}
          ${records.length > 10 ? `<div class="preview-more">... and ${records.length - 10} more records in preview</div>` : ''}
        `;
      } else {
        previewDiv.innerHTML = `<div class="preview-error">Error: ${result.error || 'Failed to query records'}</div>`;
      }
    } catch (error: any) {
      previewDiv.innerHTML = `<div class="preview-error">Error: ${error.message}</div>`;
    }
  }

  /**
   * Collect where conditions from UI
   */
  private collectWhereConditions(): Record<string, any> {
    const conditions: Record<string, any> = {};
    const rows = document.querySelectorAll('.condition-row');

    rows.forEach(row => {
      const column = (row.querySelector('.condition-column') as HTMLSelectElement)?.value;
      const operator = (row.querySelector('.condition-operator') as HTMLSelectElement)?.value;
      const value = (row.querySelector('.condition-value') as HTMLInputElement)?.value;

      if (column && value) {
        // For simplicity, only support equality for now
        // A real implementation would need to handle different operators
        conditions[column] = value;
      }
    });

    return conditions;
  }

  /**
   * Collect update fields from UI
   */
  private collectUpdateFields(): Record<string, any> {
    const updates: Record<string, any> = {};
    const rows = document.querySelectorAll('.update-field-row');

    rows.forEach(row => {
      const column = (row.querySelector('.update-field-column') as HTMLSelectElement)?.value;
      const value = (row.querySelector('.update-field-value') as HTMLInputElement)?.value;

      if (column && value !== '') {
        updates[column] = value;
      }
    });

    return updates;
  }

  /**
   * Preview changes before execution
   */
  private async previewChanges(): Promise<void> {
    const previewDiv = document.getElementById('changes-preview');
    if (!previewDiv) return;

    const updateFields = this.collectUpdateFields();

    if (Object.keys(updateFields).length === 0) {
      previewDiv.innerHTML = '<div class="preview-error">Please specify at least one field to update</div>';
      return;
    }

    if (this.selectedRecords.length === 0) {
      previewDiv.innerHTML = '<div class="preview-error">Please preview selection first</div>';
      return;
    }

    // Generate preview of changes
    const previewRecords = this.selectedRecords.slice(0, 10).map(record => {
      const updated = { ...record, ...updateFields };
      return { before: record, after: updated };
    });

    previewDiv.innerHTML = `
      <div class="preview-info">
        <strong>Preview of changes (first 10 records):</strong>
      </div>
      ${this.renderChangesTable(previewRecords)}
      <div class="preview-summary">
        Will update ${this.selectedRecords.length} record(s)
      </div>
    `;

    // Enable execute button
    const executeButton = document.getElementById('batch-update-execute') as HTMLButtonElement;
    if (executeButton) {
      executeButton.disabled = false;
    }
  }

  /**
   * Render records table
   */
  private renderRecordsTable(records: any[]): string {
    if (records.length === 0) {
      return '<div class="empty-preview">No records found</div>';
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
   * Render changes comparison table
   */
  private renderChangesTable(changes: Array<{ before: any; after: any }>): string {
    if (changes.length === 0) return '';

    const updateFields = this.collectUpdateFields();
    const changedColumns = Object.keys(updateFields);

    return `
      <div class="changes-table-wrapper">
        ${changes.map((change, idx) => `
          <div class="change-item">
            <div class="change-header">Record ${idx + 1}</div>
            <table class="changes-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                ${changedColumns.map(col => `
                  <tr>
                    <td><strong>${this.escapeHtml(col)}</strong></td>
                    <td class="old-value">${this.escapeHtml(String(change.before[col] ?? ''))}</td>
                    <td class="new-value">${this.escapeHtml(String(change.after[col] ?? ''))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Execute batch update
   */
  private async executeUpdate(): Promise<void> {
    const whereConditions = this.collectWhereConditions();
    const updateFields = this.collectUpdateFields();

    if (Object.keys(updateFields).length === 0) {
      alert('Please specify fields to update');
      return;
    }

    if (!confirm(`Are you sure you want to update ${this.selectedRecords.length} record(s)?`)) {
      return;
    }

    await this.performBatchUpdate(whereConditions, updateFields);
  }

  /**
   * Perform batch update with progress tracking
   */
  private async performBatchUpdate(
    whereConditions: Record<string, any>,
    updateFields: Record<string, any>
  ): Promise<void> {
    const progressDiv = document.getElementById('batch-update-progress');
    const resultsDiv = document.getElementById('batch-update-results');
    const statusSpan = document.getElementById('update-progress-status');
    const progressText = document.getElementById('update-progress-text');
    const progressFill = document.getElementById('update-progress-fill');

    if (progressDiv) progressDiv.style.display = 'block';
    if (resultsDiv) resultsDiv.style.display = 'none';

    try {
      if (statusSpan) statusSpan.textContent = 'Updating records...';
      if (progressText) progressText.textContent = `0 / ${this.selectedRecords.length}`;

      // For bulk update, we use the batch update API
      const params: BatchUpdateParams = {
        table: this.currentTable,
        updates: [{
          where: whereConditions,
          data: updateFields,
        }],
      };

      const result = await databaseService.batchUpdate(params);

      if (progressFill) progressFill.style.width = '100%';
      if (statusSpan) statusSpan.textContent = 'Complete!';
      if (progressText) progressText.textContent = `${this.selectedRecords.length} / ${this.selectedRecords.length}`;

      this.showResults({
        success: result.success,
        updated: result.success ? this.selectedRecords.length : 0,
        failed: result.success ? 0 : this.selectedRecords.length,
        errors: result.success ? [] : [{ condition: whereConditions, error: result.error || 'Update failed' }],
        totalProcessed: this.selectedRecords.length,
      });

      this.options.onComplete?.({
        success: result.success,
        updated: result.success ? this.selectedRecords.length : 0,
        failed: result.success ? 0 : this.selectedRecords.length,
        errors: result.success ? [] : [{ condition: whereConditions, error: result.error || 'Update failed' }],
        totalProcessed: this.selectedRecords.length,
      });
    } catch (error: any) {
      this.options.onError?.(`Batch update failed: ${error.message}`);
    }
  }

  /**
   * Show update results
   */
  private showResults(result: BatchUpdateResult): void {
    const resultsDiv = document.getElementById('batch-update-results');
    if (!resultsDiv) return;

    resultsDiv.style.display = 'block';

    resultsDiv.innerHTML = `
      <div class="batch-results-summary ${result.success ? 'success' : 'partial'}">
        <h4>${result.success ? 'Success!' : 'Update completed with errors'}</h4>
        <div class="results-stats">
          <div class="stat">
            <span class="stat-label">Total Processed:</span>
            <span class="stat-value">${result.totalProcessed}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Successfully Updated:</span>
            <span class="stat-value success">${result.updated}</span>
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
    this.whereConditions = {};
    this.updateData = {};
    this.selectedRecords = [];

    const selectionPreview = document.getElementById('selection-preview');
    if (selectionPreview) selectionPreview.innerHTML = '';

    const changesPreview = document.getElementById('changes-preview');
    if (changesPreview) changesPreview.innerHTML = '';

    const resultsDiv = document.getElementById('batch-update-results');
    if (resultsDiv) resultsDiv.style.display = 'none';

    const progressDiv = document.getElementById('batch-update-progress');
    if (progressDiv) progressDiv.style.display = 'none';

    const executeButton = document.getElementById('batch-update-execute') as HTMLButtonElement;
    if (executeButton) executeButton.disabled = true;

    this.renderWhereConditions();
    this.renderUpdateFields();
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
