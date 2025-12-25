/**
 * Code Execution Executor Tests
 *
 * Tests for JavaScript and Python code execution, sandboxing,
 * security validation, and timeout handling.
 */

import { CodeExecutionExecutor } from '../code-execution-executor';
import { CodeExecutionNode } from '../../../../types/workflow-nodes';

// Mock child_process for Python tests
jest.mock('child_process', () => {
  const EventEmitter = require('events');

  return {
    spawn: jest.fn((command, args, options) => {
      const mockProcess = new EventEmitter();
      mockProcess.stdin = {
        write: jest.fn(),
        end: jest.fn(),
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      mockProcess.killed = false;

      // Store for test access
      (mockProcess as any).command = command;
      (mockProcess as any).args = args;

      // Simulate process execution
      setTimeout(() => {
        const code = args[1]; // Python code is in args[1]

        // Check for test conditions in code
        if (code.includes('print("Hello from Python")')) {
          mockProcess.stdout.emit('data', Buffer.from('Hello from Python\n'));
          mockProcess.emit('close', 0);
        } else if (code.includes('import sys')) {
          mockProcess.stdout.emit('data', Buffer.from('Test output\n'));
          mockProcess.emit('close', 0);
        } else if (code.includes('raise Exception')) {
          mockProcess.stderr.emit('data', Buffer.from('Error: Test exception\n'));
          mockProcess.emit('close', 1);
        } else {
          mockProcess.emit('close', 0);
        }
      }, 10);

      return mockProcess;
    }),
  };
});

describe('CodeExecutionExecutor', () => {
  let executor: CodeExecutionExecutor;

  beforeEach(() => {
    executor = new CodeExecutionExecutor();
    jest.clearAllMocks();
  });

  describe('JavaScript execution - sandboxed', () => {
    it('should execute simple JavaScript code', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'return 2 + 2;',
        sandbox: {
          enabled: true,
          cpuTimeoutMs: 5000,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.result.returnValue).toBe(4);
    });

    it('should provide context to JavaScript code', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'return context.value * 2;',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test', value: 21 };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.result.returnValue).toBe(42);
    });

    it('should capture console.log output', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'console.log("Hello, World!"); return 42;',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.stdout).toContain('Hello, World!');
    });

    it('should handle array operations', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'return context.numbers.map(x => x * 2);',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test', numbers: [1, 2, 3, 4, 5] };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.result.returnValue).toEqual([2, 4, 6, 8, 10]);
    });

    it('should handle object operations', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'return { result: context.a + context.b, operation: "add" };',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test', a: 10, b: 32 };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.result.returnValue).toEqual({ result: 42, operation: 'add' });
    });

    it('should handle errors gracefully', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'throw new Error("Test error");',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Test error');
    });
  });

  describe('JavaScript execution - unsandboxed', () => {
    it('should execute without sandbox when disabled', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'return context.value + 10;',
        sandbox: {
          enabled: false,
        },
      };

      const context = { projectFolder: '/test', value: 32 };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.result.returnValue).toBe(42);
    });

    it('should handle errors in unsandboxed mode', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'invalid javascript syntax {{{',
        sandbox: {
          enabled: false,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('JavaScript execution error');
    });
  });

  describe('Python execution', () => {
    it('should execute simple Python code', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'python',
        code: 'print("Hello from Python")',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.stdout).toContain('Hello from Python');
    });

    it('should provide context to Python code', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'python',
        code: 'import sys\nprint("Test output")',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test', value: 42 };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
    });

    it('should handle Python errors', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'python',
        code: 'raise Exception("Test exception")',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('exit code 1');
    });
  });

  describe('security validation', () => {
    it('should block child_process in JavaScript', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'const cp = require("child_process"); return cp.execSync("ls");',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('dangerous pattern');
    });

    it('should block eval in JavaScript', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'return eval("2 + 2");',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('dangerous pattern');
    });

    it('should block Function constructor in JavaScript', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'return new Function("return 2 + 2")();',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('dangerous pattern');
    });

    it('should block process.exit in JavaScript', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'process.exit(1);',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('dangerous pattern');
    });

    it('should block os module in Python', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'python',
        code: 'import os\nos.system("ls")',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('dangerous pattern');
    });

    it('should block subprocess in Python', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'python',
        code: 'import subprocess\nsubprocess.run(["ls"])',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('dangerous pattern');
    });

    it('should block eval in Python', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'python',
        code: 'eval("print(2 + 2)")',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('dangerous pattern');
    });

    it('should allow whitelisted modules', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'const fs = require("fs"); return "allowed";',
        sandbox: {
          enabled: true,
          allowedModules: ['fs'],
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      // Should not fail on security validation (but may fail on actual execution)
      expect(result.error).not.toContain('dangerous pattern');
    });

    it('should skip security checks when sandbox disabled', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: 'return "allowed";',
        sandbox: {
          enabled: false,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
    });
  });

  describe('validation', () => {
    it('should fail when code is empty', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'javascript',
        code: '',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Code is required');
    });

    it('should fail for unsupported language', async () => {
      const node: CodeExecutionNode = {
        id: 'code-1',
        name: 'Execute Code',
        description: 'Test code',
        type: 'code',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        language: 'ruby' as any,
        code: 'puts "Hello"',
        sandbox: {
          enabled: true,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Unsupported language');
    });
  });

  describe('error handling', () => {
    it('should handle invalid node type', async () => {
      const node = {
        id: 'code-1',
        name: 'Invalid Node',
        type: 'invalid-type',
      } as any;

      const context = { projectFolder: '/test' };

      await expect(executor.execute(node, context)).rejects.toThrow(
        'CodeExecutionExecutor received invalid node type'
      );
    });
  });
});
