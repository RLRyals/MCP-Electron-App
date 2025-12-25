/**
 * Loop Executor
 *
 * Implements the NodeExecutor interface for LoopNode.
 * Supports three loop types:
 * - forEach: Iterate over a collection from context
 * - while: Loop until condition becomes false
 * - count: Fixed number of iterations
 *
 * Manages loop stack in context for nested loops and executes child nodes
 * for each iteration, aggregating results.
 */

import { NodeExecutor } from './base-executor';
import { WorkflowNode, LoopNode, NodeOutput, isLoopNode } from '../../../types/workflow-nodes';
import { WorkflowExecutionContext, LoopContext } from '../../../types/workflow-context';
import { ContextManager } from '../context-manager';
import { logWithCategory, LogCategory } from '../../logger';

export class LoopExecutor implements NodeExecutor {
  readonly nodeType = 'loop';

  private contextManager: ContextManager;

  // Maximum iterations for safety (prevents infinite loops)
  private readonly DEFAULT_MAX_ITERATIONS = 1000;

  constructor() {
    this.contextManager = new ContextManager();
  }

  /**
   * Execute loop node
   * Manages loop context, iterates, and aggregates results
   */
  async execute(node: WorkflowNode, context: any): Promise<NodeOutput> {
    if (!isLoopNode(node)) {
      throw new Error(`LoopExecutor received invalid node type: ${node.type}`);
    }

    const loopNode = node as LoopNode;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing loop node: ${loopNode.name} (type: ${loopNode.loopType})`);

    try {
      // Determine loop configuration
      const loopConfig = this.prepareLoopConfiguration(loopNode, context);

      if (!loopConfig.valid) {
        return {
          nodeId: loopNode.id,
          nodeName: loopNode.name,
          timestamp: new Date(),
          status: 'failed',
          output: null,
          variables: {},
          error: loopConfig.error,
        };
      }

      // Execute loop iterations
      const iterationResults = await this.executeIterations(
        loopNode,
        context,
        loopConfig
      );

      // Aggregate results
      const aggregatedOutput = {
        loopType: loopNode.loopType,
        totalIterations: iterationResults.length,
        iterations: iterationResults,
        summary: this.generateSummary(iterationResults),
      };

      return {
        nodeId: loopNode.id,
        nodeName: loopNode.name,
        timestamp: new Date(),
        status: 'success',
        output: aggregatedOutput,
        variables: {
          iterations: iterationResults,
          iterationCount: iterationResults.length,
          lastIteration: iterationResults[iterationResults.length - 1] || null,
        },
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Loop node failed: ${error.message}`);

      return {
        nodeId: loopNode.id,
        nodeName: loopNode.name,
        timestamp: new Date(),
        status: 'failed',
        output: null,
        variables: {},
        error: error.message,
        errorStack: error.stack,
      };
    }
  }

  /**
   * Prepare loop configuration based on loop type
   */
  private prepareLoopConfiguration(
    loopNode: LoopNode,
    context: any
  ): LoopConfiguration {
    const globalContext = context as WorkflowExecutionContext;

    switch (loopNode.loopType) {
      case 'forEach': {
        // Evaluate collection from context
        if (!loopNode.collection) {
          return {
            valid: false,
            error: 'forEach loop requires a collection path',
          };
        }

        try {
          const collection = this.contextManager.evaluateJSONPath(
            loopNode.collection,
            globalContext
          );

          if (!Array.isArray(collection)) {
            return {
              valid: false,
              error: `Collection at ${loopNode.collection} is not an array`,
            };
          }

          return {
            valid: true,
            type: 'forEach',
            collection,
            totalIterations: collection.length,
          };

        } catch (error: any) {
          return {
            valid: false,
            error: `Failed to evaluate collection: ${error.message}`,
          };
        }
      }

      case 'while': {
        // While loops use condition evaluation
        if (!loopNode.whileCondition) {
          return {
            valid: false,
            error: 'while loop requires a condition',
          };
        }

        const maxIterations = loopNode.maxIterations || this.DEFAULT_MAX_ITERATIONS;

        return {
          valid: true,
          type: 'while',
          condition: loopNode.whileCondition,
          maxIterations,
        };
      }

      case 'count': {
        // Count loops use fixed number
        if (!loopNode.count || loopNode.count < 1) {
          return {
            valid: false,
            error: 'count loop requires a positive count value',
          };
        }

        return {
          valid: true,
          type: 'count',
          totalIterations: loopNode.count,
        };
      }

      default:
        return {
          valid: false,
          error: `Unknown loop type: ${loopNode.loopType}`,
        };
    }
  }

  /**
   * Execute loop iterations
   */
  private async executeIterations(
    loopNode: LoopNode,
    context: any,
    config: LoopConfiguration
  ): Promise<IterationResult[]> {
    const globalContext = context as WorkflowExecutionContext;
    const results: IterationResult[] = [];

    let iteration = 0;
    let shouldContinue = true;

    while (shouldContinue) {
      // Check termination conditions
      if (config.type === 'forEach' && iteration >= config.collection!.length) {
        break;
      }

      if (config.type === 'count' && iteration >= config.totalIterations!) {
        break;
      }

      if (config.type === 'while') {
        // Evaluate condition
        const conditionResult = this.contextManager.evaluateCondition(
          config.condition!,
          globalContext
        );

        if (!conditionResult) {
          logWithCategory('info', LogCategory.WORKFLOW,
            `While loop condition became false after ${iteration} iterations`);
          break;
        }

        // Safety check for max iterations
        if (iteration >= config.maxIterations!) {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `While loop reached max iterations (${config.maxIterations})`);
          break;
        }
      }

      // Create loop context for this iteration
      const loopContext: LoopContext = {
        loopNodeId: loopNode.id,
        iteratorVariable: loopNode.iteratorVariable,
        indexVariable: loopNode.indexVariable,
        currentIndex: iteration,
        totalItems: config.totalIterations || -1, // -1 for while loops
        collectionData: config.type === 'forEach' ? config.collection! : [],
      };

      // Push loop context onto stack
      if (!globalContext.loopStack) {
        globalContext.loopStack = [];
      }
      globalContext.loopStack.push(loopContext);

      // Set iteration variables in context
      if (config.type === 'forEach') {
        globalContext.variables[loopNode.iteratorVariable] = config.collection![iteration];
      } else {
        globalContext.variables[loopNode.iteratorVariable] = iteration;
      }

      if (loopNode.indexVariable) {
        globalContext.variables[loopNode.indexVariable] = iteration;
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Loop iteration ${iteration + 1}: ${loopNode.iteratorVariable} = ${
          config.type === 'forEach'
            ? JSON.stringify(config.collection![iteration]).substring(0, 50)
            : iteration
        }`);

      // Execute child nodes for this iteration
      // Note: This is a placeholder. The actual WorkflowExecutor will need to
      // execute the child nodes connected to this loop node.
      const iterationResult = await this.executeIterationBody(
        loopNode,
        globalContext,
        iteration
      );

      results.push(iterationResult);

      // Pop loop context from stack
      globalContext.loopStack.pop();

      // Check for early exit on error
      if (iterationResult.status === 'failed') {
        // For now, we'll stop on error. Could make this configurable later.
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Loop iteration ${iteration} failed, stopping loop execution`);
        break;
      }

      iteration++;
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Loop completed: ${results.length} iterations executed`);

    return results;
  }

  /**
   * Execute the body of a single iteration
   *
   * NOTE: This is a placeholder. The actual implementation will need to
   * coordinate with WorkflowExecutor to execute child nodes.
   *
   * For now, we return a placeholder result indicating what would be executed.
   */
  private async executeIterationBody(
    loopNode: LoopNode,
    context: WorkflowExecutionContext,
    iteration: number
  ): Promise<IterationResult> {
    // Placeholder implementation
    // In the full implementation, this would:
    // 1. Find child nodes connected to this loop node
    // 2. Execute them in order
    // 3. Collect their outputs
    // 4. Return aggregated result

    const iteratorValue = context.variables[loopNode.iteratorVariable];

    return {
      iteration,
      status: 'success',
      timestamp: new Date(),
      variables: {
        [loopNode.iteratorVariable]: iteratorValue,
        ...(loopNode.indexVariable ? { [loopNode.indexVariable]: iteration } : {}),
      },
      output: {
        message: `Iteration ${iteration} executed (placeholder)`,
        iteratorValue,
        note: 'This is a placeholder. Child node execution will be implemented when WorkflowExecutor integration is complete.',
      },
    };
  }

  /**
   * Generate summary statistics for loop execution
   */
  private generateSummary(results: IterationResult[]): LoopSummary {
    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    return {
      totalIterations: results.length,
      successCount,
      failureCount,
      successRate: results.length > 0 ? successCount / results.length : 0,
    };
  }
}

/**
 * Loop configuration after evaluation
 */
interface LoopConfiguration {
  valid: boolean;
  error?: string;
  type?: 'forEach' | 'while' | 'count';
  collection?: any[];
  totalIterations?: number;
  condition?: string;
  maxIterations?: number;
}

/**
 * Result of a single iteration
 */
interface IterationResult {
  iteration: number;
  status: 'success' | 'failed';
  timestamp: Date;
  variables: Record<string, any>;
  output: any;
  error?: string;
}

/**
 * Summary statistics for loop execution
 */
interface LoopSummary {
  totalIterations: number;
  successCount: number;
  failureCount: number;
  successRate: number;
}
