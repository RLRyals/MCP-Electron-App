/**
 * Build Pipeline Orchestrator
 * Coordinates the complete build pipeline including repository cloning,
 * npm builds, Docker image creation, and artifact verification
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { repositoryManager } from './repository-manager';
import { createBuildOrchestrator } from './build-orchestrator';
import type { BuildStep, BuildStepType, BuildStepStatus } from '../types/build';
import type { RepositoryProgress } from '../types/repository';
// import { ProgressAggregator } from '../utils/progress-aggregator';
import { ProgressPhase, OperationType, OperationStartEvent } from '../types/progress';

/**
 * Repository configuration from setup-config.json
 */
export interface RepositoryConfig {
  id: string;
  name: string;
  url: string;
  clonePath: string;
  branch: string;
  optional: boolean;
  description?: string;
}

/**
 * Build step configuration from setup-config.json
 */
export interface BuildStepConfig {
  id: string;
  name: string;
  repositoryId: string;
  command: string;
  workingDir: string;
  continueOnError: boolean;
  timeout: number;
}

/**
 * Docker image configuration from setup-config.json
 */
export interface DockerImageConfig {
  repository: string;
  tag: string;
  buildContextPath: string;
  dockerfilePath: string;
}

/**
 * Component configuration for filtering
 */
export interface ComponentConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  repositoryIds: string[];
}

/**
 * Complete setup configuration
 */
export interface SetupConfig {
  version: string;
  title?: string;
  description?: string;
  baseClonePath: string;
  repositories: RepositoryConfig[];
  buildOrder: {
    order: string[];
    dependencies: Record<string, string[]>;
    allowParallel: boolean;
  };
  buildSteps: BuildStepConfig[];
  dockerImages: Record<string, DockerImageConfig>;
  components: ComponentConfig[];
  globalEnv?: Record<string, string>;
  metadata?: {
    createdAt: string;
    updatedAt: string;
    author: string;
  };
}

/**
 * Pipeline execution options
 */
export interface PipelineOptions {
  /** User-selected components to build */
  selectedComponents?: string[];
  /** Skip repository cloning (use existing) */
  skipClone?: boolean;
  /** Skip npm builds */
  skipBuild?: boolean;
  /** Skip Docker image builds */
  skipDocker?: boolean;
  /** Skip artifact verification */
  skipVerification?: boolean;
  /** Force rebuild even if artifacts exist */
  force?: boolean;
  /** Working directory for operations */
  workingDirectory?: string;
}

/**
 * Pipeline phase types
 */
export enum PipelinePhase {
  INITIALIZING = 'initializing',
  CLONING = 'cloning',
  BUILDING = 'building',
  DOCKER = 'docker',
  VERIFYING = 'verifying',
  COMPLETE = 'complete',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  success: boolean;
  message: string;
  phase: PipelinePhase;
  clonedRepositories: string[];
  builtRepositories: string[];
  dockerImages: string[];
  verifiedArtifacts: string[];
  errors: Array<{
    phase: PipelinePhase;
    component: string;
    error: string;
  }>;
  startTime: Date;
  endTime: Date;
  duration: number;
}

/**
 * Progress callback for pipeline operations
 */
export type PipelineProgressCallback = (progress: {
  phase: PipelinePhase;
  message: string;
  percent: number;
  currentOperation?: string;
  totalOperations?: number;
  currentStep?: number;
  totalSteps?: number;
}) => void;

/**
 * Build Pipeline Orchestrator
 * Manages the complete build pipeline from repository cloning to artifact verification
 */
export class BuildPipelineOrchestrator {
  private config: SetupConfig | null = null;
  // private progressAggregator: ProgressAggregator;
  private isCancelled = false;
  private currentPhase: PipelinePhase = PipelinePhase.INITIALIZING;

  constructor() {
    // this.progressAggregator = new ProgressAggregator(undefined, {
      throttleInterval: 100,
      maxConsoleLines: 1000,
      captureConsoleOutput: true,
      enableTimeEstimation: true,
    });
  }

  /**
   * Load configuration from file
   */
  async loadConfig(configPath: string): Promise<void> {
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get configuration (throws if not loaded)
   */
  private getConfig(): SetupConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Filter repositories based on selected components
   */
  private filterRepositories(selectedComponents?: string[]): RepositoryConfig[] {
    const config = this.getConfig();

    // If no components selected, use all enabled components
    const componentsToInclude = selectedComponents && selectedComponents.length > 0
      ? selectedComponents
      : config.components.filter(c => c.enabled).map(c => c.id);

    // Get all repository IDs from selected components
    const repositoryIds = new Set<string>();
    for (const componentId of componentsToInclude) {
      const component = config.components.find(c => c.id === componentId);
      if (component) {
        component.repositoryIds.forEach(id => repositoryIds.add(id));
      }
    }

    // Filter repositories
    return config.repositories.filter(repo => repositoryIds.has(repo.id));
  }

  /**
   * Resolve build order based on dependencies
   */
  private resolveBuildOrder(repositories: RepositoryConfig[]): string[] {
    const config = this.getConfig();
    const repoIds = new Set(repositories.map(r => r.id));
    const buildOrder: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (repoId: string): void => {
      if (visited.has(repoId)) return;
      if (visiting.has(repoId)) {
        throw new Error(`Circular dependency detected involving ${repoId}`);
      }

      visiting.add(repoId);

      // Visit dependencies first
      const deps = config.buildOrder.dependencies[repoId] || [];
      for (const dep of deps) {
        if (repoIds.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(repoId);
      visited.add(repoId);
      buildOrder.push(repoId);
    };

    // Start with the configured order, filtered by selected repositories
    for (const repoId of config.buildOrder.order) {
      if (repoIds.has(repoId)) {
        visit(repoId);
      }
    }

    return buildOrder;
  }

  /**
   * Clone repositories phase
   */
  private async cloneRepositories(
    repositories: RepositoryConfig[],
    options: PipelineOptions,
    onProgress?: PipelineProgressCallback
  ): Promise<string[]> {
    const config = this.getConfig();
    const clonedRepos: string[] = [];
    const baseClonePath = path.resolve(options.workingDirectory || '.', config.baseClonePath);

    // Ensure base clone path exists
    await fs.ensureDir(baseClonePath);

    for (let i = 0; i < repositories.length; i++) {
      if (this.isCancelled) {
        throw new Error('Pipeline cancelled by user');
      }

      const repo = repositories[i];
      const repoPath = path.join(baseClonePath, repo.clonePath);

      // Check if already cloned
      if (!options.force && await fs.pathExists(repoPath)) {
        console.log(`Repository ${repo.name} already exists at ${repoPath}, skipping clone`);
        clonedRepos.push(repo.id);

        if (onProgress) {
          onProgress({
            phase: PipelinePhase.CLONING,
            message: `Repository ${repo.name} already exists`,
            percent: ((i + 1) / repositories.length) * 100,
            currentOperation: repo.name,
            totalOperations: repositories.length,
            currentStep: i + 1,
            totalSteps: repositories.length,
          });
        }
        continue;
      }

      // Register operation with progress aggregator
      const operationId = // this.progressAggregator.startOperation({
        id: `clone-${repo.id}`,
        type: OperationType.REPOSITORY_CLONE,
        name: `Cloning ${repo.name}`,
        totalSteps: 100,
      });

      try {
        // Clone repository
        const result = await repositoryManager.cloneRepository(repo.url, repoPath, {
          branch: repo.branch,
          onProgress: (progress: RepositoryProgress) => {
            // this.progressAggregator.updateProgress(operationId, {
              currentStep: Math.floor(progress.percent),
              message: progress.message,
            });

            if (onProgress) {
              onProgress({
                phase: PipelinePhase.CLONING,
                message: `${repo.name}: ${progress.message}`,
                percent: ((i + progress.percent / 100) / repositories.length) * 100,
                currentOperation: repo.name,
                totalOperations: repositories.length,
                currentStep: i + 1,
                totalSteps: repositories.length,
              });
            }
          },
        });

        if (result.success) {
          clonedRepos.push(repo.id);
          // this.progressAggregator.completeOperation(operationId, {
            success: true,
            message: `Successfully cloned ${repo.name}`,
          });
        } else {
          // this.progressAggregator.completeOperation(operationId, {
            success: false,
            error: result.error || 'Unknown error',
          });

          if (!repo.optional) {
            throw new Error(`Failed to clone required repository ${repo.name}: ${result.error}`);
          }
        }
      } catch (error) {
        // this.progressAggregator.completeOperation(operationId, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });

        if (!repo.optional) {
          throw error;
        }
      }
    }

    return clonedRepos;
  }

  /**
   * Build repositories phase
   */
  private async buildRepositories(
    buildOrder: string[],
    options: PipelineOptions,
    onProgress?: PipelineProgressCallback
  ): Promise<string[]> {
    const config = this.getConfig();
    const builtRepos: string[] = [];
    const baseClonePath = path.resolve(options.workingDirectory || '.', config.baseClonePath);

    // Filter build steps for selected repositories
    const buildSteps = config.buildSteps.filter(step =>
      buildOrder.includes(step.repositoryId)
    );

    for (let i = 0; i < buildSteps.length; i++) {
      if (this.isCancelled) {
        throw new Error('Pipeline cancelled by user');
      }

      const step = buildSteps[i];
      const repo = config.repositories.find(r => r.id === step.repositoryId);
      if (!repo) continue;

      const repoPath = path.join(baseClonePath, repo.clonePath, step.workingDir);
      const operationId = `build-${step.id}`;

      // Determine operation type based on command
      let operationType: OperationType;
      if (step.command.includes('npm install')) {
        operationType = OperationType.NPM_INSTALL;
      } else if (step.command.includes('npm run') || step.command.includes('npm build')) {
        operationType = OperationType.NPM_BUILD;
      } else {
        operationType = OperationType.CUSTOM_SCRIPT;
      }

      // this.progressAggregator.startOperation({
        id: operationId,
        type: operationType,
        name: step.name,
        totalSteps: 100,
      });

      if (onProgress) {
        onProgress({
          phase: PipelinePhase.BUILDING,
          message: `Building ${step.name}`,
          percent: (i / buildSteps.length) * 100,
          currentOperation: step.name,
          totalOperations: buildSteps.length,
          currentStep: i + 1,
          totalSteps: buildSteps.length,
        });
      }

      try {
        const buildOrchestrator = createBuildOrchestrator();

        // Execute build based on command type
        let result;
        if (step.command.includes('npm install')) {
          result = await buildOrchestrator.npmInstall(repoPath, {
            timeout: step.timeout * 1000,
            env: config.globalEnv,
            onProgress: (progress) => {
              // this.progressAggregator.updateProgress(operationId, {
                currentStep: Math.floor(progress.percent),
                message: progress.message,
              });
              if (progress.stdout) {
                // this.progressAggregator.addConsoleOutput(operationId, progress.stdout);
              }
            },
          });
        } else if (step.command.includes('npm run') || step.command.includes('npm build')) {
          const scriptMatch = step.command.match(/npm run (\S+)/);
          const script = scriptMatch ? scriptMatch[1] : 'build';

          result = await buildOrchestrator.npmBuild(repoPath, {
            script,
            timeout: step.timeout * 1000,
            env: config.globalEnv,
            onProgress: (progress) => {
              // this.progressAggregator.updateProgress(operationId, {
                currentStep: Math.floor(progress.percent),
                message: progress.message,
              });
              if (progress.stdout) {
                // this.progressAggregator.addConsoleOutput(operationId, progress.stdout);
              }
            },
          });
        } else {
          result = await buildOrchestrator.executeCustomScript(step.command, {
            cwd: repoPath,
            timeout: step.timeout * 1000,
            env: config.globalEnv,
            onProgress: (progress) => {
              // this.progressAggregator.updateProgress(operationId, {
                currentStep: Math.floor(progress.percent),
                message: progress.message,
              });
              if (progress.stdout) {
                // this.progressAggregator.addConsoleOutput(operationId, progress.stdout);
              }
            },
          });
        }

        if (result.success) {
          builtRepos.push(step.repositoryId);
          // this.progressAggregator.completeOperation(operationId, {
            success: true,
            message: `Successfully completed ${step.name}`,
          });
        } else {
          // this.progressAggregator.completeOperation(operationId, {
            success: false,
            error: result.error || 'Build failed',
          });

          if (!step.continueOnError) {
            throw new Error(`Build step failed: ${step.name} - ${result.error}`);
          }
        }
      } catch (error) {
        // this.progressAggregator.completeOperation(operationId, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });

        if (!step.continueOnError) {
          throw error;
        }
      }
    }

    return [...new Set(builtRepos)]; // Remove duplicates
  }

  /**
   * Build Docker images phase
   */
  private async buildDockerImages(
    buildOrder: string[],
    options: PipelineOptions,
    onProgress?: PipelineProgressCallback
  ): Promise<string[]> {
    const config = this.getConfig();
    const dockerImages: string[] = [];
    const baseClonePath = path.resolve(options.workingDirectory || '.', config.baseClonePath);

    // Filter Docker images for built repositories
    const imagesToBuild = Object.entries(config.dockerImages).filter(([key, _]) =>
      buildOrder.includes(key)
    );

    for (let i = 0; i < imagesToBuild.length; i++) {
      if (this.isCancelled) {
        throw new Error('Pipeline cancelled by user');
      }

      const [repoId, imageConfig] = imagesToBuild[i];
      const repo = config.repositories.find(r => r.id === repoId);
      if (!repo) continue;

      const repoPath = path.join(baseClonePath, repo.clonePath);
      const dockerfilePath = path.join(repoPath, imageConfig.dockerfilePath);
      const imageName = `${imageConfig.repository}:${imageConfig.tag}`;

      // Check if Dockerfile exists
      if (!await fs.pathExists(dockerfilePath)) {
        console.log(`Dockerfile not found at ${dockerfilePath}, skipping Docker build for ${imageName}`);
        continue;
      }

      const operationId = `docker-${repoId}`;
      // this.progressAggregator.startOperation({
        id: operationId,
        type: OperationType.DOCKER_BUILD,
        name: `Building Docker image ${imageName}`,
        totalSteps: 100,
      });

      if (onProgress) {
        onProgress({
          phase: PipelinePhase.DOCKER,
          message: `Building Docker image ${imageName}`,
          percent: (i / imagesToBuild.length) * 100,
          currentOperation: imageName,
          totalOperations: imagesToBuild.length,
          currentStep: i + 1,
          totalSteps: imagesToBuild.length,
        });
      }

      try {
        const buildOrchestrator = createBuildOrchestrator();
        const buildContext = path.join(repoPath, imageConfig.buildContextPath);

        const result = await buildOrchestrator.dockerBuild(buildContext, imageName, {
          dockerfile: imageConfig.dockerfilePath,
          env: config.globalEnv,
          onProgress: (progress) => {
            // this.progressAggregator.updateProgress(operationId, {
              currentStep: Math.floor(progress.percent),
              message: progress.message,
            });
            if (progress.stdout) {
              // this.progressAggregator.addConsoleOutput(operationId, progress.stdout);
            }
          },
        });

        if (result.success) {
          dockerImages.push(imageName);
          // this.progressAggregator.completeOperation(operationId, {
            success: true,
            message: `Successfully built ${imageName}`,
          });
        } else {
          // this.progressAggregator.completeOperation(operationId, {
            success: false,
            error: result.error || 'Docker build failed',
          });

          // Don't fail the entire pipeline for Docker build failures
          console.warn(`Docker build failed for ${imageName}, but continuing pipeline`);
        }
      } catch (error) {
        // this.progressAggregator.completeOperation(operationId, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });

        console.warn(`Docker build error for ${imageName}:`, error);
      }
    }

    return dockerImages;
  }

  /**
   * Verify artifacts phase
   */
  private async verifyArtifacts(
    buildOrder: string[],
    options: PipelineOptions,
    onProgress?: PipelineProgressCallback
  ): Promise<string[]> {
    const config = this.getConfig();
    const verifiedArtifacts: string[] = [];
    const baseClonePath = path.resolve(options.workingDirectory || '.', config.baseClonePath);

    for (let i = 0; i < buildOrder.length; i++) {
      if (this.isCancelled) {
        throw new Error('Pipeline cancelled by user');
      }

      const repoId = buildOrder[i];
      const repo = config.repositories.find(r => r.id === repoId);
      if (!repo) continue;

      const repoPath = path.join(baseClonePath, repo.clonePath);

      if (onProgress) {
        onProgress({
          phase: PipelinePhase.VERIFYING,
          message: `Verifying ${repo.name}`,
          percent: (i / buildOrder.length) * 100,
          currentOperation: repo.name,
          totalOperations: buildOrder.length,
          currentStep: i + 1,
          totalSteps: buildOrder.length,
        });
      }

      // Check common build artifacts
      const artifactsToCheck = [
        'dist',
        'build',
        'out',
        'node_modules',
        'package-lock.json',
      ];

      let hasArtifacts = false;
      for (const artifact of artifactsToCheck) {
        const artifactPath = path.join(repoPath, artifact);
        if (await fs.pathExists(artifactPath)) {
          hasArtifacts = true;
          break;
        }
      }

      if (hasArtifacts) {
        verifiedArtifacts.push(repoId);
      }
    }

    return verifiedArtifacts;
  }

  /**
   * Execute the complete build pipeline
   */
  async executePipeline(
    options: PipelineOptions = {},
    onProgress?: PipelineProgressCallback
  ): Promise<PipelineResult> {
    const startTime = new Date();
    const errors: PipelineResult['errors'] = [];
    let clonedRepositories: string[] = [];
    let builtRepositories: string[] = [];
    let dockerImages: string[] = [];
    let verifiedArtifacts: string[] = [];

    try {
      this.isCancelled = false;
      this.currentPhase = PipelinePhase.INITIALIZING;

      if (onProgress) {
        onProgress({
          phase: PipelinePhase.INITIALIZING,
          message: 'Initializing build pipeline',
          percent: 0,
        });
      }

      // Filter repositories based on selected components
      const repositories = this.filterRepositories(options.selectedComponents);
      const buildOrder = this.resolveBuildOrder(repositories);

      // Phase 1: Clone repositories
      if (!options.skipClone) {
        this.currentPhase = PipelinePhase.CLONING;
        try {
          clonedRepositories = await this.cloneRepositories(repositories, options, onProgress);
        } catch (error) {
          errors.push({
            phase: PipelinePhase.CLONING,
            component: 'repositories',
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }

      // Phase 2: Build repositories
      if (!options.skipBuild) {
        this.currentPhase = PipelinePhase.BUILDING;
        try {
          builtRepositories = await this.buildRepositories(buildOrder, options, onProgress);
        } catch (error) {
          errors.push({
            phase: PipelinePhase.BUILDING,
            component: 'builds',
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }

      // Phase 3: Build Docker images
      if (!options.skipDocker) {
        this.currentPhase = PipelinePhase.DOCKER;
        try {
          dockerImages = await this.buildDockerImages(buildOrder, options, onProgress);
        } catch (error) {
          errors.push({
            phase: PipelinePhase.DOCKER,
            component: 'docker',
            error: error instanceof Error ? error.message : String(error),
          });
          // Don't throw - Docker failures are not fatal
        }
      }

      // Phase 4: Verify artifacts
      if (!options.skipVerification) {
        this.currentPhase = PipelinePhase.VERIFYING;
        try {
          verifiedArtifacts = await this.verifyArtifacts(buildOrder, options, onProgress);
        } catch (error) {
          errors.push({
            phase: PipelinePhase.VERIFYING,
            component: 'verification',
            error: error instanceof Error ? error.message : String(error),
          });
          // Don't throw - verification failures are not fatal
        }
      }

      // Complete
      this.currentPhase = PipelinePhase.COMPLETE;
      if (onProgress) {
        onProgress({
          phase: PipelinePhase.COMPLETE,
          message: 'Build pipeline completed successfully',
          percent: 100,
        });
      }

      const endTime = new Date();
      return {
        success: true,
        message: 'Build pipeline completed successfully',
        phase: PipelinePhase.COMPLETE,
        clonedRepositories,
        builtRepositories,
        dockerImages,
        verifiedArtifacts,
        errors,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      };
    } catch (error) {
      const endTime = new Date();
      this.currentPhase = this.isCancelled ? PipelinePhase.CANCELLED : PipelinePhase.FAILED;

      if (onProgress) {
        onProgress({
          phase: this.currentPhase,
          message: this.isCancelled ? 'Pipeline cancelled' : 'Pipeline failed',
          percent: 0,
        });
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        phase: this.currentPhase,
        clonedRepositories,
        builtRepositories,
        dockerImages,
        verifiedArtifacts,
        errors,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      };
    }
  }

  /**
   * Cancel the current pipeline execution
   */
  async cancel(): Promise<void> {
    this.isCancelled = true;
    await repositoryManager.cancelOperation();
    // BuildOrchestrator instances will need to be cancelled individually
    // This is handled in the build phase
  }

  /**
   * Get current progress aggregator
   */
  getProgressAggregator(): ProgressAggregator {
    return // this.progressAggregator;
  }

  /**
   * Get current pipeline phase
   */
  getCurrentPhase(): PipelinePhase {
    return this.currentPhase;
  }
}

/**
 * Create a new BuildPipelineOrchestrator instance
 */
export function createBuildPipelineOrchestrator(): BuildPipelineOrchestrator {
  return new BuildPipelineOrchestrator();
}
