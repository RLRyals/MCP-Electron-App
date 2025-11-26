# Connection Leak Analysis - Database Tab Issue

## Executive Summary

**ROOT CAUSE IDENTIFIED**: 10 MCP servers running simultaneously, each creating ~20 database connections = 200 total connections, immediately exhausting PgBouncer's limit.

**THIS IS NOT A CAPACITY ISSUE - IT'S AN ARCHITECTURE ISSUE**

Increasing limits from 200 → 500 is a band-aid that:
- ❌ Wastes database resources
- ❌ Delays the inevitable
- ❌ Doesn't address the real problem
- ❌ Will fail again under any real load

## Problem Statement

The system hits PgBouncer's `max_client_conn` limit (200) even when idle. Each of 10 MCP servers creates its own connection pool, exhausting available connections before any actual work begins.

## Evidence from Logs and Documentation

From the user's logs, we can see servers starting and failing:

```
[book-planning-phase] Database manager created
book-planning-phase HTTP server running on port 3000

[database-admin-server] Database manager created
database-admin-server HTTP server running on port 3000

[DATABASE-ADMIN-SERVER] Database health check failed: no more connections allowed (max_client_conn)
```

**CONFIRMED: From `docs/DATABASE-CRUD-SPECIFICATION.md`, there are exactly 10 MCP servers:**

1. book-planning-server
2. series-planning-server
3. chapter-planning-server
4. character-planning-server
5. scene-server
6. core-continuity-server
7. review-server
8. reporting-server
9. author-server
10. database-admin-server

## Confirmed Root Cause

### 1. 10 MCP Servers × Default Pool Size = Exhausted Connections

**The math is simple and damning:**

```
10 servers × 20 connections/server (typical default) = 200 connections
```

This **immediately exhausts PgBouncer's max_client_conn = 200** even when all servers are completely idle!

When the 10th server (database-admin-server) tries to connect, there are no available connections:
```
[DATABASE-ADMIN-SERVER] Database health check failed: no more connections allowed (max_client_conn)
```

### 2. Connection Pools Not Sharing Resources

Each MCP server appears to create its own `DatabaseManager` instance:
```
[book-planning-phase] Database manager created
[database-admin-server] Database manager created
```

This suggests each server is creating separate connection pools instead of sharing a centralized pool.

### 3. Connections Not Being Released

Even when servers are idle (not processing requests), they're likely holding onto all pool connections. This is normal for connection pools, but problematic when you have many servers.

### 4. No Connection Recycling Strategy

The system may lack:
- Connection timeouts for idle connections
- Dynamic pool sizing (shrinking pools when idle)
- Shared connection pool architecture

## Investigation Needed

We need to examine the MCP-Writing-Servers codebase:

### 1. Database Connection Configuration
**Files to check:**
- `src/database/DatabaseManager.ts` or similar
- Connection pool initialization code
- Environment variables for pool sizing

**Questions:**
- What's the default pool size per server?
- Are pools configurable via environment variables?
- Is there connection timeout/recycling logic?

### 2. Server Startup Logic
**Files to check:**
- Main entry point (probably `src/index.ts` or `src/server.ts`)
- Server orchestration code

**Questions:**
- How many servers are being started?
- Can we selectively disable servers we don't need?
- Is there a way to run only essential servers?

### 3. Connection Pool Strategy
**Code to examine:**
- Pool initialization parameters
- Min/max connection settings
- Idle timeout settings
- Connection release logic

## Proposed Real Solutions

### Solution 1: Centralized Connection Pool (Best)

**Create a single shared connection pool** that all MCP servers use:

```typescript
// Singleton pool manager
class SharedDatabasePool {
  private static instance: Pool;

  static getPool(): Pool {
    if (!this.instance) {
      this.instance = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 50,  // Total for ALL servers
        min: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
    return this.instance;
  }
}

// Each server uses the shared pool
class BookPlanningServer {
  constructor() {
    this.pool = SharedDatabasePool.getPool();
  }
}
```

**Benefits:**
- Only 1 pool with 50 connections total (not 200+)
- Efficient resource sharing
- Automatic connection reuse

### Solution 2: Reduce Per-Server Pool Sizes

**Configure each server's pool** to use minimal connections:

```typescript
// Environment variable approach
const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '5'),  // Only 5 per server
  min: parseInt(process.env.DB_POOL_MIN || '1'),
  idleTimeoutMillis: 10000,  // Release idle connections after 10s
};
```

**With 10 servers × 5 connections = 50 total connections**

### Solution 3: Lazy Server Loading

**Only start servers that are actually needed:**

```typescript
// Instead of starting all servers on boot
const activeServers = process.env.ACTIVE_MCP_SERVERS?.split(',') || ['database-admin'];

if (activeServers.includes('book-planning')) {
  startBookPlanningServer();
}
// etc.
```

**Benefits:**
- Fewer servers = fewer connections
- User can control which servers run
- Faster startup

### Solution 4: Dynamic Connection Scaling

**Implement smart pool sizing:**

```typescript
const poolConfig = {
  max: 10,  // Max per server
  min: 1,   // Start with just 1
  idleTimeoutMillis: 30000,  // Release idle connections
  evictionRunIntervalMillis: 10000,  // Check every 10s
};
```

**Benefits:**
- Pools start small
- Scale up under load
- Shrink back down when idle

## Immediate Diagnostic Steps

### Step 1: Count Active Connections
```bash
docker exec writing-pgbouncer psql -p 6432 -U writer -d pgbouncer -c "SHOW CLIENTS;" | wc -l
```

### Step 2: Check Pool Configuration
```bash
docker exec mcp-writing-servers cat /app/src/database/config.ts
# or wherever connection pool is configured
```

### Step 3: List Running Servers
```bash
docker logs mcp-writing-servers 2>&1 | grep "HTTP server running"
```

### Step 4: Check Pool Sizes per Server
```bash
docker logs mcp-writing-servers 2>&1 | grep -i "pool.*size\|connection.*pool"
```

## Recommended Fix Priority

1. **Immediate**: Add connection pool configuration via environment variables
   - Add `DB_POOL_MAX_PER_SERVER` (default: 3-5)
   - Add `DB_POOL_IDLE_TIMEOUT` (default: 10000ms)

2. **Short-term**: Implement centralized connection pool
   - Refactor to shared pool architecture
   - Remove per-server pools

3. **Long-term**: Implement dynamic server loading
   - Only start servers when needed
   - Add server lifecycle management

## Files to Modify

### In MCP-Electron-App:
- `src/main/mcp-system.ts` - Add pool size env vars
- `docker-compose.yml` - Pass pool config to container
- `.env` - Add DB_POOL_MAX_PER_SERVER setting

### In MCP-Writing-Servers (external repo):
- `src/database/DatabaseManager.ts` - Implement shared pool
- `src/index.ts` - Add lazy server loading
- `src/config.ts` - Add pool size configuration

## Conclusion

**Increasing limits from 200 to 500 is NOT the solution.** It just delays the inevitable and wastes resources.

The real issue is **architectural**: too many servers each maintaining large connection pools without coordination.

We need to:
1. Understand the current connection usage pattern
2. Implement proper connection pooling
3. Make pool sizes configurable
4. Consider server-on-demand architecture

---

**Status**: Investigation in progress
**Priority**: High - System design flaw, not capacity issue
**Next Steps**: Examine MCP-Writing-Servers database connection code
