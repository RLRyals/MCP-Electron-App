/**
 * Complete TypeScript Type System for FictionLab Workflow Engine
 *
 * Four-layer architecture:
 * 1. Workflows - Visual graphs with phases
 * 2. Agents - AI personas that orchestrate
 * 3. Skills - Executable processes
 * 4. MCP Servers - Data persistence
 */

// Import enhanced node types and LLM providers
import type { WorkflowNode as EnhancedWorkflowNode } from './workflow-nodes';
import type { LLMProviderConfig } from './llm-providers';
import type { WorkflowExecutionContext } from './workflow-context';

// Re-export for convenience
export type { EnhancedWorkflowNode, LLMProviderConfig, WorkflowExecutionContext };
export * from './workflow-nodes';
export * from './llm-providers';
export * from './workflow-context';

/**
 * Phase types in the workflow
 * Includes both legacy types and new enhanced node types
 */
export type PhaseType =
  | 'planning'
  | 'writing'
  | 'gate'
  | 'user-input'
  | 'user'
  | 'code'
  | 'http'
  | 'file'
  | 'conditional'
  | 'loop'
  | 'subworkflow';

/**
 * Workflow execution status
 */
export type WorkflowStatus = 'draft' | 'ready' | 'in_progress' | 'paused' | 'complete' | 'failed';

/**
 * Phase execution status
 */
export type PhaseStatus = 'pending' | 'running' | 'complete' | 'failed' | 'blocked' | 'skipped';

/**
 * Gate result
 */
export type GateResult = 'pass' | 'fail' | 'pending';

/**
 * Individual phase in a workflow
 */
export interface WorkflowPhase {
  id: number;
  name: string;
  fullName: string;
  type: PhaseType;
  agent: string;                    // Which agent executes this phase
  skill?: string;                   // Which skill the agent invokes (optional)
  subWorkflowId?: string;           // ID of sub-workflow (for subworkflow type)
  description: string;
  process: string[];                // Steps in this phase
  output: string;                   // What this phase produces
  mcp: string;                      // MCP interactions description
  gate: boolean;                    // Is this a quality gate?
  gateCondition?: string;           // Condition to pass gate
  requiresApproval: boolean;        // User approval required?
  position: { x: number; y: number }; // Canvas position for visualization
}

/**
 * Dependencies discovered from workflow
 */
export interface WorkflowDependencies {
  agents: string[];                 // Agent markdown files needed
  skills: string[];                 // Skills needed (in ~/.claude/skills/)
  mcpServers: string[];             // MCP servers required
  subWorkflows?: string[];          // Nested workflows
}

/**
 * Complete workflow definition (parsed from YAML/JSON)
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  phases: WorkflowPhase[];
  dependencies: WorkflowDependencies;
  metadata: {
    author?: string;
    created: string;
    updated: string;
    tags?: string[];
  };
}

/**
 * Workflow graph representation (for React Flow visualization)
 * Uses WorkflowNode from workflow-nodes.ts (the enhanced format)
 */
export interface WorkflowGraph {
  nodes: EnhancedWorkflowNode[];  // Use the new enhanced format
  edges: WorkflowEdge[];
  metadata?: WorkflowMetadata;
}

/**
 * Edge connecting workflow nodes
 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: 'sequential' | 'conditional' | 'loop';
  condition?: string;
  label?: string;
  style?: Record<string, any>;
}

/**
 * Workflow metadata for visualization
 */
export interface WorkflowMetadata {
  workflowId: string;
  workflowName: string;
  version: string;
  breadcrumb?: string[];            // For drill-down navigation: ["12-Phase Pipeline", "Phase 3: Series Architect"]
}

/**
 * Workflow execution instance (runtime)
 */
export interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  currentPhase: number;
  startedAt: Date;
  completedAt?: Date;
  context: Record<string, any>;     // Execution context variables
  checkpoints: WorkflowCheckpoint[];
  error?: string;
}

/**
 * Checkpoint for resume capability
 */
export interface WorkflowCheckpoint {
  id: string;
  instanceId: string;
  phaseId: number;
  state: Record<string, any>;
  createdAt: Date;
}

/**
 * Phase execution record
 */
export interface PhaseExecution {
  id: string;
  instanceId: string;
  phaseId: number;
  status: PhaseStatus;
  startedAt: Date;
  completedAt?: Date;
  output?: Record<string, any>;
  error?: string;
  claudeCodeSession?: string;       // Claude Code session ID (if applicable)
}

/**
 * Quality gate execution and result
 */
export interface QualityGate {
  id: string;
  instanceId: string;
  phaseId: number;
  gateType: string;                 // 'npe_validation', 'commercial_validation', 'user_approval'
  criteria: string;
  result: GateResult;
  score?: number;
  details?: Record<string, any>;
  createdAt: Date;
}

/**
 * Dependency check result
 */
export interface DependencyCheckResult {
  component: string;                // Agent name, skill name, or MCP server name
  type: 'agent' | 'skill' | 'mcp';
  exists: boolean;
  path?: string;                    // Where it exists (if found)
  requiresInstallation: boolean;
}

/**
 * Installation plan for missing dependencies
 */
export interface InstallationPlan {
  workflow: WorkflowDefinition;
  missing: {
    agents: string[];
    skills: string[];
    mcpServers: string[];
  };
  existing: {
    agents: string[];
    skills: string[];
    mcpServers: string[];
  };
  actions: InstallationAction[];
}

/**
 * Individual installation action
 */
export interface InstallationAction {
  type: 'copy_agent' | 'copy_skill' | 'initialize_mcp';
  component: string;
  source?: string;
  destination: string;
  description: string;
}

/**
 * Workflow import result
 */
export interface WorkflowImportResult {
  success: boolean;
  workflowId: string;
  workflow: WorkflowDefinition;
  graph: WorkflowGraph;
  installationPlan: InstallationPlan;
  error?: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  success: boolean;
  instanceId: string;
  completedPhases: number;
  totalPhases: number;
  currentPhase?: number;
  status: WorkflowStatus;
  error?: string;
  errorPhase?: number;
}

/**
 * Source of workflow execution
 */
export type WorkflowSource = 'fictionlab_ui' | 'claude_code' | 'typingmind';

/**
 * Active workflow instance status
 */
export type ActiveWorkflowStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Active workflow instance for cross-project tracking
 * Used by the Workflow Manager Panel to display all running workflows
 */
export interface ActiveWorkflowInstance {
  id: string;
  workflowId: string;
  workflowName: string;
  source: WorkflowSource;
  projectFolder: string;
  projectName: string;
  currentNodeId: string;
  currentNodeName: string;
  status: ActiveWorkflowStatus;
  progressPercent: number;
  totalNodes: number;
  completedNodes: number;
  startedAt: string;
  updatedAt: string;
  availableNodes: { id: string; name: string }[];
  metadata?: Record<string, any>;
}

/**
 * Workflow update event types
 */
export type WorkflowUpdateType = 'progress' | 'status' | 'node_changed' | 'completed' | 'failed';

/**
 * Workflow update event payload
 * Broadcast via IPC when workflow state changes
 */
export interface WorkflowUpdate {
  registryId: string;
  type: WorkflowUpdateType;
  data: Partial<ActiveWorkflowInstance>;
  timestamp: string;
}

// ============================================================================
// DATABASE FORMAT TYPES
// These types represent workflows as stored in the database via MCP
// The "_json" suffix indicates fields that are serialized JSON in the database
// but typed objects in TypeScript
// ============================================================================

/**
 * Workflow definition as stored in database
 * This is the format returned by MCP workflow-manager server
 *
 * Key differences from file-based WorkflowDefinition:
 * - Uses `graph_json` instead of a separate graph property
 * - Uses `dependencies_json` instead of `dependencies`
 * - Includes database-specific fields like `tags`, `is_system`, `created_by`
 */
export interface DatabaseWorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;

  /**
   * Graph-based workflow structure (PRIMARY)
   * Contains nodes and edges for the workflow canvas
   */
  graph_json?: WorkflowGraph;

  /**
   * Dependencies required to run this workflow
   */
  dependencies_json?: WorkflowDependencies;

  /**
   * Legacy phase array format (DEPRECATED - use graph_json)
   * Kept for backward compatibility with older workflows
   * @deprecated Use graph_json instead
   */
  phases_json?: DatabaseWorkflowPhase[];

  /** Tags for categorization and filtering */
  tags?: string[];

  /** Marketplace/sharing metadata */
  marketplace_metadata?: Record<string, unknown>;

  /** Whether this is a system-provided workflow */
  is_system?: boolean;

  /** Who created this workflow */
  created_by?: string;
}

/**
 * Phase as stored in database (legacy format)
 * Used in phases_json for backward compatibility
 * New workflows should use graph_json with WorkflowNode instead
 * @deprecated Use graph_json with EnhancedWorkflowNode instead
 */
export interface DatabaseWorkflowPhase {
  id: number | string;
  name: string;
  type: PhaseType;
  agent?: string;
  skill?: string;
  prompt?: string;
  subWorkflowId?: string;
  description?: string;
  gate?: boolean;
  gateCondition?: string;
  requiresApproval?: boolean;
  position?: { x: number; y: number };
}

/**
 * Type alias for backward compatibility
 * Use DatabaseWorkflowDefinition in new code
 */
export type MCPWorkflowDefinition = DatabaseWorkflowDefinition;
