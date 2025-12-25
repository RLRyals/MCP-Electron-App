/**
 * Context Manager
 *
 * Manages variable passing and context building between workflow nodes.
 * Supports both Simple mode (automatic) and Advanced mode (explicit JSONPath mappings).
 */

import * as JSONPath from 'jsonpath';
import { WorkflowExecutionContext, VariableReference, NodeContextResult, VariableExtractionResult } from '../../types/workflow-context';
import { WorkflowNode, ContextMapping, NodeOutput } from '../../types/workflow-nodes';
import { logWithCategory, LogCategory } from '../logger';

export class ContextManager {
  /**
   * Build node-specific context from global context
   * Applies input mappings based on mode (simple vs advanced)
   */
  async buildNodeContext(
    node: WorkflowNode,
    globalContext: WorkflowExecutionContext
  ): Promise<NodeContextResult> {
    try {
      const nodeContext: any = {
        // Always include these
        projectFolder: globalContext.projectFolder,
        instanceId: globalContext.instanceId,
        workflowId: globalContext.workflowId,
        eventEmitter: (globalContext as any).eventEmitter,
        userInputQueue: (globalContext as any).userInputQueue,
      };

      if (node.contextConfig.mode === 'simple') {
        // Simple mode: pass all previous outputs automatically
        nodeContext.previousOutputs = {};

        for (const [nodeId, output] of globalContext.nodeOutputs) {
          nodeContext.previousOutputs[nodeId] = output.variables;
        }

        // Also include global variables
        nodeContext.variables = { ...globalContext.variables };

        // Include MCP data
        nodeContext.mcpData = globalContext.mcpData;

      } else {
        // Advanced mode: apply explicit input mappings
        if (node.contextConfig.inputs && node.contextConfig.inputs.length > 0) {
          const missingVariables: string[] = [];

          for (const mapping of node.contextConfig.inputs) {
            try {
              const value = this.evaluateMapping(mapping, globalContext);
              nodeContext[mapping.target] = value;
            } catch (error: any) {
              logWithCategory('warn', LogCategory.WORKFLOW,
                `Failed to map input variable ${mapping.source} -> ${mapping.target}: ${error.message}`);
              missingVariables.push(mapping.source);
            }
          }

          if (missingVariables.length > 0) {
            return {
              success: false,
              context: nodeContext,
              error: `Missing variables: ${missingVariables.join(', ')}`,
              missingVariables,
            };
          }
        }

        // Include MCP data if needed
        nodeContext.mcpData = globalContext.mcpData;
      }

      return {
        success: true,
        context: nodeContext,
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to build node context: ${error.message}`);

      return {
        success: false,
        context: {},
        error: error.message,
      };
    }
  }

  /**
   * Extract output variables from node result
   * Applies output mappings based on mode
   */
  async extractOutputs(
    node: WorkflowNode,
    result: NodeOutput,
    globalContext: WorkflowExecutionContext
  ): Promise<VariableExtractionResult> {
    try {
      const outputs: Record<string, any> = {};
      const warnings: string[] = [];

      if (node.contextConfig.mode === 'simple') {
        // Simple mode: entire output as single variable
        outputs.output = result.output;

      } else {
        // Advanced mode: apply explicit output mappings
        if (node.contextConfig.outputs && node.contextConfig.outputs.length > 0) {
          for (const mapping of node.contextConfig.outputs) {
            try {
              const value = this.evaluateMapping(mapping, {
                ...globalContext,
                currentNodeOutput: result.output,
              } as any);

              outputs[mapping.target] = value;

              // Also add to global variables
              globalContext.variables[mapping.target] = value;

            } catch (error: any) {
              warnings.push(`Failed to extract ${mapping.source} -> ${mapping.target}: ${error.message}`);
            }
          }
        } else {
          // No output mappings defined, use entire output
          outputs.output = result.output;
        }
      }

      return {
        success: true,
        variables: outputs,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to extract outputs: ${error.message}`);

      return {
        success: false,
        variables: {},
        error: error.message,
      };
    }
  }

  /**
   * Evaluate a context mapping with JSONPath and optional transformation
   */
  private evaluateMapping(
    mapping: ContextMapping,
    context: any
  ): any {
    // Evaluate JSONPath expression
    let value = this.evaluateJSONPath(mapping.source, context);

    // Apply transformation if present
    if (mapping.transform) {
      try {
        const transformFn = eval(`(${mapping.transform})`);
        value = transformFn(value);
      } catch (error: any) {
        throw new Error(`Transform function failed: ${error.message}`);
      }
    }

    return value;
  }

  /**
   * Evaluate JSONPath expression
   * Supports:
   * - $.path.to.field
   * - $.array[0]
   * - $.array[*]
   * - {{variableName}} for simple variable references
   */
  evaluateJSONPath(expression: string, context: any): any {
    // Handle variable references: {{variableName}}
    if (expression.startsWith('{{') && expression.endsWith('}}')) {
      const varName = expression.slice(2, -2).trim();

      // Check in variables first
      if (context.variables && varName in context.variables) {
        return context.variables[varName];
      }

      // Check in root context
      if (varName in context) {
        return context[varName];
      }

      throw new Error(`Variable not found: ${varName}`);
    }

    // Handle JSONPath expressions
    try {
      const results = JSONPath.query(context, expression);

      if (results.length === 0) {
        throw new Error(`No results found for JSONPath: ${expression}`);
      }

      // Return single result or array
      return results.length === 1 ? results[0] : results;

    } catch (error: any) {
      throw new Error(`JSONPath evaluation failed: ${error.message}`);
    }
  }

  /**
   * Evaluate condition expression
   * Supports: $.field >= value, $.field === value, etc.
   */
  evaluateCondition(expression: string, context: any): boolean {
    try {
      // Parse condition: $.score >= 70
      const match = expression.match(/^(.+?)\s*(==|!=|>=|<=|>|<|===|!==)\s*(.+?)$/);

      if (!match) {
        throw new Error(`Invalid condition format: ${expression}`);
      }

      const [, left, operator, right] = match;

      // Evaluate left side (JSONPath)
      const leftValue = this.evaluateJSONPath(left.trim(), context);

      // Parse right side (literal value)
      const rightValue = this.parseValue(right.trim());

      // Evaluate condition
      switch (operator) {
        case '==':
        case '===':
          return leftValue == rightValue;
        case '!=':
        case '!==':
          return leftValue != rightValue;
        case '>=':
          return leftValue >= rightValue;
        case '<=':
          return leftValue <= rightValue;
        case '>':
          return leftValue > rightValue;
        case '<':
          return leftValue < rightValue;
        default:
          return false;
      }

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Condition evaluation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Substitute variables in a template string
   * Example: "Hello {{userName}}" -> "Hello John"
   */
  substitute(template: string, context: any): string {
    return template.replace(/\{\{(.+?)\}\}/g, (match, varName) => {
      try {
        const value = this.evaluateJSONPath(`{{${varName}}}`, context);
        return String(value);
      } catch (error) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Failed to substitute variable ${varName}: ${error}`);
        return match; // Return original if substitution fails
      }
    });
  }

  /**
   * Parse literal value from string
   */
  private parseValue(value: string): any {
    // Try to parse as number
    if (!isNaN(Number(value))) {
      return Number(value);
    }

    // Try to parse as boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;

    // Remove quotes from strings
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    return value;
  }

  /**
   * Get available variables from previous nodes (for UI variable browser)
   */
  getAvailableVariables(
    currentNodeId: string,
    globalContext: WorkflowExecutionContext
  ): VariableReference[] {
    const variables: VariableReference[] = [];

    // Add variables from completed nodes
    for (const [nodeId, output] of globalContext.nodeOutputs) {
      // Skip current node
      if (nodeId === currentNodeId) continue;

      // Add each variable from this node
      for (const [varName, value] of Object.entries(output.variables)) {
        variables.push({
          nodeId,
          nodeName: output.nodeName,
          nodeType: 'unknown', // Would need to lookup from workflow definition
          path: `$.${nodeId}.${varName}`,
          value,
          type: typeof value,
        });
      }
    }

    // Add global variables
    for (const [varName, value] of Object.entries(globalContext.variables)) {
      variables.push({
        nodeId: 'global',
        nodeName: 'Global Variables',
        nodeType: 'global',
        path: `{{${varName}}}`,
        value,
        type: typeof value,
      });
    }

    return variables;
  }
}
