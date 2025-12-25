import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as prerequisites from './prerequisites';
import logger, { initializeLogger, getRecentLogs, LogCategory, logWithCategory } from './logger';
import {
  openLogFile,
  openLogsDirectory,
  exportDiagnosticReport,
  testSystem,
  generateGitHubIssueTemplate,
  openGitHubIssue,
} from './diagnostics';
import * as docker from './docker';
import * as dockerImages from './docker-images';
import * as envConfig from './env-config';
import * as installationWizard from './installation-wizard';
import * as clientSelection from './client-selection';
import * as typingMindDownloader from './typingmind-downloader';
import * as typingMindAutoConfig from './typingmind-auto-config';
import * as mcpSystem from './mcp-system';
import * as databaseBackup from './database-backup';
import * as databaseAdmin from './database-admin';
import * as updater from './updater';
import * as setupWizard from './setup-wizard';
import * as migrations from './migrations';
import { repositoryManager } from './repository-manager';
import { createBuildOrchestrator } from './build-orchestrator';
import { createBuildPipelineOrchestrator, resolveConfigPath } from './build-pipeline-orchestrator';
import { ProgressThrottler, IPC_CHANNELS } from '../types/ipc';
import { pluginManager } from './plugin-manager';
import { pluginViewManager } from './plugin-views';
import { initializeDatabasePool, getDatabasePool, closeDatabasePool } from './database-connection';
import { WorkflowExecutor } from './workflow/workflow-executor';
import { ClaudeCodeExecutor } from './workflow/claude-code-executor';
import { PersistentMCPClient } from './workflow/persistent-mcp-client';
import { workflowCache } from './workflow/workflow-cache';
import { ContextManager } from './workflow/context-manager';
import { getProviderManager } from './llm/provider-manager';
import type { LLMProviderConfig } from '../types/llm-providers';
import { PTYManager } from './pty-manager';
import type {
  RepositoryCloneRequest,
  RepositoryCloneResponse,
  RepositoryCheckoutRequest,
  RepositoryCheckoutResponse,
  RepositoryStatusRequest,
  RepositoryStatusResponse,
  RepositoryBranchRequest,
  RepositoryBranchResponse,
  RepositoryCommitRequest,
  RepositoryCommitResponse,
  RepositoryCancelResponse,
  BuildNpmInstallRequest,
  BuildNpmInstallResponse,
  BuildNpmBuildRequest,
  BuildNpmBuildResponse,
  BuildDockerBuildRequest,
  BuildDockerBuildResponse,
  BuildExecuteChainRequest,
  BuildExecuteChainResponse,
  BuildExecuteCustomScriptRequest,
  BuildExecuteCustomScriptResponse,
  BuildCancelResponse,
  PipelineExecuteRequest,
  PipelineExecuteResponse,
  PipelineCancelResponse,
  PipelineStatusResponse,
} from '../types/ipc';

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

// Singleton persistent MCP client for workflow operations
let persistentMCPClient: PersistentMCPClient | null = null;

/**
 * Get the correct icon path for the current platform and packaging state
 */
function getIconPath(): string {
  const iconFileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  
  if (app.isPackaged) {
    // In packaged apps, resources are in process.resourcesPath
    return path.join(process.resourcesPath, 'resources', iconFileName);
  } else {
    // In development, use relative path from compiled JS location
    return path.join(__dirname, '../resources', iconFileName);
  }
}

/**
 * Create the application menu
 */
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Diagnostics',
      submenu: [
        {
          label: 'View Logs',
          click: async () => {
            try {
              await openLogFile();
            } catch (error) {
              logger.error('Error opening log file:', error);
            }
          },
        },
        {
          label: 'Open Logs Directory',
          click: async () => {
            try {
              await openLogsDirectory();
            } catch (error) {
              logger.error('Error opening logs directory:', error);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Export Diagnostic Report',
          click: async () => {
            try {
              const result = await exportDiagnosticReport();
              if (result.success) {
                logger.info('Diagnostic report exported successfully');
              } else {
                logger.error('Failed to export diagnostic report:', result.error);
              }
            } catch (error) {
              logger.error('Error exporting diagnostic report:', error);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Test System',
          click: async () => {
            try {
              const results = await testSystem();
              logger.info('System test completed', results);
              // Send results to renderer if window exists
              if (mainWindow) {
                mainWindow.webContents.send('system-test-results', results);
              }
            } catch (error) {
              logger.error('Error running system tests:', error);
            }
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'User Guide',
          click: async () => {
            await shell.openExternal('https://github.com/RLRyals/MCP-Electron-App/blob/main/docs/USER-GUIDE.md');
          },
        },
        {
          label: 'Quick Start',
          click: async () => {
            await shell.openExternal('https://github.com/RLRyals/MCP-Electron-App/blob/main/docs/QUICK-START.md');
          },
        },
        {
          label: 'Troubleshooting',
          click: async () => {
            await shell.openExternal('https://github.com/RLRyals/MCP-Electron-App/blob/main/docs/TROUBLESHOOTING.md');
          },
        },
        {
          label: 'FAQ',
          click: async () => {
            await shell.openExternal('https://github.com/RLRyals/MCP-Electron-App/blob/main/docs/FAQ.md');
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: async () => {
            try {
              const updates = await updater.checkForAllUpdates();
              logger.info('Update check completed', updates);
              // Send results to renderer if window exists
              if (mainWindow) {
                mainWindow.webContents.send('updater:check-complete', updates);
              }
            } catch (error) {
              logger.error('Error checking for updates:', error);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: async () => {
            try {
              await openGitHubIssue('General Issue', 'Please describe the issue');
            } catch (error) {
              logger.error('Error opening GitHub issue:', error);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'About FictionLab',
          click: () => {
            const aboutMessage = `FictionLab v${app.getVersion()}\n\nYour AI-powered writing laboratory - a professional workspace for authors.\n\nCopyright © 2025 FictionLab\nLicense: MIT`;
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About FictionLab',
              message: 'FictionLab',
              detail: aboutMessage,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Create the setup wizard window
 */
function createWizardWindow(): void {
  logger.info('Creating setup wizard window...');

  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: iconPath,
    title: 'MCP Writing System - Setup Wizard',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false, // Don't show until ready
  });

  // Load the setup wizard HTML file
  const wizardPath = path.join(__dirname, '../renderer/setup-wizard.html');
  mainWindow.loadFile(wizardPath);

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    logger.info('Wizard window ready to show');
    mainWindow?.show();
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Setup wizard window created');
}

/**
 * Create the migration wizard window
 */
function createMigrationWizardWindow(): void {
  logger.info('Creating migration wizard window...');

  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    title: 'MCP Writing System - Migration Wizard',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false, // Don't show until ready
  });

  // Load the migration wizard HTML file
  const migrationWizardPath = path.join(__dirname, '../renderer/migration-wizard.html');
  mainWindow.loadFile(migrationWizardPath);

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    logger.info('Migration wizard window ready to show');
    mainWindow?.show();
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Migration wizard window created');
}

/**
 * Create the main application window
 */
function createWindow(): void {
  logger.info('Creating main window...');

  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'FictionLab',
    icon: iconPath,
    frame: process.platform !== 'win32', // Frameless on Windows, native frame on Mac/Linux
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default', // Native macOS style
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false, // Don't show until ready
  });

  // Load the index.html file
  const indexPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(indexPath);

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    logger.info('Window ready to show');
    mainWindow?.show();
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set main window for plugin view manager
  pluginViewManager.setMainWindow(mainWindow);

  logger.info('Main window created');
}

/**
 * Create the Typing Mind window
 */
function openTypingMindInBrowser(url: string): void {
  logger.info(`Opening Typing Mind in default browser: ${url}`);

  // Open in default browser
  shell.openExternal(url).catch((error) => {
    logger.error('Failed to open Typing Mind in browser', error);
  });
}

import { registerImportHandlers } from './handlers/import-handlers';
import { registerBundledPluginsHandlers } from './handlers/bundled-plugins-handlers';

/**
 * Set up IPC handlers for communication between main and renderer processes
 */
function setupIPC(): void {
  // Register import handlers
  registerImportHandlers();

  // Register bundled plugins handlers
  registerBundledPluginsHandlers();

  // Example IPC handler - ping/pong
  ipcMain.handle('ping', async () => {

    logger.info('Received ping from renderer');
    return 'pong';
  });

  // Get app version
  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });

  // Get platform info
  ipcMain.handle('get-platform-info', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
    };
  });

  // Window controls (for frameless window on Windows)
  ipcMain.handle('window:minimize', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.restore();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  // Prerequisites checks
  ipcMain.handle('prerequisites:check-docker', async () => {
    logWithCategory('info', LogCategory.PREREQUISITES, 'Checking Docker installation...');
    return await prerequisites.checkDockerInstalled();
  });

  ipcMain.handle('prerequisites:check-docker-running', async () => {
    logWithCategory('info', LogCategory.PREREQUISITES, 'Checking if Docker is running...');
    return await prerequisites.checkDockerRunning();
  });

  ipcMain.handle('prerequisites:get-docker-version', async () => {
    logWithCategory('info', LogCategory.PREREQUISITES, 'Getting Docker version...');
    return await prerequisites.getDockerVersion();
  });

  ipcMain.handle('prerequisites:check-git', async () => {
    logWithCategory('info', LogCategory.PREREQUISITES, 'Checking Git installation...');
    return await prerequisites.checkGit();
  });

  ipcMain.handle('prerequisites:check-wsl', async () => {
    logWithCategory('info', LogCategory.PREREQUISITES, 'Checking WSL status...');
    return await prerequisites.checkWSL();
  });

  ipcMain.handle('prerequisites:check-all', async () => {
    logWithCategory('info', LogCategory.PREREQUISITES, 'Running all prerequisite checks...');
    return await prerequisites.checkAll();
  });

  ipcMain.handle('prerequisites:get-platform-info', async () => {
    return prerequisites.getPlatformInfo();
  });

  // Logging and diagnostics IPC handlers
  ipcMain.handle('logger:open', async () => {
    logger.info('Opening log file...');
    return await openLogFile();
  });

  ipcMain.handle('logger:open-directory', async () => {
    logger.info('Opening logs directory...');
    return await openLogsDirectory();
  });

  ipcMain.handle('logger:export', async () => {
    logger.info('Exporting diagnostic report...');
    return await exportDiagnosticReport();
  });

  ipcMain.handle('logger:test-system', async () => {
    logger.info('Running system tests...');
    return await testSystem();
  });

  ipcMain.handle('logger:get-logs', async (_, lines: number = 100) => {
    return getRecentLogs(lines);
  });

  ipcMain.handle('logger:get-log-level', async () => {
    const { getConsoleLogLevel } = await import('./logger.js');
    return getConsoleLogLevel();
  });

  ipcMain.handle('logger:set-log-level', async (_, level: 'debug' | 'info' | 'warn' | 'error') => {
    const { setConsoleLogLevel } = await import('./logger.js');
    setConsoleLogLevel(level);
    return { success: true, level };
  });

  ipcMain.handle('logger:enable-verbose', async () => {
    const { enableVerboseLogging } = await import('./logger.js');
    enableVerboseLogging();
    // Also reset env config logging to show full details
    const { resetConfigLogging } = await import('./env-config.js');
    resetConfigLogging();
    return { success: true };
  });

  ipcMain.handle('logger:disable-verbose', async () => {
    const { disableVerboseLogging } = await import('./logger.js');
    disableVerboseLogging();
    return { success: true };
  });

  ipcMain.handle('logger:generate-issue-template', async (_, title: string, message: string, stack?: string) => {
    return generateGitHubIssueTemplate(title, message, stack);
  });

  ipcMain.handle('logger:open-github-issue', async (_, title: string, message: string, stack?: string) => {
    return await openGitHubIssue(title, message, stack);
  });

  // Environment configuration IPC handlers
  ipcMain.handle('env:get-config', async () => {
    logger.info('Getting environment configuration...');
    return await envConfig.loadEnvConfig();
  });

  ipcMain.handle('env:save-config', async (_, config: envConfig.EnvConfig) => {
    logger.info('Saving environment configuration...');
    logger.info('Config credentials check:', {
      hasPassword: !!config.POSTGRES_PASSWORD,
      hasToken: !!config.MCP_AUTH_TOKEN,
      passwordLength: config.POSTGRES_PASSWORD?.length || 0,
      tokenLength: config.MCP_AUTH_TOKEN?.length || 0
    });

    const validation = envConfig.validateConfig(config);
    if (!validation.valid) {
      logger.error('Config validation failed:', validation.errors);
      return { success: false, error: 'Validation failed: ' + validation.errors.join(', ') };
    }

    logger.info('Config validation passed, proceeding to save');
    const result = await envConfig.saveEnvConfig(config);

    // Update GitHub credentials if token changed
    if (config.GITHUB_TOKEN) {
      try {
        const { getGitHubCredentialManager } = await import('./github-credential-manager');
        getGitHubCredentialManager(config.GITHUB_TOKEN);
        logger.info('GitHub credentials updated from saved config');
      } catch (error) {
        logger.warn('Error updating GitHub credentials:', error);
      }
    }

    return result;
  });

  ipcMain.handle('env:generate-password', async (_, length?: number) => {
    logger.info('Generating password...');
    return envConfig.generatePassword(length);
  });

  ipcMain.handle('env:generate-token', async () => {
    logger.info('Generating auth token...');
    return envConfig.generateAuthToken();
  });

  ipcMain.handle('env:check-port', async (_, port: number) => {
    logger.info(`Checking if port ${port} is available...`);
    return await envConfig.checkPortAvailable(port);
  });

  ipcMain.handle('env:reset-defaults', async () => {
    logger.info('Resetting to default configuration...');
    return {
      ...envConfig.DEFAULT_CONFIG,
      POSTGRES_PASSWORD: envConfig.generatePassword(),
      MCP_AUTH_TOKEN: envConfig.generateAuthToken(),
    };
  });

  ipcMain.handle('env:validate-config', async (_, config: envConfig.EnvConfig) => {
    return envConfig.validateConfig(config);
  });

  ipcMain.handle('env:calculate-password-strength', async (_, password: string) => {
    return envConfig.calculatePasswordStrength(password);
  });

  ipcMain.handle('env:get-env-file-path', async () => {
    return envConfig.getEnvFilePath();
  });

  ipcMain.handle('env:file-exists', async () => {
    const envPath = envConfig.getEnvFilePath();
    return fs.existsSync(envPath);
  });

  ipcMain.handle('env:check-all-ports', async (_, config: envConfig.EnvConfig) => {
    logger.info('Checking all ports for conflicts...');
    return await envConfig.checkAllPortsAndSuggestAlternatives(config);
  });

  ipcMain.handle('env:find-next-available-port', async (_, startPort: number) => {
    logger.info(`Finding next available port starting from ${startPort}...`);
    return await envConfig.findNextAvailablePort(startPort);
  });

  
  // Docker IPC handlers
  ipcMain.handle('docker:start', async (_event) => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Starting Docker Desktop...');

    // Send progress updates to renderer
    const progressCallback: docker.ProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('docker:progress', progress);
      }
    };

    const result = await docker.startDockerDesktop(progressCallback);
    return result;
  });

  ipcMain.handle('docker:wait-ready', async (_event) => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Waiting for Docker to be ready...');

    // Send progress updates to renderer
    const progressCallback: docker.ProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('docker:progress', progress);
      }
    };

    const result = await docker.waitForDockerReady(progressCallback);
    return result;
  });

  ipcMain.handle('docker:start-and-wait', async (_event) => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Starting Docker and waiting for it to be ready...');

    // Send progress updates to renderer
    const progressCallback: docker.ProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('docker:progress', progress);
      }
    };

    const result = await docker.startAndWaitForDocker(progressCallback);
    return result;
  });

  ipcMain.handle('docker:stop', async () => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Stopping Docker Desktop...');
    return await docker.stopDocker();
  });

  ipcMain.handle('docker:restart', async (_event) => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Restarting Docker Desktop...');

    // Send progress updates to renderer
    const progressCallback: docker.ProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('docker:progress', progress);
      }
    };

    const result = await docker.restartDocker(progressCallback);
    return result;
  });

  ipcMain.handle('docker:health-check', async () => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Checking Docker health...');
    return await docker.checkDockerHealth();
  });

  ipcMain.handle('docker:containers-status', async () => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Getting containers status...');
    return await docker.getContainersStatus();
  });

  // Installation wizard IPC handlers
  ipcMain.handle('wizard:get-instructions', async () => {
    logWithCategory('info', LogCategory.PREREQUISITES, 'Getting installation instructions...');
    return installationWizard.getInstallationInstructions();
  });

  ipcMain.handle('wizard:get-download-url', async () => {
    logWithCategory('info', LogCategory.PREREQUISITES, 'Getting Docker download URL...');
    return installationWizard.getDockerDownloadUrl();
  });

  ipcMain.handle('wizard:open-download', async () => {
    logWithCategory('info', LogCategory.PREREQUISITES, 'Opening Docker download page...');
    return await installationWizard.openDownloadPage();
  });

  ipcMain.handle('wizard:copy-command', async (_, command: string) => {
    logWithCategory('info', LogCategory.PREREQUISITES, `Copying command to clipboard: ${command}`);
    return installationWizard.copyCommandToClipboard(command);
  });

  ipcMain.handle('wizard:get-step', async (_, stepNumber: number) => {
    return installationWizard.getStep(stepNumber);
  });

  ipcMain.handle('wizard:get-explanation', async () => {
    return installationWizard.getWhyDockerExplanation();
  });

  // Client selection IPC handlers
  ipcMain.handle('client:get-options', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'Getting available client options...');
    return clientSelection.getAvailableClients();
  });

  ipcMain.handle('client:save-selection', async (_, clients: string[]) => {
    logWithCategory('info', LogCategory.SYSTEM, `Saving client selection: ${clients.join(', ')}`);
    return await clientSelection.saveClientSelection(clients);
  });

  ipcMain.handle('client:get-selection', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'Getting current client selection...');
    return await clientSelection.loadClientSelection();
  });

  ipcMain.handle('client:get-status', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'Getting client status...');
    return await clientSelection.getClientStatus();
  });

  ipcMain.handle('client:clear-selection', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'Clearing client selection...');
    return await clientSelection.clearClientSelection();
  });

  ipcMain.handle('client:get-by-id', async (_, clientId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `Getting client by ID: ${clientId}`);
    return clientSelection.getClientById(clientId);
  });

  ipcMain.handle('client:add-custom', async (_, client: clientSelection.ClientMetadata) => {
    logWithCategory('info', LogCategory.SYSTEM, `Adding custom client: ${client.name}`);
    return await clientSelection.addCustomClient(client);
  });

  ipcMain.handle('client:remove-custom', async (_, clientId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `Removing custom client: ${clientId}`);
    return await clientSelection.removeCustomClient(clientId);
  });

  ipcMain.handle('client:update-config', async (_, clientId: string, updates: Partial<clientSelection.ClientMetadata>) => {
    logWithCategory('info', LogCategory.SYSTEM, `Updating client config: ${clientId}`);
    return await clientSelection.updateClientConfig(clientId, updates);
  });

  ipcMain.handle('client:get-selection-file-path', async () => {
    return clientSelection.getSelectionFilePath();
  });

  ipcMain.handle('client:launch-electron-app', async (_, clientId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `Launching electron app: ${clientId}`);
    return await clientSelection.launchElectronApp(clientId);
  });

  // Typing Mind downloader IPC handlers
  ipcMain.handle('typingmind:download', async (_event) => {
    logWithCategory('info', LogCategory.SCRIPT, 'IPC: Starting Typing Mind download...');

    // Send progress updates to renderer
    const progressCallback: typingMindDownloader.ProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('typingmind:progress', progress);
      }
    };

    const result = await typingMindDownloader.downloadTypingMind(progressCallback);
    return result;
  });

  ipcMain.handle('typingmind:cancel-download', async () => {
    logWithCategory('info', LogCategory.SCRIPT, 'IPC: Cancelling Typing Mind download...');
    return await typingMindDownloader.cancelDownload();
  });

  ipcMain.handle('typingmind:is-installed', async () => {
    logWithCategory('info', LogCategory.SCRIPT, 'IPC: Checking if Typing Mind is installed...');
    return await typingMindDownloader.isInstalled();
  });

  ipcMain.handle('typingmind:get-version', async () => {
    logWithCategory('info', LogCategory.SCRIPT, 'IPC: Getting Typing Mind version...');
    return await typingMindDownloader.getVersion();
  });

  ipcMain.handle('typingmind:uninstall', async () => {
    logWithCategory('info', LogCategory.SCRIPT, 'IPC: Uninstalling Typing Mind...');
    return await typingMindDownloader.uninstall();
  });

  ipcMain.handle('typingmind:check-updates', async () => {
    logWithCategory('info', LogCategory.SCRIPT, 'IPC: Checking for Typing Mind updates...');
    return await typingMindDownloader.checkForUpdates();
  });

  ipcMain.handle('typingmind:get-install-path', async () => {
    return typingMindDownloader.getTypingMindDirectory();
  });

  // TypingMind Auto-Configuration IPC handlers
  ipcMain.handle('typingmind:auto-configure', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Auto-configuring TypingMind with MCP Connector...');
    return await typingMindAutoConfig.autoConfigureTypingMind();
  });

  ipcMain.handle('typingmind:set-custom-config', async (_event, serverUrl: string, authToken: string) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Setting custom TypingMind configuration...');
    return await typingMindAutoConfig.setCustomTypingMindConfig(serverUrl, authToken);
  });

  ipcMain.handle('typingmind:get-config', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting TypingMind configuration...');
    return await typingMindAutoConfig.loadTypingMindConfig();
  });

  ipcMain.handle('typingmind:get-config-instructions', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting TypingMind configuration instructions...');
    return await typingMindAutoConfig.getConfigurationInstructions();
  });

  ipcMain.handle('typingmind:is-configured', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Checking if TypingMind is configured...');
    return await typingMindAutoConfig.isTypingMindConfigured();
  });

  ipcMain.handle('typingmind:reset-config', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Resetting TypingMind configuration...');
    return await typingMindAutoConfig.resetTypingMindConfig();
  });

  ipcMain.handle('typingmind:get-mcp-servers-json', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting MCP servers JSON configuration...');
    const serversConfig = await typingMindAutoConfig.buildMCPServersConfig();
    return JSON.stringify(serversConfig, null, 2);
  });

  ipcMain.handle('typingmind:open-window', async (_, url: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Opening Typing Mind in browser at ${url}...`);
    try {
      openTypingMindInBrowser(url);
      return { success: true };
    } catch (error) {
      logWithCategory('error', LogCategory.ERROR, 'Failed to open Typing Mind in browser', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Claude Desktop Auto-Configuration IPC handlers
  ipcMain.handle('claude-desktop:auto-configure', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Auto-configuring Claude Desktop...');
    const { autoConfigureClaudeDesktop } = await import('./claude-desktop-auto-config');
    return await autoConfigureClaudeDesktop();
  });

  ipcMain.handle('claude-desktop:is-configured', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Checking if Claude Desktop is configured...');
    const { isClaudeDesktopConfigured } = await import('./claude-desktop-auto-config');
    return await isClaudeDesktopConfigured();
  });

  ipcMain.handle('claude-desktop:get-config', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting Claude Desktop configuration...');
    const { getClaudeDesktopConfig } = await import('./claude-desktop-auto-config');
    return await getClaudeDesktopConfig();
  });

  ipcMain.handle('claude-desktop:reset-config', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Resetting Claude Desktop configuration...');
    const { resetClaudeDesktopConfig } = await import('./claude-desktop-auto-config');
    return await resetClaudeDesktopConfig();
  });

  ipcMain.handle('claude-desktop:get-config-path', () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting Claude Desktop config path...');
    const { getClaudeDesktopConfigPath } = require('./claude-desktop-auto-config');
    return getClaudeDesktopConfigPath();
  });

  ipcMain.handle('claude-desktop:open-config-folder', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Opening Claude Desktop config folder...');
    const { getClaudeDesktopConfigPath } = await import('./claude-desktop-auto-config');
    const configPath = getClaudeDesktopConfigPath();
    await shell.showItemInFolder(configPath);
  });

  ipcMain.handle('claude-desktop:get-config-instructions', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting Claude Desktop configuration instructions...');
    const { getConfigurationInstructions } = await import('./claude-desktop-auto-config');
    return await getConfigurationInstructions();
  });

  // Claude Code CLI IPC handlers
  ipcMain.handle('claude-code:get-status', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting Claude Code CLI status...');
    const { ClaudeCodeDetector } = await import('./claude-code-detector');
    const detector = new ClaudeCodeDetector();
    return await detector.getStatus();
  });

  ipcMain.handle('claude-code:open-install-page', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Opening Claude Code installation page...');
    await shell.openExternal('https://www.anthropic.com/claude-code');
  });

  // Docker Images IPC handlers
  ipcMain.handle('docker-images:load-all', async (_event) => {
    logWithCategory('info', LogCategory.DOCKER_IMAGE, 'IPC: Loading all Docker images...');

    // Send progress updates to renderer
    const progressCallback: dockerImages.ImageProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('docker-images:progress', progress);
      }
    };

    const result = await dockerImages.loadAllDockerImages(progressCallback);
    return result;
  });

  ipcMain.handle('docker-images:load-image', async (_event, imagePath: string, imageName: string) => {
    logWithCategory('info', LogCategory.DOCKER_IMAGE, `IPC: Loading Docker image ${imageName} from ${imagePath}...`);

    // Send progress updates to renderer
    const progressCallback: dockerImages.ImageProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('docker-images:progress', progress);
      }
    };

    const result = await dockerImages.loadImage(imagePath, imageName, progressCallback);
    return result;
  });

  ipcMain.handle('docker-images:check-exists', async (_event, imageName: string) => {
    logWithCategory('info', LogCategory.DOCKER_IMAGE, `IPC: Checking if image exists: ${imageName}`);
    return await dockerImages.checkImageExists(imageName);
  });

  ipcMain.handle('docker-images:list', async () => {
    logWithCategory('info', LogCategory.DOCKER_IMAGE, 'IPC: Getting Docker image list...');
    return await dockerImages.getImageList();
  });

  ipcMain.handle('docker-images:get-bundled', async () => {
    logWithCategory('info', LogCategory.DOCKER_IMAGE, 'IPC: Getting bundled images information...');
    return await dockerImages.getBundledImages();
  });

  ipcMain.handle('docker-images:check-disk-space', async () => {
    logWithCategory('info', LogCategory.DOCKER_IMAGE, 'IPC: Checking disk space...');
    return await dockerImages.checkDiskSpace();
  });

  // MCP System IPC handlers
  ipcMain.handle('mcp-system:start', async (_event) => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Starting MCP system...');

    // Send progress updates to renderer
    const progressCallback: mcpSystem.ProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('mcp-system:progress', progress);
      }
    };

    const result = await mcpSystem.startMCPSystem(progressCallback);
    return result;
  });

  ipcMain.handle('mcp-system:stop', async () => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Stopping MCP system...');
    return await mcpSystem.stopMCPSystem();
  });

  ipcMain.handle('mcp-system:restart', async (_event) => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Restarting MCP system...');

    // Send progress updates to renderer
    const progressCallback: mcpSystem.ProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('mcp-system:progress', progress);
      }
    };

    const result = await mcpSystem.restartMCPSystem(progressCallback);
    return result;
  });

  ipcMain.handle('mcp-system:status', async () => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Getting MCP system status...');
    return await mcpSystem.getSystemStatus();
  });

  ipcMain.handle('mcp-system:detailed-status', async () => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Getting detailed MCP system status...');
    return await mcpSystem.getDetailedServiceStatus();
  });

  ipcMain.handle('mcp-system:urls', async () => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Getting service URLs...');
    return await mcpSystem.getServiceUrls();
  });

  ipcMain.handle('mcp-system:logs', async (_, serviceName: 'postgres' | 'mcp-writing-servers' | 'mcp-connector' | 'typing-mind', tail?: number) => {
    logWithCategory('info', LogCategory.DOCKER, `IPC: Getting logs for ${serviceName}...`);
    return await mcpSystem.viewServiceLogs(serviceName, tail);
  });

  ipcMain.handle('mcp-system:check-ports', async () => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Checking port conflicts...');
    return await mcpSystem.checkPortConflicts();
  });

  ipcMain.handle('mcp-system:working-directory', async () => {
    return mcpSystem.getMCPWorkingDirectoryPath();
  });

  // Database Backup/Restore IPC handlers
  ipcMain.handle('database-backup:create', async (_, customPath?: string, compressed?: boolean) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Creating database backup...');
    return await databaseBackup.createBackup(customPath, compressed);
  });

  ipcMain.handle('database-backup:restore', async (_, backupPath: string, dropExisting?: boolean) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Restoring database from ${backupPath}...`);
    return await databaseBackup.restoreBackup(backupPath, dropExisting);
  });

  ipcMain.handle('database-backup:list', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Listing available backups...');
    return await databaseBackup.listBackups();
  });

  ipcMain.handle('database-backup:delete', async (_, backupPath: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Deleting backup ${backupPath}...`);
    return await databaseBackup.deleteBackup(backupPath);
  });

  ipcMain.handle('database-backup:select-save-location', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Showing save dialog for backup...');
    return await databaseBackup.selectBackupSaveLocation();
  });

  ipcMain.handle('database-backup:select-restore-file', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Showing open dialog for restore...');
    return await databaseBackup.selectBackupFileForRestore();
  });

  ipcMain.handle('database-backup:get-directory', async () => {
    return databaseBackup.getBackupDirectoryPath();
  });

  ipcMain.handle('database-backup:open-directory', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Opening backup directory...');
    return await databaseBackup.openBackupDirectory();
  });

  // Database Administration IPC handlers (MCP database tools)
  ipcMain.handle('database-admin:check-connection', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Checking database admin server connection...');
    return await databaseAdmin.checkConnection();
  });

  ipcMain.handle('database-admin:get-server-info', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting database server info...');
    return await databaseAdmin.getServerInfo();
  });

  // CRUD Operations
  ipcMain.handle('database-admin:query-records', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Querying records from table ${params.table}...`);
    return await databaseAdmin.queryRecords(params);
  });

  ipcMain.handle('database-admin:insert-record', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Inserting record into table ${params.table}...`);
    return await databaseAdmin.insertRecord(params);
  });

  ipcMain.handle('database-admin:update-records', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Updating records in table ${params.table}...`);
    return await databaseAdmin.updateRecords(params);
  });

  ipcMain.handle('database-admin:delete-records', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Deleting records from table ${params.table}...`);
    return await databaseAdmin.deleteRecords(params);
  });

  // Batch Operations
  ipcMain.handle('database-admin:batch-insert', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Batch inserting ${params.records?.length || 0} records into table ${params.table}...`);
    return await databaseAdmin.batchInsert(params);
  });

  ipcMain.handle('database-admin:batch-update', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Batch updating records in table ${params.table}...`);
    return await databaseAdmin.batchUpdate(params);
  });

  ipcMain.handle('database-admin:batch-delete', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Batch deleting records from table ${params.table}...`);
    return await databaseAdmin.batchDelete(params);
  });

  // Schema Management
  ipcMain.handle('database-admin:get-schema', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Getting schema for table ${params.table}...`);
    return await databaseAdmin.getSchema(params);
  });

  ipcMain.handle('database-admin:list-tables', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Listing database tables...');
    return await databaseAdmin.listTables();
  });

  ipcMain.handle('database-admin:get-relationships', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting table relationships...');
    return await databaseAdmin.getRelationships(params);
  });

  ipcMain.handle('database-admin:list-columns', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Listing columns for table ${params.table}...`);
    return await databaseAdmin.listColumns(params);
  });

  // Audit Functions
  ipcMain.handle('database-admin:query-audit-logs', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Querying audit logs...');
    return await databaseAdmin.queryAuditLogs(params);
  });

  ipcMain.handle('database-admin:get-audit-summary', async (_, params: any) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting audit summary...');
    return await databaseAdmin.getAuditSummary(params);
  });

  // Updater IPC handlers
  ipcMain.handle('updater:check-all', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Checking for all updates...');
    return await updater.checkForAllUpdates();
  });

  ipcMain.handle('updater:check-mcp-servers', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Checking for MCP servers updates...');
    return await updater.checkForMCPServersUpdate();
  });

  ipcMain.handle('updater:check-typing-mind', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Checking for Typing Mind updates...');
    return await updater.checkForTypingMindUpdate();
  });

  ipcMain.handle('updater:update-all', async (_event) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Updating all components...');

    // Send progress updates to renderer
    const progressCallback: updater.ProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('updater:progress', progress);
      }
    };

    return await updater.updateAll(progressCallback);
  });

  ipcMain.handle('updater:update-mcp-servers', async (_event) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Updating MCP servers...');

    // Send progress updates to renderer
    const progressCallback: updater.ProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('updater:progress', progress);
      }
    };

    return await updater.updateMCPServers(progressCallback);
  });

  ipcMain.handle('updater:update-typing-mind', async (_event) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Updating Typing Mind...');

    // Send progress updates to renderer
    const progressCallback: updater.ProgressCallback = (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('updater:progress', progress);
      }
    };

    return await updater.updateTypingMind(progressCallback);
  });

  ipcMain.handle('updater:get-preferences', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting update preferences...');
    return await updater.getUpdatePreferences();
  });

  ipcMain.handle('updater:set-preferences', async (_, prefs: updater.UpdatePreferences) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Setting update preferences...');
    return await updater.setUpdatePreferences(prefs);
  });

  // Setup Wizard IPC handlers
  ipcMain.handle('setup-wizard:is-first-run', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Checking if first run...');
    return await setupWizard.isFirstRun();
  });

  ipcMain.handle('setup-wizard:get-state', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting wizard state...');
    return await setupWizard.getWizardState();
  });

  ipcMain.handle('setup-wizard:save-state', async (_, step: setupWizard.WizardStep, data?: Partial<setupWizard.WizardStepData>) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Saving wizard state for step ${step}...`);
    return await setupWizard.saveWizardState(step, data);
  });

  ipcMain.handle('setup-wizard:complete-step', async (_, step: setupWizard.WizardStep, data?: Partial<setupWizard.WizardStepData>) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Completing wizard step ${step}...`);
    return await setupWizard.completeStep(step, data);
  });

  ipcMain.handle('setup-wizard:go-to-step', async (_, step: setupWizard.WizardStep) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Navigating to wizard step ${step}...`);
    return await setupWizard.goToStep(step);
  });

  ipcMain.handle('setup-wizard:mark-complete', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Marking wizard as complete...');
    const result = await setupWizard.markWizardComplete();

    // Close the wizard window and open the dashboard
    if (mainWindow) {
      logWithCategory('info', LogCategory.SYSTEM, 'Closing wizard and opening dashboard...');

      // Create the dashboard window BEFORE closing the wizard to prevent app.quit()
      const wizardWindow = mainWindow;
      mainWindow = null; // Clear reference so createWindow() can create new one

      createWindow(); // Create dashboard immediately

      // Close wizard after dashboard is created
      setTimeout(() => {
        wizardWindow.close();
      }, 100);
    }

    return result;
  });

  ipcMain.handle('setup-wizard:reset', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Resetting wizard...');
    return await setupWizard.resetWizard();
  });

  ipcMain.handle('setup-wizard:get-progress', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting wizard progress...');
    return await setupWizard.getWizardProgress();
  });

  ipcMain.handle('setup-wizard:is-step-completed', async (_, step: setupWizard.WizardStep) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Checking if step ${step} is completed...`);
    return await setupWizard.isStepCompleted(step);
  });

  ipcMain.handle('setup-wizard:get-step-name', async (_, step: setupWizard.WizardStep) => {
    return setupWizard.getStepName(step);
  });

  ipcMain.handle('setup-wizard:get-step-description', async (_, step: setupWizard.WizardStep) => {
    return setupWizard.getStepDescription(step);
  });

  ipcMain.handle('setup-wizard:can-proceed', async (_, step: setupWizard.WizardStep) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Checking if can proceed from step ${step}...`);
    return await setupWizard.canProceedToNextStep(step);
  });

  ipcMain.handle('setup-wizard:get-installation-version', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting installation version...');
    return await setupWizard.getInstallationVersion();
  });

  ipcMain.handle('setup-wizard:is-installation-outdated', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Checking if installation is outdated...');
    return await setupWizard.isInstallationOutdated();
  });

  ipcMain.handle('setup-wizard:get-migration-history', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting migration history...');
    return await setupWizard.getMigrationHistory();
  });

  ipcMain.handle('setup-wizard:add-migration-record', async (_, record: setupWizard.MigrationRecord) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Adding migration record for version ${record.version}...`);
    return await setupWizard.addMigrationRecord(record);
  });

  // Migration IPC handlers
  ipcMain.handle('migrations:check-pending', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Checking for pending migrations...');
    return await migrations.checkForPendingMigrations();
  });

  ipcMain.handle('migrations:run', async (_, migrationsToRun: migrations.Migration[]) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Running ${migrationsToRun.length} migrations...`);
    return await migrations.runMigrations(migrationsToRun);
  });

  ipcMain.handle('migrations:get-all', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting all registered migrations...');
    return migrations.getAllMigrations();
  });

  ipcMain.handle('migrations:get-for-upgrade', async (_, fromVersion: string, toVersion: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Getting migrations for upgrade ${fromVersion} -> ${toVersion}...`);
    return migrations.getMigrationsForUpgrade(fromVersion, toVersion);
  });

  ipcMain.handle('migrations:get-steps-to-rerun', async (_, pendingMigrations: migrations.Migration[]) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting steps to rerun for pending migrations...');
    return migrations.getStepsToRerunForMigrations(pendingMigrations);
  });

  ipcMain.handle('migrations:validate', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Validating migration registry...');
    return migrations.validateMigrations();
  });

  // Migration Wizard IPC handlers
  ipcMain.handle('migrations:complete', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Migration wizard completed, transitioning to main app...');

    // Close the current migration wizard window
    if (mainWindow) {
      mainWindow.close();
      mainWindow = null;
    }

    // Create the main application window
    createWindow();

    return { success: true };
  });

  ipcMain.handle('closeWindow', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Closing current window...');

    if (mainWindow) {
      mainWindow.close();
    }

    return { success: true };
  });

  // GitHub Credentials IPC handlers
  ipcMain.handle('github-credentials:set-token', async (_, token: string) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Setting GitHub token...');
    const { getGitHubCredentialManager } = await import('./github-credential-manager');
    getGitHubCredentialManager(token);
    return { success: true };
  });

  ipcMain.handle('github-credentials:get-status', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Getting GitHub credentials status...');
    const { getGitHubCredentialManager } = await import('./github-credential-manager');
    const credentialManager = getGitHubCredentialManager();
    return {
      configured: credentialManager.isConfigured(),
    };
  });

  ipcMain.handle('github-credentials:test-token', async (_, token?: string) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Testing GitHub token...');
    const { getGitHubCredentialManager } = await import('./github-credential-manager');
    const credentialManager = getGitHubCredentialManager();
    return await credentialManager.testTokenValidity(token);
  });

  ipcMain.handle('github-credentials:validate-token-format', async (_, token: string) => {
    const { GitHubCredentialManager } = await import('./github-credential-manager');
    return GitHubCredentialManager.validateTokenFormat(token);
  });

  ipcMain.handle('github-credentials:clear-token', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Clearing GitHub token...');
    const { getGitHubCredentialManager } = await import('./github-credential-manager');
    const credentialManager = getGitHubCredentialManager();
    credentialManager.clearToken();
    return { success: true };
  });

  // ========================================
  // Repository IPC Handlers
  // ========================================

  /**
   * Clone a Git repository with progress tracking
   */
  ipcMain.handle(
    IPC_CHANNELS.REPOSITORY.CLONE,
    async (_event, request: RepositoryCloneRequest): Promise<RepositoryCloneResponse> => {
      logWithCategory('info', LogCategory.GENERAL, `IPC: Cloning repository ${request.url} to ${request.targetPath}`);

      try {
        // Create progress throttler (max 10 events per second)
        const progressThrottler = new ProgressThrottler(10);

        // Wrap the progress callback with throttling
        const throttledOptions = {
          ...request.options,
          onProgress: request.options?.onProgress
            ? (progress: any) => {
                progressThrottler.emit(progress, (throttledProgress) => {
                  if (mainWindow) {
                    mainWindow.webContents.send(IPC_CHANNELS.REPOSITORY.PROGRESS, throttledProgress);
                  }
                });
              }
            : undefined,
        };

        await repositoryManager.cloneRepository(request.url, request.targetPath, throttledOptions);

        // Flush any pending progress
        if (throttledOptions.onProgress) {
          progressThrottler.flush((finalProgress) => {
            if (mainWindow) {
              mainWindow.webContents.send(IPC_CHANNELS.REPOSITORY.PROGRESS, finalProgress);
            }
          });
        }

        return {
          success: true,
          message: 'Repository cloned successfully',
          path: request.targetPath,
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error cloning repository', error);
        return {
          success: false,
          message: 'Failed to clone repository',
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * Checkout a specific version (branch, tag, or commit)
   */
  ipcMain.handle(
    IPC_CHANNELS.REPOSITORY.CHECKOUT_VERSION,
    async (_event, request: RepositoryCheckoutRequest): Promise<RepositoryCheckoutResponse> => {
      logWithCategory('info', LogCategory.GENERAL, `IPC: Checking out version ${request.version} in ${request.repoPath}`);

      try {
        await repositoryManager.checkoutVersion(request.repoPath, request.version);

        return {
          success: true,
          message: `Checked out ${request.version}`,
          version: request.version,
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error checking out version', error);
        return {
          success: false,
          message: 'Failed to checkout version',
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * Get repository status
   */
  ipcMain.handle(
    IPC_CHANNELS.REPOSITORY.GET_STATUS,
    async (_event, request: RepositoryStatusRequest): Promise<RepositoryStatusResponse> => {
      logWithCategory('info', LogCategory.GENERAL, `IPC: Getting repository status for ${request.repoPath}`);

      try {
        const status = await repositoryManager.getRepoStatus(request.repoPath);

        return {
          success: true,
          status,
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error getting repository status', error);
        return {
          success: false,
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * Get current branch name
   */
  ipcMain.handle(
    IPC_CHANNELS.REPOSITORY.GET_CURRENT_BRANCH,
    async (_event, request: RepositoryBranchRequest): Promise<RepositoryBranchResponse> => {
      logWithCategory('info', LogCategory.GENERAL, `IPC: Getting current branch for ${request.repoPath}`);

      try {
        const status = await repositoryManager.getRepoStatus(request.repoPath);

        if (!status.isGitRepo) {
          return {
            success: false,
            error: 'Not a Git repository',
          };
        }

        return {
          success: true,
          branch: status.currentBranch,
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error getting current branch', error);
        return {
          success: false,
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * List all branches in repository
   */
  ipcMain.handle(
    IPC_CHANNELS.REPOSITORY.LIST_BRANCHES,
    async (_event, request: RepositoryBranchRequest): Promise<RepositoryBranchResponse> => {
      logWithCategory('info', LogCategory.GENERAL, `IPC: Listing branches for ${request.repoPath}`);

      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execPromise = promisify(exec);

        const { stdout } = await execPromise('git branch -a', {
          cwd: request.repoPath,
          timeout: 10000,
        });

        const branches = stdout
          .split('\n')
          .map((line: string) => line.trim().replace(/^\*\s+/, '').replace(/^remotes\/origin\//, ''))
          .filter((line: string) => line.length > 0 && !line.includes('HEAD ->'));

        // Remove duplicates
        const uniqueBranches = Array.from(new Set(branches)) as string[];

        return {
          success: true,
          branches: uniqueBranches,
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error listing branches', error);
        return {
          success: false,
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * Get latest commit information
   */
  ipcMain.handle(
    IPC_CHANNELS.REPOSITORY.GET_LATEST_COMMIT,
    async (_event, request: RepositoryCommitRequest): Promise<RepositoryCommitResponse> => {
      logWithCategory('info', LogCategory.GENERAL, `IPC: Getting latest commit for ${request.repoPath}`);

      try {
        const status = await repositoryManager.getRepoStatus(request.repoPath);

        if (!status.isGitRepo) {
          return {
            success: false,
            error: 'Not a Git repository',
          };
        }

        return {
          success: true,
          commit: status.latestCommit,
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error getting latest commit', error);
        return {
          success: false,
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * Cancel ongoing repository operation
   */
  ipcMain.handle(
    IPC_CHANNELS.REPOSITORY.CANCEL,
    async (): Promise<RepositoryCancelResponse> => {
      logWithCategory('info', LogCategory.GENERAL, 'IPC: Cancelling repository operation');

      try {
        const cancelled = await repositoryManager.cancelOperation();

        return {
          success: cancelled,
          message: cancelled ? 'Operation cancelled' : 'No operation to cancel',
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error cancelling operation', error);
        return {
          success: false,
          message: error.message || String(error),
        };
      }
    }
  );

  // ========================================
  // Build IPC Handlers
  // ========================================

  /**
   * Execute npm install
   */
  ipcMain.handle(
    IPC_CHANNELS.BUILD.NPM_INSTALL,
    async (_event, request: BuildNpmInstallRequest): Promise<BuildNpmInstallResponse> => {
      logWithCategory('info', LogCategory.GENERAL, `IPC: Running npm install in ${request.repoPath}`);

      try {
        // Create progress throttler (max 10 events per second)
        const progressThrottler = new ProgressThrottler(10);

        const buildOrchestrator = createBuildOrchestrator((progress) => {
          progressThrottler.emit(progress, (throttledProgress) => {
            if (mainWindow) {
              mainWindow.webContents.send(IPC_CHANNELS.BUILD.PROGRESS, throttledProgress);
            }
          });
        });

        await buildOrchestrator.npmInstall(request.repoPath, request.options);

        // Flush any pending progress
        progressThrottler.flush((finalProgress) => {
          if (mainWindow) {
            mainWindow.webContents.send(IPC_CHANNELS.BUILD.PROGRESS, finalProgress);
          }
        });

        return {
          success: true,
          message: 'npm install completed successfully',
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error running npm install', error);
        return {
          success: false,
          message: 'npm install failed',
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * Execute npm build
   */
  ipcMain.handle(
    IPC_CHANNELS.BUILD.NPM_BUILD,
    async (_event, request: BuildNpmBuildRequest): Promise<BuildNpmBuildResponse> => {
      logWithCategory('info', LogCategory.GENERAL, `IPC: Running npm build in ${request.repoPath}`);

      try {
        // Create progress throttler (max 10 events per second)
        const progressThrottler = new ProgressThrottler(10);

        const buildOrchestrator = createBuildOrchestrator((progress) => {
          progressThrottler.emit(progress, (throttledProgress) => {
            if (mainWindow) {
              mainWindow.webContents.send(IPC_CHANNELS.BUILD.PROGRESS, throttledProgress);
            }
          });
        });

        await buildOrchestrator.npmBuild(request.repoPath, request.buildScript, request.options);

        // Flush any pending progress
        progressThrottler.flush((finalProgress) => {
          if (mainWindow) {
            mainWindow.webContents.send(IPC_CHANNELS.BUILD.PROGRESS, finalProgress);
          }
        });

        return {
          success: true,
          message: 'npm build completed successfully',
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error running npm build', error);
        return {
          success: false,
          message: 'npm build failed',
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * Execute docker build
   */
  ipcMain.handle(
    IPC_CHANNELS.BUILD.DOCKER_BUILD,
    async (_event, request: BuildDockerBuildRequest): Promise<BuildDockerBuildResponse> => {
      logWithCategory('info', LogCategory.DOCKER, `IPC: Building Docker image ${request.imageName}`);

      try {
        // Create progress throttler (max 10 events per second)
        const progressThrottler = new ProgressThrottler(10);

        const buildOrchestrator = createBuildOrchestrator((progress) => {
          progressThrottler.emit(progress, (throttledProgress) => {
            if (mainWindow) {
              mainWindow.webContents.send(IPC_CHANNELS.BUILD.PROGRESS, throttledProgress);
            }
          });
        });

        await buildOrchestrator.dockerBuild(request.dockerfile, request.imageName, request.options);

        // Flush any pending progress
        progressThrottler.flush((finalProgress) => {
          if (mainWindow) {
            mainWindow.webContents.send(IPC_CHANNELS.BUILD.PROGRESS, finalProgress);
          }
        });

        return {
          success: true,
          message: 'Docker build completed successfully',
          imageName: request.imageName,
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.DOCKER, 'Error running docker build', error);
        return {
          success: false,
          message: 'Docker build failed',
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * Execute build chain
   */
  ipcMain.handle(
    IPC_CHANNELS.BUILD.EXECUTE_CHAIN,
    async (_event, request: BuildExecuteChainRequest): Promise<BuildExecuteChainResponse> => {
      logWithCategory('info', LogCategory.GENERAL, `IPC: Executing build chain with ${request.steps.length} steps`);

      try {
        // Create progress throttler (max 10 events per second)
        const progressThrottler = new ProgressThrottler(10);

        const buildOrchestrator = createBuildOrchestrator((progress) => {
          progressThrottler.emit(progress, (throttledProgress) => {
            if (mainWindow) {
              mainWindow.webContents.send(IPC_CHANNELS.BUILD.PROGRESS, throttledProgress);
            }
          });
        });

        const result = await buildOrchestrator.executeBuildChain(request.steps, request.config);

        // Flush any pending progress
        progressThrottler.flush((finalProgress) => {
          if (mainWindow) {
            mainWindow.webContents.send(IPC_CHANNELS.BUILD.PROGRESS, finalProgress);
          }
        });

        return {
          success: result.success,
          result,
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error executing build chain', error);
        return {
          success: false,
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * Execute custom script
   */
  ipcMain.handle(
    IPC_CHANNELS.BUILD.EXECUTE_CUSTOM_SCRIPT,
    async (_event, request: BuildExecuteCustomScriptRequest): Promise<BuildExecuteCustomScriptResponse> => {
      logWithCategory('info', LogCategory.SCRIPT, `IPC: Executing custom script: ${request.command}`);

      try {
        // Create progress throttler (max 10 events per second)
        const progressThrottler = new ProgressThrottler(10);

        const buildOrchestrator = createBuildOrchestrator((progress) => {
          progressThrottler.emit(progress, (throttledProgress) => {
            if (mainWindow) {
              mainWindow.webContents.send(IPC_CHANNELS.BUILD.PROGRESS, throttledProgress);
            }
          });
        });

        await buildOrchestrator.executeCustomScript(request.command, request.options);

        // Flush any pending progress
        progressThrottler.flush((finalProgress) => {
          if (mainWindow) {
            mainWindow.webContents.send(IPC_CHANNELS.BUILD.PROGRESS, finalProgress);
          }
        });

        return {
          success: true,
          message: 'Custom script executed successfully',
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.SCRIPT, 'Error executing custom script', error);
        return {
          success: false,
          message: 'Custom script execution failed',
          error: error.message || String(error),
        };
      }
    }
  );

  /**
   * Cancel ongoing build operation
   */
  ipcMain.handle(
    IPC_CHANNELS.BUILD.CANCEL,
    async (): Promise<BuildCancelResponse> => {
      logWithCategory('info', LogCategory.GENERAL, 'IPC: Cancelling build operation');

      try {
        const buildOrchestrator = createBuildOrchestrator();
        buildOrchestrator.cancel();

        return {
          success: true,
          message: 'Build operation cancelled',
        };
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error cancelling build operation', error);
        return {
          success: false,
          message: error.message || String(error),
        };
      }
    }
  );

  // ====================
  // Pipeline IPC Handlers
  // ====================

  let currentPipelineOrchestrator: ReturnType<typeof createBuildPipelineOrchestrator> | null = null;

  /**
   * Execute build pipeline
   */
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE.EXECUTE,
    async (_event, request: PipelineExecuteRequest): Promise<PipelineExecuteResponse> => {
      logWithCategory('info', LogCategory.GENERAL, 'IPC: Executing build pipeline', { configPath: request.configPath });

      try {
        // Create new pipeline orchestrator
        currentPipelineOrchestrator = createBuildPipelineOrchestrator();

        // Resolve and load configuration
        const resolvedConfigPath = resolveConfigPath(request.configPath);
        logWithCategory('info', LogCategory.GENERAL, 'Resolved config path', { resolvedConfigPath });
        await currentPipelineOrchestrator.loadConfig(resolvedConfigPath);

        // Ensure workingDirectory is set to userData if not provided
        // This ensures repositories are cloned to {userData}/repositories/
        // where Docker Compose expects them for volume mounts (via environment variables)
        const options = request.options || {};
        if (!options.workingDirectory) {
          options.workingDirectory = mcpSystem.getMCPWorkingDirectory();
          logWithCategory('info', LogCategory.GENERAL, 'Using userData as working directory', { workingDirectory: options.workingDirectory });
        }

        // Create progress throttler
        const progressThrottler = new ProgressThrottler(10);

        // Execute pipeline with progress tracking
        const result = await currentPipelineOrchestrator.executePipeline(
          options,
          (progress) => {
            progressThrottler.emit(progress, (throttledProgress) => {
              if (mainWindow) {
                mainWindow.webContents.send(IPC_CHANNELS.PIPELINE.PROGRESS, throttledProgress);
              }
            });
          }
        );

        // Flush any pending progress
        progressThrottler.flush((finalProgress) => {
          if (mainWindow) {
            mainWindow.webContents.send(IPC_CHANNELS.PIPELINE.PROGRESS, finalProgress);
          }
        });

        return {
          success: result.success,
          message: result.message,
          result: {
            phase: result.phase,
            clonedRepositories: result.clonedRepositories,
            builtRepositories: result.builtRepositories,
            dockerImages: result.dockerImages,
            verifiedArtifacts: result.verifiedArtifacts,
            errors: result.errors,
            duration: result.duration,
          },
        };
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        logWithCategory('error', LogCategory.GENERAL, 'Error executing build pipeline', { message: errorMessage, stack: errorStack });

        // Log additional context
        if (error.code) {
          logWithCategory('error', LogCategory.GENERAL, `Error code: ${error.code}`);
        }

        return {
          success: false,
          message: 'Build pipeline execution failed',
          error: errorMessage,
        };
      } finally {
        currentPipelineOrchestrator = null;
      }
    }
  );

  /**
   * Cancel ongoing pipeline operation
   */
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE.CANCEL,
    async (): Promise<PipelineCancelResponse> => {
      logWithCategory('info', LogCategory.GENERAL, 'IPC: Cancelling pipeline operation');

      try {
        if (currentPipelineOrchestrator) {
          await currentPipelineOrchestrator.cancel();
          return {
            success: true,
            message: 'Pipeline operation cancelled',
          };
        } else {
          return {
            success: false,
            message: 'No active pipeline operation to cancel',
          };
        }
      } catch (error: any) {
        logWithCategory('error', LogCategory.ERROR, 'Error cancelling pipeline operation', error);
        return {
          success: false,
          message: error.message || String(error),
        };
      }
    }
  );

  /**
   * Get current pipeline status
   */
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE.GET_STATUS,
    async (): Promise<PipelineStatusResponse> => {
      try {
        if (currentPipelineOrchestrator) {
          const phase = currentPipelineOrchestrator.getCurrentPhase();
          return {
            success: true,
            phase,
            message: `Pipeline is in ${phase} phase`,
          };
        } else {
          return {
            success: true,
            phase: 'idle',
            message: 'No active pipeline',
          };
        }
      } catch (error: any) {
        return {
          success: false,
          phase: 'error',
          message: error.message || String(error),
        };
      }
    }
  );

  // ============================================================================
  // Plugin Management IPC Handlers
  // ============================================================================

  ipcMain.handle('plugins:get-all', async () => {
    try {
      return {
        success: true,
        plugins: pluginManager.getAllPlugins(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Alias for plugins:get-all (for backwards compatibility with 'plugin:list')
  ipcMain.handle('plugin:list', async () => {
    try {
      const plugins = pluginManager.getAllPlugins();
      // Sanitize plugin data - only return serializable fields
      return plugins.map(plugin => ({
        id: plugin.id,
        manifest: plugin.manifest,
        status: plugin.status,
        error: plugin.error,
        // Don't include 'instance' or 'context' as they contain non-serializable functions
      }));
    } catch (error: any) {
      logger.error('Error getting plugin list:', error);
      return [];
    }
  });

  ipcMain.handle('plugins:get-statistics', async () => {
    try {
      return {
        success: true,
        statistics: pluginManager.getStatistics(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('plugins:activate', async (_event, pluginId: string) => {
    try {
      await pluginManager.activatePlugin(pluginId);
      return {
        success: true,
        message: `Plugin ${pluginId} activated`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('plugins:deactivate', async (_event, pluginId: string) => {
    try {
      await pluginManager.deactivatePlugin(pluginId);
      return {
        success: true,
        message: `Plugin ${pluginId} deactivated`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('plugins:reload', async (_event, pluginId: string) => {
    try {
      await pluginManager.reloadPlugin(pluginId);
      return {
        success: true,
        message: `Plugin ${pluginId} reloaded`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Plugin View IPC handlers
  // NEW: Get plugin view URL for embedding in main window
  ipcMain.handle('plugin:get-view-url', async (_event, pluginId: string, viewName: string) => {
    try {
      logWithCategory('info', LogCategory.SYSTEM, `IPC: Getting plugin view URL ${pluginId}:${viewName}`);

      const pluginRegistry = pluginManager.getRegistry();
      const plugin = pluginRegistry?.getPlugin(pluginId);

      if (!plugin) {
        const error = `Plugin ${pluginId} not found`;
        logWithCategory('error', LogCategory.SYSTEM, error);
        throw new Error(error);
      }

      // Get plugin view path
      const pluginDir = plugin.context.plugin.installPath;
      const viewPath = path.join(pluginDir, 'dist', 'renderer', 'index.html');

      logWithCategory('debug', LogCategory.SYSTEM, `Plugin directory: ${pluginDir}`);
      logWithCategory('debug', LogCategory.SYSTEM, `View path: ${viewPath}`);

      // Check if file exists
      if (!fs.existsSync(viewPath)) {
        const error = `Plugin renderer not found at: ${viewPath}`;
        logWithCategory('error', LogCategory.SYSTEM, error);
        throw new Error(error);
      }

      const result = {
        pluginId,
        viewName,
        url: viewPath,
        metadata: {
          name: plugin.manifest.name,
          version: plugin.manifest.version,
          description: plugin.manifest.description,
        },
      };

      logWithCategory('info', LogCategory.SYSTEM, `Plugin view URL retrieved successfully: ${pluginId}:${viewName}`);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to get plugin view URL: ${error.message}`);
      logWithCategory('error', LogCategory.SYSTEM, `Error stack: ${error.stack}`);
      throw error;
    }
  });

  // DEPRECATED: Old plugin:show-view handler (kept for backward compatibility)
  ipcMain.handle('plugin:show-view', async (_event, pluginId: string, viewName: string) => {
    try {
      logWithCategory('warn', LogCategory.SYSTEM, `[DEPRECATED] plugin:show-view called - use ViewRouter instead`);
      logWithCategory('info', LogCategory.SYSTEM, `IPC: Showing plugin view ${pluginId}:${viewName}`);

      const pluginRegistry = pluginManager.getRegistry();
      const plugin = pluginRegistry?.getPlugin(pluginId);

      if (!plugin) {
        const error = `Plugin ${pluginId} not found`;
        logWithCategory('error', LogCategory.SYSTEM, error);
        throw new Error(error);
      }

      // Get plugin view path
      const pluginDir = plugin.context.plugin.installPath;
      const viewPath = path.join(pluginDir, 'dist', 'renderer', 'index.html');

      logWithCategory('debug', LogCategory.SYSTEM, `Plugin directory: ${pluginDir}`);
      logWithCategory('debug', LogCategory.SYSTEM, `View path: ${viewPath}`);

      // Check if file exists
      if (!fs.existsSync(viewPath)) {
        const error = `Plugin renderer not found at: ${viewPath}`;
        logWithCategory('error', LogCategory.SYSTEM, error);
        throw new Error(error);
      }

      await pluginViewManager.showPluginView({
        pluginId,
        viewName,
        url: viewPath,
      });

      logWithCategory('info', LogCategory.SYSTEM, `Plugin view shown successfully: ${pluginId}:${viewName}`);
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to show plugin view: ${error.message}`);
      logWithCategory('error', LogCategory.SYSTEM, `Error stack: ${error.stack}`);
      throw error;
    }
  });

  ipcMain.handle('plugin:hide-view', (_event, pluginId: string, viewName: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Hiding plugin view ${pluginId}:${viewName}`);
    pluginViewManager.hidePluginView(pluginId, viewName);
  });

  ipcMain.handle('plugin:close-view', (_event, pluginId: string, viewName: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Closing plugin view ${pluginId}:${viewName}`);
    pluginViewManager.closePluginView(pluginId, viewName);
  });

  // ========================================
  // Workflow IPC Handlers
  // ========================================

  ipcMain.handle('workflows:list', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Listing workflows');
    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        `SELECT id, name, description, steps, target_type, target_id, status, version,
                run_count, success_count, failure_count, last_run_at, last_run_status,
                created_at, updated_at
         FROM workflows
         ORDER BY updated_at DESC`
      );
      return result.rows;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error listing workflows:', error);
      throw error;
    }
  });

  ipcMain.handle('workflows:get', async (_event, workflowId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Getting workflow ${workflowId}`);
    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        'SELECT * FROM workflows WHERE id = $1',
        [workflowId]
      );
      return result.rows[0] || null;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error getting workflow:', error);
      throw error;
    }
  });

  ipcMain.handle('workflows:execute', async (_event, workflowId: string, initialContext?: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Executing workflow ${workflowId}`);
    try {
      const pool = getDatabasePool();
      const { WorkflowEngine } = await import('./workflow-engine');
      const engine = new WorkflowEngine(pool);

      const result = await engine.executeWorkflow(workflowId, initialContext || {}, 'manual');

      logWithCategory('info', LogCategory.SYSTEM, `Workflow execution completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error executing workflow:', error);
      throw error;
    }
  });

  ipcMain.handle('workflows:cancel', async (_event, runId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Cancelling workflow run ${runId}`);
    try {
      const pool = getDatabasePool();
      const { WorkflowEngine } = await import('./workflow-engine');
      const engine = new WorkflowEngine(pool);

      await engine.cancelWorkflow(runId);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error cancelling workflow:', error);
      throw error;
    }
  });

  ipcMain.handle('workflows:get-runs', async (_event, workflowId: string, limit?: number) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Getting workflow runs for ${workflowId}`);
    try {
      const pool = getDatabasePool();
      const { WorkflowEngine } = await import('./workflow-engine');
      const engine = new WorkflowEngine(pool);

      const runs = await engine.getWorkflowRuns(workflowId, limit);
      return runs;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error getting workflow runs:', error);
      throw error;
    }
  });

  ipcMain.handle('workflows:delete', async (_event, workflowId: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Deleting workflow ${workflowId}`);
    try {
      const pool = getDatabasePool();
      await pool.query('DELETE FROM workflows WHERE id = $1', [workflowId]);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error deleting workflow:', error);
      throw error;
    }
  });

  ipcMain.handle('workflows:create', async (_event, workflow: any) => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Creating new workflow');
    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        `INSERT INTO workflows (name, description, steps, target_type, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          workflow.name,
          workflow.description || null,
          JSON.stringify(workflow.steps),
          workflow.target_type || null,
          workflow.status || 'draft'
        ]
      );
      return result.rows[0];
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error creating workflow:', error);
      throw error;
    }
  });

  ipcMain.handle('workflows:update', async (_event, workflowId: string, updates: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Updating workflow ${workflowId}`);
    try {
      const pool = getDatabasePool();
      const result = await pool.query(
        `UPDATE workflows
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             steps = COALESCE($3, steps),
             status = COALESCE($4, status),
             target_type = COALESCE($5, target_type)
         WHERE id = $6
         RETURNING *`,
        [
          updates.name || null,
          updates.description || null,
          updates.steps ? JSON.stringify(updates.steps) : null,
          updates.status || null,
          updates.target_type || null,
          workflowId
        ]
      );
      return result.rows[0];
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error updating workflow:', error);
      throw error;
    }
  });

  // ========================================
  // Workflow Execution Engine IPC Handlers
  // ========================================

  // Use persistent MCP client for fast workflow operations (no process spawning overhead)
  const workflowExecutor = new WorkflowExecutor(persistentMCPClient);

  // Forward workflow events to renderer
  workflowExecutor.on('workflow:user-input-required', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('workflow:user-input-required', data);

      // Also send prompt to Claude Code terminal if it exists
      // Format the prompt for Claude Code to display
      let promptText = `\r\n\x1b[1;33m[Workflow Input Required]\x1b[0m\r\n` +
                        `\x1b[36m${data.prompt || 'Please provide input'}\x1b[0m\r\n` +
                        `\x1b[90m(Node: ${data.nodeName})\x1b[0m\r\n`;

      // Add character limit information if validation exists
      if (data.validation && (data.validation.minLength || data.validation.maxLength)) {
        const limits: string[] = [];
        if (data.validation.minLength) {
          limits.push(`Min: ${data.validation.minLength} chars`);
        }
        if (data.validation.maxLength) {
          limits.push(`Max: ${data.validation.maxLength} chars`);
        }
        promptText += `\x1b[33mℹ️  ${limits.join(' • ')}\x1b[0m\r\n`;
      }

      promptText += `\x1b[32m>\x1b[0m `;

      mainWindow.webContents.send('terminal:write-prompt', {
        requestId: data.requestId,
        prompt: promptText,
        validation: data.validation
      });
    }
  });

  workflowExecutor.on('workflow:log', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('workflow:log', data);
    }
  });

  // Use the singleton persistent MCP client
  if (!persistentMCPClient) {
    throw new Error('Persistent MCP client not initialized. This should not happen.');
  }
  const workflowClient = persistentMCPClient;

  // Start workflow execution
  ipcMain.handle('workflow:start', async (_event, options: {
    workflowDefId: string;
    version?: string;
    projectId: number;
    userId: number;
    startPhase?: number;
    projectFolder: string;
  }) => {
    logWithCategory('info', LogCategory.WORKFLOW,
      `IPC: Starting workflow execution: ${options.workflowDefId} with project folder: ${options.projectFolder}`);
    try {
      const instanceId = await workflowExecutor.startWorkflow(options);
      return { success: true, instanceId };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to start workflow: ${error.message}`);
      throw error;
    }
  });

  // Stop workflow execution
  ipcMain.handle('workflow:stop', async (_event, instanceId: number) => {
    logWithCategory('info', LogCategory.WORKFLOW,
      `IPC: Stopping workflow instance: ${instanceId}`);
    try {
      workflowExecutor.stopWorkflow(instanceId);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to stop workflow: ${error.message}`);
      throw error;
    }
  });

  // Approve workflow phase
  ipcMain.handle('workflow:approve-phase', async (_event, instanceId: number, phaseNumber: number) => {
    logWithCategory('info', LogCategory.WORKFLOW,
      `IPC: Approving phase ${phaseNumber} for instance ${instanceId}`);
    try {
      const success = workflowExecutor.approvePhase(instanceId, phaseNumber);
      return { success };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to approve phase: ${error.message}`);
      throw error;
    }
  });

  // Reject workflow phase
  ipcMain.handle('workflow:reject-phase', async (_event, instanceId: number, phaseNumber: number, reason: string) => {
    logWithCategory('info', LogCategory.WORKFLOW,
      `IPC: Rejecting phase ${phaseNumber} for instance ${instanceId}: ${reason}`);
    try {
      const success = workflowExecutor.rejectPhase(instanceId, phaseNumber, reason);
      return { success };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to reject phase: ${error.message}`);
      throw error;
    }
  });

  // Handle user input submission
  ipcMain.handle('workflow:send-user-input', async (_event, requestId: string, userInput: any) => {
    logWithCategory('info', LogCategory.WORKFLOW,
      `IPC: User input received for request ${requestId}`);
    try {
      const pending = workflowExecutor.userInputQueue.get(requestId);

      if (pending) {
        pending.resolve(userInput);
        workflowExecutor.userInputQueue.delete(requestId);
        return { success: true };
      } else {
        throw new Error(`No pending input request found: ${requestId}`);
      }
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to handle user input: ${error.message}`);
      throw error;
    }
  });

  // Get workflow execution state
  ipcMain.handle('workflow:get-state', async (_event, instanceId: number) => {
    logWithCategory('info', LogCategory.WORKFLOW,
      `IPC: Getting workflow state: ${instanceId}`);
    try {
      const state = workflowExecutor.getWorkflowState(instanceId);
      return state || null;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to get workflow state: ${error.message}`);
      throw error;
    }
  });

  // Get all running workflows
  ipcMain.handle('workflow:get-running', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Getting running workflows');
    try {
      const workflows = workflowExecutor.getRunningWorkflows();
      return workflows;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to get running workflows: ${error.message}`);
      throw error;
    }
  });

  // Get workflow definitions
  ipcMain.handle('workflow:get-definitions', async (_event, filters?: {
    tags?: string[];
    is_system?: boolean;
    skipCache?: boolean;
  }) => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Getting workflow definitions');
    try {
      // Check cache first (unless skipCache is true)
      if (!filters?.skipCache) {
        const cached = workflowCache.getList();
        if (cached) {
          logWithCategory('debug', LogCategory.WORKFLOW, 'Returning cached workflow definitions');
          return cached;
        }
      }

      // Cache miss or cache skipped - fetch from MCP server
      const definitions = await workflowClient.getWorkflowDefinitions(filters);

      // Cache the result
      workflowCache.setList(definitions);

      return definitions;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to get workflow definitions: ${error.message}`);
      throw error;
    }
  });

  // Get specific workflow definition
  ipcMain.handle('workflow:get-definition', async (_event, workflowDefId: string, version?: string, skipCache?: boolean) => {
    logWithCategory('info', LogCategory.WORKFLOW,
      `IPC: Getting workflow definition: ${workflowDefId} v${version || 'latest'}`);
    try {
      // Check cache first (unless skipCache is true)
      if (!skipCache) {
        const cached = workflowCache.get(workflowDefId, version);
        if (cached) {
          logWithCategory('debug', LogCategory.WORKFLOW, 'Returning cached workflow definition');
          return cached;
        }
      }

      // Cache miss or cache skipped - fetch from MCP server
      const definition = await workflowClient.getWorkflowDefinition(workflowDefId, version);

      // Cache the result if found
      if (definition) {
        workflowCache.set(workflowDefId, definition.version, definition);
      }

      return definition;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to get workflow definition: ${error.message}`);
      throw error;
    }
  });

  // Update workflow node positions
  ipcMain.handle('workflow:update-positions', async (_event, data: {
    workflowId: string;
    positions: Record<string, { x: number; y: number }>;
  }) => {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `IPC: Updating node positions for workflow: ${data.workflowId}`);
    try {
      await workflowClient.updateNodePositions(data.workflowId, data.positions);

      // Invalidate cache for this workflow so next fetch gets updated positions
      workflowCache.invalidate(data.workflowId);

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to update node positions: ${error.message}`);
      throw error;
    }
  });

  // Update individual workflow phase
  ipcMain.handle('workflow:update-phase', async (_event, data: {
    workflowId: string;
    phaseId: number;
    updates: any;
  }) => {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `IPC: Updating phase ${data.phaseId} in workflow: ${data.workflowId}`);
    try {
      const updatedPhase = await workflowClient.updateWorkflowPhase(
        data.workflowId,
        data.phaseId,
        data.updates
      );

      // Invalidate cache for this workflow
      workflowCache.invalidate(data.workflowId);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Successfully updated phase ${data.phaseId} in workflow ${data.workflowId}`);

      return { success: true, phase: updatedPhase };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to update phase: ${error.message}`);
      throw error;
    }
  });

  // Add new phase to workflow
  ipcMain.handle('workflow:add-phase', async (_event, data: {
    workflowId: string;
    newPhase: any;
  }) => {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `IPC: Adding new phase to workflow: ${data.workflowId}`);
    try {
      // Get current workflow
      const workflow = await workflowClient.getWorkflowDefinition(data.workflowId);

      if (!workflow || !workflow.phases_json) {
        throw new Error('Workflow not found or has no phases');
      }

      // Find the next available phase ID
      const maxId = workflow.phases_json.reduce((max, phase) =>
        Math.max(max, phase.id), -1);
      const newPhaseId = maxId + 1;

      // Create the new phase with ID
      const newPhaseWithId = {
        ...data.newPhase,
        id: newPhaseId,
      };

      // Add to phases array
      const updatedPhasesJson = [...workflow.phases_json, newPhaseWithId];

      // Update workflow in database using import (which updates existing workflow)
      await workflowClient.importWorkflowDefinition({
        ...workflow,
        phases_json: updatedPhasesJson,
      });

      // Invalidate cache for this workflow
      workflowCache.invalidate(data.workflowId);

      // Get fresh workflow data
      const updatedWorkflow = await workflowClient.getWorkflowDefinition(data.workflowId);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Successfully added phase ${newPhaseId} to workflow ${data.workflowId}`);

      return { success: true, workflow: updatedWorkflow };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to add phase: ${error.message}`);
      throw error;
    }
  });

  // =============================================
  // GRAPH-BASED WORKFLOW OPERATIONS (N8N-style)
  // =============================================

  // Add node to workflow graph
  ipcMain.handle('workflow:add-node', async (_event, data: {
    workflowId: string;
    newNode: any; // Accept full WorkflowNode object with all properties
  }) => {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `IPC: Adding node to workflow: ${data.workflowId}`);
    try {
      const { randomUUID } = await import('crypto');
      const nodeId = data.newNode.id || randomUUID();

      logWithCategory('info', LogCategory.WORKFLOW,
        `Adding node ${nodeId} (${data.newNode.type}) to workflow ${data.workflowId}`);

      // Store the complete node data including all enhanced fields
      const nodeData = { ...data.newNode };
      delete nodeData.id; // Remove id as it's stored separately

      // Call MCP add_node tool
      await workflowClient.callTool('add_node', {
        workflow_def_id: data.workflowId,
        node_id: nodeId,
        node_type: data.newNode.type,
        node_data: nodeData // Store complete node configuration
      });

      // Invalidate cache for this workflow
      workflowCache.invalidate(data.workflowId);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Successfully added node ${nodeId} to workflow ${data.workflowId}`);

      return { success: true, nodeId };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to add node: ${error.message}`);
      throw error;
    }
  });

  // Delete node from workflow graph
  ipcMain.handle('workflow:delete-node', async (_event, data: {
    workflowId: string;
    nodeId: string;
  }) => {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `IPC: Deleting node ${data.nodeId} from workflow: ${data.workflowId}`);
    try {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Deleting node ${data.nodeId} from workflow ${data.workflowId}`);

      // Call MCP delete_node tool (also removes connected edges)
      await workflowClient.callTool('delete_node', {
        workflow_def_id: data.workflowId,
        node_id: data.nodeId
      });

      // Invalidate cache for this workflow
      workflowCache.invalidate(data.workflowId);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Successfully deleted node ${data.nodeId} from workflow ${data.workflowId}`);

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to delete node: ${error.message}`);
      throw error;
    }
  });

  // Add edge to workflow graph
  ipcMain.handle('workflow:add-edge', async (_event, data: {
    workflowId: string;
    source: string;
    target: string;
    type?: string;
    label?: string;
    condition?: string;
  }) => {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `IPC: Adding edge to workflow: ${data.workflowId}`);
    try {
      const { randomUUID } = await import('crypto');
      const edgeId = randomUUID();

      logWithCategory('info', LogCategory.WORKFLOW,
        `Adding edge ${edgeId} (${data.source} -> ${data.target}) to workflow ${data.workflowId}`);

      // Call MCP create_edge tool
      await workflowClient.callTool('create_edge', {
        workflow_def_id: data.workflowId,
        edge_id: edgeId,
        source_node_id: data.source,
        target_node_id: data.target,
        edge_type: data.type,
        label: data.label,
        condition: data.condition
      });

      // Invalidate cache for this workflow
      workflowCache.invalidate(data.workflowId);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Successfully added edge ${edgeId} to workflow ${data.workflowId}`);

      return { success: true, edgeId };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to add edge: ${error.message}`);
      throw error;
    }
  });

  // Update edge in workflow graph
  ipcMain.handle('workflow:update-edge', async (_event, data: {
    workflowId: string;
    edgeId: string;
    updates: {
      label?: string;
      condition?: string;
      type?: string;
    };
  }) => {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `IPC: Updating edge ${data.edgeId} in workflow: ${data.workflowId}`);
    try {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Updating edge ${data.edgeId} in workflow ${data.workflowId}`);

      // Call MCP update_edge tool
      await workflowClient.callTool('update_edge', {
        workflow_def_id: data.workflowId,
        edge_id: data.edgeId,
        updates: data.updates
      });

      // Invalidate cache for this workflow
      workflowCache.invalidate(data.workflowId);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Successfully updated edge ${data.edgeId} in workflow ${data.workflowId}`);

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to update edge: ${error.message}`);
      throw error;
    }
  });

  // Delete edge from workflow graph
  ipcMain.handle('workflow:delete-edge', async (_event, data: {
    workflowId: string;
    edgeId: string;
  }) => {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `IPC: Deleting edge ${data.edgeId} from workflow: ${data.workflowId}`);
    try {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Deleting edge ${data.edgeId} from workflow ${data.workflowId}`);

      // Call MCP delete_edge tool
      await workflowClient.callTool('delete_edge', {
        workflow_def_id: data.workflowId,
        edge_id: data.edgeId
      });

      // Invalidate cache for this workflow
      workflowCache.invalidate(data.workflowId);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Successfully deleted edge ${data.edgeId} from workflow ${data.workflowId}`);

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to delete edge: ${error.message}`);
      throw error;
    }
  });

  // Update node properties in workflow graph
  ipcMain.handle('workflow:update-node', async (_event, data: {
    workflowId: string;
    nodeId: string;
    updates: any;
  }) => {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `IPC: Updating node ${data.nodeId} in workflow: ${data.workflowId}`);
    try {
      const pool = getDatabasePool();

      // Get current workflow definition
      const workflowResult = await pool.query(
        `SELECT graph_json FROM workflow_definitions
         WHERE id = $1
         ORDER BY version DESC LIMIT 1`,
        [data.workflowId]
      );

      if (workflowResult.rows.length === 0) {
        throw new Error(`Workflow not found: ${data.workflowId}`);
      }

      const row = workflowResult.rows[0];

      // Parse graph_json
      const graphJson = typeof row.graph_json === 'string'
        ? JSON.parse(row.graph_json)
        : row.graph_json;

      if (!graphJson || !graphJson.nodes) {
        throw new Error('Workflow has no graph_json or nodes');
      }

      // Find and update the node
      const nodeIndex = graphJson.nodes.findIndex((n: any) => String(n.id) === String(data.nodeId));
      if (nodeIndex === -1) {
        throw new Error(`Node not found: ${data.nodeId}`);
      }

      // Merge updates into the node
      graphJson.nodes[nodeIndex] = {
        ...graphJson.nodes[nodeIndex],
        ...data.updates
      };

      logWithCategory('info', LogCategory.WORKFLOW,
        `Updating node ${data.nodeId}: ${JSON.stringify(data.updates).substring(0, 200)}`);

      // Save back to database
      await pool.query(
        `UPDATE workflow_definitions
         SET graph_json = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(graphJson), data.workflowId]
      );

      // Invalidate cache for this workflow
      workflowCache.invalidate(data.workflowId);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Successfully updated node ${data.nodeId} in workflow ${data.workflowId}`);

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to update node: ${error.message}`, error);
      throw error;
    }
  });

  // Delete workflow definition (all versions)
  ipcMain.handle('workflow:delete', async (_event, workflowDefId: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Deleting workflow: ${workflowDefId}`);
    try {
      const pool = getDatabasePool();

      // Delete all versions of the workflow - use 'id' column
      const result = await pool.query(
        `DELETE FROM workflow_definitions WHERE id = $1 RETURNING id, version`,
        [workflowDefId]
      );

      logWithCategory('info', LogCategory.WORKFLOW,
        `Deleted ${result.rowCount} version(s) of workflow: ${workflowDefId}`);

      // Invalidate entire cache to refresh the workflow list
      workflowCache.invalidateAll();

      return {
        success: true,
        deletedVersions: result.rowCount,
        workflow_def_id: workflowDefId
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to delete workflow: ${error.message}`);
      throw error;
    }
  });

  // Preview workflow before import
  ipcMain.handle('workflow:preview', async (_event, folderPath: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Previewing workflow from folder: ${folderPath}`);
    try {
      const { FolderImporter } = await import('./workflow/folder-importer');
      const importer = new FolderImporter();
      const preview = await importer.previewWorkflow(folderPath);

      if (!preview) return null;

      // Check if this ID already exists and suggest an incremented version
      const pool = getDatabasePool();
      const existingResult = await pool.query(
        'SELECT id FROM workflow_definitions WHERE id = $1 LIMIT 1',
        [preview.id]
      );

      let suggestedId = preview.id;
      let isDuplicate = (existingResult.rowCount ?? 0) > 0;

      // If duplicate, find next available incremented ID
      if (isDuplicate) {
        let counter = 2;
        while (true) {
          const testId = `${preview.id}-${counter}`;
          const testResult = await pool.query(
            'SELECT id FROM workflow_definitions WHERE id = $1 LIMIT 1',
            [testId]
          );
          if ((testResult.rowCount ?? 0) === 0) {
            suggestedId = testId;
            break;
          }
          counter++;
        }
      }

      return {
        ...preview,
        suggestedId,
        isDuplicate
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to preview workflow: ${error.message}`);
      return null;
    }
  });

  // Import workflow from folder
  ipcMain.handle('workflow:import-from-folder', async (_event, folderPath: string, customId?: string, customName?: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Importing workflow from folder: ${folderPath}${customId ? ` with custom ID: ${customId}` : ''}${customName ? ` with custom name: ${customName}` : ''}`);
    try {
      const { FolderImporter } = await import('./workflow/folder-importer');
      const importer = new FolderImporter();
      const result = await importer.importFromFolder(folderPath, customId, customName);

      // Invalidate cache after successful import
      workflowCache.invalidateAll();

      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to import workflow: ${error.message}`);
      throw error;
    }
  });

  // Re-import workflow (delete old versions and import fresh from folder)
  ipcMain.handle('workflow:reimport', async (_event, workflowDefId: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Re-importing workflow: ${workflowDefId}`);
    try {
      const fs = await import('fs');
      const path = await import('path');
      const pool = getDatabasePool();

      // Try to find the source folder from workflow_imports table
      let folderPath: string | null = null;

      try {
        const importRecord = await pool.query(
          `SELECT source_path FROM workflow_imports WHERE workflow_def_id = $1 ORDER BY imported_at DESC LIMIT 1`,
          [workflowDefId]
        );

        if (importRecord.rows.length > 0) {
          folderPath = importRecord.rows[0].source_path;
        }
      } catch (err: any) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `workflow_imports table not available: ${err.message}`);
      }

      // If not found in imports table, scan workflows directory
      if (!folderPath) {
        const workflowsDir = path.join(__dirname, '..', 'workflows');

        if (fs.existsSync(workflowsDir)) {
          const folders = fs.readdirSync(workflowsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => path.join(workflowsDir, dirent.name));

          // Check each folder for matching workflow_def_id
          for (const folder of folders) {
            const workflowJsonPath = path.join(folder, 'workflow.json');
            if (fs.existsSync(workflowJsonPath)) {
              const content = fs.readFileSync(workflowJsonPath, 'utf8');
              const data = JSON.parse(content);
              if (data.workflow_def_id === workflowDefId) {
                folderPath = folder;
                break;
              }
            }
          }
        }
      }

      if (!folderPath) {
        throw new Error(`Cannot re-import: No source folder found for ${workflowDefId}`);
      }

      // Delete existing versions - use 'id' column
      await pool.query(
        `DELETE FROM workflow_definitions WHERE id = $1`,
        [workflowDefId]
      );

      logWithCategory('info', LogCategory.WORKFLOW,
        `Deleted old versions of ${workflowDefId}, re-importing from ${folderPath}`);

      // Re-import from folder
      const { FolderImporter } = await import('./workflow/folder-importer');
      const importer = new FolderImporter();
      const result = await importer.importFromFolder(folderPath);

      // Invalidate cache
      workflowCache.invalidateAll();

      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to re-import workflow: ${error.message}`);
      throw error;
    }
  });

  // Check workflow dependencies
  ipcMain.handle('workflow:check-dependencies', async (_event, dependencies: any) => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Checking workflow dependencies');
    try {
      const { DependencyResolver } = await import('./workflow/dependency-resolver');
      const resolver = new DependencyResolver();
      return await resolver.checkDependencies(dependencies);
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to check dependencies: ${error.message}`);
      throw error;
    }
  });

  // Import workflow definition directly
  ipcMain.handle('workflow:import-definition', async (_event, workflow: any) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Importing workflow definition: ${workflow.name}`);
    try {
      const result = await workflowClient.importWorkflowDefinition(workflow);

      // Invalidate cache after successful import
      workflowCache.invalidateAll();

      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to import workflow definition: ${error.message}`);
      throw error;
    }
  });

  // Get installed agents
  ipcMain.handle('workflow:get-installed-agents', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Getting installed agents');
    try {
      const { DependencyResolver } = await import('./workflow/dependency-resolver');
      const resolver = new DependencyResolver();
      return await resolver.getInstalledAgents();
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to get installed agents: ${error.message}`);
      throw error;
    }
  });

  // Get installed skills
  ipcMain.handle('workflow:get-installed-skills', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Getting installed skills');
    try {
      const { DependencyResolver } = await import('./workflow/dependency-resolver');
      const resolver = new DependencyResolver();
      return await resolver.getInstalledSkills();
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to get installed skills: ${error.message}`);
      throw error;
    }
  });

  // Read agent file
  ipcMain.handle('document:read-agent', async (_event, agentName: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Reading agent file: ${agentName}`);
    try {
      const fs = await import('fs/promises');
      const os = await import('os');
      const homeDir = os.homedir();
      const agentPath = path.join(homeDir, '.claude', 'agents', `${agentName}.md`);

      const content = await fs.readFile(agentPath, 'utf-8');
      return {
        content,
        filePath: agentPath,
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to read agent: ${error.message}`);
      throw error;
    }
  });

  // Write agent file
  ipcMain.handle('document:write-agent', async (_event, agentName: string, content: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Writing agent file: ${agentName}`);
    try {
      const fs = await import('fs/promises');
      const os = await import('os');
      const homeDir = os.homedir();
      const agentsDir = path.join(homeDir, '.claude', 'agents');
      const agentPath = path.join(agentsDir, `${agentName}.md`);

      // Ensure directory exists
      await fs.mkdir(agentsDir, { recursive: true });

      await fs.writeFile(agentPath, content, 'utf-8');
      logWithCategory('info', LogCategory.WORKFLOW, `Agent file saved: ${agentPath}`);

      return { success: true, filePath: agentPath };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to write agent: ${error.message}`);
      throw error;
    }
  });

  // Read skill file
  ipcMain.handle('document:read-skill', async (_event, skillName: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Reading skill file: ${skillName}`);
    try {
      const fs = await import('fs/promises');
      const os = await import('os');
      const homeDir = os.homedir();

      // Try both single file and directory formats
      const singleFilePath = path.join(homeDir, '.claude', 'skills', `${skillName}.md`);
      const dirFilePath = path.join(homeDir, '.claude', 'skills', skillName, 'SKILL.md');

      let content: string;
      let filePath: string;

      try {
        content = await fs.readFile(singleFilePath, 'utf-8');
        filePath = singleFilePath;
      } catch {
        content = await fs.readFile(dirFilePath, 'utf-8');
        filePath = dirFilePath;
      }

      return { content, filePath };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to read skill: ${error.message}`);
      throw error;
    }
  });

  // Write skill file
  ipcMain.handle('document:write-skill', async (_event, skillName: string, content: string, filePath?: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Writing skill file: ${skillName}`);
    try {
      const fs = await import('fs/promises');
      const os = await import('os');
      const homeDir = os.homedir();

      // Use provided path or determine from skill name
      let targetPath = filePath;
      if (!targetPath) {
        const singleFilePath = path.join(homeDir, '.claude', 'skills', `${skillName}.md`);
        const dirFilePath = path.join(homeDir, '.claude', 'skills', skillName, 'SKILL.md');

        // Check which format exists
        try {
          await fs.access(singleFilePath);
          targetPath = singleFilePath;
        } catch {
          try {
            await fs.access(dirFilePath);
            targetPath = dirFilePath;
          } catch {
            // Default to single file format
            targetPath = singleFilePath;
          }
        }
      }

      await fs.writeFile(targetPath, content, 'utf-8');
      logWithCategory('info', LogCategory.WORKFLOW, `Skill file saved: ${targetPath}`);

      return { success: true, filePath: targetPath };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to write skill: ${error.message}`);
      throw error;
    }
  });

  // Import agent from single file
  ipcMain.handle('document:import-agent-file', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Importing agent from file');
    try {
      const { dialog } = await import('electron');
      const result = await dialog.showOpenDialog({
        title: 'Import Agent File',
        properties: ['openFile'],
        filters: [
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        buttonLabel: 'Import Agent'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const fs = await import('fs/promises');
      const sourcePath = result.filePaths[0];
      const content = await fs.readFile(sourcePath, 'utf-8');
      const fileName = path.basename(sourcePath, '.md');

      logWithCategory('info', LogCategory.WORKFLOW, `Agent imported from: ${sourcePath}`);

      return {
        canceled: false,
        fileName,
        content,
        sourcePath
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to import agent file: ${error.message}`);
      throw error;
    }
  });

  // Import agents from folder
  ipcMain.handle('document:import-agent-folder', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Importing agents from folder');
    try {
      const { dialog } = await import('electron');
      const result = await dialog.showOpenDialog({
        title: 'Import Agents from Folder',
        properties: ['openDirectory'],
        buttonLabel: 'Import Agents'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const fs = await import('fs/promises');
      const folderPath = result.filePaths[0];
      const files = await fs.readdir(folderPath);

      const agents: Array<{ fileName: string; content: string; sourcePath: string }> = [];

      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(folderPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const fileName = path.basename(file, '.md');
          agents.push({ fileName, content, sourcePath: filePath });
        }
      }

      logWithCategory('info', LogCategory.WORKFLOW, `Imported ${agents.length} agent(s) from: ${folderPath}`);

      return {
        canceled: false,
        agents
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to import agent folder: ${error.message}`);
      throw error;
    }
  });

  // Import skill from single file
  ipcMain.handle('document:import-skill-file', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Importing skill from file');
    try {
      const { dialog } = await import('electron');
      const result = await dialog.showOpenDialog({
        title: 'Import Skill File',
        properties: ['openFile'],
        filters: [
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        buttonLabel: 'Import Skill'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const fs = await import('fs/promises');
      const sourcePath = result.filePaths[0];
      const content = await fs.readFile(sourcePath, 'utf-8');
      const fileName = path.basename(sourcePath, '.md');

      logWithCategory('info', LogCategory.WORKFLOW, `Skill imported from: ${sourcePath}`);

      return {
        canceled: false,
        fileName,
        content,
        sourcePath
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to import skill file: ${error.message}`);
      throw error;
    }
  });

  // Import skills from folder
  ipcMain.handle('document:import-skill-folder', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Importing skills from folder');
    try {
      const { dialog } = await import('electron');
      const result = await dialog.showOpenDialog({
        title: 'Import Skills from Folder',
        properties: ['openDirectory'],
        buttonLabel: 'Import Skills'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const fs = await import('fs/promises');
      const folderPath = result.filePaths[0];
      const items = await fs.readdir(folderPath, { withFileTypes: true });

      const skills: Array<{ fileName: string; content: string; sourcePath: string }> = [];

      for (const item of items) {
        if (item.isFile() && item.name.endsWith('.md')) {
          // Single .md file
          const filePath = path.join(folderPath, item.name);
          const content = await fs.readFile(filePath, 'utf-8');
          const fileName = path.basename(item.name, '.md');
          skills.push({ fileName, content, sourcePath: filePath });
        } else if (item.isDirectory()) {
          // Check for SKILL.md in subdirectory
          const skillFilePath = path.join(folderPath, item.name, 'SKILL.md');
          try {
            const content = await fs.readFile(skillFilePath, 'utf-8');
            skills.push({ fileName: item.name, content, sourcePath: skillFilePath });
          } catch {
            // No SKILL.md in this directory, skip
          }
        }
      }

      logWithCategory('info', LogCategory.WORKFLOW, `Imported ${skills.length} skill(s) from: ${folderPath}`);

      return {
        canceled: false,
        skills
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to import skill folder: ${error.message}`);
      throw error;
    }
  });

  // Export workflow to Claude Code format
  ipcMain.handle('workflow:export-claude-code', async (_event, workflowId: string, options?: any) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Exporting workflow to Claude Code format: ${workflowId}`);
    try {
      const { ClaudeCodeExporter } = await import('./workflow/exporters/claude-code-exporter');
      const exporter = new ClaudeCodeExporter();
      const result = await exporter.export(workflowId, options);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to export workflow: ${error.message}`);
      throw error;
    }
  });

  // List exportable workflows
  ipcMain.handle('workflow:list-exportable', async (_event, filters?: any) => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Listing exportable workflows');
    try {
      const { ClaudeCodeExporter } = await import('./workflow/exporters/claude-code-exporter');
      const exporter = new ClaudeCodeExporter();
      return await exporter.listExportableWorkflows(filters);
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to list exportable workflows: ${error.message}`);
      throw error;
    }
  });

  // Validate exported workflow package
  ipcMain.handle('workflow:validate-export', async (_event, exportPath: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Validating export package: ${exportPath}`);
    try {
      const { ClaudeCodeExporter } = await import('./workflow/exporters/claude-code-exporter');
      const exporter = new ClaudeCodeExporter();
      return await exporter.validateExport(exportPath);
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to validate export: ${error.message}`);
      throw error;
    }
  });

  // ========================================
  // Project and Series Management IPC Handlers
  // ========================================

  // Project handlers
  ipcMain.handle('project:create', async (_event, data: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Creating project: ${data.name}`);
    try {
      const { ProjectManager } = await import('./project-manager');
      const projectManager = new ProjectManager();
      return await projectManager.createProject(data);
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to create project: ${error.message}`);
      throw error;
    }
  });

  ipcMain.handle('project:list', async () => {
    logWithCategory('debug', LogCategory.SYSTEM, 'IPC: Listing projects');
    try {
      const { ProjectManager } = await import('./project-manager');
      const projectManager = new ProjectManager();
      return await projectManager.listProjects();
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to list projects: ${error.message}`);
      throw error;
    }
  });

  ipcMain.handle('project:get', async (_event, id: number) => {
    logWithCategory('debug', LogCategory.SYSTEM, `IPC: Getting project ${id}`);
    try {
      const { ProjectManager } = await import('./project-manager');
      const projectManager = new ProjectManager();
      return await projectManager.getProject(id);
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to get project: ${error.message}`);
      throw error;
    }
  });

  ipcMain.handle('project:update', async (_event, id: number, data: any) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Updating project ${id}`);
    try {
      const { ProjectManager } = await import('./project-manager');
      const projectManager = new ProjectManager();
      await projectManager.updateProject(id, data);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to update project: ${error.message}`);
      throw error;
    }
  });

  ipcMain.handle('project:delete', async (_event, id: number) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Deleting project ${id}`);
    try {
      const { ProjectManager } = await import('./project-manager');
      const projectManager = new ProjectManager();
      await projectManager.deleteProject(id);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to delete project: ${error.message}`);
      throw error;
    }
  });

  // ========================================
  // Provider Management Handlers
  // ========================================

  // List all saved providers
  ipcMain.handle('provider:list', async () => {
    try {
      const providerManager = getProviderManager();
      await providerManager.initialize();
      const providers = await providerManager.listSavedProviders();
      return providers;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to list providers: ${error.message}`);
      return { error: error.message };
    }
  });

  // Add new provider
  ipcMain.handle('provider:add', async (_event, provider: LLMProviderConfig) => {
    try {
      const providerManager = getProviderManager();
      await providerManager.initialize();
      const id = await providerManager.saveProvider(provider);
      return { success: true, id };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to add provider: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Update existing provider
  ipcMain.handle('provider:update', async (_event, id: string, provider: LLMProviderConfig) => {
    try {
      const providerManager = getProviderManager();
      await providerManager.initialize();
      const updatedProvider = { ...provider, id };
      await providerManager.saveProvider(updatedProvider);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to update provider: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Delete provider
  ipcMain.handle('provider:delete', async (_event, id: string) => {
    try {
      const providerManager = getProviderManager();
      await providerManager.initialize();
      await providerManager.deleteProvider(id);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to delete provider: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Test provider credentials
  ipcMain.handle('provider:test', async (_event, provider: LLMProviderConfig) => {
    try {
      const providerManager = getProviderManager();
      await providerManager.initialize();
      const result = await providerManager.validateProvider(provider);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Provider test failed: ${error.message}`);
      return { valid: false, error: error.message };
    }
  });

  // Get all available LLM providers (for workflow node configuration)
  ipcMain.handle('llm-providers:get-all', async () => {
    try {
      const providerManager = getProviderManager();
      await providerManager.initialize();

      // Get saved providers from credential store
      const savedProviders = await providerManager.listSavedProviders();

      // If no saved providers, return a default Claude Code CLI provider
      if (!savedProviders || savedProviders.length === 0) {
        logWithCategory('info', LogCategory.WORKFLOW, 'No saved providers, returning default Claude Code CLI');
        return [{
          id: 'default-claude-code-cli',
          type: 'claude-code-cli',
          name: 'Claude Code (Default)',
          enabled: true,
          config: {
            model: 'claude-sonnet-4-5',
            headless: true,
            outputFormat: 'text'
          }
        }];
      }

      return savedProviders;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to get LLM providers: ${error.message}`);
      // Return default provider even on error
      return [{
        id: 'default-claude-code-cli',
        type: 'claude-code-cli',
        name: 'Claude Code (Default)',
        enabled: true,
        config: {
          model: 'claude-sonnet-4-5',
          headless: true,
          outputFormat: 'text'
        }
      }];
    }
  });

  // ========================================
  // Context & Variable Handlers
  // ========================================

  // Evaluate JSONPath expression (for testing in UI)
  ipcMain.handle('workflow:evaluate-jsonpath', async (_event, expression: string, context: any) => {
    try {
      const contextManager = new ContextManager();
      const result = contextManager.evaluateJSONPath(expression, context);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Test condition expression (for conditional nodes)
  ipcMain.handle('workflow:test-condition', async (_event, condition: string, context: any) => {
    try {
      const contextManager = new ContextManager();
      const result = contextManager.evaluateCondition(condition, context);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ========================================
  // File Browser Handlers
  // ========================================

  // Open file picker dialog
  ipcMain.handle('dialog:open-file', async (_event, options?: { defaultPath?: string }) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        defaultPath: options?.defaultPath,
      });

      if (result.canceled) {
        return { canceled: true };
      }

      return { canceled: false, filePath: result.filePaths[0] };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `File dialog error: ${error.message}`);
      return { error: error.message };
    }
  });

  // Open folder picker dialog
  ipcMain.handle('dialog:open-folder', async (_event, options?: { defaultPath?: string }) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: options?.defaultPath,
      });

      if (result.canceled) {
        return { canceled: true };
      }

      return { canceled: false, folderPath: result.filePaths[0] };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Folder dialog error: ${error.message}`);
      return { error: error.message };
    }
  });

  // Shell operations
  ipcMain.handle('shell:open-path', async (_event, path: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Opening path: ${path}`);
    try {
      const result = await shell.openPath(path);
      if (result) {
        // openPath returns empty string on success, error message on failure
        logWithCategory('error', LogCategory.SYSTEM, `Failed to open path: ${result}`);
        throw new Error(result);
      }
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to open path: ${error.message}`);
      throw error;
    }
  });

  // Automated Claude Code CLI installation
  ipcMain.handle('claude:install-cli', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Installing Claude Code CLI');
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Install via npm globally
      logWithCategory('info', LogCategory.SYSTEM, 'Running: npm install -g @anthropic-ai/claude-code');

      const { stdout, stderr } = await execAsync('npm install -g @anthropic-ai/claude-code', {
        timeout: 120000 // 2 minutes timeout
      });

      logWithCategory('info', LogCategory.SYSTEM, `Installation output: ${stdout}`);

      if (stderr && !stderr.includes('npm WARN')) {
        logWithCategory('warn', LogCategory.SYSTEM, `Installation warnings: ${stderr}`);
      }

      return { success: true, message: 'Claude Code CLI installed successfully' };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to install Claude Code CLI: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Installation failed. Make sure npm is installed and you have an internet connection.'
      };
    }
  });

  // Automated Claude Code authentication
  ipcMain.handle('claude:authenticate', async () => {
    logWithCategory('info', LogCategory.SYSTEM, 'IPC: Authenticating with Claude');
    try {
      const { spawn } = require('child_process');

      // Run claude auth login in interactive mode
      // This will open a browser for the user to authenticate
      logWithCategory('info', LogCategory.SYSTEM, 'Running: claude auth login');

      return new Promise((resolve) => {
        const authProcess = spawn('claude', ['auth', 'login'], {
          stdio: 'inherit', // Allow browser interaction
          shell: true
        });

        authProcess.on('close', (code: number) => {
          if (code === 0) {
            logWithCategory('info', LogCategory.SYSTEM, 'Authentication successful');
            resolve({ success: true, message: 'Authentication successful' });
          } else {
            logWithCategory('error', LogCategory.SYSTEM, `Authentication failed with code ${code}`);
            resolve({
              success: false,
              error: `Authentication process exited with code ${code}`
            });
          }
        });

        authProcess.on('error', (error: Error) => {
          logWithCategory('error', LogCategory.SYSTEM, `Authentication error: ${error.message}`);
          resolve({
            success: false,
            error: error.message
          });
        });
      });
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to authenticate: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Authentication failed'
      };
    }
  });

  // Forward node-based workflow events to renderer (phase-based system removed)
  workflowExecutor.on('node-started', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('workflow:node-started', data);
    }
  });

  workflowExecutor.on('node-completed', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('workflow:node-completed', data);
    }
  });

  workflowExecutor.on('node-failed', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('workflow:node-failed', data);
    }
  });

  // Forward Claude Code setup required event to renderer
  workflowExecutor.on('claude-setup-required', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Forwarding claude-setup-required to renderer: ${data.reason}`);
      mainWindow.webContents.send('claude-setup-required', data);
    }
  });

  // Forward Claude Code output to terminal in real-time
  workflowExecutor.on('claude-output', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Stream output to terminal via terminal:data event
      mainWindow.webContents.send('claude-code:stream', data);
    }
  });

  // Also listen to provider manager events for claude-setup-required
  // (from ClaudeCodeCLIAdapter which creates its own executor instance)
  const providerManager = getProviderManager();
  providerManager.on('claude-setup-required', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Forwarding claude-setup-required from provider manager to renderer: ${data.reason}`);
      mainWindow.webContents.send('claude-setup-required', data);
    }
  });

  // ========================================
  // PTY (Terminal) IPC Handlers
  // ========================================

  const ptyManager = new PTYManager();

  // Initialize ClaudeCodeExecutor singleton with PTY manager
  // This ensures interactive mode can use PTY terminals
  ClaudeCodeExecutor.getInstance(ptyManager);

  // Forward PTY output to renderer
  ptyManager.on('terminal:data', (data) => {
    console.log(`[IPC] Forwarding terminal data to renderer:`, data.data?.substring(0, 50));
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', data);
    }
  });

  ptyManager.on('terminal:exit', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:exit', data);
    }
  });

  ptyManager.on('terminal:error', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:error', data);
    }
  });

  // Create terminal session
  ipcMain.handle('terminal:create', async (_event, options: {
    id: string;
    command: string;
    args: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    cols?: number;
    rows?: number;
  }) => {
    logWithCategory('info', LogCategory.SYSTEM,
      `IPC: Creating terminal ${options.id}: ${options.command} ${options.args.join(' ')}`);
    try {
      ptyManager.createTerminal(options);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM,
        `Failed to create terminal: ${error.message}`);
      throw error;
    }
  });

  // Send input to terminal
  ipcMain.handle('terminal:input', async (_event, id: string, data: string) => {
    console.log(`[IPC] terminal:input received for ${id}:`, data);
    ptyManager.writeToTerminal(id, data);
    return { success: true };
  });

  // Resize terminal
  ipcMain.handle('terminal:resize', async (_event, id: string, cols: number, rows: number) => {
    ptyManager.resizeTerminal(id, cols, rows);
    return { success: true };
  });

  // Close terminal
  ipcMain.handle('terminal:close', async (_event, id: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Closing terminal ${id}`);
    ptyManager.closeTerminal(id);
    return { success: true };
  });

  // Get active terminals
  ipcMain.handle('terminal:list', async () => {
    return { terminals: ptyManager.getActiveTerminals() };
  });

  // Cleanup PTY sessions on app quit
  app.on('before-quit', () => {
    logWithCategory('info', LogCategory.SYSTEM, 'Closing all terminal sessions');
    ptyManager.closeAll();
  });

  logger.info('IPC handlers registered');
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Initialize logging system after app is ready
  initializeLogger();
  logger.info('App is ready');

  // Set Windows App User Model ID for proper taskbar behavior
  if (process.platform === 'win32') {
    app.setAppUserModelId('net.fictionlab.studio');
  }

  // Initialize database pool and persistent MCP client BEFORE setupIPC
  // (IPC handlers need the client to be ready)
  try {
    logWithCategory('info', LogCategory.SYSTEM, 'Initializing database pool...');
    await initializeDatabasePool();
    logWithCategory('info', LogCategory.SYSTEM, 'Database pool initialized');

    logWithCategory('info', LogCategory.SYSTEM, 'Initializing persistent MCP client...');
    persistentMCPClient = new PersistentMCPClient();
    await persistentMCPClient.start();
    logWithCategory('info', LogCategory.SYSTEM, 'Persistent MCP client initialized successfully');
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error initializing database/MCP client:', error);
    // Fatal error - show error dialog and quit
    dialog.showErrorBox('Initialization Error',
      `Failed to initialize database or MCP client: ${error}\n\nThe application will now exit.`);
    app.quit();
    return;
  }

  setupIPC();
  createMenu();

  // Initialize GitHub credentials from environment
  try {
    const config = await envConfig.loadEnvConfig();
    if (config.GITHUB_TOKEN) {
      const { getGitHubCredentialManager } = await import('./github-credential-manager');
      getGitHubCredentialManager(config.GITHUB_TOKEN);
      logger.info('GitHub credentials initialized from environment');
    }
  } catch (error) {
    logger.warn('Error initializing GitHub credentials from environment:', error);
  }

  // Check if this is the first run
  const isFirst = await setupWizard.isFirstRun();
  logger.info(`First run: ${isFirst}`);

  if (isFirst) {
    // Show setup wizard
    createWizardWindow();
  } else {
    // Check for pending migrations before showing main window
    try {
      logWithCategory('info', LogCategory.SYSTEM, 'Checking for pending migrations...');
      const pendingMigrations = await migrations.checkForPendingMigrations();

      if (pendingMigrations.hasPending) {
        logWithCategory('info', LogCategory.SYSTEM,
          `Found ${pendingMigrations.migrations.length} pending migrations ` +
          `(${pendingMigrations.criticalCount} critical, ${pendingMigrations.optionalCount} optional)`
        );

        // Log each pending migration
        pendingMigrations.migrations.forEach(migration => {
          logWithCategory('info', LogCategory.SYSTEM,
            `  - Migration ${migration.version}: ${migration.description} ` +
            `(${migration.steps.length} steps, critical: ${migration.critical || false})`
          );
        });

        // If there are critical migrations, they should be handled
        if (pendingMigrations.criticalCount > 0) {
          logWithCategory('warn', LogCategory.SYSTEM,
            'Critical migrations detected! Showing migration wizard.'
          );
        }

        // Show migration wizard instead of main window
        createMigrationWizardWindow();
        return; // Don't continue to create main window
      } else {
        logWithCategory('info', LogCategory.SYSTEM, 'No pending migrations found');
      }
    } catch (error) {
      logger.error('Error checking for pending migrations:', error);
      // Non-fatal, just log and continue
    }

    // Show main application window
    createWindow();

    // Initialize plugin system after main window is created
    // (Database and MCP client are already initialized before setupIPC)
    try {
      logWithCategory('info', LogCategory.SYSTEM, 'Initializing plugin system...');

      // Initialize plugin manager
      await pluginManager.initialize();

      // Set main window reference for plugin UI interactions
      if (mainWindow) {
        pluginManager.setMainWindow(mainWindow);
      }

      logWithCategory('info', LogCategory.SYSTEM, 'Plugin system initialized successfully');
    } catch (error) {
      logWithCategory('error', LogCategory.SYSTEM, 'Error initializing plugin system:', error);
      // Non-fatal, just log and continue
    }

    // Auto-check for updates on startup (only for non-first-run)
    try {
      const shouldCheck = await updater.shouldAutoCheck();
      if (shouldCheck) {
        logWithCategory('info', LogCategory.SYSTEM, 'Auto-checking for updates...');
        const updates = await updater.checkForAllUpdates();

        if (updates.hasUpdates) {
          logWithCategory('info', LogCategory.SYSTEM, 'Updates available!');
          // Notify renderer if window is ready
          if (mainWindow) {
            mainWindow.webContents.send('updater:auto-check-complete', updates);
          }
        } else {
          logWithCategory('info', LogCategory.SYSTEM, 'All components are up to date');
        }
      }
    } catch (error) {
      logger.error('Error during auto-update check:', error);
      // Non-fatal, just log and continue
    }
  }

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      // Check again if first run when re-activating
      setupWizard.isFirstRun().then(isFirst => {
        if (isFirst) {
          createWizardWindow();
        } else {
          createWindow();
        }
      });
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app before quit
app.on('before-quit', async () => {
  logger.info('App is quitting...');

  // Shut down persistent MCP client
  try {
    if (persistentMCPClient) {
      logWithCategory('info', LogCategory.SYSTEM, 'Shutting down persistent MCP client...');
      await persistentMCPClient.shutdown();
    }
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error shutting down persistent MCP client:', error);
  }

  // Clean up plugin system
  try {
    logWithCategory('info', LogCategory.SYSTEM, 'Cleaning up plugin system...');
    await pluginManager.cleanup();
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error cleaning up plugin system:', error);
  }

  // Close database connection pool
  try {
    await closeDatabasePool();
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error closing database pool:', error);
  }
});

// Log any unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});
