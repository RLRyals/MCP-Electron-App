/**
 * BackupWizard Component
 * Interactive wizard for creating database backups
 *
 * Features:
 * - Full database or table-level backup selection
 * - Multi-select table picker
 * - Incremental backup support
 * - Custom naming
 * - Compression options
 * - Progress tracking
 */

export interface BackupOptions {
  type: 'full' | 'tables' | 'incremental';
  tables?: string[];
  customName?: string;
  compressed: boolean;
  customPath?: string;
}

export interface BackupWizardCallbacks {
  onStart: (options: BackupOptions) => Promise<void>;
  onCancel: () => void;
  onGetTables: () => Promise<string[]>;
}

export class BackupWizard {
  private container: HTMLElement | null = null;
  private currentStep: number = 1;
  private availableTables: string[] = [];
  private selectedTables: Set<string> = new Set();
  private callbacks: BackupWizardCallbacks;
  private options: BackupOptions = {
    type: 'full',
    compressed: true,
  };
  private isCreating: boolean = false;

  constructor(callbacks: BackupWizardCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Show the wizard
   */
  public async show(container: HTMLElement): Promise<void> {
    this.container = container;
    this.currentStep = 1;
    this.isCreating = false;

    // Load available tables
    try {
      this.availableTables = await this.callbacks.onGetTables();
    } catch (error) {
      console.error('Failed to load tables:', error);
      this.availableTables = [];
    }

    this.render();
  }

  /**
   * Hide the wizard
   */
  public hide(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.reset();
  }

  /**
   * Reset wizard state
   */
  private reset(): void {
    this.currentStep = 1;
    this.selectedTables.clear();
    this.options = {
      type: 'full',
      compressed: true,
    };
    this.isCreating = false;
  }

  /**
   * Render the wizard
   */
  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="backup-wizard-overlay">
        <div class="backup-wizard-modal">
          ${this.renderHeader()}
          ${this.renderStepIndicator()}
          ${this.renderCurrentStep()}
          ${this.renderFooter()}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render header
   */
  private renderHeader(): string {
    return `
      <div class="wizard-header">
        <h2>Create Database Backup</h2>
        <button class="wizard-close-btn" id="wizard-close-btn">&times;</button>
      </div>
    `;
  }

  /**
   * Render step indicator
   */
  private renderStepIndicator(): string {
    const steps = [
      { num: 1, label: 'Backup Type' },
      { num: 2, label: 'Configuration' },
      { num: 3, label: 'Confirm & Create' }
    ];

    const stepsHtml = steps.map(step => `
      <div class="wizard-step ${step.num === this.currentStep ? 'active' : ''} ${step.num < this.currentStep ? 'completed' : ''}">
        <div class="step-number">${step.num}</div>
        <div class="step-label">${step.label}</div>
      </div>
    `).join('');

    return `
      <div class="wizard-steps">
        ${stepsHtml}
      </div>
    `;
  }

  /**
   * Render current step content
   */
  private renderCurrentStep(): string {
    switch (this.currentStep) {
      case 1:
        return this.renderStep1();
      case 2:
        return this.renderStep2();
      case 3:
        return this.renderStep3();
      default:
        return '';
    }
  }

  /**
   * Render Step 1: Backup Type Selection
   */
  private renderStep1(): string {
    return `
      <div class="wizard-content">
        <h3>Select Backup Type</h3>
        <p>Choose what you want to backup</p>

        <div class="backup-type-options">
          <label class="backup-type-option ${this.options.type === 'full' ? 'selected' : ''}">
            <input type="radio" name="backup-type" value="full" ${this.options.type === 'full' ? 'checked' : ''} />
            <div class="option-content">
              <div class="option-icon">🗄️</div>
              <div class="option-details">
                <strong>Full Database Backup</strong>
                <p>Backup the entire database including all tables, data, and schema</p>
              </div>
            </div>
          </label>

          <label class="backup-type-option ${this.options.type === 'tables' ? 'selected' : ''}">
            <input type="radio" name="backup-type" value="tables" ${this.options.type === 'tables' ? 'checked' : ''} />
            <div class="option-content">
              <div class="option-icon">📊</div>
              <div class="option-details">
                <strong>Table-Level Backup</strong>
                <p>Select specific tables to backup</p>
              </div>
            </div>
          </label>

          <label class="backup-type-option ${this.options.type === 'incremental' ? 'selected' : ''} option-disabled">
            <input type="radio" name="backup-type" value="incremental" disabled />
            <div class="option-content">
              <div class="option-icon">📈</div>
              <div class="option-details">
                <strong>Incremental Backup</strong>
                <p>Backup only changes since last backup (Coming soon)</p>
              </div>
            </div>
          </label>
        </div>
      </div>
    `;
  }

  /**
   * Render Step 2: Configuration
   */
  private renderStep2(): string {
    if (this.options.type === 'tables') {
      return this.renderTableSelection();
    } else {
      return this.renderFullBackupConfig();
    }
  }

  /**
   * Render table selection for table-level backup
   */
  private renderTableSelection(): string {
    const tablesHtml = this.availableTables.map(table => `
      <label class="table-checkbox-item">
        <input
          type="checkbox"
          class="table-checkbox"
          value="${this.escapeHtml(table)}"
          ${this.selectedTables.has(table) ? 'checked' : ''}
        />
        <span class="table-name">${this.escapeHtml(table)}</span>
      </label>
    `).join('');

    return `
      <div class="wizard-content">
        <h3>Select Tables</h3>
        <p>Choose which tables to include in the backup</p>

        <div class="table-selection-controls">
          <button class="btn-secondary btn-small" id="select-all-tables">Select All</button>
          <button class="btn-secondary btn-small" id="deselect-all-tables">Deselect All</button>
          <div class="selected-count">
            <span id="selected-table-count">${this.selectedTables.size}</span> of ${this.availableTables.length} selected
          </div>
        </div>

        <div class="table-selection-list">
          ${tablesHtml || '<p class="empty-message">No tables found in database</p>'}
        </div>

        ${this.renderCompressionOption()}
      </div>
    `;
  }

  /**
   * Render full backup configuration
   */
  private renderFullBackupConfig(): string {
    return `
      <div class="wizard-content">
        <h3>Backup Configuration</h3>
        <p>Configure backup settings</p>

        <div class="config-section">
          <label class="config-label">Custom Backup Name (Optional)</label>
          <input
            type="text"
            id="backup-custom-name"
            class="config-input"
            placeholder="Leave empty for auto-generated name"
            value="${this.options.customName || ''}"
          />
          <small class="config-hint">If empty, backup will be named automatically with timestamp</small>
        </div>

        ${this.renderCompressionOption()}
        ${this.renderCustomPathOption()}
      </div>
    `;
  }

  /**
   * Render compression option
   */
  private renderCompressionOption(): string {
    return `
      <div class="config-section">
        <label class="config-checkbox-label">
          <input
            type="checkbox"
            id="backup-compressed"
            ${this.options.compressed ? 'checked' : ''}
          />
          <span>Compress backup file</span>
        </label>
        <small class="config-hint">Recommended for saving disk space</small>
      </div>
    `;
  }

  /**
   * Render custom path option
   */
  private renderCustomPathOption(): string {
    return `
      <div class="config-section">
        <label class="config-label">Custom Save Location (Optional)</label>
        <div class="config-input-group">
          <input
            type="text"
            id="backup-custom-path"
            class="config-input"
            placeholder="Default backup directory"
            value="${this.options.customPath || ''}"
            readonly
          />
          <button class="btn-secondary" id="select-backup-path">Browse...</button>
        </div>
        <small class="config-hint">Leave empty to use default backup directory</small>
      </div>
    `;
  }

  /**
   * Render Step 3: Confirmation
   */
  private renderStep3(): string {
    const summaryItems: string[] = [];

    // Backup type
    if (this.options.type === 'full') {
      summaryItems.push('Full database backup');
    } else if (this.options.type === 'tables') {
      summaryItems.push(`${this.selectedTables.size} table(s) selected`);
    }

    // Compression
    summaryItems.push(this.options.compressed ? 'Compressed format' : 'Plain SQL format');

    // Custom name
    if (this.options.customName) {
      summaryItems.push(`Custom name: ${this.options.customName}`);
    }

    // Custom path
    if (this.options.customPath) {
      summaryItems.push(`Custom location: ${this.options.customPath}`);
    }

    const summaryHtml = summaryItems.map(item => `
      <li>${this.escapeHtml(item)}</li>
    `).join('');

    return `
      <div class="wizard-content">
        <h3>Confirm Backup</h3>
        <p>Review your backup settings and click Create to proceed</p>

        <div class="backup-summary">
          <h4>Backup Summary</h4>
          <ul class="summary-list">
            ${summaryHtml}
          </ul>

          ${this.options.type === 'tables' && this.selectedTables.size > 0 ? `
            <div class="selected-tables-preview">
              <h5>Selected Tables:</h5>
              <div class="tables-preview-list">
                ${Array.from(this.selectedTables).map(t => `<span class="table-tag">${this.escapeHtml(t)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        ${this.isCreating ? `
          <div class="backup-progress">
            <div class="progress-spinner"></div>
            <p>Creating backup...</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render footer
   */
  private renderFooter(): string {
    const canProceed = this.canProceed();

    return `
      <div class="wizard-footer">
        <button class="btn-secondary" id="wizard-cancel-btn">Cancel</button>
        <div class="wizard-nav-buttons">
          ${this.currentStep > 1 ? '<button class="btn-secondary" id="wizard-prev-btn">Previous</button>' : ''}
          ${this.currentStep < 3 ? `<button class="btn-primary" id="wizard-next-btn" ${!canProceed ? 'disabled' : ''}>Next</button>` : ''}
          ${this.currentStep === 3 ? `<button class="btn-primary" id="wizard-create-btn" ${!canProceed || this.isCreating ? 'disabled' : ''}>Create Backup</button>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Check if can proceed to next step
   */
  private canProceed(): boolean {
    if (this.currentStep === 2 && this.options.type === 'tables') {
      return this.selectedTables.size > 0;
    }
    return true;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Close button
    const closeBtn = document.getElementById('wizard-close-btn');
    closeBtn?.addEventListener('click', () => this.handleCancel());

    // Cancel button
    const cancelBtn = document.getElementById('wizard-cancel-btn');
    cancelBtn?.addEventListener('click', () => this.handleCancel());

    // Navigation buttons
    const prevBtn = document.getElementById('wizard-prev-btn');
    prevBtn?.addEventListener('click', () => this.handlePrevious());

    const nextBtn = document.getElementById('wizard-next-btn');
    nextBtn?.addEventListener('click', () => this.handleNext());

    const createBtn = document.getElementById('wizard-create-btn');
    createBtn?.addEventListener('click', () => this.handleCreate());

    // Step 1: Backup type selection
    const typeRadios = document.querySelectorAll('input[name="backup-type"]');
    typeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.options.type = (e.target as HTMLInputElement).value as 'full' | 'tables' | 'incremental';
        this.render();
      });
    });

    // Step 2: Table selection
    const tableCheckboxes = document.querySelectorAll('.table-checkbox');
    tableCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const table = target.value;
        if (target.checked) {
          this.selectedTables.add(table);
        } else {
          this.selectedTables.delete(table);
        }
        this.updateSelectedCount();
        this.updateFooter();
      });
    });

    // Select/Deselect all buttons
    const selectAllBtn = document.getElementById('select-all-tables');
    selectAllBtn?.addEventListener('click', () => {
      this.availableTables.forEach(table => this.selectedTables.add(table));
      this.render();
    });

    const deselectAllBtn = document.getElementById('deselect-all-tables');
    deselectAllBtn?.addEventListener('click', () => {
      this.selectedTables.clear();
      this.render();
    });

    // Custom name input
    const customNameInput = document.getElementById('backup-custom-name') as HTMLInputElement;
    customNameInput?.addEventListener('input', (e) => {
      this.options.customName = (e.target as HTMLInputElement).value || undefined;
    });

    // Compression checkbox
    const compressedCheckbox = document.getElementById('backup-compressed') as HTMLInputElement;
    compressedCheckbox?.addEventListener('change', (e) => {
      this.options.compressed = (e.target as HTMLInputElement).checked;
    });

    // Custom path selection
    const selectPathBtn = document.getElementById('select-backup-path');
    selectPathBtn?.addEventListener('click', async () => {
      const path = await window.electronAPI.databaseBackup.selectSaveLocation();
      if (path) {
        this.options.customPath = path;
        const pathInput = document.getElementById('backup-custom-path') as HTMLInputElement;
        if (pathInput) {
          pathInput.value = path;
        }
      }
    });
  }

  /**
   * Update selected table count display
   */
  private updateSelectedCount(): void {
    const countElement = document.getElementById('selected-table-count');
    if (countElement) {
      countElement.textContent = String(this.selectedTables.size);
    }
  }

  /**
   * Update footer (for enable/disable next button)
   */
  private updateFooter(): void {
    const nextBtn = document.getElementById('wizard-next-btn') as HTMLButtonElement;
    if (nextBtn) {
      nextBtn.disabled = !this.canProceed();
    }
  }

  /**
   * Handle cancel
   */
  private handleCancel(): void {
    this.callbacks.onCancel();
    this.hide();
  }

  /**
   * Handle previous step
   */
  private handlePrevious(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.render();
    }
  }

  /**
   * Handle next step
   */
  private handleNext(): void {
    if (this.currentStep < 3 && this.canProceed()) {
      this.currentStep++;
      this.render();
    }
  }

  /**
   * Handle create backup
   */
  private async handleCreate(): Promise<void> {
    if (!this.canProceed() || this.isCreating) return;

    this.isCreating = true;
    this.render();

    try {
      const options: BackupOptions = {
        ...this.options,
        tables: this.options.type === 'tables' ? Array.from(this.selectedTables) : undefined,
      };

      await this.callbacks.onStart(options);
      this.hide();
    } catch (error) {
      console.error('Backup creation failed:', error);
      this.isCreating = false;
      this.render();
    }
  }

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
