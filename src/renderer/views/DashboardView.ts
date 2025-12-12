/**
 * DashboardView
 * Wrapper for existing DashboardTab component
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { initializeDashboard } from '../components/DashboardTab.js';

export class DashboardView implements View {
  private container: HTMLElement | null = null;

  /**
   * Mount the dashboard view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Get the existing dashboard HTML from the old tab panel
    // We'll clone it to preserve the structure
    const oldDashboardPanel = document.getElementById('tab-panel-dashboard');
    if (oldDashboardPanel) {
      container.innerHTML = oldDashboardPanel.innerHTML;
    } else {
      // Fallback: create basic dashboard structure
      container.innerHTML = `
        <div id="dashboard-container">
          <div class="dashboard-content">
            <!-- Dashboard content will be initialized by DashboardTab -->
          </div>
        </div>
      `;
    }

    // Initialize the existing dashboard functionality
    try {
      await initializeDashboard();
      console.log('[DashboardView] Dashboard initialized');
    } catch (error) {
      console.error('[DashboardView] Failed to initialize dashboard:', error);
      container.innerHTML = `
        <div class="error-message">
          <h2>Failed to load Dashboard</h2>
          <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  /**
   * Unmount the dashboard view
   */
  async unmount(): Promise<void> {
    // Cleanup if needed
    this.container = null;
  }

  /**
   * Handle action from top bar
   */
  handleAction(actionId: string): void {
    console.log('[DashboardView] Action:', actionId);

    switch (actionId) {
      case 'refresh':
        // Trigger dashboard refresh
        window.dispatchEvent(new CustomEvent('dashboard-refresh'));
        break;
      case 'export':
        // Trigger export functionality
        window.dispatchEvent(new CustomEvent('dashboard-export'));
        break;
      default:
        console.warn('[DashboardView] Unknown action:', actionId);
    }
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Dashboard',
      actions: [
        { id: 'refresh', label: 'Refresh', icon: '🔄' },
        { id: 'export', label: 'Export Report', icon: '📊' },
      ],
      global: {
        projectSelector: true,
        environmentIndicator: true,
      },
    };
  }
}
