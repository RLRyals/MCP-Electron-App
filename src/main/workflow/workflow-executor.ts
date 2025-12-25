/**
 * Enhanced Workflow Executor
 *
 * Main workflow execution engine that orchestrates phase execution
 * Uses modular executor system for different node types
 * Integrates with LLMProviderManager, ContextManager, and NodeExecutor interface
 * Emits events for real-time UI updates
 */

import { EventEmitter } from 'events';
import { MCPWorkflowClient, WorkflowPhase, WorkflowDefinition } from './mcp-workflow-client';
import { ClaudeCodeExecutor } from './claude-code-executor';
import { logWithCategory, LogCategory } from '../logger';
import { NodeExecutor } from './executors/base-executor';
import { AgentNodeExecutor } from './executors/agent-node-executor';
import { UserInputExecutor } from './executors/user-input-executor';
import { CodeExecutionExecutor } from './executors/code-execution-executor';
import { HttpRequestExecutor } from './executors/http-request-executor';
import { FileOperationExecutor } from './executors/file-operation-executor';
import { ConditionalExecutor } from './executors/conditional-executor';
import { LoopExecutor } from './executors/loop-executor';
import { SubWorkflowExecutor } from './executors/subworkflow-executor';
import { ContextManager } from './context-manager';
import { getProviderManager } from '../llm/provider-manager';
import { WorkflowNode, NodeOutput } from '../../types/workflow-nodes';
import { WorkflowExecutionContext } from '../../types/workflow-context';
import { workflowCache } from './workflow-cache';

export interface WorkflowExecutionOptions {
  workflowDefId: string;
  version?: string;
  projectId: number;
  userId: number;
  startPhase?: number;
  projectFolder: string;  // Required for file operations
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
  projectFolder?: string;
}

export class WorkflowExecutor extends EventEmitter {
  private workflowClient: MCPWorkflowClient;
  private claudeExecutor: ClaudeCodeExecutor;
  private runningInstances: Map<number, WorkflowExecutionState> = new Map();
  private approvalQueue: Map<number, { phaseNumber: number; resolve: () => void; reject: (error: Error) => void }> = new Map();
  private _userInputQueue: Map<string, {
    nodeId: string;
    resolve: (input: any) => void;
    reject: (error: Error) => void;
  }> = new Map();

  // Enhanced execution system
  private nodeExecutors: Map<string, NodeExecutor>;
  private contextManager: ContextManager;
  private providerManager: any; // LLMProviderManager

  constructor(workflowClient?: any) {
    super();
    // Use persistent client if provided, otherwise fallback to creating new client
    this.workflowClient = workflowClient || new MCPWorkflowClient();
    this.claudeExecutor = ClaudeCodeExecutor.getInstance();
    this.contextManager = new ContextManager();
    this.providerManager = getProviderManager();

    // Forward Claude Code setup events
    this.claudeExecutor.on('claude-setup-required', (data) => {
      this.emit('claude-setup-required', data);
    });

    // Forward Claude Code output to terminal
    this.claudeExecutor.on('claude-output', (data) => {
      this.emit('claude-output', data);
    });

    // Register all node executors
    this.nodeExecutors = new Map<string, NodeExecutor>();
    this.nodeExecutors.set('planning', new AgentNodeExecutor());
    this.nodeExecutors.set('writing', new AgentNodeExecutor());
    this.nodeExecutors.set('gate', new AgentNodeExecutor());
    this.nodeExecutors.set('user-input', new UserInputExecutor());
    this.nodeExecutors.set('code', new CodeExecutionExecutor());
    this.nodeExecutors.set('http', new HttpRequestExecutor());
    this.nodeExecutors.set('file', new FileOperationExecutor());
    this.nodeExecutors.set('conditional', new ConditionalExecutor());
    this.nodeExecutors.set('loop', new LoopExecutor());
    this.nodeExecutors.set('subworkflow', new SubWorkflowExecutor());
  }

  /**
   * Start workflow execution
   */
  async startWorkflow(options: WorkflowExecutionOptions): Promise<number> {
    const { workflowDefId, version, projectId, userId, startPhase = 0, projectFolder } = options;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Starting workflow: ${workflowDefId} for project ${projectId}`);

    try {
      // 1. Get workflow definition (check cache first for speed)
      let workflow = workflowCache.get(workflowDefId, version);

      if (!workflow) {
        logWithCategory('debug', LogCategory.WORKFLOW, 'Cache miss, fetching workflow from MCP');
        workflow = await this.workflowClient.getWorkflowDefinition(workflowDefId, version);

        if (!workflow) {
          throw new Error(`Workflow definition not found: ${workflowDefId}`);
        }

        // Cache for future use
        workflowCache.set(workflowDefId, workflow.version, workflow);
      } else {
        logWithCategory('debug', LogCategory.WORKFLOW, 'Cache hit for workflow definition');
      }

      // 2. Create workflow instance using the MCP tool
      const instanceResult = await this.workflowClient.createWorkflowInstance(
        projectId,
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
        startedAt: new Date(),
        projectFolder
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
   * Execute workflow - supports both node-based and phase-based (legacy)
   */
  private async executeWorkflow(
    instanceId: number,
    workflow: any,
    startPhase: number
  ): Promise<void> {
    const state = this.runningInstances.get(instanceId);
    if (!state) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    // Parse graph_json to get nodes if it exists
    let nodes: any[] | undefined;
    if (workflow.graph_json) {
      try {
        const graphJson = typeof workflow.graph_json === 'string'
          ? JSON.parse(workflow.graph_json)
          : workflow.graph_json;
        nodes = graphJson.nodes;

        // Add nodes to workflow object for easier access
        if (nodes && Array.isArray(nodes)) {
          (workflow as any).nodes = nodes;
          (workflow as any).edges = graphJson.edges;
        }
      } catch (error: any) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Failed to parse graph_json: ${error.message}`);
      }
    }

    // Debug: log workflow structure
    logWithCategory('info', LogCategory.WORKFLOW,
      `Workflow structure - has nodes: ${!!nodes}, has phases_json: ${!!workflow.phases_json}, has phases: ${!!workflow.phases}`);

    if (nodes) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Nodes type: ${typeof nodes}, is array: ${Array.isArray(nodes)}, length: ${nodes?.length}`);
    }

    // Check if this is a node-based workflow (new format)
    // Priority: if nodes exist and are non-empty, use node-based execution
    if (nodes && Array.isArray(nodes) && nodes.length > 0) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Executing node-based workflow ${instanceId}: ${nodes.length} nodes`);
      await this.executeNodeBasedWorkflow(instanceId, workflow);
      return;
    }

    // Legacy phase-based execution
    const phases: WorkflowPhase[] = workflow.phases_json || workflow.phases;

    if (!phases || phases.length === 0) {
      throw new Error('Workflow has no phases or nodes to execute');
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing phase-based workflow ${instanceId}: ${phases.length} phases`);

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
   * Get the user input queue for IPC handlers
   */
  get userInputQueue() {
    return this._userInputQueue;
  }

  /**
   * Execute node-based workflow (new format)
   */
  private async executeNodeBasedWorkflow(
    instanceId: number,
    workflow: any
  ): Promise<void> {
    const { projectFolder } = this.runningInstances.get(instanceId) || {};

    // Create execution context
    const context: WorkflowExecutionContext = {
      instanceId: String(instanceId),
      workflowId: workflow.id || workflow.name,
      projectFolder: projectFolder || '',
      variables: {},
      nodeOutputs: new Map(),
      mcpData: {},
      currentNodeId: '',
      completedNodes: [],
      loopStack: [],
      startedAt: new Date(),
      userId: 0, // TODO: Get from workflow options
      seriesId: 0, // TODO: Get from workflow options
      eventEmitter: this, // Pass this WorkflowExecutor as event emitter
      userInputQueue: this._userInputQueue // Pass the user input queue
    } as any;

    const nodes: WorkflowNode[] = workflow.nodes;
    const edges = workflow.edges || [];

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing ${nodes.length} nodes in workflow ${instanceId}`);

    // Emit log to terminal
    this.emit('workflow:log', {
      level: 'info',
      category: 'WORKFLOW',
      message: `Executing ${nodes.length} nodes in workflow ${instanceId}`
    });

    // Simple sequential execution for now (TODO: respect edges for conditional/parallel execution)
    for (const node of nodes) {
      context.currentNodeId = node.id;

      try {
        logWithCategory('info', LogCategory.WORKFLOW,
          `Executing node: ${node.name} (${node.type})`);

        this.emit('workflow:log', {
          level: 'info',
          category: 'WORKFLOW',
          message: `Executing node: ${node.name} (${node.type})`
        });

        const result = await this.executeNodeEnhanced(node, context);

        if (result.status === 'failed') {
          // Check if node has continueOnError flag
          const continueOnError = (node as any).continueOnError || false;

          if (!continueOnError) {
            throw new Error(result.error || 'Node execution failed');
          }

          // Log warning but continue execution
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Node failed but continuing due to continueOnError flag: ${node.name} - ${result.error}`);

          this.emit('workflow:log', {
            level: 'warn',
            category: 'WORKFLOW',
            message: `⚠ Node failed but continuing: ${node.name} - ${result.error}`
          });

          // Still add to completed nodes to track that it was executed
          context.completedNodes.push(node.id);
          continue;
        }

        context.completedNodes.push(node.id);

        logWithCategory('info', LogCategory.WORKFLOW,
          `Node completed: ${node.name}`);

        this.emit('workflow:log', {
          level: 'info',
          category: 'WORKFLOW',
          message: `✓ Node completed: ${node.name}`
        });

      } catch (error: any) {
        logWithCategory('error', LogCategory.WORKFLOW,
          `Node execution failed: ${node.name} - ${error.message}`);

        this.emit('workflow:log', {
          level: 'error',
          category: 'WORKFLOW',
          message: `✗ Node failed: ${node.name} - ${error.message}`
        });

        // Check if we should stop the entire workflow or continue
        const continueOnError = (node as any).continueOnError || false;
        if (!continueOnError) {
          throw error;
        }

        // Log and continue to next node
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Continuing workflow despite node failure due to continueOnError flag`);
      }
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Workflow ${instanceId} completed successfully`);

    this.emit('workflow:log', {
      level: 'info',
      category: 'WORKFLOW',
      message: `✓ Workflow ${instanceId} completed successfully`
    });
  }

  /**
   * Enhanced node execution with new executor system
   * Uses NodeExecutor interface, ContextManager, and retry logic
   */
  private async executeNodeEnhanced(
    node: WorkflowNode,
    context: WorkflowExecutionContext
  ): Promise<NodeOutput> {
    try {
      // 1. Check skip condition (if present)
      if (node.skipCondition) {
        const shouldSkip = this.contextManager.evaluateCondition(node.skipCondition, context);
        if (shouldSkip) {
          logWithCategory('info', LogCategory.WORKFLOW,
            `Skipping node ${node.id} due to skip condition: ${node.skipCondition}`);

          return {
            nodeId: node.id,
            nodeName: node.name,
            timestamp: new Date(),
            status: 'success',
            output: { skipped: true, reason: 'Skip condition met' },
            variables: { skipped: true },
          };
        }
      }

      // 2. Build node-specific context (input mapping)
      const nodeContextResult = await this.contextManager.buildNodeContext(node, context);
      if (!nodeContextResult.success) {
        const errorMsg = nodeContextResult.error || 'Failed to build node context';
        logWithCategory('error', LogCategory.WORKFLOW,
          `Node context build failed for ${node.id}: ${errorMsg}`);

        return {
          nodeId: node.id,
          nodeName: node.name,
          timestamp: new Date(),
          status: 'failed',
          output: null,
          variables: {},
          error: errorMsg,
        };
      }

      // 3. Get executor for node type
      const executor = this.nodeExecutors.get(node.type);
      if (!executor) {
        throw new Error(`No executor found for node type: ${node.type}`);
      }

      // Emit node started event
      this.emit('node-started', {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        timestamp: new Date().toISOString(),
      });

      // 4. Execute with retry logic and timeout
      const result = await this.executeWithRetry(
        () => executor.execute(node, nodeContextResult.context),
        node.retryConfig,
        node.timeoutMs
      );

      // 5. Extract output variables (output mapping)
      const extracted = await this.contextManager.extractOutputs(node, result, context);

      logWithCategory('debug', LogCategory.WORKFLOW,
        `Node ${node.id} extracted variables: ${JSON.stringify(Object.keys(extracted.variables))}`);

      // 6. Update global context
      context.nodeOutputs.set(node.id, result);
      Object.assign(context.variables, extracted.variables);

      logWithCategory('debug', LogCategory.WORKFLOW,
        `Global context now has variables: ${JSON.stringify(Object.keys(context.variables))}`);

      // Log complete variable state for debugging
      logWithCategory('debug', LogCategory.WORKFLOW,
        `=== Variables After Node ${node.id} (${node.name}) ===`);
      logWithCategory('debug', LogCategory.WORKFLOW,
        `Available: ${JSON.stringify(Object.keys(context.variables))}`);

      // Preview each variable
      for (const [key, value] of Object.entries(context.variables)) {
        const preview = String(value).substring(0, 100);
        logWithCategory('debug', LogCategory.WORKFLOW,
          `  ${key}: ${preview}${String(value).length > 100 ? '...' : ''}`);
      }

      // 7. Emit node completed event
      this.emit('node-completed', {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        status: result.status,
        output: result.output,              // ADD: actual output content
        variables: extracted.variables,      // ADD: extracted variables
        timestamp: new Date().toISOString(),
      });

      // 8. Emit output to terminal if it's an agent node with text output
      if (result.output && typeof result.output === 'string' && result.output.length > 0) {
        this.emit('workflow:output', {
          instanceId: context.instanceId,
          nodeId: node.id,
          nodeName: node.name,
          output: result.output,
          type: 'node-output',
        });

        logWithCategory('info', LogCategory.WORKFLOW,
          `Node ${node.id} (${node.name}) output: ${result.output.substring(0, 200)}...`);
      }

      return result;

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Enhanced node execution failed for ${node.id}: ${error.message}`);

      // Emit node failed event
      this.emit('node-failed', {
        nodeId: node.id,
        nodeName: node.name,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      return {
        nodeId: node.id,
        nodeName: node.name,
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
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryConfig?: { maxRetries: number; retryDelayMs: number; backoffMultiplier: number },
    timeoutMs?: number
  ): Promise<T> {
    const maxRetries = retryConfig?.maxRetries || 0;
    const retryDelay = retryConfig?.retryDelayMs || 1000;
    const backoff = retryConfig?.backoffMultiplier || 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (timeoutMs) {
          return await this.executeWithTimeout(fn, timeoutMs);
        } else {
          return await fn();
        }
      } catch (error: any) {
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(backoff, attempt);
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Execution failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${error.message}`);
          await this.sleep(delay);
          continue;
        }
        throw error;
      }
    }

    throw new Error('executeWithRetry: unreachable code');
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
   * NOTE: Phase-based system is legacy and being phased out
   */
  private emitPhaseEvent(event: PhaseExecutionEvent): void {
    // Validate event before emitting to prevent undefined errors
    if (!event || typeof event !== 'object') {
      console.warn('[WorkflowExecutor] Attempted to emit invalid phase event:', event);
      return;
    }

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
