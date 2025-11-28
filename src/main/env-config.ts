/**
 * Environment configuration module
 * Handles generation, validation, and persistence of environment variables
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { app } from 'electron';
import logger from './logger';
import { sanitizeEnvFileContent } from './utils/sanitize';

/**
 * Environment configuration interface
 */
export interface EnvConfig {
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_PORT: number;
  MCP_CONNECTOR_PORT: number;
  HTTP_SSE_PORT: number;
  DB_ADMIN_PORT: number;
  MCP_AUTH_TOKEN: string;
  TYPING_MIND_PORT: number;
  GITHUB_TOKEN?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: EnvConfig = {
  POSTGRES_DB: 'mcp_writing_db',
  POSTGRES_USER: 'writer',
  POSTGRES_PASSWORD: '',
  POSTGRES_PORT: 5432,
  MCP_CONNECTOR_PORT: 50880,
  HTTP_SSE_PORT: 3001,
  DB_ADMIN_PORT: 3010,
  MCP_AUTH_TOKEN: '',
  TYPING_MIND_PORT: 8080,
  GITHUB_TOKEN: '',
};

/**
 * Get the path to the .env file
 */
export function getEnvFilePath(): string {
  // Store .env file in user data directory
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, '.env');
}

/**
 * Generate a secure random password (alphanumeric only for PostgreSQL compatibility)
 * @param length Length of the password (default: 16)
 */
export function generatePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length * 2);

  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = bytes[i] % charset.length;
    password += charset[randomIndex];
  }

  // Ensure password contains at least one of each type (uppercase, lowercase, number)
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  // If missing any type, regenerate (recursive with small probability of deep recursion)
  if (!hasLowercase || !hasUppercase || !hasNumber) {
    return generatePassword(length);
  }

  logger.info('Generated secure alphanumeric password');
  return password;
}

/**
 * Generate a secure auth token
 */
export function generateAuthToken(): string {
  // Generate a 32-byte random token in hexadecimal format
  const token = crypto.randomBytes(32).toString('hex');
  logger.info('Generated auth token');
  return token;
}

/**
 * Calculate password strength (adjusted for alphanumeric passwords)
 * @param password The password to check
 * @returns Strength level: 'weak', 'medium', or 'strong'
 */
export function calculatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (!password || password.length < 12) {
    return 'weak';
  }

  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const typesCount = [hasLowercase, hasUppercase, hasNumber].filter(Boolean).length;

  // Strong: 16+ chars with all three types (uppercase, lowercase, numbers)
  if (password.length >= 16 && typesCount === 3) {
    return 'strong';
  } else if (password.length >= 12 && typesCount >= 2) {
    return 'medium';
  } else {
    return 'weak';
  }
}

/**
 * Validate database name
 * @param name Database name to validate
 */
export function validateDatabaseName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: 'Database name is required' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return { valid: false, error: 'Database name can only contain letters, numbers, and underscores' };
  }

  if (name.length < 1 || name.length > 63) {
    return { valid: false, error: 'Database name must be between 1 and 63 characters' };
  }

  return { valid: true };
}

/**
 * Validate database user
 * @param user Database user to validate
 */
export function validateDatabaseUser(user: string): { valid: boolean; error?: string } {
  if (!user) {
    return { valid: false, error: 'Database user is required' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(user)) {
    return { valid: false, error: 'Database user can only contain letters, numbers, and underscores' };
  }

  if (user.length < 1 || user.length > 63) {
    return { valid: false, error: 'Database user must be between 1 and 63 characters' };
  }

  return { valid: true };
}

/**
 * Validate port number
 * @param port Port number to validate
 */
export function validatePort(port: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(port)) {
    return { valid: false, error: 'Port must be an integer' };
  }

  if (port < 1024 || port > 65535) {
    return { valid: false, error: 'Port must be between 1024 and 65535' };
  }

  return { valid: true };
}

/**
 * Validate password
 * @param password Password to validate
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long' };
  }

  return { valid: true };
}

/**
 * Check if a port is available
 * @param port Port number to check
 */
export function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        // Other errors might indicate the port is available but there's another issue
        resolve(true);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find next available port starting from a given port
 * @param startPort Port to start checking from
 * @param maxAttempts Maximum number of ports to try (default: 100)
 */
export async function findNextAvailablePort(startPort: number, maxAttempts: number = 100): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (port > 65535) break; // Port number out of range
    
    const available = await checkPortAvailable(port);
    if (available) {
      return port;
    }
  }
  return null; // No available port found
}

/**
 * Port conflict information
 */
export interface PortConflict {
  port: number;
  name: string;
  suggested: number;
}

/**
 * Result of port conflict check
 */
export interface PortConflictCheckResult {
  hasConflicts: boolean;
  conflicts: PortConflict[];
  suggestedConfig?: EnvConfig;
}

/**
 * Check all configured ports for conflicts and suggest alternatives
 * @param config Configuration to check
 */
export async function checkAllPortsAndSuggestAlternatives(
  config: EnvConfig
): Promise<PortConflictCheckResult> {
  logger.info('Checking all ports for conflicts...');
  
  const conflicts: PortConflict[] = [];
  const portChecks = [
    { port: config.POSTGRES_PORT, name: 'PostgreSQL', key: 'POSTGRES_PORT' as const },
    { port: config.MCP_CONNECTOR_PORT, name: 'MCP Connector', key: 'MCP_CONNECTOR_PORT' as const },
    { port: config.HTTP_SSE_PORT, name: 'HTTP/SSE', key: 'HTTP_SSE_PORT' as const },
    { port: config.DB_ADMIN_PORT, name: 'DB Admin', key: 'DB_ADMIN_PORT' as const },
    { port: config.TYPING_MIND_PORT, name: 'TypingMind', key: 'TYPING_MIND_PORT' as const },
  ];

  // Check each port
  for (const check of portChecks) {
    const available = await checkPortAvailable(check.port);
    if (!available) {
      logger.warn(`Port ${check.port} (${check.name}) is already in use`);
      
      // Find next available port
      const suggested = await findNextAvailablePort(check.port + 1);
      if (suggested) {
        conflicts.push({
          port: check.port,
          name: check.name,
          suggested,
        });
        logger.info(`Suggested alternative port for ${check.name}: ${suggested}`);
      } else {
        logger.error(`Could not find available alternative port for ${check.name}`);
        conflicts.push({
          port: check.port,
          name: check.name,
          suggested: check.port, // Keep original if no alternative found
        });
      }
    }
  }

  // If conflicts exist, create suggested configuration
  let suggestedConfig: EnvConfig | undefined;
  if (conflicts.length > 0) {
    suggestedConfig = { ...config };
    for (const conflict of conflicts) {
      const check = portChecks.find(c => c.port === conflict.port);
      if (check) {
        suggestedConfig[check.key] = conflict.suggested;
      }
    }
    logger.info(`Created suggested configuration with ${conflicts.length} port changes`);
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    suggestedConfig,
  };
}

/**
 * Parse .env file content
 * @param content File content to parse
 */
export function parseEnvFile(content: string): Partial<EnvConfig> {
  const config: Partial<EnvConfig> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse key=value pairs
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();

      // Remove quotes if present
      const unquotedValue = value.replace(/^["']|["']$/g, '');

      // Map to config properties
      switch (key) {
        case 'POSTGRES_DB':
          config.POSTGRES_DB = unquotedValue;
          break;
        case 'POSTGRES_USER':
          config.POSTGRES_USER = unquotedValue;
          break;
        case 'POSTGRES_PASSWORD':
          config.POSTGRES_PASSWORD = unquotedValue;
          break;
        case 'POSTGRES_PORT':
          config.POSTGRES_PORT = parseInt(unquotedValue, 10);
          break;
        case 'MCP_CONNECTOR_PORT':
          config.MCP_CONNECTOR_PORT = parseInt(unquotedValue, 10);
          break;
        case 'HTTP_SSE_PORT':
          config.HTTP_SSE_PORT = parseInt(unquotedValue, 10);
          break;
        case 'DB_ADMIN_PORT':
          config.DB_ADMIN_PORT = parseInt(unquotedValue, 10);
          break;
        case 'MCP_AUTH_TOKEN':
          config.MCP_AUTH_TOKEN = unquotedValue;
          break;
        case 'TYPING_MIND_PORT':
          config.TYPING_MIND_PORT = parseInt(unquotedValue, 10);
          break;
        case 'GITHUB_TOKEN':
          config.GITHUB_TOKEN = unquotedValue;
          break;
      }
    }
  }

  return config;
}

/**
 * Load configuration from .env file
 *
 * WARNING: This function generates random credentials if no .env exists, but does NOT save them.
 * The setup wizard must explicitly save the configuration to persist it.
 */
export async function loadEnvConfig(): Promise<EnvConfig> {
  const envPath = getEnvFilePath();

  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const parsed = parseEnvFile(content);

      // Merge with defaults
      const config: EnvConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
      };

      // If GITHUB_TOKEN is not set in .env, check environment variables
      if (!config.GITHUB_TOKEN) {
        const envToken = process.env.GITHUB_AUTH_TOKEN || process.env.GITHUB_TOKEN;
        if (envToken && envToken.trim().length > 0) {
          config.GITHUB_TOKEN = envToken.trim();
          logger.info('Using GITHUB_AUTH_TOKEN from environment variable');
        }
      }

      // Validate that critical fields are not empty
      if (!config.MCP_AUTH_TOKEN || config.MCP_AUTH_TOKEN.trim() === '') {
        logger.warn('MCP_AUTH_TOKEN is empty in .env file - this will cause docker container errors');
      }
      if (!config.POSTGRES_PASSWORD || config.POSTGRES_PASSWORD.trim() === '') {
        logger.warn('POSTGRES_PASSWORD is empty in .env file - this will cause database connection errors');
      }

      // Log with sanitized content
      const sanitized = sanitizeEnvFileContent(content);
      logger.info('Loaded .env configuration from:', envPath);
      logger.info('Sanitized .env content:\n' + sanitized);

      return config;
    } else {
      logger.warn('No .env file found at:', envPath);
      logger.warn('Returning temporary config with generated credentials - these will NOT persist!');
      logger.warn('The setup wizard must be completed to save the configuration.');

      // Check for GitHub token in environment variables even if no .env file exists
      const envToken = process.env.GITHUB_AUTH_TOKEN || process.env.GITHUB_TOKEN;

      return {
        ...DEFAULT_CONFIG,
        POSTGRES_PASSWORD: generatePassword(),
        MCP_AUTH_TOKEN: generateAuthToken(),
        GITHUB_TOKEN: envToken && envToken.trim().length > 0 ? envToken.trim() : '',
      };
    }
  } catch (error) {
    logger.error('Error loading .env file:', error);
    logger.warn('Returning temporary config with generated credentials - these will NOT persist!');

    // Check for GitHub token in environment variables even on error
    const envToken = process.env.GITHUB_AUTH_TOKEN || process.env.GITHUB_TOKEN;

    return {
      ...DEFAULT_CONFIG,
      POSTGRES_PASSWORD: generatePassword(),
      MCP_AUTH_TOKEN: generateAuthToken(),
      GITHUB_TOKEN: envToken && envToken.trim().length > 0 ? envToken.trim() : '',
    };
  }
}

/**
 * Format configuration as .env file content
 * @param config Configuration to format
 */
export function formatEnvFile(config: EnvConfig): string {
  const lines = [
    '# MCP Writing System Configuration',
    '# Generated by MCP Electron App',
    '',
    `POSTGRES_DB=${config.POSTGRES_DB}`,
    `POSTGRES_USER=${config.POSTGRES_USER}`,
    `POSTGRES_PASSWORD=${config.POSTGRES_PASSWORD}`,
    `POSTGRES_PORT=${config.POSTGRES_PORT}`,
    `MCP_CONNECTOR_PORT=${config.MCP_CONNECTOR_PORT}`,
    `HTTP_SSE_PORT=${config.HTTP_SSE_PORT}`,
    `DB_ADMIN_PORT=${config.DB_ADMIN_PORT}`,
    `MCP_AUTH_TOKEN=${config.MCP_AUTH_TOKEN}`,
    `TYPING_MIND_PORT=${config.TYPING_MIND_PORT}`,
  ];

  // Only include GITHUB_TOKEN if it's set
  if (config.GITHUB_TOKEN) {
    lines.push(`GITHUB_TOKEN=${config.GITHUB_TOKEN}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Save configuration to .env file
 * @param config Configuration to save
 */
export async function saveEnvConfig(config: EnvConfig): Promise<{ success: boolean; path?: string; error?: string }> {
  const envPath = getEnvFilePath();

  try {
    // Ensure directory exists
    const dir = path.dirname(envPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Format and write file
    const content = formatEnvFile(config);
    fs.writeFileSync(envPath, content, 'utf-8');

    // Log with sanitized content
    const sanitized = sanitizeEnvFileContent(content);
    logger.info('Saved .env configuration to:', envPath);
    logger.info('Sanitized .env content:\n' + sanitized);

    return { success: true, path: envPath };
  } catch (error) {
    logger.error('Error saving .env file:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Validate complete configuration
 * @param config Configuration to validate
 */
export function validateConfig(config: EnvConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate database name
  const dbNameValidation = validateDatabaseName(config.POSTGRES_DB);
  if (!dbNameValidation.valid) {
    errors.push(`Database name: ${dbNameValidation.error}`);
  }

  // Validate database user
  const dbUserValidation = validateDatabaseUser(config.POSTGRES_USER);
  if (!dbUserValidation.valid) {
    errors.push(`Database user: ${dbUserValidation.error}`);
  }

  // Validate password
  const passwordValidation = validatePassword(config.POSTGRES_PASSWORD);
  if (!passwordValidation.valid) {
    errors.push(`Password: ${passwordValidation.error}`);
  }

  // Validate ports
  const postgresPortValidation = validatePort(config.POSTGRES_PORT);
  if (!postgresPortValidation.valid) {
    errors.push(`Postgres port: ${postgresPortValidation.error}`);
  }

  const mcpPortValidation = validatePort(config.MCP_CONNECTOR_PORT);
  if (!mcpPortValidation.valid) {
    errors.push(`MCP connector port: ${mcpPortValidation.error}`);
  }

  const httpSsePortValidation = validatePort(config.HTTP_SSE_PORT);
  if (!httpSsePortValidation.valid) {
    errors.push(`HTTP/SSE port: ${httpSsePortValidation.error}`);
  }

  const dbAdminPortValidation = validatePort(config.DB_ADMIN_PORT);
  if (!dbAdminPortValidation.valid) {
    errors.push(`DB Admin port: ${dbAdminPortValidation.error}`);
  }

  const typingMindPortValidation = validatePort(config.TYPING_MIND_PORT);
  if (!typingMindPortValidation.valid) {
    errors.push(`Typing Mind port: ${typingMindPortValidation.error}`);
  }

  // Validate auth token
  if (!config.MCP_AUTH_TOKEN) {
    errors.push('Auth token: Auth token is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
