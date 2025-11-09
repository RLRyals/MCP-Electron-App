/**
 * Progress Aggregator Utility
 * Combines and manages multiple operation progress events into a unified view
 */

import {
  ProgressEvent,
  ProgressPhase,
  OperationType,
  AggregatedProgress,
  OperationProgress,
  OperationStartEvent,
  OperationCompleteEvent,
  ConsoleOutputEvent,
  ErrorEvent,
  OperationCallbacks,
  ProgressTrackingOptions,
  LogEntry,
  ProgressSeverity,
  LogExportFormat,
  LogExportOptions,
} from '../types/progress';

/**
 * Progress Aggregator Class
 * Manages progress tracking across multiple concurrent operations
 */
export class ProgressAggregator {
  private operations: Map<string, OperationProgress> = new Map();
  private consoleOutput: Map<string, ConsoleOutputEvent[]> = new Map();
  private logs: LogEntry[] = [];
  private callbacks: OperationCallbacks = {};
  private options: ProgressTrackingOptions;
  private lastUpdateTime: Map<string, number> = new Map();
  private startTime?: Date;

  constructor(callbacks?: OperationCallbacks, options?: ProgressTrackingOptions) {
    this.callbacks = callbacks || {};
    this.options = {
      throttleInterval: options?.throttleInterval || 100, // 100ms default throttle
      captureConsoleOutput: options?.captureConsoleOutput ?? true,
      maxConsoleLines: options?.maxConsoleLines || 1000,
      enableTimeEstimation: options?.enableTimeEstimation ?? true,
    };
  }

  /**
   * Register a new operation
   */
  public startOperation(event: OperationStartEvent): void {
    if (!this.startTime) {
      this.startTime = event.timestamp;
    }

    const operation: OperationProgress = {
      operationId: event.operationId,
      operationType: event.operationType,
      name: event.name,
      phase: ProgressPhase.INITIALIZING,
      percent: 0,
      message: 'Starting operation...',
      startTime: event.timestamp,
    };

    this.operations.set(event.operationId, operation);

    // Initialize console output buffer
    if (this.options.captureConsoleOutput) {
      this.consoleOutput.set(event.operationId, []);
    }

    // Log the start
    this.addLog({
      timestamp: event.timestamp,
      operationId: event.operationId,
      operationType: event.operationType,
      severity: ProgressSeverity.INFO,
      message: `Started: ${event.name}`,
      data: event.metadata,
    });

    // Trigger callback
    if (this.callbacks.onStart) {
      this.callbacks.onStart(event);
    }
  }

  /**
   * Update operation progress
   */
  public updateProgress(event: ProgressEvent): void {
    const operation = this.operations.get(event.operationId);
    if (!operation) {
      console.warn(`Unknown operation ID: ${event.operationId}`);
      return;
    }

    // Apply throttling
    if (this.shouldThrottle(event.operationId)) {
      return;
    }

    // Update operation state
    operation.phase = event.phase;
    operation.percent = Math.min(100, Math.max(0, event.percent));
    operation.message = event.message;

    // Log the progress
    this.addLog({
      timestamp: event.timestamp,
      operationId: event.operationId,
      operationType: event.operationType,
      severity: event.severity || ProgressSeverity.INFO,
      message: event.message,
      data: event.metadata,
    });

    // Update last update time
    this.lastUpdateTime.set(event.operationId, Date.now());

    // Trigger callback
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress(event);
    }
  }

  /**
   * Add console output for an operation
   */
  public addConsoleOutput(event: ConsoleOutputEvent): void {
    if (!this.options.captureConsoleOutput) {
      return;
    }

    const outputs = this.consoleOutput.get(event.operationId) || [];
    outputs.push(event);

    // Enforce max lines limit
    if (outputs.length > this.options.maxConsoleLines!) {
      outputs.shift(); // Remove oldest entry
    }

    this.consoleOutput.set(event.operationId, outputs);

    // Log the output
    this.addLog({
      timestamp: event.timestamp,
      operationId: event.operationId,
      operationType: OperationType.CUSTOM_SCRIPT, // Default, will be overridden if known
      severity: event.severity || (event.stream === 'stderr' ? ProgressSeverity.WARNING : ProgressSeverity.DEBUG),
      message: event.content,
    });

    // Trigger callback
    if (this.callbacks.onConsoleOutput) {
      this.callbacks.onConsoleOutput(event);
    }
  }

  /**
   * Record an error for an operation
   */
  public recordError(event: ErrorEvent): void {
    const operation = this.operations.get(event.operationId);
    if (operation) {
      operation.error = event.message;
      operation.phase = ProgressPhase.FAILED;
    }

    // Log the error
    this.addLog({
      timestamp: event.timestamp,
      operationId: event.operationId,
      operationType: operation?.operationType || OperationType.CUSTOM_SCRIPT,
      severity: ProgressSeverity.ERROR,
      message: event.message,
      data: {
        error: event.error,
        stackTrace: event.stackTrace,
        recoverable: event.recoverable,
        retryAction: event.retryAction,
        context: event.context,
      },
    });

    // Trigger callback
    if (this.callbacks.onError) {
      this.callbacks.onError(event);
    }
  }

  /**
   * Mark an operation as complete
   */
  public completeOperation(event: OperationCompleteEvent): void {
    const operation = this.operations.get(event.operationId);
    if (!operation) {
      console.warn(`Unknown operation ID: ${event.operationId}`);
      return;
    }

    // Update operation state
    operation.phase = event.success ? ProgressPhase.COMPLETE : ProgressPhase.FAILED;
    operation.percent = event.success ? 100 : operation.percent;
    operation.message = event.message;
    operation.endTime = event.timestamp;
    operation.success = event.success;

    if (!event.success && event.error) {
      operation.error = event.error;
    }

    // Log completion
    this.addLog({
      timestamp: event.timestamp,
      operationId: event.operationId,
      operationType: event.operationType,
      severity: event.success ? ProgressSeverity.INFO : ProgressSeverity.ERROR,
      message: `Completed: ${event.message} (${event.duration}ms)`,
      data: {
        success: event.success,
        duration: event.duration,
        result: event.result,
        error: event.error,
      },
    });

    // Trigger callback
    if (this.callbacks.onComplete) {
      this.callbacks.onComplete(event);
    }
  }

  /**
   * Get aggregated progress state
   */
  public getAggregatedProgress(): AggregatedProgress {
    const operations = Array.from(this.operations.values());
    const totalOperations = operations.length;
    const completedOperations = operations.filter(
      (op) => op.phase === ProgressPhase.COMPLETE
    ).length;
    const failedOperations = operations.filter(
      (op) => op.phase === ProgressPhase.FAILED
    ).length;

    // Calculate overall progress
    const overallPercent = totalOperations > 0
      ? operations.reduce((sum, op) => sum + op.percent, 0) / totalOperations
      : 0;

    // Find current active operation
    const currentOperation = operations.find(
      (op) => op.phase === ProgressPhase.IN_PROGRESS || op.phase === ProgressPhase.INITIALIZING
    );

    // Determine overall phase
    let phase: ProgressPhase;
    if (failedOperations > 0 && completedOperations + failedOperations === totalOperations) {
      phase = ProgressPhase.FAILED;
    } else if (completedOperations === totalOperations && totalOperations > 0) {
      phase = ProgressPhase.COMPLETE;
    } else if (currentOperation) {
      phase = ProgressPhase.IN_PROGRESS;
    } else if (totalOperations === 0) {
      phase = ProgressPhase.INITIALIZING;
    } else {
      phase = ProgressPhase.INITIALIZING;
    }

    // Estimate time remaining (if enabled)
    let estimatedTimeRemaining: number | undefined;
    if (this.options.enableTimeEstimation && currentOperation && this.startTime) {
      estimatedTimeRemaining = this.estimateTimeRemaining(operations);
    }

    return {
      overallPercent: Math.round(overallPercent),
      currentOperation: currentOperation
        ? {
            operationId: currentOperation.operationId,
            operationType: currentOperation.operationType,
            name: currentOperation.name,
            timestamp: currentOperation.startTime,
          }
        : undefined,
      operations,
      totalOperations,
      completedOperations,
      failedOperations,
      phase,
      estimatedTimeRemaining,
      startTime: this.startTime,
    };
  }

  /**
   * Get console output for a specific operation
   */
  public getConsoleOutput(operationId: string): ConsoleOutputEvent[] {
    return this.consoleOutput.get(operationId) || [];
  }

  /**
   * Get all console output
   */
  public getAllConsoleOutput(): ConsoleOutputEvent[] {
    const allOutput: ConsoleOutputEvent[] = [];
    this.consoleOutput.forEach((outputs) => {
      allOutput.push(...outputs);
    });
    return allOutput.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get operation by ID
   */
  public getOperation(operationId: string): OperationProgress | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Get all operations
   */
  public getAllOperations(): OperationProgress[] {
    return Array.from(this.operations.values());
  }

  /**
   * Cancel an operation
   */
  public cancelOperation(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (operation && operation.phase !== ProgressPhase.COMPLETE && operation.phase !== ProgressPhase.FAILED) {
      operation.phase = ProgressPhase.CANCELLED;
      operation.message = 'Operation cancelled by user';
      operation.endTime = new Date();

      this.addLog({
        timestamp: new Date(),
        operationId,
        operationType: operation.operationType,
        severity: ProgressSeverity.WARNING,
        message: 'Operation cancelled by user',
      });
    }
  }

  /**
   * Clear all operations and reset state
   */
  public reset(): void {
    this.operations.clear();
    this.consoleOutput.clear();
    this.logs = [];
    this.lastUpdateTime.clear();
    this.startTime = undefined;
  }

  /**
   * Export logs to various formats
   */
  public exportLogs(options: LogExportOptions): string {
    let filteredLogs = [...this.logs];

    // Apply filters
    if (options.operationType) {
      filteredLogs = filteredLogs.filter((log) => log.operationType === options.operationType);
    }
    if (options.severity) {
      filteredLogs = filteredLogs.filter((log) => log.severity === options.severity);
    }
    if (options.startTime) {
      filteredLogs = filteredLogs.filter((log) => log.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      filteredLogs = filteredLogs.filter((log) => log.timestamp <= options.endTime!);
    }

    // Format output
    switch (options.format) {
      case LogExportFormat.TEXT:
        return this.exportAsText(filteredLogs);
      case LogExportFormat.JSON:
        return this.exportAsJSON(filteredLogs);
      case LogExportFormat.CSV:
        return this.exportAsCSV(filteredLogs);
      case LogExportFormat.HTML:
        return this.exportAsHTML(filteredLogs);
      default:
        return this.exportAsText(filteredLogs);
    }
  }

  /**
   * Get logs
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Private helper methods

  private shouldThrottle(operationId: string): boolean {
    if (!this.options.throttleInterval) {
      return false;
    }

    const lastUpdate = this.lastUpdateTime.get(operationId) || 0;
    const now = Date.now();
    return now - lastUpdate < this.options.throttleInterval;
  }

  private estimateTimeRemaining(operations: OperationProgress[]): number {
    const completedOps = operations.filter((op) => op.phase === ProgressPhase.COMPLETE);
    const inProgressOps = operations.filter(
      (op) => op.phase === ProgressPhase.IN_PROGRESS || op.phase === ProgressPhase.INITIALIZING
    );

    if (completedOps.length === 0 || inProgressOps.length === 0) {
      return 0;
    }

    // Calculate average time per operation
    const totalCompletedTime = completedOps.reduce((sum, op) => {
      if (op.endTime) {
        return sum + (op.endTime.getTime() - op.startTime.getTime());
      }
      return sum;
    }, 0);

    const avgTimePerOp = totalCompletedTime / completedOps.length;

    // Estimate remaining time based on remaining operations and their progress
    const remainingTime = inProgressOps.reduce((sum, op) => {
      const remainingPercent = (100 - op.percent) / 100;
      return sum + avgTimePerOp * remainingPercent;
    }, 0);

    return Math.round(remainingTime);
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
  }

  private exportAsText(logs: LogEntry[]): string {
    return logs
      .map((log) => {
        const timestamp = log.timestamp.toISOString();
        const severity = log.severity.toUpperCase().padEnd(7);
        const opType = log.operationType.padEnd(20);
        return `[${timestamp}] ${severity} [${opType}] ${log.message}`;
      })
      .join('\n');
  }

  private exportAsJSON(logs: LogEntry[]): string {
    return JSON.stringify(logs, null, 2);
  }

  private exportAsCSV(logs: LogEntry[]): string {
    const header = 'Timestamp,Severity,Operation Type,Operation ID,Message\n';
    const rows = logs
      .map((log) => {
        const timestamp = log.timestamp.toISOString();
        const message = log.message.replace(/"/g, '""'); // Escape quotes
        return `"${timestamp}","${log.severity}","${log.operationType}","${log.operationId}","${message}"`;
      })
      .join('\n');
    return header + rows;
  }

  private exportAsHTML(logs: LogEntry[]): string {
    const rows = logs
      .map((log) => {
        const timestamp = log.timestamp.toISOString();
        const severityClass = log.severity.toLowerCase();
        return `
        <tr class="${severityClass}">
          <td>${timestamp}</td>
          <td>${log.severity}</td>
          <td>${log.operationType}</td>
          <td>${log.operationId}</td>
          <td>${log.message}</td>
        </tr>`;
      })
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Operation Logs</title>
  <style>
    body { font-family: monospace; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #667eea; color: white; }
    tr.error { background-color: #ffebee; }
    tr.warning { background-color: #fff3e0; }
    tr.info { background-color: #e3f2fd; }
  </style>
</head>
<body>
  <h1>Operation Logs</h1>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Severity</th>
        <th>Operation Type</th>
        <th>Operation ID</th>
        <th>Message</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
  }
}

/**
 * Helper function to create a new progress aggregator
 */
export function createProgressAggregator(
  callbacks?: OperationCallbacks,
  options?: ProgressTrackingOptions
): ProgressAggregator {
  return new ProgressAggregator(callbacks, options);
}
