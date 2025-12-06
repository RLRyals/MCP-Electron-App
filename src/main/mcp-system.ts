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
import * as mcpConfigGenerator from './mcp-config-generator';
import * as pgbouncerConfig from './pgbouncer-config';
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
 * Get the bundled resources path (where source docker-compose.yml is located)
 * This is read-only in packaged apps
 */
function getBundledResourcesPath(): string {
  let resourcesPath: string;
  
  if (app.isPackaged) {
    // In packaged app, resources are in the resources directory
    // Linux AppImage: /tmp/.mount_XXX/resources or extracted location
    // macOS: AppName.app/Contents/Resources
    // Windows: AppName/resources
    
    const appPath = app.getAppPath(); // Points to app.asar
    
    // On Linux AppImage, use process.resourcesPath if available
    // This points to the actual resources directory, not the temp mount
    if (process.platform === 'linux' && process.resourcesPath) {
      resourcesPath = process.resourcesPath;
      logWithCategory('info', LogCategory.DOCKER, `Using Linux resourcesPath: ${resourcesPath}`);
    } else {
      // Windows and macOS: go from app.asar to parent (resources directory)
      resourcesPath = path.dirname(appPath);
    }
  } else {
    // In development, go from src/main -> project root
    resourcesPath = path.join(__dirname, '..', '..');
  }
  
  return path.normalize(resourcesPath);
}

/**
 * Get the project root directory (runtime location for Docker files)
 * Returns a writable directory in userData where we copy config files
 */
export function getProjectRootDirectory(): string {
  const userDataPath = app.getPath('userData');
  const dockerDir = path.join(userDataPath, 'docker');
  return dockerDir;
}

/**
 * Initialize the Docker directory in userData
 * Copies docker-compose.yml and nginx.conf from bundled resources to writable location
 */
async function initializeDockerDirectory(): Promise<void> {
  const dockerDir = getProjectRootDirectory();
  const resourcesPath = getBundledResourcesPath();
  
  logWithCategory('info', LogCategory.DOCKER, `Initializing Docker directory at: ${dockerDir}`);
  
  try {
    await fs.ensureDir(dockerDir);
    
    // Copy docker-compose.yml
    const sourceCompose = path.join(resourcesPath, 'docker-compose.yml');
    const destCompose = path.join(dockerDir, 'docker-compose.yml');
    
    // Check if source exists (it should always exist in bundle)
    if (fs.existsSync(sourceCompose)) {
      // Always overwrite to ensure updates are applied
      await fs.copy(sourceCompose, destCompose, { overwrite: true });
      logWithCategory('info', LogCategory.DOCKER, 'Copied docker-compose.yml to writable location');
    } else {
      // Fallback check for resources subdirectory
      const altSource = path.join(resourcesPath, 'resources', 'docker-compose.yml');
      if (fs.existsSync(altSource)) {
        await fs.copy(altSource, destCompose, { overwrite: true });
        logWithCategory('info', LogCategory.DOCKER, 'Copied docker-compose.yml from resources subdirectory');
      } else {
        logWithCategory('warn', LogCategory.DOCKER, `Source docker-compose.yml not found at ${sourceCompose}`);
      }
    }
    
    // Copy nginx.conf
    const sourceNginx = path.join(resourcesPath, 'nginx.conf');
    const destNginx = path.join(dockerDir, 'nginx.conf');

    if (fs.existsSync(sourceNginx)) {
      await fs.copy(sourceNginx, destNginx, { overwrite: true });
      logWithCategory('info', LogCategory.DOCKER, 'Copied nginx.conf to writable location');
    } else {
      // Fallback check
      const altNginx = path.join(resourcesPath, 'resources', 'nginx.conf');
      if (fs.existsSync(altNginx)) {
        await fs.copy(altNginx, destNginx, { overwrite: true });
        logWithCategory('info', LogCategory.DOCKER, 'Copied nginx.conf from resources subdirectory');
      }
    }

  } catch (error) {
    logWithCategory('error', LogCategory.DOCKER, 'Failed to initialize Docker directory', error);
    throw error;
  }
}

/**
 * Get the cloned MCP-Writing-Servers repository path (still needed for data files)
 * Ensures the directory exists before returning the path
 */
export function getMCPRepositoryDirectory(): string {
  const repoPath = path.join(getMCPWorkingDirectory(), 'repositories', 'mcp-writing-servers');
  
  // Ensure directory exists before returning
  // This prevents Docker mount errors when the path doesn't exist
  try {
    if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, { recursive: true });
      logWithCategory('info', LogCategory.DOCKER, `Created MCP repository directory: ${repoPath}`);
    }
  } catch (error) {
    logWithCategory('error', LogCategory.DOCKER, `Failed to create MCP repository directory: ${repoPath}`, error);
    // Return the path anyway - let the caller handle the error
  }
  
  return repoPath;
}

/**
 * Get docker-compose file path (now using the root docker-compose.yml)
 */
function getDockerComposeFilePath(type: 'core' | 'typing-mind'): string {
  // All services are now in a single docker-compose.yml at the project root
  return path.join(getProjectRootDirectory(), 'docker-compose.yml');
}

/**
 * Clone MCP-Writing-Servers repository if it doesn't exist
 */
async function cloneMCPRepository(): Promise<void> {
  const repoPath = getMCPRepositoryDirectory();
  const repoUrl = 'https://github.com/RLRyals/MCP-Writing-Servers.git';
  const branch = 'main';

  logWithCategory('info', LogCategory.DOCKER, `Cloning MCP-Writing-Servers repository to ${repoPath}...`);

  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(repoPath);
    await fs.ensureDir(parentDir);

    // Clone the repository
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync(
      `git clone --depth 1 --branch ${branch} ${repoUrl} "${repoPath}"`,
      { cwd: parentDir, timeout: 300000 } // 5 minute timeout
    );

    logWithCategory('info', LogCategory.DOCKER, 'MCP-Writing-Servers repository cloned successfully');
  } catch (error: any) {
    logWithCategory('error', LogCategory.DOCKER, 'Failed to clone MCP-Writing-Servers repository', error);
    throw new Error(
      `Failed to clone MCP-Writing-Servers repository: ${error.message}. ` +
      'Please check your internet connection and try again.'
    );
  }
}

/**
 * Prepare MCP configuration for TypingMind Connector
 * Generates mcp-config.json that will be mounted as a Docker volume
 */
async function prepareMCPConfiguration(): Promise<void> {
  logWithCategory('info', LogCategory.SYSTEM, 'Preparing MCP configuration...');

  try {
    // Generate the mcp-config.json file
    logWithCategory('info', LogCategory.SYSTEM, 'Generating mcp-config.json...');
    const configResult = await mcpConfigGenerator.generateMCPConfig();

    if (!configResult.success) {
      logWithCategory('warn', LogCategory.SYSTEM, `Failed to generate MCP config: ${configResult.error}`);
      // Continue anyway - system will fall back to default behavior
    } else {
      logWithCategory('info', LogCategory.SYSTEM, `MCP config generated at: ${configResult.configPath}`);
      logWithCategory('info', LogCategory.SYSTEM, 'This file will be mounted in the Docker container via volume');
    }
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error preparing MCP configuration', error);
    // Don't throw - allow system to continue with default configuration
  }
}

/**
 * Ensure docker-compose file exists in the project root
 */
async function ensureDockerComposeFiles(): Promise<void> {
  logWithCategory('info', LogCategory.DOCKER, 'Checking docker-compose file...');

  // Check that docker-compose.yml exists in the project root
  const composePath = getDockerComposeFilePath('core');

  if (!await fs.pathExists(composePath)) {
    throw new Error(
      `docker-compose.yml not found at ${composePath}. ` +
      'The project may be corrupted or incomplete. Please ensure the docker-compose.yml file exists in the project root.'
    );
  }

  logWithCategory('info', LogCategory.DOCKER, 'Docker-compose file verified at project root');

  // Also ensure MCP-Writing-Servers repository exists for Docker build context
  const repoPath = getMCPRepositoryDirectory();
  const dockerfilePath = path.join(repoPath, 'Dockerfile');

  // Check if repository is actually cloned by verifying Dockerfile exists
  // Don't just check if directory exists, as getMCPRepositoryDirectory() may create an empty dir
  const isRepoCloned = await fs.pathExists(dockerfilePath);

  if (!isRepoCloned) {
    logWithCategory('warn', LogCategory.DOCKER, 'MCP-Writing-Servers repository not found or incomplete, cloning...');

    // Remove the directory if it exists but is empty/incomplete
    if (await fs.pathExists(repoPath)) {
      logWithCategory('info', LogCategory.DOCKER, `Removing incomplete repository directory: ${repoPath}`);
      await fs.remove(repoPath);
    }

    await cloneMCPRepository();
  } else {
    logWithCategory('info', LogCategory.DOCKER, 'MCP-Writing-Servers repository already exists');
  }

  // Copy init.sql from repository to docker directory
  // This ensures it's in a writable location and works on all systems
  // Copy init.sql from repository to docker directory
  // This ensures it's in a writable location and works on all systems
  const sourceInitSql = path.join(repoPath, 'init.sql');
  const destInitSql = path.join(getProjectRootDirectory(), 'init.sql');

  if (await fs.pathExists(sourceInitSql)) {
    await fs.copy(sourceInitSql, destInitSql, { overwrite: true });
    logWithCategory('info', LogCategory.DOCKER, `Copied init.sql from repository to docker directory`);
  } else {
    logWithCategory('warn', LogCategory.DOCKER, `init.sql not found in repository at ${sourceInitSql}`);
  }
}

/**
 * Validate all Docker volume mount paths exist as directories
 * This prevents mount failures, especially on Linux where file vs directory matters
 */
async function validateMountPaths(): Promise<{ success: boolean; error?: string }> {
  logWithCategory('info', LogCategory.DOCKER, 'Validating Docker mount paths...');
  
  const pathsToValidate = [
    { name: 'MCP Repository', path: getMCPRepositoryDirectory() },
    { name: 'TypingMind', path: typingMindDownloader.getTypingMindDirectory() },
    { name: 'Project Root', path: getProjectRootDirectory() },
  ];
  
  for (const { name, path: dirPath } of pathsToValidate) {
    try {
      // Check if path exists
      if (!fs.existsSync(dirPath)) {
        logWithCategory('warn', LogCategory.DOCKER, `${name} directory does not exist: ${dirPath}. Creating...`);
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Check if it's a directory (not a file)
      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) {
        const error = `${name} path exists but is not a directory: ${dirPath}`;
        logWithCategory('error', LogCategory.DOCKER, error);
        return { success: false, error };
      }
      
      logWithCategory('info', LogCategory.DOCKER, `✓ ${name} directory validated: ${dirPath}`);
    } catch (error: any) {
      const errorMsg = `Failed to validate ${name} directory: ${dirPath} - ${error.message}`;
      logWithCategory('error', LogCategory.DOCKER, errorMsg);
      return { success: false, error: errorMsg };
    }
  }
  
  return { success: true };
}

/**
 * Kill process using a specific port (Linux only)
 */
async function killProcessOnPort(port: number): Promise<boolean> {
  if (process.platform !== 'linux') {
    return false;
  }
  
  try {
    // Try to find and kill the process using lsof
    const { stdout } = await execAsync(`lsof -ti :${port}`, { timeout: 5000 });
    const pids = stdout.trim().split('\n').filter(p => p);
    
    if (pids.length > 0) {
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`, { timeout: 5000 });
          logWithCategory('info', LogCategory.DOCKER, `Killed process ${pid} using port ${port}`);
        } catch (killError) {
          logWithCategory('warn', LogCategory.DOCKER, `Could not kill process ${pid}`, killError);
        }
      }
      return true;
    }
  } catch (error) {
    // lsof might not find anything or might not be installed
    logWithCategory('debug', LogCategory.DOCKER, `Could not find process on port ${port}`, error);
  }
  
  return false;
}

/**
 * Stop existing containers to release ports - AGGRESSIVE cleanup
 */
export async function stopExistingContainers(): Promise<void> {
  const coreFile = getDockerComposeFilePath('core');
  logWithCategory('info', LogCategory.DOCKER, 'Performing aggressive cleanup of existing containers...');

  try {
    // Step 1: Find and stop ALL containers with fictionlab in the name or using our images
    logWithCategory('info', LogCategory.DOCKER, 'Searching for all FictionLab-related containers...');
    try {
      const { stdout } = await execAsync('docker ps -a --format "{{.Names}}"', { timeout: 10000 });
      const allContainers = stdout.trim().split('\n').filter(name => name.includes('fictionlab'));
      
      if (allContainers.length > 0) {
        logWithCategory('info', LogCategory.DOCKER, `Found ${allContainers.length} FictionLab containers: ${allContainers.join(', ')}`);
        
        // Force remove all of them
        for (const name of allContainers) {
          try {
            await execAsync(`docker rm -f ${name}`, { timeout: 10000 });
            logWithCategory('info', LogCategory.DOCKER, `Forcefully removed container: ${name}`);
          } catch (error: any) {
            logWithCategory('warn', LogCategory.DOCKER, `Could not remove ${name}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      logWithCategory('debug', LogCategory.DOCKER, 'Could not list containers', error);
    }

    // Step 2: Also try to remove by specific names (in case they're not running)
    const containerNames = [
      'fictionlab-postgres',
      'fictionlab-pgbouncer', 
      'fictionlab-mcp-connector',
      'fictionlab-mcp-servers',
      'fictionlab-typingmind'
    ];
    
    for (const name of containerNames) {
      try {
        await execAsync(`docker rm -f ${name}`, { timeout: 10000 });
        logWithCategory('info', LogCategory.DOCKER, `Removed container: ${name}`);
      } catch (error: any) {
        // Container doesn't exist - that's fine
        if (!error.message.includes('No such container')) {
          logWithCategory('debug', LogCategory.DOCKER, `Could not remove ${name}: ${error.message}`);
        }
      }
    }

    // Step 3: Use docker-compose to clean up any compose-managed containers
    try {
      await execDockerCompose(coreFile, 'down', ['--remove-orphans']);
      logWithCategory('info', LogCategory.DOCKER, 'Docker Compose cleanup completed');
    } catch (composeError: any) {
      logWithCategory('warn', LogCategory.DOCKER, 'Compose cleanup encountered an issue (may be safe to ignore)', composeError);
    }

    // Step 4: Wait for ports to be released with multiple retries
    const maxRetries = 3;
    const config = await envConfig.loadEnvConfig();
    const requiredPorts = [
      config.POSTGRES_PORT,
      6432, // pgbouncer
      config.MCP_CONNECTOR_PORT,
      config.HTTP_SSE_PORT,
      config.DB_ADMIN_PORT,
      config.TYPING_MIND_PORT
    ];
    
    for (let retry = 0; retry < maxRetries; retry++) {
      const waitTime = process.platform === 'linux' ? 5000 : 3000;
      logWithCategory('info', LogCategory.DOCKER, `Waiting ${waitTime}ms for ports to be released (attempt ${retry + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Check if ports are free
      const portCheckResult = await envConfig.checkAllPortsAndSuggestAlternatives(config);
      
      if (!portCheckResult.hasConflicts) {
        logWithCategory('info', LogCategory.DOCKER, 'All ports are now free');
        return; // Success!
      }
      
      const conflictPorts = portCheckResult.conflicts.map(c => c.port);
      logWithCategory('warn', LogCategory.DOCKER, 
        `Ports still in use: ${conflictPorts.join(', ')} (attempt ${retry + 1}/${maxRetries})`);
      
      // On Linux, try to kill processes using the ports (last resort)
      if (process.platform === 'linux' && retry === maxRetries - 1) {
        logWithCategory('warn', LogCategory.DOCKER, 'Attempting to kill processes using required ports...');
        for (const port of conflictPorts) {
          await killProcessOnPort(port);
        }
        // Wait again after killing processes
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Final check
    const finalCheck = await envConfig.checkAllPortsAndSuggestAlternatives(config);
    if (finalCheck.hasConflicts) {
      logWithCategory('warn', LogCategory.DOCKER, 
        `Warning: Some ports are still in use after cleanup: ${finalCheck.conflicts.map(c => c.port).join(', ')}`);
    }
    
  } catch (error: any) {
    logWithCategory('warn', LogCategory.DOCKER, 'Cleanup encountered an issue', error);
    // Wait a bit anyway
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

/**
 * Identify what process is using a specific port (Linux only)
 */
async function identifyPortUser(port: number): Promise<string | null> {
  if (process.platform !== 'linux') {
    return null;
  }
  
  try {
    // Try lsof first (most detailed)
    try {
      const { stdout } = await execAsync(`lsof -i :${port} -n -P`, { timeout: 5000 });
      if (stdout.trim()) {
        return stdout.trim();
      }
    } catch (lsofError) {
      // lsof might not be installed, try ss
      try {
        const { stdout } = await execAsync(`ss -lptn sport = :${port}`, { timeout: 5000 });
        if (stdout.trim()) {
          return stdout.trim();
        }
      } catch (ssError) {
        // Neither command worked
        logWithCategory('debug', LogCategory.DOCKER, `Could not identify port ${port} user: lsof and ss both failed`);
      }
    }
  } catch (error) {
    logWithCategory('debug', LogCategory.DOCKER, `Error identifying port ${port} user`, error);
  }
  
  return null;
}

/**
 * Check if ports are available before starting
 */
export async function checkPortConflicts(): Promise<{ success: boolean; conflicts: number[]; details?: any }> {
  logWithCategory('info', LogCategory.DOCKER, 'Checking for port conflicts...');

  const config = await envConfig.loadEnvConfig();
  const result = await envConfig.checkAllPortsAndSuggestAlternatives(config);

  if (result.hasConflicts) {
    const conflictPorts = result.conflicts.map(c => c.port);
    logWithCategory('warn', LogCategory.DOCKER, `Port conflicts detected: ${conflictPorts.join(', ')}`);
    
    // On Linux, try to identify what's using the ports
    if (process.platform === 'linux') {
      for (const conflict of result.conflicts) {
        const portUser = await identifyPortUser(conflict.port);
        if (portUser) {
          logWithCategory('info', LogCategory.DOCKER, 
            `Port ${conflict.port} is being used by:\n${portUser}`);
        }
      }
    }
    
    return { 
      success: false, 
      conflicts: conflictPorts,
      details: result.conflicts
    };
  }

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
  // Use the project root directory as the working directory so Docker can find build contexts
  const workingDir = getProjectRootDirectory();

  // Load environment variables for docker-compose
  const config = await envConfig.loadEnvConfig();

  // Build the -f flags for all compose files
  const composeFiles = Array.isArray(composeFile) ? composeFile : [composeFile];
  const composeFlags = composeFiles.map(f => `-f "${f}"`).join(' ');

  // Build the command without inline environment variables
  // Use Docker Compose V2 syntax (docker compose) instead of V1 (docker-compose)
  const fullCommand = `docker compose ${composeFlags} ${command} ${args.join(' ')}`;

  logWithCategory('info', LogCategory.DOCKER, `Executing: ${fullCommand}`);
  logWithCategory('info', LogCategory.DOCKER, `Working directory: ${workingDir}`);
  logWithCategory('info', LogCategory.DOCKER, `Environment variables: MCP_AUTH_TOKEN=****, POSTGRES_PASSWORD=****`);

  try {
    // Get the path to the generated MCP config file
    const mcpConfigPath = mcpConfigGenerator.getMCPConfigPath();

    // Pass environment variables through the env option (cross-platform compatible)
    const result = await execAsync(fullCommand, {
      cwd: workingDir,
      env: {
        ...process.env, // Include existing environment variables
        POSTGRES_DB: config.POSTGRES_DB,
        POSTGRES_USER: config.POSTGRES_USER,
        POSTGRES_PASSWORD: config.POSTGRES_PASSWORD,
        POSTGRES_PORT: String(config.POSTGRES_PORT),
        MCP_CONNECTOR_PORT: String(config.MCP_CONNECTOR_PORT),
        HTTP_SSE_PORT: String(config.HTTP_SSE_PORT),
        DB_ADMIN_PORT: String(config.DB_ADMIN_PORT),
        MCP_AUTH_TOKEN: config.MCP_AUTH_TOKEN,
        TYPING_MIND_PORT: String(config.TYPING_MIND_PORT),
        TYPING_MIND_DIR: typingMindDownloader.getTypingMindDirectory(),
        // Path to MCP config file for Docker volume mounting
        MCP_CONFIG_FILE_PATH: mcpConfigPath,
        // Repository paths for Docker volume mounting
        MCP_WRITING_SERVERS_DIR: getMCPRepositoryDirectory(),
        // Docker directory path (contains init.sql, nginx.conf, etc.)
        DOCKER_DIR: workingDir,
        // nginx.conf path for TypingMind container
        NGINX_CONF_PATH: path.join(workingDir, 'nginx.conf'),
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
  let checksPerformed = 0;

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
    checksPerformed++;

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
      // Fast path: if already healthy on first check, services were already running
      const wasAlreadyRunning = checksPerformed === 1;
      const message = wasAlreadyRunning
        ? 'All services were already healthy - startup skipped'
        : 'All services are healthy';

      logWithCategory('info', LogCategory.DOCKER, message);

      if (progressCallback) {
        progressCallback({
          message: 'System Ready!',
          percent: 100,
          step: 'complete',
          status: 'ready',
        });
      }

      return { success: true, message };
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

    await initializeDockerDirectory();

    // Ensure MCP-Writing-Servers repository is cloned (contains init.sql and other data files)
    if (progressCallback) {
      progressCallback({
        message: 'Ensuring MCP-Writing-Servers repository...',
        percent: 10.5,
        step: 'ensure-repo',
        status: 'checking',
      });
    }

    await ensureDockerComposeFiles();

    // Validate all mount paths exist as directories
    if (progressCallback) {
      progressCallback({
        message: 'Validating mount paths...',
        percent: 11,
        step: 'validate-mounts',
        status: 'checking',
      });
    }

    const mountValidation = await validateMountPaths();
    if (!mountValidation.success) {
      return {
        success: false,
        message: `Mount path validation failed: ${mountValidation.error}`,
        error: 'INVALID_MOUNT_PATH',
      };
    }

    // Prepare MCP configuration (generates mcp-config.json and copies custom entrypoint)
    if (progressCallback) {
      progressCallback({
        message: 'Generating MCP configuration...',
        percent: 12,
        step: 'mcp-config',
        status: 'checking',
      });
    }

    await prepareMCPConfiguration();

    // Generate PgBouncer configuration files
    if (progressCallback) {
      progressCallback({
        message: 'Generating PgBouncer configuration...',
        percent: 13,
        step: 'pgbouncer-config',
        status: 'checking',
      });
    }

    const pgbouncerResult = await pgbouncerConfig.generatePgBouncerConfig(config);
    if (!pgbouncerResult.success) {
      logWithCategory('warn', LogCategory.DOCKER, `Failed to generate PgBouncer config: ${pgbouncerResult.error}`);
      // Continue anyway - system might work without it
    } else {
      logWithCategory('info', LogCategory.DOCKER, 'PgBouncer configuration generated successfully');
    }

    // Determine which services to start
    const services = await determineServicesToStart();
    logWithCategory('info', LogCategory.DOCKER, `Services to start: ${JSON.stringify(services)}`);

    // Check port conflicts
    let portCheck = await checkPortConflicts();
    
    if (!portCheck.success) {
      logWithCategory('warn', LogCategory.DOCKER, `Port conflicts detected: ${portCheck.conflicts.join(', ')}`);
      
      // Try to resolve by stopping existing containers
      if (progressCallback) {
        progressCallback({
          message: 'Port conflicts detected. Cleaning up old containers...',
          percent: 15,
          step: 'cleanup',
          status: 'checking',
        });
      }

      await stopExistingContainers();
      
      // Re-check ports
      portCheck = await checkPortConflicts();

      if (!portCheck.success) {
        // Build a detailed error message with process info if available
        let conflictDetails = '';
        if (portCheck.details && Array.isArray(portCheck.details)) {
          for (const detail of portCheck.details) {
            conflictDetails += `\n• Port ${detail.port} (${detail.name})`;
            if (detail.processInfo) {
              conflictDetails += `:\n  ${detail.processInfo.split('\n').join('\n  ')}`;
            }
            // Special note for PgBouncer port which cannot be changed
            if (detail.port === 6432) {
              conflictDetails += '\n  ⚠️ This port is required by PgBouncer and cannot be changed.';
              conflictDetails += '\n  You must stop whatever is using port 6432 before starting.';
            }
          }
        }

        const conflictMsg = `Port conflicts detected on ports: ${portCheck.conflicts.join(', ')}.\n` +
          (conflictDetails ? `\nConflict details:${conflictDetails}\n` : '') +
          `\nThe application attempted to free these ports automatically but was unable to do so.\n\n` +
          `Please try one of the following:\n` +
          `1. Stop any other applications using these ports (check details above)\n` +
          `2. On Linux, run: sudo lsof -i :<port> to see what's using a port\n` +
          `3. For configurable ports, change them in the Setup Wizard (Environment Configuration step)\n` +
          `4. Restart your computer to clear all port locks\n` +
          `5. Check the logs for more details`;

        logWithCategory('error', LogCategory.DOCKER, conflictMsg);
        return {
          success: false,
          message: conflictMsg,
          error: 'PORT_CONFLICT',
        };
      }
    } else {
      // No conflicts, but still good to ensure clean slate
      if (progressCallback) {
        progressCallback({
          message: 'Cleaning up old containers...',
          percent: 15,
          step: 'cleanup',
          status: 'checking',
        });
      }
      await stopExistingContainers();
    }

    // Start services
    const composeFiles: string[] = [];
    const coreFile = getDockerComposeFilePath('core');

    // 1. Build and start core services
    composeFiles.push(coreFile);

    // Build the mcp-writing-servers image first
    if (progressCallback) {
      progressCallback({
        message: 'Building MCP Writing Servers image (this may take a few minutes on first run)...',
        percent: 25,
        step: 'building-image',
        status: 'starting',
      });
    }

    try {
      logWithCategory('info', LogCategory.DOCKER, 'Building mcp-writing-servers image...');
      await execDockerCompose(coreFile, 'build', ['mcp-writing-servers']);
      logWithCategory('info', LogCategory.DOCKER, 'mcp-writing-servers image built successfully');
    } catch (error: any) {
      logWithCategory('error', LogCategory.DOCKER, 'Failed to build mcp-writing-servers image', error);
      return {
        success: false,
        message: 'Failed to build MCP Writing Servers image. Check logs for details.',
        error: error.message,
      };
    }

    // Start core services (postgres, mcp-connector, mcp-writing-servers)
    if (progressCallback) {
      progressCallback({
        message: 'Starting core services (PostgreSQL, MCP Connector, MCP Writing Servers)...',
        percent: 40,
        step: 'starting-core',
        status: 'starting',
      });
    }

    try {
      // Start postgres, pgbouncer, mcp-connector, and mcp-writing-servers
      // Docker Compose will handle dependencies automatically
      await execDockerCompose(coreFile, 'up', ['-d', 'postgres', 'pgbouncer', 'mcp-connector', 'mcp-writing-servers']);
      logWithCategory('info', LogCategory.DOCKER, 'Core services started');
    } catch (error: any) {
      logWithCategory('error', LogCategory.DOCKER, 'Failed to start core services', error);

      const errorMessage = error.message || '';
      const errorStderr = error.stderr || '';

      // Check if it's a port conflict
      if (errorStderr.includes('port is already allocated')) {
        const match = errorStderr.match(/port (\d+) is already allocated/);
        const port = match ? match[1] : 'unknown';
        return {
          success: false,
          message: `Port ${port} is already in use. Please change the port in environment configuration or stop the conflicting service.`,
          error: 'PORT_CONFLICT',
        };
      }

      // Check for EADDRINUSE error (port already in use inside container)
      if (errorMessage.includes('EADDRINUSE') || errorStderr.includes('EADDRINUSE')) {
        const portMatch = errorMessage.match(/EADDRINUSE.*:(\d+)/) || errorStderr.match(/EADDRINUSE.*:(\d+)/);
        const port = portMatch ? portMatch[1] : 'unknown';

        logWithCategory('error', LogCategory.DOCKER, `Port conflict detected inside container: ${port}`);

        // Try aggressive cleanup and restart with multiple retries
        let retrySuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            logWithCategory('info', LogCategory.DOCKER, `Attempting force cleanup (attempt ${attempt}/3)...`);

            // Stop all containers first
            await execDockerCompose(coreFile, 'stop', []);
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Remove all containers (without removing volumes to preserve data)
            await execDockerCompose(coreFile, 'down', ['--remove-orphans']);
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Wait progressively longer on each attempt (3s, 5s, 7s)
            const waitTime = 3000 + (attempt - 1) * 2000;
            logWithCategory('info', LogCategory.DOCKER, `Waiting ${waitTime}ms for ports to be fully released...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));

            // Retry startup
            logWithCategory('info', LogCategory.DOCKER, `Retrying container startup (attempt ${attempt}/3)...`);
            await execDockerCompose(coreFile, 'up', ['-d', 'postgres', 'pgbouncer', 'mcp-connector', 'mcp-writing-servers']);
            logWithCategory('info', LogCategory.DOCKER, `Core services started successfully after retry ${attempt}`);
            retrySuccess = true;
            break;
          } catch (retryError: any) {
            logWithCategory('error', LogCategory.DOCKER, `Retry attempt ${attempt} failed`, retryError);

            if (attempt === 3) {
              // All retries exhausted
              return {
                success: false,
                message: `Port ${port} is still in use after ${attempt} cleanup attempts. This may indicate a deeper Docker issue. Please try:\n1. Restart Docker Desktop\n2. Check for other services using port ${port}`,
                error: 'PORT_CONFLICT_PERSISTENT',
              };
            }
            // Continue to next retry attempt
          }
        }

        // If we didn't succeed after all retries, this code won't be reached
        // but keep it for safety
        if (!retrySuccess) {
          return {
            success: false,
            message: `Port ${port} conflict could not be resolved. Please restart Docker Desktop and try again.`,
            error: 'PORT_CONFLICT_PERSISTENT',
          };
        }
      } else {
        return {
          success: false,
          message: 'Failed to start core services. Check logs for details.',
          error: error.message,
        };
      }
    }

    // 2. Start Typing Mind if needed
    // All services are now in a single docker-compose.yml
    if (services.typingMind) {
      if (progressCallback) {
        progressCallback({
          message: 'Starting Typing Mind...',
          percent: 65,
          step: 'starting-typing-mind',
          status: 'starting',
        });
      }

      try {
        // Start the typingmind service from the single docker-compose.yml
        await execDockerCompose(coreFile, 'up', ['-d', 'typingmind']);
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
    const composeFile = getDockerComposeFilePath('core');

    // Stop all services from the single docker-compose.yml
    try {
      if (await fs.pathExists(composeFile)) {
        await execDockerCompose(composeFile, 'down');
        logWithCategory('info', LogCategory.DOCKER, `Stopped all services from ${path.basename(composeFile)}`);
      }
    } catch (error) {
      logWithCategory('warn', LogCategory.DOCKER, `Failed to stop services from ${path.basename(composeFile)}`, error);
      throw error; // Re-throw since this is the only compose file
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
 * Uses docker ps to get all FictionLab-related containers regardless of how they were started
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  logWithCategory('info', LogCategory.DOCKER, 'Getting system status...');

  try {
    // Use docker ps to find all FictionLab-related containers
    // This works regardless of which compose file was used to start them
    const { stdout } = await execAsync('docker ps -a --filter \"name=fictionlab-\" --filter \"name=mcp-\" --filter \"name=writing-\" --filter \"name=typing\" --format \"{{json .}}\"');

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
 * Detailed service status for monitoring
 */
export interface DetailedServiceStatus {
  serviceName: string;
  containerName: string;
  status: 'starting' | 'running' | 'healthy' | 'unhealthy' | 'stopped' | 'missing';
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
  url?: string;
  port?: number;
  message: string;
}

/**
 * Comprehensive system status with detailed service information
 */
export interface DetailedSystemStatus {
  overall: {
    running: boolean;
    healthy: boolean;
    ready: boolean;
    message: string;
  };
  services: DetailedServiceStatus[];
  timestamp: Date;
}

/**
 * Get detailed service status for real-time monitoring
 * Provides comprehensive information about each service including URLs and health
 */
export async function getDetailedServiceStatus(): Promise<DetailedSystemStatus> {
  logWithCategory('info', LogCategory.DOCKER, 'Getting detailed service status...');

  try {
    const [systemStatus, serviceUrls, config] = await Promise.all([
      getSystemStatus(),
      getServiceUrls(),
      envConfig.loadEnvConfig(),
    ]);

    const serviceDefinitions = [
      {
        serviceName: 'PostgreSQL Database',
        containerName: 'fictionlab-postgres',
        port: config.POSTGRES_PORT,
        url: serviceUrls.postgres,
      },
      {
        serviceName: 'MCP Connector',
        containerName: 'fictionlab-mcp-connector',
        port: config.MCP_CONNECTOR_PORT,
        url: serviceUrls.mcpConnector,
      },
      {
        serviceName: 'MCP Writing Servers',
        containerName: 'fictionlab-mcp-servers',
        port: 3001, // Primary port
        url: undefined, // Internal service
      },
      {
        serviceName: 'TypingMind UI',
        containerName: 'fictionlab-typingmind',
        port: config.TYPING_MIND_PORT,
        url: serviceUrls.typingMind,
      },
    ];

    const services: DetailedServiceStatus[] = serviceDefinitions.map(def => {
      const container = systemStatus.containers.find(c => c.name === def.containerName);

      if (!container) {
        return {
          serviceName: def.serviceName,
          containerName: def.containerName,
          status: 'missing',
          health: 'unknown',
          url: def.url,
          port: def.port,
          message: 'Container not found',
        };
      }

      let status: DetailedServiceStatus['status'];
      let message: string;

      if (container.health === 'healthy') {
        status = 'healthy';
        message = 'Service is healthy and ready';
      } else if (container.health === 'starting') {
        status = 'starting';
        message = 'Service is starting...';
      } else if (container.health === 'unhealthy') {
        status = 'unhealthy';
        message = 'Service is unhealthy';
      } else if (container.running) {
        status = 'running';
        message = 'Service is running';
      } else {
        status = 'stopped';
        message = 'Service is stopped';
      }

      return {
        serviceName: def.serviceName,
        containerName: def.containerName,
        status,
        health: container.health,
        url: def.url,
        port: def.port,
        message,
      };
    });

    const runningCount = services.filter(s => s.status !== 'stopped' && s.status !== 'missing').length;
    const healthyCount = services.filter(s => s.status === 'healthy' || s.status === 'running').length;
    const ready = healthyCount === services.length;

    return {
      overall: {
        running: systemStatus.running,
        healthy: systemStatus.healthy,
        ready,
        message: ready
          ? 'All services are ready'
          : `${healthyCount}/${services.length} services ready`,
      },
      services,
      timestamp: new Date(),
    };
  } catch (error: any) {
    logWithCategory('error', LogCategory.DOCKER, 'Failed to get detailed service status', error);
    return {
      overall: {
        running: false,
        healthy: false,
        ready: false,
        message: 'Failed to get status',
      },
      services: [],
      timestamp: new Date(),
    };
  }
}

/**
 * View service logs
 */
export async function viewServiceLogs(
  serviceName: 'postgres' | 'mcp-writing-servers' | 'mcp-connector' | 'typing-mind',
  tail: number = 100
): Promise<ServiceLogsResult> {
  logWithCategory('info', LogCategory.DOCKER, `Getting logs for ${serviceName}...`);

  try {
    // Map service names to actual container names (from docker-compose.yml)
    const containerNameMap: { [key: string]: string } = {
      'postgres': 'fictionlab-postgres',
      'mcp-writing-servers': 'fictionlab-mcp-servers',
      'mcp-connector': 'fictionlab-mcp-connector',
      'typing-mind': 'fictionlab-typingmind',
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
