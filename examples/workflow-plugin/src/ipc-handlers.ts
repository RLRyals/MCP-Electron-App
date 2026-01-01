import { PluginContext } from './types/plugin-api';
import { WorkflowRunner, WorkflowClient } from '../bundled/workflow-runner/dist';

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

  // Additional handlers for workflow management can be added here
}
