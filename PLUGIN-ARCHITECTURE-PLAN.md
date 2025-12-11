# BQ-Studio as FictionLab Plugin - Architecture Plan

## Executive Summary

This document outlines the architectural transformation of BQ-Studio from a standalone Electron application into a plugin for FictionLab. The new architecture leverages FictionLab's infrastructure (PostgreSQL database, MCP servers, Docker management) while Studio focuses on its core competency: orchestrating Claude Code in headless mode to execute AI-powered publishing workflows using the user's Claude Pro/Max subscription.

---

## Current State Analysis

### BQ-Studio (Current Standalone Architecture)
- **Electron App**: Full desktop application with main process, renderer, and preload scripts
- **Core Services**: AI service, database service (SQLite), file service, workflow engine, event bus
- **Plugin System**: Internal plugin architecture for series planning, manuscript writing, etc.
- **Agent Orchestration**: Queue manager, session manager, Claude Code executor, token tracker
- **User Authentication**: Manages Claude Pro/Max session tokens
- **Technology Stack**: Electron, React, TypeScript, Zustand, Vite, SQLite

### FictionLab (Host Environment)
- **Electron App**: Full desktop application managing Docker, PostgreSQL, MCP servers
- **PostgreSQL Database**: Centralized data persistence for all writing projects
- **MCP Servers**: Workflow Manager MCP (port 3012), Writing Servers, other context servers
- **Docker Management**: Automated container orchestration and health monitoring
- **Client Integration**: Typing Mind, Claude Desktop
- **Technology Stack**: Electron, TypeScript, Docker, PostgreSQL, Node.js

### Key Integration Point: Workflow Manager MCP
The Workflow Manager MCP Server (running on port 3012) provides:
- Workflow lifecycle management (create, advance phases, complete)
- Phase execution tracking
- Quality gate validation
- Approval workflows
- Metrics and analytics
- Multi-book series progress tracking
- Production metric recording

---

## Proposed Architecture: BQ-Studio as FictionLab Plugin

### Design Philosophy

**Separation of Concerns:**
1. **FictionLab**: Infrastructure provider (DB, MCP servers, Docker, system services)
2. **BQ-Studio Plugin**: Specialized execution engine for Claude Code + publishing workflows

**Key Principle:** Studio becomes a "smart client" that connects to FictionLab's infrastructure rather than managing its own.

---

## Architecture Components

### 1. Plugin Distribution Model

```
BQ-Studio-Plugin/
├── plugin.json                 # Plugin manifest for FictionLab
├── dist/                       # Compiled plugin bundle
│   ├── main.js                # Main plugin entry point
│   ├── renderer.bundle.js     # UI components bundle
│   └── workers/               # Background workers
├── src/
│   ├── plugin-entry.ts        # Plugin lifecycle hooks
│   ├── core/                  # Core services (adapted)
│   │   ├── agent-orchestration/
│   │   ├── claude-code-executor/
│   │   ├── session-manager/
│   │   ├── usage-tracker/
│   │   └── workflow-client/   # MCP workflow client
│   ├── ui/                    # React components
│   └── types/                 # TypeScript definitions
└── package.json               # Plugin dependencies
```

### 2. Plugin Manifest (`plugin.json`)

```json
{
  "id": "bq-studio",
  "name": "BQ Studio - Publishing Workflow Engine",
  "version": "1.0.0",
  "description": "AI-powered publishing workflows using Claude Code in headless mode",
  "author": "BQ Studio Team",
  "fictionLabVersion": ">=0.1.0",
  "pluginType": "execution-engine",

  "entry": {
    "main": "dist/main.js",
    "renderer": "dist/renderer.bundle.js"
  },

  "permissions": {
    "database": true,
    "mcp": ["workflow-manager"],
    "fileSystem": true,
    "network": true,
    "childProcesses": true
  },

  "dependencies": {
    "mcp-servers": ["workflow-manager@>=1.0.0"],
    "fictionlab-api": "^1.0.0"
  },

  "ui": {
    "mainView": "StudioDashboard",
    "menuItems": [
      {
        "label": "BQ Studio",
        "submenu": [
          "New Series",
          "Active Jobs",
          "Usage Tracking",
          "Settings"
        ]
      }
    ],
    "sidebarWidget": "StudioQuickActions",
    "settingsPanel": "StudioSettings"
  },

  "mcpIntegration": {
    "workflowManager": {
      "required": true,
      "endpoint": "http://localhost:3012"
    }
  }
}
```

### 3. Plugin Entry Point Architecture

```typescript
// src/plugin-entry.ts
import { FictionLabPlugin, PluginContext } from '@fictionlab/plugin-api';
import { AgentOrchestrationService } from './core/agent-orchestration/AgentOrchestrationService';
import { WorkflowManagerClient } from './core/workflow-client/WorkflowManagerClient';
import { SessionManager } from './core/session-manager/SessionManager';

export default class BQStudioPlugin implements FictionLabPlugin {
  id = 'bq-studio';
  name = 'BQ Studio';
  version = '1.0.0';

  private orchestrationService: AgentOrchestrationService;
  private workflowClient: WorkflowManagerClient;
  private sessionManager: SessionManager;
  private context: PluginContext;

  async onActivate(context: PluginContext): Promise<void> {
    this.context = context;

    // Connect to FictionLab services
    const database = context.services.database; // PostgreSQL from FictionLab
    const mcp = context.services.mcp; // MCP connection manager
    const fileSystem = context.services.fileSystem;

    // Initialize Workflow Manager MCP client
    this.workflowClient = new WorkflowManagerClient(
      mcp.getEndpoint('workflow-manager')
    );

    // Initialize session manager (stores Claude auth in PostgreSQL)
    this.sessionManager = new SessionManager(database);

    // Initialize orchestration service
    this.orchestrationService = new AgentOrchestrationService({
      workspaceRoot: context.workspace.root,
      workflowClient: this.workflowClient,
      sessionManager: this.sessionManager,
      database: database,
      fileSystem: fileSystem
    });

    // Register IPC handlers for renderer
    context.ipc.handle('studio:create-job', this.handleCreateJob.bind(this));
    context.ipc.handle('studio:get-queue-status', this.handleGetQueueStatus.bind(this));
    context.ipc.handle('studio:pause-job', this.handlePauseJob.bind(this));
    context.ipc.handle('studio:resume-job', this.handleResumeJob.bind(this));
    context.ipc.handle('studio:cancel-job', this.handleCancelJob.bind(this));
    context.ipc.handle('studio:authenticate', this.handleAuthenticate.bind(this));
    context.ipc.handle('studio:get-usage', this.handleGetUsage.bind(this));

    // Register menu items
    context.ui.registerMenuItem({
      label: 'New Series Workflow',
      click: () => context.ui.showView('StudioDashboard')
    });

    console.log('BQ Studio plugin activated');
  }

  async onDeactivate(): Promise<void> {
    this.orchestrationService?.cleanup();
    console.log('BQ Studio plugin deactivated');
  }

  private async handleCreateJob(event, params) {
    return this.orchestrationService.createJob(
      params.seriesId,
      params.seriesName,
      params.skillName,
      params.userPrompt
    );
  }

  // ... other handlers
}
```

### 4. Data Architecture: PostgreSQL Integration

#### Database Schema Extensions

Studio extends FictionLab's PostgreSQL schema with plugin-specific tables:

```sql
-- Studio-specific tables (added to FictionLab DB)
CREATE SCHEMA IF NOT EXISTS bq_studio;

-- Claude session management
CREATE TABLE bq_studio.claude_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id),
  session_token TEXT NOT NULL,
  subscription_tier VARCHAR(10) CHECK (subscription_tier IN ('pro', 'max')),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Execution job queue (transient state, complements workflow_instances)
CREATE TABLE bq_studio.execution_jobs (
  id UUID PRIMARY KEY,
  workflow_id INTEGER REFERENCES public.workflow_instances(workflow_id),
  series_id INTEGER REFERENCES public.series(series_id),
  status VARCHAR(20) CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  current_phase VARCHAR(100),
  progress INTEGER DEFAULT 0,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_code VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Job logs
CREATE TABLE bq_studio.job_logs (
  id SERIAL PRIMARY KEY,
  job_id UUID REFERENCES bq_studio.execution_jobs(id) ON DELETE CASCADE,
  timestamp TIMESTAMP DEFAULT NOW(),
  level VARCHAR(10) CHECK (level IN ('info', 'warn', 'error', 'debug')),
  source VARCHAR(50),
  message TEXT
);

-- Token usage tracking
CREATE TABLE bq_studio.token_usage (
  id SERIAL PRIMARY KEY,
  job_id UUID REFERENCES bq_studio.execution_jobs(id),
  series_id INTEGER REFERENCES public.series(series_id),
  timestamp TIMESTAMP DEFAULT NOW(),
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED
);

-- Claude Code execution metadata
CREATE TABLE bq_studio.execution_metadata (
  id SERIAL PRIMARY KEY,
  job_id UUID REFERENCES bq_studio.execution_jobs(id),
  workspace_dir TEXT NOT NULL,
  skill_name VARCHAR(100),
  user_prompt TEXT,
  claude_code_version VARCHAR(20),
  execution_config JSONB,
  result JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Data Access Layer

```typescript
// src/core/database/StudioDatabase.ts
export class StudioDatabase {
  constructor(private db: FictionLabDatabase) {}

  async saveSession(userId: number, sessionToken: string, tier: 'pro' | 'max', expiresAt?: Date) {
    return this.db.query(
      `INSERT INTO bq_studio.claude_sessions (user_id, session_token, subscription_tier, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET session_token = $2, subscription_tier = $3, expires_at = $4, updated_at = NOW()
       RETURNING *`,
      [userId, sessionToken, tier, expiresAt]
    );
  }

  async createExecutionJob(jobData: ExecutionJobData) {
    return this.db.query(
      `INSERT INTO bq_studio.execution_jobs
       (id, workflow_id, series_id, status, current_phase, max_retries)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [jobData.id, jobData.workflowId, jobData.seriesId, 'pending', null, 3]
    );
  }

  async updateJobProgress(jobId: string, progress: number, phase: string) {
    return this.db.query(
      `UPDATE bq_studio.execution_jobs
       SET progress = $2, current_phase = $3, updated_at = NOW()
       WHERE id = $1`,
      [jobId, progress, phase]
    );
  }

  async addJobLog(jobId: string, level: string, message: string, source?: string) {
    return this.db.query(
      `INSERT INTO bq_studio.job_logs (job_id, level, message, source)
       VALUES ($1, $2, $3, $4)`,
      [jobId, level, message, source]
    );
  }

  async recordTokenUsage(jobId: string, seriesId: number, inputTokens: number, outputTokens: number) {
    return this.db.query(
      `INSERT INTO bq_studio.token_usage (job_id, series_id, input_tokens, output_tokens)
       VALUES ($1, $2, $3, $4)`,
      [jobId, seriesId, inputTokens, outputTokens]
    );
  }

  async getJobsByStatus(status: string[]) {
    return this.db.query(
      `SELECT * FROM bq_studio.execution_jobs
       WHERE status = ANY($1)
       ORDER BY created_at ASC`,
      [status]
    );
  }

  async getSeriesTokenUsage(seriesId: number) {
    return this.db.query(
      `SELECT
         SUM(input_tokens) as total_input,
         SUM(output_tokens) as total_output,
         SUM(total_tokens) as total_tokens,
         COUNT(*) as request_count
       FROM bq_studio.token_usage
       WHERE series_id = $1`,
      [seriesId]
    );
  }
}
```

### 5. MCP Integration: Workflow Manager Client

Studio acts as an **MCP client** connecting to FictionLab's Workflow Manager MCP server.

**Key Integration Pattern:**

```typescript
// src/core/workflow-client/WorkflowManagerClient.ts
export class WorkflowManagerClient {
  constructor(
    private mcpConnection: MCPConnection, // Provided by FictionLab
    private endpoint: string = 'http://localhost:3012'
  ) {}

  async createWorkflow(params: {
    series_id: number;
    user_id: number;
    concept?: string;
  }): Promise<WorkflowInstance> {
    return this.callMCPTool('create_workflow', params);
  }

  async advanceToPhase(workflowId: number, phaseNumber: number) {
    return this.callMCPTool('advance_to_phase', {
      workflow_id: workflowId,
      phase_number: phaseNumber
    });
  }

  async completeCurrentPhase(workflowId: number, output?: any) {
    return this.callMCPTool('complete_current_phase', {
      workflow_id: workflowId,
      output
    });
  }

  async recordQualityGate(params: QualityGateParams) {
    return this.callMCPTool('record_quality_gate', params);
  }

  async getWorkflowMetrics(workflowId: number) {
    return this.callMCPTool('get_workflow_metrics', {
      workflow_id: workflowId
    });
  }

  private async callMCPTool<T>(toolName: string, args: Record<string, any>): Promise<T> {
    return this.mcpConnection.callTool(this.endpoint, toolName, args);
  }
}
```

### 6. Claude Code Execution in Headless Mode

**Key Difference:** Studio runs Claude Code CLI in headless mode using the user's authenticated session token.

```typescript
// src/core/claude-code-executor/ClaudeCodeExecutor.ts
export class ClaudeCodeExecutor {
  async execute(
    jobId: string,
    config: ClaudeCodeExecutionConfig,
    onOutput: (output: string, isError: boolean) => void,
    onProgress: (progress: number, phase: string) => void
  ): Promise<ClaudeCodeExecutionResult> {

    const args = [
      'claude-code',
      '--headless',
      '--session-token', config.sessionToken,
      '--workspace', path.join(config.workspaceRoot, config.seriesDir),
      '--skill', config.skillName,
      '--input', config.input,
      '--auto-approve',
      '--json-output'
    ];

    const process = spawn('npx', args, {
      cwd: config.workspaceRoot,
      env: {
        ...process.env,
        CLAUDE_SESSION_TOKEN: config.sessionToken,
        NO_COLOR: '1' // Disable color codes for parsing
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Stream output parsing
    process.stdout.on('data', (data) => {
      const output = data.toString();
      this.parseOutput(output, onOutput, onProgress);
    });

    process.stderr.on('data', (data) => {
      onOutput(data.toString(), true);
    });

    return new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: this.collectedOutput });
        } else {
          resolve({
            success: false,
            error: {
              code: 'EXECUTION_FAILED',
              message: `Claude Code exited with code ${code}`,
              recoverable: false
            }
          });
        }
      });
    });
  }

  private parseOutput(
    output: string,
    onOutput: (output: string, isError: boolean) => void,
    onProgress: (progress: number, phase: string) => void
  ) {
    // Parse JSON-formatted output from Claude Code
    try {
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          const json = JSON.parse(line);

          if (json.type === 'progress') {
            onProgress(json.progress, json.phase);
          } else if (json.type === 'token_usage') {
            // Handle token usage separately
          } else if (json.type === 'output') {
            onOutput(json.message, false);
          }
        } else {
          onOutput(line, false);
        }
      }
    } catch (e) {
      // Fallback to plain text output
      onOutput(output, false);
    }
  }
}
```

### 7. Agent Orchestration Service (Adapted)

```typescript
// src/core/agent-orchestration/AgentOrchestrationService.ts
export class AgentOrchestrationService extends EventEmitter {
  constructor(private config: {
    workspaceRoot: string;
    workflowClient: WorkflowManagerClient;
    sessionManager: SessionManager;
    database: StudioDatabase;
    fileSystem: FileSystemService;
  }) {
    super();
    this.queueManager = new QueueManager({ maxConcurrent: 3 });
    this.claudeCodeExecutor = new ClaudeCodeExecutor();
    this.usageTracker = new UsageTracker(config.database);
  }

  async createJob(
    seriesId: number,
    seriesName: string,
    skillName: string,
    userPrompt: string
  ): Promise<string> {
    // 1. Validate Claude session
    if (!this.config.sessionManager.isAuthenticated()) {
      throw new Error('Claude Pro/Max authentication required');
    }

    // 2. Create workflow in Workflow Manager MCP
    const workflow = await this.config.workflowClient.createWorkflow({
      series_id: seriesId,
      user_id: this.config.sessionManager.getUserId(),
      concept: userPrompt
    });

    // 3. Create execution job in Studio database
    const job: ExecutionJob = {
      id: randomUUID(),
      workflowId: workflow.workflow_id,
      seriesId,
      seriesName,
      workspaceDir: `series-${seriesId}`,
      skillName,
      userPrompt,
      status: 'pending',
      currentPhase: null,
      progress: 0,
      createdAt: new Date(),
      tokensUsed: { input: 0, output: 0, total: 0 },
      retryCount: 0,
      maxRetries: 3
    };

    await this.config.database.createExecutionJob(job);

    // 4. Enqueue for execution
    await this.queueManager.enqueue(job);

    // 5. Start processing
    await this.processQueue();

    return job.id;
  }

  private async startJob(jobId: string): Promise<void> {
    const job = this.queueManager.getJob(jobId);
    if (!job) return;

    try {
      // Get Claude session token
      const sessionToken = this.config.sessionManager.getSessionToken();

      // Execute Claude Code in headless mode
      const result = await this.claudeCodeExecutor.execute(
        jobId,
        {
          workspaceRoot: this.config.workspaceRoot,
          seriesDir: job.workspaceDir,
          skillName: job.skillName,
          input: job.userPrompt,
          sessionToken,
          autoApprove: true
        },
        (output, isError) => this.handleOutput(jobId, output, isError),
        (progress, phase) => this.handleProgress(jobId, progress, phase)
      );

      if (result.success) {
        // Update workflow in MCP
        await this.config.workflowClient.completeCurrentPhase(
          job.workflowId,
          result.output
        );

        await this.completeJob(jobId, result);
      } else {
        await this.failJob(jobId, result);
      }
    } catch (error) {
      await this.handleJobError(jobId, error);
    }
  }

  private async handleProgress(jobId: string, progress: number, phase: string) {
    // Update local job state
    this.queueManager.updateJobProgress(jobId, progress, phase);

    // Update database
    await this.config.database.updateJobProgress(jobId, progress, phase);

    // Update workflow phase in MCP
    const job = this.queueManager.getJob(jobId);
    if (job?.workflowId) {
      const phaseNumber = this.getPhaseNumberFromName(phase);
      if (phaseNumber > 0) {
        await this.config.workflowClient.advanceToPhase(
          job.workflowId,
          phaseNumber
        );
      }
    }

    // Emit event for UI
    this.emit('phase-progress', { jobId, phase, progress });
  }

  private async handleOutput(jobId: string, output: string, isError: boolean) {
    const level = isError ? 'error' : 'info';

    // Store in database
    await this.config.database.addJobLog(jobId, level, output, 'claude-code');

    // Parse for token usage
    const tokenData = this.parseTokenUsage(output);
    if (tokenData) {
      const job = this.queueManager.getJob(jobId);
      await this.config.database.recordTokenUsage(
        jobId,
        job.seriesId,
        tokenData.input,
        tokenData.output
      );

      this.emit('tokens-used', { jobId, ...tokenData });
    }

    // Emit log event
    this.emit('log', { jobId, level, message: output });
  }
}
```

### 8. UI Integration with FictionLab

#### React Components for Studio Dashboard

```typescript
// src/ui/StudioDashboard.tsx
import React from 'react';
import { useFictionLabPlugin } from '@fictionlab/plugin-react';

export const StudioDashboard: React.FC = () => {
  const { ipc, database, ui } = useFictionLabPlugin();
  const [queueStatus, setQueueStatus] = useState<ExecutionQueue | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Subscribe to queue updates
    ipc.on('studio:queue-updated', (event, status) => {
      setQueueStatus(status);
    });

    // Check authentication status
    ipc.invoke('studio:is-authenticated').then(setIsAuthenticated);

    return () => {
      ipc.removeAllListeners('studio:queue-updated');
    };
  }, []);

  const handleCreateJob = async (seriesId: number, skillName: string, prompt: string) => {
    try {
      const jobId = await ipc.invoke('studio:create-job', {
        seriesId,
        seriesName: 'My Series',
        skillName,
        userPrompt: prompt
      });

      ui.showNotification({
        type: 'success',
        message: `Job ${jobId} created successfully`
      });
    } catch (error) {
      ui.showNotification({
        type: 'error',
        message: `Failed to create job: ${error.message}`
      });
    }
  };

  return (
    <div className="studio-dashboard">
      <header>
        <h1>BQ Studio - Publishing Workflow Engine</h1>
        {!isAuthenticated && (
          <ClaudeAuthButton onAuth={() => setIsAuthenticated(true)} />
        )}
      </header>

      <section className="queue-overview">
        <h2>Execution Queue</h2>
        {queueStatus && (
          <QueueStatusWidget
            running={queueStatus.running}
            pending={queueStatus.pending}
            completed={queueStatus.completed}
          />
        )}
      </section>

      <section className="active-jobs">
        <h2>Active Jobs</h2>
        {queueStatus?.running.map(job => (
          <JobCard
            key={job.id}
            job={job}
            onPause={(id) => ipc.invoke('studio:pause-job', id)}
            onCancel={(id) => ipc.invoke('studio:cancel-job', id)}
          />
        ))}
      </section>

      <section className="create-new">
        <h2>Start New Workflow</h2>
        <WorkflowCreator onSubmit={handleCreateJob} />
      </section>
    </div>
  );
};
```

### 9. FictionLab Plugin API Requirements

For Studio to work as a plugin, FictionLab needs to provide:

```typescript
// @fictionlab/plugin-api (provided by FictionLab)

export interface PluginContext {
  // Core services
  services: {
    database: FictionLabDatabase;      // PostgreSQL connection
    mcp: MCPConnectionManager;         // MCP client manager
    fileSystem: FileSystemService;     // File operations
    docker: DockerService;             // Docker management (optional)
  };

  // Workspace info
  workspace: {
    root: string;                      // User's workspace root
    config: WorkspaceConfig;
  };

  // IPC for renderer communication
  ipc: {
    handle: (channel: string, handler: Function) => void;
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
  };

  // UI integration
  ui: {
    registerMenuItem: (item: MenuItem) => void;
    registerSidebarWidget: (widget: Widget) => void;
    showView: (viewId: string) => void;
    showNotification: (notification: Notification) => void;
  };

  // Plugin metadata
  plugin: {
    id: string;
    version: string;
    dataPath: string;                  // Plugin-specific data directory
  };
}

export interface FictionLabDatabase {
  query: (sql: string, params?: any[]) => Promise<any>;
  transaction: (callback: (client: any) => Promise<void>) => Promise<void>;
  pool: any; // pg.Pool instance
}

export interface MCPConnectionManager {
  getEndpoint: (serverId: string) => string;
  callTool: (endpoint: string, toolName: string, args: any) => Promise<any>;
  isServerRunning: (serverId: string) => Promise<boolean>;
}

export interface FileSystemService {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  mkdir: (path: string) => Promise<void>;
}
```

---

## Migration Strategy

### Phase 1: Core Refactoring (Weeks 1-2)
- Remove Electron app wrapper from Studio
- Refactor core services to accept external dependencies
- Implement plugin entry point and lifecycle hooks
- Create FictionLab plugin API contract

### Phase 2: Database Migration (Week 3)
- Replace SQLite with PostgreSQL access layer
- Create Studio schema in PostgreSQL
- Migrate data persistence logic
- Test database operations

### Phase 3: MCP Integration (Week 4)
- Implement WorkflowManagerClient using FictionLab's MCP connection
- Update AgentOrchestrationService to use MCP workflow management
- Test workflow lifecycle integration
- Implement quality gates and metrics

### Phase 4: UI Integration (Week 5)
- Port React components to plugin format
- Integrate with FictionLab's UI system (menus, notifications, views)
- Create plugin settings panel
- Test UI in FictionLab environment

### Phase 5: Claude Code Execution (Week 6)
- Adapt ClaudeCodeExecutor for headless mode
- Implement session token management via FictionLab's secure storage
- Test execution with user's Claude subscription
- Implement error handling and retry logic

### Phase 6: Testing & Polish (Week 7)
- End-to-end testing of complete workflows
- Performance optimization
- Documentation
- User acceptance testing

### Phase 7: Deployment (Week 8)
- Package plugin for distribution
- Create installation guide
- Publish to FictionLab plugin registry
- Monitor initial deployments

---

## Benefits of Plugin Architecture

### For Users
1. **Single Installation**: Install FictionLab once, add Studio as a plugin
2. **Unified Database**: All writing data in one PostgreSQL database
3. **Shared Infrastructure**: Docker, MCP servers managed by FictionLab
4. **Lower Resource Usage**: No duplicate services or processes
5. **Use Your Own Subscription**: Studio uses your Claude Pro/Max account, no API costs

### For Developers
1. **Separation of Concerns**: Studio focuses on Claude Code orchestration, not infrastructure
2. **Easier Maintenance**: FictionLab handles Docker, DB, MCP updates
3. **Interoperability**: Multiple plugins can share workflow data via MCP
4. **Faster Iteration**: Changes to Studio don't require infrastructure updates
5. **Plugin Ecosystem**: Other developers can build complementary plugins

### For FictionLab
1. **Value-Add Plugin**: Attracts users who need AI-powered publishing workflows
2. **Reference Implementation**: Shows how to build sophisticated plugins
3. **MCP Showcase**: Demonstrates MCP server usage
4. **Ecosystem Growth**: Encourages other workflow-based plugins

---

## Security Considerations

### Claude Session Token Storage
- **Current (Standalone)**: Stored in electron-store (encrypted at rest)
- **Plugin**: Store in FictionLab's secure credential manager or PostgreSQL with encryption
- **Access Control**: Only Studio plugin can access its session tokens

### Child Process Execution
- Studio spawns Claude Code CLI as child process
- **Permission Required**: `childProcesses: true` in plugin manifest
- **Sandboxing**: Claude Code runs in user's workspace directory
- **Monitoring**: FictionLab can monitor resource usage and kill runaway processes

### Database Access
- Studio creates its own schema (`bq_studio`)
- **Isolated**: Cannot access other plugins' data directly
- **Shared Tables**: Can read/write to `workflow_instances` via MCP only
- **Audit Trail**: All workflow changes logged by MCP server

---

## Open Questions & Decisions

### 1. Plugin Distribution
- **Option A**: NPM package installed via FictionLab UI
- **Option B**: Self-contained bundle (ZIP) uploaded to FictionLab
- **Option C**: FictionLab plugin registry/marketplace

**Recommendation**: Start with Option B (ZIP bundle), evolve to Option C

### 2. Claude Authentication Flow
- **Option A**: Studio handles auth, stores token
- **Option B**: FictionLab provides centralized Claude auth service
- **Option C**: Hybrid - Studio manages its own auth using FictionLab's secure storage

**Recommendation**: Option C for v1, Option B for future versions

### 3. Workspace Management
- **Option A**: Studio creates subdirectories in FictionLab workspace
- **Option B**: Studio requests dedicated workspace from FictionLab
- **Option C**: User chooses workspace location during first run

**Recommendation**: Option A (simplest)

### 4. Claude Code CLI Distribution
- **Assumption**: User has Claude Code CLI installed globally (`npx claude-code`)
- **Alternative**: Bundle Claude Code CLI with plugin
- **Issue**: Claude Code is proprietary, bundling may violate terms

**Recommendation**: Document requirement, provide installation check/guidance

---

## Success Metrics

### Technical
- Plugin load time < 2 seconds
- Job creation latency < 500ms
- Database query performance < 100ms (p95)
- Claude Code execution overhead < 5%
- Memory usage < 200MB (idle), < 1GB (active)

### User Experience
- Single-click plugin installation
- Zero configuration required (uses FictionLab's setup)
- Real-time job progress updates
- Token usage tracking accuracy > 99%
- Job success rate > 95%

### Business
- 50+ plugin installations in first month
- 80%+ user retention after 30 days
- <5% support ticket rate
- Positive user reviews (>4.0/5.0)

---

## Conclusion

Transforming BQ-Studio into a FictionLab plugin represents a strategic architectural shift that:

1. **Simplifies infrastructure management** by leveraging FictionLab's PostgreSQL, Docker, and MCP services
2. **Focuses Studio's core competency** on Claude Code orchestration and publishing workflows
3. **Improves user experience** with a unified installation and shared database
4. **Enables ecosystem growth** by demonstrating plugin patterns for other developers
5. **Reduces costs** by using the user's Claude Pro/Max subscription instead of API fees

The proposed architecture maintains Studio's powerful agent orchestration capabilities while integrating seamlessly with FictionLab's infrastructure. The plugin model provides clear separation of concerns, better resource efficiency, and a foundation for building a rich plugin ecosystem.

**Next Steps:**
1. Review and approve architectural plan
2. Define FictionLab Plugin API contract
3. Begin Phase 1 refactoring
4. Create proof-of-concept plugin
5. Test integration with FictionLab
6. Iterate based on feedback

---

## Appendix: File Structure Comparison

### Current (Standalone)
```
BQ-Studio/
├── src/
│   ├── main/                    # Electron main process
│   ├── renderer/                # React UI
│   ├── core/                    # Core services
│   └── preload/                 # IPC bridge
├── database/                    # SQLite schemas
├── package.json
└── electron config
```

### Proposed (Plugin)
```
BQ-Studio-Plugin/
├── src/
│   ├── plugin-entry.ts          # Plugin lifecycle
│   ├── core/                    # Core services (adapted)
│   │   ├── agent-orchestration/
│   │   ├── claude-code-executor/
│   │   ├── session-manager/
│   │   ├── usage-tracker/
│   │   └── workflow-client/     # MCP client
│   ├── ui/                      # React components
│   ├── database/                # PostgreSQL schema extensions
│   └── types/
├── dist/                        # Built plugin
├── plugin.json                  # Plugin manifest
└── package.json
```

**Key Changes:**
- ❌ Remove: Electron main process, preload scripts, window management
- ❌ Remove: SQLite database, electron-store
- ➕ Add: Plugin entry point, FictionLab plugin API usage
- ➕ Add: PostgreSQL data layer, MCP client integration
- ✏️ Adapt: Core services to accept external dependencies
- ✏️ Adapt: UI components for plugin environment
