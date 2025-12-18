# FictionLab Workflow System - Requirements Gap Analysis

**Date:** 2025-12-15 (UPDATED)
**Status:** Comprehensive assessment with accurate implementation status

---

## 🎯 Core Requirements

0. **CRITICAL BUGFIXES** - Fix blocking issues (position saving)
1. **Import workflows from folders** (marketplace-ready)
2. **Create visual workflow graphs** (list, select, visualize)
2A. **WORKFLOW PORTABILITY** - Export to Claude Code, OpenAI, other platforms
3. **Run workflows** (execute with Claude Code)
4. **Visualize execution status** (real-time agent positions)
5. **Edit workflows with version control** (update skills/agents)
7. **MARKETPLACE & SHARING** - Local and cloud workflow sharing
8. **EXECUTION ENHANCEMENTS** - Resume, progress, loops, gates

---

## 🐛 REQUIREMENT 0: CRITICAL BUGFIXES

### What's BROKEN ⚠️

**Position Saving Bug (CRITICAL)**
- **Location:** `src/renderer/components/WorkflowCanvas.tsx:213-216`
- **Status:** Positions NOT being saved when user drags nodes
- **Root Cause:** `onNodeDragStop` reads from `nodesRef.current` which contains STALE positions
  - `nodesRef` only updates when `nodesWithStatus` recomputes
  - `nodesWithStatus` only depends on `baseNodes` and `executionStatus`
  - When user drags node, React Flow updates positions internally
  - But dependency chain doesn't trigger recompute → ref stays stale
  - Save operation sends old positions to database

### What's NEEDED ❌

**Priority:** CRITICAL (blocks basic drag-to-arrange functionality)
**Estimated Effort:** 30 minutes

**Fix:** Use React Flow's current state parameter instead of stale ref

```typescript
// File: src/renderer/components/WorkflowCanvas.tsx, lines 207-223
// CHANGE THIS:
const onNodeDragStop: NodeDragHandler = useCallback(
  (_event, _node) => {
    if (!workflow) return;
    const positions: Record<string, { x: number; y: number }> = {};
    nodesRef.current.forEach(node => {  // ❌ STALE DATA
      const phaseId = (node.data as PhaseNodeData).phase.id;
      positions[phaseId] = { x: node.position.x, y: node.position.y };
    });
    savePositions(workflow.id, positions);
  },
  [workflow, savePositions]
);

// TO THIS:
const onNodeDragStop: NodeDragHandler = useCallback(
  (_event, _node, currentNodes) => {  // ✅ Use third parameter
    if (!workflow) return;
    const positions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach(node => {  // ✅ Current React Flow state
      const phaseId = (node.data as PhaseNodeData).phase.id;
      positions[phaseId] = { x: node.position.x, y: node.position.y };
    });
    savePositions(workflow.id, positions);
  },
  [workflow, savePositions]
);
```

**Impact:** Once fixed, positions will save correctly to database via MCP server

---

## ✅ REQUIREMENT 1: Import Workflows from Folders

### What's DONE ✅

**Type System:**
- ✅ `WorkflowDefinition` - Complete structure
- ✅ `WorkflowDependencies` - Agents, skills, MCPs, sub-workflows
- ✅ `InstallationPlan` - Tracks what needs installing
- ✅ `WorkflowImportResult` - Import operation result

**Parser:**
- ✅ `WorkflowParser` (src/main/parsers/workflow-parser.ts) - Parses YAML, JSON, HTML
- ✅ Dependency extraction from phases
- ✅ Export to YAML/JSON

**Import System (FULLY IMPLEMENTED!):**
- ✅ **FolderImporter** (src/main/workflow/folder-importer.ts) - Complete workflow import
- ✅ **DependencyResolver** (src/main/workflow/dependency-resolver.ts) - Checks installed components
- ✅ **WorkflowImportDialog** (src/renderer/components/WorkflowImportDialog.tsx) - UI component
- ✅ Component installation to correct paths (agents → userData/agents, skills → ~/.claude/skills)
- ✅ IPC handler `workflow:import-from-folder`
- ✅ Database recording in workflow_imports table

**Infrastructure:**
- ✅ Plugin system with component installation
- ✅ File operations (fs-extra)
- ✅ User data paths (Electron userData)

### What's NEEDED ❌

**Priority:** LOW (core functionality complete, only polish needed)

**1. Marketplace Folder Structure (ALREADY DEFINED)**
```
marketplace/
├── workflows/
│   └── 12-phase-novel-pipeline/
│       ├── workflow.yaml           # Workflow definition
│       ├── README.md               # Description, author, screenshots
│       ├── agents/                 # Bundled agents
│       │   ├── market-research-agent.md
│       │   └── series-architect-agent.md
│       ├── skills/                 # Bundled skills
│       │   ├── series-planning-skill.md
│       │   └── book-planning-skill.md
│       └── metadata.json           # Version, tags, dependencies
```

**2. Folder Import System** (`src/main/import/folder-importer.ts`)
```typescript
class FolderImporter {
  // Scan marketplace folder
  async scanMarketplaceFolder(folderPath: string): Promise<WorkflowPackage>

  // Import complete workflow package
  async importWorkflowPackage(packagePath: string): Promise<WorkflowImportResult>

  // Install dependencies
  async installAgents(agents: string[], sourcePath: string): Promise<void>
  async installSkills(skills: string[], sourcePath: string): Promise<void>
  async initializeMCPs(mcps: string[]): Promise<void>
}

interface WorkflowPackage {
  workflow: WorkflowDefinition;
  metadata: PackageMetadata;
  bundledAgents: string[];
  bundledSkills: string[];
  readme: string;
}

interface PackageMetadata {
  name: string;
  version: string;
  author: string;
  description: string;
  tags: string[];
  screenshots?: string[];
  changelog?: string;
}
```

**3. Dependency Resolver** (`src/main/dependency-resolver.ts`)
```typescript
class DependencyResolver {
  // Check what's installed vs. missing
  async resolveDependencies(
    workflow: WorkflowDefinition,
    packagePath?: string
  ): Promise<DependencyCheckResult[]>

  // Find agents
  async findAgent(name: string): Promise<AgentInstallStatus>

  // Find skills
  async findSkill(name: string): Promise<SkillInstallStatus>

  // Check MCPs
  async checkMCPServer(name: string): Promise<boolean>
}
```

**4. Component Installer** (`src/main/import/component-installer.ts`)
```typescript
class ComponentInstaller {
  // Install to correct locations
  async installAgent(source: string, agentName: string): Promise<void>
  // → FictionLabUserData/agents/{agentName}.md

  async installSkill(source: string, skillName: string): Promise<void>
  // → ~/.claude/skills/{skillName}/SKILL.md

  async initializeMCPDatabase(mcpName: string): Promise<void>
  // → FictionLabUserData/db/{mcpName}.db
}
```

**5. IPC Handlers** (`src/main/handlers/import-handlers.ts`)
```typescript
// Renderer → Main process communication
ipcMain.handle('workflow:import-folder', async (event, folderPath) => {
  const importer = new FolderImporter();
  return await importer.importWorkflowPackage(folderPath);
});

ipcMain.handle('workflow:scan-marketplace', async (event, marketplacePath) => {
  // Scan for available workflow packages
  return await scanMarketplaceDirectory(marketplacePath);
});
```

**6. File Paths Configuration** (`src/main/paths.ts` - NEW)
```typescript
export const PATHS = {
  userData: app.getPath('userData'),

  // FictionLab user data
  fictionLabData: path.join(app.getPath('userData'), 'FictionLabUserData'),
  workflows: path.join(app.getPath('userData'), 'FictionLabUserData/workflows'),
  agents: path.join(app.getPath('userData'), 'FictionLabUserData/agents'),
  databases: path.join(app.getPath('userData'), 'FictionLabUserData/db'),

  // Claude Code skills (system-wide)
  claudeSkills: path.join(os.homedir(), '.claude/skills'),

  // Bundled resources (read-only)
  bundledAgents: path.join(process.resourcesPath, '.claude/agents'),
  bundledSkills: path.join(process.resourcesPath, '.claude/skills'),
  bundledWorkflows: path.join(process.resourcesPath, 'workflows/library'),
};
```

### **PRIORITY:** HIGH (Foundation for everything else)

---

## ✅ REQUIREMENT 2: Create Visual Workflow Graphs

### What's DONE ✅

**Type System:**
- ✅ `WorkflowGraph` - Nodes, edges, metadata
- ✅ `WorkflowNode` - Phase visualization data
- ✅ `WorkflowEdge` - Connections with types
- ✅ `WorkflowMetadata` - Breadcrumb navigation

**Parser:**
- ✅ Workflow parsing from multiple formats
- ✅ Phase extraction with positions

**React Flow Visualization (FULLY IMPLEMENTED!):**
- ✅ **WorkflowCanvas.tsx** (src/renderer/components/WorkflowCanvas.tsx) - Complete React Flow integration
- ✅ **Drag-and-drop node positioning** - Live repositioning with mouse
- ⚠️ **Position persistence** - BROKEN (see Requirement 0 for bugfix)
- ✅ **Custom PhaseNode components** (src/renderer/components/nodes/PhaseNode.tsx) - Status colors, icons, badges
- ✅ **WorkflowList** (src/renderer/components/WorkflowList.tsx) - Sidebar with workflow selection
- ✅ **WorkflowsViewReact** (src/renderer/views/WorkflowsViewReact.tsx) - Main view with toolbar
- ✅ **Animated edges** - Green for completed, animated for in-progress
- ✅ **Background grid** with zoom/pan controls
- ✅ **Auto-layout algorithm** - 250px horizontal, 200px vertical spacing
- ✅ **IPC handlers** - `workflow:get-definitions`, `workflow:update-positions`

**Infrastructure:**
- ✅ Renderer process with React support
- ✅ IPC communication (main ↔ renderer)
- ✅ React Flow library installed and configured

### What's NEEDED ❌

**Priority:** MEDIUM (core visualization complete, enhancements needed)

**1. Three-Level Drill-Down UI** (2-3 days)
```typescript
class WorkflowGraphGenerator {
  // Convert WorkflowDefinition → WorkflowGraph
  generateGraph(workflow: WorkflowDefinition): WorkflowGraph

  // Calculate node positions (river layout)
  calculateLayout(phases: WorkflowPhase[]): void

  // Generate edges between phases
  generateEdges(phases: WorkflowPhase[]): WorkflowEdge[]

  // Handle sub-workflows
  expandSubWorkflow(phaseId: number, subWorkflowId: string): WorkflowGraph
}
```

**2. React Flow Canvas** (`src/renderer/components/WorkflowCanvas.tsx`)
```tsx
import ReactFlow, { Node, Edge } from 'reactflow';

interface WorkflowCanvasProps {
  workflowId: string;
  graph: WorkflowGraph;
  onNodeClick: (nodeId: string) => void;
  onDrillDown: (subWorkflowId: string) => void;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflowId,
  graph,
  onNodeClick,
  onDrillDown
}) => {
  // Render React Flow with custom nodes
  // Handle three-level drill-down
  // Show breadcrumb navigation
  // Display execution state
};
```

**3. Custom Node Components** (`src/renderer/components/workflow-nodes/`)
```tsx
// PlanningNode.tsx - Blue node for planning phases
// GateNode.tsx - Orange node for quality gates
// WritingNode.tsx - Green node for writing phases
// LoopNode.tsx - Purple node for loop phases
// UserNode.tsx - Indigo node for user interaction
// SubWorkflowNode.tsx - Expandable node with drill-down
```

**4. Workflow List View** (`src/renderer/views/WorkflowsView.tsx`)
```tsx
export const WorkflowsView: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  // List all workflows from MCP
  useEffect(() => {
    loadWorkflows();
  }, []);

  return (
    <div>
      <WorkflowList
        workflows={workflows}
        onSelect={setSelectedWorkflow}
      />
      {selectedWorkflow && (
        <WorkflowCanvas workflowId={selectedWorkflow} />
      )}
    </div>
  );
};
```

**5. Breadcrumb Navigation** (`src/renderer/components/WorkflowBreadcrumb.tsx`)
```tsx
interface BreadcrumbProps {
  levels: string[];  // ["12-Phase Pipeline", "Phase 3: Series Architect"]
  onNavigate: (index: number) => void;
}

export const WorkflowBreadcrumb: React.FC<BreadcrumbProps> = ({
  levels,
  onNavigate
}) => {
  // Render clickable breadcrumb trail
  // Handle back navigation
};
```

**6. IPC Handlers for Graph Operations**
```typescript
// Get workflow list
ipcMain.handle('workflow:list', async () => {
  return await workflowManagerMCP.listWorkflows();
});

// Get workflow graph
ipcMain.handle('workflow:get-graph', async (event, workflowId) => {
  const workflow = await workflowManagerMCP.getWorkflow(workflowId);
  const generator = new WorkflowGraphGenerator();
  return generator.generateGraph(workflow);
});

// Get sub-workflow graph (drill-down)
ipcMain.handle('workflow:get-subworkflow', async (event, workflowId, phaseId) => {
  return generator.expandSubWorkflow(phaseId, subWorkflowId);
});
```

**7. React Flow Installation**
```bash
npm install reactflow
npm install @types/reactflow --save-dev
```

### **PRIORITY:** HIGH (User-facing core feature)

---

## 🚀 REQUIREMENT 2A: WORKFLOW PORTABILITY (NEW!)

### What's DONE ✅

**Export Capability:**
- ✅ WorkflowParser has `exportToYAML()` and `exportToJSON()` methods
- ✅ MCPWorkflowClient has `exportWorkflowPackage()` method
- ✅ **ClaudeCodeExporter COMPLETE** (src/main/workflow/exporters/claude-code-exporter.ts)
- ✅ Full agent + skill + workflow structure export
- ✅ IPC handlers for renderer integration (3 handlers)
- ✅ Comprehensive documentation (README.md, USAGE_EXAMPLES.md)

**Claude Code Exporter Features:**
- ✅ Exports workflows to `~/.claude/exports/{workflow-name}-{date}/`
- ✅ Copies all referenced agents (from userData/agents/)
- ✅ Copies all referenced skills (from ~/.claude/skills/)
- ✅ Supports both YAML and JSON formats
- ✅ Generates comprehensive README with installation instructions
- ✅ Validates export package structure
- ✅ Lists all exportable workflows with filtering
- ✅ Full error handling and logging
- ✅ Preserves all 15 agents and 8+ skills
- ✅ Works with Claude Code CLI + Task tool

**Export Structure:**
```
~/.claude/exports/{workflow-name}-{date}/
├── workflows/
│   └── {workflow-id}.yaml          # Workflow definition
├── agents/                          # Agent personas (15 total)
│   ├── market-research-agent.md
│   ├── series-architect-agent.md
│   └── ... (all referenced agents)
├── skills/                          # Executable skills (8+ total)
│   ├── series-planning-skill.md
│   ├── book-planning-skill.md
│   └── ... (all referenced skills)
└── README.md                        # Complete documentation
```

**IPC Handlers:**
- ✅ `workflow:export-claude-code` - Export workflow to Claude Code format
- ✅ `workflow:list-exportable` - List all exportable workflows
- ✅ `workflow:validate-export` - Validate export package structure

### What's NEEDED ❌

**Priority:** MEDIUM - Core export complete, only UI integration needed
**Estimated Effort:** 5-7 days

**1. UI Integration** (1-2 days)

Add export functionality to workflow UI:

```typescript
// File: src/renderer/components/WorkflowExportDialog.tsx (NEW)
// - Export dialog component with format/path options
// - Progress tracking during export
// - Success/error feedback

// File: src/renderer/components/WorkflowsViewReact.tsx (MODIFY)
// - Add "Export to Claude Code" button to workflow cards
// - Integrate WorkflowExportDialog
```

**Implementation Steps:**
1. Create WorkflowExportDialog component
2. Add export button to WorkflowsViewReact
3. Wire up IPC calls to backend
4. Add success/error notifications
5. Test with 12-phase pipeline workflow

**2. OpenAI Skills Format Research & Exporter** (2-3 days)

```typescript
// File: src/main/workflow/exporters/openai-exporter.ts (NEW)
class OpenAISkillsExporter {
  async export(workflowId: string, outputPath: string): Promise<void> {
    // 1. Research OpenAI Skills specification (announced Dec 2024)
    // 2. Compare format to Claude Code skills
    // 3. Map workflow phases → OpenAI skills
    // 4. Export with OpenAI-compatible structure
    // 5. Document any incompatibilities
  }
}
```

**3. Generic JSON/YAML Exporter** (1 day)

Universal fallback format for future AI tools:

```typescript
// File: src/main/workflow/exporters/generic-exporter.ts (NEW)
class GenericWorkflowExporter {
  async export(workflowId: string, format: 'json' | 'yaml'): Promise<string> {
    // 1. Export workflow with complete metadata
    // 2. Platform-agnostic structure
    // 3. Include:
    //    - Workflow definition
    //    - All phases with dependencies
    //    - Agent/skill references
    //    - Execution order
    //    - Quality gates
    // 4. Documentation for importing to new platforms
  }
}
```

**4. Export Framework & UI** (2-3 days)

```tsx
// File: src/renderer/components/WorkflowExportDialog.tsx (NEW)
interface ExportPlatform {
  id: string;
  name: string;
  description: string;
  exporter: WorkflowExporter;
}

export const WorkflowExportDialog: React.FC<{
  workflow: WorkflowDefinition;
  onClose: () => void;
}> = ({ workflow, onClose }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('claude-code');
  const [outputPath, setOutputPath] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  const platforms: ExportPlatform[] = [
    { id: 'claude-code', name: 'Claude Code (Full)', description: 'Agents + Skills + Workflows' },
    { id: 'openai-skills', name: 'OpenAI Skills', description: 'Compatible with OpenAI ecosystem' },
    { id: 'json', name: 'Generic JSON', description: 'Universal format for future tools' },
    { id: 'yaml', name: 'Generic YAML', description: 'Human-readable universal format' },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    await window.electron.invoke('workflow:export', {
      workflowId: workflow.id,
      platform: selectedPlatform,
      outputPath
    });
    setIsExporting(false);
    // Show success notification with "Open folder" button
  };

  return (
    <Dialog>
      <h2>Export Workflow: {workflow.name}</h2>

      <PlatformSelector
        platforms={platforms}
        selected={selectedPlatform}
        onChange={setSelectedPlatform}
      />

      <PathSelector
        value={outputPath}
        onChange={setOutputPath}
        placeholder="Select export location..."
      />

      <ExportPreview
        workflow={workflow}
        platform={selectedPlatform}
      />

      <Button onClick={handleExport} disabled={!outputPath || isExporting}>
        {isExporting ? 'Exporting...' : 'Export Workflow'}
      </Button>
    </Dialog>
  );
};
```

**5. Export Manager** (1-2 days)

Plugin-based architecture for exporters:

```typescript
// File: src/main/workflow/exporters/export-manager.ts (NEW)
interface WorkflowExporter {
  platformName: string;
  export(workflow: WorkflowDefinition, options: ExportOptions): Promise<ExportResult>;
  validate(workflow: WorkflowDefinition): ValidationResult;
}

class ExportManager {
  private exporters = new Map<string, WorkflowExporter>();

  registerExporter(exporter: WorkflowExporter): void {
    this.exporters.set(exporter.platformName, exporter);
  }

  async export(workflowId: string, platform: string, options: ExportOptions): Promise<void> {
    const exporter = this.exporters.get(platform);
    if (!exporter) throw new Error(`No exporter for platform: ${platform}`);

    const workflow = await workflowClient.getWorkflowDefinition(workflowId);
    const validation = exporter.validate(workflow);

    if (!validation.isValid) {
      // Warn user about incompatibilities
    }

    await exporter.export(workflow, options);
  }

  getSupportedPlatforms(): string[] {
    return Array.from(this.exporters.keys());
  }
}
```

**6. IPC Handlers** (included in framework)

```typescript
// File: src/main/handlers/workflow-handlers.ts (MODIFY)
ipcMain.handle('workflow:export', async (event, data: {
  workflowId: string;
  platform: string;
  outputPath: string;
}) => {
  return await exportManager.export(data.workflowId, data.platform, {
    outputPath: data.outputPath
  });
});

ipcMain.handle('workflow:get-export-platforms', async () => {
  return exportManager.getSupportedPlatforms();
});
```

**7. Future Platform Research** (1 day - deferred)

- **Antigravity Workflows** - Research format specification
- **MSTY** - Research automation format
- **Typing Mind** - Already has agents/prompts, may be compatible
- Document compatibility and implementation requirements

### **Implementation Priority**

1. **CRITICAL (Now):** Claude Code Full Export (Option C)
2. **HIGH (Next):** OpenAI Skills Export + Generic JSON/YAML
3. **MEDIUM (Later):** Export UI Framework
4. **FUTURE:** Antigravity/MSTY after format research

---

## ✅ REQUIREMENT 3: Run Workflows

### What's DONE ✅

**Type System:**
- ✅ `WorkflowInstance` - Runtime execution state
- ✅ `PhaseExecution` - Individual phase tracking
- ✅ `WorkflowExecutionResult` - Execution outcome
- ✅ Complete MCP workflow-manager types (src/types/mcp-workflow-manager.ts)

**Execution Engine (FULLY IMPLEMENTED!):**
- ✅ **WorkflowExecutor** (src/main/workflow/workflow-executor.ts) - Complete execution engine with EventEmitter
- ✅ **ClaudeCodeExecutor** (src/main/workflow/claude-code-executor.ts) - Headless Claude Code skill execution
- ✅ **MCP Workflow Client** (src/main/workflow/mcp-workflow-client.ts) - 20+ MCP operations
- ✅ **Phase-by-phase execution** - Sequential workflow execution
- ✅ **Quality gate logic** - executeGatePhase (auto-passes currently, needs validation logic)
- ✅ **Approval gates** - executeUserPhase with pause/resume
- ✅ **Sub-workflow execution** - startSubWorkflow via MCP
- ✅ **Version locking** - Prevents editing running workflows
- ✅ **Phase execution tracking** - Updates to database via MCP
- ✅ **Error handling** - Phase failure tracking
- ✅ **IPC events** - phase-started, phase-completed, phase-failed, approval-required

**Infrastructure:**
- ✅ PostgreSQL connection for workflow runs
- ✅ MCP workflow-manager server (SQLite) - External dependency
- ✅ IPC handlers for execution control
- ✅ EventEmitter for real-time UI updates

**Agent/Skill Definitions:**
- ✅ 15 agents in `.claude/agents/` (markdown with YAML frontmatter)
- ✅ 8+ skills in `.claude/skills/` (multi-phase structure)
- ✅ Genre pack system for writing conventions

### What's NEEDED ❌

**Priority:** MEDIUM (core execution works, enhancements needed)

**1. Loop Phase Implementation** (1-2 days)
```typescript
// SQLite database (NOT PostgreSQL)
import Database from 'better-sqlite3';

class WorkflowManagerMCP implements WorkflowManagerMCP {
  private db: Database.Database;

  async initializeDatabase(): Promise<void> {
    // Create tables: workflows, workflow_instances, phase_executions,
    //                quality_gates, checkpoints
  }

  async createInstance(workflowId: string): Promise<string> {
    // Create new workflow_instance
    // Return instance ID
  }

  async startPhase(instanceId: string, phaseId: number): Promise<string> {
    // Create phase_execution record
    // Update instance current_phase
    // Return phase_execution ID
  }

  async completePhase(phaseExecId: string, output: any): Promise<void> {
    // Update phase_execution status
    // Store output
  }

  async recordQualityGate(/* ... */): Promise<void> {
    // Record gate result
  }

  // ... (full interface from mcp-workflow-manager.ts)
}
```

**2. Workflow Executor** (`src/main/mcp/workflow-executor.ts`)
```typescript
class WorkflowExecutor {
  constructor(
    private workflowMCP: WorkflowManagerMCP,
    private claudeCodeExecutor: ClaudeCodeExecutor
  ) {}

  async executeWorkflow(workflowId: string): Promise<WorkflowExecutionResult> {
    // 1. Load workflow from MCP
    const workflow = await this.workflowMCP.getWorkflow(workflowId);

    // 2. Create instance
    const instanceId = await this.workflowMCP.createInstance(workflowId);

    // 3. For each phase:
    for (const phase of workflow.phases) {
      // a. Start phase
      const phaseExecId = await this.workflowMCP.startPhase(instanceId, phase.id);

      // b. Load agent for this phase
      const agent = await this.loadAgent(phase.agent);

      // c. Determine which skill to invoke
      const skill = this.determineSkill(phase, agent);

      // d. Execute via Claude Code
      const result = await this.claudeCodeExecutor.executePhase(
        agent,
        skill,
        phase,
        instanceId
      );

      // e. Handle quality gates
      if (phase.gate) {
        const gateResult = await this.checkQualityGate(phase, result);
        await this.workflowMCP.recordQualityGate({
          instance_id: instanceId,
          phase_id: phase.id,
          gate_type: phase.gateCondition,
          result: gateResult,
          // ...
        });

        if (gateResult === 'fail') {
          // Return to previous phase or fail workflow
          break;
        }
      }

      // f. Handle approval gates
      if (phase.requiresApproval) {
        await this.pauseForApproval(instanceId, phase.id);
        // Wait for user approval (via IPC event)
      }

      // g. Complete phase
      await this.workflowMCP.completePhase(phaseExecId, result);

      // h. Create checkpoint
      await this.workflowMCP.createCheckpoint(instanceId, phase.id, {
        // Current state
      });
    }

    // 4. Complete workflow
    await this.workflowMCP.completeInstance(instanceId, true);
  }

  private async pauseForApproval(instanceId: string, phaseId: number) {
    // Emit IPC event to renderer
    // Update instance status to 'paused'
    // Wait for approval event
  }
}
```

**3. Claude Code Executor** (`src/main/claude-code/executor.ts`)
```typescript
import { spawn } from 'child_process';

class ClaudeCodeExecutor {
  async executePhase(
    agent: AgentDefinition,
    skill: SkillDefinition | null,
    phase: WorkflowPhase,
    instanceId: string
  ): Promise<any> {
    // Build prompt for Claude Code
    const prompt = this.buildPrompt(agent, skill, phase);

    // Spawn Claude Code headless
    const claudeProcess = spawn('claude', [
      '-p', prompt,
      '--output-format', 'json'
    ]);

    // Capture output
    let output = '';
    claudeProcess.stdout.on('data', (data) => {
      output += data.toString();
      // Emit real-time updates via IPC
      this.emitProgress(instanceId, phase.id, data.toString());
    });

    return new Promise((resolve, reject) => {
      claudeProcess.on('close', (code) => {
        if (code === 0) {
          resolve(JSON.parse(output));
        } else {
          reject(new Error(`Claude Code exited with code ${code}`));
        }
      });
    });
  }

  private buildPrompt(
    agent: AgentDefinition,
    skill: SkillDefinition | null,
    phase: WorkflowPhase
  ): string {
    // Construct prompt that tells Claude:
    // 1. You are [agent name]
    // 2. Execute [phase description]
    // 3. Invoke skill [skill name] if applicable
    // 4. Use these MCP servers: [list]

    return `
You are the ${agent.frontmatter.name}.

Your task: ${phase.description}

${skill ? `Invoke the skill: /${skill.metadata.name}` : ''}

Phase details:
${phase.process.join('\n')}

Expected output: ${phase.output}
    `.trim();
  }
}
```

**4. Agent/Skill Parsers** (Read markdown files)

**Agent Parser** (`src/main/parsers/agent-parser.ts`)
```typescript
import matter from 'gray-matter';

class AgentParser {
  async parseAgent(filePath: string): Promise<AgentDefinition> {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data, content: markdown } = matter(content);

    // Extract frontmatter
    const frontmatter: AgentFrontmatter = {
      name: data.name,
      description: data.description,
      tools: data.tools || [],
      autonomy: data.autonomy || 5,
    };

    // Find skill invocations (search for /skill-name patterns)
    const skillInvocations = this.extractSkillInvocations(markdown);

    return {
      filePath,
      frontmatter,
      content: markdown,
      skillInvocations,
    };
  }

  private extractSkillInvocations(markdown: string): SkillInvocation[] {
    const regex = /\/([a-z-]+skill)/gi;
    const matches = markdown.matchAll(regex);

    const invocations: SkillInvocation[] = [];
    for (const match of matches) {
      invocations.push({
        skillName: match[1],
        slashCommand: match[0],
        context: this.extractContext(markdown, match.index),
      });
    }

    return invocations;
  }
}
```

**Skill Parser** (`src/main/parsers/skill-parser.ts`)
```typescript
class SkillParser {
  async parseSkill(filePath: string): Promise<SkillDefinition> {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data, content: markdown } = matter(content);

    // Extract metadata
    const metadata: SkillMetadata = {
      name: data.name,
      description: data.description,
      version: data.metadata?.version || '1.0.0',
      phase: data.metadata?.phase || 'planning',
      mcps: data.metadata?.mcps || [],
    };

    // Extract phases from markdown structure
    const phases = this.extractPhases(markdown);

    return {
      filePath,
      metadata,
      phases,
      content: markdown,
    };
  }

  private extractPhases(markdown: string): SkillPhase[] {
    // Parse markdown to find "## Phase X" sections
    // Extract MCP operations from each phase
    // Determine approval requirements
  }
}
```

**5. IPC Handlers for Execution**
```typescript
ipcMain.handle('workflow:execute', async (event, workflowId) => {
  const executor = new WorkflowExecutor(workflowMCP, claudeCodeExecutor);
  return await executor.executeWorkflow(workflowId);
});

ipcMain.handle('workflow:approve-phase', async (event, instanceId, phaseId) => {
  // Resume workflow after approval
});

ipcMain.handle('workflow:cancel', async (event, instanceId) => {
  // Cancel running workflow
});
```

**6. NPM Dependencies**
```bash
npm install better-sqlite3  # For SQLite MCP
npm install gray-matter     # For YAML frontmatter parsing
npm install @types/better-sqlite3 --save-dev
```

### **PRIORITY:** CRITICAL (Core functionality)

---

## ✅ REQUIREMENT 4: Visualize Execution Status

### What's DONE ✅

**Type System:**
- ✅ `PhaseStatus` - pending, running, complete, failed, blocked
- ✅ `WorkflowStatus` - draft, ready, in_progress, paused, complete, failed
- ✅ `PhaseExecution` - Tracks execution state

**Real-Time Execution Tracking (FULLY IMPLEMENTED!):**
- ✅ **IPC Events** - phase-started, phase-completed, phase-failed, approval-required emitted by WorkflowExecutor
- ✅ **Event Listeners** in WorkflowsViewReact.tsx - Captures and processes execution events
- ✅ **Status Map in UI** - Tracks execution status for each phase
- ✅ **Color-coded Nodes** - Gray (pending), blue (running), green (complete), red (failed)
- ✅ **Pulse Animation** - Current phase pulses to show active execution
- ✅ **Animated Edges** - Edges animate during execution to show flow
- ✅ **EventEmitter Architecture** - WorkflowExecutor emits events as phases progress

**Database Schema:**
- ✅ Defined in `mcp-workflow-manager.ts`
- ✅ Phase execution tracking to database

### What's NEEDED ❌

**Priority:** MEDIUM (basic visualization works, enhancements needed)

**1. User Input & Agent Interaction** (3-4 days) **CRITICAL FOR ACTUAL USE**

During workflow execution, users need to:
- **View agent outputs** - See what the agent produced in each phase
- **Provide input** - Respond to agent questions, provide feedback
- **Approve/reject outputs** - Quality control at approval gates
- **Edit agent outputs** - Refine results before moving to next phase
- **Communicate with running agents** - Send messages during execution

```typescript
// File: src/renderer/components/WorkflowExecutionPanel.tsx (NEW)
interface WorkflowExecutionPanelProps {
  instanceId: string;
  workflow: WorkflowDefinition;
  onApprove: (phaseId: number) => void;
  onReject: (phaseId: number, reason: string) => void;
}

export const WorkflowExecutionPanel: React.FC<WorkflowExecutionPanelProps> = ({
  instanceId,
  workflow,
  onApprove,
  onReject
}) => {
  const [currentPhase, setCurrentPhase] = useState<number | null>(null);
  const [phaseOutput, setPhaseOutput] = useState<string>('');
  const [userInput, setUserInput] = useState<string>('');

  return (
    <div className="execution-panel">
      {/* Current phase info */}
      <PhaseHeader phase={currentPhase} />

      {/* Agent output display */}
      <OutputViewer content={phaseOutput} editable={true} />

      {/* User input area */}
      <InputBox
        value={userInput}
        onChange={setUserInput}
        placeholder="Provide feedback or answer agent questions..."
        onSend={handleSendInput}
      />

      {/* Approval controls */}
      {currentPhase?.requiresApproval && (
        <ApprovalControls
          onApprove={() => onApprove(currentPhase.id)}
          onReject={(reason) => onReject(currentPhase.id, reason)}
        />
      )}

      {/* Live logs */}
      <LogViewer logs={executionLogs} />
    </div>
  );
};
```

**Key Features Needed:**

1. **Output Display** - Show agent outputs in readable format (markdown, text, JSON)
2. **Output Editing** - Allow users to edit agent outputs before approval
3. **Input Prompt** - Detect when agent is asking for input and show prompt
4. **Approval UI** - Clear approve/reject buttons with optional feedback
5. **Live Streaming** - Stream agent output in real-time during execution
6. **Phase History** - Show outputs from previous phases for context
7. **Error Display** - Show errors clearly with retry options

**IPC Handlers Needed:**

```typescript
// Get phase output
ipcMain.handle('workflow:get-phase-output', async (event, instanceId, phaseId) => {
  const output = await workflowMCP.getPhaseOutput(instanceId, phaseId);
  return output;
});

// Send user input to running agent
ipcMain.handle('workflow:send-user-input', async (event, instanceId, input) => {
  await claudeCodeExecutor.sendInput(instanceId, input);
});

// Approve phase
ipcMain.handle('workflow:approve-phase', async (event, instanceId, phaseId, editedOutput) => {
  await workflowExecutor.approvePhase(instanceId, phaseId, editedOutput);
});

// Reject phase
ipcMain.handle('workflow:reject-phase', async (event, instanceId, phaseId, reason) => {
  await workflowExecutor.rejectPhase(instanceId, phaseId, reason);
});
```

**Backend Support Needed:**

```typescript
// File: src/main/workflow/workflow-executor.ts (MODIFY)
class WorkflowExecutor {
  // Add input handling
  async sendUserInput(instanceId: string, input: string): Promise<void> {
    const session = this.activeSessions.get(instanceId);
    if (session?.claudeProcess) {
      session.claudeProcess.stdin.write(input + '\n');
    }
  }

  // Add output capture
  private capturePhaseOutput(instanceId: string, phaseId: number, output: string): void {
    this.emit('phase-output', { instanceId, phaseId, output });
    // Store in database
    this.workflowMCP.updatePhaseExecution(phaseId, { output });
  }

  // Enhanced approval with edited output
  async approvePhase(
    instanceId: string,
    phaseId: number,
    editedOutput?: string
  ): Promise<void> {
    if (editedOutput) {
      // Store edited version
      await this.workflowMCP.updatePhaseExecution(phaseId, {
        output: editedOutput,
        edited: true
      });
    }
    // Resume workflow
    this.resumeFromApproval(instanceId, phaseId);
  }
}
```

**Why This Is Critical:**

- ✅ Without this, workflows run blind - users can't see what's happening
- ✅ Can't provide input for user-approval phases
- ✅ Can't review and edit agent outputs before moving forward
- ✅ Can't answer agent questions during execution
- ✅ No way to debug or understand what went wrong

**Example User Flow:**

1. User starts workflow execution
2. Workflow runs Phase 1 (Market Research Agent)
3. Agent output appears in ExecutionPanel in real-time
4. Agent asks: "Which genre should we focus on?"
5. User types response in input box → sent to agent
6. Agent completes with final output
7. Phase requires approval → Approve/Reject buttons appear
8. User reviews output, makes minor edits
9. User clicks "Approve" → workflow continues to Phase 2
10. Process repeats for each phase

**2. Enhanced Progress Panel** (2 days)
```typescript
class WorkflowStatusEmitter {
  constructor(
    private workflowMCP: WorkflowManagerMCP,
    private mainWindow: BrowserWindow
  ) {}

  // Emit status updates to renderer
  emitPhaseStarted(instanceId: string, phaseId: number): void {
    this.mainWindow.webContents.send('workflow:phase-started', {
      instanceId,
      phaseId,
      timestamp: new Date().toISOString(),
    });
  }

  emitPhaseProgress(instanceId: string, phaseId: number, progress: string): void {
    this.mainWindow.webContents.send('workflow:phase-progress', {
      instanceId,
      phaseId,
      progress,
      timestamp: new Date().toISOString(),
    });
  }

  emitPhaseCompleted(instanceId: string, phaseId: number, output: any): void {
    this.mainWindow.webContents.send('workflow:phase-completed', {
      instanceId,
      phaseId,
      output,
      timestamp: new Date().toISOString(),
    });
  }

  emitGateBlocked(instanceId: string, phaseId: number, reason: string): void {
    this.mainWindow.webContents.send('workflow:gate-blocked', {
      instanceId,
      phaseId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }
}
```

**2. Status Overlay on Canvas** (`src/renderer/components/WorkflowStatusOverlay.tsx`)
```tsx
interface WorkflowStatusOverlayProps {
  instanceId: string;
  graph: WorkflowGraph;
}

export const WorkflowStatusOverlay: React.FC<WorkflowStatusOverlayProps> = ({
  instanceId,
  graph
}) => {
  const [phaseStatuses, setPhaseStatuses] = useState<Map<number, PhaseStatus>>(new Map());
  const [currentPhase, setCurrentPhase] = useState<number | null>(null);

  useEffect(() => {
    // Listen for status updates
    window.electron.on('workflow:phase-started', (data) => {
      setCurrentPhase(data.phaseId);
      setPhaseStatuses(prev => new Map(prev).set(data.phaseId, 'running'));
    });

    window.electron.on('workflow:phase-completed', (data) => {
      setPhaseStatuses(prev => new Map(prev).set(data.phaseId, 'complete'));
    });

    // ... other listeners
  }, [instanceId]);

  // Overlay status on graph nodes
  const enrichedNodes = graph.nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      status: phaseStatuses.get(node.data.phase.id),
      isCurrent: node.data.phase.id === currentPhase,
    },
  }));

  return <WorkflowCanvas graph={{ ...graph, nodes: enrichedNodes }} />;
};
```

**3. Node Status Styling** (Update `WorkflowNode.tsx`)
```tsx
export const WorkflowNode: React.FC<NodeProps> = ({ data }) => {
  const { phase, status, isCurrent } = data;

  // Style based on status
  const statusColors = {
    pending: 'gray',
    running: 'blue',
    complete: 'green',
    failed: 'red',
    blocked: 'orange',
    skipped: 'gray',
  };

  const borderColor = statusColors[status] || 'gray';
  const pulseAnimation = isCurrent ? 'animate-pulse' : '';

  return (
    <div
      className={`workflow-node ${pulseAnimation}`}
      style={{ borderColor, borderWidth: isCurrent ? 4 : 2 }}
    >
      <div className="node-header">
        {status === 'running' && <Spinner />}
        {status === 'complete' && <CheckIcon />}
        {status === 'blocked' && <BlockIcon />}
        {phase.name}
      </div>
      {isCurrent && <div className="current-indicator">▶ RUNNING</div>}
    </div>
  );
};
```

**4. Progress Panel** (`src/renderer/components/WorkflowProgressPanel.tsx`)
```tsx
export const WorkflowProgressPanel: React.FC<{ instanceId: string }> = ({
  instanceId
}) => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    window.electron.on('workflow:phase-progress', (data) => {
      setLogs(prev => [...prev, data.progress]);
    });
  }, [instanceId]);

  return (
    <div className="progress-panel">
      <h3>Workflow Progress</h3>
      <div className="log-output">
        {logs.map((log, i) => (
          <div key={i} className="log-entry">{log}</div>
        ))}
      </div>
    </div>
  );
};
```

**5. Status Query IPC**
```typescript
ipcMain.handle('workflow:get-status', async (event, instanceId) => {
  const instance = await workflowMCP.getInstance(instanceId);
  const phaseExecutions = await workflowMCP.getPhaseExecutions(instanceId);
  const qualityGates = await workflowMCP.getQualityGates(instanceId);

  return {
    instance,
    phaseExecutions,
    qualityGates,
  };
});
```

### **PRIORITY:** HIGH (Critical UX feature)

---

## ✅ REQUIREMENT 5: Edit Workflows with Version Control

### What's DONE ✅

**Type System:**
- ✅ `WorkflowDefinition` with version field
- ✅ Metadata with created/updated timestamps

**Parser:**
- ✅ Can export to YAML/JSON

### What's NEEDED ❌

**1. Version Control System** (`src/main/workflow-version-control.ts`)
```typescript
interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: string;
  definition: WorkflowDefinition;
  createdAt: Date;
  createdBy: string;
  changelog: string;
  parentVersion?: string;  // For version history
}

class WorkflowVersionControl {
  // Create new version
  async createVersion(
    workflowId: string,
    definition: WorkflowDefinition,
    changelog: string
  ): Promise<string> {
    // Increment version (semver)
    // Store new version in MCP
    // Lock running instances to their version
  }

  // Get version history
  async getVersionHistory(workflowId: string): Promise<WorkflowVersion[]> {
    // Return all versions
  }

  // Rollback to version
  async rollbackToVersion(workflowId: string, versionId: string): Promise<void> {
    // Restore workflow to specific version
  }

  // Check if version is locked (running instances)
  async isVersionLocked(workflowId: string, version: string): Promise<boolean> {
    // Check if any instances are using this version
  }
}
```

**2. Workflow Editor** (`src/renderer/views/WorkflowEditorView.tsx`)
```tsx
export const WorkflowEditorView: React.FC<{ workflowId: string }> = ({
  workflowId
}) => {
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load workflow
  useEffect(() => {
    loadWorkflow(workflowId);
  }, [workflowId]);

  // Save changes (creates new version)
  const handleSave = async () => {
    const changelog = await promptForChangelog();
    await window.electron.invoke('workflow:save-version', {
      workflowId,
      definition: workflow,
      changelog,
    });
    setIsDirty(false);
  };

  return (
    <div>
      <WorkflowCanvas
        graph={workflow.graph}
        editable={isEditing}
        onChange={(updatedGraph) => {
          setWorkflow({ ...workflow, graph: updatedGraph });
          setIsDirty(true);
        }}
      />

      {isDirty && (
        <div className="save-banner">
          Unsaved changes
          <button onClick={handleSave}>Save as New Version</button>
        </div>
      )}

      <VersionHistoryPanel workflowId={workflowId} />
    </div>
  );
};
```

**3. Phase Editor** (`src/renderer/components/PhaseEditor.tsx`)
```tsx
export const PhaseEditor: React.FC<{
  phase: WorkflowPhase;
  onChange: (updated: WorkflowPhase) => void;
}> = ({ phase, onChange }) => {
  return (
    <div className="phase-editor">
      <input
        value={phase.name}
        onChange={(e) => onChange({ ...phase, name: e.target.value })}
      />

      <select
        value={phase.agent}
        onChange={(e) => onChange({ ...phase, agent: e.target.value })}
      >
        {/* List available agents */}
      </select>

      <select
        value={phase.skill || ''}
        onChange={(e) => onChange({ ...phase, skill: e.target.value || undefined })}
      >
        {/* List available skills */}
      </select>

      <textarea
        value={phase.description}
        onChange={(e) => onChange({ ...phase, description: e.target.value })}
      />

      {/* Edit other fields */}
    </div>
  );
};
```

**4. Agent/Skill Editor** (Edit markdown files)

**Agent Editor** (`src/renderer/components/AgentEditor.tsx`)
```tsx
export const AgentEditor: React.FC<{ agentName: string }> = ({ agentName }) => {
  const [agent, setAgent] = useState<AgentDefinition | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Load agent markdown
  useEffect(() => {
    loadAgent(agentName);
  }, [agentName]);

  // Save changes (updates markdown file)
  const handleSave = async () => {
    await window.electron.invoke('agent:save', {
      name: agentName,
      frontmatter: agent.frontmatter,
      content: agent.content,
    });
    setIsDirty(false);
  };

  return (
    <div className="agent-editor">
      <h2>Edit Agent: {agentName}</h2>

      <label>
        Description:
        <textarea
          value={agent.frontmatter.description}
          onChange={(e) => {
            setAgent({
              ...agent,
              frontmatter: {
                ...agent.frontmatter,
                description: e.target.value,
              },
            });
            setIsDirty(true);
          }}
        />
      </label>

      <label>
        Autonomy (1-10):
        <input
          type="number"
          min={1}
          max={10}
          value={agent.frontmatter.autonomy}
          onChange={(e) => {
            setAgent({
              ...agent,
              frontmatter: {
                ...agent.frontmatter,
                autonomy: parseInt(e.target.value),
              },
            });
            setIsDirty(true);
          }}
        />
      </label>

      <label>
        Markdown Content:
        <textarea
          className="code-editor"
          value={agent.content}
          onChange={(e) => {
            setAgent({ ...agent, content: e.target.value });
            setIsDirty(true);
          }}
        />
      </label>

      <button onClick={handleSave} disabled={!isDirty}>
        Save Changes
      </button>
    </div>
  );
};
```

**Skill Editor** - Similar structure for editing skill markdown

**5. Version Lock Enforcement**
```typescript
// In WorkflowExecutor
async executeWorkflow(workflowId: string): Promise<WorkflowExecutionResult> {
  // Load current version
  const workflow = await this.workflowMCP.getWorkflow(workflowId);

  // Lock this version
  const versionLock = await this.versionControl.lockVersion(
    workflowId,
    workflow.version
  );

  // Create instance with locked version
  const instanceId = await this.workflowMCP.createInstance(
    workflowId,
    { lockedVersion: workflow.version }
  );

  // Execute...

  // Release lock when complete
  await this.versionControl.unlockVersion(versionLock);
}
```

**6. IPC Handlers for Editing**
```typescript
// Save new workflow version
ipcMain.handle('workflow:save-version', async (event, { workflowId, definition, changelog }) => {
  return await versionControl.createVersion(workflowId, definition, changelog);
});

// Get version history
ipcMain.handle('workflow:get-versions', async (event, workflowId) => {
  return await versionControl.getVersionHistory(workflowId);
});

// Save agent changes
ipcMain.handle('agent:save', async (event, { name, frontmatter, content }) => {
  const filePath = path.join(PATHS.agents, `${name}.md`);
  const markdown = matter.stringify(content, frontmatter);
  await fs.writeFile(filePath, markdown);
});

// Save skill changes
ipcMain.handle('skill:save', async (event, { name, metadata, content }) => {
  const skillPath = path.join(PATHS.claudeSkills, name, 'SKILL.md');
  const markdown = matter.stringify(content, metadata);
  await fs.writeFile(skillPath, markdown);
});
```

**7. Version History Table** (in MCP database)
```sql
CREATE TABLE workflow_versions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  version TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  changelog TEXT,
  parent_version TEXT,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

CREATE TABLE version_locks (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  version TEXT NOT NULL,
  locked_by_instance TEXT NOT NULL,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id),
  FOREIGN KEY (locked_by_instance) REFERENCES workflow_instances(id)
);
```

### **PRIORITY:** MEDIUM (Important but not blocking)

---

## 📊 Summary: What's Done vs. What's Needed

### ✅ **DONE (Foundation Complete):**

1. ✅ **Type System** - All interfaces defined
2. ✅ **Workflow Parser** - YAML, JSON, HTML parsing
3. ✅ **Basic Infrastructure** - Electron, TypeScript, file operations
4. ✅ **Agent/Skill Files** - 12+ agents, 7+ skills in markdown

### ❌ **NEEDS IMPLEMENTATION:**

| Requirement | Components Needed | Priority | Estimated Effort |
|-------------|-------------------|----------|------------------|
| **1. Import from Folders** | Folder importer, dependency resolver, component installer, path config | **HIGH** | 2-3 days |
| **2. Visual Workflows** | Graph generator, React Flow canvas, custom nodes, breadcrumb nav | **HIGH** | 3-4 days |
| **3. Run Workflows** | Workflow Manager MCP, executor, Claude Code bridge, agent/skill parsers | **CRITICAL** | 4-5 days |
| **4. Visualize Status** | Status emitter, real-time updates, status overlay, progress panel | **HIGH** | 2-3 days |
| **5. Edit with Versions** | Version control system, workflow editor, agent/skill editors, version locks | **MEDIUM** | 3-4 days |

### **TOTAL ESTIMATED EFFORT:** 14-19 days (2.5-4 weeks for full implementation)

---

## 🚀 Recommended Implementation Order

### **Phase 1: Core Execution (CRITICAL PATH)**
1. Workflow Manager MCP (SQLite database)
2. Agent/Skill Parsers
3. Claude Code Executor
4. Basic Workflow Executor
5. Import system (folders)
6. Dependency resolver

**Result:** Can import and execute workflows (headless)

### **Phase 2: Visualization (USER-FACING)**
1. Graph generator
2. React Flow canvas
3. Workflow list view
4. Custom node components
5. Breadcrumb navigation

**Result:** Can see and select workflows visually

### **Phase 3: Real-Time Status (UX ENHANCEMENT)**
1. Status emitter
2. Real-time IPC updates
3. Status overlay on canvas
4. Progress panel
5. Node status styling

**Result:** See workflow execution in real-time

### **Phase 4: Editing & Version Control (ADVANCED)**
1. Version control system
2. Workflow editor
3. Agent/skill editors
4. Version history UI
5. Version locks

**Result:** Can edit workflows and components with version safety

---

## 📁 Complete File Manifest

### **Files Already Created:**
- ✅ `FICTIONLAB_WORKFLOW_ANALYSIS.md`
- ✅ `src/types/workflow.ts`
- ✅ `src/types/agent.ts`
- ✅ `src/types/skill.ts`
- ✅ `src/types/mcp-workflow-manager.ts`
- ✅ `src/main/parsers/workflow-parser.ts`

### **Files to Create (Priority Order):**

**Phase 1 - Core Execution:**
1. `src/main/paths.ts` - File path configuration
2. `src/main/mcp/workflow-manager-mcp.ts` - SQLite database
3. `src/main/parsers/agent-parser.ts` - Parse agent markdown
4. `src/main/parsers/skill-parser.ts` - Parse skill markdown
5. `src/main/claude-code/executor.ts` - Spawn Claude Code
6. `src/main/mcp/workflow-executor.ts` - Execute workflows
7. `src/main/dependency-resolver.ts` - Check dependencies
8. `src/main/import/folder-importer.ts` - Import workflow packages
9. `src/main/import/component-installer.ts` - Install components
10. `src/main/handlers/workflow-handlers.ts` - IPC handlers

**Phase 2 - Visualization:**
11. `src/main/workflow-graph-generator.ts` - Generate graphs
12. `src/renderer/views/WorkflowsView.tsx` - Main workflow view
13. `src/renderer/components/WorkflowCanvas.tsx` - React Flow canvas
14. `src/renderer/components/WorkflowBreadcrumb.tsx` - Navigation
15. `src/renderer/components/workflow-nodes/PlanningNode.tsx`
16. `src/renderer/components/workflow-nodes/GateNode.tsx`
17. `src/renderer/components/workflow-nodes/WritingNode.tsx`
18. `src/renderer/components/workflow-nodes/LoopNode.tsx`
19. `src/renderer/components/workflow-nodes/UserNode.tsx`
20. `src/renderer/components/workflow-nodes/SubWorkflowNode.tsx`

**Phase 3 - Real-Time Status:**
21. `src/main/workflow-status-emitter.ts` - Emit status updates
22. `src/renderer/components/WorkflowStatusOverlay.tsx` - Status visualization
23. `src/renderer/components/WorkflowProgressPanel.tsx` - Progress logs

**Phase 4 - Editing:**
24. `src/main/workflow-version-control.ts` - Version management
25. `src/renderer/views/WorkflowEditorView.tsx` - Workflow editor
26. `src/renderer/components/PhaseEditor.tsx` - Edit phases
27. `src/renderer/components/AgentEditor.tsx` - Edit agents
28. `src/renderer/components/SkillEditor.tsx` - Edit skills
29. `src/renderer/components/VersionHistoryPanel.tsx` - Version history

---

## ✅ Next Actions

**Immediate priorities to make the system functional:**

1. ✅ Create `src/main/paths.ts` (file paths config)
2. ✅ Create `src/main/mcp/workflow-manager-mcp.ts` (SQLite database)
3. ✅ Create `src/main/parsers/agent-parser.ts`
4. ✅ Create `src/main/parsers/skill-parser.ts`
5. ✅ Create `src/main/dependency-resolver.ts`
6. ✅ Test with Phase 0 tests (skill detection)
7. ✅ Create `src/main/import/folder-importer.ts`
8. ✅ Build end-to-end import → execute → visualize flow

**This gives you a working workflow system ready for the marketplace.**
