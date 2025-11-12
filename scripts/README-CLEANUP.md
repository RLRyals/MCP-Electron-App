# Docker Cleanup Scripts

## Purpose

These scripts help resolve Docker port conflicts (EADDRINUSE errors) by safely cleaning up MCP-related containers.

## Safety

**IMPORTANT:** These scripts are designed to ONLY affect MCP-related containers:
- Containers with names starting with `mcp-`
- Containers with names starting with `typing-mind-`

**Your other Docker containers will NOT be affected.**

## Usage

### Linux/macOS

```bash
./scripts/cleanup-docker.sh
```

### Windows

```cmd
scripts\cleanup-docker.bat
```

## When to Use

Use these scripts when:
1. You encounter a `EADDRINUSE` error when starting the MCP system
2. The application fails to start with port conflict messages
3. You need to completely reset the MCP Docker containers

## What the Scripts Do

1. Check if Docker is running
2. Find all MCP-related containers
3. Stop those containers
4. Remove those containers
5. Leave volumes intact (unless you uncomment the volume cleanup section)

## Automatic Cleanup

The MCP system now includes automatic cleanup:
- Before starting services, old containers are automatically stopped and removed
- If port conflicts are detected, the system attempts automatic recovery
- These scripts are only needed if automatic cleanup fails

## Manual Docker Commands

If you prefer to run Docker commands directly:

```bash
# View MCP containers
docker ps -a --filter "name=mcp-" --filter "name=typing-mind-"

# Stop MCP containers only
docker stop $(docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q)

# Remove MCP containers only
docker rm $(docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q)
```

## Troubleshooting

If you still encounter port conflicts after running the cleanup:

1. Check if another application is using the port:
   ```bash
   # Linux/macOS
   lsof -i :50880

   # Windows (PowerShell)
   Get-NetTCPConnection -LocalPort 50880
   ```

2. Change the port in the MCP Electron App environment configuration

3. Restart Docker Desktop
