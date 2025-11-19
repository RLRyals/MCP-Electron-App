/**
 * SetupTab Component
 * Consolidates client configuration, installation, and system prerequisite management
 *
 * Features:
 * - Prerequisites checking (Docker, Git, WSL)
 * - Client selection and configuration
 * - Environment configuration
 * - Update tools for MCP-Writing-Servers, Typing Mind, and FictionLab
 */

interface PrerequisiteStatus {
  installed: boolean;
  running?: boolean;
  version?: string;
  error?: string;
}

interface AllPrerequisitesResult {
  docker: PrerequisiteStatus;
  git: PrerequisiteStatus;
  wsl?: PrerequisiteStatus;
  platform: string;
}

interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  message: string;
}

interface GitPullResult {
  success: boolean;
  message: string;
  error?: string;
  changes?: string;
}

/**
 * Initialize the Setup Tab
 */
export async function initializeSetupTab(): Promise<void> {
  console.log('Initializing Setup Tab...');

  try {
    // Setup event listeners
    setupSetupTabListeners();

    // Load initial data
    await loadSetupTabData();

    // Auto-check prerequisites
    await checkPrerequisites();
  } catch (error) {
    console.error('Failed to initialize Setup Tab:', error);
    showNotification(`Setup Tab initialization failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

/**
 * Setup all Setup Tab event listeners
 */
function setupSetupTabListeners(): void {
  // Prerequisites Check button
  const checkPrereqBtn = document.getElementById('check-prerequisites');
  if (checkPrereqBtn) {
    checkPrereqBtn.addEventListener('click', checkPrerequisites);
  }

  // Update Tools buttons
  const updateMCPBtn = document.getElementById('update-mcp-servers');
  if (updateMCPBtn) {
    updateMCPBtn.addEventListener('click', handleUpdateMCPServers);
  }

  const updateTypingMindBtn = document.getElementById('update-typing-mind');
  if (updateTypingMindBtn) {
    updateTypingMindBtn.addEventListener('click', handleUpdateTypingMind);
  }

  const checkUpdatesBtn = document.getElementById('check-fictionlab-updates');
  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', handleCheckFictionLabUpdates);
  }

  console.log('Setup Tab event listeners attached');
}

/**
 * Load initial Setup Tab data
 */
async function loadSetupTabData(): Promise<void> {
  try {
    // Load current FictionLab version
    const version = await window.electronAPI.getAppVersion();
    const versionElement = document.getElementById('fictionlab-current-version');
    if (versionElement) {
      versionElement.textContent = `Current Version: ${version}`;
    }
  } catch (error) {
    console.error('Error loading Setup Tab data:', error);
  }
}

/**
 * Check all prerequisites
 */
export async function checkPrerequisites(): Promise<void> {
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
 * Handle Update MCP-Writing-Servers action
 */
async function handleUpdateMCPServers(): Promise<void> {
  const button = document.getElementById('update-mcp-servers') as HTMLButtonElement;
  const statusDiv = document.getElementById('mcp-update-status');

  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Updating...';

    if (statusDiv) {
      statusDiv.textContent = 'Checking for updates...';
      statusDiv.style.display = 'block';
      statusDiv.style.color = '#FFB84D';
    }

    showNotification('Checking for MCP-Writing-Servers updates...', 'info');

    // Check for updates using the updater API
    const updateCheck = await window.electronAPI.updater.checkMCPServers();

    if (!updateCheck.available) {
      showNotification('MCP-Writing-Servers is already up to date', 'info');
      if (statusDiv) {
        statusDiv.textContent = `Already up to date (${updateCheck.currentVersion || 'latest'})`;
        statusDiv.style.color = '#00D4AA';
      }
      return;
    }

    // Perform the update
    const result = await window.electronAPI.updater.updateMCPServers();

    if (result.success) {
      showNotification('MCP-Writing-Servers updated successfully!', 'success');
      if (statusDiv) {
        statusDiv.textContent = `Updated: ${result.message}`;
        statusDiv.style.color = '#00D4AA';
      }
    } else {
      showNotification(`Update failed: ${result.error || result.message}`, 'error');
      if (statusDiv) {
        statusDiv.textContent = `Error: ${result.error || result.message}`;
        statusDiv.style.color = '#f44336';
      }
    }

  } catch (error) {
    console.error('Error updating MCP-Writing-Servers:', error);
    showNotification('Failed to update MCP-Writing-Servers', 'error');
    if (statusDiv) {
      statusDiv.textContent = `Update failed: ${error instanceof Error ? error.message : String(error)}`;
      statusDiv.style.color = '#f44336';
    }
  } finally {
    button.disabled = false;
    button.textContent = 'Update MCP-Writing-Servers';
  }
}

/**
 * Handle Update Typing Mind action
 */
async function handleUpdateTypingMind(): Promise<void> {
  const button = document.getElementById('update-typing-mind') as HTMLButtonElement;
  const statusDiv = document.getElementById('typing-mind-update-status');

  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Checking...';

    if (statusDiv) {
      statusDiv.textContent = 'Checking for updates...';
      statusDiv.style.display = 'block';
      statusDiv.style.color = '#FFB84D';
    }

    showNotification('Checking for Typing Mind updates...', 'info');

    // Check for updates using the updater API
    const updateCheck = await window.electronAPI.updater.checkTypingMind();

    if (!updateCheck.available) {
      showNotification('Typing Mind is already up to date', 'info');
      if (statusDiv) {
        statusDiv.textContent = `Already up to date (${updateCheck.currentVersion || 'latest'})`;
        statusDiv.style.color = '#00D4AA';
      }
      return;
    }

    // Show update available message
    if (statusDiv) {
      statusDiv.textContent = `Update available: ${updateCheck.latestVersion || 'newer version'}`;
      statusDiv.style.color = '#FFB84D';
    }

    // Ask user if they want to update
    if (confirm(`A new version of Typing Mind is available${updateCheck.latestVersion ? `: ${updateCheck.latestVersion}` : ''}\n\nWould you like to update now?`)) {
      button.textContent = 'Updating...';
      showNotification('Updating Typing Mind...', 'info');

      const result = await window.electronAPI.updater.updateTypingMind();

      if (result.success) {
        showNotification('Typing Mind updated successfully!', 'success');
        if (statusDiv) {
          statusDiv.textContent = `Updated: ${result.message}`;
          statusDiv.style.color = '#00D4AA';
        }
      } else {
        showNotification(`Update failed: ${result.error || result.message}`, 'error');
        if (statusDiv) {
          statusDiv.textContent = `Update failed: ${result.error || result.message}`;
          statusDiv.style.color = '#f44336';
        }
      }
    }

  } catch (error) {
    console.error('Error checking Typing Mind updates:', error);
    showNotification('Failed to check for updates', 'error');
    if (statusDiv) {
      statusDiv.textContent = `Failed to check for updates: ${error instanceof Error ? error.message : String(error)}`;
      statusDiv.style.color = '#f44336';
    }
  } finally {
    button.disabled = false;
    button.textContent = 'Check for Updates';
  }
}

/**
 * Handle Check FictionLab Updates action
 */
async function handleCheckFictionLabUpdates(): Promise<void> {
  const button = document.getElementById('check-fictionlab-updates') as HTMLButtonElement;
  const statusDiv = document.getElementById('fictionlab-update-status');

  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Checking...';

    if (statusDiv) {
      statusDiv.textContent = 'Checking for updates...';
      statusDiv.style.display = 'block';
      statusDiv.style.color = '#FFB84D';
    }

    // Check if update API is available
    if (!(window.electronAPI as any).updates?.checkForUpdates) {
      const version = await window.electronAPI.getAppVersion();
      showNotification('Automatic update checking not yet implemented', 'info');
      if (statusDiv) {
        statusDiv.textContent = `Current version: ${version} - Check GitHub for latest releases`;
        statusDiv.style.color = '#FFB84D';
      }
      return;
    }

    showNotification('Checking for FictionLab updates...', 'info');

    // Check for FictionLab updates
    const result = await (window.electronAPI as any).updates.checkForUpdates();

    if (result.hasUpdate) {
      if (statusDiv) {
        statusDiv.textContent = `Update available: ${result.latestVersion}`;
        statusDiv.style.color = '#FFB84D';
      }

      // Show update dialog
      showUpdateDialog(result);
    } else {
      showNotification('FictionLab is up to date!', 'success');
      if (statusDiv) {
        statusDiv.textContent = `Up to date (${result.currentVersion})`;
        statusDiv.style.color = '#00D4AA';
      }
    }

  } catch (error) {
    console.error('Error checking FictionLab updates:', error);
    showNotification('Failed to check for updates', 'error');
    if (statusDiv) {
      statusDiv.textContent = 'Failed to check for updates';
      statusDiv.style.color = '#f44336';
    }
  } finally {
    button.disabled = false;
    button.textContent = 'Check for Updates';
  }
}

/**
 * Show update dialog for FictionLab
 */
function showUpdateDialog(updateInfo: UpdateCheckResult): void {
  const dialog = document.createElement('div');
  dialog.className = 'error-dialog'; // Reuse error dialog styles
  dialog.innerHTML = `
    <div class="error-dialog-backdrop"></div>
    <div class="error-dialog-content">
      <h3>Update Available</h3>
      <p>A new version of FictionLab is available!</p>
      <p><strong>Current Version:</strong> ${updateInfo.currentVersion}</p>
      <p><strong>Latest Version:</strong> ${updateInfo.latestVersion}</p>
      <p>${updateInfo.message}</p>
      <div class="error-dialog-buttons">
        <button id="download-update" class="button primary">Download Update</button>
        <button id="close-update-dialog" class="button">Later</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Add event listeners
  const downloadButton = document.getElementById('download-update');
  const closeButton = document.getElementById('close-update-dialog');

  if (downloadButton) {
    downloadButton.addEventListener('click', () => {
      // Note: Electron app self-updates are not yet implemented
      // Users should download updates manually from the releases page
      showNotification('Please download the latest version from the releases page', 'info');
      document.body.removeChild(dialog);
    });
  }

  if (closeButton) {
    closeButton.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  }
}

/**
 * Show a notification message
 */
function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  // Use the global notification function if available
  if ((window as any).showNotification) {
    (window as any).showNotification(message, type);
    return;
  }

  // Fallback notification implementation
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
