/**
 * Updater Module
 * Manages update detection and execution for MCP servers and clients
 * Checks GitHub for new commits and updates Docker images
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs-extra';
import { app } from 'electron';
import logger, { logWithCategory, LogCategory } from './logger';
import * as typingMindDownloader from './typingmind-downloader';
import * as mcpSystem from './mcp-system';
import { checkDockerRunning } from './prerequisites';

const execAsync = promisify(exec);

/**
 * Progress callback for update operations
 */
export type ProgressCallback = (progress: UpdateProgress) => void;

/**
 * Update progress interface
 */
export interface UpdateProgress {
  message: string;
  percent: number;
  step: string;
  status: 'checking' | 'downloading' | 'updating' | 'complete' | 'error';
}

/**
 * Update info for a single component
 */
export interface UpdateInfo {
  available: boolean;
  currentVersion?: string;
  latestVersion?: string;
  currentDate?: string;
  latestDate?: string;
  commitMessage?: string;
  error?: string;
}

/**
 * Combined update check result
 */
export interface UpdateCheckResult {
  hasUpdates: boolean;
  mcpServers: UpdateInfo;
  typingMind: UpdateInfo;
  checkedAt: string;
}

/**
 * Update execution result
 */
export interface UpdateResult {
  success: boolean;
  message: string;
  error?: string;
  rollback?: boolean;
}

/**
 * Update preferences
 */
export interface UpdatePreferences {
  autoCheck: boolean;
  checkInterval: number; // days
  lastChecked?: string;
  notifyOnlyIfUpdatesAvailable: boolean;
  skippedVersions?: {
    mcpServers?: string;
    typingMind?: string;
  };
}

/**
 * System metadata structure
 */
interface SystemMetadata {
  mcpServers?: {
    sha?: string;
    updatedAt?: string;
    version?: string;
    repositoryUrl?: string;
  };
  typingMind?: {
    sha?: string;
    updatedAt?: string;
    installedAt?: string;
  };
  updatePreferences?: UpdatePreferences;
  lastStarted?: string;
  version?: string;
}

// GitHub repository configuration
const MCP_SERVERS_REPO = 'RLRyals/MCP-Tutorial-New';
const MCP_SERVERS_REPO_URL = `https://github.com/${MCP_SERVERS_REPO}.git`;
const MCP_SERVERS_BRANCH = 'main';

// Default update preferences
const DEFAULT_PREFERENCES: UpdatePreferences = {
  autoCheck: true,
  checkInterval: 1, // Check daily
  notifyOnlyIfUpdatesAvailable: true,
};

/**
 * Get the system metadata file path
 */
function getMetadataPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'mcp-writing-system', '.system-metadata.json');
}

/**
 * Load system metadata
 */
async function loadMetadata(): Promise<SystemMetadata> {
  try {
    const metadataPath = getMetadataPath();

    if (!await fs.pathExists(metadataPath)) {
      return {};
    }

    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.error('Error loading system metadata:', error);
    return {};
  }
}

/**
 * Save system metadata
 */
async function saveMetadata(metadata: SystemMetadata): Promise<void> {
  try {
    const metadataPath = getMetadataPath();
    const dir = path.dirname(metadataPath);

    // Ensure directory exists
    await fs.ensureDir(dir);

    // Save metadata
    await fs.writeJson(metadataPath, metadata, { spaces: 2 });

    logWithCategory('info', LogCategory.SYSTEM, 'System metadata saved successfully');
  } catch (error) {
    logger.error('Error saving system metadata:', error);
    throw error;
  }
}

/**
 * Get update preferences
 */
export async function getUpdatePreferences(): Promise<UpdatePreferences> {
  const metadata = await loadMetadata();
  return metadata.updatePreferences || DEFAULT_PREFERENCES;
}

/**
 * Set update preferences
 */
export async function setUpdatePreferences(preferences: UpdatePreferences): Promise<void> {
  const metadata = await loadMetadata();
  metadata.updatePreferences = preferences;
  await saveMetadata(metadata);
  logWithCategory('info', LogCategory.SYSTEM, 'Update preferences saved');
}

/**
 * Check if enough time has passed since last check
 */
export async function shouldAutoCheck(): Promise<boolean> {
  const prefs = await getUpdatePreferences();

  if (!prefs.autoCheck) {
    return false;
  }

  if (!prefs.lastChecked) {
    return true;
  }

  const lastChecked = new Date(prefs.lastChecked);
  const now = new Date();
  const daysSince = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);

  return daysSince >= prefs.checkInterval;
}

/**
 * Check for MCP Servers updates via GitHub API
 */
export async function checkForMCPServersUpdate(): Promise<UpdateInfo> {
  try {
    logWithCategory('info', LogCategory.SYSTEM, 'Checking for MCP Servers updates...');

    // Get latest commit from GitHub API
    const apiUrl = `https://api.github.com/repos/${MCP_SERVERS_REPO}/commits/${MCP_SERVERS_BRANCH}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MCP-Electron-App',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        // Rate limiting
        return {
          available: false,
          error: 'GitHub API rate limit exceeded. Please try again later.',
        };
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const latestCommit = await response.json();
    const latestSHA = latestCommit.sha;
    const latestDate = latestCommit.commit.committer.date;
    const commitMessage = latestCommit.commit.message;

    // Get current version from metadata
    const metadata = await loadMetadata();
    const currentSHA = metadata.mcpServers?.sha;
    const currentDate = metadata.mcpServers?.updatedAt;

    // Check if update is available
    const available = currentSHA !== latestSHA;

    return {
      available,
      currentVersion: currentSHA ? currentSHA.substring(0, 7) : 'Not installed',
      latestVersion: latestSHA.substring(0, 7),
      currentDate,
      latestDate,
      commitMessage: commitMessage.split('\n')[0], // First line only
    };

  } catch (error: any) {
    logger.error('Error checking for MCP Servers updates:', error);
    return {
      available: false,
      error: error.message,
    };
  }
}

/**
 * Check for Typing Mind updates
 * Uses existing checkForUpdates from typingmind-downloader
 */
export async function checkForTypingMindUpdate(): Promise<UpdateInfo> {
  try {
    logWithCategory('info', LogCategory.SYSTEM, 'Checking for Typing Mind updates...');

    // Check if Typing Mind is installed
    const isInstalled = await typingMindDownloader.isInstalled();
    if (!isInstalled) {
      return {
        available: false,
        error: 'Typing Mind is not installed',
      };
    }

    // Use existing check function
    const result = await typingMindDownloader.checkForUpdates();

    if (result.error) {
      return {
        available: false,
        error: result.error,
      };
    }

    return {
      available: result.hasUpdate,
      currentVersion: result.currentVersion ? result.currentVersion.substring(0, 7) : undefined,
      latestVersion: result.latestVersion ? result.latestVersion.substring(0, 7) : undefined,
    };

  } catch (error: any) {
    logger.error('Error checking for Typing Mind updates:', error);
    return {
      available: false,
      error: error.message,
    };
  }
}

/**
 * Check for all updates
 */
export async function checkForAllUpdates(): Promise<UpdateCheckResult> {
  logWithCategory('info', LogCategory.SYSTEM, 'Checking for all updates...');

  const [mcpServers, typingMind] = await Promise.all([
    checkForMCPServersUpdate(),
    checkForTypingMindUpdate(),
  ]);

  const hasUpdates = mcpServers.available || typingMind.available;

  // Update last checked timestamp
  const prefs = await getUpdatePreferences();
  prefs.lastChecked = new Date().toISOString();
  await setUpdatePreferences(prefs);

  return {
    hasUpdates,
    mcpServers,
    typingMind,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Get the MCP working directory
 */
function getMCPWorkingDirectory(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'mcp-writing-system');
}

/**
 * Get the MCP repository directory
 */
function getMCPRepoDirectory(): string {
  return path.join(getMCPWorkingDirectory(), 'mcp-servers-repo');
}

/**
 * Clone or pull MCP servers repository
 */
async function cloneOrPullMCPRepo(progressCallback?: ProgressCallback): Promise<string> {
  const repoDir = getMCPRepoDirectory();
  const mcpDir = getMCPWorkingDirectory();

  await fs.ensureDir(mcpDir);

  try {
    if (await fs.pathExists(path.join(repoDir, '.git'))) {
      // Repository exists, pull latest
      logWithCategory('info', LogCategory.SYSTEM, 'Pulling latest MCP servers code...');
      progressCallback?.({
        message: 'Pulling latest code from GitHub...',
        percent: 20,
        step: 'git-pull',
        status: 'downloading',
      });

      await execAsync(`git pull origin ${MCP_SERVERS_BRANCH}`, { cwd: repoDir });
    } else {
      // Clone fresh
      logWithCategory('info', LogCategory.SYSTEM, 'Cloning MCP servers repository...');
      progressCallback?.({
        message: 'Cloning repository from GitHub...',
        percent: 20,
        step: 'git-clone',
        status: 'downloading',
      });

      // Remove directory if it exists but isn't a git repo
      if (await fs.pathExists(repoDir)) {
        await fs.remove(repoDir);
      }

      await execAsync(
        `git clone --depth 1 --branch ${MCP_SERVERS_BRANCH} ${MCP_SERVERS_REPO_URL} "${repoDir}"`,
        { cwd: mcpDir }
      );
    }

    // Get commit SHA
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: repoDir });
    const sha = stdout.trim();

    logWithCategory('info', LogCategory.SYSTEM, `Repository at commit: ${sha}`);
    return sha;

  } catch (error: any) {
    logger.error('Error cloning/pulling MCP repository:', error);
    throw new Error(`Failed to download MCP servers: ${error.message}`);
  }
}

/**
 * Build MCP servers Docker image
 */
async function buildMCPServersImage(progressCallback?: ProgressCallback): Promise<void> {
  const repoDir = getMCPRepoDirectory();

  try {
    logWithCategory('info', LogCategory.SYSTEM, 'Building MCP servers Docker image...');
    progressCallback?.({
      message: 'Building Docker image...',
      percent: 50,
      step: 'docker-build',
      status: 'updating',
    });

    // Check if Docker is running
    const dockerStatus = await checkDockerRunning();
    if (!dockerStatus.running) {
      throw new Error('Docker is not running');
    }

    // Build the image
    const { stdout, stderr } = await execAsync(
      'docker build -t mcp-servers:latest -t mcp-servers:backup .',
      { cwd: repoDir, timeout: 300000 } // 5 minute timeout
    );

    logWithCategory('info', LogCategory.SYSTEM, 'Docker image built successfully');
    logger.debug('Build output:', stdout);

    if (stderr) {
      logger.debug('Build stderr:', stderr);
    }

  } catch (error: any) {
    logger.error('Error building Docker image:', error);
    throw new Error(`Failed to build Docker image: ${error.message}`);
  }
}

/**
 * Create backup of current Docker image
 */
async function backupCurrentImage(): Promise<void> {
  try {
    logWithCategory('info', LogCategory.SYSTEM, 'Creating backup of current image...');

    // Check if current image exists
    const { stdout } = await execAsync('docker images -q mcp-servers:latest');

    if (stdout.trim()) {
      // Tag current latest as backup
      await execAsync('docker tag mcp-servers:latest mcp-servers:backup');
      logWithCategory('info', LogCategory.SYSTEM, 'Backup created: mcp-servers:backup');
    } else {
      logWithCategory('info', LogCategory.SYSTEM, 'No existing image to backup');
    }

  } catch (error) {
    logger.warn('Failed to create backup image:', error);
    // Non-fatal, continue anyway
  }
}

/**
 * Rollback to backup image
 */
async function rollbackToBackup(): Promise<void> {
  try {
    logWithCategory('info', LogCategory.SYSTEM, 'Rolling back to backup image...');

    // Check if backup exists
    const { stdout } = await execAsync('docker images -q mcp-servers:backup');

    if (stdout.trim()) {
      // Tag backup as latest
      await execAsync('docker tag mcp-servers:backup mcp-servers:latest');
      logWithCategory('info', LogCategory.SYSTEM, 'Rollback successful');
    } else {
      logWithCategory('warn', LogCategory.SYSTEM, 'No backup image found for rollback');
    }

  } catch (error) {
    logger.error('Failed to rollback:', error);
    throw error;
  }
}

/**
 * Update MCP Servers
 */
export async function updateMCPServers(progressCallback?: ProgressCallback): Promise<UpdateResult> {
  logWithCategory('info', LogCategory.SYSTEM, 'Starting MCP Servers update...');

  try {
    // 1. Check if system is running and stop it
    progressCallback?.({
      message: 'Stopping MCP system...',
      percent: 5,
      step: 'stop-system',
      status: 'updating',
    });

    const status = await mcpSystem.getSystemStatus();
    const wasRunning = status.running;

    if (wasRunning) {
      await mcpSystem.stopMCPSystem();
      // Wait for shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 2. Create backup of current image
    progressCallback?.({
      message: 'Creating backup...',
      percent: 10,
      step: 'backup',
      status: 'updating',
    });

    await backupCurrentImage();

    // 3. Clone/pull latest code
    progressCallback?.({
      message: 'Downloading latest code...',
      percent: 20,
      step: 'download',
      status: 'downloading',
    });

    const sha = await cloneOrPullMCPRepo(progressCallback);

    // 4. Build new Docker image
    progressCallback?.({
      message: 'Building Docker image...',
      percent: 50,
      step: 'build',
      status: 'updating',
    });

    await buildMCPServersImage(progressCallback);

    // 5. Update metadata
    progressCallback?.({
      message: 'Updating metadata...',
      percent: 80,
      step: 'metadata',
      status: 'updating',
    });

    const metadata = await loadMetadata();
    metadata.mcpServers = {
      sha,
      updatedAt: new Date().toISOString(),
      version: MCP_SERVERS_BRANCH,
      repositoryUrl: MCP_SERVERS_REPO_URL,
    };
    await saveMetadata(metadata);

    // 6. Restart system if it was running
    if (wasRunning) {
      progressCallback?.({
        message: 'Restarting MCP system...',
        percent: 90,
        step: 'restart',
        status: 'updating',
      });

      const restartResult = await mcpSystem.startMCPSystem();

      if (!restartResult.success) {
        // Restart failed - rollback
        logWithCategory('error', LogCategory.SYSTEM, 'New version failed to start, rolling back...');

        await rollbackToBackup();

        // Try to start with backup
        await mcpSystem.startMCPSystem();

        progressCallback?.({
          message: 'Update failed, rolled back to previous version',
          percent: 100,
          step: 'rollback',
          status: 'error',
        });

        return {
          success: false,
          message: 'Update failed: New version did not start properly. Rolled back to previous version.',
          error: restartResult.error,
          rollback: true,
        };
      }
    }

    // 7. Complete
    progressCallback?.({
      message: 'Update complete!',
      percent: 100,
      step: 'complete',
      status: 'complete',
    });

    logWithCategory('info', LogCategory.SYSTEM, 'MCP Servers updated successfully');

    return {
      success: true,
      message: 'MCP Servers updated successfully',
    };

  } catch (error: any) {
    logger.error('Error updating MCP Servers:', error);

    // Attempt rollback
    try {
      await rollbackToBackup();
      await mcpSystem.startMCPSystem();
    } catch (rollbackError) {
      logger.error('Rollback also failed:', rollbackError);
    }

    progressCallback?.({
      message: `Update failed: ${error.message}`,
      percent: 0,
      step: 'error',
      status: 'error',
    });

    return {
      success: false,
      message: `Failed to update MCP Servers: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Update Typing Mind
 */
export async function updateTypingMind(progressCallback?: ProgressCallback): Promise<UpdateResult> {
  logWithCategory('info', LogCategory.SYSTEM, 'Starting Typing Mind update...');

  try {
    // 1. Check if Typing Mind is installed
    const isInstalled = await typingMindDownloader.isInstalled();
    if (!isInstalled) {
      return {
        success: false,
        message: 'Typing Mind is not installed',
        error: 'NOT_INSTALLED',
      };
    }

    // 2. Check if Typing Mind container is running
    progressCallback?.({
      message: 'Checking Typing Mind status...',
      percent: 5,
      step: 'check',
      status: 'checking',
    });

    const status = await mcpSystem.getSystemStatus();
    const typingMindContainer = status.containers.find(c => c.name.includes('typing-mind'));
    const wasRunning = typingMindContainer?.running || false;

    // 3. Stop Typing Mind if running
    if (wasRunning) {
      progressCallback?.({
        message: 'Stopping Typing Mind...',
        percent: 10,
        step: 'stop',
        status: 'updating',
      });

      // Stop just the typing-mind service
      const mcpDir = mcpSystem.getMCPWorkingDirectoryPath();
      const composeFile = path.join(mcpDir, 'docker-compose.typing-mind.yml');

      if (await fs.pathExists(composeFile)) {
        await execAsync(`docker-compose -f "${composeFile}" down`, { cwd: mcpDir });
      }

      // Wait for shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 4. Download latest Typing Mind files
    progressCallback?.({
      message: 'Downloading latest Typing Mind...',
      percent: 20,
      step: 'download',
      status: 'downloading',
    });

    // Use existing download function which handles progress
    const downloadResult = await typingMindDownloader.downloadTypingMind((tmProgress) => {
      // Map Typing Mind progress to update progress
      progressCallback?.({
        message: tmProgress.message,
        percent: 20 + (tmProgress.percent * 0.6), // Scale 0-100 to 20-80
        step: tmProgress.step,
        status: tmProgress.status === 'complete' ? 'complete' : 'downloading',
      });
    });

    if (!downloadResult.success) {
      return {
        success: false,
        message: downloadResult.message,
        error: downloadResult.error,
      };
    }

    // 5. Restart Typing Mind if it was running
    if (wasRunning) {
      progressCallback?.({
        message: 'Restarting Typing Mind...',
        percent: 90,
        step: 'restart',
        status: 'updating',
      });

      const mcpDir = mcpSystem.getMCPWorkingDirectoryPath();
      const composeFile = path.join(mcpDir, 'docker-compose.typing-mind.yml');

      if (await fs.pathExists(composeFile)) {
        await execAsync(`docker-compose -f "${composeFile}" up -d`, { cwd: mcpDir });
      }
    }

    // 6. Complete
    progressCallback?.({
      message: 'Typing Mind updated!',
      percent: 100,
      step: 'complete',
      status: 'complete',
    });

    logWithCategory('info', LogCategory.SYSTEM, 'Typing Mind updated successfully');

    return {
      success: true,
      message: 'Typing Mind updated successfully',
    };

  } catch (error: any) {
    logger.error('Error updating Typing Mind:', error);

    progressCallback?.({
      message: `Update failed: ${error.message}`,
      percent: 0,
      step: 'error',
      status: 'error',
    });

    return {
      success: false,
      message: `Failed to update Typing Mind: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Update all components that have updates available
 */
export async function updateAll(progressCallback?: ProgressCallback): Promise<UpdateResult> {
  logWithCategory('info', LogCategory.SYSTEM, 'Starting update all...');

  try {
    // Check what needs updating
    progressCallback?.({
      message: 'Checking for updates...',
      percent: 5,
      step: 'check',
      status: 'checking',
    });

    const updateCheck = await checkForAllUpdates();

    if (!updateCheck.hasUpdates) {
      return {
        success: true,
        message: 'All components are up to date',
      };
    }

    const results: { component: string; success: boolean; message: string }[] = [];

    // Update MCP Servers if needed
    if (updateCheck.mcpServers.available) {
      progressCallback?.({
        message: 'Updating MCP Servers...',
        percent: 10,
        step: 'mcp-servers',
        status: 'updating',
      });

      const result = await updateMCPServers((progress) => {
        // Scale progress to 10-60%
        progressCallback?.({
          ...progress,
          percent: 10 + (progress.percent * 0.5),
        });
      });

      results.push({
        component: 'MCP Servers',
        success: result.success,
        message: result.message,
      });

      if (!result.success) {
        logWithCategory('error', LogCategory.SYSTEM, `MCP Servers update failed: ${result.message}`);
      }
    }

    // Update Typing Mind if needed
    if (updateCheck.typingMind.available) {
      progressCallback?.({
        message: 'Updating Typing Mind...',
        percent: 60,
        step: 'typing-mind',
        status: 'updating',
      });

      const result = await updateTypingMind((progress) => {
        // Scale progress to 60-100%
        progressCallback?.({
          ...progress,
          percent: 60 + (progress.percent * 0.4),
        });
      });

      results.push({
        component: 'Typing Mind',
        success: result.success,
        message: result.message,
      });

      if (!result.success) {
        logWithCategory('error', LogCategory.SYSTEM, `Typing Mind update failed: ${result.message}`);
      }
    }

    // Determine overall success
    const allSuccessful = results.every(r => r.success);
    const anySuccessful = results.some(r => r.success);

    progressCallback?.({
      message: allSuccessful ? 'All updates complete!' : 'Updates completed with errors',
      percent: 100,
      step: 'complete',
      status: allSuccessful ? 'complete' : 'error',
    });

    if (allSuccessful) {
      return {
        success: true,
        message: 'All components updated successfully',
      };
    } else if (anySuccessful) {
      const failed = results.filter(r => !r.success).map(r => r.component);
      return {
        success: false,
        message: `Some updates failed: ${failed.join(', ')}`,
        error: 'PARTIAL_FAILURE',
      };
    } else {
      return {
        success: false,
        message: 'All updates failed',
        error: 'ALL_FAILED',
      };
    }

  } catch (error: any) {
    logger.error('Error in updateAll:', error);

    progressCallback?.({
      message: `Update failed: ${error.message}`,
      percent: 0,
      step: 'error',
      status: 'error',
    });

    return {
      success: false,
      message: `Failed to update components: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Save initial MCP servers version after installation
 */
export async function saveInitialMCPServersVersion(sha: string): Promise<void> {
  const metadata = await loadMetadata();
  metadata.mcpServers = {
    sha,
    updatedAt: new Date().toISOString(),
    version: MCP_SERVERS_BRANCH,
    repositoryUrl: MCP_SERVERS_REPO_URL,
  };
  await saveMetadata(metadata);
  logWithCategory('info', LogCategory.SYSTEM, 'Initial MCP Servers version saved');
}
