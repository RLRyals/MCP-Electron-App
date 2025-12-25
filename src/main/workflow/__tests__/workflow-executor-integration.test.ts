/**
 * Workflow Executor Integration Tests
 *
 * Tests for executeNodeEnhanced with different node types, retry logic,
 * timeout enforcement, context building, variable extraction, and event emissions.
 */

import { WorkflowExecutor } from '../workflow-executor';
import { WorkflowExecutionContext } from '../../../types/workflow-context';
import {
  AgentWorkflowNode,
  UserInputNode,
  CodeExecutionNode,
  FileOperationNode,
  ConditionalNode,
  NodeOutput
} from '../../../types/workflow-nodes';
import { ContextManager } from '../context-manager';
import { getProviderManager } from '../../llm/provider-manager';

// Mock dependencies
jest.mock('../mcp-workflow-client');
jest.mock('../claude-code-executor');
jest.mock('../../llm/provider-manager');
jest.mock('child_process');

describe('Workflow Executor Integration Tests', () => {
  let executor: WorkflowExecutor;
  let context: WorkflowExecutionContext;
  let mockProviderManager: any;

  beforeEach(() => {
    // Create fresh executor instance
    executor = new WorkflowExecutor();

    // Mock provider manager
    mockProviderManager = {
      executePrompt: jest.fn().mockResolvedValue({
        success: true,
        output: { result: 'Test output', score: 85 },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      }),
      validateProvider: jest.fn().mockResolvedValue({ valid: true }),
      initialize: jest.fn().mockResolvedValue(undefined)
    };
    (getProviderManager as jest.Mock).mockReturnValue(mockProviderManager);

    // Create test context
    context = {
      instanceId: 'test-instance-123',
      workflowId: 'test-workflow-456',
      projectFolder: '/tmp/test-project',
      variables: {},
      nodeOutputs: new Map(),
      mcpData: {},
      currentNodeId: '',
      completedNodes: [],
      loopStack: [],
      startedAt: new Date(),
      userId: 1
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeNodeEnhanced - Agent Nodes', () => {
    it('should execute planning node successfully', async () => {
      const planningNode: AgentWorkflowNode = {
        id: 'planning-node-1',
        name: 'Series Planning',
        description: 'Plan the series structure',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'series-architect-agent',
        skill: 'series-planning',
        gate: false
      };

      // Access private method via reflection
      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(planningNode, context);

      expect(result.status).toBe('success');
      expect(result.nodeId).toBe('planning-node-1');
      expect(result.nodeName).toBe('Series Planning');
      expect(result.output).toBeDefined();
      expect(result.variables).toBeDefined();
      expect(mockProviderManager.executePrompt).toHaveBeenCalledTimes(1);
    });

    it('should execute writing node successfully', async () => {
      const writingNode: AgentWorkflowNode = {
        id: 'writing-node-1',
        name: 'Chapter Writing',
        description: 'Write a chapter',
        type: 'writing',
        position: { x: 100, y: 200 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'chapter-writer-agent',
        skill: 'chapter-writing',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(writingNode, context);

      expect(result.status).toBe('success');
      expect(result.nodeId).toBe('writing-node-1');
      expect(mockProviderManager.executePrompt).toHaveBeenCalled();
    });

    it('should execute gate node and pass condition', async () => {
      mockProviderManager.executePrompt.mockResolvedValueOnce({
        success: true,
        output: { score: 85, feedback: 'Good work' },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      });

      const gateNode: AgentWorkflowNode = {
        id: 'gate-node-1',
        name: 'Quality Gate',
        description: 'Check quality',
        type: 'gate',
        position: { x: 100, y: 300 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'quality-checker-agent',
        gate: true,
        gateCondition: '$.score >= 80'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(gateNode, context);

      expect(result.status).toBe('success');
      expect(mockProviderManager.executePrompt).toHaveBeenCalled();
    });

    it('should execute gate node and fail condition', async () => {
      mockProviderManager.executePrompt.mockResolvedValueOnce({
        success: true,
        output: { score: 65, feedback: 'Needs improvement' },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      });

      const gateNode: AgentWorkflowNode = {
        id: 'gate-node-2',
        name: 'Quality Gate',
        description: 'Check quality',
        type: 'gate',
        position: { x: 100, y: 300 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'quality-checker-agent',
        gate: true,
        gateCondition: '$.score >= 80'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(gateNode, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Gate condition not met');
    });
  });

  describe('executeNodeEnhanced - Skip Conditions', () => {
    it('should skip node when skip condition is met', async () => {
      context.variables.skipFlag = true;

      const node: AgentWorkflowNode = {
        id: 'skippable-node',
        name: 'Skippable Node',
        description: 'Can be skipped',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        skipCondition: '$.variables.skipFlag == true',
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(node, context);

      expect(result.status).toBe('success');
      expect(result.output).toEqual({ skipped: true, reason: 'Skip condition met' });
      expect(mockProviderManager.executePrompt).not.toHaveBeenCalled();
    });

    it('should not skip node when skip condition is not met', async () => {
      context.variables.skipFlag = false;

      const node: AgentWorkflowNode = {
        id: 'non-skippable-node',
        name: 'Non-Skippable Node',
        description: 'Should execute',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        skipCondition: '$.variables.skipFlag == true',
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(node, context);

      expect(result.status).toBe('success');
      expect(result.output).not.toHaveProperty('skipped');
      expect(mockProviderManager.executePrompt).toHaveBeenCalled();
    });
  });

  describe('executeNodeEnhanced - Retry Logic', () => {
    it('should retry failed execution and eventually succeed', async () => {
      let attemptCount = 0;
      mockProviderManager.executePrompt.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return {
          success: true,
          output: { result: 'Success on retry' },
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        };
      });

      const node: AgentWorkflowNode = {
        id: 'retry-node',
        name: 'Retry Node',
        description: 'Node with retry',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        retryConfig: {
          maxRetries: 3,
          retryDelayMs: 100,
          backoffMultiplier: 2
        },
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(node, context);

      expect(result.status).toBe('success');
      expect(attemptCount).toBe(3);
      expect(mockProviderManager.executePrompt).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries exceeded', async () => {
      mockProviderManager.executePrompt.mockRejectedValue(new Error('Persistent failure'));

      const node: AgentWorkflowNode = {
        id: 'failing-node',
        name: 'Failing Node',
        description: 'Node that fails',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        retryConfig: {
          maxRetries: 2,
          retryDelayMs: 50,
          backoffMultiplier: 2
        },
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Persistent failure');
      expect(mockProviderManager.executePrompt).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  describe('executeNodeEnhanced - Timeout Enforcement', () => {
    it('should timeout long-running execution', async () => {
      mockProviderManager.executePrompt.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          output: 'Should not complete'
        }), 5000))
      );

      const node: AgentWorkflowNode = {
        id: 'timeout-node',
        name: 'Timeout Node',
        description: 'Node with timeout',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        timeoutMs: 1000, // 1 second timeout
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('timeout');
    }, 10000);

    it('should complete within timeout', async () => {
      mockProviderManager.executePrompt.mockResolvedValue({
        success: true,
        output: { result: 'Quick completion' },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      });

      const node: AgentWorkflowNode = {
        id: 'quick-node',
        name: 'Quick Node',
        description: 'Fast node',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        timeoutMs: 5000,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(node, context);

      expect(result.status).toBe('success');
    });
  });

  describe('executeNodeEnhanced - Context Building and Variable Extraction', () => {
    it('should build context in simple mode', async () => {
      // Add previous node output
      context.nodeOutputs.set('prev-node', {
        nodeId: 'prev-node',
        nodeName: 'Previous Node',
        timestamp: new Date(),
        status: 'success',
        output: { data: 'test data' },
        variables: { resultVar: 'test value' }
      });

      const node: AgentWorkflowNode = {
        id: 'context-node',
        name: 'Context Node',
        description: 'Node using context',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(node, context);

      expect(result.status).toBe('success');
      expect(mockProviderManager.executePrompt).toHaveBeenCalled();

      // Check that context was built correctly
      const callArgs = mockProviderManager.executePrompt.mock.calls[0];
      const passedContext = callArgs[2];
      expect(passedContext).toBeDefined();
    });

    it('should build context in advanced mode with input mappings', async () => {
      context.variables.userName = 'John Doe';

      const node: AgentWorkflowNode = {
        id: 'advanced-node',
        name: 'Advanced Node',
        description: 'Node with advanced context',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: {
          mode: 'advanced',
          inputs: [
            { source: '{{userName}}', target: 'user' }
          ],
          outputs: [
            { source: '$.output.result', target: 'processedResult' }
          ]
        },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(node, context);

      expect(result.status).toBe('success');
      expect(context.variables.processedResult).toBeDefined();
    });

    it('should extract output variables', async () => {
      mockProviderManager.executePrompt.mockResolvedValueOnce({
        success: true,
        output: {
          result: 'Test result',
          chapters: ['Chapter 1', 'Chapter 2'],
          wordCount: 5000
        },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      });

      const node: AgentWorkflowNode = {
        id: 'extract-node',
        name: 'Extract Node',
        description: 'Node with extraction',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(node, context);

      expect(result.status).toBe('success');
      expect(result.variables).toBeDefined();
      expect(context.nodeOutputs.has('extract-node')).toBe(true);
    });
  });

  describe('executeNodeEnhanced - Event Emissions', () => {
    it('should emit node-started event', async () => {
      const startedSpy = jest.fn();
      executor.on('node-started', startedSpy);

      const node: AgentWorkflowNode = {
        id: 'event-node',
        name: 'Event Node',
        description: 'Node emitting events',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      await executeNodeEnhanced(node, context);

      expect(startedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'event-node',
          nodeName: 'Event Node',
          nodeType: 'planning'
        })
      );
    });

    it('should emit node-completed event on success', async () => {
      const completedSpy = jest.fn();
      executor.on('node-completed', completedSpy);

      const node: AgentWorkflowNode = {
        id: 'success-node',
        name: 'Success Node',
        description: 'Successful node',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      await executeNodeEnhanced(node, context);

      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'success-node',
          status: 'success'
        })
      );
    });

    it('should emit node-failed event on failure', async () => {
      mockProviderManager.executePrompt.mockRejectedValueOnce(new Error('Execution failed'));

      const failedSpy = jest.fn();
      executor.on('node-failed', failedSpy);

      const node: AgentWorkflowNode = {
        id: 'failed-node',
        name: 'Failed Node',
        description: 'Failing node',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'test-agent',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      await executeNodeEnhanced(node, context);

      expect(failedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'failed-node',
          error: expect.stringContaining('Execution failed')
        })
      );
    });
  });

  describe('executeNodeEnhanced - Different Node Types', () => {
    it('should execute code execution node', async () => {
      const codeNode: CodeExecutionNode = {
        id: 'code-node',
        name: 'Code Node',
        description: 'Execute code',
        type: 'code',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'return 2 + 2;',
        sandbox: {
          enabled: true,
          cpuTimeoutMs: 5000
        }
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(codeNode, context);

      expect(result.status).toBe('success');
      expect(result.variables.result).toBeDefined();
    });

    it('should execute user input node with default value', async () => {
      const inputNode: UserInputNode = {
        id: 'input-node',
        name: 'Input Node',
        description: 'Get input',
        type: 'user-input',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter name',
        inputType: 'text',
        required: true,
        defaultValue: 'Default Name'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(inputNode, context);

      expect(result.status).toBe('success');
      expect(result.variables.userInput).toBe('Default Name');
    });

    it('should execute conditional node', async () => {
      context.variables.score = 85;

      const conditionalNode: ConditionalNode = {
        id: 'conditional-node',
        name: 'Conditional Node',
        description: 'Branch based on condition',
        type: 'conditional',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        condition: '$.variables.score >= 80',
        conditionType: 'jsonpath'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result: NodeOutput = await executeNodeEnhanced(conditionalNode, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });
  });
});
