# FictionLab Workflow Skill - Quick Start Guide

Get up and running with FictionLab workflows in Claude Desktop in 5 minutes!

## Prerequisites

Before you begin, ensure you have:

1. **Claude Desktop** installed on your computer
2. **FictionLab app** installed
3. **Docker Desktop** running (required by FictionLab)

## Installation (2 minutes)

### Windows

1. Download `fictionlab-workflow.zip` and extract it
2. Press `Win+R`, type `%APPDATA%\Claude\skills` and press Enter
3. Create the folder if it doesn't exist
4. Copy the `fictionlab-workflow` folder into the skills directory
5. **Restart Claude Desktop** (fully quit and reopen)

### Mac

1. Download `fictionlab-workflow.zip` and extract it
2. Open Finder, press `Cmd+Shift+G`
3. Type: `~/Library/Application Support/Claude/skills` and press Go
4. Create the folder if it doesn't exist
5. Copy the `fictionlab-workflow` folder into the skills directory
6. **Restart Claude Desktop** (fully quit and reopen)

## First Workflow (3 minutes)

### Step 1: Start FictionLab (1 minute)

1. Launch the FictionLab app
2. Click on **Services** tab
3. Wait for Docker containers to show "Running" status (green)
4. Click on **Plugins** tab
5. Verify "Workflow" plugin shows as active
6. Check console output for: `[IDE IPC Server] Listening on...`

### Step 2: Test Connection (30 seconds)

1. Open Claude Desktop
2. Start a new conversation
3. Type:
   ```
   /fictionlab-workflow list
   ```
4. You should see a list of available workflows

**Expected output:**
```
Found 9 workflow(s):

1. Series Architect - Complete Pipeline
   ID: series-architect-orchestrator
   ...

2. Simple Test Workflow
   ID: simple-test-2
   ...
```

### Step 3: Run Your First Workflow (1-2 minutes)

Execute the simple test workflow:

```
/fictionlab-workflow execute simple-test-2
```

The workflow will:
1. Connect to FictionLab
2. Execute workflow steps
3. Show completion status with results

**Success looks like:**
```
✅ Status: SUCCESS

Instance ID: simple-test-2-1234567890
Completed Nodes (2):
  ✓ Process with AI
  ✓ Save Output

Output Variables:
  concept: [your brainstormed series concept]
```

## Next Steps

### Try a Real Workflow

Execute a series planning workflow:

```
/fictionlab-workflow execute series-architect-intake
```

This workflow will help you plan a complete fiction series!

### Customize with Variables

Pass variables to workflows:

```
/fictionlab-workflow execute series-architect-intake \
  --variables '{"genre":"Urban Fantasy","targetAudience":"Adult"}'
```

### Specify Workspace

Save workflow outputs to a specific project folder:

```
/fictionlab-workflow execute series-architect-orchestrator \
  --workspace "C:/Writing/My Urban Fantasy Series"
```

## Common Commands

### List All Workflows
```
/fictionlab-workflow list
```

### Get Workflow Details
```
/fictionlab-workflow get <workflow-id>
```

### Execute Workflow
```
/fictionlab-workflow execute <workflow-id>
```

### Execute with Options
```
/fictionlab-workflow execute <workflow-id> \
  --workspace "path/to/project" \
  --variables '{"key":"value"}'
```

## Troubleshooting

### "FictionLab is not running" Error

**Fix:**
1. Launch FictionLab app
2. Wait for Services tab to show all containers as "Running"
3. Verify Plugins tab shows Workflow plugin active
4. Try command again

### Skill Not Found Error

**Fix:**
1. Verify installation: Check files are in correct location
   - Windows: `%APPDATA%\Claude\skills\fictionlab-workflow\`
   - Mac: `~/Library/Application Support/Claude/skills/fictionlab-workflow/`
2. Restart Claude Desktop completely (quit and relaunch)
3. Try command again

### Workflow Timeout

**Fix:**
1. Check Docker containers are healthy in FictionLab Services tab
2. Try a simpler workflow first: `/fictionlab-workflow execute simple-test-2`
3. Check FictionLab console for error messages

## Getting Help

### Built-in Help
```
/fictionlab-workflow
```
Shows usage instructions and examples.

### Documentation
- Full README in skill folder
- FictionLab documentation
- GitHub Issues for bug reports

### Verification Steps

If something isn't working, check:

1. **Claude Desktop**: Restart after installation
2. **FictionLab app**: Running with green container status
3. **Workflow plugin**: Active in FictionLab Plugins tab
4. **Console output**: Shows IPC server listening message
5. **Docker**: Docker Desktop running with containers active

## Example Workflow Session

Here's a complete example conversation in Claude Desktop:

```
User: I want to plan a new Urban Fantasy series

Claude: I can help you with that using FictionLab's Series Architect workflow!
Let me start the planning process.

/fictionlab-workflow execute series-architect-intake \
  --workspace "C:/Writing/Urban Fantasy Series" \
  --variables '{"genre":"Urban Fantasy","targetAudience":"Adult"}'

[Workflow executes...]

✅ The intake phase is complete! Your series planning has started.
The workflow has created initial documents in your workspace.

Would you like to continue with the research phase next?

User: Yes, continue

Claude: Great! Let me run the research phase to analyze market trends
and generate a genre pack with beat sheets...

/fictionlab-workflow execute series-architect-research \
  --workspace "C:/Writing/Urban Fantasy Series"

[Research workflow executes...]

✅ Research complete! I've analyzed current Urban Fantasy trends and
generated a custom genre pack with:
- 12 popular tropes for Urban Fantasy
- Beat sheet templates
- Character archetype recommendations
- Market positioning analysis

Would you like to move on to building the series framework?
```

## Success Indicators

You'll know everything is working when:

1. ✅ `/fictionlab-workflow list` shows workflows
2. ✅ Simple test workflow executes and completes
3. ✅ You see "Status: SUCCESS" messages
4. ✅ Output files appear in your workspace folder
5. ✅ No error messages about FictionLab not running

## Tips for Best Results

1. **Start FictionLab first**: Always launch before using skill
2. **Use full paths**: Specify complete workspace paths
3. **Check console**: FictionLab console shows detailed progress
4. **Be patient**: Complex workflows can take 5-10 minutes
5. **Test simple first**: Try `simple-test-2` before complex workflows

## What's Next?

Now that you're set up, explore:

- **Series Planning**: Complete 6-stage series architecture workflows
- **Book Structuring**: Plan individual books with beat sheets
- **Chapter Writing**: Execute chapter writing pipelines
- **Quality Gates**: Validate commercial fiction standards (NPE)

For detailed workflow descriptions and advanced usage, see the full [README.md](README.md).

---

**Having Issues?** Check the full [README.md](README.md) troubleshooting section or report issues on GitHub.
