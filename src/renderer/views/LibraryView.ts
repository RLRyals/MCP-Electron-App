/**
 * LibraryView
 * Placeholder for Library feature (Phase 5)
 * Will be fully implemented in Phase 5
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';

export class LibraryView implements View {
  private container: HTMLElement | null = null;

  /**
   * Mount the library view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    container.innerHTML = `
      <div class="library-placeholder" style="padding: var(--spacing-xl); text-align: center;">
        <div style="font-size: 4rem; margin-bottom: var(--spacing-lg);">📚</div>
        <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-md);">Library</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-lg); max-width: 600px; margin-left: auto; margin-right: auto;">
          Browse and manage your content: series, books, outlines, drafts, campaigns, and marketing assets.
          A user-friendly view of everything in your database.
        </p>
        <div style="background: var(--color-accent-dim); border: 1px solid var(--color-accent); border-radius: var(--radius-md); padding: var(--spacing-lg); max-width: 600px; margin: 0 auto;">
          <p style="color: var(--color-accent); margin: 0;">
            <strong>Coming in Phase 5</strong><br>
            This feature will be implemented with content browser, filters, detail panels, and context menus for plugin integration.
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Unmount the view
   */
  async unmount(): Promise<void> {
    this.container = null;
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Library',
      actions: [
        { id: 'add-item', label: 'Add Item', icon: '➕', variant: 'primary' },
        { id: 'export', label: 'Export', icon: '📤' },
      ],
      global: {
        projectSelector: true,
        environmentIndicator: true,
      },
    };
  }
}
