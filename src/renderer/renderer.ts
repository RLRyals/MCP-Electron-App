/**
 * Renderer process script
 * This file runs in the renderer process and has access to the DOM
 * It communicates with the main process via IPC through the preload script
 */

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
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

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
export {};
