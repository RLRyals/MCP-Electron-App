import { ipcMain, dialog, BrowserWindow } from 'electron';
import { pluginManager } from '../plugin-manager';
import { WorkflowEngine } from '../workflow-engine';
import { logWithCategory, LogCategory } from '../logger';
import { getDatabasePool } from '../database-connection';

/**
 * Register import handlers
 */
export function registerImportHandlers() {
  // Import Plugin
  ipcMain.handle('import:plugin', async (event, sourcePath: string) => {
    try {
      return await pluginManager.importPlugin(sourcePath);
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Import plugin failed via IPC', error);
      throw error;
    }
  });

  // Import Workflow
  ipcMain.handle('import:workflow', async (event, sourcePath: string) => {
    try {
      const dbPool = getDatabasePool();
      const workflowEngine = new WorkflowEngine(dbPool);
      return await workflowEngine.importWorkflow(sourcePath);
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'Import workflow failed via IPC', error);
      throw error;
    }
  });

  // Show Open Dialog
  ipcMain.handle('dialog:show-open-dialog', async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return { canceled: true, filePaths: [] };
    
    return await dialog.showOpenDialog(window, options);
  });
}
