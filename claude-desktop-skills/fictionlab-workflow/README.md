# FictionLab Workflow Skill for Claude Desktop

Execute FictionLab workflows directly from Claude Desktop conversations. This skill connects to the FictionLab Electron app running on your computer to execute multi-phase writing workflows.

## Features

- ✅ List all available workflows from FictionLab
- ✅ Execute workflows with custom variables
- ✅ Get detailed workflow definitions
- ✅ Cross-platform support (Windows & Mac)
- ✅ Real-time workflow execution with progress tracking
- ✅ Comprehensive error messages and troubleshooting

## Prerequisites

1. **FictionLab App**: Must be installed and running
2. **Docker**: Required for FictionLab's MCP services
3. **Node.js**: Required by Claude Desktop (already installed with Claude Desktop)

## Installation

### Step 1: Download and Extract

Download `fictionlab-workflow.zip` and extract it. The folder contains:
- `skill.md` - Skill definition
- `ipc-client.js` - Cross-platform IPC client
- `README.md` - This documentation
- `QUICKSTART.md` - Quick start guide

### Step 2: Copy to Claude Desktop Skills Folder

**Windows:**
1. Press `Win+R` and type: `%APPDATA%\Claude\skills` then press Enter
2. If the folder doesn't exist, create it
3. Copy the entire `fictionlab-workflow` folder into this directory
4. You should have: `%APPDATA%\Claude\skills\fictionlab-workflow\skill.md`

**Mac:**
1. Open Finder, press `Cmd+Shift+G`
2. Type: `~/Library/Application Support/Claude/skills` then press Go
3. If the folder doesn't exist, create it
4. Copy the entire `fictionlab-workflow` folder into this directory
5. You should have: `~/Library/Application Support/Claude/skills/fictionlab-workflow/skill.md`

### Step 3: Restart Claude Desktop

1. **Completely quit** Claude Desktop (not just close the window - fully quit the app)
2. Restart Claude Desktop
3. The skill is now available as `/fictionlab-workflow`

## Usage

### Before Using the Skill

**IMPORTANT**: Launch FictionLab app before using the skill!

1. Start FictionLab.exe (Windows) or FictionLab.app (Mac)
2. Open the **Services** tab and verify Docker containers are running
3. Open the **Plugins** tab and verify the Workflow plugin is active
4. Check console output for: `[IDE IPC Server] Listening on \\.\pipe\fictionlab-workflow-runner`

### In Claude Desktop

#### List Available Workflows

In a Claude Desktop conversation, type:
```
/fictionlab-workflow list
```

Claude will connect to FictionLab and show all available workflows.

#### Execute a Workflow

```
/fictionlab-workflow execute <workflow-id>
```

Example:
```
/fictionlab-workflow execute 12-phase-novel-pipeline
```

#### Execute with Options

```
/fictionlab-workflow execute <workflow-id> --workspace "C:/path/to/project" --variables '{"genre":"Urban Fantasy"}'
```

#### Get Workflow Details

```
/fictionlab-workflow get <workflow-id>
```

## Common Workflows

### Series Planning
```
/fictionlab-workflow execute series-architecture-v2
```

Creates a complete series architecture with 5-book structure, character arcs, and world building.

### Book Structure
```
/fictionlab-workflow execute book-structure-12-phase
```

Plans a single book using the 12-phase novel structure method.

### Chapter Writing
```
/fictionlab-workflow execute chapter-writing-pipeline
```

Writes a complete chapter with beats, scenes, and editing passes.

### NPE Validation
```
/fictionlab-workflow execute npe-validation-gate
```

Validates No Plot Events (NPE) compliance for commercial fiction.

## Options Reference

### --workspace

Specify the project directory where workflow files will be saved.

**Windows Example:**
```
--workspace "C:/Users/Author/Documents/MyNovel"
```

**Mac Example:**
```
--workspace "/Users/author/Documents/MyNovel"
```

Default: Current directory

### --variables

Pass initial variables to the workflow as JSON.

**Example:**
```
--variables '{"genre":"Urban Fantasy","targetWordCount":80000,"protagonistName":"Alex"}'
```

Variables depend on workflow definition. Check workflow details with `get` command.

### --version

Specify workflow version (default: `latest`).

**Example:**
```
--version "2.0"
```

## Troubleshooting

### Error: "FictionLab is not running"

**Problem**: Cannot connect to FictionLab IPC server.

**Solutions**:
1. Launch FictionLab app
2. Check Services tab - Docker containers should show "Running"
3. Check Plugins tab - Workflow plugin should be active
4. Look for console message: "IPC Server Listening on..."

### Error: "Request timeout"

**Problem**: Workflow execution took longer than 10 minutes.

**Solutions**:
1. Check if Docker containers are healthy (Services tab)
2. Verify PostgreSQL database connection
3. Check FictionLab console for errors
4. Try a simpler workflow first (e.g., `simple-test-2`)

### Error: "Workflow not found"

**Problem**: Workflow ID doesn't exist in database.

**Solutions**:
1. Run `/fictionlab-workflow list` to see available workflows
2. Check spelling of workflow ID (case-sensitive)
3. Import workflow definitions in FictionLab Workflows tab

### Connection Works But No Workflows

**Problem**: Skill connects but no workflows are listed.

**Solutions**:
1. Open FictionLab Workflows tab
2. Import workflow definitions from JSON
3. Or create workflows using the workflow designer
4. Verify workflows are saved in PostgreSQL database

### Platform-Specific Issues

#### Windows: Named Pipe Access Denied

If you see "EPERM" or "Access Denied" errors:
1. Run Claude Desktop as Administrator (right-click → Run as administrator)
2. Check Windows Firewall isn't blocking named pipes
3. Verify FictionLab is running under the same user account

#### Mac: Socket File Not Found

If connection fails on Mac:
1. Verify FictionLab is running (check Activity Monitor)
2. Check socket exists: `ls -l /tmp/fictionlab-workflow-runner.sock`
3. Check socket permissions: Should be readable by current user
4. Restart FictionLab to recreate socket

## How It Works

### Architecture

```
Claude Desktop (Skill)
    ↓
Node.js IPC Client (ipc-client.js)
    ↓
Named Pipe (Windows) / Unix Socket (Mac)
    ↓
FictionLab Electron App (IPC Server)
    ↓
Workflow Runner Plugin
    ↓
MCP Workflow Manager (Docker)
    ↓
PostgreSQL Database (Docker)
```

### Cross-Platform Connection

The skill automatically detects your platform:

- **Windows**: Connects to `\\.\pipe\fictionlab-workflow-runner` (named pipe)
- **Mac**: Connects to `/tmp/fictionlab-workflow-runner.sock` (Unix socket)

Both use the same JSON-RPC protocol over the socket for communication.

### Security

- All communication happens locally on your machine via IPC
- No external network connections
- No data leaves your computer
- Socket is only accessible to current user
- Named pipe/socket automatically cleaned up when FictionLab exits

## Advanced Usage

### Custom Workspace Paths

You can organize your writing projects and execute workflows in specific directories:

```
/fictionlab-workflow execute series-architecture-v2 \
  --workspace "C:/Writing Projects/Urban Fantasy Series" \
  --variables '{"seriesTitle":"The Shadow Archives","bookCount":5}'
```

### Workflow Variable Templates

Different workflows accept different variables. Common variables:

**Series Planning:**
- `genre`: "Urban Fantasy", "Mystery", "Romance", etc.
- `seriesTitle`: Name of series
- `bookCount`: Number of books (typically 3-7)
- `targetAudience`: "Adult", "YA", "Middle Grade"

**Chapter Writing:**
- `chapterNumber`: Chapter number (1, 2, 3...)
- `bookId`: Database ID of book
- `pov`: Point of view character name
- `sceneCount`: Number of scenes in chapter

**NPE Validation:**
- `chapterPath`: Path to chapter file
- `strictMode`: `true` for strict NPE rules

Use `/fictionlab-workflow get <workflow-id>` to see required variables.

## Support

### Getting Help

1. Check FictionLab console output for detailed errors
2. Review workflow execution logs in FictionLab
3. Verify all prerequisites are met
4. Test with a simple workflow first: `/fictionlab-workflow execute simple-test-2`

### Reporting Issues

When reporting issues, include:
- Platform (Windows/Mac)
- FictionLab version
- Claude Desktop version
- Workflow ID being executed
- Full error message
- FictionLab console output

### Updates

To update the skill:
1. Download new version of skill files
2. Replace files in `%APPDATA%\Claude\skills\fictionlab-workflow\` (Windows) or `~/Library/Application Support/Claude/skills/fictionlab-workflow/` (Mac)
3. Restart Claude Desktop

## Version History

### v1.0.0 (2026-01-10)
- Initial release
- Windows and Mac support
- List, get, and execute commands
- Cross-platform IPC connection
- Comprehensive error handling
- 10-minute workflow execution timeout

## License

This skill is part of the FictionLab project. See main FictionLab license for details.
