/**
 * MCP Workflow Manager Database Types
 *
 * SQLite database schema for workflow execution state tracking.
 * This is separate from domain MCPs (author-server, series-planning-server, etc.)
 */

import { WorkflowStatus, PhaseStatus, GateResult } from './workflow';

/**
 * Workflow record in MCP database
 */
export interface MCPWorkflow {
  id: string;
  name: string;
  version: string;
  description: string;
  graph_json: string;               // Serialized WorkflowGraph
  dependencies_json: string;        // Serialized WorkflowDependencies
  created_at: string;               // ISO timestamp
  updated_at: string;
}

/**
 * Workflow instance (execution run)
 */
export interface MCPWorkflowInstance {
  id: string;
  workflow_id: string;
  status: WorkflowStatus;
  current_phase: number;
  started_at: string;               // ISO timestamp
  completed_at: string | null;
  context_json: string | null;      // Execution context
  error: string | null;
}

/**
 * Phase execution record
 */
export interface MCPPhaseExecution {
  id: string;
  instance_id: string;
  phase_id: number;
  status: PhaseStatus;
  started_at: string;
  completed_at: string | null;
  output_json: string | null;
  error: string | null;
  claude_code_session: string | null;  // Claude Code session ID
}

/**
 * Quality gate record
 */
export interface MCPQualityGate {
  id: string;
  instance_id: string;
  phase_id: number;
  gate_type: string;                // 'npe_validation', 'commercial_validation', 'user_approval'
  criteria: string;
  result: GateResult;
  score: number | null;
  details_json: string | null;
  created_at: string;
}

/**
 * Checkpoint record (for resume capability)
 */
export interface MCPCheckpoint {
  id: string;
  instance_id: string;
  phase_id: number;
  state_json: string;               // Serialized state at this point
  created_at: string;
}

/**
 * Workflow Manager MCP Server Interface
 *
 * Functions that the MCP server must implement
 */
export interface WorkflowManagerMCP {
  // Workflow CRUD
  createWorkflow(workflow: Omit<MCPWorkflow, 'created_at' | 'updated_at'>): Promise<string>;
  getWorkflow(id: string): Promise<MCPWorkflow | null>;
  listWorkflows(): Promise<MCPWorkflow[]>;
  updateWorkflow(id: string, updates: Partial<MCPWorkflow>): Promise<void>;
  deleteWorkflow(id: string): Promise<void>;

  // Instance management
  createInstance(workflowId: string, context?: Record<string, any>): Promise<string>;
  getInstance(id: string): Promise<MCPWorkflowInstance | null>;
  updateInstanceStatus(id: string, status: WorkflowStatus, currentPhase?: number): Promise<void>;
  completeInstance(id: string, success: boolean, error?: string): Promise<void>;

  // Phase execution
  startPhase(instanceId: string, phaseId: number): Promise<string>;
  completePhase(phaseExecutionId: string, output?: any, error?: string): Promise<void>;
  getPhaseExecutions(instanceId: string): Promise<MCPPhaseExecution[]>;

  // Quality gates
  recordQualityGate(gate: Omit<MCPQualityGate, 'id' | 'created_at'>): Promise<string>;
  getQualityGates(instanceId: string): Promise<MCPQualityGate[]>;
  updateGateResult(id: string, result: GateResult, score?: number, details?: any): Promise<void>;

  // Checkpoints
  createCheckpoint(instanceId: string, phaseId: number, state: Record<string, any>): Promise<string>;
  getCheckpoints(instanceId: string): Promise<MCPCheckpoint[]>;
  getLatestCheckpoint(instanceId: string): Promise<MCPCheckpoint | null>;

  // Utilities
  initializeDatabase(): Promise<void>;
  closeDatabase(): Promise<void>;
}
