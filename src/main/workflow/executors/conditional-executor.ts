/**
 * Conditional Executor
 *
 * Evaluates conditions to determine workflow branching.
 * Supports JSONPath-based conditions for if/else logic.
 */

import { NodeExecutor } from './base-executor';
import { WorkflowNode, ConditionalNode, NodeOutput, isConditionalNode } from '../../../types/workflow-nodes';
import { ContextManager } from '../context-manager';
import { logWithCategory, LogCategory } from '../../logger';

export class ConditionalExecutor implements NodeExecutor {
  readonly nodeType = 'conditional';
  private contextManager: ContextManager;

  constructor() {
    this.contextManager = new ContextManager();
  }

  /**
   * Execute conditional node
   * Evaluates the condition and returns which branch to take
   */
  async execute(node: WorkflowNode, context: any): Promise<NodeOutput> {
    if (!isConditionalNode(node)) {
      throw new Error(`ConditionalExecutor received invalid node type: ${node.type}`);
    }

    const conditionalNode = node as ConditionalNode;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing conditional node: ${conditionalNode.name}`);
    logWithCategory('debug', LogCategory.WORKFLOW,
      `Condition: ${conditionalNode.condition} (type: ${conditionalNode.conditionType})`);

    try {
      let conditionResult: boolean;

      // Evaluate condition based on type
      if (conditionalNode.conditionType === 'jsonpath') {
        conditionResult = this.evaluateJSONPathCondition(conditionalNode.condition, context);
      } else if (conditionalNode.conditionType === 'javascript') {
        conditionResult = this.evaluateJavaScriptCondition(conditionalNode.condition, context);
      } else {
        throw new Error(`Unsupported condition type: ${conditionalNode.conditionType}`);
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Condition evaluated to: ${conditionResult}`);

      // Return successful output with condition result
      // Note: The workflow engine will use edges with labels 'true' and 'false'
      // to determine which node to execute next based on conditionResult
      return {
        nodeId: conditionalNode.id,
        nodeName: conditionalNode.name,
        timestamp: new Date(),
        status: 'success',
        output: {
          conditionResult,
          condition: conditionalNode.condition,
          conditionType: conditionalNode.conditionType,
        },
        variables: {
          conditionResult,
        },
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Conditional node evaluation failed: ${error.message}`);

      // On error, default to false and log the error
      // This provides graceful degradation rather than failing the entire workflow
      logWithCategory('warn', LogCategory.WORKFLOW,
        `Condition evaluation error, defaulting to false`);

      return {
        nodeId: conditionalNode.id,
        nodeName: conditionalNode.name,
        timestamp: new Date(),
        status: 'failed',
        output: {
          conditionResult: false,
          condition: conditionalNode.condition,
          conditionType: conditionalNode.conditionType,
          error: error.message,
        },
        variables: {
          conditionResult: false,
        },
        error: error.message,
        errorStack: error.stack,
      };
    }
  }

  /**
   * Evaluate JSONPath-based condition
   * Uses ContextManager.evaluateCondition() for standard JSONPath expressions
   *
   * Supports conditions like:
   * - $.score >= 70
   * - $.status === "approved"
   * - $.errorCount < 5
   * - {{variable}} >= 100
   */
  private evaluateJSONPathCondition(condition: string, context: any): boolean {
    try {
      const result = this.contextManager.evaluateCondition(condition, context);

      logWithCategory('debug', LogCategory.WORKFLOW,
        `JSONPath condition "${condition}" evaluated to: ${result}`);

      return result;

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `JSONPath condition evaluation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Evaluate JavaScript-based condition
   * Provides more flexibility for complex conditions
   *
   * The JavaScript code should return a boolean value
   * Context is available as 'context' variable
   *
   * Example:
   * "context.score >= 70 && context.status === 'approved'"
   */
  private evaluateJavaScriptCondition(condition: string, context: any): boolean {
    try {
      // Create a safe evaluation function
      // The condition should be a JavaScript expression that returns boolean
      const evaluationFn = new Function('context', `return (${condition});`);
      const result = evaluationFn(context);

      logWithCategory('debug', LogCategory.WORKFLOW,
        `JavaScript condition "${condition}" evaluated to: ${result}`);

      // Ensure result is boolean
      if (typeof result !== 'boolean') {
        throw new Error(`JavaScript condition must return boolean, got ${typeof result}`);
      }

      return result;

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `JavaScript condition evaluation failed: ${error.message}`);
      throw error;
    }
  }
}
