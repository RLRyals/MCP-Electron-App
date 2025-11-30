/**
 * Database Backup and Restore Module
 * Handles PostgreSQL database backup and restore operations
 * Uses pg_dump and pg_restore via Docker exec commands
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';
import { app, dialog } from 'electron';
import { logWithCategory, LogCategory } from './logger';
import * as envConfig from './env-config';

const execAsync = promisify(exec);

/**
 * Backup operation result
 */
export interface BackupResult {
  success: boolean;
  message: string;
  path?: string;
  size?: number;
  error?: string;
}

/**
 * Restore operation result
 */
export interface RestoreResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Backup metadata interface
 */
export interface BackupMetadata {
  filename: string;
  path: string;
  createdAt: string;
  size: number;
  database: string;
  compressed: boolean;
}

/**
 * List backups result
 */
export interface ListBackupsResult {
  success: boolean;
  backups: BackupMetadata[];
  error?: string;
}

/**
 * Get the default backup directory
 */
export function getBackupDirectory(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'backups');
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDirectory(): Promise<void> {
  const backupDir = getBackupDirectory();
  await fs.ensureDir(backupDir);
  logWithCategory('info', LogCategory.SYSTEM, `Backup directory ensured: ${backupDir}`);
}

/**
 * Generate a backup filename with timestamp
 */
function generateBackupFilename(database: string, compressed: boolean = true): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const extension = compressed ? '.sql.gz' : '.sql';
  return `${database}_${timestamp}${extension}`;
}

/**
 * Create a database backup
 * @param customPath Optional custom path for the backup file
 * @param compressed Whether to compress the backup (default: true)
 */
export async function createBackup(
  customPath?: string,
  compressed: boolean = true
): Promise<BackupResult> {
  logWithCategory('info', LogCategory.SYSTEM, 'Starting database backup...');

  try {
    // Ensure backup directory exists
    await ensureBackupDirectory();

    // Get database configuration
    const config = await envConfig.loadEnvConfig();
    const database = config.POSTGRES_DB;
    const user = config.POSTGRES_USER;
    const password = config.POSTGRES_PASSWORD;

    // Generate backup filename
    const filename = generateBackupFilename(database, compressed);
    const backupPath = customPath || path.join(getBackupDirectory(), filename);

    // Ensure the directory for the backup path exists
    await fs.ensureDir(path.dirname(backupPath));

    logWithCategory('info', LogCategory.SYSTEM, `Creating backup to: ${backupPath}`);

    // Build pg_dump command
    // We'll execute this inside the postgres container for simplicity
    const containerName = 'fictionlab-postgres';

    // Determine the format and compression options
    let dumpCommand: string;
    if (compressed) {
      // Custom format with compression (can be restored with pg_restore)
      dumpCommand = `docker exec ${containerName} pg_dump -U ${user} -Fc -Z 9 -d ${database}`;
    } else {
      // Plain SQL format
      dumpCommand = `docker exec ${containerName} pg_dump -U ${user} -d ${database}`;
    }

    logWithCategory('info', LogCategory.SYSTEM, `Executing: ${dumpCommand.replace(password, '****')}`);

    // Execute the backup command and save output to file
    const { stdout, stderr } = await execAsync(dumpCommand, {
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer
      timeout: 300000, // 5 minutes timeout
      env: {
        ...process.env,
        PGPASSWORD: password,
      },
    });

    // Write the backup to file
    await fs.writeFile(backupPath, stdout);

    // Check if stderr has any warnings (pg_dump may write warnings to stderr even on success)
    if (stderr && stderr.trim().length > 0) {
      logWithCategory('warn', LogCategory.SYSTEM, `pg_dump warnings: ${stderr}`);
    }

    // Get file size
    const stats = await fs.stat(backupPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    logWithCategory('info', LogCategory.SYSTEM, `Backup completed successfully: ${backupPath} (${sizeInMB} MB)`);

    return {
      success: true,
      message: `Backup created successfully: ${filename} (${sizeInMB} MB)`,
      path: backupPath,
      size: stats.size,
    };

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to create backup', { error: errorMessage });

    return {
      success: false,
      message: 'Failed to create database backup',
      error: errorMessage,
    };
  }
}

/**
 * Restore a database from backup
 * @param backupPath Path to the backup file
 * @param dropExisting Whether to drop the existing database before restore (default: false)
 */
export async function restoreBackup(
  backupPath: string,
  dropExisting: boolean = false
): Promise<RestoreResult> {
  logWithCategory('info', LogCategory.SYSTEM, `Starting database restore from: ${backupPath}`);

  try {
    // Verify backup file exists
    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    // Get database configuration
    const config = await envConfig.loadEnvConfig();
    const database = config.POSTGRES_DB;
    const user = config.POSTGRES_USER;
    const password = config.POSTGRES_PASSWORD;

    const containerName = 'fictionlab-postgres';

    // Determine if backup is compressed (based on file extension)
    const isCompressed = backupPath.endsWith('.gz') || backupPath.endsWith('.dump');

    // Copy backup file into container
    const containerBackupPath = `/tmp/${path.basename(backupPath)}`;
    logWithCategory('info', LogCategory.SYSTEM, `Copying backup to container: ${containerBackupPath}`);

    await execAsync(`docker cp "${backupPath}" ${containerName}:${containerBackupPath}`);

    // If drop existing flag is set, drop and recreate the database
    if (dropExisting) {
      logWithCategory('warn', LogCategory.SYSTEM, 'Dropping existing database...');

      // Terminate all connections to the database
      const terminateCmd = `docker exec ${containerName} psql -U ${user} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();"`;
      await execAsync(terminateCmd, {
        env: { ...process.env, PGPASSWORD: password },
      });

      // Drop database
      const dropCmd = `docker exec ${containerName} dropdb -U ${user} --if-exists ${database}`;
      await execAsync(dropCmd, {
        env: { ...process.env, PGPASSWORD: password },
      });

      // Recreate database
      const createCmd = `docker exec ${containerName} createdb -U ${user} ${database}`;
      await execAsync(createCmd, {
        env: { ...process.env, PGPASSWORD: password },
      });

      logWithCategory('info', LogCategory.SYSTEM, 'Database recreated successfully');
    }

    // Build restore command
    let restoreCommand: string;
    if (isCompressed) {
      // Use pg_restore for custom format
      restoreCommand = `docker exec ${containerName} pg_restore -U ${user} -d ${database} --clean --if-exists ${containerBackupPath}`;
    } else {
      // Use psql for plain SQL format
      restoreCommand = `docker exec ${containerName} psql -U ${user} -d ${database} -f ${containerBackupPath}`;
    }

    logWithCategory('info', LogCategory.SYSTEM, `Executing restore: ${restoreCommand.replace(password, '****')}`);

    // Execute restore command
    const { stderr } = await execAsync(restoreCommand, {
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer
      timeout: 600000, // 10 minutes timeout
      env: {
        ...process.env,
        PGPASSWORD: password,
      },
    });

    // Check stderr for errors (pg_restore/psql may write warnings to stderr)
    if (stderr && stderr.includes('ERROR')) {
      logWithCategory('error', LogCategory.SYSTEM, `Restore errors: ${stderr}`);
      throw new Error(`Restore completed with errors: ${stderr}`);
    } else if (stderr && stderr.trim().length > 0) {
      logWithCategory('warn', LogCategory.SYSTEM, `Restore warnings: ${stderr}`);
    }

    // Clean up: remove backup file from container
    try {
      await execAsync(`docker exec ${containerName} rm ${containerBackupPath}`);
    } catch (cleanupError) {
      logWithCategory('warn', LogCategory.SYSTEM, 'Failed to clean up temporary backup file in container');
    }

    logWithCategory('info', LogCategory.SYSTEM, 'Database restore completed successfully');

    return {
      success: true,
      message: 'Database restored successfully',
    };

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to restore backup', { error: errorMessage });

    return {
      success: false,
      message: 'Failed to restore database backup',
      error: errorMessage,
    };
  }
}

/**
 * List all available backups in the backup directory
 */
export async function listBackups(): Promise<ListBackupsResult> {
  logWithCategory('info', LogCategory.SYSTEM, 'Listing available backups...');

  try {
    await ensureBackupDirectory();
    const backupDir = getBackupDirectory();

    // Read all files in backup directory
    const files = await fs.readdir(backupDir);

    // Filter for backup files (.sql or .sql.gz)
    const backupFiles = files.filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'));

    // Get metadata for each backup
    const backups: BackupMetadata[] = [];
    for (const filename of backupFiles) {
      try {
        const filePath = path.join(backupDir, filename);
        const stats = await fs.stat(filePath);

        // Extract database name from filename (format: dbname_timestamp.sql[.gz])
        const match = filename.match(/^(.+?)_(\d{4}-\d{2}-\d{2})/);
        const database = match ? match[1] : 'unknown';

        backups.push({
          filename,
          path: filePath,
          createdAt: stats.mtime.toISOString(),
          size: stats.size,
          database,
          compressed: filename.endsWith('.gz'),
        });
      } catch (error) {
        logWithCategory('warn', LogCategory.SYSTEM, `Failed to get metadata for backup: ${filename}`);
      }
    }

    // Sort by creation date (newest first)
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    logWithCategory('info', LogCategory.SYSTEM, `Found ${backups.length} backup(s)`);

    return {
      success: true,
      backups,
    };

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to list backups', { error: errorMessage });

    return {
      success: false,
      backups: [],
      error: errorMessage,
    };
  }
}

/**
 * Delete a backup file
 */
export async function deleteBackup(backupPath: string): Promise<BackupResult> {
  logWithCategory('info', LogCategory.SYSTEM, `Deleting backup: ${backupPath}`);

  try {
    // Verify file exists
    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    // Delete the file
    await fs.remove(backupPath);

    logWithCategory('info', LogCategory.SYSTEM, `Backup deleted successfully: ${backupPath}`);

    return {
      success: true,
      message: 'Backup deleted successfully',
    };

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to delete backup', { error: errorMessage });

    return {
      success: false,
      message: 'Failed to delete backup',
      error: errorMessage,
    };
  }
}

/**
 * Show native file picker to select backup save location
 */
export async function selectBackupSaveLocation(): Promise<string | null> {
  try {
    const config = await envConfig.loadEnvConfig();
    const database = config.POSTGRES_DB;
    const defaultFilename = generateBackupFilename(database);

    const result = await dialog.showSaveDialog({
      title: 'Save Database Backup',
      defaultPath: path.join(app.getPath('documents'), defaultFilename),
      filters: [
        { name: 'Compressed SQL Backup', extensions: ['sql.gz'] },
        { name: 'SQL Backup', extensions: ['sql'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to show save dialog', error);
    return null;
  }
}

/**
 * Show native file picker to select backup file for restore
 */
export async function selectBackupFileForRestore(): Promise<string | null> {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Database Backup to Restore',
      defaultPath: getBackupDirectory(),
      filters: [
        { name: 'SQL Backups', extensions: ['sql', 'gz', 'dump'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to show open dialog', error);
    return null;
  }
}

/**
 * Get backup directory path (for UI display)
 */
export function getBackupDirectoryPath(): string {
  return getBackupDirectory();
}

/**
 * Open backup directory in file explorer
 */
export async function openBackupDirectory(): Promise<void> {
  const { shell } = require('electron');
  await ensureBackupDirectory();
  const backupDir = getBackupDirectory();
  await shell.openPath(backupDir);
  logWithCategory('info', LogCategory.SYSTEM, `Opened backup directory: ${backupDir}`);
}
