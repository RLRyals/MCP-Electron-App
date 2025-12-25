# Workflow Node Executors

## Overview

Node executors are the core execution units of the FictionLab workflow system. Each executor is responsible for running a specific type of workflow node and returning structured output.

## Executor Architecture

### Base Executor Interface

All executors must implement the `NodeExecutor` interface:

```typescript
export interface NodeExecutor {
  /**
   * Execute a workflow node with the given context
   */
  execute(node: WorkflowNode, context: any): Promise<NodeOutput>;

  /**
   * Node type this executor handles
   */
  readonly nodeType: string;
}
```

### NodeOutput Structure

```typescript
interface NodeOutput {
  nodeId: string;           // Node that produced this output
  nodeName: string;         // Human-readable node name
  timestamp: Date;          // When execution completed
  status: 'success' | 'failed' | 'skipped';
  output: any;              // Node-specific output data
  variables: Record<string, any>;  // Extracted variables for context
  error?: string;           // Error message if failed
  metadata?: any;           // Executor-specific metadata
}
```

## Built-in Executors

### 1. Agent Node Executor

**File**: `agent-node-executor.ts`
**Node Types**: `planning`, `writing`, `gate`

Executes AI agent nodes using the LLM Provider system.

**Configuration**:
```typescript
interface AgentWorkflowNode {
  type: 'planning' | 'writing' | 'gate';
  agentName: string;        // Which agent to use
  skillName?: string;       // Optional skill
  provider: LLMProviderConfig;  // LLM provider
  gateConfig?: {            // For gate nodes
    condition: string;
    passMessage: string;
    failMessage: string;
  };
}
```

**Example**:
```typescript
const node: AgentWorkflowNode = {
  id: 'phase1',
  type: 'planning',
  name: 'Market Research',
  agentName: 'series-architect',
  skillName: 'market-research',
  provider: {
    type: 'claude-api',
    name: 'Claude for Planning',
    config: { model: 'claude-sonnet-4-5', /* ... */ },
  },
};

const output = await executor.execute(node, context);
// output.variables.plan = "Urban fantasy series targeting..."
```

**Output Variables**:
- `output` - Full agent response
- `agentName` - Which agent executed
- `skillName` - Which skill was used (if any)

### 2. User Input Executor

**File**: `user-input-executor.ts`
**Node Type**: `user-input`

Prompts the user for input during workflow execution.

**Configuration**:
```typescript
interface UserInputNode {
  type: 'user-input';
  prompt: string;           // What to ask the user
  inputType: 'text' | 'textarea' | 'number' | 'select';
  required: boolean;
  validation?: {
    pattern?: string;       // Regex pattern
    minLength?: number;
    maxLength?: number;
    min?: number;          // For numbers
    max?: number;
  };
  options?: Array<{        // For select type
    label: string;
    value: string;
  }>;
  defaultValue?: string | number;
}
```

**Example**:
```typescript
const node: UserInputNode = {
  id: 'user-idea',
  type: 'user-input',
  name: 'Capture Book Idea',
  prompt: 'What is your book/series idea?',
  inputType: 'textarea',
  required: true,
  validation: {
    minLength: 50,
    maxLength: 2000,
  },
};

const output = await executor.execute(node, context);
// output.variables.userInput = "A detective who can see ghosts..."
```

**Output Variables**:
- `userInput` - The user's input value

**Validation**:
- Required fields
- Min/max length (text)
- Min/max value (numbers)
- Regex pattern matching
- Select option validation

### 3. Code Execution Executor

**File**: `code-execution-executor.ts`
**Node Type**: `code`

Executes JavaScript or Python code in a sandboxed environment.

**Configuration**:
```typescript
interface CodeExecutionNode {
  type: 'code';
  language: 'javascript' | 'python';
  code: string;
  sandbox: {
    enabled: boolean;
    allowedModules?: string[];  // Whitelist of Node.js modules
    timeout?: number;           // Execution timeout (ms)
    memoryLimit?: number;       // Memory limit (MB)
  };
}
```

**JavaScript Example**:
```typescript
const node: CodeExecutionNode = {
  id: 'process-data',
  type: 'code',
  name: 'Process Market Data',
  language: 'javascript',
  code: `
    const trends = context.previousOutputs.phase1.trendingTropes;
    const top3 = trends.slice(0, 3);
    return { topTrends: top3 };
  `,
  sandbox: {
    enabled: true,
    allowedModules: ['lodash', 'date-fns'],
    timeout: 5000,
  },
};

const output = await executor.execute(node, context);
// output.variables.topTrends = ["slow burn romance", "found family", "chosen one"]
```

**Python Example**:
```typescript
const node: CodeExecutionNode = {
  id: 'analyze-sentiment',
  type: 'code',
  language: 'python',
  code: `
import json
data = json.loads(context_json)
text = data['previousOutputs']['phase2']['output']
# Sentiment analysis code...
result = {"sentiment": "positive", "score": 0.85}
print(json.dumps(result))
  `,
  sandbox: { enabled: true, timeout: 10000 },
};
```

**Security**:
- JavaScript: Uses `vm2` for sandboxing
- Python: Subprocess execution with timeout
- Module whitelisting (JavaScript)
- Dangerous pattern detection (eval, exec, etc.)
- Memory and CPU limits

**Output Variables**:
- JavaScript: Returned object properties
- Python: JSON.parse of stdout

### 4. HTTP Request Executor

**File**: `http-request-executor.ts`
**Node Type**: `http`

Makes HTTP/API requests with authentication support.

**Configuration**:
```typescript
interface HttpRequestNode {
  type: 'http';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;              // Supports {{variable}} substitution
  headers?: Record<string, string>;
  body?: any;               // For POST/PUT/PATCH
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'api-key';
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    headerName?: string;   // For api-key type
  };
  retry?: {
    maxAttempts: number;
    delay: number;
    backoffMultiplier: number;
  };
}
```

**Example**:
```typescript
const node: HttpRequestNode = {
  id: 'fetch-tropes',
  type: 'http',
  name: 'Fetch Trending Tropes',
  method: 'GET',
  url: 'https://api.booktrends.com/tropes?genre={{genre}}',
  headers: {
    'Accept': 'application/json',
  },
  auth: {
    type: 'bearer',
    token: '{{apiToken}}',
  },
  retry: {
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2,
  },
};

const output = await executor.execute(node, context);
// output.variables.response = { tropes: [...], trending: [...] }
```

**Variable Substitution**:
```typescript
// URL: "https://api.example.com/books/{{bookId}}/chapters/{{chapterId}}"
// Body: { "title": "{{chapterTitle}}", "content": "{{content}}" }

// Variables replaced from context:
// {{bookId}} -> context.variables.bookId
// {{chapterTitle}} -> context.variables.chapterTitle
```

**Output Variables**:
- `response` - Parsed response body
- `statusCode` - HTTP status code
- `headers` - Response headers

### 5. File Operation Executor

**File**: `file-operation-executor.ts`
**Node Type**: `file`

Performs file system operations with safety restrictions.

**Configuration**:
```typescript
interface FileOperationNode {
  type: 'file';
  operation: 'read' | 'write' | 'copy' | 'move' | 'delete' | 'exists';
  path: string;             // Supports {{variable}} substitution
  destinationPath?: string; // For copy/move
  content?: string;         // For write (supports {{variable}})
  encoding?: string;        // Default: 'utf8'
  createDirectories?: boolean;  // Create parent dirs if missing
  overwrite?: boolean;      // Overwrite existing files
  restrictToProjectFolder?: boolean;  // Safety: restrict to project folder
}
```

**Read Example**:
```typescript
const node: FileOperationNode = {
  id: 'read-template',
  type: 'file',
  name: 'Read Chapter Template',
  operation: 'read',
  path: '{{projectFolder}}/templates/chapter-template.md',
  encoding: 'utf8',
};

const output = await executor.execute(node, context);
// output.variables.content = "# Chapter {{chapterNumber}}\n\n..."
```

**Write Example**:
```typescript
const node: FileOperationNode = {
  id: 'save-chapter',
  type: 'file',
  name: 'Save Chapter 1',
  operation: 'write',
  path: '{{projectFolder}}/book1/chapter1.md',
  content: '{{chapterContent}}',
  createDirectories: true,
  overwrite: true,
  restrictToProjectFolder: true,
};
```

**Copy/Move Example**:
```typescript
const node: FileOperationNode = {
  id: 'backup-chapter',
  type: 'file',
  operation: 'copy',
  path: '{{projectFolder}}/book1/chapter1.md',
  destinationPath: '{{projectFolder}}/backups/chapter1-{{timestamp}}.md',
};
```

**Security**:
- Path traversal attack prevention (`../` blocked)
- Optional project folder restriction
- Validation of absolute/relative paths
- Permission checks before operations

**Output Variables**:
- `read`: `content` - File contents
- `write`: `path` - Written file path
- `copy/move`: `sourcePath`, `destinationPath`
- `delete`: `deletedPath`
- `exists`: `exists` (boolean), `path`

### 6. Conditional Executor

**File**: `conditional-executor.ts`
**Node Type**: `conditional`

Evaluates conditions and routes workflow execution.

**Configuration**:
```typescript
interface ConditionalNode {
  type: 'conditional';
  conditions: Array<{
    expression: string;     // JSONPath or JavaScript
    nextNodeId: string;    // Where to go if true
    label?: string;        // Description (e.g., "Pass", "Fail")
  }>;
  defaultNextNodeId?: string;  // Fallback if no condition matches
  evaluationType: 'jsonpath' | 'javascript';
}
```

**JSONPath Example**:
```typescript
const node: ConditionalNode = {
  id: 'gate',
  type: 'conditional',
  name: 'Quality Gate',
  evaluationType: 'jsonpath',
  conditions: [
    {
      expression: '$.score >= 80',
      nextNodeId: 'phase3',
      label: 'Pass',
    },
    {
      expression: '$.score < 80',
      nextNodeId: 'phase2-revise',
      label: 'Needs Revision',
    },
  ],
};

const output = await executor.execute(node, context);
// output.variables.nextNodeId = 'phase3'
// output.variables.conditionResult = true
// output.variables.conditionLabel = 'Pass'
```

**JavaScript Example**:
```typescript
const node: ConditionalNode = {
  id: 'complex-gate',
  type: 'conditional',
  evaluationType: 'javascript',
  conditions: [
    {
      expression: `
        const score = context.previousOutputs.phase2.score;
        const wordCount = context.previousOutputs.phase2.wordCount;
        return score >= 80 && wordCount >= 50000;
      `,
      nextNodeId: 'publish',
      label: 'Ready to Publish',
    },
  ],
  defaultNextNodeId: 'revise',
};
```

**Output Variables**:
- `nextNodeId` - Which node to execute next
- `conditionResult` - Boolean result
- `conditionLabel` - Human-readable label

### 7. Loop Executor

**File**: `loop-executor.ts`
**Node Type**: `loop`

Executes a sequence of nodes multiple times.

**Configuration**:
```typescript
interface LoopNode {
  type: 'loop';
  loopType: 'forEach' | 'while' | 'count';
  iteratorVariable?: string;    // Variable name for current item
  indexVariable?: string;       // Variable name for index
  collection?: string;          // JSONPath to array (forEach)
  condition?: string;           // Condition expression (while)
  count?: number;              // Number of iterations (count)
  maxIterations?: number;      // Safety limit for while loops
  loopNodes: string[];         // Node IDs to execute in loop
  aggregateResults?: boolean;  // Collect all iteration outputs
}
```

**forEach Example**:
```typescript
const node: LoopNode = {
  id: 'book-loop',
  type: 'loop',
  name: 'Process Each Book',
  loopType: 'forEach',
  collection: '$.seriesBooks',  // Array of books from context
  iteratorVariable: 'currentBook',
  indexVariable: 'bookIndex',
  loopNodes: ['plan-book', 'write-chapters', 'quality-check'],
  aggregateResults: true,
};

const output = await executor.execute(node, context);
// output.variables.iterations = [
//   { currentBook: {...}, bookIndex: 0, results: {...} },
//   { currentBook: {...}, bookIndex: 1, results: {...} },
//   ...
// ]
```

**while Example**:
```typescript
const node: LoopNode = {
  id: 'improve-until-good',
  type: 'loop',
  loopType: 'while',
  condition: '$.qualityScore < 80',
  maxIterations: 5,  // Safety limit
  loopNodes: ['revise-chapter', 'check-quality'],
};
```

**count Example**:
```typescript
const node: LoopNode = {
  id: 'generate-5-ideas',
  type: 'loop',
  loopType: 'count',
  count: 5,
  indexVariable: 'ideaNumber',
  loopNodes: ['generate-idea', 'evaluate-idea'],
  aggregateResults: true,
};
```

**Output Variables**:
- `iterations` - Array of iteration results (if aggregateResults)
- `iterationCount` - Total iterations performed
- `completed` - Whether loop completed normally

### 8. Sub-Workflow Executor

**File**: `subworkflow-executor.ts`
**Node Type**: `subworkflow`

Executes a nested workflow with isolated context.

**Configuration**:
```typescript
interface SubWorkflowNode {
  type: 'subworkflow';
  workflowId: string;        // Which workflow to execute
  inputMapping?: Array<{     // Map parent context to sub-workflow
    source: string;
    target: string;
  }>;
  outputMapping?: Array<{    // Map sub-workflow results to parent
    source: string;
    target: string;
  }>;
  isolateContext?: boolean;  // Whether sub-workflow has separate context
}
```

**Example**:
```typescript
const node: SubWorkflowNode = {
  id: 'run-book-workflow',
  type: 'subworkflow',
  name: 'Execute Book Writing Workflow',
  workflowId: 'single-book-workflow',
  inputMapping: [
    { source: '$.currentBook', target: 'bookData' },
    { source: '$.seriesTitle', target: 'seriesTitle' },
  ],
  outputMapping: [
    { source: '$.completedBook', target: 'books[{{bookIndex}}]' },
  ],
  isolateContext: true,
};

const output = await executor.execute(node, context);
// output.variables.subworkflowResult = { completedBook: {...}, ... }
```

**Output Variables**:
- `subworkflowResult` - Full output from sub-workflow
- Plus any variables from outputMapping

## Creating a Custom Executor

### Step 1: Define Node Type

Add to `src/types/workflow-nodes.ts`:

```typescript
export interface MyCustomNode extends BaseWorkflowNode {
  type: 'my-custom';
  customOption: string;
  customConfig?: {
    setting1: boolean;
    setting2: number;
  };
}

// Add to union
export type WorkflowNode =
  | AgentWorkflowNode
  | UserInputNode
  | CodeExecutionNode
  | HttpRequestNode
  | FileOperationNode
  | ConditionalNode
  | LoopNode
  | SubWorkflowNode
  | MyCustomNode;  // Add here
```

### Step 2: Create Executor Class

Create `src/main/workflow/executors/my-custom-executor.ts`:

```typescript
import { NodeExecutor } from './base-executor';
import { WorkflowNode, MyCustomNode, NodeOutput, isMyCustomNode } from '../../../types/workflow-nodes';
import { logWithCategory, LogCategory } from '../../logger';

export class MyCustomExecutor implements NodeExecutor {
  readonly nodeType = 'my-custom';

  async execute(node: WorkflowNode, context: any): Promise<NodeOutput> {
    // Type guard
    if (!isMyCustomNode(node)) {
      throw new Error(`MyCustomExecutor received invalid node type: ${node.type}`);
    }

    const customNode = node as MyCustomNode;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing custom node: ${customNode.name}`);

    try {
      // Your custom logic here
      const result = await this.doCustomWork(customNode, context);

      return {
        nodeId: customNode.id,
        nodeName: customNode.name,
        timestamp: new Date(),
        status: 'success',
        output: result,
        variables: {
          customResult: result,
        },
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Custom node failed: ${error.message}`);

      return {
        nodeId: customNode.id,
        nodeName: customNode.name,
        timestamp: new Date(),
        status: 'failed',
        output: null,
        variables: {},
        error: error.message,
      };
    }
  }

  private async doCustomWork(node: MyCustomNode, context: any): Promise<any> {
    // Implement your custom logic
    // Access context: context.variables, context.previousOutputs, etc.
    // Use node configuration: node.customOption, node.customConfig

    return { success: true, data: 'Custom result' };
  }
}
```

### Step 3: Add Type Guard

Add to `src/types/workflow-nodes.ts`:

```typescript
export function isMyCustomNode(node: WorkflowNode): node is MyCustomNode {
  return node.type === 'my-custom';
}
```

### Step 4: Register Executor

Add to `src/main/workflow/workflow-executor.ts` constructor:

```typescript
import { MyCustomExecutor } from './executors/my-custom-executor';

constructor() {
  this.nodeExecutors = new Map([
    // ... existing executors
    ['my-custom', new MyCustomExecutor()],
  ]);
}
```

### Step 5: Create UI Config Panel

Create `src/renderer/components/dialogs/config-panels/MyCustomNodeConfig.tsx`:

```typescript
import React from 'react';
import { MyCustomNode } from '../../../../types/workflow-nodes';

interface MyCustomNodeConfigProps {
  node: MyCustomNode;
  onChange: (updates: Partial<MyCustomNode>) => void;
  errors: Record<string, string>;
}

export const MyCustomNodeConfig: React.FC<MyCustomNodeConfigProps> = ({
  node,
  onChange,
  errors,
}) => {
  return (
    <div className="config-panel">
      <div className="form-group">
        <label htmlFor="customOption">
          Custom Option:
          <span className="required" aria-label="required">*</span>
        </label>
        <input
          id="customOption"
          type="text"
          value={node.customOption || ''}
          onChange={(e) => onChange({ customOption: e.target.value })}
          aria-required="true"
          aria-invalid={!!errors.customOption}
          aria-describedby={errors.customOption ? 'customOption-error' : undefined}
        />
        {errors.customOption && (
          <div
            id="customOption-error"
            className="error-message"
            role="alert"
            aria-live="polite"
          >
            {errors.customOption}
          </div>
        )}
      </div>

      {/* Add more configuration fields */}
    </div>
  );
};
```

### Step 6: Integrate Config Panel

Add to `src/renderer/components/dialogs/NodeConfigDialog.tsx`:

```typescript
import { MyCustomNodeConfig } from './config-panels/MyCustomNodeConfig';

// In renderConfigurationTab():
case 'my-custom':
  return <MyCustomNodeConfig node={formData as MyCustomNode} onChange={handleChange} errors={errors} />;
```

### Step 7: Write Tests

Create `src/main/workflow/executors/__tests__/my-custom-executor.test.ts`:

```typescript
import { MyCustomExecutor } from '../my-custom-executor';
import { MyCustomNode } from '../../../../types/workflow-nodes';

describe('MyCustomExecutor', () => {
  let executor: MyCustomExecutor;

  beforeEach(() => {
    executor = new MyCustomExecutor();
  });

  test('should execute successfully', async () => {
    const node: MyCustomNode = {
      id: 'test',
      type: 'my-custom',
      name: 'Test Custom Node',
      customOption: 'test-value',
      position: { x: 0, y: 0 },
      requiresApproval: false,
      contextConfig: { mode: 'simple' },
    };

    const context = {
      variables: {},
      previousOutputs: {},
    };

    const output = await executor.execute(node, context);

    expect(output.status).toBe('success');
    expect(output.variables.customResult).toBeDefined();
  });

  test('should handle errors gracefully', async () => {
    // Test error cases
  });
});
```

## Best Practices

### 1. Always Use Type Guards

```typescript
if (!isMyNodeType(node)) {
  throw new Error(`Wrong executor for node type: ${node.type}`);
}
```

### 2. Structured Error Handling

```typescript
try {
  const result = await operation();
  return { status: 'success', output: result, variables: {...} };
} catch (error: any) {
  logWithCategory('error', LogCategory.WORKFLOW, error.message);
  return { status: 'failed', error: error.message, variables: {} };
}
```

### 3. Comprehensive Logging

```typescript
logWithCategory('info', LogCategory.WORKFLOW, `Starting ${node.name}`);
logWithCategory('debug', LogCategory.WORKFLOW, `Config: ${JSON.stringify(node.config)}`);
logWithCategory('info', LogCategory.WORKFLOW, `Completed ${node.name} in ${duration}ms`);
```

### 4. Validate Configuration

```typescript
if (!node.requiredField) {
  return {
    status: 'failed',
    error: 'Missing required field: requiredField',
    // ...
  };
}
```

### 5. Use Context Manager for Variables

```typescript
import { ContextManager } from '../context-manager';

const contextManager = new ContextManager();

// Evaluate JSONPath expressions
const value = contextManager.evaluateJSONPath('$.previousNode.field', context);

// Substitute variables in strings
const url = contextManager.substitute('https://api.example.com/{{bookId}}', context);
```

### 6. Emit Events for Progress

```typescript
this.emit('node-started', { nodeId: node.id, nodeName: node.name });
// ... do work ...
this.emit('node-completed', { nodeId: node.id, output });
```

### 7. Respect Timeouts

```typescript
const timeout = node.timeoutMs || 60000;

const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Execution timeout')), timeout)
);

const result = await Promise.race([
  this.doWork(node, context),
  timeoutPromise,
]);
```

## Testing

### Unit Tests

Test each executor in isolation with mock contexts:

```typescript
test('should process all items in forEach loop', async () => {
  const node: LoopNode = {
    id: 'loop',
    type: 'loop',
    loopType: 'forEach',
    collection: '$.items',
    iteratorVariable: 'item',
    loopNodes: ['process-item'],
    // ...
  };

  const context = {
    variables: {
      items: [1, 2, 3],
    },
  };

  const output = await executor.execute(node, context);

  expect(output.status).toBe('success');
  expect(output.variables.iterationCount).toBe(3);
});
```

### Integration Tests

Test executors working together in a workflow:

```typescript
test('should execute multi-node workflow', async () => {
  const workflow = {
    nodes: [
      { id: '1', type: 'user-input', /* ... */ },
      { id: '2', type: 'code', /* ... */ },
      { id: '3', type: 'http', /* ... */ },
    ],
  };

  const result = await workflowExecutor.execute(workflow);

  expect(result.status).toBe('completed');
  expect(result.nodeOutputs.size).toBe(3);
});
```

## Debugging

### Enable Detailed Logging

```bash
DEBUG=fictionlab:workflow:* npm run dev
```

### Inspect Context

```typescript
console.log('Context before execution:', JSON.stringify(context, null, 2));
const output = await executor.execute(node, context);
console.log('Output:', JSON.stringify(output, null, 2));
```

### Use Debugger

```typescript
debugger;  // Breakpoint
const result = await criticalOperation();
```

## Performance Optimization

### 1. Lazy Loading

Only load expensive resources when needed:

```typescript
private sdkClient?: SomeSDK;

private getClient(): SomeSDK {
  if (!this.sdkClient) {
    this.sdkClient = new SomeSDK(config);
  }
  return this.sdkClient;
}
```

### 2. Caching

Cache expensive computations:

```typescript
private cache = new Map<string, any>();

async execute(node: WorkflowNode, context: any): Promise<NodeOutput> {
  const cacheKey = this.getCacheKey(node);

  if (this.cache.has(cacheKey)) {
    return this.cache.get(cacheKey);
  }

  const result = await this.doWork(node, context);
  this.cache.set(cacheKey, result);
  return result;
}
```

### 3. Parallel Execution

When nodes are independent, execute in parallel:

```typescript
const results = await Promise.all([
  executor1.execute(node1, context),
  executor2.execute(node2, context),
  executor3.execute(node3, context),
]);
```

## Security Considerations

### 1. Input Validation

Always validate node configuration:

```typescript
if (node.code.includes('eval(') || node.code.includes('Function(')) {
  throw new Error('Dangerous code patterns not allowed');
}
```

### 2. Sandboxing

Isolate untrusted code execution:

```typescript
const { VM } = require('vm2');
const vm = new VM({
  timeout: 5000,
  sandbox: { context },
  eval: false,
  wasm: false,
});

const result = vm.run(node.code);
```

### 3. Path Traversal Prevention

```typescript
const safePath = path.resolve(projectFolder, requestedPath);

if (!safePath.startsWith(projectFolder)) {
  throw new Error('Path traversal attempt blocked');
}
```

### 4. Credential Protection

Never log or expose credentials:

```typescript
// BAD
console.log('Using API key:', apiKey);

// GOOD
logWithCategory('info', LogCategory.WORKFLOW, 'Using configured API key');
```

## License

This code is part of FictionLab and follows the project's license terms.
