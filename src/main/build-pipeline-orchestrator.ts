/**
 * Build Pipeline Orchestrator
 * Coordinates the complete build pipeline including repository cloning,
 * npm builds, Docker image creation, and artifact verification
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { repositoryManager } from './repository-manager';
import { createBuildOrchestrator } from './build-orchestrator';
import type { RepositoryProgress } from '../types/repository';

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
  selectedComponents?: string[];
  skipClone?: boolean;
  skipBuild?: boolean;
  skipDocker?: boolean;
  skipVerification?: boolean;
  force?: boolean;
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
  private isCancelled = false;
  private currentPhase: PipelinePhase = PipelinePhase.INITIALIZING;

  constructor() {
    // No initialization needed
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

    const componentsToInclude = selectedComponents && selectedComponents.length > 0
      ? selectedComponents
      : config.components.filter(c => c.enabled).map(c => c.id);

    const repositoryIds = new Set<string>();
    for (const componentId of componentsToInclude) {
      const component = config.components.find(c => c.id === componentId);
      if (component) {
        component.repositoryIds.forEach(id => repositoryIds.add(id));
      }
    }

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

    await fs.ensureDir(baseClonePath);

    for (let i = 0; i < repositories.length; i++) {
      if (this.isCancelled) {
        throw new Error('Pipeline cancelled by user');
      }

      const repo = repositories[i];
      const repoPath = path.join(baseClonePath, repo.clonePath);

      if (!options.force && await fs.pathExists(repoPath)) {
        console.log(`Repository ${repo.name} already exists, skipping`);
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

      try {
        await repositoryManager.cloneRepository(repo.url, repoPath, {
          branch: repo.branch,
          onProgress: (progress: RepositoryProgress) => {
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

        // If we get here, clone was successful
        clonedRepos.push(repo.id);
      } catch (error) {
        // If optional, log and continue; otherwise re-throw
        if (repo.optional) {
          console.warn(`Failed to clone optional repository ${repo.name}:`, error);
        } else {
          throw new Error(`Failed to clone required repository ${repo.name}: ${error instanceof Error ? error.message : String(error)}`);
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

        if (step.command.includes('npm install')) {
          await buildOrchestrator.npmInstall(repoPath, {
            cwd: repoPath,
            timeout: step.timeout * 1000,
            env: config.globalEnv,
          });
        } else if (step.command.includes('npm run') || step.command.includes('npm build')) {
          const scriptMatch = step.command.match(/npm run (\S+)/);
          const script = scriptMatch ? scriptMatch[1] : 'build';

          await buildOrchestrator.npmBuild(repoPath, script, {
            cwd: repoPath,
            script,
            timeout: step.timeout * 1000,
            env: config.globalEnv,
          });
        } else {
          await buildOrchestrator.executeCustomScript(step.command, {
            cwd: repoPath,
            timeout: step.timeout * 1000,
            env: config.globalEnv,
          });
        }

        builtRepos.push(step.repositoryId);
      } catch (error) {
        if (!step.continueOnError) {
          throw error;
        }
      }
    }

    return [...new Set(builtRepos)];
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

      if (!await fs.pathExists(dockerfilePath)) {
        console.log(`Dockerfile not found, skipping Docker build for ${imageName}`);
        continue;
      }

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

        await buildOrchestrator.dockerBuild(buildContext, imageName, {
          cwd: buildContext,
          dockerfile: imageConfig.dockerfilePath,
        });

        dockerImages.push(imageName);
      } catch (error) {
        console.warn(`Docker build failed for ${imageName}, continuing`);
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

      const artifactsToCheck = ['dist', 'build', 'out', 'node_modules', 'package-lock.json'];

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

      const repositories = this.filterRepositories(options.selectedComponents);
      const buildOrder = this.resolveBuildOrder(repositories);

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
        }
      }

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
        }
      }

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
