---
name: run-workflow
description: Execute FictionLab workflows from your IDE. Use this to run multi-phase writing workflows like series planning, book structuring, chapter writing, and quality gates. Requires FictionLab app to be running.
allowed-tools: Bash(node:*)
---

# FictionLab Workflow Runner

Execute FictionLab workflows from Claude Code. Requires FictionLab app to be running with Docker containers up.

## Prerequisites

1. **FictionLab must be running** (check Services tab - all green)
2. **workflow-runner package built**: Run once in terminal:
   ```bash
   cd c:/github/workflow-runner && npm run build
   ```

## Commands

### List Available Workflows

```bash
node c:/github/workflow-runner/dist/index.js list
```

### Execute a Workflow

```bash
node c:/github/workflow-runner/dist/index.js execute <workflow-id>
```

**Example:**
```bash
node c:/github/workflow-runner/dist/index.js execute idea-to-series-2
```

### Execute with Options

```bash
node c:/github/workflow-runner/dist/index.js execute <workflow-id> \
  --workspace "c:/path/to/project" \
  --variables '{"genre":"Urban Fantasy","targetWordCount":80000}'
```

## Available Workflows

Check FictionLab's Workflows tab or run `list` command to see available workflows.

Common workflows:
- `idea-to-series-2` - Full series planning workflow
- `simple-test-2` - Simple test workflow

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "MCP connection failed" | Ensure FictionLab is running + Docker containers up |
| "Workflow not found" | Import workflow via FictionLab Workflows tab first |
| "ECONNREFUSED" | Check that workflow-manager MCP server is running |

## How it Works

```
Claude Code → workflow-runner → IPC Socket → FictionLab → MCP Server → PostgreSQL
```

The workflow-runner connects to FictionLab's IPC server via:
- Windows: `\\.\pipe\fictionlab-workflow-runner`
- Mac/Linux: `/tmp/fictionlab-workflow-runner.sock`
