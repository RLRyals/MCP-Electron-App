/**
 * SubWorkflow Executor
 *
 * Executes a nested workflow as part of a parent workflow.
 * Loads workflow definition, creates isolated context, executes sub-workflow,
 * and returns aggregated results to parent workflow.
 */

import { NodeExecutor } from './base-executor';
import { WorkflowNode, SubWorkflowNode, NodeOutput, isSubWorkflowNode } from '../../../types/workflow-nodes';
import { WorkflowExecutionContext } from '../../../types/workflow-context';
import { logWithCategory, LogCategory } from '../../logger';

export class SubWorkflowExecutor implements NodeExecutor {
  readonly nodeType = 'subworkflow';

  /**
   * Execute sub-workflow node
   * Loads workflow definition, creates isolated context, and executes sub-workflow
   */
  async execute(node: WorkflowNode, context: any): Promise<NodeOutput> {
    if (!isSubWorkflowNode(node)) {
      throw new Error(`SubWorkflowExecutor received invalid node type: ${node.type}`);
    }

    const subWorkflowNode = node as SubWorkflowNode;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing sub-workflow node: ${subWorkflowNode.name} (sub-workflow ID: ${subWorkflowNode.subWorkflowId})`);

    try {
      // Validate required sub-workflow ID
      if (!subWorkflowNode.subWorkflowId) {
        throw new Error('Sub-workflow ID is required');
      }

      // Check timeout configuration
      const timeout = subWorkflowNode.timeoutMs || 300000; // Default 5 minutes

      // Execute sub-workflow with timeout
      const result = await this.executeWithTimeout(
        () => this.executeSubWorkflow(subWorkflowNode, context),
        timeout
      );

      // Return successful output
      return {
        nodeId: subWorkflowNode.id,
        nodeName: subWorkflowNode.name,
        timestamp: new Date(),
        status: 'success',
        output: result,
        variables: result.outputs || {},
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Sub-workflow node failed: ${error.message}`);

      return {
        nodeId: subWorkflowNode.id,
        nodeName: subWorkflowNode.name,
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
   * Execute the sub-workflow with proper context isolation
   */
  private async executeSubWorkflow(
    node: SubWorkflowNode,
    parentContext: any
  ): Promise<any> {
    const version = node.subWorkflowVersion || 'latest';

    logWithCategory('info', LogCategory.WORKFLOW,
      `Loading sub-workflow: ${node.subWorkflowId} (version: ${version})`);

    // 1. Load workflow definition
    const workflowDefinition = await this.loadWorkflowDefinition(
      node.subWorkflowId,
      version
    );

    if (!workflowDefinition) {
      throw new Error(`Sub-workflow not found: ${node.subWorkflowId}`);
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Loaded sub-workflow: ${workflowDefinition.name} (${workflowDefinition.nodes?.length || 0} nodes)`);

    // 2. Build sub-workflow context from parent context
    const subWorkflowContext = this.buildSubWorkflowContext(
      node,
      parentContext,
      workflowDefinition
    );

    logWithCategory('info', LogCategory.WORKFLOW,
      `Sub-workflow context created with ${Object.keys(subWorkflowContext.variables).length} input variables`);

    // 3. Execute sub-workflow
    // NOTE: This is a placeholder - actual execution will coordinate with WorkflowExecutor
    // For now, we'll return metadata about what would be executed
    const executionResult = await this.coordinateSubWorkflowExecution(
      workflowDefinition,
      subWorkflowContext,
      node
    );

    logWithCategory('info', LogCategory.WORKFLOW,
      `Sub-workflow execution completed: ${node.subWorkflowId}`);

    // 4. Extract and return output variables
    return {
      subWorkflowId: node.subWorkflowId,
      subWorkflowName: workflowDefinition.name,
      version: workflowDefinition.version,
      executionResult,
      outputs: executionResult.outputs || {},
      metadata: {
        nodeCount: workflowDefinition.nodes?.length || 0,
        executionTime: executionResult.executionTime,
        completedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Load workflow definition from database or file
   */
  private async loadWorkflowDefinition(
    workflowId: string,
    version: string
  ): Promise<any> {
    // This is a placeholder for actual workflow loading logic
    // In a real implementation, this would:
    // 1. Query database for workflow definition by ID and version
    // 2. Parse workflow JSON
    // 3. Validate workflow structure
    // 4. Return workflow definition

    logWithCategory('info', LogCategory.WORKFLOW,
      `[PLACEHOLDER] Would load workflow: ${workflowId} (version: ${version}) from database/file`);

    // Return placeholder workflow definition
    return {
      id: workflowId,
      name: `Sub-Workflow ${workflowId}`,
      version: version === 'latest' ? '1.0.0' : version,
      nodes: [],
      edges: [],
      metadata: {
        loadedFrom: 'placeholder',
      },
    };
  }

  /**
   * Build isolated context for sub-workflow execution
   */
  private buildSubWorkflowContext(
    node: SubWorkflowNode,
    parentContext: any,
    workflowDefinition: any
  ): WorkflowExecutionContext {
    // Create new context inheriting necessary data from parent
    const subContext: WorkflowExecutionContext = {
      // Generate new instance ID for sub-workflow
      instanceId: `${parentContext.instanceId}-sub-${node.id}`,
      workflowId: node.subWorkflowId,

      // Inherit project folder from parent (required for file operations)
      projectFolder: parentContext.projectFolder,

      // Initialize variables based on context mode
      variables: this.mapInputVariables(node, parentContext),

      // Initialize empty node outputs map
      nodeOutputs: new Map(),

      // Inherit MCP data from parent (series, books, characters, etc.)
      mcpData: {
        ...parentContext.mcpData,
      },

      // Execution state
      currentNodeId: '',
      completedNodes: [],

      // Initialize empty loop stack
      loopStack: [],

      // Metadata
      startedAt: new Date(),
      userId: parentContext.userId,
      seriesId: parentContext.seriesId,
    };

    return subContext;
  }

  /**
   * Map input variables from parent to sub-workflow context
   */
  private mapInputVariables(
    node: SubWorkflowNode,
    parentContext: any
  ): Record<string, any> {
    const inputVariables: Record<string, any> = {};

    // In simple mode, pass relevant variables from parent
    if (node.contextConfig.mode === 'simple') {
      // Pass all parent variables to sub-workflow
      if (parentContext.variables) {
        Object.assign(inputVariables, parentContext.variables);
      }

      // Also include previousOutputs if available
      if (parentContext.previousOutputs) {
        inputVariables._parentOutputs = parentContext.previousOutputs;
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `[Simple Mode] Passing ${Object.keys(inputVariables).length} variables to sub-workflow`);
    }
    // In advanced mode, use explicit input mappings
    else if (node.contextConfig.inputs && node.contextConfig.inputs.length > 0) {
      for (const mapping of node.contextConfig.inputs) {
        try {
          // Evaluate mapping from parent context
          // This would use ContextManager.evaluateMapping in real implementation
          const value = this.evaluateMappingPlaceholder(mapping, parentContext);
          inputVariables[mapping.target] = value;

          logWithCategory('info', LogCategory.WORKFLOW,
            `[Advanced Mode] Mapped ${mapping.source} -> ${mapping.target}`);
        } catch (error: any) {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Failed to map input variable ${mapping.source}: ${error.message}`);
        }
      }
    }

    return inputVariables;
  }

  /**
   * Placeholder for mapping evaluation (would use ContextManager in real implementation)
   */
  private evaluateMappingPlaceholder(mapping: any, context: any): any {
    // This is a simple placeholder
    // Real implementation would use ContextManager.evaluateMapping
    const source = mapping.source;

    // Handle simple variable references: {{variableName}}
    if (source.startsWith('{{') && source.endsWith('}}')) {
      const varName = source.slice(2, -2).trim();
      if (context.variables && varName in context.variables) {
        return context.variables[varName];
      }
    }

    // For now, return placeholder value
    return `[PLACEHOLDER: ${source}]`;
  }

  /**
   * Coordinate sub-workflow execution
   * This will integrate with WorkflowExecutor in the future
   */
  private async coordinateSubWorkflowExecution(
    workflowDefinition: any,
    subContext: WorkflowExecutionContext,
    node: SubWorkflowNode
  ): Promise<any> {
    const startTime = Date.now();

    logWithCategory('info', LogCategory.WORKFLOW,
      `[PLACEHOLDER] Coordinating sub-workflow execution: ${workflowDefinition.name}`);

    // This is a placeholder for actual sub-workflow execution
    // In a real implementation, this would:
    // 1. Create a new WorkflowExecutor instance or reuse existing one
    // 2. Pass the sub-workflow context
    // 3. Execute all nodes in the sub-workflow
    // 4. Wait for completion or handle errors
    // 5. Extract output variables from final node outputs
    // 6. Return aggregated results

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    logWithCategory('info', LogCategory.WORKFLOW,
      `[PLACEHOLDER] Sub-workflow execution completed in ${executionTime}ms`);

    // Return placeholder execution result
    return {
      status: 'completed',
      executionTime,
      outputs: {
        // Placeholder outputs that would be extracted from sub-workflow
        subWorkflowCompleted: true,
        executedNodes: workflowDefinition.nodes?.length || 0,
        executionContext: {
          instanceId: subContext.instanceId,
          startedAt: subContext.startedAt.toISOString(),
          completedAt: new Date().toISOString(),
        },
      },
      metadata: {
        workflowId: workflowDefinition.id,
        workflowName: workflowDefinition.name,
        version: workflowDefinition.version,
      },
    };
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Sub-workflow execution timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Extract output variables from sub-workflow results
   * Used when parent workflow needs specific outputs from sub-workflow
   */
  private extractOutputVariables(
    node: SubWorkflowNode,
    subWorkflowResult: any
  ): Record<string, any> {
    const outputs: Record<string, any> = {};

    // In simple mode, return entire result
    if (node.contextConfig.mode === 'simple') {
      outputs.output = subWorkflowResult;
    }
    // In advanced mode, use explicit output mappings
    else if (node.contextConfig.outputs && node.contextConfig.outputs.length > 0) {
      for (const mapping of node.contextConfig.outputs) {
        try {
          // Extract value from sub-workflow result using mapping
          // This would use ContextManager.evaluateMapping in real implementation
          const value = this.extractValuePlaceholder(mapping.source, subWorkflowResult);
          outputs[mapping.target] = value;

          logWithCategory('info', LogCategory.WORKFLOW,
            `Extracted output: ${mapping.source} -> ${mapping.target}`);
        } catch (error: any) {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Failed to extract output variable ${mapping.source}: ${error.message}`);
        }
      }
    } else {
      // No output mappings, return entire result
      outputs.output = subWorkflowResult;
    }

    return outputs;
  }

  /**
   * Placeholder for value extraction
   */
  private extractValuePlaceholder(path: string, data: any): any {
    // Simple dot notation support for placeholder
    const parts = path.replace(/^\$\./, '').split('.');
    let value = data;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return `[PLACEHOLDER: ${path}]`;
      }
    }

    return value;
  }
}
