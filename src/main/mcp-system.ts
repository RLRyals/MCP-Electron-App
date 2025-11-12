/**
 * MCP System Module
 * Manages the MCP core system startup, health checks, and lifecycle
 * Integrates with all completed modules (env-config, docker, client-selection, etc.)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs-extra';
import { app } from 'electron';
import { logWithCategory, LogCategory } from './logger';
import * as envConfig from './env-config';
import * as clientSelection from './client-selection';
import * as typingMindDownloader from './typingmind-downloader';
import * as typingMindAutoConfig from './typingmind-auto-config';
import { checkDockerRunning } from './prerequisites';

const execAsync = promisify(exec);

/**
 * Progress callback for system operations
 */
export type ProgressCallback = (progress: SystemProgress) => void;

/**
 * System progress interface
 */
export interface SystemProgress {
  message: string;
  percent: number;
  step: string;
  status: 'starting' | 'checking' | 'ready' | 'error';
}

/**
 * System operation result
 */
export interface SystemOperationResult {
  success: boolean;
  message: string;
  error?: string;
  urls?: ServiceUrls;
}

/**
 * Service URLs interface
 */
export interface ServiceUrls {
  typingMind?: string;
  mcpConnector?: string;
  postgres?: string;
}

/**
 * Container health status
 */
export interface ContainerHealth {
  name: string;
  status: string;
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
  running: boolean;
}

/**
 * System status interface
 */
export interface SystemStatus {
  running: boolean;
  healthy: boolean;
  containers: ContainerHealth[];
  message: string;
}

/**
 * Service logs result
 */
export interface ServiceLogsResult {
  success: boolean;
  logs: string;
  error?: string;
}

// Timeout for health checks (2 minutes)
const HEALTH_CHECK_TIMEOUT = 120000;
const HEALTH_CHECK_INTERVAL = 2000;

/**
 * Get the MCP working directory (base directory for all MCP data)
 */
export function getMCPWorkingDirectory(): string {
  const userDataPath = app.getPath('userData');
  return userDataPath;
}

/**
 * Get the cloned MCP-Writing-Servers repository path
 */
export function getMCPRepositoryDirectory(): string {
  return path.join(getMCPWorkingDirectory(), 'repositories', 'mcp-writing-servers');
}

/**
 * Get docker-compose file path from the cloned MCP-Writing-Servers repository
 */
function getDockerComposeFilePath(type: 'core' | 'typing-mind'): string {
  const repoPath = getMCPRepositoryDirectory();
  // Use connector-http-sse setup for core (recommended for TypingMind URL-based config)
  if (type === 'core') {
    return path.join(repoPath, 'docker', 'docker-compose.connector-http-sse.yml');
  }
  return path.join(repoPath, 'docker', `docker-compose.${type}.yml`);
}

/**
 * Ensure docker-compose files exist in the cloned MCP-Writing-Servers repository
 */
async function ensureDockerComposeFiles(): Promise<void> {
  logWithCategory('info', LogCategory.DOCKER, 'Checking docker-compose files from repository...');

  // Check that the MCP-Writing-Servers repository exists
  const repoPath = getMCPRepositoryDirectory();
  if (!await fs.pathExists(repoPath)) {
    throw new Error(
      `MCP-Writing-Servers repository not found at ${repoPath}. ` +
      'Please ensure the repository was cloned during installation.'
    );
  }

  // Check that required docker-compose files exist
  const coreComposePath = getDockerComposeFilePath('core');
  if (!await fs.pathExists(coreComposePath)) {
    throw new Error(
      `docker-compose.connector-http-sse.yml not found at ${coreComposePath}. ` +
      'The MCP-Writing-Servers repository may be incomplete or corrupted.'
    );
  }

  logWithCategory('info', LogCategory.DOCKER, 'Docker-compose files verified from repository (using connector-http-sse setup)');
}

/**
 * Check if ports are available before starting
 */
export async function checkPortConflicts(): Promise<{ success: boolean; conflicts: number[] }> {
  logWithCategory('info', LogCategory.DOCKER, 'Checking for port conflicts...');

  const config = await envConfig.loadEnvConfig();
  const conflicts: number[] = [];

  // Check all ports
  const portsToCheck = [
    config.POSTGRES_PORT,
    config.MCP_CONNECTOR_PORT,
    config.TYPING_MIND_PORT,
  ];

  for (const port of portsToCheck) {
    const available = await envConfig.checkPortAvailable(port);
    if (!available) {
      conflicts.push(port);
      logWithCategory('warn', LogCategory.DOCKER, `Port ${port} is already in use`);
    }
  }

  if (conflicts.length > 0) {
    logWithCategory('warn', LogCategory.DOCKER, `Port conflicts detected: ${conflicts.join(', ')}`);
    return { success: false, conflicts };
  }

  logWithCategory('info', LogCategory.DOCKER, 'No port conflicts detected');
  return { success: true, conflicts: [] };
}

/**
 * Determine which services to start based on client selection
 */
async function determineServicesToStart(): Promise<{
  core: boolean;
  mcpConnector: boolean;
  typingMind: boolean;
}> {
  logWithCategory('info', LogCategory.DOCKER, 'Determining which services to start...');

  // Core services are always needed
  const services = {
    core: true,
    mcpConnector: false,
    typingMind: false,
  };

  // Load client selection
  const selection = await clientSelection.loadClientSelection();

  if (!selection || !selection.clients || selection.clients.length === 0) {
    logWithCategory('warn', LogCategory.DOCKER, 'No clients selected, will only start core services');
    return services;
  }

  const selectedClients = selection.clients;
  logWithCategory('info', LogCategory.DOCKER, `Selected clients: ${selectedClients.join(', ')}`);

  // Start MCP connector if Typing Mind or Claude Desktop is selected
  if (selectedClients.includes('typingmind') || selectedClients.includes('claude-desktop')) {
    services.mcpConnector = true;
    logWithCategory('info', LogCategory.DOCKER, 'MCP Connector will be started');
  }

  // Start Typing Mind if selected AND files are downloaded
  if (selectedClients.includes('typingmind')) {
    const isInstalled = await typingMindDownloader.isInstalled();
    if (isInstalled) {
      services.typingMind = true;
      logWithCategory('info', LogCategory.DOCKER, 'Typing Mind will be started');
    } else {
      logWithCategory('warn', LogCategory.DOCKER, 'Typing Mind selected but not installed');
    }
  }

  return services;
}

/**
 * Execute docker-compose command
 */
async function execDockerCompose(
  composeFile: string | string[],
  command: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string }> {
  // Use the repository directory as the working directory so Docker can find build contexts
  const repoDir = getMCPRepositoryDirectory();

  // Load environment variables for docker-compose
  const config = await envConfig.loadEnvConfig();

  // Build the -f flags for all compose files
  const composeFiles = Array.isArray(composeFile) ? composeFile : [composeFile];
  const composeFlags = composeFiles.map(f => `-f "${f}"`).join(' ');

  // Build the command without inline environment variables
  const fullCommand = `docker-compose ${composeFlags} ${command} ${args.join(' ')}`;

  logWithCategory('info', LogCategory.DOCKER, `Executing: ${fullCommand}`);
  logWithCategory('info', LogCategory.DOCKER, `Working directory: ${repoDir}`);
  logWithCategory('info', LogCategory.DOCKER, `Environment variables: MCP_AUTH_TOKEN=****, POSTGRES_PASSWORD=****`);

  try {
    // Pass environment variables through the env option (cross-platform compatible)
    const result = await execAsync(fullCommand, {
      cwd: repoDir,
      env: {
        ...process.env, // Include existing environment variables
        POSTGRES_DB: config.POSTGRES_DB,
        POSTGRES_USER: config.POSTGRES_USER,
        POSTGRES_PASSWORD: config.POSTGRES_PASSWORD,
        POSTGRES_PORT: String(config.POSTGRES_PORT),
        MCP_CONNECTOR_PORT: String(config.MCP_CONNECTOR_PORT),
        HTTP_SSE_PORT: String(config.HTTP_SSE_PORT),
        MCP_AUTH_TOKEN: config.MCP_AUTH_TOKEN,
        TYPING_MIND_PORT: String(config.TYPING_MIND_PORT),
        TYPING_MIND_DIR: typingMindDownloader.getTypingMindDirectory(),
      }
    });
    return result;
  } catch (error: any) {
    logWithCategory('error', LogCategory.DOCKER, `Docker-compose command failed: ${fullCommand}`, error);
    throw error;
  }
}

/**
 * Parse docker-compose ps output to get container health
 */
async function getContainerHealth(composeFile: string | string[]): Promise<ContainerHealth[]> {
  try {
    const { stdout } = await execDockerCompose(composeFile, 'ps', ['--format', 'json']);

    if (!stdout.trim()) {
      return [];
    }

    const containers: ContainerHealth[] = [];
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      try {
        const container = JSON.parse(line);

        // Parse health status
        let health: ContainerHealth['health'] = 'none';
        if (container.Health) {
          health = container.Health.toLowerCase() as ContainerHealth['health'];
        } else if (container.State === 'running') {
          // If no health check defined, consider it healthy if running
          health = 'healthy';
        }

        containers.push({
          name: container.Name || container.Service,
          status: container.State || container.Status,
          health: health,
          running: container.State === 'running',
        });
      } catch (parseError) {
        logWithCategory('warn', LogCategory.DOCKER, `Failed to parse container JSON: ${line}`);
      }
    }

    return containers;
  } catch (error) {
    logWithCategory('error', LogCategory.DOCKER, 'Failed to get container health', error);
    return [];
  }
}

/**
 * Wait for all containers to be healthy
 */
async function waitForHealthy(
  composeFiles: string[],
  progressCallback?: ProgressCallback
): Promise<{ success: boolean; message: string }> {
  logWithCategory('info', LogCategory.DOCKER, 'Waiting for containers to be healthy...');

  const startTime = Date.now();
  let lastProgress = 0;

  while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT) {
    // Get health status from all compose files together
    // This ensures dependencies between files are resolved
    const allContainers = await getContainerHealth(composeFiles);

    if (allContainers.length === 0) {
      logWithCategory('warn', LogCategory.DOCKER, 'No containers found');
      await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
      continue;
    }

    // Check if all containers are healthy
    const unhealthy = allContainers.filter(c => c.running && c.health !== 'healthy');
    const notRunning = allContainers.filter(c => !c.running);

    // Calculate progress
    const healthyCount = allContainers.filter(c => c.health === 'healthy').length;
    const progress = Math.min(95, Math.floor((healthyCount / allContainers.length) * 100));

    // Report progress
    if (progress > lastProgress && progressCallback) {
      lastProgress = progress;

      // Determine current step message
      let stepMessage = 'Initializing...';
      if (unhealthy.some(c => c.name.includes('postgres'))) {
        stepMessage = 'PostgreSQL starting...';
      } else if (unhealthy.some(c => c.name.includes('mcp'))) {
        stepMessage = 'MCP Servers starting...';
      } else if (unhealthy.length > 0) {
        stepMessage = 'Services starting...';
      } else {
        stepMessage = 'Services ready!';
      }

      progressCallback({
        message: stepMessage,
        percent: progress,
        step: 'health-check',
        status: 'checking',
      });
    }

    if (notRunning.length > 0) {
      logWithCategory('warn', LogCategory.DOCKER, `Containers not running: ${notRunning.map(c => c.name).join(', ')}`);

      // Report progress with error status
      if (progressCallback) {
        progressCallback({
          message: `Container failed to start: ${notRunning[0].name}`,
          percent: progress,
          step: 'health-check',
          status: 'error',
        });
      }

      return {
        success: false,
        message: `Container failed to start: ${notRunning.map(c => c.name).join(', ')}`,
      };
    }

    if (unhealthy.length === 0) {
      logWithCategory('info', LogCategory.DOCKER, 'All containers are healthy!');

      if (progressCallback) {
        progressCallback({
          message: 'System Ready!',
          percent: 100,
          step: 'complete',
          status: 'ready',
        });
      }

      return { success: true, message: 'All services are healthy' };
    }

    // Log current status
    logWithCategory('info', LogCategory.DOCKER,
      `Health check: ${healthyCount}/${allContainers.length} healthy. ` +
      `Waiting for: ${unhealthy.map(c => `${c.name} (${c.health})`).join(', ')}`
    );

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
  }

  // Timeout reached
  logWithCategory('error', LogCategory.DOCKER, 'Health check timeout reached');

  if (progressCallback) {
    progressCallback({
      message: 'Health check timeout - services did not become ready',
      percent: lastProgress,
      step: 'health-check',
      status: 'error',
    });
  }

  return {
    success: false,
    message: 'Health check timeout - services did not become ready within 2 minutes',
  };
}

/**
 * Start the MCP system
 */
export async function startMCPSystem(
  progressCallback?: ProgressCallback
): Promise<SystemOperationResult> {
  logWithCategory('info', LogCategory.DOCKER, 'Starting MCP system...');

  try {
    // Check if Docker is running
    if (progressCallback) {
      progressCallback({
        message: 'Checking Docker...',
        percent: 5,
        step: 'pre-check',
        status: 'checking',
      });
    }

    const dockerStatus = await checkDockerRunning();
    if (!dockerStatus.running) {
      logWithCategory('error', LogCategory.DOCKER, 'Docker is not running');
      return {
        success: false,
        message: 'Docker is not running. Please start Docker Desktop first.',
        error: 'DOCKER_NOT_RUNNING',
      };
    }

    // Verify environment configuration is valid before starting
    const config = await envConfig.loadEnvConfig();
    if (!config.MCP_AUTH_TOKEN || config.MCP_AUTH_TOKEN.trim() === '') {
      logWithCategory('error', LogCategory.DOCKER, 'MCP_AUTH_TOKEN is not configured');
      return {
        success: false,
        message: 'Environment configuration is incomplete. Please complete the setup wizard and configure the environment settings before starting the system.',
        error: 'INVALID_CONFIG',
      };
    }
    if (!config.POSTGRES_PASSWORD || config.POSTGRES_PASSWORD.trim() === '') {
      logWithCategory('error', LogCategory.DOCKER, 'POSTGRES_PASSWORD is not configured');
      return {
        success: false,
        message: 'Database password is not configured. Please complete the setup wizard and configure the environment settings before starting the system.',
        error: 'INVALID_CONFIG',
      };
    }

    // Ensure docker-compose files exist
    if (progressCallback) {
      progressCallback({
        message: 'Preparing configuration...',
        percent: 10,
        step: 'config',
        status: 'checking',
      });
    }

    await ensureDockerComposeFiles();

    // Determine which services to start
    const services = await determineServicesToStart();
    logWithCategory('info', LogCategory.DOCKER, `Services to start: ${JSON.stringify(services)}`);

    // Check port conflicts (optional - warn but continue)
    const portCheck = await checkPortConflicts();
    if (!portCheck.success) {
      logWithCategory('warn', LogCategory.DOCKER, `Port conflicts detected: ${portCheck.conflicts.join(', ')}`);
      // We'll continue anyway - docker-compose will fail with a better error if there's a real conflict
    }

    // Start services
    const composeFiles: string[] = [];

    // 1. Build and start core services
    const coreFile = getDockerComposeFilePath('core');
    composeFiles.push(coreFile);

    // Build the mcp-writing-system image first
    if (progressCallback) {
      progressCallback({
        message: 'Building MCP Writing System image (this may take a few minutes on first run)...',
        percent: 20,
        step: 'building-image',
        status: 'starting',
      });
    }

    try {
      logWithCategory('info', LogCategory.DOCKER, 'Building mcp-writing-system image...');
      await execDockerCompose(coreFile, 'build', ['mcp-writing-system']);
      logWithCategory('info', LogCategory.DOCKER, 'mcp-writing-system image built successfully');
    } catch (error: any) {
      logWithCategory('error', LogCategory.DOCKER, 'Failed to build mcp-writing-system image', error);
      return {
        success: false,
        message: 'Failed to build MCP Writing System image. Check logs for details.',
        error: error.message,
      };
    }

    // Start core services
    if (progressCallback) {
      progressCallback({
        message: 'Starting core services (PostgreSQL, MCP Writing System)...',
        percent: 40,
        step: 'starting-core',
        status: 'starting',
      });
    }

    try {
      await execDockerCompose(coreFile, 'up', ['-d', 'mcp-writing-system']);
      logWithCategory('info', LogCategory.DOCKER, 'Core services started');
    } catch (error: any) {
      logWithCategory('error', LogCategory.DOCKER, 'Failed to start core services', error);

      // Check if it's a port conflict
      if (error.stderr && error.stderr.includes('port is already allocated')) {
        const match = error.stderr.match(/port (\d+) is already allocated/);
        const port = match ? match[1] : 'unknown';
        return {
          success: false,
          message: `Port ${port} is already in use. Please change the port in environment configuration.`,
          error: 'PORT_CONFLICT',
        };
      }

      return {
        success: false,
        message: 'Failed to start core services. Check logs for details.',
        error: error.message,
      };
    }

    // 2. Start Typing Mind if needed
    // Note: MCP Connector is now bundled in the core mcp-writing-system service
    if (services.typingMind) {
      if (progressCallback) {
        progressCallback({
          message: 'Starting Typing Mind...',
          percent: 65,
          step: 'starting-typing-mind',
          status: 'starting',
        });
      }

      const typingMindFile = getDockerComposeFilePath('typing-mind');
      composeFiles.push(typingMindFile);

      try {
        // Use both core and typing-mind compose files together to resolve service dependencies
        // But only start the typing-mind-web service
        const repoDir = getMCPRepositoryDirectory();
        const config = await envConfig.loadEnvConfig();

        const fullCommand = `docker-compose -f "${coreFile}" -f "${typingMindFile}" up -d typing-mind-web`;

        logWithCategory('info', LogCategory.DOCKER, `Executing: ${fullCommand}`);

        await execAsync(fullCommand, {
          cwd: repoDir,
          env: {
            ...process.env,
            POSTGRES_DB: config.POSTGRES_DB,
            POSTGRES_USER: config.POSTGRES_USER,
            POSTGRES_PASSWORD: config.POSTGRES_PASSWORD,
            POSTGRES_PORT: String(config.POSTGRES_PORT),
            MCP_CONNECTOR_PORT: String(config.MCP_CONNECTOR_PORT),
            MCP_AUTH_TOKEN: config.MCP_AUTH_TOKEN,
            TYPING_MIND_PORT: String(config.TYPING_MIND_PORT),
            TYPING_MIND_DIR: typingMindDownloader.getTypingMindDirectory(),
          }
        });

        logWithCategory('info', LogCategory.DOCKER, 'Typing Mind started');
      } catch (error: any) {
        logWithCategory('error', LogCategory.DOCKER, 'Failed to start Typing Mind', error);
        // Continue anyway - other services might still work
      }
    }

    // Wait for all containers to be healthy
    if (progressCallback) {
      progressCallback({
        message: 'Waiting for services to be ready...',
        percent: 70,
        step: 'health-check',
        status: 'checking',
      });
    }

    const healthResult = await waitForHealthy(composeFiles, progressCallback);

    if (!healthResult.success) {
      return {
        success: false,
        message: healthResult.message,
        error: 'HEALTH_CHECK_FAILED',
      };
    }

    // Save startup timestamp
    await saveStartupMetadata();

    // Get service URLs
    const urls = await getServiceUrls();

    // Auto-configure TypingMind if enabled (MCP servers are auto-started by Docker)
    if (services.typingMind) {
      logWithCategory('info', LogCategory.DOCKER, 'Auto-configuring TypingMind connection to MCP Connector...');

      // Wait a bit for the MCP connector to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const autoConfigResult = await typingMindAutoConfig.autoConfigureTypingMind();
        if (autoConfigResult.success) {
          logWithCategory('info', LogCategory.DOCKER, 'TypingMind auto-configured successfully');
        } else {
          logWithCategory('warn', LogCategory.DOCKER, `TypingMind auto-configuration failed: ${autoConfigResult.message}`);
        }
      } catch (error) {
        logWithCategory('error', LogCategory.DOCKER, 'Error during TypingMind auto-configuration', error);
        // Don't fail the whole startup if auto-config fails
      }
    }

    logWithCategory('info', LogCategory.DOCKER, 'MCP system started successfully');

    return {
      success: true,
      message: 'MCP system started successfully',
      urls,
    };

  } catch (error: any) {
    logWithCategory('error', LogCategory.DOCKER, 'Failed to start MCP system', error);
    return {
      success: false,
      message: 'Failed to start MCP system',
      error: error.message,
    };
  }
}

/**
 * Stop the MCP system
 */
export async function stopMCPSystem(): Promise<SystemOperationResult> {
  logWithCategory('info', LogCategory.DOCKER, 'Stopping MCP system...');

  try {
    const composeFiles = [
      getDockerComposeFilePath('typing-mind'),
      getDockerComposeFilePath('core'),
    ];

    // Stop all services in reverse order
    for (const composeFile of composeFiles) {
      try {
        if (await fs.pathExists(composeFile)) {
          await execDockerCompose(composeFile, 'down');
          logWithCategory('info', LogCategory.DOCKER, `Stopped services from ${path.basename(composeFile)}`);
        }
      } catch (error) {
        logWithCategory('warn', LogCategory.DOCKER, `Failed to stop services from ${path.basename(composeFile)}`, error);
        // Continue stopping other services
      }
    }

    logWithCategory('info', LogCategory.DOCKER, 'MCP system stopped');

    return {
      success: true,
      message: 'MCP system stopped successfully',
    };

  } catch (error: any) {
    logWithCategory('error', LogCategory.DOCKER, 'Failed to stop MCP system', error);
    return {
      success: false,
      message: 'Failed to stop MCP system',
      error: error.message,
    };
  }
}

/**
 * Restart the MCP system
 */
export async function restartMCPSystem(
  progressCallback?: ProgressCallback
): Promise<SystemOperationResult> {
  logWithCategory('info', LogCategory.DOCKER, 'Restarting MCP system...');

  if (progressCallback) {
    progressCallback({
      message: 'Stopping services...',
      percent: 10,
      step: 'stopping',
      status: 'starting',
    });
  }

  // Stop first
  const stopResult = await stopMCPSystem();
  if (!stopResult.success) {
    logWithCategory('warn', LogCategory.DOCKER, 'Stop failed during restart, continuing anyway');
  }

  // Wait a moment for cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));

  if (progressCallback) {
    progressCallback({
      message: 'Starting services...',
      percent: 20,
      step: 'starting',
      status: 'starting',
    });
  }

  // Start again
  return await startMCPSystem(progressCallback);
}

/**
 * Get current system status
 * Uses docker ps to get all MCP-related containers regardless of how they were started
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  logWithCategory('info', LogCategory.DOCKER, 'Getting system status...');

  try {
    // Use docker ps to find all MCP-related containers
    // This works regardless of which compose file was used to start them
    const { stdout } = await execAsync('docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" --format "{{json .}}"');

    if (!stdout.trim()) {
      return {
        running: false,
        healthy: false,
        containers: [],
        message: 'No containers running',
      };
    }

    const allContainers: ContainerHealth[] = [];
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      try {
        const container = JSON.parse(line);

        // Parse health status
        let health: ContainerHealth['health'] = 'none';
        const status = container.Status || '';

        if (status.includes('(healthy)')) {
          health = 'healthy';
        } else if (status.includes('(unhealthy)')) {
          health = 'unhealthy';
        } else if (status.includes('(starting)') || status.includes('(health: starting)')) {
          health = 'starting';
        } else if (container.State === 'running') {
          // If no health check defined, consider it healthy if running
          health = 'healthy';
        }

        allContainers.push({
          name: container.Names,
          status: container.State,
          health: health,
          running: container.State === 'running',
        });
      } catch (parseError) {
        logWithCategory('warn', LogCategory.DOCKER, `Failed to parse container JSON: ${line}`);
      }
    }

    if (allContainers.length === 0) {
      return {
        running: false,
        healthy: false,
        containers: [],
        message: 'No containers running',
      };
    }

    const running = allContainers.some(c => c.running);
    const healthy = allContainers.every(c => !c.running || c.health === 'healthy');

    return {
      running,
      healthy,
      containers: allContainers,
      message: healthy ? 'All services healthy' : 'Some services unhealthy',
    };

  } catch (error: any) {
    logWithCategory('error', LogCategory.DOCKER, 'Failed to get system status', error);
    return {
      running: false,
      healthy: false,
      containers: [],
      message: 'Failed to get status',
    };
  }
}

/**
 * Get service URLs
 */
export async function getServiceUrls(): Promise<ServiceUrls> {
  const config = await envConfig.loadEnvConfig();
  const selection = await clientSelection.loadClientSelection();
  const urls: ServiceUrls = {};

  // Add Typing Mind URL if selected and installed
  if (selection?.clients.includes('typingmind')) {
    const isInstalled = await typingMindDownloader.isInstalled();
    if (isInstalled) {
      urls.typingMind = `http://localhost:${config.TYPING_MIND_PORT}`;
    }
  }

  // Add MCP Connector URL if needed
  if (selection?.clients.includes('typingmind') || selection?.clients.includes('claude-desktop')) {
    urls.mcpConnector = `http://localhost:${config.MCP_CONNECTOR_PORT}`;
  }

  // Always include postgres info
  urls.postgres = `postgres://${config.POSTGRES_USER}:****@localhost:${config.POSTGRES_PORT}/${config.POSTGRES_DB}`;

  return urls;
}

/**
 * View service logs
 */
export async function viewServiceLogs(
  serviceName: 'postgres' | 'mcp-writing-system' | 'typing-mind',
  tail: number = 100
): Promise<ServiceLogsResult> {
  logWithCategory('info', LogCategory.DOCKER, `Getting logs for ${serviceName}...`);

  try {
    // Map service names to actual container names
    const containerNameMap: { [key: string]: string } = {
      'postgres': 'mcp-writing-db',
      'mcp-writing-system': 'mcp-writing-system',
      'typing-mind': 'typing-mind-web',
    };

    const containerName = containerNameMap[serviceName] || serviceName;

    // Use docker logs directly instead of docker-compose since we just need to read logs
    const { stdout } = await execAsync(`docker logs --tail ${tail} ${containerName}`);

    return {
      success: true,
      logs: stdout,
    };

  } catch (error: any) {
    logWithCategory('error', LogCategory.DOCKER, `Failed to get logs for ${serviceName}`, error);
    return {
      success: false,
      logs: '',
      error: error.message,
    };
  }
}

/**
 * Save startup metadata
 */
async function saveStartupMetadata(): Promise<void> {
  try {
    const metadataPath = path.join(getMCPWorkingDirectory(), '.system-metadata.json');
    const metadata = {
      lastStarted: new Date().toISOString(),
      version: app.getVersion(),
    };

    await fs.writeJson(metadataPath, metadata, { spaces: 2 });
    logWithCategory('info', LogCategory.DOCKER, 'Saved startup metadata');
  } catch (error) {
    logWithCategory('warn', LogCategory.DOCKER, 'Failed to save startup metadata', error);
  }
}

/**
 * Get the MCP working directory path (for UI display)
 */
export function getMCPWorkingDirectoryPath(): string {
  return getMCPWorkingDirectory();
}
