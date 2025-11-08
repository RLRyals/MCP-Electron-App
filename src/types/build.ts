/**
 * Type definitions for the Build Orchestrator system
 * Defines interfaces and types for build operations, npm commands, and Docker builds
 */

/**
 * Build step types
 */
export enum BuildStepType {
  NPM_INSTALL = 'npm_install',
  NPM_BUILD = 'npm_build',
  DOCKER_BUILD = 'docker_build',
  CUSTOM_SCRIPT = 'custom_script',
}

/**
 * Build step status
 */
export enum BuildStepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * Progress callback for build operations
 */
export type BuildProgressCallback = (progress: {
  message: string;
  percent: number;
  step: string;
  currentStep?: number;
  totalSteps?: number;
  stdout?: string;
  stderr?: string;
}) => void;

/**
 * Options for npm install command
 */
export interface NpmOptions {
  /** Working directory for npm command */
  cwd?: string;
  /** Use production mode (no devDependencies) */
  production?: boolean;
  /** Use legacy peer dependencies */
  legacyPeerDeps?: boolean;
  /** Clean install (remove node_modules first) */
  clean?: boolean;
  /** Additional npm flags */
  flags?: string[];
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables to pass to npm */
  env?: Record<string, string>;
}

/**
 * Options for npm build command
 */
export interface NpmBuildOptions {
  /** Working directory for npm command */
  cwd?: string;
  /** Build script name (defaults to 'build') */
  script?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables to pass to npm */
  env?: Record<string, string>;
  /** Additional npm flags */
  flags?: string[];
}

/**
 * Options for docker build command
 */
export interface DockerBuildOptions {
  /** Working directory containing Dockerfile */
  cwd?: string;
  /** Path to Dockerfile (relative to cwd) */
  dockerfile?: string;
  /** Build arguments to pass to docker build */
  buildArgs?: Record<string, string>;
  /** Tags for the image */
  tags?: string[];
  /** Target stage for multi-stage builds */
  target?: string;
  /** Platform to build for (e.g., linux/amd64) */
  platform?: string;
  /** Do not use cache when building */
  noCache?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Additional docker build flags */
  flags?: string[];
}

/**
 * Custom script execution options
 */
export interface CustomScriptOptions {
  /** Working directory for script execution */
  cwd?: string;
  /** Shell to use (bash, sh, powershell, etc.) */
  shell?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables to pass to script */
  env?: Record<string, string>;
}

/**
 * Build step definition
 */
export interface BuildStep {
  /** Unique identifier for the step */
  id: string;
  /** Human-readable name for the step */
  name: string;
  /** Type of build step */
  type: BuildStepType;
  /** Current status of the step */
  status: BuildStepStatus;
  /** Configuration for the step */
  config: NpmOptions | NpmBuildOptions | DockerBuildOptions | CustomScriptOptions;
  /** Custom script command (only for CUSTOM_SCRIPT type) */
  command?: string;
  /** Dependencies - IDs of steps that must complete before this one */
  dependsOn?: string[];
  /** Whether to continue on failure */
  continueOnFailure?: boolean;
  /** Error message if step failed */
  error?: string;
  /** Step start time */
  startTime?: Date;
  /** Step end time */
  endTime?: Date;
  /** Captured stdout */
  stdout?: string[];
  /** Captured stderr */
  stderr?: string[];
}

/**
 * Build chain configuration
 */
export interface BuildChainConfig {
  /** Build chain name */
  name: string;
  /** Description of what this build chain does */
  description?: string;
  /** List of build steps */
  steps: BuildStep[];
  /** Working directory for entire build chain */
  workingDirectory?: string;
  /** Global timeout for entire chain (milliseconds) */
  timeout?: number;
  /** Environment variables for all steps */
  env?: Record<string, string>;
  /** Whether to stop on first failure */
  stopOnFailure?: boolean;
}

/**
 * Build result for a single step
 */
export interface BuildStepResult {
  /** Step that was executed */
  step: BuildStep;
  /** Whether the step succeeded */
  success: boolean;
  /** Result message */
  message: string;
  /** Error details if failed */
  error?: string;
  /** Duration in milliseconds */
  duration?: number;
  /** Captured stdout */
  stdout?: string;
  /** Captured stderr */
  stderr?: string;
}

/**
 * Build chain execution result
 */
export interface BuildChainResult {
  /** Overall success status */
  success: boolean;
  /** Summary message */
  message: string;
  /** Results for each step */
  stepResults: BuildStepResult[];
  /** Total duration in milliseconds */
  totalDuration: number;
  /** Number of successful steps */
  successCount: number;
  /** Number of failed steps */
  failureCount: number;
  /** Number of skipped steps */
  skippedCount: number;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
}

/**
 * Build configuration file format
 */
export interface BuildConfig {
  /** Version of the build config format */
  version: string;
  /** Build chains defined in this config */
  chains: BuildChainConfig[];
  /** Global environment variables */
  globalEnv?: Record<string, string>;
  /** Global timeout (milliseconds) */
  globalTimeout?: number;
}
