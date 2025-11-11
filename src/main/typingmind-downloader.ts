/**
 * Typing Mind Downloader Module
 * Downloads Typing Mind UI files from the MCP-Tutorial-New GitHub repository
 * Uses Git sparse checkout to download only the typing-mind-static directory
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import logger, { logWithCategory, LogCategory } from './logger';
import { checkGit } from './prerequisites';

const execAsync = promisify(exec);

/**
 * Progress callback for download updates
 */
export type ProgressCallback = (progress: TypingMindProgress) => void;

/**
 * Progress update interface
 */
export interface TypingMindProgress {
  message: string;
  percent: number;
  step: string;
  status: 'downloading' | 'verifying' | 'complete' | 'error';
}

/**
 * Download result interface
 */
export interface DownloadResult {
  success: boolean;
  message: string;
  path?: string;
  version?: string;
  error?: string;
}

/**
 * Typing Mind metadata interface
 */
export interface TypingMindMetadata {
  installed: boolean;
  version?: string;
  installedAt?: string;
  lastUpdated?: string;
  path?: string;
  repositoryUrl?: string;
  commitHash?: string;
}

// GitHub repository configuration
const REPO_URL = 'https://github.com/typingMind/typingmind.git';
const SPARSE_CHECKOUT_PATH = 'src';
const TEMP_CLONE_DIR = 'temp-typing-mind-clone';

// Active download process tracking
let activeProcess: ChildProcess | null = null;
let isCancelled = false;

/**
 * Get the directory where Typing Mind files are located
 * Files are downloaded to repositories/typing-mind/src during the download process
 */
export function getTypingMindDirectory(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'repositories', 'typing-mind', 'src');
}

/**
 * Get the temporary clone directory
 */
function getTempCloneDirectory(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'mcp-writing-system', TEMP_CLONE_DIR);
}

/**
 * Get the metadata file path
 */
export function getMetadataPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'mcp-writing-system', '.metadata.json');
}

/**
 * Load metadata from file
 */
export async function loadMetadata(): Promise<TypingMindMetadata> {
  try {
    const metadataPath = getMetadataPath();

    if (!fs.existsSync(metadataPath)) {
      return { installed: false };
    }

    const content = await fs.promises.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content);

    return metadata.typingMind || { installed: false };
  } catch (error) {
    logger.error('Error loading metadata:', error);
    return { installed: false };
  }
}

/**
 * Save metadata to file
 */
export async function saveMetadata(typingMindData: TypingMindMetadata): Promise<void> {
  try {
    const metadataPath = getMetadataPath();
    const dir = path.dirname(metadataPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // Load existing metadata
    let metadata: any = {};
    if (fs.existsSync(metadataPath)) {
      const content = await fs.promises.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(content);
    }

    // Update Typing Mind section
    metadata.typingMind = typingMindData;
    metadata.lastUpdated = new Date().toISOString();

    // Save back to file
    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    logger.info('Metadata saved successfully');
  } catch (error) {
    logger.error('Error saving metadata:', error);
    throw error;
  }
}

/**
 * Check if Typing Mind is already installed
 */
export async function isInstalled(): Promise<boolean> {
  const metadata = await loadMetadata();
  const installDir = getTypingMindDirectory();

  // Check both metadata and actual directory
  return metadata.installed && fs.existsSync(installDir);
}

/**
 * Get installed version information
 */
export async function getVersion(): Promise<TypingMindMetadata> {
  return await loadMetadata();
}

/**
 * Clean up temporary directories
 */
async function cleanupTempDirectory(): Promise<void> {
  const tempDir = getTempCloneDirectory();

  try {
    if (fs.existsSync(tempDir)) {
      logWithCategory('info', LogCategory.SCRIPT, `Cleaning up temp directory: ${tempDir}`);
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    logger.warn('Error cleaning up temp directory:', error);
    // Non-fatal, just log and continue
  }
}

/**
 * Execute a Git command with progress tracking
 */
async function executeGitCommand(
  command: string,
  cwd: string,
  progressCallback?: ProgressCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    logWithCategory('info', LogCategory.SCRIPT, `Executing Git command: ${command}`);

    const child = spawn('git', command.split(' '), {
      cwd,
      shell: false,
      windowsHide: true,
    });

    activeProcess = child;
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;

      if (progressCallback) {
        // Parse git progress output
        const progressMatch = output.match(/(\d+)%/);
        if (progressMatch) {
          const percent = parseInt(progressMatch[1], 10);
          progressCallback({
            message: output.trim(),
            percent: Math.min(percent, 99),
            step: 'downloading',
            status: 'downloading',
          });
        }
      }
    });

    child.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;

      // Git outputs progress to stderr
      if (progressCallback && output.includes('%')) {
        const progressMatch = output.match(/(\d+)%/);
        if (progressMatch) {
          const percent = parseInt(progressMatch[1], 10);
          progressCallback({
            message: output.trim(),
            percent: Math.min(percent, 99),
            step: 'downloading',
            status: 'downloading',
          });
        }
      }
    });

    child.on('close', (code) => {
      activeProcess = null;

      if (isCancelled) {
        reject(new Error('Download cancelled by user'));
        return;
      }

      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Git command failed with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      activeProcess = null;
      reject(error);
    });
  });
}

/**
 * Verify downloaded files
 */
async function verifyDownload(downloadPath: string): Promise<boolean> {
  try {
    logWithCategory('info', LogCategory.SCRIPT, 'Verifying downloaded files...');

    // Check if directory exists
    if (!fs.existsSync(downloadPath)) {
      logger.error('Download directory does not exist');
      return false;
    }

    // Check for essential files
    const essentialFiles = ['index.html'];
    const essentialDirs = ['assets', 'js', 'css'];

    for (const file of essentialFiles) {
      const filePath = path.join(downloadPath, file);
      if (!fs.existsSync(filePath)) {
        logger.error(`Essential file missing: ${file}`);
        return false;
      }
    }

    for (const dir of essentialDirs) {
      const dirPath = path.join(downloadPath, dir);
      if (!fs.existsSync(dirPath)) {
        logger.warn(`Directory missing (non-fatal): ${dir}`);
        // Not a fatal error, just a warning
      }
    }

    // Check total file count
    const files = await fs.promises.readdir(downloadPath);
    if (files.length < 3) {
      logger.error('Too few files downloaded');
      return false;
    }

    logWithCategory('info', LogCategory.SCRIPT, 'Download verification passed');
    return true;
  } catch (error) {
    logger.error('Error verifying download:', error);
    return false;
  }
}

/**
 * Get the latest commit hash from the cloned repository
 */
async function getCommitHash(repoPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
    return stdout.trim();
  } catch (error) {
    logger.warn('Could not get commit hash:', error);
    return undefined;
  }
}

/**
 * Download Typing Mind UI files from GitHub
 */
export async function downloadTypingMind(
  progressCallback?: ProgressCallback
): Promise<DownloadResult> {
  logWithCategory('info', LogCategory.SCRIPT, 'Starting Typing Mind download...');
  isCancelled = false;

  try {
    // 1. Check if Git is installed
    progressCallback?.({
      message: 'Checking prerequisites...',
      percent: 0,
      step: 'prerequisites',
      status: 'downloading',
    });

    const gitStatus = await checkGit();
    if (!gitStatus.installed) {
      const errorMsg = 'Git is not installed. Please install Git to download Typing Mind.';
      logWithCategory('error', LogCategory.SCRIPT, errorMsg);
      return {
        success: false,
        message: errorMsg,
        error: 'GIT_NOT_INSTALLED',
      };
    }

    logWithCategory('info', LogCategory.SCRIPT, `Git version: ${gitStatus.version}`);

    // 2. Prepare directories
    progressCallback?.({
      message: 'Preparing directories...',
      percent: 5,
      step: 'preparation',
      status: 'downloading',
    });

    const tempDir = getTempCloneDirectory();
    const installDir = getTypingMindDirectory();

    // Clean up any existing temp directory
    await cleanupTempDirectory();

    // Create temp directory
    await fs.promises.mkdir(tempDir, { recursive: true });

    // 3. Clone repository with sparse checkout
    progressCallback?.({
      message: 'Cloning repository...',
      percent: 10,
      step: 'cloning',
      status: 'downloading',
    });

    logWithCategory('info', LogCategory.SCRIPT, `Cloning from: ${REPO_URL}`);

    // Initialize git repository
    await executeGitCommand('init', tempDir, progressCallback);

    // Configure sparse checkout
    await executeGitCommand('config core.sparseCheckout true', tempDir);

    // Add remote
    await executeGitCommand(`remote add origin ${REPO_URL}`, tempDir);

    // Set sparse checkout paths
    const sparseCheckoutFile = path.join(tempDir, '.git', 'info', 'sparse-checkout');
    await fs.promises.mkdir(path.dirname(sparseCheckoutFile), { recursive: true });
    await fs.promises.writeFile(sparseCheckoutFile, `${SPARSE_CHECKOUT_PATH}/\n`, 'utf-8');

    // Pull the files
    progressCallback?.({
      message: 'Downloading files...',
      percent: 30,
      step: 'downloading',
      status: 'downloading',
    });

    await executeGitCommand(
      'pull --depth 1 origin main',
      tempDir,
      progressCallback
    );

    // 4. Verify downloaded files
    progressCallback?.({
      message: 'Verifying files...',
      percent: 80,
      step: 'verifying',
      status: 'verifying',
    });

    const downloadedPath = path.join(tempDir, SPARSE_CHECKOUT_PATH);
    const isValid = await verifyDownload(downloadedPath);

    if (!isValid) {
      throw new Error('Downloaded files failed verification');
    }

    // 5. Get commit hash for version tracking
    const commitHash = await getCommitHash(tempDir);

    // 6. Move files to final location
    progressCallback?.({
      message: 'Installing files...',
      percent: 90,
      step: 'installing',
      status: 'downloading',
    });

    // Remove existing installation if present
    if (fs.existsSync(installDir)) {
      await fs.promises.rm(installDir, { recursive: true, force: true });
    }

    // Ensure parent directory exists
    await fs.promises.mkdir(path.dirname(installDir), { recursive: true });

    // Move downloaded files to install location
    await fs.promises.rename(downloadedPath, installDir);

    // 7. Update metadata
    const metadata: TypingMindMetadata = {
      installed: true,
      version: new Date().toISOString(),
      installedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      path: installDir,
      repositoryUrl: REPO_URL,
      commitHash: commitHash,
    };

    await saveMetadata(metadata);

    // 8. Clean up temp directory
    await cleanupTempDirectory();

    // 9. Complete!
    progressCallback?.({
      message: 'Download complete!',
      percent: 100,
      step: 'complete',
      status: 'complete',
    });

    logWithCategory('info', LogCategory.SCRIPT, 'Typing Mind download completed successfully');

    return {
      success: true,
      message: 'Typing Mind downloaded and installed successfully',
      path: installDir,
      version: metadata.version,
    };

  } catch (error: any) {
    logWithCategory('error', LogCategory.SCRIPT, 'Error downloading Typing Mind', error);

    // Clean up on error
    await cleanupTempDirectory();

    progressCallback?.({
      message: `Error: ${error.message}`,
      percent: 0,
      step: 'error',
      status: 'error',
    });

    return {
      success: false,
      message: `Failed to download Typing Mind: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Cancel ongoing download
 */
export async function cancelDownload(): Promise<boolean> {
  logWithCategory('info', LogCategory.SCRIPT, 'Cancelling Typing Mind download...');
  isCancelled = true;

  if (activeProcess) {
    try {
      activeProcess.kill('SIGTERM');

      // Wait a bit, then force kill if needed
      setTimeout(() => {
        if (activeProcess && !activeProcess.killed) {
          activeProcess.kill('SIGKILL');
        }
      }, 5000);

      return true;
    } catch (error) {
      logger.error('Error cancelling download:', error);
      return false;
    }
  }

  // Clean up temp directory
  await cleanupTempDirectory();

  return true;
}

/**
 * Uninstall Typing Mind
 */
export async function uninstall(): Promise<DownloadResult> {
  try {
    logWithCategory('info', LogCategory.SCRIPT, 'Uninstalling Typing Mind...');

    const installDir = getTypingMindDirectory();

    if (fs.existsSync(installDir)) {
      await fs.promises.rm(installDir, { recursive: true, force: true });
    }

    // Update metadata
    await saveMetadata({
      installed: false,
    });

    logWithCategory('info', LogCategory.SCRIPT, 'Typing Mind uninstalled successfully');

    return {
      success: true,
      message: 'Typing Mind uninstalled successfully',
    };
  } catch (error: any) {
    logger.error('Error uninstalling Typing Mind:', error);
    return {
      success: false,
      message: `Failed to uninstall Typing Mind: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Check for updates (compare commit hashes)
 */
export async function checkForUpdates(): Promise<{
  hasUpdate: boolean;
  currentVersion?: string;
  latestVersion?: string;
  error?: string;
}> {
  try {
    logWithCategory('info', LogCategory.SCRIPT, 'Checking for Typing Mind updates...');

    const metadata = await loadMetadata();

    if (!metadata.installed) {
      return { hasUpdate: false, error: 'Typing Mind is not installed' };
    }

    // Get latest commit hash from GitHub
    const { stdout } = await execAsync(
      `git ls-remote ${REPO_URL} HEAD`,
      { timeout: 10000 }
    );

    const latestCommit = stdout.split('\t')[0];
    const currentCommit = metadata.commitHash;

    const hasUpdate = currentCommit !== latestCommit;

    return {
      hasUpdate,
      currentVersion: currentCommit,
      latestVersion: latestCommit,
    };
  } catch (error: any) {
    logger.error('Error checking for updates:', error);
    return {
      hasUpdate: false,
      error: error.message,
    };
  }
}
