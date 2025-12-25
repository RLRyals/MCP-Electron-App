/**
 * User Input Executor
 *
 * Prompts the user for input during workflow execution.
 * This is especially useful for capturing the initial book/series idea.
 */

import { NodeExecutor } from './base-executor';
import { WorkflowNode, UserInputNode, NodeOutput, isUserInputNode } from '../../../types/workflow-nodes';
import { logWithCategory, LogCategory } from '../../logger';

export class UserInputExecutor implements NodeExecutor {
  readonly nodeType = 'user-input';

  /**
   * Execute user input node
   * Emits event to renderer to prompt user for input
   */
  async execute(node: WorkflowNode, context: any): Promise<NodeOutput> {
    if (!isUserInputNode(node)) {
      throw new Error(`UserInputExecutor received invalid node type: ${node.type}`);
    }

    const inputNode = node as UserInputNode;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing user input node: ${inputNode.name}`);

    try {
      // Keep prompting until we get valid input
      let userInput: any;
      let validationError: string | undefined;
      let attempts = 0;
      const maxAttempts = 10; // Prevent infinite loop

      while (attempts < maxAttempts) {
        attempts++;

        // Prompt user for input
        userInput = await this.promptUser(inputNode, context, validationError);

        // Validate input
        const validationResult = this.validateInput(userInput, inputNode);

        if (validationResult.valid) {
          // Valid input - break out of loop
          break;
        } else {
          // Invalid input - set error message and re-prompt
          validationError = validationResult.error;
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Invalid input for ${inputNode.name}: ${validationError}. Re-prompting...`);
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error(`Maximum validation attempts (${maxAttempts}) exceeded`);
      }

      // Return successful output
      return {
        nodeId: inputNode.id,
        nodeName: inputNode.name,
        timestamp: new Date(),
        status: 'success',
        output: userInput,
        variables: {
          userInput: userInput,
        },
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `User input node failed: ${error.message}`);

      return {
        nodeId: inputNode.id,
        nodeName: inputNode.name,
        timestamp: new Date(),
        status: 'failed',
        output: null,
        variables: {},
        error: error.message,
      };
    }
  }

  /**
   * Prompt user for input via IPC event and promise queue
   */
  private async promptUser(node: UserInputNode, context: any, validationError?: string): Promise<any> {
    // Generate unique request ID
    const requestId = `${context.instanceId}-${node.id}-${Date.now()}`;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Requesting user input: ${node.name} (${requestId})${validationError ? ' [retry after validation error]' : ''}`);

    // Emit event to renderer requesting user input
    if (context.eventEmitter) {
      context.eventEmitter.emit('workflow:user-input-required', {
        instanceId: context.instanceId,
        requestId: requestId,
        nodeId: node.id,
        nodeName: node.name,
        prompt: node.prompt,
        inputType: node.inputType,
        required: node.required,
        validation: node.validation,
        options: node.options,
        defaultValue: node.defaultValue,
        validationError: validationError // Include validation error from previous attempt
      });
    } else {
      logWithCategory('warn', LogCategory.WORKFLOW,
        'No eventEmitter in context - cannot notify renderer');
    }

    // Create promise that will be resolved when user provides input
    return new Promise((resolve, reject) => {
      if (context.userInputQueue) {
        context.userInputQueue.set(requestId, {
          nodeId: node.id,
          resolve,
          reject
        });

        logWithCategory('info', LogCategory.WORKFLOW,
          `Waiting for user input: ${node.name} (${requestId})`);
      } else {
        reject(new Error('User input queue not available in context'));
      }
    });
  }

  /**
   * Validate user input according to node configuration
   */
  private validateInput(input: any, node: UserInputNode): { valid: boolean; error?: string } {
    // Check required
    if (node.required && (input === null || input === undefined || input === '')) {
      return {
        valid: false,
        error: 'This field is required',
      };
    }

    // Skip validation if input is empty and not required
    if (!node.required && (input === null || input === undefined || input === '')) {
      return { valid: true };
    }

    // Type-specific validation
    if (node.inputType === 'number') {
      const num = Number(input);
      if (isNaN(num)) {
        return {
          valid: false,
          error: 'Invalid number',
        };
      }

      if (node.validation?.min !== undefined && num < node.validation.min) {
        return {
          valid: false,
          error: `Value must be at least ${node.validation.min}`,
        };
      }

      if (node.validation?.max !== undefined && num > node.validation.max) {
        return {
          valid: false,
          error: `Value must be at most ${node.validation.max}`,
        };
      }
    }

    // String validation
    if (node.inputType === 'text' || node.inputType === 'textarea') {
      const str = String(input);

      if (node.validation?.minLength !== undefined && str.length < node.validation.minLength) {
        return {
          valid: false,
          error: `Must be at least ${node.validation.minLength} characters`,
        };
      }

      if (node.validation?.maxLength !== undefined && str.length > node.validation.maxLength) {
        return {
          valid: false,
          error: `Must be at most ${node.validation.maxLength} characters`,
        };
      }

      if (node.validation?.pattern) {
        const regex = new RegExp(node.validation.pattern);
        if (!regex.test(str)) {
          return {
            valid: false,
            error: 'Input does not match required pattern',
          };
        }
      }
    }

    // Select validation
    if (node.inputType === 'select') {
      if (!node.options) {
        return {
          valid: false,
          error: 'No options defined for select input',
        };
      }

      const validValues = node.options.map(opt => opt.value);
      if (!validValues.includes(String(input))) {
        return {
          valid: false,
          error: 'Invalid selection',
        };
      }
    }

    return { valid: true };
  }
}
