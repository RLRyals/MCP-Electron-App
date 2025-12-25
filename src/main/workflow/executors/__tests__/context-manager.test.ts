/**
 * Context Manager Tests
 *
 * Tests for context building, variable extraction, JSONPath evaluation,
 * condition evaluation, and variable substitution.
 */

import { ContextManager } from '../../context-manager';
import { WorkflowNode, ContextConfig } from '../../../../types/workflow-nodes';
import { WorkflowExecutionContext, NodeContextResult } from '../../../../types/workflow-context';
import { createTestContext } from './test-helpers';

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  describe('evaluateJSONPath', () => {
    const testContext = {
      variables: {
        userName: 'John',
        score: 85,
        items: [1, 2, 3, 4, 5],
      },
      nested: {
        field: 'value',
        array: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
      },
    };

    it('should evaluate variable references with {{}}', () => {
      const result = contextManager.evaluateJSONPath('{{userName}}', testContext);
      expect(result).toBe('John');
    });

    it('should evaluate nested variable references', () => {
      const result = contextManager.evaluateJSONPath('{{score}}', testContext);
      expect(result).toBe(85);
    });

    it('should evaluate JSONPath expressions', () => {
      const result = contextManager.evaluateJSONPath('$.nested.field', testContext);
      expect(result).toBe('value');
    });

    it('should evaluate JSONPath array access', () => {
      const result = contextManager.evaluateJSONPath('$.variables.items[0]', testContext);
      expect(result).toBe(1);
    });

    it('should evaluate JSONPath array wildcard', () => {
      const result = contextManager.evaluateJSONPath('$.nested.array[*].name', testContext);
      expect(result).toEqual(['Item 1', 'Item 2']);
    });

    it('should throw error for missing variable', () => {
      expect(() => {
        contextManager.evaluateJSONPath('{{nonExistent}}', testContext);
      }).toThrow('Variable not found: nonExistent');
    });

    it('should throw error for invalid JSONPath', () => {
      expect(() => {
        contextManager.evaluateJSONPath('$.doesNotExist', testContext);
      }).toThrow('No results found for JSONPath');
    });
  });

  describe('evaluateCondition', () => {
    const testContext = {
      variables: {
        score: 85,
        status: 'approved',
        count: 10,
      },
    };

    it('should evaluate >= condition', () => {
      const result = contextManager.evaluateCondition('{{score}} >= 70', testContext);
      expect(result).toBe(true);
    });

    it('should evaluate <= condition', () => {
      const result = contextManager.evaluateCondition('{{count}} <= 20', testContext);
      expect(result).toBe(true);
    });

    it('should evaluate == condition', () => {
      const result = contextManager.evaluateCondition('{{status}} == "approved"', testContext);
      expect(result).toBe(true);
    });

    it('should evaluate === condition', () => {
      const result = contextManager.evaluateCondition('{{score}} === 85', testContext);
      expect(result).toBe(true);
    });

    it('should evaluate != condition', () => {
      const result = contextManager.evaluateCondition('{{status}} != "rejected"', testContext);
      expect(result).toBe(true);
    });

    it('should evaluate > condition', () => {
      const result = contextManager.evaluateCondition('{{score}} > 80', testContext);
      expect(result).toBe(true);
    });

    it('should evaluate < condition', () => {
      const result = contextManager.evaluateCondition('{{count}} < 20', testContext);
      expect(result).toBe(true);
    });

    it('should return false for failed condition', () => {
      const result = contextManager.evaluateCondition('{{score}} < 50', testContext);
      expect(result).toBe(false);
    });

    it('should handle numeric comparisons correctly', () => {
      const result = contextManager.evaluateCondition('{{score}} >= 85', testContext);
      expect(result).toBe(true);
    });
  });

  describe('substitute', () => {
    const testContext = {
      variables: {
        userName: 'John',
        greeting: 'Hello',
        count: 42,
      },
    };

    it('should substitute single variable', () => {
      const result = contextManager.substitute('Hello {{userName}}', testContext);
      expect(result).toBe('Hello John');
    });

    it('should substitute multiple variables', () => {
      const result = contextManager.substitute('{{greeting}} {{userName}}, count: {{count}}', testContext);
      expect(result).toBe('Hello John, count: 42');
    });

    it('should return original text if variable not found', () => {
      const result = contextManager.substitute('Hello {{unknown}}', testContext);
      expect(result).toBe('Hello {{unknown}}');
    });

    it('should handle template with no variables', () => {
      const result = contextManager.substitute('Plain text', testContext);
      expect(result).toBe('Plain text');
    });

    it('should handle empty template', () => {
      const result = contextManager.substitute('', testContext);
      expect(result).toBe('');
    });
  });

  describe('buildNodeContext - Simple Mode', () => {
    it('should build context with all previous outputs', async () => {
      const globalContext = createTestContext({
        variables: { globalVar: 'value' },
        nodeOutputs: new Map([
          ['node1', {
            nodeId: 'node1',
            nodeName: 'Node 1',
            timestamp: new Date(),
            status: 'success',
            output: { result: 'data' },
            variables: { var1: 'value1' },
          }],
          ['node2', {
            nodeId: 'node2',
            nodeName: 'Node 2',
            timestamp: new Date(),
            status: 'success',
            output: { result: 'data2' },
            variables: { var2: 'value2' },
          }],
        ]),
      });

      const node: Partial<WorkflowNode> = {
        id: 'node3',
        name: 'Node 3',
        contextConfig: {
          mode: 'simple',
        },
      };

      const result = await contextManager.buildNodeContext(
        node as WorkflowNode,
        globalContext
      );

      expect(result.success).toBe(true);
      expect(result.context.projectFolder).toBe('/test/project');
      expect(result.context.instanceId).toBe('test-instance');
      expect(result.context.previousOutputs).toBeDefined();
      expect(result.context.previousOutputs.node1).toEqual({ var1: 'value1' });
      expect(result.context.previousOutputs.node2).toEqual({ var2: 'value2' });
      expect(result.context.variables).toEqual({ globalVar: 'value' });
    });
  });

  describe('buildNodeContext - Advanced Mode', () => {
    it('should build context with explicit input mappings', async () => {
      const globalContext: WorkflowExecutionContext = {
        projectFolder: '/test/project',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: { score: 85, name: 'Test' },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const node: Partial<WorkflowNode> = {
        id: 'node1',
        name: 'Node 1',
        contextConfig: {
          mode: 'advanced',
          inputs: [
            { source: '{{score}}', target: 'userScore' },
            { source: '{{name}}', target: 'userName' },
          ],
        },
      };

      const result = await contextManager.buildNodeContext(
        node as WorkflowNode,
        globalContext
      );

      expect(result.success).toBe(true);
      expect(result.context.userScore).toBe(85);
      expect(result.context.userName).toBe('Test');
    });

    it('should apply transform function to mapped values', async () => {
      const globalContext: WorkflowExecutionContext = {
        projectFolder: '/test/project',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: { name: 'john' },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const node: Partial<WorkflowNode> = {
        id: 'node1',
        name: 'Node 1',
        contextConfig: {
          mode: 'advanced',
          inputs: [
            {
              source: '{{name}}',
              target: 'upperName',
              transform: '(x) => x.toUpperCase()',
            },
          ],
        },
      };

      const result = await contextManager.buildNodeContext(
        node as WorkflowNode,
        globalContext
      );

      expect(result.success).toBe(true);
      expect(result.context.upperName).toBe('JOHN');
    });

    it('should return error for missing variables', async () => {
      const globalContext: WorkflowExecutionContext = {
        projectFolder: '/test/project',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const node: Partial<WorkflowNode> = {
        id: 'node1',
        name: 'Node 1',
        contextConfig: {
          mode: 'advanced',
          inputs: [
            { source: '{{missing}}', target: 'value' },
          ],
        },
      };

      const result = await contextManager.buildNodeContext(
        node as WorkflowNode,
        globalContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing variables');
      expect(result.missingVariables).toContain('{{missing}}');
    });
  });

  describe('extractOutputs - Simple Mode', () => {
    it('should extract entire output as single variable', async () => {
      const globalContext: WorkflowExecutionContext = {
        projectFolder: '/test/project',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const node: Partial<WorkflowNode> = {
        id: 'node1',
        name: 'Node 1',
        contextConfig: {
          mode: 'simple',
        },
      };

      const nodeOutput = {
        nodeId: 'node1',
        nodeName: 'Node 1',
        timestamp: new Date(),
        status: 'success' as const,
        output: { result: 'test data', count: 42 },
        variables: {},
      };

      const result = await contextManager.extractOutputs(
        node as WorkflowNode,
        nodeOutput,
        globalContext
      );

      expect(result.success).toBe(true);
      expect(result.variables.output).toEqual({ result: 'test data', count: 42 });
    });
  });

  describe('extractOutputs - Advanced Mode', () => {
    it('should extract specific fields with output mappings', async () => {
      const globalContext: WorkflowExecutionContext = {
        projectFolder: '/test/project',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const node: Partial<WorkflowNode> = {
        id: 'node1',
        name: 'Node 1',
        contextConfig: {
          mode: 'advanced',
          outputs: [
            { source: '$.currentNodeOutput.result', target: 'extractedResult' },
            { source: '$.currentNodeOutput.count', target: 'extractedCount' },
          ],
        },
      };

      const nodeOutput = {
        nodeId: 'node1',
        nodeName: 'Node 1',
        timestamp: new Date(),
        status: 'success' as const,
        output: { result: 'test data', count: 42 },
        variables: {},
      };

      const result = await contextManager.extractOutputs(
        node as WorkflowNode,
        nodeOutput,
        globalContext
      );

      expect(result.success).toBe(true);
      expect(result.variables.extractedResult).toBe('test data');
      expect(result.variables.extractedCount).toBe(42);
      expect(globalContext.variables.extractedResult).toBe('test data');
      expect(globalContext.variables.extractedCount).toBe(42);
    });

    it('should apply transform to extracted outputs', async () => {
      const globalContext: WorkflowExecutionContext = {
        projectFolder: '/test/project',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const node: Partial<WorkflowNode> = {
        id: 'node1',
        name: 'Node 1',
        contextConfig: {
          mode: 'advanced',
          outputs: [
            {
              source: '$.currentNodeOutput.count',
              target: 'doubledCount',
              transform: '(x) => x * 2',
            },
          ],
        },
      };

      const nodeOutput = {
        nodeId: 'node1',
        nodeName: 'Node 1',
        timestamp: new Date(),
        status: 'success' as const,
        output: { count: 21 },
        variables: {},
      };

      const result = await contextManager.extractOutputs(
        node as WorkflowNode,
        nodeOutput,
        globalContext
      );

      expect(result.success).toBe(true);
      expect(result.variables.doubledCount).toBe(42);
    });

    it('should return warnings for failed extractions', async () => {
      const globalContext: WorkflowExecutionContext = {
        projectFolder: '/test/project',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const node: Partial<WorkflowNode> = {
        id: 'node1',
        name: 'Node 1',
        contextConfig: {
          mode: 'advanced',
          outputs: [
            { source: '$.currentNodeOutput.missing', target: 'extracted' },
          ],
        },
      };

      const nodeOutput = {
        nodeId: 'node1',
        nodeName: 'Node 1',
        timestamp: new Date(),
        status: 'success' as const,
        output: { result: 'data' },
        variables: {},
      };

      const result = await contextManager.extractOutputs(
        node as WorkflowNode,
        nodeOutput,
        globalContext
      );

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableVariables', () => {
    it('should return variables from completed nodes', () => {
      const globalContext: WorkflowExecutionContext = {
        projectFolder: '/test/project',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: { globalVar: 'value' },
        nodeOutputs: new Map([
          ['node1', {
            nodeId: 'node1',
            nodeName: 'Node 1',
            timestamp: new Date(),
            status: 'success',
            output: {},
            variables: { var1: 'value1', var2: 42 },
          }],
        ]),
        mcpData: {},
      };

      const variables = contextManager.getAvailableVariables('node2', globalContext);

      expect(variables.length).toBeGreaterThan(0);

      const globalVars = variables.filter(v => v.nodeId === 'global');
      expect(globalVars.length).toBeGreaterThan(0);
      expect(globalVars[0].path).toContain('{{');

      const node1Vars = variables.filter(v => v.nodeId === 'node1');
      expect(node1Vars.length).toBe(2);
    });

    it('should exclude current node from available variables', () => {
      const globalContext: WorkflowExecutionContext = {
        projectFolder: '/test/project',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: {},
        nodeOutputs: new Map([
          ['node1', {
            nodeId: 'node1',
            nodeName: 'Node 1',
            timestamp: new Date(),
            status: 'success',
            output: {},
            variables: { var1: 'value1' },
          }],
        ]),
        mcpData: {},
      };

      const variables = contextManager.getAvailableVariables('node1', globalContext);

      const node1Vars = variables.filter(v => v.nodeId === 'node1');
      expect(node1Vars.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid transform functions', async () => {
      const globalContext: WorkflowExecutionContext = {
        projectFolder: '/test/project',
        instanceId: 'test-instance',
        workflowId: 'test-workflow',
        variables: { value: 'test' },
        nodeOutputs: new Map(),
        mcpData: {},
      };

      const node: Partial<WorkflowNode> = {
        id: 'node1',
        name: 'Node 1',
        contextConfig: {
          mode: 'advanced',
          inputs: [
            {
              source: '{{value}}',
              target: 'transformed',
              transform: 'invalid javascript code {{{',
            },
          ],
        },
      };

      const result = await contextManager.buildNodeContext(
        node as WorkflowNode,
        globalContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing variables');
    });
  });
});
