/**
 * PgBouncer Configuration Generator
 * Generates pgbouncer.ini and userlist.txt files dynamically based on environment config
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import logger, { logWithCategory, LogCategory } from './logger';
import { EnvConfig } from './env-config';

/**
 * Get the project root directory (where docker-compose.yml is located)
 */
function getProjectRootDirectory(): string {
  if (app.isPackaged) {
    return path.join(path.dirname(app.getAppPath()));
  } else {
    return path.join(__dirname, '..', '..');
  }
}

/**
 * Generate MD5 hash for PgBouncer authentication
 * Format: "md5" + md5(password + username)
 */
function generateMD5Hash(password: string, username: string): string {
  const hash = crypto
    .createHash('md5')
    .update(password + username)
    .digest('hex');
  return `md5${hash}`;
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
    const iniContent = `[databases]
* = host=localhost port=5432 dbname=${config.POSTGRES_DB}

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
admin_users = ${config.POSTGRES_USER}
pool_mode = transaction
max_client_conn = 200
default_pool_size = 25
min_pool_size = 10
reserve_pool_size = 10
server_idle_timeout = 600
server_lifetime = 3600
server_connect_timeout = 15
query_timeout = 0
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
ignore_startup_parameters = extra_float_digits
`;

    // Generate userlist.txt content
    // Format: "username" "md5hash"
    const md5Hash = generateMD5Hash(config.POSTGRES_PASSWORD, config.POSTGRES_USER);
    const userlistContent = `"${config.POSTGRES_USER}" "${md5Hash}"\n`;

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
