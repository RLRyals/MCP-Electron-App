import { FictionLabPlugin, PluginContext } from '../../../src/types/plugin-api';
// Import from bundled workflow-runner (copied during plugin deployment)
// In dev: resolves via package.json "file:" reference
// In production: resolves from bundled/workflow-runner/dist
import { WorkflowRunner } from '@fictionlab/workflow-runner';
import { MCPClientAdapter } from './mcp-client-adapter';
import { ElectronPlatformAdapter } from './electron-platform-adapter';
import { registerIPCHandlers } from './ipc-handlers';
import { WorkflowIPCServer } from './workflow-ipc-server';
import { BrowserWindow } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export default class WorkflowPlugin implements FictionLabPlugin {
  readonly id = 'fictionlab-workflow';
  readonly name = 'Workflow System';
  readonly version = '1.1.0';

  private runner: WorkflowRunner | null = null;
  private ipcServer: WorkflowIPCServer | null = null;
  private context: PluginContext | null = null;

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: any[]): void {
    if (this.context?.logger) {
      this.context.logger[level](message, ...args);
    } else {
      console[level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log'](`[Workflow Plugin] ${message}`, ...args);
    }
  }

  async onActivate(context: PluginContext): Promise<void> {
    this.context = context;
    this.log('info', 'Activating workflow plugin...');

    try {
      // 1. Install global Claude Code skill
      await this.installGlobalSkill();

      // 2. Create MCP client adapter (wraps FictionLab's PersistentMCPClient)
      this.log('debug', 'Creating MCP client adapter...');
      const mcpClient = new MCPClientAdapter(context);

      // 3. Create Electron platform adapter
      this.log('debug', 'Creating Electron platform adapter...');
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const platformAdapter = new ElectronPlatformAdapter(context, mainWindow);

      // 4. Initialize workflow runner with injected dependencies
      this.log('debug', 'Initializing WorkflowRunner...');
      this.runner = new WorkflowRunner({
        mcpClient,
        platformAdapter
      });

      // 5. Register IPC handlers for renderer communication
      this.log('debug', 'Registering IPC handlers...');
      registerIPCHandlers(context, this.runner);

      // 6. Start IDE IPC server for Claude Code skill
      this.log('info', 'Starting IDE IPC server...');
      await this.startWorkflowIPCServer();

      this.log('info', 'Workflow plugin activated successfully');
    } catch (error: any) {
      this.log('error', 'Failed to activate workflow plugin:', error.message, error.stack);
      throw error;
    }
  }

  async onDeactivate(): Promise<void> {
    this.log('info', 'Deactivating workflow plugin...');

    // Shutdown IPC server
    if (this.ipcServer) {
      try {
        await this.ipcServer.shutdown();
        this.log('info', 'IDE IPC server shutdown complete');
      } catch (error: any) {
        this.log('error', 'Error shutting down IDE IPC server:', error.message);
      }
      this.ipcServer = null;
    }

    // Shutdown workflow runner
    if (this.runner) {
      try {
        await this.runner.shutdown();
        this.log('info', 'Workflow runner shutdown complete');
      } catch (error: any) {
        this.log('error', 'Error shutting down workflow runner:', error.message);
      }
      this.runner = null;
    }

    this.log('info', 'Workflow plugin deactivated');
  }

  /**
   * Install global Claude Code skill to ~/.claude/skills/run-workflow
   */
  private async installGlobalSkill(): Promise<void> {
    try {
      const homeDir = os.homedir();
      const globalSkillDir = path.join(homeDir, '.claude', 'skills', 'run-workflow');
      const localSkillDir = path.join(__dirname, '../skills/run-workflow');

      this.log('info', `Installing global skill from ${localSkillDir} to ${globalSkillDir}`);

      // Ensure target directory exists
      await fs.ensureDir(path.dirname(globalSkillDir));

      // Copy skill files to global location
      await fs.copy(localSkillDir, globalSkillDir, { overwrite: true });

      this.log('info', 'Global skill installed successfully');
    } catch (error: any) {
      this.log('error', 'Failed to install global skill:', error.message);
      // Don't throw - skill installation is optional
    }
  }

  /**
   * Start IDE IPC server for Claude Code skill communication
   */
  private async startWorkflowIPCServer(): Promise<void> {
    try {
      if (!this.runner) {
        throw new Error('Workflow runner not initialized');
      }

      const socketPath = process.platform === 'win32'
        ? '\\\\.\\pipe\\fictionlab-workflow-runner'
        : '/tmp/fictionlab-workflow-runner.sock';

      this.log('info', `Creating IDE IPC server on ${socketPath}`);
      this.ipcServer = new WorkflowIPCServer(this.runner);

      this.log('debug', 'Calling ipcServer.start()...');
      await this.ipcServer.start();

      this.log('info', `IDE IPC server started successfully on ${socketPath}`);
    } catch (error: any) {
      this.log('error', 'Failed to start IDE IPC server:', error.message, error.stack);
      // Don't throw - IPC server is optional
    }
  }
}
