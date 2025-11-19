/**
 * Dashboard Handlers
 * Main application control interface for the MCP Writing System
 * Provides system status, quick actions, and service management
 */

interface MCPSystemStatus {
  running: boolean;
  healthy: boolean;
  containers: ContainerHealth[];
  message: string;
}

interface ContainerHealth {
  name: string;
  status: string;
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
  running: boolean;
}

interface ServiceUrls {
  typingMind?: string;
  mcpConnector?: string;
  postgres?: string;
}

interface MCPSystemProgress {
  message: string;
  percent: number;
  step: string;
  status: 'starting' | 'checking' | 'ready' | 'error';
}

interface EnvConfig {
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_PORT: number;
  MCP_CONNECTOR_PORT: number;
  MCP_AUTH_TOKEN: string;
  TYPING_MIND_PORT: number;
}

// Global polling interval
let statusPollingInterval: NodeJS.Timeout | null = null;
const POLL_INTERVAL = 5000; // 5 seconds

// Track if we've already shown the offline notification
let hasShownOfflineNotification = false;

/**
 * Initialize the dashboard
 */
export async function initializeDashboard(): Promise<void> {
  console.log('Initializing dashboard...');

  try {
    // Setup event listeners first (so buttons work even if status fails)
    setupDashboardListeners();

    // Load initial status
    await updateSystemStatus();

    // Check if system needs to be auto-started after wizard completion
    await checkAndAutoStartSystem();

    // Start polling
    startStatusPolling();
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
    showNotification(`Dashboard initialization failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    // Still set up event listeners in case of error
    setupDashboardListeners();
  }
}

/**
 * Setup all dashboard event listeners
 */
function setupDashboardListeners(): void {
  // Quick Actions
  const startBtn = document.getElementById('dashboard-start-system');
  const stopBtn = document.getElementById('dashboard-stop-system');
  const restartBtn = document.getElementById('dashboard-restart-system');
  const openTypingMindBtn = document.getElementById('dashboard-open-typing-mind');
  const configureTypingMindBtn = document.getElementById('dashboard-configure-typing-mind');
  const refreshBtn = document.getElementById('dashboard-refresh-status');
  const backupDbBtn = document.getElementById('dashboard-backup-database');
  const restoreDbBtn = document.getElementById('dashboard-restore-database');
  const manageBackupsBtn = document.getElementById('dashboard-manage-backups');
  const openBackupFolderBtn = document.getElementById('dashboard-open-backup-folder');

  if (startBtn) {
    startBtn.addEventListener('click', handleStartSystem);
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', handleStopSystem);
  }

  if (restartBtn) {
    restartBtn.addEventListener('click', handleRestartSystem);
  }

  if (openTypingMindBtn) {
    openTypingMindBtn.addEventListener('click', handleOpenTypingMind);
  }

  if (configureTypingMindBtn) {
    configureTypingMindBtn.addEventListener('click', handleConfigureTypingMind);
  }

  const configureClaudeDesktopBtn = document.getElementById('dashboard-configure-claude-desktop');
  if (configureClaudeDesktopBtn) {
    configureClaudeDesktopBtn.addEventListener('click', handleConfigureClaudeDesktop);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => updateSystemStatus());
  }

  if (backupDbBtn) {
    backupDbBtn.addEventListener('click', handleBackupDatabase);
  }

  if (restoreDbBtn) {
    restoreDbBtn.addEventListener('click', handleRestoreDatabase);
  }

  if (manageBackupsBtn) {
    manageBackupsBtn.addEventListener('click', handleManageBackups);
  }

  if (openBackupFolderBtn) {
    openBackupFolderBtn.addEventListener('click', handleOpenBackupFolder);
  }

  // Service card actions
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Find the button element even if a child element was clicked
    const viewLogsBtn = target.closest('.view-logs-btn') as HTMLElement;
    if (viewLogsBtn) {
      const serviceName = viewLogsBtn.getAttribute('data-service');
      if (serviceName) {
        handleViewLogs(serviceName);
      }
      return;
    }

    const copyTokenBtn = target.closest('.copy-token-btn') as HTMLElement;
    if (copyTokenBtn) {
      handleCopyToken();
      return;
    }

    const openBrowserBtn = target.closest('.open-browser-btn') as HTMLElement;
    if (openBrowserBtn) {
      const url = openBrowserBtn.getAttribute('data-url');
      if (url) {
        handleOpenBrowser(url);
      }
      return;
    }
  });
}

/**
 * Start polling for status updates every 5 seconds
 */
function startStatusPolling(): void {
  // Clear any existing interval
  stopStatusPolling();

  // Start new polling interval
  statusPollingInterval = setInterval(async () => {
    await updateSystemStatus();
  }, POLL_INTERVAL);

  console.log('Started status polling');
}

/**
 * Stop status polling
 */
function stopStatusPolling(): void {
  if (statusPollingInterval) {
    clearInterval(statusPollingInterval);
    statusPollingInterval = null;
    console.log('Stopped status polling');
  }
}

/**
 * Check if system should be auto-started after wizard completion
 * This handles the case where the wizard started containers but they stopped or weren't detected
 */
async function checkAndAutoStartSystem(): Promise<void> {
  try {
    // Check if electronAPI is available
    if (!window.electronAPI || !window.electronAPI.mcpSystem) {
      return;
    }

    // Get current system status
    const status = await window.electronAPI.mcpSystem.getStatus();

    // If system is already running, no action needed
    if (status.running) {
      console.log('System is already running, no auto-start needed');
      return;
    }

    // Check if wizard was just completed (not first run anymore)
    const isFirstRun = await (window as any).electronAPI.setupWizard.isFirstRun();
    if (isFirstRun) {
      console.log('First run detected, not auto-starting (wizard should handle this)');
      return;
    }

    // Check wizard state to see if system startup was completed
    const wizardState = await (window as any).electronAPI.setupWizard.getState();
    if (wizardState?.data?.systemStartup?.healthy) {
      console.log('System was marked healthy during wizard but is now offline - auto-starting...');
      showNotification('Starting MCP system...', 'info');

      // Auto-start the system
      const result = await window.electronAPI.mcpSystem.start();

      if (result.success) {
        console.log('System auto-started successfully');
        showNotification('MCP system started successfully!', 'success');
        // Update status to reflect the change
        await updateSystemStatus();
      } else {
        console.error('Auto-start failed:', result.message || result.error);
        showNotification(`Failed to start system: ${result.message || result.error}`, 'error');
      }
    } else {
      console.log('System startup not completed during wizard, manual start required');
    }
  } catch (error) {
    console.error('Error checking auto-start conditions:', error);
    // Don't show notification for this error - just log it
  }
}

/**
 * Update the system status and refresh UI
 */
export async function updateSystemStatus(): Promise<void> {
  try {
    // Check if electronAPI is available
    if (!window.electronAPI || !window.electronAPI.mcpSystem) {
      throw new Error('Electron API not available');
    }

    // Get system status
    const status = await window.electronAPI.mcpSystem.getStatus();

    // Update overall status indicator
    updateStatusIndicator(status);

    // Update service cards
    await updateServiceCards(status);

    // Update last updated timestamp
    updateLastUpdatedTime();

  } catch (error) {
    console.error('Error updating system status:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error details:', errorMessage);
    showErrorStatus(errorMessage);
  }
}

/**
 * Update the main status indicator at the top
 */
function updateStatusIndicator(status: MCPSystemStatus): void {
  const statusElement = document.getElementById('dashboard-status-indicator');
  const statusTextElement = document.getElementById('dashboard-status-text');

  if (!statusElement || !statusTextElement) return;

  // Remove all status classes
  statusElement.classList.remove('status-green', 'status-yellow', 'status-red');

  if (!status.running) {
    // System offline - red
    statusElement.classList.add('status-red');
    statusTextElement.textContent = 'System Offline';

    // Show helpful message if system is offline (only once)
    if (status.message && !hasShownOfflineNotification) {
      console.log('System status message:', status.message);
      // If it's just "No containers running", that's normal - user needs to start the system
      if (status.message === 'No containers running') {
        showNotification('System is offline. Click "Start System" to begin.', 'info');
        hasShownOfflineNotification = true;
      } else if (status.message.includes('repository not found') || status.message.includes('complete setup')) {
        // Critical issue - repository missing
        showNotification(`Setup incomplete: ${status.message}`, 'error');
        hasShownOfflineNotification = true;
      }
    }
  } else {
    // Check core services health (postgres and mcp-servers only)
    // Typing Mind and MCP Connector are optional and don't affect overall health
    const coreContainers = status.containers.filter(c =>
      c.name.includes('postgres') ||
      c.name.includes('mcp-writing-servers') ||
      c.name.includes('mcp-connector')
    );

    const allCoreHealthy = coreContainers.length > 0 &&
      coreContainers.every(c => c.running && c.health === 'healthy');
    const someCoreStarting = coreContainers.some(c =>
      c.running && c.health !== 'healthy' && c.health !== 'unhealthy'
    );

    if (allCoreHealthy) {
      // All core systems operational - green
      statusElement.classList.add('status-green');
      statusTextElement.textContent = 'System Ready';
      // Reset notification flag when system is healthy
      hasShownOfflineNotification = false;
    } else if (someCoreStarting) {
      // Core system starting - yellow
      statusElement.classList.add('status-yellow');
      statusTextElement.textContent = 'System Starting';
      hasShownOfflineNotification = false;
    } else {
      // Core system degraded - yellow
      statusElement.classList.add('status-yellow');
      statusTextElement.textContent = 'System Degraded';
      // Reset notification flag when system comes back online
      hasShownOfflineNotification = false;
    }
  }
}

/**
 * Update service cards with current status
 */
async function updateServiceCards(status: MCPSystemStatus): Promise<void> {
  try {
    // Get config for port information
    const config = await window.electronAPI.envConfig.getConfig();
    const urls = await window.electronAPI.mcpSystem.getUrls();

    // Update PostgreSQL card
    updatePostgreSQLCard(status, config);

    // Update MCP Servers card
    updateMCPServersCard(status);

    // Update MCP Connector card
    updateMCPConnectorCard(status, config, urls);

    // Update Typing Mind card
    updateTypingMindCard(status, config, urls);
  } catch (error) {
    console.error('Error updating service cards:', error);
    // Don't throw - let dashboard continue to function even if card updates fail
    showNotification(`Failed to update service information: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

/**
 * Update PostgreSQL service card
 */
function updatePostgreSQLCard(status: MCPSystemStatus, config: EnvConfig): void {
  const container = status.containers.find(c => c.name.includes('postgres'));

  const statusIcon = document.getElementById('postgres-status-icon');
  const statusText = document.getElementById('postgres-status-text');
  const portText = document.getElementById('postgres-port-display');

  if (statusIcon && statusText && portText) {
    portText.textContent = `Port: ${config.POSTGRES_PORT}`;

    if (container?.running && container.health === 'healthy') {
      statusIcon.innerHTML = '<span class="status-dot status-green"></span>';
      statusText.textContent = 'Healthy';
    } else if (container?.running) {
      statusIcon.innerHTML = '<span class="status-dot status-yellow"></span>';
      statusText.textContent = 'Starting...';
    } else {
      statusIcon.innerHTML = '<span class="status-dot status-red"></span>';
      statusText.textContent = 'Offline';
    }
  }
}

/**
 * Update MCP Servers service card
 * Note: Looks for 'mcp-writing-servers' or 'mcp-connector'
 */
function updateMCPServersCard(status: MCPSystemStatus): void {
  const container = status.containers.find(c => c.name.includes('mcp-writing-servers') || c.name.includes('mcp-connector'));

  const statusIcon = document.getElementById('mcp-servers-status-icon');
  const statusText = document.getElementById('mcp-servers-status-text');

  if (statusIcon && statusText) {
    if (container?.running && container.health === 'healthy') {
      statusIcon.innerHTML = '<span class="status-dot status-green"></span>';
      statusText.textContent = 'Healthy';
    } else if (container?.running) {
      statusIcon.innerHTML = '<span class="status-dot status-yellow"></span>';
      statusText.textContent = 'Starting...';
    } else {
      statusIcon.innerHTML = '<span class="status-dot status-red"></span>';
      statusText.textContent = 'Offline';
    }
  }
}

/**
 * Update MCP Connector service card
 */
function updateMCPConnectorCard(status: MCPSystemStatus, config: EnvConfig, urls: ServiceUrls): void {
  const container = status.containers.find(c => c.name.includes('mcp-connector'));
  const card = document.getElementById('mcp-connector-card');

  // Show/hide card based on whether connector is configured
  if (card) {
    if (urls.mcpConnector) {
      card.style.display = 'block';

      const statusIcon = document.getElementById('mcp-connector-status-icon');
      const statusText = document.getElementById('mcp-connector-status-text');
      const portText = document.getElementById('mcp-connector-port-display');

      if (statusIcon && statusText && portText) {
        portText.textContent = `Port: ${config.MCP_CONNECTOR_PORT}`;

        // MCP Connector may not have health checks configured
        // Show as healthy if running and health is 'healthy', 'none', or 'unknown'
        if (container?.running && (container.health === 'healthy' || container.health === 'none' || container.health === 'unknown')) {
          statusIcon.innerHTML = '<span class="status-dot status-green"></span>';
          statusText.textContent = 'Healthy';
        } else if (container?.running && (container.health === 'starting' || container.health === 'unhealthy')) {
          statusIcon.innerHTML = '<span class="status-dot status-yellow"></span>';
          statusText.textContent = container.health === 'starting' ? 'Starting...' : 'Unhealthy';
        } else {
          statusIcon.innerHTML = '<span class="status-dot status-red"></span>';
          statusText.textContent = 'Offline';
        }
      }
    } else {
      card.style.display = 'none';
    }
  }
}

/**
 * Update Typing Mind service card
 */
function updateTypingMindCard(status: MCPSystemStatus, config: EnvConfig, urls: ServiceUrls): void {
  const container = status.containers.find(c => c.name.includes('typingmind'));
  const card = document.getElementById('typing-mind-card');

  // Show/hide card based on whether Typing Mind is configured
  if (card) {
    if (urls.typingMind) {
      card.style.display = 'block';

      const statusIcon = document.getElementById('typing-mind-status-icon');
      const statusText = document.getElementById('typing-mind-status-text');
      const portText = document.getElementById('typing-mind-port-display');
      const openBrowserBtn = card.querySelector('.open-browser-btn') as HTMLButtonElement;

      if (statusIcon && statusText && portText) {
        portText.textContent = `Port: ${config.TYPING_MIND_PORT}`;

        // Typing Mind may not have health checks configured
        // Show as healthy if running and health is 'healthy', 'none', or 'unknown'
        if (container?.running && (container.health === 'healthy' || container.health === 'none' || container.health === 'unknown')) {
          statusIcon.innerHTML = '<span class="status-dot status-green"></span>';
          statusText.textContent = 'Healthy';
        } else if (container?.running && (container.health === 'starting' || container.health === 'unhealthy')) {
          statusIcon.innerHTML = '<span class="status-dot status-yellow"></span>';
          statusText.textContent = container.health === 'starting' ? 'Starting...' : 'Unhealthy';
        } else {
          statusIcon.innerHTML = '<span class="status-dot status-red"></span>';
          statusText.textContent = 'Offline';
        }
      }

      // Update the Open Browser button data-url attribute
      if (openBrowserBtn) {
        openBrowserBtn.setAttribute('data-url', urls.typingMind);
      }
    } else {
      card.style.display = 'none';
    }
  }
}

/**
 * Show error status when status update fails
 */
function showErrorStatus(errorMessage?: string): void {
  const statusElement = document.getElementById('dashboard-status-indicator');
  const statusTextElement = document.getElementById('dashboard-status-text');

  if (statusElement && statusTextElement) {
    statusElement.classList.remove('status-green', 'status-yellow', 'status-red');
    statusElement.classList.add('status-red');
    statusTextElement.textContent = 'Status Unknown';

    // Show error notification with details
    if (errorMessage) {
      showNotification(`Failed to get system status: ${errorMessage}`, 'error');
    }
  }
}

/**
 * Update last updated timestamp
 */
function updateLastUpdatedTime(): void {
  const timestampElement = document.getElementById('dashboard-last-updated');
  if (timestampElement) {
    const now = new Date();
    timestampElement.textContent = `Last updated: ${now.toLocaleTimeString()}`;
  }
}

/**
 * Handle Start System action
 */
async function handleStartSystem(): Promise<void> {
  const button = document.getElementById('dashboard-start-system') as HTMLButtonElement;
  const progressDiv = document.getElementById('dashboard-progress');
  const progressBar = document.getElementById('dashboard-progress-bar') as HTMLDivElement;
  const progressText = document.getElementById('dashboard-progress-text');

  if (!button) return;

  try {
    // Disable all buttons
    setQuickActionsEnabled(false);
    button.textContent = 'Starting...';

    // Show progress
    if (progressDiv) progressDiv.classList.add('show');
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Initializing...';

    // Listen for progress updates
    window.electronAPI.mcpSystem.onProgress((progress: MCPSystemProgress) => {
      if (progressBar) progressBar.style.width = `${progress.percent}%`;
      if (progressText) progressText.textContent = progress.message;
    });

    // Start the system
    const result = await window.electronAPI.mcpSystem.start();

    if (result.success) {
      showNotification('MCP system started successfully!', 'success');

      // Update status immediately
      await updateSystemStatus();

      // Show URLs in progress text
      if (result.urls && progressText) {
        let urlInfo = 'System ready!';
        if (result.urls.typingMind) {
          urlInfo += ` Typing Mind: ${result.urls.typingMind}`;
        }
        progressText.textContent = urlInfo;
      }
    } else {
      showNotification(`Failed to start system: ${result.error || result.message}`, 'error');

      if (progressText) {
        progressText.textContent = `Error: ${result.error || result.message}`;
      }
    }

  } catch (error) {
    console.error('Error starting system:', error);
    showNotification('Failed to start system', 'error');

    if (progressText) {
      progressText.textContent = 'Error starting system';
    }
  } finally {
    button.textContent = 'Start System';
    setQuickActionsEnabled(true);

    // Hide progress after a delay
    setTimeout(() => {
      if (progressDiv) progressDiv.classList.remove('show');
    }, 3000);

    // Remove progress listener
    window.electronAPI.mcpSystem.removeProgressListener();
  }
}

/**
 * Handle Stop System action
 */
async function handleStopSystem(): Promise<void> {
  const button = document.getElementById('dashboard-stop-system') as HTMLButtonElement;

  if (!button) return;

  try {
    setQuickActionsEnabled(false);
    button.textContent = 'Stopping...';

    const result = await window.electronAPI.mcpSystem.stop();

    if (result.success) {
      showNotification('MCP system stopped successfully', 'success');
      await updateSystemStatus();
    } else {
      showNotification(`Failed to stop system: ${result.error || result.message}`, 'error');
    }

  } catch (error) {
    console.error('Error stopping system:', error);
    showNotification('Failed to stop system', 'error');
  } finally {
    button.textContent = 'Stop System';
    setQuickActionsEnabled(true);
  }
}

/**
 * Handle Restart System action
 */
async function handleRestartSystem(): Promise<void> {
  const button = document.getElementById('dashboard-restart-system') as HTMLButtonElement;
  const progressDiv = document.getElementById('dashboard-progress');
  const progressBar = document.getElementById('dashboard-progress-bar') as HTMLDivElement;
  const progressText = document.getElementById('dashboard-progress-text');

  if (!button) return;

  try {
    setQuickActionsEnabled(false);
    button.textContent = 'Restarting...';

    // Show progress
    if (progressDiv) progressDiv.classList.add('show');
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Restarting...';

    // Listen for progress updates
    window.electronAPI.mcpSystem.onProgress((progress: MCPSystemProgress) => {
      if (progressBar) progressBar.style.width = `${progress.percent}%`;
      if (progressText) progressText.textContent = progress.message;
    });

    const result = await window.electronAPI.mcpSystem.restart();

    if (result.success) {
      showNotification('MCP system restarted successfully!', 'success');
      await updateSystemStatus();
    } else {
      showNotification(`Failed to restart system: ${result.error || result.message}`, 'error');
    }

  } catch (error) {
    console.error('Error restarting system:', error);
    showNotification('Failed to restart system', 'error');
  } finally {
    button.textContent = 'Restart System';
    setQuickActionsEnabled(true);

    setTimeout(() => {
      if (progressDiv) progressDiv.classList.remove('show');
    }, 3000);

    window.electronAPI.mcpSystem.removeProgressListener();
  }
}

/**
 * Handle Open Typing Mind action
 */
async function handleOpenTypingMind(): Promise<void> {
  try {
    const urls = await window.electronAPI.mcpSystem.getUrls();

    if (urls.typingMind) {
      await handleOpenBrowser(urls.typingMind);
    } else {
      showNotification('Typing Mind is not running', 'error');
    }
  } catch (error) {
    console.error('Error opening Typing Mind:', error);
    showNotification('Failed to open Typing Mind', 'error');
  }
}

/**
 * Handle Configure Typing Mind action
 * Automatically configures Typing Mind with MCP Connector settings
 */
async function handleConfigureTypingMind(): Promise<void> {
  try {
    showNotification('Configuring Typing Mind...', 'info');

    // Auto-configure Typing Mind with MCP Connector settings
    const result = await window.electronAPI.typingMind.autoConfigure();

    if (result.success) {
      // Get MCP servers JSON
      const mcpServersJSON = await window.electronAPI.typingMind.getMCPServersJSON();

      // Show success notification
      showNotification('Typing Mind configured successfully!', 'success');

      // Display configuration details in a dialog
      showConfigurationDialog(result.config, mcpServersJSON);
    } else {
      showNotification(`Configuration failed: ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('Error configuring Typing Mind:', error);
    showNotification('Failed to configure Typing Mind', 'error');
  }
}

/**
 * Handle Configure Claude Desktop action
 * Shows popup dialog for Claude Desktop configuration
 */
async function handleConfigureClaudeDesktop(): Promise<void> {
  try {
    // Get current configuration status
    const isConfigured = await window.electronAPI.claudeDesktop.isConfigured();
    const config = isConfigured ? await window.electronAPI.claudeDesktop.getConfig() : null;

    // Show the configuration dialog
    showClaudeDesktopDialog(isConfigured, config);
  } catch (error) {
    console.error('Error opening Claude Desktop configuration:', error);
    showNotification('Failed to open configuration dialog', 'error');
  }
}

/**
 * Handle View Logs action
 */
async function handleViewLogs(serviceName: string): Promise<void> {
  try {
    // Map UI service names to actual service names
    const serviceMap: { [key: string]: 'postgres' | 'mcp-writing-servers' | 'mcp-connector' | 'typing-mind' } = {
      'postgres': 'postgres',
      'mcp-servers': 'mcp-writing-servers',
      'mcp-connector': 'mcp-connector',
      'typing-mind': 'typing-mind',
    };

    const actualServiceName = serviceMap[serviceName];
    if (!actualServiceName) {
      showNotification('Invalid service name', 'error');
      return;
    }

    const result = await window.electronAPI.mcpSystem.getLogs(actualServiceName, 100);

    if (result.success) {
      // Show logs in a dialog or modal
      showLogsDialog(serviceName, result.logs);
    } else {
      showNotification(`Failed to get logs: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error viewing logs:', error);
    showNotification('Failed to view logs', 'error');
  }
}

/**
 * Handle Copy Token action
 */
async function handleCopyToken(): Promise<void> {
  try {
    const config = await window.electronAPI.envConfig.getConfig();

    await navigator.clipboard.writeText(config.MCP_AUTH_TOKEN);
    showNotification('Auth token copied to clipboard!', 'success');
  } catch (error) {
    console.error('Error copying token:', error);
    showNotification('Failed to copy token', 'error');
  }
}

/**
 * Handle Open Browser action
 * Opens Typing Mind in a dedicated Electron window with context menu support
 */
async function handleOpenBrowser(url: string): Promise<void> {
  try {
    // Open Typing Mind in a dedicated Electron window with context menu support
    const result = await window.electronAPI.typingMind.openWindow(url);

    if (result.success) {
      showNotification('Opening Typing Mind...', 'info');
    } else {
      showNotification(`Failed to open Typing Mind: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error opening Typing Mind window:', error);
    showNotification('Failed to open Typing Mind', 'error');
  }
}

/**
 * Show logs in a dialog
 */
function showLogsDialog(serviceName: string, logs: string): void {
  const dialog = document.createElement('div');
  dialog.className = 'logs-dialog';
  dialog.innerHTML = `
    <div class="logs-dialog-backdrop"></div>
    <div class="logs-dialog-content">
      <div class="logs-dialog-header">
        <h3>${serviceName} Logs</h3>
        <button class="logs-dialog-close">×</button>
      </div>
      <div class="logs-dialog-body">
        <pre>${escapeHtml(logs)}</pre>
      </div>
      <div class="logs-dialog-footer">
        <button class="logs-dialog-copy">Copy Logs</button>
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
      await navigator.clipboard.writeText(logs);
      showNotification('Logs copied to clipboard!', 'success');
    });
  }
}

/**
 * Show configuration dialog
 */
function showConfigurationDialog(config: any, mcpServersJSON: string): void {
  const dialog = document.createElement('div');
  dialog.className = 'logs-dialog'; // Reuse logs dialog styles

  // Parse the MCP servers JSON to count servers
  const serversConfig = JSON.parse(mcpServersJSON);
  const serverCount = Object.keys(serversConfig.mcpServers).length;
  const serverNames = Object.keys(serversConfig.mcpServers);

  dialog.innerHTML = `
    <div class="logs-dialog-backdrop"></div>
    <div class="logs-dialog-content" style="max-width: 700px;">
      <div class="logs-dialog-header">
        <h3>✓ TypingMind Fully Configured!</h3>
        <button class="logs-dialog-close">×</button>
      </div>
      <div class="logs-dialog-body">
        <div style="margin-bottom: 20px;">
          <h4>Configuration Values (Click to Copy):</h4>

          <!-- Server URL -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Server URL:</label>
            <div style="display: flex; gap: 10px;">
              <input type="text" readonly value="${escapeHtml(config.serverUrl)}"
                     style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; background: #f5f5f5;">
              <button class="copy-btn" data-copy="${escapeHtml(config.serverUrl)}"
                      style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Copy
              </button>
            </div>
          </div>

          <!-- Auth Token -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Auth Token:</label>
            <div style="display: flex; gap: 10px;">
              <input type="text" readonly value="${escapeHtml(config.authToken)}"
                     style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; background: #f5f5f5;">
              <button class="copy-btn" data-copy="${escapeHtml(config.authToken)}"
                      style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Copy
              </button>
            </div>
          </div>

          <!-- MCP Servers JSON -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">
              MCP Servers JSON (${serverCount} servers):
            </label>
            <div style="display: flex; gap: 10px;">
              <textarea readonly
                        style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; background: #f5f5f5; resize: vertical; min-height: 120px; font-size: 0.85em;"
              >${escapeHtml(mcpServersJSON)}</textarea>
              <button class="copy-btn" data-copy-json='${escapeHtml(mcpServersJSON)}'
                      style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer; align-self: flex-start;">
                Copy
              </button>
            </div>
            <div style="font-size: 0.85em; color: #666; margin-top: 5px;">
              Servers: ${serverNames.join(', ')}
            </div>
          </div>
        </div>

        <div style="margin-top: 20px; padding: 15px; background: #f0f9ff; border-left: 3px solid #0284c7; border-radius: 4px;">
          <h4 style="margin-top: 0;">Next Steps:</h4>
          <ol style="line-height: 1.8; margin-bottom: 0;">
            <li>Click "Open Typing Mind" to launch the web interface</li>
            <li>In TypingMind, go to Settings → MCP Integration</li>
            <li>Paste the <strong>Server URL</strong> and <strong>Auth Token</strong> from above</li>
            <li>Paste the <strong>MCP Servers JSON</strong> in the servers configuration field</li>
            <li>Click "Connect" and start using all ${serverCount} MCP servers!</li>
          </ol>
        </div>
      </div>
      <div class="logs-dialog-footer">
        <button class="logs-dialog-close-btn">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Add event listeners for close buttons
  const closeButtons = dialog.querySelectorAll('.logs-dialog-close, .logs-dialog-close-btn');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  });

  // Add event listeners for copy buttons
  const copyButtons = dialog.querySelectorAll('.copy-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const buttonElement = btn as HTMLButtonElement;
      const textToCopy = buttonElement.getAttribute('data-copy') || buttonElement.getAttribute('data-copy-json') || '';
      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = buttonElement.textContent;
        buttonElement.textContent = 'Copied!';
        buttonElement.style.background = '#28a745';
        setTimeout(() => {
          buttonElement.textContent = originalText;
          buttonElement.style.background = '#0284c7';
        }, 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
        showNotification('Failed to copy to clipboard', 'error');
      }
    });
  });
}

/**
 * Show Claude Desktop configuration dialog
 */
function showClaudeDesktopDialog(isConfigured: boolean, config: any): void {
  const dialog = document.createElement('div');
  dialog.className = 'logs-dialog'; // Reuse logs dialog styles

  const serverCount = config ? Object.keys(config.mcpServers || {}).length : 0;

  dialog.innerHTML = `
    <div class="logs-dialog-backdrop"></div>
    <div class="logs-dialog-content" style="max-width: 700px;">
      <div class="logs-dialog-header">
        <h3>${isConfigured ? '✓ ' : ''}Claude Desktop Configuration</h3>
        <button class="logs-dialog-close">×</button>
      </div>
      <div class="logs-dialog-body">
        <div style="margin-bottom: 20px;">
          <div style="padding: 15px; background: ${isConfigured ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)'}; border: 1px solid ${isConfigured ? 'rgba(76, 175, 80, 0.5)' : 'rgba(255, 152, 0, 0.5)'}; border-radius: 10px; margin-bottom: 20px;">
            <strong>Status:</strong> ${isConfigured ? `✓ Configured (${serverCount} servers)` : 'Not Configured'}
          </div>

          ${isConfigured ? `
            <div style="margin-bottom: 20px;">
              <h4>Configuration Preview:</h4>
              <div style="max-height: 200px; overflow-y: auto; background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 8px;">
                <pre style="margin: 0; font-family: monospace; font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(JSON.stringify(config, null, 2))}</pre>
              </div>
            </div>
          ` : ''}

          <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
            <button id="claude-desktop-auto-config-btn" class="logs-dialog-copy" style="flex: 1; min-width: 150px;">
              ${isConfigured ? 'Reconfigure' : 'Auto-Configure'}
            </button>
            <button id="claude-desktop-open-folder-btn" class="logs-dialog-copy" style="flex: 1; min-width: 150px;">
              Open Config Folder
            </button>
            ${isConfigured ? `
              <button id="claude-desktop-reset-btn" class="logs-dialog-copy" style="flex: 1; min-width: 150px; background: rgba(244, 67, 54, 0.3); border-color: rgba(244, 67, 54, 0.5);">
                Reset Configuration
              </button>
            ` : ''}
          </div>

          <div style="padding: 15px; background: rgba(0, 150, 255, 0.2); border-left: 3px solid rgba(0, 150, 255, 0.5); border-radius: 4px;">
            <h4 style="margin-top: 0;">What this does:</h4>
            <ul style="line-height: 1.8; margin-bottom: 10px;">
              <li>Creates Claude Desktop config file at the correct platform-specific location</li>
              <li>Configures all 9 MCP servers for stdio access</li>
              <li>Uses ultra-low latency connection (1-5ms response time)</li>
              <li>Enables seamless integration with Claude Desktop app</li>
            </ul>
            <p style="margin-bottom: 0;">
              <strong>Note:</strong> Claude Desktop must be installed separately.
              <a href="#" id="claude-desktop-download-link" style="color: #4caf50; text-decoration: underline;">Download Claude Desktop</a>
            </p>
          </div>
        </div>
      </div>
      <div class="logs-dialog-footer">
        <button class="logs-dialog-close-btn">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Add event listeners for close buttons
  const closeButtons = dialog.querySelectorAll('.logs-dialog-close, .logs-dialog-close-btn');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  });

  // Auto-configure button
  const autoConfigBtn = dialog.querySelector('#claude-desktop-auto-config-btn');
  if (autoConfigBtn) {
    autoConfigBtn.addEventListener('click', async () => {
      try {
        (autoConfigBtn as HTMLButtonElement).disabled = true;
        (autoConfigBtn as HTMLButtonElement).textContent = 'Configuring...';

        showNotification('Configuring Claude Desktop...', 'info');

        const result = await window.electronAPI.claudeDesktop.autoConfigure();

        if (result.success) {
          showNotification('Claude Desktop configured successfully!', 'success');
          // Close and reopen dialog to show updated status
          document.body.removeChild(dialog);
          const newConfig = await window.electronAPI.claudeDesktop.getConfig();
          showClaudeDesktopDialog(true, newConfig);
        } else {
          showNotification('Configuration failed: ' + (result.error || 'Unknown error'), 'error');
          (autoConfigBtn as HTMLButtonElement).disabled = false;
          (autoConfigBtn as HTMLButtonElement).textContent = isConfigured ? 'Reconfigure' : 'Auto-Configure';
        }
      } catch (error) {
        console.error('Error auto-configuring Claude Desktop:', error);
        showNotification('Failed to configure Claude Desktop', 'error');
        (autoConfigBtn as HTMLButtonElement).disabled = false;
        (autoConfigBtn as HTMLButtonElement).textContent = isConfigured ? 'Reconfigure' : 'Auto-Configure';
      }
    });
  }

  // Open folder button
  const openFolderBtn = dialog.querySelector('#claude-desktop-open-folder-btn');
  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', async () => {
      try {
        await window.electronAPI.claudeDesktop.openConfigFolder();
        showNotification('Opening config folder...', 'info');
      } catch (error) {
        console.error('Error opening config folder:', error);
        showNotification('Failed to open config folder', 'error');
      }
    });
  }

  // Reset button
  const resetBtn = dialog.querySelector('#claude-desktop-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to reset Claude Desktop configuration? This will remove all MCP server settings.')) {
        return;
      }

      try {
        showNotification('Resetting configuration...', 'info');

        const result = await window.electronAPI.claudeDesktop.resetConfig();

        if (result.success) {
          showNotification('Configuration reset successfully', 'success');
          // Close and reopen dialog to show updated status
          document.body.removeChild(dialog);
          showClaudeDesktopDialog(false, null);
        } else {
          showNotification('Reset failed: ' + (result.error || 'Unknown error'), 'error');
        }
      } catch (error) {
        console.error('Error resetting Claude Desktop config:', error);
        showNotification('Failed to reset configuration', 'error');
      }
    });
  }

  // Download link
  const downloadLink = dialog.querySelector('#claude-desktop-download-link');
  if (downloadLink) {
    downloadLink.addEventListener('click', (e) => {
      e.preventDefault();
      const url = 'https://claude.ai/download';
      window.open(url, '_blank');
      showNotification('Opening Claude Desktop download page...', 'info');
    });
  }
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Enable/disable quick action buttons
 */
function setQuickActionsEnabled(enabled: boolean): void {
  const buttons = [
    'dashboard-start-system',
    'dashboard-stop-system',
    'dashboard-restart-system',
    'dashboard-open-typing-mind',
  ];

  buttons.forEach(id => {
    const button = document.getElementById(id) as HTMLButtonElement;
    if (button) {
      button.disabled = !enabled;
    }
  });
}

/**
 * Show a notification message
 */
function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'success' ? 'rgba(0, 255, 0, 0.2)' : type === 'error' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 150, 255, 0.2)'};
    border: 1px solid ${type === 'success' ? 'rgba(0, 255, 0, 0.5)' : type === 'error' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 150, 255, 0.5)'};
    border-radius: 8px;
    color: white;
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

/**
 * Handle Backup Database action
 */
async function handleBackupDatabase(): Promise<void> {
  try {
    // Ask user if they want to choose a custom location
    const useCustomLocation = confirm('Would you like to choose where to save the backup?\n\nClick OK to choose a location, or Cancel to use the default backup folder.');

    let customPath: string | null = null;
    if (useCustomLocation) {
      customPath = await window.electronAPI.databaseBackup.selectSaveLocation();
      if (!customPath) {
        // User cancelled the file dialog
        return;
      }
    }

    showNotification('Creating database backup...', 'info');

    const result = await window.electronAPI.databaseBackup.create(customPath || undefined, true);

    if (result.success) {
      const sizeInMB = result.size ? (result.size / (1024 * 1024)).toFixed(2) : '?';
      showNotification(`Backup created successfully! (${sizeInMB} MB)`, 'success');
    } else {
      showNotification(`Failed to create backup: ${result.error || result.message}`, 'error');
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    showNotification('Failed to create database backup', 'error');
  }
}

/**
 * Handle Restore Database action
 */
async function handleRestoreDatabase(): Promise<void> {
  try {
    // Warn user about restore operation
    if (!confirm('WARNING: Restoring a database backup will replace all current data.\n\nMake sure you have a recent backup of your current data before proceeding.\n\nDo you want to continue?')) {
      return;
    }

    // Ask user to select a backup file
    const backupPath = await window.electronAPI.databaseBackup.selectRestoreFile();
    if (!backupPath) {
      // User cancelled the file dialog
      return;
    }

    // Ask if they want to drop the existing database
    const dropExisting = confirm('Do you want to completely replace the existing database?\n\nClick OK to drop and recreate the database (recommended for clean restore).\nClick Cancel to merge the backup with existing data.');

    showNotification('Restoring database... This may take a few minutes.', 'info');

    const result = await window.electronAPI.databaseBackup.restore(backupPath, dropExisting);

    if (result.success) {
      showNotification('Database restored successfully!', 'success');
      // Refresh system status after restore
      await updateSystemStatus();
    } else {
      showNotification(`Failed to restore database: ${result.error || result.message}`, 'error');
    }
  } catch (error) {
    console.error('Error restoring database:', error);
    showNotification('Failed to restore database', 'error');
  }
}

/**
 * Handle Manage Backups action
 */
async function handleManageBackups(): Promise<void> {
  try {
    showNotification('Loading backups...', 'info');

    const result = await window.electronAPI.databaseBackup.list();

    if (!result.success) {
      showNotification(`Failed to load backups: ${result.error}`, 'error');
      return;
    }

    showBackupsDialog(result.backups);
  } catch (error) {
    console.error('Error loading backups:', error);
    showNotification('Failed to load backups', 'error');
  }
}

/**
 * Handle Open Backup Folder action
 */
async function handleOpenBackupFolder(): Promise<void> {
  try {
    await window.electronAPI.databaseBackup.openDirectory();
    showNotification('Opening backup folder...', 'info');
  } catch (error) {
    console.error('Error opening backup folder:', error);
    showNotification('Failed to open backup folder', 'error');
  }
}

/**
 * Show backups management dialog
 */
function showBackupsDialog(backups: any[]): void {
  const dialog = document.createElement('div');
  dialog.className = 'logs-dialog'; // Reuse logs dialog styles

  const backupDirectory = backups.length > 0 ? backups[0].path.substring(0, backups[0].path.lastIndexOf('/')) : 'N/A';

  let backupsHTML = '';
  if (backups.length === 0) {
    backupsHTML = '<p style="text-align: center; padding: 20px; opacity: 0.7;">No backups found</p>';
  } else {
    backupsHTML = backups.map(backup => {
      const createdDate = new Date(backup.createdAt);
      const sizeInMB = (backup.size / (1024 * 1024)).toFixed(2);
      const isCompressed = backup.compressed ? '(Compressed)' : '(Plain SQL)';

      return `
        <div class="backup-item" style="padding: 15px; margin-bottom: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: bold; margin-bottom: 5px;">${escapeHtml(backup.filename)}</div>
              <div style="font-size: 0.9em; opacity: 0.8;">
                ${createdDate.toLocaleString()} • ${sizeInMB} MB ${isCompressed}
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button class="backup-restore-btn" data-path="${escapeHtml(backup.path)}" style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Restore
              </button>
              <button class="backup-delete-btn" data-path="${escapeHtml(backup.path)}" style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Delete
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  dialog.innerHTML = `
    <div class="logs-dialog-backdrop"></div>
    <div class="logs-dialog-content" style="max-width: 800px; max-height: 80vh;">
      <div class="logs-dialog-header">
        <h3>Manage Database Backups</h3>
        <button class="logs-dialog-close">×</button>
      </div>
      <div class="logs-dialog-body" style="max-height: 500px; overflow-y: auto;">
        <div style="margin-bottom: 20px; padding: 15px; background: rgba(0, 150, 255, 0.2); border-left: 3px solid rgba(0, 150, 255, 0.5); border-radius: 4px;">
          <strong>Backup Directory:</strong> ${escapeHtml(backupDirectory || 'N/A')}
        </div>
        ${backupsHTML}
      </div>
      <div class="logs-dialog-footer">
        <button id="backups-create-new" class="logs-dialog-copy">Create New Backup</button>
        <button class="logs-dialog-close-btn">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Add event listeners for close buttons
  const closeButtons = dialog.querySelectorAll('.logs-dialog-close, .logs-dialog-close-btn');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  });

  // Add event listener for create new backup button
  const createNewBtn = dialog.querySelector('#backups-create-new');
  if (createNewBtn) {
    createNewBtn.addEventListener('click', async () => {
      document.body.removeChild(dialog);
      await handleBackupDatabase();
    });
  }

  // Add event listeners for restore buttons
  const restoreButtons = dialog.querySelectorAll('.backup-restore-btn');
  restoreButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const backupPath = btn.getAttribute('data-path');
      if (!backupPath) return;

      // Confirm restore
      if (!confirm('Are you sure you want to restore this backup?\n\nThis will replace all current database data.')) {
        return;
      }

      document.body.removeChild(dialog);
      showNotification('Restoring database...', 'info');

      try {
        const result = await window.electronAPI.databaseBackup.restore(backupPath, false);
        if (result.success) {
          showNotification('Database restored successfully!', 'success');
          await updateSystemStatus();
        } else {
          showNotification(`Failed to restore: ${result.error || result.message}`, 'error');
        }
      } catch (error) {
        console.error('Error restoring backup:', error);
        showNotification('Failed to restore backup', 'error');
      }
    });
  });

  // Add event listeners for delete buttons
  const deleteButtons = dialog.querySelectorAll('.backup-delete-btn');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const backupPath = btn.getAttribute('data-path');
      if (!backupPath) return;

      // Confirm deletion
      if (!confirm('Are you sure you want to delete this backup?\n\nThis action cannot be undone.')) {
        return;
      }

      try {
        const result = await window.electronAPI.databaseBackup.delete(backupPath);
        if (result.success) {
          showNotification('Backup deleted successfully', 'success');
          // Refresh the dialog
          document.body.removeChild(dialog);
          await handleManageBackups();
        } else {
          showNotification(`Failed to delete backup: ${result.error || result.message}`, 'error');
        }
      } catch (error) {
        console.error('Error deleting backup:', error);
        showNotification('Failed to delete backup', 'error');
      }
    });
  });
}

/**
 * Clean up dashboard (called when navigating away)
 */
export function cleanupDashboard(): void {
  stopStatusPolling();
  window.electronAPI.mcpSystem.removeProgressListener();
}
