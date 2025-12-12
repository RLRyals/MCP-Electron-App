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
  HTTP_SSE_PORT: number;
  DB_ADMIN_PORT: number;
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
 * Port conflict details
 */
interface PortConflict {
  port: number;
  name: string;
  suggested: number;
}

/**
 * Port conflict check result with suggestions
 */
interface PortConflictCheckResult {
  hasConflicts: boolean;
  conflicts: PortConflict[];
  suggestedConfig?: EnvConfig;
}

/**
 * Database backup result
 */
interface BackupResult {
  success: boolean;
  message: string;
  path?: string;
  size?: number;
  error?: string;
}

/**
 * Database restore result
 */
interface RestoreResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Backup metadata
 */
interface BackupMetadata {
  filename: string;
  path: string;
  createdAt: string;
  size: number;
  database: string;
  compressed: boolean;
}

/**
 * List backups result
 */
interface ListBackupsResult {
  success: boolean;
  backups: BackupMetadata[];
  error?: string;
}

/**
 * Update info for a component
 */
interface UpdateInfo {
  available: boolean;
  currentVersion?: string;
  latestVersion?: string;
  currentDate?: string;
  latestDate?: string;
  commitMessage?: string;
  error?: string;
}

/**
 * Update check result
 */
interface UpdateCheckResult {
  hasUpdates: boolean;
  mcpServers: UpdateInfo;
  typingMind: UpdateInfo;
  checkedAt: string;
}

/**
 * Update result
 */
interface UpdateResult {
  success: boolean;
  message: string;
  error?: string;
  rollback?: boolean;
}

/**
 * Update preferences
 */
interface UpdatePreferences {
  autoCheck: boolean;
  checkInterval: number;
  lastChecked?: string;
  notifyOnlyIfUpdatesAvailable: boolean;
  skippedVersions?: {
    mcpServers?: string;
    typingMind?: string;
  };
}

/**
 * Update progress
 */
interface UpdateProgress {
  message: string;
  percent: number;
  step: string;
  status: 'checking' | 'downloading' | 'updating' | 'complete' | 'error';
}

/**
 * Wizard step enum
 */
enum WizardStep {
  WELCOME = 1,
  PREREQUISITES = 2,
  ENVIRONMENT = 3,
  CLIENT_SELECTION = 4,
  DOWNLOAD_SETUP = 5,
  SYSTEM_STARTUP = 6,
  COMPLETE = 7
}

/**
 * Wizard step data
 */
interface WizardStepData {
  prerequisites?: {
    docker: boolean;
    git: boolean;
    wsl?: boolean;
  };
  environment?: {
    saved: boolean;
    configPath?: string;
  };
  clients?: string[];
  downloads?: {
    typingMindCompleted: boolean;
    dockerImagesCompleted: boolean;
  };
  systemStartup?: {
    started: boolean;
    healthy: boolean;
  };
}

/**
 * Migration record
 */
interface MigrationRecord {
  version: string;
  appliedAt: string;  // ISO timestamp
  stepsRerun: WizardStep[];
  success: boolean;
}

/**
 * Wizard state
 */
interface WizardState {
  completed: boolean;
  currentStep: WizardStep;
  stepsCompleted: WizardStep[];
  data: WizardStepData;
  startedAt?: string;
  completedAt?: string;
  version?: string;
  installationVersion?: string;     // Version when wizard was completed
  lastMigrationVersion?: string;    // Last migration that was applied
  migrationHistory?: MigrationRecord[];  // History of applied migrations
}

/**
 * Wizard operation result
 */
interface WizardOperationResult {
  success: boolean;
  error?: string;
  nextStep?: WizardStep;
}

/**
 * Can proceed result
 */
interface CanProceedResult {
  canProceed: boolean;
  reason?: string;
}

/**
 * Migration definition interface
 */
interface Migration {
  version: string;
  description: string;
  steps: WizardStep[];
  skipIfFresh?: boolean;
  critical?: boolean;
  fromVersion?: string;
}

/**
 * Migration result interface
 */
interface MigrationResult {
  version: string;
  success: boolean;
  appliedAt: string;
  stepsRerun: WizardStep[];
  error?: string;
}

/**
 * Pending migrations status
 */
interface PendingMigrationsStatus {
  hasPending: boolean;
  migrations: Migration[];
  criticalCount: number;
  optionalCount: number;
}

/**
 * Migration validation result
 */
interface MigrationValidationResult {
  valid: boolean;
  errors: string[];
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
     * Check all ports for conflicts and suggest alternatives
     */
    checkAllPorts: (config: EnvConfig): Promise<PortConflictCheckResult> => {
      return ipcRenderer.invoke('env:check-all-ports', config);
    },

    /**
     * Find next available port
     */
    findNextAvailablePort: (startPort: number): Promise<number | null> => {
      return ipcRenderer.invoke('env:find-next-available-port', startPort);
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

    /**
     * Check if .env file exists on disk
     */
    fileExists: (): Promise<boolean> => {
      return ipcRenderer.invoke('env:file-exists');
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
     * Add a custom client
     */
    addCustomClient: (client: ClientMetadata): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('client:add-custom', client);
    },

    /**
     * Remove a custom client
     */
    removeCustomClient: (clientId: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('client:remove-custom', clientId);
    },

    /**
     * Update client configuration
     */
    updateClientConfig: (clientId: string, updates: Partial<ClientMetadata>): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('client:update-config', clientId, updates);
    },

    /**
     * Get the path where client selection is saved
     */
    getSelectionFilePath: (): Promise<string> => {
      return ipcRenderer.invoke('client:get-selection-file-path');
    },

    /**
     * Launch an electron app client
     */
    launchElectronApp: (clientId: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('client:launch-electron-app', clientId);
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
     * Auto-configure Typing Mind with MCP Connector settings
     */
    autoConfigure: (): Promise<any> => {
      return ipcRenderer.invoke('typingmind:auto-configure');
    },

    /**
     * Set custom Typing Mind configuration
     */
    setCustomConfig: (serverUrl: string, authToken: string): Promise<any> => {
      return ipcRenderer.invoke('typingmind:set-custom-config', serverUrl, authToken);
    },

    /**
     * Get current Typing Mind configuration
     */
    getConfig: (): Promise<any> => {
      return ipcRenderer.invoke('typingmind:get-config');
    },

    /**
     * Get configuration instructions for manual setup
     */
    getConfigInstructions: (): Promise<string> => {
      return ipcRenderer.invoke('typingmind:get-config-instructions');
    },

    /**
     * Check if Typing Mind is configured
     */
    isConfigured: (): Promise<boolean> => {
      return ipcRenderer.invoke('typingmind:is-configured');
    },

    /**
     * Reset Typing Mind configuration
     */
    resetConfig: (): Promise<any> => {
      return ipcRenderer.invoke('typingmind:reset-config');
    },

    /**
     * Get MCP servers configuration as JSON string
     */
    getMCPServersJSON: (): Promise<string> => {
      return ipcRenderer.invoke('typingmind:get-mcp-servers-json');
    },

    /**
     * Open Typing Mind in a dedicated Electron window
     */
    openWindow: (url: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('typingmind:open-window', url);
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
   * Claude Desktop API
   */
  claudeDesktop: {
    /**
     * Auto-configure Claude Desktop with MCP server settings
     */
    autoConfigure: (): Promise<any> => {
      return ipcRenderer.invoke('claude-desktop:auto-configure');
    },

    /**
     * Check if Claude Desktop is configured
     */
    isConfigured: (): Promise<boolean> => {
      return ipcRenderer.invoke('claude-desktop:is-configured');
    },

    /**
     * Get current Claude Desktop configuration
     */
    getConfig: (): Promise<any> => {
      return ipcRenderer.invoke('claude-desktop:get-config');
    },

    /**
     * Reset Claude Desktop configuration
     */
    resetConfig: (): Promise<any> => {
      return ipcRenderer.invoke('claude-desktop:reset-config');
    },

    /**
     * Get the path where Claude Desktop config is stored
     */
    getConfigPath: (): Promise<string> => {
      return ipcRenderer.invoke('claude-desktop:get-config-path');
    },

    /**
     * Open Claude Desktop config folder in file explorer
     */
    openConfigFolder: (): Promise<void> => {
      return ipcRenderer.invoke('claude-desktop:open-config-folder');
    },

    /**
     * Get configuration instructions for manual setup
     */
    getConfigInstructions: (): Promise<string> => {
      return ipcRenderer.invoke('claude-desktop:get-config-instructions');
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
     * Get detailed service status for monitoring
     */
    getDetailedStatus: (): Promise<any> => {
      return ipcRenderer.invoke('mcp-system:detailed-status');
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
      serviceName: 'postgres' | 'mcp-writing-servers' | 'mcp-connector' | 'typing-mind',
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

  /**
   * Database Administration API (MCP Tools)
   */
  databaseAdmin: {
    /**
     * Check connection to database admin server
     */
    checkConnection: (): Promise<any> => {
      return ipcRenderer.invoke('database-admin:check-connection');
    },

    /**
     * Get database server info
     */
    getServerInfo: (): Promise<any> => {
      return ipcRenderer.invoke('database-admin:get-server-info');
    },

    /**
     * Query records from a table
     */
    queryRecords: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:query-records', params);
    },

    /**
     * Insert a record into a table
     */
    insertRecord: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:insert-record', params);
    },

    /**
     * Update records in a table
     */
    updateRecords: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:update-records', params);
    },

    /**
     * Delete records from a table
     */
    deleteRecords: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:delete-records', params);
    },

    /**
     * Batch insert multiple records
     */
    batchInsert: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:batch-insert', params);
    },

    /**
     * Batch update multiple records
     */
    batchUpdate: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:batch-update', params);
    },

    /**
     * Batch delete multiple sets of records
     */
    batchDelete: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:batch-delete', params);
    },

    /**
     * Get schema information for a table
     */
    getSchema: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:get-schema', params);
    },

    /**
     * List all available tables
     */
    listTables: (): Promise<any> => {
      return ipcRenderer.invoke('database-admin:list-tables');
    },

    /**
     * Get table relationships
     */
    getRelationships: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:get-relationships', params);
    },

    /**
     * List columns for a table
     */
    listColumns: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:list-columns', params);
    },

    /**
     * Query audit logs
     */
    queryAuditLogs: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:query-audit-logs', params);
    },

    /**
     * Get audit summary
     */
    getAuditSummary: (params: any): Promise<any> => {
      return ipcRenderer.invoke('database-admin:get-audit-summary', params);
    },
  },

  /**
   * Database Backup/Restore API
   */
  databaseBackup: {
    /**
     * Create a database backup
     */
    create: (customPath?: string, compressed?: boolean): Promise<BackupResult> => {
      return ipcRenderer.invoke('database-backup:create', customPath, compressed);
    },

    /**
     * Restore database from a backup file
     */
    restore: (backupPath: string, dropExisting?: boolean): Promise<RestoreResult> => {
      return ipcRenderer.invoke('database-backup:restore', backupPath, dropExisting);
    },

    /**
     * List all available backups
     */
    list: (): Promise<ListBackupsResult> => {
      return ipcRenderer.invoke('database-backup:list');
    },

    /**
     * Delete a backup file
     */
    delete: (backupPath: string): Promise<BackupResult> => {
      return ipcRenderer.invoke('database-backup:delete', backupPath);
    },

    /**
     * Show file picker to select backup save location
     */
    selectSaveLocation: (): Promise<string | null> => {
      return ipcRenderer.invoke('database-backup:select-save-location');
    },

    /**
     * Show file picker to select backup file for restore
     */
    selectRestoreFile: (): Promise<string | null> => {
      return ipcRenderer.invoke('database-backup:select-restore-file');
    },

    /**
     * Get backup directory path
     */
    getDirectory: (): Promise<string> => {
      return ipcRenderer.invoke('database-backup:get-directory');
    },

    /**
     * Open backup directory in file explorer
     */
    openDirectory: (): Promise<void> => {
      return ipcRenderer.invoke('database-backup:open-directory');
    },
  },

  /**
   * Updater API
   */
  updater: {
    /**
     * Check for all updates
     */
    checkAll: (): Promise<UpdateCheckResult> => {
      return ipcRenderer.invoke('updater:check-all');
    },

    /**
     * Check for MCP servers updates
     */
    checkMCPServers: (): Promise<UpdateInfo> => {
      return ipcRenderer.invoke('updater:check-mcp-servers');
    },

    /**
     * Check for Typing Mind updates
     */
    checkTypingMind: (): Promise<UpdateInfo> => {
      return ipcRenderer.invoke('updater:check-typing-mind');
    },

    /**
     * Update all components
     */
    updateAll: (): Promise<UpdateResult> => {
      return ipcRenderer.invoke('updater:update-all');
    },

    /**
     * Update MCP servers
     */
    updateMCPServers: (): Promise<UpdateResult> => {
      return ipcRenderer.invoke('updater:update-mcp-servers');
    },

    /**
     * Update Typing Mind
     */
    updateTypingMind: (): Promise<UpdateResult> => {
      return ipcRenderer.invoke('updater:update-typing-mind');
    },

    /**
     * Get update preferences
     */
    getPreferences: (): Promise<UpdatePreferences> => {
      return ipcRenderer.invoke('updater:get-preferences');
    },

    /**
     * Set update preferences
     */
    setPreferences: (prefs: UpdatePreferences): Promise<void> => {
      return ipcRenderer.invoke('updater:set-preferences', prefs);
    },

    /**
     * Listen for update progress
     */
    onProgress: (callback: (progress: UpdateProgress) => void): void => {
      ipcRenderer.on('updater:progress', (_, progress) => callback(progress));
    },

    /**
     * Remove update progress listener
     */
    removeProgressListener: (): void => {
      ipcRenderer.removeAllListeners('updater:progress');
    },

    /**
     * Listen for update check complete (from menu)
     */
    onCheckComplete: (callback: (result: UpdateCheckResult) => void): void => {
      ipcRenderer.on('updater:check-complete', (_, result) => callback(result));
    },

    /**
     * Listen for auto-check complete on startup
     */
    onAutoCheckComplete: (callback: (result: UpdateCheckResult) => void): void => {
      ipcRenderer.on('updater:auto-check-complete', (_, result) => callback(result));
    },

    /**
     * Remove check complete listeners
     */
    removeCheckListeners: (): void => {
      ipcRenderer.removeAllListeners('updater:check-complete');
      ipcRenderer.removeAllListeners('updater:auto-check-complete');
    },
  },

  /**
   * Repository Manager API
   */
  repository: {
    /**
     * Clone a Git repository with progress tracking
     */
    clone: (url: string, targetPath: string, options?: any): Promise<any> => {
      return ipcRenderer.invoke('repository:clone', { url, targetPath, options });
    },

    /**
     * Checkout a specific version (branch, tag, or commit)
     */
    checkoutVersion: (repoPath: string, version: string): Promise<any> => {
      return ipcRenderer.invoke('repository:checkout-version', { repoPath, version });
    },

    /**
     * Get repository status
     */
    getStatus: (repoPath: string): Promise<any> => {
      return ipcRenderer.invoke('repository:get-status', { repoPath });
    },

    /**
     * Get current branch name
     */
    getCurrentBranch: (repoPath: string): Promise<any> => {
      return ipcRenderer.invoke('repository:get-current-branch', { repoPath });
    },

    /**
     * List all branches in repository
     */
    listBranches: (repoPath: string): Promise<any> => {
      return ipcRenderer.invoke('repository:list-branches', { repoPath });
    },

    /**
     * Get latest commit information
     */
    getLatestCommit: (repoPath: string, ref?: string): Promise<any> => {
      return ipcRenderer.invoke('repository:get-latest-commit', { repoPath, ref });
    },

    /**
     * Cancel ongoing repository operation
     */
    cancel: (): Promise<any> => {
      return ipcRenderer.invoke('repository:cancel');
    },

    /**
     * Listen for repository progress updates
     */
    onProgress: (callback: (progress: any) => void): void => {
      ipcRenderer.on('repository:progress', (_, progress) => callback(progress));
    },

    /**
     * Remove repository progress listener
     */
    removeProgressListener: (): void => {
      ipcRenderer.removeAllListeners('repository:progress');
    },
  },

  /**
   * Build Orchestrator API
   */
  build: {
    /**
     * Execute npm install
     */
    npmInstall: (repoPath: string, options?: any): Promise<any> => {
      return ipcRenderer.invoke('build:npm-install', { repoPath, options });
    },

    /**
     * Execute npm build
     */
    npmBuild: (repoPath: string, buildScript?: string, options?: any): Promise<any> => {
      return ipcRenderer.invoke('build:npm-build', { repoPath, buildScript, options });
    },

    /**
     * Execute docker build
     */
    dockerBuild: (dockerfile: string, imageName: string, options?: any): Promise<any> => {
      return ipcRenderer.invoke('build:docker-build', { dockerfile, imageName, options });
    },

    /**
     * Execute build chain
     */
    executeChain: (steps: any[], config?: any): Promise<any> => {
      return ipcRenderer.invoke('build:execute-chain', { steps, config });
    },

    /**
     * Execute custom script
     */
    executeCustomScript: (command: string, options?: any): Promise<any> => {
      return ipcRenderer.invoke('build:execute-custom-script', { command, options });
    },

    /**
     * Cancel ongoing build operation
     */
    cancel: (): Promise<any> => {
      return ipcRenderer.invoke('build:cancel');
    },

    /**
     * Listen for build progress updates
     */
    onProgress: (callback: (progress: any) => void): void => {
      ipcRenderer.on('build:progress', (_, progress) => callback(progress));
    },

    /**
     * Remove build progress listener
     */
    removeProgressListener: (): void => {
      ipcRenderer.removeAllListeners('build:progress');
    },
  },

  /**
   * Setup Wizard API
   */
  setupWizard: {
    /**
     * Check if this is the first run
     */
    isFirstRun: (): Promise<boolean> => {
      return ipcRenderer.invoke('setup-wizard:is-first-run');
    },

    /**
     * Get the current wizard state
     */
    getState: (): Promise<WizardState> => {
      return ipcRenderer.invoke('setup-wizard:get-state');
    },

    /**
     * Save wizard state
     */
    saveState: (step: WizardStep, data?: Partial<WizardStepData>): Promise<WizardOperationResult> => {
      return ipcRenderer.invoke('setup-wizard:save-state', step, data);
    },

    /**
     * Complete a step and move to the next
     */
    completeStep: (step: WizardStep, data?: Partial<WizardStepData>): Promise<WizardOperationResult> => {
      return ipcRenderer.invoke('setup-wizard:complete-step', step, data);
    },

    /**
     * Navigate to a specific step
     */
    goToStep: (step: WizardStep): Promise<WizardOperationResult> => {
      return ipcRenderer.invoke('setup-wizard:go-to-step', step);
    },

    /**
     * Mark the wizard as complete
     */
    markComplete: (): Promise<WizardOperationResult> => {
      return ipcRenderer.invoke('setup-wizard:mark-complete');
    },

    /**
     * Reset the wizard (start over)
     */
    reset: (): Promise<WizardOperationResult> => {
      return ipcRenderer.invoke('setup-wizard:reset');
    },

    /**
     * Get wizard progress percentage (0-100)
     */
    getProgress: (): Promise<number> => {
      return ipcRenderer.invoke('setup-wizard:get-progress');
    },

    /**
     * Check if a specific step is completed
     */
    isStepCompleted: (step: WizardStep): Promise<boolean> => {
      return ipcRenderer.invoke('setup-wizard:is-step-completed', step);
    },

    /**
     * Get step name for display
     */
    getStepName: (step: WizardStep): Promise<string> => {
      return ipcRenderer.invoke('setup-wizard:get-step-name', step);
    },

    /**
     * Get step description for display
     */
    getStepDescription: (step: WizardStep): Promise<string> => {
      return ipcRenderer.invoke('setup-wizard:get-step-description', step);
    },

    /**
     * Check if can proceed to next step
     */
    canProceed: (step: WizardStep): Promise<CanProceedResult> => {
      return ipcRenderer.invoke('setup-wizard:can-proceed', step);
    },

    /**
     * Get the installation version from wizard state
     */
    getInstallationVersion: (): Promise<string | null> => {
      return ipcRenderer.invoke('setup-wizard:get-installation-version');
    },

    /**
     * Check if installation version is outdated
     */
    isInstallationOutdated: (): Promise<boolean> => {
      return ipcRenderer.invoke('setup-wizard:is-installation-outdated');
    },

    /**
     * Get migration history from wizard state
     */
    getMigrationHistory: (): Promise<MigrationRecord[]> => {
      return ipcRenderer.invoke('setup-wizard:get-migration-history');
    },

    /**
     * Add a migration record to the migration history
     */
    addMigrationRecord: (record: MigrationRecord): Promise<WizardOperationResult> => {
      return ipcRenderer.invoke('setup-wizard:add-migration-record', record);
    },

    /**
     * Wizard step enum for use in renderer
     */
    WizardStep: {
      WELCOME: 1,
      PREREQUISITES: 2,
      ENVIRONMENT: 3,
      CLIENT_SELECTION: 4,
      DOWNLOAD_SETUP: 5,
      SYSTEM_STARTUP: 6,
      COMPLETE: 7
    }
  },

  /**
   * Migrations API
   */
  migrations: {
    /**
     * Check for pending migrations at startup
     */
    checkPending: (): Promise<PendingMigrationsStatus> => {
      return ipcRenderer.invoke('migrations:check-pending');
    },

    /**
     * Run migrations
     */
    run: (migrations: Migration[]): Promise<MigrationResult[]> => {
      return ipcRenderer.invoke('migrations:run', migrations);
    },

    /**
     * Get all registered migrations
     */
    getAll: (): Promise<Migration[]> => {
      return ipcRenderer.invoke('migrations:get-all');
    },

    /**
     * Get migrations for upgrade between two versions
     */
    getForUpgrade: (fromVersion: string, toVersion: string): Promise<Migration[]> => {
      return ipcRenderer.invoke('migrations:get-for-upgrade', fromVersion, toVersion);
    },

    /**
     * Get steps to rerun for pending migrations
     */
    getStepsToRerun: (pendingMigrations: Migration[]): Promise<WizardStep[]> => {
      return ipcRenderer.invoke('migrations:get-steps-to-rerun', pendingMigrations);
    },

    /**
     * Validate migration registry
     */
    validate: (): Promise<MigrationValidationResult> => {
      return ipcRenderer.invoke('migrations:validate');
    },

    /**
     * Mark migration wizard as complete and transition to main app
     */
    complete: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('migrations:complete');
    },
  },

  /**
   * Close the current window
   */
  closeWindow: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('closeWindow');
  },

  /**
   * Build Pipeline API
   */
  pipeline: {
    /**
     * Execute the build pipeline
     */
    execute: (configPath: string, options?: any): Promise<any> => {
      return ipcRenderer.invoke('pipeline:execute', { configPath, options });
    },

    /**
     * Cancel ongoing pipeline operation
     */
    cancel: (): Promise<any> => {
      return ipcRenderer.invoke('pipeline:cancel');
    },

    /**
     * Get current pipeline status
     */
    getStatus: (): Promise<any> => {
      return ipcRenderer.invoke('pipeline:get-status');
    },

    /**
     * Listen for pipeline progress updates
     */
    onProgress: (callback: (progress: any) => void): void => {
      ipcRenderer.on('pipeline:progress', (_event, progress) => callback(progress));
    },

    /**
     * Remove pipeline progress listener
     */
    removeProgressListener: (): void => {
      ipcRenderer.removeAllListeners('pipeline:progress');
    },
  },

  /**
   * Plugin system API
   */
  plugins: {
    /**
     * Get plugin view URL for embedding (NEW)
     * Returns the URL and metadata for loading a plugin view in the main window
     */
    getViewUrl: (pluginId: string, viewName: string): Promise<{ pluginId: string; viewName: string; url: string; metadata: any }> => {
      return ipcRenderer.invoke('plugin:get-view-url', pluginId, viewName);
    },

    /**
     * List all plugins
     */
    list: (): Promise<any[]> => {
      return ipcRenderer.invoke('plugin:list');
    },

    /**
     * Show a plugin view (DEPRECATED - kept for compatibility)
     * @deprecated Use ViewRouter navigation instead
     */
    showView: (pluginId: string, viewName: string): Promise<void> => {
      console.warn('[DEPRECATED] plugins.showView - use ViewRouter.navigateTo instead');
      return ipcRenderer.invoke('plugin:show-view', pluginId, viewName);
    },

    /**
     * Hide a plugin view (DEPRECATED - kept for compatibility)
     * @deprecated Use ViewRouter navigation instead
     */
    hideView: (pluginId: string, viewName: string): Promise<void> => {
      console.warn('[DEPRECATED] plugins.hideView - use ViewRouter.back() instead');
      return ipcRenderer.invoke('plugin:hide-view', pluginId, viewName);
    },

    /**
     * Close a plugin view (DEPRECATED - kept for compatibility)
     * @deprecated Use ViewRouter navigation instead
     */
    closeView: (pluginId: string, viewName: string): Promise<void> => {
      console.warn('[DEPRECATED] plugins.closeView - use ViewRouter navigation instead');
      return ipcRenderer.invoke('plugin:close-view', pluginId, viewName);
    },

    /**
     * Listen for plugin action events
     */
    onAction: (callback: (data: { pluginId: string; action: string }) => void): void => {
      ipcRenderer.on('plugin-action', (_event, data) => callback(data));
    },

    /**
     * Remove plugin action listener
     */
    removeActionListener: (): void => {
      ipcRenderer.removeAllListeners('plugin-action');
    },
  },

  /**
   * Workflows API
   */
  workflows: {
    /**
     * List all workflows
     */
    list: (): Promise<any[]> => {
      return ipcRenderer.invoke('workflows:list');
    },

    /**
     * Get a specific workflow by ID
     */
    get: (workflowId: string): Promise<any> => {
      return ipcRenderer.invoke('workflows:get', workflowId);
    },

    /**
     * Execute a workflow
     */
    execute: (workflowId: string, initialContext?: any): Promise<any> => {
      return ipcRenderer.invoke('workflows:execute', workflowId, initialContext);
    },

    /**
     * Cancel a running workflow
     */
    cancel: (runId: string): Promise<any> => {
      return ipcRenderer.invoke('workflows:cancel', runId);
    },

    /**
     * Get workflow execution history
     */
    getRuns: (workflowId: string, limit?: number): Promise<any[]> => {
      return ipcRenderer.invoke('workflows:get-runs', workflowId, limit);
    },

    /**
     * Delete a workflow
     */
    delete: (workflowId: string): Promise<any> => {
      return ipcRenderer.invoke('workflows:delete', workflowId);
    },

    /**
     * Create a new workflow
     */
    create: (workflow: any): Promise<any> => {
      return ipcRenderer.invoke('workflows:create', workflow);
    },

    /**
     * Update an existing workflow
     */
    update: (workflowId: string, updates: any): Promise<any> => {
      return ipcRenderer.invoke('workflows:update', workflowId, updates);
    },
  },

  /**
   * Window controls API (for frameless window on Windows)
   */
  window: {
    /**
     * Minimize the window
     */
    minimize: (): Promise<void> => {
      return ipcRenderer.invoke('window:minimize');
    },

    /**
     * Maximize/restore the window
     */
    maximize: (): Promise<void> => {
      return ipcRenderer.invoke('window:maximize');
    },

    /**
     * Close the window
     */
    close: (): Promise<void> => {
      return ipcRenderer.invoke('window:close');
    },
  },
});

console.log('Preload script loaded successfully');
