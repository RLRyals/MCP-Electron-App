# FictionLab + Claude Code Extension Quick Start

This guide is for using FictionLab workflows with the **Claude Code VS Code extension** (not the terminal CLI).

---

## Prerequisites

- [ ] FictionLab app installed and running
- [ ] Docker Desktop running (check FictionLab Services tab - all green)
- [ ] Claude Code VS Code extension installed
- [ ] Your project folder open in VS Code

---

## Part 1: FictionLab Setup

### Step 1: Start FictionLab

1. Open FictionLab app
2. Wait for Docker containers to start (Services tab - all should be green)
3. Verify the Workflows tab shows your workflows

### Step 2: Create a New Project

1. Click the **project selector** in the top bar
2. Click **"Create New Project"**
3. Fill in:
   - **Project Name**: Your series name (e.g., "Antigravity Series")
   - **Project Folder**: Click "Browse..." → select/create your project folder
   - **Initialize workspace structure**: Leave checked
   - **Genre Pack**: Select if applicable, or "None"
4. Click **"Create Project"**

### Step 3: Select Your Project

1. Click project selector in top bar
2. Click your project name (checkmark confirms selection)

---

## Part 2: VS Code Setup

### Step 1: Open Project in VS Code

1. Open VS Code
2. File → Open Folder → Select your project folder
3. Open the Claude Code extension panel

### Step 2: Verify Available Workflows

Your database has these workflows:
- `idea-to-series-2`
- `simple-test-2`

---

## Part 3: Running Workflows

### Using the /run-workflow Skill

In the Claude Code extension chat, type:

```
/run-workflow
```

This invokes the run-workflow skill which connects to FictionLab.

### Available Commands

**List workflows:**
```
/run-workflow list
```

**Execute a workflow:**
```
/run-workflow execute idea-to-series-2
```

**Execute simple test:**
```
/run-workflow execute simple-test-2
```

**Get workflow details:**
```
/run-workflow get idea-to-series-2
```

---

## What Happens When You Run a Workflow

1. **Claude Code extension** receives your `/run-workflow` command
2. **Skill connects** to FictionLab via IPC socket
3. **FictionLab** loads workflow from database
4. **Workflow executes** node by node
5. **Results returned** to Claude Code extension

```
VS Code (Claude Code Extension)
    │
    ▼ /run-workflow execute idea-to-series-2
    │
    ▼ IPC Socket Connection
    │
FictionLab App
    │
    ▼ Workflow Plugin
    │
    ▼ MCP Server (Docker)
    │
    ▼ PostgreSQL Database
```

---

## Example Session

### Starting a New Series

1. **In FictionLab**: Create project "My New Series", select folder, create
2. **In FictionLab**: Select "My New Series" in project dropdown
3. **In VS Code**: Open the project folder
4. **In Claude Code chat**:

```
/run-workflow execute idea-to-series-2
```

5. **Follow prompts** - the workflow will guide you through series planning

### Running a Quick Test

```
/run-workflow execute simple-test-2
```

This runs a simple workflow to verify everything is connected.

---

## Troubleshooting

### "Skill not found" or "/run-workflow doesn't work"

The skill should auto-install when FictionLab starts. Check:
- Is FictionLab running?
- Look for `~/.claude/skills/run-workflow/` folder

**Fix**: Restart FictionLab to reinstall the skill.

### "Connection failed" or "FictionLab not responding"

**Fix**:
1. Make sure FictionLab is open
2. Check Services tab - all services should be green
3. If services are red, click "Start All"

### "Workflow not found"

**Fix**: Verify workflow exists:
- In FictionLab → Workflows tab
- You should see `idea-to-series-2` and `simple-test-2`

### "No active project"

**Fix**:
1. In FictionLab, click project selector
2. Select your project (checkmark appears)

### Workflow seems stuck

Some workflow nodes wait for:
- User input (check FictionLab Workflows tab)
- Approval gates
- Agent execution

Check FictionLab's Workflows tab for any pending prompts.

---

## Quick Reference

### FictionLab Actions

| Action | How |
|--------|-----|
| Start services | Services tab → "Start All" |
| Create project | TopBar → Project dropdown → "Create New Project" |
| Select project | TopBar → Project dropdown → Click project name |
| View workflows | Workflows tab |
| Check status | Look for pending prompts in Workflows tab |

### Claude Code Extension Commands

| Command | What it does |
|---------|--------------|
| `/run-workflow list` | Show available workflows |
| `/run-workflow execute idea-to-series-2` | Run idea-to-series workflow |
| `/run-workflow execute simple-test-2` | Run simple test workflow |
| `/run-workflow get <workflow-id>` | Get workflow details |

### Your Available Workflows

| Workflow ID | Description |
|-------------|-------------|
| `idea-to-series-2` | Full series planning from initial idea |
| `simple-test-2` | Quick test workflow |

---

## Step-by-Step: Your First Workflow Run

### 1. Verify FictionLab is Ready
- [ ] FictionLab app is open
- [ ] Services tab shows all green
- [ ] Project is selected in top bar

### 2. Open Project in VS Code
- [ ] File → Open Folder → Your project folder
- [ ] Claude Code extension panel is open

### 3. Run the Workflow
- [ ] Type in Claude Code chat: `/run-workflow execute simple-test-2`
- [ ] Wait for response

### 4. Check Results
- [ ] Look for success message in Claude Code
- [ ] Check your project folder for any generated files
- [ ] Check FictionLab Workflows tab for execution status

---

## Next: Adapting for Antigravity

Once this is working, we can:
1. Create Antigravity-specific workflow definitions
2. Build Antigravity genre packs with your templates
3. Import custom workflows into FictionLab

Let me know when you've tested `/run-workflow execute simple-test-2` and we can move forward with Antigravity customization.
