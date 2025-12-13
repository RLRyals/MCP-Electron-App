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
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Import plugin request for ${sourcePath}`);
    try {
      const id = await pluginManager.importPlugin(sourcePath);
      logWithCategory('info', LogCategory.SYSTEM, `IPC: Import plugin success, ID: ${id}`);
      return id;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'IPC: Import plugin failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Import Workflow
  ipcMain.handle('import:workflow', async (event, sourcePath: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Import workflow request for ${sourcePath}`);
    try {
      const dbPool = getDatabasePool();
      if (!dbPool) {
        throw new Error('Database pool not initialized');
      }
      const workflowEngine = new WorkflowEngine(dbPool);
      const id = await workflowEngine.importWorkflow(sourcePath);
      logWithCategory('info', LogCategory.SYSTEM, `IPC: Import workflow success, ID: ${id}`);
      return id;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'IPC: Import workflow failed', { error: error.message, stack: error.stack });
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
