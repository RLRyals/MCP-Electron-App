/**
 * Persistent MCP Client
 *
 * Maintains a single persistent Node.js process for the workflow-manager MCP server
 * to eliminate the 1-2 second process spawning overhead on every operation.
 *
 * Key features:
 * - Spawn workflow-manager-server/index.js once on startup
 * - Keep stdio connection open throughout app lifecycle
 * - Queue requests with unique IDs
 * - Parse responses asynchronously via stdout
 * - Auto-restart on crash with exponential backoff
 * - Graceful shutdown
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { app } from 'electron';
import { logWithCategory, LogCategory } from '../logger';
import { getDatabaseUrl } from '../database-connection';
import * as fs from 'fs';

// Import canonical types from shared types directory
import type {
  DatabaseWorkflowDefinition,
  WorkflowBreadcrumbEntry,
} from '../../types/workflow';

// Re-export for backward compatibility
export type WorkflowDefinition = DatabaseWorkflowDefinition;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  toolName: string;
}

export class PersistentMCPClient {
  private mcpProcess: ChildProcess | null = null;
  private mcpServerPath: string;
  private requestQueue: Map<number, PendingRequest> = new Map();
  private requestId: number = 0;
  private isShuttingDown: boolean = false;
  private isStarting: boolean = false;
  private isRestarting: boolean = false;
  private restartDelay: number = 1000; // Start with 1 second
  private maxRestartDelay: number = 30000; // Max 30 seconds
  private stdoutBuffer: string = '';
  private databaseUrl: string | null = null;

  constructor() {
    // Path to workflow-manager MCP server
    const userDataPath = app.getPath('userData');
    const mcpServersDir = path.join(userDataPath, 'repositories', 'mcp-writing-servers');
    this.mcpServerPath = path.join(
      mcpServersDir,
      'src',
      'mcps',
      'workflow-manager-server',
      'index.js'
    );
  }

  /**
   * Start the persistent MCP server process
   */
  async start(): Promise<void> {
    if (this.mcpProcess) {
      logWithCategory('debug', LogCategory.WORKFLOW,
        'Persistent MCP client already started');
      return;
    }

    if (this.isStarting) {
      logWithCategory('debug', LogCategory.WORKFLOW,
        'Persistent MCP client already starting, waiting...');
      // Wait for startup to complete
      await this.waitForReady();
      return;
    }

    this.isStarting = true;

    try {
      // Check if MCP server file exists
      if (!fs.existsSync(this.mcpServerPath)) {
        throw new Error(`MCP server not found at: ${this.mcpServerPath}`);
      }

      // Get database URL
      this.databaseUrl = await getDatabaseUrl();

      logWithCategory('info', LogCategory.WORKFLOW,
        'Starting persistent MCP client...');

      // Spawn MCP server process
      this.mcpProcess = spawn('node', [this.mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MCP_STDIO_MODE: 'true',
          DATABASE_URL: this.databaseUrl
        }
      });

      // Set up stdout handler
      this.mcpProcess.stdout?.on('data', (data) => {
        this.handleStdout(data);
      });

      // Set up stderr handler for logging
      this.mcpProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        logWithCategory('debug', LogCategory.WORKFLOW,
          `MCP server stderr: ${message}`);
      });

      // Set up process exit handler
      this.mcpProcess.on('exit', (code, signal) => {
        this.handleProcessExit(code, signal);
      });

      // Set up error handler
      this.mcpProcess.on('error', (error) => {
        logWithCategory('error', LogCategory.WORKFLOW,
          `MCP process error: ${error.message}`);
        this.handleProcessCrash(error);
      });

      logWithCategory('info', LogCategory.WORKFLOW,
        'Persistent MCP client started successfully');

      this.isStarting = false;
      this.restartDelay = 1000; // Reset restart delay on successful start

    } catch (error: any) {
      this.isStarting = false;
      this.mcpProcess = null;
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to start persistent MCP client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for the client to be ready
   */
  private async waitForReady(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    while (this.isStarting && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (this.isStarting) {
      throw new Error('Timeout waiting for MCP client to start');
    }
  }

  /**
   * Handle stdout data from MCP process
   */
  private handleStdout(data: Buffer): void {
    this.stdoutBuffer += data.toString();

    // Process complete lines
    const lines = this.stdoutBuffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response = JSON.parse(line);
        this.handleResponse(response);
      } catch (e) {
        // Skip non-JSON lines (debug output)
        logWithCategory('debug', LogCategory.WORKFLOW,
          `Non-JSON line from MCP: ${line.substring(0, 100)}`);
      }
    }
  }

  /**
   * Handle parsed JSON-RPC response
   */
  private handleResponse(response: any): void {
    const requestId = response.id;
    const pending = this.requestQueue.get(requestId);

    if (!pending) {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `Received response for unknown request ID: ${requestId}`);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeout);
    this.requestQueue.delete(requestId);

    if (response.error) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `MCP tool ${pending.toolName} error: ${response.error.message}`);
      pending.reject(new Error(response.error.message));
    } else if (response.result?.isError) {
      // Handle MCP tool-level errors (returned as result with isError flag)
      const errorContent = response.result?.content;
      let errorMessage = `MCP tool ${pending.toolName} failed`;
      if (Array.isArray(errorContent) && errorContent.length > 0) {
        const textContent = errorContent.find((c: any) => c.type === 'text')?.text;
        if (textContent) {
          errorMessage = textContent;
        }
      }
      logWithCategory('error', LogCategory.WORKFLOW,
        `MCP tool ${pending.toolName} error (isError): ${errorMessage}`);
      pending.reject(new Error(errorMessage));
    } else {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `MCP tool ${pending.toolName} completed successfully`);

      // Extract content from MCP response (same logic as original client)
      const content = response.result?.content;
      if (Array.isArray(content) && content.length > 0) {
        const textContent = content.find((c: any) => c.type === 'text')?.text;
        if (textContent) {
          try {
            pending.resolve(JSON.parse(textContent));
          } catch {
            pending.resolve(textContent);
          }
        } else {
          pending.resolve(content);
        }
      } else if (Array.isArray(content) && content.length === 0) {
        // Empty content array - likely an empty result from database
        // Return empty array instead of the raw result object
        logWithCategory('debug', LogCategory.WORKFLOW,
          `MCP tool ${pending.toolName} returned empty content array`);
        pending.resolve([]);
      } else if (response.result === null || response.result === undefined) {
        // Null/undefined result - return empty array for list operations
        logWithCategory('debug', LogCategory.WORKFLOW,
          `MCP tool ${pending.toolName} returned null/undefined result`);
        pending.resolve(null);
      } else {
        // Non-MCP format or unexpected format - return as-is but log for debugging
        logWithCategory('debug', LogCategory.WORKFLOW,
          `MCP tool ${pending.toolName} returned non-standard format:`,
          JSON.stringify(response.result).substring(0, 200));
        pending.resolve(response.result);
      }
    }
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    logWithCategory('warn', LogCategory.WORKFLOW,
      `MCP process exited with code ${code}, signal ${signal}`);

    this.mcpProcess = null;

    if (this.isShuttingDown) {
      logWithCategory('info', LogCategory.WORKFLOW,
        'MCP process exited during shutdown');
      return;
    }

    // Reject all pending requests
    for (const [id, pending] of this.requestQueue) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('MCP server process exited'));
    }
    this.requestQueue.clear();

    // Auto-restart
    this.scheduleRestart();
  }

  /**
   * Handle process crash/error
   */
  private handleProcessCrash(error: Error): void {
    logWithCategory('error', LogCategory.WORKFLOW,
      `MCP process crashed: ${error.message}`);

    this.mcpProcess = null;

    if (this.isShuttingDown) {
      return;
    }

    // Reject all pending requests
    for (const [id, pending] of this.requestQueue) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`MCP server crashed: ${error.message}`));
    }
    this.requestQueue.clear();

    // Auto-restart
    this.scheduleRestart();
  }

  /**
   * Schedule automatic restart with exponential backoff
   */
  private scheduleRestart(): void {
    if (this.isRestarting || this.isShuttingDown) {
      return;
    }

    this.isRestarting = true;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Scheduling MCP process restart in ${this.restartDelay}ms`);

    setTimeout(async () => {
      try {
        await this.start();
        this.isRestarting = false;
        this.restartDelay = 1000; // Reset on successful restart
        logWithCategory('info', LogCategory.WORKFLOW,
          'MCP process restarted successfully');
      } catch (error: any) {
        this.isRestarting = false;
        // Increase delay with exponential backoff
        this.restartDelay = Math.min(this.restartDelay * 2, this.maxRestartDelay);
        logWithCategory('error', LogCategory.WORKFLOW,
          `Failed to restart MCP process: ${error.message}`);
        // Try again
        this.scheduleRestart();
      }
    }, this.restartDelay);
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName: string, args: any): Promise<any> {
    if (!this.mcpProcess) {
      throw new Error('MCP client not started. Call start() first.');
    }

    if (this.isShuttingDown) {
      throw new Error('MCP client is shutting down');
    }

    const id = ++this.requestId;

    logWithCategory('debug', LogCategory.WORKFLOW,
      `Calling MCP tool: ${toolName} (request ${id})`);

    // Create JSON-RPC request
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    // Send request
    try {
      this.mcpProcess.stdin?.write(JSON.stringify(request) + '\n');
    } catch (error: any) {
      throw new Error(`Failed to send request to MCP server: ${error.message}`);
    }

    // Return promise that resolves when response arrives
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.requestQueue.has(id)) {
          this.requestQueue.delete(id);
          reject(new Error(`Request timeout for tool: ${toolName}`));
        }
      }, 30000); // 30 second timeout

      this.requestQueue.set(id, {
        resolve,
        reject,
        timeout,
        toolName
      });
    });
  }

  /**
   * Gracefully shut down the MCP client
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logWithCategory('debug', LogCategory.WORKFLOW,
        'Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;

    logWithCategory('info', LogCategory.WORKFLOW,
      'Shutting down persistent MCP client...');

    // Reject all pending requests
    for (const [id, pending] of this.requestQueue) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('MCP client is shutting down'));
    }
    this.requestQueue.clear();

    // Kill process
    if (this.mcpProcess) {
      try {
        this.mcpProcess.kill();
        // Wait a bit for graceful exit
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Force kill if still alive
        if (this.mcpProcess && !this.mcpProcess.killed) {
          this.mcpProcess.kill('SIGKILL');
        }
      } catch (error: any) {
        logWithCategory('error', LogCategory.WORKFLOW,
          `Error killing MCP process: ${error.message}`);
      }
      this.mcpProcess = null;
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      'Persistent MCP client shut down');
  }

  /**
   * Check if the client is ready
   */
  isReady(): boolean {
    return this.mcpProcess !== null && !this.isShuttingDown && !this.isStarting;
  }

  // ========================================
  // High-level convenience methods
  // (Same as MCPWorkflowClient for compatibility)
  // ========================================

  /**
   * Import workflow definition
   */
  async importWorkflowDefinition(workflow: WorkflowDefinition): Promise<{
    workflow_id: string;
    version: string;
    message: string;
  }> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Importing workflow: ${workflow.name} v${workflow.version}`);

    const params = {
      id: workflow.id,
      name: workflow.name,
      version: workflow.version,
      description: workflow.description,
      graph_json: JSON.stringify(workflow.graph_json),
      dependencies_json: JSON.stringify(workflow.dependencies_json),
      tags: workflow.tags || [],
      marketplace_metadata: JSON.stringify(workflow.marketplace_metadata || {}),
      created_by: workflow.created_by
    };

    const result = await this.callTool('import_workflow_definition', params);
    return result;
  }

  /**
   * Get all workflow definitions
   */
  async getWorkflowDefinitions(filters?: {
    tags?: string[];
    is_system?: boolean;
  }): Promise<WorkflowDefinition[]> {
    const result = await this.callTool('get_workflow_definitions', filters || {});
    return Array.isArray(result) ? result : [];
  }

  /**
   * Get specific workflow definition
   */
  async getWorkflowDefinition(
    workflowId: string,
    version?: string
  ): Promise<WorkflowDefinition | null> {
    return await this.callTool('get_workflow_definition', {
      workflow_id: workflowId,
      version
    });
  }

  /**
   * Update node positions in workflow definition
   */
  async updateNodePositions(
    workflowId: string,
    positions: Record<string, { x: number; y: number }>
  ): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Updating node positions for workflow: ${workflowId}`);

    await this.callTool('update_workflow_positions', {
      workflow_id: workflowId,
      positions
    });
  }

  /**
   * Update a node in the workflow graph
   */
  async updateNode(
    workflowId: string,
    nodeId: string,
    updates: Record<string, any>
  ): Promise<any> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Updating node ${nodeId} in workflow: ${workflowId}`);

    return await this.callTool('update_node', {
      workflow_id: workflowId,
      node_id: nodeId,
      updates
    });
  }

  /**
   * Add a node to the workflow graph
   */
  async addNode(
    workflowId: string,
    nodeId: string,
    nodeType: string,
    nodeData: Record<string, any>
  ): Promise<any> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Adding node ${nodeId} to workflow: ${workflowId}`);

    return await this.callTool('add_node', {
      workflow_id: workflowId,
      node_id: nodeId,
      node_type: nodeType,
      node_data: nodeData
    });
  }

  /**
   * Delete a node from the workflow graph
   */
  async deleteNode(
    workflowId: string,
    nodeId: string
  ): Promise<any> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Deleting node ${nodeId} from workflow: ${workflowId}`);

    return await this.callTool('delete_node', {
      workflow_id: workflowId,
      node_id: nodeId
    });
  }

  /**
   * Create an edge in the workflow graph
   */
  async createEdge(
    workflowId: string,
    edgeId: string,
    sourceNodeId: string,
    targetNodeId: string,
    edgeType?: string,
    label?: string,
    condition?: string
  ): Promise<any> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Creating edge ${edgeId} in workflow: ${workflowId}`);

    return await this.callTool('create_edge', {
      workflow_id: workflowId,
      edge_id: edgeId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      edge_type: edgeType,
      label,
      condition
    });
  }

  /**
   * Update an edge in the workflow graph
   */
  async updateEdge(
    workflowId: string,
    edgeId: string,
    updates: Record<string, any>
  ): Promise<any> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Updating edge ${edgeId} in workflow: ${workflowId}`);

    return await this.callTool('update_edge', {
      workflow_id: workflowId,
      edge_id: edgeId,
      updates
    });
  }

  /**
   * Delete an edge from the workflow graph
   */
  async deleteEdge(
    workflowId: string,
    edgeId: string
  ): Promise<any> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Deleting edge ${edgeId} from workflow: ${workflowId}`);

    return await this.callTool('delete_edge', {
      workflow_id: workflowId,
      edge_id: edgeId
    });
  }

  /**
   * Create workflow version
   */
  async createWorkflowVersion(
    workflowId: string,
    version: string,
    definitionJson: object,
    changelog: string,
    parentVersion?: string,
    createdBy?: string
  ): Promise<any> {
    return await this.callTool('create_workflow_version', {
      workflow_id: workflowId,
      version,
      definition_json: definitionJson,
      changelog,
      parent_version: parentVersion,
      created_by: createdBy
    });
  }

  /**
   * Get workflow versions
   */
  async getWorkflowVersions(workflowId: string): Promise<any[]> {
    const result = await this.callTool('get_workflow_versions', {
      workflow_id: workflowId
    });
    return Array.isArray(result) ? result : [];
  }

  /**
   * Lock workflow version during execution
   */
  async lockWorkflowVersion(
    workflowId: string,
    version: string,
    instanceId: number
  ): Promise<void> {
    await this.callTool('lock_workflow_version', {
      workflow_id: workflowId,
      version,
      instance_id: instanceId
    });
  }

  /**
   * Unlock workflow version
   */
  async unlockWorkflowVersion(
    workflowId: string,
    version: string,
    instanceId: number
  ): Promise<void> {
    await this.callTool('unlock_workflow_version', {
      workflow_id: workflowId,
      version,
      instance_id: instanceId
    });
  }

  /**
   * Start sub-workflow
   */
  async startSubWorkflow(
    parentInstanceId: number,
    parentPhaseNumber: number,
    subworkflowId: string,
    subWorkflowVersion: string
  ): Promise<any> {
    return await this.callTool('start_sub_workflow', {
      parent_instance_id: parentInstanceId,
      parent_phase_number: parentPhaseNumber,
      sub_workflow_id: subworkflowId,
      sub_workflow_version: subWorkflowVersion
    });
  }

  /**
   * Complete sub-workflow
   */
  async completeSubWorkflow(
    subWorkflowExecutionId: number,
    outputJson?: object,
    error?: string
  ): Promise<any> {
    return await this.callTool('complete_sub_workflow', {
      sub_workflow_execution_id: subWorkflowExecutionId,
      output_json: outputJson,
      error
    });
  }

  /**
   * Get sub-workflow status
   */
  async getSubWorkflowStatus(
    subWorkflowExecutionId?: number,
    parentInstanceId?: number
  ): Promise<any> {
    return await this.callTool('get_sub_workflow_status', {
      sub_workflow_execution_id: subWorkflowExecutionId,
      parent_instance_id: parentInstanceId
    });
  }

  /**
   * Update phase execution
   */
  async updatePhaseExecution(
    workflowId: number,
    phaseNumber: number,
    claudeCodeSession?: string,
    skillInvoked?: string,
    outputJson?: object
  ): Promise<void> {
    await this.callTool('update_phase_execution', {
      workflow_id: workflowId,
      phase_number: phaseNumber,
      claude_code_session: claudeCodeSession,
      skill_invoked: skillInvoked,
      output_json: outputJson
    });
  }

  /**
   * Create workflow instance (uses existing create_workflow tool)
   */
  async createWorkflowInstance(
    seriesId: number,
    userId: number,
    concept: string
  ): Promise<any> {
    return await this.callTool('create_workflow', {
      series_id: seriesId,
      user_id: userId,
      concept
    });
  }

  /**
   * Get workflow state
   */
  async getWorkflowState(workflowId: number): Promise<any> {
    return await this.callTool('get_workflow_state', {
      workflow_id: workflowId
    });
  }

  /**
   * Advance to phase
   */
  async advanceToPhase(workflowId: number, targetPhase: number): Promise<any> {
    return await this.callTool('advance_to_phase', {
      workflow_id: workflowId,
      target_phase: targetPhase
    });
  }

  /**
   * Export workflow package for sharing/marketplace
   */
  async exportWorkflowPackage(
    workflowId: string,
    options?: {
      version?: string;
      includeAgents?: boolean;
      includeSkills?: boolean;
      exportFormat?: 'json' | 'yaml';
      outputPath?: string;
    }
  ): Promise<any> {
    return await this.callTool('export_workflow_package', {
      workflow_id: workflowId,
      version: options?.version,
      include_agents: options?.includeAgents ?? true,
      include_skills: options?.includeSkills ?? true,
      export_format: options?.exportFormat || 'yaml',
      output_path: options?.outputPath
    });
  }

  // ========================================
  // Active Workflow Management Methods
  // ========================================

  /**
   * List all active workflows across all sources
   */
  async listActiveWorkflows(): Promise<any[]> {
    logWithCategory('info', LogCategory.WORKFLOW, 'Listing active workflows');
    try {
      const result = await this.callTool('list_active_workflows', {});
      return Array.isArray(result) ? result : [];
    } catch (error: any) {
      logWithCategory('warn', LogCategory.WORKFLOW,
        `list_active_workflows not available: ${error.message}`);
      return [];
    }
  }

  /**
   * Register an active workflow
   */
  async registerActiveWorkflow(params: {
    workflowId: string;
    workflowName: string;
    source: 'fictionlab_ui' | 'claude_code' | 'typingmind';
    projectFolder: string;
    projectName: string;
    totalNodes: number;
    availableNodes?: { id: string; name: string }[];
    parentWorkflowId?: string;
  }): Promise<{ registryId: string }> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Registering active workflow: ${params.workflowName} from ${params.source}${params.parentWorkflowId ? ` (parent: ${params.parentWorkflowId})` : ''}`);

    const result = await this.callTool('register_active_workflow', {
      workflow_id: params.workflowId,
      workflow_name: params.workflowName,
      source: params.source,
      project_folder: params.projectFolder,
      project_name: params.projectName,
      total_nodes: params.totalNodes,
      available_nodes: params.availableNodes,
      parent_workflow_id: params.parentWorkflowId
    });

    return { registryId: result?.registry_id || result?.id };
  }

  /**
   * Update workflow progress
   * @param registryId - The active workflow registry ID
   * @param nodeId - Current node being executed
   * @param nodeName - Human-readable node name
   * @param progressPercent - Progress percentage (0-100)
   * @param completedNodes - Number of completed nodes
   * @param breadcrumb - Optional breadcrumb trail for nested workflow tracking
   */
  async updateWorkflowProgress(
    registryId: string,
    nodeId: string,
    nodeName: string,
    progressPercent: number,
    completedNodes?: number,
    breadcrumb?: WorkflowBreadcrumbEntry[]
  ): Promise<void> {
    await this.callTool('update_workflow_progress', {
      registry_id: registryId,
      current_node_id: nodeId,
      current_node_name: nodeName,
      progress_percent: progressPercent,
      completed_nodes: completedNodes,
      breadcrumb: breadcrumb ? JSON.stringify(breadcrumb) : undefined
    });
  }

  /**
   * Pause a workflow
   */
  async pauseWorkflow(registryId: string): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW, `Pausing workflow: ${registryId}`);
    await this.callTool('pause_workflow', { registry_id: registryId });
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(registryId: string): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW, `Resuming workflow: ${registryId}`);
    await this.callTool('resume_workflow', { registry_id: registryId });
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(registryId: string): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW, `Cancelling workflow: ${registryId}`);
    await this.callTool('cancel_workflow', { registry_id: registryId });
  }

  /**
   * Jump to a specific node in a workflow
   */
  async jumpToNode(registryId: string, nodeId: string): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Jumping to node ${nodeId} in workflow: ${registryId}`);
    await this.callTool('jump_to_node', {
      registry_id: registryId,
      node_id: nodeId
    });
  }

  /**
   * Mark a workflow as completed
   */
  async completeActiveWorkflow(registryId: string): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW, `Completing workflow: ${registryId}`);
    await this.callTool('complete_workflow', { registry_id: registryId });
  }

  /**
   * Mark a workflow as failed
   */
  async failActiveWorkflow(registryId: string, error: string): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW, `Failing workflow: ${registryId}`);
    await this.callTool('fail_workflow', {
      registry_id: registryId,
      error
    });
  }

  /**
   * Mark a node as started (sets it as the current node)
   */
  async markNodeStarted(registryId: string, nodeId: string, nodeName: string): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW, `Marking node started: ${nodeId} in workflow ${registryId}`);
    await this.callTool('mark_node_started', {
      registry_id: registryId,
      node_id: nodeId,
      node_name: nodeName
    });
  }

  /**
   * Mark a node as completed (adds to completedNodeIds list)
   */
  async markNodeCompleted(registryId: string, nodeId: string): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW, `Marking node completed: ${nodeId} in workflow ${registryId}`);
    await this.callTool('mark_node_completed', {
      registry_id: registryId,
      node_id: nodeId
    });
  }
}
