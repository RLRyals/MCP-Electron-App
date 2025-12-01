/**
 * Update Manager Module
 * Handles system updates with rollback capability
 */

import * as path from 'path';
import logger, { logWithCategory, LogCategory } from './logger';
import { RepositoryManager } from './repository-manager';
import Docker from 'dockerode';

export interface UpdateCheckResult {
  repositories: {
    [key: string]: {
      hasUpdate: boolean;
      commitsBehind: number;
      changes?: string[];
    };
  };
  dockerImages: {
    [key: string]: {
      hasUpdate: boolean;
    };
  };
}

export interface UpdateOptions {
  updateRepositories: boolean;
  updateDockerImages: boolean;
  rebuildContainers: boolean;
}

export class UpdateManager {
  private repoManager: RepositoryManager;
  private docker: Docker;
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.repoManager = new RepositoryManager();
    this.docker = new Docker();
  }

  /**
   * Check for all available updates
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    logWithCategory('info', LogCategory.GENERAL, 'Checking for updates');

    const result: UpdateCheckResult = {
      repositories: {},
      dockerImages: {},
    };

    // Check MCP-Writing-Servers repository
    try {
      const mcpServersPath = path.join(this.basePath, 'mcp-writing-servers');
      const mcpStatus = await this.repoManager.checkForUpdates(mcpServersPath);

      result.repositories['mcp-writing-servers'] = {
        hasUpdate: mcpStatus.hasUpdate,
        commitsBehind: mcpStatus.commitsBehind,
        changes: mcpStatus.changes,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithCategory('warn', LogCategory.GENERAL, `Could not check MCP-Writing-Servers updates: ${errorMsg}`);
    }

    // Check TypingMind repository
    try {
      const typingmindPath = path.join(this.basePath, 'typingmind');
      const tmStatus = await this.repoManager.checkForUpdates(typingmindPath);

      result.repositories['typingmind'] = {
        hasUpdate: tmStatus.hasUpdate,
        commitsBehind: tmStatus.commitsBehind,
        changes: tmStatus.changes,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithCategory('warn', LogCategory.GENERAL, `Could not check TypingMind updates: ${errorMsg}`);
    }

    // Check Docker images
    const images = ['postgres:16', 'node:18-alpine', 'nginx:alpine'];

    for (const imageName of images) {
      try {
        const hasUpdate = await this.checkImageUpdate(imageName);
        result.dockerImages[imageName] = { hasUpdate };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logWithCategory('warn', LogCategory.GENERAL, `Could not check ${imageName} update: ${errorMsg}`);
      }
    }

    return result;
  }

  /**
   * Check if Docker image has updates available
   */
  private async checkImageUpdate(imageName: string): Promise<boolean> {
    try {
      // Get current image ID
      const currentImage = this.docker.getImage(imageName);
      let currentInfo;

      try {
        currentInfo = await currentImage.inspect();
      } catch {
        // Image doesn't exist locally, consider it as needing update
        return true;
      }

      // Pull latest image (this will be a dry-run to check)
      logWithCategory('info', LogCategory.GENERAL, `Checking for updates to ${imageName}`);

      await new Promise<void>((resolve, reject) => {
        this.docker.pull(imageName, (err: Error | null, stream: any) => {
          if (err) return reject(err);

          this.docker.modem.followProgress(stream, (err: Error | null) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });

      // Get new image ID
      const newImage = this.docker.getImage(imageName);
      const newInfo = await newImage.inspect();

      return currentInfo.Id !== newInfo.Id;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithCategory('error', LogCategory.GENERAL, `Error checking image update for ${imageName}: ${errorMsg}`);
      return false;
    }
  }

  /**
   * Perform full system update with rollback capability
   */
  async performUpdate(
    options: UpdateOptions,
    progressCallback?: (message: string) => void
  ): Promise<void> {
    const backups: string[] = [];

    try {
      // Step 1: Stop services
      progressCallback?.('Stopping services...');
      await this.stopDockerServices();

      // Step 2: Create backups
      if (options.updateRepositories) {
        progressCallback?.('Creating backups...');

        const mcpServersPath = path.join(this.basePath, 'mcp-writing-servers');
        const backup = await this.repoManager.createBackup(mcpServersPath);
        backups.push(backup);
      }

      // Step 3: Update repositories
      if (options.updateRepositories) {
        progressCallback?.('Updating repositories...');

        const mcpServersPath = path.join(this.basePath, 'mcp-writing-servers');
        await this.repoManager.updateRepository(mcpServersPath);

        const typingmindPath = path.join(this.basePath, 'typingmind');
        await this.repoManager.updateRepository(typingmindPath);
      }

      // Step 4: Update Docker images
      if (options.updateDockerImages) {
        progressCallback?.('Pulling latest Docker images...');
        await this.pullLatestImages();
      }

      // Step 5: Rebuild containers
      if (options.rebuildContainers) {
        progressCallback?.('Rebuilding containers...');
        await this.buildMCPServersImage();
      }

      // Step 6: Restart services
      progressCallback?.('Starting services...');
      await this.startDockerServices();

      // Step 7: Clean up old backups
      progressCallback?.('Cleaning up...');
      await this.cleanupOldBackups('mcp-writing-servers', 3);

      progressCallback?.('Update completed successfully!');
      logWithCategory('info', LogCategory.GENERAL, 'System update completed successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithCategory('error', LogCategory.GENERAL, `Update failed, attempting rollback: ${errorMsg}`);
      progressCallback?.('Update failed, rolling back...');

      // Rollback: Restore backups
      for (const backupPath of backups) {
        try {
          await this.repoManager.restoreBackup(backupPath, path.join(this.basePath, 'mcp-writing-servers'));
        } catch (rollbackError) {
          const rollbackMsg = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
          logWithCategory('error', LogCategory.GENERAL, `Rollback failed: ${rollbackMsg}`);
        }
      }

      // Restart services with old version
      try {
        await this.startDockerServices();
      } catch (restartError) {
        const restartMsg = restartError instanceof Error ? restartError.message : String(restartError);
        logWithCategory('error', LogCategory.GENERAL, `Failed to restart services: ${restartMsg}`);
      }

      throw new Error(`Update failed and rolled back: ${errorMsg}`);
    }
  }

  /**
   * Pull latest Docker images
   */
  private async pullLatestImages(): Promise<void> {
    const images = ['postgres:16', 'node:18-alpine', 'nginx:alpine'];

    for (const imageName of images) {
      logWithCategory('info', LogCategory.GENERAL, `Pulling ${imageName}...`);

      await new Promise<void>((resolve, reject) => {
        this.docker.pull(imageName, (err: Error | null, stream: any) => {
          if (err) return reject(err);

          this.docker.modem.followProgress(stream, (err: Error | null) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    }
  }

  /**
   * Build MCP Writing Servers image
   */
  private async buildMCPServersImage(): Promise<void> {
    const buildPath = path.join(this.basePath, 'mcp-writing-servers');

    logWithCategory('info', LogCategory.GENERAL, 'Building MCP Writing Servers image...');

    await new Promise<void>((resolve, reject) => {
      this.docker.buildImage(
        {
          context: buildPath,
          src: ['Dockerfile', 'package.json', 'src'],
        },
        { t: 'mcp-writing-servers:latest' },
        (err: Error | null, stream: any) => {
          if (err) return reject(err);

          this.docker.modem.followProgress(stream, (err: Error | null) => {
            if (err) return reject(err);
            resolve();
          });
        }
      );
    });

    logWithCategory('info', LogCategory.GENERAL, 'MCP Writing Servers image built successfully');
  }

  /**
   * Stop Docker services using Docker Compose
   */
  private async stopDockerServices(): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    logWithCategory('info', LogCategory.GENERAL, 'Stopping Docker services');

    try {
      await execAsync('docker compose down', { cwd: this.basePath });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithCategory('warn', LogCategory.GENERAL, `Error stopping services: ${errorMsg}`);
    }
  }

  /**
   * Start Docker services using Docker Compose
   */
  private async startDockerServices(): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    logWithCategory('info', LogCategory.GENERAL, 'Starting Docker services');

    await execAsync('docker compose up -d', { cwd: this.basePath });
  }

  /**
   * Clean up old backups (keep only N most recent)
   */
  private async cleanupOldBackups(repoName: string, keepCount: number): Promise<void> {
    const fs = require('fs-extra');
    const repoPath = path.join(this.basePath, repoName);
    const parentDir = path.dirname(repoPath);
    const repoBaseName = path.basename(repoPath);

    try {
      const files = await fs.readdir(parentDir);
      const backups = files
        .filter((file: string) => file.startsWith(`${repoBaseName}.backup.`))
        .map((file: string) => ({
          name: file,
          path: path.join(parentDir, file),
          timestamp: parseInt(file.split('.backup.')[1]),
        }))
        .sort((a: any, b: any) => b.timestamp - a.timestamp);

      // Remove old backups
      const toRemove = backups.slice(keepCount);
      for (const backup of toRemove) {
        await fs.remove(backup.path);
        logWithCategory('info', LogCategory.GENERAL, `Removed old backup: ${backup.name}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithCategory('warn', LogCategory.GENERAL, `Could not clean up old backups: ${errorMsg}`);
    }
  }
}
