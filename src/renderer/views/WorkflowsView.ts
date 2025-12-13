/**
 * WorkflowsView
 * Manage and execute multi-step workflows
 *
 * Features:
 * - List of saved workflows
 * - Create/edit/delete workflows
 * - Execute workflows
 * - View execution history
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: string;
  steps: any[];
  target_type?: string;
  run_count: number;
  success_count: number;
  failure_count: number;
  last_run_at?: string;
  last_run_status?: string;
}

export class WorkflowsView implements View {
  private container: HTMLElement | null = null;
  private workflows: Workflow[] = [];
  private selectedWorkflow: Workflow | null = null;

  /**
   * Mount the workflows view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Load workflows from database
    await this.loadWorkflows();

    // Render the view
    this.render();

    // Attach event listeners
    this.attachEventListeners();

    console.log('[WorkflowsView] Mounted with', this.workflows.length, 'workflows');
  }

  /**
   * Load workflows from database
   */
  private async loadWorkflows(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && electronAPI.workflows && electronAPI.workflows.list) {
        this.workflows = await electronAPI.workflows.list();
      } else {
        console.warn('[WorkflowsView] Workflow API not available');
        this.workflows = [];
      }
    } catch (error) {
      console.error('[WorkflowsView] Failed to load workflows:', error);
      this.workflows = [];
    }
  }

  /**
   * Render the workflows view
   */
  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="workflows-view">
        <div class="workflows-header">
          <div class="workflows-stats">
            <div class="stat-card">
              <span class="stat-value">${this.workflows.length}</span>
              <span class="stat-label">Total Workflows</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${this.workflows.filter(w => w.status === 'active').length}</span>
              <span class="stat-label">Active</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${this.workflows.reduce((sum, w) => sum + w.run_count, 0)}</span>
              <span class="stat-label">Total Runs</span>
            </div>
          </div>
        </div>

        <div class="workflows-content">
          ${this.workflows.length > 0
            ? this.renderWorkflowsList()
            : this.renderEmptyState()}
        </div>
      </div>
    `;
  }

  /**
   * Render workflows list
   */
  private renderWorkflowsList(): string {
    return `
      <div class="workflows-list">
        ${this.workflows.map(workflow => this.renderWorkflowCard(workflow)).join('')}
      </div>
    `;
  }

  /**
   * Render a single workflow card
   */
  private renderWorkflowCard(workflow: Workflow): string {
    const statusClass = workflow.status === 'active' ? 'active' : workflow.status === 'draft' ? 'draft' : 'archived';
    const lastRunIcon = workflow.last_run_status === 'success' ? '✓' : workflow.last_run_status === 'failed' ? '✗' : '—';
    const successRate = workflow.run_count > 0
      ? Math.round((workflow.success_count / workflow.run_count) * 100)
      : 0;

    return `
      <div class="workflow-card" data-workflow-id="${workflow.id}">
        <div class="workflow-header">
          <div class="workflow-info">
            <h3 class="workflow-name">${this.escapeHtml(workflow.name)}</h3>
            <p class="workflow-description">${this.escapeHtml(workflow.description || 'No description')}</p>
          </div>
          <span class="workflow-status ${statusClass}">${workflow.status}</span>
        </div>

        <div class="workflow-details">
          <div class="workflow-meta">
            <span class="meta-item">
              <span class="meta-icon">📋</span>
              <span>${workflow.steps.length} steps</span>
            </span>
            <span class="meta-item">
              <span class="meta-icon">🎯</span>
              <span>${workflow.target_type || 'global'}</span>
            </span>
            <span class="meta-item">
              <span class="meta-icon">${lastRunIcon}</span>
              <span>${successRate}% success</span>
            </span>
          </div>

          <div class="workflow-stats-mini">
            <span>${workflow.run_count} runs</span>
            ${workflow.last_run_at
              ? `<span>Last run: ${new Date(workflow.last_run_at).toLocaleDateString()}</span>`
              : '<span>Never run</span>'}
          </div>
        </div>

        <div class="workflow-actions">
          ${workflow.status === 'active'
            ? `<button class="workflow-action-btn primary" data-action="run">
                 <span class="btn-icon">▶</span>
                 <span>Run Workflow</span>
               </button>`
            : ''}
          <button class="workflow-action-btn" data-action="edit">
            <span class="btn-icon">✏️</span>
            <span>Edit</span>
          </button>
          <button class="workflow-action-btn" data-action="history">
            <span class="btn-icon">📊</span>
            <span>History</span>
          </button>
          <button class="workflow-action-btn danger" data-action="delete">
            <span class="btn-icon">🗑️</span>
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): string {
    return `
      <div class="workflows-empty">
        <div class="empty-icon">🔧</div>
        <h3>No Workflows Yet</h3>
        <p>Create your first workflow to automate multi-step tasks like series planning, drafting, and marketing.</p>
        <button class="create-workflow-btn" data-action="create">
          <span>+ Create Workflow</span>
        </button>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Workflow action buttons
    this.container.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action]') as HTMLElement;

      if (!button) return;

      const action = button.dataset.action;
      const card = button.closest('.workflow-card') as HTMLElement;
      const workflowId = card?.dataset.workflowId;

      switch (action) {
        case 'run':
          if (workflowId) await this.runWorkflow(workflowId);
          break;
        case 'edit':
          if (workflowId) this.editWorkflow(workflowId);
          break;
        case 'history':
          if (workflowId) this.showWorkflowHistory(workflowId);
          break;
        case 'delete':
          if (workflowId) await this.deleteWorkflow(workflowId);
          break;
        case 'create':
          this.createWorkflow();
          break;
      }
    });
  }

  /**
   * Run a workflow
   */
  private async runWorkflow(workflowId: string): Promise<void> {
    console.log('[WorkflowsView] Running workflow:', workflowId);

    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.workflows) {
        throw new Error('Workflow API not available');
      }

      // Show loading state
      this.showNotification('info', 'Workflow started', 'Executing workflow...');

      // Execute workflow
      const result = await electronAPI.workflows.execute(workflowId);

      if (result.success) {
        this.showNotification('success', 'Workflow completed', `Completed ${result.completedSteps}/${result.totalSteps} steps`);
        await this.loadWorkflows();
        this.render();
        this.attachEventListeners();
      } else {
        this.showNotification('error', 'Workflow failed', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[WorkflowsView] Failed to run workflow:', error);
      this.showNotification('error', 'Execution failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Edit a workflow
   */
  private editWorkflow(workflowId: string): void {
    console.log('[WorkflowsView] Edit workflow:', workflowId);
    // TODO: Open workflow builder
    this.showNotification('info', 'Coming soon', 'Workflow builder will be available soon');
  }

  /**
   * Show workflow execution history
   */
  private showWorkflowHistory(workflowId: string): void {
    console.log('[WorkflowsView] Show history:', workflowId);
    // TODO: Open history panel
    this.showNotification('info', 'Coming soon', 'Workflow history viewer will be available soon');
  }

  /**
   * Delete a workflow
   */
  private async deleteWorkflow(workflowId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this workflow?')) {
      return;
    }

    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.workflows) {
        throw new Error('Workflow API not available');
      }

      await electronAPI.workflows.delete(workflowId);

      this.showNotification('success', 'Workflow deleted', 'Workflow has been removed');
      await this.loadWorkflows();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('[WorkflowsView] Failed to delete workflow:', error);
      this.showNotification('error', 'Delete failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Create a new workflow
   */
  private createWorkflow(): void {
    console.log('[WorkflowsView] Create new workflow');
    // TODO: Open workflow builder
    this.showNotification('info', 'Coming soon', 'Workflow builder will be available soon');
  }

  /**
   * Show a notification
   */
  private showNotification(type: 'info' | 'success' | 'error', title: string, message: string): void {
    if (typeof (window as any).showNotification === 'function') {
      (window as any).showNotification(`${title}: ${message}`, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    }
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
      actions: [
        { id: 'create', label: 'Create Workflow', icon: '➕', variant: 'primary' },
        { id: 'import', label: 'Import Workflow', icon: '📥' },
        { id: 'refresh', label: 'Refresh', icon: '🔄' },
      ],
      global: {
        projectSelector: true,
        environmentIndicator: true,
      },
    };
  }

  /**
   * Handle action from top bar
   */
  async handleAction(actionId: string): Promise<void> {
    switch (actionId) {
      case 'create':
        this.createWorkflow();
        break;
      case 'import':
        try {
          const electronAPI = (window as any).electronAPI;
          const result = await electronAPI.dialog.showOpenDialog({
            title: 'Import Workflow',
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            properties: ['openFile'],
            buttonLabel: 'Import Workflow',
          });
          
          if (!result.canceled && result.filePaths.length > 0) {
            const path = result.filePaths[0];
            await electronAPI.import.workflow(path);
            this.showNotification('success', 'Import Successful', 'Workflow imported successfully');
            // Refresh list
            await this.loadWorkflows();
            this.render();
            this.attachEventListeners();
          }
        } catch (error: any) {
          console.error('[WorkflowsView] Import failed:', error);
          this.showNotification('error', 'Import Failed', error.message);
        }
        break;
      case 'refresh':
        this.loadWorkflows().then(() => {
          this.render();
          this.attachEventListeners();
        });
        break;
      default:
        console.warn('[WorkflowsView] Unknown action:', actionId);
    }
  }
}
