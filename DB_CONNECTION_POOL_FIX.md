# Database Connection Pool Fix - Comprehensive Solution

## Issue Summary

The Database Tab is failing with the error:
```
'no more connections allowed (max_client_conn)'
```

This occurs because **10 MCP servers are running simultaneously**, each creating its own connection pool with ~20 connections, totaling **200 connections** that exhaust PgBouncer's limit.

## Root Cause

### The Math
```
10 MCP servers × 20 connections per server = 200 total connections
PgBouncer max_client_conn = 200
Result: Pool exhausted even when idle! ❌
```

### The Architecture Problem
1. Each MCP server creates its own database connection pool
2. Pools don't shrink when idle
3. No connection sharing between servers
4. Connections are held even when not in use

## Solution Applied (This PR)

### 1. Added Connection Pool Configuration to docker-compose.yml

**File Modified:** `docker-compose.yml`

Added environment variables to the `mcp-writing-servers` service:
```yaml
environment:
  DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@pgbouncer:6432/${POSTGRES_DB}?sslmode=disable
  NODE_ENV: production
  NODE_OPTIONS: "--max-old-space-size=2048"
  # Connection pool configuration to prevent exhaustion
  DB_POOL_MAX: 5          # Max connections per server (10 servers × 5 = 50 total)
  DB_POOL_MIN: 1          # Minimum connections per server
  DB_POOL_IDLE_TIMEOUT: 10000  # Release idle connections after 10 seconds
```

### Expected Impact
```
Before: 10 servers × 20 connections = 200 connections ❌
After:  10 servers × 5 connections  = 50 connections ✅

Reduction: 75% fewer connections!
```

## Required Changes in MCP-Writing-Servers Repository

⚠️ **IMPORTANT**: The MCP-Writing-Servers repository must be updated to use these environment variables.

### Location
The connection pool configuration is likely in:
- `src/database/DatabaseManager.ts`
- `src/database/db.ts`
- `src/config/database.ts`

### Required Code Changes

**Current code (likely):**
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // HARDCODED - this is the problem!
  min: 5,
});
```

**Updated code (needed):**
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: 2000,
});

console.log(`[DATABASE] Pool configured with max=${pool.options.max}, min=${pool.options.min}`);
```

### Verification
After updating MCP-Writing-Servers, check the logs:
```bash
docker logs mcp-writing-servers 2>&1 | grep "Pool configured"
```

Should see:
```
[DATABASE] Pool configured with max=5, min=1
```

## Immediate Workaround (Until MCP-Writing-Servers is Updated)

### Option 1: Restart the System (Recommended)

1. **Stop the MCP System:**
   - In the app: Dashboard → Click **"Stop System"**
   - Or via CLI: `docker-compose down`

2. **Wait 10 seconds**

3. **Start the System:**
   - In the app: Dashboard → Click **"Start System"**
   - Or via CLI: `docker-compose up -d`

4. **Wait for all containers to be healthy**

5. **Test the Database Tab**

### Option 2: Restart PgBouncer Only

```bash
docker restart writing-pgbouncer
```

This clears stale connections temporarily but doesn't fix the root cause.

## Long-Term Solutions (Recommended for Future)

### Solution A: Shared Connection Pool (Best)

Create a singleton pool shared by all servers:

```typescript
// MCP-Writing-Servers/src/database/SharedPool.ts

import { Pool } from 'pg';

class SharedDatabasePool {
  private static instance: Pool | null = null;

  static getPool(): Pool {
    if (!this.instance) {
      this.instance = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: parseInt(process.env.DB_POOL_MAX || '30'),
        min: parseInt(process.env.DB_POOL_MIN || '5'),
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '10000'),
        connectionTimeoutMillis: 2000,
      });

      console.log(`[SHARED-POOL] Initialized with max=${this.instance.options.max}`);
    }

    return this.instance;
  }

  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.end();
      this.instance = null;
    }
  }
}

export default SharedDatabasePool;
```

**Impact:**
```
One shared pool for all 10 servers = 30 total connections (configurable)
Automatic connection sharing
Much more efficient resource usage
```

### Solution B: Lazy Server Loading

Only start servers that are actually needed:

```yaml
# docker-compose.yml
mcp-writing-servers:
  environment:
    ACTIVE_MCP_SERVERS: "${ACTIVE_MCP_SERVERS:-database-admin,book-planning,author}"
```

**Impact:**
```
3 active servers × 5 connections = 15 total connections
User controls which servers run
Faster startup, lower resource usage
```

## Testing the Fix

### Test 1: Verify Connection Count
```bash
# Check active connections to PgBouncer
docker exec writing-pgbouncer psql -p 6432 -U writer -d pgbouncer -c "SHOW CLIENTS;" | wc -l

# Should be ~50-60 connections (not 200+)
```

### Test 2: Verify Database Tab Works
1. Open the app
2. Navigate to **Database** tab
3. Click **"Refresh Connection"** → Should show "Connected to MCP Database Server"
4. Click **"List Tables"** → Should display tables without errors

### Test 3: Check Server Logs
```bash
# Verify no connection errors
docker logs mcp-writing-servers 2>&1 | grep -i "no more connections\|max_client_conn"

# Should return nothing (no errors)
```

### Test 4: Verify All Servers Started
```bash
docker logs mcp-writing-servers 2>&1 | grep "HTTP server running"

# Should see all 10 servers running on their ports
```

## Deployment Steps

### Step 1: Apply This PR
```bash
git checkout claude/fix-db-connection-pool-01UxWiQttzQCt3mpy3enyXGP
git pull
```

### Step 2: Stop the System
```bash
docker-compose down
```

### Step 3: Update MCP-Writing-Servers Repository

Navigate to your MCP-Writing-Servers repository and:

1. Find the database connection pool initialization code
2. Update it to use `DB_POOL_MAX`, `DB_POOL_MIN`, and `DB_POOL_IDLE_TIMEOUT` environment variables
3. Commit and push the changes
4. Pull the latest changes in your local repository

### Step 4: Rebuild and Start
```bash
# Rebuild the mcp-writing-servers container
docker-compose build mcp-writing-servers

# Start the system
docker-compose up -d
```

### Step 5: Verify
```bash
# Wait for containers to be healthy
docker ps

# Check connection count
docker exec writing-pgbouncer psql -p 6432 -U writer -d pgbouncer -c "SHOW CLIENTS;" | wc -l

# Test database tab in the app
```

## Success Criteria

✅ Active connection count < 100 (ideally < 60)
✅ Database tab shows "Connected" status
✅ "List Tables" works without errors
✅ No "max_client_conn" errors in logs
✅ All MCP servers start successfully

## Files Modified

- `docker-compose.yml` - Added DB_POOL_* environment variables

## Files That Need Modification (MCP-Writing-Servers)

- Database connection pool initialization code (likely in `src/database/DatabaseManager.ts` or similar)

## Related Documentation

- `CONNECTION_LEAK_ANALYSIS.md` - Detailed analysis of the problem
- `IMMEDIATE_FIX_PLAN.md` - Comprehensive solution roadmap
- `PGBOUNCER_CONNECTION_FIX.md` - Quick restart workarounds
- `DATABASE_TAB_FIX.md` - Previous PgBouncer limit increase (band-aid fix)

## Why Previous Fixes Didn't Work

**Previous approach:** Increased PgBouncer limits from 200 → 500
**Problem:** This is a band-aid that doesn't address the root cause
**Result:** Under any real load, the system would still exhaust connections

**This approach:** Configure smaller, smarter connection pools
**Benefit:** Efficient resource usage that scales properly
**Result:** System remains stable even under load

## Next Steps

1. **Immediate**: Apply this PR and restart the system
2. **Short-term**: Update MCP-Writing-Servers to use the environment variables
3. **Long-term**: Implement shared connection pool in MCP-Writing-Servers
4. **Future**: Add lazy server loading for user control

---

**Status:** Fix applied to MCP-Electron-App, waiting for MCP-Writing-Servers update
**Priority:** HIGH
**Impact:** Critical for database functionality
**Last Updated:** 2025-11-23
