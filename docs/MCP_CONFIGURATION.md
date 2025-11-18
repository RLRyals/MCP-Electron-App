# MCP Configuration Setup for TypingMind

This document explains the MCP (Model Context Protocol) configuration setup for the TypingMind Connector.

## Overview

The system follows TypingMind's recommended approach for MCP configuration:

1. **MCP Config File (`mcp-config.json`)**: Auto-generated file that lists all available MCP servers
2. **Volume Mounting**: Config file is mounted into the Docker container
3. **Auto-Discovery**: MCP servers are automatically discovered from the repository and added to the config

## Architecture

```
TypingMind UI
    ↓
MCP Connector (port 50880) + Auth Token
    ↓
mcp-config.json (mounted as Docker volume)
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
2. Generates `mcp-config.json` with URL-based endpoints in `{userData}/config/`
3. Passes the config file path to Docker as an environment variable (`MCP_CONFIG_FILE_PATH`)

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

The Docker Compose setup will use a volume mount to access the config file:

- **Base file**: `docker-compose.connector-http-sse.yml` (from mcp-writing-servers repo)
- **Future file**: `docker-compose.connector-config.yml` (to be added to mcp-writing-servers repo)

The MCP-Writing-Servers repository will be updated to:
- Add a custom entrypoint script that reads the config file
- Add volume mounting for the config file using `${MCP_CONFIG_FILE_PATH}`
- Launch the connector with `--config /app/mcp-config.json`

**Note**: The Docker integration is currently being refactored. The Electron app generates the config file, and the MCP-Writing-Servers repo will be updated to use it.

## Configuration Files

### Location Map

| File | Location | Purpose |
|------|----------|---------|
| `mcp-config.json` | `{userData}/config/mcp-config.json` | Generated config file (mounted as volume) |
| `connector-entrypoint.sh` | `MCP-Electron-App/docker/connector-entrypoint.sh` | Reference implementation for MCP-Writing-Servers PR |

Where:
- `{userData}` = Electron app user data directory (e.g., `~/.config/FictionLab App`)

**Volume Mounting**:
- The config file is passed to Docker via the `MCP_CONFIG_FILE_PATH` environment variable
- Docker will mount it at `/app/mcp-config.json` (this will be configured in MCP-Writing-Servers repo)

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
4. │  └─ generateMCPConfig() → creates {userData}/config/mcp-config.json
5. ├─ execDockerCompose() with MCP_CONFIG_FILE_PATH env var
6. │  ├─ Build Docker image
7. │  └─ Start containers (config mounted via volume)
8. └─ Container uses config file via MCP-Writing-Servers entrypoint
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

### Config File Not Mounted

**Symptom**: Container starts but config file not found

**Solution**:
1. Verify config was generated: Check `{userData}/config/mcp-config.json`
2. Check environment variable is set: Look for `MCP_CONFIG_FILE_PATH` in logs
3. Verify the MCP-Writing-Servers repo has been updated with volume mount support
4. Check Docker logs for mount errors: `docker logs mcp-writing-system`

**Note**: The Docker volume mounting requires updates to the MCP-Writing-Servers repository (see "Pending Changes" section below).

## Pending Changes

### MCP-Writing-Servers Repository Updates Required

To complete the integration, the following changes need to be made to the [MCP-Writing-Servers](https://github.com/RLRyals/MCP-Writing-Servers) repository:

1. **Add custom entrypoint script**: `docker/connector-config-entrypoint.sh`
   - Waits for PostgreSQL
   - Starts HTTP/SSE server
   - Launches connector with `--config /app/mcp-config.json`

2. **Add new Docker Compose file**: `docker/docker-compose.connector-config.yml`
   - Based on `docker-compose.connector-http-sse.yml`
   - Adds volume mount: `${MCP_CONFIG_FILE_PATH}:/app/mcp-config.json:ro`
   - Uses the custom entrypoint script

3. **Reference implementation**: See `MCP-Electron-App/docker/connector-entrypoint.sh` for the entrypoint script template

Once these changes are merged in MCP-Writing-Servers, the Electron app will be able to use the config-based approach seamlessly.

## References

- [TypingMind MCP Documentation](https://docs.typingmind.com)
- [MCP Writing Servers Repository](https://github.com/RLRyals/MCP-Writing-Servers)
- [@typingmind/mcp Connector](https://www.npmjs.com/package/@typingmind/mcp)
