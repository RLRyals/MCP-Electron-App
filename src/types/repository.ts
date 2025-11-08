/**
 * Repository Manager Type Definitions
 * Types for managing Git repository operations
 */

/**
 * Clone options for repository operations
 */
export interface CloneOptions {
  /** Branch to checkout (default: main) */
  branch?: string;
  /** Clone depth for shallow clone (default: full clone) */
  depth?: number;
  /** Enable sparse checkout with specific paths */
  sparseCheckoutPaths?: string[];
  /** Progress callback for clone operations */
  onProgress?: ProgressCallback;
  /** Timeout in milliseconds (default: 300000 - 5 minutes) */
  timeout?: number;
  /** Use SSH instead of HTTPS (default: false) */
  useSsh?: boolean;
  /** Credentials for private repositories */
  credentials?: GitCredentials;
}

/**
 * Git credentials for authentication
 */
export interface GitCredentials {
  /** Username for HTTPS authentication */
  username?: string;
  /** Personal access token or password */
  token?: string;
  /** SSH key path for SSH authentication */
  sshKeyPath?: string;
}

/**
 * Progress callback for repository operations
 */
export type ProgressCallback = (progress: RepositoryProgress) => void;

/**
 * Progress update interface
 */
export interface RepositoryProgress {
  /** Progress message */
  message: string;
  /** Progress percentage (0-100) */
  percent: number;
  /** Current operation step */
  step: string;
  /** Operation status */
  status: 'initializing' | 'cloning' | 'checking-out' | 'complete' | 'error';
  /** Number of bytes received (optional) */
  bytesReceived?: number;
  /** Total bytes to receive (optional) */
  totalBytes?: number;
}

/**
 * Repository status information
 */
export interface RepoStatus {
  /** Whether the repository exists at the path */
  exists: boolean;
  /** Whether the path is a valid Git repository */
  isGitRepo: boolean;
  /** Current branch name */
  currentBranch?: string;
  /** Current commit hash (HEAD) */
  currentCommit?: string;
  /** Remote URL (origin) */
  remoteUrl?: string;
  /** Whether the working directory is clean */
  isClean?: boolean;
  /** Number of untracked files */
  untrackedFiles?: number;
  /** Number of modified files */
  modifiedFiles?: number;
  /** Number of staged files */
  stagedFiles?: number;
  /** Latest commit information */
  latestCommit?: CommitInfo;
  /** Error message if status check failed */
  error?: string;
}

/**
 * Commit information
 */
export interface CommitInfo {
  /** Commit hash */
  hash: string;
  /** Short commit hash (7 chars) */
  shortHash: string;
  /** Commit message */
  message: string;
  /** Author name */
  author: string;
  /** Author email */
  email: string;
  /** Commit date */
  date: Date;
}

/**
 * Repository operation result
 */
export interface RepositoryResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Result message */
  message: string;
  /** Repository path (for clone operations) */
  path?: string;
  /** Commit hash or version (for checkout operations) */
  version?: string;
  /** Error message if operation failed */
  error?: string;
  /** Additional error details */
  errorDetails?: any;
}

/**
 * Sparse checkout configuration
 */
export interface SparseCheckoutConfig {
  /** Paths to include in sparse checkout */
  paths: string[];
  /** Whether to use cone mode (default: true) */
  coneMode?: boolean;
}

/**
 * Repository metadata for tracking
 */
export interface RepositoryMetadata {
  /** Repository URL */
  url: string;
  /** Local path */
  path: string;
  /** Current branch */
  branch: string;
  /** Current commit hash */
  commit: string;
  /** Clone date */
  clonedAt: Date;
  /** Last update date */
  lastUpdated?: Date;
  /** Whether sparse checkout is enabled */
  isSparseCheckout?: boolean;
  /** Sparse checkout paths if enabled */
  sparseCheckoutPaths?: string[];
}

/**
 * Error types for repository operations
 */
export enum RepositoryErrorType {
  GIT_NOT_INSTALLED = 'GIT_NOT_INSTALLED',
  INVALID_URL = 'INVALID_URL',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  DISK_SPACE_ERROR = 'DISK_SPACE_ERROR',
  PATH_EXISTS = 'PATH_EXISTS',
  PATH_NOT_FOUND = 'PATH_NOT_FOUND',
  NOT_A_GIT_REPO = 'NOT_A_GIT_REPO',
  INVALID_BRANCH = 'INVALID_BRANCH',
  INVALID_COMMIT = 'INVALID_COMMIT',
  TIMEOUT = 'TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Repository error class
 */
export class RepositoryError extends Error {
  constructor(
    public type: RepositoryErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}
