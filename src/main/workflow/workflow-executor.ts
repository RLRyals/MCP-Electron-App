/**
 * Workflow Executor
 *
 * Main workflow execution engine that orchestrates phase execution
 * Uses ClaudeCodeExecutor to run skills and MCPWorkflowClient to track progress
 * Emits events for real-time UI updates
 */

import { EventEmitter } from 'events';
import { MCPWorkflowClient, WorkflowPhase, WorkflowDefinition } from './mcp-workflow-client';
import { ClaudeCodeExecutor } from './claude-code-executor';
import { logWithCategory, LogCategory } from '../logger';

export interface WorkflowExecutionOptions {
  workflowDefId: string;
  version?: string;
  seriesId: number;
  userId: number;
  startPhase?: number;
}

export interface PhaseExecutionEvent {
  workflowInstanceId: number;
  phaseNumber: number;
  phaseName: string;
  status: 'starting' | 'in_progress' | 'completed' | 'failed' | 'waiting_approval';
  output?: object;
  error?: string;
  timestamp: string;
}

export interface WorkflowExecutionState {
  instanceId: number;
  workflowDefId: string;
  version: string;
  currentPhase: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export class WorkflowExecutor extends EventEmitter {
  private workflowClient: MCPWorkflowClient;
  private claudeExecutor: ClaudeCodeExecutor;
  private runningInstances: Map<number, WorkflowExecutionState> = new Map();
  private approvalQueue: Map<number, { phaseNumber: number; resolve: () => void; reject: (error: Error) => void }> = new Map();

  constructor() {
    super();
    this.workflowClient = new MCPWorkflowClient();
    this.claudeExecutor = new ClaudeCodeExecutor();
  }

  /**
   * Start workflow execution
   */
  async startWorkflow(options: WorkflowExecutionOptions): Promise<number> {
    const { workflowDefId, version, seriesId, userId, startPhase = 0 } = options;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Starting workflow: ${workflowDefId} for series ${seriesId}`);

    try {
      // 1. Get workflow definition
      const workflow = await this.workflowClient.getWorkflowDefinition(workflowDefId, version);
      if (!workflow) {
        throw new Error(`Workflow definition not found: ${workflowDefId}`);
      }

      // 2. Create workflow instance using the MCP tool
      const instanceResult = await this.workflowClient.createWorkflowInstance(
        seriesId,
        userId,
        `Workflow execution: ${workflow.name}`
      );

      const instanceId = instanceResult.workflow_id;

      logWithCategory('info', LogCategory.WORKFLOW,
        `Created workflow instance: ${instanceId}`);

      // 3. Lock workflow version
      await this.workflowClient.lockWorkflowVersion(
        workflow.id,
        workflow.version,
        instanceId
      );

      // 4. Initialize execution state
      const state: WorkflowExecutionState = {
        instanceId,
        workflowDefId: workflow.id,
        version: workflow.version,
        currentPhase: startPhase,
        status: 'running',
        startedAt: new Date()
      };

      this.runningInstances.set(instanceId, state);

      // 5. Start execution asynchronously
      this.executeWorkflow(instanceId, workflow, startPhase).catch(error => {
        logWithCategory('error', LogCategory.WORKFLOW,
          `Workflow execution failed: ${error.message}`);

        state.status = 'failed';
        state.error = error.message;
        state.completedAt = new Date();
      });

      return instanceId;

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to start workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute workflow phases sequentially
   */
  private async executeWorkflow(
    instanceId: number,
    workflow: WorkflowDefinition,
    startPhase: number
  ): Promise<void> {
    const state = this.runningInstances.get(instanceId);
    if (!state) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    const phases: WorkflowPhase[] = workflow.phases_json;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing workflow ${instanceId}: ${phases.length} phases`);

    try {
      for (let i = startPhase; i < phases.length; i++) {
        // Check if workflow was stopped
        if (state.status !== 'running') {
          logWithCategory('info', LogCategory.WORKFLOW,
            `Workflow ${instanceId} stopped at phase ${i}`);
          break;
        }

        const phase = phases[i];
        state.currentPhase = phase.id;

        try {
          await this.executePhase(instanceId, phase, workflow);
        } catch (error: any) {
          this.emitPhaseEvent({
            workflowInstanceId: instanceId,
            phaseNumber: phase.id,
            phaseName: phase.name,
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          });

          // Stop execution on error
          state.status = 'failed';
          state.error = error.message;
          throw error;
        }
      }

      // All phases completed successfully
      state.status = 'completed';
      state.completedAt = new Date();

      logWithCategory('info', LogCategory.WORKFLOW,
        `Workflow ${instanceId} completed successfully`);

    } finally {
      // Unlock workflow version
      try {
        await this.workflowClient.unlockWorkflowVersion(
          workflow.id,
          workflow.version,
          instanceId
        );
      } catch (error: any) {
        logWithCategory('error', LogCategory.WORKFLOW,
          `Failed to unlock workflow version: ${error.message}`);
      }

      // Clean up instance after some time
      setTimeout(() => {
        this.runningInstances.delete(instanceId);
      }, 60000); // Keep for 1 minute
    }
  }

  /**
   * Execute a single phase
   */
  private async executePhase(
    instanceId: number,
    phase: WorkflowPhase,
    workflow: WorkflowDefinition
  ): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing Phase ${phase.id}: ${phase.name} (type: ${phase.type})`);

    this.emitPhaseEvent({
      workflowInstanceId: instanceId,
      phaseNumber: phase.id,
      phaseName: phase.name,
      status: 'starting',
      timestamp: new Date().toISOString()
    });

    let output: object = {};

    // Handle different phase types
    switch (phase.type) {
      case 'planning':
      case 'writing':
        output = await this.executeAgentPhase(instanceId, phase);
        break;

      case 'gate':
        output = await this.executeGatePhase(instanceId, phase);
        break;

      case 'user':
        output = await this.executeUserPhase(instanceId, phase);
        break;

      case 'subworkflow':
        output = await this.executeSubWorkflow(instanceId, phase);
        break;

      case 'loop':
        output = await this.executeLoopPhase(instanceId, phase);
        break;

      default:
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Unknown phase type: ${phase.type}, skipping`);
    }

    this.emitPhaseEvent({
      workflowInstanceId: instanceId,
      phaseNumber: phase.id,
      phaseName: phase.name,
      status: 'completed',
      output,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Execute agent phase (planning or writing with optional skill)
   */
  private async executeAgentPhase(
    instanceId: number,
    phase: WorkflowPhase
  ): Promise<object> {
    if (!phase.skill) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Phase ${phase.id} has no skill, skipping execution`);

      return {
        skipped: true,
        reason: 'No skill specified'
      };
    }

    // Build prompt for Claude Code
    const prompt = this.buildPhasePrompt(phase);

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing skill: ${phase.skill} with prompt: ${prompt.substring(0, 100)}...`);

    // Execute skill with Claude Code
    const result = await this.claudeExecutor.executeSkill(
      phase.skill,
      phase.id,
      prompt
    );

    if (!result.success) {
      throw new Error(`Skill execution failed: ${result.error}`);
    }

    // Update phase execution in database
    await this.workflowClient.updatePhaseExecution(
      instanceId,
      phase.id,
      result.session_id,
      phase.skill,
      result.output
    );

    return result.output;
  }

  /**
   * Execute gate phase (quality check)
   */
  private async executeGatePhase(
    instanceId: number,
    phase: WorkflowPhase
  ): Promise<object> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Gate Phase ${phase.id}: ${phase.gateCondition || 'No condition specified'}`);

    // Gates would typically validate output from previous phases
    // For now, we'll pass gates automatically
    // TODO: Implement actual gate validation logic

    return {
      gate_passed: true,
      condition: phase.gateCondition,
      message: 'Gate validation not yet implemented - auto-passed'
    };
  }

  /**
   * Execute user approval phase
   */
  private async executeUserPhase(
    instanceId: number,
    phase: WorkflowPhase
  ): Promise<object> {
    if (phase.requiresApproval) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Phase ${phase.id} requires user approval - pausing execution`);

      // Emit approval required event
      this.emitPhaseEvent({
        workflowInstanceId: instanceId,
        phaseNumber: phase.id,
        phaseName: phase.name,
        status: 'waiting_approval',
        timestamp: new Date().toISOString()
      });

      // Pause execution and wait for approval
      const state = this.runningInstances.get(instanceId);
      if (state) {
        state.status = 'paused';
      }

      await this.waitForApproval(instanceId, phase.id);

      // Resume execution
      if (state) {
        state.status = 'running';
      }

      return {
        approved: true,
        timestamp: new Date().toISOString()
      };
    }

    return {
      skipped: true,
      reason: 'No approval required'
    };
  }

  /**
   * Execute sub-workflow
   */
  private async executeSubWorkflow(
    instanceId: number,
    phase: WorkflowPhase
  ): Promise<object> {
    if (!phase.subWorkflowId) {
      throw new Error(`Phase ${phase.id} missing subWorkflowId`);
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Starting sub-workflow: ${phase.subWorkflowId}`);

    // Start sub-workflow using MCP client
    const subWorkflowResult = await this.workflowClient.startSubWorkflow(
      instanceId,
      phase.id,
      phase.subWorkflowId,
      'latest' // Use latest version
    );

    logWithCategory('info', LogCategory.WORKFLOW,
      `Sub-workflow started: execution_id=${subWorkflowResult.execution_id}`);

    // TODO: Wait for sub-workflow completion
    // For now, just return the result
    return {
      sub_workflow_id: phase.subWorkflowId,
      execution_id: subWorkflowResult.execution_id,
      status: 'started'
    };
  }

  /**
   * Execute loop phase (Book Production Loop)
   */
  private async executeLoopPhase(
    instanceId: number,
    phase: WorkflowPhase
  ): Promise<object> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Loop Phase ${phase.id}: ${phase.name}`);

    // Book production loop logic
    // TODO: Implement loop iteration logic
    return {
      loop_type: 'book_production',
      iterations: 0,
      status: 'not_implemented'
    };
  }

  /**
   * Wait for user approval
   */
  private async waitForApproval(
    instanceId: number,
    phaseNumber: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.approvalQueue.set(instanceId, {
        phaseNumber,
        resolve,
        reject
      });

      logWithCategory('info', LogCategory.WORKFLOW,
        `Waiting for approval: instance=${instanceId}, phase=${phaseNumber}`);
    });
  }

  /**
   * Approve a phase (called from IPC handler)
   */
  approvePhase(instanceId: number, phaseNumber: number): boolean {
    const approval = this.approvalQueue.get(instanceId);

    if (approval && approval.phaseNumber === phaseNumber) {
      approval.resolve();
      this.approvalQueue.delete(instanceId);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Phase approved: instance=${instanceId}, phase=${phaseNumber}`);

      return true;
    }

    return false;
  }

  /**
   * Reject a phase (called from IPC handler)
   */
  rejectPhase(instanceId: number, phaseNumber: number, reason: string): boolean {
    const approval = this.approvalQueue.get(instanceId);

    if (approval && approval.phaseNumber === phaseNumber) {
      approval.reject(new Error(`Phase rejected: ${reason}`));
      this.approvalQueue.delete(instanceId);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Phase rejected: instance=${instanceId}, phase=${phaseNumber}, reason=${reason}`);

      return true;
    }

    return false;
  }

  /**
   * Stop workflow execution
   */
  stopWorkflow(instanceId: number): void {
    const state = this.runningInstances.get(instanceId);

    if (state) {
      state.status = 'failed';
      state.error = 'Stopped by user';
      state.completedAt = new Date();

      logWithCategory('info', LogCategory.WORKFLOW,
        `Stopping workflow: ${instanceId}`);

      // Reject any pending approvals
      const approval = this.approvalQueue.get(instanceId);
      if (approval) {
        approval.reject(new Error('Workflow stopped by user'));
        this.approvalQueue.delete(instanceId);
      }
    }
  }

  /**
   * Get workflow execution state
   */
  getWorkflowState(instanceId: number): WorkflowExecutionState | undefined {
    return this.runningInstances.get(instanceId);
  }

  /**
   * Get all running workflows
   */
  getRunningWorkflows(): WorkflowExecutionState[] {
    return Array.from(this.runningInstances.values());
  }

  /**
   * Build prompt for a phase
   */
  private buildPhasePrompt(phase: WorkflowPhase): string {
    const parts = [
      `Execute ${phase.name} phase.`,
      `Agent: ${phase.agent}`,
      `Description: ${phase.description}`
    ];

    return parts.join('\n');
  }

  /**
   * Emit phase event to renderer
   */
  private emitPhaseEvent(event: PhaseExecutionEvent): void {
    this.emit('phase-event', event);

    // Also emit specific event types
    switch (event.status) {
      case 'starting':
        this.emit('phase-started', event);
        break;
      case 'completed':
        this.emit('phase-completed', event);
        break;
      case 'failed':
        this.emit('phase-failed', event);
        break;
      case 'waiting_approval':
        this.emit('approval-required', event);
        break;
    }
  }
}
