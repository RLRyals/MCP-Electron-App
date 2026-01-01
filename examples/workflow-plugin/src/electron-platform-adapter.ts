import { PlatformAdapter } from '../bundled/workflow-runner/dist';
import { PluginContext } from './types/plugin-api';
import { BrowserWindow } from 'electron';

/**
 * Electron-specific platform adapter
 * Handles UI interactions and LLM execution
 */
export class ElectronPlatformAdapter implements PlatformAdapter {
  constructor(
    private context: PluginContext,
    private mainWindow: BrowserWindow
  ) {}

  async executeAgentNode(node: any, context: any): Promise<any> {
    // Use FictionLab's LLM provider system
    // This will be integrated with existing LLMProviderManager

    // For now, send to renderer for UI handling
    return new Promise((resolve) => {
      this.mainWindow.webContents.send('workflow:execute-agent-node', {
        node,
        context
      });

      // Listen for response from renderer
      const handler = (_event: any, result: any) => {
        (this.mainWindow.webContents as any).removeListener('workflow:agent-node-result', handler);
        resolve(result);
      };
      (this.mainWindow.webContents as any).on('workflow:agent-node-result', handler);
    });
  }

  async promptUser(prompt: string, options: any): Promise<string> {
    // Show dialog in Electron UI
    return new Promise((resolve) => {
      this.mainWindow.webContents.send('workflow:prompt-user', { prompt, options });

      const handler = (_event: any, response: string) => {
        (this.mainWindow.webContents as any).removeListener('workflow:user-response', handler);
        resolve(response);
      };
      (this.mainWindow.webContents as any).on('workflow:user-response', handler);
    });
  }

  getWorkspaceRoot(): string {
    // Get from FictionLab's project settings
    return this.context.services.environment.getUserDataPath();
  }

  logMessage(level: string, message: string): void {
    // Use FictionLab's logging system
    console.log(`[${level.toUpperCase()}] ${message}`);
  }
}
