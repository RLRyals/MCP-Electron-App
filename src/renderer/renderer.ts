/**
 * Renderer process script
 * This file runs in the renderer process and has access to the DOM
 * It communicates with the main process via IPC through the preload script
 */

import { loadEnvConfig, setupEnvConfigListeners } from './env-config-handlers.js';
import { loadClientOptions, setupClientSelectionListeners } from './client-selection-handlers.js';
import { initializeDashboard } from './dashboard-handlers.js';
import { createDefaultTabNavigation } from './components/TabNavigation.js';
import { initializeSetupTab } from './components/SetupTab.js';
import { createDashboardTab } from './components/DashboardTab.js';
import { createDefaultLogsTab } from './components/LogsTab.js';
import { initializeServicesTab } from './components/ServicesTab.js';
import { createDatabaseTab } from './components/DatabaseTab.js';

// Type definitions for the API exposed by preload script
interface PrerequisiteStatus {
  installed: boolean;
  running?: boolean;
  version?: string;
  error?: string;
}

interface PlatformInfo {
  platform: string;
  platformName: string;
  arch: string;
  nodeVersion: string;
}

interface AllPrerequisitesResult {
  docker: PrerequisiteStatus;
  git: PrerequisiteStatus;
  wsl?: PrerequisiteStatus;
  platform: string;
}

interface SystemCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

interface SystemTestResult {
  passed: boolean;
  systemInfo: any;
  checks: SystemCheck[];
}

interface DiagnosticReportResult {
  success: boolean;
  path?: string;
  error?: string;
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
  TYPING_MIND_PORT: number;
}

interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

interface SaveConfigResult {
  success: boolean;
  path?: string;
  error?: string;
}

interface DockerStatus {
  running: boolean;
  healthy: boolean;
  message: string;
  error?: string;
}

interface DockerOperationResult {
  success: boolean;
  message: string;
  error?: string;
}

interface DockerProgress {
  message: string;
  percent: number;
  step: string;
}

interface InstallationStep {
  stepNumber: number;
  title: string;
  description: string;
  command?: string;
  requiresAdmin?: boolean;
  requiresRestart?: boolean;
  estimatedTime?: string;
}

interface InstallationInstructions {
  platform: string;
  platformName: string;
  architecture: string;
  downloadUrl: string;
  totalSteps: number;
  steps: InstallationStep[];
  notes: string[];
  additionalInfo?: string;
}

interface DockerContainer {
  id: string;
  name: string;
  status: string;
  health?: string;
}

interface DockerContainersResult {
  success: boolean;
  containers: DockerContainer[];
  error?: string;
}

interface ClientMetadata {
  id: string;
  name: string;
  type: 'web-based' | 'native';
  description: string;
  features: string[];
  requirements: string[];
  downloadSize: string;
  installation: 'automatic' | 'manual';
}

interface ClientSelection {
  clients: string[];
  selectedAt: string;
  version?: string;
}

interface ClientStatus {
  id: string;
  name: string;
  selected: boolean;
  installed: boolean;
  installationDate?: string;
  version?: string;
}

interface SaveSelectionResult {
  success: boolean;
  error?: string;
}

interface MCPSystemProgress {
  message: string;
  percent: number;
  step: string;
  status: 'starting' | 'checking' | 'ready' | 'error';
}

interface MCPSystemOperationResult {
  success: boolean;
  message: string;
  error?: string;
  urls?: ServiceUrls;
}

interface ServiceUrls {
  typingMind?: string;
  mcpConnector?: string;
  postgres?: string;
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

interface ServiceLogsResult {
  success: boolean;
  logs: string;
  error?: string;
}

interface PortConflictResult {
  success: boolean;
  conflicts: number[];
}

interface BackupResult {
  success: boolean;
  message: string;
  path?: string;
  size?: number;
  error?: string;
}

interface RestoreResult {
  success: boolean;
  message: string;
  error?: string;
}

interface BackupMetadata {
  filename: string;
  path: string;
  createdAt: string;
  size: number;
  database: string;
  compressed: boolean;
}

interface ListBackupsResult {
  success: boolean;
  backups: BackupMetadata[];
  error?: string;
}

interface ElectronAPI {
  ping: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  getPlatformInfo: () => Promise<{
    platform: string;
    arch: string;
    version: string;
  }>;
  prerequisites: {
    checkDocker: () => Promise<PrerequisiteStatus>;
    checkDockerRunning: () => Promise<PrerequisiteStatus>;
    getDockerVersion: () => Promise<PrerequisiteStatus>;
    checkGit: () => Promise<PrerequisiteStatus>;
    checkWSL: () => Promise<PrerequisiteStatus>;
    checkAll: () => Promise<AllPrerequisitesResult>;
    getPlatformInfo: () => Promise<PlatformInfo>;
  };
  logger: {
    openLogFile: () => Promise<void>;
    openLogsDirectory: () => Promise<void>;
    exportDiagnosticReport: () => Promise<DiagnosticReportResult>;
    testSystem: () => Promise<SystemTestResult>;
    getRecentLogs: (lines?: number) => Promise<string[]>;
    generateIssueTemplate: (title: string, message: string, stack?: string) => Promise<string>;
    openGitHubIssue: (title: string, message: string, stack?: string) => Promise<void>;
    onSystemTestResults: (callback: (results: SystemTestResult) => void) => void;
  };
  envConfig: {
    getConfig: () => Promise<EnvConfig>;
    saveConfig: (config: EnvConfig) => Promise<SaveConfigResult>;
    generatePassword: (length?: number) => Promise<string>;
    generateToken: () => Promise<string>;
    checkPort: (port: number) => Promise<boolean>;
    resetDefaults: () => Promise<EnvConfig>;
    validateConfig: (config: EnvConfig) => Promise<ConfigValidationResult>;
    calculatePasswordStrength: (password: string) => Promise<'weak' | 'medium' | 'strong'>;
    getEnvFilePath: () => Promise<string>;
  };
  docker: {
    start: () => Promise<DockerOperationResult>;
    waitReady: () => Promise<DockerOperationResult>;
    startAndWait: () => Promise<DockerOperationResult>;
    stop: () => Promise<DockerOperationResult>;
    restart: () => Promise<DockerOperationResult>;
    healthCheck: () => Promise<DockerStatus>;
    getContainersStatus: () => Promise<DockerContainersResult>;
    onProgress: (callback: (progress: DockerProgress) => void) => void;
    removeProgressListener: () => void;
  };
  wizard: {
    getInstructions: () => Promise<InstallationInstructions>;
    getDownloadUrl: () => Promise<string>;
    openDownloadPage: () => Promise<void>;
    copyCommand: (command: string) => Promise<boolean>;
    getStep: (stepNumber: number) => Promise<InstallationStep | null>;
    getExplanation: () => Promise<string>;
  };
  clientSelection: {
    getOptions: () => Promise<ClientMetadata[]>;
    saveSelection: (clients: string[]) => Promise<SaveSelectionResult>;
    getSelection: () => Promise<ClientSelection | null>;
    getStatus: () => Promise<ClientStatus[]>;
    clearSelection: () => Promise<SaveSelectionResult>;
    getById: (clientId: string) => Promise<ClientMetadata | null>;
    getSelectionFilePath: () => Promise<string>;
  };
  mcpSystem: {
    start: () => Promise<MCPSystemOperationResult>;
    stop: () => Promise<MCPSystemOperationResult>;
    restart: () => Promise<MCPSystemOperationResult>;
    getStatus: () => Promise<MCPSystemStatus>;
    getUrls: () => Promise<ServiceUrls>;
    getLogs: (serviceName: 'postgres' | 'mcp-writing-servers' | 'mcp-connector' | 'typing-mind', tail?: number) => Promise<ServiceLogsResult>;
    checkPorts: () => Promise<PortConflictResult>;
    getWorkingDirectory: () => Promise<string>;
    onProgress: (callback: (progress: MCPSystemProgress) => void) => void;
    removeProgressListener: () => void;
  };
  databaseBackup: {
    create: (customPath?: string, compressed?: boolean) => Promise<BackupResult>;
    restore: (backupPath: string, dropExisting?: boolean) => Promise<RestoreResult>;
    list: () => Promise<ListBackupsResult>;
    delete: (backupPath: string) => Promise<BackupResult>;
    selectSaveLocation: () => Promise<string | null>;
    selectRestoreFile: () => Promise<string | null>;
    getDirectory: () => Promise<string>;
    openDirectory: () => Promise<void>;
  };
  databaseAdmin: {
    checkConnection: () => Promise<any>;
    getServerInfo: () => Promise<any>;
    queryRecords: (params: any) => Promise<any>;
    insertRecord: (params: any) => Promise<any>;
    updateRecords: (params: any) => Promise<any>;
    deleteRecords: (params: any) => Promise<any>;
    batchInsert: (params: any) => Promise<any>;
    batchUpdate: (params: any) => Promise<any>;
    batchDelete: (params: any) => Promise<any>;
    getSchema: (params: any) => Promise<any>;
    listTables: () => Promise<any>;
    getRelationships: (params: any) => Promise<any>;
    listColumns: (params: any) => Promise<any>;
    queryAuditLogs: (params: any) => Promise<any>;
    getAuditSummary: (params: any) => Promise<any>;
  };
  typingMind: {
    autoConfigure: () => Promise<any>;
    setCustomConfig: (serverUrl: string, authToken: string) => Promise<any>;
    getConfig: () => Promise<any>;
    getConfigInstructions: () => Promise<string>;
    isConfigured: () => Promise<boolean>;
    resetConfig: () => Promise<any>;
    getMCPServersJSON: () => Promise<string>;
    openWindow: (url: string) => Promise<{ success: boolean; error?: string }>;
  };
  claudeDesktop: {
    autoConfigure: () => Promise<any>;
    isConfigured: () => Promise<boolean>;
    getConfig: () => Promise<any>;
    resetConfig: () => Promise<any>;
    getConfigPath: () => Promise<string>;
    openConfigFolder: () => Promise<void>;
    getConfigInstructions: () => Promise<string>;
  };
  updater: {
    checkAll: () => Promise<any>;
    checkMCPServers: () => Promise<any>;
    checkTypingMind: () => Promise<any>;
    updateAll: () => Promise<any>;
    updateMCPServers: () => Promise<any>;
    updateTypingMind: () => Promise<any>;
    getPreferences: () => Promise<any>;
    setPreferences: (prefs: any) => Promise<void>;
    onProgress: (callback: (progress: any) => void) => void;
    removeProgressListener: () => void;
    onCheckComplete: (callback: (result: any) => void) => void;
    onAutoCheckComplete: (callback: (result: any) => void) => void;
    removeCheckListeners: () => void;
  };
}

// Access the API exposed through preload script
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

/**
 * Load and display application information
 */
async function loadAppInfo(): Promise<void> {
  try {
    // Get app version
    const version = await window.electronAPI.getAppVersion();
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
      versionElement.textContent = version;
    }

    // Get platform info
    const platformInfo = await window.electronAPI.getPlatformInfo();

    const platformElement = document.getElementById('platform');
    if (platformElement) {
      platformElement.textContent = platformInfo.platform;
    }

    const archElement = document.getElementById('architecture');
    if (archElement) {
      archElement.textContent = platformInfo.arch;
    }

    const nodeVersionElement = document.getElementById('node-version');
    if (nodeVersionElement) {
      nodeVersionElement.textContent = platformInfo.version;
    }

    console.log('App info loaded successfully');
  } catch (error) {
    console.error('Error loading app info:', error);
  }
}

/**
 * Test IPC communication with main process
 */
async function testIPC(): Promise<void> {
  const button = document.getElementById('test-ipc') as HTMLButtonElement;
  const result = document.getElementById('test-result');

  if (!button || !result) return;

  try {
    button.disabled = true;
    button.textContent = 'Testing...';

    const response = await window.electronAPI.ping();

    if (response === 'pong') {
      result.textContent = 'IPC communication successful!';
      result.style.background = 'rgba(0, 255, 0, 0.2)';
      result.classList.add('show');

      console.log('IPC test passed:', response);
    } else {
      throw new Error('Unexpected response from IPC');
    }
  } catch (error) {
    console.error('IPC test failed:', error);
    result.textContent = 'IPC communication failed!';
    result.style.background = 'rgba(255, 0, 0, 0.2)';
    result.classList.add('show');
  } finally {
    button.disabled = false;
    button.textContent = 'Test IPC Communication';
  }
}

/**
 * Update prerequisite status UI
 */
function updatePrereqUI(
  name: string,
  status: PrerequisiteStatus
): void {
  const iconElement = document.getElementById(`${name}-status-icon`);
  const detailElement = document.getElementById(`${name}-detail`);
  const errorElement = document.getElementById(`${name}-error`);

  if (!iconElement || !detailElement || !errorElement) return;

  // Remove all status classes
  iconElement.classList.remove('success', 'error', 'loading');

  if (status.installed) {
    iconElement.classList.add('success');
    let detail = `Installed: ${status.version || 'unknown version'}`;

    if (status.running !== undefined) {
      detail += status.running ? ' (Running)' : ' (Not Running)';
      if (!status.running) {
        iconElement.classList.remove('success');
        iconElement.classList.add('error');
      }
    }

    detailElement.textContent = detail;
    errorElement.style.display = 'none';
  } else {
    iconElement.classList.add('error');
    detailElement.textContent = 'Not Installed';

    if (status.error) {
      errorElement.textContent = status.error;
      errorElement.style.display = 'block';
    } else {
      errorElement.style.display = 'none';
    }
  }
}

/**
 * Check all prerequisites
 */
async function checkPrerequisites(): Promise<void> {
  const button = document.getElementById('check-prerequisites') as HTMLButtonElement;

  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Checking...';

    // Reset all icons to loading state
    ['docker', 'git', 'wsl'].forEach(name => {
      const iconElement = document.getElementById(`${name}-status-icon`);
      const detailElement = document.getElementById(`${name}-detail`);
      if (iconElement) {
        iconElement.classList.remove('success', 'error');
        iconElement.classList.add('loading');
      }
      if (detailElement) {
        detailElement.textContent = 'Checking...';
      }
    });

    // Get platform info to determine if we should show WSL
    const platformInfo = await window.electronAPI.prerequisites.getPlatformInfo();
    const wslItem = document.getElementById('wsl-item');
    if (wslItem) {
      wslItem.style.display = platformInfo.platform === 'windows' ? 'block' : 'none';
    }

    // Check all prerequisites
    const results = await window.electronAPI.prerequisites.checkAll();

    console.log('Prerequisites check results:', results);

    // Update UI with results
    updatePrereqUI('docker', results.docker);
    updatePrereqUI('git', results.git);

    if (results.wsl) {
      updatePrereqUI('wsl', results.wsl);
    }

  } catch (error) {
    console.error('Error checking prerequisites:', error);

    // Show error state
    ['docker', 'git', 'wsl'].forEach(name => {
      const iconElement = document.getElementById(`${name}-status-icon`);
      const detailElement = document.getElementById(`${name}-detail`);
      if (iconElement) {
        iconElement.classList.remove('loading', 'success');
        iconElement.classList.add('error');
      }
      if (detailElement) {
        detailElement.textContent = 'Check failed';
      }
    });
  } finally {
    button.disabled = false;
    button.textContent = 'Check Prerequisites';
  }
}

/**
 * Run system tests and display results
 */
async function runSystemTests(): Promise<void> {
  const button = document.getElementById('test-system') as HTMLButtonElement;
  const resultsDiv = document.getElementById('system-test-results');

  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Testing...';

    if (resultsDiv) {
      resultsDiv.innerHTML = '<p>Running system tests...</p>';
      resultsDiv.classList.add('show');
    }

    const results = await window.electronAPI.logger.testSystem();

    displaySystemTestResults(results);
  } catch (error) {
    console.error('Error running system tests:', error);
    if (resultsDiv) {
      resultsDiv.innerHTML = '<p style="color: red;">Error running system tests</p>';
    }
  } finally {
    button.disabled = false;
    button.textContent = 'Test System';
  }
}

/**
 * Display system test results
 */
function displaySystemTestResults(results: SystemTestResult): void {
  const resultsDiv = document.getElementById('system-test-results');

  if (!resultsDiv) return;

  let html = `<div class="test-results ${results.passed ? 'passed' : 'failed'}">`;
  html += `<h4>System Test ${results.passed ? 'Passed' : 'Failed'}</h4>`;
  html += '<ul>';

  results.checks.forEach(check => {
    const icon = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '⚠';
    const statusClass = check.status === 'pass' ? 'success' : check.status === 'fail' ? 'error' : 'warning';
    html += `<li class="${statusClass}"><span class="icon">${icon}</span> <strong>${check.name}:</strong> ${check.message}</li>`;
  });

  html += '</ul></div>';
  resultsDiv.innerHTML = html;
  resultsDiv.classList.add('show');
}

/**
 * Export diagnostic report
 */
async function exportDiagnosticReport(): Promise<void> {
  const button = document.getElementById('export-report') as HTMLButtonElement;

  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Exporting...';

    const result = await window.electronAPI.logger.exportDiagnosticReport();

    if (result.success) {
      showNotification(`Diagnostic report exported to: ${result.path}`, 'success');
    } else {
      showNotification(`Failed to export report: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error exporting diagnostic report:', error);
    showNotification('Failed to export diagnostic report', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Export Diagnostic Report';
  }
}

/**
 * Show a notification message
 */
export function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
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

// Make showNotification globally available for other modules
(window as any).showNotification = showNotification;

/**
 * Show error dialog with details
 */
function showErrorDialog(title: string, message: string, stack?: string): void {
  const dialog = document.createElement('div');
  dialog.className = 'error-dialog';
  dialog.innerHTML = `
    <div class="error-dialog-backdrop"></div>
    <div class="error-dialog-content">
      <h3>${title}</h3>
      <p>${message}</p>
      ${stack ? `<pre class="error-stack">${stack}</pre>` : ''}
      <div class="error-dialog-buttons">
        <button id="copy-error" class="button">Copy Error Details</button>
        <button id="report-issue" class="button">Report Issue</button>
        <button id="close-error" class="button primary">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Add event listeners
  const copyButton = document.getElementById('copy-error');
  const reportButton = document.getElementById('report-issue');
  const closeButton = document.getElementById('close-error');

  if (copyButton) {
    copyButton.addEventListener('click', () => {
      const errorDetails = `${title}\n\n${message}\n\n${stack || ''}`;
      navigator.clipboard.writeText(errorDetails);
      showNotification('Error details copied to clipboard', 'success');
    });
  }

  if (reportButton) {
    reportButton.addEventListener('click', async () => {
      try {
        await window.electronAPI.logger.openGitHubIssue(title, message, stack);
        showNotification('Opening GitHub issue template...', 'info');
      } catch (error) {
        console.error('Error opening GitHub issue:', error);
        showNotification('Failed to open GitHub issue', 'error');
      }
    });
  }

  if (closeButton) {
    closeButton.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  }
}

/**
 * Global error handler
 */
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  showErrorDialog('Application Error', event.message, event.error?.stack);
});

/**
 * Global unhandled rejection handler
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  showErrorDialog('Unhandled Promise Rejection', String(event.reason), event.reason?.stack);
});

/**
 * Initialize the renderer process
 */
function init(): void {
  console.log('Renderer process initialized');

  // Initialize tab navigation system
  const tabNavigation = createDefaultTabNavigation();
  tabNavigation.initialize();

  // Initialize dashboard tab component
  const dashboardTab = createDashboardTab();
  dashboardTab.initialize();

  // Initialize logs tab component
  const logsTab = createDefaultLogsTab();

  // Declare servicesTab and databaseTab variables to initialize them when needed
  let servicesTab: any = null;
  let databaseTab: any = null;

  // Listen for tab changes to initialize LogsTab, ServicesTab, and DatabaseTab when first shown
  window.addEventListener('tab-changed', async (e: Event) => {
    const customEvent = e as CustomEvent;
    if (customEvent.detail.tabId === 'logs' && !logsTab['isInitialized']) {
      try {
        await logsTab.initialize();
      } catch (err) {
        console.error('Error initializing Logs Tab:', err);
      }
    }
    if (customEvent.detail.tabId === 'services' && !servicesTab) {
      try {
        servicesTab = await initializeServicesTab();
        console.log('Services Tab initialized successfully');
      } catch (err) {
        console.error('Error initializing Services Tab:', err);
        showNotification('Failed to initialize Services Tab', 'error');
      }
    }
    if (customEvent.detail.tabId === 'database' && !databaseTab) {
      try {
        databaseTab = createDatabaseTab();
        await databaseTab.initialize();
        console.log('Database Tab initialized successfully');
      } catch (err) {
        console.error('Error initializing Database Tab:', err);
        showNotification('Failed to initialize Database Tab', 'error');
      }
    }
  });

  // Load app information
  loadAppInfo();

  // Set up event listeners
  const testButton = document.getElementById('test-ipc');
  if (testButton) {
    testButton.addEventListener('click', testIPC);
  }

  const prereqButton = document.getElementById('check-prerequisites');
  if (prereqButton) {
    prereqButton.addEventListener('click', checkPrerequisites);
  }

  const testSystemButton = document.getElementById('test-system');
  if (testSystemButton) {
    testSystemButton.addEventListener('click', runSystemTests);
  }

  const exportReportButton = document.getElementById('export-report');
  if (exportReportButton) {
    exportReportButton.addEventListener('click', exportDiagnosticReport);
  }

  const viewLogsButton = document.getElementById('view-logs');
  if (viewLogsButton) {
    viewLogsButton.addEventListener('click', () => {
      window.electronAPI.logger.openLogFile().catch(err => {
        console.error('Error opening log file:', err);
        showNotification('Failed to open log file', 'error');
      });
    });
  }

  // Listen for system test results from menu
  window.electronAPI.logger.onSystemTestResults((results) => {
    displaySystemTestResults(results);
  });

  // Setup environment configuration listeners and load config
  setupEnvConfigListeners();
  loadEnvConfig();

  // Setup client selection listeners and load options
  setupClientSelectionListeners();
  loadClientOptions();

  // Initialize Setup Tab
  initializeSetupTab().catch(err => {
    console.error('Error initializing Setup Tab:', err);
    // Don't show notification - this is not critical
  });

  // Initialize dashboard (main control interface)
  initializeDashboard().catch(err => {
    console.error('Critical error initializing dashboard:', err);
    showNotification('Failed to initialize dashboard. Please check the console for details.', 'error');
  });

  // Set up Docker control event listeners
  const startButton = document.getElementById('start-docker');
  if (startButton) {
    startButton.addEventListener('click', startDocker);
  }

  const stopButton = document.getElementById('stop-docker');
  if (stopButton) {
    stopButton.addEventListener('click', stopDocker);
  }

  const restartButton = document.getElementById('restart-docker');
  if (restartButton) {
    restartButton.addEventListener('click', restartDocker);
  }

  const healthButton = document.getElementById('check-docker-health');
  if (healthButton) {
    healthButton.addEventListener('click', checkDockerHealth);
  }

  // Set up Database tab event listeners
  const dbBackupButton = document.getElementById('db-backup-database');
  if (dbBackupButton) {
    dbBackupButton.addEventListener('click', () => {
      // Delegate to dashboard handler
      const dashboardBackupButton = document.getElementById('dashboard-backup-database');
      if (dashboardBackupButton) {
        dashboardBackupButton.click();
      }
    });
  }

  const dbRestoreButton = document.getElementById('db-restore-database');
  if (dbRestoreButton) {
    dbRestoreButton.addEventListener('click', () => {
      // Delegate to dashboard handler
      const dashboardRestoreButton = document.getElementById('dashboard-restore-database');
      if (dashboardRestoreButton) {
        dashboardRestoreButton.click();
      }
    });
  }

  const dbManageBackupsButton = document.getElementById('db-manage-backups');
  if (dbManageBackupsButton) {
    dbManageBackupsButton.addEventListener('click', () => {
      // Delegate to dashboard handler
      const dashboardManageButton = document.getElementById('dashboard-manage-backups');
      if (dashboardManageButton) {
        dashboardManageButton.click();
      }
    });
  }

  const dbOpenBackupFolderButton = document.getElementById('db-open-backup-folder');
  if (dbOpenBackupFolderButton) {
    dbOpenBackupFolderButton.addEventListener('click', () => {
      // Delegate to dashboard handler
      const dashboardOpenFolderButton = document.getElementById('dashboard-open-backup-folder');
      if (dashboardOpenFolderButton) {
        dashboardOpenFolderButton.click();
      }
    });
  }

  // Automatically check prerequisites on load
  checkPrerequisites();
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


// Export to make this a module (required for global augmentation)


/**
 * Start Docker Desktop
 */
async function startDocker(): Promise<void> {
  const button = document.getElementById('start-docker') as HTMLButtonElement;
  const statusDiv = document.getElementById('docker-status');
  const progressDiv = document.getElementById('docker-progress');
  const progressBar = document.getElementById('docker-progress-bar') as HTMLDivElement;
  const progressText = document.getElementById('docker-progress-text');

  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Starting...';

    if (progressDiv) progressDiv.classList.add('show');
    if (progressText) progressText.textContent = 'Starting Docker Desktop...';
    if (progressBar) progressBar.style.width = '0%';

    // Listen for progress updates
    window.electronAPI.docker.onProgress((progress) => {
      if (progressText) progressText.textContent = progress.message;
      if (progressBar) progressBar.style.width = `${progress.percent}%`;
    });

    const result = await window.electronAPI.docker.startAndWait();

    if (result.success) {
      showNotification(result.message, 'success');
      if (statusDiv) {
        statusDiv.textContent = 'Status: Running';
        statusDiv.classList.add('success');
        statusDiv.classList.remove('error');
      }
      // Update Docker status in prerequisites
      await checkPrerequisites();
    } else {
      showNotification(`Failed to start Docker: ${result.error || result.message}`, 'error');
      if (statusDiv) {
        statusDiv.textContent = 'Status: Not Running';
        statusDiv.classList.add('error');
        statusDiv.classList.remove('success');
      }
    }
  } catch (error) {
    console.error('Error starting Docker:', error);
    showNotification('Failed to start Docker', 'error');
    if (statusDiv) {
      statusDiv.textContent = 'Status: Error';
      statusDiv.classList.add('error');
      statusDiv.classList.remove('success');
    }
  } finally {
    button.disabled = false;
    button.textContent = 'Start Docker';
    if (progressDiv) progressDiv.classList.remove('show');
    window.electronAPI.docker.removeProgressListener();
  }
}

/**
 * Stop Docker Desktop
 */
async function stopDocker(): Promise<void> {
  const button = document.getElementById('stop-docker') as HTMLButtonElement;
  const statusDiv = document.getElementById('docker-status');

  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Stopping...';

    const result = await window.electronAPI.docker.stop();

    if (result.success) {
      showNotification(result.message, 'success');
      if (statusDiv) {
        statusDiv.textContent = 'Status: Stopped';
        statusDiv.classList.remove('success', 'error');
      }
      // Update Docker status in prerequisites
      await checkPrerequisites();
    } else {
      showNotification(`Failed to stop Docker: ${result.error || result.message}`, 'error');
    }
  } catch (error) {
    console.error('Error stopping Docker:', error);
    showNotification('Failed to stop Docker', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Stop Docker';
  }
}

/**
 * Restart Docker Desktop
 */
async function restartDocker(): Promise<void> {
  const button = document.getElementById('restart-docker') as HTMLButtonElement;
  const statusDiv = document.getElementById('docker-status');
  const progressDiv = document.getElementById('docker-progress');
  const progressBar = document.getElementById('docker-progress-bar') as HTMLDivElement;
  const progressText = document.getElementById('docker-progress-text');

  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Restarting...';

    if (progressDiv) progressDiv.classList.add('show');
    if (progressText) progressText.textContent = 'Restarting Docker Desktop...';
    if (progressBar) progressBar.style.width = '0%';

    // Listen for progress updates
    window.electronAPI.docker.onProgress((progress) => {
      if (progressText) progressText.textContent = progress.message;
      if (progressBar) progressBar.style.width = `${progress.percent}%`;
    });

    const result = await window.electronAPI.docker.restart();

    if (result.success) {
      showNotification(result.message, 'success');
      if (statusDiv) {
        statusDiv.textContent = 'Status: Running';
        statusDiv.classList.add('success');
        statusDiv.classList.remove('error');
      }
      // Update Docker status in prerequisites
      await checkPrerequisites();
    } else {
      showNotification(`Failed to restart Docker: ${result.error || result.message}`, 'error');
      if (statusDiv) {
        statusDiv.textContent = 'Status: Error';
        statusDiv.classList.add('error');
        statusDiv.classList.remove('success');
      }
    }
  } catch (error) {
    console.error('Error restarting Docker:', error);
    showNotification('Failed to restart Docker', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Restart Docker';
    if (progressDiv) progressDiv.classList.remove('show');
    window.electronAPI.docker.removeProgressListener();
  }
}

/**
 * Check Docker health status
 */
async function checkDockerHealth(): Promise<void> {
  const button = document.getElementById('check-docker-health') as HTMLButtonElement;
  const statusDiv = document.getElementById('docker-status');
  const healthDiv = document.getElementById('docker-health-info');

  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Checking...';

    const health = await window.electronAPI.docker.healthCheck();

    if (healthDiv) {
      if (health.healthy) {
        healthDiv.innerHTML = `<span class="success">✓ ${health.message}</span>`;
      } else if (health.running) {
        healthDiv.innerHTML = `<span class="warning">⚠ ${health.message}</span>`;
      } else {
        healthDiv.innerHTML = `<span class="error">✗ ${health.message}</span>`;
      }
      healthDiv.classList.add('show');
    }

    if (statusDiv) {
      if (health.running && health.healthy) {
        statusDiv.textContent = 'Status: Running & Healthy';
        statusDiv.classList.add('success');
        statusDiv.classList.remove('error');
      } else if (health.running) {
        statusDiv.textContent = 'Status: Running (Unhealthy)';
        statusDiv.classList.remove('success', 'error');
      } else {
        statusDiv.textContent = 'Status: Not Running';
        statusDiv.classList.add('error');
        statusDiv.classList.remove('success');
      }
    }
  } catch (error) {
    console.error('Error checking Docker health:', error);
    showNotification('Failed to check Docker health', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Check Health';
  }
}

export {};
