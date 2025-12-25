/**
 * Workflow Context Management Types
 *
 * Manages variable passing and data flow between workflow nodes.
 * Supports both Simple mode (automatic) and Advanced mode (explicit JSONPath mappings).
 */

import { NodeOutput } from './workflow-nodes';

/**
 * Loop execution context for nested loops
 */
export interface LoopContext {
  loopNodeId: string;
  iteratorVariable: string;
  indexVariable?: string;
  currentIndex: number;
  totalItems: number;
  collectionData: any[];
}

/**
 * Workflow execution context - global state during workflow execution
 */
export interface WorkflowExecutionContext {
  // Workflow instance info
  instanceId: string;
  workflowId: string;
  projectFolder: string;  // REQUIRED before execution for file operations

  // Simple mode: flat key-value variables
  variables: Record<string, any>;

  // Advanced mode: structured node outputs with full metadata
  nodeOutputs: Map<string, NodeOutput>;

  // MCP data access (series, books, characters, etc.)
  mcpData: {
    series?: any;
    books?: any[];
    characters?: any[];
    scenes?: any[];
    chapters?: any[];
    // Extensible for other domain objects
    [key: string]: any;
  };

  // Execution state
  currentNodeId: string;
  completedNodes: string[];

  // Loop state (stack for nested loops)
  loopStack: LoopContext[];

  // Metadata
  startedAt: Date;
  userId: number;
  seriesId?: number;
}

/**
 * JSONPath evaluator interface
 */
export interface ContextEvaluator {
  /**
   * Evaluate a JSONPath expression against context
   * Examples:
   * - $.variables.userName
   * - $.nodeOutputs.node1.output.books[0].title
   * - $.mcpData.series.title
   */
  evaluate(expression: string, context: WorkflowExecutionContext): any;

  /**
   * Substitute variables in a template string
   * Examples:
   * - "Hello {{userName}}" -> "Hello John"
   * - "{{baseUrl}}/api/books/{{bookId}}" -> "https://api.example.com/api/books/123"
   */
  substitute(template: string, context: WorkflowExecutionContext): string;

  /**
   * Evaluate a condition expression
   * Examples:
   * - "$.score >= 70" -> true/false
   * - "$.status === 'approved'" -> true/false
   */
  evaluateCondition(expression: string, context: WorkflowExecutionContext): boolean;
}

/**
 * Variable reference for UI (variable browser)
 */
export interface VariableReference {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  path: string;        // JSONPath: $.node1.output.field
  value?: any;         // Current value (if available)
  type: string;        // JavaScript type: 'string', 'number', 'array', 'object'
}

/**
 * Context snapshot for debugging/preview
 */
export interface ContextSnapshot {
  timestamp: Date;
  nodeId: string;
  nodeName: string;
  variables: Record<string, any>;
  nodeOutputs: Array<{
    nodeId: string;
    nodeName: string;
    output: any;
  }>;
  loopStack: LoopContext[];
}

/**
 * Context build result
 */
export interface NodeContextResult {
  success: boolean;
  context: any;
  error?: string;
  missingVariables?: string[];  // Variables referenced but not found
}

/**
 * Variable extraction result
 */
export interface VariableExtractionResult {
  success: boolean;
  variables: Record<string, any>;
  error?: string;
  warnings?: string[];  // e.g., "Variable 'x' not found in output"
}
