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
