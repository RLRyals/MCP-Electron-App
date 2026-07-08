# Linux Database Connection Fix Guide

## Problem
SASL authentication errors when using MCP tools in Typing Mind on Linux, preventing database queries from working.

**Error message:**
```
SASL authentication failed
authentication error connecting to the database
```

## Root Cause
The MCP servers cannot connect to the PostgreSQL database due to authentication or network configuration issues specific to Linux Docker setups.

## Quick Diagnostic

1. **Run the diagnostic script:**
   ```bash
   cd /path/to/fictionlab-app
   chmod +x linux-db-diagnostic.sh
   ./linux-db-diagnostic.sh
   ```

2. **Check if containers are running:**
   ```bash
   docker ps | grep fictionlab
   ```

   You should see:
   - `fictionlab-postgres`
   - `fictionlab-pgbouncer` (optional but recommended)
   - `fictionlab-mcp-servers`
   - `fictionlab-mcp-connector`

## Solutions (Try in Order)

### Solution 1: Restart All Services

This fixes most transient connection issues:

```bash
# Stop all containers
docker compose down

# Wait a few seconds
sleep 5

# Start services again from the FictionLab UI
# Or manually:
docker compose up -d
```

### Solution 2: Check Environment Variables

The MCP containers need PostgreSQL credentials:

```bash
# Check if .env file exists
cat ~/.config/fictionlab/.env

# Should contain:
# POSTGRES_DB=mcp_writing_db
# POSTGRES_USER=writer
# POSTGRES_PASSWORD=<your-password>
# POSTGRES_PORT=5432
```

If missing or incorrect:
1. Open FictionLab
2. Go to Setup Wizard → Environment Configuration
3. Reset to defaults or regenerate passwords
4. Restart the system

### Solution 3: Verify Docker Network

Check if containers can reach each other:

```bash
# Test from MCP container to PostgreSQL
docker exec fictionlab-mcp-servers ping -c 3 fictionlab-postgres

# Test database connection
docker exec fictionlab-mcp-servers sh -c 'psql -h fictionlab-postgres -U writer -d mcp_writing_db -c "SELECT 1;"'
# When prompted, enter the password from .env file
```

If ping fails:
```bash
# Recreate Docker network
docker compose down
docker network prune
docker compose up -d
```

### Solution 4: Check PostgreSQL Authentication Method

PostgreSQL might be configured with incorrect auth method:

```bash
# Check PostgreSQL logs
docker logs fictionlab-postgres | grep -i "auth\|sasl"

# Check pg_hba.conf inside container
docker exec fictionlab-postgres cat /var/lib/postgresql/data/pg_hba.conf
```

Should contain:
```
host all all all scram-sha-256
```

If it shows `md5` or other methods, you may need to recreate the database:

```bash
# CAUTION: This will delete all data!
docker compose down -v  # -v removes volumes
docker compose up -d
```

### Solution 5: Increase Connection Limits

If you have many MCP tools, PostgreSQL might run out of connections:

```bash
# Check current max_connections
docker exec fictionlab-postgres psql -U writer -d mcp_writing_db -c "SHOW max_connections;"

# Check current active connections
docker exec fictionlab-postgres psql -U writer -d mcp_writing_db -c "SELECT count(*) FROM pg_stat_activity;"
```

If close to the limit, modify `docker-compose.yml`:

```yaml
services:
  postgres:
    command: postgres -c max_connections=200
```

Then restart:
```bash
docker compose down
docker compose up -d
```

### Solution 6: Check PgBouncer Configuration

PgBouncer pools connections and might have issues:

```bash
# Check PgBouncer status
docker logs fictionlab-pgbouncer | tail -50

# Test connection through PgBouncer
docker exec fictionlab-mcp-servers sh -c 'psql -h fictionlab-pgbouncer -p 6432 -U writer -d mcp_writing_db -c "SELECT 1;"'
```

If PgBouncer is causing issues, you can bypass it temporarily:

1. Edit `docker-compose.yml`
2. Change MCP servers to connect directly to PostgreSQL:
   ```yaml
   environment:
     DB_HOST: fictionlab-postgres
     DB_PORT: 5432
   ```
3. Restart: `docker compose down && docker compose up -d`

### Solution 7: Workaround - Disable Problematic Tools

If only specific MCP tools fail (like websearch):

1. Edit the generated MCP config file:
   ```bash
   nano ~/.config/fictionlab/mcp-config/mcp-config.json
   ```

2. Comment out or remove the problematic server entry

3. Restart MCP Connector:
   ```bash
   docker restart fictionlab-mcp-connector
   ```

## Verification

After applying fixes, verify the connection works:

```bash
# 1. Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# 2. Test database connection from MCP container
docker exec fictionlab-mcp-servers node -e "
const { Client } = require('pg');
const client = new Client({
    host: 'fictionlab-postgres',
    port: 5432,
    database: 'mcp_writing_db',
    user: 'writer',
    password: process.env.POSTGRES_PASSWORD
});
client.connect()
    .then(() => console.log('✓ Connection successful'))
    .catch(err => console.error('✗ Connection failed:', err.message))
    .finally(() => client.end());
"

# 3. Try creating an author via MCP tool in Typing Mind
# Ask Claude/Gemini: "Add a test author named 'Test User'"
```

If successful, you should see the author created without SASL errors.

## Collecting Logs for Support

If none of the above works, collect diagnostic information:

```bash
# Run full diagnostic
./linux-db-diagnostic.sh > diagnostic-output.txt 2>&1

# Collect container logs
docker logs fictionlab-postgres > postgres.log 2>&1
docker logs fictionlab-pgbouncer > pgbouncer.log 2>&1
docker logs fictionlab-mcp-servers > mcp-servers.log 2>&1
docker logs fictionlab-mcp-connector > mcp-connector.log 2>&1

# Check system info
uname -a > system-info.txt
docker version >> system-info.txt
docker compose version >> system-info.txt

# Package everything
tar -czf fictionlab-diagnostic.tar.gz \
    diagnostic-output.txt \
    postgres.log \
    pgbouncer.log \
    mcp-servers.log \
    mcp-connector.log \
    system-info.txt
```

Then share `fictionlab-diagnostic.tar.gz` with support.

## Known Issues

### Issue: "Connection refused" on localhost
**Cause:** Docker containers can't use `localhost` to reach each other
**Solution:** Use container names (`fictionlab-postgres`) instead of `localhost`

### Issue: "Password authentication failed"
**Cause:** Environment variables not passed to containers
**Solution:** Verify docker-compose.yml has correct env_file or environment sections

### Issue: "Too many connections"
**Cause:** PostgreSQL connection limit reached
**Solution:** Increase max_connections or use PgBouncer connection pooling

### Issue: SASL only on Linux, works on Windows
**Cause:** Different Docker networking on Linux vs Windows
**Solution:** Use Docker container names instead of host.docker.internal

## Prevention

To avoid future issues:

1. **Use PgBouncer** - Enable connection pooling
2. **Monitor connections** - Set up alerts for high connection counts
3. **Regular restarts** - Restart containers weekly to clear any connection leaks
4. **Keep updated** - Update FictionLab and Docker regularly

## Additional Resources

- [PostgreSQL Authentication Methods](https://www.postgresql.org/docs/current/auth-methods.html)
- [PgBouncer Documentation](https://www.pgbouncer.org/config.html)
- [Docker Networking Guide](https://docs.docker.com/network/)
