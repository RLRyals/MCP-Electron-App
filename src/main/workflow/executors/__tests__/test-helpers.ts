/**
 * Test Helpers
 *
 * Common utilities and factories for workflow executor tests.
 */

import { WorkflowExecutionContext } from '../../../../types/workflow-context';

/**
 * Create a test workflow execution context with default values
 */
export function createTestContext(overrides?: Partial<WorkflowExecutionContext>): WorkflowExecutionContext {
  return {
    projectFolder: '/test/project',
    instanceId: 'test-instance-' + Date.now(),
    workflowId: 'test-workflow-' + Date.now(),
    variables: {},
    nodeOutputs: new Map(),
    mcpData: {},
    currentNodeId: 'test-node',
    completedNodes: [],
    loopStack: [],
    startedAt: new Date(),
    userId: 1,
    ...overrides,
  };
}

/**
 * Create a minimal test context (for backward compatibility with tests that use simple objects)
 */
export function createMinimalContext(data: any = {}): any {
  return {
    projectFolder: '/test/project',
    ...data,
  };
}
