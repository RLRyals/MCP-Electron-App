# N8N-Style Workflow Architecture

## Overview

Rebuilding workflow system from sequential array to graph-based structure for:
- Branching (conditional paths)
- Loops (retry logic, iterations)
- Parallel execution
- Dynamic routing
- Complex author-to-publication pipelines

## Use Cases

### 1. **Idea to Series Pipeline**
```
User Input (Idea)
  ↓
Brainstorm Agent → Generate Series Plan
  ↓
Market Research → Validate Concept
  ↓ (if pass)         ↓ (if fail)
Outline Books    →  Refine Concept (loop back)
  ↓
Write Book 1 (parallel: Chapter 1, 2, 3...)
  ↓
Quality Gate → Pass/Fail/Revise
  ↓
Marketing Workflow
```

### 2. **Marketing Workflow**
```
Book Launch
  ↓
Generate Marketing Materials (parallel)
  ├─→ Social Media Content (Leonardo API)
  ├─→ Audio Samples (Eleven Labs)
  ├─→ Website Content
  └─→ Email Campaign
```

## New Data Structure

### **Workflow Definition**
```json
{
  "id": "workflow-uuid",
  "name": "Idea to Series",
  "description": "Transform concept into published series",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "node-uuid-1",
      "type": "user-input",
      "name": "Collect Author Idea",
      "position": { "x": 100, "y": 100 },
      "data": {
        "agent": null,
        "skill": null,
        "prompt": "Describe your book idea",
        "fields": ["concept", "genre", "target_audience"]
      }
    },
    {
      "id": "node-uuid-2",
      "type": "planning",
      "name": "Brainstorm Series",
      "position": { "x": 300, "y": 100 },
      "data": {
        "agent": "brainstorming-agent",
        "skill": "series-planning-skill",
        "description": "Generate 5-book series plan"
      }
    },
    {
      "id": "node-uuid-3",
      "type": "gate",
      "name": "Market Validation",
      "position": { "x": 500, "y": 100 },
      "data": {
        "agent": "market-research-agent",
        "skill": "comp-analysis-skill",
        "gate": true,
        "gateCondition": "marketScore >= 70"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-uuid-1",
      "target": "node-uuid-2",
      "type": "default"
    },
    {
      "id": "edge-2",
      "source": "node-uuid-2",
      "target": "node-uuid-3",
      "type": "default"
    },
    {
      "id": "edge-3",
      "source": "node-uuid-3",
      "target": "node-uuid-4",
      "type": "conditional",
      "label": "Pass",
      "condition": "$.marketScore >= 70"
    },
    {
      "id": "edge-4",
      "source": "node-uuid-3",
      "target": "node-uuid-2",
      "type": "conditional",
      "label": "Fail - Refine",
      "condition": "$.marketScore < 70"
    }
  ],
  "variables": {
    "concept": "",
    "genre": "",
    "marketScore": 0,
    "seriesId": null
  }
}
```

## Node Types

### 1. **user-input**
- Collects data from user
- No agent required
- Defines form fields
- Outputs: User-provided data

### 2. **planning**
- Strategic thinking (series plans, outlines)
- Requires: agent + optional skill
- Outputs: Plans, structures, concepts

### 3. **writing**
- Content generation (chapters, marketing copy)
- Requires: agent + optional skill
- Outputs: Written content

### 4. **gate**
- Quality/validation checkpoint
- Evaluates condition (pass/fail)
- Routes to different paths based on result
- Outputs: Score + pass/fail

### 5. **loop**
- Iteration control
- Can loop back to previous nodes
- Max iteration limit
- Outputs: Loop counter + continue/break

### 6. **subworkflow**
- Nested workflow execution
- References another workflow
- Outputs: Sub-workflow results

### 7. **api-call**
- External API integration
- Leonardo, Eleven Labs, etc.
- Outputs: API response data

### 8. **parallel-split**
- Forks execution into multiple paths
- All paths execute simultaneously
- Use case: Generate multiple chapters at once

### 9. **parallel-join**
- Waits for all parallel paths to complete
- Merges results
- Continues execution

## Edge Types

### 1. **default**
- Standard sequential connection
- Always follows this path

### 2. **conditional**
- Evaluates condition before following
- Uses JSONPath expressions
- Examples:
  - `$.marketScore >= 70`
  - `$.chapterCount < 50`
  - `$.userApproved == true`

### 3. **loop-back**
- Returns to previous node
- Increments loop counter
- Checks max iterations

## Execution Model

### Sequential Execution
```
[Node A] → [Node B] → [Node C]
```

### Branching (Conditional)
```
         ┌→ [Node B] (if score >= 70)
[Node A] ┤
         └→ [Node C] (if score < 70)
```

### Loops
```
[Node A] → [Node B] → [Gate]
             ↑          │
             └──────────┘ (if fail, loop back)
```

### Parallel Execution
```
           ┌→ [Node B] ┐
[Node A] → ├→ [Node C] ┤ → [Join] → [Node F]
           └→ [Node D] ┘
```

## Database Schema Changes

### Migrati on: 005_graph_based_workflows.sql

```sql
-- Drop old workflow_definitions structure (if exists)
-- Keep workflow_runs for history

-- Create new graph-based nodes table
CREATE TABLE IF NOT EXISTS workflow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,  -- References parent workflow

  -- Node identity
  type VARCHAR(50) NOT NULL,  -- 'user-input', 'planning', 'writing', 'gate', 'loop', 'subworkflow', 'api-call', 'parallel-split', 'parallel-join'
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Canvas position
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,

  -- Node configuration
  agent VARCHAR(255),  -- Agent name (optional for user-input)
  skill VARCHAR(255),  -- Skill name (optional)
  sub_workflow_id UUID,  -- For subworkflow type

  -- Gate-specific
  gate_condition TEXT,  -- JSONPath condition

  -- Loop-specific
  max_iterations INTEGER DEFAULT 10,

  -- API-specific
  api_url TEXT,
  api_method VARCHAR(10),
  api_headers JSONB,

  -- User input fields
  input_fields JSONB,  -- Array of field definitions

  -- General data
  config JSONB,  -- Additional configuration

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create edges table for connections
CREATE TABLE IF NOT EXISTS workflow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,

  -- Connection
  source_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,

  -- Edge type and routing
  type VARCHAR(50) DEFAULT 'default',  -- 'default', 'conditional', 'loop-back'
  label VARCHAR(255),  -- Display text (e.g., "Pass", "Fail", "Retry")
  condition TEXT,  -- JSONPath condition for conditional edges

  -- Visual styling
  animated BOOLEAN DEFAULT FALSE,
  style JSONB,  -- Custom edge styling

  created_at TIMESTAMP DEFAULT NOW()
);

-- Update workflows table to use graph structure
ALTER TABLE workflows
  DROP COLUMN IF EXISTS steps,
  ADD COLUMN IF NOT EXISTS graph_version INTEGER DEFAULT 2;  -- Version 2 = graph-based

-- Indexes
CREATE INDEX idx_workflow_nodes_workflow ON workflow_nodes(workflow_id);
CREATE INDEX idx_workflow_nodes_type ON workflow_nodes(type);
CREATE INDEX idx_workflow_edges_workflow ON workflow_edges(workflow_id);
CREATE INDEX idx_workflow_edges_source ON workflow_edges(source_node_id);
CREATE INDEX idx_workflow_edges_target ON workflow_edges(target_node_id);

-- Comments
COMMENT ON TABLE workflow_nodes IS 'Graph-based workflow nodes (n8n-style)';
COMMENT ON TABLE workflow_edges IS 'Connections between workflow nodes with conditional routing';
```

## React Flow Integration

### Current (Sequential)
```typescript
// Edges auto-generated from array order
for (let i = 0; i < phases.length - 1; i++) {
  edges.push({ source: phases[i].id, target: phases[i+1].id });
}
```

### New (Graph-Based)
```typescript
// Edges explicitly defined, can be created/deleted by user
const edges = workflow.edges.map(edge => ({
  id: edge.id,
  source: edge.source_node_id,
  target: edge.target_node_id,
  type: edge.type,
  label: edge.label,
  animated: edge.animated,
  data: { condition: edge.condition }
}));

// User can drag from one node's output handle to another's input
onConnect={(connection) => createEdge(connection)}
```

## UI Changes

### Add Node
- Same dialog, but node placed at position
- No longer appends to array
- Can place anywhere on canvas

### Delete Node
- Right-click node → Delete
- Removes node AND all connected edges
- Asks for confirmation

### Connect Nodes
- Drag from output handle (right side of node)
- Drop on input handle (left side of node)
- Creates edge in database
- For gates: Choose edge type (Pass/Fail)

### Edit Edge
- Click edge → Edit dialog
- Set label (e.g., "Pass", "Fail  - Loop Back")
- Set condition (for conditional edges)
- Set visual style

### Delete Edge
- Select edge → Delete key
- Or right-click edge → Delete

## Execution Engine Changes

### Current (Sequential)
```typescript
for (const phase of workflow.phases_json) {
  await executePhase(phase);
}
```

### New (Graph Traversal)
```typescript
// Find start nodes (nodes with no incoming edges)
const startNodes = findStartNodes(workflow.nodes, workflow.edges);

// Execute graph using topological sort or BFS
await executeWorkflow(startNodes, workflow.nodes, workflow.edges);

async function executeWorkflow(currentNodes, allNodes, edges) {
  for (const node of currentNodes) {
    const result = await executeNode(node);

    // Find outgoing edges
    const outgoingEdges = edges.filter(e => e.source_node_id === node.id);

    // Evaluate conditions
    const nextNodes = outgoingEdges
      .filter(edge => evaluateCondition(edge.condition, result))
      .map(edge => allNodes.find(n => n.id === edge.target_node_id));

    // Continue execution
    if (nextNodes.length > 0) {
      await executeWorkflow(nextNodes, allNodes, edges);
    }
  }
}
```

## Migration Path

1. ✅ Create new database schema (migration 005)
2. ✅ Update MCP workflow server to support nodes/edges
3. ✅ Rewrite WorkflowCanvas component
4. ✅ Enable drag-to-connect functionality
5. ✅ Add delete node/edge capabilities
6. ✅ Update execution engine for graph traversal
7. ✅ Add conditional edge evaluation
8. ✅ Support loops and parallel execution

## Benefits

✅ **Flexible Routing**: Branch based on quality scores, user input, API results
✅ **Retry Logic**: Loop back to previous steps on failure
✅ **Parallel Processing**: Generate multiple chapters simultaneously
✅ **Reusable Workflows**: Compose workflows from sub-workflows
✅ **Visual Clarity**: See the entire process flow at a glance
✅ **Scalable**: Handle complex multi-step author pipelines
✅ **Future-Proof**: Easy to add new node types (payment, publishing, distribution)

## Example: Complete Author Pipeline

```
User Input (Book Idea)
  ↓
Brainstorm Series (5 books) → Market Research
  ↓ (pass)                        ↓ (fail)
Series Plan                    Refine Concept (loop back)
  ↓
For Each Book (loop)
  ├→ Outline Chapters
  ├→ Write Chapters (parallel 1-10)
  ├→ Edit & Revise
  ├→ Quality Gate (NPE score >= 80)
  │    ↓ (fail)
  │  Revision Loop
  └→ Finalize Book
  ↓
Marketing Workflow
  ├→ Generate Cover Art (Leonardo API)
  ├→ Create Audio Samples (Eleven Labs)
  ├→ Write Blurb & Metadata
  └→ Social Media Content
  ↓
Publish to Platform
  ↓
Monitor & Analytics
```

This architecture supports the entire author-to-publication pipeline with full flexibility for branching, loops, and parallel processing.
