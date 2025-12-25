/**
 * Multi-Node Workflow Integration Tests
 *
 * Tests for complete workflows with sequential nodes, conditional branching,
 * loops, file operations, and variable passing between nodes.
 */

import { WorkflowExecutor } from '../workflow-executor';
import { WorkflowExecutionContext } from '../../../types/workflow-context';
import {
  AgentWorkflowNode,
  CodeExecutionNode,
  FileOperationNode,
  ConditionalNode,
  LoopNode,
  UserInputNode
} from '../../../types/workflow-nodes';
import { getProviderManager } from '../../llm/provider-manager';
import * as fs from 'fs-extra';

// Mock dependencies
jest.mock('../mcp-workflow-client');
jest.mock('../claude-code-executor');
jest.mock('../../llm/provider-manager');
jest.mock('fs-extra');
jest.mock('child_process');

describe('Multi-Node Workflow Integration Tests', () => {
  let executor: WorkflowExecutor;
  let context: WorkflowExecutionContext;
  let mockProviderManager: any;

  beforeEach(() => {
    executor = new WorkflowExecutor();

    mockProviderManager = {
      executePrompt: jest.fn().mockResolvedValue({
        success: true,
        output: { result: 'Test output', chapters: ['Ch1', 'Ch2'], score: 85 },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      }),
      validateProvider: jest.fn().mockResolvedValue({ valid: true }),
      initialize: jest.fn().mockResolvedValue(undefined)
    };
    (getProviderManager as jest.Mock).mockReturnValue(mockProviderManager);

    // Mock fs-extra
    (fs.readFile as jest.Mock).mockResolvedValue('File content');
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.pathExists as jest.Mock).mockResolvedValue(true);

    context = {
      instanceId: 'workflow-123',
      workflowId: 'test-workflow',
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

  describe('Sequential Node Execution', () => {
    it('should execute nodes in sequence with variable passing', async () => {
      // Node 1: Planning
      const node1: AgentWorkflowNode = {
        id: 'planning-1',
        name: 'Plan Series',
        description: 'Plan the series',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'series-planner',
        gate: false
      };

      // Node 2: Writing (uses output from node 1)
      const node2: AgentWorkflowNode = {
        id: 'writing-1',
        name: 'Write Chapter',
        description: 'Write first chapter',
        type: 'writing',
        position: { x: 100, y: 200 },
        requiresApproval: false,
        contextConfig: {
          mode: 'advanced',
          inputs: [
            { source: '$.nodeOutputs.planning-1.output.chapters[0]', target: 'chapterOutline' }
          ]
        },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'chapter-writer',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);

      // Execute node 1
      const result1 = await executeNodeEnhanced(node1, context);
      expect(result1.status).toBe('success');
      expect(context.nodeOutputs.size).toBe(1);
      expect(context.nodeOutputs.has('planning-1')).toBe(true);

      // Execute node 2 (should have access to node 1 output)
      const result2 = await executeNodeEnhanced(node2, context);
      expect(result2.status).toBe('success');
      expect(context.nodeOutputs.size).toBe(2);
      expect(context.nodeOutputs.has('writing-1')).toBe(true);
    });

    it('should pass variables through three sequential nodes', async () => {
      mockProviderManager.executePrompt
        .mockResolvedValueOnce({
          success: true,
          output: { seriesTitle: 'Urban Fantasy Series', bookCount: 5 },
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        })
        .mockResolvedValueOnce({
          success: true,
          output: { book1Title: 'Shadows Rising', chapterCount: 25 },
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        })
        .mockResolvedValueOnce({
          success: true,
          output: { characters: ['Alice', 'Bob', 'Carol'] },
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        });

      const nodes = [
        {
          id: 'series-planning',
          name: 'Series Planning',
          description: 'Plan series',
          type: 'planning' as const,
          position: { x: 100, y: 100 },
          requiresApproval: false,
          contextConfig: { mode: 'simple' as const },
          provider: { type: 'claude-api' as const, config: { model: 'claude-3-5-sonnet-20241022', outputFormat: 'json' } },
          agent: 'series-planner',
          gate: false
        },
        {
          id: 'book-planning',
          name: 'Book Planning',
          description: 'Plan first book',
          type: 'planning' as const,
          position: { x: 100, y: 200 },
          requiresApproval: false,
          contextConfig: { mode: 'simple' as const },
          provider: { type: 'claude-api' as const, config: { model: 'claude-3-5-sonnet-20241022', outputFormat: 'json' } },
          agent: 'book-planner',
          gate: false
        },
        {
          id: 'character-creation',
          name: 'Character Creation',
          description: 'Create characters',
          type: 'planning' as const,
          position: { x: 100, y: 300 },
          requiresApproval: false,
          contextConfig: { mode: 'simple' as const },
          provider: { type: 'claude-api' as const, config: { model: 'claude-3-5-sonnet-20241022', outputFormat: 'json' } },
          agent: 'character-creator',
          gate: false
        }
      ];

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);

      for (const node of nodes) {
        const result = await executeNodeEnhanced(node, context);
        expect(result.status).toBe('success');
      }

      expect(context.nodeOutputs.size).toBe(3);
      expect(mockProviderManager.executePrompt).toHaveBeenCalledTimes(3);
    });
  });

  describe('Conditional Branching', () => {
    it('should follow correct branch based on condition', async () => {
      // Gate node that produces a score
      mockProviderManager.executePrompt.mockResolvedValueOnce({
        success: true,
        output: { score: 85, feedback: 'Good work' },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      });

      const gateNode: AgentWorkflowNode = {
        id: 'quality-gate',
        name: 'Quality Gate',
        description: 'Check quality',
        type: 'gate',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'quality-checker',
        gate: true,
        gateCondition: '$.score >= 80'
      };

      // Conditional node
      const conditionalNode: ConditionalNode = {
        id: 'check-score',
        name: 'Check Score',
        description: 'Branch based on score',
        type: 'conditional',
        position: { x: 100, y: 200 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        condition: '$.nodeOutputs.quality-gate.output.score >= 80',
        conditionType: 'jsonpath'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);

      // Execute gate
      const gateResult = await executeNodeEnhanced(gateNode, context);
      expect(gateResult.status).toBe('success');

      // Execute conditional
      const condResult = await executeNodeEnhanced(conditionalNode, context);
      expect(condResult.status).toBe('success');
      expect(condResult.variables.conditionResult).toBe(true);
    });

    it('should handle false branch condition', async () => {
      context.variables.score = 65;

      const conditionalNode: ConditionalNode = {
        id: 'check-low-score',
        name: 'Check Low Score',
        description: 'Branch on low score',
        type: 'conditional',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        condition: '$.variables.score >= 80',
        conditionType: 'jsonpath'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result = await executeNodeEnhanced(conditionalNode, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(false);
    });

    it('should support complex conditional logic', async () => {
      context.variables.score = 85;
      context.variables.approved = true;

      const conditionalNode: ConditionalNode = {
        id: 'complex-check',
        name: 'Complex Check',
        description: 'Multiple conditions',
        type: 'conditional',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        condition: '$.variables.score >= 80',
        conditionType: 'jsonpath'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result = await executeNodeEnhanced(conditionalNode, context);

      expect(result.status).toBe('success');
      expect(result.variables.conditionResult).toBe(true);
    });
  });

  describe('Loop Execution', () => {
    it('should execute forEach loop over chapters', async () => {
      context.variables.chapters = [
        { id: 1, title: 'Chapter 1' },
        { id: 2, title: 'Chapter 2' },
        { id: 3, title: 'Chapter 3' }
      ];

      const loopNode: LoopNode = {
        id: 'chapter-loop',
        name: 'Chapter Loop',
        description: 'Process each chapter',
        type: 'loop',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'forEach',
        collection: '$.variables.chapters',
        iteratorVariable: 'currentChapter',
        indexVariable: 'chapterIndex'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result = await executeNodeEnhanced(loopNode, context);

      expect(result.status).toBe('success');
      expect(result.variables.iterationCount).toBe(3);
      expect(result.variables.iterations).toHaveLength(3);
    });

    it('should execute count loop with fixed iterations', async () => {
      const loopNode: LoopNode = {
        id: 'count-loop',
        name: 'Count Loop',
        description: 'Loop 5 times',
        type: 'loop',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'count',
        count: 5,
        iteratorVariable: 'iteration',
        indexVariable: 'index'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result = await executeNodeEnhanced(loopNode, context);

      expect(result.status).toBe('success');
      expect(result.variables.iterationCount).toBe(5);
    });

    it('should execute while loop until condition is met', async () => {
      context.variables.counter = 0;

      const loopNode: LoopNode = {
        id: 'while-loop',
        name: 'While Loop',
        description: 'Loop while counter < 3',
        type: 'loop',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        loopType: 'while',
        whileCondition: '$.variables.counter < 3',
        maxIterations: 10,
        iteratorVariable: 'iteration'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result = await executeNodeEnhanced(loopNode, context);

      expect(result.status).toBe('success');
      expect(result.variables.iterationCount).toBeGreaterThan(0);
      expect(result.variables.iterationCount).toBeLessThanOrEqual(10);
    });
  });

  describe('File Operations', () => {
    it('should read and write files in sequence', async () => {
      // Read node
      const readNode: FileOperationNode = {
        id: 'read-file',
        name: 'Read File',
        description: 'Read input file',
        type: 'file',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'read',
        sourcePath: '/tmp/test-project/input.txt',
        encoding: 'utf8',
        requireProjectFolder: true
      };

      // Write node
      const writeNode: FileOperationNode = {
        id: 'write-file',
        name: 'Write File',
        description: 'Write output file',
        type: 'file',
        position: { x: 100, y: 200 },
        requiresApproval: false,
        contextConfig: {
          mode: 'advanced',
          inputs: [
            { source: '$.nodeOutputs.read-file.output.content', target: 'fileContent' }
          ]
        },
        operation: 'write',
        targetPath: '/tmp/test-project/output.txt',
        content: '{{fileContent}}',
        overwrite: true,
        requireProjectFolder: true
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);

      // Execute read
      const readResult = await executeNodeEnhanced(readNode, context);
      expect(readResult.status).toBe('success');
      expect(fs.readFile).toHaveBeenCalled();

      // Execute write
      const writeResult = await executeNodeEnhanced(writeNode, context);
      expect(writeResult.status).toBe('success');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should copy file from source to target', async () => {
      (fs.copy as jest.Mock).mockResolvedValue(undefined);

      const copyNode: FileOperationNode = {
        id: 'copy-file',
        name: 'Copy File',
        description: 'Copy manuscript',
        type: 'file',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'copy',
        sourcePath: '/tmp/test-project/draft.txt',
        targetPath: '/tmp/test-project/final.txt',
        requireProjectFolder: true
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result = await executeNodeEnhanced(copyNode, context);

      expect(result.status).toBe('success');
      expect(fs.copy).toHaveBeenCalled();
    });
  });

  describe('Variable Passing Between Nodes', () => {
    it('should pass variables in simple mode', async () => {
      mockProviderManager.executePrompt
        .mockResolvedValueOnce({
          success: true,
          output: { title: 'My Series', books: 5 },
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        })
        .mockResolvedValueOnce({
          success: true,
          output: { confirmation: 'Series created with 5 books' },
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        });

      const node1: AgentWorkflowNode = {
        id: 'create-series',
        name: 'Create Series',
        description: 'Create series structure',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'series-creator',
        gate: false
      };

      const node2: AgentWorkflowNode = {
        id: 'confirm-series',
        name: 'Confirm Series',
        description: 'Confirm series creation',
        type: 'writing',
        position: { x: 100, y: 200 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'confirmer',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);

      const result1 = await executeNodeEnhanced(node1, context);
      expect(result1.status).toBe('success');
      expect(result1.variables).toHaveProperty('output');

      const result2 = await executeNodeEnhanced(node2, context);
      expect(result2.status).toBe('success');

      // Check that node2 received context from node1
      const node2Context = mockProviderManager.executePrompt.mock.calls[1][2];
      expect(node2Context).toBeDefined();
    });

    it('should pass variables in advanced mode with explicit mappings', async () => {
      mockProviderManager.executePrompt.mockResolvedValueOnce({
        success: true,
        output: {
          characters: [
            { name: 'Alice', role: 'protagonist' },
            { name: 'Bob', role: 'antagonist' }
          ]
        },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      });

      const node1: AgentWorkflowNode = {
        id: 'create-characters',
        name: 'Create Characters',
        description: 'Create character profiles',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: {
          mode: 'advanced',
          outputs: [
            { source: '$.output.characters[0].name', target: 'protagonistName' },
            { source: '$.output.characters[1].name', target: 'antagonistName' }
          ]
        },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'character-creator',
        gate: false
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);
      const result = await executeNodeEnhanced(node1, context);

      expect(result.status).toBe('success');
      expect(context.variables.protagonistName).toBe('Alice');
      expect(context.variables.antagonistName).toBe('Bob');
    });
  });

  describe('Complete Workflow Scenarios', () => {
    it('should execute a mini chapter writing workflow', async () => {
      // Setup mocks for each phase
      mockProviderManager.executePrompt
        .mockResolvedValueOnce({
          success: true,
          output: { outline: 'Chapter outline...', wordCount: 3000 },
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        })
        .mockResolvedValueOnce({
          success: true,
          output: { content: 'Chapter content...', actualWordCount: 3200 },
          usage: { promptTokens: 500, completionTokens: 3000, totalTokens: 3500 }
        })
        .mockResolvedValueOnce({
          success: true,
          output: { score: 85, feedback: 'Well written' },
          usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 }
        });

      const planNode: AgentWorkflowNode = {
        id: 'plan-chapter',
        name: 'Plan Chapter',
        description: 'Plan chapter structure',
        type: 'planning',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'chapter-planner',
        gate: false
      };

      const writeNode: AgentWorkflowNode = {
        id: 'write-chapter',
        name: 'Write Chapter',
        description: 'Write chapter content',
        type: 'writing',
        position: { x: 100, y: 200 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'chapter-writer',
        gate: false
      };

      const reviewNode: AgentWorkflowNode = {
        id: 'review-chapter',
        name: 'Review Chapter',
        description: 'Review chapter quality',
        type: 'gate',
        position: { x: 100, y: 300 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'chapter-reviewer',
        gate: true,
        gateCondition: '$.score >= 80'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);

      // Execute workflow
      const planResult = await executeNodeEnhanced(planNode, context);
      expect(planResult.status).toBe('success');

      const writeResult = await executeNodeEnhanced(writeNode, context);
      expect(writeResult.status).toBe('success');

      const reviewResult = await executeNodeEnhanced(reviewNode, context);
      expect(reviewResult.status).toBe('success');

      // Verify all nodes executed
      expect(context.nodeOutputs.size).toBe(3);
      expect(mockProviderManager.executePrompt).toHaveBeenCalledTimes(3);
    });

    it('should execute workflow with conditional retry', async () => {
      let attemptCount = 0;

      mockProviderManager.executePrompt.mockImplementation(async () => {
        attemptCount++;
        const score = attemptCount === 1 ? 65 : 85;
        return {
          success: true,
          output: { score, feedback: `Attempt ${attemptCount}` },
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        };
      });

      const gateNode: AgentWorkflowNode = {
        id: 'quality-check',
        name: 'Quality Check',
        description: 'Check quality',
        type: 'gate',
        position: { x: 100, y: 100 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        provider: {
          type: 'claude-api',
          name: 'Test Provider',
          config: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        agent: 'quality-checker',
        gate: true,
        gateCondition: '$.score >= 80'
      };

      const executeNodeEnhanced = (executor as any).executeNodeEnhanced.bind(executor);

      // First attempt - should fail gate
      const result1 = await executeNodeEnhanced(gateNode, context);
      expect(result1.status).toBe('failed');
      expect(result1.error).toContain('Gate condition not met');

      // Second attempt - should pass gate
      const result2 = await executeNodeEnhanced(gateNode, context);
      expect(result2.status).toBe('success');
    });
  });
});
