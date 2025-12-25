/**
 * User Input Executor Tests
 *
 * Tests for user input validation, default values, and error handling.
 */

import { UserInputExecutor } from '../user-input-executor';
import { UserInputNode } from '../../../../types/workflow-nodes';

describe('UserInputExecutor', () => {
  let executor: UserInputExecutor;

  beforeEach(() => {
    executor = new UserInputExecutor();
  });

  describe('execute', () => {
    it('should execute successfully with default value', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get User Input',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter your name',
        inputType: 'text',
        required: false,
        defaultValue: 'John Doe',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.output).toBe('John Doe');
      expect(result.variables.userInput).toBe('John Doe');
    });

    it('should fail when no default value and IPC not implemented', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get User Input',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter your name',
        inputType: 'text',
        required: true,
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('IPC integration');
    });
  });

  describe('validation - text input', () => {
    it('should validate required field', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get User Input',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter your name',
        inputType: 'text',
        required: true,
        defaultValue: '',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('This field is required');
    });

    it('should pass validation for optional empty field', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get User Input',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter your name',
        inputType: 'text',
        required: false,
        defaultValue: '',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
    });

    it('should validate minimum length', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get User Input',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter your name',
        inputType: 'text',
        required: true,
        defaultValue: 'Jo',
        validation: {
          minLength: 3,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('at least 3 characters');
    });

    it('should validate maximum length', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get User Input',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter your name',
        inputType: 'text',
        required: true,
        defaultValue: 'This is a very long name that exceeds the maximum',
        validation: {
          maxLength: 10,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('at most 10 characters');
    });

    it('should validate pattern', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get Email',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter your email',
        inputType: 'text',
        required: true,
        defaultValue: 'invalid-email',
        validation: {
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('does not match required pattern');
    });

    it('should pass validation with valid pattern', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get Email',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter your email',
        inputType: 'text',
        required: true,
        defaultValue: 'test@example.com',
        validation: {
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.output).toBe('test@example.com');
    });
  });

  describe('validation - number input', () => {
    it('should validate number type', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get Number',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter a number',
        inputType: 'number',
        required: true,
        defaultValue: 'not-a-number',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Invalid number');
    });

    it('should validate minimum value', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get Number',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter a number',
        inputType: 'number',
        required: true,
        defaultValue: 5,
        validation: {
          min: 10,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('at least 10');
    });

    it('should validate maximum value', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get Number',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter a number',
        inputType: 'number',
        required: true,
        defaultValue: 100,
        validation: {
          max: 50,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('at most 50');
    });

    it('should pass validation with valid number', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get Number',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter a number',
        inputType: 'number',
        required: true,
        defaultValue: 42,
        validation: {
          min: 1,
          max: 100,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.output).toBe(42);
    });
  });

  describe('validation - select input', () => {
    it('should validate select options', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Select Option',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Select an option',
        inputType: 'select',
        required: true,
        defaultValue: 'invalid',
        options: [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' },
        ],
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Invalid selection');
    });

    it('should pass validation with valid selection', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Select Option',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Select an option',
        inputType: 'select',
        required: true,
        defaultValue: 'opt1',
        options: [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' },
        ],
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.output).toBe('opt1');
    });

    it('should fail when options not defined', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Select Option',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Select an option',
        inputType: 'select',
        required: true,
        defaultValue: 'opt1',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('No options defined');
    });
  });

  describe('validation - textarea input', () => {
    it('should validate textarea length', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get Text',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter text',
        inputType: 'textarea',
        required: true,
        defaultValue: 'Short',
        validation: {
          minLength: 20,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('at least 20 characters');
    });

    it('should pass validation with valid textarea', async () => {
      const node: UserInputNode = {
        id: 'input-1',
        name: 'Get Text',
        description: 'Test input',
        type: 'user-input',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        prompt: 'Enter text',
        inputType: 'textarea',
        required: true,
        defaultValue: 'This is a long enough text that should pass validation',
        validation: {
          minLength: 20,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
    });
  });

  describe('error handling', () => {
    it('should handle invalid node type', async () => {
      const node = {
        id: 'input-1',
        name: 'Invalid Node',
        type: 'invalid-type',
      } as any;

      const context = { projectFolder: '/test' };

      await expect(executor.execute(node, context)).rejects.toThrow(
        'UserInputExecutor received invalid node type'
      );
    });
  });
});
