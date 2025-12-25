/**
 * MCP Workflow Client
 *
 * Communicates with workflow-manager MCP server via stdio
 * Uses the same pattern as other MCP clients in the system
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { app } from 'electron';
import { logWithCategory, LogCategory } from '../logger';
import { getDatabaseUrl } from '../database-connection';

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  graph_json: object;
  dependencies_json: {
    agents: string[];
    skills: string[];
    mcpServers: string[];
    subWorkflows?: string[];
  };
  phases_json: WorkflowPhase[];
  tags?: string[];
  marketplace_metadata?: object;
  is_system?: boolean;
  created_by?: string;
}

export interface WorkflowPhase {
  id: number;
  name: string;
  type: 'planning' | 'gate' | 'writing' | 'loop' | 'user' | 'subworkflow';
  agent: string;
  skill?: string;
  prompt?: string;                  // Prompt template for agent nodes (CRITICAL for execution)
  subWorkflowId?: string;
  description: string;
  gate: boolean;
  gateCondition?: string;
  requiresApproval: boolean;
  position: { x: number; y: number };
}

export class MCPWorkflowClient {
  private mcpServerPath: string;
  private requestId: number = 0;

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
   * Call MCP tool via stdio
   * Public for use in IPC handlers for graph-based workflow operations
   */
  public async callTool(toolName: string, args: any): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const requestId = ++this.requestId;

      logWithCategory('debug', LogCategory.WORKFLOW,
        `Calling MCP tool: ${toolName} (request ${requestId})`);

      // Get database URL for the MCP server
      let databaseUrl: string;
      try {
        databaseUrl = await getDatabaseUrl();
      } catch (error: any) {
        reject(new Error(`Failed to get database URL: ${error.message}`));
        return;
      }

      // Spawn MCP server in stdio mode
      const mcpProcess = spawn('node', [this.mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MCP_STDIO_MODE: 'true',
          DATABASE_URL: databaseUrl
        }
      });

      let stdout = '';
      let stderr = '';
      let toolResponse: any = null;

      // Send MCP request
      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      mcpProcess.stdin?.write(JSON.stringify(request) + '\n');
      mcpProcess.stdin?.end();

      // Collect stdout
      mcpProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr (for logs)
      mcpProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      mcpProcess.on('close', (code) => {
        if (code !== 0) {
          logWithCategory('error', LogCategory.WORKFLOW,
            `MCP server exited with code ${code}: ${stderr}`);
          reject(new Error(`MCP server failed: ${stderr}`));
          return;
        }

        try {
          // Parse JSON-RPC response
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const response = JSON.parse(line);
              if (response.id === requestId) {
                toolResponse = response;
                break;
              }
            } catch (e) {
              // Skip non-JSON lines (debug output)
            }
          }

          if (!toolResponse) {
            reject(new Error('No valid JSON-RPC response received'));
            return;
          }

          if (toolResponse.error) {
            reject(new Error(toolResponse.error.message));
            return;
          }

          logWithCategory('debug', LogCategory.WORKFLOW,
            `MCP tool ${toolName} completed successfully`);

          // Extract content from MCP response
          const content = toolResponse.result?.content;
          if (Array.isArray(content) && content.length > 0) {
            // Parse text content as JSON if possible
            const textContent = content.find(c => c.type === 'text')?.text;
            if (textContent) {
              try {
                resolve(JSON.parse(textContent));
              } catch {
                resolve(textContent);
              }
            } else {
              resolve(content);
            }
          } else {
            resolve(toolResponse.result);
          }

        } catch (error: any) {
          reject(new Error(`Failed to parse MCP response: ${error.message}`));
        }
      });

      mcpProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn MCP server: ${error.message}`));
      });
    });
  }

  /**
   * Import workflow definition
   */
  async importWorkflowDefinition(workflow: WorkflowDefinition): Promise<{
    workflow_def_id: string;
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
      phases_json: JSON.stringify(workflow.phases_json),
      tags: workflow.tags || [],
      marketplace_metadata: JSON.stringify(workflow.marketplace_metadata || {}),
      created_by: workflow.created_by
    };

    logWithCategory('info', LogCategory.WORKFLOW,
      `MCP import params: ${JSON.stringify(params, null, 2).substring(0, 500)}...`);

    const result = await this.callTool('import_workflow_definition', params);

    logWithCategory('info', LogCategory.WORKFLOW,
      `MCP import result: ${JSON.stringify(result)}`);

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
    workflowDefId: string,
    version?: string
  ): Promise<WorkflowDefinition | null> {
    return await this.callTool('get_workflow_definition', {
      workflow_def_id: workflowDefId,
      version
    });
  }

  /**
   * Update node positions in workflow definition
   */
  async updateNodePositions(
    workflowDefId: string,
    positions: Record<string, { x: number; y: number }>
  ): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Updating node positions for workflow: ${workflowDefId}`);

    await this.callTool('update_workflow_positions', {
      workflow_def_id: workflowDefId,
      positions
    });
  }

  /**
   * Update a specific phase in a workflow definition
   */
  async updateWorkflowPhase(
    workflowDefId: string,
    phaseId: number,
    updates: Partial<WorkflowPhase>
  ): Promise<WorkflowPhase> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Updating phase ${phaseId} in workflow: ${workflowDefId}`);

    return await this.callTool('update_workflow_phase', {
      workflow_def_id: workflowDefId,
      phase_id: phaseId,
      updates
    });
  }

  /**
   * Create workflow version
   */
  async createWorkflowVersion(
    workflowDefId: string,
    version: string,
    definitionJson: object,
    changelog: string,
    parentVersion?: string,
    createdBy?: string
  ): Promise<any> {
    return await this.callTool('create_workflow_version', {
      workflow_def_id: workflowDefId,
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
  async getWorkflowVersions(workflowDefId: string): Promise<any[]> {
    const result = await this.callTool('get_workflow_versions', {
      workflow_def_id: workflowDefId
    });
    return Array.isArray(result) ? result : [];
  }

  /**
   * Lock workflow version during execution
   */
  async lockWorkflowVersion(
    workflowDefId: string,
    version: string,
    instanceId: number
  ): Promise<void> {
    await this.callTool('lock_workflow_version', {
      workflow_def_id: workflowDefId,
      version,
      instance_id: instanceId
    });
  }

  /**
   * Unlock workflow version
   */
  async unlockWorkflowVersion(
    workflowDefId: string,
    version: string,
    instanceId: number
  ): Promise<void> {
    await this.callTool('unlock_workflow_version', {
      workflow_def_id: workflowDefId,
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
    subWorkflowDefId: string,
    subWorkflowVersion: string
  ): Promise<any> {
    return await this.callTool('start_sub_workflow', {
      parent_instance_id: parentInstanceId,
      parent_phase_number: parentPhaseNumber,
      sub_workflow_def_id: subWorkflowDefId,
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
    workflowDefId: string,
    options?: {
      version?: string;
      includeAgents?: boolean;
      includeSkills?: boolean;
      exportFormat?: 'json' | 'yaml';
      outputPath?: string;
    }
  ): Promise<any> {
    return await this.callTool('export_workflow_package', {
      workflow_def_id: workflowDefId,
      version: options?.version,
      include_agents: options?.includeAgents ?? true,
      include_skills: options?.includeSkills ?? true,
      export_format: options?.exportFormat || 'yaml',
      output_path: options?.outputPath
    });
  }
}
