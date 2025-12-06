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
import * as envConfig from './env-config';
import * as mcpSystem from './mcp-system';
import { checkDockerRunning } from './prerequisites';
import { DatabaseMigrator } from './database-migrator';
import * as clientSelection from './client-selection';

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
  customClients: Record<string, UpdateInfo>; // Added support for custom clients
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
  customClients?: Record<string, {
    sha?: string;
    updatedAt?: string;
    repoUrl?: string;
  }>;
  updatePreferences?: UpdatePreferences;
  lastStarted?: string;
  version?: string;
}

// GitHub repository configuration
const MCP_SERVERS_REPO = 'RLRyals/MCP-Writing-Servers';
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
  return path.join(userDataPath, '.system-metadata.json');
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
 * Check for updates for a specific repository
 */
async function checkForRepoUpdate(repoUrl: string, currentSha?: string): Promise<UpdateInfo> {
  try {
    // Basic check using git ls-remote to avoid GitHub API rate limits if possible, 
    // but for private repos or specific metadata, API is better. 
    // For generic git support, ls-remote is safer.
    
    // Extract info if it's a GitHub repo for API check (optimization), 
    // otherwise fallback to git ls-remote? 
    // For now, let's use a simple git check if possible without cloning?
    // Actually, simplest is to assume available if we don't have it, or rely on fetch.
    
    // For this implementation, we'll return "Available" if we can't determine, 
    // or rely on the actual update process to pull.
    
    // TODO: Implement proper remote check for generic git repos
    return { available: true }; 
  } catch (error: any) {
    return { available: false, error: error.message };
  }
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

  // Check custom clients
  const customClients: Record<string, UpdateInfo> = {};
  const availableClients = await clientSelection.getAvailableClients();
  const selectedClients = await clientSelection.loadClientSelection();
  
  // Only check selected clients
  if (selectedClients && selectedClients.clients) {
    for (const clientId of selectedClients.clients) {
      const client = availableClients.find(c => c.id === clientId);
      if (client && client.repoUrl && client.isCustom) {
          // For now, assume custom clients always "check" successfully (git pull will happen on update)
          // A real check would involve git ls-remote or API calls
          customClients[clientId] = { available: true };
      }
    }
  }

  const hasUpdates = mcpServers.available || typingMind.available || Object.values(customClients).some(c => c.available);

  // Update last checked timestamp
  const prefs = await getUpdatePreferences();
  prefs.lastChecked = new Date().toISOString();
  await setUpdatePreferences(prefs);

  return {
    hasUpdates,
    mcpServers,
    typingMind,
    customClients,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Get the repository directory for a specific client
 */
function getRepositoryDirectory(clientId: string): string {
  const userDataPath = app.getPath('userData');
  // Map specific IDs to specific folders if needed, otherwise use ID
  if (clientId === 'mcp-servers') {
    return path.join(userDataPath, 'repositories', 'mcp-writing-servers');
  }
  return path.join(userDataPath, 'repositories', clientId);
}

/**
 * Generic function to clone or pull a repository
 */
async function cloneOrPullRepository(
  repoUrl: string, 
  targetDir: string, 
  branch: string = 'main',
  progressCallback?: ProgressCallback,
  stepPrefix: string = 'git'
): Promise<string> {
  
  await fs.ensureDir(path.dirname(targetDir));

  try {
    if (await fs.pathExists(path.join(targetDir, '.git'))) {
      // Repository exists, pull latest
      logWithCategory('info', LogCategory.SYSTEM, `Pulling latest code from ${repoUrl}...`);
      progressCallback?.({
        message: `Pulling updates from ${repoUrl}...`,
        percent: 20, // Relative progress
        step: `${stepPrefix}-pull`,
        status: 'downloading',
      });

      // Try pulling
      try {
        await execAsync(`git pull origin ${branch}`, { cwd: targetDir });
      } catch (e) {
         // Fallback: try checkout branch if pull failed, or just fetch
         logger.warn(`Git pull failed, trying fetch: ${e}`);
         await execAsync(`git fetch origin`, { cwd: targetDir });
         await execAsync(`git reset --hard origin/${branch}`, { cwd: targetDir });
      }
      
    } else {
      // Clone fresh
      logWithCategory('info', LogCategory.SYSTEM, `Cloning repository ${repoUrl}...`);
      progressCallback?.({
        message: `Cloning ${repoUrl}...`,
        percent: 20, // Relative progress
        step: `${stepPrefix}-clone`,
        status: 'downloading',
      });

      // Remove directory if it exists but isn't a git repo
      if (await fs.pathExists(targetDir)) {
        await fs.remove(targetDir);
      }

      await execAsync(
        `git clone --depth 1 --branch ${branch} ${repoUrl} "${targetDir}"`,
        { cwd: path.dirname(targetDir) } // Clone parent dir
      );
    }

    // Get commit SHA
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: targetDir });
    const sha = stdout.trim();

    logWithCategory('info', LogCategory.SYSTEM, `Repository ${path.basename(targetDir)} at commit: ${sha}`);
    return sha;

  } catch (error: any) {
    logger.error(`Error cloning/pulling repository ${repoUrl}:`, error);
    throw new Error(`Failed to update repository: ${error.message}`);
  }
}

/**
 * Build MCP servers Docker image
 */
async function buildMCPServersImage(progressCallback?: ProgressCallback): Promise<void> {
  const repoDir = getRepositoryDirectory('mcp-servers');

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
      'docker build -t mcp-writing-servers:latest -t mcp-writing-servers:backup .',
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
    const { stdout } = await execAsync('docker images -q mcp-writing-servers:latest');

    if (stdout.trim()) {
      // Tag current latest as backup
      await execAsync('docker tag mcp-writing-servers:latest mcp-writing-servers:backup');
      logWithCategory('info', LogCategory.SYSTEM, 'Backup created: mcp-writing-servers:backup');
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
    const { stdout } = await execAsync('docker images -q mcp-writing-servers:backup');

    if (stdout.trim()) {
      // Tag backup as latest
      await execAsync('docker tag mcp-writing-servers:backup mcp-writing-servers:latest');
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
 * Update MCP Servers and Custom Clients
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

    // 3. Clone/pull MCP Servers Code
    progressCallback?.({
      message: 'Downloading MCP Servers code...',
      percent: 15,
      step: 'download-core',
      status: 'downloading',
    });

    const mcpRepoDir = getRepositoryDirectory('mcp-servers');
    const sha = await cloneOrPullRepository(
        MCP_SERVERS_REPO_URL, 
        mcpRepoDir, 
        MCP_SERVERS_BRANCH, 
        progressCallback,
        'mcp-servers'
    );

    // 3.5 Clone/pull Custom Clients
    const selectedClients = await clientSelection.loadClientSelection();
    const availableClients = await clientSelection.getAvailableClients();
    const metadata = await loadMetadata();
    metadata.customClients = metadata.customClients || {};

    if (selectedClients?.clients) {
        let clientIdx = 0;
        for (const clientId of selectedClients.clients) {
            const client = availableClients.find(c => c.id === clientId);
            if (client && client.repoUrl && client.isCustom) {
                clientIdx++;
                progressCallback?.({
                    message: `Downloading ${client.name}...`,
                    percent: 15 + (clientIdx * 2),
                    step: `download-${client.id}`,
                    status: 'downloading',
                });
                
                try {
                    const clientDir = getRepositoryDirectory(client.id);
                    // Determine branch? Default to main for now.
                    const clientSha = await cloneOrPullRepository(
                        client.repoUrl,
                        clientDir,
                        'main', 
                        undefined, // don't clutter progress with details
                        client.id
                    );
                    
                    // Update metadata for this client
                    metadata.customClients[client.id] = {
                        sha: clientSha,
                        updatedAt: new Date().toISOString(),
                        repoUrl: client.repoUrl
                    };
                } catch (e) {
                    logger.error(`Failed to update custom client ${client.name}:`, e);
                    // Continue with other clients, don't fail entire update for one custom repo
                }
            }
        }
    }

    // 4. Build new Docker image (Core MCP Only)
    // NOTE: Custom clients are currently just cloned, not built into the image unless we change the Dockerfile
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

    // Update core metadata
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

    // 7. Run Database Migrations (Defined in database-migrator.ts)
    progressCallback?.({
      message: 'Running database migrations...',
      percent: 95,
      step: 'migrations',
      status: 'updating',
    });


    try {
      // We must ensure the repository directory is correct for the migrator
      const repoDir = getRepositoryDirectory('mcp-servers');
      const config = await envConfig.loadEnvConfig();
      const migrator = new DatabaseMigrator(repoDir, config);
      
      const migrationResult = await migrator.runMigrations((msg, prog) => {
        // Map 0-100 progress to 95-99% overall
        const scaledProgress = 95 + (prog * 0.04);
        progressCallback?.({
          message: msg,
          percent: scaledProgress,
          step: 'migrations',
          status: 'updating'
        });
      });

      if (!migrationResult.success) {
         logWithCategory('error', LogCategory.SYSTEM, 'Migration failed', migrationResult.error);
         // Note: We don't rollback for migration failures yet, as that's complex. 
         // We warn the user instead.
         return {
           success: false,
           message: `Update finished but migrations failed: ${migrationResult.error}. System may be unstable.`,
           error: migrationResult.error
         };
      }
      
      logWithCategory('info', LogCategory.SYSTEM, `Migrations executed: ${migrationResult.executed.length}`);
      
    } catch (migrationError: any) {
        logWithCategory('error', LogCategory.SYSTEM, 'Migration error', migrationError);
         return {
           success: false,
           message: `Update finished but migrations failed: ${migrationError.message}.`,
           error: migrationError.message
         };
    }

    // 8. Complete
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

      // Stop just the typing-mind service using mcp-system's stopMCPSystem
      // which will stop all services - we'll restart core services after update
      await mcpSystem.stopMCPSystem();

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

      // Restart the full MCP system which will include Typing Mind if configured
      await mcpSystem.startMCPSystem();
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
