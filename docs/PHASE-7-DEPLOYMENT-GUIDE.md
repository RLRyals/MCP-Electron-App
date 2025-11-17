# Phase 7: Integration, Deployment & Production Rollout

## Overview

This document provides comprehensive guidance for Phase 7 of the database-admin-server implementation: Integration, Deployment, and Production Rollout. This phase focuses on integrating the database-admin-server into the MCP Writing System ecosystem, deploying to production, and establishing monitoring infrastructure.

**Reference Issue**: [#40 - Phase 7: Integration, Deployment & Production Rollout](https://github.com/RLRyals/MCP-Writing-Servers/issues/40)

**Prerequisites**:
- ✅ Phase 1: Core CRUD Operations (completed)
- ✅ Phase 2: Batch Operations (completed)
- ✅ Phase 3: Schema Introspection (completed)
- ✅ Phase 4: Security & Audit (completed)
- ✅ Phase 5: Backup & Restore (completed)
- ✅ Phase 6: Testing & Documentation (completed)

---

## Table of Contents

1. [MCP Integration](#mcp-integration)
2. [Docker Deployment](#docker-deployment)
3. [Production Deployment](#production-deployment)
4. [Monitoring & Observability](#monitoring--observability)
5. [Performance Optimization](#performance-optimization)
6. [Security Hardening](#security-hardening)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)

---

## MCP Integration

### Server Registration

The database-admin-server runs on **port 3010** and integrates with the existing MCP ecosystem.

#### 1. Update MCP Orchestrator

Add the database-admin-server to the MCP orchestrator configuration:

**File**: `mcp-writing-servers/server.js`

```javascript
// Import database-admin-server
const DatabaseAdminServer = require('./src/mcps/database-admin-server');

// Server configuration
const servers = [
  { port: 3001, name: 'book-planning-server', server: BookPlanningServer },
  { port: 3002, name: 'series-planning-server', server: SeriesPlanningServer },
  { port: 3003, name: 'chapter-planning-server', server: ChapterPlanningServer },
  { port: 3004, name: 'character-planning-server', server: CharacterPlanningServer },
  { port: 3005, name: 'scene-server', server: SceneServer },
  { port: 3006, name: 'core-continuity-server', server: CoreContinuityServer },
  { port: 3007, name: 'review-server', server: ReviewServer },
  { port: 3008, name: 'reporting-server', server: ReportingServer },
  { port: 3009, name: 'author-server', server: AuthorServer },
  { port: 3010, name: 'database-admin-server', server: DatabaseAdminServer }, // NEW
];

// Start all servers
servers.forEach(({ port, name, server }) => {
  server.listen(port, () => {
    console.log(`✓ ${name} running on port ${port}`);
  });
});
```

#### 2. Update Docker Configuration

Add database-admin-server to the Dockerfile exposure list:

**File**: `mcp-writing-servers/Dockerfile`

```dockerfile
# Expose ports for all MCP servers (including database-admin-server on 3010)
EXPOSE 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010
```

#### 3. Environment Variables

Add database-admin-server configuration to your `.env` file:

```bash
# Database Admin Server Configuration
DB_ADMIN_PORT=3010
DB_ADMIN_MAX_BATCH_SIZE=1000
DB_ADMIN_RATE_LIMIT=100  # requests per minute

# Backup Configuration
BACKUP_DIR=/var/backups/mcp-writing-db
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE_ENABLED=true
BACKUP_CRON_SCHEDULE="0 2 * * *"  # Daily at 2 AM

# Security
DB_ADMIN_RESTRICTED_TABLES=users,auth_tokens,system_config,audit_logs
DB_ADMIN_AUDIT_LOG_ENABLED=true
```

#### 4. Health Check Endpoint

The database-admin-server exposes a health check endpoint at `/health`:

```bash
curl http://localhost:3010/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-17T10:30:00Z",
  "database": {
    "connected": true,
    "poolSize": 20,
    "activeConnections": 3
  },
  "backupDirectory": {
    "path": "/var/backups",
    "diskSpaceAvailable": "45.2 GB",
    "diskSpaceUsed": "4.8 GB"
  },
  "version": "1.0.0"
}
```

### HTTP/SSE Server Integration

For TypingMind integration, the database-admin-server provides HTTP/SSE endpoints:

**File**: `mcp-writing-servers/src/http-sse-server.js`

```javascript
const express = require('express');
const app = express();

// Database Admin Server routes
app.post('/api/db/query', async (req, res) => {
  try {
    const result = await DatabaseAdminServer.queryRecords(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/db/insert', async (req, res) => {
  try {
    const result = await DatabaseAdminServer.insertRecord(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add routes for update, delete, batch operations, schema introspection
// ... (see full implementation in database-admin-server)
```

### Claude Desktop Integration

For Claude Desktop, the database-admin-server works via stdio protocol.

**Update**: `~/.config/claude/claude_desktop_config.json` (macOS/Linux) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "database-admin": {
      "command": "docker",
      "args": [
        "exec",
        "-i",
        "mcp-writing-servers",
        "node",
        "src/mcps/database-admin-server/index.js",
        "--stdio"
      ]
    }
  }
}
```

**Verify Integration**:
```bash
# Test that Claude Desktop can discover the tools
docker exec -i mcp-writing-servers node src/mcps/database-admin-server/index.js --stdio <<EOF
{"jsonrpc": "2.0", "method": "tools/list", "id": 1}
EOF
```

---

## Docker Deployment

### Docker Compose Configuration

Update `docker-compose.yml` to include database-admin-server configuration:

```yaml
services:
  # PostgreSQL Database
  postgres:
    image: postgres:16
    container_name: writing-postgres
    network_mode: host
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ${MCP_WRITING_SERVERS_DIR}/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # PgBouncer Connection Pooling
  pgbouncer:
    image: edoburu/pgbouncer:latest
    container_name: writing-pgbouncer
    network_mode: host
    volumes:
      - ./pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro
      - ./userlist.txt:/etc/pgbouncer/userlist.txt:ro
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  # MCP Writing Servers (including database-admin-server)
  mcp-writing-servers:
    build:
      context: ${MCP_WRITING_SERVERS_DIR}
      dockerfile: Dockerfile
    container_name: mcp-writing-servers
    network_mode: host
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:6432/${POSTGRES_DB}
      DB_ADMIN_PORT: 3010
      BACKUP_DIR: /var/backups
      BACKUP_RETENTION_DAYS: 30
      DB_ADMIN_AUDIT_LOG_ENABLED: "true"
      NODE_ENV: production
    volumes:
      - backup_data:/var/backups
    depends_on:
      postgres:
        condition: service_healthy
    stdin_open: true
    tty: true
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "sh", "-c", "wget --quiet --tries=1 --spider http://localhost:3010/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  mcp_workspace:
  backup_data:  # NEW: For database backups
```

### Building the Docker Image

```bash
# Navigate to MCP-Writing-Servers directory
cd $MCP_WRITING_SERVERS_DIR

# Build the Docker image
docker build -t mcp-writing-servers:latest .

# Verify the image
docker images | grep mcp-writing-servers
```

### Starting Services

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f mcp-writing-servers

# Check database-admin-server health
curl http://localhost:3010/health
```

---

## Production Deployment

### Pre-Deployment Checklist

Before deploying to production, complete this checklist:

#### Staging Environment Testing
- [ ] Deploy to staging environment
- [ ] Run full test suite in staging
- [ ] Perform load testing (see Performance Optimization section)
- [ ] Conduct security audit
- [ ] Verify all tools are discoverable
- [ ] Test backup and restore procedures
- [ ] Validate monitoring and alerting

#### Production Preparation
- [ ] Create deployment checklist (see below)
- [ ] Schedule maintenance window
- [ ] Notify stakeholders of deployment
- [ ] Create database backup
- [ ] Review and test rollback procedure
- [ ] Prepare incident response plan

#### Environment Configuration
- [ ] Secure all environment variables
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up log rotation
- [ ] Configure backup storage
- [ ] Test disaster recovery

### Deployment Steps

#### 1. Backup Current Production State

```bash
# Create full database backup
docker exec writing-postgres pg_dump -U writer mcp_writing_db > backup_pre_deployment_$(date +%Y%m%d_%H%M%S).sql

# Backup current Docker containers
docker commit mcp-writing-servers mcp-writing-servers:backup-$(date +%Y%m%d_%H%M%S)

# Save environment configuration
cp .env .env.backup-$(date +%Y%m%d_%H%M%S)
```

#### 2. Deploy Database-Admin-Server

```bash
# Pull latest code
cd $MCP_WRITING_SERVERS_DIR
git pull origin main

# Install dependencies
npm install --production

# Run database migrations (if any)
npm run migrate:up

# Build Docker image
docker-compose build mcp-writing-servers

# Stop existing containers
docker-compose stop mcp-writing-servers

# Start updated containers
docker-compose up -d mcp-writing-servers

# Wait for health check
sleep 30
curl http://localhost:3010/health
```

#### 3. Verify Deployment

```bash
# Check all MCP servers are running
for port in 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010; do
  echo "Checking port $port..."
  curl -s http://localhost:$port/health || echo "Port $port not responding"
done

# Test database connectivity
docker exec -i mcp-writing-servers node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection failed:', err);
      process.exit(1);
    }
    console.log('Database connected:', res.rows[0]);
    pool.end();
  });
"

# Verify backup directory
docker exec mcp-writing-servers ls -lah /var/backups
```

#### 4. Monitor Initial Performance

```bash
# Monitor logs for errors
docker-compose logs -f --tail=100 mcp-writing-servers

# Check resource usage
docker stats mcp-writing-servers

# Monitor database connections
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "SELECT count(*) FROM pg_stat_activity;"
```

### Post-Deployment Monitoring

Monitor these metrics for the first 48 hours:

- **Error Rate**: Should be < 1%
- **Response Time**: P95 latency < 100ms
- **Database Connections**: Should be within pool limits
- **Backup Success Rate**: 100%
- **Disk Space**: > 10% available

---

## Monitoring & Observability

For comprehensive monitoring setup, see [MONITORING-OBSERVABILITY-GUIDE.md](./MONITORING-OBSERVABILITY-GUIDE.md).

### Quick Reference

#### Health Checks

```bash
# Database Admin Server
curl http://localhost:3010/health

# PostgreSQL
docker exec writing-postgres pg_isready -U writer -d mcp_writing_db

# PgBouncer
docker exec writing-pgbouncer psql -U writer -h localhost -p 6432 -d mcp_writing_db -c "SHOW POOLS;"
```

#### Log Locations

- **Container Logs**: `docker-compose logs mcp-writing-servers`
- **Application Logs**: `/app/logs/` (inside container)
- **Audit Logs**: PostgreSQL `audit_logs` table
- **Backup Logs**: `/var/backups/logs/` (inside container)

#### Key Metrics

```bash
# Request count by operation
curl http://localhost:3010/metrics | grep request_count

# Response time percentiles
curl http://localhost:3010/metrics | grep response_time

# Database query duration
curl http://localhost:3010/metrics | grep query_duration

# Connection pool utilization
curl http://localhost:3010/metrics | grep pool_utilization
```

---

## Performance Optimization

### Database Optimization

#### 1. Create Necessary Indexes

```sql
-- Index for audit logs (frequently queried by timestamp)
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Index for audit logs (queried by operation and table)
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation_table ON audit_logs(operation, table_name);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
```

#### 2. Connection Pooling Configuration

**File**: `pgbouncer.ini`

```ini
[databases]
mcp_writing_db = host=localhost port=5432 dbname=mcp_writing_db

[pgbouncer]
pool_mode = transaction
max_client_conn = 200
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
max_db_connections = 30
max_user_connections = 30

# Connection limits
server_idle_timeout = 600
server_lifetime = 3600
server_connect_timeout = 15

# Performance tuning
query_timeout = 0
query_wait_timeout = 120
```

#### 3. PostgreSQL Tuning

**File**: `postgresql.conf` (via Docker command)

```bash
# Update docker-compose.yml postgres service
postgres:
  command: >
    postgres
    -c max_connections=200
    -c shared_buffers=512MB
    -c effective_cache_size=2GB
    -c maintenance_work_mem=128MB
    -c checkpoint_completion_target=0.9
    -c wal_buffers=16MB
    -c default_statistics_target=100
    -c random_page_cost=1.1
    -c effective_io_concurrency=200
    -c work_mem=10MB
    -c min_wal_size=1GB
    -c max_wal_size=4GB
```

### Application Optimization

#### 1. Enable Schema Caching

Cache schema information to reduce database queries:

```javascript
// src/mcps/database-admin-server/schema-cache.js
const NodeCache = require('node-cache');
const schemaCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL

async function getTableSchema(tableName) {
  const cacheKey = `schema:${tableName}`;

  // Check cache first
  let schema = schemaCache.get(cacheKey);
  if (schema) {
    return schema;
  }

  // Fetch from database
  schema = await fetchSchemaFromDB(tableName);

  // Store in cache
  schemaCache.set(cacheKey, schema);

  return schema;
}
```

#### 2. Optimize Batch Operations

Use PostgreSQL's `COPY` command for bulk inserts:

```javascript
async function batchInsertOptimized(table, records) {
  const copyQuery = format('COPY %I (%s) FROM STDIN WITH CSV', table, columns.join(','));
  const stream = client.query(copyQuery);

  records.forEach(record => {
    stream.write(recordToCsvRow(record));
  });

  stream.end();
}
```

### Load Testing

#### Test Configuration

```bash
# Install load testing tool
npm install -g autocannon

# Test query endpoint
autocannon -c 100 -d 60 -p 10 \
  -m POST \
  -H "Content-Type: application/json" \
  -b '{"table":"books","limit":50}' \
  http://localhost:3010/api/db/query

# Test insert endpoint
autocannon -c 50 -d 30 -p 10 \
  -m POST \
  -H "Content-Type: application/json" \
  -b '{"table":"test_data","data":{"name":"test","value":123}}' \
  http://localhost:3010/api/db/insert
```

#### Performance Targets

- **Query Operations**: P95 < 50ms, P99 < 100ms
- **Insert Operations**: P95 < 75ms, P99 < 150ms
- **Batch Operations (1000 records)**: < 5 seconds
- **Throughput**: > 100 requests/second per operation
- **Error Rate**: < 0.1%

---

## Security Hardening

### Production Security Checklist

- [ ] **Disable Debug Logging**: Set `NODE_ENV=production`
- [ ] **Secure Environment Variables**: Use secrets management
- [ ] **Enable HTTPS/TLS**: Configure reverse proxy
- [ ] **Implement API Authentication**: Add JWT or API key validation
- [ ] **Rotate Database Credentials**: Schedule regular rotation
- [ ] **Configure Firewall Rules**: Restrict port access
- [ ] **Network Segmentation**: Isolate database network
- [ ] **Enable Audit Logging**: Track all operations
- [ ] **Regular Security Scans**: Schedule weekly scans
- [ ] **Update Dependencies**: Monitor for vulnerabilities

### Security Scanning

```bash
# Scan npm dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Scan Docker image
docker scan mcp-writing-servers:latest

# Static code analysis
npm install -g eslint-plugin-security
eslint --plugin security src/
```

### Credential Rotation

```bash
# Generate new database password
NEW_PASSWORD=$(openssl rand -base64 32)

# Update PostgreSQL
docker exec writing-postgres psql -U postgres -c "ALTER USER writer PASSWORD '$NEW_PASSWORD';"

# Update .env file
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW_PASSWORD/" .env

# Restart services
docker-compose restart mcp-writing-servers pgbouncer
```

---

## Rollback Procedures

### Rollback Triggers

Initiate rollback if any of the following occur:

- Critical security vulnerability discovered
- Data corruption detected
- Error rate > 10%
- Performance degradation > 50%
- Database connection failures
- Backup system failures

### Rollback Steps

#### 1. Immediate Rollback

```bash
# Stop new deployment
docker-compose stop mcp-writing-servers

# Restore previous container
docker tag mcp-writing-servers:backup-20251117_100000 mcp-writing-servers:latest
docker-compose up -d mcp-writing-servers

# Verify services
curl http://localhost:3010/health
```

#### 2. Database Rollback (if needed)

```bash
# Restore database backup
docker exec -i writing-postgres psql -U writer -d mcp_writing_db < backup_pre_deployment_20251117_100000.sql

# Verify data integrity
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "SELECT COUNT(*) FROM books;"
```

#### 3. Configuration Rollback

```bash
# Restore environment configuration
cp .env.backup-20251117_100000 .env

# Restart services
docker-compose restart
```

#### 4. Post-Rollback Verification

```bash
# Check all services
docker-compose ps

# Verify all MCP servers
for port in 3001 3002 3003 3004 3005 3006 3007 3008 3009; do
  echo "Port $port: $(curl -s http://localhost:$port/health | jq -r .status)"
done

# Monitor logs
docker-compose logs -f --tail=100
```

---

## Troubleshooting

### Common Issues

#### Issue: Database Admin Server Not Starting

**Symptoms**:
- Port 3010 not responding
- Health check failing
- Container logs show errors

**Diagnosis**:
```bash
# Check container status
docker ps | grep mcp-writing-servers

# View logs
docker-compose logs mcp-writing-servers

# Check port availability
netstat -tuln | grep 3010
```

**Solutions**:
```bash
# Restart container
docker-compose restart mcp-writing-servers

# Check environment variables
docker exec mcp-writing-servers env | grep DB_ADMIN

# Verify database connectivity
docker exec mcp-writing-servers node -e "require('pg').Pool({ connectionString: process.env.DATABASE_URL }).query('SELECT 1')"
```

#### Issue: High Latency / Slow Queries

**Symptoms**:
- P95 latency > 200ms
- Timeout errors
- Slow response times

**Diagnosis**:
```bash
# Check database query performance
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check connection pool
docker exec writing-pgbouncer psql -U writer -h localhost -p 6432 -d mcp_writing_db -c "SHOW POOLS;"

# Check system resources
docker stats mcp-writing-servers
```

**Solutions**:
```bash
# Add missing indexes (see Performance Optimization)
# Increase connection pool size
# Optimize slow queries
# Scale horizontally if needed
```

#### Issue: Backup Failures

**Symptoms**:
- Backup directory not accessible
- Disk space errors
- Permission denied errors

**Diagnosis**:
```bash
# Check backup directory
docker exec mcp-writing-servers ls -lah /var/backups

# Check disk space
docker exec mcp-writing-servers df -h /var/backups

# Check permissions
docker exec mcp-writing-servers whoami
docker exec mcp-writing-servers ls -l /var/backups
```

**Solutions**:
```bash
# Fix permissions
docker exec -u root mcp-writing-servers chown -R nodejs:nodejs /var/backups

# Clean old backups
docker exec mcp-writing-servers find /var/backups -type f -mtime +30 -delete

# Increase disk space (add volume or expand existing)
```

### Support & Resources

- **Documentation**: [DATABASE-CRUD-SPECIFICATION.md](./DATABASE-CRUD-SPECIFICATION.md)
- **Issue Tracker**: https://github.com/RLRyals/MCP-Writing-Servers/issues
- **Monitoring Guide**: [MONITORING-OBSERVABILITY-GUIDE.md](./MONITORING-OBSERVABILITY-GUIDE.md)
- **CI/CD Guide**: [CI-CD-PIPELINE-GUIDE.md](./CI-CD-PIPELINE-GUIDE.md)

---

## Success Criteria

Deployment is successful when:

- ✅ Database-admin-server integrated with MCP ecosystem
- ✅ All tools accessible from AI clients (Claude Desktop, TypingMind)
- ✅ Successfully deployed to production
- ✅ Zero critical errors in first 48 hours
- ✅ Performance meets targets (P95 < 100ms)
- ✅ Monitoring and alerting operational
- ✅ Backups running successfully
- ✅ No regressions in existing MCP servers
- ✅ Documentation complete and accurate
- ✅ Positive user feedback

---

**Document Version**: 1.0
**Last Updated**: 2025-11-17
**Author**: FictionLab Team
**Status**: Active
