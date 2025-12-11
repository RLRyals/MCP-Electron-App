import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getFixedEnv } from './prerequisites';
import { logWithCategory, LogCategory } from './logger';
import * as envConfig from './env-config';

const execAsync = promisify(exec);

/**
 * Interface for a migration file
 */
interface MigrationFile {
  filename: string;
  version: number; // Extracted from filename (e.g., 026)
  name: string;    // Extracted from filename (e.g., revision_and_metrics)
  fullPath: string;
}

/**
 * Database Migrator
 * Handles executing SQL migrations from the MCP-Writing-Servers repository
 * against the Dockerized PostgreSQL database.
 */
export class DatabaseMigrator {
  private repoPath: string;
  private containerName: string = 'fictionlab-postgres';
  private dbUser: string;
  private dbName: string;

  constructor(repoPath: string, config: envConfig.EnvConfig) {
    this.repoPath = repoPath;
    // Use configuration values passed from caller
    this.dbUser = config.POSTGRES_USER;
    this.dbName = config.POSTGRES_DB;
  }

  /**
   * Run all pending migrations
   * @param progressCallback Optional callback for progress updates
   */
  async runMigrations(
    progressCallback?: (message: string, progress: number) => void
  ): Promise<{ success: boolean; executed: string[]; error?: string }> {
    logWithCategory('info', LogCategory.SYSTEM, 'Starting database migration process...');
    
    try {
      if (progressCallback) progressCallback('Checking for pending migrations...', 10);

      // 1. Ensure database is accessible
      const isReady = await this.checkDatabaseReady();
      if (!isReady) {
        throw new Error('Database container is not ready or accessible');
      }

      // 2. Ensure migrations table exists
      await this.ensureMigrationsTable();

      // 3. Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      logWithCategory('info', LogCategory.SYSTEM, `Found ${appliedMigrations.length} applied migrations`);

      // 4. Get available migrations from disk
      const availableMigrations = await this.getAvailableMigrations();
      logWithCategory('info', LogCategory.SYSTEM, `Found ${availableMigrations.length} available migrations in ${this.repoPath}`);

      // 5. Filter pending migrations
      const pendingMigrations = availableMigrations.filter(
        (m) => !appliedMigrations.includes(m.filename)
      );

      if (pendingMigrations.length === 0) {
        logWithCategory('info', LogCategory.SYSTEM, 'No pending migrations found. Database is up to date.');
        if (progressCallback) progressCallback('Database is up to date.', 100);
        return { success: true, executed: [] };
      }

      logWithCategory('info', LogCategory.SYSTEM, `Found ${pendingMigrations.length} pending migrations: ${pendingMigrations.map(m => m.filename).join(', ')}`);

      // 6. Execute pending migrations
      const executed: string[] = [];
      let currentProgress = 20;
      const progressPerFile = 70 / pendingMigrations.length;

      for (const migration of pendingMigrations) {
        if (progressCallback) {
          progressCallback(`Running migration: ${migration.filename}...`, Math.round(currentProgress));
        }

        logWithCategory('info', LogCategory.SYSTEM, `Executing migration: ${migration.filename}`);
        
        await this.applyMigration(migration);
        executed.push(migration.filename);
        
        currentProgress += progressPerFile;
      }

      if (progressCallback) progressCallback('Migrations completed successfully!', 100);
      
      return { success: true, executed };

    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Migration failed', error);
      return { 
        success: false, 
        executed: [], 
        error: error.message || 'Unknown error during migration' 
      };
    }
  }

  /**
   * Check if the database container is running and accepting commands
   */
  private async checkDatabaseReady(): Promise<boolean> {
    try {
      await execAsync(`docker exec ${this.containerName} pg_isready -U ${this.dbUser}`, { env: getFixedEnv() });
      return true;
    } catch (error) {
      logWithCategory('warn', LogCategory.SYSTEM, 'Database container not ready or pg_isready failed');
      return false;
    }
  }

  /**
   * Ensure the migrations tracking table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        run_on TIMESTAMP DEFAULT NOW()
      );
    `;
    
    await this.executeSql(createTableSQL);
  }

  /**
   * Get list of migration filenames that have already been applied
   */
  private async getAppliedMigrations(): Promise<string[]> {
    try {
      const { stdout } = await this.executeSql("SELECT name FROM migrations ORDER BY id ASC;", true);
      // Parse output usually looks like:
      // name
      // ------
      // 001_initial.sql
      // (1 row)
      
      const lines = stdout.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('name') && !l.startsWith('----') && !l.match(/^\(\d+ rows?\)$/));
      
      return lines;
    } catch (error) {
        // If table doesn't exist yet (should be caught by ensureMigrationsTable, but just in case)
      return [];
    }
  }

  /**
   * Get all migration files from the repo directory
   */
  private async getAvailableMigrations(): Promise<MigrationFile[]> {
    const migrationsDir = path.join(this.repoPath, 'migrations');
    
    if (!await fs.pathExists(migrationsDir)) {
      logWithCategory('warn', LogCategory.SYSTEM, `Migrations directory not found at: ${migrationsDir}`);
      return [];
    }

    const files = await fs.readdir(migrationsDir);
    
    return files
      .filter(f => f.endsWith('.sql'))
      .map(filename => {
        // Match 001_some_name.sql
        const match = filename.match(/^(\d+)_(.+)\.sql$/);
        return {
          filename,
          version: match ? parseInt(match[1], 10) : 0,
          name: match ? match[2] : filename,
          fullPath: path.join(migrationsDir, filename)
        };
      })
      .sort((a, b) => a.version - b.version);
  }

  /**
   * Apply a single migration file
   */
  private async applyMigration(migration: MigrationFile): Promise<void> {
    // 1. Copy file to container (to avoid complex quoting issues with sending content directly)
    // Actually, sending content via stdin is usually cleaner than copying if file size is reasonable.
    // But docker exec -i works well.
    
    // Read file content
    const sqlContent = await fs.readFile(migration.fullPath, 'utf8');
    
    // Execute SQL
    await this.executeSql(sqlContent);

    // Record as executed
    // This is handled by the SQL file itself, so we don't need to do it here.
    // await this.executeSql(`INSERT INTO migrations (filename) VALUES ('${migration.filename}');`);
  }

  /**
   * Execute raw SQL inside the container
   * @param sql SQL string
   * @param tuplesOnly If true, returns cleaner output (psql -t)
   */
  private async executeSql(sql: string, tuplesOnly: boolean = false): Promise<{ stdout: string; stderr: string }> {
    // Escape single quotes for the shell command wrapper, 
    // BUT we are piping into docker exec -i, so we handle it differently.
    
    // Using child_process.spawn or exec with input stream is safer for large SQL
    // But for simplicity with execAsync, we'll try to pipe.
    
    // Windows PowerShell piping to docker exec can be tricky with encoding.
    // A robust way in Node is to use the 'input' option of exec if available, 
    // or write to stdin of the spawned process.
    
    return new Promise((resolve, reject) => {
      const args = [
        'exec',
        '-i', // Interactive mode to accept stdin
        this.containerName,
        'psql',
        '-U', this.dbUser,
        '-d', this.dbName,
        '-v', 'ON_ERROR_STOP=1'
      ];
      
      if (tuplesOnly) {
        args.push('-t', '-A'); // Tuples only, unaligned (for easier parsing)
      }

      const { spawn } = require('child_process');
      const child = spawn('docker', args, { env: getFixedEnv() });
      
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: any) => { stdout += data.toString(); });
      child.stderr.on('data', (data: any) => { stderr += data.toString(); });
      
      child.on('close', (code: number) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
            // psql error
          reject(new Error(`SQL Execution failed (Exit code ${code}): ${stderr}\nSQL start: ${sql.substring(0, 100)}...`));
        }
      });
      
      child.on('error', (err: any) => {
        reject(err);
      });

      // Write SQL to stdin
      child.stdin.write(sql);
      child.stdin.end();
    });
  }
}
