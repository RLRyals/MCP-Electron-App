/**
 * WorkflowsView
 * Placeholder for Workflows feature (Phase 4)
 * Will be fully implemented in Phase 4
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';

export class WorkflowsView implements View {
  private container: HTMLElement | null = null;

  /**
   * Mount the workflows view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    container.innerHTML = `
      <div class="workflows-placeholder" style="padding: var(--spacing-xl); text-align: center;">
        <div style="font-size: 4rem; margin-bottom: var(--spacing-lg);">🔧</div>
        <h2 style="color: var(--color-text-primary); margin-bottom: var(--spacing-md);">Workflows</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-lg); max-width: 600px; margin-left: auto; margin-right: auto;">
          Create and manage multi-step workflows that chain plugins together.
          Build automated pipelines for your book series (Plan → Draft → Edit → Market).
        </p>
        <div style="background: var(--color-accent-dim); border: 1px solid var(--color-accent); border-radius: var(--radius-md); padding: var(--spacing-lg); max-width: 600px; margin: 0 auto;">
          <p style="color: var(--color-accent); margin: 0;">
            <strong>Coming in Phase 4</strong><br>
            This feature will be implemented with workflow builder, execution engine, and history tracking.
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
      title: 'Workflows',
      actions: [],
      global: {
        projectSelector: true,
        environmentIndicator: true,
      },
    };
  }
}
