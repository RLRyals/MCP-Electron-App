/**
 * DatabaseTab Component
 * Database administration interface with MCP database tools integration
 *
 * Features:
 * - Table browser and schema viewer
 * - CRUD operation interface
 * - Batch operations support
 * - Database backup and restore management
 */

import { databaseService } from '../services/databaseService.js';
import { BackupManager } from './DatabaseAdmin/Backup/BackupManager.js';
import { CRUDPanel } from './DatabaseAdmin/CRUD/CRUDPanel.js';

export class DatabaseTab {
  private container: HTMLElement | null = null;
  private availableTables: string[] = [];
  private backupManager: BackupManager | null = null;
  private crudPanel: CRUDPanel | null = null;
  private currentView: 'overview' | 'backup' = 'overview';
  private currentActiveTab: 'schema' | 'data' = 'data'; // Default to data view

  constructor() {
    this.backupManager = new BackupManager();
  }

  /**
   * Initialize the database tab
   */
  public async initialize(): Promise<void> {
    this.container = document.getElementById('database-card');
    if (!this.container) {
      console.error('Database container not found');
      return;
    }

    // Render the database structure
    this.render();

    console.log('DatabaseTab initialized');
    
    // Initial table load
    await this.handleListTables();
  }

  /**
   * Render the complete database tab structure
   */
  private render(): void {
    if (!this.container) return;

    if (this.currentView === 'backup') {
      this.renderBackupView();
    } else {
      this.renderOverviewView();
    }
  }

  /**
   * Render overview view
   */
  private renderOverviewView(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      ${this.renderHeader()}
      <div class="database-layout">
        <div class="database-top-bar">
          ${this.renderQuickActions()}
        </div>
        <div class="database-content-wrapper">
          <div class="database-sidebar-left">
            ${this.renderTableBrowser()}
          </div>
          <div class="database-main-area" id="database-main-area">
            <div id="crud-panel-container" class="crud-panel-container">
              <div class="empty-state">
                <span class="empty-icon">👈</span>
                <h4>Select a Table</h4>
                <p>Choose a table from the sidebar to view and edit data</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render backup view
   */
  private async renderBackupView(): Promise<void> {
    if (!this.container) return;

    this.container.innerHTML = `
      ${this.renderHeader()}
      <div class="database-backup-view">
        <div class="backup-view-header">
          <button class="btn-back" id="back-to-overview-btn">
            <span class="btn-icon">←</span>
            Back to Overview
          </button>
        </div>
        <div id="backup-manager-container"></div>
      </div>
    `;

    // Attach back button listener
    const backBtn = document.getElementById('back-to-overview-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.currentView = 'overview';
        this.render();
      });
    }

    // Initialize backup manager
    const backupContainer = document.getElementById('backup-manager-container');
    if (backupContainer && this.backupManager) {
      await this.backupManager.initialize(backupContainer);
    }
  }

  /**
   * Render the header
   */
  private renderHeader(): string {
    return `
      <div class="database-header">
        <div class="database-header-left">
          <h2>Database Administration</h2>
          <span class="database-subtitle">Manage your PostgreSQL database and MCP server</span>
        </div>
      </div>
    `;
  }

  /**
   * Render quick actions (Top Menu)
   */
  private renderQuickActions(): string {
    return `
      <div class="quick-actions-bar">
        <button id="db-list-tables" class="quick-action-btn-small" title="Refresh Tables">
          <span class="action-icon">🔄</span>
          <span class="action-label">Refresh Tables</span>
        </button>
        <button id="db-view-audit-logs" class="quick-action-btn-small" title="View audit logs">
          <span class="action-icon">📜</span>
          <span class="action-label">Audit Logs</span>
        </button>
        <button id="db-test-query" class="quick-action-btn-small" title="Test a simple query">
          <span class="action-icon">🔍</span>
          <span class="action-label">Test Query</span>
        </button>
        <div class="spacer"></div>
        <button id="db-manage-backups" class="quick-action-btn-small primary" title="Manage database backups">
          <span class="action-icon">💾</span>
          <span class="action-label">Backups</span>
        </button>
      </div>
    `;
  }

  /**
   * Render table browser section (Sidebar)
   */
  private renderTableBrowser(): string {
    return `
      <div class="table-browser-sidebar-content">
        <div class="sidebar-header">
          <h3>Tables</h3>
        </div>
        <div class="table-list" id="database-table-list">
          <div class="empty-state-compact">
            <span class="spinner-small"></span>
            <p>Loading tables...</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to buttons
   */
  private attachEventListeners(): void {
    const listTablesBtn = document.getElementById('db-list-tables');
    if (listTablesBtn) {
      listTablesBtn.addEventListener('click', () => this.handleListTables());
    }

    const viewLogsBtn = document.getElementById('db-view-audit-logs');
    if (viewLogsBtn) {
      viewLogsBtn.addEventListener('click', () => this.handleViewAuditLogs());
    }

    const testQueryBtn = document.getElementById('db-test-query');
    if (testQueryBtn) {
      testQueryBtn.addEventListener('click', () => this.handleTestQuery());
    }

    const manageBackupsBtn = document.getElementById('db-manage-backups');
    if (manageBackupsBtn) {
      manageBackupsBtn.addEventListener('click', () => this.handleManageBackups());
    }
  }

  // ===================
  // Event Handlers
  // ===================

  /**
   * Handle list tables button click
   */
  private async handleListTables(): Promise<void> {
    try {
      console.log('Fetching database tables...');

      const result = await databaseService.listTables();

      if (result.success && result.data) {
        const tablesData = result.data.tables || result.data;
        
        // Extract table names from table objects
        this.availableTables = Array.isArray(tablesData)
          ? tablesData.map((t: any) => typeof t === 'string' ? t : t.name)
          : [];

        this.updateTableList(this.availableTables);
        console.log(`Found ${this.availableTables.length} tables`);
      } else {
        const errorMsg = result.error || 'Failed to list tables';
        console.error('[DatabaseTab] List tables failed:', errorMsg);
        this.updateTableList([]);
      }
    } catch (error: any) {
      console.error('[DatabaseTab] List tables exception:', error);
      this.updateTableList([]);
    }
  }

  /**
   * Handle view audit logs button click
   */
  private async handleViewAuditLogs(): Promise<void> {
    // Switch to Logs tab or show modal
    // For now, let's just log to console as the requirement was to move logs to LogsTab
    console.log('View Audit Logs clicked - this should navigate to Logs tab');
    // We could trigger a tab switch here if we had access to the tab manager
    const logsTabBtn = document.querySelector('[data-tab="logs"]');
    if (logsTabBtn instanceof HTMLElement) {
      logsTabBtn.click();
    }
  }

  /**
   * Handle test query button click
   */
  private async handleTestQuery(): Promise<void> {
    try {
      console.log('Running test query...');
      const result = await databaseService.listTables();
      if (result.success) {
        console.log('Test query executed successfully');
        alert('Test query successful! Database is responsive.');
      } else {
        console.error('Test query failed:', result.error);
        alert(`Test query failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Test query error:', error);
      alert(`Test query error: ${error.message}`);
    }
  }

  /**
   * Handle manage backups button click
   */
  private async handleManageBackups(): Promise<void> {
    this.currentView = 'backup';
    await this.render();
  }

  /**
   * Update table list display
   */
  private updateTableList(tables: string[]): void {
    const tableList = document.getElementById('database-table-list');
    if (!tableList) return;

    if (tables.length === 0) {
      tableList.innerHTML = `
        <div class="empty-state-compact">
          <span class="empty-icon">📋</span>
          <p>No tables found</p>
        </div>
      `;
      return;
    }

    const html = tables.map(table => `
      <div class="table-item" data-table="${table}">
        <span class="table-icon">📊</span>
        <span class="table-name">${this.escapeHtml(table)}</span>
      </div>
    `).join('');

    tableList.innerHTML = html;

    // Add click listeners
    const tableItems = tableList.querySelectorAll('.table-item');
    tableItems.forEach(item => {
      item.addEventListener('click', () => {
        // Remove active class from all items
        tableItems.forEach(i => i.classList.remove('active'));
        // Add active class to clicked item
        item.classList.add('active');

        const tableName = item.getAttribute('data-table');
        if (tableName) {
          this.handleTableClick(tableName);
        }
      });
    });
  }

  /**
   * Handle table click
   */
  private async handleTableClick(tableName: string): Promise<void> {
    try {
      console.log(`Loading table: ${tableName}`);
      await this.initializeCRUDPanel(tableName);
    } catch (error: any) {
      console.error(`Error loading table ${tableName}:`, error);
    }
  }

  /**
   * Initialize CRUD panel for a table
   */
  private async initializeCRUDPanel(tableName: string): Promise<void> {
    const container = document.getElementById('crud-panel-container');
    if (!container) return;

    try {
      // Destroy existing panel if any
      if (this.crudPanel) {
        this.crudPanel.destroy();
      }
      
      // Clear container
      container.innerHTML = '';

      // Create new CRUD panel
      this.crudPanel = new CRUDPanel(container, {
        onStatusChange: (message, type) => {
          console.log(`[CRUD] [${type}] ${message}`);
        }
      });

      await this.crudPanel.initialize();

      // Auto-select the current table
      await this.crudPanel.selectTable(tableName);

      console.log(`CRUD panel loaded for ${tableName}`);
    } catch (error: any) {
      console.error('CRUD panel initialization error:', error);
      container.innerHTML = `
        <div class="error-state">
          <h4>Error loading table</h4>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Factory function to create the database tab instance
 */
export function createDatabaseTab(): DatabaseTab {
  return new DatabaseTab();
}
