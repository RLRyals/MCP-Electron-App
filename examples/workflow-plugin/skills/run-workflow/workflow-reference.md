# Workflow Node Type Reference

This document defines all workflow node types that Claude Code must understand to execute FictionLab workflows.

## Node Types Overview

| Type | Icon | Purpose | Claude Code Execution |
|------|------|---------|----------------------|
| `user-input` | 👤 | Capture user input | Direct conversation with user |
| `planning` | 📋 | AI planning operations | Interactive conversation OR spawn sub-agent |
| `writing` | ✍️ | AI content generation | Interactive conversation OR spawn sub-agent |
| `gate` | 🚪 | Quality validation gates | Spawn validator agent, evaluate condition |
| `code` | ⚙️ | Execute JavaScript/Python | Run via IPC (FictionLab handles) |
| `http` | 🌐 | Make API calls | Run via IPC (FictionLab handles) |
| `file` | 📁 | File system operations | Use Write/Read tools |
| `conditional` | 🔀 | Branch workflow | Evaluate condition, follow edge |
| `loop` | 🔄 | Iterate over items | Track iteration state |
| `subworkflow` | 📦 | Execute nested workflow | Run via IPC (FictionLab handles) |

---

## Base Node Properties

All nodes share these common properties:

```typescript
interface BaseWorkflowNode {
  id: string;                    // Unique node identifier
  type: string;                  // Node type (see above)
  name: string;                  // Display name
  description?: string;          // Node description
  position: { x: number; y: number };  // Canvas position (ignored by executor)

  // Execution control
  requiresApproval?: boolean;    // Pause for user approval after execution
  skipCondition?: string;        // JSONPath condition to skip node
  timeoutMs?: number;            // Execution timeout

  // Retry configuration
  retryConfig?: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier?: number;  // Exponential backoff
  };

  // Context configuration
  contextConfig?: {
    mode: 'simple' | 'advanced';
    inputs?: ContextMapping[];   // Advanced: explicit input mappings
    outputs?: ContextMapping[];  // Advanced: explicit output mappings
  };
}

interface ContextMapping {
  source: string;     // JSONPath (e.g., "$.previousNode.field" or "{{variable}}")
  target: string;     // Target variable name
  transform?: string; // Optional JavaScript transform (e.g., "x => x.toUpperCase()")
}
```

---

## Node Type Details

### 1. user-input

Captures user input during workflow execution.

```typescript
interface UserInputNode extends BaseWorkflowNode {
  type: 'user-input';
  prompt: string;                           // Question to ask user
  inputType: 'text' | 'textarea' | 'number' | 'select';
  required?: boolean;                       // Input required
  defaultValue?: string | number;           // Default value
  options?: Array<{ label: string; value: string }>;  // For select inputs
  validation?: {
    pattern?: string;      // Regex pattern
    minLength?: number;    // Minimum text length
    maxLength?: number;    // Maximum text length
    min?: number;          // Minimum number value
    max?: number;          // Maximum number value
  };
}
```

**Claude Code Execution:**
1. Present the `prompt` to user conversationally
2. For `select` inputs, present options as choices
3. Validate response against `validation` rules
4. If invalid, explain issue and re-ask
5. Store response in `context.variables[node.id]`

---

### 2. planning / writing (Agent Nodes)

AI-powered planning or content generation.

```typescript
interface AgentWorkflowNode extends BaseWorkflowNode {
  type: 'planning' | 'writing' | 'gate';

  // Agent configuration
  agent?: string;            // Agent name (e.g., "series-architect-agent")
  skill?: string;            // Skill to invoke for conversation guidance
  prompt: string;            // User-visible prompt with {{variable}} substitution
  systemPrompt?: string;     // Optional system prompt override

  // LLM configuration
  provider?: {
    providerId: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    config?: {
      headless?: boolean;    // true = spawn sub-agent, false = interactive
    };
  };

  // Gate configuration (for type: 'gate')
  gate?: boolean;            // Marks as quality gate
  gateCondition?: string;    // Condition for gate to pass (e.g., "$.score >= 80")
}
```

**Claude Code Execution for planning/writing:**

**Interactive Mode** (`provider.config.headless = false` or not set):
1. Load skill if `skill` is specified
2. Substitute {{variables}} in `prompt`
3. Conduct multi-turn conversation following skill's guidance
4. Gather required outputs through dialogue
5. Present results for user approval
6. Save via MCP if skill requires it
7. Store output in `context.variables[node.id]`

**Headless Mode** (`provider.config.headless = true`):
1. Substitute {{variables}} in `prompt`
2. Spawn sub-agent via Task tool with appropriate `subagent_type`
3. Pass prompt to sub-agent
4. Store agent output in `context.variables[node.id]`

**Sub-Agent Mapping:**
| node.agent | Task subagent_type |
|------------|-------------------|
| market-research-agent | market-research-agent |
| series-architect-agent | series-architect-agent |
| bailey-first-drafter | bailey-first-drafter |
| npe-series-validator-agent | npe-series-validator-agent |
| commercial-validator-agent | commercial-validator-agent |
| detective-logan | detective-logan |
| dr-viktor-psychologist | dr-viktor-psychologist |
| edna-editor | edna-editor |
| finn-style-specialist | finn-style-specialist |
| miranda-showrunner | miranda-showrunner |
| tessa-continuity | tessa-continuity |
| (default/unspecified) | general-purpose |

---

### 3. gate

Quality validation gate with pass/fail evaluation.

```typescript
interface GateNode extends AgentWorkflowNode {
  type: 'gate';
  gate: true;
  gateCondition: string;     // JSONPath condition (e.g., "$.npeScore >= 80")
}
```

**Claude Code Execution:**
1. Spawn validator agent based on `agent` field
2. Get structured result from agent (should include score/evaluation)
3. Evaluate `gateCondition` against result
4. If PASS: follow success edge (usually labeled "pass" or default)
5. If FAIL: follow failure edge (usually loops back to previous node)
6. If `requiresApproval`: ask user to confirm gate result

---

### 4. file

File system operations.

```typescript
interface FileOperationNode extends BaseWorkflowNode {
  type: 'file';
  operation: 'read' | 'write' | 'copy' | 'move' | 'delete' | 'exists';
  sourcePath: string;           // Source path (supports {{variable}} substitution)
  targetPath?: string;          // Destination path (for copy/move)
  content?: string;             // Content for write operation
  encoding?: 'utf8' | 'binary'; // File encoding
  overwrite?: boolean;          // Overwrite existing files
  requireProjectFolder?: boolean; // Restrict to project folder
}
```

**Claude Code Execution:**
1. Substitute {{variables}} in `sourcePath`, `targetPath`, and `content`
2. For `write`: Use Write tool to create file
3. For `read`: Use Read tool to read file, store in variables
4. For other operations: Execute via IPC to FictionLab
5. Store result in `context.variables[node.id]`

---

### 5. conditional

Branches workflow based on conditions.

```typescript
interface ConditionalNode extends BaseWorkflowNode {
  type: 'conditional';
  condition: string;                        // Condition expression
  conditionType?: 'jsonpath' | 'javascript';
}
```

**Claude Code Execution:**
1. Evaluate `condition` against current context variables
2. For JSONPath: Use `$.variableName` syntax (e.g., `$.score >= 70`)
3. Result determines which outgoing edge to follow
4. Edges typically labeled "true"/"false" or "yes"/"no"

---

### 6. loop

Iteration control for forEach, while, or count loops.

```typescript
interface LoopNode extends BaseWorkflowNode {
  type: 'loop';
  loopType: 'forEach' | 'while' | 'count';

  // For forEach loops
  collection?: string;         // JSONPath to array (e.g., "$.books")
  iteratorVariable?: string;   // Current item variable (e.g., "currentBook")

  // For while loops
  whileCondition?: string;     // JSONPath condition

  // For count loops
  count?: number;              // Number of iterations

  // Common
  indexVariable?: string;      // Loop counter variable (e.g., "bookIndex")
  maxIterations?: number;      // Safety limit
}
```

**Claude Code Execution:**

**forEach:**
1. Get array from `context.variables` via `collection` JSONPath
2. For each item:
   - Set `context.variables[iteratorVariable] = currentItem`
   - Set `context.variables[indexVariable] = currentIndex`
   - Execute child nodes (nodes connected to loop's "body" edge)
3. When array exhausted, continue to loop's "complete" edge

**count:**
1. Iterate `count` times
2. For each iteration:
   - Set `context.variables[indexVariable] = currentIndex`
   - Execute child nodes
3. After all iterations, continue to "complete" edge

**while:**
1. Evaluate `whileCondition`
2. While true (up to `maxIterations`):
   - Execute child nodes
   - Re-evaluate condition
3. When false, continue to "complete" edge

---

### 7. code

Executes JavaScript or Python code.

```typescript
interface CodeExecutionNode extends BaseWorkflowNode {
  type: 'code';
  language: 'javascript' | 'python';
  code: string;                // Source code to execute
  sandbox?: {
    enabled: boolean;
    allowedModules: string[];  // Whitelist for require/import
    memoryLimitMb?: number;
    cpuTimeoutMs?: number;
  };
}
```

**Claude Code Execution:**
Execute via IPC to FictionLab - code execution happens in FictionLab's sandbox.

---

### 8. http

Makes API calls and HTTP requests.

```typescript
interface HttpRequestNode extends BaseWorkflowNode {
  type: 'http';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;                         // Supports {{variable}} substitution
  headers?: Record<string, string>;    // HTTP headers
  body?: string | object;              // Request body
  responseType?: 'json' | 'text' | 'buffer';
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'api-key';
    config?: Record<string, string>;   // Credentials
  };
}
```

**Claude Code Execution:**
Execute via IPC to FictionLab - HTTP requests are made by FictionLab to preserve credentials.

---

### 9. subworkflow

Executes a nested workflow.

```typescript
interface SubWorkflowNode extends BaseWorkflowNode {
  type: 'subworkflow';
  subWorkflowId: string;               // ID of workflow to execute
  subWorkflowVersion?: string;         // 'latest' or specific version
}
```

**Claude Code Execution:**
Execute via IPC to FictionLab - nested workflow execution is handled by FictionLab.

---

## Variable Substitution

All string fields in nodes support variable substitution using `{{variableName}}` syntax:

```json
{
  "prompt": "Write a chapter based on: {{bookOutline}}",
  "sourcePath": "{{projectFolder}}/chapters/chapter-{{chapterIndex}}.md",
  "content": "# Chapter {{chapterIndex}}\n\n{{chapterContent}}"
}
```

**Built-in Variables:**
- `{{projectFolder}}` - Current workspace root
- `{{workflowId}}` - Current workflow ID
- `{{instanceId}}` - Current execution instance ID

---

## JSONPath Conditions

Conditions use JSONPath syntax to reference context variables:

```
$.variableName              // Access variable
$.npeScore >= 80            // Numeric comparison
$.bookIdea.length > 100     // String length check
$.books.length >= 5         // Array length check
$.status == "approved"      // String comparison
```

---

## Edge Types

Workflow edges connect nodes and determine execution flow:

```typescript
interface WorkflowEdge {
  id: string;
  source: string;        // Source node ID
  target: string;        // Target node ID
  sourceHandle?: string; // Output port (e.g., "true", "false", "body", "complete")
  targetHandle?: string; // Input port
  label?: string;        // Edge label (for conditionals/gates)
}
```

**Common Edge Patterns:**
- Sequential: Default edges connect nodes in order
- Conditional: "true"/"false" edges from conditional nodes
- Gate: "pass"/"fail" edges from gate nodes
- Loop: "body" edge for loop iteration, "complete" edge for exit
