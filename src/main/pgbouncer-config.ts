/**
 * PgBouncer Configuration Generator
 * Generates pgbouncer.ini and userlist.txt files dynamically based on environment config
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger, { logWithCategory, LogCategory } from './logger';
import { EnvConfig } from './env-config';

const execAsync = promisify(exec);

import { getProjectRootDirectory } from './mcp-system';

/**
 * Fetch SCRAM-SHA-256 hash from PostgreSQL for PgBouncer authentication
 * When using scram-sha-256 auth_type, PgBouncer needs the actual SCRAM hash from PostgreSQL
 */
async function fetchScramHashFromPostgres(config: EnvConfig): Promise<string> {
  try {
    // Query PostgreSQL for the SCRAM hash
    // Using sh -c for cross-platform compatibility and proper quote handling
    const query = `SELECT rolpassword FROM pg_authid WHERE rolname = '${config.POSTGRES_USER}';`;
    const command = `docker exec fictionlab-postgres sh -c "psql -U ${config.POSTGRES_USER} -d ${config.POSTGRES_DB} -t -A -c \\"${query}\\""`;

    const { stdout } = await execAsync(command);
    const scramHash = stdout.trim();

    if (!scramHash || !scramHash.startsWith('SCRAM-SHA-256')) {
      throw new Error('Failed to retrieve valid SCRAM hash from PostgreSQL');
    }

    logWithCategory('info', LogCategory.DOCKER, 'Retrieved SCRAM hash from PostgreSQL');
    return scramHash;
  } catch (error: any) {
    logWithCategory('warn', LogCategory.DOCKER, 'Could not fetch SCRAM hash from PostgreSQL, using plaintext password', error);
    // Fallback to plaintext password if we can't get the hash
    return config.POSTGRES_PASSWORD;
  }
}

/**
 * Generate pgbouncer.ini configuration file
 */
export async function generatePgBouncerConfig(config: EnvConfig): Promise<{
  success: boolean;
  iniPath?: string;
  userlistPath?: string;
  error?: string;
}> {
  logWithCategory('info', LogCategory.DOCKER, 'Generating PgBouncer configuration files...');

  try {
    const projectRoot = getProjectRootDirectory();
    const iniPath = path.join(projectRoot, 'pgbouncer.ini');
    const userlistPath = path.join(projectRoot, 'userlist.txt');

    // Generate pgbouncer.ini content
    // Use container hostname for cross-platform compatibility
    const iniContent = `[databases]
* = host=postgres port=5432 dbname=${config.POSTGRES_DB}

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
admin_users = ${config.POSTGRES_USER}
pool_mode = transaction
max_client_conn = 500
default_pool_size = 50
min_pool_size = 10
reserve_pool_size = 20
server_idle_timeout = 600
server_lifetime = 3600
server_connect_timeout = 15
query_timeout = 0
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
ignore_startup_parameters = extra_float_digits
client_tls_sslmode = disable
`;

    // Generate userlist.txt content
    // Format for scram-sha-256: "username" "SCRAM-SHA-256$..."
    // PgBouncer needs the actual SCRAM hash from PostgreSQL for proper authentication
    const passwordHash = await fetchScramHashFromPostgres(config);
    const userlistContent = `"${config.POSTGRES_USER}" "${passwordHash}"\n`;

    // Write both files
    await fs.writeFile(iniPath, iniContent, 'utf-8');
    await fs.writeFile(userlistPath, userlistContent, 'utf-8');

    logWithCategory('info', LogCategory.DOCKER, 'PgBouncer configuration files generated successfully', {
      iniPath,
      userlistPath,
      database: config.POSTGRES_DB,
      user: config.POSTGRES_USER
    });

    return {
      success: true,
      iniPath,
      userlistPath
    };

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.DOCKER, 'Failed to generate PgBouncer configuration', error);

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Clean up PgBouncer configuration files
 */
export async function cleanupPgBouncerConfig(): Promise<void> {
  try {
    const projectRoot = getProjectRootDirectory();
    const iniPath = path.join(projectRoot, 'pgbouncer.ini');
    const userlistPath = path.join(projectRoot, 'userlist.txt');

    if (await fs.pathExists(iniPath)) {
      await fs.remove(iniPath);
      logWithCategory('info', LogCategory.DOCKER, 'Removed pgbouncer.ini');
    }

    if (await fs.pathExists(userlistPath)) {
      await fs.remove(userlistPath);
      logWithCategory('info', LogCategory.DOCKER, 'Removed userlist.txt');
    }

  } catch (error) {
    logWithCategory('warn', LogCategory.DOCKER, 'Error cleaning up PgBouncer configuration', error);
  }
}
