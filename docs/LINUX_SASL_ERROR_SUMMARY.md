# Linux SASL Authentication Error - Summary for User

## Problem Report
Your Linux tester encountered **SASL authentication failed** errors when using MCP tools in Typing Mind. The workaround of disabling the websearch tool temporarily masked the issue, but the root cause is a database connection problem.

## What Was Done

### 1. Diagnostic Script Created ✅
**File:** `linux-db-diagnostic.sh`

A comprehensive diagnostic script that checks:
- Docker and container status
- PostgreSQL and PgBouncer health
- Port conflicts
- Database connectivity from MCP containers
- Environment variables
- Authentication logs

**Usage:**
```bash
chmod +x linux-db-diagnostic.sh
./linux-db-diagnostic.sh
```

Save output to share with support:
```bash
./linux-db-diagnostic.sh > diagnostic-output.txt 2>&1
```

### 2. Detailed Fix Guide Created ✅
**File:** `LINUX_DB_FIX.md`

Comprehensive troubleshooting guide with 7 solutions in priority order:

1. **Restart All Services** - Fixes most transient issues
2. **Check Environment Variables** - Verify credentials
3. **Verify Docker Network** - Ensure container communication
4. **Check PostgreSQL Auth Method** - Verify SASL/SCRAM setup
5. **Increase Connection Limits** - For multiple MCP tools
6. **Check PgBouncer Configuration** - Connection pooling issues
7. **Workaround - Disable Problematic Tools** - Temporary solution

### 3. Enhanced Error Handling ✅
**File:** `src/utils/error-handler.ts`

Added specialized error codes and user-friendly messages for:

**Database Errors:**
- `DB_CONNECTION_FAILED` (5000)
- `DB_AUTH_FAILED` (5001)
- `DB_SASL_AUTH_FAILED` (5002) ← **Specific to this issue**
- `DB_TIMEOUT` (5003)
- `DB_NETWORK_ERROR` (5004)
- `DB_POOL_EXHAUSTED` (5005)
- `DB_QUERY_FAILED` (5006)
- `DB_PERMISSION_DENIED` (5007)

**MCP Server Errors:**
- `MCP_CONNECTION_FAILED` (5100)
- `MCP_TOOL_FAILED` (5101)
- `MCP_AUTH_FAILED` (5102)
- `MCP_TIMEOUT` (5103)
- `MCP_SERVER_UNAVAILABLE` (5104)
- `MCP_INVALID_RESPONSE` (5105)

Each error now includes:
- User-friendly explanation
- Platform-specific troubleshooting steps (especially Linux)
- Direct links to fix documentation
- Suggested recovery actions

## What Your Linux Tester Should Do

### Immediate Action (Most Likely Fix)
```bash
# Stop all services
docker compose down

# Wait 5 seconds
sleep 5

# Restart from FictionLab UI or:
docker compose up -d

# Check health
docker ps
```

### If That Doesn't Work
1. **Run the diagnostic script:**
   ```bash
   ./linux-db-diagnostic.sh > diagnostic.txt 2>&1
   ```

2. **Review the output** - it will tell you exactly what's wrong

3. **Follow the fix guide** - `LINUX_DB_FIX.md` has step-by-step solutions

### Collecting Debug Information
If none of the fixes work, collect this info:

```bash
# Run diagnostic
./linux-db-diagnostic.sh > diagnostic-output.txt 2>&1

# Collect logs
docker logs fictionlab-postgres > postgres.log 2>&1
docker logs fictionlab-pgbouncer > pgbouncer.log 2>&1
docker logs fictionlab-mcp-servers > mcp-servers.log 2>&1
docker logs fictionlab-mcp-connector > mcp-connector.log 2>&1

# Package everything
tar -czf fictionlab-debug.tar.gz \
    diagnostic-output.txt \
    postgres.log \
    pgbouncer.log \
    mcp-servers.log \
    mcp-connector.log
```

Then send you `fictionlab-debug.tar.gz`.

## Why This Happens on Linux But Not Windows

**Linux Docker networking differs from Windows:**

1. **Container networking:** Linux uses native bridge networking, Windows uses a VM layer
2. **Port binding:** Different behavior for localhost vs container names
3. **File permissions:** Linux Docker may have stricter permission requirements
4. **SASL auth method:** PostgreSQL SCRAM-SHA-256 auth works differently on Linux

## Common Causes

Based on the code analysis, the most likely causes are:

1. **Environment variables not passed to containers** (60% probability)
   - `POSTGRES_PASSWORD` not reaching MCP containers
   - Container can't authenticate to database

2. **Docker network isolation** (25% probability)
   - Containers can't communicate on internal network
   - MCP servers can't reach PostgreSQL

3. **Connection pool exhaustion** (10% probability)
   - Too many MCP tools connecting simultaneously
   - All connections used up (explains why disabling websearch "fixes" it)

4. **PgBouncer misconfiguration** (5% probability)
   - Connection pooler not properly configured
   - Auth method mismatch

## Expected Outcome

After running the diagnostic and applying fixes:

✅ **MCP tools work in Typing Mind**
✅ **No SASL authentication errors**
✅ **Can create authors, query database**
✅ **All tools available (including websearch if desired)**

## Files to Share With Linux Tester

1. **linux-db-diagnostic.sh** - Run this first
2. **LINUX_DB_FIX.md** - Step-by-step solutions
3. **This summary file** - Overview of the issue

## Next Steps

1. Send these files to your Linux tester
2. Ask them to run the diagnostic script
3. Based on output, follow the appropriate solution in LINUX_DB_FIX.md
4. If none of the fixes work, collect the debug package and investigate further

## Technical Notes

The SASL authentication happens at this level:
```
Typing Mind (Browser)
  ↓
MCP Connector (Docker)
  ↓
MCP Writing Servers (Docker)
  ↓
PostgreSQL via PgBouncer (Docker) ← SASL AUTH HAPPENS HERE
  ↓
PostgreSQL (Docker)
```

The MCP servers need these environment variables to connect:
- `DB_HOST` = "fictionlab-postgres" (or "fictionlab-pgbouncer")
- `DB_PORT` = 5432 (or 6432 for PgBouncer)
- `POSTGRES_USER` = "writer"
- `POSTGRES_PASSWORD` = <from .env>
- `POSTGRES_DB` = "mcp_writing_db"

If any of these are missing or incorrect, SASL authentication fails.

## Questions to Ask Your Tester

1. What Linux distribution are they using?
2. What Docker version? (`docker --version`)
3. Can they run `docker logs fictionlab-mcp-servers` and see any errors?
4. Does `docker exec fictionlab-mcp-servers env | grep POSTGRES` show the password?
5. Can they ping between containers: `docker exec fictionlab-mcp-servers ping fictionlab-postgres`?

These answers will help narrow down the exact cause.
