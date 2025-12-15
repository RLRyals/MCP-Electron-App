# Docker Networking Fix for Linux SASL Authentication

## Problem
SASL authentication errors on Linux when MCP tools tried to connect to PostgreSQL through PgBouncer.

**Root Cause:**
The `docker-compose.yml` was incorrectly using `${PGBOUNCER_PORT}` in the DATABASE_URL connection string. This variable represents the **external** port mapping (e.g., 6432 on the host), but inside the Docker network, containers must use **internal** ports.

### Why This Failed on Linux But Not Windows

**Windows Docker Desktop:**
- Uses a VM layer with more forgiving networking
- Sometimes allows external port variables to work internally
- NAT translation can mask the issue

**Linux Docker (Native):**
- Uses native bridge networking
- Strict separation between internal and external ports
- External port variables don't work for inter-container communication

## The Fix

### Before (BROKEN on Linux):
```yaml
environment:
  DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@pgbouncer:${PGBOUNCER_PORT}/${POSTGRES_DB}
  # ${PGBOUNCER_PORT} might be 6432 externally, but containers see different ports
```

### After (WORKS on all platforms):
```yaml
environment:
  # Use container name and INTERNAL port
  DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@fictionlab-pgbouncer:6432/${POSTGRES_DB}

  # Explicit credentials passed individually too
  POSTGRES_HOST: fictionlab-pgbouncer
  POSTGRES_PORT: 6432
  POSTGRES_USER: ${POSTGRES_USER}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  POSTGRES_DB: ${POSTGRES_DB}

  # Fallback to direct PostgreSQL if PgBouncer has issues
  DB_HOST: fictionlab-postgres
  DB_PORT: 5432
```

## Key Changes Made

1. **Container Name**: Changed `pgbouncer` → `fictionlab-pgbouncer` (full container name)
2. **Internal Port**: Hardcoded `6432` instead of `${PGBOUNCER_PORT}` variable
3. **Explicit Params**: Added individual connection parameters for different connection patterns
4. **Fallback Option**: Added `DIRECT_DATABASE_URL` for direct PostgreSQL access
5. **Dependency**: Added `pgbouncer` to `depends_on` to ensure startup order

## Docker Networking Principles

### External vs Internal Ports

**Port Mapping Format:** `"${EXTERNAL}:${INTERNAL}"`

Example:
```yaml
ports:
  - "6432:6432"  # Maps host port 6432 to container port 6432
```

**From Host:**
- Access via: `localhost:6432`
- Uses external port

**From Another Container:**
- Access via: `container-name:6432`
- Uses internal port (right side of mapping)
- NEVER use `${PORT_VARIABLE}` - it might be different!

### Container Naming

**Short Name vs Full Name:**
```yaml
services:
  pgbouncer:                    # Short service name
    container_name: fictionlab-pgbouncer  # Full container name
```

**Best Practice:**
- Always use full `container_name` in connection strings
- Ensures consistency across environments
- Avoids Docker Compose prefix issues

## Why This Fixes SASL Authentication

**The Authentication Flow:**
```
MCP Container → Connects to fictionlab-pgbouncer:6432
                ↓
PgBouncer → Authenticates user with SCRAM-SHA-256
            ↓
            Connects to fictionlab-postgres:5432
            ↓
PostgreSQL → Validates credentials
```

**What Was Breaking:**
- MCP container tried to connect to `pgbouncer:${PGBOUNCER_PORT}`
- `${PGBOUNCER_PORT}` might resolve to wrong value or be undefined
- Connection failed or went to wrong service
- PostgreSQL rejected with SASL authentication error

**What Now Works:**
- MCP container connects to `fictionlab-pgbouncer:6432` (hardcoded, reliable)
- PgBouncer receives connection correctly
- Authentication succeeds
- Database queries work

## Testing the Fix

### On Linux:
```bash
# Restart services to apply changes
docker compose down
docker compose up -d

# Verify MCP container has correct environment
docker exec fictionlab-mcp-servers env | grep -E "DATABASE_URL|POSTGRES_HOST"

# Should show:
# DATABASE_URL=postgresql://writer:***@fictionlab-pgbouncer:6432/mcp_writing_db
# POSTGRES_HOST=fictionlab-pgbouncer
# POSTGRES_PORT=6432

# Test connection from MCP container
docker exec fictionlab-mcp-servers sh -c 'node -e "
const { Client } = require(\"pg\");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => console.log(\"✓ Connection successful\"))
  .catch(err => console.error(\"✗ Failed:\", err.message))
  .finally(() => client.end());
"'
```

### Expected Result:
```
✓ Connection successful
```

### In Typing Mind:
Ask Claude or Gemini to create an author:
```
Add a new author named "Test Author"
```

Should work without SASL authentication errors.

## Files Changed

1. **docker-compose.yml** - Fixed DATABASE_URL and added explicit connection params

## Impact

✅ **Fixes:**
- SASL authentication errors on Linux
- Inter-container database connectivity issues
- MCP tools unable to query database

✅ **Maintains:**
- Windows compatibility
- macOS compatibility
- Connection pooling via PgBouncer
- All existing functionality

✅ **Improves:**
- Cross-platform reliability
- Error clarity
- Connection string consistency

## Prevention

**When adding new services to docker-compose.yml:**

❌ **DON'T:**
```yaml
environment:
  DB_URL: postgresql://user:pass@service:${PORT_VAR}/db
```

✅ **DO:**
```yaml
environment:
  DB_URL: postgresql://user:pass@fictionlab-service:5432/db
```

**Golden Rule:**
> In Docker Compose environment variables for inter-container connections, always use hardcoded internal ports and full container names.

## Related Issues

- Linux SASL authentication failures
- "Connection refused" errors between containers
- Environment variables not resolving correctly in connection strings
- PgBouncer connectivity issues on Linux

## Version

- **Fixed in**: [Current Date]
- **Affects**: All Linux deployments
- **Backward Compatible**: Yes (Windows/macOS unaffected)
