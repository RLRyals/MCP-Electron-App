# Claude Code (Subscription) Plugin

Install and use Claude Code CLI with your Anthropic subscription for headless workflow execution in FictionLab.

## Features

- ✅ **Easy Installation**: One-click install via npm or Homebrew
- 🔐 **Browser-Based Authentication**: Login to your Anthropic subscription (no API keys!)
- 🤖 **Headless Execution**: Run Claude tasks without interactive prompts
- 📝 **Form-Based Interface**: User-friendly forms for task input
- ⚡ **Fast & Efficient**: Uses your existing Anthropic subscription
- 💰 **No Per-Call Charges**: Uses subscription credits, not pay-per-use API

## Installation

### Via FictionLab UI (Recommended)

1. Navigate to **Plugins** in FictionLab
2. Click **Import Plugin**
3. Select **"Install Example Plugin"**
4. Choose **"Claude Code (Subscription)"**
5. Click **Install**

### Manual Installation

1. Copy this folder to:
   - Windows: `%APPDATA%\fictionlab\plugins\claude-code-subscription\`
   - Mac/Linux: `~/.fictionlab/plugins/claude-code-subscription/`

2. Build the plugin:
   ```bash
   cd examples/claude-code-subscription-plugin
   npm install
   npm run build
   ```

3. Restart FictionLab

## Setup

### 1. Install Claude Code CLI

After installing the plugin:

1. Click **Menu → Claude Code → Install CLI**
2. Choose installation method:
   - **npm** (Windows, Linux): Requires Node.js
   - **Homebrew** (Mac): Recommended for macOS
   - **Manual**: Download from GitHub releases

3. Wait for installation to complete

### 2. Login to Anthropic

1. Click **Menu → Claude Code → Login to Anthropic**
2. Browser window will open
3. Login to your Anthropic account
4. Return to FictionLab and click OK
5. You're authenticated!

**No API key needed** - uses your Anthropic subscription/credits.

### 3. Run Your First Task

1. Click **Menu → Claude Code → Run Headless Task**
2. Fill out the form:
   - **Task Prompt**: What you want Claude to do
   - **Context** (optional): Additional information
   - **Working Directory** (optional): Where to run the task
   - **Timeout**: Max execution time (seconds)
3. Click **Run Task**
4. View results in the results dialog

## Usage

### Running Headless Tasks

The plugin provides a form-based interface for running Claude Code tasks:

```
Task Prompt: "Review the code in src/main.ts and suggest improvements"
Context: "Focus on performance and security issues"
Working Directory: /path/to/project
Timeout: 300 seconds
```

Claude will:
- Execute in headless mode (no interactive prompts)
- Return results directly to the form
- Show output, errors, and completion status

### Example Tasks

**Code Review:**
```
Prompt: Review the authentication system and identify security issues
```

**File Generation:**
```
Prompt: Create a comprehensive README.md for this project
Context: This is a TypeScript Electron app for fiction authors
```

**Refactoring:**
```
Prompt: Refactor the database connection code to use connection pooling
Working Directory: /path/to/project
```

**Documentation:**
```
Prompt: Add JSDoc comments to all public methods in src/api/
```

## Menu Actions

### Claude Code → Install CLI
Install Claude Code CLI on your system using npm, Homebrew, or manual method.

### Claude Code → Login to Anthropic
Authenticate with your Anthropic subscription via browser login.

### Claude Code → Check Authentication Status
Verify your authentication status and view account info.

### Claude Code → Run Headless Task
Execute a Claude Code task using the form-based interface.

### Claude Code → Settings
Configure plugin settings:
- Custom Claude Code path
- Auto-update preferences
- Headless mode defaults

## Views

### Claude Task Runner View

Navigate to this view from the sidebar to access:
- Quick action buttons
- Getting started guide
- Example task prompts
- Status information

## Configuration

The plugin stores configuration in FictionLab's plugin config system:

```json
{
  "claudeCodePath": "",           // Custom path (empty = auto-detect)
  "authenticated": false,         // Authentication status
  "autoUpdate": true,             // Check for CLI updates
  "headlessMode": true            // Default to headless execution
}
```

## Authentication

This plugin uses **subscription-based authentication** instead of API keys:

- **Browser Login**: `claude auth login` opens browser for authentication
- **Session Token**: Stored securely on your machine
- **Subscription Credits**: Uses your existing Anthropic subscription
- **No Pay-Per-Use**: Not charged per API call like the API

This is the same authentication method used by Claude Desktop and Claude Code CLI.

## Headless Mode

Tasks run in **headless mode** by default:

- No interactive prompts during execution
- Results returned directly to your form
- Suitable for automation and workflows
- Can specify timeout to prevent long-running tasks

## Requirements

### System Requirements
- **Windows**: Windows 10 or later
- **macOS**: macOS 10.15 or later
- **Linux**: Modern Linux distribution

### Software Requirements
- **Node.js 18+** (for npm installation method)
- **Homebrew** (for macOS Homebrew installation)
- **Anthropic Account** with active subscription

### FictionLab Requirements
- FictionLab v0.1.0 or later

## Troubleshooting

### Claude Code not found
**Issue**: Plugin can't find Claude Code CLI

**Solution**:
1. Verify installation: `claude --version` in terminal
2. Check PATH includes Claude Code directory
3. Specify custom path in plugin settings
4. Reinstall using plugin's Install CLI option

### Authentication failed
**Issue**: Can't login to Anthropic

**Solution**:
1. Ensure you have an active Anthropic subscription
2. Check internet connection
3. Try: Menu → Claude Code → Login to Anthropic
4. Follow browser prompts carefully
5. Check authentication: Menu → Claude Code → Check Authentication Status

### Task timeout
**Issue**: Tasks fail with timeout error

**Solution**:
1. Increase timeout in task form (default: 300 seconds)
2. Break large tasks into smaller chunks
3. Check if Claude is waiting for user input (shouldn't happen in headless mode)

### Permission denied
**Issue**: Can't execute Claude Code CLI

**Solution**:
- **Windows**: Run FictionLab as administrator (first time only)
- **Mac/Linux**: Check claude executable permissions: `chmod +x $(which claude)`

### Output truncated
**Issue**: Task output seems incomplete

**Solution**:
- Click "Copy Output" button and paste into text editor
- Check FictionLab logs for full output
- Output buffer limit is 10MB

## Development

### Building the Plugin

```bash
cd examples/claude-code-subscription-plugin
npm install
npm run build
```

Output: `dist/index.js`

### Watching for Changes

```bash
npm run watch
```

### Testing

1. Build the plugin
2. Restart FictionLab
3. Check browser console for plugin logs
4. Test each menu action
5. Verify task execution

## Architecture

### Components

1. **Installation Manager**
   - Detects OS platform
   - Handles npm/Homebrew/manual installation
   - Verifies installation

2. **Authentication Manager**
   - Runs `claude auth login` for browser-based auth
   - Checks authentication status
   - No API key management needed

3. **Task Executor**
   - Builds headless command
   - Executes with timeout
   - Captures output/errors
   - Returns structured results

4. **UI Components**
   - Form-based task input
   - Results display with copy function
   - Settings management
   - Status indicators

### Command Execution

Tasks are executed as:
```bash
claude --headless "your task prompt"
```

Flags:
- `--headless`: Non-interactive mode
- Working directory set via `cwd` option
- Timeout enforced via Node.js exec timeout

## Security

### Authentication
- Uses official Anthropic authentication flow
- Session tokens stored by Claude CLI (not this plugin)
- No API keys stored in plugin config

### Command Execution
- Prompts escaped to prevent command injection
- Timeout limits prevent runaway processes
- Working directory validated
- Output size limited to prevent memory issues

### Permissions

Required permissions:
- `childProcesses`: Execute Claude Code CLI
- `fileSystem`: Access working directory
- `network`: Communication with Anthropic services
- `dialogs`: Show UI forms and results
- `clipboard`: Copy output to clipboard

## Comparison with API Key Plugin

| Feature | Subscription Plugin | API Key Plugin |
|---------|-------------------|----------------|
| Authentication | Browser login | Manual API key |
| Billing | Subscription credits | Pay-per-use API |
| Setup Complexity | Low (click login) | Medium (find/paste key) |
| Security | Managed by Anthropic | User manages key |
| Best For | End users | Developers, automation |

## Known Limitations

1. **Requires Active Subscription**: Must have Anthropic subscription
2. **CLI Dependency**: Requires Claude Code CLI installed
3. **No Offline Mode**: Requires internet for authentication and execution
4. **Output Size**: Limited to 10MB buffer
5. **Single Task**: Can't run multiple tasks simultaneously

## Future Enhancements

- [ ] Task history and favorites
- [ ] Batch task execution
- [ ] Custom templates for common tasks
- [ ] Integration with FictionLab workflows
- [ ] Progress indicators for long-running tasks
- [ ] Task scheduling/queuing

## Support

### Documentation
- Claude Code CLI: https://github.com/anthropics/claude-code
- Anthropic Console: https://console.anthropic.com

### Issues
Report issues in the FictionLab GitHub repository:
https://github.com/RLRyals/MCP-Electron-App/issues

### Community
- FictionLab Discord: [Coming Soon]
- Forum: [Coming Soon]

## License

MIT License - See main FictionLab LICENSE file

## Credits

- **FictionLab Team**: Plugin development
- **Anthropic**: Claude Code CLI
- **Contributors**: Community feedback and testing

---

**Version**: 1.0.0
**Last Updated**: 2025-12-18
**Compatibility**: FictionLab 0.1.0+
