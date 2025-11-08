/**
 * Docker Management Module
 * Handles Docker Desktop startup, shutdown, health checks, and monitoring
 * Cross-platform support for Windows, macOS, and Linux
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getPlatform, checkDockerRunning } from './prerequisites';
import { LogCategory, logWithCategory } from './logger';

const execAsync = promisify(exec);

/**
 * Docker status interface
 */
export interface DockerStatus {
  running: boolean;
  healthy: boolean;
  message: string;
  error?: string;
}

/**
 * Progress callback for Docker operations
 */
export type ProgressCallback = (progress: {
  message: string;
  percent: number;
  step: string;
}) => void;

/**
 * Docker operation result
 */
export interface DockerOperationResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Start Docker Desktop programmatically
 * Platform-specific implementation
 */
export async function startDockerDesktop(
  progressCallback?: ProgressCallback
): Promise<DockerOperationResult> {
  logWithCategory('info', LogCategory.DOCKER, 'Starting Docker Desktop...');

  const platform = getPlatform();

  try {
    // Report initial progress
    if (progressCallback) {
      progressCallback({
        message: 'Starting Docker Desktop...',
        percent: 0,
        step: 'initializing',
      });
    }

    // Platform-specific Docker Desktop startup
    if (platform === 'windows') {
      const dockerPath = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
      logWithCategory('info', LogCategory.DOCKER, `Starting Docker Desktop on Windows: ${dockerPath}`);

      // Start Docker Desktop without waiting for it to complete
      exec(`start "" "${dockerPath}"`, { windowsHide: true }, (error) => {
        if (error) {
          logWithCategory('warn', LogCategory.DOCKER, `Error starting Docker Desktop: ${error.message}`);
        }
      });

    } else if (platform === 'macos') {
      logWithCategory('info', LogCategory.DOCKER, 'Starting Docker Desktop on macOS');

      // Start Docker.app on macOS
      exec('open -a Docker', (error) => {
        if (error) {
          logWithCategory('warn', LogCategory.DOCKER, `Error starting Docker Desktop: ${error.message}`);
        }
      });

    } else if (platform === 'linux') {
      logWithCategory('info', LogCategory.DOCKER, 'Starting Docker service on Linux');

      // Try systemctl first, then service command
      try {
        await execAsync('sudo systemctl start docker');
      } catch (systemctlError) {
        // Fallback to service command
        try {
          await execAsync('sudo service docker start');
        } catch (serviceError) {
          logWithCategory('error', LogCategory.DOCKER, 'Failed to start Docker service', {
            systemctlError,
            serviceError,
          });
          return {
            success: false,
            message: 'Failed to start Docker service',
            error: 'Could not start Docker using systemctl or service command. You may need to start Docker manually or check permissions.',
          };
        }
      }
    }

    if (progressCallback) {
      progressCallback({
        message: 'Docker Desktop starting...',
        percent: 10,
        step: 'started',
      });
    }

    logWithCategory('info', LogCategory.DOCKER, 'Docker Desktop start command executed successfully');

    return {
      success: true,
      message: 'Docker Desktop start command executed',
    };

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.DOCKER, 'Error starting Docker Desktop', { error: errorMessage });

    return {
      success: false,
      message: 'Failed to start Docker Desktop',
      error: errorMessage,
    };
  }
}

/**
 * Wait for Docker daemon to be ready
 * Polls docker ps command with timeout
 */
export async function waitForDockerReady(
  progressCallback?: ProgressCallback,
  maxTimeoutSeconds: number = 60,
  checkIntervalSeconds: number = 2
): Promise<DockerOperationResult> {
  logWithCategory('info', LogCategory.DOCKER, `Waiting for Docker to be ready (timeout: ${maxTimeoutSeconds}s)`);

  const maxAttempts = Math.floor(maxTimeoutSeconds / checkIntervalSeconds);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Check if Docker daemon is responsive
      await execAsync('docker ps', { timeout: checkIntervalSeconds * 1000 });

      // Docker is ready!
      const message = 'Docker is ready!';
      logWithCategory('info', LogCategory.DOCKER, message);

      if (progressCallback) {
        progressCallback({
          message,
          percent: 100,
          step: 'ready',
        });
      }

      return {
        success: true,
        message: message,
      };

    } catch (error: any) {
      // Docker not ready yet, continue polling
      const percent = Math.min(90, 10 + (attempt / maxAttempts) * 80);
      const message = `Waiting for Docker daemon... (${attempt}/${maxAttempts})`;

      logWithCategory('debug', LogCategory.DOCKER, message);

      if (progressCallback) {
        progressCallback({
          message,
          percent,
          step: 'waiting',
        });
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, checkIntervalSeconds * 1000));
    }
  }

  // Timeout reached
  const errorMessage = `Docker failed to start within ${maxTimeoutSeconds} seconds`;
  logWithCategory('error', LogCategory.DOCKER, errorMessage);

  if (progressCallback) {
    progressCallback({
      message: 'Docker startup timed out',
      percent: 100,
      step: 'timeout',
    });
  }

  return {
    success: false,
    message: 'Docker startup timed out',
    error: errorMessage,
  };
}

/**
 * Stop Docker Desktop gracefully
 */
export async function stopDocker(): Promise<DockerOperationResult> {
  logWithCategory('info', LogCategory.DOCKER, 'Stopping Docker Desktop...');

  const platform = getPlatform();

  try {
    if (platform === 'windows') {
      // Kill Docker Desktop process on Windows
      await execAsync('taskkill /IM "Docker Desktop.exe" /F', { windowsHide: true });

    } else if (platform === 'macos') {
      // Quit Docker.app on macOS
      await execAsync('osascript -e \'quit app "Docker"\'');

    } else if (platform === 'linux') {
      // Stop Docker service on Linux
      try {
        await execAsync('sudo systemctl stop docker');
      } catch (systemctlError) {
        // Fallback to service command
        await execAsync('sudo service docker stop');
      }
    }

    logWithCategory('info', LogCategory.DOCKER, 'Docker Desktop stopped successfully');

    return {
      success: true,
      message: 'Docker Desktop stopped successfully',
    };

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.DOCKER, 'Error stopping Docker Desktop', { error: errorMessage });

    return {
      success: false,
      message: 'Failed to stop Docker Desktop',
      error: errorMessage,
    };
  }
}

/**
 * Restart Docker Desktop
 */
export async function restartDocker(
  progressCallback?: ProgressCallback
): Promise<DockerOperationResult> {
  logWithCategory('info', LogCategory.DOCKER, 'Restarting Docker Desktop...');

  try {
    // Report initial progress
    if (progressCallback) {
      progressCallback({
        message: 'Stopping Docker...',
        percent: 0,
        step: 'stopping',
      });
    }

    // Stop Docker first
    const stopResult = await stopDocker();

    if (!stopResult.success) {
      logWithCategory('warn', LogCategory.DOCKER, 'Failed to stop Docker, attempting to start anyway');
    }

    // Wait a bit for Docker to fully stop
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (progressCallback) {
      progressCallback({
        message: 'Starting Docker...',
        percent: 25,
        step: 'starting',
      });
    }

    // Start Docker again
    const startResult = await startDockerDesktop((progress) => {
      if (progressCallback) {
        // Adjust progress to account for restart (25-100% range)
        progressCallback({
          ...progress,
          percent: 25 + (progress.percent * 0.75),
        });
      }
    });

    if (!startResult.success) {
      return startResult;
    }

    // Wait for Docker to be ready
    const readyResult = await waitForDockerReady((progress) => {
      if (progressCallback) {
        // Use the progress from waitForDockerReady
        progressCallback(progress);
      }
    });

    if (readyResult.success) {
      logWithCategory('info', LogCategory.DOCKER, 'Docker Desktop restarted successfully');
      return {
        success: true,
        message: 'Docker Desktop restarted successfully',
      };
    } else {
      return readyResult;
    }

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.DOCKER, 'Error restarting Docker Desktop', { error: errorMessage });

    return {
      success: false,
      message: 'Failed to restart Docker Desktop',
      error: errorMessage,
    };
  }
}

/**
 * Check current Docker health status
 */
export async function checkDockerHealth(): Promise<DockerStatus> {
  logWithCategory('info', LogCategory.DOCKER, 'Checking Docker health...');

  try {
    // First check if Docker is installed and running
    const runningStatus = await checkDockerRunning();

    if (!runningStatus.installed) {
      return {
        running: false,
        healthy: false,
        message: 'Docker is not installed',
        error: runningStatus.error,
      };
    }

    if (!runningStatus.running) {
      return {
        running: false,
        healthy: false,
        message: 'Docker is installed but not running',
        error: runningStatus.error,
      };
    }

    // Docker is running, check if it's healthy by running a simple command
    try {
      await execAsync('docker ps', { timeout: 5000 });

      logWithCategory('info', LogCategory.DOCKER, 'Docker is healthy');

      return {
        running: true,
        healthy: true,
        message: 'Docker is running and healthy',
      };

    } catch (error: any) {
      logWithCategory('warn', LogCategory.DOCKER, 'Docker is running but not healthy', { error: error.message });

      return {
        running: true,
        healthy: false,
        message: 'Docker is running but not responding',
        error: error.message,
      };
    }

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.DOCKER, 'Error checking Docker health', { error: errorMessage });

    return {
      running: false,
      healthy: false,
      message: 'Failed to check Docker health',
      error: errorMessage,
    };
  }
}

/**
 * Get Docker containers status
 */
export async function getContainersStatus(): Promise<{
  success: boolean;
  containers: Array<{
    id: string;
    name: string;
    status: string;
    health?: string;
  }>;
  error?: string;
}> {
  logWithCategory('info', LogCategory.DOCKER, 'Getting Docker containers status...');

  try {
    // Get list of containers with their health status
    const result = await execAsync(
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.State}}"',
      { timeout: 5000 }
    );

    const containers = result.stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => {
        const [id, name, status, state] = line.split('|');
        return {
          id,
          name,
          status,
          health: state,
        };
      });

    logWithCategory('info', LogCategory.DOCKER, `Found ${containers.length} containers`);

    return {
      success: true,
      containers,
    };

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.DOCKER, 'Error getting containers status', { error: errorMessage });

    return {
      success: false,
      containers: [],
      error: errorMessage,
    };
  }
}

/**
 * Start Docker and wait for it to be ready (combined operation)
 */
export async function startAndWaitForDocker(
  progressCallback?: ProgressCallback
): Promise<DockerOperationResult> {
  logWithCategory('info', LogCategory.DOCKER, 'Starting Docker and waiting for it to be ready...');

  // First, start Docker Desktop
  const startResult = await startDockerDesktop((progress) => {
    if (progressCallback) {
      progressCallback({
        ...progress,
        percent: Math.min(progress.percent, 10), // Cap at 10% for start phase
      });
    }
  });

  if (!startResult.success) {
    return startResult;
  }

  // Then wait for it to be ready
  const readyResult = await waitForDockerReady((progress) => {
    if (progressCallback) {
      progressCallback({
        ...progress,
        percent: 10 + (progress.percent * 0.9), // Scale from 10-100%
      });
    }
  });

  return readyResult;
}
