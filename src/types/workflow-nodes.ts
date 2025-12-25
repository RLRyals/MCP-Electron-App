/**
 * Enhanced Workflow Node Type System
 *
 * Supports multiple node types for comprehensive workflow orchestration:
 * - Agent nodes (AI-powered planning/writing/gates)
 * - User input nodes (capture ideas and feedback)
 * - Code execution nodes (JavaScript/Python)
 * - HTTP request nodes (API integrations)
 * - File operation nodes (read/write/copy/move)
 * - Conditional nodes (if/else branching)
 * - Loop nodes (forEach/while/count iterations)
 * - Subworkflow nodes (nested workflows)
 */

import { LLMProviderConfig } from './llm-providers';

/**
 * Retry configuration for node execution
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number; // Exponential backoff: delay * (multiplier ^ attempt)
}

/**
 * Sandbox configuration for code execution
 */
export interface SandboxConfig {
  enabled: boolean;
  allowedModules?: string[]; // Whitelist for require/import
  memoryLimitMb?: number;
  cpuTimeoutMs?: number;
}

/**
 * Context configuration - Simple vs Advanced mode
 */
export interface ContextConfig {
  mode: 'simple' | 'advanced';
  inputs?: ContextMapping[];   // Advanced: explicit input mapping
  outputs?: ContextMapping[];  // Advanced: explicit output mapping
}

/**
 * Context mapping for variable flow between nodes
 */
export interface ContextMapping {
  source: string;      // JSONPath expression: $.previousNode.field or {{variable}}
  target: string;      // Variable name in target node
  transform?: string;  // Optional JavaScript transformation: "x => x.toUpperCase()"
}

/**
 * Base interface for all workflow nodes
 */
export interface BaseWorkflowNode {
  id: string;
  name: string;
  description: string;
  position: { x: number; y: number };

  // Execution settings
  requiresApproval: boolean;
  retryConfig?: RetryConfig;
  timeoutMs?: number;
  skipCondition?: string; // JSONPath expression to determine if node should be skipped

  // Context configuration
  contextConfig: ContextConfig;
}

/**
 * Agent Workflow Node - AI-powered nodes (planning, writing, gates)
 */
export interface AgentWorkflowNode extends BaseWorkflowNode {
  type: 'planning' | 'writing' | 'gate';

  // LLM Provider (per-node selection)
  provider: LLMProviderConfig;

  // Agent and skill configuration
  agent: string;        // Agent name (e.g., 'series-architect-agent')
  skill?: string;       // Optional skill name (e.g., 'series-planning-skill')

  // EXPLICIT USER-VISIBLE PROMPT
  // This is what actually gets sent to the AI - must be visible and editable
  prompt: string;       // User-defined prompt with variable substitution support ({{varName}})
  systemPrompt?: string; // Optional system prompt override

  // Gate-specific fields
  gate: boolean;
  gateCondition?: string; // Condition for quality gate to pass
}

/**
 * User Input Node - Capture user input during workflow execution
 */
export interface UserInputNode extends BaseWorkflowNode {
  type: 'user-input';

  // Input configuration
  prompt: string;         // What to ask the user
  inputType: 'text' | 'textarea' | 'number' | 'select';

  // Validation
  required: boolean;
  validation?: {
    pattern?: string;     // Regex pattern
    minLength?: number;
    maxLength?: number;
    min?: number;         // For number inputs
    max?: number;
  };

  // For select inputs
  options?: Array<{ label: string; value: string }>;

  // Default value
  defaultValue?: string | number;
}

/**
 * Code Execution Node - Run JavaScript or Python code
 */
export interface CodeExecutionNode extends BaseWorkflowNode {
  type: 'code';

  // Language and code
  language: 'javascript' | 'python';
  code: string;

  // Sandbox settings (security)
  sandbox: SandboxConfig;
}

/**
 * HTTP Request Node - Make API calls
 */
export interface HttpRequestNode extends BaseWorkflowNode {
  type: 'http';

  // Request configuration
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;  // Supports variable substitution: {{baseUrl}}/api/books
  headers?: Record<string, string>;
  body?: string | object;

  // Response handling
  responseType: 'json' | 'text' | 'buffer';

  // Authentication
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'api-key';
    config: Record<string, string>; // Keys depend on auth type
  };
}

/**
 * File Operation Node - File system operations
 */
export interface FileOperationNode extends BaseWorkflowNode {
  type: 'file';

  operation: 'read' | 'write' | 'copy' | 'move' | 'delete' | 'exists';

  // Paths (support variable substitution)
  sourcePath?: string;
  targetPath?: string;

  // For read operations
  encoding?: 'utf8' | 'binary';

  // For write operations
  content?: string;
  overwrite?: boolean;

  // Safety: restrict operations to project folder
  requireProjectFolder: boolean;
}

/**
 * Conditional Node - Branch based on conditions
 */
export interface ConditionalNode extends BaseWorkflowNode {
  type: 'conditional';

  // Condition evaluation
  condition: string;  // JSONPath expression: $.score >= 70
  conditionType: 'jsonpath' | 'javascript';

  // Branches are defined by edges with labels
  // No additional config needed here
}

/**
 * Loop Node - Iterate over collections or repeat until condition
 */
export interface LoopNode extends BaseWorkflowNode {
  type: 'loop';

  // Loop configuration
  loopType: 'forEach' | 'while' | 'count';

  // For forEach loops
  collection?: string;  // JSONPath to array: $.books

  // For while loops
  whileCondition?: string;  // JSONPath condition
  maxIterations?: number;   // Safety limit

  // For count loops
  count?: number;

  // Variable names for current iteration
  iteratorVariable: string;  // e.g., "currentBook"
  indexVariable?: string;    // e.g., "bookIndex"

  // Loop body is defined by edges pointing to nodes and back
}

/**
 * SubWorkflow Node - Execute another workflow as a nested step
 */
export interface SubWorkflowNode extends BaseWorkflowNode {
  type: 'subworkflow';

  subWorkflowId: string;
  subWorkflowVersion?: string;  // 'latest' or specific version
}

/**
 * Union type for all workflow nodes
 */
export type WorkflowNode =
  | AgentWorkflowNode
  | UserInputNode
  | CodeExecutionNode
  | HttpRequestNode
  | FileOperationNode
  | ConditionalNode
  | LoopNode
  | SubWorkflowNode;

/**
 * Type guard functions for runtime type checking
 */
export function isAgentNode(node: WorkflowNode): node is AgentWorkflowNode {
  return node.type === 'planning' || node.type === 'writing' || node.type === 'gate';
}

export function isUserInputNode(node: WorkflowNode): node is UserInputNode {
  return node.type === 'user-input';
}

export function isCodeExecutionNode(node: WorkflowNode): node is CodeExecutionNode {
  return node.type === 'code';
}

export function isHttpRequestNode(node: WorkflowNode): node is HttpRequestNode {
  return node.type === 'http';
}

export function isFileOperationNode(node: WorkflowNode): node is FileOperationNode {
  return node.type === 'file';
}

export function isConditionalNode(node: WorkflowNode): node is ConditionalNode {
  return node.type === 'conditional';
}

export function isLoopNode(node: WorkflowNode): node is LoopNode {
  return node.type === 'loop';
}

export function isSubWorkflowNode(node: WorkflowNode): node is SubWorkflowNode {
  return node.type === 'subworkflow';
}

/**
 * Node execution output
 */
export interface NodeOutput {
  nodeId: string;
  nodeName: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'skipped';

  // Raw output from executor
  output: any;

  // Extracted variables (from outputMapping in advanced mode)
  variables: Record<string, any>;

  // Error details (if failed)
  error?: string;
  errorStack?: string;
}
