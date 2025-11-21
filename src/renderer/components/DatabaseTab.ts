/**
 * DatabaseTab Component
 * Database administration interface with MCP database tools integration
 *
 * Features:
 * - Connection status to database admin server
 * - Table browser and schema viewer
 * - CRUD operation interface
 * - Batch operations support
 * - Audit log viewer
 * - Database backup and restore management
 */

import { databaseService } from '../services/databaseService.js';
import { BackupManager } from './DatabaseAdmin/Backup/BackupManager.js';
import { CRUDPanel } from './DatabaseAdmin/CRUD/CRUDPanel.js';

export interface DatabaseEvent {
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export class DatabaseTab {
  private container: HTMLElement | null = null;
  private recentEvents: DatabaseEvent[] = [];
  private maxEvents: number = 10;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 30000; // 30 seconds
  private isConnected: boolean = false;
  private availableTables: string[] = [];
  private backupManager: BackupManager | null = null;
  private crudPanel: CRUDPanel | null = null;
  private currentView: 'overview' | 'backup' = 'overview';
  private currentActiveTab: 'schema' | 'data' = 'schema';

  constructor() {
    this.recentEvents = [];
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

    // Check initial connection
    await this.checkConnection();

    // Start periodic connection checks
    this.startConnectionChecks();

    console.log('DatabaseTab initialized');
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
      ${this.renderConnectionStatus()}
      ${this.renderQuickActions()}
      ${this.renderTableBrowser()}
      ${this.renderActivityLog()}
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
        <h2>Database Administration</h2>
        <div class="database-status">
          <div id="database-connection-indicator" class="status-indicator status-red">
            <span class="status-dot"></span>
          </div>
          <span id="database-connection-text">Checking connection...</span>
        </div>
      </div>
    `;
  }

  /**
   * Render connection status section
   */
  private renderConnectionStatus(): string {
    return `
      <div class="database-section">
        <h3>MCP Server Connection</h3>
        <div class="connection-info">
          <div class="info-row">
            <span class="info-label">Server Address:</span>
            <span class="info-value" id="server-address">localhost:3010</span>
          </div>
          <div class="info-row">
            <span class="info-label">Protocol:</span>
            <span class="info-value">JSON-RPC 2.0 over HTTP</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value" id="connection-status-text">Checking...</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render quick actions
   */
  private renderQuickActions(): string {
    return `
      <div class="database-section">
        <h3>Quick Actions</h3>
        <div class="database-actions">
          <button id="db-refresh-connection" class="action-button secondary" title="Refresh connection status">
            Refresh Connection
          </button>
          <button id="db-list-tables" class="action-button secondary" title="List all database tables">
            List Tables
          </button>
          <button id="db-view-audit-logs" class="action-button secondary" title="View audit logs">
            View Audit Logs
          </button>
          <button id="db-test-query" class="action-button secondary" title="Test a simple query">
            Test Query
          </button>
          <button id="db-manage-backups" class="action-button primary" title="Manage database backups">
            💾 Manage Backups
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render table browser section
   */
  private renderTableBrowser(): string {
    return `
      <div class="database-section">
        <h3>Table Browser</h3>
        <div class="table-browser">
          <div class="table-list" id="database-table-list">
            <div class="loading-message">
              Click "List Tables" to view available database tables
            </div>
          </div>
          <div class="table-details" id="database-table-details">
            <div class="empty-state">
              Select a table to view its schema and data
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render activity log
   */
  private renderActivityLog(): string {
    const eventsHtml = this.recentEvents.length > 0
      ? this.recentEvents.map(event => this.renderEventItem(event)).join('')
      : '<div class="activity-empty">No recent activity</div>';

    return `
      <div class="database-section">
        <h3>Activity Log</h3>
        <div class="activity-list" id="database-activity-list">
          ${eventsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render a single activity event item
   */
  private renderEventItem(event: DatabaseEvent): string {
    const icon = this.getEventIcon(event.type);
    const timeStr = this.formatTime(event.timestamp);

    return `
      <div class="activity-item activity-${event.type}">
        <span class="activity-icon">${icon}</span>
        <div class="activity-content">
          <span class="activity-message">${this.escapeHtml(event.message)}</span>
          <span class="activity-time">${timeStr}</span>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to buttons
   */
  private attachEventListeners(): void {
    const refreshBtn = document.getElementById('db-refresh-connection');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.handleRefreshConnection());
    }

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
   * Handle refresh connection button click
   */
  private async handleRefreshConnection(): Promise<void> {
    this.addEvent('info', 'Refreshing database connection...');
    await this.checkConnection();
  }

  /**
   * Handle list tables button click
   */
  private async handleListTables(): Promise<void> {
    try {
      this.addEvent('info', 'Fetching database tables...');

      const result = await databaseService.listTables();

      if (result.success && result.data) {
        const tablesData = result.data.tables || result.data;
        // Extract table names from table objects
        this.availableTables = Array.isArray(tablesData)
          ? tablesData.map((t: any) => typeof t === 'string' ? t : t.name)
          : [];

        this.updateTableList(this.availableTables);
        this.addEvent('success', `Found ${this.availableTables.length} tables`);
      } else {
        this.addEvent('error', result.error || 'Failed to list tables');
        this.updateTableList([]);
      }
    } catch (error: any) {
      this.addEvent('error', `Error listing tables: ${error.message}`);
      this.updateTableList([]);
    }
  }

  /**
   * Handle view audit logs button click
   */
  private async handleViewAuditLogs(): Promise<void> {
    try {
      this.addEvent('info', 'Querying audit logs...');

      const result = await databaseService.queryAuditLogs({
        limit: 50,
      });

      if (result.success) {
        const logs = result.data?.data || result.data || [];
        this.addEvent('success', `Retrieved ${logs.length} audit log entries`);
        console.log('Audit Logs:', logs);

        // Display logs in a modal or table
        if (logs.length > 0) {
          this.displayAuditLogs(logs);
        } else {
          this.addEvent('info', 'No audit logs found');
        }
      } else {
        const errorMsg = result.error || 'No audit logs available';
        this.addEvent('error', errorMsg);
        console.error('Audit logs error:', result);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message || String(error);
      this.addEvent('error', `Error querying audit logs: ${errorMsg}`);
      console.error('Audit logs exception:', error);
    }
  }

  /**
   * Handle test query button click
   */
  private async handleTestQuery(): Promise<void> {
    try {
      this.addEvent('info', 'Running test query...');

      // Test by listing tables (simple query)
      const result = await databaseService.listTables();

      if (result.success) {
        this.addEvent('success', 'Test query executed successfully');
      } else {
        this.addEvent('error', result.error || 'Test query failed');
      }
    } catch (error: any) {
      this.addEvent('error', `Test query error: ${error.message}`);
    }
  }

  /**
   * Handle manage backups button click
   */
  private async handleManageBackups(): Promise<void> {
    this.addEvent('info', 'Opening backup management...');
    this.currentView = 'backup';
    await this.render();
  }

  // ===================
  // Connection Management
  // ===================

  /**
   * Check database server connection
   */
  private async checkConnection(): Promise<void> {
    try {
      const result = await databaseService.checkConnection();

      if (result.success) {
        this.isConnected = true;
        this.updateConnectionStatus('connected', 'Connected to MCP Database Server');
      } else {
        this.isConnected = false;
        this.updateConnectionStatus(
          'disconnected',
          result.error || 'Cannot connect to database server'
        );
      }
    } catch (error: any) {
      this.isConnected = false;
      this.updateConnectionStatus('error', `Connection error: ${error.message}`);
    }
  }

  /**
   * Update connection status display
   */
  private updateConnectionStatus(status: 'connected' | 'disconnected' | 'error', message: string): void {
    const indicator = document.getElementById('database-connection-indicator');
    const text = document.getElementById('database-connection-text');
    const statusText = document.getElementById('connection-status-text');

    if (indicator) {
      indicator.classList.remove('status-green', 'status-yellow', 'status-red');

      switch (status) {
        case 'connected':
          indicator.classList.add('status-green');
          break;
        case 'disconnected':
          indicator.classList.add('status-yellow');
          break;
        case 'error':
          indicator.classList.add('status-red');
          break;
      }
    }

    if (text) {
      text.textContent = message;
    }

    if (statusText) {
      statusText.textContent = status === 'connected' ? 'Online' : 'Offline';
    }
  }

  /**
   * Start periodic connection checks
   */
  private startConnectionChecks(): void {
    this.stopConnectionChecks();

    this.connectionCheckInterval = setInterval(() => {
      this.checkConnection();
    }, this.CHECK_INTERVAL);

    console.log('Database connection checks started (30s interval)');
  }

  /**
   * Stop periodic connection checks
   */
  private stopConnectionChecks(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
      console.log('Database connection checks stopped');
    }
  }

  /**
   * Update table list display
   */
  private updateTableList(tables: string[]): void {
    const tableList = document.getElementById('database-table-list');
    if (!tableList) return;

    if (tables.length === 0) {
      tableList.innerHTML = '<div class="loading-message">No tables found</div>';
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
      this.addEvent('info', `Loading schema for table: ${tableName}`);

      const result = await databaseService.getSchema({
        table: tableName,
        includeConstraints: true,
        includeIndexes: true,
      });

      if (result.success && result.data) {
        this.displayTableSchema(tableName, result.data);
        this.addEvent('success', `Loaded schema for ${tableName}`);
      } else {
        this.addEvent('error', result.error || 'Failed to load schema');
      }
    } catch (error: any) {
      this.addEvent('error', `Error loading schema: ${error.message}`);
    }
  }

  /**
   * Display table schema with tabbed interface
   */
  private async displayTableSchema(tableName: string, schema: any): Promise<void> {
    const detailsPanel = document.getElementById('database-table-details');
    if (!detailsPanel) return;

    const columns = schema.columns || [];

    const html = `
      <div class="table-details-container">
        <h4>${this.escapeHtml(tableName)}</h4>

        <!-- Tab Navigation -->
        <div class="table-details-tabs">
          <button class="tab-button active" data-tab="schema">Schema</button>
          <button class="tab-button" data-tab="data">Data & CRUD</button>
        </div>

        <!-- Tab Contents -->
        <div class="table-details-content">
          <!-- Schema Tab -->
          <div class="tab-content active" id="schema-tab">
            <table class="schema-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Type</th>
                  <th>Nullable</th>
                  <th>Default</th>
                  <th>Key</th>
                </tr>
              </thead>
              <tbody>
                ${columns.map((col: any) => `
                  <tr>
                    <td><strong>${this.escapeHtml(col.name || '')}</strong></td>
                    <td>${this.escapeHtml(col.type || '')}</td>
                    <td>${col.nullable ? 'Yes' : 'No'}</td>
                    <td>${col.default || '-'}</td>
                    <td>${col.isPrimaryKey ? 'PK' : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Data Tab -->
          <div class="tab-content" id="data-tab">
            <div id="crud-panel-container"></div>
          </div>
        </div>
      </div>
    `;

    detailsPanel.innerHTML = html;

    // Attach tab switching event listeners
    this.attachTabListeners(tableName);

    // If data tab is active, initialize CRUD panel
    if (this.currentActiveTab === 'data') {
      await this.initializeCRUDPanel(tableName);
    }
  }

  /**
   * Attach tab switching listeners
   */
  private attachTabListeners(tableName: string): void {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const tab = target.getAttribute('data-tab') as 'schema' | 'data';

        // Update active tab
        tabButtons.forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');

        // Update content visibility
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => content.classList.remove('active'));

        const activeContent = document.getElementById(`${tab}-tab`);
        if (activeContent) {
          activeContent.classList.add('active');
        }

        // Store current tab
        this.currentActiveTab = tab;

        // Initialize CRUD panel if data tab is selected
        if (tab === 'data') {
          await this.initializeCRUDPanel(tableName);
        }
      });
    });
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

      // Create new CRUD panel
      this.crudPanel = new CRUDPanel(container, {
        onStatusChange: (message, type) => {
          this.addEvent(type, message);
        }
      });

      await this.crudPanel.initialize();

      // Auto-select the current table
      await this.crudPanel.selectTable(tableName);

      this.addEvent('success', `CRUD panel loaded for ${tableName}`);
    } catch (error: any) {
      this.addEvent('error', `Failed to initialize CRUD panel: ${error.message}`);
      console.error('CRUD panel initialization error:', error);
    }
  }

  /**
   * Display audit logs
   */
  private displayAuditLogs(logs: any[]): void {
    const detailsPanel = document.getElementById('database-table-details');
    if (!detailsPanel) return;

    const html = `
      <div class="audit-logs-display">
        <h4>Audit Logs (${logs.length} entries)</h4>
        <table class="schema-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Table</th>
              <th>Operation</th>
              <th>User</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map((log: any) => `
              <tr>
                <td>${this.escapeHtml(log.timestamp || log.created_at || '-')}</td>
                <td><strong>${this.escapeHtml(log.table_name || log.table || '-')}</strong></td>
                <td>${this.escapeHtml(log.operation || log.action || '-')}</td>
                <td>${this.escapeHtml(log.user || log.changed_by || '-')}</td>
                <td><small>${this.escapeHtml(JSON.stringify(log.details || log.changes || {}).substring(0, 100))}</small></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    detailsPanel.innerHTML = html;
  }

  // ===================
  // Activity Log
  // ===================

  /**
   * Add an event to the activity log
   */
  public addEvent(type: 'info' | 'success' | 'warning' | 'error', message: string): void {
    const event: DatabaseEvent = {
      timestamp: new Date(),
      type,
      message,
    };

    this.recentEvents.unshift(event);

    if (this.recentEvents.length > this.maxEvents) {
      this.recentEvents = this.recentEvents.slice(0, this.maxEvents);
    }

    this.updateActivityList();
  }

  /**
   * Update the activity list in the DOM
   */
  private updateActivityList(): void {
    const activityList = document.getElementById('database-activity-list');
    if (!activityList) return;

    if (this.recentEvents.length > 0) {
      activityList.innerHTML = this.recentEvents
        .map(event => this.renderEventItem(event))
        .join('');
    } else {
      activityList.innerHTML = '<div class="activity-empty">No recent activity</div>';
    }
  }

  // ===================
  // Utility Methods
  // ===================

  /**
   * Get icon for event type
   */
  private getEventIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  }

  /**
   * Format timestamp
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString();
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
   * Clear activity log
   */
  public clearActivity(): void {
    this.recentEvents = [];
    this.updateActivityList();
  }

  /**
   * Destroy the database tab
   */
  public destroy(): void {
    this.stopConnectionChecks();
    this.recentEvents = [];
    if (this.backupManager) {
      this.backupManager.destroy();
      this.backupManager = null;
    }
    if (this.crudPanel) {
      this.crudPanel.destroy();
      this.crudPanel = null;
    }
    console.log('DatabaseTab destroyed');
  }
}

/**
 * Create and initialize the database tab
 */
export function createDatabaseTab(): DatabaseTab {
  const databaseTab = new DatabaseTab();
  return databaseTab;
}
