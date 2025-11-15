/**
 * Client Selection Handlers
 * Manages client selection UI and interactions
 */

// Type definitions for the API exposed by preload script
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

// Track selected clients
let selectedClients: Set<string> = new Set();

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
 * Create client card HTML
 */
function createClientCard(client: ClientMetadata, isSelected: boolean): string {
  const checkboxId = `client-checkbox-${client.id}`;

  return `
    <div class="client-card ${isSelected ? 'selected' : ''}" data-client-id="${client.id}">
      <div class="client-card-header">
        <div class="client-checkbox-wrapper">
          <input
            type="checkbox"
            id="${checkboxId}"
            class="client-checkbox"
            data-client-id="${client.id}"
            ${isSelected ? 'checked' : ''}
          >
          <label for="${checkboxId}">
            <h3>${client.name}</h3>
            <span class="client-type">${client.type === 'web-based' ? 'Web-Based' : 'Native App'}</span>
          </label>
        </div>
      </div>

      <div class="client-card-body">
        <p class="client-description">${client.description}</p>

        <div class="client-info-section">
          <h4>Features</h4>
          <ul class="client-features">
            ${client.features.map(feature => `<li>${feature}</li>`).join('')}
          </ul>
        </div>

        <div class="client-info-section">
          <h4>Requirements</h4>
          <ul class="client-requirements">
            ${client.requirements.map(req => `<li>${req}</li>`).join('')}
          </ul>
        </div>

        <div class="client-meta">
          <div class="client-meta-item">
            <strong>Download Size:</strong> ${client.downloadSize}
          </div>
          <div class="client-meta-item">
            <strong>Installation:</strong> ${client.installation === 'automatic' ? 'Automatic' : 'Manual'}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Load and display available clients
 */
export async function loadClientOptions(): Promise<void> {
  const container = document.getElementById('client-cards-container');
  const loadingDiv = document.getElementById('client-selection-loading');

  if (!container) return;

  try {
    // Show loading state
    if (loadingDiv) loadingDiv.style.display = 'block';

    // Get available clients
    const clients = await window.electronAPI.clientSelection.getOptions();

    // Get current selection
    const currentSelection = await window.electronAPI.clientSelection.getSelection();
    const selectedClientIds = currentSelection?.clients || [];
    selectedClients = new Set(selectedClientIds);

    // Render client cards
    container.innerHTML = clients.map(client =>
      createClientCard(client, selectedClientIds.includes(client.id))
    ).join('');

    // Set up event listeners for checkboxes
    const checkboxes = container.querySelectorAll('.client-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', handleClientToggle);
    });

    // Update button states
    updateButtonStates();

    // Hide loading state
    if (loadingDiv) loadingDiv.style.display = 'none';

    console.log('Client options loaded successfully');
  } catch (error) {
    console.error('Error loading client options:', error);
    if (container) {
      container.innerHTML = '<p class="error-message">Failed to load client options</p>';
    }
    if (loadingDiv) loadingDiv.style.display = 'none';
  }
}

/**
 * Handle client toggle (checkbox change)
 */
function handleClientToggle(event: Event): void {
  const checkbox = event.target as HTMLInputElement;
  const clientId = checkbox.dataset.clientId;

  if (!clientId) return;

  if (checkbox.checked) {
    selectedClients.add(clientId);
  } else {
    selectedClients.delete(clientId);
  }

  // Update card visual state
  const card = checkbox.closest('.client-card');
  if (card) {
    if (checkbox.checked) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  }

  updateButtonStates();
  console.log('Selected clients:', Array.from(selectedClients));
}

/**
 * Update button states based on selection
 */
function updateButtonStates(): void {
  const saveButton = document.getElementById('save-client-selection') as HTMLButtonElement;
  const clearButton = document.getElementById('clear-client-selection') as HTMLButtonElement;

  const hasSelection = selectedClients.size > 0;

  if (saveButton) {
    saveButton.disabled = !hasSelection;
  }

  if (clearButton) {
    clearButton.disabled = !hasSelection;
  }

  // Update selection summary
  const summaryDiv = document.getElementById('selection-summary');
  if (summaryDiv) {
    if (hasSelection) {
      const count = selectedClients.size;
      const clientText = count === 1 ? 'client' : 'clients';
      summaryDiv.textContent = `${count} ${clientText} selected`;
      summaryDiv.classList.add('show');
    } else {
      summaryDiv.classList.remove('show');
    }
  }
}

/**
 * Save client selection
 */
export async function saveClientSelection(): Promise<void> {
  const saveButton = document.getElementById('save-client-selection') as HTMLButtonElement;
  const statusDiv = document.getElementById('client-selection-status');

  if (!saveButton) return;

  if (selectedClients.size === 0) {
    showNotification('Please select at least one client', 'error');
    return;
  }

  try {
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    if (statusDiv) {
      statusDiv.textContent = 'Saving selection...';
      statusDiv.className = 'config-status show';
    }

    const clientsArray = Array.from(selectedClients);
    const result = await window.electronAPI.clientSelection.saveSelection(clientsArray);

    if (result.success) {
      showNotification('Client selection saved successfully!', 'success');
      if (statusDiv) {
        statusDiv.textContent = `Saved: ${clientsArray.join(', ')}`;
        statusDiv.className = 'config-status show success';
      }
      console.log('Client selection saved:', clientsArray);
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error saving client selection:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    showNotification(`Failed to save selection: ${errorMsg}`, 'error');
    if (statusDiv) {
      statusDiv.textContent = `Error: ${errorMsg}`;
      statusDiv.className = 'config-status show error';
    }
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Selection';
  }
}

/**
 * Clear client selection
 */
export async function clearClientSelection(): Promise<void> {
  const statusDiv = document.getElementById('client-selection-status');

  try {
    const result = await window.electronAPI.clientSelection.clearSelection();

    if (result.success) {
      // Uncheck all checkboxes
      const checkboxes = document.querySelectorAll('.client-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        const card = checkbox.closest('.client-card');
        if (card) {
          card.classList.remove('selected');
        }
      });

      selectedClients.clear();
      updateButtonStates();

      showNotification('Client selection cleared', 'success');
      if (statusDiv) {
        statusDiv.textContent = 'Selection cleared';
        statusDiv.className = 'config-status show success';
      }

      console.log('Client selection cleared');
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error clearing client selection:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    showNotification(`Failed to clear selection: ${errorMsg}`, 'error');
    if (statusDiv) {
      statusDiv.textContent = `Error: ${errorMsg}`;
      statusDiv.className = 'config-status show error';
    }
  }
}

/**
 * Skip client selection (configure later)
 */
export async function skipClientSelection(): Promise<void> {
  showNotification('You can configure clients later from the application menu', 'info');
  console.log('Client selection skipped');

  // Optionally, you could hide the client selection section or navigate to another view
  const selectionCard = document.getElementById('client-selection-card');
  if (selectionCard) {
    selectionCard.style.opacity = '0.5';
  }
}

/**
 * Setup client selection event listeners
 */
export function setupClientSelectionListeners(): void {
  // Save button
  const saveButton = document.getElementById('save-client-selection');
  if (saveButton) {
    saveButton.addEventListener('click', saveClientSelection);
  }

  // Clear button
  const clearButton = document.getElementById('clear-client-selection');
  if (clearButton) {
    clearButton.addEventListener('click', clearClientSelection);
  }

  // Skip button
  const skipButton = document.getElementById('skip-client-selection');
  if (skipButton) {
    skipButton.addEventListener('click', skipClientSelection);
  }

  console.log('Client selection listeners set up');
}

// ===========================
// Claude Desktop Handlers
// ===========================

/**
 * Update Claude Desktop status
 */
async function updateClaudeDesktopStatus(): Promise<void> {
  try {
    const isConfigured = await window.electronAPI.claudeDesktop.isConfigured();
    const statusText = document.getElementById('claude-desktop-status-text');
    const resetBtn = document.getElementById('claude-desktop-reset-btn');
    const previewSection = document.getElementById('claude-desktop-config-preview');

    if (statusText) {
      if (isConfigured) {
        statusText.textContent = '✓ Configured';
        statusText.style.color = '#4caf50';
        if (resetBtn) resetBtn.style.display = 'inline-block';

        // Show config preview
        try {
          const config = await window.electronAPI.claudeDesktop.getConfig();
          const configContent = document.getElementById('claude-desktop-config-content');
          if (config && configContent) {
            configContent.textContent = JSON.stringify(config, null, 2);
            if (previewSection) previewSection.style.display = 'block';
          }
        } catch (error) {
          console.error('Error loading config preview:', error);
        }
      } else {
        statusText.textContent = 'Not Configured';
        statusText.style.color = '#ff9800';
        if (resetBtn) resetBtn.style.display = 'none';
        if (previewSection) previewSection.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error updating Claude Desktop status:', error);
  }
}

/**
 * Auto-configure Claude Desktop
 */
async function autoConfigureClaudeDesktop(): Promise<void> {
  const button = document.getElementById('claude-desktop-auto-config-btn') as HTMLButtonElement;
  if (!button) return;

  try {
    button.disabled = true;
    button.textContent = 'Configuring...';

    showNotification('Configuring Claude Desktop...', 'info');

    const result = await window.electronAPI.claudeDesktop.autoConfigure();

    if (result.success) {
      showNotification('Claude Desktop configured successfully!', 'success');
      await updateClaudeDesktopStatus();
    } else {
      showNotification(`Configuration failed: ${result.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('Error auto-configuring Claude Desktop:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    showNotification(`Error: ${errorMsg}`, 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Auto-Configure Claude Desktop';
    }
  }
}

/**
 * Open Claude Desktop config folder
 */
async function openClaudeDesktopConfigFolder(): Promise<void> {
  try {
    await window.electronAPI.claudeDesktop.openConfigFolder();
    showNotification('Opening config folder...', 'info');
  } catch (error) {
    console.error('Error opening config folder:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    showNotification(`Error: ${errorMsg}`, 'error');
  }
}

/**
 * Reset Claude Desktop configuration
 */
async function resetClaudeDesktopConfig(): Promise<void> {
  if (!confirm('Are you sure you want to reset Claude Desktop configuration? This will remove all MCP server settings.')) {
    return;
  }

  try {
    showNotification('Resetting configuration...', 'info');

    const result = await window.electronAPI.claudeDesktop.resetConfig();

    if (result.success) {
      showNotification('Configuration reset successfully', 'success');
      await updateClaudeDesktopStatus();
    } else {
      showNotification(`Reset failed: ${result.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('Error resetting Claude Desktop config:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    showNotification(`Error: ${errorMsg}`, 'error');
  }
}

/**
 * Open Claude Desktop download link
 */
function openClaudeDesktopDownloadLink(event: Event): void {
  event.preventDefault();
  // Open external link (assuming we have shell API exposed)
  const url = 'https://claude.ai/download';
  console.log('Opening Claude Desktop download page:', url);
  showNotification('Opening Claude Desktop download page...', 'info');
  // If shell.openExternal is available through the API, use it
  // Otherwise, the link will open in the default browser
  window.open(url, '_blank');
}

/**
 * Setup Claude Desktop event listeners
 */
export function setupClaudeDesktopListeners(): void {
  // Auto-configure button
  const autoConfigBtn = document.getElementById('claude-desktop-auto-config-btn');
  if (autoConfigBtn) {
    autoConfigBtn.addEventListener('click', autoConfigureClaudeDesktop);
  }

  // Open folder button
  const openFolderBtn = document.getElementById('claude-desktop-open-folder-btn');
  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', openClaudeDesktopConfigFolder);
  }

  // Reset button
  const resetBtn = document.getElementById('claude-desktop-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetClaudeDesktopConfig);
  }

  // Download link
  const downloadLink = document.getElementById('claude-desktop-download-link');
  if (downloadLink) {
    downloadLink.addEventListener('click', openClaudeDesktopDownloadLink);
  }

  // Initialize status
  updateClaudeDesktopStatus();

  console.log('Claude Desktop listeners set up');
}
