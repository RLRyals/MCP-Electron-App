# FictionLab Project Instructions

This project folder is configured for FictionLab workflow execution with Claude Code.

## Workflow Resumption Protocol (CRITICAL)

**At the START of any conversation**, check if `.fictionlab/workflow-context.md` exists in this project folder.

If it exists:
1. **Read it immediately** - you may be resuming a workflow after context compaction
2. Extract the Registry ID and current execution position
3. Invoke `/run-workflow` to reload the skill instructions
4. Use the IPC commands from the context file (NOT curl or HTTP)
5. Continue executing from where the workflow left off

**Why this matters:** During long workflow executions, Claude's context may be compacted, causing loss of skill instructions and critical IDs. The workflow-context.md file persists this information on disk.

## Project Structure

```
<project-folder>/
├── .claude/
│   └── CLAUDE.md          # This file (project instructions)
├── .fictionlab/
│   ├── workflow-context.md # Active workflow state (auto-generated)
│   └── workflow-state/     # Saved workflow checkpoints
├── outputs/                # Generated content
└── ...
```

## Available Skills

### /run-workflow
Execute FictionLab workflows. Usage:
```
/run-workflow <workflow-id>
/run-workflow list
/run-workflow resume
```

## IPC Client Location

The workflow IPC client is installed at:
- Windows: `C:\Users\<username>\.claude\skills\run-workflow\ipc-client.js`
- Mac/Linux: `~/.claude/skills/run-workflow/ipc-client.js`

**Always use the Node.js IPC client** - never use curl or HTTP for workflow communication.

## FictionLab Requirements

For workflows to function, FictionLab must be running with:
- Docker containers up (check Services tab)
- Workflow plugin active (check Plugins tab)
