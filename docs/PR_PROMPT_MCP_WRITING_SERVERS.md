# Prompt for Claude Code Agent: MCP-Writing-Servers Configuration Support

## Task Overview

Add support for `mcp-config.json` file to the MCP-Writing-Servers repository to enable TypingMind's recommended MCP configuration approach. This integrates with the MCP-Electron-App which generates the config file.

## Repository Information

- **Repository**: https://github.com/RLRyals/MCP-Writing-Servers
- **Current Docker setup**: `docker/docker-compose.connector-http-sse.yml`
- **Current entrypoint**: `docker/connector-http-sse-entrypoint.sh`

## Changes Required

### 1. Create Custom Entrypoint Script

**File**: `docker/connector-config-entrypoint.sh`

**Purpose**: Launch the MCP Connector with `--config` flag to use `mcp-config.json`

**Template** (reference from MCP-Electron-App repo):
```bash
#!/bin/bash
set -e

echo "=========================================="
echo "MCP Writing System - Starting with Config"
echo "=========================================="

# Validate required environment variables
if [ -z "$MCP_AUTH_TOKEN" ]; then
  echo "ERROR: MCP_AUTH_TOKEN environment variable is required"
  exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "ERROR: POSTGRES_PASSWORD environment variable is required"
  exit 1
fi

# Set default values
HTTP_SSE_PORT=${HTTP_SSE_PORT:-3000}
MCP_CONNECTOR_PORT=${MCP_CONNECTOR_PORT:-50880}
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_USER=${POSTGRES_USER:-writer}
POSTGRES_DB=${POSTGRES_DB:-mcp_writing_db}

echo "Environment Configuration:"
echo "  - HTTP/SSE Port: $HTTP_SSE_PORT"
echo "  - MCP Connector Port: $MCP_CONNECTOR_PORT"
echo "  - PostgreSQL Host: $POSTGRES_HOST"
echo "  - PostgreSQL Database: $POSTGRES_DB"
echo ""

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; then
    echo "✓ PostgreSQL is ready"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "  Attempt $RETRY_COUNT/$MAX_RETRIES - PostgreSQL not ready yet, waiting..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: PostgreSQL did not become ready in time"
  exit 1
fi

# Start HTTP/SSE Server in the background
echo ""
echo "Starting HTTP/SSE Server on port $HTTP_SSE_PORT..."
HTTP_SSE_PORT=$HTTP_SSE_PORT node /app/src/http-sse-server.js &
HTTP_SSE_PID=$!

# Give the HTTP/SSE server a moment to start
sleep 3

# Verify HTTP/SSE server is running
if ! ps -p $HTTP_SSE_PID > /dev/null; then
  echo "ERROR: HTTP/SSE Server failed to start"
  exit 1
fi

echo "✓ HTTP/SSE Server started (PID: $HTTP_SSE_PID)"

# Start MCP Connector with config file
echo ""
echo "Starting MCP Connector on port $MCP_CONNECTOR_PORT..."

# Check if mcp-config.json exists
if [ -f "/app/mcp-config.json" ]; then
  echo "✓ Using MCP config file: /app/mcp-config.json"

  # Show config file contents for debugging
  echo "Config file contents:"
  cat /app/mcp-config.json | head -20
  echo ""

  # Launch connector with config file
  exec npx @typingmind/mcp@latest "$MCP_AUTH_TOKEN" --config /app/mcp-config.json
else
  echo "⚠ MCP config file not found at /app/mcp-config.json"
  echo "  Falling back to default connector mode (no config file)"

  # Launch connector without config file (fallback mode)
  exec npx @typingmind/mcp@latest "$MCP_AUTH_TOKEN"
fi
```

**Requirements**:
- Script must have execute permissions (chmod +x)
- Must handle both config file mode and fallback mode
- Must wait for PostgreSQL before starting
- Must start HTTP/SSE server in background
- Must use `exec` for the final connector command

### 2. Create New Docker Compose File

**File**: `docker/docker-compose.connector-config.yml`

**Purpose**: Docker Compose file that supports mcp-config.json volume mounting

**Based on**: `docker-compose.connector-http-sse.yml`

**Key Changes**:
1. Add volume mount for the config file
2. Use the new custom entrypoint

**Example structure**:
```yaml
version: '3.8'

services:
  postgres:
    # Same as connector-http-sse.yml
    image: postgres:15
    # ... rest of postgres config

  mcp-writing-system:
    # Build configuration
    build:
      context: ..
      dockerfile: docker/Dockerfile.connector-config  # New Dockerfile or reuse existing

    # Volume mounts
    volumes:
      # Mount the mcp-config.json file from host
      - ${MCP_CONFIG_FILE_PATH:-./mcp-config.json}:/app/mcp-config.json:ro

    # Use custom entrypoint
    entrypoint: ["/usr/local/bin/connector-config-entrypoint.sh"]

    # Environment variables (same as connector-http-sse.yml)
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      MCP_AUTH_TOKEN: ${MCP_AUTH_TOKEN}
      HTTP_SSE_PORT: ${HTTP_SSE_PORT:-3000}
      MCP_CONNECTOR_PORT: ${MCP_CONNECTOR_PORT:-50880}

    # Ports (same as connector-http-sse.yml)
    ports:
      - "${MCP_CONNECTOR_PORT:-50880}:${MCP_CONNECTOR_PORT:-50880}"

    # Dependencies
    depends_on:
      postgres:
        condition: service_healthy

    # Health check
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "${MCP_CONNECTOR_PORT:-50880}"]
      interval: 10s
      timeout: 5s
      retries: 5

    networks:
      - mcp-network

networks:
  mcp-network:
    driver: bridge

volumes:
  mcp-writing-data:
```

### 3. Update or Create Dockerfile

**Option A**: Reuse existing Dockerfile.connector-http-sse and add the new entrypoint

**Option B**: Create `docker/Dockerfile.connector-config` (copy of Dockerfile.connector-http-sse)

**Key requirement**:
- Copy the `connector-config-entrypoint.sh` to `/usr/local/bin/`
- Make it executable
- Set it as the entrypoint

**Example addition to Dockerfile**:
```dockerfile
# Copy the custom entrypoint script
COPY docker/connector-config-entrypoint.sh /usr/local/bin/connector-config-entrypoint.sh
RUN chmod +x /usr/local/bin/connector-config-entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/usr/local/bin/connector-config-entrypoint.sh"]
```

### 4. Update README (Optional but Recommended)

Add documentation about the new configuration mode:

```markdown
## Configuration Modes

### HTTP/SSE Mode (Default)
Uses `docker-compose.connector-http-sse.yml`

### Config File Mode (Recommended for TypingMind)
Uses `docker-compose.connector-config.yml`

This mode requires an `mcp-config.json` file that lists all MCP servers.

**Usage**:
```bash
export MCP_CONFIG_FILE_PATH=/path/to/mcp-config.json
docker-compose -f docker/docker-compose.connector-config.yml up -d
```

**Config file format**:
```json
{
  "mcpServers": {
    "server-name": {
      "url": "http://localhost:3000/server-name"
    }
  }
}
```
```

## Testing Requirements

Before submitting the PR, test:

1. **With config file**:
   ```bash
   # Create a test mcp-config.json
   cat > /tmp/mcp-config.json <<EOF
   {
     "mcpServers": {
       "book-planning-server": {
         "url": "http://localhost:3000/book-planning-server"
       }
     }
   }
   EOF

   # Run with config
   export MCP_CONFIG_FILE_PATH=/tmp/mcp-config.json
   docker-compose -f docker/docker-compose.connector-config.yml up -d

   # Check logs
   docker logs mcp-writing-system
   ```

2. **Without config file** (fallback mode):
   ```bash
   # Run without MCP_CONFIG_FILE_PATH set
   docker-compose -f docker/docker-compose.connector-config.yml up -d

   # Should fall back to default mode
   docker logs mcp-writing-system
   ```

3. **Verify connector starts**:
   ```bash
   # Check that connector is running
   curl http://localhost:50880
   ```

## PR Details

**Branch name**: `feature/mcp-config-file-support`

**PR Title**: Add support for mcp-config.json in Docker setup

**PR Description**:
```markdown
## Summary
Adds support for using `mcp-config.json` file with the MCP Connector, following TypingMind's recommended configuration approach.

## Changes
- Added `docker/connector-config-entrypoint.sh`: Custom entrypoint with `--config` support
- Added `docker/docker-compose.connector-config.yml`: Compose file with volume mounting
- Updated/Created Dockerfile to include the new entrypoint
- [Optional] Updated README with configuration mode documentation

## Features
- ✅ Supports mcp-config.json via `MCP_CONFIG_FILE_PATH` environment variable
- ✅ Graceful fallback if config file is missing
- ✅ Maintains backward compatibility with existing HTTP/SSE mode
- ✅ Volume mounting for config file (read-only)

## Integration
This change enables integration with MCP-Electron-App which auto-generates the config file.

## Testing
- [x] Tested with config file present
- [x] Tested fallback mode (config file missing)
- [x] Verified connector starts and accepts connections
- [x] Verified PostgreSQL connection works
- [x] Verified HTTP/SSE server starts correctly

## Related
- Integrates with: RLRyals/MCP-Electron-App#[PR number]
```

## Important Notes

1. **Maintain backward compatibility**: Don't break the existing `docker-compose.connector-http-sse.yml` setup
2. **Graceful fallback**: If config file is missing, fall back to default mode
3. **Read-only mount**: Config file should be mounted as `:ro` (read-only)
4. **Environment variable**: Use `MCP_CONFIG_FILE_PATH` with a sensible default
5. **Execute permissions**: Ensure entrypoint script is executable

## File Locations Summary

New files to create:
- `docker/connector-config-entrypoint.sh` (executable)
- `docker/docker-compose.connector-config.yml`
- `docker/Dockerfile.connector-config` (optional, or update existing)
- Updates to README.md (optional)

## Reference

The MCP-Electron-App repository has a reference implementation in:
- `docker/connector-entrypoint.sh` (can be viewed for reference)
- See commit history on branch `claude/mcp-typing-mind-setup-011CV4ZEsuQd6zZWuPLE4Fo3`

## Success Criteria

✅ New compose file and entrypoint created
✅ Config file mounting works
✅ Fallback mode works
✅ Backward compatibility maintained
✅ Tests pass
✅ Documentation updated
✅ PR submitted with clear description

---

## Instructions for Claude Code Agent

1. Clone the MCP-Writing-Servers repository
2. Create a new branch: `feature/mcp-config-file-support`
3. Create all required files as specified above
4. Test the implementation
5. Commit with clear messages
6. Create PR with the description provided

Ask clarifying questions if anything is unclear!
