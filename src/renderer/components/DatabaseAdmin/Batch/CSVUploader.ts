/**
 * CSV Uploader Component
 * Handles CSV file upload with drag & drop functionality and parsing
 */

export interface CSVParseResult {
  success: boolean;
  data: Record<string, any>[];
  headers: string[];
  error?: string;
  rowCount: number;
}

export interface CSVUploadOptions {
  onFileSelected?: (file: File) => void;
  onParsed?: (result: CSVParseResult) => void;
  onError?: (error: string) => void;
  maxFileSize?: number; // in bytes
  acceptedExtensions?: string[];
}

export class CSVUploader {
  private container: HTMLElement | null = null;
  private options: CSVUploadOptions;
  private currentFile: File | null = null;
  private readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly DEFAULT_EXTENSIONS = ['.csv', '.txt'];

  constructor(containerId: string, options: CSVUploadOptions = {}) {
    this.options = {
      maxFileSize: this.DEFAULT_MAX_SIZE,
      acceptedExtensions: this.DEFAULT_EXTENSIONS,
      ...options,
    };
    this.container = document.getElementById(containerId);
  }

  /**
   * Render the CSV uploader interface
   */
  public render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="csv-uploader">
        <div class="csv-upload-area" id="csv-drop-zone">
          <div class="csv-upload-icon">📁</div>
          <div class="csv-upload-text">
            <strong>Drop CSV file here</strong> or <label class="csv-upload-link" for="csv-file-input">browse</label>
          </div>
          <div class="csv-upload-hint">
            Supported: CSV files up to ${this.formatFileSize(this.options.maxFileSize || this.DEFAULT_MAX_SIZE)}
          </div>
          <input type="file" id="csv-file-input" accept=".csv,.txt" style="display: none;">
        </div>
        <div class="csv-preview" id="csv-preview" style="display: none;">
          <div class="csv-preview-header">
            <h4>File Preview</h4>
            <button id="csv-clear-file" class="action-button secondary small">Clear</button>
          </div>
          <div class="csv-file-info" id="csv-file-info"></div>
          <div class="csv-preview-content" id="csv-preview-content"></div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners for file upload
   */
  private attachEventListeners(): void {
    const dropZone = document.getElementById('csv-drop-zone');
    const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
    const clearButton = document.getElementById('csv-clear-file');

    if (dropZone) {
      // Drag and drop events
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('csv-dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('csv-dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('csv-dragover');

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          this.handleFile(files[0]);
        }
      });

      // Click to upload
      dropZone.addEventListener('click', () => {
        fileInput?.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          this.handleFile(target.files[0]);
        }
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearFile();
      });
    }
  }

  /**
   * Handle file selection
   */
  private handleFile(file: File): void {
    // Validate file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!this.options.acceptedExtensions?.includes(extension)) {
      this.handleError(`Invalid file type. Please upload a CSV file.`);
      return;
    }

    // Validate file size
    if (file.size > (this.options.maxFileSize || this.DEFAULT_MAX_SIZE)) {
      this.handleError(`File too large. Maximum size is ${this.formatFileSize(this.options.maxFileSize || this.DEFAULT_MAX_SIZE)}`);
      return;
    }

    this.currentFile = file;
    this.options.onFileSelected?.(file);
    this.parseCSV(file);
  }

  /**
   * Parse CSV file
   */
  private async parseCSV(file: File): Promise<void> {
    try {
      const text = await file.text();
      const result = this.parseCSVText(text);

      if (result.success) {
        this.displayPreview(file, result);
        this.options.onParsed?.(result);
      } else {
        this.handleError(result.error || 'Failed to parse CSV file');
      }
    } catch (error: any) {
      this.handleError(`Error reading file: ${error.message}`);
    }
  }

  /**
   * Parse CSV text content
   */
  private parseCSVText(text: string): CSVParseResult {
    try {
      const lines = text.split('\n').filter(line => line.trim() !== '');

      if (lines.length === 0) {
        return {
          success: false,
          data: [],
          headers: [],
          error: 'CSV file is empty',
          rowCount: 0,
        };
      }

      // Parse headers
      const headers = this.parseCSVLine(lines[0]);

      if (headers.length === 0) {
        return {
          success: false,
          data: [],
          headers: [],
          error: 'CSV file has no headers',
          rowCount: 0,
        };
      }

      // Parse data rows
      const data: Record<string, any>[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);

        if (values.length === 0) continue; // Skip empty lines

        if (values.length !== headers.length) {
          errors.push(`Row ${i}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
          continue;
        }

        const row: Record<string, any> = {};
        headers.forEach((header, index) => {
          row[header] = this.parseValue(values[index]);
        });

        data.push(row);
      }

      return {
        success: true,
        data,
        headers,
        rowCount: data.length,
        error: errors.length > 0 ? `Parsed with warnings:\n${errors.slice(0, 5).join('\n')}` : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        headers: [],
        error: error.message,
        rowCount: 0,
      };
    }
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quotes
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current.trim());

    return result;
  }

  /**
   * Parse value with type detection
   */
  private parseValue(value: string): any {
    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    // Empty value
    if (value === '' || value.toLowerCase() === 'null') {
      return null;
    }

    // Boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Number
    if (!isNaN(Number(value)) && value !== '') {
      return Number(value);
    }

    // String
    return value;
  }

  /**
   * Display file preview
   */
  private displayPreview(file: File, result: CSVParseResult): void {
    const preview = document.getElementById('csv-preview');
    const fileInfo = document.getElementById('csv-file-info');
    const previewContent = document.getElementById('csv-preview-content');

    if (!preview || !fileInfo || !previewContent) return;

    // Show preview section
    preview.style.display = 'block';

    // Display file info
    fileInfo.innerHTML = `
      <div class="csv-file-details">
        <div><strong>File:</strong> ${this.escapeHtml(file.name)}</div>
        <div><strong>Size:</strong> ${this.formatFileSize(file.size)}</div>
        <div><strong>Rows:</strong> ${result.rowCount}</div>
        <div><strong>Columns:</strong> ${result.headers.length}</div>
      </div>
    `;

    if (result.error) {
      fileInfo.innerHTML += `<div class="csv-warning">${this.escapeHtml(result.error)}</div>`;
    }

    // Display preview table (first 10 rows)
    const previewRows = result.data.slice(0, 10);
    const hasMore = result.data.length > 10;

    previewContent.innerHTML = `
      <div class="csv-table-wrapper">
        <table class="csv-preview-table">
          <thead>
            <tr>
              ${result.headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${previewRows.map(row => `
              <tr>
                ${result.headers.map(h => `<td>${this.escapeHtml(String(row[h] ?? ''))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${hasMore ? `<div class="csv-preview-more">... and ${result.data.length - 10} more rows</div>` : ''}
      </div>
    `;
  }

  /**
   * Clear current file
   */
  public clearFile(): void {
    this.currentFile = null;
    const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    const preview = document.getElementById('csv-preview');
    if (preview) {
      preview.style.display = 'none';
    }
  }

  /**
   * Get current file
   */
  public getCurrentFile(): File | null {
    return this.currentFile;
  }

  /**
   * Handle error
   */
  private handleError(error: string): void {
    this.options.onError?.(error);
    alert(error);
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
   * Parse CSV text and return result (public method for external use)
   */
  public parseText(text: string): CSVParseResult {
    return this.parseCSVText(text);
  }
}
