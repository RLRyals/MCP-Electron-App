/**
 * LogsView
 * Wrapper for existing LogsTab component
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { LogsTab } from '../components/LogsTab.js';

export class LogsView implements View {
  private container: HTMLElement | null = null;
  private logsTab: LogsTab | null = null;

  /**
   * Mount the logs view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Clear any existing content (like loading spinner)
    container.innerHTML = '';

    // Create the logs card container that LogsTab expects
    const logsCard = document.createElement('div');
    logsCard.id = 'logs-card';
    logsCard.style.display = 'block';
    container.appendChild(logsCard);

    // Initialize the existing logs functionality
    try {
      this.logsTab = new LogsTab({ containerId: 'logs-card' });
      await this.logsTab.initialize();
      console.log('[LogsView] Logs tab initialized');
    } catch (error) {
      console.error('[LogsView] Failed to initialize logs:', error);
      container.innerHTML = `
        <div class="error-message">
          <h2>Failed to load Logs</h2>
          <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  /**
   * Unmount the logs view
   */
  async unmount(): Promise<void> {
    // Cleanup logs tab
    if (this.logsTab && typeof (this.logsTab as any).destroy === 'function') {
      (this.logsTab as any).destroy();
    }
    this.logsTab = null;
    this.container = null;
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Logs',
      breadcrumb: ['Settings', 'Logs'],
      actions: [
        { id: 'clear', label: 'Clear Logs', icon: '🗑️', variant: 'danger' },
        { id: 'export', label: 'Export', icon: '📤' },
        { id: 'refresh', label: 'Refresh', icon: '🔄' },
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
    console.log('[LogsView] Action:', actionId);

    switch (actionId) {
      case 'clear':
        window.dispatchEvent(new CustomEvent('logs-clear'));
        break;
      case 'export':
        window.dispatchEvent(new CustomEvent('logs-export'));
        break;
      case 'refresh':
        window.dispatchEvent(new CustomEvent('logs-refresh'));
        break;
      default:
        console.warn('[LogsView] Unknown action:', actionId);
    }
  }
}
