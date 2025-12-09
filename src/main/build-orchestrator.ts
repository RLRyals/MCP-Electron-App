/**
 * Build Orchestrator Module
 * Handles execution of npm install, npm build, and Docker build commands
 * with comprehensive progress tracking, output streaming, and error handling
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { LogCategory, logWithCategory, logError } from './logger';
import { getFixedEnv } from './prerequisites';
import {
  BuildStep,
  BuildStepType,
  BuildStepStatus,
  BuildChainConfig,
  BuildChainResult,
  BuildStepResult,
  BuildProgressCallback,
  NpmOptions,
  NpmBuildOptions,
  DockerBuildOptions,
  CustomScriptOptions,
  BuildConfig,
} from '../types/build';
import {
  BuildError,
  BuildErrorCode,
  ErrorHandler,
} from '../utils/error-handler';
import { RetryStrategy, RetryOptions } from '../utils/retry-strategy';

/**
 * Default timeout for build operations (30 minutes)
 */
const DEFAULT_TIMEOUT = 30 * 60 * 1000;

/**
 * Default timeout for npm install (10 minutes)
 */
const NPM_INSTALL_TIMEOUT = 10 * 60 * 1000;

/**
 * Default timeout for npm build (15 minutes)
 */
const NPM_BUILD_TIMEOUT = 15 * 60 * 1000;

/**
 * Default timeout for docker build (20 minutes)
 */
const DOCKER_BUILD_TIMEOUT = 20 * 60 * 1000;

/**
 * BuildOrchestrator class
 * Orchestrates build operations including npm and Docker builds
 */
export class BuildOrchestrator {
  private progressCallback?: BuildProgressCallback;
  private currentProcess?: ChildProcess;
  private retryStrategy: RetryStrategy;

  constructor(progressCallback?: BuildProgressCallback, retryOptions?: RetryOptions) {
    this.progressCallback = progressCallback;
    this.retryStrategy = new RetryStrategy({
      maxAttempts: 3,
      initialDelay: 2000,
      maxDelay: 16000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      ...retryOptions,
      onRetry: (error, attempt, delay) => {
        logWithCategory(
          'warn',
          LogCategory.GENERAL,
          `Retrying build operation (attempt ${attempt}) after ${delay}ms`,
          { error: error instanceof Error ? error.message : String(error) }
        );

        // Report retry to progress callback
        if (this.progressCallback) {
          this.progressCallback({
            message: `Retrying... (attempt ${attempt})`,
            percent: -1,
            step: 'retrying',
          });
        }
      },
    });
  }

  /**
   * Set or update the progress callback
   */
  public setProgressCallback(callback: BuildProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Execute npm install command with retry logic
   * @param repoPath Path to the repository containing package.json
   * @param options Options for npm install
   */
  public async npmInstall(
    repoPath: string,
    options?: NpmOptions
  ): Promise<void> {
    logWithCategory('info', LogCategory.GENERAL, `Running npm install in ${repoPath}`);

    const result = await this.retryStrategy.execute(
      () => this.executeNpmInstall(repoPath, options),
      { operation: 'npm-install', repoPath }
    );

    if (!result.success) {
      throw result.error || new Error('npm install failed');
    }
  }

  /**
   * Internal npm install execution (wrapped by retry logic)
   */
  private async executeNpmInstall(
    repoPath: string,
    options?: NpmOptions
  ): Promise<void> {
    // Validate repository path
    if (!fs.existsSync(repoPath)) {
      throw ErrorHandler.createError(
        BuildErrorCode.SYSTEM_PERMISSION_DENIED,
        new Error(`Repository path does not exist: ${repoPath}`),
        { repoPath }
      );
    }

    const packageJsonPath = path.join(repoPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw ErrorHandler.createError(
        BuildErrorCode.NPM_INSTALL_FAILED,
        new Error(`package.json not found in ${repoPath}`),
        { repoPath }
      );
    }

    // Clean node_modules if requested
    if (options?.clean) {
      const nodeModulesPath = path.join(repoPath, 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        logWithCategory('info', LogCategory.GENERAL, 'Cleaning node_modules directory');
        this.reportProgress('Cleaning node_modules...', 5);
        fs.rmSync(nodeModulesPath, { recursive: true, force: true });
      }
    }

    // Build npm install command
    const args: string[] = ['install'];

    if (options?.production) {
      args.push('--production');
    }

    if (options?.legacyPeerDeps) {
      args.push('--legacy-peer-deps');
    }

    if (options?.flags && options.flags.length > 0) {
      args.push(...options.flags);
    }

    const command = `npm ${args.join(' ')}`;
    logWithCategory('info', LogCategory.GENERAL, `Executing: ${command}`);

    this.reportProgress('Installing npm dependencies...', 10);

    try {
      // Execute npm install with streaming output
      await this.executeCommand(
        command,
        options?.cwd || repoPath,
        options?.timeout || NPM_INSTALL_TIMEOUT,
        options?.env
      );

      this.reportProgress('npm install completed', 100);
      logWithCategory('info', LogCategory.GENERAL, 'npm install completed successfully');
    } catch (error: any) {
      const buildError = ErrorHandler.classify(error, {
        operation: 'npm-install',
        repoPath,
        command,
      });

      ErrorHandler.logError(buildError);
      throw buildError;
    }
  }

  /**
   * Execute npm build command with retry logic
   * @param repoPath Path to the repository
   * @param buildScript Name of the build script (defaults to 'build')
   * @param options Options for npm build
   */
  public async npmBuild(
    repoPath: string,
    buildScript: string = 'build',
    options?: NpmBuildOptions
  ): Promise<void> {
    logWithCategory('info', LogCategory.GENERAL, `Running npm build in ${repoPath}`);

    const result = await this.retryStrategy.execute(
      () => this.executeNpmBuild(repoPath, buildScript, options),
      { operation: 'npm-build', repoPath, buildScript }
    );

    if (!result.success) {
      throw result.error || new Error('npm build failed');
    }
  }

  /**
   * Internal npm build execution (wrapped by retry logic)
   */
  private async executeNpmBuild(
    repoPath: string,
    buildScript: string = 'build',
    options?: NpmBuildOptions
  ): Promise<void> {
    // Validate repository path
    if (!fs.existsSync(repoPath)) {
      throw ErrorHandler.createError(
        BuildErrorCode.SYSTEM_PERMISSION_DENIED,
        new Error(`Repository path does not exist: ${repoPath}`),
        { repoPath }
      );
    }

    const packageJsonPath = path.join(repoPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw ErrorHandler.createError(
        BuildErrorCode.NPM_BUILD_SCRIPT_FAILED,
        new Error(`package.json not found in ${repoPath}`),
        { repoPath }
      );
    }

    // Verify build script exists in package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const scriptName = options?.script || buildScript;

    if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
      throw ErrorHandler.createError(
        BuildErrorCode.NPM_BUILD_SCRIPT_FAILED,
        new Error(`Build script '${scriptName}' not found in package.json`),
        { repoPath, scriptName }
      );
    }

    // Build npm run command
    const args: string[] = ['run', scriptName];

    if (options?.flags && options.flags.length > 0) {
      args.push('--');
      args.push(...options.flags);
    }

    const command = `npm ${args.join(' ')}`;
    logWithCategory('info', LogCategory.GENERAL, `Executing: ${command}`);

    this.reportProgress(`Running build script: ${scriptName}...`, 10);

    try {
      // Execute npm build with streaming output
      await this.executeCommand(
        command,
        options?.cwd || repoPath,
        options?.timeout || NPM_BUILD_TIMEOUT,
        options?.env
      );

      this.reportProgress('npm build completed', 100);
      logWithCategory('info', LogCategory.GENERAL, 'npm build completed successfully');
    } catch (error: any) {
      const buildError = ErrorHandler.classify(error, {
        operation: 'npm-build',
        repoPath,
        scriptName,
        command,
      });

      ErrorHandler.logError(buildError);
      throw buildError;
    }
  }

  /**
   * Execute docker build command with retry logic
   * @param dockerfile Path to Dockerfile or directory containing Dockerfile
   * @param imageName Name and tag for the Docker image
   * @param options Options for docker build
   */
  public async dockerBuild(
    dockerfile: string,
    imageName: string,
    options?: DockerBuildOptions
  ): Promise<void> {
    logWithCategory('info', LogCategory.DOCKER, `Building Docker image: ${imageName}`);

    const result = await this.retryStrategy.execute(
      () => this.executeDockerBuild(dockerfile, imageName, options),
      { operation: 'docker-build', dockerfile, imageName }
    );

    if (!result.success) {
      throw result.error || new Error('Docker build failed');
    }
  }

  /**
   * Internal docker build execution (wrapped by retry logic)
   */
  private async executeDockerBuild(
    dockerfile: string,
    imageName: string,
    options?: DockerBuildOptions
  ): Promise<void> {
    // Determine working directory and Dockerfile path
    let buildContext: string;
    let dockerfilePath: string;

    if (fs.existsSync(dockerfile)) {
      const stats = fs.statSync(dockerfile);
      if (stats.isDirectory()) {
        buildContext = dockerfile;
        dockerfilePath = options?.dockerfile || 'Dockerfile';
      } else {
        buildContext = path.dirname(dockerfile);
        dockerfilePath = path.basename(dockerfile);
      }
    } else {
      throw ErrorHandler.createError(
        BuildErrorCode.DOCKER_BUILD_CONTEXT_ERROR,
        new Error(`Dockerfile or directory does not exist: ${dockerfile}`),
        { dockerfile }
      );
    }

    // Verify Dockerfile exists
    const fullDockerfilePath = path.join(buildContext, dockerfilePath);
    if (!fs.existsSync(fullDockerfilePath)) {
      throw ErrorHandler.createError(
        BuildErrorCode.DOCKER_INVALID_DOCKERFILE,
        new Error(`Dockerfile not found: ${fullDockerfilePath}`),
        { fullDockerfilePath }
      );
    }

    // Build docker build command
    const args: string[] = ['build'];

    // Add Dockerfile path if not default
    if (dockerfilePath !== 'Dockerfile') {
      args.push('-f', dockerfilePath);
    }

    // Add build arguments
    if (options?.buildArgs) {
      for (const [key, value] of Object.entries(options.buildArgs)) {
        args.push('--build-arg', `${key}=${value}`);
      }
    }

    // Add tags
    if (options?.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        args.push('-t', tag);
      }
    } else {
      args.push('-t', imageName);
    }

    // Add target stage
    if (options?.target) {
      args.push('--target', options.target);
    }

    // Add platform
    if (options?.platform) {
      args.push('--platform', options.platform);
    }

    // Add no-cache flag
    if (options?.noCache) {
      args.push('--no-cache');
    }

    // Add additional flags
    if (options?.flags && options.flags.length > 0) {
      args.push(...options.flags);
    }

    // Add build context (always last)
    args.push('.');

    const command = `docker ${args.join(' ')}`;
    logWithCategory('info', LogCategory.DOCKER, `Executing: ${command}`);

    this.reportProgress(`Building Docker image: ${imageName}...`, 10);

    try {
      // Execute docker build with streaming output
      await this.executeCommand(
        command,
        options?.cwd || buildContext,
        options?.timeout || DOCKER_BUILD_TIMEOUT,
        process.env as Record<string, string>
      );

      this.reportProgress('Docker build completed', 100);
      logWithCategory('info', LogCategory.DOCKER, 'Docker build completed successfully');
    } catch (error: any) {
      const buildError = ErrorHandler.classify(error, {
        operation: 'docker-build',
        imageName,
        buildContext,
        command,
      });

      ErrorHandler.logError(buildError);
      throw buildError;
    }
  }

  /**
   * Execute a custom script or command
   * @param command Command to execute
   * @param options Options for script execution
   */
  public async executeCustomScript(
    command: string,
    options?: CustomScriptOptions
  ): Promise<void> {
    logWithCategory('info', LogCategory.SCRIPT, `Executing custom script: ${command}`);

    this.reportProgress('Executing custom script...', 10);

    await this.executeCommand(
      command,
      options?.cwd || process.cwd(),
      options?.timeout || DEFAULT_TIMEOUT,
      options?.env,
      options?.shell
    );

    this.reportProgress('Custom script completed', 100);
    logWithCategory('info', LogCategory.SCRIPT, 'Custom script completed successfully');
  }

  /**
   * Execute a build chain with multiple steps
   * @param steps Array of build steps to execute
   * @param config Optional build chain configuration
   */
  public async executeBuildChain(
    steps: BuildStep[],
    config?: Partial<BuildChainConfig>
  ): Promise<BuildChainResult> {
    const startTime = new Date();
    const stepResults: BuildStepResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    logWithCategory('info', LogCategory.GENERAL, 'Starting build chain execution');
    this.reportProgress('Starting build chain...', 0, 'initialization');

    // Validate dependencies
    this.validateBuildChainDependencies(steps);

    // Execute steps in order, respecting dependencies
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepNumber = i + 1;
      const totalSteps = steps.length;

      // Check if dependencies are met
      const canExecute = this.canExecuteStep(step, stepResults);

      if (!canExecute) {
        logWithCategory('warn', LogCategory.GENERAL, `Skipping step ${step.name} - dependencies not met`);
        step.status = BuildStepStatus.SKIPPED;
        skippedCount++;
        stepResults.push({
          step,
          success: false,
          message: 'Dependencies not met',
          error: 'One or more dependent steps failed',
        });

        this.reportProgress(
          `Skipped: ${step.name}`,
          Math.round((stepNumber / totalSteps) * 100),
          step.id,
          stepNumber,
          totalSteps
        );

        continue;
      }

      // Execute the step
      const stepStartTime = new Date();
      step.status = BuildStepStatus.IN_PROGRESS;
      step.startTime = stepStartTime;

      logWithCategory('info', LogCategory.GENERAL, `Executing step ${stepNumber}/${totalSteps}: ${step.name}`);
      this.reportProgress(
        `Executing: ${step.name}`,
        Math.round((stepNumber / totalSteps) * 100),
        step.id,
        stepNumber,
        totalSteps
      );

      try {
        await this.executeStep(step, config?.workingDirectory);

        const stepEndTime = new Date();
        const duration = stepEndTime.getTime() - stepStartTime.getTime();

        step.status = BuildStepStatus.COMPLETED;
        step.endTime = stepEndTime;
        successCount++;

        stepResults.push({
          step,
          success: true,
          message: `Step completed successfully`,
          duration,
          stdout: step.stdout?.join('\n'),
          stderr: step.stderr?.join('\n'),
        });

        logWithCategory('info', LogCategory.GENERAL, `Step ${step.name} completed in ${duration}ms`);

      } catch (error) {
        const stepEndTime = new Date();
        const duration = stepEndTime.getTime() - stepStartTime.getTime();
        const errorMessage = error instanceof Error ? error.message : String(error);

        step.status = BuildStepStatus.FAILED;
        step.endTime = stepEndTime;
        step.error = errorMessage;
        failureCount++;

        stepResults.push({
          step,
          success: false,
          message: `Step failed: ${errorMessage}`,
          error: errorMessage,
          duration,
          stdout: step.stdout?.join('\n'),
          stderr: step.stderr?.join('\n'),
        });

        logError(error, `Step ${step.name} failed`);

        // Check if we should stop on failure
        if (config?.stopOnFailure && !step.continueOnFailure) {
          logWithCategory('error', LogCategory.GENERAL, 'Stopping build chain due to failure');

          // Mark remaining steps as skipped
          for (let j = i + 1; j < steps.length; j++) {
            steps[j].status = BuildStepStatus.SKIPPED;
            skippedCount++;
            stepResults.push({
              step: steps[j],
              success: false,
              message: 'Skipped due to previous failure',
            });
          }

          break;
        }
      }
    }

    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();
    const success = failureCount === 0;

    const result: BuildChainResult = {
      success,
      message: success
        ? `Build chain completed successfully in ${totalDuration}ms`
        : `Build chain completed with ${failureCount} failure(s)`,
      stepResults,
      totalDuration,
      successCount,
      failureCount,
      skippedCount,
      startTime,
      endTime,
    };

    this.reportProgress(
      success ? 'Build chain completed' : 'Build chain failed',
      100,
      'complete'
    );

    logWithCategory(
      success ? 'info' : 'error',
      LogCategory.GENERAL,
      result.message,
      { successCount, failureCount, skippedCount, totalDuration }
    );

    return result;
  }

  /**
   * Load build configuration from a JSON file
   * @param configPath Path to build.config.json
   */
  public loadBuildConfig(configPath: string): BuildConfig {
    logWithCategory('info', LogCategory.GENERAL, `Loading build config from ${configPath}`);

    if (!fs.existsSync(configPath)) {
      const error = `Build config file not found: ${configPath}`;
      logWithCategory('error', LogCategory.GENERAL, error);
      throw new Error(error);
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config: BuildConfig = JSON.parse(configContent);

      logWithCategory('info', LogCategory.GENERAL, `Loaded build config with ${config.chains.length} chain(s)`);
      return config;
    } catch (error) {
      logError(error, 'Failed to parse build config');
      throw new Error(`Failed to parse build config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a command with streaming output and timeout
   * @private
   */
  private async executeCommand(
    command: string,
    cwd: string,
    timeout: number,
    env?: Record<string, string>,
    shell?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const stdout: string[] = [];
      const stderr: string[] = [];

      // Merge environment variables
      const processEnv = {
        ...getFixedEnv(),
        ...env,
      };

      // Spawn the process
      this.currentProcess = spawn(command, {
        cwd,
        shell: shell || true,
        env: processEnv as NodeJS.ProcessEnv,
      });

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        if (this.currentProcess) {
          logWithCategory('error', LogCategory.GENERAL, `Command timed out after ${timeout}ms: ${command}`);
          this.currentProcess.kill('SIGTERM');

          // Force kill after 5 seconds if still running
          setTimeout(() => {
            if (this.currentProcess && !this.currentProcess.killed) {
              this.currentProcess.kill('SIGKILL');
            }
          }, 5000);
        }
      }, timeout);

      // Capture stdout
      if (this.currentProcess.stdout) {
        this.currentProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          stdout.push(output);

          // Report progress with stdout
          if (this.progressCallback) {
            this.progressCallback({
              message: 'Processing...',
              percent: -1, // Unknown progress
              step: 'executing',
              stdout: output,
            });
          }

          logWithCategory('debug', LogCategory.GENERAL, `[stdout] ${output.trim()}`);
        });
      }

      // Capture stderr
      if (this.currentProcess.stderr) {
        this.currentProcess.stderr.on('data', (data: Buffer) => {
          const output = data.toString();
          stderr.push(output);

          // Report progress with stderr
          if (this.progressCallback) {
            this.progressCallback({
              message: 'Processing...',
              percent: -1, // Unknown progress
              step: 'executing',
              stderr: output,
            });
          }

          logWithCategory('debug', LogCategory.GENERAL, `[stderr] ${output.trim()}`);
        });
      }

      // Handle process completion
      this.currentProcess.on('close', (code: number) => {
        clearTimeout(timeoutHandle);
        this.currentProcess = undefined;

        if (code === 0) {
          resolve();
        } else {
          const error = new Error(
            `Command failed with exit code ${code}: ${command}\n${stderr.join('\n')}`
          );
          reject(error);
        }
      });

      // Handle process errors
      this.currentProcess.on('error', (error: Error) => {
        clearTimeout(timeoutHandle);
        this.currentProcess = undefined;
        logError(error, `Failed to execute command: ${command}`);
        reject(error);
      });
    });
  }

  /**
   * Execute a single build step
   * @private
   */
  private async executeStep(step: BuildStep, workingDirectory?: string): Promise<void> {
    step.stdout = [];
    step.stderr = [];

    switch (step.type) {
      case BuildStepType.NPM_INSTALL: {
        const options = step.config as NpmOptions;
        const repoPath = workingDirectory || options.cwd || process.cwd();
        await this.npmInstall(repoPath, options);
        break;
      }

      case BuildStepType.NPM_BUILD: {
        const options = step.config as NpmBuildOptions;
        const repoPath = workingDirectory || options.cwd || process.cwd();
        const script = options.script || 'build';
        await this.npmBuild(repoPath, script, options);
        break;
      }

      case BuildStepType.DOCKER_BUILD: {
        const options = step.config as DockerBuildOptions;
        const dockerfilePath = workingDirectory || options.cwd || process.cwd();
        const imageName = `build-step-${step.id}`;
        await this.dockerBuild(dockerfilePath, imageName, options);
        break;
      }

      case BuildStepType.CUSTOM_SCRIPT: {
        const options = step.config as CustomScriptOptions;
        if (!step.command) {
          throw new Error('Custom script step requires a command');
        }
        await this.executeCustomScript(step.command, options);
        break;
      }

      default:
        throw new Error(`Unknown build step type: ${step.type}`);
    }
  }

  /**
   * Check if a step's dependencies are met
   * @private
   */
  private canExecuteStep(step: BuildStep, stepResults: BuildStepResult[]): boolean {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      return true;
    }

    for (const dependencyId of step.dependsOn) {
      const dependencyResult = stepResults.find(r => r.step.id === dependencyId);

      // Dependency not executed yet
      if (!dependencyResult) {
        return false;
      }

      // Dependency failed
      if (!dependencyResult.success) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate build chain dependencies
   * @private
   */
  private validateBuildChainDependencies(steps: BuildStep[]): void {
    const stepIds = new Set(steps.map(s => s.id));

    for (const step of steps) {
      if (step.dependsOn && step.dependsOn.length > 0) {
        for (const dependencyId of step.dependsOn) {
          if (!stepIds.has(dependencyId)) {
            throw new Error(
              `Step '${step.id}' depends on '${dependencyId}' which does not exist in the build chain`
            );
          }
        }
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies(steps);
  }

  /**
   * Detect circular dependencies in build steps
   * @private
   */
  private detectCircularDependencies(steps: BuildStep[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const visit = (stepId: string): void => {
      if (recursionStack.has(stepId)) {
        throw new Error(`Circular dependency detected involving step: ${stepId}`);
      }

      if (visited.has(stepId)) {
        return;
      }

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step && step.dependsOn) {
        for (const dependencyId of step.dependsOn) {
          visit(dependencyId);
        }
      }

      recursionStack.delete(stepId);
    };

    for (const step of steps) {
      visit(step.id);
    }
  }

  /**
   * Report progress to callback
   * @private
   */
  private reportProgress(
    message: string,
    percent: number,
    step: string = 'executing',
    currentStep?: number,
    totalSteps?: number
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        message,
        percent,
        step,
        currentStep,
        totalSteps,
      });
    }
  }

  /**
   * Cancel the current running process
   */
  public cancel(): void {
    if (this.currentProcess && !this.currentProcess.killed) {
      logWithCategory('warn', LogCategory.GENERAL, 'Cancelling current build process');
      this.currentProcess.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          logWithCategory('warn', LogCategory.GENERAL, 'Force killing build process');
          this.currentProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }
}

/**
 * Create a new BuildOrchestrator instance
 */
export function createBuildOrchestrator(progressCallback?: BuildProgressCallback): BuildOrchestrator {
  return new BuildOrchestrator(progressCallback);
}
