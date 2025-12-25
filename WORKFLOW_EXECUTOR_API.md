# Workflow Executor API Reference

## Class: WorkflowExecutor

Enhanced workflow execution engine with modular executor system.

### Constructor

```typescript
constructor()
```

Initializes:
- `MCPWorkflowClient` for MCP integration
- `ClaudeCodeExecutor` for legacy Claude Code skills
- `ContextManager` for variable mapping
- `LLMProviderManager` for LLM provider access
- All 10 node executors (agent, user-input, code, http, file, conditional, loop, subworkflow)

### Public Methods

#### startWorkflow()

Start workflow execution with given options.

```typescript
async startWorkflow(options: WorkflowExecutionOptions): Promise<number>
```

**Parameters:**
- `options.workflowDefId` - Workflow definition ID
- `options.version` - Optional version (default: latest)
- `options.seriesId` - Series ID for MCP integration
- `options.userId` - User ID for tracking
- `options.startPhase` - Optional starting phase (default: 0)

**Returns:** Workflow instance ID

**Events Emitted:**
- `phase-started` - Phase execution begins
- `phase-completed` - Phase execution completes
- `phase-failed` - Phase execution fails
- `approval-required` - User approval needed

#### approvePhase()

Approve a phase waiting for user approval.

```typescript
approvePhase(instanceId: number, phaseNumber: number): boolean
```

**Parameters:**
- `instanceId` - Workflow instance ID
- `phaseNumber` - Phase number to approve

**Returns:** `true` if approval was processed, `false` if no pending approval found

#### rejectPhase()

Reject a phase waiting for user approval.

```typescript
rejectPhase(instanceId: number, phaseNumber: number, reason: string): boolean
```

**Parameters:**
- `instanceId` - Workflow instance ID
- `phaseNumber` - Phase number to reject
- `reason` - Reason for rejection

**Returns:** `true` if rejection was processed, `false` if no pending approval found

#### stopWorkflow()

Stop a running workflow.

```typescript
stopWorkflow(instanceId: number): void
```

**Parameters:**
- `instanceId` - Workflow instance ID to stop

#### getWorkflowState()

Get current state of a workflow instance.

```typescript
getWorkflowState(instanceId: number): WorkflowExecutionState | undefined
```

**Returns:**
```typescript
interface WorkflowExecutionState {
  instanceId: number;
  workflowDefId: string;
  version: string;
  currentPhase: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}
```

#### getRunningWorkflows()

Get all currently running workflows.

```typescript
getRunningWorkflows(): WorkflowExecutionState[]
```

**Returns:** Array of workflow states

### Private Methods (Internal Use)

#### executeNodeEnhanced()

Enhanced node execution with new executor system.

```typescript
private async executeNodeEnhanced(
  node: WorkflowNode,
  context: WorkflowExecutionContext
): Promise<NodeOutput>
```

**Flow:**
1. Check skip condition
2. Build node context (input mapping)
3. Get executor for node type
4. Emit node-started event
5. Execute with retry and timeout
6. Extract outputs (output mapping)
7. Update global context
8. Emit node-completed event

**Events Emitted:**
- `node-started` - Node execution begins
- `node-completed` - Node execution completes
- `node-failed` - Node execution fails

#### executeWithRetry()

Execute function with retry logic and exponential backoff.

```typescript
private async executeWithRetry<T>(
  fn: () => Promise<T>,
  retryConfig?: RetryConfig,
  timeoutMs?: number
): Promise<T>
```

**Parameters:**
- `fn` - Function to execute
- `retryConfig.maxRetries` - Maximum retry attempts (default: 0)
- `retryConfig.retryDelayMs` - Initial retry delay (default: 1000ms)
- `retryConfig.backoffMultiplier` - Backoff multiplier (default: 2)
- `timeoutMs` - Optional timeout per attempt

**Retry Delay Formula:** `delay * (multiplier ^ attempt)`

#### executeWithTimeout()

Execute function with timeout enforcement.

```typescript
private async executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T>
```

**Parameters:**
- `fn` - Function to execute
- `timeoutMs` - Timeout in milliseconds

**Throws:** Error if execution exceeds timeout

## Events

### Node-Level Events

#### node-started

Emitted when node execution begins.

```typescript
{
  nodeId: string;
  nodeName: string;
  nodeType: string;
  timestamp: string;
}
```

#### node-completed

Emitted when node execution completes.

```typescript
{
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'success' | 'failed';
  timestamp: string;
}
```

#### node-failed

Emitted when node execution fails.

```typescript
{
  nodeId: string;
  nodeName: string;
  error: string;
  timestamp: string;
}
```

### Phase-Level Events (Legacy)

#### phase-event

Generic phase event.

```typescript
interface PhaseExecutionEvent {
  workflowInstanceId: number;
  phaseNumber: number;
  phaseName: string;
  status: 'starting' | 'in_progress' | 'completed' | 'failed' | 'waiting_approval';
  output?: object;
  error?: string;
  timestamp: string;
}
```

#### phase-started

Phase execution begins.

#### phase-completed

Phase execution completes successfully.

#### phase-failed

Phase execution fails.

#### approval-required

User approval is required.

## Registered Executors

### Node Type to Executor Mapping

| Node Type | Executor Class | Description |
|-----------|---------------|-------------|
| `planning` | AgentNodeExecutor | AI planning tasks |
| `writing` | AgentNodeExecutor | AI writing tasks |
| `gate` | AgentNodeExecutor | Quality gates with conditions |
| `user-input` | UserInputExecutor | User input capture |
| `code` | CodeExecutionExecutor | JavaScript/Python execution |
| `http` | HttpRequestExecutor | HTTP API requests |
| `file` | FileOperationExecutor | File read/write/copy/move/delete |
| `conditional` | ConditionalExecutor | If/else branching |
| `loop` | LoopExecutor | forEach/while/count loops |
| `subworkflow` | SubWorkflowExecutor | Nested workflow execution |

## Context Management

### WorkflowExecutionContext

Global execution context passed between nodes.

```typescript
interface WorkflowExecutionContext {
  // Workflow instance info
  instanceId: string;
  workflowId: string;
  projectFolder: string;

  // Variable storage
  variables: Record<string, any>;
  nodeOutputs: Map<string, NodeOutput>;

  // MCP data access
  mcpData: {
    series?: any;
    books?: any[];
    characters?: any[];
    scenes?: any[];
    chapters?: any[];
    [key: string]: any;
  };

  // Execution state
  currentNodeId: string;
  completedNodes: string[];
  loopStack: LoopContext[];

  // Metadata
  startedAt: Date;
  userId: number;
  seriesId?: number;
}
```

### NodeOutput

Result from node execution.

```typescript
interface NodeOutput {
  nodeId: string;
  nodeName: string;
  timestamp: Date;
  status: 'success' | 'failed';
  output: any;
  variables: Record<string, any>;
  error?: string;
  errorStack?: string;
}
```

## Usage Examples

### Example 1: Start Workflow

```typescript
const executor = new WorkflowExecutor();

// Listen for events
executor.on('phase-started', (event) => {
  console.log(`Phase started: ${event.phaseName}`);
});

executor.on('phase-completed', (event) => {
  console.log(`Phase completed: ${event.phaseName}`);
});

executor.on('approval-required', (event) => {
  console.log(`Approval required for phase: ${event.phaseName}`);
  // UI should prompt user for approval
});

// Start workflow
const instanceId = await executor.startWorkflow({
  workflowDefId: 'series-workflow',
  version: 'v1.0',
  seriesId: 123,
  userId: 1,
  startPhase: 0
});

console.log(`Workflow started: ${instanceId}`);
```

### Example 2: Monitor Workflow State

```typescript
const executor = new WorkflowExecutor();
const instanceId = await executor.startWorkflow({...});

// Poll workflow state
const interval = setInterval(() => {
  const state = executor.getWorkflowState(instanceId);

  if (state) {
    console.log(`Current phase: ${state.currentPhase}`);
    console.log(`Status: ${state.status}`);

    if (state.status === 'completed' || state.status === 'failed') {
      clearInterval(interval);
      console.log(`Workflow finished: ${state.status}`);
    }
  }
}, 1000);
```

### Example 3: Handle User Approval

```typescript
const executor = new WorkflowExecutor();

executor.on('approval-required', async (event) => {
  const { workflowInstanceId, phaseNumber, phaseName } = event;

  // Show UI dialog
  const approved = await showApprovalDialog(phaseName);

  if (approved) {
    executor.approvePhase(workflowInstanceId, phaseNumber);
  } else {
    executor.rejectPhase(workflowInstanceId, phaseNumber, 'User rejected');
  }
});
```

### Example 4: Stop Workflow

```typescript
const executor = new WorkflowExecutor();
const instanceId = await executor.startWorkflow({...});

// Stop workflow after 5 seconds
setTimeout(() => {
  executor.stopWorkflow(instanceId);
  console.log('Workflow stopped');
}, 5000);
```

### Example 5: Get All Running Workflows

```typescript
const executor = new WorkflowExecutor();

// Get all running workflows
const running = executor.getRunningWorkflows();

console.log(`Running workflows: ${running.length}`);
running.forEach(state => {
  console.log(`- ${state.workflowDefId} (phase ${state.currentPhase})`);
});
```

## Error Handling

### Workflow Errors

Errors during workflow execution are:
1. Logged via `logWithCategory()`
2. Stored in `WorkflowExecutionState.error`
3. Emitted via `phase-failed` event
4. Set workflow status to `'failed'`

### Node Errors

Errors during node execution are:
1. Caught by `executeNodeEnhanced()`
2. Returned as failed `NodeOutput`
3. Emitted via `node-failed` event
4. Include error message and stack trace

### Retry Behavior

When retry is configured:
- Failed executions are retried up to `maxRetries` times
- Delay increases exponentially: `delay * (multiplier ^ attempt)`
- Timeout applies to each attempt individually
- Final failure throws error after all retries exhausted

## Best Practices

### 1. Event Listeners

Always add event listeners before starting workflow:

```typescript
const executor = new WorkflowExecutor();
executor.on('phase-completed', handleCompletion);
executor.on('approval-required', handleApproval);
await executor.startWorkflow({...});
```

### 2. Error Handling

Always handle workflow failures:

```typescript
executor.on('phase-failed', (event) => {
  console.error(`Phase failed: ${event.error}`);
  // Notify user, log error, etc.
});
```

### 3. Cleanup

Clean up event listeners when done:

```typescript
executor.removeAllListeners('phase-completed');
executor.removeAllListeners('approval-required');
```

### 4. State Monitoring

Check workflow state periodically:

```typescript
const state = executor.getWorkflowState(instanceId);
if (state?.status === 'completed') {
  // Handle completion
}
```

## Integration Points

### MCP Integration

- Uses `MCPWorkflowClient` for database operations
- Persists workflow instances, phase executions, and results
- Locks workflow versions during execution

### LLM Integration

- Uses `LLMProviderManager` (singleton)
- Supports multiple LLM providers
- Per-node provider configuration

### Context Management

- Uses `ContextManager` for variable mapping
- Supports JSONPath expressions
- Supports variable transformations

### Executor Registry

- All executors implement `NodeExecutor` interface
- Registered in constructor
- Easy to add new node types

## Future Enhancements

1. **Graph-Based Execution**: Use `executeNodeEnhanced()` for graph traversal
2. **Parallel Execution**: Execute independent nodes concurrently
3. **Conditional Branching**: Use conditional node results to determine path
4. **Dynamic Loop Iteration**: Execute child nodes within loop nodes
5. **Nested Subworkflows**: Full support for workflow composition
6. **Event Streaming**: Real-time UI updates during execution
7. **Checkpoint/Resume**: Save and restore execution state
8. **Debugging**: Step-through execution with breakpoints
