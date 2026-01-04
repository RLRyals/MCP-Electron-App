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
      const client = runner.getClient();
      if (client && typeof (client as any).registerActiveWorkflow === 'function') {
        const result = await (client as any).registerActiveWorkflow(params);
        // Broadcast new workflow registered
        if (result.registryId || result.registry_id) {
          broadcastWorkflowUpdate({
            registryId: result.registryId || result.registry_id,
            type: 'status',
            data: { status: 'running', ...params },
            timestamp: new Date().toISOString(),
          });
        }
        return {
          registryId: result.registryId || result.registry_id,
          ...result
        };
      }
      throw new Error('registerActiveWorkflow not available on client');
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
      const client = runner.getClient();
      if (client && typeof (client as any).updateWorkflowProgress === 'function') {
        await (client as any).updateWorkflowProgress(
          params.registryId,
          params.currentNodeId,
          params.currentNodeName,
          params.progressPercent,
          params.completedNodes
        );
        broadcastWorkflowUpdate({
          registryId: params.registryId,
          type: 'progress',
          data: params,
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Update progress failed:', error.message);
      throw error;
    }
  });

  // Complete a workflow
  context.ipc.handle('workflow:complete-active', async (_event, { registryId }: { registryId: string }) => {
    try {
      const client = runner.getClient();
      if (client && typeof (client as any).completeActiveWorkflow === 'function') {
        await (client as any).completeActiveWorkflow(registryId);
        broadcastWorkflowUpdate({
          registryId,
          type: 'completed',
          data: { status: 'completed' },
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Complete workflow failed:', error.message);
      throw error;
    }
  });

  // Mark a workflow as failed
  context.ipc.handle('workflow:fail-active', async (_event, { registryId, errorMessage }: { registryId: string; errorMessage: string }) => {
    try {
      const client = runner.getClient();
      if (client && typeof (client as any).failActiveWorkflow === 'function') {
        await (client as any).failActiveWorkflow(registryId, errorMessage);
        broadcastWorkflowUpdate({
          registryId,
          type: 'failed',
          data: { status: 'failed', error: errorMessage },
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (error: any) {
      console.error('[workflow-plugin] Fail workflow failed:', error.message);
      throw error;
    }
  });
}
