# Troubleshooting 404 Errors in Docker MCP Setup

## Issue Description

When starting the MCP system in Docker, you may encounter 404 errors like:

```
Failed to initialize client author-server: SseError: SSE error: Non-200 status code (404)
```

## Root Cause

The 404 errors occur because the **HTTP/SSE server endpoints are not available**. This happens due to a mismatch between the MCP-Electron-App configuration and the MCP-Writing-Servers repository setup.

### Why This Happens

1. **Expected Setup**: The MCP-Electron-App has a reference `docker/connector-entrypoint.sh` script that expects:
   - An HTTP/SSE server to be running at `/app/src/http-sse-server.js` inside the Docker container
   - This server should expose endpoints like `http://localhost:3000/author-server`

2. **Current Reality**: The MCP-Writing-Servers repository's `docker-compose.connector-http-sse.yml` may:
   - Not include the `http-sse-server.js` file
   - Not start the HTTP/SSE server before the MCP Connector
   - Use a different entrypoint that doesn't match the expected configuration

3. **Configuration Mismatch**: The system is using `docker-compose.connector-http-sse.yml` from MCP-Writing-Servers (see `src/main/mcp-system.ts:111`), but this file needs to be updated with the proper setup.

## Current Status

According to `docs/MCP_CONFIGURATION.md`, there are **pending changes** required in the MCP-Writing-Servers repository:

> ### Pending Changes
>
> ### MCP-Writing-Servers Repository Updates Required
>
> To complete the integration, the following changes need to be made to the MCP-Writing-Servers repository:
>
> 1. **Add custom entrypoint script**: `docker/connector-config-entrypoint.sh`
> 2. **Add new Docker Compose file**: `docker/docker-compose.connector-config.yml`
> 3. **Reference implementation**: See `MCP-Electron-App/docker/connector-entrypoint.sh`

## Solution Options

### Option 1: Use Existing HTTP/SSE Server (If Available)

If the MCP-Writing-Servers repository already has an HTTP/SSE server:

1. **Verify the server exists**:
   ```bash
   ls -la ~/.config/MCP\ Electron\ App/repositories/mcp-writing-servers/src/
   ```

   Look for `http-sse-server.js` or similar

2. **Check Docker logs**:
   ```bash
   docker logs mcp-writing-system 2>&1 | grep -E "SSE|http|ERROR"
   ```

3. **Test endpoints manually**:
   ```bash
   curl http://localhost:3000/author-server
   ```

### Option 2: Update MCP-Writing-Servers Repository

The proper fix requires updating the MCP-Writing-Servers repository. See `docs/PR_PROMPT_MCP_WRITING_SERVERS.md` for detailed instructions.

**Key requirements**:
1. Create `docker/connector-config-entrypoint.sh` (reference: `MCP-Electron-App/docker/connector-entrypoint.sh`)
2. Ensure `src/http-sse-server.js` exists and properly exposes all MCP servers
3. Update Docker Compose to use the custom entrypoint
4. Mount the `mcp-config.json` file as a volume

### Option 3: Wait for MCP-Writing-Servers Update (Temporary)

Until the MCP-Writing-Servers repository is updated, you can:

1. **Use a different Docker Compose file** (if available):
   ```bash
   # Check for alternative compose files
   ls -la ~/.config/MCP\ Electron\ App/repositories/mcp-writing-servers/docker/
   ```

2. **Manually verify the setup**:
   - Ensure the MCP-Writing-Servers repository is cloned
   - Check that Docker is running
   - Verify all environment variables are set correctly

## Immediate Workaround

While waiting for the proper fix, you can try these workarounds:

### 1. Check MCP-Writing-Servers Repository Version

```bash
cd ~/.config/MCP\ Electron\ App/repositories/mcp-writing-servers
git log --oneline -5
```

Make sure you have the latest version with HTTP/SSE support.

### 2. Re-clone the Repository

Sometimes the repository might be corrupted or outdated:

1. Close the FictionLab App
2. Delete the repository:
   ```bash
   rm -rf ~/.config/MCP\ Electron\ App/repositories/mcp-writing-servers
   ```
3. Restart the FictionLab App (it will re-clone automatically)

### 3. Check Docker Container Status

```bash
# View all MCP containers
docker ps -a --filter "name=mcp-"

# Check specific container logs
docker logs mcp-writing-system 2>&1 | tail -100

# Look for HTTP/SSE server startup messages
docker logs mcp-writing-system 2>&1 | grep "HTTP/SSE\|Starting\|port"
```

### 4. Verify Environment Configuration

1. Open the FictionLab App
2. Go to **Settings → Environment Configuration**
3. Verify all fields are filled:
   - `MCP_AUTH_TOKEN` is set
   - `POSTGRES_PASSWORD` is set
   - `HTTP_SSE_PORT` is set (default: 3000)
   - `MCP_CONNECTOR_PORT` is set (default: 50880)

## Expected Behavior (When Fixed)

When the system is properly configured, you should see:

1. **Container logs showing HTTP/SSE server starting**:
   ```
   Starting HTTP/SSE Server on port 3000...
   ✓ HTTP/SSE Server started (PID: 123)
   ```

2. **MCP Connector loading with config**:
   ```
   ✓ Using MCP config file: /app/mcp-config.json
   Starting MCP Connector on port 50880...
   ```

3. **All servers initialized successfully**:
   ```
   Initialized: book-planning-server
   Initialized: chapter-planning-server
   Initialized: author-server
   ...
   ```

## File Locations Reference

- **FictionLab App Config**: `~/.config/FictionLab App/config/mcp-config.json`
- **MCP-Writing-Servers Repo**: `~/.config/FictionLab App/repositories/mcp-writing-servers/`
- **Docker Compose Files**: `~/.config/FictionLab App/repositories/mcp-writing-servers/docker/`
- **Reference Entrypoint**: `MCP-Electron-App/docker/connector-entrypoint.sh` (in source code)

## Code References

Key files to check:

1. **src/main/mcp-system.ts:107-114** - Docker compose file selection
2. **docs/MCP_CONFIGURATION.md** - Full documentation of the setup
3. **docs/PR_PROMPT_MCP_WRITING_SERVERS.md** - Required changes for MCP-Writing-Servers
4. **docker/connector-entrypoint.sh** - Reference implementation

## Getting Help

If these solutions don't work:

1. **Check application logs**:
   - In the FictionLab App, go to **Diagnostics → View Logs**

2. **Check Docker logs**:
   ```bash
   docker logs mcp-writing-system 2>&1 > ~/mcp-logs.txt
   docker logs mcp-writing-db 2>&1 >> ~/mcp-logs.txt
   ```

3. **Report the issue**:
   - GitHub Issues: https://github.com/RLRyals/MCP-Electron-App/issues
   - Include: Docker logs, application logs, and error messages

## Next Steps for Developers

To permanently fix this issue, the MCP-Writing-Servers repository needs to be updated:

1. Review `docs/PR_PROMPT_MCP_WRITING_SERVERS.md`
2. Implement the custom entrypoint script
3. Add volume mounting for `mcp-config.json`
4. Test the integration
5. Submit a PR to MCP-Writing-Servers

---

**Last Updated**: 2025-11-12
**Status**: Issue identified, fix pending in MCP-Writing-Servers repository
