import { PluginContext } from '../../../src/types/plugin-api';
import { WorkflowRunner, WorkflowClient } from '@fictionlab/workflow-runner';
import { BrowserWindow } from 'electron';
import type { WorkflowUpdate } from '../../../src/types/workflow';
import { FolderImporter } from '../../../src/main/workflow/folder-importer';

/**
 * Broadcast workflow updates to all renderer windows
 */
function broadcastWorkflowUpdate(update: WorkflowUpdate) {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('workflow:instance-updated', update);
  });
}

export function registerIPCHandlers(context: PluginContext, runner: WorkflowRunner) {
  // List workflows
  context.ipc.handle('workflow:list', async (_event, filters) => {
    return runner.listWorkflows(filters);
  });

  // Get workflow definition
  context.ipc.handle('workflow:get', async (_event, { id, version }) => {
    return runner.getWorkflow(id, version);
  });

  // Execute workflow
  context.ipc.handle('workflow:execute', async (_event, { workflowId, options }) => {
    return runner.execute(workflowId, options);
  });

  // ============================================
  // Workflow Import/Delete Handlers
  // ============================================

  // Import workflow from folder
  context.ipc.handle('workflow:import-from-folder', async (_event, folderPath: string, customId?: string, customName?: string) => {
    console.log('[workflow-plugin] Import from folder:', folderPath, customId, customName);
    try {
      const importer = new FolderImporter();
      const result = await importer.importFromFolder(folderPath, customId, customName);
      return result;
    } catch (error: any) {
      console.error('[workflow-plugin] Import failed:', error.message);
      throw error;
    }
  });

  // Delete workflow - uses PersistentMCPClient to call MCP tool
  context.ipc.handle('workflow:delete', async (_event, workflowId: string) => {
    console.log('[workflow-plugin] Delete workflow:', workflowId);
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();
      // Call delete_workflow_definition MCP tool
      await client.callTool('delete_workflow_definition', { id: workflowId });
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Delete workflow failed:', error.message);
      throw error;
    }
  });

  // Reimport workflow (delete and re-import from original source)
  context.ipc.handle('workflow:reimport', async (_event, workflowId: string) => {
    console.log('[workflow-plugin] Reimport workflow:', workflowId);
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();

      // Get source path from workflow_imports via MCP tool
      const importInfo = await client.callTool('get_workflow_import_source', { id: workflowId });

      if (!importInfo || !importInfo.sourcePath) {
        throw new Error('Cannot reimport: workflow source path not found');
      }

      const sourcePath = importInfo.sourcePath;

      // Delete the workflow via MCP
      await client.callTool('delete_workflow_definition', { id: workflowId });

      // Re-import from the same folder
      const importer = new FolderImporter();
      const importResult = await importer.importFromFolder(sourcePath);
      return importResult;
    } catch (error: any) {
      console.error('[workflow-plugin] Reimport workflow failed:', error.message);
      throw error;
    }
  });

  // ============================================
  // Active Workflow Management Handlers
  // These handlers use PersistentMCPClient directly for active workflow operations
  // ============================================

  // List all active workflows
  context.ipc.handle('workflow:list-active', async () => {
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();
      const result = await client.listActiveWorkflows();
      return result || [];
    } catch (error: any) {
      console.error('[workflow-plugin] List active workflows failed:', error.message);
      return [];
    }
  });

  // Pause a workflow
  context.ipc.handle('workflow:pause', async (_event, registryId: string) => {
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();
      await client.pauseWorkflow(registryId);
      broadcastWorkflowUpdate({
        registryId,
        type: 'status',
        data: { status: 'paused' },
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Pause workflow failed:', error.message);
      throw error;
    }
  });

  // Resume a workflow
  context.ipc.handle('workflow:resume', async (_event, registryId: string) => {
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();
      await client.resumeWorkflow(registryId);
      broadcastWorkflowUpdate({
        registryId,
        type: 'status',
        data: { status: 'running' },
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Resume workflow failed:', error.message);
      throw error;
    }
  });

  // Cancel a workflow
  context.ipc.handle('workflow:cancel', async (_event, registryId: string) => {
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();
      await client.cancelWorkflow(registryId);
      broadcastWorkflowUpdate({
        registryId,
        type: 'status',
        data: { status: 'cancelled' },
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Cancel workflow failed:', error.message);
      throw error;
    }
  });

  // Jump to a specific node
  context.ipc.handle('workflow:jump-to-node', async (_event, { registryId, nodeId }: { registryId: string; nodeId: string }) => {
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();
      await client.jumpToNode(registryId, nodeId);
      broadcastWorkflowUpdate({
        registryId,
        type: 'node_changed',
        data: { currentNodeId: nodeId },
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Jump to node failed:', error.message);
      throw error;
    }
  });

  // Register a new active workflow
  context.ipc.handle('workflow:register-active', async (_event, params: {
    workflowDefId: string;
    workflowName?: string;
    source: string;
    projectFolder?: string;
    projectName?: string;
    totalNodes?: number;
    metadata?: Record<string, any>;
  }) => {
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();
      const result = await client.registerActiveWorkflow(params as any);
      // Broadcast new workflow registered
      const regId = result.registryId || (result as any).registry_id;
      if (regId) {
        broadcastWorkflowUpdate({
          registryId: regId,
          type: 'status',
          data: { status: 'running' },
          timestamp: new Date().toISOString(),
        });
      }
      return {
        ...result,
        registryId: regId
      };
    } catch (error: any) {
      console.error('[workflow-plugin] Register workflow failed:', error.message);
      throw error;
    }
  });

  // Update workflow progress
  context.ipc.handle('workflow:update-progress', async (_event, params: {
    registryId: string;
    currentNodeId?: string;
    currentNodeName?: string;
    progressPercent?: number;
    completedNodes?: number;
    metadata?: Record<string, any>;
  }) => {
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();
      await client.updateWorkflowProgress(
        params.registryId,
        params.currentNodeId || '',
        params.currentNodeName || '',
        params.progressPercent || 0,
        params.completedNodes || 0
      );
      broadcastWorkflowUpdate({
        registryId: params.registryId,
        type: 'progress',
        data: params,
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Update progress failed:', error.message);
      throw error;
    }
  });

  // Complete a workflow
  context.ipc.handle('workflow:complete-active', async (_event, { registryId }: { registryId: string }) => {
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();
      await client.completeActiveWorkflow(registryId);
      broadcastWorkflowUpdate({
        registryId,
        type: 'completed',
        data: { status: 'completed' },
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Complete workflow failed:', error.message);
      throw error;
    }
  });

  // Mark a workflow as failed
  context.ipc.handle('workflow:fail-active', async (_event, { registryId, errorMessage }: { registryId: string; errorMessage: string }) => {
    try {
      const { PersistentMCPClient } = await import('../../../src/main/workflow/persistent-mcp-client');
      const client = new PersistentMCPClient();
      await client.start();
      await client.failActiveWorkflow(registryId, errorMessage);
      broadcastWorkflowUpdate({
        registryId,
        type: 'failed',
        data: { status: 'failed' as const },
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Fail workflow failed:', error.message);
      throw error;
    }
  });
}
