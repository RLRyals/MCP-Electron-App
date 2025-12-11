/**
 * Utility functions for collecting system information
 */

import { app } from 'electron';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getFixedEnv } from '../prerequisites';

const execAsync = promisify(exec);

export interface SystemInfo {
  app: {
    name: string;
    version: string;
    electronVersion: string;
    nodeVersion: string;
    chromeVersion: string;
  };
  system: {
    platform: string;
    arch: string;
    release: string;
    hostname: string;
    totalMemory: string;
    freeMemory: string;
    cpuCores: number;
    cpuModel: string;
    uptime: string;
  };
  paths: {
    userData: string;
    logs: string;
    temp: string;
    home: string;
  };
  docker?: {
    installed: boolean;
    version?: string;
    composeVersion?: string;
    running?: boolean;
    error?: string;
  };
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format uptime to human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '0m';
}

/**
 * Check if Docker is installed and running
 */
async function checkDocker(): Promise<SystemInfo['docker']> {
  const dockerInfo: SystemInfo['docker'] = {
    installed: false,
    running: false,
  };

  try {
    // Check Docker version
    const { stdout: dockerVersion } = await execAsync('docker --version');
    dockerInfo.installed = true;
    dockerInfo.version = dockerVersion.trim();

    // Check if Docker is running
    try {
      await execAsync('docker ps');
      dockerInfo.running = true;
    } catch (error) {
      dockerInfo.running = false;
      dockerInfo.error = 'Docker daemon is not running';
    }

    // Check Docker Compose version
    try {
      const { stdout: composeVersion } = await execAsync('docker compose version', { env: getFixedEnv() });
      dockerInfo.composeVersion = composeVersion.trim();
    } catch (error) {
      // Docker Compose not installed or different version
      try {
        const { stdout: composeVersion } = await execAsync('docker compose version', { env: getFixedEnv() });
        dockerInfo.composeVersion = composeVersion.trim();
      } catch (error2) {
        dockerInfo.composeVersion = 'Not installed';
      }
    }
  } catch (error) {
    dockerInfo.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return dockerInfo;
}

/**
 * Collect comprehensive system information
 */
export async function collectSystemInfo(): Promise<SystemInfo> {
  const cpus = os.cpus();

  const info: SystemInfo = {
    app: {
      name: app.getName(),
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
    },
    system: {
      platform: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      totalMemory: formatBytes(os.totalmem()),
      freeMemory: formatBytes(os.freemem()),
      cpuCores: cpus.length,
      cpuModel: cpus[0]?.model || 'Unknown',
      uptime: formatUptime(os.uptime()),
    },
    paths: {
      userData: app.getPath('userData'),
      logs: path.join(app.getPath('userData'), 'logs'),
      temp: app.getPath('temp'),
      home: app.getPath('home'),
    },
  };

  // Check Docker (may take some time)
  try {
    info.docker = await checkDocker();
  } catch (error) {
    info.docker = {
      installed: false,
      error: error instanceof Error ? error.message : 'Failed to check Docker',
    };
  }

  return info;
}

/**
 * Get Docker logs from Docker Compose
 */
export async function getDockerLogs(projectPath?: string): Promise<string> {
  try {
    const cwd = projectPath || process.cwd();
    const { stdout } = await execAsync('docker compose logs --tail=100', {
      cwd,
      timeout: 10000,
      env: getFixedEnv(),
    });
    return stdout;
  } catch (error) {
    if (error instanceof Error) {
      return `Error getting Docker logs: ${error.message}`;
    }
    return 'Error getting Docker logs: Unknown error';
  }
}

/**
 * Run system checks and return results
 */
export async function runSystemChecks(): Promise<{
  passed: boolean;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
  }>;
}> {
  const checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
  }> = [];

  // Check if logs directory exists
  const logsPath = path.join(app.getPath('userData'), 'logs');
  if (fs.existsSync(logsPath)) {
    checks.push({
      name: 'Logs Directory',
      status: 'pass',
      message: `Logs directory exists at ${logsPath}`,
    });
  } else {
    checks.push({
      name: 'Logs Directory',
      status: 'fail',
      message: 'Logs directory does not exist',
    });
  }

  // Check Docker installation
  const dockerInfo = await checkDocker();
  if (dockerInfo && dockerInfo.installed) {
    if (dockerInfo.running) {
      checks.push({
        name: 'Docker',
        status: 'pass',
        message: `Docker is installed and running (${dockerInfo.version})`,
      });
    } else {
      checks.push({
        name: 'Docker',
        status: 'warning',
        message: `Docker is installed but not running (${dockerInfo.version})`,
      });
    }

    // Check Docker Compose
    if (dockerInfo.composeVersion && dockerInfo.composeVersion !== 'Not installed') {
      checks.push({
        name: 'Docker Compose',
        status: 'pass',
        message: dockerInfo.composeVersion,
      });
    } else {
      checks.push({
        name: 'Docker Compose',
        status: 'fail',
        message: 'Docker Compose is not installed',
      });
    }
  } else {
    checks.push({
      name: 'Docker',
      status: 'fail',
      message: 'Docker is not installed',
    });
  }

  // Check available disk space
  try {
    const userDataPath = app.getPath('userData');
    const stats = fs.statfsSync ? fs.statfsSync(userDataPath) : null;
    if (stats) {
      const availableSpace = stats.bavail * stats.bsize;
      const availableGB = availableSpace / (1024 * 1024 * 1024);

      if (availableGB > 1) {
        checks.push({
          name: 'Disk Space',
          status: 'pass',
          message: `${availableGB.toFixed(2)} GB available`,
        });
      } else {
        checks.push({
          name: 'Disk Space',
          status: 'warning',
          message: `Low disk space: ${availableGB.toFixed(2)} GB available`,
        });
      }
    }
  } catch (error) {
    checks.push({
      name: 'Disk Space',
      status: 'warning',
      message: 'Unable to check disk space',
    });
  }

  // Check memory
  const freeMemoryGB = os.freemem() / (1024 * 1024 * 1024);
  if (freeMemoryGB > 1) {
    checks.push({
      name: 'Memory',
      status: 'pass',
      message: `${freeMemoryGB.toFixed(2)} GB available`,
    });
  } else {
    checks.push({
      name: 'Memory',
      status: 'warning',
      message: `Low memory: ${freeMemoryGB.toFixed(2)} GB available`,
    });
  }

  // Determine if all checks passed
  const passed = checks.every(check => check.status === 'pass');

  return { passed, checks };
}
