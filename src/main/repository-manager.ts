/**
 * Repository Manager Module
 * Handles Git repository operations with progress tracking
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import logger, { logWithCategory, LogCategory } from './logger';
import { checkGit, getFixedEnv } from './prerequisites';
import { getGitHubCredentialManager, sanitizeUrlForLogging } from './github-credential-manager';
import {
  CloneOptions,
  RepositoryProgress,
  RepoStatus,
  RepositoryError,
  RepositoryErrorType,
  CommitInfo,
} from '../types/repository';
import {
  BuildError,
  BuildErrorCode,
  ErrorHandler,
} from '../utils/error-handler';
import { RetryStrategy, RetryOptions } from '../utils/retry-strategy';

const promisifiedExec = promisify(exec);
const execAsync = async (command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> => {
  return promisifiedExec(command, {
    ...options,
    encoding: 'utf8',
    env: getFixedEnv(),
  }) as unknown as Promise<{ stdout: string; stderr: string }>;
};

/**
 * RepositoryManager class for managing Git repository operations
 */
export class RepositoryManager {
  private activeProcess: ChildProcess | null = null;
  private isCancelled = false;
  private retryStrategy: RetryStrategy;

  /**
   * Initialize retry strategy with custom options
   */
  constructor(retryOptions?: RetryOptions) {
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
          `Retrying git operation (attempt ${attempt}) after ${delay}ms`,
          { error: error instanceof Error ? error.message : String(error) }
        );
      },
    });
  }

  /**
   * Clone a Git repository to a target path with retry logic
   * @param url - Repository URL (HTTPS or SSH)
   * @param targetPath - Local path where the repository should be cloned
   * @param options - Clone options
   */
  async cloneRepository(
    url: string,
    targetPath: string,
    options: CloneOptions = {}
  ): Promise<void> {
    logWithCategory('info', LogCategory.GENERAL, `Starting repository clone: ${url}`);
    this.isCancelled = false;

    // Execute clone with retry logic
    const result = await this.retryStrategy.execute(
      () => this.executeClone(url, targetPath, options),
      { url: sanitizeUrlForLogging(url), targetPath }
    );

    if (!result.success) {
      throw result.error || new Error('Clone failed');
    }
  }

  /**
   * Internal clone execution (wrapped by retry logic)
   */
  private async executeClone(
    url: string,
    targetPath: string,
    options: CloneOptions
  ): Promise<void> {

    try {
      // Validate inputs
      this.validateUrl(url);
      this.validateTargetPath(targetPath);

      // Check if Git is installed
      options.onProgress?.({
        message: 'Checking prerequisites...',
        percent: 0,
        step: 'prerequisites',
        status: 'initializing',
      });

      const gitStatus = await checkGit();
      if (!gitStatus.installed) {
        throw new RepositoryError(
          RepositoryErrorType.GIT_NOT_INSTALLED,
          'Git is not installed. Please install Git to clone repositories.'
        );
      }

      logWithCategory('info', LogCategory.GENERAL, `Git version: ${gitStatus.version}`);

      // Check if target path already exists
      if (fs.existsSync(targetPath)) {
        throw new RepositoryError(
          RepositoryErrorType.PATH_EXISTS,
          `Target path already exists: ${targetPath}`
        );
      }

      // Check available disk space
      await this.checkDiskSpace(targetPath);

      // Prepare clone options
      const branch = options.branch || 'main';
      const depth = options.depth;
      const timeout = options.timeout || 300000; // 5 minutes default

      // Get credential manager and prepare authenticated URL if needed
      const credentialManager = getGitHubCredentialManager();
      let cloneUrl = url;

      // Use authenticated URL for HTTPS URLs if GitHub token is available
      if (url.includes('https://github.com') && credentialManager.isConfigured()) {
        cloneUrl = credentialManager.getAuthenticatedUrl(url);
        logWithCategory('info', LogCategory.GENERAL, 'Using authenticated GitHub URL for clone');
      }

      // Build clone command
      let cloneArgs = ['clone'];

      if (depth) {
        cloneArgs.push('--depth', depth.toString());
      }

      if (branch) {
        cloneArgs.push('--branch', branch);
      }

      // Handle sparse checkout
      if (options.sparseCheckoutPaths && options.sparseCheckoutPaths.length > 0) {
        cloneArgs.push('--no-checkout');
      }

      cloneArgs.push('--progress', cloneUrl, targetPath);

      // Execute clone
      options.onProgress?.({
        message: `Cloning repository from ${sanitizeUrlForLogging(url)}...`,
        percent: 10,
        step: 'cloning',
        status: 'cloning',
      });

      await this.executeGitCommand(
        cloneArgs,
        process.cwd(),
        options.onProgress,
        timeout
      );

      // Handle sparse checkout if specified
      if (options.sparseCheckoutPaths && options.sparseCheckoutPaths.length > 0) {
        await this.setupSparseCheckout(targetPath, options.sparseCheckoutPaths);

        options.onProgress?.({
          message: 'Checking out sparse paths...',
          percent: 80,
          step: 'checking-out',
          status: 'checking-out',
        });

        await this.executeGitCommand(
          ['checkout', branch],
          targetPath,
          options.onProgress,
          timeout
        );
      }

      // Complete
      options.onProgress?.({
        message: 'Repository cloned successfully',
        percent: 100,
        step: 'complete',
        status: 'complete',
      });

      logWithCategory('info', LogCategory.GENERAL, 'Repository clone completed successfully');

    } catch (error: any) {
      logWithCategory('error', LogCategory.ERROR, 'Error cloning repository', error);

      options.onProgress?.({
        message: `Error: ${error.message}`,
        percent: 0,
        step: 'error',
        status: 'error',
      });

      // Clean up partial clone on error
      if (fs.existsSync(targetPath)) {
        try {
          await fs.promises.rm(targetPath, { recursive: true, force: true });
        } catch (cleanupError) {
          logger.warn('Error cleaning up after failed clone:', cleanupError);
        }
      }

      // Classify and re-throw error for retry logic
      const buildError = ErrorHandler.classify(error, {
        operation: 'git-clone',
        url: sanitizeUrlForLogging(url),
        targetPath,
      });

      ErrorHandler.logError(buildError);
      throw buildError;
    }
  }

  /**
   * Checkout a specific version (branch, tag, or commit) in a repository with retry logic
   * @param repoPath - Path to the repository
   * @param version - Branch name, tag, or commit hash
   */
  async checkoutVersion(repoPath: string, version: string): Promise<void> {
    logWithCategory('info', LogCategory.GENERAL, `Checking out version: ${version}`);

    const result = await this.retryStrategy.execute(
      () => this.executeCheckout(repoPath, version),
      { repoPath, version }
    );

    if (!result.success) {
      throw result.error || new Error('Checkout failed');
    }
  }

  /**
   * Internal checkout execution (wrapped by retry logic)
   */
  private async executeCheckout(repoPath: string, version: string): Promise<void> {
    try {
      // Validate repository
      await this.validateRepository(repoPath);

      // Fetch the version if it's a remote branch/tag
      try {
        await execAsync(`git fetch origin ${version}`, { cwd: repoPath, timeout: 60000 });
      } catch (fetchError) {
        // Ignore fetch errors - version might be local or a commit hash
        logger.debug('Fetch failed, proceeding with checkout:', fetchError);
      }

      // Checkout the version
      await execAsync(`git checkout ${version}`, { cwd: repoPath, timeout: 30000 });

      logWithCategory('info', LogCategory.GENERAL, `Checked out version: ${version}`);

    } catch (error: any) {
      logWithCategory('error', LogCategory.ERROR, 'Error checking out version', error);

      if (error.message.includes('did not match any file')) {
        const branchError = ErrorHandler.createError(
          BuildErrorCode.GIT_BRANCH_NOT_FOUND,
          error,
          { repoPath, version }
        );
        throw branchError;
      }

      const buildError = ErrorHandler.classify(error, {
        operation: 'git-checkout',
        repoPath,
        version,
      });

      ErrorHandler.logError(buildError);
      throw buildError;
    }
  }

  /**
   * Setup sparse checkout for a repository
   * @param repoPath - Path to the repository
   * @param paths - Array of paths to include in sparse checkout
   */
  async sparseCheckout(repoPath: string, paths: string[]): Promise<void> {
    logWithCategory('info', LogCategory.GENERAL, `Setting up sparse checkout with ${paths.length} paths`);

    try {
      // Validate repository
      await this.validateRepository(repoPath);

      // Setup sparse checkout
      await this.setupSparseCheckout(repoPath, paths);

      logWithCategory('info', LogCategory.GENERAL, 'Sparse checkout configured successfully');

    } catch (error: any) {
      logWithCategory('error', LogCategory.ERROR, 'Error setting up sparse checkout', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get the status of a repository
   * @param repoPath - Path to the repository
   */
  async getRepoStatus(repoPath: string): Promise<RepoStatus> {
    try {
      // Check if path exists
      if (!fs.existsSync(repoPath)) {
        return {
          exists: false,
          isGitRepo: false,
          error: 'Path does not exist',
        };
      }

      // Check if it's a Git repository
      const gitDir = path.join(repoPath, '.git');
      if (!fs.existsSync(gitDir)) {
        return {
          exists: true,
          isGitRepo: false,
          error: 'Not a Git repository',
        };
      }

      // Get current branch
      const branchResult = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoPath,
        timeout: 5000,
      });
      const currentBranch = branchResult.stdout.trim();

      // Get current commit
      const commitResult = await execAsync('git rev-parse HEAD', {
        cwd: repoPath,
        timeout: 5000,
      });
      const currentCommit = commitResult.stdout.trim();

      // Get remote URL
      let remoteUrl: string | undefined;
      try {
        const remoteResult = await execAsync('git config --get remote.origin.url', {
          cwd: repoPath,
          timeout: 5000,
        });
        remoteUrl = remoteResult.stdout.trim();
      } catch (error) {
        // No remote configured
        remoteUrl = undefined;
      }

      // Get working directory status
      const statusResult = await execAsync('git status --porcelain', {
        cwd: repoPath,
        timeout: 5000,
      });
      const statusLines = statusResult.stdout.trim().split('\n').filter(line => line.length > 0);

      const untrackedFiles = statusLines.filter(line => line.startsWith('??')).length;
      const modifiedFiles = statusLines.filter(line => line.startsWith(' M')).length;
      const stagedFiles = statusLines.filter(line => line.match(/^[AMD]/)).length;
      const isClean = statusLines.length === 0;

      // Get latest commit info
      const latestCommit = await this.getCommitInfo(repoPath, 'HEAD');

      return {
        exists: true,
        isGitRepo: true,
        currentBranch,
        currentCommit,
        remoteUrl,
        isClean,
        untrackedFiles,
        modifiedFiles,
        stagedFiles,
        latestCommit,
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.ERROR, 'Error getting repository status', error);
      return {
        exists: fs.existsSync(repoPath),
        isGitRepo: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel ongoing repository operation
   */
  async cancelOperation(): Promise<boolean> {
    logWithCategory('info', LogCategory.GENERAL, 'Cancelling repository operation...');
    this.isCancelled = true;

    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGTERM');

        // Wait a bit, then force kill if needed
        setTimeout(() => {
          if (this.activeProcess && !this.activeProcess.killed) {
            this.activeProcess.kill('SIGKILL');
          }
        }, 5000);

        return true;
      } catch (error) {
        logger.error('Error cancelling operation:', error);
        return false;
      }
    }

    return true;
  }

  /**
   * Private helper methods
   */

  /**
   * Execute a Git command with progress tracking
   */
  private async executeGitCommand(
    args: string[],
    cwd: string,
    progressCallback?: (progress: RepositoryProgress) => void,
    timeout: number = 300000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      logWithCategory('info', LogCategory.GENERAL, `Executing Git command: git ${args.join(' ')}`);

      // Get credential manager environment
      const credentialManager = getGitHubCredentialManager();
      const credentialEnv = credentialManager.getGitEnvironment();

      const child = spawn('git', args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: {
          ...getFixedEnv(),
          ...credentialEnv,
        },
      });

      this.activeProcess = child;
      let stdout = '';
      let stderr = '';

      // Set timeout
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new RepositoryError(
          RepositoryErrorType.TIMEOUT,
          `Git command timed out after ${timeout}ms`
        ));
      }, timeout);

      child.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;

        if (progressCallback) {
          this.parseGitProgress(output, progressCallback);
        }
      });

      child.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;

        // Git outputs progress to stderr
        if (progressCallback) {
          this.parseGitProgress(output, progressCallback);
        }
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        this.activeProcess = null;

        if (this.isCancelled) {
          reject(new Error('Operation cancelled by user'));
          return;
        }

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        this.activeProcess = null;
        reject(error);
      });
    });
  }

  /**
   * Parse Git progress output
   */
  private parseGitProgress(
    output: string,
    progressCallback: (progress: RepositoryProgress) => void
  ): void {
    // Parse percentage from Git output
    const progressMatch = output.match(/(\d+)%/);
    if (progressMatch) {
      const percent = parseInt(progressMatch[1], 10);
      progressCallback({
        message: output.trim(),
        percent: Math.min(percent, 99),
        step: 'cloning',
        status: 'cloning',
      });
    }

    // Parse object counts (Receiving objects: 1234/5678)
    const objectMatch = output.match(/Receiving objects:\s+(\d+)\/(\d+)/);
    if (objectMatch) {
      const received = parseInt(objectMatch[1], 10);
      const total = parseInt(objectMatch[2], 10);
      const percent = Math.floor((received / total) * 100);
      progressCallback({
        message: output.trim(),
        percent: Math.min(percent, 99),
        step: 'cloning',
        status: 'cloning',
      });
    }
  }

  /**
   * Setup sparse checkout for a repository
   */
  private async setupSparseCheckout(repoPath: string, paths: string[]): Promise<void> {
    // Enable sparse checkout
    await execAsync('git config core.sparseCheckout true', {
      cwd: repoPath,
      timeout: 5000,
    });

    // Write sparse checkout paths
    const sparseCheckoutFile = path.join(repoPath, '.git', 'info', 'sparse-checkout');
    await fs.promises.mkdir(path.dirname(sparseCheckoutFile), { recursive: true });
    await fs.promises.writeFile(
      sparseCheckoutFile,
      paths.map(p => `${p}\n`).join(''),
      'utf-8'
    );

    logWithCategory('info', LogCategory.GENERAL, `Sparse checkout configured with ${paths.length} paths`);
  }

  /**
   * Get commit information
   */
  private async getCommitInfo(repoPath: string, ref: string = 'HEAD'): Promise<CommitInfo> {
    const format = '%H%n%h%n%s%n%an%n%ae%n%aI';
    const { stdout } = await execAsync(`git show -s --format="${format}" ${ref}`, {
      cwd: repoPath,
      timeout: 5000,
    });

    const lines = stdout.trim().split('\n');

    return {
      hash: lines[0],
      shortHash: lines[1],
      message: lines[2],
      author: lines[3],
      email: lines[4],
      date: new Date(lines[5]),
    };
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): void {
    if (!url || url.trim().length === 0) {
      throw new RepositoryError(
        RepositoryErrorType.INVALID_URL,
        'Repository URL cannot be empty'
      );
    }

    // Check if URL is HTTPS or SSH format
    const httpsPattern = /^https?:\/\/.+/;
    const sshPattern = /^git@.+:.+/;

    if (!httpsPattern.test(url) && !sshPattern.test(url)) {
      throw new RepositoryError(
        RepositoryErrorType.INVALID_URL,
        'Invalid repository URL. Must be HTTPS or SSH format.'
      );
    }
  }

  /**
   * Validate target path
   */
  private validateTargetPath(targetPath: string): void {
    if (!targetPath || targetPath.trim().length === 0) {
      throw new RepositoryError(
        RepositoryErrorType.INVALID_URL,
        'Target path cannot be empty'
      );
    }

    // Check if parent directory exists
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      throw new RepositoryError(
        RepositoryErrorType.PATH_NOT_FOUND,
        `Parent directory does not exist: ${parentDir}`
      );
    }
  }

  /**
   * Validate repository path
   */
  private async validateRepository(repoPath: string): Promise<void> {
    if (!fs.existsSync(repoPath)) {
      throw new RepositoryError(
        RepositoryErrorType.PATH_NOT_FOUND,
        `Repository path does not exist: ${repoPath}`
      );
    }

    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir)) {
      throw new RepositoryError(
        RepositoryErrorType.NOT_A_GIT_REPO,
        `Path is not a Git repository: ${repoPath}`
      );
    }
  }

  /**
   * Check available disk space
   */
  private async checkDiskSpace(targetPath: string): Promise<void> {
    try {
      const parentDir = path.dirname(targetPath);
      const { stdout } = await execAsync(`df -k "${parentDir}"`, { timeout: 5000 });
      const lines = stdout.trim().split('\n');

      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        const availableKB = parseInt(parts[3], 10);
        const availableMB = availableKB / 1024;

        // Require at least 100MB free space
        if (availableMB < 100) {
          throw new RepositoryError(
            RepositoryErrorType.DISK_SPACE_ERROR,
            `Insufficient disk space. Available: ${availableMB.toFixed(2)}MB, Required: 100MB`
          );
        }
      }
    } catch (error: any) {
      // On Windows or if df command fails, just log a warning
      logger.warn('Could not check disk space:', error);
    }
  }

  /**
   * Handle and normalize errors
   */
  private handleError(error: any): RepositoryError {
    if (error instanceof RepositoryError) {
      return error;
    }

    const message = error.message || String(error);

    // Network errors
    if (message.includes('Could not resolve host') || message.includes('network')) {
      return new RepositoryError(
        RepositoryErrorType.NETWORK_ERROR,
        'Network error: Unable to connect to remote repository',
        error
      );
    }

    // Authentication errors
    if (message.includes('Authentication failed') || message.includes('403')) {
      return new RepositoryError(
        RepositoryErrorType.AUTHENTICATION_FAILED,
        'Authentication failed: Invalid credentials or insufficient permissions',
        error
      );
    }

    // Permission errors
    if (message.includes('Permission denied') || message.includes('EACCES')) {
      return new RepositoryError(
        RepositoryErrorType.PERMISSION_DENIED,
        'Permission denied: Unable to write to target directory',
        error
      );
    }

    // Default to unknown error
    return new RepositoryError(
      RepositoryErrorType.UNKNOWN_ERROR,
      message,
      error
    );
  }

  /**
   * Check if repositories have updates available
   * @param repoPath - Path to repository to check
   */
  async checkForUpdates(repoPath: string): Promise<{
    hasUpdate: boolean;
    currentCommit: string;
    latestCommit: string;
    commitsBehind: number;
    changes?: string[];
  }> {
    await this.validateRepository(repoPath);

    try {
      // Fetch latest from remote
      await execAsync('git fetch origin', { cwd: repoPath, timeout: 30000 });

      // Get current commit
      const { stdout: currentCommit } = await execAsync('git rev-parse HEAD', { cwd: repoPath });

      // Get latest commit on remote
      const { stdout: latestCommit } = await execAsync('git rev-parse origin/HEAD', { cwd: repoPath });

      const current = currentCommit.trim();
      const latest = latestCommit.trim();

      if (current === latest) {
        return {
          hasUpdate: false,
          currentCommit: current,
          latestCommit: latest,
          commitsBehind: 0,
        };
      }

      // Count commits behind
      const { stdout: behindCount } = await execAsync(
        `git rev-list --count ${current}..${latest}`,
        { cwd: repoPath }
      );

      // Get list of changes
      const { stdout: changes } = await execAsync(
        `git log --oneline ${current}..${latest}`,
        { cwd: repoPath }
      );

      return {
        hasUpdate: true,
        currentCommit: current,
        latestCommit: latest,
        commitsBehind: parseInt(behindCount.trim()),
        changes: changes.trim().split('\n').filter(line => line.length > 0),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithCategory('error', LogCategory.GENERAL, `Failed to check for updates: ${errorMsg}`);
      throw this.handleError(error);
    }
  }

  /**
   * Update repository by pulling latest changes
   * @param repoPath - Path to repository to update
   */
  async updateRepository(repoPath: string): Promise<void> {
    await this.validateRepository(repoPath);

    try {
      logWithCategory('info', LogCategory.GENERAL, `Updating repository at ${repoPath}`);

      // Stash any local changes
      try {
        await execAsync('git stash', { cwd: repoPath, timeout: 10000 });
      } catch {
        // Ignore if nothing to stash
      }

      // Pull latest changes
      await execAsync('git pull origin', { cwd: repoPath, timeout: 60000 });

      logWithCategory('info', LogCategory.GENERAL, `Successfully updated repository at ${repoPath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithCategory('error', LogCategory.GENERAL, `Failed to update repository: ${errorMsg}`);
      throw this.handleError(error);
    }
  }

  /**
   * Create backup of repository
   * @param repoPath - Path to repository to backup
   */
  async createBackup(repoPath: string): Promise<string> {
    if (!fs.existsSync(repoPath)) {
      throw new RepositoryError(
        RepositoryErrorType.PATH_NOT_FOUND,
        `Repository path does not exist: ${repoPath}`
      );
    }

    const backupPath = `${repoPath}.backup.${Date.now()}`;

    logWithCategory('info', LogCategory.GENERAL, `Creating backup at ${backupPath}`);

    await fs.promises.cp(repoPath, backupPath, { recursive: true });

    logWithCategory('info', LogCategory.GENERAL, `Backup created successfully at ${backupPath}`);

    return backupPath;
  }

  /**
   * Restore repository from backup
   * @param backupPath - Path to backup
   * @param targetPath - Path where to restore
   */
  async restoreBackup(backupPath: string, targetPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new RepositoryError(
        RepositoryErrorType.PATH_NOT_FOUND,
        `Backup path does not exist: ${backupPath}`
      );
    }

    logWithCategory('info', LogCategory.GENERAL, `Restoring backup from ${backupPath} to ${targetPath}`);

    // Remove current version if it exists
    if (fs.existsSync(targetPath)) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    }

    // Copy backup to target
    await fs.promises.cp(backupPath, targetPath, { recursive: true });

    // Clean up backup
    await fs.promises.rm(backupPath, { recursive: true, force: true });

    logWithCategory('info', LogCategory.GENERAL, `Successfully restored backup to ${targetPath}`);
  }
}

// Export a singleton instance with default retry options
export const repositoryManager = new RepositoryManager();

// Export the class as default
export default RepositoryManager;
