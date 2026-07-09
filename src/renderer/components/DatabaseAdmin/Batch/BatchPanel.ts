/**
 * BatchPanel Component
 *
 * Container that wires the Batch Operations scaffolding (BatchInsert,
 * BatchUpdate, BatchDelete -- from commit 3ec4248 / issues #127-#130) into a
 * single tabbed panel for issue #128 ("Database Batch Operations UI").
 *
 * Each sub-component is lazily constructed the first time its tab is
 * activated (they hit the DB via databaseService on render), then reused
 * for the lifetime of the panel so table selections / staged data aren't
 * lost when the user flips between tabs.
 */

import { BatchInsert, BatchInsertResult } from './BatchInsert.js';
import { BatchUpdate, BatchUpdateResult } from './BatchUpdate.js';
import { BatchDelete, BatchDeleteResult } from './BatchDelete.js';

export type BatchOperationTab = 'insert' | 'update' | 'delete';

export interface BatchPanelOptions {
  onStatusChange?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const TABS: Array<{ id: BatchOperationTab; label: string }> = [
  { id: 'insert', label: 'Bulk Insert' },
  { id: 'update', label: 'Bulk Update' },
  { id: 'delete', label: 'Bulk Delete' },
];

export class BatchPanel {
  private container: HTMLElement | null = null;
  private options: BatchPanelOptions;
  private currentTab: BatchOperationTab = 'insert';
  private batchInsert: BatchInsert | null = null;
  private batchUpdate: BatchUpdate | null = null;
  private batchDelete: BatchDelete | null = null;

  constructor(options: BatchPanelOptions = {}) {
    this.options = options;
  }

  /**
   * Render the panel into the given container and mount the default tab.
   */
  public initialize(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  /**
   * Render the tab shell
   */
  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="batch-panel">
        <div class="batch-panel-header">
          <h3>Batch Operations</h3>
          <p class="batch-panel-subtitle">Bulk insert, update, or delete records for a single table</p>
        </div>
        <div class="batch-panel-tabs" role="tablist">
          ${TABS.map(tab => `
            <button class="batch-tab-button${tab.id === this.currentTab ? ' active' : ''}"
              data-tab="${tab.id}" role="tab" aria-selected="${tab.id === this.currentTab}">
              ${tab.label}
            </button>
          `).join('')}
        </div>
        <div class="batch-panel-content">
          <div id="batch-panel-insert" class="batch-panel-tab-content${this.currentTab === 'insert' ? ' active' : ''}"></div>
          <div id="batch-panel-update" class="batch-panel-tab-content${this.currentTab === 'update' ? ' active' : ''}"></div>
          <div id="batch-panel-delete" class="batch-panel-tab-content${this.currentTab === 'delete' ? ' active' : ''}"></div>
        </div>
        <div id="batch-panel-status" class="batch-panel-status" role="status" aria-live="polite"></div>
      </div>
    `;

    this.attachEventListeners();
    this.mountActiveTab();
  }

  /**
   * Attach tab-switch listeners
   */
  private attachEventListeners(): void {
    const tabButtons = this.container?.querySelectorAll('.batch-tab-button');
    tabButtons?.forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab') as BatchOperationTab | null;
        if (tab) this.switchTab(tab);
      });
    });
  }

  /**
   * Switch the active tab (mounting the target sub-component on first visit)
   */
  private switchTab(tab: BatchOperationTab): void {
    if (this.currentTab === tab) return;
    this.currentTab = tab;

    const tabButtons = this.container?.querySelectorAll('.batch-tab-button');
    tabButtons?.forEach(button => {
      const isActive = button.getAttribute('data-tab') === tab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });

    const tabPanels = this.container?.querySelectorAll('.batch-panel-tab-content');
    tabPanels?.forEach(panel => {
      panel.classList.toggle('active', panel.id === `batch-panel-${tab}`);
    });

    this.mountActiveTab();
  }

  /**
   * Lazily construct + render the sub-component backing the current tab
   */
  private mountActiveTab(): void {
    switch (this.currentTab) {
      case 'insert':
        if (!this.batchInsert) {
          this.batchInsert = new BatchInsert('batch-panel-insert', {
            onProgress: (progress, total) => this.setStatus(`Inserting ${progress} / ${total}...`, 'info'),
            onComplete: (result: BatchInsertResult) => this.setStatus(
              result.success
                ? `Inserted ${result.inserted} record(s) successfully.`
                : `Insert completed with ${result.failed} error(s) (${result.inserted} succeeded).`,
              result.success ? 'success' : 'error'
            ),
            onError: (error) => this.setStatus(error, 'error'),
          });
          this.batchInsert.render();
        }
        break;
      case 'update':
        if (!this.batchUpdate) {
          this.batchUpdate = new BatchUpdate('batch-panel-update', {
            onComplete: (result: BatchUpdateResult) => this.setStatus(
              result.success
                ? `Updated ${result.updated} record(s) successfully.`
                : `Update failed (${result.errors[0]?.error || 'unknown error'}).`,
              result.success ? 'success' : 'error'
            ),
            onError: (error) => this.setStatus(error, 'error'),
          });
          this.batchUpdate.render();
        }
        break;
      case 'delete':
        if (!this.batchDelete) {
          this.batchDelete = new BatchDelete('batch-panel-delete', {
            onComplete: (result: BatchDeleteResult) => this.setStatus(
              result.success
                ? `Deleted ${result.deleted} record(s) successfully.`
                : `Delete failed (${result.errors[0]?.error || 'unknown error'}).`,
              result.success ? 'success' : 'error'
            ),
            onError: (error) => this.setStatus(error, 'error'),
          });
          this.batchDelete.render();
        }
        break;
    }
  }

  /**
   * Update the shared status line beneath the tab content
   */
  private setStatus(message: string, type: 'success' | 'error' | 'info'): void {
    const statusEl = document.getElementById('batch-panel-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `batch-panel-status ${type}`;
    }
    this.options.onStatusChange?.(message, type);
  }

  /**
   * Release references to sub-components (called when the Database tab
   * navigates away from the batch view).
   */
  public destroy(): void {
    this.batchInsert = null;
    this.batchUpdate = null;
    this.batchDelete = null;
    this.container = null;
  }
}
