# MCP Configuration Setup for TypingMind

This document explains the MCP (Model Context Protocol) configuration setup for the TypingMind Connector.

## Overview

The system now follows TypingMind's recommended approach for MCP configuration:

1. **MCP Config File (`mcp-config.json`)**: Lists all available MCP servers with their connection details
2. **Custom Entrypoint**: Docker container uses a custom entrypoint script that launches the connector with the config file
3. **Auto-Discovery**: MCP servers are automatically discovered from the repository and added to the config

## Architecture

```
TypingMind UI
    ↓
MCP Connector (port 50880) + Auth Token
    ↓
mcp-config.json (lists all servers)
    ↓
HTTP/SSE Server (port 3000)
    ↓
Individual MCP Servers (auto-discovered)
```

## How It Works

### 1. Server Discovery

The system automatically discovers MCP servers from the `mcp-writing-servers` repository:

```
{userData}/repositories/mcp-writing-servers/src/config-mcps/
├── book-planning-server/
├── chapter-planning-server/
├── character-planning-server/
├── core-continuity-server/
├── reporting-server/
├── review-server/
├── scene-server/
└── series-planning-server/
```

### 2. Config Generation

When the system starts, it:

1. Discovers all available MCP servers
2. Generates `mcp-config.json` with URL-based endpoints
3. Copies the config to the Docker context
4. Copies the custom entrypoint script to the Docker context

Example `mcp-config.json`:

```json
{
  "mcpServers": {
    "book-planning-server": {
      "url": "http://localhost:3000/book-planning-server"
    },
    "chapter-planning-server": {
      "url": "http://localhost:3000/chapter-planning-server"
    }
    // ... more servers
  }
}
```

### 3. Docker Integration

The Docker Compose setup uses:

- **Base file**: `docker-compose.connector-http-sse.yml` (from mcp-writing-servers repo)
- **Override file**: `docker-compose.override.yml` (custom)

The override file:
- Mounts the custom entrypoint script (`connector-entrypoint.sh`)
- Mounts the generated `mcp-config.json`
- Overrides the container entrypoint to use the custom script

### 4. Custom Entrypoint Script

The `connector-entrypoint.sh` script:

1. Waits for PostgreSQL to be ready
2. Starts the HTTP/SSE server in the background
3. Launches the MCP Connector with the config file:
   ```bash
   npx @typingmind/mcp@latest "$MCP_AUTH_TOKEN" --config /app/mcp-config.json
   ```

## Configuration Files

### Location Map

| File | Development Location | Docker Context | Container Path |
|------|---------------------|----------------|----------------|
| `mcp-config.json` | `{userData}/mcp-config.json` | `{repo}/docker/mcp-config.json` | `/app/mcp-config.json` |
| `connector-entrypoint.sh` | `MCP-Electron-App/docker/connector-entrypoint.sh` | `{repo}/docker/connector-entrypoint.sh` | `/custom-entrypoint.sh` |
| `docker-compose.override.yml` | `MCP-Electron-App/docker/docker-compose.override.yml` | `{repo}/docker/docker-compose.override.yml` | N/A (compose file) |

Where:
- `{userData}` = Electron app user data directory (e.g., `~/.config/MCP Electron App`)
- `{repo}` = `{userData}/repositories/mcp-writing-servers`

## TypingMind Setup

To connect TypingMind to your MCP servers:

### Option 1: Automatic Configuration (Recommended)

The Electron app automatically configures TypingMind during startup if selected.

### Option 2: Manual Configuration

1. Open TypingMind in your browser
2. Go to **Settings → Advanced Settings → Model Context Protocol**
3. Select **"Remote Server"**
4. Enter:
   - **Server URL**: `http://localhost:50880`
   - **Authentication Token**: (from your `.env` file or settings)
5. Click **"Connect"**
6. Go to **Plugins** tab
7. All MCP servers should appear automatically

## Development Workflow

### Adding New MCP Servers

1. Add your server to: `{repo}/src/config-mcps/your-server-name/`
2. Ensure it has an `index.js` entry point
3. Restart the application
4. The server will be auto-discovered and added to the config

### Updating Configuration

The config is regenerated on each startup. To force a regeneration:

1. Stop the Docker containers
2. Delete `{userData}/mcp-config.json`
3. Restart the application

### Debugging

Check these files for troubleshooting:

- **App logs**: See Electron app console
- **Docker logs**: `docker logs <container-name>`
- **Generated config**: `{userData}/mcp-config.json`
- **Docker context**: `{repo}/docker/`

## Code Structure

### Key Modules

1. **`mcp-config-generator.ts`**: Generates and manages the MCP config file
   - `generateMCPConfig()`: Creates the config from discovered servers
   - `loadMCPConfig()`: Loads the current config
   - `validateMCPConfig()`: Validates config structure

2. **`typingmind-auto-config.ts`**: Auto-configures TypingMind
   - `discoverMCPServers()`: Finds all MCP server directories
   - `buildMCPServersConfig()`: Builds the config object
   - `autoConfigureTypingMind()`: Performs auto-configuration

3. **`mcp-system.ts`**: Manages Docker lifecycle
   - `prepareMCPConfiguration()`: Prepares config files before Docker starts
   - `startSystem()`: Starts the entire MCP system

### Startup Flow

```
1. startSystem()
2. ├─ ensureDockerComposeFiles()
3. ├─ prepareMCPConfiguration()
4. │  ├─ generateMCPConfig()
5. │  ├─ Copy connector-entrypoint.sh to Docker context
6. │  ├─ Copy docker-compose.override.yml to Docker context
7. │  └─ Copy mcp-config.json to Docker context
8. ├─ execDockerCompose(composeFiles, 'build', ...)
9. └─ execDockerCompose(composeFiles, 'up', ...)
```

## Environment Variables

Required in `.env`:

```bash
MCP_AUTH_TOKEN=your_secure_token_here
HTTP_SSE_PORT=3000
MCP_CONNECTOR_PORT=50880
POSTGRES_DB=mcp_writing_db
POSTGRES_USER=writer
POSTGRES_PASSWORD=your_secure_password
```

## URL-Based vs Command-Based Configuration

### URL-Based (Current Implementation)

```json
{
  "mcpServers": {
    "server-name": {
      "url": "http://localhost:3000/server-name"
    }
  }
}
```

**Pros**:
- Works with existing HTTP/SSE architecture
- Single HTTP server manages all MCP servers
- Auto-discovery built-in
- Easier to maintain

### Command-Based (Alternative)

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/app/src/config-mcps/server-name/index.js", "--port", "9001"]
    }
  }
}
```

**Pros**:
- Each server runs as independent process
- More isolation between servers
- Follows TypingMind's example literally

**Note**: The current implementation uses URL-based configuration because it integrates better with the existing HTTP/SSE architecture.

## Troubleshooting

### Config File Not Generated

**Symptom**: No `mcp-config.json` file found

**Solution**:
1. Check that the mcp-writing-servers repository is cloned
2. Verify servers exist in `{repo}/src/config-mcps/`
3. Check application logs for errors
4. Try regenerating: Delete the config and restart

### Servers Not Appearing in TypingMind

**Symptom**: TypingMind shows "Connected" but no plugins

**Solution**:
1. Verify the connector is running: `docker ps`
2. Check Docker logs: `docker logs mcp-writing-system`
3. Verify the config file contains servers
4. Check that HTTP/SSE server is running inside container
5. Test endpoint manually: `curl http://localhost:3000/book-planning-server`

### Custom Entrypoint Not Loading

**Symptom**: Container starts with default behavior

**Solution**:
1. Check that `connector-entrypoint.sh` exists in Docker context
2. Verify execute permissions: `ls -la {repo}/docker/connector-entrypoint.sh`
3. Check override file is being used: Look for logs mentioning "Using docker-compose override file"
4. Ensure Docker Compose is using both files: Check the compose command in logs

## References

- [TypingMind MCP Documentation](https://docs.typingmind.com)
- [MCP Writing Servers Repository](https://github.com/RLRyals/MCP-Writing-Servers)
- [@typingmind/mcp Connector](https://www.npmjs.com/package/@typingmind/mcp)
