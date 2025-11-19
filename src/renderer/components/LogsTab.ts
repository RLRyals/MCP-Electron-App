/**
 * LogsTab Component
 * Centralized logs and diagnostics interface
 *
 * Features:
 * - Real-time application log display
 * - Service log viewer (PostgreSQL, MCP Server, Typing Mind, Docker)
 * - Log filtering by severity (error, warn, info, debug)
 * - Search functionality
 * - Export capabilities
 * - Diagnostic tools
 */

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  source?: string;
}

export interface LogsTabOptions {
  containerId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export class LogsTab {
  private containerId: string;
  private autoRefresh: boolean;
  private refreshInterval: number;
  private refreshTimer: NodeJS.Timeout | null = null;
  private currentService: 'application' | 'postgres' | 'mcp-servers' | 'mcp-connector' | 'typing-mind' = 'application';
  private currentFilter: 'all' | 'error' | 'warn' | 'info' | 'debug' = 'all';
  private searchQuery: string = '';
  private logs: LogEntry[] = [];
  private isInitialized: boolean = false;

  constructor(options: LogsTabOptions) {
    this.containerId = options.containerId;
    this.autoRefresh = options.autoRefresh ?? true;
    this.refreshInterval = options.refreshInterval ?? 5000; // 5 seconds
  }

  /**
   * Initialize the LogsTab component
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('LogsTab already initialized');
      return;
    }

    console.log('Initializing LogsTab...');

    try {
      this.render();
      this.attachEventListeners();
      await this.loadLogs();

      if (this.autoRefresh) {
        this.startAutoRefresh();
      }

      this.isInitialized = true;
      console.log('LogsTab initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LogsTab:', error);
      this.showError('Failed to initialize logs viewer');
    }
  }

  /**
   * Render the LogsTab UI
   */
  private render(): void {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container with id "${this.containerId}" not found`);
      return;
    }

    container.innerHTML = `
      <div class="logs-tab-container">
        <div class="logs-header">
          <h2>Logs & Diagnostics</h2>
          <p class="logs-subtitle">View and manage application and service logs</p>
        </div>

        <!-- Service Selector and Controls -->
        <div class="logs-controls">
          <div class="logs-control-group">
            <label for="service-selector">
              <span class="control-icon">🔍</span>
              Service:
            </label>
            <select id="service-selector" class="logs-select">
              <option value="application">Application Logs</option>
              <option value="postgres">PostgreSQL</option>
              <option value="mcp-servers">MCP Servers</option>
              <option value="mcp-connector">MCP Connector</option>
              <option value="typing-mind">Typing Mind</option>
            </select>
          </div>

          <div class="logs-control-group">
            <label for="severity-filter">
              <span class="control-icon">🎚️</span>
              Level:
            </label>
            <select id="severity-filter" class="logs-select">
              <option value="all">All Levels</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          <div class="logs-control-group logs-search-group">
            <label for="log-search">
              <span class="control-icon">🔎</span>
              Search:
            </label>
            <input
              type="text"
              id="log-search"
              class="logs-search-input"
              placeholder="Search logs..."
            />
            <button id="clear-search" class="logs-icon-btn" title="Clear search">
              ✕
            </button>
          </div>

          <button id="refresh-logs" class="logs-btn logs-btn-primary" title="Refresh logs">
            <span class="btn-icon">🔄</span>
            Refresh
          </button>
        </div>

        <!-- Log Display Area -->
        <div class="logs-display-container">
          <div class="logs-display-header">
            <div class="logs-info">
              <span id="log-count">0 entries</span>
              <span class="separator">•</span>
              <span id="log-source">Application</span>
              <span class="separator" id="auto-refresh-indicator">•</span>
              <span id="auto-refresh-status">Auto-refresh: ON</span>
            </div>
            <div class="logs-actions">
              <button id="toggle-auto-refresh" class="logs-icon-btn" title="Toggle auto-refresh">
                ⏸️
              </button>
              <button id="clear-display" class="logs-icon-btn" title="Clear display">
                🗑️
              </button>
            </div>
          </div>

          <div id="logs-display" class="logs-display">
            <div class="logs-loading">
              <div class="spinner"></div>
              <p>Loading logs...</p>
            </div>
          </div>
        </div>

        <!-- Diagnostic Tools -->
        <div class="logs-diagnostics">
          <h3>Diagnostic Tools</h3>
          <div class="diagnostics-grid">
            <button id="export-logs" class="diagnostic-btn" title="Export current logs to file">
              <span class="diagnostic-icon">💾</span>
              <span class="diagnostic-label">Export Logs</span>
            </button>

            <button id="export-diagnostic-report" class="diagnostic-btn" title="Generate comprehensive diagnostic report">
              <span class="diagnostic-icon">📋</span>
              <span class="diagnostic-label">Export Report</span>
            </button>

            <button id="run-system-test" class="diagnostic-btn" title="Run comprehensive system test">
              <span class="diagnostic-icon">🔬</span>
              <span class="diagnostic-label">System Test</span>
            </button>

            <button id="open-logs-folder" class="diagnostic-btn" title="Open logs directory in file explorer">
              <span class="diagnostic-icon">📁</span>
              <span class="diagnostic-label">Open Logs Folder</span>
            </button>
          </div>
        </div>

        <!-- System Test Results -->
        <div id="system-test-results-container" class="system-test-results" style="display: none;">
          <h3>System Test Results</h3>
          <div id="system-test-results-content"></div>
        </div>
      </div>
    `;

    this.addStyles();
  }

  /**
   * Add component-specific styles
   */
  private addStyles(): void {
    if (document.getElementById('logs-tab-styles')) {
      return; // Styles already added
    }

    const style = document.createElement('style');
    style.id = 'logs-tab-styles';
    style.textContent = `
      .logs-tab-container {
        padding: 20px;
        max-width: 1400px;
        margin: 0 auto;
      }

      .logs-header {
        margin-bottom: 25px;
      }

      .logs-header h2 {
        font-size: 2rem;
        margin-bottom: 8px;
      }

      .logs-subtitle {
        opacity: 0.9;
        font-size: 1rem;
      }

      .logs-controls {
        display: flex;
        gap: 15px;
        margin-bottom: 20px;
        flex-wrap: wrap;
        align-items: flex-end;
      }

      .logs-control-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .logs-control-group label {
        font-size: 0.9rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .control-icon {
        font-size: 1rem;
      }

      .logs-select {
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        padding: 10px 15px;
        border-radius: 8px;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.3s ease;
        min-width: 180px;
      }

      .logs-select:hover {
        border-color: rgba(255, 255, 255, 0.4);
        background: rgba(255, 255, 255, 0.15);
      }

      .logs-select:focus {
        outline: none;
        border-color: rgba(0, 212, 170, 0.5);
        background: rgba(255, 255, 255, 0.15);
      }

      .logs-search-group {
        flex: 1;
        min-width: 250px;
      }

      .logs-search-group label {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .logs-search-group > div {
        display: flex;
        gap: 5px;
      }

      .logs-search-input {
        flex: 1;
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        padding: 10px 15px;
        border-radius: 8px;
        font-size: 1rem;
        transition: all 0.3s ease;
      }

      .logs-search-input:focus {
        outline: none;
        border-color: rgba(0, 212, 170, 0.5);
        background: rgba(255, 255, 255, 0.15);
      }

      .logs-search-input::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }

      .logs-btn {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        border: 2px solid rgba(255, 255, 255, 0.3);
        padding: 10px 20px;
        font-size: 1rem;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
      }

      .logs-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.3);
        border-color: rgba(255, 255, 255, 0.5);
        transform: translateY(-2px);
      }

      .logs-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .logs-btn-primary {
        background: rgba(0, 212, 170, 0.3);
        border-color: rgba(0, 212, 170, 0.5);
      }

      .logs-btn-primary:hover:not(:disabled) {
        background: rgba(0, 212, 170, 0.5);
        border-color: rgba(0, 212, 170, 0.7);
      }

      .logs-icon-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 1rem;
      }

      .logs-icon-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
      }

      .btn-icon {
        font-size: 1.1rem;
      }

      .logs-display-container {
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 30px;
      }

      .logs-display-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .logs-info {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.9rem;
        opacity: 0.9;
      }

      .separator {
        opacity: 0.5;
      }

      .logs-actions {
        display: flex;
        gap: 8px;
      }

      .logs-display {
        height: 500px;
        overflow-y: auto;
        padding: 15px;
        font-family: 'Courier New', Consolas, monospace;
        font-size: 0.9rem;
        background: rgba(0, 0, 0, 0.3);
      }

      .logs-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 15px;
        opacity: 0.7;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.2);
        border-top-color: #00D4AA;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .log-entry {
        padding: 8px 12px;
        margin-bottom: 4px;
        border-left: 3px solid transparent;
        border-radius: 4px;
        transition: background 0.2s ease;
      }

      .log-entry:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .log-entry.level-error {
        border-left-color: #f44336;
        background: rgba(244, 67, 54, 0.1);
      }

      .log-entry.level-warn {
        border-left-color: #FFB84D;
        background: rgba(255, 184, 77, 0.1);
      }

      .log-entry.level-info {
        border-left-color: #2196F3;
        background: rgba(33, 150, 243, 0.1);
      }

      .log-entry.level-debug {
        border-left-color: #9E9E9E;
        background: rgba(158, 158, 158, 0.05);
      }

      .log-timestamp {
        color: rgba(255, 255, 255, 0.6);
        margin-right: 10px;
      }

      .log-level {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 600;
        margin-right: 10px;
        text-transform: uppercase;
      }

      .log-level.error {
        background: rgba(244, 67, 54, 0.3);
        color: #ffcdd2;
      }

      .log-level.warn {
        background: rgba(255, 184, 77, 0.3);
        color: #fff3cd;
      }

      .log-level.info {
        background: rgba(33, 150, 243, 0.3);
        color: #bbdefb;
      }

      .log-level.debug {
        background: rgba(158, 158, 158, 0.3);
        color: #e0e0e0;
      }

      .log-message {
        color: rgba(255, 255, 255, 0.95);
        word-wrap: break-word;
      }

      .log-highlight {
        background: rgba(255, 235, 59, 0.3);
        padding: 2px 4px;
        border-radius: 2px;
      }

      .logs-empty {
        text-align: center;
        padding: 60px 20px;
        opacity: 0.6;
      }

      .logs-empty-icon {
        font-size: 3rem;
        margin-bottom: 15px;
      }

      .logs-diagnostics {
        margin-top: 30px;
      }

      .logs-diagnostics h3 {
        font-size: 1.5rem;
        margin-bottom: 15px;
      }

      .diagnostics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
      }

      .diagnostic-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        padding: 20px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        text-align: center;
      }

      .diagnostic-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
        transform: translateY(-2px);
      }

      .diagnostic-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .diagnostic-icon {
        font-size: 2rem;
      }

      .diagnostic-label {
        font-size: 1rem;
        font-weight: 500;
      }

      .system-test-results {
        margin-top: 30px;
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 20px;
      }

      .system-test-results h3 {
        font-size: 1.5rem;
        margin-bottom: 15px;
      }

      .test-check {
        padding: 12px;
        margin-bottom: 8px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .test-check.pass {
        background: rgba(76, 175, 80, 0.2);
        border-left: 4px solid #4CAF50;
      }

      .test-check.fail {
        background: rgba(244, 67, 54, 0.2);
        border-left: 4px solid #f44336;
      }

      .test-check.warning {
        background: rgba(255, 184, 77, 0.2);
        border-left: 4px solid #FFB84D;
      }

      .test-check-icon {
        font-size: 1.3rem;
        font-weight: bold;
      }

      .test-check-content {
        flex: 1;
      }

      .test-check-name {
        font-weight: 600;
        margin-bottom: 4px;
      }

      .test-check-message {
        font-size: 0.9rem;
        opacity: 0.9;
      }

      @media (max-width: 768px) {
        .logs-controls {
          flex-direction: column;
        }

        .logs-control-group {
          width: 100%;
        }

        .logs-select, .logs-search-input {
          width: 100%;
        }

        .logs-display {
          height: 400px;
        }

        .diagnostics-grid {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Service selector
    const serviceSelector = document.getElementById('service-selector') as HTMLSelectElement;
    if (serviceSelector) {
      serviceSelector.addEventListener('change', () => {
        this.currentService = serviceSelector.value as any;
        this.loadLogs();
      });
    }

    // Severity filter
    const severityFilter = document.getElementById('severity-filter') as HTMLSelectElement;
    if (severityFilter) {
      severityFilter.addEventListener('change', () => {
        this.currentFilter = severityFilter.value as any;
        this.renderLogs();
      });
    }

    // Search input
    const searchInput = document.getElementById('log-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value;
        this.renderLogs();
      });
    }

    // Clear search
    const clearSearch = document.getElementById('clear-search');
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          this.searchQuery = '';
          this.renderLogs();
        }
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-logs');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadLogs());
    }

    // Toggle auto-refresh
    const toggleAutoRefresh = document.getElementById('toggle-auto-refresh');
    if (toggleAutoRefresh) {
      toggleAutoRefresh.addEventListener('click', () => {
        this.autoRefresh = !this.autoRefresh;
        if (this.autoRefresh) {
          this.startAutoRefresh();
          toggleAutoRefresh.textContent = '⏸️';
          toggleAutoRefresh.title = 'Pause auto-refresh';
        } else {
          this.stopAutoRefresh();
          toggleAutoRefresh.textContent = '▶️';
          toggleAutoRefresh.title = 'Resume auto-refresh';
        }
        this.updateAutoRefreshStatus();
      });
    }

    // Clear display
    const clearDisplay = document.getElementById('clear-display');
    if (clearDisplay) {
      clearDisplay.addEventListener('click', () => {
        this.logs = [];
        this.renderLogs();
      });
    }

    // Export logs
    const exportLogs = document.getElementById('export-logs');
    if (exportLogs) {
      exportLogs.addEventListener('click', () => this.exportLogs());
    }

    // Export diagnostic report
    const exportReport = document.getElementById('export-diagnostic-report');
    if (exportReport) {
      exportReport.addEventListener('click', () => this.exportDiagnosticReport());
    }

    // Run system test
    const runTest = document.getElementById('run-system-test');
    if (runTest) {
      runTest.addEventListener('click', () => this.runSystemTest());
    }

    // Open logs folder
    const openFolder = document.getElementById('open-logs-folder');
    if (openFolder) {
      openFolder.addEventListener('click', () => this.openLogsFolder());
    }
  }

  /**
   * Load logs from the selected source
   */
  private async loadLogs(): Promise<void> {
    const logsDisplay = document.getElementById('logs-display');
    if (!logsDisplay) return;

    // Show loading state
    logsDisplay.innerHTML = `
      <div class="logs-loading">
        <div class="spinner"></div>
        <p>Loading logs...</p>
      </div>
    `;

    try {
      if (this.currentService === 'application') {
        await this.loadApplicationLogs();
      } else {
        await this.loadServiceLogs(this.currentService);
      }

      this.renderLogs();
      this.updateLogInfo();
    } catch (error) {
      console.error('Error loading logs:', error);
      this.showError('Failed to load logs');
    }
  }

  /**
   * Load application logs
   */
  private async loadApplicationLogs(): Promise<void> {
    try {
      const logLines = await window.electronAPI.logger.getRecentLogs(500);

      this.logs = logLines.map(line => this.parseLogLine(line)).filter(log => log !== null) as LogEntry[];
    } catch (error) {
      console.error('Error loading application logs:', error);
      this.logs = [];
    }
  }

  /**
   * Load service logs
   */
  private async loadServiceLogs(service: string): Promise<void> {
    try {
      const serviceMap: { [key: string]: 'postgres' | 'mcp-writing-servers' | 'mcp-connector' | 'typing-mind' } = {
        'postgres': 'postgres',
        'mcp-servers': 'mcp-writing-servers',
        'mcp-connector': 'mcp-connector',
        'typing-mind': 'typing-mind',
      };

      const serviceName = serviceMap[service];
      if (!serviceName) {
        this.logs = [];
        return;
      }

      const result = await window.electronAPI.mcpSystem.getLogs(serviceName, 200);

      if (result.success) {
        const logLines = result.logs.split('\n').filter(line => line.trim() !== '');
        this.logs = logLines.map(line => this.parseServiceLogLine(line, service)).filter(log => log !== null) as LogEntry[];
      } else {
        this.logs = [];
      }
    } catch (error) {
      console.error(`Error loading ${service} logs:`, error);
      this.logs = [];
    }
  }

  /**
   * Parse a log line into a LogEntry
   */
  private parseLogLine(line: string): LogEntry | null {
    // Try to parse as JSON first (structured logging)
    try {
      const parsed = JSON.parse(line);
      return {
        timestamp: parsed.timestamp || new Date().toISOString(),
        level: parsed.level || 'info',
        message: parsed.message || line,
        source: parsed.source || 'application'
      };
    } catch {
      // Fall back to simple parsing
      const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/);
      const levelMatch = line.match(/\[(ERROR|WARN|INFO|DEBUG)\]/i);

      return {
        timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
        level: levelMatch ? levelMatch[1].toLowerCase() as any : 'info',
        message: line,
        source: 'application'
      };
    }
  }

  /**
   * Parse a service log line into a LogEntry
   */
  private parseServiceLogLine(line: string, service: string): LogEntry | null {
    if (!line || line.trim() === '') return null;

    // Extract timestamp if present
    const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/);

    // Try to detect log level
    let level: 'error' | 'warn' | 'info' | 'debug' = 'info';
    if (/error|fail|exception|fatal/i.test(line)) {
      level = 'error';
    } else if (/warn|warning/i.test(line)) {
      level = 'warn';
    } else if (/debug|trace/i.test(line)) {
      level = 'debug';
    }

    return {
      timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
      level,
      message: line,
      source: service
    };
  }

  /**
   * Render logs to the display
   */
  private renderLogs(): void {
    const logsDisplay = document.getElementById('logs-display');
    if (!logsDisplay) return;

    // Filter logs
    let filteredLogs = this.logs;

    // Filter by severity
    if (this.currentFilter !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === this.currentFilter);
    }

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filteredLogs = filteredLogs.filter(log =>
        log.message.toLowerCase().includes(query) ||
        log.level.toLowerCase().includes(query) ||
        (log.source && log.source.toLowerCase().includes(query))
      );
    }

    // Render
    if (filteredLogs.length === 0) {
      logsDisplay.innerHTML = `
        <div class="logs-empty">
          <div class="logs-empty-icon">📭</div>
          <p>No logs found</p>
          ${this.searchQuery ? '<p style="font-size: 0.9rem; opacity: 0.8;">Try adjusting your search or filter</p>' : ''}
        </div>
      `;
      return;
    }

    logsDisplay.innerHTML = filteredLogs.map(log => {
      const highlightedMessage = this.highlightSearchQuery(log.message);
      const timestamp = new Date(log.timestamp).toLocaleTimeString();

      return `
        <div class="log-entry level-${log.level}">
          <span class="log-timestamp">${timestamp}</span>
          <span class="log-level ${log.level}">${log.level}</span>
          <span class="log-message">${highlightedMessage}</span>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    logsDisplay.scrollTop = logsDisplay.scrollHeight;

    this.updateLogInfo();
  }

  /**
   * Highlight search query in text
   */
  private highlightSearchQuery(text: string): string {
    if (!this.searchQuery) return this.escapeHtml(text);

    const escapedText = this.escapeHtml(text);
    const escapedQuery = this.escapeHtml(this.searchQuery);
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    return escapedText.replace(regex, '<span class="log-highlight">$1</span>');
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update log info display
   */
  private updateLogInfo(): void {
    const logCount = document.getElementById('log-count');
    const logSource = document.getElementById('log-source');

    if (logCount) {
      const count = this.logs.length;
      logCount.textContent = `${count} ${count === 1 ? 'entry' : 'entries'}`;
    }

    if (logSource) {
      const sourceNames: { [key: string]: string } = {
        'application': 'Application',
        'postgres': 'PostgreSQL',
        'mcp-servers': 'MCP Servers',
        'mcp-connector': 'MCP Connector',
        'typing-mind': 'Typing Mind'
      };
      logSource.textContent = sourceNames[this.currentService] || this.currentService;
    }
  }

  /**
   * Update auto-refresh status display
   */
  private updateAutoRefreshStatus(): void {
    const status = document.getElementById('auto-refresh-status');
    if (status) {
      status.textContent = `Auto-refresh: ${this.autoRefresh ? 'ON' : 'OFF'}`;
    }
  }

  /**
   * Start auto-refresh
   */
  private startAutoRefresh(): void {
    this.stopAutoRefresh(); // Clear any existing timer

    this.refreshTimer = setInterval(() => {
      this.loadLogs();
    }, this.refreshInterval);

    console.log('Auto-refresh started');
  }

  /**
   * Stop auto-refresh
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log('Auto-refresh stopped');
    }
  }

  /**
   * Export logs to file
   */
  private async exportLogs(): Promise<void> {
    try {
      const button = document.getElementById('export-logs') as HTMLButtonElement;
      if (button) button.disabled = true;

      // Format logs as text
      const logsText = this.logs.map(log => {
        const timestamp = new Date(log.timestamp).toISOString();
        return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
      }).join('\n');

      // Create blob and download
      const blob = new Blob([logsText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.currentService}-logs-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      this.showNotification('Logs exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting logs:', error);
      this.showNotification('Failed to export logs', 'error');
    } finally {
      const button = document.getElementById('export-logs') as HTMLButtonElement;
      if (button) button.disabled = false;
    }
  }

  /**
   * Export diagnostic report
   */
  private async exportDiagnosticReport(): Promise<void> {
    try {
      const button = document.getElementById('export-diagnostic-report') as HTMLButtonElement;
      if (button) {
        button.disabled = true;
        button.textContent = 'Exporting...';
      }

      this.showNotification('Generating diagnostic report...', 'info');

      const result = await window.electronAPI.logger.exportDiagnosticReport();

      if (result.success) {
        this.showNotification(`Diagnostic report exported to: ${result.path}`, 'success');
      } else {
        this.showNotification(`Failed to export report: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error exporting diagnostic report:', error);
      this.showNotification('Failed to export diagnostic report', 'error');
    } finally {
      const button = document.getElementById('export-diagnostic-report') as HTMLButtonElement;
      if (button) {
        button.disabled = false;
        button.innerHTML = '<span class="diagnostic-icon">📋</span><span class="diagnostic-label">Export Report</span>';
      }
    }
  }

  /**
   * Run system test
   */
  private async runSystemTest(): Promise<void> {
    try {
      const button = document.getElementById('run-system-test') as HTMLButtonElement;
      const resultsContainer = document.getElementById('system-test-results-container');
      const resultsContent = document.getElementById('system-test-results-content');

      if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="diagnostic-icon">⏳</span><span class="diagnostic-label">Testing...</span>';
      }

      if (resultsContainer) {
        resultsContainer.style.display = 'block';
      }

      if (resultsContent) {
        resultsContent.innerHTML = '<p style="text-align: center; padding: 20px;">Running system tests...</p>';
      }

      const results = await window.electronAPI.logger.testSystem();

      if (resultsContent) {
        const checksHtml = results.checks.map(check => {
          const icon = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '⚠';
          return `
            <div class="test-check ${check.status}">
              <span class="test-check-icon">${icon}</span>
              <div class="test-check-content">
                <div class="test-check-name">${check.name}</div>
                <div class="test-check-message">${check.message}</div>
              </div>
            </div>
          `;
        }).join('');

        resultsContent.innerHTML = `
          <div style="margin-bottom: 15px; padding: 15px; background: ${results.passed ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}; border-radius: 8px;">
            <strong>Overall Result:</strong> ${results.passed ? '✓ All tests passed' : '✗ Some tests failed'}
          </div>
          ${checksHtml}
        `;
      }

      const message = results.passed ? 'System test passed!' : 'System test completed with warnings';
      this.showNotification(message, results.passed ? 'success' : 'error');
    } catch (error) {
      console.error('Error running system test:', error);
      this.showNotification('Failed to run system test', 'error');
    } finally {
      const button = document.getElementById('run-system-test') as HTMLButtonElement;
      if (button) {
        button.disabled = false;
        button.innerHTML = '<span class="diagnostic-icon">🔬</span><span class="diagnostic-label">System Test</span>';
      }
    }
  }

  /**
   * Open logs folder
   */
  private async openLogsFolder(): Promise<void> {
    try {
      await window.electronAPI.logger.openLogsDirectory();
      this.showNotification('Opening logs folder...', 'info');
    } catch (error) {
      console.error('Error opening logs folder:', error);
      this.showNotification('Failed to open logs folder', 'error');
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const logsDisplay = document.getElementById('logs-display');
    if (logsDisplay) {
      logsDisplay.innerHTML = `
        <div class="logs-empty">
          <div class="logs-empty-icon">❌</div>
          <p>${message}</p>
        </div>
      `;
    }
  }

  /**
   * Show notification
   */
  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // Use the global showNotification function if available
    if ((window as any).showNotification) {
      (window as any).showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Destroy the component
   */
  public destroy(): void {
    this.stopAutoRefresh();
    this.logs = [];
    this.isInitialized = false;

    // Remove styles
    const styles = document.getElementById('logs-tab-styles');
    if (styles) {
      styles.remove();
    }

    console.log('LogsTab destroyed');
  }
}

/**
 * Create and initialize the default LogsTab
 */
export function createDefaultLogsTab(): LogsTab {
  const logsTab = new LogsTab({
    containerId: 'tab-panel-logs',
    autoRefresh: true,
    refreshInterval: 5000 // 5 seconds
  });

  return logsTab;
}
