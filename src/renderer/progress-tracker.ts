/**
 * Progress Tracker Renderer Module
 * Handles the UI updates for Step 5 progress tracking
 */

// Type definitions for Progress Tracker
type ProgressPhaseType = 'initializing' | 'in_progress' | 'completing' | 'complete' | 'failed' | 'cancelled';
type OperationTypeString = 'repository_clone' | 'npm_install' | 'npm_build' | 'docker_build' | 'custom_script' | 'download' | 'environment_setup';

interface ConsoleOutputEvent {
  operationId: string;
  timestamp: Date;
  stream: 'stdout' | 'stderr';
  content: string;
}

interface ProgressErrorEvent {
  operationId: string;
  timestamp: Date;
  message?: string;
  errorMessage?: string;
  error?: any;
  recoverable: boolean;
  retryAction?: string;
}

interface OperationStartEvent {
  operationId: string;
  operationType: OperationTypeString;
  name: string;
  timestamp: Date;
}

interface AggregatedProgress {
  overallPercent: number;
  currentOperation?: {
    operationId: string;
    operationType: OperationTypeString;
    name: string;
    timestamp: Date;
  };
  operations: any[];
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  phase: ProgressPhaseType;
  startTime: Date;
}

interface OperationProgress {
  operationId: string;
  operationType: OperationTypeString;
  name: string;
  phase: ProgressPhaseType;
  percent: number;
  message?: string;
  startTime: Date;
  endTime?: Date;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Progress Tracker UI Manager
 */
class ProgressTrackerUI {
  private overallProgressFill: HTMLElement | null = null;
  private overallProgressPercent: HTMLElement | null = null;
  private operationTypeBadge: HTMLElement | null = null;
  private currentOperationMessage: HTMLElement | null = null;
  private buildStepsList: HTMLElement | null = null;
  private consoleOutput: HTMLElement | null = null;
  private errorDisplay: HTMLElement | null = null;
  private errorMessage: HTMLElement | null = null;
  private consoleLines: string[] = [];
  private operationElements: Map<string, HTMLElement> = new Map();

  constructor() {
    this.initializeElements();
    this.attachEventListeners();
  }

  /**
   * Initialize DOM element references
   */
  private initializeElements(): void {
    this.overallProgressFill = document.getElementById('overall-progress-fill');
    this.overallProgressPercent = document.getElementById('overall-progress-percent');
    this.operationTypeBadge = document.getElementById('operation-type-badge');
    this.currentOperationMessage = document.getElementById('current-operation-message');
    this.buildStepsList = document.getElementById('build-steps-list');
    this.consoleOutput = document.getElementById('console-output');
    this.errorDisplay = document.getElementById('error-display');
    this.errorMessage = document.getElementById('error-message');
  }

  /**
   * Attach event listeners to buttons
   */
  private attachEventListeners(): void {
    const clearConsoleBtn = document.getElementById('clear-console-btn');
    const exportLogsBtn = document.getElementById('export-logs-btn');
    const retryBtn = document.getElementById('retry-operation-btn');
    const skipBtn = document.getElementById('skip-operation-btn');
    const cancelAllBtn = document.getElementById('cancel-all-btn');

    if (clearConsoleBtn) {
      clearConsoleBtn.addEventListener('click', () => this.clearConsole());
    }

    if (exportLogsBtn) {
      exportLogsBtn.addEventListener('click', () => this.exportLogs());
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.handleRetry());
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.handleSkip());
    }

    if (cancelAllBtn) {
      cancelAllBtn.addEventListener('click', () => this.handleCancelAll());
    }
  }

  /**
   * Update overall progress display
   */
  public updateOverallProgress(aggregated: AggregatedProgress): void {
    if (this.overallProgressFill) {
      this.overallProgressFill.style.width = `${aggregated.overallPercent}%`;
    }

    if (this.overallProgressPercent) {
      this.overallProgressPercent.textContent = `${aggregated.overallPercent}%`;
    }

    // Update current operation info
    if (aggregated.currentOperation) {
      this.updateCurrentOperation(aggregated.currentOperation);
    }
  }

  /**
   * Update current operation display
   */
  private updateCurrentOperation(operation: {
    operationId: string;
    operationType: OperationTypeString;
    name: string;
    timestamp: Date;
  }): void {
    if (this.operationTypeBadge) {
      this.operationTypeBadge.textContent = this.formatOperationType(operation.operationType);
    }

    if (this.currentOperationMessage) {
      this.currentOperationMessage.textContent = operation.name;
    }
  }

  /**
   * Add or update an operation in the build steps list
   */
  public updateOperation(operation: OperationProgress): void {
    if (!this.buildStepsList) return;

    let operationEl = this.operationElements.get(operation.operationId);

    if (!operationEl) {
      // Create new operation element
      operationEl = this.createOperationElement(operation);
      this.operationElements.set(operation.operationId, operationEl);

      // Clear placeholder if exists
      if (this.buildStepsList.querySelector('[style*="No operations"]')) {
        this.buildStepsList.innerHTML = '';
      }

      this.buildStepsList.appendChild(operationEl);
    } else {
      // Update existing operation element
      this.updateOperationElement(operationEl, operation);
    }
  }

  /**
   * Create a new operation element
   */
  private createOperationElement(operation: OperationProgress): HTMLElement {
    const el = document.createElement('div');
    el.className = 'build-step-item';
    el.style.cssText = 'padding: 12px; margin-bottom: 10px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border-left: 4px solid transparent;';

    this.updateOperationElement(el, operation);
    return el;
  }

  /**
   * Update an existing operation element
   */
  private updateOperationElement(el: HTMLElement, operation: OperationProgress): void {
    const statusIcon = this.getStatusIcon(operation.phase);
    const statusColor = this.getStatusColor(operation.phase);

    el.style.borderLeftColor = statusColor;

    el.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 1.5rem;">${statusIcon}</span>
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span style="font-weight: 500; font-size: 0.95rem;">${this.escapeHtml(operation.name)}</span>
            <span style="font-size: 0.85rem; opacity: 0.8;">${operation.percent}%</span>
          </div>
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 8px;">${this.escapeHtml(operation.message || '')}</div>
          ${operation.percent < 100 && operation.phase === 'in_progress' ? `
            <div style="height: 4px; background: rgba(0, 0, 0, 0.3); border-radius: 2px; overflow: hidden;">
              <div style="height: 100%; background: ${statusColor}; width: ${operation.percent}%; transition: width 0.3s ease;"></div>
            </div>
          ` : ''}
          ${operation.errorMessage ? `
            <div style="margin-top: 8px; padding: 8px; background: rgba(244, 67, 54, 0.2); border-radius: 4px; font-size: 0.85rem; color: #ffcdd2;">
              ${this.escapeHtml(operation.errorMessage)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Add console output line
   */
  public addConsoleOutput(event: ConsoleOutputEvent): void {
    if (!this.consoleOutput) return;

    const timestamp = this.formatTimestamp(event.timestamp);
    const stream = event.stream === 'stderr' ? 'ERR' : 'OUT';
    const color = event.stream === 'stderr' ? '#ffcdd2' : '#e0e0e0';
    const line = `<div style="margin-bottom: 4px; color: ${color};"><span style="opacity: 0.6;">[${timestamp}]</span> <span style="opacity: 0.5;">[${stream}]</span> ${this.escapeHtml(event.content)}</div>`;

    this.consoleLines.push(line);

    // Limit console lines
    if (this.consoleLines.length > 1000) {
      this.consoleLines.shift();
    }

    this.consoleOutput.innerHTML = this.consoleLines.join('');

    // Auto-scroll to bottom
    this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
  }

  /**
   * Show error display
   */
  public showError(event: ProgressErrorEvent): void {
    if (!this.errorDisplay || !this.errorMessage) return;

    this.errorMessage.textContent = event.message || event.errorMessage || 'An error occurred';
    this.errorDisplay.style.display = 'block';

    // Store error context for retry
    (this.errorDisplay as any).__errorContext = event;
  }

  /**
   * Hide error display
   */
  public hideError(): void {
    if (this.errorDisplay) {
      this.errorDisplay.style.display = 'none';
    }
  }

  /**
   * Clear console output
   */
  private clearConsole(): void {
    this.consoleLines = [];
    if (this.consoleOutput) {
      this.consoleOutput.innerHTML = '<div style="opacity: 0.6;">Console cleared</div>';
    }
  }

  /**
   * Export logs
   */
  private async exportLogs(): Promise<void> {
    try {
      // Get logs from the main process
      // This would need to be implemented in the IPC layer
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `build-logs-${timestamp}.txt`;

      // Create log content from console lines
      const logContent = this.consoleLines
        .map(line => {
          // Strip HTML tags
          const div = document.createElement('div');
          div.innerHTML = line;
          return div.textContent || '';
        })
        .join('\n');

      // Create a blob and download it
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      this.showNotification('Logs exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting logs:', error);
      this.showNotification('Failed to export logs', 'error');
    }
  }

  /**
   * Handle retry button click
   */
  private handleRetry(): void {
    this.hideError();
    // Emit retry event - this should be handled by the parent component
    const event = new CustomEvent('progress:retry');
    window.dispatchEvent(event);
  }

  /**
   * Handle skip button click
   */
  private handleSkip(): void {
    this.hideError();
    // Emit skip event
    const event = new CustomEvent('progress:skip');
    window.dispatchEvent(event);
  }

  /**
   * Handle cancel all button click
   */
  private async handleCancelAll(): Promise<void> {
    const confirmed = confirm('Are you sure you want to cancel all operations?');
    if (confirmed) {
      // Emit cancel event
      const event = new CustomEvent('progress:cancel-all');
      window.dispatchEvent(event);
    }
  }

  /**
   * Show notification
   */
  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    // Simple notification - could be enhanced with a proper toast system
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: ${type === 'success' ? 'rgba(76, 175, 80, 0.9)' : type === 'error' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(33, 150, 243, 0.9)'};
      color: white;
      border-radius: 8px;
      font-size: 0.95rem;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Reset the UI
   */
  public reset(): void {
    if (this.overallProgressFill) {
      this.overallProgressFill.style.width = '0%';
    }
    if (this.overallProgressPercent) {
      this.overallProgressPercent.textContent = '0%';
    }
    if (this.operationTypeBadge) {
      this.operationTypeBadge.textContent = 'Initializing';
    }
    if (this.currentOperationMessage) {
      this.currentOperationMessage.textContent = 'Preparing to start...';
    }
    if (this.buildStepsList) {
      this.buildStepsList.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 20px;">No operations started yet</div>';
    }
    this.clearConsole();
    this.hideError();
    this.operationElements.clear();
  }

  // Helper methods

  private formatOperationType(type: OperationTypeString): string {
    const typeMap: Record<OperationTypeString, string> = {
      'repository_clone': 'Repository Clone',
      'npm_install': 'NPM Install',
      'npm_build': 'NPM Build',
      'docker_build': 'Docker Build',
      'custom_script': 'Custom Script',
      'download': 'Download',
      'environment_setup': 'Environment Setup',
    };
    return typeMap[type] || 'Operation';
  }

  private getStatusIcon(phase: ProgressPhaseType): string {
    const iconMap: Record<ProgressPhaseType, string> = {
      'initializing': '⏳',
      'in_progress': '▶️',
      'completing': '🔄',
      'complete': '✅',
      'failed': '❌',
      'cancelled': '🚫',
    };
    return iconMap[phase] || '⏳';
  }

  private getStatusColor(phase: ProgressPhaseType): string {
    const colorMap: Record<ProgressPhaseType, string> = {
      'initializing': '#667eea',
      'in_progress': '#2196f3',
      'completing': '#ff9800',
      'complete': '#4caf50',
      'failed': '#f44336',
      'cancelled': '#9e9e9e',
    };
    return colorMap[phase] || '#667eea';
  }

  private formatTimestamp(date: Date): string {
    return date.toTimeString().split(' ')[0];
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Make ProgressTrackerUI available globally
(window as any).ProgressTrackerUI = ProgressTrackerUI;

// Define global ProgressPhase and OperationType objects
(window as any).ProgressPhase = {
  INITIALIZING: 'initializing',
  IN_PROGRESS: 'in_progress',
  COMPLETING: 'completing',
  COMPLETE: 'complete',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

(window as any).OperationType = {
  REPOSITORY_CLONE: 'repository_clone',
  NPM_INSTALL: 'npm_install',
  NPM_BUILD: 'npm_build',
  DOCKER_BUILD: 'docker_build',
  CUSTOM_SCRIPT: 'custom_script',
  DOWNLOAD: 'download',
  ENVIRONMENT_SETUP: 'environment_setup'
};
