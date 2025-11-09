/**
 * IPC Type Definitions
 * Type-safe IPC channel definitions for repository and build operations
 */

import {
  CloneOptions,
  RepositoryProgress,
  RepoStatus,
  CommitInfo,
} from './repository';

import {
  NpmOptions,
  NpmBuildOptions,
  DockerBuildOptions,
  CustomScriptOptions,
  BuildStep,
  BuildChainConfig,
  BuildChainResult,
} from './build';

/**
 * IPC Channel Names
 * Centralized definition of all IPC channel names for type safety
 */
export const IPC_CHANNELS = {
  // Repository channels
  REPOSITORY: {
    CLONE: 'repository:clone',
    CHECKOUT_VERSION: 'repository:checkout-version',
    GET_STATUS: 'repository:get-status',
    GET_CURRENT_BRANCH: 'repository:get-current-branch',
    LIST_BRANCHES: 'repository:list-branches',
    GET_LATEST_COMMIT: 'repository:get-latest-commit',
    CANCEL: 'repository:cancel',
    PROGRESS: 'repository:progress',
  },
  // Build channels
  BUILD: {
    NPM_INSTALL: 'build:npm-install',
    NPM_BUILD: 'build:npm-build',
    DOCKER_BUILD: 'build:docker-build',
    EXECUTE_CHAIN: 'build:execute-chain',
    EXECUTE_CUSTOM_SCRIPT: 'build:execute-custom-script',
    CANCEL: 'build:cancel',
    PROGRESS: 'build:progress',
  },
  // Pipeline channels
  PIPELINE: {
    EXECUTE: 'pipeline:execute',
    CANCEL: 'pipeline:cancel',
    GET_STATUS: 'pipeline:get-status',
    PROGRESS: 'pipeline:progress',
  },
} as const;

/**
 * Repository IPC Request/Response Types
 */

export interface RepositoryCloneRequest {
  url: string;
  targetPath: string;
  options?: CloneOptions;
}

export interface RepositoryCloneResponse {
  success: boolean;
  message: string;
  path?: string;
  error?: string;
}

export interface RepositoryCheckoutRequest {
  repoPath: string;
  version: string;
}

export interface RepositoryCheckoutResponse {
  success: boolean;
  message: string;
  version?: string;
  error?: string;
}

export interface RepositoryStatusRequest {
  repoPath: string;
}

export interface RepositoryStatusResponse {
  success: boolean;
  status?: RepoStatus;
  error?: string;
}

export interface RepositoryBranchRequest {
  repoPath: string;
}

export interface RepositoryBranchResponse {
  success: boolean;
  branch?: string;
  branches?: string[];
  error?: string;
}

export interface RepositoryCommitRequest {
  repoPath: string;
  ref?: string;
}

export interface RepositoryCommitResponse {
  success: boolean;
  commit?: CommitInfo;
  error?: string;
}

export interface RepositoryCancelResponse {
  success: boolean;
  message: string;
}

/**
 * Build IPC Request/Response Types
 */

export interface BuildNpmInstallRequest {
  repoPath: string;
  options?: NpmOptions;
}

export interface BuildNpmInstallResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface BuildNpmBuildRequest {
  repoPath: string;
  buildScript?: string;
  options?: NpmBuildOptions;
}

export interface BuildNpmBuildResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface BuildDockerBuildRequest {
  dockerfile: string;
  imageName: string;
  options?: DockerBuildOptions;
}

export interface BuildDockerBuildResponse {
  success: boolean;
  message: string;
  imageName?: string;
  error?: string;
}

export interface BuildExecuteChainRequest {
  steps: BuildStep[];
  config?: Partial<BuildChainConfig>;
}

export interface BuildExecuteChainResponse {
  success: boolean;
  result?: BuildChainResult;
  error?: string;
}

export interface BuildExecuteCustomScriptRequest {
  command: string;
  options?: CustomScriptOptions;
}

export interface BuildExecuteCustomScriptResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface BuildCancelResponse {
  success: boolean;
  message: string;
}

/**
 * Pipeline IPC Request/Response Types
 */

export interface PipelineExecuteRequest {
  configPath: string;
  options?: {
    selectedComponents?: string[];
    skipClone?: boolean;
    skipBuild?: boolean;
    skipDocker?: boolean;
    skipVerification?: boolean;
    force?: boolean;
    workingDirectory?: string;
  };
}

export interface PipelineExecuteResponse {
  success: boolean;
  message: string;
  result?: {
    phase: string;
    clonedRepositories: string[];
    builtRepositories: string[];
    dockerImages: string[];
    verifiedArtifacts: string[];
    errors: Array<{
      phase: string;
      component: string;
      error: string;
    }>;
    duration: number;
  };
  error?: string;
}

export interface PipelineCancelResponse {
  success: boolean;
  message: string;
}

export interface PipelineStatusRequest {
  // No parameters needed
}

export interface PipelineStatusResponse {
  success: boolean;
  phase: string;
  message?: string;
}

/**
 * Progress Event Types
 */

export interface RepositoryProgressEvent extends RepositoryProgress {
  timestamp: number;
}

export interface BuildProgressEvent {
  message: string;
  percent: number;
  step: string;
  currentStep?: number;
  totalSteps?: number;
  stdout?: string;
  stderr?: string;
  timestamp: number;
}

/**
 * Progress Callback Types for IPC
 */

export type RepositoryProgressCallback = (progress: RepositoryProgressEvent) => void;
export type BuildProgressCallbackIPC = (progress: BuildProgressEvent) => void;

/**
 * Throttled Progress Manager
 * Manages progress event throttling to limit events to max 10 per second
 */
export class ProgressThrottler {
  private lastEmitTime: number = 0;
  private readonly minInterval: number;
  private pendingProgress: any = null;
  private pendingTimeout: NodeJS.Timeout | null = null;

  /**
   * Create a new progress throttler
   * @param eventsPerSecond Maximum number of events per second (default: 10)
   */
  constructor(eventsPerSecond: number = 10) {
    this.minInterval = 1000 / eventsPerSecond;
  }

  /**
   * Emit a progress event with throttling
   * @param progress Progress data to emit
   * @param callback Callback to invoke with throttled progress
   */
  emit(progress: any, callback: (progress: any) => void): void {
    const now = Date.now();
    const timeSinceLastEmit = now - this.lastEmitTime;

    // Clear any pending timeout
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    // If enough time has passed, emit immediately
    if (timeSinceLastEmit >= this.minInterval) {
      this.lastEmitTime = now;
      callback({ ...progress, timestamp: now });
    } else {
      // Store pending progress and schedule emission
      this.pendingProgress = progress;
      const delay = this.minInterval - timeSinceLastEmit;

      this.pendingTimeout = setTimeout(() => {
        this.lastEmitTime = Date.now();
        callback({ ...this.pendingProgress, timestamp: this.lastEmitTime });
        this.pendingProgress = null;
        this.pendingTimeout = null;
      }, delay);
    }
  }

  /**
   * Force emit any pending progress immediately
   */
  flush(callback: (progress: any) => void): void {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    if (this.pendingProgress) {
      this.lastEmitTime = Date.now();
      callback({ ...this.pendingProgress, timestamp: this.lastEmitTime });
      this.pendingProgress = null;
    }
  }

  /**
   * Clear any pending progress without emitting
   */
  clear(): void {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    this.pendingProgress = null;
  }
}

/**
 * Type guard helpers
 */

export function isRepositoryProgressEvent(event: any): event is RepositoryProgressEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    typeof event.message === 'string' &&
    typeof event.percent === 'number' &&
    typeof event.step === 'string' &&
    typeof event.status === 'string' &&
    typeof event.timestamp === 'number'
  );
}

export function isBuildProgressEvent(event: any): event is BuildProgressEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    typeof event.message === 'string' &&
    typeof event.percent === 'number' &&
    typeof event.step === 'string' &&
    typeof event.timestamp === 'number'
  );
}
