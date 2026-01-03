import { ipcMain } from 'electron';
import { logWithCategory, LogCategory } from '../logger';
import { PersistentMCPClient } from '../workflow/persistent-mcp-client';
import { DependencyResolver } from '../workflow/dependency-resolver';

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

  // Add node to workflow (graph-based)
  ipcMain.handle('workflow:add-node', async (_event, { workflowId, node }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Add node to workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const { id, type, ...nodeData } = node;
      const result = await client.addNode(workflowId, String(id), type, nodeData);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Add node failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Update node in workflow (graph-based)
  ipcMain.handle('workflow:update-node', async (_event, { workflowId, nodeId, updates }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Update node ${nodeId} in workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.updateNode(workflowId, String(nodeId), updates);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Update node failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Delete node from workflow (graph-based)
  ipcMain.handle('workflow:delete-node', async (_event, { workflowId, nodeId }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Delete node ${nodeId} from workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.deleteNode(workflowId, String(nodeId));
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Delete node failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Add edge to workflow (graph-based)
  ipcMain.handle('workflow:add-edge', async (_event, { workflowId, edge }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Add edge to workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.createEdge(
        workflowId,
        edge.id,
        edge.source,
        edge.target,
        edge.type,
        edge.label,
        edge.condition
      );
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Add edge failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Update edge in workflow (graph-based)
  ipcMain.handle('workflow:update-edge', async (_event, { workflowId, edgeId, updates }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Update edge ${edgeId} in workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.updateEdge(workflowId, edgeId, updates);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Update edge failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Delete edge from workflow (graph-based)
  ipcMain.handle('workflow:delete-edge', async (_event, { workflowId, edgeId }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Delete edge ${edgeId} from workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.deleteEdge(workflowId, edgeId);
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

  // Get installed agents from ~/.claude/agents/
  ipcMain.handle('workflow:get-installed-agents', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Get installed agents');
    try {
      const resolver = new DependencyResolver();
      const agents = await resolver.getInstalledAgents();
      logWithCategory('info', LogCategory.WORKFLOW, `IPC: Found ${agents.length} installed agents`);
      return agents;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Get installed agents failed', { error: error.message, stack: error.stack });
      return [];
    }
  });

  // Get installed skills from ~/.claude/skills/
  ipcMain.handle('workflow:get-installed-skills', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Get installed skills');
    try {
      const resolver = new DependencyResolver();
      const skills = await resolver.getInstalledSkills();
      logWithCategory('info', LogCategory.WORKFLOW, `IPC: Found ${skills.length} installed skills`);
      return skills;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Get installed skills failed', { error: error.message, stack: error.stack });
      return [];
    }
  });

  // Get installed output-styles from ~/.claude/output-styles/
  ipcMain.handle('workflow:get-installed-output-styles', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Get installed output-styles');
    try {
      const resolver = new DependencyResolver();
      const outputStyles = await resolver.getInstalledOutputStyles();
      logWithCategory('info', LogCategory.WORKFLOW, `IPC: Found ${outputStyles.length} installed output-styles`);
      return outputStyles;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Get installed output-styles failed', { error: error.message, stack: error.stack });
      return [];
    }
  });

  logWithCategory('info', LogCategory.SYSTEM, 'Workflow IPC handlers registered');
}
