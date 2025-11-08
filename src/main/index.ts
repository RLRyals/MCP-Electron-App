import { app, BrowserWindow, ipcMain, Menu } from 'electron';
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
import * as envConfig from './env-config';
import * as installationWizard from './installation-wizard';

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
          label: 'Report Issue',
          click: async () => {
            try {
              await openGitHubIssue('General Issue', 'Please describe the issue');
            } catch (error) {
              logger.error('Error opening GitHub issue:', error);
            }
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
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
    return await envConfig.saveEnvConfig(config);
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

  logger.info('IPC handlers registered');
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  logger.info('App is ready');
  setupIPC();
  createMenu();
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
