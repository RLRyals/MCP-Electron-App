import { FictionLabPlugin, PluginContext } from './types/plugin-api';
import { WorkflowRunner } from '@fictionlab/workflow-runner';
import { MCPClientAdapter } from './mcp-client-adapter';
import { ElectronPlatformAdapter } from './electron-platform-adapter';
import { registerIPCHandlers } from './ipc-handlers';
import { IDEIPCServer } from './ide-ipc-server';
import { BrowserWindow } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export default class WorkflowPlugin implements FictionLabPlugin {
  readonly id = 'fictionlab-workflow';
  readonly name = 'Workflow System';
  readonly version = '1.0.0';

  private runner: WorkflowRunner | null = null;
  private ipcServer: IDEIPCServer | null = null;

  async onActivate(context: PluginContext): Promise<void> {
    console.log('[Workflow Plugin] Activating...');

    // 1. Install global Claude Code skill
    await this.installGlobalSkill();

    // 2. Create MCP client adapter (wraps FictionLab's PersistentMCPClient)
    const mcpClient = new MCPClientAdapter(context);

    // 3. Create Electron platform adapter
    const mainWindow = BrowserWindow.getAllWindows()[0];
    const platformAdapter = new ElectronPlatformAdapter(context, mainWindow);

    // 4. Initialize workflow runner with injected dependencies
    this.runner = new WorkflowRunner({
      mcpClient,
      platformAdapter
    });

    // 5. Register IPC handlers for renderer communication
    registerIPCHandlers(context, this.runner);

    // 6. Start IDE IPC server for Claude Code skill
    await this.startIDEIPCServer();

    console.log('[Workflow Plugin] Activated successfully');
  }

  async onDeactivate(): Promise<void> {
    console.log('[Workflow Plugin] Deactivating...');

    // Shutdown IPC server
    if (this.ipcServer) {
      await this.ipcServer.shutdown();
      this.ipcServer = null;
    }

    // Shutdown workflow runner
    if (this.runner) {
      await this.runner.shutdown();
      this.runner = null;
    }

    console.log('[Workflow Plugin] Deactivated');
  }

  /**
   * Install global Claude Code skill to ~/.claude/skills/run-workflow
   */
  private async installGlobalSkill(): Promise<void> {
    try {
      const homeDir = os.homedir();
      const globalSkillDir = path.join(homeDir, '.claude', 'skills', 'run-workflow');
      const localSkillDir = path.join(__dirname, '../skills/run-workflow');

      console.log('[Workflow Plugin] Installing global skill...');
      console.log(`  Source: ${localSkillDir}`);
      console.log(`  Target: ${globalSkillDir}`);

      // Ensure target directory exists
      await fs.ensureDir(path.dirname(globalSkillDir));

      // Copy skill files to global location
      await fs.copy(localSkillDir, globalSkillDir, { overwrite: true });

      console.log('[Workflow Plugin] Global skill installed successfully');
    } catch (error) {
      console.error('[Workflow Plugin] Failed to install global skill:', error);
      // Don't throw - skill installation is optional
    }
  }

  /**
   * Start IDE IPC server for Claude Code skill communication
   */
  private async startIDEIPCServer(): Promise<void> {
    try {
      if (!this.runner) {
        throw new Error('Workflow runner not initialized');
      }

      this.ipcServer = new IDEIPCServer(this.runner);
      await this.ipcServer.start();

      console.log('[Workflow Plugin] IDE IPC server started successfully');
    } catch (error) {
      console.error('[Workflow Plugin] Failed to start IDE IPC server:', error);
      // Don't throw - IPC server is optional
    }
  }
}
