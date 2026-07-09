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
import { getFixedEnv } from './prerequisites';

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
  /** True when the user dismissed a file picker instead of a real failure */
  canceled?: boolean;
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
  /**
   * Where this backup came from:
   *  - 'app': created via this app's Backup Manager (userData/backups)
   *  - 'scheduled-task': written by the separate "FictionLab DB Daily Backup"
   *    Windows Scheduled Task (C:\Backups\fictionlab). This app only reads
   *    from that directory -- it never writes to or manages the task itself.
   */
  source: 'app' | 'scheduled-task';
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
 * Result of a lightweight backup integrity check
 */
export interface ValidateResult {
  success: boolean;
  valid: boolean;
  message: string;
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
 * Validate a Postgres table name is a safe, unquoted identifier.
 * Table names are passed to pg_dump via shell exec, so this rejects anything
 * that isn't a plain identifier (guards against shell/SQL injection).
 */
function isValidTableIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

/**
 * Create a database backup
 * @param customPath Optional custom path for the backup file
 * @param compressed Whether to compress the backup (default: true)
 * @param tables Optional list of table names to scope the backup to (table-level backup).
 *               Omit or pass an empty array for a full database backup.
 */
export async function createBackup(
  customPath?: string,
  compressed: boolean = true,
  tables?: string[]
): Promise<BackupResult> {
  logWithCategory('info', LogCategory.SYSTEM, 'Starting database backup...');

  try {
    // Validate table names up front (before touching the filesystem or Docker)
    let tableArgs = '';
    if (tables && tables.length > 0) {
      const invalidTable = tables.find((t) => !isValidTableIdentifier(t));
      if (invalidTable) {
        throw new Error(`Invalid table name: "${invalidTable}"`);
      }
      tableArgs = tables.map((t) => ` -t "${t}"`).join('');
    }

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
      dumpCommand = `docker exec ${containerName} pg_dump -U ${user} -Fc -Z 9 -d ${database}${tableArgs}`;
    } else {
      // Plain SQL format
      dumpCommand = `docker exec ${containerName} pg_dump -U ${user} -d ${database}${tableArgs}`;
    }

    logWithCategory('info', LogCategory.SYSTEM, `Executing: ${dumpCommand.replace(password, '****')}`);

    // Execute the backup command and save output to file
    const { stdout, stderr } = await execAsync(dumpCommand, {
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer
      timeout: 300000, // 5 minutes timeout
      env: {
        ...getFixedEnv(),
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

    const tableSuffix = tables && tables.length > 0
      ? ` [${tables.length} table${tables.length !== 1 ? 's' : ''}: ${tables.join(', ')}]`
      : '';

    return {
      success: true,
      message: `Backup created successfully: ${filename} (${sizeInMB} MB)${tableSuffix}`,
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

    await execAsync(`docker cp "${backupPath}" ${containerName}:${containerBackupPath}`, { env: getFixedEnv() });

    // If drop existing flag is set, drop and recreate the database
    if (dropExisting) {
      logWithCategory('warn', LogCategory.SYSTEM, 'Dropping existing database...');

      // Terminate all connections to the database
      const terminateCmd = `docker exec ${containerName} psql -U ${user} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();"`;
      await execAsync(terminateCmd, {
        env: { ...getFixedEnv(), PGPASSWORD: password },
      });

      // Drop database
      const dropCmd = `docker exec ${containerName} dropdb -U ${user} --if-exists ${database}`;
      await execAsync(dropCmd, {
        env: { ...getFixedEnv(), PGPASSWORD: password },
      });

      // Recreate database
      const createCmd = `docker exec ${containerName} createdb -U ${user} ${database}`;
      await execAsync(createCmd, {
        env: { ...getFixedEnv(), PGPASSWORD: password },
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
        ...getFixedEnv(),
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
      await execAsync(`docker exec ${containerName} rm ${containerBackupPath}`, { env: getFixedEnv() });
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
 * Directory used by the separate "FictionLab DB Daily Backup" Windows Scheduled Task
 * (pg_dump of the fictionlab-postgres container / mcp_writing_db database, superuser
 * `writer`, trust-auth local -- see shared/scripts/backup-fictionlab-db.ps1).
 *
 * This app NEVER writes here and never manages the scheduled task itself -- it only
 * reads this directory so those backups can be browsed and restored from the same
 * list as backups the app creates. Configurable via FICTIONLAB_SCHEDULED_BACKUP_DIR
 * for non-default installs and tests.
 */
export function getScheduledTaskBackupDirectory(): string {
  return process.env.FICTIONLAB_SCHEDULED_BACKUP_DIR || 'C:\\Backups\\fictionlab';
}

/**
 * Parse a scheduled-task backup filename, e.g. `fictionlab-mcp_writing_db-20260101-030000.dump`.
 * Returns null for anything that isn't a per-database dump -- in particular the task's
 * `fictionlab-globals-*.sql` (roles-only, not a database backup) and `backup-log.txt`
 * are intentionally excluded so they never show up as restorable "backups".
 */
function parseScheduledTaskFilename(filename: string): { database: string } | null {
  if (!filename.endsWith('.dump')) return null;
  const match = filename.match(/^fictionlab-(.+)-\d{8}-\d{6}\.dump$/);
  return match ? { database: match[1] } : null;
}

/**
 * List backups written by the "FictionLab DB Daily Backup" scheduled task.
 * Read-only, best-effort: a missing directory (e.g. on a machine where the task
 * hasn't run yet) or an unreadable directory yields an empty list rather than
 * failing the whole listBackups() call.
 */
async function listScheduledTaskBackups(): Promise<BackupMetadata[]> {
  const dir = getScheduledTaskBackupDirectory();
  const backups: BackupMetadata[] = [];

  if (!(await fs.pathExists(dir))) {
    return backups;
  }

  try {
    const files = await fs.readdir(dir);

    for (const filename of files) {
      const parsed = parseScheduledTaskFilename(filename);
      if (!parsed) continue;

      try {
        const filePath = path.join(dir, filename);
        const stats = await fs.stat(filePath);

        backups.push({
          filename,
          path: filePath,
          createdAt: stats.mtime.toISOString(),
          size: stats.size,
          database: parsed.database,
          compressed: true, // scheduled task always dumps in custom format (-Fc)
          source: 'scheduled-task',
        });
      } catch (error) {
        logWithCategory('warn', LogCategory.SYSTEM, `Failed to get metadata for scheduled-task backup: ${filename}`);
      }
    }
  } catch (error: any) {
    logWithCategory('warn', LogCategory.SYSTEM, `Failed to read scheduled-task backup directory: ${error.message || error}`);
  }

  return backups;
}

/**
 * List all available backups: the app's own (userData/backups) plus the ones
 * written by the separate "FictionLab DB Daily Backup" Windows Scheduled Task
 * (C:\Backups\fictionlab), merged into a single newest-first list. Each entry's
 * `source` field distinguishes the two so the UI can label them accordingly.
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
          source: 'app',
        });
      } catch (error) {
        logWithCategory('warn', LogCategory.SYSTEM, `Failed to get metadata for backup: ${filename}`);
      }
    }

    // Merge in the scheduled task's backups so both sources show up in one list
    const scheduledBackups = await listScheduledTaskBackups();
    backups.push(...scheduledBackups);

    // Sort by creation date (newest first)
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    logWithCategory(
      'info',
      LogCategory.SYSTEM,
      `Found ${backups.length} backup(s) (${backups.length - scheduledBackups.length} app, ${scheduledBackups.length} scheduled-task)`
    );

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

/**
 * Lightweight integrity check for a backup file, based on its format signature.
 * Deliberately does NOT shell out to Docker/pg_restore -- it's meant to be a fast,
 * safe check the UI can run without touching the live database or container:
 *  - .dump  (pg_dump custom format): must start with the "PGDMP" magic bytes
 *  - .gz    (gzip-compressed plain SQL): must start with the gzip magic bytes (0x1f 0x8b)
 *  - .sql   (plain SQL): looks for the standard pg_dump header comment
 */
export async function validateBackupFile(backupPath: string): Promise<ValidateResult> {
  logWithCategory('info', LogCategory.SYSTEM, `Validating backup: ${backupPath}`);

  try {
    if (!await fs.pathExists(backupPath)) {
      return { success: true, valid: false, message: 'Backup file not found' };
    }

    const stats = await fs.stat(backupPath);
    if (stats.size === 0) {
      return { success: true, valid: false, message: 'Backup file is empty' };
    }

    const buffer = await fs.readFile(backupPath);
    const lower = backupPath.toLowerCase();

    if (lower.endsWith('.dump')) {
      const isValid = buffer.subarray(0, 5).toString('ascii') === 'PGDMP';
      return {
        success: true,
        valid: isValid,
        message: isValid
          ? 'Valid pg_dump custom-format backup (PGDMP header present)'
          : 'File does not have a valid pg_dump custom-format header',
      };
    }

    if (lower.endsWith('.gz')) {
      const isValid = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
      return {
        success: true,
        valid: isValid,
        message: isValid
          ? 'Valid gzip-compressed backup (gzip header present)'
          : 'File does not have a valid gzip header',
      };
    }

    // Plain .sql -- look for the standard pg_dump header comment near the top of the file
    const head = buffer.subarray(0, 4096).toString('utf-8');
    const isValid = /postgresql database dump/i.test(head) || head.trimStart().startsWith('--');
    return {
      success: true,
      valid: isValid,
      message: isValid
        ? 'Valid plain SQL backup (pg_dump header present)'
        : 'File does not look like a pg_dump plain SQL backup',
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to validate backup', { error: errorMessage });
    return { success: false, valid: false, message: 'Failed to validate backup', error: errorMessage };
  }
}

/**
 * Copy a backup file to a user-chosen location (native save dialog).
 * Used by the "Download" action so backups can be exported off the machine.
 */
export async function downloadBackup(sourcePath: string): Promise<BackupResult> {
  logWithCategory('info', LogCategory.SYSTEM, `Downloading backup: ${sourcePath}`);

  try {
    if (!await fs.pathExists(sourcePath)) {
      throw new Error(`Backup file not found: ${sourcePath}`);
    }

    const defaultFilename = path.basename(sourcePath);
    const result = await dialog.showSaveDialog({
      title: 'Download Database Backup',
      defaultPath: path.join(app.getPath('downloads'), defaultFilename),
      filters: [
        { name: 'Backup Files', extensions: ['gz', 'sql', 'dump'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, message: 'Download canceled', canceled: true };
    }

    await fs.copy(sourcePath, result.filePath);
    const stats = await fs.stat(result.filePath);

    logWithCategory('info', LogCategory.SYSTEM, `Backup downloaded to: ${result.filePath}`);

    return {
      success: true,
      message: `Backup downloaded to ${result.filePath}`,
      path: result.filePath,
      size: stats.size,
    };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to download backup', { error: errorMessage });
    return { success: false, message: 'Failed to download backup', error: errorMessage };
  }
}
