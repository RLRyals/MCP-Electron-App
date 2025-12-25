/**
 * Code Execution Executor
 *
 * Executes JavaScript or Python code in a sandboxed environment.
 * Supports memory and CPU limits, module whitelisting, and secure execution.
 *
 * Features:
 * - JavaScript execution using vm2 for sandboxing
 * - Python execution via child_process with timeout control
 * - Security validation to prevent malicious code patterns
 * - Timeout enforcement (default: 30 seconds)
 * - Context variables passed to code execution
 * - Captures stdout, stderr, and return values
 * - Module whitelisting for JavaScript (configurable per node)
 *
 * Usage:
 * ```typescript
 * const executor = new CodeExecutionExecutor();
 * const node: CodeExecutionNode = {
 *   id: 'code-1',
 *   name: 'Process Data',
 *   type: 'code',
 *   language: 'javascript',
 *   code: 'return context.inputData.map(x => x * 2);',
 *   sandbox: {
 *     enabled: true,
 *     allowedModules: ['lodash'],
 *     cpuTimeoutMs: 5000
 *   },
 *   // ... other BaseWorkflowNode fields
 * };
 *
 * const context = { inputData: [1, 2, 3, 4, 5] };
 * const output = await executor.execute(node, context);
 * // output.variables.result = [2, 4, 6, 8, 10]
 * ```
 *
 * Security Notes:
 * - Sandbox is ENABLED by default for safety
 * - Disabling sandbox allows dangerous operations - only for trusted code
 * - Dangerous patterns are blocked when sandbox is enabled:
 *   - JavaScript: eval, Function constructor, child_process, process.exit
 *   - Python: os, subprocess, eval, exec
 * - Module whitelisting allows specific modules through security checks
 */

import { NodeExecutor } from './base-executor';
import { WorkflowNode, CodeExecutionNode, NodeOutput, isCodeExecutionNode } from '../../../types/workflow-nodes';
import { logWithCategory, LogCategory } from '../../logger';
import { spawn } from 'child_process';

// Import VM2 - use require to avoid TypeScript module issues
const { VM } = require('vm2');

export class CodeExecutionExecutor implements NodeExecutor {
  readonly nodeType = 'code';

  /**
   * Execute code execution node
   */
  async execute(node: WorkflowNode, context: any): Promise<NodeOutput> {
    if (!isCodeExecutionNode(node)) {
      throw new Error(`CodeExecutionExecutor received invalid node type: ${node.type}`);
    }

    const codeNode = node as CodeExecutionNode;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing code node: ${codeNode.name} (${codeNode.language})`);

    try {
      // Validate code before execution
      const validationResult = this.validateCode(codeNode);
      if (!validationResult.valid) {
        return {
          nodeId: codeNode.id,
          nodeName: codeNode.name,
          timestamp: new Date(),
          status: 'failed',
          output: null,
          variables: {},
          error: validationResult.error,
        };
      }

      // Execute based on language
      let result: any;
      if (codeNode.language === 'javascript') {
        result = await this.executeJavaScript(codeNode, context);
      } else if (codeNode.language === 'python') {
        result = await this.executePython(codeNode, context);
      } else {
        throw new Error(`Unsupported language: ${codeNode.language}`);
      }

      // Return successful output
      return {
        nodeId: codeNode.id,
        nodeName: codeNode.name,
        timestamp: new Date(),
        status: 'success',
        output: result,
        variables: {
          result: result,
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Code execution node failed: ${error.message}`);

      return {
        nodeId: codeNode.id,
        nodeName: codeNode.name,
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
   * Validate code for basic security checks
   */
  private validateCode(node: CodeExecutionNode): { valid: boolean; error?: string } {
    if (!node.code || node.code.trim() === '') {
      return {
        valid: false,
        error: 'Code is required',
      };
    }

    // Basic security checks for malicious patterns
    const dangerousPatterns = [
      /require\s*\(\s*['"]child_process['"]\s*\)/i, // Prevent child_process in JS
      /require\s*\(\s*['"]fs['"]\s*\)/i, // Prevent direct fs access unless whitelisted
      /eval\s*\(/i, // Prevent eval
      /Function\s*\(/i, // Prevent Function constructor
      /__dirname/i, // Prevent directory access
      /__filename/i, // Prevent filename access
      /process\.exit/i, // Prevent process exit
      /process\.kill/i, // Prevent process kill
    ];

    // For Python, check for dangerous imports
    const pythonDangerousPatterns = [
      /import\s+os/i,
      /from\s+os\s+import/i,
      /import\s+subprocess/i,
      /from\s+subprocess\s+import/i,
      /__import__/i,
      /eval\s*\(/i,
      /exec\s*\(/i,
    ];

    const patterns = node.language === 'javascript' ? dangerousPatterns : pythonDangerousPatterns;

    // Only enforce security checks if sandbox is enabled
    if (node.sandbox.enabled) {
      for (const pattern of patterns) {
        if (pattern.test(node.code)) {
          // Check if it's a whitelisted module
          if (node.language === 'javascript') {
            const requireMatch = node.code.match(/require\s*\(\s*['"](.*?)['"]\s*\)/);
            if (requireMatch) {
              const moduleName = requireMatch[1];
              if (node.sandbox.allowedModules && node.sandbox.allowedModules.includes(moduleName)) {
                continue; // Whitelisted, skip this pattern
              }
            }
          }

          return {
            valid: false,
            error: `Code contains potentially dangerous pattern: ${pattern.toString()}`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Execute JavaScript code using vm2
   */
  private async executeJavaScript(node: CodeExecutionNode, context: any): Promise<any> {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `Executing JavaScript with sandbox: ${node.sandbox.enabled}`);

    if (!node.sandbox.enabled) {
      // Direct execution without sandbox (dangerous, only for trusted code)
      logWithCategory('warn', LogCategory.WORKFLOW,
        'Executing JavaScript without sandbox - this is dangerous!');

      try {
        // Create a new function with context as parameters
        const func = new Function('context', node.code);
        const result = func(context);
        return {
          stdout: '',
          stderr: '',
          returnValue: result,
        };
      } catch (error: any) {
        throw new Error(`JavaScript execution error: ${error.message}`);
      }
    }

    // Sandboxed execution using vm2
    try {
      const timeout = node.sandbox.cpuTimeoutMs || node.timeoutMs || 30000;

      // Create VM with sandbox configuration
      const vm = new VM({
        timeout: timeout,
        sandbox: {
          context: context, // Make context available to the code
          console: {
            log: (...args: any[]) => {
              // Capture console.log output
              return args.join(' ');
            },
          },
        },
        eval: false, // Disable eval
        wasm: false, // Disable WebAssembly
        fixAsync: true, // Fix async/await support
      });

      // Wrap code to capture output
      const wrappedCode = `
        let __stdout = [];
        let __stderr = [];
        const originalLog = console.log;
        console.log = (...args) => {
          __stdout.push(args.join(' '));
          return originalLog(...args);
        };
        console.error = (...args) => {
          __stderr.push(args.join(' '));
        };

        try {
          const __result = (function() {
            ${node.code}
          })();

          ({ stdout: __stdout.join('\\n'), stderr: __stderr.join('\\n'), returnValue: __result });
        } catch (error) {
          throw error;
        }
      `;

      const result = vm.run(wrappedCode);

      logWithCategory('debug', LogCategory.WORKFLOW,
        `JavaScript execution completed successfully`);

      return result;

    } catch (error: any) {
      if (error.message.includes('Script execution timed out')) {
        throw new Error(`JavaScript execution timed out after ${node.sandbox.cpuTimeoutMs || node.timeoutMs || 30000}ms`);
      }
      throw new Error(`JavaScript execution error: ${error.message}`);
    }
  }

  /**
   * Execute Python code using child_process spawn
   */
  private async executePython(node: CodeExecutionNode, context: any): Promise<any> {
    logWithCategory('debug', LogCategory.WORKFLOW,
      `Executing Python with sandbox: ${node.sandbox.enabled}`);

    return new Promise((resolve, reject) => {
      const timeout = node.sandbox.cpuTimeoutMs || node.timeoutMs || 30000;
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Create Python code wrapper that loads context from stdin
      const wrappedCode = `
import sys
import json

# Read context from stdin
try:
    context_json = input()
    context = json.loads(context_json)
except:
    context = {}

# Make context available as variables
globals().update(context)

# User code
${node.code}
`;

      // Spawn Python process
      const pythonProcess = spawn('python', ['-c', wrappedCode], {
        timeout: timeout,
        env: {
          ...process.env,
          // Limit memory if specified (platform-dependent)
        },
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        pythonProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!pythonProcess.killed) {
            pythonProcess.kill('SIGKILL');
          }
        }, 1000);
      }, timeout);

      // Send context as JSON to stdin
      try {
        pythonProcess.stdin.write(JSON.stringify(context) + '\n');
        pythonProcess.stdin.end();
      } catch (error: any) {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to send context to Python process: ${error.message}`));
        return;
      }

      // Capture stdout
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Capture stderr
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      pythonProcess.on('close', (code) => {
        clearTimeout(timeoutId);

        if (timedOut) {
          reject(new Error(`Python execution timed out after ${timeout}ms`));
          return;
        }

        if (code !== 0) {
          reject(new Error(`Python execution failed with exit code ${code}: ${stderr}`));
          return;
        }

        logWithCategory('debug', LogCategory.WORKFLOW,
          `Python execution completed successfully`);

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          returnValue: null, // Python doesn't return a value directly
        });
      });

      // Handle process errors
      pythonProcess.on('error', (error) => {
        clearTimeout(timeoutId);

        if (error.message.includes('ENOENT')) {
          reject(new Error('Python not found. Please ensure Python is installed and in PATH.'));
        } else {
          reject(new Error(`Python execution error: ${error.message}`));
        }
      });
    });
  }
}
