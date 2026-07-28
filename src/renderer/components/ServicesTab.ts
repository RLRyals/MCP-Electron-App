/**
 * ServicesTab Component (issue #124)
 * Comprehensive service management interface for all FictionLab services
 *
 * Features:
 * - PostgreSQL database management with connection details and real controls
 * - Individual MCP server management (Connector + Writing Servers): status,
 *   port, start/stop/restart, and per-server logs
 * - Docker Desktop lifecycle management with real version info
 * - Per-service log viewing (with credential redaction)
 * - Real resource usage monitoring via `docker stats`
 * - Start All / Stop All / Restart All top-bar actions (window events
 *   dispatched by ServicesView)
 * - Ports settings section with conflict checking
 */

interface ContainerHealth {
  name: string;
  status: string;
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
  running: boolean;
}

interface ServiceUrls {
  mcpConnector?: string;
  postgres?: string;
}

interface EnvConfig {
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_PORT: number;
  MCP_CONNECTOR_PORT: number;
  HTTP_SSE_PORT: number;
  DB_ADMIN_PORT: number;
  MCP_AUTH_TOKEN: string;
  PGBOUNCER_PORT: number;
  NPE_PORT: number;
  WORKFLOW_MANAGER_PORT: number;
  OUTLINE_PORT: number;
  KANBAN_PORT: number;
  STORY_ANALYSIS_PORT: number;
  SERIES_PORT: number;
  CHAPTER_PORT: number;
  CHARACTER_PORT: number;
  SCENE_PORT: number;
  AUTHOR_PORT: number;
}

/**
 * Shape of one entry from mcpSystem.getDetailedStatus().services
 */
interface DetailedServiceStatusEntry {
  serviceName: string;
  containerName: string;
  status: 'starting' | 'running' | 'healthy' | 'unhealthy' | 'stopped' | 'missing';
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
  url?: string;
  port?: number;
  message: string;
}

/**
 * Live per-container resource usage from mcpSystem.getResourceUsage()
 */
interface ResourceUsage {
  cpuPercent: string;
  memoryUsage: string;
  memoryPercent: string;
}

/**
 * Services that can be individually controlled via mcpSystem.controlService
 */
type ControlledService = 'postgres' | 'mcp-writing-servers' | 'mcp-connector';

type ServiceAction = 'start' | 'stop' | 'restart';

const ACTION_PROGRESS_LABEL: Record<ServiceAction, string> = {
  start: 'Starting',
  stop: 'Stopping',
  restart: 'Restarting',
};

function pastTense(action: ServiceAction): string {
  return action === 'stop' ? 'stopped' : `${action}ed`;
}

/**
 * Container names as reported by getDetailedStatus, keyed by service id.
 */
const SERVICE_CONTAINERS: Record<ControlledService, string> = {
  'postgres': 'fictionlab-postgres',
  'mcp-connector': 'fictionlab-mcp-connector',
  'mcp-writing-servers': 'fictionlab-mcp-servers',
};

/**
 * The two individually-managed MCP servers shown in the MCP Servers card.
 * elementPrefix matches the ids in ServicesView markup
 * (`<prefix>-status-badge`, `<prefix>-port-info`, `<prefix>-resource-usage`,
 * `<prefix>-start|stop|restart|view-logs`).
 */
const MCP_SERVERS: Array<{
  service: 'mcp-connector' | 'mcp-writing-servers';
  elementPrefix: string;
  displayName: string;
}> = [
  { service: 'mcp-connector', elementPrefix: 'mcp-connector', displayName: 'MCP Connector' },
  { service: 'mcp-writing-servers', elementPrefix: 'mcp-writing-servers', displayName: 'MCP Writing Servers' },
];

/**
 * A single row in the Ports settings table
 */
interface PortRowDefinition {
  key: 'POSTGRES_PORT' | 'PGBOUNCER_PORT' | 'MCP_CONNECTOR_PORT' | 'HTTP_SSE_PORT' | 'DB_ADMIN_PORT' | 'NPE_PORT' | 'WORKFLOW_MANAGER_PORT' | 'OUTLINE_PORT' | 'KANBAN_PORT' | 'STORY_ANALYSIS_PORT' | 'SERIES_PORT' | 'CHAPTER_PORT' | 'CHARACTER_PORT' | 'SCENE_PORT' | 'AUTHOR_PORT';
  name: string;
}

/**
 * Canonical list of all user-facing ports.
 */
const PORT_ROWS: PortRowDefinition[] = [
  { key: 'POSTGRES_PORT', name: 'PostgreSQL' },
  { key: 'PGBOUNCER_PORT', name: 'PgBouncer' },
  { key: 'MCP_CONNECTOR_PORT', name: 'MCP Connector' },
  { key: 'HTTP_SSE_PORT', name: 'HTTP/SSE' },
  { key: 'DB_ADMIN_PORT', name: 'DB Admin' },
  { key: 'NPE_PORT', name: 'NPE Server' },
  { key: 'WORKFLOW_MANAGER_PORT', name: 'Workflow Manager' },
  { key: 'OUTLINE_PORT', name: 'Outline Server' },
  { key: 'KANBAN_PORT', name: 'Kanban Server' },
  { key: 'STORY_ANALYSIS_PORT', name: 'Story Analysis Server' },
  { key: 'SERIES_PORT', name: 'Series Planning Server' },
  { key: 'CHAPTER_PORT', name: 'Chapter Planning Server' },
  { key: 'CHARACTER_PORT', name: 'Character Server' },
  { key: 'SCENE_PORT', name: 'Scene Server' },
  { key: 'AUTHOR_PORT', name: 'Author Server' },
];

export class ServicesTab {
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 5000; // 5 seconds
  private lastSuggestedPortsConfig: EnvConfig | null = null;
  private dockerVersion: string | null = null;

  // Bound top-bar action handlers (ServicesView dispatches these window
  // events from its TopBar actions). Kept as fields so cleanup() can
  // remove exactly the listeners initialize() added.
  private readonly onStartAllEvent = (): void => {
    void this.handleSystemAction('start');
  };
  private readonly onStopAllEvent = (): void => {
    void this.handleSystemAction('stop');
  };
  private readonly onRestartAllEvent = (): void => {
    void this.handleSystemAction('restart');
  };

  constructor() {
    console.log('ServicesTab component initialized');
  }

  /**
   * Initialize the Services Tab
   */
  public async initialize(): Promise<void> {
    console.log('Initializing Services Tab...');

    try {
      // Setup event listeners
      this.setupEventListeners();

      // Docker version rarely changes; fetch once and cache
      await this.loadDockerVersion();

      // Load initial service status
      await this.refreshAllServices();

      // Load the Ports settings table
      await this.loadPortsTable();

      // Start auto-refresh
      this.startAutoRefresh();

      console.log('Services Tab initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Services Tab:', error);
      this.showNotification('Failed to initialize Services Tab', 'error');
    }
  }

  /**
   * Setup all event listeners for service controls
   */
  private setupEventListeners(): void {
    // PostgreSQL controls
    this.setupPostgresListeners();

    // Individual MCP server controls (Connector + Writing Servers)
    this.setupMCPServersListeners();

    // Docker Desktop controls
    this.setupDockerListeners();

    // Refresh button
    const refreshBtn = document.getElementById('services-refresh-all');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshAllServices());
    }

    // Top-bar Start All / Stop All / Restart All actions (issue #124)
    window.addEventListener('services-start-all', this.onStartAllEvent);
    window.addEventListener('services-stop-all', this.onStopAllEvent);
    window.addEventListener('services-restart-all', this.onRestartAllEvent);

    // Ports section controls
    this.setupPortsListeners();
  }

  /**
   * Setup Ports section listeners
   */
  private setupPortsListeners(): void {
    const checkAllBtn = document.getElementById('ports-check-all');
    const useSuggestedBtn = document.getElementById('ports-use-suggested');
    const saveBtn = document.getElementById('ports-save');

    if (checkAllBtn) checkAllBtn.addEventListener('click', () => this.handleCheckAllPorts());
    if (useSuggestedBtn) useSuggestedBtn.addEventListener('click', () => this.handleUseSuggestedPorts());
    if (saveBtn) saveBtn.addEventListener('click', () => this.handleSavePorts());
  }

  /**
   * Build the current port values from the table's input fields.
   * Falls back to the last-loaded config for any row not yet rendered.
   */
  private readPortsFromInputs(baseConfig: EnvConfig): EnvConfig {
    const config: EnvConfig = { ...baseConfig };
    for (const row of PORT_ROWS) {
      const input = document.getElementById(`port-input-${row.key}`) as HTMLInputElement | null;
      if (input && input.value.trim() !== '') {
        const parsed = parseInt(input.value, 10);
        if (!isNaN(parsed)) {
          (config as any)[row.key] = parsed;
        }
      }
    }
    return config;
  }

  /**
   * Render a single port row's markup
   */
  private renderPortRowHtml(row: PortRowDefinition, port: number): string {
    return `
      <tr id="port-row-${row.key}" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
        <td style="padding: 8px;">${row.name}</td>
        <td style="padding: 8px;">
          <input type="number" id="port-input-${row.key}" value="${port}" min="1024" max="65535"
                 style="width: 100px; padding: 4px 6px; background: rgba(0,0,0,0.2); color: inherit; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px;" />
        </td>
        <td style="padding: 8px;">
          <span id="port-status-${row.key}" class="port-status">
            <span class="loading">checking…</span>
          </span>
        </td>
      </tr>
    `;
  }

  /**
   * Load the Ports table: fetch current config, render rows, and check live status
   */
  private async loadPortsTable(): Promise<void> {
    const tbody = document.getElementById('ports-table-body');
    if (!tbody) return;

    try {
      const config = await window.electronAPI.envConfig.getConfig() as EnvConfig;

      tbody.innerHTML = PORT_ROWS.map(row => this.renderPortRowHtml(row, (config as any)[row.key])).join('');

      // Wire up per-row "check on change"
      for (const row of PORT_ROWS) {
        const input = document.getElementById(`port-input-${row.key}`) as HTMLInputElement | null;
        if (input) {
          input.addEventListener('change', () => {
            const port = parseInt(input.value, 10);
            if (!isNaN(port)) {
              this.refreshPortRowStatus(row.key, port);
            }
          });
        }
      }

      // Live-check each port's current availability
      await Promise.all(PORT_ROWS.map(row => this.refreshPortRowStatus(row.key, (config as any)[row.key])));

      this.updatePortsLastChecked();
    } catch (error) {
      console.error('Error loading ports table:', error);
      tbody.innerHTML = '<tr><td colspan="3" style="padding: 8px;">Failed to load ports</td></tr>';
    }
  }

  /**
   * Check a single port's availability and update its status cell
   */
  private async refreshPortRowStatus(key: PortRowDefinition['key'], port: number): Promise<void> {
    const statusEl = document.getElementById(`port-status-${key}`);
    if (!statusEl) return;

    try {
      const available = await window.electronAPI.envConfig.checkPort(port);
      statusEl.innerHTML = available
        ? '<span class="available" style="color: #4CAF50;">✓ Available</span>'
        : '<span class="unavailable" style="color: #f44336;">✗ In use</span>';
    } catch (error) {
      console.error(`Error checking port ${port}:`, error);
      statusEl.innerHTML = '<span class="unavailable">? Unknown</span>';
    }
  }

  /**
   * "Check All" - runs checkAllPortsAndSuggestAlternatives against the current
   * table values and surfaces any conflicts plus a "Use Suggested" option.
   */
  private async handleCheckAllPorts(): Promise<void> {
    const statusMsg = document.getElementById('ports-status-message');
    const useSuggestedBtn = document.getElementById('ports-use-suggested');

    try {
      if (statusMsg) statusMsg.innerHTML = '<div style="opacity: 0.8;">Checking all ports…</div>';

      const baseConfig = await window.electronAPI.envConfig.getConfig() as EnvConfig;
      const config = this.readPortsFromInputs(baseConfig);

      const result = await window.electronAPI.envConfig.checkAllPorts(config as any);

      // Refresh each row's live status against the values actually checked
      await Promise.all(PORT_ROWS.map(row => this.refreshPortRowStatus(row.key, (config as any)[row.key])));

      if (result.hasConflicts) {
        this.lastSuggestedPortsConfig = (result.suggestedConfig as EnvConfig) || null;

        const conflictList = result.conflicts.map((c: any) =>
          `<li><strong>${c.name}</strong>: port ${c.port} is in use (suggested: ${c.suggested})</li>`
        ).join('');

        if (statusMsg) {
          statusMsg.innerHTML = `
            <div class="alert warning">
              <strong>Port conflicts detected</strong>
              <ul style="margin: 5px 0 0 20px; padding: 0;">${conflictList}</ul>
            </div>
          `;
        }

        if (useSuggestedBtn) useSuggestedBtn.style.display = 'inline-block';
      } else {
        this.lastSuggestedPortsConfig = null;
        if (statusMsg) {
          statusMsg.innerHTML = '<div class="alert success">All ports are available.</div>';
        }
        if (useSuggestedBtn) useSuggestedBtn.style.display = 'none';
      }

      this.updatePortsLastChecked();
    } catch (error) {
      console.error('Error checking all ports:', error);
      if (statusMsg) statusMsg.innerHTML = '<div class="alert error">Failed to check ports.</div>';
    }
  }

  /**
   * "Use Suggested" - applies the last-computed suggestedConfig to the input fields
   */
  private handleUseSuggestedPorts(): void {
    if (!this.lastSuggestedPortsConfig) return;

    for (const row of PORT_ROWS) {
      const input = document.getElementById(`port-input-${row.key}`) as HTMLInputElement | null;
      const value = (this.lastSuggestedPortsConfig as any)[row.key];
      if (input && value !== undefined) {
        input.value = String(value);
        input.style.borderColor = '#4CAF50';
        setTimeout(() => { input.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }, 2000);
      }
    }

    this.showNotification('Applied suggested available ports. Click Save to persist.', 'success');

    // Re-check with the newly applied values
    this.handleCheckAllPorts();
  }

  /**
   * "Save" - persists the port configuration to .env and prompts to restart services
   */
  private async handleSavePorts(): Promise<void> {
    const statusMsg = document.getElementById('ports-status-message');
    const saveBtn = document.getElementById('ports-save') as HTMLButtonElement | null;

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }

      const baseConfig = await window.electronAPI.envConfig.getConfig() as EnvConfig;
      const config = this.readPortsFromInputs(baseConfig);

      const validation = await window.electronAPI.envConfig.validateConfig(config as any);
      if (!validation.valid) {
        if (statusMsg) {
          statusMsg.innerHTML = `<div class="alert error">Validation failed: ${validation.errors.join(', ')}</div>`;
        }
        return;
      }

      const result = await window.electronAPI.envConfig.saveConfig(config as any);

      if (result.success) {
        if (statusMsg) {
          statusMsg.innerHTML = `<div class="alert success">Ports saved to ${result.path}. Restart services for changes to take effect.</div>`;
        }
        this.showNotification('Ports saved successfully', 'success');

        const shouldRestart = window.confirm(
          'Port configuration saved. Services must be restarted for the new ports to take effect. Restart now?'
        );
        if (shouldRestart) {
          this.showNotification('Restarting MCP system...', 'info');
          const restartResult = await window.electronAPI.mcpSystem.restart();
          if (restartResult.success) {
            this.showNotification('Services restarted successfully', 'success');
            await this.refreshAllServices();
          } else {
            this.showNotification(`Failed to restart services: ${restartResult.message}`, 'error');
          }
        }

        await this.loadPortsTable();
      } else {
        if (statusMsg) {
          statusMsg.innerHTML = `<div class="alert error">Failed to save: ${result.error}</div>`;
        }
        this.showNotification('Failed to save port configuration', 'error');
      }
    } catch (error) {
      console.error('Error saving ports:', error);
      if (statusMsg) statusMsg.innerHTML = '<div class="alert error">Error saving port configuration.</div>';
      this.showNotification('Error saving port configuration', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    }
  }

  /**
   * Update the "last checked" timestamp for the Ports section
   */
  private updatePortsLastChecked(): void {
    const el = document.getElementById('ports-last-checked');
    if (el) {
      el.textContent = `Last checked: ${new Date().toLocaleTimeString()}`;
    }
  }

  /**
   * Setup PostgreSQL service listeners
   */
  private setupPostgresListeners(): void {
    const startBtn = document.getElementById('postgres-start');
    const stopBtn = document.getElementById('postgres-stop');
    const restartBtn = document.getElementById('postgres-restart');
    const viewLogsBtn = document.getElementById('postgres-view-logs');
    const viewConnectionBtn = document.getElementById('postgres-view-connection');

    if (startBtn) startBtn.addEventListener('click', () => this.handleServiceControl('postgres', 'PostgreSQL', 'start'));
    if (stopBtn) stopBtn.addEventListener('click', () => this.handleServiceControl('postgres', 'PostgreSQL', 'stop'));
    if (restartBtn) restartBtn.addEventListener('click', () => this.handleServiceControl('postgres', 'PostgreSQL', 'restart'));
    if (viewLogsBtn) viewLogsBtn.addEventListener('click', () => this.handleViewLogs('postgres', 'PostgreSQL'));
    if (viewConnectionBtn) viewConnectionBtn.addEventListener('click', () => this.handleShowConnectionDetails());
  }

  /**
   * Setup per-server listeners for the MCP Servers card (issue #124):
   * each of the two servers gets its own start/stop/restart/logs controls,
   * plus the card-level aggregate health check.
   */
  private setupMCPServersListeners(): void {
    for (const server of MCP_SERVERS) {
      const startBtn = document.getElementById(`${server.elementPrefix}-start`);
      const stopBtn = document.getElementById(`${server.elementPrefix}-stop`);
      const restartBtn = document.getElementById(`${server.elementPrefix}-restart`);
      const viewLogsBtn = document.getElementById(`${server.elementPrefix}-view-logs`);

      if (startBtn) startBtn.addEventListener('click', () => this.handleServiceControl(server.service, server.displayName, 'start'));
      if (stopBtn) stopBtn.addEventListener('click', () => this.handleServiceControl(server.service, server.displayName, 'stop'));
      if (restartBtn) restartBtn.addEventListener('click', () => this.handleServiceControl(server.service, server.displayName, 'restart'));
      if (viewLogsBtn) viewLogsBtn.addEventListener('click', () => this.handleViewLogs(server.service, server.displayName));
    }

    const healthCheckBtn = document.getElementById('mcp-servers-health-check');
    if (healthCheckBtn) healthCheckBtn.addEventListener('click', () => this.handleMCPServersHealthCheck());
  }

  /**
   * Setup Docker Desktop listeners
   */
  private setupDockerListeners(): void {
    const startBtn = document.getElementById('docker-service-start');
    const stopBtn = document.getElementById('docker-service-stop');
    const restartBtn = document.getElementById('docker-service-restart');
    const healthCheckBtn = document.getElementById('docker-service-health-check');

    if (startBtn) startBtn.addEventListener('click', () => this.handleDockerStart());
    if (stopBtn) stopBtn.addEventListener('click', () => this.handleDockerStop());
    if (restartBtn) restartBtn.addEventListener('click', () => this.handleDockerRestart());
    if (healthCheckBtn) healthCheckBtn.addEventListener('click', () => this.handleDockerHealthCheck());
  }

  /**
   * Start / stop / restart a single service via the per-service control IPC
   * (issue #124 -- replaces the old "use the Dashboard" placeholder handlers).
   */
  private async handleServiceControl(
    service: ControlledService,
    displayName: string,
    action: ServiceAction
  ): Promise<void> {
    try {
      this.showNotification(`${ACTION_PROGRESS_LABEL[action]} ${displayName}...`, 'info');

      const result = await window.electronAPI.mcpSystem.controlService(service, action);

      if (result.success) {
        this.showNotification(`${displayName} ${pastTense(action)} successfully`, 'success');
      } else {
        this.showNotification(`Failed to ${action} ${displayName}: ${result.error || result.message}`, 'error');
      }

      await this.refreshAllServices();
    } catch (error) {
      console.error(`Error during ${action} of ${displayName}:`, error);
      this.showNotification(`Failed to ${action} ${displayName}`, 'error');
    }
  }

  /**
   * Start / stop / restart the whole MCP system. Wired to the top bar's
   * Start All / Stop All / Restart All actions via window events.
   */
  private async handleSystemAction(action: ServiceAction): Promise<void> {
    try {
      this.showNotification(`${ACTION_PROGRESS_LABEL[action]} all services...`, 'info');

      const api = window.electronAPI.mcpSystem;
      const result = action === 'start'
        ? await api.start()
        : action === 'stop'
          ? await api.stop()
          : await api.restart();

      if (result.success) {
        this.showNotification(`All services ${pastTense(action)} successfully`, 'success');
      } else {
        this.showNotification(`Failed to ${action} services: ${result.message}`, 'error');
      }

      await this.refreshAllServices();
    } catch (error) {
      console.error(`Error during system ${action}:`, error);
      this.showNotification(`Failed to ${action} services`, 'error');
    }
  }

  /**
   * Refresh all services status
   */
  private async refreshAllServices(): Promise<void> {
    try {
      // One status + one config fetch shared by all cards
      const [detailed, config] = await Promise.all([
        window.electronAPI.mcpSystem.getDetailedStatus(),
        window.electronAPI.envConfig.getConfig() as Promise<EnvConfig>,
      ]);

      const services: DetailedServiceStatusEntry[] = detailed?.services ?? [];

      await Promise.all([
        this.updatePostgreSQLCard(services, config),
        this.updateMCPServersCard(services),
        this.updateDockerCard(),
      ]);

      // Update last refresh timestamp
      this.updateLastRefreshTime();
    } catch (error) {
      console.error('Error refreshing services:', error);
    }
  }

  /**
   * Find a service's detailed status entry by its container name
   */
  private findService(
    services: DetailedServiceStatusEntry[],
    service: ControlledService
  ): DetailedServiceStatusEntry | undefined {
    return services.find(s => s.containerName === SERVICE_CONTAINERS[service]);
  }

  /**
   * Whether a detailed status entry represents a container that is up
   * (running in any state, including still starting or unhealthy)
   */
  private isServiceUp(entry: DetailedServiceStatusEntry | undefined): boolean {
    if (!entry) return false;
    return entry.status === 'healthy'
      || entry.status === 'running'
      || entry.status === 'starting'
      || entry.status === 'unhealthy';
  }

  /**
   * Apply a status badge (text + class) for a detailed status entry
   */
  private applyStatusBadge(elementId: string, entry: DetailedServiceStatusEntry | undefined): void {
    const badge = document.getElementById(elementId);
    if (!badge) return;

    if (!entry || entry.status === 'missing' || entry.status === 'stopped') {
      badge.className = 'service-status-badge status-offline';
      badge.textContent = 'Offline';
    } else if (entry.status === 'healthy') {
      badge.className = 'service-status-badge status-healthy';
      badge.textContent = 'Healthy';
    } else if (entry.status === 'running') {
      badge.className = 'service-status-badge status-healthy';
      badge.textContent = 'Running';
    } else if (entry.status === 'starting') {
      badge.className = 'service-status-badge status-starting';
      badge.textContent = 'Starting';
    } else {
      badge.className = 'service-status-badge status-offline';
      badge.textContent = 'Unhealthy';
    }
  }

  /**
   * Render real resource usage into an element. Fetches live CPU/memory via
   * `docker stats` when the service is up (issue #124 -- replaces the old
   * hardcoded placeholder numbers).
   */
  private async updateResourceUsage(
    elementId: string,
    service: ControlledService,
    isUp: boolean
  ): Promise<void> {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (!isUp) {
      el.innerHTML = '<div class="resource-item">Not running</div>';
      return;
    }

    try {
      const usage: ResourceUsage | null = await window.electronAPI.mcpSystem.getResourceUsage(service);

      if (usage) {
        el.innerHTML = `
          <div class="resource-item">
            <span>CPU:</span>
            <span class="resource-value">${this.escapeHtml(usage.cpuPercent)}</span>
          </div>
          <div class="resource-item">
            <span>Memory:</span>
            <span class="resource-value">${this.escapeHtml(usage.memoryUsage)} (${this.escapeHtml(usage.memoryPercent)})</span>
          </div>
        `;
      } else {
        el.innerHTML = '<div class="resource-item">Usage unavailable</div>';
      }
    } catch (error) {
      console.error(`Error fetching resource usage for ${service}:`, error);
      el.innerHTML = '<div class="resource-item">Usage unavailable</div>';
    }
  }

  /**
   * Update PostgreSQL service card: status badge, connection info
   * (host / port / database), live resource usage, and control states.
   */
  private async updatePostgreSQLCard(
    services: DetailedServiceStatusEntry[],
    config: EnvConfig
  ): Promise<void> {
    try {
      const entry = this.findService(services, 'postgres');
      const isUp = this.isServiceUp(entry);

      this.applyStatusBadge('postgres-status-badge', entry);

      const hostDisplay = document.getElementById('postgres-host-info');
      const portDisplay = document.getElementById('postgres-port-info');
      const databaseDisplay = document.getElementById('postgres-database-info');

      if (hostDisplay) hostDisplay.textContent = 'Host: localhost';
      if (portDisplay) portDisplay.textContent = `Port: ${config.POSTGRES_PORT}`;
      if (databaseDisplay) databaseDisplay.textContent = `Database: ${config.POSTGRES_DB}`;

      await this.updateResourceUsage('postgres-resource-usage', 'postgres', isUp);

      // Enable/disable controls based on status
      this.updateServiceControls('postgres', isUp);
    } catch (error) {
      console.error('Error updating PostgreSQL card:', error);
    }
  }

  /**
   * Update the MCP Servers card: per-server rows (status badge, port, live
   * resource usage, control states) plus the aggregate card badge.
   */
  private async updateMCPServersCard(services: DetailedServiceStatusEntry[]): Promise<void> {
    try {
      const entries = MCP_SERVERS.map(server => ({
        server,
        entry: this.findService(services, server.service),
      }));

      // Aggregate badge: healthy only when every server is healthy
      const aggregateBadge = document.getElementById('mcp-servers-status-badge');
      if (aggregateBadge) {
        const upCount = entries.filter(({ entry }) => this.isServiceUp(entry)).length;
        const healthyCount = entries.filter(({ entry }) => entry?.status === 'healthy' || entry?.status === 'running').length;

        if (healthyCount === entries.length) {
          aggregateBadge.className = 'service-status-badge status-healthy';
          aggregateBadge.textContent = 'Healthy';
        } else if (upCount > 0) {
          aggregateBadge.className = 'service-status-badge status-starting';
          aggregateBadge.textContent = 'Degraded';
        } else {
          aggregateBadge.className = 'service-status-badge status-offline';
          aggregateBadge.textContent = 'Offline';
        }
      }

      // Per-server rows
      await Promise.all(entries.map(async ({ server, entry }) => {
        const isUp = this.isServiceUp(entry);

        this.applyStatusBadge(`${server.elementPrefix}-status-badge`, entry);

        const portDisplay = document.getElementById(`${server.elementPrefix}-port-info`);
        if (portDisplay) {
          portDisplay.textContent = entry?.port !== undefined ? `Port: ${entry.port}` : 'Port: --';
        }

        await this.updateResourceUsage(`${server.elementPrefix}-resource-usage`, server.service, isUp);

        this.updateServiceControls(server.elementPrefix, isUp);
      }));
    } catch (error) {
      console.error('Error updating MCP Servers card:', error);
    }
  }

  /**
   * Update Docker Desktop service card
   */
  private async updateDockerCard(): Promise<void> {
    try {
      const status = await window.electronAPI.docker.healthCheck();

      const statusBadge = document.getElementById('docker-status-badge');
      const healthDisplay = document.getElementById('docker-health-info');

      if (statusBadge) {
        if (status.running && status.healthy) {
          statusBadge.className = 'service-status-badge status-healthy';
          statusBadge.textContent = 'Healthy';
        } else if (status.running) {
          statusBadge.className = 'service-status-badge status-starting';
          statusBadge.textContent = 'Unhealthy';
        } else {
          statusBadge.className = 'service-status-badge status-offline';
          statusBadge.textContent = 'Offline';
        }
      }

      this.renderDockerVersion();

      if (healthDisplay) {
        healthDisplay.textContent = status.message;
      }

      // Enable/disable controls based on status
      this.updateServiceControls('docker-service', status.running);
    } catch (error) {
      console.error('Error updating Docker card:', error);
    }
  }

  /**
   * Fetch and cache the real Docker version (issue #124 -- replaces the
   * hardcoded "Docker Desktop" placeholder).
   */
  private async loadDockerVersion(): Promise<void> {
    try {
      const status = await window.electronAPI.prerequisites.getDockerVersion();
      this.dockerVersion = status?.version || null;
    } catch (error) {
      console.error('Error fetching Docker version:', error);
      this.dockerVersion = null;
    }
    this.renderDockerVersion();
  }

  /**
   * Render the cached Docker version into the Docker card
   */
  private renderDockerVersion(): void {
    const versionDisplay = document.getElementById('docker-version-info');
    if (versionDisplay) {
      versionDisplay.textContent = this.dockerVersion
        ? `Version: Docker ${this.dockerVersion}`
        : 'Version: unknown';
    }
  }

  /**
   * Update service control buttons based on running status
   */
  private updateServiceControls(servicePrefix: string, isRunning: boolean): void {
    const startBtn = document.getElementById(`${servicePrefix}-start`) as HTMLButtonElement;
    const stopBtn = document.getElementById(`${servicePrefix}-stop`) as HTMLButtonElement;
    const restartBtn = document.getElementById(`${servicePrefix}-restart`) as HTMLButtonElement;

    if (startBtn) startBtn.disabled = isRunning;
    if (stopBtn) stopBtn.disabled = !isRunning;
    if (restartBtn) restartBtn.disabled = !isRunning;
  }

  /**
   * Handle MCP Servers health check: per-server status summary in a dialog
   */
  private async handleMCPServersHealthCheck(): Promise<void> {
    try {
      const detailed = await window.electronAPI.mcpSystem.getDetailedStatus();
      const services: DetailedServiceStatusEntry[] = detailed?.services ?? [];

      const lines = MCP_SERVERS.map(server => {
        const entry = this.findService(services, server.service);
        if (!entry) {
          return `${server.displayName}: container not found`;
        }
        return `${server.displayName}\n  Status: ${entry.status}\n  Health: ${entry.health}\n  ${entry.message}`;
      });

      const allHealthy = MCP_SERVERS.every(server => {
        const entry = this.findService(services, server.service);
        return entry?.status === 'healthy' || entry?.status === 'running';
      });

      this.showLogsDialog('MCP Servers Health Check', lines.join('\n\n'));
      this.showNotification(
        allHealthy ? 'All MCP servers are healthy' : 'Some MCP servers are not healthy',
        allHealthy ? 'success' : 'info'
      );
    } catch (error) {
      console.error('Error checking MCP Servers health:', error);
      this.showNotification('Failed to check health status', 'error');
    }
  }

  /**
   * Handle Docker start
   */
  private async handleDockerStart(): Promise<void> {
    try {
      this.showNotification('Starting Docker Desktop...', 'info');
      const result = await window.electronAPI.docker.startAndWait();

      if (result.success) {
        this.showNotification('Docker Desktop started successfully!', 'success');
        await this.loadDockerVersion();
        await this.refreshAllServices();
      } else {
        this.showNotification(`Failed to start Docker: ${result.error || result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error starting Docker:', error);
      this.showNotification('Failed to start Docker Desktop', 'error');
    }
  }

  /**
   * Handle Docker stop
   */
  private async handleDockerStop(): Promise<void> {
    try {
      this.showNotification('Stopping Docker Desktop...', 'info');
      const result = await window.electronAPI.docker.stop();

      if (result.success) {
        this.showNotification('Docker Desktop stopped successfully', 'success');
        await this.refreshAllServices();
      } else {
        this.showNotification(`Failed to stop Docker: ${result.error || result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error stopping Docker:', error);
      this.showNotification('Failed to stop Docker Desktop', 'error');
    }
  }

  /**
   * Handle Docker restart
   */
  private async handleDockerRestart(): Promise<void> {
    try {
      this.showNotification('Restarting Docker Desktop...', 'info');
      const result = await window.electronAPI.docker.restart();

      if (result.success) {
        this.showNotification('Docker Desktop restarted successfully!', 'success');
        await this.loadDockerVersion();
        await this.refreshAllServices();
      } else {
        this.showNotification(`Failed to restart Docker: ${result.error || result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error restarting Docker:', error);
      this.showNotification('Failed to restart Docker Desktop', 'error');
    }
  }

  /**
   * Handle Docker health check
   */
  private async handleDockerHealthCheck(): Promise<void> {
    try {
      const health = await window.electronAPI.docker.healthCheck();

      const healthMsg = health.running && health.healthy
        ? 'Docker Desktop is running and healthy'
        : health.running
        ? `Docker Desktop is running but unhealthy: ${health.message}`
        : 'Docker Desktop is not running';

      this.showNotification(healthMsg, health.healthy ? 'success' : 'info');
    } catch (error) {
      console.error('Error checking Docker health:', error);
      this.showNotification('Failed to check Docker health', 'error');
    }
  }

  /**
   * Redact sensitive information from logs
   */
  private redactSensitiveInfo(logs: string): string {
    let redacted = logs;

    // Redact PostgreSQL connection strings
    redacted = redacted.replace(
      /postgresql:\/\/([^:]+):([^@]+)@/gi,
      'postgresql://$1:********@'
    );

    // Redact password in connection URIs
    redacted = redacted.replace(
      /:\/\/([^:]+):([^@]+)@/gi,
      '://$1:********@'
    );

    // Redact environment variables for passwords
    redacted = redacted.replace(
      /(POSTGRES_PASSWORD|PASSWORD|PASS|pwd)=([^\s&]+)/gi,
      '$1=********'
    );

    // Redact authentication tokens
    redacted = redacted.replace(
      /(MCP_AUTH_TOKEN|AUTH_TOKEN|TOKEN|token)=([^\s&]+)/gi,
      '$1=********'
    );

    return redacted;
  }

  /**
   * Handle viewing service logs
   */
  private async handleViewLogs(serviceName: 'postgres' | 'mcp-writing-servers' | 'mcp-connector', displayName: string): Promise<void> {
    try {
      const result = await window.electronAPI.mcpSystem.getLogs(serviceName, 100);

      if (result.success) {
        const redactedLogs = this.redactSensitiveInfo(result.logs);
        this.showLogsDialog(`${displayName} Logs`, redactedLogs);
      } else {
        this.showNotification(`Failed to get logs: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error viewing logs:', error);
      this.showNotification('Failed to view logs', 'error');
    }
  }

  /**
   * Handle showing PostgreSQL connection details
   */
  private async handleShowConnectionDetails(): Promise<void> {
    try {
      const config = await window.electronAPI.envConfig.getConfig();

      const details = `
Database: ${config.POSTGRES_DB}
User: ${config.POSTGRES_USER}
Password: ********
Port: ${config.POSTGRES_PORT}
Host: localhost

Connection String:
postgresql://${config.POSTGRES_USER}:********@localhost:${config.POSTGRES_PORT}/${config.POSTGRES_DB}
      `.trim();

      this.showLogsDialog('PostgreSQL Connection Details', details);
    } catch (error) {
      console.error('Error showing connection details:', error);
      this.showNotification('Failed to load connection details', 'error');
    }
  }

  /**
   * Show logs dialog
   */
  private showLogsDialog(title: string, content: string): void {
    const dialog = document.createElement('div');
    dialog.className = 'logs-dialog';
    dialog.innerHTML = `
      <div class="logs-dialog-backdrop"></div>
      <div class="logs-dialog-content">
        <div class="logs-dialog-header">
          <h3>${this.escapeHtml(title)}</h3>
          <button class="logs-dialog-close">×</button>
        </div>
        <div class="logs-dialog-body">
          <pre>${this.escapeHtml(content)}</pre>
        </div>
        <div class="logs-dialog-footer">
          <button class="logs-dialog-copy">Copy to Clipboard</button>
          <button class="logs-dialog-close-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Add event listeners
    const closeButtons = dialog.querySelectorAll('.logs-dialog-close, .logs-dialog-close-btn');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.removeChild(dialog);
      });
    });

    const copyButton = dialog.querySelector('.logs-dialog-copy');
    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        await navigator.clipboard.writeText(content);
        this.showNotification('Copied to clipboard!', 'success');
      });
    }
  }

  /**
   * Start auto-refresh interval
   */
  private startAutoRefresh(): void {
    this.stopAutoRefresh(); // Clear any existing interval

    this.updateInterval = setInterval(() => {
      this.refreshAllServices();
    }, this.REFRESH_INTERVAL);

    console.log('Started auto-refresh for services');
  }

  /**
   * Stop auto-refresh interval
   */
  private stopAutoRefresh(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('Stopped auto-refresh for services');
    }
  }

  /**
   * Update last refresh timestamp
   */
  private updateLastRefreshTime(): void {
    const timestampElement = document.getElementById('services-last-updated');
    if (timestampElement) {
      const now = new Date();
      timestampElement.textContent = `Last updated: ${now.toLocaleTimeString()}`;
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
   * Cleanup when navigating away from tab: stops the auto-refresh interval
   * and removes the window-level top-bar action listeners (issue #124 --
   * previously the interval and listeners leaked across navigations).
   */
  public cleanup(): void {
    this.stopAutoRefresh();

    window.removeEventListener('services-start-all', this.onStartAllEvent);
    window.removeEventListener('services-stop-all', this.onStopAllEvent);
    window.removeEventListener('services-restart-all', this.onRestartAllEvent);

    console.log('ServicesTab cleanup complete');
  }
}

/**
 * Create and initialize the Services Tab
 */
export async function initializeServicesTab(): Promise<ServicesTab> {
  const servicesTab = new ServicesTab();
  await servicesTab.initialize();
  return servicesTab;
}
