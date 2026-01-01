# run-workflow

Execute FictionLab workflows from any IDE with Claude Code.

## Requirements

- FictionLab must be running (provides MCP servers and database)
- Workflow plugin installed in FictionLab

## Usage

```bash
/run-workflow <workflow-id> [--version=<version>]
```

## Examples

```bash
# Run latest version of a workflow
/run-workflow 12-phase-novel-pipeline

# Run specific version
/run-workflow 12-phase-novel-pipeline --version=1.2.0
```

## How it works

1. Skill connects to FictionLab via Named Pipe (Windows) or Unix Socket (Mac/Linux)
2. FictionLab's main process receives request via IPC socket
3. Main process uses PersistentMCPClient to execute workflow (stdio/JSON-RPC)
4. Results are returned through IPC socket to IDE
5. Workflow outputs are displayed in console

**Socket Path:**
- Windows: `\\\\.\\pipe\\fictionlab-workflow-runner`
- Mac/Linux: `~/.fictionlab/workflow-runner.sock`

## Workflow Outputs

Workflows can produce variables and artifacts that are saved to your workspace:
- Generated files (outlines, chapters, etc.)
- Workflow variables (character names, plot points, etc.)
- Execution logs and history
