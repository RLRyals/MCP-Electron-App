# Claude Code Executor Plugin

FictionLab plugin that executes Claude Code CLI skills in headless mode for AI-powered writing workflows.

## Features

- Execute `.claude/skills/*.md` skills via Claude Code CLI
- Support for phase-by-phase execution
- Progress tracking and output parsing
- Integration with FictionLab workflows

## Installation

1. **Install Claude Code CLI** (if not already installed):
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Copy plugin to FictionLab**:
   ```bash
   cp -r claude-code-executor-plugin ~/.config/fictionlab/plugins/claude-code-executor
   ```

   Or on Windows:
   ```cmd
   xcopy /E /I claude-code-executor-plugin %APPDATA%\fictionlab\plugins\claude-code-executor
   ```

3. **Build the plugin**:
   ```bash
   cd ~/.config/fictionlab/plugins/claude-code-executor
   npm install
   npm run build
   ```

4. **Restart FictionLab** - the plugin will be automatically discovered and loaded

## Configuration

Open FictionLab Settings → Plugins → Claude Code Executor:

- **Claude Code Path**: Custom path to Claude Code CLI (leave empty for auto-detection)
- **Default Workspace**: Default directory for skill execution (defaults to `~/FictionLab`)
- **Max Concurrent Executions**: Maximum number of simultaneous skill executions
- **Enable Detailed Logging**: Show detailed logs for debugging

## Usage in Workflows

The plugin provides the following actions for workflows:

### `execute-skill`

Execute a Claude Code skill:

```json
{
  "id": "step-1",
  "name": "Execute Book Planning",
  "pluginId": "claude-code-executor",
  "action": "execute-skill",
  "config": {
    "skillPath": ".claude/skills/book-planning-skill.md",
    "phase": 1,
    "seriesId": "{{series_id}}",
    "bookNumber": 3
  },
  "outputMapping": {
    "book_id": "$.result.book_id",
    "outputs": "$.result.outputs"
  }
}
```

**Config Parameters**:
- `skillPath` (required): Path to skill file (relative to `.claude/skills/`)
- `phase` (optional): Specific phase to execute (1-7)
- `seriesId` (optional): Series ID for context
- `bookId` (optional): Book ID for context
- `bookNumber` (optional): Book number for context
- `previousPhaseOutput` (optional): Output from previous phase
- `userInput` (optional): Additional user input
- `workspace` (optional): Custom workspace directory

**Returns**:
```json
{
  "success": true,
  "result": {
    "book_id": "book-003",
    "outputs": [
      "book_foundation_summary.md",
      "book_3_metadata.json"
    ],
    "metadata": {
      "beatStructure": "Five-Act Structure",
      "thematicFocus": "justice"
    }
  }
}
```

### `check-status`

Check execution status:

```json
{
  "pluginId": "claude-code-executor",
  "action": "check-status",
  "config": {
    "jobId": "job-12345"
  }
}
```

### `cancel`

Cancel a running execution:

```json
{
  "pluginId": "claude-code-executor",
  "action": "cancel",
  "config": {
    "jobId": "job-12345"
  }
}
```

## Skills Location

Skills should be placed in your home directory:
```
~/.claude/skills/
├── book-planning-skill.md
├── series-planning-skill.md
├── chapter-planning-skill.md
└── scene-writing-skill.md
```

This is the standard location where Claude Code CLI looks for skills.

## Example Workflow

See `examples/workflows/book-planning-workflow.json` for a complete example of using this plugin in a workflow.

## Troubleshooting

**Claude Code CLI not found**:
- Make sure Claude Code is installed: `claude-code --version`
- Set custom path in plugin settings if installed in non-standard location

**Skills not executing**:
- Verify skills exist in `~/.claude/skills/`
- Check FictionLab logs for error messages
- Enable detailed logging in plugin settings

**Permission denied**:
- Ensure the plugin has `childProcesses` and `fileSystem` permissions in `plugin.json`

## Development

Build the plugin:
```bash
npm run build
```

Watch for changes:
```bash
npm run watch
```

## License

MIT
