/**
 * Workflow Execution Engine
 *
 * Executes multi-step workflows that chain plugins together.
 * Handles variable substitution, error handling, and execution tracking.
 */

import { Pool } from 'pg';
import { logWithCategory, LogCategory } from './logger';

export interface WorkflowStep {
  id: string;
  name: string;
  pluginId: string;
  action: string;
  config: Record<string, any>;
  outputMapping?: Record<string, string>;  // JSONPath mappings for output
  condition?: string;  // Optional condition for executing step
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  target_type?: string;
  target_id?: string;
  status: string;
}

export interface WorkflowContext {
  variables: Record<string, any>;
  stepOutputs: Record<string, any>;  // Outputs from each step
}

export interface WorkflowRunResult {
  success: boolean;
  runId: string;
  completedSteps: number;
  totalSteps: number;
  context: WorkflowContext;
  error?: string;
  errorStep?: number;
}

export class WorkflowEngine {
  private dbPool: Pool;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
  }

  /**
   * Execute a workflow by ID
   */
  async executeWorkflow(
    workflowId: string,
    initialContext: Record<string, any> = {},
    triggeredBy: string = 'manual',
    triggeredByUser?: string
  ): Promise<WorkflowRunResult> {
    logWithCategory('info', LogCategory.SYSTEM, `Starting workflow execution: ${workflowId}`);

    // Fetch workflow from database
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Create workflow run record
    const runId = await this.createWorkflowRun(workflowId, workflow.steps.length, triggeredBy, triggeredByUser);

    // Initialize execution context
    const context: WorkflowContext = {
      variables: { ...initialContext },
      stepOutputs: {},
    };

    let completedSteps = 0;
    let currentStepIndex = 0;

    try {
      // Execute each step sequentially
      for (let i = 0; i < workflow.steps.length; i++) {
        currentStepIndex = i;
        const step = workflow.steps[i];

        logWithCategory('info', LogCategory.SYSTEM, `Executing workflow step ${i + 1}/${workflow.steps.length}: ${step.name}`);

        // Update run status
        await this.updateWorkflowRunProgress(runId, i, 'running');

        // Check condition if present
        if (step.condition && !this.evaluateCondition(step.condition, context)) {
          logWithCategory('info', LogCategory.SYSTEM, `Skipping step ${step.name} - condition not met`);
          await this.logStepExecution(runId, i, 'skipped', null, 'Condition not met');
          continue;
        }

        // Substitute variables in step config
        const resolvedConfig = this.substituteVariables(step.config, context);

        // Execute the step (call plugin action)
        const stepResult = await this.executeStep(step, resolvedConfig);

        // Extract output variables using JSONPath
        if (step.outputMapping) {
          for (const [varName, jsonPath] of Object.entries(step.outputMapping)) {
            const value = this.extractValue(stepResult, jsonPath);
            context.stepOutputs[step.id] = context.stepOutputs[step.id] || {};
            context.stepOutputs[step.id][varName] = value;

            // Also add to global variables for easier access
            context.variables[varName] = value;
          }
        }

        // Log successful step execution
        await this.logStepExecution(runId, i, 'completed', stepResult);

        completedSteps++;
      }

      // Mark workflow run as completed
      await this.completeWorkflowRun(runId, 'completed', context);

      // Update workflow statistics
      await this.updateWorkflowStats(workflowId, true);

      logWithCategory('info', LogCategory.SYSTEM, `Workflow execution completed: ${workflowId}`);

      return {
        success: true,
        runId,
        completedSteps,
        totalSteps: workflow.steps.length,
        context,
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Workflow execution failed at step ${currentStepIndex + 1}:`, error);

      // Log error
      await this.logStepExecution(runId, currentStepIndex, 'failed', null, error.message);

      // Mark workflow run as failed
      await this.completeWorkflowRun(runId, 'failed', context, error.message, currentStepIndex);

      // Update workflow statistics
      await this.updateWorkflowStats(workflowId, false);

      return {
        success: false,
        runId,
        completedSteps,
        totalSteps: workflow.steps.length,
        context,
        error: error.message,
        errorStep: currentStepIndex,
      };
    }
  }

  /**
   * Get workflow by ID from database
   */
  private async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const result = await this.dbPool.query(
      'SELECT id, name, description, steps, target_type, target_id, status FROM workflows WHERE id = $1',
      [workflowId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as Workflow;
  }

  /**
   * Create a new workflow run record
   */
  private async createWorkflowRun(
    workflowId: string,
    totalSteps: number,
    triggeredBy: string,
    triggeredByUser?: string
  ): Promise<string> {
    const result = await this.dbPool.query(
      `INSERT INTO workflow_runs (workflow_id, total_steps, triggered_by, triggered_by_user, execution_log, context)
       VALUES ($1, $2, $3, $4, '[]'::jsonb, '{}'::jsonb)
       RETURNING id`,
      [workflowId, totalSteps, triggeredBy, triggeredByUser || null]
    );

    return result.rows[0].id;
  }

  /**
   * Update workflow run progress
   */
  private async updateWorkflowRunProgress(runId: string, currentStep: number, status: string): Promise<void> {
    await this.dbPool.query(
      'UPDATE workflow_runs SET current_step = $1, status = $2 WHERE id = $3',
      [currentStep, status, runId]
    );
  }

  /**
   * Log step execution to workflow run
   */
  private async logStepExecution(
    runId: string,
    stepIndex: number,
    status: string,
    output: any,
    errorMessage?: string
  ): Promise<void> {
    const logEntry = {
      step: stepIndex,
      status,
      timestamp: new Date().toISOString(),
      output,
      error: errorMessage || null,
    };

    await this.dbPool.query(
      `UPDATE workflow_runs
       SET execution_log = execution_log || $1::jsonb
       WHERE id = $2`,
      [JSON.stringify(logEntry), runId]
    );
  }

  /**
   * Complete workflow run
   */
  private async completeWorkflowRun(
    runId: string,
    status: string,
    context: WorkflowContext,
    errorMessage?: string,
    errorStep?: number
  ): Promise<void> {
    await this.dbPool.query(
      `UPDATE workflow_runs
       SET completed_at = NOW(),
           status = $1,
           context = $2,
           error_message = $3,
           error_step = $4
       WHERE id = $5`,
      [status, JSON.stringify(context), errorMessage || null, errorStep ?? null, runId]
    );
  }

  /**
   * Update workflow statistics after execution
   */
  private async updateWorkflowStats(workflowId: string, success: boolean): Promise<void> {
    await this.dbPool.query(
      `UPDATE workflows
       SET run_count = run_count + 1,
           success_count = success_count + CASE WHEN $1 THEN 1 ELSE 0 END,
           failure_count = failure_count + CASE WHEN $1 THEN 0 ELSE 1 END,
           last_run_at = NOW(),
           last_run_status = CASE WHEN $1 THEN 'success' ELSE 'failed' END
       WHERE id = $2`,
      [success, workflowId]
    );
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: WorkflowStep, config: Record<string, any>): Promise<any> {
    // TODO: Implement actual plugin action execution
    // For now, return mock data
    logWithCategory('debug', LogCategory.SYSTEM, `[MOCK] Executing plugin action: ${step.pluginId}.${step.action}`, config);

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mock result based on action type
    if (step.action === 'new-series') {
      return {
        success: true,
        result: {
          seriesId: `series-${Date.now()}`,
          name: config.name || 'New Series',
          createdAt: new Date().toISOString(),
        },
      };
    } else if (step.action === 'generate-outline') {
      return {
        success: true,
        result: {
          outlineId: `outline-${Date.now()}`,
          seriesId: config.seriesId,
          bookCount: config.bookCount || 1,
        },
      };
    } else if (step.action === 'draft-chapter') {
      return {
        success: true,
        result: {
          draftId: `draft-${Date.now()}`,
          chapterNumber: config.chapterNumber,
          wordCount: 2500,
        },
      };
    }

    return { success: true, result: {} };
  }

  /**
   * Substitute variables in config using context
   * Replaces {{step-id.variable}} with actual values
   */
  private substituteVariables(config: Record<string, any>, context: WorkflowContext): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.includes('{{')) {
        // Extract variable reference: {{step-1.seriesId}}
        const match = value.match(/\{\{(.+?)\}\}/);
        if (match) {
          const varPath = match[1]; // "step-1.seriesId"
          const resolvedValue = this.resolveVariable(varPath, context);
          result[key] = resolvedValue !== undefined ? resolvedValue : value;
        } else {
          result[key] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.substituteVariables(value, context);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Resolve a variable reference from context
   * Example: "step-1.seriesId" → context.stepOutputs['step-1'].seriesId
   */
  private resolveVariable(varPath: string, context: WorkflowContext): any {
    const parts = varPath.split('.');

    if (parts[0].startsWith('step-')) {
      // Step output variable
      const stepId = parts[0];
      const varName = parts.slice(1).join('.');
      return context.stepOutputs[stepId]?.[varName];
    } else {
      // Global variable
      return context.variables[varPath];
    }
  }

  /**
   * Extract value from result using JSONPath-like syntax
   * Simple implementation - supports $.result.field
   */
  private extractValue(obj: any, path: string): any {
    if (!path.startsWith('$.')) {
      return obj[path];
    }

    const parts = path.substring(2).split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Evaluate a condition expression
   * Simple implementation - supports basic comparisons
   */
  private evaluateCondition(condition: string, context: WorkflowContext): boolean {
    // TODO: Implement proper condition evaluation
    // For now, always return true
    return true;
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(runId: string): Promise<void> {
    await this.dbPool.query(
      `UPDATE workflow_runs
       SET status = 'cancelled',
           completed_at = NOW(),
           error_message = 'Cancelled by user'
       WHERE id = $1 AND status = 'running'`,
      [runId]
    );

    logWithCategory('info', LogCategory.SYSTEM, `Workflow run cancelled: ${runId}`);
  }

  /**
   * Get workflow execution history
   */
  async getWorkflowRuns(workflowId: string, limit: number = 50): Promise<any[]> {
    const result = await this.dbPool.query(
      `SELECT * FROM workflow_runs
       WHERE workflow_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [workflowId, limit]
    );

    return result.rows;
  }
}
