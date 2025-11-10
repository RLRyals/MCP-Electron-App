/**
 * Prerequisites Detection Module
 * Detects Docker, Git, and WSL (on Windows) installation and status
 * Cross-platform support for Windows, macOS, and Linux
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as log from 'electron-log';

const execAsync = promisify(exec);

/**
 * Standard response format for prerequisite checks
 */
export interface PrerequisiteStatus {
  installed: boolean;
  running?: boolean;
  version?: string;
  error?: string;
}

/**
 * Platform detection helper
 */
export function getPlatform(): 'windows' | 'macos' | 'linux' {
  const platform = process.platform;
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  return 'linux';
}

/**
 * Execute a command with timeout
 */
async function executeCommand(
  command: string,
  timeoutMs: number = 5000
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(command, {
      timeout: timeoutMs,
      windowsHide: true,
    });
    return result;
  } catch (error: any) {
    // If command fails, throw with both stdout and stderr
    throw {
      code: error.code,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      message: error.message,
    };
  }
}

/**
 * Parse version string from command output
 */
function parseVersion(output: string, regex?: RegExp): string | undefined {
  try {
    if (regex) {
      const match = output.match(regex);
      return match ? match[1] : undefined;
    }

    // Default version extraction - looks for patterns like "version 1.2.3" or "v1.2.3"
    const patterns = [
      /version\s+(\d+\.\d+\.\d+[^\s]*)/i,
      /v(\d+\.\d+\.\d+[^\s]*)/i,
      /(\d+\.\d+\.\d+[^\s]*)/,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) return match[1];
    }

    return undefined;
  } catch (error) {
    log.error('Error parsing version:', error);
    return undefined;
  }
}

/**
 * Check if Docker is installed
 */
export async function checkDockerInstalled(): Promise<PrerequisiteStatus> {
  log.info('Checking Docker installation...');

  try {
    const result = await executeCommand('docker --version');
    const version = parseVersion(result.stdout);

    log.info(`Docker installed: version ${version}`);
    return {
      installed: true,
      version: version || 'unknown',
    };
  } catch (error: any) {
    log.warn('Docker not installed or not in PATH:', error.message);
    return {
      installed: false,
      error: 'Docker is not installed or not found in PATH',
    };
  }
}

/**
 * Check if Docker daemon is running
 * Uses a longer timeout to account for Docker Desktop initialization time
 */
export async function checkDockerRunning(): Promise<PrerequisiteStatus> {
  log.info('Checking if Docker daemon is running...');

  try {
    // First check if Docker is installed
    const installedCheck = await checkDockerInstalled();
    if (!installedCheck.installed) {
      return {
        installed: false,
        running: false,
        error: installedCheck.error,
      };
    }

    // Try to execute docker ps to check if daemon is running
    // Use a longer timeout (15s) because Docker Desktop can take time to fully initialize
    // especially right after system boot or when the app is just starting
    await executeCommand('docker ps', 15000);

    log.info('Docker daemon is running');
    return {
      installed: true,
      running: true,
      version: installedCheck.version,
    };
  } catch (error: any) {
    log.warn('Docker daemon is not running:', error.message);

    // Check if it's a daemon connection error or if Docker is still initializing
    const errorStr = error.stderr || error.stdout || error.message || '';
    const isDaemonError =
      errorStr.includes('daemon') ||
      errorStr.includes('not running') ||
      errorStr.includes('cannot connect') ||
      errorStr.includes('connection refused') ||
      errorStr.includes('starting') ||
      errorStr.includes('initializing');

    if (isDaemonError) {
      // Provide more specific error message if Docker appears to be starting
      if (errorStr.includes('starting') || errorStr.includes('initializing')) {
        return {
          installed: true,
          running: false,
          error: 'Docker Desktop is starting up. Please wait a moment and try again.',
        };
      }

      return {
        installed: true,
        running: false,
        error: 'Docker is installed but the daemon is not running',
      };
    }

    return {
      installed: true,
      running: false,
      error: `Unable to connect to Docker daemon: ${errorStr.substring(0, 100)}`,
    };
  }
}

/**
 * Get Docker version
 */
export async function getDockerVersion(): Promise<PrerequisiteStatus> {
  log.info('Getting Docker version...');

  try {
    const result = await executeCommand('docker version --format "{{.Server.Version}}"');
    const version = result.stdout.trim();

    if (version && !version.includes('Error') && !version.includes('error')) {
      log.info(`Docker version: ${version}`);
      return {
        installed: true,
        running: true,
        version: version,
      };
    }

    // Fallback to docker --version if server version fails
    const fallbackResult = await executeCommand('docker --version');
    const fallbackVersion = parseVersion(fallbackResult.stdout);

    return {
      installed: true,
      version: fallbackVersion || 'unknown',
    };
  } catch (error: any) {
    log.warn('Error getting Docker version:', error.message);

    // Try to at least get the client version
    try {
      const clientResult = await executeCommand('docker --version');
      const clientVersion = parseVersion(clientResult.stdout);

      return {
        installed: true,
        running: false,
        version: clientVersion || 'unknown',
        error: 'Docker is installed but daemon may not be running',
      };
    } catch (clientError: any) {
      return {
        installed: false,
        error: 'Docker is not installed',
      };
    }
  }
}

/**
 * Check if Git is installed
 */
export async function checkGit(): Promise<PrerequisiteStatus> {
  log.info('Checking Git installation...');

  try {
    const result = await executeCommand('git --version');
    const version = parseVersion(result.stdout);

    log.info(`Git installed: version ${version}`);
    return {
      installed: true,
      version: version || 'unknown',
    };
  } catch (error: any) {
    log.warn('Git not installed or not in PATH:', error.message);
    return {
      installed: false,
      error: 'Git is not installed or not found in PATH',
    };
  }
}

/**
 * Check WSL status (Windows only)
 */
export async function checkWSL(): Promise<PrerequisiteStatus> {
  const platform = getPlatform();

  if (platform !== 'windows') {
    log.info('WSL check skipped - not on Windows');
    return {
      installed: false,
      error: 'WSL is only available on Windows',
    };
  }

  log.info('Checking WSL installation...');

  try {
    // Check if WSL is installed and get status
    const result = await executeCommand('wsl --status');
    const output = result.stdout + result.stderr;

    // Check for WSL2
    let version = 'WSL';
    if (output.includes('WSL 2') || output.includes('version 2')) {
      version = 'WSL2';
    } else if (output.includes('WSL 1') || output.includes('version 1')) {
      version = 'WSL1';
    }

    log.info(`WSL installed: ${version}`);
    return {
      installed: true,
      version: version,
    };
  } catch (error: any) {
    // Try alternative check - list distributions
    try {
      const listResult = await executeCommand('wsl --list');
      const output = listResult.stdout + listResult.stderr;

      if (output.length > 0) {
        log.info('WSL installed (detected via wsl --list)');
        return {
          installed: true,
          version: 'WSL',
        };
      }
    } catch (listError) {
      // WSL not installed or not functional
    }

    log.warn('WSL not installed or not functional:', error.message);
    return {
      installed: false,
      error: 'WSL is not installed or not functional',
    };
  }
}

/**
 * Run all prerequisite checks
 */
export async function checkAll(): Promise<{
  docker: PrerequisiteStatus;
  git: PrerequisiteStatus;
  wsl?: PrerequisiteStatus;
  platform: string;
}> {
  log.info('Running all prerequisite checks...');

  const platform = getPlatform();
  const results: any = {
    platform,
    docker: await checkDockerRunning(),
    git: await checkGit(),
  };

  // Only check WSL on Windows
  if (platform === 'windows') {
    results.wsl = await checkWSL();
  }

  log.info('All prerequisite checks completed');
  return results;
}

/**
 * Get detailed platform information
 */
export function getPlatformInfo(): {
  platform: string;
  platformName: string;
  arch: string;
  nodeVersion: string;
} {
  const platform = getPlatform();
  let platformName = 'Unknown';

  switch (platform) {
    case 'windows':
      platformName = 'Windows';
      break;
    case 'macos':
      platformName = 'macOS';
      break;
    case 'linux':
      platformName = 'Linux';
      break;
  }

  return {
    platform,
    platformName,
    arch: process.arch,
    nodeVersion: process.version,
  };
}
