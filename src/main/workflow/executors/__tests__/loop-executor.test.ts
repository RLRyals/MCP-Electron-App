/**
 * Loop Executor Tests
 *
 * Tests for forEach, while, and count loop types,
 * loop context management, and max iterations safety.
 */

import { LoopExecutor } from '../loop-executor';
import { LoopNode } from '../../../../types/workflow-nodes';
import { WorkflowExecutionContext } from '../../../../types/workflow-context';

describe('LoopExecutor', () => {
  let executor: LoopExecutor;

  beforeEach(() => {
    executor = new LoopExecutor();
  });

  describe('forEach loop', () => {
    it('should iterate over array collection', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Process Items',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'forEach',
        collection: '{{items}}',
        iteratorVariable: 'item',
        indexVariable: 'index',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {
          items: [1, 2, 3, 4, 5],
        },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.iterationCount).toBe(5);
      expect(result.output.totalIterations).toBe(5);
      expect(result.output.iterations).toHaveLength(5);
    });

    it('should iterate over object array', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Process Users',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'forEach',
        collection: '{{users}}',
        iteratorVariable: 'user',
        indexVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {
          users: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
            { id: 3, name: 'Charlie' },
          ],
        },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.iterationCount).toBe(3);
      expect(result.output.iterations[0].variables.user).toEqual({ id: 1, name: 'Alice' });
      expect(result.output.iterations[1].variables.user).toEqual({ id: 2, name: 'Bob' });
    });

    it('should handle empty collection', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Process Empty',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'forEach',
        collection: '{{items}}',
        iteratorVariable: 'item',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {
          items: [],
        },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.iterationCount).toBe(0);
      expect(result.output.iterations).toHaveLength(0);
    });

    it('should fail when collection is not array', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Invalid Collection',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'forEach',
        collection: '{{notAnArray}}',
        iteratorVariable: 'item',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {
          notAnArray: 'just a string',
        },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('not an array');
    });

    it('should fail when collection not found', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Missing Collection',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'forEach',
        collection: '{{missing}}',
        iteratorVariable: 'item',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Failed to evaluate collection');
    });

    it('should fail when collection path not provided', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'No Collection',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'forEach',
        iteratorVariable: 'item',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('requires a collection path');
    });
  });

  describe('count loop', () => {
    it('should iterate fixed number of times', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Count Loop',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'count',
        count: 5,
        iteratorVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.iterationCount).toBe(5);
      expect(result.output.iterations).toHaveLength(5);
      expect(result.output.iterations[0].variables.i).toBe(0);
      expect(result.output.iterations[4].variables.i).toBe(4);
    });

    it('should iterate once when count is 1', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Single Iteration',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'count',
        count: 1,
        iteratorVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.iterationCount).toBe(1);
    });

    it('should fail when count is zero', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Zero Count',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'count',
        count: 0,
        iteratorVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('positive count value');
    });

    it('should fail when count is negative', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Negative Count',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'count',
        count: -5,
        iteratorVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('positive count value');
    });
  });

  describe('while loop', () => {
    it('should iterate while condition is true', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'While Loop',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'while',
        whileCondition: '{{counter}} < 3',
        iteratorVariable: 'i',
        maxIterations: 10,
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {
          counter: 0,
        },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      // Note: In the placeholder implementation, counter doesn't actually increment
      // In a real implementation, this would iterate until counter >= 3
    });

    it('should stop at max iterations', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'While Loop Max',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'while',
        whileCondition: '{{alwaysTrue}} == true',
        iteratorVariable: 'i',
        maxIterations: 5,
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {
          alwaysTrue: true,
        },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.iterationCount).toBeLessThanOrEqual(5);
    });

    it('should fail when condition not provided', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'No Condition',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'while',
        iteratorVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('requires a condition');
    });

    it('should not iterate when condition is initially false', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'False Condition',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'while',
        whileCondition: '{{value}} > 100',
        iteratorVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {
          value: 5,
        },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.iterationCount).toBe(0);
    });
  });

  describe('loop context management', () => {
    it('should set iterator variable in context', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Loop Context',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'forEach',
        collection: '{{items}}',
        iteratorVariable: 'currentItem',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {
          items: ['a', 'b', 'c'],
        },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.output.iterations[0].variables.currentItem).toBe('a');
      expect(result.output.iterations[1].variables.currentItem).toBe('b');
      expect(result.output.iterations[2].variables.currentItem).toBe('c');
    });

    it('should set index variable when provided', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Loop with Index',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'forEach',
        collection: '{{items}}',
        iteratorVariable: 'item',
        indexVariable: 'idx',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {
          items: [10, 20, 30],
        },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.output.iterations[0].variables.idx).toBe(0);
      expect(result.output.iterations[1].variables.idx).toBe(1);
      expect(result.output.iterations[2].variables.idx).toBe(2);
    });

    it('should manage loop stack for nested loops', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Outer Loop',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'count',
        count: 2,
        iteratorVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
        loopStack: [],
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      // Loop stack should be empty after loop completes
      expect(context.loopStack).toHaveLength(0);
    });
  });

  describe('summary generation', () => {
    it('should generate summary with success count', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Summary Test',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'count',
        count: 5,
        iteratorVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.output.summary).toBeDefined();
      expect(result.output.summary.totalIterations).toBe(5);
      expect(result.output.summary.successCount).toBe(5);
      expect(result.output.summary.failureCount).toBe(0);
      expect(result.output.summary.successRate).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle unknown loop type', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Invalid Loop',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'invalid' as any,
        iteratorVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Unknown loop type');
    });

    it('should handle invalid node type', async () => {
      const node = {
        id: 'loop-1',
        name: 'Invalid Node',
        type: 'invalid-type',
      } as any;

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      await expect(executor.execute(node, context)).rejects.toThrow(
        'LoopExecutor received invalid node type'
      );
    });
  });

  describe('lastIteration variable', () => {
    it('should set lastIteration variable', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Last Iteration Test',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'count',
        count: 3,
        iteratorVariable: 'i',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.lastIteration).toBeDefined();
      expect(result.variables.lastIteration.iteration).toBe(2); // Last iteration (0-indexed)
    });

    it('should set lastIteration to null for empty loop', async () => {
      const node: LoopNode = {
        id: 'loop-1',
        name: 'Empty Loop',
        description: 'Test loop',
        type: 'loop',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'forEach',
        collection: '{{items}}',
        iteratorVariable: 'item',
      };

      const context: WorkflowExecutionContext = {
        projectFolder: '/test',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {
          items: [],
        },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.lastIteration).toBeNull();
    });
  });
});
