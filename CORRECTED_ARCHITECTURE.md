# FictionLab Workflow System - CORRECTED Architecture

**Date:** 2025-12-13
**Status:** Architecture Correction

---

## ❌ PREVIOUS MISTAKE - CORRECTED

**WRONG:** I incorrectly assumed Workflow Manager would use SQLite
**CORRECT:** ALL MCPs use PostgreSQL in Docker containers

---

## ✅ CORRECT ARCHITECTURE

### Infrastructure Stack

```
┌─────────────────────────────────────────────────────────────┐
│                  FictionLab Electron App                    │
│  (Installed on user's machine - NOT the same as repo)      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Clones and runs:                                          │
│  → github.com/user/MCP-Writing-Servers                     │
│                                                             │
│  Runs Docker Compose with:                                 │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Docker Containers:                               │    │
│  │  ├─ postgres:16 (fictionlab-postgres)            │    │
│  │  ├─ pgbouncer (connection pooling)               │    │
│  │  ├─ mcp-writing-servers (Node.js)                │    │
│  │  │   ├─ author-server                            │    │
│  │  │   ├─ series-planning-server                   │    │
│  │  │   ├─ character-planning-server                │    │
│  │  │   ├─ workflow-manager (NEW)                   │    │
│  │  │   └─ ... other MCP servers                    │    │
│  │  ├─ mcp-connector (TypingMind bridge)            │    │
│  │  └─ typingmind (nginx static files)              │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ File Structure Comparison

### Development (Repository)
```
c:\github\MCP-Electron-App\
├── src\
│   ├── main\       # Main process
│   ├── renderer\   # UI
│   └── types\      # TypeScript types
├── .claude\
│   ├── agents\     # Agent definitions (bundled)
│   ├── skills\     # Skill definitions (bundled)
│   └── genre-packs\
├── docker-compose.yml
└── package.json
```

### Production (Installed Electron App)
```
Installed App Location (e.g., C:\Program Files\FictionLab\)
├── resources\
│   ├── app.asar          # Compiled Electron app
│   ├── .claude\
│   │   ├── agents\       # Bundled agents (read-only)
│   │   ├── skills\       # Bundled skills (read-only)
│   │   └── genre-packs\  # Bundled genre packs (read-only)
│   └── workflows\
│       └── library\      # Bundled workflows (read-only)

User Data (Electron userData path)
├── Windows: %APPDATA%\FictionLab\
├── macOS: ~/Library/Application Support/FictionLab/
├── Linux: ~/.config/FictionLab/

FictionLab User Data:
├── docker-compose.yml    # Copied from resources
├── .env                  # Generated config
├── docker\
│   ├── init.sql
│   ├── pgbouncer.ini
│   └── userlist.txt
├── MCP-Writing-Servers\  # Cloned repo
│   ├── Dockerfile
│   ├── servers\
│   │   ├── author-server\
│   │   ├── series-planning-server\
│   │   ├── workflow-manager\  # NEW - to be created
│   │   └── ...
│   └── package.json
├── workflows\            # User-imported workflows
├── agents\               # User-installed agents
└── typing-mind\          # Downloaded if needed

Claude Code Skills (system-wide):
~/.claude/skills/         # Skills for Claude Code to find
```

---

## 🔧 MCP Writing Servers Repository

**Location:** `c:\github\MCP-Writing-Servers` (separate repo)

**Structure:**
```
MCP-Writing-Servers\
├── Dockerfile
├── package.json
├── servers\
│   ├── author-server\
│   │   ├── index.ts
│   │   └── schema.sql
│   ├── series-planning-server\
│   │   ├── index.ts
│   │   └── schema.sql
│   ├── character-planning-server\
│   ├── core-continuity-server\
│   ├── npe-config-server\
│   └── workflow-manager\        # NEW - TO CREATE
│       ├── index.ts             # MCP server implementation
│       ├── schema.sql           # PostgreSQL schema
│       └── README.md
└── mcp-config\
    └── config.json
```

---

## 📊 Workflow Manager MCP (PostgreSQL)

### Database Schema (PostgreSQL, NOT SQLite)

**File:** `MCP-Writing-Servers/servers/workflow-manager/schema.sql`

```sql
-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  graph_json JSONB NOT NULL,
  dependencies_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow instances (execution runs)
CREATE TABLE IF NOT EXISTS workflow_instances (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  status TEXT NOT NULL,  -- 'in_progress', 'paused', 'complete', 'failed'
  current_phase INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  context_json JSONB,
  error TEXT,
  locked_version TEXT   -- Version lock
);

-- Phase executions
CREATE TABLE IF NOT EXISTS phase_executions (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
  phase_id INTEGER NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'running', 'complete', 'failed', 'blocked'
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  output_json JSONB,
  error TEXT,
  claude_code_session TEXT  -- Session ID if using Claude Code
);

-- Quality gates
CREATE TABLE IF NOT EXISTS quality_gates (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
  phase_id INTEGER NOT NULL,
  gate_type TEXT NOT NULL,  -- 'npe_validation', 'commercial_validation', 'user_approval'
  criteria TEXT NOT NULL,
  result TEXT NOT NULL,  -- 'pass', 'fail', 'pending'
  score INTEGER,
  details_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Checkpoints (for resume capability)
CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
  phase_id INTEGER NOT NULL,
  state_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow versions
CREATE TABLE IF NOT EXISTS workflow_versions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  version TEXT NOT NULL,
  definition_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  changelog TEXT,
  parent_version TEXT
);

-- Version locks (prevent editing running workflows)
CREATE TABLE IF NOT EXISTS version_locks (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  version TEXT NOT NULL,
  locked_by_instance TEXT NOT NULL REFERENCES workflow_instances(id),
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_id ON workflow_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_phase_executions_instance_id ON phase_executions(instance_id);
CREATE INDEX IF NOT EXISTS idx_quality_gates_instance_id ON quality_gates(instance_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_instance_id ON checkpoints(instance_id);
```

---

## 🔌 How Electron App Communicates with MCPs

### Connection Flow

```
Electron Main Process
  ↓
Uses PostgreSQL Pool (pg library)
  ↓
Connects to: localhost:5433 (PgBouncer)
  ↓
PgBouncer pools to: fictionlab-postgres:5432
  ↓
PostgreSQL Database
  ↓
All MCP servers query same database
```

**Code (already exists in Electron app):**
```typescript
// src/main/database-connection.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: config.POSTGRES_PORT,  // 5433 (PgBouncer)
  database: config.POSTGRES_DB,
  user: config.POSTGRES_USER,
  password: config.POSTGRES_PASSWORD,
});
```

### Workflow Manager MCP Functions

**File:** `MCP-Writing-Servers/servers/workflow-manager/index.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Pool } from 'pg';

const server = new Server(
  {
    name: 'workflow-manager',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Tool: create_workflow
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'create_workflow') {
    const { id, name, version, graph, dependencies } = request.params.arguments;

    await pool.query(
      `INSERT INTO workflows (id, name, version, graph_json, dependencies_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, name, version, JSON.stringify(graph), JSON.stringify(dependencies)]
    );

    return {
      content: [{ type: 'text', text: `Workflow ${name} created successfully` }],
    };
  }

  // ... other tools: get_workflow, create_instance, start_phase, etc.
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## ✅ CORRECTED Implementation Plan

### Phase 1: Create Workflow Manager MCP (in MCP-Writing-Servers repo)

**Location:** `c:\github\MCP-Writing-Servers\servers\workflow-manager\`

**Files to Create:**
1. `schema.sql` - PostgreSQL schema (above)
2. `index.ts` - MCP server implementation
3. `README.md` - Documentation
4. Update `MCP-Writing-Servers/package.json` to include workflow-manager

### Phase 2: Electron App Integration

**Files to Create in MCP-Electron-App:**
1. `src/main/workflow/workflow-executor.ts` - Executes workflows
2. `src/main/workflow/workflow-client.ts` - Communicates with workflow-manager MCP via PostgreSQL
3. `src/main/parsers/agent-parser.ts` - Parse agent markdown
4. `src/main/parsers/skill-parser.ts` - Parse skill markdown
5. `src/main/dependency-resolver.ts` - Check dependencies
6. `src/main/import/folder-importer.ts` - Import workflow packages
7. `src/main/claude-code/executor.ts` - Spawn Claude Code processes

### Phase 3: UI Components (React)

**Files to Create:**
1. `src/renderer/views/WorkflowsView.tsx` - Main workflow view
2. `src/renderer/components/WorkflowCanvas.tsx` - React Flow visualization
3. Custom node components for different phase types
4. Status overlay components

---

## 🚀 Key Differences from Wrong Architecture

### ❌ WRONG (What I said before):
- "Workflow Manager MCP uses SQLite"
- "Store in `FictionLabUserData/db/workflow-manager.db`"
- "Initialize SQLite database"

### ✅ CORRECT (Actual architecture):
- **Workflow Manager MCP uses PostgreSQL** (same as all other MCPs)
- **Stored in Docker container** `fictionlab-postgres`
- **Schema in** `MCP-Writing-Servers/servers/workflow-manager/schema.sql`
- **Electron app connects via** PostgreSQL connection pool
- **MCP-Writing-Servers repo is cloned** by installed app
- **Docker Compose starts all services** including PostgreSQL + all MCPs

---

## 📂 Correct File Paths

### Development:
```
c:\github\MCP-Electron-App\          # Electron app repo
c:\github\MCP-Writing-Servers\       # MCP servers repo (separate)
```

### Production (Installed App):
```
C:\Program Files\FictionLab\
└── resources\
    ├── app.asar                     # Electron app
    └── [bundled read-only files]

%APPDATA%\FictionLab\                # User data
├── docker-compose.yml
├── .env
├── docker\
├── MCP-Writing-Servers\             # Cloned from GitHub
│   └── servers\
│       └── workflow-manager\        # NEW MCP server
├── workflows\                       # User workflows
├── agents\                          # User agents
└── typing-mind\

C:\Users\[User]\.claude\skills\      # Claude Code skills (system-wide)
```

---

## ✅ Corrected Deliverables

### To Create in `MCP-Writing-Servers` Repo:
1. `servers/workflow-manager/schema.sql`
2. `servers/workflow-manager/index.ts`
3. `servers/workflow-manager/README.md`

### To Create in `MCP-Electron-App` Repo:
1. Workflow execution engine (uses PostgreSQL pool)
2. Agent/skill parsers
3. Import system
4. Claude Code executor
5. React UI components
6. IPC handlers

### No SQLite - All PostgreSQL via Docker!

---

**ARCHITECTURE CORRECTED. Ready to implement with correct database strategy.**
