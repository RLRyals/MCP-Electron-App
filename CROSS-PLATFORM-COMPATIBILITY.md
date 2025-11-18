# Cross-Platform Compatibility

## Overview

The TypingMind auto-configuration system is fully compatible with **Windows, Mac, and Linux**. All path handling and file operations work correctly on all platforms.

## Platform-Specific Paths

### Windows
```
User Data: C:\Users\<username>\AppData\Roaming\fictionlab
MCP Servers: C:\Users\<username>\AppData\Roaming\fictionlab\repositories\mcp-writing-servers\src\config-mcps
Config File: C:\Users\<username>\AppData\Roaming\fictionlab\typingmind-mcp-config.json
.env File: C:\Users\<username>\AppData\Roaming\fictionlab\.env
```

### macOS
```
User Data: /Users/<username>/Library/Application Support/fictionlab
MCP Servers: /Users/<username>/Library/Application Support/fictionlab/repositories/mcp-writing-servers/src/config-mcps
Config File: /Users/<username>/Library/Application Support/fictionlab/typingmind-mcp-config.json
.env File: /Users/<username>/Library/Application Support/fictionlab/.env
```

### Linux
```
User Data: /home/<username>/.config/fictionlab
MCP Servers: /home/<username>/.config/fictionlab/repositories/mcp-writing-servers/src/config-mcps
Config File: /home/<username>/.config/fictionlab/typingmind-mcp-config.json
.env File: /home/<username>/.config/fictionlab/.env
```

## How Cross-Platform Compatibility is Achieved

### 1. Electron's `app.getPath('userData')`
```typescript
function getMCPWritingServersPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'repositories', 'mcp-writing-servers');
}
```
- Automatically returns the correct path for each OS
- No platform-specific code needed

### 2. Node.js `path.join()`
```typescript
const serverPath = path.join(mcpServersPath, serverName, 'index.js');
```
- Automatically uses correct separator:
  - Windows: `\` (backslash)
  - Mac/Linux: `/` (forward slash)
- No manual path manipulation needed

### 3. `fs-extra` Cross-Platform File Operations
```typescript
await fs.pathExists(mcpServersPath)
await fs.readdir(mcpServersPath, { withFileTypes: true })
await fs.writeJson(configPath, config, { spaces: 2 })
```
- Works identically on all platforms
- Handles platform-specific quirks automatically

### 4. No Platform-Specific Code
The implementation uses only cross-platform APIs:
- ✅ `path.join()` for path construction
- ✅ `app.getPath()` for system directories
- ✅ `fs-extra` for file operations
- ✅ No hardcoded paths
- ✅ No platform detection needed
- ✅ No OS-specific logic

## Generated Configuration Examples

### Windows Configuration
```json
{
  "mcpServers": {
    "book-planning-server": {
      "command": "node",
      "args": [
        "C:\\Users\\User\\AppData\\Roaming\\fictionlab\\repositories\\mcp-writing-servers\\src\\config-mcps\\book-planning-server\\index.js"
      ],
      "env": {
        "NODE_ENV": "development",
        "MCP_STDIO_MODE": "false"
      }
    }
  }
}
```

### macOS Configuration
```json
{
  "mcpServers": {
    "book-planning-server": {
      "command": "node",
      "args": [
        "/Users/username/Library/Application Support/fictionlab/repositories/mcp-writing-servers/src/config-mcps/book-planning-server/index.js"
      ],
      "env": {
        "NODE_ENV": "development",
        "MCP_STDIO_MODE": "false"
      }
    }
  }
}
```

### Linux Configuration
```json
{
  "mcpServers": {
    "book-planning-server": {
      "command": "node",
      "args": [
        "/home/username/.config/fictionlab/repositories/mcp-writing-servers/src/config-mcps/book-planning-server/index.js"
      ],
      "env": {
        "NODE_ENV": "development",
        "MCP_STDIO_MODE": "false"
      }
    }
  }
}
```

## Testing Cross-Platform Compatibility

### On Each Platform:

1. **Start the FictionLab App**
   - Should launch correctly on all platforms

2. **Check .env file location**
   ```bash
   # Windows
   dir %APPDATA%\fictionlab\.env

   # Mac
   ls ~/Library/Application\ Support/fictionlab/.env

   # Linux
   ls ~/.config/fictionlab/.env
   ```

3. **Click "Configure Typing Mind"**
   - Should discover MCP servers on all platforms
   - Should generate correct paths for each OS
   - Should successfully call /start endpoint

4. **Verify in logs**
   - Check that paths use correct separator for OS
   - Verify server discovery works
   - Confirm /start endpoint called successfully

## MCP Connector URL

The MCP Connector URL is platform-independent:
```
http://localhost:50880
```

This works identically on Windows, Mac, and Linux since it's a network address.

## Environment Variables

The `.env` file format is the same on all platforms:
```env
POSTGRES_DB=mcp_writing_db
POSTGRES_USER=writer
POSTGRES_PASSWORD=<generated-secure-password>
POSTGRES_PORT=5432
MCP_CONNECTOR_PORT=50880
MCP_AUTH_TOKEN=<generated-secure-token>
TYPING_MIND_PORT=3000
```

No platform-specific modifications needed. Passwords and tokens are automatically generated during setup.

## File Permissions

### macOS and Linux
The app may need execute permissions for certain operations:
```bash
# Grant execute permission if needed
chmod +x /path/to/mcp-electron-app
```

### Windows
No special permissions needed - runs with standard user privileges.

## Localhost Binding

All services bind to `localhost`:
- `http://localhost:50880` - MCP Connector
- `http://localhost:3000` - TypingMind
- `localhost:5432` - PostgreSQL

This works identically on all platforms.

## Summary

✅ **Fully Cross-Platform** - Works on Windows, Mac, and Linux
✅ **No Platform Detection** - Uses only cross-platform APIs
✅ **Automatic Path Handling** - Correct separators and locations
✅ **Same User Experience** - Identical on all platforms
✅ **No Special Configuration** - Works out of the box

The auto-configuration system will work correctly for all users regardless of their operating system!
