/**
 * DashboardView
 * Wrapper for existing DashboardTab component
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { DashboardTab } from '../components/DashboardTab.js';
import { cleanupDashboard, exportDashboardDiagnosticReport, updateSystemStatus } from '../dashboard-handlers.js';

export class DashboardView implements View {
  private container: HTMLElement | null = null;
  private dashboardTab: DashboardTab | null = null;

  /**
   * Mount the dashboard view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Create the dashboard card container that DashboardTab expects
    container.innerHTML = `
      <div id="dashboard-card" style="display: block;">
        <!-- Dashboard content will be initialized by DashboardTab -->
      </div>
    `;

    // Initialize the existing dashboard functionality
    try {
      this.dashboardTab = new DashboardTab();
      this.dashboardTab.initialize();
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
    // Cleanup dashboard tab
    if (this.dashboardTab && typeof (this.dashboardTab as any).destroy === 'function') {
      (this.dashboardTab as any).destroy();
    }
    this.dashboardTab = null;
    this.container = null;

    // Stop dashboard-handlers.ts's status polling / progress listener.
    // Without this, navigating to another view left a 5-second interval
    // (and its IPC progress listener) running forever in the background --
    // cleanupDashboard() already existed for exactly this purpose but was
    // never wired up to a view lifecycle hook.
    try {
      cleanupDashboard();
    } catch (error) {
      console.error('[DashboardView] Failed to clean up dashboard handlers:', error);
    }
  }

  /**
   * Handle action from top bar
   */
  handleAction(actionId: string): void {
    console.log('[DashboardView] Action:', actionId);

    switch (actionId) {
      case 'refresh':
        // Trigger an immediate status refresh (same call the 5s polling
        // loop makes) rather than only firing an event nobody listened for.
        window.dispatchEvent(new CustomEvent('dashboard-refresh'));
        updateSystemStatus().catch((error) => {
          console.error('[DashboardView] Refresh failed:', error);
        });
        break;
      case 'export':
        // Export a diagnostic report via the same IPC call the Setup/Logs
        // views use, rather than only firing an event nobody listened for.
        window.dispatchEvent(new CustomEvent('dashboard-export'));
        exportDashboardDiagnosticReport().catch((error) => {
          console.error('[DashboardView] Export failed:', error);
        });
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
