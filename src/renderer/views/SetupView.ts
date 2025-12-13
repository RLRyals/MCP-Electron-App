/**
 * SetupView
 * Wrapper for existing SetupTab component
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { initializeSetupTab } from '../components/SetupTab.js';
import { loadEnvConfig, setupEnvConfigListeners } from '../env-config-handlers.js';
import { loadClientOptions, setupClientSelectionListeners } from '../client-selection-handlers.js';

export class SetupView implements View {
  private container: HTMLElement | null = null;

  /**
   * Mount the setup view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Get the existing setup HTML from the old tab panel
    const oldSetupPanel = document.getElementById('tab-panel-setup');
    if (oldSetupPanel) {
      container.innerHTML = oldSetupPanel.innerHTML;
    } else {
      // Fallback: create basic setup structure
      container.innerHTML = `
        <div id="setup-container">
          <div class="setup-content">
            <!-- Setup content will be initialized by SetupTab -->
          </div>
        </div>
      `;
    }

    // Initialize the existing setup functionality
    try {
      await initializeSetupTab();
      console.log('[SetupView] Setup tab initialized');

      // Re-setup event listeners for forms that were just copied into the view
      setupEnvConfigListeners();
      loadEnvConfig();

      setupClientSelectionListeners();
      loadClientOptions();

      console.log('[SetupView] Form event listeners attached');
    } catch (error) {
      console.error('[SetupView] Failed to initialize setup:', error);
      container.innerHTML = `
        <div class="error-message">
          <h2>Failed to load Setup</h2>
          <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  /**
   * Unmount the setup view
   */
  async unmount(): Promise<void> {
    this.container = null;
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Setup',
      breadcrumb: ['Settings', 'Setup'],
      actions: [],
      global: {
        projectSelector: false,
        environmentIndicator: true,
      },
    };
  }
}
