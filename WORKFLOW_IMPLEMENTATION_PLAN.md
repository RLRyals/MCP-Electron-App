# Workflow System Implementation Plan

**Goal:** Build complete workflow import, execution, and visualization system for FictionLab

**Status:** Migration 028 complete ✅ | Ready for implementation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Electron Main Process                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                 │
│  │ Workflow Import  │───▶│ Dependency Check │                 │
│  │ System           │    │ & Install        │                 │
│  └──────────────────┘    └──────────────────┘                 │
│            │                       │                            │
│            ▼                       ▼                            │
│  ┌──────────────────┐    ┌──────────────────┐                 │
│  │ MCP Client       │◀───│ Workflow         │                 │
│  │ (Workflow Mgr)   │    │ Executor         │                 │
│  └──────────────────┘    └──────────────────┘                 │
│            │                       │                            │
│            │              ┌────────▼────────┐                  │
│            │              │ Claude Code     │                  │
│            │              │ Executor        │                  │
│            │              └─────────────────┘                  │
└────────────┼──────────────────────┼───────────────────────────┘
             │                      │
             ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  React Renderer Process                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                 │
│  │ WorkflowsView    │◀───│ WorkflowCanvas   │                 │
│  │ (List/Select)    │    │ (React Flow)     │                 │
│  └──────────────────┘    └──────────────────┘                 │
│            │                       │                            │
│            └───────────┬───────────┘                            │
│                        ▼                                        │
│            ┌──────────────────────┐                            │
│            │ Execution Status     │                            │
│            │ Real-time Updates    │                            │
│            └──────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
             │                      ▲
             │                      │
             ▼                      │
┌─────────────────────────────────────────────────────────────────┐
│         PostgreSQL (via workflow-manager MCP)                    │
│  - workflow_definitions     - sub_workflow_executions           │
│  - workflow_instances       - workflow_phase_history            │
│  - workflow_versions        - workflow_imports                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: MCP Client Integration (2-3 days)

### Files to Create

#### 1. `src/main/workflow/mcp-workflow-client.ts`
**Purpose:** TypeScript client for workflow-manager MCP tools

```typescript
import { Pool } from 'pg';
import { getDatabasePool } from '../database-connection';
import { logWithCategory, LogCategory } from '../logger';

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  graph_json: object;
  dependencies_json: {
    agents: string[];
    skills: string[];
    mcpServers: string[];
    subWorkflows?: string[];
  };
  phases_json: WorkflowPhase[];
  tags?: string[];
  marketplace_metadata?: object;
  is_system?: boolean;
  created_by?: string;
}

export interface WorkflowPhase {
  id: number;
  name: string;
  type: 'planning' | 'gate' | 'writing' | 'loop' | 'user' | 'subworkflow';
  agent: string;
  skill?: string;
  subWorkflowId?: string;
  description: string;
  gate: boolean;
  gateCondition?: string;
  requiresApproval: boolean;
  position: { x: number; y: number };
}

export class MCPWorkflowClient {
  private pool: Pool;

  constructor() {
    this.pool = getDatabasePool();
  }

  /**
   * Import workflow definition
   */
  async importWorkflowDefinition(workflow: WorkflowDefinition): Promise<{
    workflow_def_id: string;
    version: string;
    message: string;
  }> {
    const result = await this.pool.query(`
      INSERT INTO workflow_definitions (
        id, name, version, description, graph_json, dependencies_json,
        phases_json, tags, marketplace_metadata, created_by, is_system
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id, version) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        graph_json = EXCLUDED.graph_json,
        dependencies_json = EXCLUDED.dependencies_json,
        phases_json = EXCLUDED.phases_json,
        tags = EXCLUDED.tags,
        marketplace_metadata = EXCLUDED.marketplace_metadata,
        updated_at = NOW()
      RETURNING id, version, created_at
    `, [
      workflow.id,
      workflow.name,
      workflow.version,
      workflow.description,
      workflow.graph_json,
      workflow.dependencies_json,
      workflow.phases_json,
      workflow.tags || [],
      workflow.marketplace_metadata || {},
      workflow.created_by,
      workflow.is_system || false
    ]);

    logWithCategory('info', LogCategory.WORKFLOW,
      `Imported workflow: ${workflow.name} v${workflow.version}`);

    return {
      workflow_def_id: result.rows[0].id,
      version: result.rows[0].version,
      message: `Workflow definition ${workflow.name} v${workflow.version} imported successfully`
    };
  }

  /**
   * Get all workflow definitions
   */
  async getWorkflowDefinitions(filters?: {
    tags?: string[];
    is_system?: boolean;
  }): Promise<WorkflowDefinition[]> {
    let whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.tags && filters.tags.length > 0) {
      whereConditions.push(`tags && $${paramIndex}`);
      params.push(filters.tags);
      paramIndex++;
    }

    if (filters?.is_system !== undefined) {
      whereConditions.push(`is_system = $${paramIndex}`);
      params.push(filters.is_system);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const result = await this.pool.query(`
      SELECT * FROM workflow_definitions
      ${whereClause}
      ORDER BY is_system DESC, created_at DESC
    `, params);

    return result.rows;
  }

  /**
   * Get specific workflow definition
   */
  async getWorkflowDefinition(
    workflowDefId: string,
    version?: string
  ): Promise<WorkflowDefinition | null> {
    let versionClause = '';
    const params: any[] = [workflowDefId];

    if (version) {
      versionClause = 'AND version = $2';
      params.push(version);
    } else {
      versionClause = `AND version = (
        SELECT version FROM workflow_definitions
        WHERE id = $1
        ORDER BY created_at DESC
        LIMIT 1
      )`;
    }

    const result = await this.pool.query(`
      SELECT * FROM workflow_definitions
      WHERE id = $1 ${versionClause}
    `, params);

    return result.rows[0] || null;
  }

  /**
   * Create workflow instance
   */
  async createWorkflowInstance(
    workflowDefId: string,
    seriesId: number,
    userId: number
  ): Promise<number> {
    const result = await this.pool.query(`
      INSERT INTO workflow_instances (
        workflow_def_id, series_id, author_id, current_phase, phase_status
      ) VALUES ($1, $2, $3, -1, 'pending')
      RETURNING id
    `, [workflowDefId, seriesId, userId]);

    return result.rows[0].id;
  }

  /**
   * Lock workflow version during execution
   */
  async lockWorkflowVersion(
    workflowDefId: string,
    version: string,
    instanceId: number
  ): Promise<void> {
    await this.pool.query(`
      INSERT INTO workflow_version_locks (
        workflow_def_id, version, locked_by_instance_id
      ) VALUES ($1, $2, $3)
      ON CONFLICT (workflow_def_id, version, locked_by_instance_id) DO NOTHING
    `, [workflowDefId, version, instanceId]);
  }

  /**
   * Unlock workflow version
   */
  async unlockWorkflowVersion(
    workflowDefId: string,
    version: string,
    instanceId: number
  ): Promise<void> {
    await this.pool.query(`
      DELETE FROM workflow_version_locks
      WHERE workflow_def_id = $1 AND version = $2 AND locked_by_instance_id = $3
    `, [workflowDefId, version, instanceId]);
  }

  /**
   * Get workflow instance status
   */
  async getWorkflowInstanceStatus(instanceId: number) {
    const result = await this.pool.query(`
      SELECT
        wi.*,
        wd.name as workflow_name,
        wd.phases_json
      FROM workflow_instances wi
      LEFT JOIN workflow_definitions wd
        ON wi.workflow_def_id = wd.id AND wi.workflow_version = wd.version
      WHERE wi.id = $1
    `, [instanceId]);

    return result.rows[0];
  }

  /**
   * Update phase execution
   */
  async updatePhaseExecution(
    workflowId: number,
    phaseNumber: number,
    claudeCodeSession?: string,
    skillInvoked?: string,
    outputJson?: object
  ): Promise<void> {
    await this.pool.query(`
      UPDATE workflow_phase_history
      SET claude_code_session = COALESCE($1, claude_code_session),
          skill_invoked = COALESCE($2, skill_invoked),
          output_json = COALESCE($3, output_json),
          completed_at = NOW()
      WHERE workflow_id = $4
        AND phase_number = $5
        AND id = (
          SELECT id FROM workflow_phase_history
          WHERE workflow_id = $4 AND phase_number = $5
          ORDER BY started_at DESC
          LIMIT 1
        )
    `, [claudeCodeSession, skillInvoked, outputJson, workflowId, phaseNumber]);
  }
}
```

**IPC Handlers:** Add to `src/main/index.ts`:

```typescript
import { MCPWorkflowClient } from './workflow/mcp-workflow-client';

const workflowClient = new MCPWorkflowClient();

// Get all workflows
ipcMain.handle('workflow:get-definitions', async () => {
  return await workflowClient.getWorkflowDefinitions();
});

// Get specific workflow
ipcMain.handle('workflow:get-definition', async (event, id: string, version?: string) => {
  return await workflowClient.getWorkflowDefinition(id, version);
});

// Import workflow
ipcMain.handle('workflow:import', async (event, workflow: WorkflowDefinition) => {
  return await workflowClient.importWorkflowDefinition(workflow);
});
```

---

## Phase 2: Workflow Import System (3-4 days)

### Files to Create

#### 2. `src/main/workflow/dependency-resolver.ts`
**Purpose:** Check which agents, skills, and MCPs are installed

```typescript
import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { Pool } from 'pg';
import { getDatabasePool } from '../database-connection';

export interface DependencyCheckResult {
  installed: string[];
  missing: string[];
}

export interface AllDependencies {
  agents: DependencyCheckResult;
  skills: DependencyCheckResult;
  mcpServers: DependencyCheckResult;
  subWorkflows: DependencyCheckResult;
}

export class DependencyResolver {
  private pool: Pool;

  constructor() {
    this.pool = getDatabasePool();
  }

  /**
   * Check all dependencies for a workflow
   */
  async checkDependencies(dependencies: {
    agents: string[];
    skills: string[];
    mcpServers: string[];
    subWorkflows?: string[];
  }): Promise<AllDependencies> {
    return {
      agents: await this.checkAgents(dependencies.agents),
      skills: await this.checkSkills(dependencies.skills),
      mcpServers: await this.checkMCPServers(dependencies.mcpServers),
      subWorkflows: await this.checkSubWorkflows(dependencies.subWorkflows || [])
    };
  }

  /**
   * Check agents (look in userData/agents)
   */
  private async checkAgents(agents: string[]): Promise<DependencyCheckResult> {
    const userDataPath = app.getPath('userData');
    const agentsDir = path.join(userDataPath, 'agents');

    const installed: string[] = [];
    const missing: string[] = [];

    for (const agent of agents) {
      const agentPath = path.join(agentsDir, `${agent}.md`);
      if (await fs.pathExists(agentPath)) {
        installed.push(agent);
      } else {
        missing.push(agent);
      }
    }

    return { installed, missing };
  }

  /**
   * Check skills (look in ~/.claude/skills)
   */
  private async checkSkills(skills: string[]): Promise<DependencyCheckResult> {
    const homeDir = require('os').homedir();
    const skillsDir = path.join(homeDir, '.claude', 'skills');

    const installed: string[] = [];
    const missing: string[] = [];

    for (const skill of skills) {
      const skillPath = path.join(skillsDir, `${skill}.md`);
      if (await fs.pathExists(skillPath)) {
        installed.push(skill);
      } else {
        missing.push(skill);
      }
    }

    return { installed, missing };
  }

  /**
   * Check MCP servers (query database or check running containers)
   */
  private async checkMCPServers(mcpServers: string[]): Promise<DependencyCheckResult> {
    // For now, assume all MCP servers are available if Docker is running
    // In production, you'd query the MCP servers list
    return {
      installed: mcpServers,
      missing: []
    };
  }

  /**
   * Check sub-workflows (query workflow_definitions table)
   */
  private async checkSubWorkflows(subWorkflows: string[]): Promise<DependencyCheckResult> {
    if (subWorkflows.length === 0) {
      return { installed: [], missing: [] };
    }

    const result = await this.pool.query(`
      SELECT DISTINCT id FROM workflow_definitions
      WHERE id = ANY($1::text[])
    `, [subWorkflows]);

    const installed = result.rows.map(r => r.id);
    const missing = subWorkflows.filter(sw => !installed.includes(sw));

    return { installed, missing };
  }
}
```

#### 3. `src/main/workflow/folder-importer.ts`
**Purpose:** Import workflows from marketplace folder structure

```typescript
import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { WorkflowParser } from '../parsers/workflow-parser';
import { DependencyResolver } from './dependency-resolver';
import { MCPWorkflowClient } from './mcp-workflow-client';
import { logWithCategory, LogCategory } from '../logger';

export interface ImportResult {
  success: boolean;
  workflowId?: string;
  version?: string;
  message: string;
  missingDependencies?: {
    agents: string[];
    skills: string[];
    mcpServers: string[];
  };
  installedComponents?: {
    agents: number;
    skills: number;
  };
}

export class FolderImporter {
  private parser: WorkflowParser;
  private depResolver: DependencyResolver;
  private workflowClient: MCPWorkflowClient;

  constructor() {
    this.parser = new WorkflowParser();
    this.depResolver = new DependencyResolver();
    this.workflowClient = new MCPWorkflowClient();
  }

  /**
   * Import workflow from folder
   * Expected structure:
   * /workflow-folder/
   *   ├── workflow.yaml (or workflow.json)
   *   ├── agents/
   *   │   └── agent-name.md
   *   ├── skills/
   *   │   └── skill-name.md
   *   └── README.md
   */
  async importFromFolder(folderPath: string): Promise<ImportResult> {
    try {
      // 1. Find workflow definition file
      const workflowFile = await this.findWorkflowFile(folderPath);
      if (!workflowFile) {
        return {
          success: false,
          message: 'No workflow.yaml or workflow.json found in folder'
        };
      }

      // 2. Parse workflow definition
      const workflow = await this.parser.parseWorkflow(workflowFile);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Parsed workflow: ${workflow.name}`);

      // 3. Check dependencies
      const depCheck = await this.depResolver.checkDependencies(workflow.dependencies);

      // 4. Install missing components
      const installedCounts = await this.installComponents(
        folderPath,
        depCheck.agents.missing,
        depCheck.skills.missing
      );

      // 5. Import workflow definition to database
      const result = await this.workflowClient.importWorkflowDefinition({
        ...workflow,
        source_type: 'folder',
        source_path: folderPath
      } as any);

      // 6. Record import
      await this.recordImport(workflow.id, folderPath, installedCounts);

      return {
        success: true,
        workflowId: result.workflow_def_id,
        version: result.version,
        message: result.message,
        installedComponents: installedCounts
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Import failed: ${error.message}`);

      return {
        success: false,
        message: `Import failed: ${error.message}`
      };
    }
  }

  /**
   * Find workflow.yaml or workflow.json in folder
   */
  private async findWorkflowFile(folderPath: string): Promise<string | null> {
    const candidates = ['workflow.yaml', 'workflow.yml', 'workflow.json'];

    for (const filename of candidates) {
      const filePath = path.join(folderPath, filename);
      if (await fs.pathExists(filePath)) {
        return filePath;
      }
    }

    return null;
  }

  /**
   * Install agents and skills from workflow folder
   */
  private async installComponents(
    folderPath: string,
    missingAgents: string[],
    missingSkills: string[]
  ): Promise<{ agents: number; skills: number }> {
    let agentsInstalled = 0;
    let skillsInstalled = 0;

    const userDataPath = app.getPath('userData');
    const homeDir = require('os').homedir();

    // Install agents
    const agentsDir = path.join(folderPath, 'agents');
    if (await fs.pathExists(agentsDir)) {
      for (const agent of missingAgents) {
        const sourceFile = path.join(agentsDir, `${agent}.md`);
        if (await fs.pathExists(sourceFile)) {
          const destDir = path.join(userDataPath, 'agents');
          await fs.ensureDir(destDir);
          await fs.copy(sourceFile, path.join(destDir, `${agent}.md`));
          agentsInstalled++;
          logWithCategory('info', LogCategory.WORKFLOW,
            `Installed agent: ${agent}`);
        }
      }
    }

    // Install skills
    const skillsDir = path.join(folderPath, 'skills');
    if (await fs.pathExists(skillsDir)) {
      for (const skill of missingSkills) {
        const sourceFile = path.join(skillsDir, `${skill}.md`);
        if (await fs.pathExists(sourceFile)) {
          const destDir = path.join(homeDir, '.claude', 'skills');
          await fs.ensureDir(destDir);
          await fs.copy(sourceFile, path.join(destDir, `${skill}.md`));
          skillsInstalled++;
          logWithCategory('info', LogCategory.WORKFLOW,
            `Installed skill: ${skill}`);
        }
      }
    }

    return { agents: agentsInstalled, skills: skillsInstalled };
  }

  /**
   * Record import in workflow_imports table
   */
  private async recordImport(
    workflowDefId: string,
    sourcePath: string,
    installed: { agents: number; skills: number }
  ): Promise<void> {
    const pool = getDatabasePool();

    await pool.query(`
      INSERT INTO workflow_imports (
        workflow_def_id, source_type, source_path, installation_log
      ) VALUES ($1, $2, $3, $4)
    `, [
      workflowDefId,
      'folder',
      sourcePath,
      { timestamp: new Date().toISOString(), installed }
    ]);
  }
}
```

**IPC Handler:**

```typescript
import { FolderImporter } from './workflow/folder-importer';

const folderImporter = new FolderImporter();

ipcMain.handle('workflow:import-from-folder', async (event, folderPath: string) => {
  return await folderImporter.importFromFolder(folderPath);
});
```

---

## Phase 3: Workflow Execution Engine (4-5 days)

### Files to Create

#### 4. `src/main/workflow/claude-code-executor.ts`
**Purpose:** Execute Claude Code skills headlessly

```typescript
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { logWithCategory, LogCategory } from '../logger';

export interface ClaudeCodeSession {
  id: string;
  phaseNumber: number;
  skillName: string;
  process?: ChildProcess;
  output: string[];
  status: 'running' | 'completed' | 'failed';
}

export interface ClaudeCodeResult {
  success: boolean;
  output: object;
  error?: string;
  session_id: string;
}

export class ClaudeCodeExecutor {
  private sessions: Map<string, ClaudeCodeSession> = new Map();

  /**
   * Execute a skill with Claude Code
   */
  async executeSkill(
    skillName: string,
    phaseNumber: number,
    prompt: string,
    context?: object
  ): Promise<ClaudeCodeResult> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: ClaudeCodeSession = {
      id: sessionId,
      phaseNumber,
      skillName,
      output: [],
      status: 'running'
    };

    this.sessions.set(sessionId, session);

    logWithCategory('info', LogCategory.WORKFLOW,
      `Starting Claude Code session: ${sessionId} for skill: ${skillName}`);

    try {
      // Execute Claude Code with skill
      const result = await this.runClaudeCode(prompt, skillName, session);

      session.status = 'completed';
      logWithCategory('info', LogCategory.WORKFLOW,
        `Completed Claude Code session: ${sessionId}`);

      return {
        success: true,
        output: result,
        session_id: sessionId
      };

    } catch (error: any) {
      session.status = 'failed';
      logWithCategory('error', LogCategory.WORKFLOW,
        `Claude Code session failed: ${sessionId} - ${error.message}`);

      return {
        success: false,
        output: {},
        error: error.message,
        session_id: sessionId
      };
    }
  }

  /**
   * Run Claude Code CLI
   */
  private async runClaudeCode(
    prompt: string,
    skillName: string,
    session: ClaudeCodeSession
  ): Promise<object> {
    return new Promise((resolve, reject) => {
      // Construct Claude Code command
      // claude -p "prompt" --skill skillName --output-format json
      const args = [
        '-p', prompt,
        '--skill', skillName,
        '--output-format', 'json'
      ];

      const claudeProcess = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      session.process = claudeProcess;

      let stdout = '';
      let stderr = '';

      claudeProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        session.output.push(output);
      });

      claudeProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      claudeProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse JSON output
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse Claude Code output: ${error}`));
          }
        } else {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
        }
      });

      claudeProcess.on('error', (error) => {
        reject(new Error(`Failed to start Claude Code: ${error.message}`));
      });
    });
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Cancel session
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session && session.process) {
      session.process.kill();
      session.status = 'failed';
      return true;
    }
    return false;
  }
}
```

#### 5. `src/main/workflow/workflow-executor.ts`
**Purpose:** Main workflow execution engine

```typescript
import { EventEmitter } from 'events';
import { MCPWorkflowClient, WorkflowPhase } from './mcp-workflow-client';
import { ClaudeCodeExecutor } from './claude-code-executor';
import { getDatabasePool } from '../database-connection';
import { logWithCategory, LogCategory } from '../logger';

export interface WorkflowExecutionOptions {
  workflowDefId: string;
  seriesId: number;
  userId: number;
  startPhase?: number;
}

export interface PhaseExecutionEvent {
  workflowInstanceId: number;
  phaseNumber: number;
  phaseName: string;
  status: 'starting' | 'in_progress' | 'completed' | 'failed' | 'waiting_approval';
  output?: object;
  error?: string;
}

export class WorkflowExecutor extends EventEmitter {
  private workflowClient: MCPWorkflowClient;
  private claudeExecutor: ClaudeCodeExecutor;
  private runningInstances: Map<number, boolean> = new Map();

  constructor() {
    super();
    this.workflowClient = new MCPWorkflowClient();
    this.claudeExecutor = new ClaudeCodeExecutor();
  }

  /**
   * Start workflow execution
   */
  async startWorkflow(options: WorkflowExecutionOptions): Promise<number> {
    const { workflowDefId, seriesId, userId, startPhase = 0 } = options;

    logWithCategory('info', LogCategory.WORKFLOW,
      `Starting workflow: ${workflowDefId} for series ${seriesId}`);

    // 1. Get workflow definition
    const workflow = await this.workflowClient.getWorkflowDefinition(workflowDefId);
    if (!workflow) {
      throw new Error(`Workflow definition not found: ${workflowDefId}`);
    }

    // 2. Create workflow instance
    const instanceId = await this.workflowClient.createWorkflowInstance(
      workflowDefId,
      seriesId,
      userId
    );

    // 3. Lock workflow version
    await this.workflowClient.lockWorkflowVersion(
      workflow.id,
      workflow.version,
      instanceId
    );

    // 4. Start execution
    this.runningInstances.set(instanceId, true);
    this.executeWorkflow(instanceId, workflow, startPhase).catch(error => {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Workflow execution failed: ${error.message}`);
    });

    return instanceId;
  }

  /**
   * Execute workflow phases
   */
  private async executeWorkflow(
    instanceId: number,
    workflow: any,
    startPhase: number
  ): Promise<void> {
    const phases: WorkflowPhase[] = workflow.phases_json;

    for (let i = startPhase; i < phases.length; i++) {
      if (!this.runningInstances.get(instanceId)) {
        logWithCategory('info', LogCategory.WORKFLOW,
          `Workflow ${instanceId} stopped by user`);
        break;
      }

      const phase = phases[i];

      try {
        await this.executePhase(instanceId, phase, workflow);
      } catch (error: any) {
        this.emit('phase-failed', {
          workflowInstanceId: instanceId,
          phaseNumber: phase.id,
          phaseName: phase.name,
          status: 'failed',
          error: error.message
        });

        // Stop execution on error
        break;
      }
    }

    // Unlock workflow version
    await this.workflowClient.unlockWorkflowVersion(
      workflow.id,
      workflow.version,
      instanceId
    );

    this.runningInstances.delete(instanceId);

    logWithCategory('info', LogCategory.WORKFLOW,
      `Workflow ${instanceId} completed`);
  }

  /**
   * Execute a single phase
   */
  private async executePhase(
    instanceId: number,
    phase: WorkflowPhase,
    workflow: any
  ): Promise<void> {
    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing Phase ${phase.id}: ${phase.name}`);

    this.emit('phase-started', {
      workflowInstanceId: instanceId,
      phaseNumber: phase.id,
      phaseName: phase.name,
      status: 'starting'
    });

    // Handle different phase types
    switch (phase.type) {
      case 'planning':
      case 'writing':
        await this.executeAgentPhase(instanceId, phase);
        break;

      case 'gate':
        await this.executeGatePhase(instanceId, phase);
        break;

      case 'user':
        await this.executeUserPhase(instanceId, phase);
        break;

      case 'subworkflow':
        await this.executeSubWorkflow(instanceId, phase);
        break;

      case 'loop':
        await this.executeLoopPhase(instanceId, phase);
        break;
    }

    this.emit('phase-completed', {
      workflowInstanceId: instanceId,
      phaseNumber: phase.id,
      phaseName: phase.name,
      status: 'completed'
    });
  }

  /**
   * Execute agent phase (with optional skill)
   */
  private async executeAgentPhase(
    instanceId: number,
    phase: WorkflowPhase
  ): Promise<void> {
    if (!phase.skill) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Phase ${phase.id} has no skill, skipping execution`);
      return;
    }

    // Build prompt for Claude Code
    const prompt = `Execute ${phase.name} phase. Agent: ${phase.agent}. ${phase.description}`;

    // Execute skill with Claude Code
    const result = await this.claudeExecutor.executeSkill(
      phase.skill,
      phase.id,
      prompt
    );

    if (!result.success) {
      throw new Error(`Skill execution failed: ${result.error}`);
    }

    // Update phase execution in database
    await this.workflowClient.updatePhaseExecution(
      instanceId,
      phase.id,
      result.session_id,
      phase.skill,
      result.output
    );
  }

  /**
   * Execute gate phase (quality check)
   */
  private async executeGatePhase(
    instanceId: number,
    phase: WorkflowPhase
  ): Promise<void> {
    // Gates would call validation tools
    // For now, placeholder
    logWithCategory('info', LogCategory.WORKFLOW,
      `Gate Phase ${phase.id}: ${phase.gateCondition}`);
  }

  /**
   * Execute user approval phase
   */
  private async executeUserPhase(
    instanceId: number,
    phase: WorkflowPhase
  ): Promise<void> {
    if (phase.requiresApproval) {
      // Pause and wait for user approval
      this.emit('approval-required', {
        workflowInstanceId: instanceId,
        phaseNumber: phase.id,
        phaseName: phase.name,
        status: 'waiting_approval'
      });

      // Pause execution until approval is granted
      await this.waitForApproval(instanceId, phase.id);
    }
  }

  /**
   * Execute sub-workflow
   */
  private async executeSubWorkflow(
    instanceId: number,
    phase: WorkflowPhase
  ): Promise<void> {
    if (!phase.subWorkflowId) {
      throw new Error(`Phase ${phase.id} missing subWorkflowId`);
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Starting sub-workflow: ${phase.subWorkflowId}`);

    // Start sub-workflow recursively
    // For now, placeholder
  }

  /**
   * Execute loop phase (Book Production Loop)
   */
  private async executeLoopPhase(
    instanceId: number,
    phase: WorkflowPhase
  ): Promise<void> {
    // Book production loop logic
    logWithCategory('info', LogCategory.WORKFLOW,
      `Loop Phase ${phase.id}: ${phase.name}`);
  }

  /**
   * Wait for user approval
   */
  private async waitForApproval(
    instanceId: number,
    phaseNumber: number
  ): Promise<void> {
    // Implement approval waiting logic
    // This would listen for IPC events from renderer
  }

  /**
   * Stop workflow execution
   */
  stopWorkflow(instanceId: number): void {
    this.runningInstances.set(instanceId, false);
    logWithCategory('info', LogCategory.WORKFLOW,
      `Stopping workflow: ${instanceId}`);
  }
}
```

**IPC Handlers:**

```typescript
import { WorkflowExecutor } from './workflow/workflow-executor';

const workflowExecutor = new WorkflowExecutor();

// Start workflow
ipcMain.handle('workflow:start', async (event, options) => {
  return await workflowExecutor.startWorkflow(options);
});

// Stop workflow
ipcMain.handle('workflow:stop', async (event, instanceId: number) => {
  workflowExecutor.stopWorkflow(instanceId);
});

// Listen for events
workflowExecutor.on('phase-started', (data) => {
  mainWindow.webContents.send('workflow:phase-started', data);
});

workflowExecutor.on('phase-completed', (data) => {
  mainWindow.webContents.send('workflow:phase-completed', data);
});

workflowExecutor.on('approval-required', (data) => {
  mainWindow.webContents.send('workflow:approval-required', data);
});
```

---

## Phase 4: React UI Components (5-6 days)

### Files to Create

#### 6. `src/renderer/views/WorkflowsView.tsx`
**Purpose:** Main workflow management view

```tsx
import React, { useState, useEffect } from 'react';
import { WorkflowList } from '../components/WorkflowList';
import { WorkflowCanvas } from '../components/WorkflowCanvas';
import { WorkflowImportDialog } from '../components/WorkflowImportDialog';

export const WorkflowsView: React.FC = () => {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    const result = await window.electron.invoke('workflow:get-definitions');
    setWorkflows(result);
  };

  const handleImport = async (folderPath: string) => {
    const result = await window.electron.invoke('workflow:import-from-folder', folderPath);
    if (result.success) {
      loadWorkflows();
      setShowImportDialog(false);
    }
  };

  const handleSelectWorkflow = async (workflowId: string) => {
    const workflow = await window.electron.invoke('workflow:get-definition', workflowId);
    setSelectedWorkflow(workflow);
  };

  const handleStartWorkflow = async () => {
    if (!selectedWorkflow) return;

    const instanceId = await window.electron.invoke('workflow:start', {
      workflowDefId: selectedWorkflow.id,
      seriesId: 1, // Get from context
      userId: 1    // Get from context
    });

    console.log('Started workflow instance:', instanceId);
  };

  return (
    <div className="workflows-view">
      <div className="toolbar">
        <button onClick={() => setShowImportDialog(true)}>
          Import Workflow
        </button>
        <button onClick={handleStartWorkflow} disabled={!selectedWorkflow}>
          Start Workflow
        </button>
      </div>

      <div className="content">
        <div className="sidebar">
          <WorkflowList
            workflows={workflows}
            selectedId={selectedWorkflow?.id}
            onSelect={handleSelectWorkflow}
          />
        </div>

        <div className="canvas-container">
          {selectedWorkflow && (
            <WorkflowCanvas workflow={selectedWorkflow} />
          )}
        </div>
      </div>

      {showImportDialog && (
        <WorkflowImportDialog
          onImport={handleImport}
          onClose={() => setShowImportDialog(false)}
        />
      )}
    </div>
  );
};
```

#### 7. `src/renderer/components/WorkflowCanvas.tsx`
**Purpose:** React Flow workflow visualization

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { PhaseNode } from './nodes/PhaseNode';
import { GateNode } from './nodes/GateNode';
import { SubWorkflowNode } from './nodes/SubWorkflowNode';

const nodeTypes = {
  planning: PhaseNode,
  writing: PhaseNode,
  gate: GateNode,
  user: PhaseNode,
  subworkflow: SubWorkflowNode,
  loop: PhaseNode,
};

interface WorkflowCanvasProps {
  workflow: any;
  executionStatus?: Map<number, string>;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflow,
  executionStatus
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!workflow) return;

    // Convert workflow phases to React Flow nodes
    const flowNodes: Node[] = workflow.phases_json.map((phase: any) => ({
      id: phase.id.toString(),
      type: phase.type,
      position: phase.position || { x: phase.id * 200, y: 0 },
      data: {
        label: phase.name,
        phase,
        status: executionStatus?.get(phase.id) || 'pending'
      },
    }));

    // Create edges between sequential phases
    const flowEdges: Edge[] = [];
    for (let i = 0; i < workflow.phases_json.length - 1; i++) {
      flowEdges.push({
        id: `e${i}-${i+1}`,
        source: i.toString(),
        target: (i + 1).toString(),
        animated: executionStatus?.get(i) === 'in_progress',
      });
    }

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [workflow, executionStatus]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
};
```

#### 8. `src/renderer/components/nodes/PhaseNode.tsx`
**Purpose:** Custom node for workflow phases

```tsx
import React from 'react';
import { Handle, Position } from 'reactflow';

interface PhaseNodeProps {
  data: {
    label: string;
    phase: any;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  };
}

export const PhaseNode: React.FC<PhaseNodeProps> = ({ data }) => {
  const getStatusColor = () => {
    switch (data.status) {
      case 'completed': return '#4ade80';
      case 'in_progress': return '#60a5fa';
      case 'failed': return '#f87171';
      default: return '#9ca3af';
    }
  };

  return (
    <div
      style={{
        padding: '10px 20px',
        borderRadius: '8px',
        border: `2px solid ${getStatusColor()}`,
        background: 'white',
        minWidth: '150px',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div>
        <div style={{ fontWeight: 'bold' }}>{data.label}</div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {data.phase.agent}
        </div>
        {data.phase.skill && (
          <div style={{ fontSize: '11px', color: '#999' }}>
            Skill: {data.phase.skill}
          </div>
        )}
        <div
          style={{
            fontSize: '10px',
            marginTop: '5px',
            color: getStatusColor(),
            fontWeight: 'bold'
          }}
        >
          {data.status.toUpperCase()}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
```

---

## Implementation Timeline

### Week 1: MCP Client & Import (Days 1-5)
- [ ] Day 1: `mcp-workflow-client.ts` + IPC handlers
- [ ] Day 2: `dependency-resolver.ts`
- [ ] Day 3-4: `folder-importer.ts` + integration
- [ ] Day 5: Testing import flow

### Week 2: Execution Engine (Days 6-10)
- [ ] Day 6-7: `claude-code-executor.ts`
- [ ] Day 8-9: `workflow-executor.ts`
- [ ] Day 10: Testing execution flow

### Week 3: React UI (Days 11-15)
- [ ] Day 11: Install reactflow, setup WorkflowsView
- [ ] Day 12-13: WorkflowCanvas + node components
- [ ] Day 14: Real-time status updates
- [ ] Day 15: Testing and polish

### Week 4: Integration & Testing (Days 16-20)
- [ ] Day 16-17: End-to-end testing
- [ ] Day 18: Bug fixes
- [ ] Day 19: Documentation
- [ ] Day 20: Demo 12-phase workflow

---

## Testing Strategy

### Unit Tests
- [ ] MCP client database queries
- [ ] Dependency resolver logic
- [ ] Workflow parser (already created)

### Integration Tests
- [ ] Import workflow from folder
- [ ] Execute simple 2-phase workflow
- [ ] Execute 12-phase workflow (Phase 0-1)
- [ ] Sub-workflow execution

### E2E Tests
- [ ] Full 12-phase pipeline import
- [ ] Execute with real Claude Code
- [ ] Approval gates
- [ ] Status visualization

---

## Success Criteria

- ✅ Can import workflows from folders
- ✅ Can list workflows in UI
- ✅ Can visualize workflow graph with React Flow
- ✅ Can start workflow execution
- ✅ Can track execution status in real-time
- ✅ Can execute phases with Claude Code
- ✅ Can handle approval gates
- ✅ Can execute sub-workflows
- ✅ Can view phase execution history

---

## Next Immediate Steps

1. **Install reactflow dependency:**
   ```bash
   npm install reactflow
   ```

2. **Create MCP client:**
   Start with `src/main/workflow/mcp-workflow-client.ts`

3. **Add IPC handlers:**
   Update `src/main/index.ts` with workflow handlers

4. **Test database queries:**
   Verify MCP client can query workflow_definitions

5. **Build import system:**
   Implement folder-importer.ts

---

Ready to start implementing? Let me know which phase you want to tackle first!
