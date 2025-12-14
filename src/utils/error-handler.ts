/**
 * Error Handler Utility
 * Provides comprehensive error handling, classification, and recovery strategies
 * for build automation operations
 */

import logger, { logWithCategory, LogCategory } from '../main/logger';

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  RESOURCE = 'RESOURCE',
  VALIDATION = 'VALIDATION',
  DEPENDENCY = 'DEPENDENCY',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
  CONFIG = "CONFIG",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Retry behavior options
 */
export enum RetryBehavior {
  RETRY = 'RETRY',
  RETRY_WITH_BACKOFF = 'RETRY_WITH_BACKOFF',
  NO_RETRY = 'NO_RETRY',
  USER_INTERVENTION = 'USER_INTERVENTION',
}

/**
 * Recovery actions
 */
export enum RecoveryAction {
  RETRY = 'RETRY',
  SKIP = 'SKIP',
  ROLLBACK = 'ROLLBACK',
  USER_INPUT = 'USER_INPUT',
  ABORT = 'ABORT',
}

/**
 * Comprehensive build error codes
 */
export enum BuildErrorCode {
  // Git errors (1000-1099)
  GIT_CLONE_FAILED = 1000,
  GIT_NETWORK_ERROR = 1001,
  GIT_AUTH_FAILED = 1002,
  GIT_NOT_FOUND = 1003,
  GIT_TIMEOUT = 1004,
  GIT_DISK_FULL = 1005,
  GIT_PERMISSION_DENIED = 1006,
  GIT_INVALID_URL = 1007,
  GIT_BRANCH_NOT_FOUND = 1008,
  GIT_SHALLOW_CLONE_FAILED = 1009,

  // NPM errors (2000-2099)
  NPM_INSTALL_FAILED = 2000,
  NPM_NETWORK_ERROR = 2001,
  NPM_REGISTRY_UNAVAILABLE = 2002,
  NPM_PACKAGE_NOT_FOUND = 2003,
  NPM_VERSION_CONFLICT = 2004,
  NPM_PEER_DEPENDENCY_ERROR = 2005,
  NPM_TIMEOUT = 2006,
  NPM_DISK_FULL = 2007,
  NPM_PERMISSION_DENIED = 2008,
  NPM_CORRUPTED_CACHE = 2009,
  NPM_BUILD_SCRIPT_FAILED = 2010,

  // Docker errors (3000-3099)
  DOCKER_BUILD_FAILED = 3000,
  DOCKER_DAEMON_NOT_RUNNING = 3001,
  DOCKER_IMAGE_NOT_FOUND = 3002,
  DOCKER_NETWORK_ERROR = 3003,
  DOCKER_DISK_FULL = 3004,
  DOCKER_PERMISSION_DENIED = 3005,
  DOCKER_TIMEOUT = 3006,
  DOCKER_INVALID_DOCKERFILE = 3007,
  DOCKER_BUILD_CONTEXT_ERROR = 3008,
  DOCKER_REGISTRY_ERROR = 3009,
  DOCKER_LAYER_PULL_FAILED = 3010,

  // System errors (4000-4099)
  SYSTEM_OUT_OF_MEMORY = 4000,
  SYSTEM_DISK_FULL = 4001,
  SYSTEM_PERMISSION_DENIED = 4002,
  SYSTEM_PROCESS_KILLED = 4003,
  SYSTEM_COMMAND_NOT_FOUND = 4004,
  SYSTEM_TIMEOUT = 4005,
  SYSTEM_RESOURCE_UNAVAILABLE = 4006,
  SYSTEM_UNKNOWN_ERROR = 4999,

  // Database/PostgreSQL errors (5000-5099)
  DB_CONNECTION_FAILED = 5000,
  DB_AUTH_FAILED = 5001,
  DB_SASL_AUTH_FAILED = 5002,
  DB_TIMEOUT = 5003,
  DB_NETWORK_ERROR = 5004,
  DB_POOL_EXHAUSTED = 5005,
  DB_QUERY_FAILED = 5006,
  DB_PERMISSION_DENIED = 5007,

  // MCP Server errors (5100-5199)
  MCP_CONNECTION_FAILED = 5100,
  MCP_TOOL_FAILED = 5101,
  MCP_AUTH_FAILED = 5102,
  MCP_TIMEOUT = 5103,
  MCP_SERVER_UNAVAILABLE = 5104,
  MCP_INVALID_RESPONSE = 5105,
}

/**
 * Error metadata for each error code
 */
export interface ErrorMetadata {
  code: BuildErrorCode;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryBehavior: RetryBehavior;
  userMessage: string;
  technicalMessage: string;
  suggestedActions: string[];
  recoveryActions: RecoveryAction[];
}

/**
 * Build error class with comprehensive metadata
 */
export class BuildError extends Error {
  public readonly code: BuildErrorCode;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly retryBehavior: RetryBehavior;
  public readonly userMessage: string;
  public readonly technicalMessage: string;
  public readonly suggestedActions: string[];
  public readonly recoveryActions: RecoveryAction[];
  public readonly originalError?: Error;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    metadata: ErrorMetadata,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(metadata.userMessage);
    this.name = 'BuildError';
    this.code = metadata.code;
    this.category = metadata.category;
    this.severity = metadata.severity;
    this.retryBehavior = metadata.retryBehavior;
    this.userMessage = metadata.userMessage;
    this.technicalMessage = metadata.technicalMessage;
    this.suggestedActions = metadata.suggestedActions;
    this.recoveryActions = metadata.recoveryActions;
    this.originalError = originalError;
    this.timestamp = new Date();
    this.context = context;

    // Maintain proper stack trace (only available in V8 environments like Node.js)
    if (typeof Error.captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, BuildError);
    }
  }

  /**
   * Get formatted error message for logging
   */
  getLogMessage(): string {
    return `[${this.code}] ${this.category} - ${this.technicalMessage}`;
  }

  /**
   * Get user-friendly error message with suggestions
   */
  getUserMessage(): string {
    let message = this.userMessage;
    if (this.suggestedActions.length > 0) {
      message += '\n\nSuggested actions:\n';
      this.suggestedActions.forEach((action, index) => {
        message += `${index + 1}. ${action}\n`;
      });
    }
    return message;
  }

  /**
   * Serialize error for IPC communication
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      retryBehavior: this.retryBehavior,
      userMessage: this.userMessage,
      technicalMessage: this.technicalMessage,
      suggestedActions: this.suggestedActions,
      recoveryActions: this.recoveryActions,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error metadata registry
 */
export const ERROR_METADATA_REGISTRY: Map<BuildErrorCode, ErrorMetadata> = new Map([
  // Git errors
  [
    BuildErrorCode.GIT_CLONE_FAILED,
    {
      code: BuildErrorCode.GIT_CLONE_FAILED,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Failed to clone repository',
      technicalMessage: 'Git clone operation failed',
      suggestedActions: [
        'Check your internet connection',
        'Verify the repository URL is correct',
        'Ensure you have access permissions',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.GIT_NETWORK_ERROR,
    {
      code: BuildErrorCode.GIT_NETWORK_ERROR,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Network error while accessing repository',
      technicalMessage: 'Network connection failed during git operation',
      suggestedActions: [
        'Check your internet connection',
        'Verify firewall settings allow Git traffic',
        'Try again in a few moments',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.GIT_AUTH_FAILED,
    {
      code: BuildErrorCode.GIT_AUTH_FAILED,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'Authentication failed for repository',
      technicalMessage: 'Git authentication credentials are invalid or missing',
      suggestedActions: [
        'Verify your credentials are correct',
        'Check if you have access to the repository',
        'Update your GitHub token or SSH keys',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.GIT_TIMEOUT,
    {
      code: BuildErrorCode.GIT_TIMEOUT,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Repository clone operation timed out',
      technicalMessage: 'Git operation exceeded timeout limit',
      suggestedActions: [
        'Check your internet connection speed',
        'Try cloning with --depth=1 for a shallow clone',
        'Increase timeout limit in settings',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.GIT_DISK_FULL,
    {
      code: BuildErrorCode.GIT_DISK_FULL,
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.CRITICAL,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'Insufficient disk space for repository',
      technicalMessage: 'Not enough disk space to clone repository',
      suggestedActions: [
        'Free up disk space',
        'Choose a different target directory',
        'Use shallow clone to reduce size',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],

  // NPM errors
  [
    BuildErrorCode.NPM_INSTALL_FAILED,
    {
      code: BuildErrorCode.NPM_INSTALL_FAILED,
      category: ErrorCategory.DEPENDENCY,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Failed to install npm dependencies',
      technicalMessage: 'npm install command failed',
      suggestedActions: [
        'Check the error output for specific package issues',
        'Try clearing npm cache: npm cache clean --force',
        'Delete node_modules and package-lock.json, then retry',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.NPM_NETWORK_ERROR,
    {
      code: BuildErrorCode.NPM_NETWORK_ERROR,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Network error while downloading packages',
      technicalMessage: 'npm registry connection failed',
      suggestedActions: [
        'Check your internet connection',
        'Verify npm registry is accessible',
        'Try using a different registry or mirror',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.NPM_PEER_DEPENDENCY_ERROR,
    {
      code: BuildErrorCode.NPM_PEER_DEPENDENCY_ERROR,
      category: ErrorCategory.DEPENDENCY,
      severity: ErrorSeverity.MEDIUM,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'Peer dependency conflict detected',
      technicalMessage: 'npm peer dependency requirements not satisfied',
      suggestedActions: [
        'Review package.json for version conflicts',
        'Try installing with --legacy-peer-deps flag',
        'Update conflicting packages to compatible versions',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.NPM_TIMEOUT,
    {
      code: BuildErrorCode.NPM_TIMEOUT,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'npm install operation timed out',
      technicalMessage: 'npm operation exceeded timeout limit',
      suggestedActions: [
        'Check your internet connection speed',
        'Increase npm timeout: npm config set timeout 120000',
        'Try again with a stable connection',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.NPM_BUILD_SCRIPT_FAILED,
    {
      code: BuildErrorCode.NPM_BUILD_SCRIPT_FAILED,
      category: ErrorCategory.DEPENDENCY,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'npm build script failed',
      technicalMessage: 'Build script execution failed during npm run',
      suggestedActions: [
        'Check build script output for specific errors',
        'Verify all build dependencies are installed',
        'Check package.json scripts configuration',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],

  // Docker errors
  [
    BuildErrorCode.DOCKER_BUILD_FAILED,
    {
      code: BuildErrorCode.DOCKER_BUILD_FAILED,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Docker build failed',
      technicalMessage: 'Docker build command failed',
      suggestedActions: [
        'Check Dockerfile syntax and instructions',
        'Review build logs for specific errors',
        'Ensure base images are accessible',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.DOCKER_DAEMON_NOT_RUNNING,
    {
      code: BuildErrorCode.DOCKER_DAEMON_NOT_RUNNING,
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.CRITICAL,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'Docker is not running',
      technicalMessage: 'Docker daemon is not accessible',
      suggestedActions: [
        'Start Docker Desktop',
        'Verify Docker service is running',
        'Check Docker installation',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.DOCKER_NETWORK_ERROR,
    {
      code: BuildErrorCode.DOCKER_NETWORK_ERROR,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Network error during Docker operation',
      technicalMessage: 'Docker network operation failed',
      suggestedActions: [
        'Check your internet connection',
        'Verify Docker registry is accessible',
        'Check firewall settings',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.DOCKER_DISK_FULL,
    {
      code: BuildErrorCode.DOCKER_DISK_FULL,
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.CRITICAL,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'Insufficient disk space for Docker build',
      technicalMessage: 'Not enough disk space for Docker operation',
      suggestedActions: [
        'Free up disk space',
        'Clean up unused Docker images: docker system prune',
        'Increase Docker disk allocation',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.DOCKER_TIMEOUT,
    {
      code: BuildErrorCode.DOCKER_TIMEOUT,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Docker operation timed out',
      technicalMessage: 'Docker build exceeded timeout limit',
      suggestedActions: [
        'Check your internet connection for image pulls',
        'Increase timeout limit for large builds',
        'Optimize Dockerfile for faster builds',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.ABORT],
    },
  ],

  // System errors
  [
    BuildErrorCode.SYSTEM_OUT_OF_MEMORY,
    {
      code: BuildErrorCode.SYSTEM_OUT_OF_MEMORY,
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.CRITICAL,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'System ran out of memory',
      technicalMessage: 'Insufficient system memory for operation',
      suggestedActions: [
        'Close other applications to free memory',
        'Increase system RAM',
        'Reduce build parallelism',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.SYSTEM_DISK_FULL,
    {
      code: BuildErrorCode.SYSTEM_DISK_FULL,
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.CRITICAL,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'Disk is full',
      technicalMessage: 'Insufficient disk space for operation',
      suggestedActions: [
        'Free up disk space',
        'Choose a different target directory',
        'Clean up temporary files',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.SYSTEM_PERMISSION_DENIED,
    {
      code: BuildErrorCode.SYSTEM_PERMISSION_DENIED,
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'Permission denied',
      technicalMessage: 'Insufficient permissions for operation',
      suggestedActions: [
        'Check file/directory permissions',
        'Run with appropriate permissions',
        'Verify user has access rights',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.SYSTEM_TIMEOUT,
    {
      code: BuildErrorCode.SYSTEM_TIMEOUT,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Operation timed out',
      technicalMessage: 'System operation exceeded timeout limit',
      suggestedActions: [
        'Increase timeout limit',
        'Check system resources',
        'Retry the operation',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.SYSTEM_UNKNOWN_ERROR,
    {
      code: BuildErrorCode.SYSTEM_UNKNOWN_ERROR,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.RETRY,
      userMessage: 'An unexpected error occurred',
      technicalMessage: 'Unknown system error',
      suggestedActions: [
        'Check the error logs for details',
        'Retry the operation',
        'Contact support if the issue persists',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.ABORT],
    },
  ],

  // Database errors
  [
    BuildErrorCode.DB_CONNECTION_FAILED,
    {
      code: BuildErrorCode.DB_CONNECTION_FAILED,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Failed to connect to the database',
      technicalMessage: 'Database connection failed',
      suggestedActions: [
        'Check that PostgreSQL container is running: docker ps | grep postgres',
        'Verify database credentials in environment configuration',
        'Restart the FictionLab system from the Dashboard',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.DB_AUTH_FAILED,
    {
      code: BuildErrorCode.DB_AUTH_FAILED,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.CRITICAL,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'Database authentication failed',
      technicalMessage: 'PostgreSQL authentication credentials invalid',
      suggestedActions: [
        'Verify database password in Setup Wizard → Environment Configuration',
        'Check PostgreSQL logs: docker logs fictionlab-postgres',
        'Reset database credentials and restart the system',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.DB_SASL_AUTH_FAILED,
    {
      code: BuildErrorCode.DB_SASL_AUTH_FAILED,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.CRITICAL,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'Database SASL authentication failed',
      technicalMessage: 'PostgreSQL SASL/SCRAM authentication failed - credentials may be incorrect or auth method mismatch',
      suggestedActions: [
        'Linux users: Run diagnostic script: ./linux-db-diagnostic.sh',
        'Check MCP container logs: docker logs fictionlab-mcp-servers',
        'Verify environment variables: docker exec fictionlab-mcp-servers env | grep POSTGRES',
        'Ensure PostgreSQL is using scram-sha-256 auth method',
        'Restart Docker services: docker compose down && docker compose up -d',
        'See LINUX_DB_FIX.md for detailed troubleshooting steps',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.DB_TIMEOUT,
    {
      code: BuildErrorCode.DB_TIMEOUT,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Database query timed out',
      technicalMessage: 'Database operation exceeded timeout limit',
      suggestedActions: [
        'Check database performance and load',
        'Verify network connectivity to PostgreSQL container',
        'Consider increasing query timeout in configuration',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.DB_NETWORK_ERROR,
    {
      code: BuildErrorCode.DB_NETWORK_ERROR,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Database network error',
      technicalMessage: 'Network connection to database failed',
      suggestedActions: [
        'Check Docker network: docker network ls',
        'Verify containers can communicate: docker exec fictionlab-mcp-servers ping fictionlab-postgres',
        'Restart Docker services to recreate network',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.DB_POOL_EXHAUSTED,
    {
      code: BuildErrorCode.DB_POOL_EXHAUSTED,
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Database connection pool exhausted',
      technicalMessage: 'All database connections in use',
      suggestedActions: [
        'Check active connections: docker exec fictionlab-postgres psql -U writer -d mcp_writing_db -c "SELECT count(*) FROM pg_stat_activity;"',
        'Increase max_connections in PostgreSQL configuration',
        'Enable PgBouncer connection pooling',
        'Close unused connections or restart services',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],

  // MCP Server errors
  [
    BuildErrorCode.MCP_CONNECTION_FAILED,
    {
      code: BuildErrorCode.MCP_CONNECTION_FAILED,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'Failed to connect to MCP server',
      technicalMessage: 'MCP server connection failed',
      suggestedActions: [
        'Check MCP containers: docker ps | grep mcp',
        'Verify MCP Connector is running on correct port',
        'Check MCP server logs: docker logs fictionlab-mcp-servers',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.MCP_TOOL_FAILED,
    {
      code: BuildErrorCode.MCP_TOOL_FAILED,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      retryBehavior: RetryBehavior.RETRY,
      userMessage: 'MCP tool execution failed',
      technicalMessage: 'MCP tool call returned an error',
      suggestedActions: [
        'Check MCP server logs for tool-specific errors',
        'Verify tool parameters are correct',
        'Ensure required database tables exist',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.MCP_AUTH_FAILED,
    {
      code: BuildErrorCode.MCP_AUTH_FAILED,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.USER_INTERVENTION,
      userMessage: 'MCP authentication failed',
      technicalMessage: 'MCP auth token invalid or missing',
      suggestedActions: [
        'Verify MCP_AUTH_TOKEN in environment configuration',
        'Ensure token matches in both client and server',
        'Regenerate token in Setup Wizard if needed',
      ],
      recoveryActions: [RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
  [
    BuildErrorCode.MCP_SERVER_UNAVAILABLE,
    {
      code: BuildErrorCode.MCP_SERVER_UNAVAILABLE,
      category: ErrorCategory.RESOURCE,
      severity: ErrorSeverity.HIGH,
      retryBehavior: RetryBehavior.RETRY_WITH_BACKOFF,
      userMessage: 'MCP server is unavailable',
      technicalMessage: 'MCP server not responding or not running',
      suggestedActions: [
        'Check if MCP containers are running: docker ps',
        'Restart MCP services from Dashboard',
        'Check container health: docker inspect fictionlab-mcp-servers',
      ],
      recoveryActions: [RecoveryAction.RETRY, RecoveryAction.USER_INPUT, RecoveryAction.ABORT],
    },
  ],
]);

/**
 * ErrorHandler class for classifying and handling errors
 */
export class ErrorHandler {
  /**
   * Classify a raw error into a BuildError
   */
  static classify(error: any, context?: Record<string, any>): BuildError {
    // If already a BuildError, return as-is
    if (error instanceof BuildError) {
      return error;
    }

    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || '';

    // Attempt to match error to known patterns
    const errorCode = this.detectErrorCode(errorMessage, errorStack);
    const metadata = ERROR_METADATA_REGISTRY.get(errorCode);

    if (metadata) {
      return new BuildError(metadata, error, context);
    }

    // Default unknown error
    const unknownMetadata = ERROR_METADATA_REGISTRY.get(BuildErrorCode.SYSTEM_UNKNOWN_ERROR)!;
    return new BuildError(
      {
        ...unknownMetadata,
        technicalMessage: errorMessage,
        userMessage: `An unexpected error occurred: ${errorMessage}`,
      },
      error,
      context
    );
  }

  /**
   * Detect error code from error message
   */
  private static detectErrorCode(message: string, stack: string): BuildErrorCode {
    const lowerMessage = message.toLowerCase();

    // Database/PostgreSQL errors (check first as they're critical)
    if (lowerMessage.includes('sasl') && lowerMessage.includes('auth')) {
      return BuildErrorCode.DB_SASL_AUTH_FAILED;
    }
    if (lowerMessage.includes('postgres') || lowerMessage.includes('pg_') || lowerMessage.includes('database')) {
      if (lowerMessage.includes('auth') || lowerMessage.includes('password') || lowerMessage.includes('credential')) {
        return BuildErrorCode.DB_AUTH_FAILED;
      }
      if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
        return BuildErrorCode.DB_TIMEOUT;
      }
      if (lowerMessage.includes('connection') && (lowerMessage.includes('refused') || lowerMessage.includes('failed'))) {
        return BuildErrorCode.DB_CONNECTION_FAILED;
      }
      if (lowerMessage.includes('network') || lowerMessage.includes('enotfound') || lowerMessage.includes('could not resolve')) {
        return BuildErrorCode.DB_NETWORK_ERROR;
      }
      if (lowerMessage.includes('pool') || lowerMessage.includes('max connections') || lowerMessage.includes('too many connections')) {
        return BuildErrorCode.DB_POOL_EXHAUSTED;
      }
      if (lowerMessage.includes('permission denied') || lowerMessage.includes('access denied')) {
        return BuildErrorCode.DB_PERMISSION_DENIED;
      }
      return BuildErrorCode.DB_CONNECTION_FAILED;
    }

    // MCP errors
    if (lowerMessage.includes('mcp')) {
      if (lowerMessage.includes('auth') || lowerMessage.includes('token')) {
        return BuildErrorCode.MCP_AUTH_FAILED;
      }
      if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
        return BuildErrorCode.MCP_TIMEOUT;
      }
      if (lowerMessage.includes('unavailable') || lowerMessage.includes('not running') || lowerMessage.includes('not responding')) {
        return BuildErrorCode.MCP_SERVER_UNAVAILABLE;
      }
      if (lowerMessage.includes('connection') && lowerMessage.includes('fail')) {
        return BuildErrorCode.MCP_CONNECTION_FAILED;
      }
      if (lowerMessage.includes('tool') && lowerMessage.includes('fail')) {
        return BuildErrorCode.MCP_TOOL_FAILED;
      }
      return BuildErrorCode.MCP_CONNECTION_FAILED;
    }

    // Git errors
    if (lowerMessage.includes('git')) {
      if (lowerMessage.includes('authentication') || lowerMessage.includes('403') || lowerMessage.includes('401')) {
        return BuildErrorCode.GIT_AUTH_FAILED;
      }
      if (lowerMessage.includes('network') || lowerMessage.includes('could not resolve host')) {
        return BuildErrorCode.GIT_NETWORK_ERROR;
      }
      if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
        return BuildErrorCode.GIT_TIMEOUT;
      }
      if (lowerMessage.includes('disk') || lowerMessage.includes('no space left')) {
        return BuildErrorCode.GIT_DISK_FULL;
      }
      if (lowerMessage.includes('permission denied') || lowerMessage.includes('eacces')) {
        return BuildErrorCode.GIT_PERMISSION_DENIED;
      }
      if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
        return BuildErrorCode.GIT_NOT_FOUND;
      }
      if (lowerMessage.includes('invalid') && lowerMessage.includes('url')) {
        return BuildErrorCode.GIT_INVALID_URL;
      }
      return BuildErrorCode.GIT_CLONE_FAILED;
    }

    // NPM errors
    if (lowerMessage.includes('npm')) {
      if (lowerMessage.includes('network') || lowerMessage.includes('enotfound') || lowerMessage.includes('etimedout')) {
        return BuildErrorCode.NPM_NETWORK_ERROR;
      }
      if (lowerMessage.includes('peer') && lowerMessage.includes('dependency')) {
        return BuildErrorCode.NPM_PEER_DEPENDENCY_ERROR;
      }
      if (lowerMessage.includes('timeout')) {
        return BuildErrorCode.NPM_TIMEOUT;
      }
      if (lowerMessage.includes('disk') || lowerMessage.includes('enospc')) {
        return BuildErrorCode.NPM_DISK_FULL;
      }
      if (lowerMessage.includes('permission') || lowerMessage.includes('eacces')) {
        return BuildErrorCode.NPM_PERMISSION_DENIED;
      }
      if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
        return BuildErrorCode.NPM_PACKAGE_NOT_FOUND;
      }
      if (lowerMessage.includes('build') && lowerMessage.includes('script')) {
        return BuildErrorCode.NPM_BUILD_SCRIPT_FAILED;
      }
      return BuildErrorCode.NPM_INSTALL_FAILED;
    }

    // Docker errors
    if (lowerMessage.includes('docker')) {
      if (lowerMessage.includes('daemon') || lowerMessage.includes('not running') || lowerMessage.includes('cannot connect')) {
        return BuildErrorCode.DOCKER_DAEMON_NOT_RUNNING;
      }
      if (lowerMessage.includes('network') || lowerMessage.includes('timeout')) {
        return BuildErrorCode.DOCKER_NETWORK_ERROR;
      }
      if (lowerMessage.includes('disk') || lowerMessage.includes('no space')) {
        return BuildErrorCode.DOCKER_DISK_FULL;
      }
      if (lowerMessage.includes('permission') || lowerMessage.includes('denied')) {
        return BuildErrorCode.DOCKER_PERMISSION_DENIED;
      }
      if (lowerMessage.includes('image') && lowerMessage.includes('not found')) {
        return BuildErrorCode.DOCKER_IMAGE_NOT_FOUND;
      }
      if (lowerMessage.includes('dockerfile')) {
        return BuildErrorCode.DOCKER_INVALID_DOCKERFILE;
      }
      return BuildErrorCode.DOCKER_BUILD_FAILED;
    }

    // System errors
    if (lowerMessage.includes('memory') || lowerMessage.includes('enomem')) {
      return BuildErrorCode.SYSTEM_OUT_OF_MEMORY;
    }
    if (lowerMessage.includes('disk') || lowerMessage.includes('enospc') || lowerMessage.includes('no space')) {
      return BuildErrorCode.SYSTEM_DISK_FULL;
    }
    if (lowerMessage.includes('permission') || lowerMessage.includes('eacces') || lowerMessage.includes('denied')) {
      return BuildErrorCode.SYSTEM_PERMISSION_DENIED;
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return BuildErrorCode.SYSTEM_TIMEOUT;
    }

    return BuildErrorCode.SYSTEM_UNKNOWN_ERROR;
  }

  /**
   * Determine if an error should be retried
   */
  static shouldRetry(error: BuildError): boolean {
    return (
      error.retryBehavior === RetryBehavior.RETRY ||
      error.retryBehavior === RetryBehavior.RETRY_WITH_BACKOFF
    );
  }

  /**
   * Determine if exponential backoff should be used
   */
  static useBackoff(error: BuildError): boolean {
    return error.retryBehavior === RetryBehavior.RETRY_WITH_BACKOFF;
  }

  /**
   * Get recovery strategy for an error
   */
  static getRecoveryStrategy(error: BuildError): RecoveryAction[] {
    return error.recoveryActions;
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: BuildError): void {
    const logMessage = error.getLogMessage();
    const category = this.getCategoryForLogging(error.category);

    switch (error.severity) {
      case ErrorSeverity.LOW:
        logWithCategory('warn', category, logMessage, {
          code: error.code,
          context: error.context,
          stack: error.stack,
        });
        break;
      case ErrorSeverity.MEDIUM:
        logWithCategory('error', category, logMessage, {
          code: error.code,
          context: error.context,
          stack: error.stack,
        });
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        logWithCategory('error', category, logMessage, {
          code: error.code,
          context: error.context,
          stack: error.stack,
          suggestedActions: error.suggestedActions,
        });
        break;
    }
  }

  /**
   * Map error category to log category
   */
  private static getCategoryForLogging(category: ErrorCategory): LogCategory {
    switch (category) {
      case ErrorCategory.NETWORK:
        return LogCategory.GENERAL;
      case ErrorCategory.AUTHENTICATION:
        return LogCategory.ERROR;
      case ErrorCategory.PERMISSION:
        return LogCategory.ERROR;
      case ErrorCategory.RESOURCE:
        return LogCategory.ERROR;
      case ErrorCategory.VALIDATION:
        return LogCategory.ERROR;
      case ErrorCategory.DEPENDENCY:
        return LogCategory.GENERAL;
      case ErrorCategory.TIMEOUT:
        return LogCategory.ERROR;
      case ErrorCategory.CONFIG:
        return LogCategory.CONFIG;
      default:
        return LogCategory.ERROR;
    }
  }

  /**
   * Create a BuildError from an error code
   */
  static createError(
    code: BuildErrorCode,
    originalError?: Error,
    context?: Record<string, any>
  ): BuildError {
    const metadata = ERROR_METADATA_REGISTRY.get(code);
    if (!metadata) {
      throw new Error(`Unknown error code: ${code}`);
    }
    return new BuildError(metadata, originalError, context);
  }
}
