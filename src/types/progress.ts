/**
 * Type definitions for the Progress Tracking system
 * Provides unified progress tracking for repository cloning, npm installs, builds, and Docker operations
 */

/**
 * Progress phase states
 */
export enum ProgressPhase {
  /** Operation is being initialized */
  INITIALIZING = 'initializing',
  /** Operation is currently in progress */
  IN_PROGRESS = 'in_progress',
  /** Operation is completing (cleanup, finalization) */
  COMPLETING = 'completing',
  /** Operation has completed successfully */
  COMPLETE = 'complete',
  /** Operation has failed */
  FAILED = 'failed',
  /** Operation was cancelled by user */
  CANCELLED = 'cancelled',
}

/**
 * Types of operations that can be tracked
 */
export enum OperationType {
  /** Git repository cloning */
  REPOSITORY_CLONE = 'repository_clone',
  /** NPM package installation */
  NPM_INSTALL = 'npm_install',
  /** NPM build script execution */
  NPM_BUILD = 'npm_build',
  /** Docker image build */
  DOCKER_BUILD = 'docker_build',
  /** Custom script execution */
  CUSTOM_SCRIPT = 'custom_script',
  /** Generic file download */
  DOWNLOAD = 'download',
  /** Environment setup/configuration */
  ENVIRONMENT_SETUP = 'environment_setup',
}

/**
 * Progress severity level for messages
 */
export enum ProgressSeverity {
  /** Informational message */
  INFO = 'info',
  /** Warning message */
  WARNING = 'warning',
  /** Error message */
  ERROR = 'error',
  /** Debug message */
  DEBUG = 'debug',
}

/**
 * Base progress event interface
 */
export interface ProgressEvent {
  /** Unique identifier for this operation */
  operationId: string;
  /** Type of operation */
  operationType: OperationType;
  /** Current phase of the operation */
  phase: ProgressPhase;
  /** Progress percentage (0-100) */
  percent: number;
  /** Human-readable status message */
  message: string;
  /** Timestamp of the event */
  timestamp: Date;
  /** Optional severity level */
  severity?: ProgressSeverity;
  /** Additional context data */
  metadata?: Record<string, any>;
}

/**
 * Detailed progress event with step information
 */
export interface DetailedProgressEvent extends ProgressEvent {
  /** Current step number (1-based) */
  currentStep?: number;
  /** Total number of steps */
  totalSteps?: number;
  /** Current step name/description */
  stepName?: string;
  /** Estimated time remaining (milliseconds) */
  estimatedTimeRemaining?: number;
}

/**
 * Console output event
 */
export interface ConsoleOutputEvent {
  /** Operation ID this output belongs to */
  operationId: string;
  /** Timestamp of the output */
  timestamp: Date;
  /** Output stream (stdout or stderr) */
  stream: 'stdout' | 'stderr';
  /** Output content */
  content: string;
  /** Severity level derived from content */
  severity?: ProgressSeverity;
}

/**
 * Error event with retry capability
 */
export interface ErrorEvent {
  /** Operation ID where error occurred */
  operationId: string;
  /** Timestamp of the error */
  timestamp: Date;
  /** Error message */
  message: string;
  /** Detailed error information */
  error?: Error | string;
  /** Stack trace if available */
  stackTrace?: string;
  /** Whether this error is recoverable */
  recoverable: boolean;
  /** Suggested retry action */
  retryAction?: string;
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Operation start event
 */
export interface OperationStartEvent {
  /** Unique operation identifier */
  operationId: string;
  /** Type of operation */
  operationType: OperationType;
  /** Operation name/description */
  name: string;
  /** Timestamp when operation started */
  timestamp: Date;
  /** Estimated duration (milliseconds) */
  estimatedDuration?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Operation complete event
 */
export interface OperationCompleteEvent {
  /** Operation identifier */
  operationId: string;
  /** Type of operation */
  operationType: OperationType;
  /** Whether operation succeeded */
  success: boolean;
  /** Completion message */
  message: string;
  /** Timestamp when operation completed */
  timestamp: Date;
  /** Actual duration (milliseconds) */
  duration: number;
  /** Result data */
  result?: any;
  /** Error if failed */
  error?: string;
}

/**
 * Aggregated progress state for multiple operations
 */
export interface AggregatedProgress {
  /** Overall progress percentage (0-100) */
  overallPercent: number;
  /** Current active operation */
  currentOperation?: OperationStartEvent;
  /** List of all operations */
  operations: OperationProgress[];
  /** Total operations */
  totalOperations: number;
  /** Completed operations */
  completedOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Current phase of overall process */
  phase: ProgressPhase;
  /** Estimated time remaining for all operations (milliseconds) */
  estimatedTimeRemaining?: number;
  /** Start time of first operation */
  startTime?: Date;
}

/**
 * Individual operation progress within aggregated view
 */
export interface OperationProgress {
  /** Operation identifier */
  operationId: string;
  /** Type of operation */
  operationType: OperationType;
  /** Operation name */
  name: string;
  /** Current phase */
  phase: ProgressPhase;
  /** Progress percentage (0-100) */
  percent: number;
  /** Current status message */
  message: string;
  /** Start time */
  startTime: Date;
  /** End time (if completed) */
  endTime?: Date;
  /** Error information (if failed) */
  error?: string;
  /** Whether this operation succeeded */
  success?: boolean;
}

/**
 * Progress update callback type
 */
export type ProgressUpdateCallback = (event: ProgressEvent) => void;

/**
 * Console output callback type
 */
export type ConsoleOutputCallback = (event: ConsoleOutputEvent) => void;

/**
 * Error callback type
 */
export type ErrorCallback = (event: ErrorEvent) => void;

/**
 * Operation lifecycle callbacks
 */
export interface OperationCallbacks {
  /** Called when operation starts */
  onStart?: (event: OperationStartEvent) => void;
  /** Called on progress updates */
  onProgress?: ProgressUpdateCallback;
  /** Called for console output */
  onConsoleOutput?: ConsoleOutputCallback;
  /** Called on errors */
  onError?: ErrorCallback;
  /** Called when operation completes */
  onComplete?: (event: OperationCompleteEvent) => void;
}

/**
 * Progress tracking options
 */
export interface ProgressTrackingOptions {
  /** Throttle progress updates (milliseconds) */
  throttleInterval?: number;
  /** Enable console output capture */
  captureConsoleOutput?: boolean;
  /** Maximum console output lines to keep */
  maxConsoleLines?: number;
  /** Enable automatic time estimation */
  enableTimeEstimation?: boolean;
}

/**
 * Log entry for export functionality
 */
export interface LogEntry {
  /** Timestamp of log entry */
  timestamp: Date;
  /** Operation ID */
  operationId: string;
  /** Operation type */
  operationType: OperationType;
  /** Log level/severity */
  severity: ProgressSeverity;
  /** Log message */
  message: string;
  /** Additional data */
  data?: any;
}

/**
 * Log export format options
 */
export enum LogExportFormat {
  /** Plain text format */
  TEXT = 'text',
  /** JSON format */
  JSON = 'json',
  /** CSV format */
  CSV = 'csv',
  /** HTML format */
  HTML = 'html',
}

/**
 * Log export options
 */
export interface LogExportOptions {
  /** Export format */
  format: LogExportFormat;
  /** Filter by operation type */
  operationType?: OperationType;
  /** Filter by severity */
  severity?: ProgressSeverity;
  /** Filter by time range */
  startTime?: Date;
  /** Filter by time range */
  endTime?: Date;
  /** Include console output */
  includeConsoleOutput?: boolean;
}
