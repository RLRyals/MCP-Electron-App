/**
 * BackupManager Component
 * Main container for database backup management
 *
 * Features:
 * - Orchestrates backup creation and restoration
 * - Manages BackupList and BackupWizard components
 * - Handles restore wizard with file selection, preview, and conflict resolution
 * - Progress tracking for long operations
 * - Integrity validation
 */

import { BackupList, BackupMetadata } from './BackupList.js';
import { BackupWizard, BackupOptions } from './BackupWizard.js';

export interface RestoreOptions {
  backupPath: string;
  dropExisting: boolean;
}

export class BackupManager {
  private container: HTMLElement | null = null;
  private backupList: BackupList;
  private backupWizard: BackupWizard;
  private isLoading: boolean = false;
  private showRestoreWizard: boolean = false;
  private selectedRestoreBackup: BackupMetadata | null = null;
  private restoreStep: number = 1;

  constructor() {
    // Initialize BackupList with callbacks
    this.backupList = new BackupList({
      onRestore: (backup) => this.handleRestoreClick(backup),
      onDownload: (backup) => this.handleDownload(backup),
      onValidate: (backup) => this.handleValidate(backup),
      onDelete: (backup) => this.handleDelete(backup),
    });

    // Initialize BackupWizard with callbacks
    this.backupWizard = new BackupWizard({
      onStart: async (options) => await this.handleCreateBackup(options),
      onCancel: () => this.hideWizard(),
      onGetTables: async () => await this.getTables(),
    });
  }

  /**
   * Initialize and render the backup manager
   */
  public async initialize(container: HTMLElement): Promise<void> {
    this.container = container;
    await this.render();
    await this.loadBackups();
  }

  /**
   * Render the backup manager UI
   */
  private async render(): Promise<void> {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="backup-manager">
        ${this.renderHeader()}
        ${this.renderMainContent()}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render header section
   */
  private renderHeader(): string {
    return `
      <div class="backup-manager-header">
        <div class="header-title">
          <h2>Database Backups</h2>
          <p>Manage database backups and restore operations</p>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" id="open-backup-dir-btn" title="Open backup directory">
            <span class="btn-icon">📁</span>
            Open Directory
          </button>
          <button class="btn-secondary" id="restore-from-file-btn" title="Restore from external backup file">
            <span class="btn-icon">📂</span>
            Restore from File
          </button>
          <button class="btn-primary" id="create-backup-btn" title="Create new backup">
            <span class="btn-icon">+</span>
            Create Backup
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render main content area
   */
  private renderMainContent(): string {
    if (this.isLoading) {
      return `
        <div class="backup-loading">
          <div class="loading-spinner"></div>
          <p>Loading backups...</p>
        </div>
      `;
    }

    return `
      <div class="backup-main-content">
        <div id="backup-list-container"></div>
        <div id="backup-wizard-container"></div>
        <div id="restore-wizard-container"></div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const createBtn = document.getElementById('create-backup-btn');
    createBtn?.addEventListener('click', () => this.showBackupWizard());

    const openDirBtn = document.getElementById('open-backup-dir-btn');
    openDirBtn?.addEventListener('click', () => this.openBackupDirectory());

    const restoreBtn = document.getElementById('restore-from-file-btn');
    restoreBtn?.addEventListener('click', () => this.showRestoreFromFile());
  }

  /**
   * Load backups from the system
   */
  private async loadBackups(): Promise<void> {
    this.isLoading = true;
    await this.render();

    try {
      const result = await window.electronAPI.databaseBackup.list();

      if (result.success) {
        const listContainer = document.getElementById('backup-list-container');
        if (listContainer) {
          this.backupList.render(listContainer);
          this.backupList.setBackups(result.backups);
        }
      } else {
        this.showError('Failed to load backups: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      this.showError('Error loading backups: ' + error.message);
    } finally {
      this.isLoading = false;
      await this.render();

      // Re-render backup list after main render
      const listContainer = document.getElementById('backup-list-container');
      if (listContainer) {
        this.backupList.render(listContainer);
      }
    }
  }

  /**
   * Show backup creation wizard
   */
  private async showBackupWizard(): Promise<void> {
    const wizardContainer = document.getElementById('backup-wizard-container');
    if (wizardContainer) {
      await this.backupWizard.show(wizardContainer);
    }
  }

  /**
   * Hide backup wizard
   */
  private hideWizard(): void {
    this.backupWizard.hide();
  }

  /**
   * Get list of tables from database
   */
  private async getTables(): Promise<string[]> {
    try {
      const result = await window.electronAPI.databaseAdmin.listTables();
      if (result.success && result.data) {
        const tables = result.data.tables || result.data;
        return Array.isArray(tables) ? tables : [];
      }
      return [];
    } catch (error) {
      console.error('Failed to get tables:', error);
      return [];
    }
  }

  /**
   * Handle backup creation
   */
  private async handleCreateBackup(options: BackupOptions): Promise<void> {
    const stopTimer = this.showProgress(
      options.type === 'tables' ? `Creating backup of ${options.tables?.length || 0} table(s)...` : 'Creating full backup...'
    );

    try {
      const tables = options.type === 'tables' ? options.tables : undefined;
      const result = await window.electronAPI.databaseBackup.create(
        options.customPath,
        options.compressed,
        tables
      );

      if (result.success) {
        this.showSuccess(result.message || 'Backup created successfully');
        await this.loadBackups();
      } else {
        this.showError('Backup failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      this.showError('Error creating backup: ' + error.message);
    } finally {
      stopTimer();
    }
  }

  /**
   * Handle restore click from backup list
   */
  private handleRestoreClick(backup: BackupMetadata): void {
    this.selectedRestoreBackup = backup;
    this.restoreStep = 1;
    this.showRestoreWizardDialog();
  }

  /**
   * Show restore from file dialog
   */
  private async showRestoreFromFile(): Promise<void> {
    try {
      const filePath = await window.electronAPI.databaseBackup.selectRestoreFile();
      if (filePath) {
        // Create a temporary backup metadata for the selected file
        this.selectedRestoreBackup = {
          filename: filePath.split('/').pop() || filePath,
          path: filePath,
          createdAt: new Date().toISOString(),
          size: 0,
          database: 'unknown',
          compressed: filePath.endsWith('.gz') || filePath.endsWith('.dump'),
          source: 'app',
        };
        this.restoreStep = 1;
        this.showRestoreWizardDialog();
      }
    } catch (error: any) {
      this.showError('Error selecting file: ' + error.message);
    }
  }

  /**
   * Show restore wizard dialog
   */
  private showRestoreWizardDialog(): void {
    const wizardContainer = document.getElementById('restore-wizard-container');
    if (!wizardContainer || !this.selectedRestoreBackup) return;

    wizardContainer.innerHTML = `
      <div class="backup-wizard-overlay">
        <div class="backup-wizard-modal restore-wizard">
          ${this.renderRestoreWizardHeader()}
          ${this.renderRestoreWizardContent()}
          ${this.renderRestoreWizardFooter()}
        </div>
      </div>
    `;

    this.attachRestoreWizardListeners();
  }

  /**
   * Render restore wizard header
   */
  private renderRestoreWizardHeader(): string {
    return `
      <div class="wizard-header">
        <h2>Restore Database</h2>
        <button class="wizard-close-btn" id="restore-wizard-close-btn">&times;</button>
      </div>
    `;
  }

  /**
   * Render restore wizard content
   */
  private renderRestoreWizardContent(): string {
    if (!this.selectedRestoreBackup) return '';

    return `
      <div class="wizard-content">
        <div class="restore-wizard-section">
          <h3>Selected Backup</h3>
          <div class="restore-backup-info">
            <div class="info-row">
              <span class="info-label">File:</span>
              <span class="info-value">${this.escapeHtml(this.selectedRestoreBackup.filename)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Database:</span>
              <span class="info-value">${this.escapeHtml(this.selectedRestoreBackup.database)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Size:</span>
              <span class="info-value">${this.formatSize(this.selectedRestoreBackup.size)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Created:</span>
              <span class="info-value">${this.formatDate(this.selectedRestoreBackup.createdAt)}</span>
            </div>
          </div>
        </div>

        <div class="restore-wizard-section">
          <h3>Restore Mode</h3>
          <p class="section-description">Both options are destructive to any tables included in this backup -- there is no non-destructive "merge".</p>

          <label class="restore-option">
            <input type="radio" name="restore-mode" value="merge" checked />
            <div class="option-content">
              <strong>Restore In-Place</strong>
              <p class="warning">⚠️ Tables present in this backup are dropped and replaced with the backup's contents. Databases/tables NOT in this backup are left untouched.</p>
            </div>
          </label>

          <label class="restore-option">
            <input type="radio" name="restore-mode" value="replace" />
            <div class="option-content">
              <strong>Full Replace</strong>
              <p class="warning">⚠️ Drops and recreates the ENTIRE database first, then restores from backup. ALL current data is permanently lost, including anything not in this backup.</p>
            </div>
          </label>
        </div>

        <div class="restore-wizard-section">
          <div class="restore-warning-box">
            <div class="warning-icon">⚠️</div>
            <div class="warning-content">
              <strong>This is a destructive operation.</strong>
              <p>Make sure the MCP system is stopped or no active connections are using the database before restoring.</p>
              <p>It's strongly recommended to create a fresh backup of the current database before proceeding.</p>
            </div>
          </div>
        </div>

        <div class="restore-wizard-section">
          <label class="restore-confirm-checkbox">
            <input type="checkbox" id="restore-confirm-checkbox" />
            <span>I understand this will overwrite existing data and cannot be undone.</span>
          </label>
        </div>
      </div>
    `;
  }

  /**
   * Render restore wizard footer
   */
  private renderRestoreWizardFooter(): string {
    return `
      <div class="wizard-footer">
        <button class="btn-secondary" id="restore-wizard-cancel-btn">Cancel</button>
        <button class="btn-danger" id="restore-wizard-confirm-btn" disabled>
          <span class="btn-icon">↻</span>
          Restore Database
        </button>
      </div>
    `;
  }

  /**
   * Attach restore wizard event listeners
   */
  private attachRestoreWizardListeners(): void {
    const closeBtn = document.getElementById('restore-wizard-close-btn');
    closeBtn?.addEventListener('click', () => this.hideRestoreWizard());

    const cancelBtn = document.getElementById('restore-wizard-cancel-btn');
    cancelBtn?.addEventListener('click', () => this.hideRestoreWizard());

    const confirmBtn = document.getElementById('restore-wizard-confirm-btn') as HTMLButtonElement | null;
    confirmBtn?.addEventListener('click', () => this.handleRestoreConfirm());

    // The destructive restore action stays disabled until the user explicitly
    // acknowledges the "cannot be undone" checkbox.
    const confirmCheckbox = document.getElementById('restore-confirm-checkbox') as HTMLInputElement | null;
    confirmCheckbox?.addEventListener('change', () => {
      if (confirmBtn) {
        confirmBtn.disabled = !confirmCheckbox.checked;
      }
    });
  }

  /**
   * Hide restore wizard
   */
  private hideRestoreWizard(): void {
    const wizardContainer = document.getElementById('restore-wizard-container');
    if (wizardContainer) {
      wizardContainer.innerHTML = '';
    }
    this.selectedRestoreBackup = null;
  }

  /**
   * Handle restore confirmation
   */
  private async handleRestoreConfirm(): Promise<void> {
    if (!this.selectedRestoreBackup) return;

    // Defense in depth: the button is already disabled until this is checked,
    // but never proceed with a destructive restore without it.
    const confirmCheckbox = document.getElementById('restore-confirm-checkbox') as HTMLInputElement | null;
    if (!confirmCheckbox?.checked) {
      return;
    }

    const modeRadios = document.querySelectorAll('input[name="restore-mode"]');
    let dropExisting = false;
    modeRadios.forEach(radio => {
      if ((radio as HTMLInputElement).checked) {
        dropExisting = (radio as HTMLInputElement).value === 'replace';
      }
    });

    // Restore is ALWAYS destructive to overlapping data -- always require an
    // explicit native confirmation on top of the checkbox, worded for the chosen mode.
    const confirmMessage = dropExisting
      ? 'This will DROP AND RECREATE the entire database, permanently deleting ALL current data, then restore from the selected backup. This cannot be undone. Continue?'
      : 'This will restore in-place: tables in the selected backup are dropped and replaced with the backup\'s contents. This cannot be undone. Continue?';

    if (!confirm(confirmMessage)) {
      return;
    }

    this.hideRestoreWizard();
    const stopTimer = this.showProgress('Restoring database...');

    try {
      const result = await window.electronAPI.databaseBackup.restore(
        this.selectedRestoreBackup.path,
        dropExisting
      );

      if (result.success) {
        this.showSuccess(result.message || 'Database restored successfully');
      } else {
        this.showError('Restore failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      this.showError('Error restoring database: ' + error.message);
    } finally {
      stopTimer();
    }
  }

  /**
   * Handle backup download -- copies the backup file to a user-chosen location
   * via a native save dialog (see database-backup:download IPC handler).
   */
  private async handleDownload(backup: BackupMetadata): Promise<void> {
    const stopTimer = this.showProgress(`Downloading ${backup.filename}...`);

    try {
      const result = await window.electronAPI.databaseBackup.download(backup.path);

      if (result.canceled) {
        // User dismissed the save dialog -- not an error, nothing to report.
        return;
      }

      if (result.success) {
        this.showSuccess(result.message || `Backup downloaded to ${result.path}`);
      } else {
        this.showError('Download failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      this.showError('Error downloading backup: ' + error.message);
    } finally {
      stopTimer();
    }
  }

  /**
   * Handle backup validation -- runs the backend's format-signature integrity
   * check (PGDMP/gzip/pg_dump-header) rather than just checking file size client-side.
   */
  private async handleValidate(backup: BackupMetadata): Promise<void> {
    const stopTimer = this.showProgress(`Validating ${backup.filename}...`);

    try {
      const result = await window.electronAPI.databaseBackup.validate(backup.path);

      if (!result.success) {
        this.showError('Validation error: ' + (result.error || 'Unknown error'));
      } else if (result.valid) {
        this.showSuccess(result.message || 'Backup file validation passed');
      } else {
        this.showError(result.message || 'Backup file failed validation');
      }
    } catch (error: any) {
      this.showError('Error validating backup: ' + error.message);
    } finally {
      stopTimer();
    }
  }

  /**
   * Handle backup deletion
   */
  private async handleDelete(backup: BackupMetadata): Promise<void> {
    if (!confirm(`Are you sure you want to delete backup "${backup.filename}"?`)) {
      return;
    }

    this.showInfo('Deleting backup...');

    try {
      const result = await window.electronAPI.databaseBackup.delete(backup.path);

      if (result.success) {
        this.showSuccess(result.message || 'Backup deleted successfully');
        await this.loadBackups();
      } else {
        this.showError('Delete failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      this.showError('Error deleting backup: ' + error.message);
    }
  }

  /**
   * Open backup directory in file explorer
   */
  private async openBackupDirectory(): Promise<void> {
    try {
      await window.electronAPI.databaseBackup.openDirectory();
    } catch (error: any) {
      this.showError('Error opening directory: ' + error.message);
    }
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    this.showToast('success', message);
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.showToast('error', message);
  }

  /**
   * Show info message
   */
  private showInfo(message: string): void {
    this.showToast('info', message);
  }

  /**
   * Show a persistent progress banner with a live elapsed-time counter for a
   * long-running operation (backup create/restore/download/validate). pg_dump
   * and pg_restore don't expose byte-level progress over the exec channel this
   * app uses, so this is an honest indeterminate indicator (spinner + elapsed
   * seconds) rather than a fake percentage bar.
   *
   * Returns a function that stops the timer and removes the banner; always
   * call it in a `finally` block.
   */
  private showProgress(message: string): () => void {
    const banner = document.createElement('div');
    banner.className = 'backup-progress-banner';
    banner.innerHTML = `
      <span class="progress-banner-spinner"></span>
      <span class="progress-banner-message">${this.escapeHtml(message)}</span>
      <span class="progress-banner-elapsed">0s</span>
    `;
    document.body.appendChild(banner);

    const startedAt = Date.now();
    const elapsedEl = banner.querySelector('.progress-banner-elapsed');
    const intervalId = window.setInterval(() => {
      if (elapsedEl) {
        elapsedEl.textContent = `${Math.round((Date.now() - startedAt) / 1000)}s`;
      }
    }, 1000);

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(intervalId);
      banner.remove();
    };
  }

  /**
   * Show toast notification
   */
  private showToast(type: 'success' | 'error' | 'info', message: string): void {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `backup-toast toast-${type}`;
    toast.textContent = message;

    // Add to document
    document.body.appendChild(toast);

    // Remove after 5 seconds
    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 5000);
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Format date
   */
  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  /**
   * Refresh backup list
   */
  public async refresh(): Promise<void> {
    await this.loadBackups();
  }

  /**
   * Destroy the backup manager
   */
  public destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
