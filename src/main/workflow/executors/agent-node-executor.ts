/**
 * Agent Node Executor
 *
 * Executes agent workflow nodes (planning, writing, gate) using LLM providers.
 * Handles AI-powered nodes with retry logic, timeout, and context management.
 */

import { NodeExecutor } from './base-executor';
import { WorkflowNode, AgentWorkflowNode, NodeOutput, isAgentNode } from '../../../types/workflow-nodes';
import { getProviderManager } from '../../llm/provider-manager';
import { logWithCategory, LogCategory } from '../../logger';
import { EventEmitter } from 'events';

export class AgentNodeExecutor extends EventEmitter implements NodeExecutor {
  readonly nodeType = 'agent';

  /**
   * Execute agent node (planning, writing, or gate)
   * Uses LLMProviderManager to execute prompts via configured provider
   */
  async execute(node: WorkflowNode, context: any): Promise<NodeOutput> {
    if (!isAgentNode(node)) {
      throw new Error(`AgentNodeExecutor received invalid node type: ${node.type}`);
    }

    const agentNode = node as AgentWorkflowNode;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing ${agentNode.type} node: ${agentNode.name} with agent: ${agentNode.agent}`);

    try {
      // Execute with retry logic
      const result = await this.executeWithRetry(agentNode, context);

      // Extract output variables according to node's contextConfig
      const variables = await this.extractVariables(result, agentNode, context);

      // For gate nodes, evaluate gate condition
      if (agentNode.gate && agentNode.gateCondition) {
        const gatePass = this.evaluateGateCondition(agentNode.gateCondition, variables, context);

        if (!gatePass) {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Gate node failed condition: ${agentNode.name}`);

          return {
            nodeId: agentNode.id,
            nodeName: agentNode.name,
            timestamp: new Date(),
            status: 'failed',
            output: result,
            variables,
            error: 'Gate condition not met',
          };
        }
      }

      return {
        nodeId: agentNode.id,
        nodeName: agentNode.name,
        timestamp: new Date(),
        status: 'success',
        output: result,
        variables,
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Agent node execution failed: ${error.message}`);

      return {
        nodeId: agentNode.id,
        nodeName: agentNode.name,
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
   * Execute agent node with retry logic
   */
  private async executeWithRetry(node: AgentWorkflowNode, context: any): Promise<any> {
    const retryConfig = node.retryConfig || {
      maxRetries: 0,
      retryDelayMs: 1000,
      backoffMultiplier: 2,
    };

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      try {
        // Execute with timeout if configured
        if (node.timeoutMs) {
          return await this.executeWithTimeout(node, context, node.timeoutMs);
        } else {
          return await this.executeNode(node, context);
        }
      } catch (error: any) {
        lastError = error;
        attempt++;

        if (attempt <= retryConfig.maxRetries) {
          const delay = retryConfig.retryDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);

          logWithCategory('warn', LogCategory.WORKFLOW,
            `Agent node failed (attempt ${attempt}/${retryConfig.maxRetries + 1}), retrying in ${delay}ms: ${error.message}`);

          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Execution failed with no error details');
  }

  /**
   * Execute node with timeout
   */
  private async executeWithTimeout(node: AgentWorkflowNode, context: any, timeoutMs: number): Promise<any> {
    return Promise.race([
      this.executeNode(node, context),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Execute the agent node using LLM provider
   */
  private async executeNode(node: AgentWorkflowNode, context: any): Promise<any> {
    const providerManager = getProviderManager();

    // Use the explicit user-defined prompt with variable substitution
    if (!node.prompt) {
      throw new Error(`Agent node ${node.id} missing required 'prompt' field. All prompts must be explicit and user-visible.`);
    }

    const prompt = this.substituteVariables(node.prompt, context);

    // Use explicit system prompt if provided, otherwise use minimal default
    const systemPrompt = node.systemPrompt
      ? this.substituteVariables(node.systemPrompt, context)
      : this.buildMinimalSystemPrompt(node);

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing ${node.type} node with user-defined prompt (${prompt.length} chars)`);

    // Log the actual prompt being sent for transparency
    logWithCategory('debug', LogCategory.WORKFLOW,
      `Prompt: ${prompt.substring(0, 200)}...`);

    // Execute prompt via provider manager
    const response = await providerManager.executePrompt(
      node.provider,
      prompt,
      context,
      systemPrompt
    );

    // Check if execution was successful
    if (!response.success) {
      throw new Error(response.error || 'LLM execution failed');
    }

    // Emit streaming events if available
    if (response.output) {
      this.emit('node-output', {
        nodeId: node.id,
        nodeName: node.name,
        output: response.output,
      });
    }

    // Log token usage if available
    if (response.usage) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `LLM usage - Prompt: ${response.usage.promptTokens}, Completion: ${response.usage.completionTokens}, Total: ${response.usage.totalTokens}`);
    }

    return response.output;
  }

  /**
   * Substitute variables in prompt template
   * Supports: {{varName}} for simple variables
   */
  private substituteVariables(template: string, context: any): string {
    // Log template info
    const varRefs = template.match(/\{\{(.+?)\}\}/g) || [];
    if (varRefs.length > 0) {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `[VAR SUB] Template has ${varRefs.length} variables: ${varRefs.join(', ')}`);
      logWithCategory('debug', LogCategory.WORKFLOW,
        `[VAR SUB] Available: ${JSON.stringify(Object.keys(context.variables || {}))}`);
    }

    return template.replace(/\{\{(.+?)\}\}/g, (match, varName) => {
      const trimmed = varName.trim();

      // Check context.variables first
      if (context.variables && trimmed in context.variables) {
        const value = context.variables[trimmed];
        logWithCategory('debug', LogCategory.WORKFLOW,
          `[VAR SUB] ✓ Found {{${trimmed}}} in context.variables`);
        return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      }

      // Check root context
      if (trimmed in context) {
        const value = context[trimmed];
        logWithCategory('debug', LogCategory.WORKFLOW,
          `[VAR SUB] ✓ Found {{${trimmed}}} in root context`);
        return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      }

      // NOT FOUND - log error
      logWithCategory('error', LogCategory.WORKFLOW,
        `[VAR SUB] ✗ Variable not found: {{${trimmed}}}`);
      logWithCategory('error', LogCategory.WORKFLOW,
        `[VAR SUB] Available were: ${JSON.stringify(Object.keys(context.variables || {}))}`);

      return match; // Keep original {{variable}}
    });
  }

  /**
   * Build minimal system prompt - just identity, no hidden instructions
   */
  private buildMinimalSystemPrompt(node: AgentWorkflowNode): string {
    const parts: string[] = [];

    parts.push(`You are ${node.agent}, an AI assistant.`);

    // Only add output format if explicitly needed
    if (node.provider.type === 'claude-code-cli' && node.provider.config.outputFormat === 'json') {
      parts.push('Always respond with valid JSON format.');
    }

    return parts.join('\n');
  }

  /**
   * Extract output variables according to node's contextConfig
   */
  private async extractVariables(
    output: any,
    node: AgentWorkflowNode,
    context: any
  ): Promise<Record<string, any>> {
    const variables: Record<string, any> = {};

    // In simple mode, store entire output
    if (node.contextConfig.mode === 'simple') {
      // Handle interactive session output (has transcript_file field)
      if (typeof output === 'object' && output !== null && 'interactive' in output) {
        // Interactive session - extract raw_output as main output
        const textOutput = output.raw_output || output.message || 'Interactive session completed';

        variables.output = textOutput;
        variables[`${node.name}_output`] = textOutput;

        // Store transcript file separately
        if ('transcript_file' in output) {
          variables.transcriptFile = output.transcript_file;
          variables[`${node.name}_transcript`] = output.transcript_file;
          logWithCategory('info', LogCategory.WORKFLOW,
            `Interactive session transcript: ${output.transcript_file}`);
        }

        // Also store as outputVariable if specified
        if ((node as any).outputVariable) {
          const varName = (node as any).outputVariable;
          variables[varName] = textOutput;
          logWithCategory('info', LogCategory.WORKFLOW,
            `Custom output variable: ${varName} = [${String(textOutput).substring(0, 50)}...]`);
        }
      } else {
        // Normal output (string or other object)
        variables.output = output;
        variables[`${node.name}_output`] = output;

        // Also store as outputVariable if specified
        if ((node as any).outputVariable) {
          const varName = (node as any).outputVariable;
          variables[varName] = output;
          logWithCategory('info', LogCategory.WORKFLOW,
            `Custom output variable: ${varName} = [${String(output).substring(0, 50)}...]`);
        }
      }

      // Try to parse as JSON if it's a string
      if (typeof output === 'string') {
        try {
          const parsed = JSON.parse(output);
          variables.parsed = parsed;
          variables[`${node.name}_parsed`] = parsed;
        } catch {
          // Not JSON, keep as string
        }
      }
    } else {
      // Advanced mode: use explicit output mapping
      if (node.contextConfig.outputs && node.contextConfig.outputs.length > 0) {
        for (const mapping of node.contextConfig.outputs) {
          const value = this.evaluateMapping(mapping.source, { ...context, output });
          const transformed = mapping.transform
            ? this.applyTransform(value, mapping.transform)
            : value;

          variables[mapping.target] = transformed;
        }
      } else {
        // No output mapping, store entire output
        variables.output = output;
        variables[`${node.name}_output`] = output;
      }
    }

    return variables;
  }

  /**
   * Evaluate a JSONPath or template mapping
   */
  private evaluateMapping(source: string, context: any): any {
    // Handle template syntax: {{variable}}
    if (source.startsWith('{{') && source.endsWith('}}')) {
      const varName = source.slice(2, -2).trim();
      return this.getNestedValue(context, varName);
    }

    // Handle JSONPath syntax: $.path.to.value
    if (source.startsWith('$.')) {
      const path = source.slice(2);
      return this.getNestedValue(context, path);
    }

    // Direct value
    return source;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Apply JavaScript transformation to a value
   */
  private applyTransform(value: any, transform: string): any {
    try {
      // Create a function from the transform string
      // Expected format: "x => x.toUpperCase()"
      const fn = eval(`(${transform})`);
      return fn(value);
    } catch (error: any) {
      logWithCategory('warn', LogCategory.WORKFLOW,
        `Transform failed: ${error.message}, returning original value`);
      return value;
    }
  }

  /**
   * Evaluate gate condition
   */
  private evaluateGateCondition(condition: string, variables: Record<string, any>, context: any): boolean {
    try {
      // Combine variables and context for evaluation
      const evalContext = { ...context, ...variables };

      // Handle JSONPath conditions: $.score >= 70
      if (condition.includes('$.')) {
        return this.evaluateJsonPathCondition(condition, evalContext);
      }

      // Handle simple JavaScript expressions
      // Create a function that evaluates the condition
      const fn = new Function(...Object.keys(evalContext), `return ${condition}`);
      return fn(...Object.values(evalContext));
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Gate condition evaluation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Evaluate JSONPath-based condition
   */
  private evaluateJsonPathCondition(condition: string, context: any): boolean {
    try {
      // Simple JSONPath evaluation (basic implementation)
      // Replace $.path with actual values
      let evaluableCondition = condition;
      const jsonPathRegex = /\$\.[\w.]+/g;
      const matches = condition.match(jsonPathRegex);

      if (matches) {
        for (const match of matches) {
          const path = match.slice(2); // Remove $.
          const value = this.getNestedValue(context, path);
          evaluableCondition = evaluableCondition.replace(match, JSON.stringify(value));
        }
      }

      // Evaluate the condition
      return eval(evaluableCondition);
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `JSONPath condition evaluation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
