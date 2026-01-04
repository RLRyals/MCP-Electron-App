---
name: run-workflow
description: Execute FictionLab workflows with Claude Code as the AI executor. Handles interactive conversations, spawns sub-agents, writes files, and manages workflow state. Requires FictionLab running for workflow definitions.
allowed-tools: Bash(node:*), Read, Write, Task, AskUserQuestion, TodoWrite
---

# FictionLab Workflow Executor

You are the workflow orchestrator. When this skill is invoked, you execute FictionLab workflows by:
1. Fetching workflow definitions from FictionLab via IPC
2. Parsing the workflow graph (nodes + edges)
3. Executing each node based on its type
4. Managing state and variables between nodes
5. Saving results back to FictionLab via MCP

## Prerequisites

FictionLab must be running with:
- Docker containers up (check Services tab)
- Workflow plugin active (check Plugins tab)

## Quick Commands

```bash
# List available workflows
node -e "require('child_process').execSync('node \"' + require('path').join(require('os').homedir(), '.claude/skills/run-workflow/ipc-client.js') + '\" list', {stdio:'inherit'})"

# Get workflow definition
node -e "require('child_process').execSync('node \"' + require('path').join(require('os').homedir(), '.claude/skills/run-workflow/ipc-client.js') + '\" get <workflow-id>', {stdio:'inherit'})"

# Execute workflow (via FictionLab - legacy)
node -e "require('child_process').execSync('node \"' + require('path').join(require('os').homedir(), '.claude/skills/run-workflow/ipc-client.js') + '\" execute <workflow-id>', {stdio:'inherit'})"

# Resume from saved state
node -e "require('child_process').execSync('node \"' + require('path').join(require('os').homedir(), '.claude/skills/run-workflow/ipc-client.js') + '\" load-state <workflow-id>', {stdio:'inherit'})"
```

---

## Workflow Execution Protocol

### Step 1: Fetch Workflow Definition

```bash
node -e "require('child_process').execSync('node \"' + require('path').join(require('os').homedir(), '.claude/skills/run-workflow/ipc-client.js') + '\" get <workflow-id>', {stdio:'inherit'})"
```

Parse the JSON response to extract:
- `nodes`: Array of workflow nodes
- `edges`: Array of connections between nodes
- `metadata`: Workflow name, version, description

### Step 2: Parse Graph Structure

1. Build node lookup: `nodeMap[node.id] = node`
2. Build edge map: For each edge, map `source` to list of `target` nodes
3. Find entry node: Node with no incoming edges
4. Determine execution order via topological sort

### Step 3: Initialize Execution Context

```javascript
const context = {
  workflowId: "<workflow-id>",
  instanceId: generateId(),
  workspaceRoot: process.cwd(),  // Current workspace
  variables: {},                  // Workflow variables
  completedNodes: [],             // Completed node IDs
  currentNodeId: entryNodeId,     // Current execution position
  loopStack: [],                  // For nested loops
  outputs: {}                     // Final outputs
};
```

### Step 4: Execute Nodes

For each node, execute based on its type:

#### user-input Node
```
1. Present node.prompt to user conversationally
2. For 'select' type: show options as choices
3. Gather response
4. Validate against node.validation:
   - Check minLength, maxLength, pattern, min, max
   - If invalid, explain issue and re-ask
5. Store: context.variables[node.id] = response
6. Mark completed: context.completedNodes.push(node.id)
```

#### planning/writing Node (Interactive)
When `node.provider.config.headless != true`:
```
1. If node.skill exists:
   - Load skill file: `path.join(os.homedir(), '.claude/skills', node.skill + '.md')`
   - Follow skill's conversation protocol
2. Substitute {{variables}} in node.prompt
3. Conduct multi-turn conversation:
   - Start with substituted prompt
   - Gather information through dialogue
   - Follow agent persona if node.agent specified
4. APPROVAL GATE (Required before MCP save):
   - Present: "Here's what I've developed: [summary]"
   - Ask: "Would you like to approve this, or should I make changes?"
   - If changes requested, iterate
5. Upon approval:
   - Execute MCP save operations from skill
   - Store: context.variables[node.id] = output
6. Mark completed
```

#### planning/writing Node (Headless)
When `node.provider.config.headless == true`:
```
1. Substitute {{variables}} in node.prompt
2. Map node.agent to Task subagent_type:
   - market-research-agent → market-research-agent
   - series-architect-agent → series-architect-agent
   - bailey-first-drafter → bailey-first-drafter
   - npe-series-validator-agent → npe-series-validator-agent
   - commercial-validator-agent → commercial-validator-agent
   - (default) → general-purpose
3. Spawn sub-agent via Task tool with prompt
4. Store agent output: context.variables[node.id] = result
5. Mark completed
```

#### gate Node
```
1. Spawn validator agent based on node.agent
2. Get structured result (should include score/evaluation)
3. Evaluate node.gateCondition against result:
   - Parse JSONPath (e.g., "$.npeScore >= 80")
   - Extract value and compare
4. If PASS:
   - Report: "Gate PASSED: [reason]"
   - Follow 'pass' or default edge
5. If FAIL:
   - Report: "Gate FAILED: [reason]"
   - Follow 'fail' edge (usually loops back)
6. If node.requiresApproval, confirm with user
```

#### file Node
```
1. Substitute {{variables}} in paths and content
2. For 'write' operation:
   - Use Write tool to create file
   - Path: context.workspaceRoot + node.sourcePath
   - Content: node.content
3. For 'read' operation:
   - Use Read tool
   - Store: context.variables[node.id] = fileContent
4. For other operations (copy, move, delete):
   - Execute via IPC to FictionLab
5. Mark completed
```

#### conditional Node
```
1. Evaluate node.condition against context.variables
2. Parse JSONPath condition (e.g., "$.score >= 70")
3. Find outgoing edges with matching labels:
   - "true"/"yes" if condition is true
   - "false"/"no" if condition is false
4. Set context.currentNodeId to target of matching edge
```

#### loop Node
```
1. Push to loopStack: { nodeId, type, index: 0, collection }
2. For 'forEach':
   - Get array: evaluate(node.collection, context.variables)
   - Set: context.variables[node.iteratorVariable] = array[0]
   - Set: context.variables[node.indexVariable] = 0
3. For 'count':
   - Set: context.variables[node.indexVariable] = 0
4. Execute child nodes (body edge targets)
5. Increment index
6. If more iterations:
   - Update iterator/index variables
   - Re-execute body
7. When complete:
   - Pop from loopStack
   - Follow 'complete' edge
```

#### code/http/subworkflow Nodes
```
1. Execute via IPC to FictionLab:
   node ipc-client.js execute-node <node-json>
2. Store result: context.variables[node.id] = result
3. Mark completed
```

### Step 5: State Management

After each node completion:
```
1. Save state to workspace:
   .fictionlab/workflow-state/<instanceId>.json
2. State includes:
   - workflowId, instanceId
   - completedNodes, currentNodeId
   - variables, loopStack
   - timestamp
```

To resume:
```
1. Load state: node ipc-client.js load-state <workflow-id>
2. Restore context from state
3. Continue from currentNodeId
```

### Step 6: Report Results

When workflow completes:
```
1. List completed nodes with summary
2. Show output variables/files created
3. Report any errors or skipped nodes
4. Ask if user wants to save execution record
```

---

## Variable Substitution

Replace `{{variableName}}` with values from context.variables:

```javascript
function substitute(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    return variables[name] ?? match;
  });
}
```

**Built-in Variables:**
- `{{projectFolder}}` → context.workspaceRoot
- `{{workflowId}}` → context.workflowId
- `{{instanceId}}` → context.instanceId

---

## JSONPath Evaluation

For conditions like `$.score >= 80`:

```javascript
function evaluateCondition(condition, variables) {
  // Parse: "$.variableName operator value"
  const match = condition.match(/\$\.(\w+)\s*(>=|<=|>|<|==|!=)\s*(.+)/);
  if (!match) return false;

  const [, varName, operator, valueStr] = match;
  const varValue = variables[varName];
  const compareValue = isNaN(valueStr) ? valueStr.replace(/"/g, '') : Number(valueStr);

  switch (operator) {
    case '>=': return varValue >= compareValue;
    case '<=': return varValue <= compareValue;
    case '>':  return varValue > compareValue;
    case '<':  return varValue < compareValue;
    case '==': return varValue == compareValue;
    case '!=': return varValue != compareValue;
    default: return false;
  }
}
```

---

## Error Handling

1. **Node Execution Error:**
   - If node has retryConfig, retry with backoff
   - Report error to user
   - Ask: "Would you like to retry, skip this node, or abort?"

2. **IPC Connection Error:**
   - Check if FictionLab is running
   - Report: "FictionLab is not running. Please start FictionLab and try again."

3. **Validation Error:**
   - Explain what validation failed
   - Re-ask for input

---

## Skill Integration

When a node has a `skill` field, load the skill file for conversation guidance:

```
1. Read skill file: `path.join(os.homedir(), '.claude/skills', node.skill + '.md')`
2. Parse skill's conversation protocol
3. Follow skill's required outputs
4. Execute skill's approval gate
5. Execute skill's MCP save operations
```

---

## IPC Socket Paths

Cross-platform socket paths are built into ipc-client.js:
- Windows: `\\.\pipe\fictionlab-workflow-runner`
- Mac/Linux: `/tmp/fictionlab-workflow-runner.sock`

---

## Example: Execute simple-test-2

```
> /run-workflow simple-test-2

1. Fetch workflow definition
2. Parse: Node 2 (planning) → Node 3 (file)
3. Execute Node 2 (planning, brainstorming agent):
   - "Let's brainstorm a new concept for your story..."
   - [Interactive conversation with user]
   - "Here's the concept we've developed: [summary]"
   - "Would you like to approve this?"
   - [User approves]
   - Store: context.variables.concept = output
4. Execute Node 3 (file, write):
   - Path: {{projectFolder}}/concept.md
   - Content: {{concept}}
   - Write file to workspace
5. Report: "Workflow complete. Created concept.md"
```

---

## Reference

See [workflow-reference.md](./workflow-reference.md) for complete node type documentation.
