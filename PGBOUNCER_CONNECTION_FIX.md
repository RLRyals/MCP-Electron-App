# PgBouncer Connection Pool Exhausted - Quick Fix

## Issue
Database operations failing with error:
```
"no more connections allowed (max_client_conn)"
```

## Root Cause
PgBouncer connection pool has reached its limit (`max_client_conn`). Too many MCP servers or database connections are active.

## Quick Fix

### Option 1: Restart the MCP System (Recommended)

1. **Stop the system**:
   - In FictionLab app: Go to **Dashboard** → Click **"Stop System"**
   - Or via command line: `docker-compose down`

2. **Wait 10 seconds**

3. **Start the system**:
   - In FictionLab app: Go to **Dashboard** → Click **"Start System"**
   - Or via command line: `docker-compose up -d`

4. **Wait for all containers to be healthy** (check Dashboard)

5. **Try Database tab again**

### Option 2: Restart Just PgBouncer

```bash
docker restart writing-pgbouncer
```

Wait 5 seconds, then try again.

### Option 3: Increase Connection Limits (Permanent Fix)

If this keeps happening, the connection pool limits need to be increased. This was already done in previous fixes, but you may need to regenerate the config.

The fix increases:
- `max_client_conn`: 200 → 500
- `default_pool_size`: 25 → 50
- `reserve_pool_size`: 10 → 20

See [DATABASE_TAB_FIX.md](DATABASE_TAB_FIX.md) for details.

## Why This Happens

PgBouncer manages database connections for all MCP servers. When multiple MCP servers are running or making many queries, the connection pool can get exhausted.

Common causes:
- Too many MCP servers running simultaneously
- MCP servers not releasing connections properly
- Many concurrent database operations
- System has been running for a long time without restart

## Prevention

1. **Restart the system periodically** - Clears stale connections
2. **Stop unused MCP servers** - Frees up connection slots
3. **Don't run too many operations at once** - Give system time to release connections

## Verification

After restarting, test with:

```bash
curl -X POST http://localhost:3010/api/tool-call \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"db_list_tables","arguments":{}},"id":1}'
```

Should return success with table list, not connection error.

## In the FictionLab App

When this happens:
1. You'll see **0 tables** in the database tab
2. Activity log shows "Failed to list tables"
3. Console shows connection error

**Solution**: Just restart the system from the Dashboard!

---

**Quick Summary**: Restart the MCP system from Dashboard → Stop System → Start System
