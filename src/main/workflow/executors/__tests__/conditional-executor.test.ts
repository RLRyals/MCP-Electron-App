/**
 * Conditional Executor Tests
 *
 * Tests for JSONPath and JavaScript condition evaluation.
 */

import { ConditionalExecutor } from '../conditional-executor';
import { ConditionalNode } from '../../../../types/workflow-nodes';

describe('ConditionalExecutor', () => {
  let executor: ConditionalExecutor;

  beforeEach(() => {
    executor = new ConditionalExecutor();
  });

  describe('JSONPath conditions', () => {
    it('should evaluate >= condition to true', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Score',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{score}} >= 70',
      };

      const context = {
        projectFolder: '/test',
        variables: { score: 85 },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
      expect(result.output.conditionResult).toBe(true);
    });

    it('should evaluate >= condition to false', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Score',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{score}} >= 70',
      };

      const context = {
        projectFolder: '/test',
        variables: { score: 50 },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(false);
    });

    it('should evaluate <= condition', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Count',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{count}} <= 100',
      };

      const context = {
        projectFolder: '/test',
        variables: { count: 75 },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should evaluate == condition with string', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Status',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{status}} == "approved"',
      };

      const context = {
        projectFolder: '/test',
        variables: { status: 'approved' },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should evaluate === condition', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Value',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{value}} === 42',
      };

      const context = {
        projectFolder: '/test',
        variables: { value: 42 },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should evaluate != condition', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Status',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{status}} != "rejected"',
      };

      const context = {
        projectFolder: '/test',
        variables: { status: 'approved' },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should evaluate > condition', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Age',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{age}} > 18',
      };

      const context = {
        projectFolder: '/test',
        variables: { age: 25 },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should evaluate < condition', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Temperature',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{temperature}} < 100',
      };

      const context = {
        projectFolder: '/test',
        variables: { temperature: 75 },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should evaluate condition with JSONPath expression', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Nested Value',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '$.user.score >= 80',
      };

      const context = {
        projectFolder: '/test',
        user: { score: 95, name: 'Alice' },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should handle false conditions gracefully', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Value',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{value}} > 100',
      };

      const context = {
        projectFolder: '/test',
        variables: { value: 50 },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(false);
    });
  });

  describe('JavaScript conditions', () => {
    it('should evaluate simple JavaScript condition to true', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'JS Condition',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'javascript',
        condition: 'context.score >= 70',
      };

      const context = {
        projectFolder: '/test',
        score: 85,
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should evaluate complex JavaScript condition', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'JS Condition',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'javascript',
        condition: 'context.score >= 70 && context.status === "approved"',
      };

      const context = {
        projectFolder: '/test',
        score: 85,
        status: 'approved',
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should evaluate JavaScript condition with OR logic', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'JS Condition',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'javascript',
        condition: 'context.role === "admin" || context.role === "moderator"',
      };

      const context = {
        projectFolder: '/test',
        role: 'moderator',
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should evaluate JavaScript condition with array operations', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'JS Condition',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'javascript',
        condition: 'context.tags.includes("important")',
      };

      const context = {
        projectFolder: '/test',
        tags: ['urgent', 'important', 'review'],
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should evaluate JavaScript condition with object property access', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'JS Condition',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'javascript',
        condition: 'context.user.age >= 18 && context.user.verified === true',
      };

      const context = {
        projectFolder: '/test',
        user: { age: 25, verified: true, name: 'Alice' },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should fail when JavaScript condition does not return boolean', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'JS Condition',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'javascript',
        condition: 'context.value + 10', // Returns number, not boolean
      };

      const context = {
        projectFolder: '/test',
        value: 42,
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('must return boolean');
    });

    it('should handle JavaScript syntax errors', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'JS Condition',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'javascript',
        condition: 'invalid javascript syntax {{{',
      };

      const context = {
        projectFolder: '/test',
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.variables.conditionResult).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should default to false on JSONPath error', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Missing Variable',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{nonExistent}} > 10',
      };

      const context = {
        projectFolder: '/test',
        variables: {},
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.variables.conditionResult).toBe(false);
    });

    it('should handle unsupported condition type', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Invalid Condition',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'invalid' as any,
        condition: 'some condition',
      };

      const context = {
        projectFolder: '/test',
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Unsupported condition type');
    });

    it('should handle invalid node type', async () => {
      const node = {
        id: 'cond-1',
        name: 'Invalid Node',
        type: 'invalid-type',
      } as any;

      const context = { projectFolder: '/test' };

      await expect(executor.execute(node, context)).rejects.toThrow(
        'ConditionalExecutor received invalid node type'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle boolean values in JSONPath conditions', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Boolean',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{isActive}} == true',
      };

      const context = {
        projectFolder: '/test',
        variables: { isActive: true },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should handle null values in conditions', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check Null',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{value}} == null',
      };

      const context = {
        projectFolder: '/test',
        variables: { value: null },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });

    it('should handle numeric string comparisons', async () => {
      const node: ConditionalNode = {
        id: 'cond-1',
        name: 'Check String Number',
        description: 'Test condition',
        type: 'conditional',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        conditionType: 'jsonpath',
        condition: '{{count}} > 5',
      };

      const context = {
        projectFolder: '/test',
        variables: { count: '10' }, // String number
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });
  });
});
