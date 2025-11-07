/**
 * Logging module for the MCP Electron App
 * Uses electron-log with custom configuration for log rotation and formatting
 */

import * as log from 'electron-log';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Define log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Define log categories
export enum LogCategory {
  GENERAL = 'GENERAL',
  PREREQUISITES = 'PREREQUISITES',
  DOCKER = 'DOCKER',
  SCRIPT = 'SCRIPT',
  NETWORK = 'NETWORK',
  ERROR = 'ERROR',
}

/**
 * Configure the logger with proper file location, rotation, and formatting
 */
export function initializeLogger(): void {
  // Get the user data directory for storing logs
  const userDataPath = app.getPath('userData');
  const logsPath = path.join(userDataPath, 'logs');

  // Ensure logs directory exists
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }

  // Configure file transport
  log.transports.file.level = 'debug';
  log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
  log.transports.file.resolvePathFn = () => path.join(logsPath, 'main.log');

  // Configure console transport
  log.transports.console.level = 'info';
  log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

  // Default log level is already set via transports

  log.info('Logger initialized');
  log.info(`Log file location: ${log.transports.file.getFile().path}`);
}

/**
 * Get the current log file path
 */
export function getLogFilePath(): string {
  return log.transports.file.getFile().path;
}

/**
 * Get the logs directory path
 */
export function getLogsDirectory(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'logs');
}

/**
 * Get all log files in the logs directory
 */
export function getLogFiles(): string[] {
  const logsDir = getLogsDirectory();

  if (!fs.existsSync(logsDir)) {
    return [];
  }

  return fs.readdirSync(logsDir)
    .filter(file => file.endsWith('.log'))
    .map(file => path.join(logsDir, file))
    .sort((a, b) => {
      const statA = fs.statSync(a);
      const statB = fs.statSync(b);
      return statB.mtime.getTime() - statA.mtime.getTime();
    });
}

/**
 * Read recent log entries from the current log file
 */
export function getRecentLogs(lines: number = 100): string[] {
  try {
    const logFilePath = getLogFilePath();

    if (!fs.existsSync(logFilePath)) {
      return [];
    }

    const content = fs.readFileSync(logFilePath, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim() !== '');

    // Return the last N lines
    return allLines.slice(-lines);
  } catch (error) {
    log.error('Error reading recent logs:', error);
    return [];
  }
}

/**
 * Rotate log files manually (keep only the last 5 files)
 */
export function rotateLogFiles(): void {
  try {
    const logFiles = getLogFiles();
    const maxFiles = 5;

    // Delete old log files if we have more than maxFiles
    if (logFiles.length > maxFiles) {
      const filesToDelete = logFiles.slice(maxFiles);
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file);
          log.info(`Deleted old log file: ${file}`);
        } catch (error) {
          log.error(`Error deleting log file ${file}:`, error);
        }
      });
    }
  } catch (error) {
    log.error('Error rotating log files:', error);
  }
}

/**
 * Log a message with a specific category
 */
export function logWithCategory(
  level: LogLevel,
  category: LogCategory,
  message: string,
  context?: any
): void {
  const categoryPrefix = `[${category}]`;
  const fullMessage = context
    ? `${categoryPrefix} ${message} ${JSON.stringify(context)}`
    : `${categoryPrefix} ${message}`;

  switch (level) {
    case 'debug':
      log.debug(fullMessage);
      break;
    case 'info':
      log.info(fullMessage);
      break;
    case 'warn':
      log.warn(fullMessage);
      break;
    case 'error':
      log.error(fullMessage);
      break;
  }
}

/**
 * Log an error with stack trace
 */
export function logError(error: Error | unknown, context?: string): void {
  if (error instanceof Error) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context: context || 'Unknown context',
    };
    logWithCategory('error', LogCategory.ERROR, 'Error occurred', errorInfo);
  } else {
    logWithCategory('error', LogCategory.ERROR, 'Unknown error occurred', {
      error: String(error),
      context: context || 'Unknown context',
    });
  }
}

/**
 * Clear all log files
 */
export function clearLogs(): void {
  try {
    const logFiles = getLogFiles();
    logFiles.forEach(file => {
      try {
        fs.unlinkSync(file);
        log.info(`Deleted log file: ${file}`);
      } catch (error) {
        log.error(`Error deleting log file ${file}:`, error);
      }
    });
    log.info('All log files cleared');
  } catch (error) {
    log.error('Error clearing logs:', error);
  }
}

// Export the logger instance
export default log;
