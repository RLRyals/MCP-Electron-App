# FictionLab + Claude Code Workflow Quick Start

This guide walks you through setting up a new writing project in FictionLab and running workflows from Claude Code.

---

## Prerequisites

Before starting, ensure you have:

- [ ] FictionLab app installed
- [ ] Docker Desktop running
- [ ] Claude Code CLI installed (`claude` command available)
- [ ] workflow-runner package built: `cd c:/github/workflow-runner && npm run build`

---

## Part 1: FictionLab Setup

### Step 1: Start FictionLab

1. Open FictionLab app
2. Wait for Docker containers to start (check Services tab - all should be green)
3. Verify the Workflows tab is accessible

### Step 2: Create a New Project

1. Click the **project selector** in the top bar (shows "No Project" or current project name)
2. Click **"Create New Project"**
3. Fill in the dialog:
   - **Project Name**: Enter your project name (e.g., "Shadow Archives Series")
   - **Project Folder**: Click "Browse..." and select/create a folder for your project
   - **Initialize workspace structure**: Leave checked (recommended)
   - **Genre Pack**: Select a genre pack if applicable (e.g., "Urban Fantasy Police Procedural")
4. Click **"Create Project"**

This creates:
```
your-project-folder/
├── .claude/
│   ├── settings.json          # Project metadata
│   └── genre-packs/           # Genre templates (if selected)
│       └── urban-fantasy-police-procedural/
├── planning/
│   ├── character-profiles/
│   └── world-building/
├── books/
└── exports/
```

### Step 3: Select Your Project

1. Click the project selector in the top bar
2. Click on your project name
3. A checkmark appears next to the active project
4. The project's `folder_path` is now available to workflows

### Step 4: Import Workflows (First Time Only)

If workflows aren't already imported:

1. Go to the **Workflows** tab
2. Click **"Import Workflow"**
3. Select a workflow definition (e.g., `workflows/12-phase-novel-series.json`)
4. The workflow is now available in the system

---

## Part 2: Claude Code Setup

### Step 1: Open Your Project in Claude Code

```bash
# Navigate to your project folder
cd c:/path/to/your-project-folder

# Start Claude Code
claude
```

### Step 2: Verify the run-workflow Skill

The `run-workflow` skill should be automatically available. You can verify by checking:
```
~/.claude/skills/run-workflow/
```

If missing, restart FictionLab - it auto-installs the skill on startup.

### Step 3: Test Connection

In Claude Code, verify FictionLab is running:

```bash
node c:/github/workflow-runner/dist/index.js list
```

This should list available workflows.

---

## Part 3: Running Workflows

### Option A: Using the /run-workflow Skill (Recommended)

In Claude Code, simply use:

```
/run-workflow execute 12-phase-novel-pipeline
```

Or with options:
```
/run-workflow execute series-architecture --variables '{"genre":"Urban Fantasy"}'
```

### Option B: Using Node CLI Directly

```bash
# List workflows
node c:/github/workflow-runner/dist/index.js list

# Execute a workflow
node c:/github/workflow-runner/dist/index.js execute 12-phase-novel-pipeline

# Execute with variables
node c:/github/workflow-runner/dist/index.js execute series-architecture \
  --workspace "c:/path/to/project" \
  --variables '{"genre":"Urban Fantasy","targetWordCount":80000}'
```

### Option C: Programmatic (in scripts)

```javascript
const { WorkflowRunner } = require('@fictionlab/workflow-runner');

async function main() {
  const runner = new WorkflowRunner();

  const result = await runner.execute('12-phase-novel-pipeline', {
    workspaceRoot: process.cwd(),
    initialVariables: {
      genre: 'Urban Fantasy',
      bookTitle: 'Shadow Archives Book 1'
    }
  });

  if (result.success) {
    console.log('Workflow completed!', result.outputs);
  } else {
    console.error('Workflow failed:', result.error);
  }
}

main();
```

---

## Available Workflows

| Workflow ID | Description | Use Case |
|-------------|-------------|----------|
| `12-phase-novel-pipeline` | Complete 5-book series workflow | Full series from idea to manuscript |
| `series-architecture` | Series planning only | Plan series structure, character arcs |
| `chapter-writing-workflow` | Single chapter writing | Write individual chapters |
| `npe-validation-gate` | Quality validation | Validate outline/manuscript quality |

List all available workflows:
```bash
node c:/github/workflow-runner/dist/index.js list
```

---

## Workflow Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR IDE (Claude Code)                    │
├─────────────────────────────────────────────────────────────────┤
│  /run-workflow execute 12-phase-novel-pipeline                  │
│       │                                                          │
│       ▼                                                          │
│  workflow-runner package                                         │
│       │                                                          │
│       ▼                                                          │
│  IPC Socket (\\.\pipe\fictionlab-workflow-runner)               │
└───────┬─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FICTIONLAB APP                              │
├─────────────────────────────────────────────────────────────────┤
│  IDE IPC Server                                                  │
│       │                                                          │
│       ▼                                                          │
│  Workflow Plugin → WorkflowRunner                                │
│       │                                                          │
│       ▼                                                          │
│  MCP Client (JSON-RPC over stdio)                               │
│       │                                                          │
│       ▼                                                          │
│  workflow-manager MCP Server (Docker)                           │
│       │                                                          │
│       ▼                                                          │
│  PostgreSQL Database                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### "MCP connection failed"

**Cause**: FictionLab not running or Docker containers down

**Fix**:
1. Open FictionLab
2. Check Services tab - all services should be green
3. If services are red, click "Start All" or restart Docker Desktop

### "Workflow not found"

**Cause**: Workflow not imported into database

**Fix**:
1. In FictionLab, go to Workflows tab
2. Click "Import Workflow"
3. Select the workflow JSON file

### "Skill not available" in Claude Code

**Cause**: run-workflow skill not installed

**Fix**:
1. Restart FictionLab (auto-installs skill)
2. Or manually check: `ls ~/.claude/skills/run-workflow/`

### "No active project"

**Cause**: No project selected in FictionLab

**Fix**:
1. In FictionLab, click project selector in top bar
2. Select your project (or create one)

### Workflow execution hangs

**Cause**: Waiting for user input or agent execution

**Fix**:
1. Check FictionLab Workflows tab for prompts
2. Some nodes require approval - check for pending gates

---

## Tips for Success

### Before Starting a Workflow

1. **Select your project** in FictionLab's top bar
2. **Verify Docker is running** (check Services tab)
3. **Have your idea ready** - workflows start by asking for your book/series concept

### During Workflow Execution

1. **Watch for prompts** - Some phases ask for your input or approval
2. **Review quality gates** - NPE validation and quality checks require scores >= 80
3. **Check outputs** - Workflow creates files in your project folder

### After Workflow Completion

1. **Review generated files** in your project folder
2. **Check `.claude/settings.json`** for workflow state
3. **Run quality checks** if needed: `/run-workflow execute npe-validation-gate`

---

## Quick Reference

### FictionLab Actions

| Action | Location |
|--------|----------|
| Create project | TopBar → Project dropdown → "Create New Project" |
| Select project | TopBar → Project dropdown → Click project name |
| Import workflow | Workflows tab → "Import Workflow" |
| View workflow status | Workflows tab → Select workflow |
| Check services | Services tab |

### Claude Code Commands

| Command | Purpose |
|---------|---------|
| `/run-workflow list` | List available workflows |
| `/run-workflow execute <id>` | Run a workflow |
| `/run-workflow get <id>` | Get workflow details |

### File Locations

| Item | Path |
|------|------|
| Workflow-runner package | `c:/github/workflow-runner/` |
| Run-workflow skill | `~/.claude/skills/run-workflow/` |
| Genre packs (dev) | `c:/github/MCP-Electron-App/.claude/genre-packs/` |
| Project settings | `<project-folder>/.claude/settings.json` |

---

## Next Steps: Adapting for Antigravity Workflows

Once you have the basic workflow running, you can adapt it for Antigravity:

1. **Create custom workflow definitions** based on `12-phase-novel-series.json`
2. **Create Antigravity-specific genre packs** in `.claude/genre-packs/`
3. **Define custom agents** for Antigravity's writing style
4. **Import and test** the custom workflows

Let me know when you're ready to adapt workflows for Antigravity and I can help create the custom definitions.
