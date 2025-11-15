# Claude Desktop Bridge for MCP Docker Containers

This bridge allows Claude Desktop to connect to MCP servers running in Docker containers.

## How It Works

1. Claude Desktop launches the bridge script via stdio
2. The bridge forwards JSON-RPC messages to the MCP Connector (HTTP)
3. Responses are sent back to Claude Desktop via stdout

## Setup

### 1. Install Dependencies

The bridge script uses only Node.js built-in modules, so no installation needed.

### 2. Make the Script Executable (macOS/Linux)

```bash
chmod +x /home/user/MCP-Electron-App/claude-desktop-bridge/mcp-bridge.js
```

### 3. Configure Claude Desktop

Edit your `claude_desktop_config.json`:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

**Configuration:**

```json
{
  "mcpServers": {
    "mcp-writing-system": {
      "command": "node",
      "args": [
        "/home/user/MCP-Electron-App/claude-desktop-bridge/mcp-bridge.js"
      ],
      "env": {
        "MCP_CONNECTOR_URL": "http://localhost:50880",
        "MCP_AUTH_TOKEN": "YOUR_AUTH_TOKEN_HERE"
      }
    }
  }
}
```

**Important:**
- Replace `YOUR_AUTH_TOKEN_HERE` with your actual MCP_AUTH_TOKEN
- Update the path to `mcp-bridge.js` if you're on Windows or macOS
- On Windows, use backslashes: `C:\\Users\\YourName\\MCP-Electron-App\\claude-desktop-bridge\\mcp-bridge.js`

### 4. Get Your MCP_AUTH_TOKEN

You can find your auth token in the MCP Electron App:
- Go to "Environment Configuration" or "Settings"
- Copy the `MCP_AUTH_TOKEN` value

Or check your configuration files in:
- Windows: `%USERPROFILE%\AppData\Roaming\mcp-electron-app\`
- macOS: `~/Library/Application Support/mcp-electron-app/`
- Linux: `~/.config/mcp-electron-app/`

### 5. Start the MCP System

Before using Claude Desktop:
1. Open the MCP Electron App
2. Click "Start System"
3. Wait for all services to be healthy
4. Verify MCP Connector is running: `docker ps | grep mcp-connector`

### 6. Restart Claude Desktop

After saving the configuration, restart Claude Desktop. It should now connect to your MCP servers.

## Troubleshooting

### Check if the bridge works

Test the bridge manually:

```bash
# Set environment variables
export MCP_CONNECTOR_URL="http://localhost:50880"
export MCP_AUTH_TOKEN="your_token_here"

# Run the bridge
node /home/user/MCP-Electron-App/claude-desktop-bridge/mcp-bridge.js
```

You should see:
```
[MCP Bridge] Starting MCP Bridge...
[MCP Bridge] Connector URL: http://localhost:50880
[MCP Bridge] Auth Token: ***configured***
[MCP Bridge] Bridge ready, waiting for requests from Claude Desktop...
```

### Common Issues

**"Could not connect to MCP Connector"**
- Make sure Docker containers are running
- Check port 50880 is accessible: `curl http://localhost:50880/health`

**"Command not found" in Claude Desktop**
- Verify the path to `mcp-bridge.js` is correct and absolute
- On Windows, make sure to use the full path with `.js` extension

**"Auth token not set"**
- Add the `MCP_AUTH_TOKEN` to the `env` section in `claude_desktop_config.json`

### View Bridge Logs

The bridge logs to stderr, which Claude Desktop should capture in its logs.

On macOS, you can view Claude Desktop logs at:
```
~/Library/Logs/Claude/
```

## Platform-Specific Paths

### Windows
```json
{
  "mcpServers": {
    "mcp-writing-system": {
      "command": "node",
      "args": [
        "C:\\Users\\YourUsername\\MCP-Electron-App\\claude-desktop-bridge\\mcp-bridge.js"
      ],
      "env": {
        "MCP_CONNECTOR_URL": "http://localhost:50880",
        "MCP_AUTH_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### macOS
```json
{
  "mcpServers": {
    "mcp-writing-system": {
      "command": "node",
      "args": [
        "/Users/yourusername/MCP-Electron-App/claude-desktop-bridge/mcp-bridge.js"
      ],
      "env": {
        "MCP_CONNECTOR_URL": "http://localhost:50880",
        "MCP_AUTH_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### Linux
```json
{
  "mcpServers": {
    "mcp-writing-system": {
      "command": "node",
      "args": [
        "/home/user/MCP-Electron-App/claude-desktop-bridge/mcp-bridge.js"
      ],
      "env": {
        "MCP_CONNECTOR_URL": "http://localhost:50880",
        "MCP_AUTH_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```
