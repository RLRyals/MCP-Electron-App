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

/**
 * Initialize the dashboard
 */
export async function initializeDashboard(): Promise<void> {
  console.log('Initializing dashboard...');

  // Load initial status
  await updateSystemStatus();

  // Start polling
  startStatusPolling();

  // Setup event listeners
  setupDashboardListeners();
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
  const refreshBtn = document.getElementById('dashboard-refresh-status');

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

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => updateSystemStatus());
  }

  // Service card actions
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains('view-logs-btn')) {
      const serviceName = target.getAttribute('data-service');
      if (serviceName) {
        handleViewLogs(serviceName);
      }
    }

    if (target.classList.contains('copy-token-btn')) {
      handleCopyToken();
    }

    if (target.classList.contains('open-browser-btn')) {
      const url = target.getAttribute('data-url');
      if (url) {
        handleOpenBrowser(url);
      }
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
 * Update the system status and refresh UI
 */
export async function updateSystemStatus(): Promise<void> {
  try {
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
    showErrorStatus();
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
  } else if (!status.healthy) {
    // System degraded - yellow
    statusElement.classList.add('status-yellow');
    statusTextElement.textContent = 'System Degraded';
  } else {
    // All systems operational - green
    statusElement.classList.add('status-green');
    statusTextElement.textContent = 'System Ready';
  }
}

/**
 * Update service cards with current status
 */
async function updateServiceCards(status: MCPSystemStatus): Promise<void> {
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
}

/**
 * Update PostgreSQL service card
 */
function updatePostgreSQLCard(status: MCPSystemStatus, config: EnvConfig): void {
  const container = status.containers.find(c => c.name.includes('postgres'));

  const statusIcon = document.getElementById('postgres-status-icon');
  const statusText = document.getElementById('postgres-status-text');
  const portText = document.getElementById('postgres-port');

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
 */
function updateMCPServersCard(status: MCPSystemStatus): void {
  const container = status.containers.find(c => c.name.includes('mcp-servers'));

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
      const portText = document.getElementById('mcp-connector-port');

      if (statusIcon && statusText && portText) {
        portText.textContent = `Port: ${config.MCP_CONNECTOR_PORT}`;

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
    } else {
      card.style.display = 'none';
    }
  }
}

/**
 * Update Typing Mind service card
 */
function updateTypingMindCard(status: MCPSystemStatus, config: EnvConfig, urls: ServiceUrls): void {
  const container = status.containers.find(c => c.name.includes('typing-mind'));
  const card = document.getElementById('typing-mind-card');

  // Show/hide card based on whether Typing Mind is configured
  if (card) {
    if (urls.typingMind) {
      card.style.display = 'block';

      const statusIcon = document.getElementById('typing-mind-status-icon');
      const statusText = document.getElementById('typing-mind-status-text');
      const portText = document.getElementById('typing-mind-port');

      if (statusIcon && statusText && portText) {
        portText.textContent = `Port: ${config.TYPING_MIND_PORT}`;

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
    } else {
      card.style.display = 'none';
    }
  }
}

/**
 * Show error status when status update fails
 */
function showErrorStatus(): void {
  const statusElement = document.getElementById('dashboard-status-indicator');
  const statusTextElement = document.getElementById('dashboard-status-text');

  if (statusElement && statusTextElement) {
    statusElement.classList.remove('status-green', 'status-yellow', 'status-red');
    statusElement.classList.add('status-red');
    statusTextElement.textContent = 'Status Unknown';
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
 * Handle View Logs action
 */
async function handleViewLogs(serviceName: string): Promise<void> {
  try {
    // Map UI service names to actual service names
    const serviceMap: { [key: string]: 'postgres' | 'mcp-servers' | 'mcp-connector' | 'typing-mind' } = {
      'postgres': 'postgres',
      'mcp-servers': 'mcp-servers',
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
 */
async function handleOpenBrowser(url: string): Promise<void> {
  try {
    // Use shell.openExternal via a new IPC call, or just window.open
    // For now, we'll use window.open which should work in Electron
    window.open(url, '_blank');
    showNotification(`Opening ${url}`, 'info');
  } catch (error) {
    console.error('Error opening browser:', error);
    showNotification('Failed to open browser', 'error');
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
 * Clean up dashboard (called when navigating away)
 */
export function cleanupDashboard(): void {
  stopStatusPolling();
  window.electronAPI.mcpSystem.removeProgressListener();
}
