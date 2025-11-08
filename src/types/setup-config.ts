/**
 * Setup Configuration Types
 * Defines the configuration schema for the build automation setup
 */

/**
 * Repository definition in the setup configuration
 */
export interface Repository {
  /** Unique identifier for the repository */
  id: string;

  /** Display name for the repository */
  name: string;

  /** Git repository URL */
  url: string;

  /** Local path where the repository will be cloned */
  clonePath: string;

  /** Git branch to clone (default: 'main' or 'master') */
  branch?: string;

  /** Specific version/tag to checkout (optional, overrides branch) */
  version?: string;

  /** Whether this repository is optional */
  optional?: boolean;

  /** Custom description of the repository */
  description?: string;
}

/**
 * Build step definition
 */
export interface BuildStep {
  /** Unique identifier for the build step */
  id: string;

  /** Display name for the build step */
  name: string;

  /** Repository ID this build step applies to */
  repositoryId: string;

  /** Shell command to execute */
  command: string;

  /** Working directory for the command (relative to repository clone path) */
  workingDir?: string;

  /** Environment variables to set during execution */
  env?: Record<string, string>;

  /** Whether to ignore errors and continue with next step */
  continueOnError?: boolean;

  /** Maximum time allowed for this step in seconds */
  timeout?: number;
}

/**
 * Build order definition
 */
export interface BuildOrder {
  /** Sequential list of repository IDs to build in order */
  order: string[];

  /** Map of repository ID to its dependent repository IDs */
  dependencies?: Record<string, string[]>;

  /** Whether to allow parallel builds for independent repositories */
  allowParallel?: boolean;
}

/**
 * Docker image configuration
 */
export interface DockerImageConfig {
  /** Base image repository name (e.g., 'myapp') */
  repository: string;

  /** Image tag format (e.g., 'latest', 'v1.0.0', or '{version}') */
  tag?: string;

  /** Registry URL for pushing images (optional) */
  registry?: string;

  /** Build context path relative to repository */
  buildContextPath?: string;

  /** Dockerfile path relative to repository */
  dockerfilePath?: string;
}

/**
 * Component feature flag
 */
export interface ComponentFlag {
  /** Unique identifier for the component */
  id: string;

  /** Display name for the component */
  name: string;

  /** Description of what this component does */
  description?: string;

  /** Whether this component is enabled by default */
  enabled: boolean;

  /** Repository IDs associated with this component */
  repositoryIds: string[];
}

/**
 * Complete setup configuration schema
 */
export interface SetupConfig {
  /** Version of the configuration schema */
  version: string;

  /** Human-readable title/description of this configuration */
  title?: string;

  /** Detailed description of this configuration */
  description?: string;

  /** List of repositories to manage */
  repositories: Repository[];

  /** Build order and dependencies */
  buildOrder: BuildOrder;

  /** Custom build commands for each repository/step */
  buildSteps: BuildStep[];

  /** Docker image naming and build configuration */
  dockerImages?: Record<string, DockerImageConfig>;

  /** Optional component feature flags */
  components?: ComponentFlag[];

  /** Base directory where all repositories will be cloned */
  baseClonePath: string;

  /** Global environment variables to apply to all build steps */
  globalEnv?: Record<string, string>;

  /** Metadata about when this config was created/updated */
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    author?: string;
  };
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;

  /** List of validation errors (if any) */
  errors: string[];

  /** List of validation warnings */
  warnings: string[];
}
