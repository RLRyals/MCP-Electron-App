/**
 * DashboardTab Component
 * Main dashboard interface with organized sections for system control
 *
 * Features:
 * - Top status bar with system health indicator
 * - Quick actions grid for common operations
 * - Service status cards with live updates
 * - Recent activity log
 * - Auto-refresh every 10 seconds
 */

export interface DashboardEvent {
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export class DashboardTab {
  private container: HTMLElement | null = null;
  private recentEvents: DashboardEvent[] = [];
  private maxEvents: number = 5;
  private autoRefreshInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 10000; // 10 seconds

  constructor() {
    this.recentEvents = [];
  }

  /**
   * Initialize the dashboard tab
   */
  public initialize(): void {
    this.container = document.getElementById('dashboard-card');
    if (!this.container) {
      console.error('Dashboard container not found');
      return;
    }

    // Render the dashboard structure
    this.render();

    // Start auto-refresh
    this.startAutoRefresh();

    console.log('DashboardTab initialized');
  }

  /**
   * Render the complete dashboard structure
   */
  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      ${this.renderTopStatusBar()}
      ${this.renderProgressSection()}
      ${this.renderQuickActionsGrid()}
      ${this.renderDatabaseManagement()}
      ${this.renderServiceStatusCards()}
      ${this.renderRecentActivity()}
      ${this.renderFooter()}
    `;
  }

  /**
   * Render the top status bar
   */
  private renderTopStatusBar(): string {
    return `
      <div class="dashboard-header">
        <h2>Writing System</h2>
        <div class="dashboard-status">
          <div id="dashboard-status-indicator" class="status-indicator status-red">
            <span class="status-dot"></span>
          </div>
          <span id="dashboard-status-text">System Offline</span>
        </div>
      </div>
    `;
  }

  /**
   * Render the progress section (shown during operations)
   */
  private renderProgressSection(): string {
    return `
      <div class="dashboard-progress" id="dashboard-progress">
        <div class="dashboard-progress-bar-container">
          <div class="dashboard-progress-bar" id="dashboard-progress-bar"></div>
        </div>
        <div class="dashboard-progress-text" id="dashboard-progress-text">
          Initializing...
        </div>
      </div>
    `;
  }

  /**
   * Render the quick actions grid
   */
  private renderQuickActionsGrid(): string {
    return `
      <div class="dashboard-section">
        <h3>Quick Actions</h3>
        <div class="dashboard-actions">
          <button id="dashboard-start-system" class="action-button primary" title="Start all services including PostgreSQL database and context servers">
            Start System
          </button>
          <button id="dashboard-stop-system" class="action-button" title="Gracefully shut down all running services">
            Stop System
          </button>
          <button id="dashboard-restart-system" class="action-button" title="Stop and restart all services (useful for troubleshooting)">
            Restart System
          </button>
          <button id="dashboard-open-typing-mind" class="action-button secondary prominent" title="Open Typing Mind web interface in your default browser">
            Open Typing Mind
          </button>
          <button id="dashboard-configure-typing-mind" class="action-button secondary" title="Automatically configure Typing Mind with connector settings">
            Configure Typing Mind
          </button>
          <button id="dashboard-configure-claude-desktop" class="action-button secondary" title="Configure Claude Desktop with native stdio servers">
            Configure Claude Desktop
          </button>
          <button id="dashboard-refresh-status" class="action-button icon-only" title="Refresh the status of all services and update the dashboard">
            🔄
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render the database management section
   */
  private renderDatabaseManagement(): string {
    return `
      <div class="dashboard-section">
        <h3>Database Management</h3>
        <div class="dashboard-actions">
          <button id="dashboard-backup-database" class="action-button secondary" title="Create a backup of your PostgreSQL database">
            Backup Database
          </button>
          <button id="dashboard-restore-database" class="action-button secondary" title="Restore database from a backup file">
            Restore Database
          </button>
          <button id="dashboard-manage-backups" class="action-button secondary" title="View and manage existing database backups">
            Manage Backups
          </button>
          <button id="dashboard-open-backup-folder" class="action-button secondary" title="Open the folder containing database backups">
            Open Backup Folder
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render the service status cards
   */
  private renderServiceStatusCards(): string {
    return `
      <div class="dashboard-section">
        <h3>Services</h3>
        <div class="service-cards">
          <!-- PostgreSQL Card -->
          <div class="service-card" id="postgres-card">
            <div class="service-card-header">
              <div class="service-name">
                <span id="postgres-status-icon" class="service-status-icon">
                  <span class="status-dot status-red"></span>
                </span>
                <h4>PostgreSQL</h4>
              </div>
              <span id="postgres-status-text" class="service-status">Offline</span>
            </div>
            <div class="service-card-body">
              <div class="service-info">
                <span id="postgres-port-display" class="service-detail">Port: 5432</span>
              </div>
              <button class="service-action-btn view-logs-btn" data-service="postgres" title="View recent PostgreSQL database logs for troubleshooting">
                View Logs
              </button>
            </div>
          </div>

          <!-- MCP Servers Card -->
          <div class="service-card" id="mcp-servers-card">
            <div class="service-card-header">
              <div class="service-name">
                <span id="mcp-servers-status-icon" class="service-status-icon">
                  <span class="status-dot status-red"></span>
                </span>
                <h4>Context Servers</h4>
              </div>
              <span id="mcp-servers-status-text" class="service-status">Offline</span>
            </div>
            <div class="service-card-body">
              <div class="service-info">
                <span class="service-detail">Version: latest</span>
              </div>
              <button class="service-action-btn view-logs-btn" data-service="mcp-servers" title="View recent context server logs for troubleshooting">
                View Logs
              </button>
            </div>
          </div>

          <!-- MCP Connector Card -->
          <div class="service-card" id="mcp-connector-card" style="display: none;">
            <div class="service-card-header">
              <div class="service-name">
                <span id="mcp-connector-status-icon" class="service-status-icon">
                  <span class="status-dot status-red"></span>
                </span>
                <h4>Context Connector</h4>
              </div>
              <span id="mcp-connector-status-text" class="service-status">Offline</span>
            </div>
            <div class="service-card-body">
              <div class="service-info">
                <span id="mcp-connector-port-display" class="service-detail">Port: 50880</span>
              </div>
              <div class="service-actions">
                <button class="service-action-btn view-logs-btn" data-service="mcp-connector" title="View recent connector logs for troubleshooting">
                  View Logs
                </button>
                <button class="service-action-btn copy-token-btn" title="Copy the authentication token to clipboard for configuring Claude Desktop">
                  Copy Token
                </button>
              </div>
            </div>
          </div>

          <!-- Typing Mind Card -->
          <div class="service-card" id="typing-mind-card" style="display: none;">
            <div class="service-card-header">
              <div class="service-name">
                <span id="typing-mind-status-icon" class="service-status-icon">
                  <span class="status-dot status-red"></span>
                </span>
                <h4>Typing Mind</h4>
              </div>
              <span id="typing-mind-status-text" class="service-status">Offline</span>
            </div>
            <div class="service-card-body">
              <div class="service-info">
                <span id="typing-mind-port-display" class="service-detail">Port: 3000</span>
              </div>
              <div class="service-actions">
                <button class="service-action-btn view-logs-btn" data-service="typing-mind" title="View recent Typing Mind logs for troubleshooting">
                  View Logs
                </button>
                <button class="service-action-btn open-browser-btn" data-url="" title="Open Typing Mind interface in your default web browser">
                  Open Browser
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the recent activity section
   */
  private renderRecentActivity(): string {
    const eventsHtml = this.recentEvents.length > 0
      ? this.recentEvents.map(event => this.renderEventItem(event)).join('')
      : '<div class="activity-empty">No recent activity</div>';

    return `
      <div class="dashboard-section">
        <h3>Recent Activity</h3>
        <div class="activity-list" id="activity-list">
          ${eventsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render a single activity event item
   */
  private renderEventItem(event: DashboardEvent): string {
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
   * Render the footer with last updated time
   */
  private renderFooter(): string {
    return `
      <div class="dashboard-footer">
        <span id="dashboard-last-updated" class="last-updated">Last updated: --:--:--</span>
      </div>
    `;
  }

  /**
   * Add an event to the recent activity log
   */
  public addEvent(type: 'info' | 'success' | 'warning' | 'error', message: string): void {
    const event: DashboardEvent = {
      timestamp: new Date(),
      type,
      message
    };

    // Add to the beginning of the array
    this.recentEvents.unshift(event);

    // Keep only the last maxEvents events
    if (this.recentEvents.length > this.maxEvents) {
      this.recentEvents = this.recentEvents.slice(0, this.maxEvents);
    }

    // Update the activity list in the DOM
    this.updateActivityList();
  }

  /**
   * Update the activity list in the DOM
   */
  private updateActivityList(): void {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;

    if (this.recentEvents.length > 0) {
      activityList.innerHTML = this.recentEvents
        .map(event => this.renderEventItem(event))
        .join('');
    } else {
      activityList.innerHTML = '<div class="activity-empty">No recent activity</div>';
    }
  }

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(): void {
    // Clear any existing interval
    this.stopAutoRefresh();

    // Note: The dashboard-handlers.ts already has a 5-second polling
    // This is an additional 10-second refresh for UI updates
    this.autoRefreshInterval = setInterval(() => {
      this.refreshStatus();
    }, this.REFRESH_INTERVAL);

    console.log('Dashboard auto-refresh started (10s interval)');
  }

  /**
   * Stop auto-refresh timer
   */
  private stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
      console.log('Dashboard auto-refresh stopped');
    }
  }

  /**
   * Refresh dashboard status
   */
  private async refreshStatus(): Promise<void> {
    // The actual status update is handled by dashboard-handlers.ts
    // This just logs that a refresh cycle occurred
    const timestamp = new Date().toLocaleTimeString();
    console.log(`Dashboard auto-refresh cycle at ${timestamp}`);
  }

  /**
   * Clear recent activity
   */
  public clearActivity(): void {
    this.recentEvents = [];
    this.updateActivityList();
  }

  /**
   * Get recent events
   */
  public getRecentEvents(): DashboardEvent[] {
    return [...this.recentEvents];
  }

  /**
   * Update status indicator
   */
  public updateStatusIndicator(status: 'online' | 'offline' | 'degraded' | 'starting', text: string): void {
    const indicator = document.getElementById('dashboard-status-indicator');
    const statusText = document.getElementById('dashboard-status-text');

    if (!indicator || !statusText) return;

    // Remove all status classes
    indicator.classList.remove('status-green', 'status-yellow', 'status-red');

    // Add appropriate class based on status
    switch (status) {
      case 'online':
        indicator.classList.add('status-green');
        break;
      case 'starting':
      case 'degraded':
        indicator.classList.add('status-yellow');
        break;
      case 'offline':
      default:
        indicator.classList.add('status-red');
        break;
    }

    statusText.textContent = text;
  }

  /**
   * Destroy the dashboard tab
   */
  public destroy(): void {
    this.stopAutoRefresh();
    this.recentEvents = [];
    console.log('DashboardTab destroyed');
  }
}

/**
 * Create and initialize the dashboard tab
 */
export function createDashboardTab(): DashboardTab {
  const dashboard = new DashboardTab();
  return dashboard;
}
