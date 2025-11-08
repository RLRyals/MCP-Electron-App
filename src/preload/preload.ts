/**
 * Preload script
 * This script runs in a privileged context before the renderer process loads
 * It exposes a limited, secure API to the renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Prerequisite status interface
 */
interface PrerequisiteStatus {
  installed: boolean;
  running?: boolean;
  version?: string;
  error?: string;
}

/**
 * Platform information interface
 */
interface PlatformInfo {
  platform: string;
  platformName: string;
  arch: string;
  nodeVersion: string;
}

/**
 * All prerequisites check result
 */
interface AllPrerequisitesResult {
  docker: PrerequisiteStatus;
  git: PrerequisiteStatus;
  wsl?: PrerequisiteStatus;
  platform: string;
}

/**
 * System test check result
 */
interface SystemCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

/**
 * System test result
 */
interface SystemTestResult {
  passed: boolean;
  systemInfo: any;
  checks: SystemCheck[];
}

/**
 * Diagnostic report result
 */
interface DiagnosticReportResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Environment configuration interface
 */
interface EnvConfig {
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_PORT: number;
  MCP_CONNECTOR_PORT: number;
  MCP_AUTH_TOKEN: string;
  TYPING_MIND_PORT: number;
}

/**
 * Configuration validation result
 */
interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Save configuration result
 */
interface SaveConfigResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Docker status interface
 */
interface DockerStatus {
  running: boolean;
  healthy: boolean;
  message: string;
  error?: string;
}

/**
 * Docker operation result
 */
interface DockerOperationResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Docker progress update
 */
interface DockerProgress {
  message: string;
  percent: number;
  step: string;
}

/**
 * Docker container info
 */
interface DockerContainer {
  id: string;
  name: string;
  status: string;
  health?: string;
}

/**
 * Docker containers status result
 */
interface DockerContainersResult {
  success: boolean;
  containers: DockerContainer[];
  error?: string;
}

/**
 * Docker image information
 */
interface DockerImageInfo {
  name: string;
  tag: string;
  fullName: string;
  fileName: string;
  size?: number;
  exists: boolean;
}

/**
 * Docker image progress update
 */
interface DockerImageProgress {
  imageName: string;
  currentImage: number;
  totalImages: number;
  percent: number;
  bytesLoaded: number;
  totalBytes: number;
  step: 'checking' | 'extracting' | 'loading' | 'verifying' | 'complete' | 'error';
  message: string;
}

/**
 * Image loading result
 */
interface ImageLoadResult {
  success: boolean;
  imageName: string;
  message: string;
  error?: string;
}

/**
 * All images loading result
 */
interface AllImagesLoadResult {
  success: boolean;
  loaded: string[];
  skipped: string[];
  failed: string[];
  errors: string[];
}

/**
 * Image list result
 */
interface ImageListResult {
  success: boolean;
  images: Array<{
    repository: string;
    tag: string;
    imageId: string;
    size: string;
  }>;
  error?: string;
}

/**
 * Disk space check result
 */
interface DiskSpaceResult {
  available: boolean;
  freeSpace: number;
  requiredSpace: number;
  error?: string;
}

/**
 * Installation step interface
 */
interface InstallationStep {
  stepNumber: number;
  title: string;
  description: string;
  command?: string;
  requiresAdmin?: boolean;
  requiresRestart?: boolean;
  estimatedTime?: string;
}

/**
 * Installation instructions interface
 */
interface InstallationInstructions {
  platform: string;
  platformName: string;
  architecture: string;
  downloadUrl: string;
  totalSteps: number;
  steps: InstallationStep[];
  notes: string[];
  additionalInfo?: string;
}

/**
 * Client metadata interface
 */
interface ClientMetadata {
  id: string;
  name: string;
  type: 'web-based' | 'native';
  description: string;
  features: string[];
  requirements: string[];
  downloadSize: string;
  installation: 'automatic' | 'manual';
}

/**
 * Client selection interface
 */
interface ClientSelection {
  clients: string[];
  selectedAt: string;
  version?: string;
}

/**
 * Client status interface
 */
interface ClientStatus {
  id: string;
  name: string;
  selected: boolean;
  installed: boolean;
  installationDate?: string;
  version?: string;
}

/**
 * Save selection result
 */
interface SaveSelectionResult {
  success: boolean;
  error?: string;
}

/**
 * Typing Mind progress update
 */
interface TypingMindProgress {
  message: string;
  percent: number;
  step: string;
  status: 'downloading' | 'verifying' | 'complete' | 'error';
}

/**
 * Typing Mind download result
 */
interface TypingMindDownloadResult {
  success: boolean;
  message: string;
  path?: string;
  version?: string;
  error?: string;
}

/**
 * Typing Mind metadata
 */
interface TypingMindMetadata {
  installed: boolean;
  version?: string;
  installedAt?: string;
  lastUpdated?: string;
  path?: string;
  repositoryUrl?: string;
  commitHash?: string;
}

/**
 * Typing Mind update check result
 */
interface TypingMindUpdateCheck {
  hasUpdate: boolean;
  currentVersion?: string;
  latestVersion?: string;
  error?: string;
}

/**
 * MCP System progress update
 */
interface MCPSystemProgress {
  message: string;
  percent: number;
  step: string;
  status: 'starting' | 'checking' | 'ready' | 'error';
}

/**
 * MCP System operation result
 */
interface MCPSystemOperationResult {
  success: boolean;
  message: string;
  error?: string;
  urls?: ServiceUrls;
}

/**
 * Service URLs
 */
interface ServiceUrls {
  typingMind?: string;
  mcpConnector?: string;
  postgres?: string;
}

/**
 * Container health status
 */
interface ContainerHealth {
  name: string;
  status: string;
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
  running: boolean;
}

/**
 * MCP System status
 */
interface MCPSystemStatus {
  running: boolean;
  healthy: boolean;
  containers: ContainerHealth[];
  message: string;
}

/**
 * Service logs result
 */
interface ServiceLogsResult {
  success: boolean;
  logs: string;
  error?: string;
}

/**
 * Port conflict check result
 */
interface PortConflictResult {
  success: boolean;
  conflicts: number[];
}

/**
 * Expose a secure API to the renderer process
 * This API is the only way the renderer can communicate with the main process
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Send a ping to the main process and receive a pong
   */
  ping: (): Promise<string> => {
    return ipcRenderer.invoke('ping');
  },

  /**
   * Get the application version
   */
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('get-app-version');
  },

  /**
   * Get platform information
   */
  getPlatformInfo: (): Promise<{
    platform: string;
    arch: string;
    version: string;
  }> => {
    return ipcRenderer.invoke('get-platform-info');
  },

  /**
   * Prerequisites API
   */
  prerequisites: {
    /**
     * Check if Docker is installed
     */
    checkDocker: (): Promise<PrerequisiteStatus> => {
      return ipcRenderer.invoke('prerequisites:check-docker');
    },

    /**
     * Check if Docker is running
     */
    checkDockerRunning: (): Promise<PrerequisiteStatus> => {
      return ipcRenderer.invoke('prerequisites:check-docker-running');
    },

    /**
     * Get Docker version
     */
    getDockerVersion: (): Promise<PrerequisiteStatus> => {
      return ipcRenderer.invoke('prerequisites:get-docker-version');
    },

    /**
     * Check if Git is installed
     */
    checkGit: (): Promise<PrerequisiteStatus> => {
      return ipcRenderer.invoke('prerequisites:check-git');
    },

    /**
     * Check WSL status (Windows only)
     */
    checkWSL: (): Promise<PrerequisiteStatus> => {
      return ipcRenderer.invoke('prerequisites:check-wsl');
    },

    /**
     * Run all prerequisite checks
     */
    checkAll: (): Promise<AllPrerequisitesResult> => {
      return ipcRenderer.invoke('prerequisites:check-all');
    },

    /**
     * Get detailed platform information
     */
    getPlatformInfo: (): Promise<PlatformInfo> => {
      return ipcRenderer.invoke('prerequisites:get-platform-info');
    },
  },

  /**
   * Logging and diagnostics API
   */
  logger: {
    /**
     * Open the log file in default editor
     */
    openLogFile: (): Promise<void> => {
      return ipcRenderer.invoke('logger:open');
    },

    /**
     * Open the logs directory
     */
    openLogsDirectory: (): Promise<void> => {
      return ipcRenderer.invoke('logger:open-directory');
    },

    /**
     * Export diagnostic report
     */
    exportDiagnosticReport: (): Promise<DiagnosticReportResult> => {
      return ipcRenderer.invoke('logger:export');
    },

    /**
     * Run system tests
     */
    testSystem: (): Promise<SystemTestResult> => {
      return ipcRenderer.invoke('logger:test-system');
    },

    /**
     * Get recent log entries
     */
    getRecentLogs: (lines?: number): Promise<string[]> => {
      return ipcRenderer.invoke('logger:get-logs', lines);
    },

    /**
     * Generate GitHub issue template
     */
    generateIssueTemplate: (
      title: string,
      message: string,
      stack?: string
    ): Promise<string> => {
      return ipcRenderer.invoke('logger:generate-issue-template', title, message, stack);
    },

    /**
     * Open GitHub issue with pre-filled template
     */
    openGitHubIssue: (
      title: string,
      message: string,
      stack?: string
    ): Promise<void> => {
      return ipcRenderer.invoke('logger:open-github-issue', title, message, stack);
    },

    /**
     * Listen for system test results
     */
    onSystemTestResults: (callback: (results: SystemTestResult) => void): void => {
      ipcRenderer.on('system-test-results', (_, results) => callback(results));
    },
  },

  /**
   * Environment configuration API
   */
  envConfig: {
    /**
     * Get current or default environment configuration
     */
    getConfig: (): Promise<EnvConfig> => {
      return ipcRenderer.invoke('env:get-config');
    },

    /**
     * Save configuration to .env file
     */
    saveConfig: (config: EnvConfig): Promise<SaveConfigResult> => {
      return ipcRenderer.invoke('env:save-config', config);
    },

    /**
     * Generate a new secure password
     */
    generatePassword: (length?: number): Promise<string> => {
      return ipcRenderer.invoke('env:generate-password', length);
    },

    /**
     * Generate a new auth token
     */
    generateToken: (): Promise<string> => {
      return ipcRenderer.invoke('env:generate-token');
    },

    /**
     * Check if a port is available
     */
    checkPort: (port: number): Promise<boolean> => {
      return ipcRenderer.invoke('env:check-port', port);
    },

    /**
     * Reset configuration to defaults
     */
    resetDefaults: (): Promise<EnvConfig> => {
      return ipcRenderer.invoke('env:reset-defaults');
    },

    /**
     * Validate configuration
     */
    validateConfig: (config: EnvConfig): Promise<ConfigValidationResult> => {
      return ipcRenderer.invoke('env:validate-config', config);
    },

    /**
     * Calculate password strength
     */
    calculatePasswordStrength: (password: string): Promise<'weak' | 'medium' | 'strong'> => {
      return ipcRenderer.invoke('env:calculate-password-strength', password);
    },

    /**
     * Get the path where .env file will be saved
     */
    getEnvFilePath: (): Promise<string> => {
      return ipcRenderer.invoke('env:get-env-file-path');
    },
  },

  /**
   * Docker API
   */
  docker: {
    /**
     * Start Docker Desktop
     */
    start: (): Promise<DockerOperationResult> => {
      return ipcRenderer.invoke('docker:start');
    },

    /**
     * Wait for Docker to be ready
     */
    waitReady: (): Promise<DockerOperationResult> => {
      return ipcRenderer.invoke('docker:wait-ready');
    },

    /**
     * Start Docker Desktop and wait for it to be ready
     */
    startAndWait: (): Promise<DockerOperationResult> => {
      return ipcRenderer.invoke('docker:start-and-wait');
    },

    /**
     * Stop Docker Desktop
     */
    stop: (): Promise<DockerOperationResult> => {
      return ipcRenderer.invoke('docker:stop');
    },

    /**
     * Restart Docker Desktop
     */
    restart: (): Promise<DockerOperationResult> => {
      return ipcRenderer.invoke('docker:restart');
    },

    /**
     * Check Docker health status
     */
    healthCheck: (): Promise<DockerStatus> => {
      return ipcRenderer.invoke('docker:health-check');
    },

    /**
     * Get Docker containers status
     */
    getContainersStatus: (): Promise<DockerContainersResult> => {
      return ipcRenderer.invoke('docker:containers-status');
    },

    /**
     * Listen for Docker progress updates
     */
    onProgress: (callback: (progress: DockerProgress) => void): void => {
      ipcRenderer.on('docker:progress', (_, progress) => callback(progress));
    },

    /**
     * Remove Docker progress listener
     */
    removeProgressListener: (): void => {
      ipcRenderer.removeAllListeners('docker:progress');
    },
  },

  /**
   * Installation Wizard API
   */
  wizard: {
    /**
     * Get platform-specific installation instructions
     */
    getInstructions: (): Promise<InstallationInstructions> => {
      return ipcRenderer.invoke('wizard:get-instructions');
    },

    /**
     * Get the Docker download URL for current platform
     */
    getDownloadUrl: (): Promise<string> => {
      return ipcRenderer.invoke('wizard:get-download-url');
    },

    /**
     * Open the Docker download page in default browser
     */
    openDownloadPage: (): Promise<void> => {
      return ipcRenderer.invoke('wizard:open-download');
    },

    /**
     * Copy a command to the clipboard
     */
    copyCommand: (command: string): Promise<boolean> => {
      return ipcRenderer.invoke('wizard:copy-command', command);
    },

    /**
     * Get a specific installation step
     */
    getStep: (stepNumber: number): Promise<InstallationStep | null> => {
      return ipcRenderer.invoke('wizard:get-step', stepNumber);
    },

    /**
     * Get explanation of why Docker is needed
     */
    getExplanation: (): Promise<string> => {
      return ipcRenderer.invoke('wizard:get-explanation');
    },
  },

  /**
   * Client Selection API
   */
  clientSelection: {
    /**
     * Get all available client options
     */
    getOptions: (): Promise<ClientMetadata[]> => {
      return ipcRenderer.invoke('client:get-options');
    },

    /**
     * Save client selection
     */
    saveSelection: (clients: string[]): Promise<SaveSelectionResult> => {
      return ipcRenderer.invoke('client:save-selection', clients);
    },

    /**
     * Get current client selection
     */
    getSelection: (): Promise<ClientSelection | null> => {
      return ipcRenderer.invoke('client:get-selection');
    },

    /**
     * Get status of all clients
     */
    getStatus: (): Promise<ClientStatus[]> => {
      return ipcRenderer.invoke('client:get-status');
    },

    /**
     * Clear client selection
     */
    clearSelection: (): Promise<SaveSelectionResult> => {
      return ipcRenderer.invoke('client:clear-selection');
    },

    /**
     * Get a specific client by ID
     */
    getById: (clientId: string): Promise<ClientMetadata | null> => {
      return ipcRenderer.invoke('client:get-by-id', clientId);
    },

    /**
     * Get the path where client selection is saved
     */
    getSelectionFilePath: (): Promise<string> => {
      return ipcRenderer.invoke('client:get-selection-file-path');
    },
  },

  /**
   * Typing Mind Downloader API
   */
  typingMind: {
    /**
     * Download Typing Mind UI files from GitHub
     */
    download: (): Promise<TypingMindDownloadResult> => {
      return ipcRenderer.invoke('typingmind:download');
    },

    /**
     * Cancel ongoing download
     */
    cancelDownload: (): Promise<boolean> => {
      return ipcRenderer.invoke('typingmind:cancel-download');
    },

    /**
     * Check if Typing Mind is installed
     */
    isInstalled: (): Promise<boolean> => {
      return ipcRenderer.invoke('typingmind:is-installed');
    },

    /**
     * Get Typing Mind version information
     */
    getVersion: (): Promise<TypingMindMetadata> => {
      return ipcRenderer.invoke('typingmind:get-version');
    },

    /**
     * Uninstall Typing Mind
     */
    uninstall: (): Promise<TypingMindDownloadResult> => {
      return ipcRenderer.invoke('typingmind:uninstall');
    },

    /**
     * Check for Typing Mind updates
     */
    checkForUpdates: (): Promise<TypingMindUpdateCheck> => {
      return ipcRenderer.invoke('typingmind:check-updates');
    },

    /**
     * Get the installation path
     */
    getInstallPath: (): Promise<string> => {
      return ipcRenderer.invoke('typingmind:get-install-path');
    },

    /**
     * Listen for Typing Mind download progress updates
     */
    onProgress: (callback: (progress: TypingMindProgress) => void): void => {
      ipcRenderer.on('typingmind:progress', (_, progress) => callback(progress));
    },

    /**
     * Remove Typing Mind progress listener
     */
    removeProgressListener: (): void => {
      ipcRenderer.removeAllListeners('typingmind:progress');
    },
  },

  /**
   * Docker Images API
   */
  dockerImages: {
    /**
     * Load all bundled Docker images
     */
    loadAll: (): Promise<AllImagesLoadResult> => {
      return ipcRenderer.invoke('docker-images:load-all');
    },

    /**
     * Load a specific Docker image from a tar.gz file
     */
    loadImage: (imagePath: string, imageName: string): Promise<ImageLoadResult> => {
      return ipcRenderer.invoke('docker-images:load-image', imagePath, imageName);
    },

    /**
     * Check if a Docker image exists locally
     */
    checkExists: (imageName: string): Promise<boolean> => {
      return ipcRenderer.invoke('docker-images:check-exists', imageName);
    },

    /**
     * Get list of all Docker images
     */
    listImages: (): Promise<ImageListResult> => {
      return ipcRenderer.invoke('docker-images:list');
    },

    /**
     * Get information about bundled images
     */
    getBundledImages: (): Promise<DockerImageInfo[]> => {
      return ipcRenderer.invoke('docker-images:get-bundled');
    },

    /**
     * Check available disk space
     */
    checkDiskSpace: (): Promise<DiskSpaceResult> => {
      return ipcRenderer.invoke('docker-images:check-disk-space');
    },

    /**
     * Listen for image loading progress updates
     */
    onProgress: (callback: (progress: DockerImageProgress) => void): void => {
      ipcRenderer.on('docker-images:progress', (_, progress) => callback(progress));
    },

    /**
     * Remove image loading progress listener
     */
    removeProgressListener: (): void => {
      ipcRenderer.removeAllListeners('docker-images:progress');
    },
  },

  /**
   * MCP System API
   */
  mcpSystem: {
    /**
     * Start the MCP system (core services and selected clients)
     */
    start: (): Promise<MCPSystemOperationResult> => {
      return ipcRenderer.invoke('mcp-system:start');
    },

    /**
     * Stop the MCP system
     */
    stop: (): Promise<MCPSystemOperationResult> => {
      return ipcRenderer.invoke('mcp-system:stop');
    },

    /**
     * Restart the MCP system
     */
    restart: (): Promise<MCPSystemOperationResult> => {
      return ipcRenderer.invoke('mcp-system:restart');
    },

    /**
     * Get current system status
     */
    getStatus: (): Promise<MCPSystemStatus> => {
      return ipcRenderer.invoke('mcp-system:status');
    },

    /**
     * Get service URLs
     */
    getUrls: (): Promise<ServiceUrls> => {
      return ipcRenderer.invoke('mcp-system:urls');
    },

    /**
     * Get service logs
     */
    getLogs: (
      serviceName: 'postgres' | 'mcp-servers' | 'mcp-connector' | 'typing-mind',
      tail?: number
    ): Promise<ServiceLogsResult> => {
      return ipcRenderer.invoke('mcp-system:logs', serviceName, tail);
    },

    /**
     * Check for port conflicts
     */
    checkPorts: (): Promise<PortConflictResult> => {
      return ipcRenderer.invoke('mcp-system:check-ports');
    },

    /**
     * Get MCP working directory path
     */
    getWorkingDirectory: (): Promise<string> => {
      return ipcRenderer.invoke('mcp-system:working-directory');
    },

    /**
     * Listen for MCP system progress updates
     */
    onProgress: (callback: (progress: MCPSystemProgress) => void): void => {
      ipcRenderer.on('mcp-system:progress', (_, progress) => callback(progress));
    },

    /**
     * Remove MCP system progress listener
     */
    removeProgressListener: (): void => {
      ipcRenderer.removeAllListeners('mcp-system:progress');
    },
  },
});

console.log('Preload script loaded successfully');
