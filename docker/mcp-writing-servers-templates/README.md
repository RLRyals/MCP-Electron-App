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

## How to Apply

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

## Note

These templates are maintained in the MCP-Electron-App repository but are intended for use in the mcp-writing-servers repository. This approach allows tracking the work as part of issue #87 while keeping the files available for the target repository.
