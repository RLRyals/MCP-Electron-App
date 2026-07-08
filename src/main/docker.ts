/**
 * Docker Management Module
 * Handles Docker Desktop startup, shutdown, health checks, and monitoring
 * Cross-platform support for Windows, macOS, and Linux
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import Docker from 'dockerode';
import { getPlatform, checkDockerRunning, getFixedEnv } from './prerequisites';
import { LogCategory, logWithCategory } from './logger';

const promisifiedExec = promisify(exec);
const execAsync = async (command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> => {
  return promisifiedExec(command, {
    ...options,
    encoding: 'utf8',
    env: getFixedEnv(),
  }) as unknown as Promise<{ stdout: string; stderr: string }>;
};

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
 * Result of a daemon-level ping probe (dockerode, not the CLI)
 */
export interface DockerPingResult {
  reachable: boolean;
  attempts: number;
  elapsedMs: number;
  error?: string;
}

/**
 * Get the platform-appropriate Docker Engine API socket/pipe path.
 * Windows: named pipe. macOS/Linux: unix socket.
 * dockerode/docker-modem already default to these same paths, but we set them
 * explicitly so the probe is authoritative regardless of DOCKER_HOST or other
 * environment overrides, and so the chosen path is visible in logs.
 */
function getDockerSocketPath(): string {
  const platform = getPlatform();
  if (platform === 'windows') {
    return '//./pipe/docker_engine';
  }
  // macOS and Linux both use the standard Docker Engine unix socket location
  return '/var/run/docker.sock';
}

/**
 * Single dockerode `docker.ping()` attempt against the Engine API, bounded by
 * an explicit timeout (dockerode/docker-modem have no built-in per-call timeout).
 * No retry here - callers compose retry/backoff on top of this primitive.
 */
async function pingDockerOnce(timeoutMs: number): Promise<{ ok: boolean; error?: string }> {
  const socketPath = getDockerSocketPath();
  const docker = new Docker({ socketPath });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await docker.ping({ abortSignal: controller.signal } as any);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ping the Docker daemon directly via dockerode against the Engine API socket/pipe
 * (Windows named pipe `//./pipe/docker_engine`, unix socket elsewhere) rather than
 * shelling out to the `docker` CLI. This is the authoritative liveness signal:
 * a reachable daemon means Docker is genuinely up, independent of whether the CLI
 * binary is on PATH or how long `docker info` takes to cold-start.
 *
 * Retries a fixed number of short-timeout attempts with backoff before declaring
 * the daemon unreachable - a cold WSL2 backend can take a few seconds to start
 * responding even once the process exists.
 */
export async function pingDockerDaemon(options: {
  attempts?: number;
  attemptTimeoutMs?: number;
  backoffMs?: number;
} = {}): Promise<DockerPingResult> {
  const attempts = options.attempts ?? 5;
  const attemptTimeoutMs = options.attemptTimeoutMs ?? 3000;
  const backoffMs = options.backoffMs ?? 3000;

  const start = Date.now();
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await pingDockerOnce(attemptTimeoutMs);

    if (result.ok) {
      const elapsedMs = Date.now() - start;
      logWithCategory('info', LogCategory.DOCKER,
        `Docker daemon ping succeeded on attempt ${attempt}/${attempts} (${elapsedMs}ms, socket: ${getDockerSocketPath()})`);
      return { reachable: true, attempts: attempt, elapsedMs };
    }

    lastError = result.error;
    logWithCategory('debug', LogCategory.DOCKER,
      `Docker daemon ping attempt ${attempt}/${attempts} failed: ${lastError}`);

    if (attempt < attempts) {
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  const elapsedMs = Date.now() - start;
  logWithCategory('warn', LogCategory.DOCKER,
    `Docker daemon ping failed after ${attempts} attempts (${elapsedMs}ms): ${lastError}`);

  return { reachable: false, attempts, elapsedMs, error: lastError };
}

/**
 * Poll the daemon ping until it succeeds or the timeout expires.
 * Used by the launch gate for both the "process already running, still
 * initializing" case (~90s budget) and the "we just started it" case (~120s
 * budget) - the daemon ping is the readiness signal in both cases, not window
 * state or the CLI.
 */
export async function waitForDockerPingReady(
  maxTimeoutSeconds: number,
  progressCallback?: ProgressCallback,
  checkIntervalSeconds: number = 3
): Promise<DockerOperationResult> {
  logWithCategory('info', LogCategory.DOCKER,
    `Polling Docker daemon ping (timeout: ${maxTimeoutSeconds}s)`);

  const start = Date.now();
  const timeoutMs = maxTimeoutSeconds * 1000;
  let attempt = 0;
  let lastError: string | undefined;

  while (Date.now() - start < timeoutMs) {
    attempt++;
    const attemptTimeoutMs = checkIntervalSeconds * 1000;
    const result = await pingDockerOnce(attemptTimeoutMs);

    if (result.ok) {
      const message = 'Docker daemon is ready!';
      logWithCategory('info', LogCategory.DOCKER, `${message} (after ${attempt} poll(s))`);

      if (progressCallback) {
        progressCallback({ message, percent: 100, step: 'ready' });
      }

      return { success: true, message };
    }

    lastError = result.error;
    const elapsed = Date.now() - start;
    const percent = Math.min(90, Math.floor((elapsed / timeoutMs) * 90));
    const message = `Waiting for Docker daemon... (attempt ${attempt}, ${Math.floor(elapsed / 1000)}s elapsed)`;

    logWithCategory('debug', LogCategory.DOCKER, `${message}: ${lastError}`);

    if (progressCallback) {
      progressCallback({ message, percent, step: 'waiting' });
    }

    // pingDockerOnce already blocks for up to attemptTimeoutMs on failure/timeout,
    // so only add a small gap between attempts rather than a full extra interval.
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const errorMessage = `Docker daemon did not respond within ${maxTimeoutSeconds} seconds`;
  logWithCategory('error', LogCategory.DOCKER, `${errorMessage}${lastError ? `: ${lastError}` : ''}`);

  if (progressCallback) {
    progressCallback({ message: 'Docker daemon did not respond in time', percent: 100, step: 'timeout' });
  }

  return { success: false, message: 'Docker daemon did not respond in time', error: lastError || errorMessage };
}

/**
 * Check if Docker Desktop process is running at the OS level,
 * independent of whether the Docker daemon is ready.
 * This detects Docker Desktop that is still initializing.
 */
export async function isDockerDesktopProcessRunning(): Promise<boolean> {
  const platform = getPlatform();
  logWithCategory('info', LogCategory.DOCKER,
    `Checking if Docker Desktop process is running on ${platform}...`);

  try {
    if (platform === 'windows') {
      const { stdout } = await execAsync(
        'tasklist /FI "IMAGENAME eq Docker Desktop.exe" /NH',
        { timeout: 5000, windowsHide: true }
      );
      const isRunning = stdout.toLowerCase().includes('docker desktop.exe');
      logWithCategory('info', LogCategory.DOCKER,
        `Docker Desktop process running (Windows): ${isRunning}`);
      return isRunning;

    } else if (platform === 'macos') {
      try {
        const { stdout } = await execAsync(
          'pgrep -f "Docker Desktop"',
          { timeout: 5000 }
        );
        const isRunning = stdout.trim().length > 0;
        logWithCategory('info', LogCategory.DOCKER,
          `Docker Desktop process running (macOS): ${isRunning}`);
        return isRunning;
      } catch {
        // pgrep returns exit code 1 when no process found
        logWithCategory('info', LogCategory.DOCKER,
          'Docker Desktop process not running (macOS)');
        return false;
      }

    } else if (platform === 'linux') {
      try {
        const { stdout } = await execAsync(
          'systemctl is-active docker',
          { timeout: 5000 }
        );
        const status = stdout.trim();
        const isRunning = status === 'active' || status === 'activating';
        logWithCategory('info', LogCategory.DOCKER,
          `Docker service status (Linux): ${status}, running: ${isRunning}`);
        return isRunning;
      } catch {
        // Fallback: check for dockerd process
        try {
          const { stdout } = await execAsync('pgrep dockerd', { timeout: 5000 });
          const isRunning = stdout.trim().length > 0;
          logWithCategory('info', LogCategory.DOCKER,
            `dockerd process running (Linux fallback): ${isRunning}`);
          return isRunning;
        } catch {
          logWithCategory('info', LogCategory.DOCKER,
            'Docker process not running (Linux)');
          return false;
        }
      }
    }

    return false;
  } catch (error: any) {
    logWithCategory('warn', LogCategory.DOCKER,
      'Error checking Docker Desktop process', { error: error.message });
    return false;
  }
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
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      const dockerPath = `${programFiles}\\Docker\\Docker\\Docker Desktop.exe`;
      logWithCategory('info', LogCategory.DOCKER, `Starting Docker Desktop on Windows: ${dockerPath}`);

      // Start Docker Desktop without waiting for it to complete
      exec(`start "" "${dockerPath}"`, { windowsHide: true, env: getFixedEnv() }, (error) => {
        if (error) {
          logWithCategory('warn', LogCategory.DOCKER, `Error starting Docker Desktop: ${error.message}`);
        }
      });

    } else if (platform === 'macos') {
      logWithCategory('info', LogCategory.DOCKER, 'Starting Docker Desktop on macOS');

      // Start Docker.app on macOS
      exec('open -a Docker', { env: getFixedEnv() }, (error) => {
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

    logWithCategory('info', LogCategory.DOCKER, 'Docker running status:', {
      installed: runningStatus.installed,
      running: runningStatus.running,
      error: runningStatus.error,
    });

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
    // Use a longer timeout (20s) to account for Docker Desktop initialization
    try {
      const result = await execAsync('docker info', { timeout: 20000 });
      logWithCategory('info', LogCategory.DOCKER, 'Docker is healthy (verified with docker info)');
      logWithCategory('debug', LogCategory.DOCKER, 'Docker info output:', result.stdout.substring(0, 200));

      return {
        running: true,
        healthy: true,
        message: 'Docker is running and healthy',
      };

    } catch (error: any) {
      logWithCategory('warn', LogCategory.DOCKER, 'Docker health check failed', {
        error: error.message,
        stderr: error.stderr,
        stdout: error.stdout,
      });

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

  // Check if Docker Desktop process is already running (but daemon not ready yet)
  const processAlreadyRunning = await isDockerDesktopProcessRunning();

  if (processAlreadyRunning) {
    logWithCategory('info', LogCategory.DOCKER,
      'Docker Desktop process is already running. Waiting for daemon to become ready...');

    if (progressCallback) {
      progressCallback({
        message: 'Docker Desktop is starting up, waiting for daemon...',
        percent: 10,
        step: 'waiting-for-existing',
      });
    }
  } else {
    // Docker Desktop is NOT running - start it
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
  }

  // Wait for the daemon to be ready (same regardless of whether we started it or not)
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
