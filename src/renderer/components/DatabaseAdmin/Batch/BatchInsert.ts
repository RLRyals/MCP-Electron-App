/**
 * Batch Insert Component
 * Handles bulk insert operations with CSV, manual entry, and JSON input
 */

import { CSVUploader, CSVParseResult } from './CSVUploader';
import { databaseService, BatchInsertParams } from '../../../services/databaseService';

export interface BatchInsertResult {
  success: boolean;
  inserted: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  totalProcessed: number;
}

export interface BatchInsertOptions {
  onProgress?: (progress: number, total: number) => void;
  onComplete?: (result: BatchInsertResult) => void;
  onError?: (error: string) => void;
  batchSize?: number;
}

export type InsertMode = 'csv' | 'manual' | 'json';

export class BatchInsert {
  private container: HTMLElement | null = null;
  private options: BatchInsertOptions;
  private csvUploader: CSVUploader | null = null;
  private currentMode: InsertMode = 'csv';
  private currentTable: string = '';
  private tableColumns: string[] = [];
  private manualData: Array<Record<string, any>> = [];
  private columnMapping: Map<string, string> = new Map();
  private readonly DEFAULT_BATCH_SIZE = 100;

  constructor(containerId: string, options: BatchInsertOptions = {}) {
    this.options = {
      batchSize: this.DEFAULT_BATCH_SIZE,
      ...options,
    };
    this.container = document.getElementById(containerId);
  }

  /**
   * Render the batch insert interface
   */
  public render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="batch-insert">
        <div class="batch-insert-header">
          <h3>Bulk Insert</h3>
          <div class="batch-insert-mode-selector">
            <button class="mode-button active" data-mode="csv">CSV Upload</button>
            <button class="mode-button" data-mode="manual">Manual Entry</button>
            <button class="mode-button" data-mode="json">JSON Paste</button>
          </div>
        </div>

        <div class="batch-insert-table-selector">
          <label for="batch-insert-table">Target Table:</label>
          <select id="batch-insert-table" class="form-select">
            <option value="">Select a table...</option>
          </select>
          <button id="batch-refresh-tables" class="action-button secondary small">Refresh</button>
        </div>

        <div class="batch-insert-content">
          <div id="batch-insert-csv" class="batch-insert-mode-panel active">
            <div id="csv-uploader-container"></div>
          </div>

          <div id="batch-insert-manual" class="batch-insert-mode-panel">
            <div class="manual-entry-controls">
              <button id="batch-add-row" class="action-button secondary">Add Row</button>
              <button id="batch-clear-rows" class="action-button secondary">Clear All</button>
              <span class="manual-entry-count">Rows: <span id="manual-row-count">0</span></span>
            </div>
            <div id="manual-entry-grid" class="manual-entry-grid"></div>
          </div>

          <div id="batch-insert-json" class="batch-insert-mode-panel">
            <div class="json-paste-instructions">
              Paste JSON array of objects (e.g., <code>[{"col1": "val1", "col2": "val2"}, ...]</code>)
            </div>
            <textarea id="json-paste-area" class="json-paste-area" placeholder='[&#10;  {"column1": "value1", "column2": "value2"},&#10;  {"column1": "value3", "column2": "value4"}&#10;]'></textarea>
            <button id="json-parse-button" class="action-button secondary">Parse JSON</button>
            <div id="json-parse-result"></div>
          </div>
        </div>

        <div id="batch-column-mapping" class="batch-column-mapping" style="display: none;">
          <h4>Column Mapping</h4>
          <div class="column-mapping-hint">Map source columns to table columns:</div>
          <div id="column-mapping-grid"></div>
        </div>

        <div class="batch-insert-actions">
          <button id="batch-insert-execute" class="action-button primary" disabled>
            Insert Records
          </button>
          <button id="batch-insert-cancel" class="action-button secondary">
            Cancel
          </button>
        </div>

        <div id="batch-insert-progress" class="batch-progress" style="display: none;">
          <div class="progress-header">
            <span id="progress-status">Processing...</span>
            <span id="progress-text">0 / 0</span>
          </div>
          <div class="progress-bar">
            <div id="progress-fill" class="progress-fill"></div>
          </div>
        </div>

        <div id="batch-insert-results" class="batch-results" style="display: none;"></div>
      </div>
    `;

    this.attachEventListeners();
    this.initializeCSVUploader();
    this.loadTables();
  }

  /**
   * Initialize CSV uploader
   */
  private initializeCSVUploader(): void {
    this.csvUploader = new CSVUploader('csv-uploader-container', {
      onParsed: (result: CSVParseResult) => {
        if (result.success && result.data.length > 0) {
          this.handleCSVParsed(result);
        }
      },
      onError: (error: string) => {
        this.options.onError?.(error);
      },
    });

    this.csvUploader.render();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Mode selector
    const modeButtons = this.container?.querySelectorAll('.mode-button');
    modeButtons?.forEach(button => {
      button.addEventListener('click', () => {
        const mode = button.getAttribute('data-mode') as InsertMode;
        this.switchMode(mode);
      });
    });

    // Table selector
    const tableSelect = document.getElementById('batch-insert-table') as HTMLSelectElement;
    tableSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.handleTableChange(target.value);
    });

    // Refresh tables
    const refreshButton = document.getElementById('batch-refresh-tables');
    refreshButton?.addEventListener('click', () => this.loadTables());

    // Manual entry controls
    const addRowButton = document.getElementById('batch-add-row');
    addRowButton?.addEventListener('click', () => this.addManualRow());

    const clearRowsButton = document.getElementById('batch-clear-rows');
    clearRowsButton?.addEventListener('click', () => this.clearManualRows());

    // JSON parse
    const jsonParseButton = document.getElementById('json-parse-button');
    jsonParseButton?.addEventListener('click', () => this.parseJSON());

    // Execute and cancel
    const executeButton = document.getElementById('batch-insert-execute');
    executeButton?.addEventListener('click', () => this.executeInsert());

    const cancelButton = document.getElementById('batch-insert-cancel');
    cancelButton?.addEventListener('click', () => this.cancel());
  }

  /**
   * Switch between input modes
   */
  private switchMode(mode: InsertMode): void {
    this.currentMode = mode;

    // Update button states
    const modeButtons = this.container?.querySelectorAll('.mode-button');
    modeButtons?.forEach(button => {
      if (button.getAttribute('data-mode') === mode) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    // Update panel visibility
    const panels = this.container?.querySelectorAll('.batch-insert-mode-panel');
    panels?.forEach(panel => {
      panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`batch-insert-${mode}`);
    activePanel?.classList.add('active');
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
    const tableSelect = document.getElementById('batch-insert-table') as HTMLSelectElement;
    if (!tableSelect) return;

    tableSelect.innerHTML = '<option value="">Select a table...</option>' +
      tables.map(table => `<option value="${table}">${table}</option>`).join('');
  }

  /**
   * Handle table selection change
   */
  private async handleTableChange(tableName: string): Promise<void> {
    this.currentTable = tableName;

    if (!tableName) {
      this.tableColumns = [];
      this.disableInsertButton();
      return;
    }

    try {
      const result = await databaseService.listColumns(tableName);

      if (result.success && result.data) {
        const columns = result.data.columns || result.data;
        this.tableColumns = Array.isArray(columns)
          ? columns.map((col: any) => typeof col === 'string' ? col : col.name)
          : [];

        this.updateManualEntryGrid();
        this.checkReadyToInsert();
      }
    } catch (error: any) {
      this.options.onError?.(`Error loading columns: ${error.message}`);
    }
  }

  /**
   * Handle CSV parsed
   */
  private handleCSVParsed(result: CSVParseResult): void {
    if (this.tableColumns.length > 0) {
      this.showColumnMapping(result.headers);
    }
    this.checkReadyToInsert();
  }

  /**
   * Show column mapping interface
   */
  private showColumnMapping(sourceColumns: string[]): void {
    const mappingSection = document.getElementById('batch-column-mapping');
    const mappingGrid = document.getElementById('column-mapping-grid');

    if (!mappingSection || !mappingGrid) return;

    mappingSection.style.display = 'block';

    this.columnMapping.clear();

    // Auto-map exact matches
    sourceColumns.forEach(sourceCol => {
      const match = this.tableColumns.find(
        tableCol => tableCol.toLowerCase() === sourceCol.toLowerCase()
      );
      if (match) {
        this.columnMapping.set(sourceCol, match);
      }
    });

    // Render mapping grid
    mappingGrid.innerHTML = sourceColumns.map(sourceCol => `
      <div class="column-mapping-row">
        <div class="source-column">${this.escapeHtml(sourceCol)}</div>
        <div class="mapping-arrow">→</div>
        <select class="target-column-select" data-source="${sourceCol}">
          <option value="">Skip this column</option>
          ${this.tableColumns.map(tableCol => `
            <option value="${tableCol}" ${this.columnMapping.get(sourceCol) === tableCol ? 'selected' : ''}>
              ${tableCol}
            </option>
          `).join('')}
        </select>
      </div>
    `).join('');

    // Add change listeners
    const selects = mappingGrid.querySelectorAll('.target-column-select');
    selects.forEach(select => {
      select.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const sourceCol = target.getAttribute('data-source');
        if (sourceCol) {
          if (target.value) {
            this.columnMapping.set(sourceCol, target.value);
          } else {
            this.columnMapping.delete(sourceCol);
          }
        }
      });
    });
  }

  /**
   * Update manual entry grid
   */
  private updateManualEntryGrid(): void {
    const grid = document.getElementById('manual-entry-grid');
    if (!grid || this.tableColumns.length === 0) return;

    const headers = this.tableColumns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('');

    const rows = this.manualData.map((row, rowIndex) => `
      <tr>
        ${this.tableColumns.map(col => `
          <td>
            <input type="text"
              class="manual-cell-input"
              data-row="${rowIndex}"
              data-col="${col}"
              value="${this.escapeHtml(String(row[col] ?? ''))}"
              placeholder="${col}">
          </td>
        `).join('')}
        <td>
          <button class="delete-row-button" data-row="${rowIndex}" title="Delete row">×</button>
        </td>
      </tr>
    `).join('');

    grid.innerHTML = `
      <div class="manual-grid-wrapper">
        <table class="manual-entry-table">
          <thead>
            <tr>${headers}<th>Actions</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="100" class="empty-grid">Click "Add Row" to start</td></tr>'}</tbody>
        </table>
      </div>
    `;

    // Attach input listeners
    const inputs = grid.querySelectorAll('.manual-cell-input');
    inputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const rowIndex = parseInt(target.getAttribute('data-row') || '0');
        const col = target.getAttribute('data-col') || '';
        if (this.manualData[rowIndex]) {
          this.manualData[rowIndex][col] = target.value;
        }
      });
    });

    // Attach delete listeners
    const deleteButtons = grid.querySelectorAll('.delete-row-button');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const rowIndex = parseInt(target.getAttribute('data-row') || '0');
        this.deleteManualRow(rowIndex);
      });
    });

    this.updateManualRowCount();
  }

  /**
   * Add a manual entry row
   */
  private addManualRow(): void {
    const newRow: Record<string, any> = {};
    this.tableColumns.forEach(col => {
      newRow[col] = '';
    });
    this.manualData.push(newRow);
    this.updateManualEntryGrid();
    this.checkReadyToInsert();
  }

  /**
   * Delete a manual entry row
   */
  private deleteManualRow(index: number): void {
    this.manualData.splice(index, 1);
    this.updateManualEntryGrid();
    this.checkReadyToInsert();
  }

  /**
   * Clear all manual rows
   */
  private clearManualRows(): void {
    this.manualData = [];
    this.updateManualEntryGrid();
    this.checkReadyToInsert();
  }

  /**
   * Update manual row count display
   */
  private updateManualRowCount(): void {
    const countElement = document.getElementById('manual-row-count');
    if (countElement) {
      countElement.textContent = String(this.manualData.length);
    }
  }

  /**
   * Parse JSON input
   */
  private parseJSON(): void {
    const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
    const resultDiv = document.getElementById('json-parse-result');

    if (!textarea || !resultDiv) return;

    try {
      const json = JSON.parse(textarea.value);

      if (!Array.isArray(json)) {
        resultDiv.innerHTML = '<div class="json-error">Error: Input must be a JSON array</div>';
        return;
      }

      if (json.length === 0) {
        resultDiv.innerHTML = '<div class="json-error">Error: Array is empty</div>';
        return;
      }

      // Extract headers from first object
      const headers = Object.keys(json[0]);

      if (this.tableColumns.length > 0) {
        this.showColumnMapping(headers);
      }

      resultDiv.innerHTML = `
        <div class="json-success">
          Successfully parsed ${json.length} records with ${headers.length} columns
        </div>
      `;

      this.checkReadyToInsert();
    } catch (error: any) {
      resultDiv.innerHTML = `<div class="json-error">Parse error: ${this.escapeHtml(error.message)}</div>`;
    }
  }

  /**
   * Check if ready to insert and enable/disable button
   */
  private checkReadyToInsert(): void {
    const executeButton = document.getElementById('batch-insert-execute') as HTMLButtonElement;
    if (!executeButton) return;

    let hasData = false;

    if (this.currentMode === 'csv' && this.csvUploader?.getCurrentFile()) {
      hasData = true;
    } else if (this.currentMode === 'manual' && this.manualData.length > 0) {
      hasData = true;
    } else if (this.currentMode === 'json') {
      const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
      try {
        const json = JSON.parse(textarea?.value || '');
        hasData = Array.isArray(json) && json.length > 0;
      } catch {
        hasData = false;
      }
    }

    executeButton.disabled = !hasData || !this.currentTable;
  }

  /**
   * Disable insert button
   */
  private disableInsertButton(): void {
    const executeButton = document.getElementById('batch-insert-execute') as HTMLButtonElement;
    if (executeButton) {
      executeButton.disabled = true;
    }
  }

  /**
   * Execute batch insert
   */
  private async executeInsert(): Promise<void> {
    let records: Array<Record<string, any>> = [];

    // Get records based on current mode
    if (this.currentMode === 'csv') {
      const file = this.csvUploader?.getCurrentFile();
      if (!file) return;

      const text = await file.text();
      const parsed = this.csvUploader?.parseText(text);
      if (!parsed || !parsed.success) return;

      // Apply column mapping
      records = this.applyColumnMapping(parsed.data);
    } else if (this.currentMode === 'manual') {
      records = this.manualData.filter(row => {
        return Object.values(row).some(val => val !== '');
      });
    } else if (this.currentMode === 'json') {
      const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
      try {
        const json = JSON.parse(textarea.value);
        records = Array.isArray(json) ? this.applyColumnMapping(json) : [];
      } catch {
        return;
      }
    }

    if (records.length === 0) {
      alert('No records to insert');
      return;
    }

    await this.performBatchInsert(records);
  }

  /**
   * Apply column mapping to records
   */
  private applyColumnMapping(records: Array<Record<string, any>>): Array<Record<string, any>> {
    if (this.columnMapping.size === 0) {
      return records;
    }

    return records.map(record => {
      const mappedRecord: Record<string, any> = {};
      this.columnMapping.forEach((targetCol, sourceCol) => {
        if (record.hasOwnProperty(sourceCol)) {
          mappedRecord[targetCol] = record[sourceCol];
        }
      });
      return mappedRecord;
    });
  }

  /**
   * Perform batch insert with progress tracking
   */
  private async performBatchInsert(records: Array<Record<string, any>>): Promise<void> {
    const progressDiv = document.getElementById('batch-insert-progress');
    const resultsDiv = document.getElementById('batch-insert-results');
    const statusSpan = document.getElementById('progress-status');
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');

    if (progressDiv) progressDiv.style.display = 'block';
    if (resultsDiv) resultsDiv.style.display = 'none';

    const batchSize = this.options.batchSize || this.DEFAULT_BATCH_SIZE;
    const totalRecords = records.length;
    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    try {
      // Process in batches
      for (let i = 0; i < totalRecords; i += batchSize) {
        const batch = records.slice(i, Math.min(i + batchSize, totalRecords));

        // Update progress
        if (statusSpan) statusSpan.textContent = `Inserting batch ${Math.floor(i / batchSize) + 1}...`;
        if (progressText) progressText.textContent = `${processedCount} / ${totalRecords}`;
        if (progressFill) {
          progressFill.style.width = `${(processedCount / totalRecords) * 100}%`;
        }

        this.options.onProgress?.(processedCount, totalRecords);

        // Execute batch insert
        const params: BatchInsertParams = {
          table: this.currentTable,
          records: batch,
        };

        try {
          const result = await databaseService.batchInsert(params);

          if (result.success) {
            successCount += batch.length;
          } else {
            failureCount += batch.length;
            batch.forEach((_, idx) => {
              errors.push({
                row: i + idx + 1,
                error: result.error || 'Unknown error',
              });
            });
          }
        } catch (error: any) {
          failureCount += batch.length;
          batch.forEach((_, idx) => {
            errors.push({
              row: i + idx + 1,
              error: error.message,
            });
          });
        }

        processedCount += batch.length;
      }

      // Final update
      if (statusSpan) statusSpan.textContent = 'Complete!';
      if (progressText) progressText.textContent = `${totalRecords} / ${totalRecords}`;
      if (progressFill) progressFill.style.width = '100%';

      // Show results
      this.showResults({
        success: failureCount === 0,
        inserted: successCount,
        failed: failureCount,
        errors,
        totalProcessed: processedCount,
      });

      this.options.onComplete?.({
        success: failureCount === 0,
        inserted: successCount,
        failed: failureCount,
        errors,
        totalProcessed: processedCount,
      });
    } catch (error: any) {
      this.options.onError?.(`Batch insert failed: ${error.message}`);
    }
  }

  /**
   * Show insert results
   */
  private showResults(result: BatchInsertResult): void {
    const resultsDiv = document.getElementById('batch-insert-results');
    if (!resultsDiv) return;

    resultsDiv.style.display = 'block';

    const errorList = result.errors.slice(0, 10).map(err =>
      `<li>Row ${err.row}: ${this.escapeHtml(err.error)}</li>`
    ).join('');

    const hasMoreErrors = result.errors.length > 10;

    resultsDiv.innerHTML = `
      <div class="batch-results-summary ${result.success ? 'success' : 'partial'}">
        <h4>${result.success ? 'Success!' : 'Completed with errors'}</h4>
        <div class="results-stats">
          <div class="stat">
            <span class="stat-label">Total Processed:</span>
            <span class="stat-value">${result.totalProcessed}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Successfully Inserted:</span>
            <span class="stat-value success">${result.inserted}</span>
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
          <ul>${errorList}</ul>
          ${hasMoreErrors ? `<div class="more-errors">... and ${result.errors.length - 10} more errors</div>` : ''}
        </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Cancel and reset
   */
  private cancel(): void {
    this.csvUploader?.clearFile();
    this.clearManualRows();
    const textarea = document.getElementById('json-paste-area') as HTMLTextAreaElement;
    if (textarea) textarea.value = '';

    const resultsDiv = document.getElementById('batch-insert-results');
    if (resultsDiv) resultsDiv.style.display = 'none';

    const progressDiv = document.getElementById('batch-insert-progress');
    if (progressDiv) progressDiv.style.display = 'none';

    const mappingSection = document.getElementById('batch-column-mapping');
    if (mappingSection) mappingSection.style.display = 'none';

    this.columnMapping.clear();
    this.checkReadyToInsert();
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
