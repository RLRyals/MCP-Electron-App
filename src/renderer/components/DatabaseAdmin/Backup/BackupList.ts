/**
 * BackupList Component
 * Displays and manages database backups with card-based UI
 *
 * Features:
 * - Card-based backup display with metadata
 * - Size/date/type badges
 * - Search and filter functionality
 * - Download, validate, delete, and restore actions
 */

export interface BackupMetadata {
  filename: string;
  path: string;
  createdAt: string;
  size: number;
  database: string;
  compressed: boolean;
}

export interface BackupListCallbacks {
  onRestore: (backup: BackupMetadata) => void;
  onDownload: (backup: BackupMetadata) => void;
  onValidate: (backup: BackupMetadata) => void;
  onDelete: (backup: BackupMetadata) => void;
}

export class BackupList {
  private container: HTMLElement | null = null;
  private backups: BackupMetadata[] = [];
  private filteredBackups: BackupMetadata[] = [];
  private searchQuery: string = '';
  private callbacks: BackupListCallbacks;

  constructor(callbacks: BackupListCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Render the backup list
   */
  public render(container: HTMLElement): void {
    this.container = container;
    this.updateDisplay();
  }

  /**
   * Set the backups to display
   */
  public setBackups(backups: BackupMetadata[]): void {
    this.backups = backups;
    this.applyFilter();
  }

  /**
   * Set search query and filter backups
   */
  public setSearchQuery(query: string): void {
    this.searchQuery = query.toLowerCase();
    this.applyFilter();
  }

  /**
   * Apply filter based on search query
   */
  private applyFilter(): void {
    if (!this.searchQuery) {
      this.filteredBackups = [...this.backups];
    } else {
      this.filteredBackups = this.backups.filter(backup =>
        backup.filename.toLowerCase().includes(this.searchQuery) ||
        backup.database.toLowerCase().includes(this.searchQuery) ||
        this.formatDate(backup.createdAt).toLowerCase().includes(this.searchQuery)
      );
    }
    this.updateDisplay();
  }

  /**
   * Update the display
   */
  private updateDisplay(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="backup-list-container">
        ${this.renderSearchBar()}
        ${this.renderBackupCards()}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render search bar
   */
  private renderSearchBar(): string {
    return `
      <div class="backup-search-bar">
        <input
          type="text"
          id="backup-search-input"
          class="search-input"
          placeholder="Search backups by name, database, or date..."
          value="${this.escapeHtml(this.searchQuery)}"
        />
        <div class="backup-count">
          ${this.filteredBackups.length} backup${this.filteredBackups.length !== 1 ? 's' : ''} found
        </div>
      </div>
    `;
  }

  /**
   * Render backup cards
   */
  private renderBackupCards(): string {
    if (this.filteredBackups.length === 0) {
      return `
        <div class="backup-empty-state">
          <div class="empty-icon">💾</div>
          <h3>No backups found</h3>
          <p>${this.searchQuery ? 'Try a different search query' : 'Create your first backup to get started'}</p>
        </div>
      `;
    }

    const cardsHtml = this.filteredBackups.map(backup => this.renderBackupCard(backup)).join('');

    return `
      <div class="backup-cards-grid">
        ${cardsHtml}
      </div>
    `;
  }

  /**
   * Render a single backup card
   */
  private renderBackupCard(backup: BackupMetadata): string {
    const sizeFormatted = this.formatSize(backup.size);
    const dateFormatted = this.formatDate(backup.createdAt);
    const timeFormatted = this.formatTime(backup.createdAt);
    const typeLabel = backup.compressed ? 'Compressed' : 'Plain SQL';
    const typeClass = backup.compressed ? 'badge-compressed' : 'badge-plain';

    return `
      <div class="backup-card" data-backup-path="${this.escapeHtml(backup.path)}">
        <div class="backup-card-header">
          <div class="backup-icon">💾</div>
          <div class="backup-title">
            <h4>${this.escapeHtml(backup.filename)}</h4>
            <span class="backup-database">${this.escapeHtml(backup.database)}</span>
          </div>
        </div>

        <div class="backup-card-metadata">
          <div class="backup-badge backup-badge-size">
            <span class="badge-label">Size:</span>
            <span class="badge-value">${sizeFormatted}</span>
          </div>
          <div class="backup-badge backup-badge-type ${typeClass}">
            <span class="badge-label">Type:</span>
            <span class="badge-value">${typeLabel}</span>
          </div>
          <div class="backup-badge backup-badge-date">
            <span class="badge-label">Created:</span>
            <span class="badge-value">${dateFormatted}</span>
          </div>
          <div class="backup-badge backup-badge-time">
            <span class="badge-label">Time:</span>
            <span class="badge-value">${timeFormatted}</span>
          </div>
        </div>

        <div class="backup-card-actions">
          <button class="backup-action-btn btn-restore" data-action="restore" title="Restore this backup">
            <span class="btn-icon">↻</span>
            Restore
          </button>
          <button class="backup-action-btn btn-download" data-action="download" title="Download to custom location">
            <span class="btn-icon">⬇</span>
            Download
          </button>
          <button class="backup-action-btn btn-validate" data-action="validate" title="Validate backup integrity">
            <span class="btn-icon">✓</span>
            Validate
          </button>
          <button class="backup-action-btn btn-delete" data-action="delete" title="Delete this backup">
            <span class="btn-icon">🗑</span>
            Delete
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Search input
    const searchInput = document.getElementById('backup-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.setSearchQuery((e.target as HTMLInputElement).value);
      });
    }

    // Action buttons
    const actionButtons = this.container?.querySelectorAll('.backup-action-btn');
    actionButtons?.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const action = target.getAttribute('data-action');
        const card = target.closest('.backup-card') as HTMLElement;
        const backupPath = card?.getAttribute('data-backup-path');

        if (!backupPath) return;

        const backup = this.backups.find(b => b.path === backupPath);
        if (!backup) return;

        this.handleAction(action as string, backup);
      });
    });
  }

  /**
   * Handle backup action
   */
  private handleAction(action: string, backup: BackupMetadata): void {
    switch (action) {
      case 'restore':
        this.callbacks.onRestore(backup);
        break;
      case 'download':
        this.callbacks.onDownload(backup);
        break;
      case 'validate':
        this.callbacks.onValidate(backup);
        break;
      case 'delete':
        this.callbacks.onDelete(backup);
        break;
    }
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
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format time
   */
  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
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
   * Refresh the backup list
   */
  public refresh(): void {
    this.updateDisplay();
  }
}
