# FictionLab Workflow System - Complete Analysis & Implementation Plan

**Date:** 2025-12-13
**Status:** Repository Analysis Complete, Implementation Ready

---

## 1. Repository Analysis

### Current State

**FictionLab** (formerly MCP-Electron-App) is a working Electron application with:

✅ **Working Infrastructure:**
- Electron main process (src/main/)
- Plugin system with registry and loader
- PostgreSQL database connection
- Basic workflow engine (src/main/workflow-engine.ts)
- IPC handlers for renderer communication
- Logger system with categories

✅ **Existing Directories:**
- `.claude/agents/` - 12+ agent markdown files
- `.claude/skills/` - 7+ skill markdown files
- `.claude/genre-packs/` - Genre pack templates and examples
- `src/main/handlers/` - Import handlers placeholder

✅ **Key Technologies:**
- TypeScript (ES2020)
- Electron 28
- PostgreSQL + pg driver
- fs-extra for file operations
- Simple Git for repository operations

### Missing Infrastructure (To Build)

❌ **Workflow System:**
- No visual workflow graph generation
- No nested workflow support (sub-workflows)
- No agent/skill dependency resolution
- No Claude Code integration/execution
- No quality gate handling
- No approval gate handling
- No MCP database schemas (workflow-manager)

❌ **Parser System:**
- No workflow YAML/JSON parser
- No agent markdown parser
- No skill markdown parser (YAML frontmatter)
- No dependency extractor

❌ **UI Components:**
- No workflow visual editor
- No drill-down navigation (3-level)
- No execution state visualization
- No React Flow integration

---

## 2. Complete TypeScript Type System

### Core Workflow Types

```typescript
// src/types/workflow.ts

/**
 * Phase types in the workflow
 */
export type PhaseType = 'planning' | 'gate' | 'writing' | 'loop' | 'user' | 'subworkflow';

/**
 * Workflow execution status
 */
export type WorkflowStatus = 'draft' | 'ready' | 'in_progress' | 'paused' | 'complete' | 'failed';

/**
 * Phase execution status
 */
export type PhaseStatus = 'pending' | 'running' | 'complete' | 'failed' | 'blocked' | 'skipped';

/**
 * Gate result
 */
export type GateResult = 'pass' | 'fail' | 'pending';

/**
 * Individual phase in a workflow
 */
export interface WorkflowPhase {
  id: number;
  name: string;
  fullName: string;
  type: PhaseType;
  agent: string;                    // Which agent executes this phase
  skill?: string;                   // Which skill the agent invokes
  subWorkflowId?: string;           // ID of sub-workflow (for subworkflow type)
  description: string;
  process: string[];                // Steps in this phase
  output: string;                   // What this phase produces
  mcp: string;                      // MCP interactions
  gate: boolean;                    // Is this a quality gate?
  gateCondition?: string;           // Condition to pass gate
  requiresApproval: boolean;        // User approval required?
  position: { x: number; y: number }; // Canvas position
}

/**
 * Dependencies discovered from workflow
 */
export interface WorkflowDependencies {
  agents: string[];                 // Agent markdown files needed
  skills: string[];                 // Skills needed (in ~/.claude/skills/)
  mcpServers: string[];             // MCP servers required
  subWorkflows?: string[];          // Nested workflows
}

/**
 * Complete workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  phases: WorkflowPhase[];
  dependencies: WorkflowDependencies;
  metadata: {
    author?: string;
    created: string;
    updated: string;
    tags?: string[];
  };
}

/**
 * Workflow graph representation (for React Flow)
 */
export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata: WorkflowMetadata;
}

export interface WorkflowNode {
  id: string;
  type: PhaseType;
  label: string;
  agent: string;
  skill?: string;
  subWorkflowId?: string;
  data: {
    phase: WorkflowPhase;
    status?: PhaseStatus;
  };
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: 'sequential' | 'conditional' | 'loop';
  condition?: string;
  label?: string;
}

export interface WorkflowMetadata {
  workflowId: string;
  workflowName: string;
  version: string;
  breadcrumb?: string[];  // For drill-down navigation
}

/**
 * Workflow execution instance
 */
export interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  currentPhase: number;
  startedAt: Date;
  completedAt?: Date;
  context: Record<string, any>;     // Execution context
  checkpoints: WorkflowCheckpoint[];
}

/**
 * Checkpoint for resume capability
 */
export interface WorkflowCheckpoint {
  id: string;
  instanceId: string;
  phaseId: number;
  state: Record<string, any>;
  createdAt: Date;
}

/**
 * Phase execution record
 */
export interface PhaseExecution {
  id: string;
  instanceId: string;
  phaseId: number;
  status: PhaseStatus;
  startedAt: Date;
  completedAt?: Date;
  output?: Record<string, any>;
  error?: string;
}

/**
 * Quality gate execution
 */
export interface QualityGate {
  id: string;
  instanceId: string;
  phaseId: number;
  gateType: string;                 // 'npe_validation', 'commercial_validation', 'user_approval'
  criteria: string;
  result: GateResult;
  score?: number;
  details?: Record<string, any>;
  createdAt: Date;
}
```

### Agent & Skill Types

```typescript
// src/types/agent.ts

/**
 * Agent frontmatter from markdown
 */
export interface AgentFrontmatter {
  name: string;
  description: string;
  tools: string[];
  autonomy: number;                 // 1-10
}

/**
 * Parsed agent definition
 */
export interface AgentDefinition {
  filePath: string;
  frontmatter: AgentFrontmatter;
  content: string;                  // Markdown content
  skillInvocations: SkillInvocation[];
}

/**
 * Skill invocation detected in agent markdown
 */
export interface SkillInvocation {
  skillName: string;
  slashCommand: string;             // e.g., "/series-planning"
  context: string;                  // When agent invokes this skill
}
```

```typescript
// src/types/skill.ts

/**
 * Skill metadata from frontmatter
 */
export interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  phase: string;                    // 'planning', 'writing', etc.
  mcps: string[];                   // MCP servers required
}

/**
 * Skill phase (multi-phase skills)
 */
export interface SkillPhase {
  id: number;
  name: string;
  objectives: string[];
  mcpOperations: MCPOperation[];
  requiresApproval: boolean;
}

/**
 * MCP operation in skill
 */
export interface MCPOperation {
  server: string;                   // Which MCP server
  operation: string;                // Operation name
  requiresApproval: boolean;
}

/**
 * Complete skill definition
 */
export interface SkillDefinition {
  filePath: string;
  metadata: SkillMetadata;
  phases: SkillPhase[];
  content: string;                  // Full markdown content
}
```

### MCP Types

```typescript
// src/types/mcp-workflow-manager.ts

/**
 * Workflow Manager MCP database schema types
 */

export interface MCPWorkflow {
  id: string;
  name: string;
  version: string;
  graph_json: string;               // Serialized graph
  created_at: Date;
}

export interface MCPWorkflowInstance {
  id: string;
  workflow_id: string;
  status: WorkflowStatus;
  current_phase: number;
  started_at: Date;
  completed_at?: Date;
}

export interface MCPPhaseExecution {
  id: string;
  instance_id: string;
  phase_id: number;
  status: PhaseStatus;
  started_at: Date;
  completed_at?: Date;
  output_json?: string;
}

export interface MCPQualityGate {
  id: string;
  instance_id: string;
  phase_id: number;
  gate_type: string;
  criteria: string;
  result: GateResult;
  score?: number;
  created_at: Date;
}

export interface MCPCheckpoint {
  id: string;
  instance_id: string;
  phase_id: number;
  state_json: string;
  created_at: Date;
}
```

---

## 3. Architecture Layers

### Layer 1: Workflows (Visual Graphs)

**Files to Create:**
- `src/main/workflow-parser.ts` - Parse YAML/JSON to WorkflowDefinition
- `src/main/workflow-graph-generator.ts` - Convert definition to graph
- `src/renderer/components/WorkflowCanvas.tsx` - React Flow canvas
- `src/renderer/components/WorkflowNode.tsx` - Custom node components

**Workflow File Format:**

```yaml
# workflows/12-phase-novel-pipeline.yaml
name: "12-Phase Novel Writing Pipeline"
version: "1.0.0"
description: "Complete workflow from concept to published 5-book series"

phases:
  - id: 0
    name: "Premise Development"
    type: planning
    agent: brainstorming-agent
    skill: null
    description: "Analyzes market trends and generates high-concept pitches"
    requiresApproval: false

  - id: 1
    name: "Genre Pack Management"
    type: planning
    agent: market-research-agent
    skill: market-driven-planning-skill
    description: "Ensures correct genre pack is loaded or created"
    requiresApproval: false

  # ... (full 12 phases from HTML)

dependencies:
  agents:
    - brainstorming-agent
    - market-research-agent
    - series-architect-agent
    - npe-series-validator-agent
    - commercial-validator-agent
    - miranda-showrunner
    - bailey-first-drafter
  skills:
    - market-driven-planning-skill
    - series-planning-skill
    - book-planning-skill
    - chapter-planning-skill
    - scene-writing-skill
  mcpServers:
    - workflow-manager
    - author-server
    - series-planning-server
    - character-planning-server
    - core-continuity-server
```

### Layer 2: Agents (Orchestration)

**Agents determine WHAT to do**

Example: [market-research-agent.md](file:///c%3A/github/MCP-Electron-App/.claude/agents/market-research-agent.md:1-990)
- Decides when to invoke `/market-driven-planning-skill`
- Determines if genre pack needs creation
- Chooses which tropes to research

**Parser Responsibilities:**
- Extract frontmatter (name, description, tools, autonomy)
- Detect skill invocations (search for `/skill-name` patterns)
- Parse agent markdown into AgentDefinition

### Layer 3: Skills (Execution)

**Skills define HOW to do it**

Example: [series-planning-skill.md](file:///c%3A/github/MCP-Electron-App/.claude/skills/series-planning-skill.md:1-1135)
- 6-phase process
- MCP operations with approval gates
- Detailed instructions for Claude Code

**Parser Responsibilities:**
- Extract frontmatter metadata
- Parse phase structure
- Identify MCP operations
- Detect approval requirements

### Layer 4: MCP Servers (Data Persistence)

**MCP Workflow Manager Schema:**

```sql
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workflow_instances (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'in_progress', 'paused', 'complete', 'failed'
  current_phase INTEGER NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

CREATE TABLE phase_executions (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  phase_id INTEGER NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'running', 'complete', 'failed', 'blocked'
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  output_json TEXT,
  error TEXT,
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id)
);

CREATE TABLE quality_gates (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  phase_id INTEGER NOT NULL,
  gate_type TEXT NOT NULL,  -- 'npe_validation', 'commercial_validation', 'user_approval'
  criteria TEXT NOT NULL,
  result TEXT NOT NULL,  -- 'pass', 'fail', 'pending'
  score INTEGER,
  details_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id)
);

CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  phase_id INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id)
);
```

---

## 4. Execution Flow

### Import Workflow (User Action)

```
User: fictionlab import 12-phase-novel-pipeline.yaml

FictionLab:
  1. Parse workflow YAML → WorkflowDefinition
  2. Discover dependencies (agents, skills, MCPs)
  3. Check what's installed:
     - Agents: Check FictionLabUserData/agents/
     - Skills: Check ~/.claude/skills/
     - MCPs: Check databases exist
  4. Install missing:
     - Download/copy agents to FictionLabUserData/agents/
     - Copy skills to ~/.claude/skills/
     - Initialize MCP databases (if needed)
  5. Generate graph: WorkflowDefinition → WorkflowGraph
  6. Store in workflow-manager.db
  7. Display success message with visual preview
```

### Execute Workflow (User Action)

```
User: fictionlab execute 12-phase-novel-pipeline

FictionLab:
  1. Load workflow from workflow-manager.db
  2. Create workflow_instance (status: 'in_progress', current_phase: 0)
  3. For each phase:
     a. Update current_phase
     b. Create phase_execution (status: 'running')
     c. Load agent markdown for phase
     d. Determine which skill to invoke (from agent)
     e. Call Claude Code headless:
        claude -p "Execute [phase]: [agent instructions]" --output-format json
     f. Skill executes multi-phase process:
        - Queries MCP for context
        - Performs operations
        - Requests user approval (pauses execution)
        - Writes to MCP (after approval)
     g. Update phase_execution (status: 'complete', output_json)
     h. If quality gate:
        - Record quality_gate
        - Check criteria
        - If fail → return to previous phase
        - If pass → proceed
     i. If user approval gate:
        - Pause execution (status: 'paused')
        - Wait for user approval
        - Resume or reject
  4. Complete workflow_instance (status: 'complete')
```

### Nested Workflows

```
Phase 3: Series Architect
  ↓
  Detected: subWorkflowId = "series-architect-6-phase"
  ↓
  Drill into sub-workflow:
    - Load series-architect-6-phase.yaml
    - Execute phases 1-6
    - Return to parent workflow
  ↓
  Breadcrumb: "12-Phase Pipeline > Phase 3: Series Architect > Phase 2: Character Planning"
```

---

## 5. Implementation Phases

### Phase 1: Core Infrastructure ✅ (Mostly Exists)

**What Exists:**
- Electron main process
- TypeScript compilation
- Basic workflow engine
- PostgreSQL connection

**What's Needed:**
- Workflow Manager MCP SQLite database (NOT PostgreSQL)
- File path configuration (FictionLabUserData)

### Phase 2: Parser & Dependency Resolver (PRIORITY 1)

**Files to Create:**
1. `src/main/parsers/workflow-parser.ts`
   - Parse YAML workflow → WorkflowDefinition
   - Extract dependencies

2. `src/main/parsers/agent-parser.ts`
   - Parse agent markdown → AgentDefinition
   - Extract frontmatter + skill invocations

3. `src/main/parsers/skill-parser.ts`
   - Parse skill markdown → SkillDefinition
   - Extract metadata + phases

4. `src/main/dependency-resolver.ts`
   - Discover all dependencies recursively
   - Check what's installed vs. missing
   - Generate installation plan

### Phase 3: Workflow Manager MCP (PRIORITY 2)

**Files to Create:**
1. `src/main/mcp/workflow-manager-mcp.ts`
   - SQLite database operations
   - Initialize schema
   - CRUD for workflows, instances, phases, gates, checkpoints

2. `src/main/mcp/workflow-executor.ts`
   - Execute workflow instances
   - Handle phase transitions
   - Manage quality gates
   - Handle approval gates

### Phase 4: Claude Code Integration (PRIORITY 3)

**Files to Create:**
1. `src/main/claude-code-executor.ts`
   - Spawn Claude Code headless processes
   - Pass agent + skill context
   - Parse JSON output
   - Handle errors

2. `src/main/claude-code-bridge.ts`
   - Map agent instructions to Claude Code prompts
   - Handle skill invocation
   - Monitor execution progress

### Phase 5: Import System (PRIORITY 4)

**Files to Create:**
1. `src/main/import/workflow-importer.ts`
   - Import workflow YAML
   - Resolve dependencies
   - Install missing components
   - Register workflow in MCP

2. `src/main/import/component-installer.ts`
   - Install agents to FictionLabUserData/agents/
   - Install skills to ~/.claude/skills/
   - Initialize MCP databases

### Phase 6: Visual Editor (PRIORITY 5)

**Files to Create:**
1. `src/renderer/components/WorkflowCanvas.tsx`
   - React Flow integration
   - Three-level drill-down
   - Node rendering (planning, gate, writing, loop)
   - Edge rendering

2. `src/renderer/components/WorkflowNode.tsx`
   - Custom node components
   - Execution state visualization
   - Click handlers for drill-down

3. `src/renderer/components/WorkflowBreadcrumb.tsx`
   - Navigation breadcrumb
   - Level transitions

---

## 6. File Structure

```
c:\github\MCP-Electron-App\
├── src\
│   ├── main\
│   │   ├── parsers\
│   │   │   ├── workflow-parser.ts       [NEW]
│   │   │   ├── agent-parser.ts          [NEW]
│   │   │   └── skill-parser.ts          [NEW]
│   │   ├── mcp\
│   │   │   ├── workflow-manager-mcp.ts  [NEW]
│   │   │   └── workflow-executor.ts     [NEW]
│   │   ├── claude-code\
│   │   │   ├── executor.ts              [NEW]
│   │   │   └── bridge.ts                [NEW]
│   │   ├── import\
│   │   │   ├── workflow-importer.ts     [NEW]
│   │   │   └── component-installer.ts   [NEW]
│   │   ├── dependency-resolver.ts       [NEW]
│   │   └── workflow-engine.ts           [EXISTS - needs upgrade]
│   ├── renderer\
│   │   └── components\
│   │       ├── WorkflowCanvas.tsx       [NEW]
│   │       ├── WorkflowNode.tsx         [NEW]
│   │       └── WorkflowBreadcrumb.tsx   [NEW]
│   └── types\
│       ├── workflow.ts                  [NEW]
│       ├── agent.ts                     [NEW]
│       ├── skill.ts                     [NEW]
│       └── mcp-workflow-manager.ts      [NEW]
├── .claude\
│   ├── agents\                          [EXISTS]
│   ├── skills\                          [EXISTS]
│   └── genre-packs\                     [EXISTS]
└── workflows\
    └── library\                         [NEW - bundled workflows]
        ├── 12-phase-novel-pipeline.yaml
        └── README.md
```

---

## 7. Test Suite (Phase 0)

### Test 1: Skill Detection

```bash
# Create test skill
mkdir -p ~/.claude/skills/test-skill
cat << 'EOF' > ~/.claude/skills/test-skill/SKILL.md
---
name: test-skill
description: Test skill for validation
---
# Test Skill
When invoked, respond with "Skill system operational!"
EOF

# Test Claude Code execution
claude -p "Test if skills are working" --output-format json
# Expected: Claude autonomously invokes test-skill
```

### Test 2: Multi-Phase Workflow

```bash
# Copy skill
cp .claude/skills/series-planning-skill.md ~/.claude/skills/series-planning-skill/SKILL.md

# Test multi-turn execution
SESSION=$(claude -p "Start series planning for urban fantasy" --output-format json | jq -r '.session_id')
claude --resume "$SESSION" -p "Move to Phase 2" --output-format json
# Expected: Maintains context across phases
```

### Test 3: Agent Invoking Skill

```bash
# Simulate agent behavior
claude -p "You are the Market Research Agent. Check if a genre pack exists for gothic romance. If not, research and create one." --output-format json
# Expected: Claude uses web search + creates files
```

---

## 8. Success Criteria

```bash
# End-to-end test
$ fictionlab import workflows/library/12-phase-novel-pipeline.yaml
# Expected output:
✓ Parsed workflow: 12-Phase Novel Writing Pipeline (v1.0.0)
✓ Discovered dependencies:
  - Agents: 7 (5 exist, 2 need installation)
  - Skills: 5 (3 exist, 2 need installation)
  - MCP Servers: 5 (all initialized)
✓ Installing missing components...
  - Copied skills to ~/.claude/skills/
  - Saved agents to FictionLabUserData/agents/
  - Initialized workflow-manager.db
✓ Generated visual graph (12 phases)
✓ Workflow ready to execute

$ fictionlab execute 12-phase-novel-pipeline
# Expected output:
✓ Workflow instance created: inst_abc123
✓ Executing Phase 0: Premise Development...
  - Agent: Brainstorming Agent
  - Status: Running
✓ Phase 0 complete
✓ Executing Phase 1: Genre Pack Management...
  - Agent: Market Research Agent
  - Skill: market-driven-planning-skill
  - Status: Running
⏸ Paused at Phase 7: User Approval (waiting for confirmation)

$ fictionlab visualize 12-phase-novel-pipeline
# Expected:
Opens React Flow canvas showing:
- 12 phases as nodes
- Current execution state (Phase 7, waiting for approval)
- Click "Phase 3: Series Architect" → drills into 6-phase sub-workflow
- Breadcrumb: "12-Phase Pipeline > Phase 3: Series Architect"
```

---

## 9. Next Steps

### Immediate Priorities (This Session)

1. ✅ **Repository Analysis** - COMPLETE
2. **Define TypeScript Types** - IN PROGRESS
3. **Workflow Parser Prototype** - Extract 12-phase pipeline from HTML
4. **Workflow Manager MCP Schema** - SQLite database
5. **Dependency Resolver** - Find all agents/skills/MCPs
6. **Import Function Prototype** - End-to-end import test

### Deliverables Today

1. Complete TypeScript type definitions
2. Working workflow parser (HTML → WorkflowDefinition)
3. Workflow Manager MCP database with schema
4. Dependency resolver that finds missing components
5. Import function that can import one workflow
6. Phase 0 test suite scripts
7. README with usage examples

---

## 10. Key Insights

### Existing Workflow Engine

**Current (workflow-engine.ts):**
- Designed for plugin-based workflows
- Uses PostgreSQL for storage
- Executes steps via IPC to plugins
- Good foundation but NOT what we need

**What We Need:**
- **Workflow Manager MCP** using **SQLite** (not PostgreSQL)
- Execution via **Claude Code headless** (not plugin IPC)
- **Agent-skill orchestration** (not direct plugin calls)
- **Quality gates and approval gates**
- **Nested sub-workflows**

**Strategy:** Create parallel workflow system, keep existing engine intact.

### Agent-Skill-MCP Relationship

**Workflow Phase** defines:
- Which **Agent** executes the phase

**Agent** determines:
- When to invoke which **Skill**
- Based on agent's markdown instructions

**Skill** defines:
- Multi-phase execution process
- **MCP** operations with approvals

**Claude Code** reads:
- Skill markdown from `~/.claude/skills/`
- Executes autonomously
- Manages MCP interactions

### File Locations

**Bundled with FictionLab:**
- `.claude/agents/` (reference agents)
- `.claude/skills/` (reference skills)
- `workflows/library/` (reference workflows)

**User Data (runtime):**
- `FictionLabUserData/agents/` (imported agents)
- `FictionLabUserData/workflows/` (imported workflows)
- `~/.claude/skills/` (installed skills - where Claude Code finds them)
- `FictionLabUserData/db/workflow-manager.db` (SQLite database)

---

**STATUS: Ready to implement. All analysis complete.**
