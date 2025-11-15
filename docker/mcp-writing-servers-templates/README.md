# MCP Writing Servers Templates

This directory contains template files for the MCP Writing Servers repository.

## Files

### Dockerfile

Multi-stage production Dockerfile for the MCP Writing Servers.

**Usage**: Copy this file to the root of the `mcp-writing-servers` repository.

**Purpose**: Implements Task 2.1 from IMPLEMENTATION_TASKS.md to create an optimized, secure, production-ready Docker image with:
- Multi-stage build architecture
- Non-root user execution
- dumb-init for proper signal handling
- Layer caching for faster builds
- Minimal image size

**Related**: See `/docs/ISSUE-87-MULTISTAGE-DOCKERFILE.md` for complete documentation.

### server.js

Server orchestrator script that manages all 9 MCP servers as child processes.

**Usage**: Copy this file to the root of the `mcp-writing-servers` repository.

**Purpose**: Implements Task 2.2 from IMPLEMENTATION_TASKS.md to provide centralized process management with:
- Single entry point for all MCP servers
- Unified logging with prefixed output
- Graceful shutdown handling (SIGTERM/SIGINT)
- Proper error handling and fail-fast behavior
- Environment variable configuration per server

**Related**: See `/docs/ISSUE-88-SERVER-ORCHESTRATOR.md` for complete documentation.

## How to Apply

### For Dockerfile (Task 2.1 / Issue #87)

1. Navigate to your local `mcp-writing-servers` repository
2. Copy the Dockerfile:
   ```bash
   cp /path/to/MCP-Electron-App/docker/mcp-writing-servers-templates/Dockerfile /path/to/mcp-writing-servers/Dockerfile
   ```
3. Test the build:
   ```bash
   cd /path/to/mcp-writing-servers
   docker build -t mcp-writing-servers:test .
   ```
4. Commit and push to the mcp-writing-servers repository

### For server.js (Task 2.2 / Issue #88)

1. Navigate to your local `mcp-writing-servers` repository
2. Copy the server.js file:
   ```bash
   cp /path/to/MCP-Electron-App/docker/mcp-writing-servers-templates/server.js /path/to/mcp-writing-servers/server.js
   ```
3. Verify file paths match your repository structure:
   ```bash
   cd /path/to/mcp-writing-servers
   ls -la src/mcps/*/index.js
   ```
4. Update paths in server.js if your structure differs
5. Test the orchestrator locally:
   ```bash
   node server.js
   ```
6. Commit and push to the mcp-writing-servers repository

## Note

These templates are maintained in the MCP-Electron-App repository but are intended for use in the mcp-writing-servers repository. This approach allows tracking the work as part of issues #87 and #88 while keeping the files available for the target repository.

## Dependencies

- **Dockerfile**: Standalone (Task 2.1 / Issue #87)
- **server.js**: Works with the Dockerfile (Task 2.2 / Issue #88)
- Both files work together to provide the complete orchestration solution
