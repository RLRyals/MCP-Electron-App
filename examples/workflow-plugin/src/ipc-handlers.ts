import { PluginContext } from '../../../src/types/plugin-api';
import { WorkflowRunner } from '@fictionlab/workflow-runner';
import { BrowserWindow } from 'electron';

/**
 * WorkflowUpdate type for broadcasting updates
 */
interface WorkflowUpdate {
  registryId: string;
  type: 'status' | 'progress' | 'node_changed' | 'completed' | 'failed';
  data: Record<string, any>;
  timestamp: string;
}

/**
 * Broadcast workflow updates to all renderer windows
 */
function broadcastWorkflowUpdate(update: WorkflowUpdate) {
  BrowserWindow.getAllWindows().forEach(win => {
    // Check if window and webContents are still valid before sending
    if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send('workflow:instance-updated', update);
    }
  });
}

export function registerIPCHandlers(context: PluginContext, runner: WorkflowRunner) {
  const logger = context.logger;
  const mcp = context.services.mcp;
  const workflow = context.services.workflow;

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
  // These use context.services.workflow provided by the main app
  // ============================================

  // Import workflow from folder
  context.ipc.handle('workflow:import-from-folder', async (_event, folderPath: string, customId?: string, customName?: string) => {
    logger.info(`Import from folder: ${folderPath}`);

    if (!workflow) {
      throw new Error('Workflow service not available. Check plugin permissions.');
    }

    const result = await workflow.importFromFolder(folderPath, customId, customName);

    if (!result.success) {
      throw new Error(result.error || 'Import failed');
    }

    return result;
  });

  // Delete workflow
  context.ipc.handle('workflow:delete', async (_event, workflowId: string) => {
    logger.info(`Delete workflow: ${workflowId}`);

    if (!workflow) {
      throw new Error('Workflow service not available. Check plugin permissions.');
    }

    await workflow.deleteWorkflow(workflowId);
    return { success: true };
  });

  // Reimport workflow (delete and re-import from original source)
  context.ipc.handle('workflow:reimport', async (_event, workflowId: string) => {
    logger.info(`Reimport workflow: ${workflowId}`);

    if (!workflow) {
      throw new Error('Workflow service not available. Check plugin permissions.');
    }

    // Get source path
    const sourcePath = await workflow.getImportSource(workflowId);

    if (!sourcePath) {
      throw new Error('Cannot reimport: workflow source path not found');
    }

    // Delete the workflow
    await workflow.deleteWorkflow(workflowId);

    // Re-import from the same folder
    const result = await workflow.importFromFolder(sourcePath);

    if (!result.success) {
      throw new Error(result.error || 'Reimport failed');
    }

    return result;
  });

  // ============================================
  // Active Workflow Management Handlers
  // These use context.services.mcp.callTool to communicate with workflow-manager
  // ============================================

  // List all active workflows
  context.ipc.handle('workflow:list-active', async () => {
    try {
      const result = await mcp.callTool('workflow-manager', 'list_active_workflows', {});
      return result || [];
    } catch (error: any) {
      logger.error('List active workflows failed:', error.message);
      return [];
    }
  });

  // Pause a workflow
  context.ipc.handle('workflow:pause', async (_event, registryId: string) => {
    await mcp.callTool('workflow-manager', 'pause_workflow', { registry_id: registryId });
    broadcastWorkflowUpdate({
      registryId,
      type: 'status',
      data: { status: 'paused' },
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  });

  // Resume a workflow
  context.ipc.handle('workflow:resume', async (_event, registryId: string) => {
    await mcp.callTool('workflow-manager', 'resume_workflow', { registry_id: registryId });
    broadcastWorkflowUpdate({
      registryId,
      type: 'status',
      data: { status: 'running' },
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  });

  // Cancel a workflow
  context.ipc.handle('workflow:cancel', async (_event, registryId: string) => {
    await mcp.callTool('workflow-manager', 'cancel_workflow', { registry_id: registryId });
    broadcastWorkflowUpdate({
      registryId,
      type: 'status',
      data: { status: 'cancelled' },
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  });

  // Jump to a specific node
  context.ipc.handle('workflow:jump-to-node', async (_event, { registryId, nodeId }: { registryId: string; nodeId: string }) => {
    await mcp.callTool('workflow-manager', 'jump_to_node', {
      registry_id: registryId,
      node_id: nodeId
    });
    broadcastWorkflowUpdate({
      registryId,
      type: 'node_changed',
      data: { currentNodeId: nodeId },
      timestamp: new Date().toISOString(),
    });
    return { success: true };
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
    const result = await mcp.callTool('workflow-manager', 'register_active_workflow', {
      workflow_def_id: params.workflowDefId,
      workflow_name: params.workflowName,
      source: params.source,
      project_folder: params.projectFolder,
      project_name: params.projectName,
      total_nodes: params.totalNodes,
      metadata: params.metadata,
    });

    const regId = result.registryId || result.registry_id;
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
    await mcp.callTool('workflow-manager', 'update_workflow_progress', {
      registry_id: params.registryId,
      current_node_id: params.currentNodeId || '',
      current_node_name: params.currentNodeName || '',
      progress_percent: params.progressPercent || 0,
      completed_nodes: params.completedNodes || 0,
    });
    broadcastWorkflowUpdate({
      registryId: params.registryId,
      type: 'progress',
      data: params,
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  });

  // Complete a workflow
  context.ipc.handle('workflow:complete-active', async (_event, { registryId }: { registryId: string }) => {
    await mcp.callTool('workflow-manager', 'complete_workflow', { registry_id: registryId });
    broadcastWorkflowUpdate({
      registryId,
      type: 'completed',
      data: { status: 'completed' },
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  });

  // Mark a workflow as failed
  context.ipc.handle('workflow:fail-active', async (_event, { registryId, errorMessage }: { registryId: string; errorMessage: string }) => {
    await mcp.callTool('workflow-manager', 'fail_workflow', {
      registry_id: registryId,
      error_message: errorMessage,
    });
    broadcastWorkflowUpdate({
      registryId,
      type: 'failed',
      data: { status: 'failed' },
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  });
}
