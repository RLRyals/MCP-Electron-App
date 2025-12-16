import { ipcMain, dialog, BrowserWindow } from 'electron';
import { WorkflowParser } from '../parsers/workflow-parser';
import { AntigravityWorkflowExporter } from '../exporters/antigravity-workflow-exporter';
import { logWithCategory, LogCategory } from '../logger';
import { getDatabasePool } from '../database-connection';
import * as path from 'path';

/**
 * Register export handlers
 */
export function registerExportHandlers() {
  /**
   * Export workflow to Antigravity format
   */
  ipcMain.handle('export:antigravity', async (event, workflowId: string, outputDir?: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Export workflow to Antigravity: ${workflowId}`);

    try {
      const dbPool = getDatabasePool();
      if (!dbPool) {
        throw new Error('Database pool not initialized');
      }

      // If no output directory specified, show dialog
      let exportDir = outputDir;
      if (!exportDir) {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          throw new Error('No browser window found');
        }

        const result = await dialog.showOpenDialog(window, {
          title: 'Select Export Directory',
          properties: ['openDirectory', 'createDirectory'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          throw new Error('Export canceled by user');
        }

        exportDir = result.filePaths[0];
      }

      // Fetch workflow from database
      const workflowResult = await dbPool.query(
        'SELECT * FROM workflows WHERE id = $1',
        [workflowId]
      );

      if (workflowResult.rows.length === 0) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      const dbWorkflow = workflowResult.rows[0];

      // Convert database workflow to WorkflowDefinition format
      const workflow = {
        id: dbWorkflow.id,
        name: dbWorkflow.name,
        version: '1.0.0',
        description: dbWorkflow.description || '',
        phases: [], // Database workflows don't have phases in the same format
        dependencies: {
          agents: [],
          skills: [],
          mcpServers: ['workflow-manager'],
          subWorkflows: [],
        },
        metadata: {
          author: dbWorkflow.created_by,
          created: dbWorkflow.created_at,
          updated: dbWorkflow.updated_at,
          tags: [],
        },
      };

      // Note: Current database workflows are step-based, not phase-based
      // This would need to be adapted based on your actual workflow structure
      logWithCategory('warn', LogCategory.SYSTEM,
        'Database workflows use step-based format. Consider using WorkflowParser for phase-based workflows.'
      );

      // Export using Antigravity exporter
      const exporter = new AntigravityWorkflowExporter();
      const result = await exporter.exportWorkflow(workflow, exportDir);

      logWithCategory('info', LogCategory.SYSTEM,
        `IPC: Export complete. Created ${result.workflows.length} workflow files in ${exportDir}`
      );

      return {
        success: true,
        outputDir: exportDir,
        workflowCount: result.workflows.length,
        workflows: result.workflows.map(wf => ({
          filename: wf.filename,
          description: wf.description,
        })),
        workflowChain: result.workflowChain,
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'IPC: Export workflow failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  });

  /**
   * Preview Antigravity export without writing files
   */
  ipcMain.handle('export:antigravity:preview', async (event, workflowFilePath: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Preview Antigravity export for ${workflowFilePath}`);

    try {
      // Parse workflow file
      const parser = new WorkflowParser();
      const workflow = await parser.parseWorkflow(workflowFilePath);

      // Preview export
      const exporter = new AntigravityWorkflowExporter();
      const result = await exporter.previewExport(workflow);

      logWithCategory('info', LogCategory.SYSTEM,
        `IPC: Preview complete. Would create ${result.workflows.length} workflow files`
      );

      return {
        success: true,
        workflowCount: result.workflows.length,
        workflows: result.workflows.map(wf => ({
          filename: wf.filename,
          description: wf.description,
          content: wf.content,
          nextWorkflow: wf.nextWorkflow,
          dependencies: wf.dependencies,
          size: wf.content.length,
        })),
        workflowChain: result.workflowChain,
        installationGuide: result.installationGuide,
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'IPC: Preview export failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  });

  /**
   * Export parsed workflow to Antigravity format
   */
  ipcMain.handle('export:antigravity:from-file', async (event, workflowFilePath: string, outputDir?: string) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: Export workflow file to Antigravity: ${workflowFilePath}`);

    try {
      // If no output directory specified, show dialog
      let exportDir = outputDir;
      if (!exportDir) {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          throw new Error('No browser window found');
        }

        const result = await dialog.showOpenDialog(window, {
          title: 'Select Export Directory',
          properties: ['openDirectory', 'createDirectory'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          throw new Error('Export canceled by user');
        }

        exportDir = result.filePaths[0];
      }

      // Parse workflow file
      const parser = new WorkflowParser();
      const workflow = await parser.parseWorkflow(workflowFilePath);

      // Export using Antigravity exporter
      const exporter = new AntigravityWorkflowExporter();
      const result = await exporter.exportWorkflow(workflow, exportDir);

      logWithCategory('info', LogCategory.SYSTEM,
        `IPC: Export complete. Created ${result.workflows.length} workflow files in ${exportDir}`
      );

      return {
        success: true,
        outputDir: exportDir,
        workflowCount: result.workflows.length,
        workflows: result.workflows.map(wf => ({
          filename: wf.filename,
          description: wf.description,
          size: wf.content.length,
        })),
        workflowChain: result.workflowChain,
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, 'IPC: Export workflow file failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  });

  /**
   * Show save dialog for directory selection
   */
  ipcMain.handle('dialog:show-save-directory', async (event, title?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return { canceled: true, filePaths: [] };

    return await dialog.showOpenDialog(window, {
      title: title || 'Select Directory',
      properties: ['openDirectory', 'createDirectory'],
    });
  });
}
