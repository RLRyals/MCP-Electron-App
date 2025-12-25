/**
 * Base Executor Interface
 *
 * All node executors must implement this interface
 */

import { WorkflowNode, NodeOutput } from '../../../types/workflow-nodes';

export interface NodeExecutor {
  /**
   * Execute a workflow node with the given context
   *
   * @param node - The workflow node to execute
   * @param context - Execution context (built by ContextManager)
   * @returns NodeOutput with results
   */
  execute(node: WorkflowNode, context: any): Promise<NodeOutput>;

  /**
   * Node type this executor handles
   */
  readonly nodeType: string;
}
