import { ipcMain } from 'electron';
import { logWithCategory, LogCategory } from '../logger';
import { PersistentMCPClient } from '../workflow/persistent-mcp-client';

// Singleton instance of PersistentMCPClient for workflow operations
let workflowClient: PersistentMCPClient | null = null;
let workflowClientStartPromise: Promise<void> | null = null;

/**
 * Get or create the singleton PersistentMCPClient for workflow operations
 */
async function getWorkflowClient(): Promise<PersistentMCPClient> {
  if (workflowClient && workflowClient.isReady()) {
    return workflowClient;
  }

  if (workflowClientStartPromise) {
    await workflowClientStartPromise;
    if (workflowClient && workflowClient.isReady()) {
      return workflowClient;
    }
  }

  workflowClient = new PersistentMCPClient();
  workflowClientStartPromise = workflowClient.start();

  try {
    await workflowClientStartPromise;
    logWithCategory('info', LogCategory.WORKFLOW, 'PersistentMCPClient started for workflow handlers');
    return workflowClient;
  } catch (error: any) {
    workflowClient = null;
    workflowClientStartPromise = null;
    throw error;
  }
}

/**
 * Register workflow-related IPC handlers
 */
export function registerWorkflowHandlers() {
  // Update node positions in workflow canvas
  ipcMain.handle('workflow:update-positions', async (_event, { workflowId, positions }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Update positions for workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      await client.updateNodePositions(workflowId, positions);
      logWithCategory('info', LogCategory.WORKFLOW, `IPC: Positions updated for workflow ${workflowId}`);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Update positions failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Get workflow definition
  ipcMain.handle('workflow:get-definition', async (_event, workflowId, version?) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Get definition for workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const definition = await client.getWorkflowDefinition(workflowId, version);
      return definition;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Get definition failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Add node to workflow
  ipcMain.handle('workflow:add-node', async (_event, { workflowId, node }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Add node to workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      // Use the addWorkflowPhase method if it exists, otherwise use callTool directly
      const result = await client.callTool('add_workflow_phase', {
        workflow_def_id: workflowId,
        phase: node
      });
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Add node failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Update node in workflow
  ipcMain.handle('workflow:update-node', async (_event, { workflowId, nodeId, updates }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Update node ${nodeId} in workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.updateWorkflowPhase(workflowId, parseInt(nodeId, 10), updates);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Update node failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Delete node from workflow
  ipcMain.handle('workflow:delete-node', async (_event, { workflowId, nodeId }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Delete node ${nodeId} from workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.callTool('delete_workflow_phase', {
        workflow_def_id: workflowId,
        phase_id: parseInt(nodeId, 10)
      });
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Delete node failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Add edge to workflow
  ipcMain.handle('workflow:add-edge', async (_event, { workflowId, edge }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Add edge to workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.callTool('add_workflow_edge', {
        workflow_def_id: workflowId,
        edge
      });
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Add edge failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Update edge in workflow
  ipcMain.handle('workflow:update-edge', async (_event, { workflowId, edgeId, updates }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Update edge ${edgeId} in workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.callTool('update_workflow_edge', {
        workflow_def_id: workflowId,
        edge_id: edgeId,
        updates
      });
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Update edge failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Delete edge from workflow
  ipcMain.handle('workflow:delete-edge', async (_event, { workflowId, edgeId }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Delete edge ${edgeId} from workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.callTool('delete_workflow_edge', {
        workflow_def_id: workflowId,
        edge_id: edgeId
      });
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Delete edge failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Preview workflow from folder
  ipcMain.handle('workflow:preview', async (_event, folderPath: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Preview workflow from ${folderPath}`);
    try {
      const { FolderImporter } = await import('../workflow/folder-importer');
      const importer = new FolderImporter();
      const preview = await importer.previewWorkflow(folderPath);
      return preview;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Preview workflow failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  logWithCategory('info', LogCategory.SYSTEM, 'Workflow IPC handlers registered');
}
