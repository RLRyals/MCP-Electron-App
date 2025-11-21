# Database Tab Fix - PgBouncer Connection Pool Exhausted

## Issue
The database tab shows error: `Request failed with status code 404` when calling `db_list_tables`.

## Root Cause (UPDATED)
**PgBouncer connection pool exhaustion!** The database admin server cannot connect to the database because PgBouncer has reached its `max_client_conn` limit of 200.

Error from logs:
```
[DATABASE-ADMIN-SERVER] Database health check failed: no more connections allowed (max_client_conn)
```

This occurs when too many MCP servers are running simultaneously and each maintains database connections through PgBouncer.

## Diagnostic Steps

### 1. Check if Docker containers are running
```bash
docker ps --filter "name=mcp-writing-servers"
```

Expected output should show the `mcp-writing-servers` container running with port 3010 mapped.

### 2. Check if port 3010 is listening
```bash
netstat -tuln | grep 3010
# or
lsof -i :3010
```

### 3. Check container logs
```bash
docker logs mcp-writing-servers
```

Look for any errors related to the database admin server starting on port 3010.

## The Fix (Applied in PR)

The following changes have been made to fix this issue:

### 1. Increased PgBouncer Connection Limits
**File:** `src/main/pgbouncer-config.ts`

- `max_client_conn`: 200 → **500** (total client connections)
- `default_pool_size`: 25 → **50** (connections per database pool)
- `reserve_pool_size`: 10 → **20** (emergency reserve)

### 2. Increased PostgreSQL Max Connections
**File:** `docker-compose.yml`

- PostgreSQL `max_connections`: 200 → **300**

These changes allow more MCP servers to run simultaneously without exhausting the connection pool.

## How to Apply the Fix

### Step 1: Stop the MCP System
```bash
# From the app: Dashboard → Stop System
# Or via command line:
docker-compose down
```

### Step 2: Update Your Code
```bash
git checkout claude/fix-database-tab-019dvCgsyYFiMfeZ9LZmmGeu
git pull
```

### Step 3: Regenerate PgBouncer Configuration
The app needs to regenerate `pgbouncer.ini` with the new settings:

1. Open the MCP Electron App
2. Go to **Dashboard**
3. The app will automatically regenerate pgbouncer.ini when you start the system

Or manually regenerate by:
- Stop the system (if running)
- Restart the app
- The config files are regenerated on system start

### Step 4: Restart the System
```bash
# From the app: Dashboard → Start System
# Or via command line:
docker-compose up -d
```

### Step 5: Verify the Fix
1. Wait for all containers to be healthy
2. Open the **Database** tab
3. Click **"Refresh Connection"**
4. Status should show "Connected to MCP Database Server"
5. Click **"List Tables"** - should work without errors

## Verification Commands

### Check PgBouncer Status
```bash
docker exec writing-pgbouncer psql -p 6432 -U writer -d pgbouncer -c "SHOW POOLS;"
```

### Check Active Connections
```bash
docker exec writing-pgbouncer psql -p 6432 -U writer -d pgbouncer -c "SHOW CLIENTS;"
```

### Check Database Admin Server Logs
```bash
docker logs mcp-writing-servers 2>&1 | grep -A 5 "database-admin-server"
```

You should see:
```
[database-admin-server] HTTP server running on port 3000
[DATABASE-ADMIN-SERVER] Initialized with 25 tools
```

WITHOUT the error:
```
[DATABASE-ADMIN-SERVER] Database health check failed: no more connections allowed
```

## Previous Solutions (For Reference)

### Solution 1: Start the MCP System
If the containers aren't running:

1. Open the FictionLab/MCP Electron App
2. Go to the Dashboard tab
3. Click "Start System" button
4. Wait for all services to start (especially `mcp-writing-servers`)
5. Once started, try the Database tab again

### Solution 2: Restart the MCP Writing Servers container
If the container is running but port 3010 isn't accessible:

```bash
docker restart mcp-writing-servers
docker logs -f mcp-writing-servers
```

Watch the logs to see if the database admin server starts successfully on port 3010.

### Solution 3: Check Environment Configuration
The database admin port is configured in your `.env` file:

1. Open the app
2. Go to Settings → Environment Configuration
3. Verify `DB_ADMIN_PORT` is set to `3010`
4. If you changed it, restart the system

### Solution 4: Rebuild the Container
If the container is missing the database admin server:

```bash
# Stop the system
docker-compose down

# Rebuild the mcp-writing-servers container
docker-compose build mcp-writing-servers

# Start the system
docker-compose up -d
```

### Solution 5: Check MCP-Writing-Servers Repository
The database admin server code should be in the MCP-Writing-Servers repository:

```bash
# Navigate to the repository
cd ~/.config/MCP\ Electron\ App/repositories/mcp-writing-servers/

# Check if database admin server files exist
ls -la src/ | grep -i "database\|admin"

# Pull latest changes
git pull origin main
```

## Verification

After applying a solution, verify the fix:

1. **Check port 3010 is listening:**
   ```bash
   curl -X POST http://localhost:3010 \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"db_list_tables","arguments":{}},"id":1}'
   ```

2. **Test in the app:**
   - Open the Database tab
   - Click "Refresh Connection"
   - Status should show "Connected to MCP Database Server"
   - Click "List Tables" to verify functionality

## Technical Details

### Expected Endpoint
- **URL:** `http://localhost:3010`
- **Protocol:** JSON-RPC 2.0 over HTTP
- **Method:** POST
- **Content-Type:** application/json

### Expected Request Format
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "db_list_tables",
    "arguments": {}
  },
  "id": 1
}
```

### Code References
- Database admin client: `src/main/database-admin.ts:70-171`
- Database service: `src/renderer/services/databaseService.ts`
- Database tab: `src/renderer/components/DatabaseTab.ts:382-400`
- Docker compose: `docker-compose.yml:83-106`

## Related Issues

If you're also seeing SSE/HTTP errors, see:
- `docs/TROUBLESHOOTING_404_ERRORS.md`

## Still Not Working?

1. **Check all container logs:**
   ```bash
   docker-compose logs
   ```

2. **Check Docker network:**
   ```bash
   docker network ls
   docker network inspect mcp-network
   ```

3. **Restart Docker Desktop completely:**
   - Quit Docker Desktop
   - Wait 30 seconds
   - Start Docker Desktop
   - Wait for it to be fully running
   - Start the MCP system again

---

**Last Updated:** 2025-11-20
**Related Files:** database-admin.ts, DatabaseTab.ts, docker-compose.yml
