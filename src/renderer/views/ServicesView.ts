/**
 * ServicesView
 * Wrapper for existing ServicesTab component
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { initializeServicesTab } from '../components/ServicesTab.js';

export class ServicesView implements View {
  private container: HTMLElement | null = null;

  /**
   * Mount the services view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Get the existing services HTML from the old tab panel
    const oldServicesPanel = document.getElementById('tab-panel-services');
    if (oldServicesPanel) {
      container.innerHTML = oldServicesPanel.innerHTML;
    } else {
      // Fallback: create basic services structure
      container.innerHTML = `
        <div id="services-container">
          <div class="services-content">
            <!-- Services content will be initialized by ServicesTab -->
          </div>
        </div>
      `;
    }

    // Initialize the existing services functionality
    try {
      await initializeServicesTab();
      console.log('[ServicesView] Services tab initialized');
    } catch (error) {
      console.error('[ServicesView] Failed to initialize services:', error);
      container.innerHTML = `
        <div class="error-message">
          <h2>Failed to load Services</h2>
          <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  /**
   * Unmount the services view
   */
  async unmount(): Promise<void> {
    this.container = null;
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Services',
      breadcrumb: ['Settings', 'Services'],
      actions: [
        { id: 'start-all', label: 'Start All', icon: '▶️', variant: 'primary' },
        { id: 'stop-all', label: 'Stop All', icon: '⏹️', variant: 'danger' },
        { id: 'restart-all', label: 'Restart All', icon: '🔄' },
      ],
      global: {
        projectSelector: false,
        environmentIndicator: true,
      },
    };
  }

  /**
   * Handle action from top bar
   */
  handleAction(actionId: string): void {
    console.log('[ServicesView] Action:', actionId);

    switch (actionId) {
      case 'start-all':
        window.dispatchEvent(new CustomEvent('services-start-all'));
        break;
      case 'stop-all':
        window.dispatchEvent(new CustomEvent('services-stop-all'));
        break;
      case 'restart-all':
        window.dispatchEvent(new CustomEvent('services-restart-all'));
        break;
      default:
        console.warn('[ServicesView] Unknown action:', actionId);
    }
  }
}
