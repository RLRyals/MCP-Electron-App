/**
 * DatabaseView
 * Wrapper for existing DatabaseTab component
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { DatabaseTab } from '../components/DatabaseTab.js';

export class DatabaseView implements View {
  private container: HTMLElement | null = null;
  private databaseTab: DatabaseTab | null = null;

  /**
   * Mount the database view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Create the database card container that DatabaseTab expects
    container.innerHTML = `
      <div id="database-card" style="display: block;">
        <!-- Database content will be initialized by DatabaseTab -->
      </div>
    `;

    // Initialize the existing database functionality
    try {
      this.databaseTab = new DatabaseTab();
      await this.databaseTab.initialize();
      console.log('[DatabaseView] Database tab initialized');
    } catch (error) {
      console.error('[DatabaseView] Failed to initialize database:', error);
      container.innerHTML = `
        <div class="error-message">
          <h2>Failed to load Database</h2>
          <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  /**
   * Unmount the database view
   */
  async unmount(): Promise<void> {
    // Cleanup database tab
    if (this.databaseTab && typeof (this.databaseTab as any).destroy === 'function') {
      (this.databaseTab as any).destroy();
    }
    this.databaseTab = null;
    this.container = null;
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Database',
      breadcrumb: ['Settings', 'Database'],
      actions: [
        { id: 'backup', label: 'Backup', icon: '💾' },
        { id: 'restore', label: 'Restore', icon: '📥' },
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
    console.log('[DatabaseView] Action:', actionId);

    switch (actionId) {
      case 'backup':
        window.dispatchEvent(new CustomEvent('database-backup'));
        break;
      case 'restore':
        window.dispatchEvent(new CustomEvent('database-restore'));
        break;
      default:
        console.warn('[DatabaseView] Unknown action:', actionId);
    }
  }
}
