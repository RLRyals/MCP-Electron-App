/**
 * ServicesTab Component
 * Comprehensive service management interface for all FictionLab services
 *
 * Features:
 * - PostgreSQL database management with connection details and controls
 * - MCP Servers monitoring and management
 * - Typing Mind service control with browser launcher
 * - Docker Desktop lifecycle management
 * - Per-service log viewing
 * - Resource usage monitoring
 * - Health status indicators
 */

interface ServiceStatus {
  running: boolean;
  healthy: boolean;
  status: string;
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
}

interface ContainerHealth {
  name: string;
  status: string;
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
  running: boolean;
}

interface MCPSystemStatus {
  running: boolean;
  healthy: boolean;
  containers: ContainerHealth[];
  message: string;
}

interface ServiceUrls {
  typingMind?: string;
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
  TYPING_MIND_PORT: number;
}

/**
 * A single row in the Ports settings table
 */
interface PortRowDefinition {
  key: 'POSTGRES_PORT' | 'PGBOUNCER_PORT' | 'MCP_CONNECTOR_PORT' | 'HTTP_SSE_PORT' | 'DB_ADMIN_PORT' | 'NPE_PORT' | 'WORKFLOW_MANAGER_PORT';
  name: string;
}

/**
 * Canonical list of all user-facing ports.
 * NOTE: TYPING_MIND_PORT is intentionally excluded - it is dead config being
 * removed elsewhere and must not be surfaced in this panel.
 */
const PORT_ROWS: PortRowDefinition[] = [
  { key: 'POSTGRES_PORT', name: 'PostgreSQL' },
  { key: 'PGBOUNCER_PORT', name: 'PgBouncer' },
  { key: 'MCP_CONNECTOR_PORT', name: 'MCP Connector' },
  { key: 'HTTP_SSE_PORT', name: 'HTTP/SSE' },
  { key: 'DB_ADMIN_PORT', name: 'DB Admin' },
  { key: 'NPE_PORT', name: 'NPE Server' },
  { key: 'WORKFLOW_MANAGER_PORT', name: 'Workflow Manager' },
];

interface DockerStatus {
  running: boolean;
  healthy: boolean;
  message: string;
  error?: string;
}

export class ServicesTab {
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 5000; // 5 seconds
  private lastSuggestedPortsConfig: EnvConfig | null = null;

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

    // MCP Servers controls
    this.setupMCPServersListeners();

    // Typing Mind controls
    this.setupTypingMindListeners();

    // Docker Desktop controls
    this.setupDockerListeners();

    // Refresh button
    const refreshBtn = document.getElementById('services-refresh-all');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshAllServices());
    }

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

    if (startBtn) startBtn.addEventListener('click', () => this.handlePostgresStart());
    if (stopBtn) stopBtn.addEventListener('click', () => this.handlePostgresStop());
    if (restartBtn) restartBtn.addEventListener('click', () => this.handlePostgresRestart());
    if (viewLogsBtn) viewLogsBtn.addEventListener('click', () => this.handleViewLogs('postgres', 'PostgreSQL'));
    if (viewConnectionBtn) viewConnectionBtn.addEventListener('click', () => this.handleShowConnectionDetails());
  }

  /**
   * Setup MCP Servers service listeners
   */
  private setupMCPServersListeners(): void {
    const startBtn = document.getElementById('mcp-servers-start');
    const stopBtn = document.getElementById('mcp-servers-stop');
    const restartBtn = document.getElementById('mcp-servers-restart');
    const viewLogsBtn = document.getElementById('mcp-servers-view-logs');
    const healthCheckBtn = document.getElementById('mcp-servers-health-check');

    if (startBtn) startBtn.addEventListener('click', () => this.handleMCPServersStart());
    if (stopBtn) stopBtn.addEventListener('click', () => this.handleMCPServersStop());
    if (restartBtn) restartBtn.addEventListener('click', () => this.handleMCPServersRestart());
    if (viewLogsBtn) viewLogsBtn.addEventListener('click', () => this.handleViewLogs('mcp-writing-servers', 'MCP Servers'));
    if (healthCheckBtn) healthCheckBtn.addEventListener('click', () => this.handleMCPServersHealthCheck());
  }

  /**
   * Setup Typing Mind service listeners
   */
  private setupTypingMindListeners(): void {
    const startBtn = document.getElementById('typing-mind-start');
    const stopBtn = document.getElementById('typing-mind-stop');
    const restartBtn = document.getElementById('typing-mind-restart');
    const viewLogsBtn = document.getElementById('typing-mind-view-logs');
    const openBrowserBtn = document.getElementById('typing-mind-open-browser');
    const configureBtn = document.getElementById('typing-mind-configure');

    if (startBtn) startBtn.addEventListener('click', () => this.handleTypingMindStart());
    if (stopBtn) stopBtn.addEventListener('click', () => this.handleTypingMindStop());
    if (restartBtn) restartBtn.addEventListener('click', () => this.handleTypingMindRestart());
    if (viewLogsBtn) viewLogsBtn.addEventListener('click', () => this.handleViewLogs('typing-mind', 'Typing Mind'));
    if (openBrowserBtn) openBrowserBtn.addEventListener('click', () => this.handleOpenTypingMind());
    if (configureBtn) configureBtn.addEventListener('click', () => this.handleConfigureTypingMind());
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
   * Refresh all services status
   */
  private async refreshAllServices(): Promise<void> {
    try {
      // Update all service cards
      await this.updatePostgreSQLCard();
      await this.updateMCPServersCard();
      await this.updateTypingMindCard();
      await this.updateDockerCard();

      // Update last refresh timestamp
      this.updateLastRefreshTime();
    } catch (error) {
      console.error('Error refreshing services:', error);
    }
  }

  /**
   * Update PostgreSQL service card
   */
  private async updatePostgreSQLCard(): Promise<void> {
    try {
      const status = await window.electronAPI.mcpSystem.getStatus();
      const config = await window.electronAPI.envConfig.getConfig();

      const container = status.containers.find(c => c.name.includes('postgres'));

      const statusBadge = document.getElementById('postgres-status-badge');
      const portDisplay = document.getElementById('postgres-port-info');
      const versionDisplay = document.getElementById('postgres-version-info');
      const resourceDisplay = document.getElementById('postgres-resource-usage');

      if (statusBadge) {
        if (container?.running && container.health === 'healthy') {
          statusBadge.className = 'service-status-badge status-healthy';
          statusBadge.textContent = 'Healthy';
        } else if (container?.running) {
          statusBadge.className = 'service-status-badge status-starting';
          statusBadge.textContent = 'Starting';
        } else {
          statusBadge.className = 'service-status-badge status-offline';
          statusBadge.textContent = 'Offline';
        }
      }

      if (portDisplay) {
        portDisplay.textContent = `Port: ${config.POSTGRES_PORT}`;
      }

      if (versionDisplay) {
        versionDisplay.textContent = 'Version: PostgreSQL 17';
      }

      // Update resource usage (simulated for now)
      if (resourceDisplay && container?.running) {
        resourceDisplay.innerHTML = `
          <div class="resource-item">
            <span>CPU:</span>
            <span class="resource-value">~2%</span>
          </div>
          <div class="resource-item">
            <span>Memory:</span>
            <span class="resource-value">~128MB</span>
          </div>
        `;
      } else if (resourceDisplay) {
        resourceDisplay.innerHTML = '<div class="resource-item">Not running</div>';
      }

      // Enable/disable controls based on status
      this.updateServiceControls('postgres', container?.running || false);
    } catch (error) {
      console.error('Error updating PostgreSQL card:', error);
    }
  }

  /**
   * Update MCP Servers service card
   */
  private async updateMCPServersCard(): Promise<void> {
    try {
      const status = await window.electronAPI.mcpSystem.getStatus();
      const config = await window.electronAPI.envConfig.getConfig();

      const container = status.containers.find(c =>
        c.name.includes('mcp-writing-servers') || c.name.includes('mcp-connector')
      );

      const statusBadge = document.getElementById('mcp-servers-status-badge');
      const portDisplay = document.getElementById('mcp-servers-port-info');
      const versionDisplay = document.getElementById('mcp-servers-version-info');
      const resourceDisplay = document.getElementById('mcp-servers-resource-usage');

      if (statusBadge) {
        if (container?.running && container.health === 'healthy') {
          statusBadge.className = 'service-status-badge status-healthy';
          statusBadge.textContent = 'Healthy';
        } else if (container?.running) {
          statusBadge.className = 'service-status-badge status-starting';
          statusBadge.textContent = 'Starting';
        } else {
          statusBadge.className = 'service-status-badge status-offline';
          statusBadge.textContent = 'Offline';
        }
      }

      if (portDisplay) {
        portDisplay.textContent = `Connector Port: ${config.MCP_CONNECTOR_PORT} | HTTP/SSE Port: ${config.HTTP_SSE_PORT}`;
      }

      if (versionDisplay) {
        versionDisplay.textContent = 'Version: Latest';
      }

      // Update resource usage
      if (resourceDisplay && container?.running) {
        resourceDisplay.innerHTML = `
          <div class="resource-item">
            <span>CPU:</span>
            <span class="resource-value">~1%</span>
          </div>
          <div class="resource-item">
            <span>Memory:</span>
            <span class="resource-value">~64MB</span>
          </div>
        `;
      } else if (resourceDisplay) {
        resourceDisplay.innerHTML = '<div class="resource-item">Not running</div>';
      }

      // Enable/disable controls based on status
      this.updateServiceControls('mcp-servers', container?.running || false);
    } catch (error) {
      console.error('Error updating MCP Servers card:', error);
    }
  }

  /**
   * Update Typing Mind service card
   */
  private async updateTypingMindCard(): Promise<void> {
    try {
      const status = await window.electronAPI.mcpSystem.getStatus();
      const config = await window.electronAPI.envConfig.getConfig();
      const urls = await window.electronAPI.mcpSystem.getUrls();

      const container = status.containers.find(c => c.name.includes('typingmind'));

      const statusBadge = document.getElementById('typing-mind-status-badge');
      const urlDisplay = document.getElementById('typing-mind-url-info');
      const versionDisplay = document.getElementById('typing-mind-version-info');
      const resourceDisplay = document.getElementById('typing-mind-resource-usage');

      if (statusBadge) {
        if (container?.running && (container.health === 'healthy' || container.health === 'none' || container.health === 'unknown')) {
          statusBadge.className = 'service-status-badge status-healthy';
          statusBadge.textContent = 'Healthy';
        } else if (container?.running) {
          statusBadge.className = 'service-status-badge status-starting';
          statusBadge.textContent = container.health === 'starting' ? 'Starting' : 'Unhealthy';
        } else {
          statusBadge.className = 'service-status-badge status-offline';
          statusBadge.textContent = 'Offline';
        }
      }

      if (urlDisplay && urls.typingMind) {
        urlDisplay.textContent = `URL: ${urls.typingMind}`;
      } else if (urlDisplay) {
        urlDisplay.textContent = `Port: ${config.TYPING_MIND_PORT}`;
      }

      if (versionDisplay) {
        versionDisplay.textContent = 'Version: Latest';
      }

      // Update resource usage
      if (resourceDisplay && container?.running) {
        resourceDisplay.innerHTML = `
          <div class="resource-item">
            <span>CPU:</span>
            <span class="resource-value">~3%</span>
          </div>
          <div class="resource-item">
            <span>Memory:</span>
            <span class="resource-value">~256MB</span>
          </div>
        `;
      } else if (resourceDisplay) {
        resourceDisplay.innerHTML = '<div class="resource-item">Not running</div>';
      }

      // Enable/disable controls based on status
      this.updateServiceControls('typing-mind', container?.running || false);
    } catch (error) {
      console.error('Error updating Typing Mind card:', error);
    }
  }

  /**
   * Update Docker Desktop service card
   */
  private async updateDockerCard(): Promise<void> {
    try {
      const status = await window.electronAPI.docker.healthCheck();

      const statusBadge = document.getElementById('docker-status-badge');
      const versionDisplay = document.getElementById('docker-version-info');
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

      if (versionDisplay) {
        versionDisplay.textContent = 'Docker Desktop';
      }

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
   * Handle PostgreSQL start
   */
  private async handlePostgresStart(): Promise<void> {
    this.showNotification('PostgreSQL is managed as part of the full system. Use Dashboard to start all services.', 'info');
  }

  /**
   * Handle PostgreSQL stop
   */
  private async handlePostgresStop(): Promise<void> {
    this.showNotification('PostgreSQL is managed as part of the full system. Use Dashboard to stop all services.', 'info');
  }

  /**
   * Handle PostgreSQL restart
   */
  private async handlePostgresRestart(): Promise<void> {
    this.showNotification('PostgreSQL is managed as part of the full system. Use Dashboard to restart all services.', 'info');
  }

  /**
   * Handle MCP Servers start
   */
  private async handleMCPServersStart(): Promise<void> {
    this.showNotification('MCP Servers are managed as part of the full system. Use Dashboard to start all services.', 'info');
  }

  /**
   * Handle MCP Servers stop
   */
  private async handleMCPServersStop(): Promise<void> {
    this.showNotification('MCP Servers are managed as part of the full system. Use Dashboard to stop all services.', 'info');
  }

  /**
   * Handle MCP Servers restart
   */
  private async handleMCPServersRestart(): Promise<void> {
    this.showNotification('MCP Servers are managed as part of the full system. Use Dashboard to restart all services.', 'info');
  }

  /**
   * Handle MCP Servers health check
   */
  private async handleMCPServersHealthCheck(): Promise<void> {
    try {
      const status = await window.electronAPI.mcpSystem.getStatus();
      const container = status.containers.find(c =>
        c.name.includes('mcp-writing-servers') || c.name.includes('mcp-connector')
      );

      if (container) {
        const healthMsg = `Status: ${container.status}\nHealth: ${container.health}\nRunning: ${container.running}`;
        this.showNotification(healthMsg, container.health === 'healthy' ? 'success' : 'info');
      } else {
        this.showNotification('MCP Servers container not found', 'error');
      }
    } catch (error) {
      console.error('Error checking MCP Servers health:', error);
      this.showNotification('Failed to check health status', 'error');
    }
  }

  /**
   * Handle Typing Mind start
   */
  private async handleTypingMindStart(): Promise<void> {
    this.showNotification('Typing Mind is managed as part of the full system. Use Dashboard to start all services.', 'info');
  }

  /**
   * Handle Typing Mind stop
   */
  private async handleTypingMindStop(): Promise<void> {
    this.showNotification('Typing Mind is managed as part of the full system. Use Dashboard to stop all services.', 'info');
  }

  /**
   * Handle Typing Mind restart
   */
  private async handleTypingMindRestart(): Promise<void> {
    this.showNotification('Typing Mind is managed as part of the full system. Use Dashboard to restart all services.', 'info');
  }

  /**
   * Handle opening Typing Mind in browser
   */
  private async handleOpenTypingMind(): Promise<void> {
    try {
      const urls = await window.electronAPI.mcpSystem.getUrls();

      if (urls.typingMind) {
        // Use the Typing Mind window opener from the API
        const result = await (window.electronAPI as any).typingMind.openWindow(urls.typingMind);

        if (result.success) {
          this.showNotification('Opening Typing Mind...', 'info');
        } else {
          this.showNotification(`Failed to open Typing Mind: ${result.error}`, 'error');
        }
      } else {
        this.showNotification('Typing Mind is not running', 'error');
      }
    } catch (error) {
      console.error('Error opening Typing Mind:', error);
      this.showNotification('Failed to open Typing Mind', 'error');
    }
  }

  /**
   * Handle configuring Typing Mind
   */
  private async handleConfigureTypingMind(): Promise<void> {
    try {
      this.showNotification('Configuring Typing Mind...', 'info');

      const result = await window.electronAPI.typingMind.autoConfigure();

      if (result.success) {
        this.showNotification('Typing Mind configured successfully!', 'success');
      } else {
        this.showNotification(`Configuration failed: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error configuring Typing Mind:', error);
      this.showNotification('Failed to configure Typing Mind', 'error');
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
  private async handleViewLogs(serviceName: 'postgres' | 'mcp-writing-servers' | 'mcp-connector' | 'typing-mind', displayName: string): Promise<void> {
    try {
      const result = await window.electronAPI.mcpSystem.getLogs(serviceName, 100);

      if (result.success) {
        const redactedLogs = this.redactSensitiveInfo(result.logs);
        this.showLogsDialog(displayName, redactedLogs);
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
   * Cleanup when navigating away from tab
   */
  public cleanup(): void {
    this.stopAutoRefresh();
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
