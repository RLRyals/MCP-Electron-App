/**
 * Dashboard Handlers
 *
 * Issue #214 (Dashboard cockpit) replaced the old infra-control-panel
 * Dashboard (status bar, quick actions grid, database management,
 * hardcoded service cards, an unfed Recent Activity list) with
 * DashboardViewReact.tsx's Running/Next/Blocked panels + SystemStrip.
 * DashboardApp/SystemStrip own their own polling and IPC calls directly
 * against window.electronAPI.mcpSystem -- this file no longer polls or
 * touches any dashboard-* DOM element.
 *
 * What's left here are the setup-time dialogs SystemStrip's "⚙ Setup
 * actions" overflow menu still wires up (design supplement item 2):
 * Configure Claude Desktop, Open/Configure Typing Mind. They were kept
 * because they're self-contained (they build their own dialog markup with
 * document.createElement rather than looking up ids from the deleted
 * dashboard markup), unlike the old Start/Stop/Restart System handlers and
 * status-polling functions, which *were* coupled to that markup and were
 * deleted along with it -- SystemStrip.tsx re-implements those directly
 * against the same mcpSystem IPC instead.
 *
 * Deleted in #214 (DOM-coupled to the removed dashboard-card markup, or
 * superseded by another view):
 *  - initializeDashboard / setupDashboardHandlers / window.setupDashboardHandlers
 *  - updateDashboardButtons / setupDashboardListeners
 *  - startStatusPolling / stopStatusPolling / cleanupDashboard (the 5s poll)
 *  - checkAndAutoStartSystem / updateSystemStatus / updateStatusIndicator
 *  - updateServiceCards / updatePostgreSQLCard / updateMCPServersCard /
 *    updateMCPConnectorCard / updateTypingMindCard / showErrorStatus /
 *    updateLastUpdatedTime
 *  - handleStartSystem / handleStopSystem / handleRestartSystem /
 *    setQuickActionsEnabled (DOM-button-coupled; SystemStrip.tsx
 *    re-implements against the same mcpSystem.start/stop/restart IPC)
 *  - handleViewLogs / handleCopyToken / showLogsDialog (per-service cards
 *    are gone; per-service log viewing already lives in the Services view)
 *  - handleBackupDatabase / handleRestoreDatabase / handleManageBackups /
 *    handleOpenBackupFolder / showBackupsDialog (Database Management
 *    already lives in the Database view since #128/#130)
 */

interface ServiceUrls {
  typingMind?: string;
  mcpConnector?: string;
  postgres?: string;
}

/**
 * Show a notification message. Builds its own toast element (no dependency
 * on the removed dashboard markup), so it's reused as-is by SystemStrip.tsx
 * for Start/Stop/Restart System feedback.
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
 * Handle Open Browser action
 * Opens Typing Mind in a dedicated Electron window with context menu support
 */
async function handleOpenBrowser(url: string): Promise<void> {
  try {
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
 * Handle Open Typing Mind action
 */
export async function handleOpenTypingMind(): Promise<void> {
  try {
    const urls: ServiceUrls = await window.electronAPI.mcpSystem.getUrls();

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
export async function handleConfigureTypingMind(): Promise<void> {
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
export async function handleConfigureClaudeDesktop(): Promise<void> {
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
          <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 15px; color: #e0e0e0;">Configuration Values (Click to Copy):</div>

          <!-- Server URL -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #e0e0e0;">Server URL:</label>
            <div style="display: flex; gap: 10px;">
              <input type="text" readonly value="${escapeHtml(config.serverUrl)}"
                     style="flex: 1; padding: 8px; border: 1px solid #444; border-radius: 4px; font-family: monospace; background: #2a2a2a; color: #e0e0e0;">
              <button class="copy-btn" data-copy="${escapeHtml(config.serverUrl)}"
                      style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Copy
              </button>
            </div>
          </div>

          <!-- Auth Token -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #e0e0e0;">Auth Token:</label>
            <div style="display: flex; gap: 10px;">
              <input type="text" readonly value="${escapeHtml(config.authToken)}"
                     style="flex: 1; padding: 8px; border: 1px solid #444; border-radius: 4px; font-family: monospace; background: #2a2a2a; color: #e0e0e0;">
              <button class="copy-btn" data-copy="${escapeHtml(config.authToken)}"
                      style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Copy
              </button>
            </div>
          </div>

          <!-- MCP Servers JSON -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #e0e0e0;">
              MCP Servers JSON (${serverCount} servers):
            </label>
            <div style="display: flex; gap: 10px;">
              <textarea readonly
                        style="flex: 1; padding: 8px; border: 1px solid #444; border-radius: 4px; font-family: monospace; background: #2a2a2a; color: #e0e0e0; resize: vertical; min-height: 120px; font-size: 0.85em;"
              >${escapeHtml(mcpServersJSON)}</textarea>
              <button class="copy-btn" data-copy-json='${escapeHtml(mcpServersJSON)}'
                      style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer; align-self: flex-start;">
                Copy
              </button>
            </div>
            <div style="font-size: 0.85em; color: #b0b0b0; margin-top: 5px;">
              Servers: ${serverNames.join(', ')}
            </div>
          </div>
        </div>

        <div style="margin-top: 20px; padding: 15px; background: rgba(2, 132, 199, 0.15); border-left: 3px solid #0284c7; border-radius: 4px;">
          <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 10px; color: #e0e0e0;">Next Steps:</div>
          <ol style="line-height: 1.8; margin-bottom: 0; color: #d0d0d0;">
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
 * Export a diagnostic report for the Dashboard's top-bar "Export Report"
 * action. Reuses the same `logger.exportDiagnosticReport` IPC call the
 * Setup/Logs views use.
 */
export async function exportDashboardDiagnosticReport(): Promise<void> {
  try {
    const result = await window.electronAPI.logger.exportDiagnosticReport();

    if (result.success) {
      showNotification(`Diagnostic report exported to: ${result.path}`, 'success');
    } else {
      showNotification(`Failed to export report: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error exporting diagnostic report:', error);
    showNotification('Failed to export diagnostic report', 'error');
  }
}
