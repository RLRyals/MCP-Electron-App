import { PluginContext } from '../../../src/types/plugin-api';
import { WorkflowRunner, WorkflowClient } from '@fictionlab/workflow-runner';
import { BrowserWindow } from 'electron';
import type { WorkflowUpdate } from '../../../src/types/workflow';

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
  // Active Workflow Management Handlers
  // ============================================

  // List all active workflows
  context.ipc.handle('workflow:list-active', async () => {
    try {
      const client = runner.getClient();
      if (client && typeof (client as any).listActiveWorkflows === 'function') {
        return await (client as any).listActiveWorkflows();
      }
      return [];
    } catch (error: any) {
      console.error('[workflow-plugin] List active workflows failed:', error.message);
      return [];
    }
  });

  // Pause a workflow
  context.ipc.handle('workflow:pause', async (_event, registryId: string) => {
    try {
      const client = runner.getClient();
      if (client && typeof (client as any).pauseWorkflow === 'function') {
        await (client as any).pauseWorkflow(registryId);
        broadcastWorkflowUpdate({
          registryId,
          type: 'status',
          data: { status: 'paused' },
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Pause workflow failed:', error.message);
      throw error;
    }
  });

  // Resume a workflow
  context.ipc.handle('workflow:resume', async (_event, registryId: string) => {
    try {
      const client = runner.getClient();
      if (client && typeof (client as any).resumeWorkflow === 'function') {
        await (client as any).resumeWorkflow(registryId);
        broadcastWorkflowUpdate({
          registryId,
          type: 'status',
          data: { status: 'running' },
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Resume workflow failed:', error.message);
      throw error;
    }
  });

  // Cancel a workflow
  context.ipc.handle('workflow:cancel', async (_event, registryId: string) => {
    try {
      const client = runner.getClient();
      if (client && typeof (client as any).cancelWorkflow === 'function') {
        await (client as any).cancelWorkflow(registryId);
        broadcastWorkflowUpdate({
          registryId,
          type: 'status',
          data: { status: 'cancelled' },
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Cancel workflow failed:', error.message);
      throw error;
    }
  });

  // Jump to a specific node
  context.ipc.handle('workflow:jump-to-node', async (_event, { registryId, nodeId }: { registryId: string; nodeId: string }) => {
    try {
      const client = runner.getClient();
      if (client && typeof (client as any).jumpToNode === 'function') {
        await (client as any).jumpToNode(registryId, nodeId);
        broadcastWorkflowUpdate({
          registryId,
          type: 'node_changed',
          data: { currentNodeId: nodeId },
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Jump to node failed:', error.message);
      throw error;
    }
  });
}
