/**
 * Database Connection Module
 *
 * Manages PostgreSQL database connection pool for the application
 * and provides it to plugins and other modules.
 */

import { Pool, PoolConfig } from 'pg';
import { logWithCategory, LogCategory } from './logger';
import * as envConfig from './env-config';

let pool: Pool | null = null;

/**
 * Initialize database connection pool
 *
 * Creates a PostgreSQL connection pool using environment configuration
 */
export async function initializeDatabasePool(): Promise<Pool> {
  if (pool) {
    logWithCategory('debug', LogCategory.SYSTEM, 'Database pool already initialized');
    return pool;
  }

  try {
    // Load environment configuration
    const config = await envConfig.loadEnvConfig();

    // Create pool configuration
    const poolConfig: PoolConfig = {
      host: 'localhost',
      port: config.POSTGRES_PORT,
      database: config.POSTGRES_DB,
      user: config.POSTGRES_USER,
      password: config.POSTGRES_PASSWORD,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    // Create pool
    pool = new Pool(poolConfig);

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logWithCategory('info', LogCategory.SYSTEM,
      `Database connection pool initialized (database: ${config.POSTGRES_DB}, port: ${config.POSTGRES_PORT})`
    );

    // Handle pool errors
    pool.on('error', (err) => {
      logWithCategory('error', LogCategory.SYSTEM, 'Unexpected database pool error:', err);
    });

    return pool;
  } catch (error: any) {
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to initialize database pool:', error);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

/**
 * Get the database connection pool
 *
 * Returns the existing pool or throws if not initialized
 */
export function getDatabasePool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabasePool() first.');
  }

  return pool;
}

/**
 * Check if database pool is initialized
 */
export function isDatabasePoolInitialized(): boolean {
  return pool !== null;
}

/**
 * Close database connection pool
 *
 * Closes all connections and releases resources
 */
export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    logWithCategory('info', LogCategory.SYSTEM, 'Closing database connection pool...');

    try {
      await pool.end();
      pool = null;
      logWithCategory('info', LogCategory.SYSTEM, 'Database connection pool closed');
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error closing database pool:', error);
      throw error;
    }
  }
}

/**
 * Test database connection
 *
 * Attempts to connect and execute a simple query
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    if (!pool) {
      await initializeDatabasePool();
    }

    const client = await pool!.connect();
    const result = await client.query('SELECT 1 as test, NOW() as now');
    client.release();

    logWithCategory('info', LogCategory.SYSTEM, 'Database connection test successful');
    return true;
  } catch (error: any) {
    logWithCategory('error', LogCategory.SYSTEM, 'Database connection test failed:', error);
    return false;
  }
}

/**
 * Get database connection URL for external processes (like MCP servers)
 *
 * Builds a PostgreSQL connection URL from the current environment configuration
 */
export async function getDatabaseUrl(): Promise<string> {
  try {
    const config = await envConfig.loadEnvConfig();

    // Build PostgreSQL connection URL
    // Format: postgresql://user:password@host:port/database
    const url = `postgresql://${config.POSTGRES_USER}:${config.POSTGRES_PASSWORD}@localhost:${config.POSTGRES_PORT}/${config.POSTGRES_DB}`;

    return url;
  } catch (error: any) {
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to build database URL:', error);
    throw new Error(`Failed to build database URL: ${error.message}`);
  }
}
