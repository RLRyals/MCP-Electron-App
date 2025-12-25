/**
 * Code Execution Executor - Usage Examples
 *
 * This file demonstrates how to use the CodeExecutionExecutor
 * to run JavaScript and Python code in workflow nodes.
 */

import { CodeExecutionExecutor } from './code-execution-executor';
import { CodeExecutionNode } from '../../../types/workflow-nodes';

// Example 1: Simple JavaScript execution with context
async function exampleJavaScriptBasic() {
  const executor = new CodeExecutionExecutor();

  const node: CodeExecutionNode = {
    id: 'js-basic-1',
    name: 'Calculate Total',
    description: 'Sum up array of numbers',
    type: 'code',
    language: 'javascript',
    code: `
      const total = context.numbers.reduce((sum, num) => sum + num, 0);
      console.log('Total:', total);
      return total;
    `,
    sandbox: {
      enabled: true,
      cpuTimeoutMs: 5000,
    },
    position: { x: 0, y: 0 },
    requiresApproval: false,
    contextConfig: {
      mode: 'simple',
    },
  };

  const context = {
    numbers: [1, 2, 3, 4, 5],
  };

  const result = await executor.execute(node, context);

  console.log('Result:', result);
  // Output:
  // {
  //   nodeId: 'js-basic-1',
  //   nodeName: 'Calculate Total',
  //   status: 'success',
  //   output: { stdout: 'Total: 15', stderr: '', returnValue: 15 },
  //   variables: {
  //     result: { stdout: 'Total: 15', stderr: '', returnValue: 15 },
  //     stdout: 'Total: 15',
  //     stderr: ''
  //   }
  // }
}

// Example 2: JavaScript with timeout
async function exampleJavaScriptTimeout() {
  const executor = new CodeExecutionExecutor();

  const node: CodeExecutionNode = {
    id: 'js-timeout-1',
    name: 'Infinite Loop Test',
    description: 'This will timeout',
    type: 'code',
    language: 'javascript',
    code: `
      while(true) {
        // Infinite loop - will be killed by timeout
      }
    `,
    sandbox: {
      enabled: true,
      cpuTimeoutMs: 1000, // 1 second timeout
    },
    position: { x: 0, y: 0 },
    requiresApproval: false,
    contextConfig: {
      mode: 'simple',
    },
  };

  const result = await executor.execute(node, {});

  console.log('Result:', result);
  // Output:
  // {
  //   status: 'failed',
  //   error: 'JavaScript execution timed out after 1000ms'
  // }
}

// Example 3: Python execution
async function examplePythonBasic() {
  const executor = new CodeExecutionExecutor();

  const node: CodeExecutionNode = {
    id: 'py-basic-1',
    name: 'Python Data Processing',
    description: 'Process data with Python',
    type: 'code',
    language: 'python',
    code: `
# Context variables are available directly
print(f"Processing {len(names)} names:")
for name in names:
    print(f"  - {name.upper()}")

# Calculate statistics
print(f"\\nStatistics:")
print(f"  Count: {len(numbers)}")
print(f"  Sum: {sum(numbers)}")
print(f"  Average: {sum(numbers) / len(numbers)}")
    `,
    sandbox: {
      enabled: true,
      cpuTimeoutMs: 5000,
    },
    position: { x: 0, y: 0 },
    requiresApproval: false,
    contextConfig: {
      mode: 'simple',
    },
  };

  const context = {
    names: ['Alice', 'Bob', 'Charlie'],
    numbers: [10, 20, 30, 40, 50],
  };

  const result = await executor.execute(node, context);

  console.log('Result:', result);
  // Output will include stdout with the printed output
}

// Example 4: JavaScript with module whitelisting
async function exampleJavaScriptWithModules() {
  const executor = new CodeExecutionExecutor();

  const node: CodeExecutionNode = {
    id: 'js-modules-1',
    name: 'Use Lodash',
    description: 'Process data with lodash',
    type: 'code',
    language: 'javascript',
    code: `
      // This would normally be blocked, but lodash is whitelisted
      const _ = require('lodash');
      const grouped = _.groupBy(context.items, 'category');
      return grouped;
    `,
    sandbox: {
      enabled: true,
      allowedModules: ['lodash'], // Whitelist lodash
      cpuTimeoutMs: 5000,
    },
    position: { x: 0, y: 0 },
    requiresApproval: false,
    contextConfig: {
      mode: 'simple',
    },
  };

  const context = {
    items: [
      { name: 'Apple', category: 'fruit' },
      { name: 'Carrot', category: 'vegetable' },
      { name: 'Banana', category: 'fruit' },
    ],
  };

  const result = await executor.execute(node, context);

  console.log('Result:', result);
}

// Example 5: Security validation - blocked code
async function exampleBlockedCode() {
  const executor = new CodeExecutionExecutor();

  const node: CodeExecutionNode = {
    id: 'js-blocked-1',
    name: 'Dangerous Code',
    description: 'This will be blocked by security validation',
    type: 'code',
    language: 'javascript',
    code: `
      // This will be blocked - trying to use eval
      eval('console.log("hacked")');
    `,
    sandbox: {
      enabled: true, // Sandbox enabled = security checks active
      cpuTimeoutMs: 5000,
    },
    position: { x: 0, y: 0 },
    requiresApproval: false,
    contextConfig: {
      mode: 'simple',
    },
  };

  const result = await executor.execute(node, {});

  console.log('Result:', result);
  // Output:
  // {
  //   status: 'failed',
  //   error: 'Code contains potentially dangerous pattern: /eval\\s*\\(/i'
  // }
}

// Example 6: Disable sandbox (DANGEROUS - only for trusted code)
async function exampleNoSandbox() {
  const executor = new CodeExecutionExecutor();

  const node: CodeExecutionNode = {
    id: 'js-nosandbox-1',
    name: 'Trusted Code',
    description: 'Run without sandbox (be careful!)',
    type: 'code',
    language: 'javascript',
    code: `
      // With sandbox disabled, all features available
      // But this is DANGEROUS if code is not trusted!
      return context.value * 2;
    `,
    sandbox: {
      enabled: false, // DANGEROUS!
    },
    position: { x: 0, y: 0 },
    requiresApproval: false,
    contextConfig: {
      mode: 'simple',
    },
  };

  const context = {
    value: 42,
  };

  const result = await executor.execute(node, context);

  console.log('Result:', result);
}

// Run examples (uncomment to test)
// exampleJavaScriptBasic();
// exampleJavaScriptTimeout();
// examplePythonBasic();
// exampleJavaScriptWithModules();
// exampleBlockedCode();
// exampleNoSandbox();
