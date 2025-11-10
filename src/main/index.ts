import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
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
import * as mcpSystem from './mcp-system';
import * as updater from './updater';
import * as setupWizard from './setup-wizard';
import { repositoryManager } from './repository-manager';
import { createBuildOrchestrator } from './build-orchestrator';
import { createBuildPipelineOrchestrator, resolveConfigPath } from './build-pipeline-orchestrator';
import { ProgressThrottler, IPC_CHANNELS } from '../types/ipc';
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

// Initialize logging system
initializeLogger();

let mainWindow: BrowserWindow | null = null;

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
          label: 'About MCP Electron App',
          click: () => {
            const aboutMessage = `MCP Electron App v${app.getVersion()}\n\nA user-friendly desktop application for managing the MCP Writing System.\n\nCopyright © 2025 MCP Team\nLicense: MIT`;
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About MCP Electron App',
              message: 'MCP Electron App',
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

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
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
 * Create the main application window
 */
function createWindow(): void {
  logger.info('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'MCP Electron App',
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

  logger.info('Main window created');
}

/**
 * Set up IPC handlers for communication between main and renderer processes
 */
function setupIPC(): void {
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
    const validation = envConfig.validateConfig(config);
    if (!validation.valid) {
      return { success: false, error: 'Validation failed: ' + validation.errors.join(', ') };
    }
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

  ipcMain.handle('client:get-selection-file-path', async () => {
    return clientSelection.getSelectionFilePath();
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

  ipcMain.handle('mcp-system:urls', async () => {
    logWithCategory('info', LogCategory.DOCKER, 'IPC: Getting service URLs...');
    return await mcpSystem.getServiceUrls();
  });

  ipcMain.handle('mcp-system:logs', async (_, serviceName: 'postgres' | 'mcp-writing-system' | 'mcp-connector' | 'typing-mind', tail?: number) => {
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
    return await setupWizard.markWizardComplete();
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

        // Create progress throttler
        const progressThrottler = new ProgressThrottler(10);

        // Execute pipeline with progress tracking
        const result = await currentPipelineOrchestrator.executePipeline(
          request.options || {},
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

  logger.info('IPC handlers registered');
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  logger.info('App is ready');
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
    // Show main application window
    createWindow();

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
app.on('before-quit', () => {
  logger.info('App is quitting...');
});

// Log any unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});
