# Immediate Fix Plan - Connection Pool Exhaustion

## The Real Problem

**10 MCP servers × 20 connections each = 200 connections used while idle**

This is an architectural issue, not a capacity issue. Increasing limits won't solve it.

## Immediate Actions (This PR)

### ✅ Already Done (But Not the Real Fix)
- Increased PgBouncer max_client_conn: 200 → 500
- Increased PostgreSQL max_connections: 200 → 300
- **Status**: Band-aid applied, buys time

### 🔴 Still Needs to Be Done

## Real Fix #1: Add Connection Pool Configuration (MCP-Writing-Servers)

**Where**: MCP-Writing-Servers repository
**Priority**: HIGH
**Effort**: LOW

Add environment variables to control pool sizes per server:

```typescript
// In MCP-Writing-Servers/src/database/DatabaseManager.ts (or similar)

const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX_PER_SERVER || '3'),  // Only 3 per server!
  min: parseInt(process.env.DB_POOL_MIN || '1'),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '10000'),
  connectionTimeoutMillis: 2000,
};
```

### Benefits:
- 10 servers × 3 connections = **30 total connections** (vs 200!)
- Configurable without code changes
- Idle connections released after 10 seconds

### Required Changes in MCP-Electron-App:

**1. Update docker-compose.yml**
```yaml
mcp-writing-servers:
  environment:
    DATABASE_URL: postgresql://...
    DB_POOL_MAX_PER_SERVER: "3"
    DB_POOL_MIN: "1"
    DB_POOL_IDLE_TIMEOUT: "10000"
```

**2. Update src/main/mcp-system.ts**
```typescript
DB_POOL_MAX_PER_SERVER: '3',
DB_POOL_MIN: '1',
DB_POOL_IDLE_TIMEOUT: '10000',
```

### Impact:
```
Before: 10 servers × 20 connections = 200 connections ❌
After:  10 servers × 3 connections = 30 connections ✅

Reduction: 85% fewer connections!
```

## Real Fix #2: Shared Connection Pool (MCP-Writing-Servers)

**Where**: MCP-Writing-Servers repository
**Priority**: HIGH
**Effort**: MEDIUM

Create a single shared pool that all servers use:

```typescript
// MCP-Writing-Servers/src/database/SharedPool.ts

import { Pool } from 'pg';

class SharedDatabasePool {
  private static instance: Pool | null = null;

  static getPool(): Pool {
    if (!this.instance) {
      this.instance = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: parseInt(process.env.DB_POOL_MAX_TOTAL || '30'),
        min: parseInt(process.env.DB_POOL_MIN_TOTAL || '5'),
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 2000,
      });

      this.instance.on('error', (err) => {
        console.error('[SHARED-POOL] Unexpected error:', err);
      });

      console.log('[SHARED-POOL] Initialized with max:', this.instance.options.max);
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

### Update Each Server:

```typescript
// Instead of:
this.pool = new Pool({ ... });

// Use:
import SharedDatabasePool from './database/SharedPool';
this.pool = SharedDatabasePool.getPool();
```

### Benefits:
- **ONE pool for all 10 servers** (not 10 separate pools!)
- Automatic connection sharing
- Much more efficient resource usage
- Total: 30 connections for everything

## Real Fix #3: Lazy Server Loading (MCP-Electron-App + MCP-Writing-Servers)

**Where**: Both repositories
**Priority**: MEDIUM
**Effort**: MEDIUM

Only start servers that are actually needed:

### In MCP-Electron-App:

**Add to src/main/env-config.ts:**
```typescript
export interface EnvConfig {
  // ... existing fields
  ACTIVE_MCP_SERVERS?: string;  // Comma-separated list
}

export const DEFAULT_CONFIG: EnvConfig = {
  // ... existing defaults
  ACTIVE_MCP_SERVERS: 'database-admin,book-planning,author',  // Minimal set
};
```

**Add to docker-compose.yml:**
```yaml
mcp-writing-servers:
  environment:
    ACTIVE_MCP_SERVERS: "${ACTIVE_MCP_SERVERS:-database-admin,book-planning,author}"
```

### In MCP-Writing-Servers:

**Update server startup logic:**
```typescript
// src/index.ts or similar

const activeServers = (process.env.ACTIVE_MCP_SERVERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allServers = {
  'book-planning': () => startBookPlanningServer(),
  'series-planning': () => startSeriesPlanningServer(),
  'chapter-planning': () => startChapterPlanningServer(),
  'character-planning': () => startCharacterPlanningServer(),
  'scene': () => startSceneServer(),
  'core-continuity': () => startCoreContinuityServer(),
  'review': () => startReviewServer(),
  'reporting': () => startReportingServer(),
  'author': () => startAuthorServer(),
  'database-admin': () => startDatabaseAdminServer(),
};

// Start only requested servers
if (activeServers.length > 0) {
  console.log(`[STARTUP] Starting selected servers: ${activeServers.join(', ')}`);
  for (const serverName of activeServers) {
    if (allServers[serverName]) {
      allServers[serverName]();
    }
  }
} else {
  // Start all servers (backward compatible)
  console.log('[STARTUP] Starting all servers');
  Object.values(allServers).forEach(start => start());
}
```

### Benefits:
- User controls which servers run
- Fewer servers = fewer connections
- Faster startup time
- Lower memory usage

### Example Configurations:

**Minimal (just Database tab):**
```
ACTIVE_MCP_SERVERS=database-admin
```
- 1 server × 3 connections = **3 total connections**

**Author workflow:**
```
ACTIVE_MCP_SERVERS=database-admin,book-planning,chapter-planning,author
```
- 4 servers × 3 connections = **12 total connections**

**Full system:**
```
ACTIVE_MCP_SERVERS=database-admin,book-planning,series-planning,chapter-planning,character-planning,scene,core-continuity,review,reporting,author
```
- 10 servers × 3 connections = **30 total connections** (still way better than 200!)

## Implementation Priority

### Phase 1: Quick Win (This Week)
1. ✅ Revert limit increases (they're band-aids)
2. 🔴 Add DB_POOL_MAX_PER_SERVER env var support in MCP-Writing-Servers
3. 🔴 Set DB_POOL_MAX_PER_SERVER=3 in MCP-Electron-App docker-compose.yml

**Expected Result:** 85% reduction in idle connections

### Phase 2: Proper Architecture (Next Sprint)
1. Implement SharedDatabasePool in MCP-Writing-Servers
2. Update all servers to use shared pool
3. Test and deploy

**Expected Result:** 100% efficient connection usage

### Phase 3: User Control (Future)
1. Implement lazy server loading
2. Add UI in MCP-Electron-App to select active servers
3. Allow hot-reload of servers

**Expected Result:** Users only run what they need

## Testing Plan

### Test 1: Verify Connection Counts
```bash
# Check PgBouncer clients
docker exec writing-pgbouncer psql -p 6432 -U writer -d pgbouncer -c "SHOW CLIENTS;" | wc -l

# Should be ~30 with pool_max=3, not 200+
```

### Test 2: Verify All Servers Work
```bash
# Check database-admin-server can connect
docker logs mcp-writing-servers 2>&1 | grep "database-admin-server"

# Should NOT see: "no more connections allowed"
```

### Test 3: Verify Database Tab Works
1. Open MCP Electron App
2. Navigate to Database tab
3. Click "Refresh Connection" → Should show "Connected"
4. Click "List Tables" → Should show tables without errors

## Success Criteria

✅ Idle connection count < 50 (currently 200)
✅ Database tab works without errors
✅ All MCP servers can connect to database
✅ No "max_client_conn" errors in logs
✅ System remains stable under load

## Next Steps

1. Create issue in MCP-Writing-Servers repo for connection pool configuration
2. Create PR in MCP-Writing-Servers with DB_POOL_MAX_PER_SERVER support
3. Update MCP-Electron-App to pass pool config env vars
4. Test thoroughly
5. Deploy

---

**Status**: Analysis complete, implementation plan ready
**Owner**: Needs to be assigned
**Timeline**: Phase 1 can be done in 1-2 days
