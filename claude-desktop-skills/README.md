# Claude Desktop Skills for FictionLab

This directory contains Claude Desktop skills that enable workflow execution from Claude Desktop conversations.

## Available Skills

### FictionLab Workflow Skill

Execute FictionLab workflows directly from Claude Desktop. Connects to the FictionLab Electron app via IPC (Inter-Process Communication) to run multi-phase writing workflows.

**Location:** [`fictionlab-workflow/`](fictionlab-workflow/)

**Features:**
- Cross-platform support (Windows & Mac)
- List available workflows
- Execute workflows with custom variables
- Real-time workflow progress tracking
- Comprehensive error handling

**Quick Start:**
```
/fictionlab-workflow list
/fictionlab-workflow execute simple-test-2
```

**Documentation:**
- [QUICKSTART.md](fictionlab-workflow/QUICKSTART.md) - Get started in 5 minutes
- [README.md](fictionlab-workflow/README.md) - Full documentation
- [DISTRIBUTION.md](DISTRIBUTION.md) - Distribution and packaging guide

## Installation

### End Users

Download the skill package from:
- **GitHub Releases**: [Latest Release](https://github.com/RLRyals/MCP-Electron-App/releases)
- **FictionLab Website**: [Downloads Page](https://fictionlab.io/downloads/)

Follow platform-specific instructions in the skill's README.

### Developers

Skills are located in this directory. Each skill folder contains:
- `skill.md` - Skill definition (required by Claude Desktop)
- `ipc-client.js` - Implementation code
- `README.md` - User documentation
- `install-*.bat/sh` - Installation scripts

## How It Works

### Architecture

```
Claude Desktop
    ↓
Skill (skill.md + ipc-client.js)
    ↓
IPC Socket (Named Pipe/Unix Socket)
    ↓
FictionLab Electron App
    ↓
Workflow Runner Plugin
    ↓
MCP Servers (Docker)
    ↓
PostgreSQL Database
```

### IPC Communication

**Windows:**
- Named pipe: `\\.\pipe\fictionlab-workflow-runner`
- Protocol: JSON-RPC over named pipe

**Mac:**
- Unix socket: `/tmp/fictionlab-workflow-runner.sock`
- Protocol: JSON-RPC over Unix socket

**Message Format:**
```json
Request:
{
  "method": "workflow:execute",
  "params": {
    "workflowId": "series-architect-orchestrator",
    "options": {...}
  }
}

Response:
{
  "success": true,
  "instanceId": "workflow-123",
  "outputs": {...}
}
```

## Development

### Creating a New Skill

1. Create skill folder: `claude-desktop-skills/<skill-name>/`
2. Add required files:
   - `skill.md` - Skill definition with YAML frontmatter
   - Implementation files (`.js`, `.ts`, etc.)
   - `README.md` - Documentation
3. Test locally by copying to Claude Desktop skills directory
4. Create distribution package (see DISTRIBUTION.md)

### Skill Definition Format

`skill.md` must include YAML frontmatter:

```yaml
---
name: skill-name
description: Brief description
tools:
  - bash
  - read
  - write
---

# Skill Documentation

Usage instructions here...
```

### Testing Skills

**Windows:**
```powershell
# Copy to Claude Desktop skills directory
$SkillDir = "$env:APPDATA\Claude\skills\your-skill-name"
Copy-Item -Recurse -Force ".\your-skill-name" "$SkillDir"

# Restart Claude Desktop
Stop-Process -Name "claude" -Force
Start-Process "claude"
```

**Mac:**
```bash
# Copy to Claude Desktop skills directory
cp -r ./your-skill-name ~/Library/Application\ Support/Claude/skills/

# Restart Claude Desktop
killall Claude
open -a Claude
```

## Distribution

See [DISTRIBUTION.md](DISTRIBUTION.md) for complete distribution guide including:
- Creating distribution packages
- Hosting options (GitHub Releases, website, etc.)
- Testing checklist
- Versioning strategy
- Update distribution process

## Platform Support

| Platform | IPC Method | Status | Notes |
|----------|------------|--------|-------|
| Windows  | Named Pipe | ✅ Tested | Fully working |
| Mac      | Unix Socket | ✅ Supported | Not tested on Mac hardware yet |
| Linux    | Unix Socket | ⚠️ N/A | Claude Desktop not available on Linux |

## Security

- All communication is local-only via IPC
- No external network connections
- Skills run in Claude Desktop's sandboxed environment
- IPC sockets are user-restricted (not accessible system-wide)

## Troubleshooting

### Skill Not Appearing in Claude Desktop

1. Check skill folder name matches skill.md `name` field
2. Verify skill.md has valid YAML frontmatter
3. Ensure files are in correct directory:
   - Windows: `%APPDATA%\Claude\skills\<skill-name>\`
   - Mac: `~/Library/Application Support/Claude/skills/<skill-name>/`
4. Restart Claude Desktop completely

### IPC Connection Failed

1. Verify FictionLab app is running
2. Check Docker containers are active (Services tab)
3. Verify Workflow plugin is enabled (Plugins tab)
4. Look for console message: `[IDE IPC Server] Listening on...`

### Skill Execution Error

1. Check FictionLab console for detailed errors
2. Verify workflow exists: `/fictionlab-workflow list`
3. Test with simple workflow first: `simple-test-2`
4. Check Docker services are healthy

## Contributing

To contribute a new skill:

1. Fork the repository
2. Create skill in `claude-desktop-skills/<skill-name>/`
3. Follow skill structure guidelines (see DISTRIBUTION.md)
4. Test on both Windows and Mac (if possible)
5. Submit pull request with:
   - Skill implementation
   - README with usage instructions
   - Installation scripts for both platforms

## Roadmap

### Planned Skills

- **Database Admin Skill**: Query and manage FictionLab database
- **MCP Server Skill**: Interact with specific MCP servers
- **Project Manager Skill**: Manage writing projects and series
- **Character Builder Skill**: Create and manage character profiles
- **World Builder Skill**: Develop world-building elements

### Future Enhancements

- Auto-update mechanism for skills
- Skill configuration UI in FictionLab
- Workflow templates bundled with skills
- Multi-language support
- Offline workflow caching

## License

Skills are part of the FictionLab project. See main repository [LICENSE](../LICENSE) for details.

## Support

- **Documentation**: Individual skill READMEs
- **Issues**: [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues)
- **Discussions**: [GitHub Discussions](https://github.com/RLRyals/MCP-Electron-App/discussions)
- **Community**: [Discord Server](https://discord.gg/fictionlab) (if available)

## Resources

- [Claude Desktop Documentation](https://claude.ai/desktop)
- [Claude Skills Guide](https://docs.anthropic.com/claude/docs/skills)
- [FictionLab Documentation](https://github.com/RLRyals/MCP-Electron-App)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

---

**Version**: 1.0.0
**Last Updated**: 2026-01-10
**Maintainer**: FictionLab Team
