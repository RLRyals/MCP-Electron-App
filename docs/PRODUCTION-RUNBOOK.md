# Production Runbook
## Database Admin Server - MCP Writing System

## Overview

This runbook provides step-by-step operational procedures for managing the database-admin-server in production. It covers common tasks, incident response, troubleshooting, and maintenance procedures.

**Target Audience**: DevOps engineers, SREs, on-call engineers

**Related Documents**:
- [Phase 7 Deployment Guide](./PHASE-7-DEPLOYMENT-GUIDE.md)
- [Monitoring & Observability Guide](./MONITORING-OBSERVABILITY-GUIDE.md)
- [CI/CD Pipeline Guide](./CI-CD-PIPELINE-GUIDE.md)

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Startup Procedures](#startup-procedures)
3. [Shutdown Procedures](#shutdown-procedures)
4. [Health Checks](#health-checks)
5. [Common Operations](#common-operations)
6. [Incident Response](#incident-response)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Maintenance Procedures](#maintenance-procedures)
9. [Backup & Restore](#backup--restore)
10. [Performance Tuning](#performance-tuning)
11. [Security Operations](#security-operations)

---

## Quick Reference

### Service Endpoints

| Service | Port | Health Check | Metrics |
|---------|------|--------------|---------|
| Database Admin Server | 3010 | `http://localhost:3010/health` | `http://localhost:3010/metrics` |
| PostgreSQL | 5432 | `pg_isready -U writer -d mcp_writing_db` | - |
| PgBouncer | 6432 | `psql -U writer -h localhost -p 6432 -d mcp_writing_db -c "SHOW POOLS;"` | - |

### Important File Locations

| Item | Location |
|------|----------|
| Application Logs | `/app/logs/combined.log` |
| Error Logs | `/app/logs/error.log` |
| Backup Directory | `/var/backups/` |
| Environment Config | `.env` |
| Docker Compose | `docker-compose.yml` |

### Key Commands

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f mcp-writing-servers

# Restart service
docker-compose restart mcp-writing-servers

# Health check
curl http://localhost:3010/health

# Metrics
curl http://localhost:3010/metrics
```

### Emergency Contacts

- **On-Call Engineer**: Refer to PagerDuty rotation
- **Database Team**: db-team@example.com
- **DevOps Lead**: devops-lead@example.com
- **Incident Slack**: #mcp-incidents

---

## Startup Procedures

### Standard Startup

**Prerequisites**:
- Docker and Docker Compose installed
- Environment variables configured in `.env`
- PostgreSQL database initialized

**Procedure**:

1. **Verify Prerequisites**

   ```bash
   # Check Docker is running
   docker info

   # Verify .env file exists
   ls -la .env

   # Check PostgreSQL is accessible
   docker exec writing-postgres pg_isready -U writer -d mcp_writing_db
   ```

2. **Start Services**

   ```bash
   # Navigate to project directory
   cd /opt/mcp-writing-servers

   # Pull latest images
   docker-compose pull

   # Start all services
   docker-compose up -d

   # Verify services started
   docker-compose ps
   ```

3. **Verify Health**

   ```bash
   # Wait for services to initialize (30-60 seconds)
   sleep 60

   # Check database-admin-server health
   curl http://localhost:3010/health

   # Check all MCP servers
   for port in 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010; do
     echo "Port $port: $(curl -s http://localhost:$port/health | jq -r .status)"
   done
   ```

4. **Monitor Initial Logs**

   ```bash
   # Monitor logs for errors
   docker-compose logs -f --tail=100 mcp-writing-servers

   # Press Ctrl+C to exit log viewing
   ```

5. **Verify Metrics Collection**

   ```bash
   # Check metrics endpoint
   curl http://localhost:3010/metrics | grep db_admin_request_count
   ```

**Expected Results**:
- All containers show status "Up"
- Health checks return `{"status": "healthy"}`
- No error messages in logs
- Metrics endpoint returns data

**Rollback on Failure**:
If startup fails, see [Incident Response](#incident-response) section.

---

## Shutdown Procedures

### Graceful Shutdown

**When to Use**: Planned maintenance, configuration changes, server migration

**Procedure**:

1. **Notify Stakeholders**

   ```bash
   # Post to Slack
   echo "Starting planned maintenance of database-admin-server at $(date)" | slack-cli -c #mcp-alerts
   ```

2. **Verify No Active Operations**

   ```bash
   # Check active database connections
   docker exec writing-postgres psql -U writer -d mcp_writing_db -c "
     SELECT COUNT(*) as active_connections
     FROM pg_stat_activity
     WHERE state = 'active';
   "

   # Should show minimal activity
   ```

3. **Graceful Stop**

   ```bash
   # Stop database-admin-server (allows in-flight requests to complete)
   docker-compose stop -t 30 mcp-writing-servers

   # Verify stopped
   docker-compose ps mcp-writing-servers
   ```

4. **Stop Dependent Services** (if doing full shutdown)

   ```bash
   # Stop all services
   docker-compose stop

   # Verify all stopped
   docker-compose ps
   ```

5. **Verify Clean Shutdown**

   ```bash
   # Check for any error messages in logs
   docker-compose logs --tail=50 mcp-writing-servers | grep -i error

   # Should show clean shutdown messages
   ```

**Expected Results**:
- No error messages in logs
- All containers stopped gracefully
- No orphaned connections in database

### Emergency Shutdown

**When to Use**: Security incident, critical bug discovered, data corruption detected

**Procedure**:

1. **Immediate Stop**

   ```bash
   # Force stop (does not wait for graceful shutdown)
   docker-compose kill mcp-writing-servers
   ```

2. **Verify Services Stopped**

   ```bash
   docker-compose ps
   netstat -tuln | grep 3010  # Should return nothing
   ```

3. **Document Reason**

   ```bash
   # Log incident
   echo "$(date): Emergency shutdown - Reason: [INCIDENT_DESCRIPTION]" >> /var/log/mcp-incidents.log
   ```

4. **Follow Incident Response Procedures**

   See [Incident Response](#incident-response) section.

---

## Health Checks

### Automated Health Checks

**Frequency**: Every 30 seconds (configured in docker-compose.yml)

**Check Script**: `/opt/mcp-writing-servers/scripts/health-check.sh`

```bash
#!/bin/bash
# Comprehensive health check script

set -e

echo "=== MCP Writing System Health Check ==="
echo "Timestamp: $(date)"
echo ""

# 1. Docker containers
echo "1. Checking Docker containers..."
docker-compose ps

# 2. PostgreSQL
echo -e "\n2. Checking PostgreSQL..."
docker exec writing-postgres pg_isready -U writer -d mcp_writing_db

# 3. PgBouncer
echo -e "\n3. Checking PgBouncer..."
docker exec writing-pgbouncer psql -U writer -h localhost -p 6432 -d mcp_writing_db -c "SHOW POOLS;" > /dev/null
echo "PgBouncer: OK"

# 4. Database Admin Server
echo -e "\n4. Checking Database Admin Server..."
HEALTH_STATUS=$(curl -s http://localhost:3010/health | jq -r .status)
if [ "$HEALTH_STATUS" != "healthy" ]; then
  echo "ERROR: Database Admin Server health check failed: $HEALTH_STATUS"
  exit 1
fi
echo "Database Admin Server: $HEALTH_STATUS"

# 5. All MCP Servers
echo -e "\n5. Checking all MCP servers..."
for port in 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010; do
  if curl -s -f http://localhost:$port/health > /dev/null; then
    echo "  Port $port: OK"
  else
    echo "  Port $port: FAILED"
    exit 1
  fi
done

# 6. Disk Space
echo -e "\n6. Checking disk space..."
DISK_USAGE=$(df -h /var/backups | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
  echo "WARNING: Disk space usage is ${DISK_USAGE}%"
  exit 1
fi
echo "Disk space: ${DISK_USAGE}% used"

echo -e "\n=== All health checks passed! ==="
```

### Manual Health Checks

Run these checks during troubleshooting:

```bash
# Quick health check
curl http://localhost:3010/health | jq

# Detailed health check
/opt/mcp-writing-servers/scripts/health-check.sh

# Check specific component
curl http://localhost:3010/health | jq '.database'
curl http://localhost:3010/health | jq '.backupDirectory'
```

---

## Common Operations

### Viewing Logs

```bash
# Real-time logs (all services)
docker-compose logs -f

# Real-time logs (database-admin-server only)
docker-compose logs -f mcp-writing-servers

# Last 100 lines
docker-compose logs --tail=100 mcp-writing-servers

# Logs from specific time
docker-compose logs --since="2025-11-17T10:00:00" mcp-writing-servers

# Error logs only
docker exec mcp-writing-servers tail -f /app/logs/error.log

# Filter logs by operation
docker exec mcp-writing-servers cat /app/logs/combined.log | jq 'select(.operation == "db_query_records")'

# Find slow operations (>100ms)
docker exec mcp-writing-servers cat /app/logs/combined.log | jq 'select(.duration > 100)'
```

### Restarting Services

```bash
# Restart database-admin-server
docker-compose restart mcp-writing-servers

# Restart with fresh pull
docker-compose pull mcp-writing-servers
docker-compose up -d mcp-writing-servers

# Restart all services
docker-compose restart

# Force recreate (use with caution)
docker-compose up -d --force-recreate mcp-writing-servers
```

### Checking Metrics

```bash
# Get all metrics
curl http://localhost:3010/metrics

# Request count
curl http://localhost:3010/metrics | grep db_admin_request_count

# Error count
curl http://localhost:3010/metrics | grep db_admin_errors_total

# Response times
curl http://localhost:3010/metrics | grep db_admin_request_duration_ms

# Connection pool status
curl http://localhost:3010/metrics | grep db_admin_pool
```

### Checking Database Connections

```bash
# Active connections
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "
  SELECT
    count(*) as connections,
    state,
    wait_event_type
  FROM pg_stat_activity
  GROUP BY state, wait_event_type;
"

# Connection pool status (PgBouncer)
docker exec writing-pgbouncer psql -U writer -h localhost -p 6432 -d mcp_writing_db -c "SHOW POOLS;"

# Long-running queries
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "
  SELECT
    pid,
    now() - query_start as duration,
    state,
    query
  FROM pg_stat_activity
  WHERE state != 'idle'
    AND query_start < now() - interval '5 minutes'
  ORDER BY query_start;
"
```

---

## Incident Response

### Incident Classification

#### Severity 1 (Critical)
- Service completely down
- Data corruption detected
- Security breach
- Error rate > 50%

**Response Time**: Immediate (< 5 minutes)
**Escalation**: Page on-call immediately

#### Severity 2 (High)
- Degraded performance (>200ms P95 latency)
- Error rate 10-50%
- Backup failures
- Disk space critical (>95%)

**Response Time**: < 15 minutes
**Escalation**: Notify on-call, escalate if not resolved in 30 minutes

#### Severity 3 (Medium)
- Intermittent errors
- Error rate 5-10%
- Warning alerts firing
- Disk space high (>85%)

**Response Time**: < 1 hour
**Escalation**: Notify team, resolve within business hours

### Incident Response Procedure

#### 1. Acknowledge and Assess

```bash
# Check service status
docker-compose ps

# Check health endpoint
curl http://localhost:3010/health | jq

# Check recent errors
docker-compose logs --tail=100 mcp-writing-servers | grep -i error

# Check metrics
curl http://localhost:3010/metrics | grep db_admin_errors_total
```

#### 2. Immediate Mitigation

**If service is down**:
```bash
# Try restart
docker-compose restart mcp-writing-servers

# If restart fails, check logs
docker-compose logs mcp-writing-servers

# If container won't start, check previous version
docker-compose down
docker tag mcp-writing-servers:previous mcp-writing-servers:latest
docker-compose up -d
```

**If high error rate**:
```bash
# Check database connectivity
docker exec writing-postgres pg_isready -U writer -d mcp_writing_db

# Check connection pool
docker exec writing-pgbouncer psql -U writer -h localhost -p 6432 -d mcp_writing_db -c "SHOW POOLS;"

# Restart connection pool if necessary
docker-compose restart pgbouncer
```

**If disk space critical**:
```bash
# Check disk usage
df -h /var/backups

# Clean old backups
docker exec mcp-writing-servers find /var/backups -type f -mtime +7 -delete

# Verify space freed
df -h /var/backups
```

#### 3. Root Cause Analysis

```bash
# Analyze logs for patterns
docker exec mcp-writing-servers cat /app/logs/error.log | jq -s 'group_by(.error.code) | map({code: .[0].error.code, count: length}) | sort_by(.count) | reverse'

# Check for slow queries
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"

# Check system resources
docker stats mcp-writing-servers --no-stream
```

#### 4. Document Incident

```bash
# Create incident report
cat > /var/log/incidents/incident-$(date +%Y%m%d-%H%M%S).md <<EOF
# Incident Report

**Date**: $(date)
**Severity**: [1/2/3]
**Status**: [Investigating/Mitigated/Resolved]

## Summary
[Brief description of the incident]

## Timeline
- $(date): Incident detected
- [Add timeline events]

## Impact
- Affected services: [list]
- Duration: [time]
- Errors: [count]

## Root Cause
[Description of root cause]

## Resolution
[Steps taken to resolve]

## Action Items
- [ ] [Action item 1]
- [ ] [Action item 2]
EOF
```

#### 5. Post-Incident Review

Schedule a post-incident review meeting within 48 hours to discuss:
- What went well
- What could be improved
- Action items to prevent recurrence

---

## Troubleshooting Guide

### Issue: High Latency / Slow Queries

**Symptoms**:
- P95 latency > 200ms
- Timeout errors
- Users reporting slow response

**Diagnosis**:
```bash
# Check current latency
curl http://localhost:3010/metrics | grep db_admin_request_duration_ms

# Find slow queries
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  WHERE mean_exec_time > 100
  ORDER BY mean_exec_time DESC
  LIMIT 20;
"

# Check connection pool
docker exec writing-pgbouncer psql -U writer -h localhost -p 6432 -d mcp_writing_db -c "SHOW POOLS;"

# Check system resources
docker stats mcp-writing-servers --no-stream
```

**Solutions**:
```bash
# 1. Add missing indexes (if identified)
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "
  CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
"

# 2. Increase connection pool size (if pool exhausted)
# Edit pgbouncer.ini, increase default_pool_size, then restart
docker-compose restart pgbouncer

# 3. Restart services to clear any stuck connections
docker-compose restart mcp-writing-servers

# 4. If persistent, check for database issues
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "VACUUM ANALYZE;"
```

### Issue: Database Connection Failures

**Symptoms**:
- "Cannot connect to database" errors
- Health check failing
- Zero active connections

**Diagnosis**:
```bash
# Check PostgreSQL status
docker exec writing-postgres pg_isready -U writer -d mcp_writing_db

# Check PgBouncer
docker exec writing-pgbouncer psql -U writer -h localhost -p 6432 -d mcp_writing_db -c "SHOW POOLS;"

# Check network connectivity
docker exec mcp-writing-servers ping -c 3 localhost

# Check credentials
docker exec mcp-writing-servers env | grep DATABASE_URL
```

**Solutions**:
```bash
# 1. Restart PgBouncer
docker-compose restart pgbouncer

# 2. Restart PostgreSQL (last resort)
docker-compose restart postgres

# 3. Check and fix configuration
cat .env | grep DB_

# 4. Verify database is initialized
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "\dt"
```

### Issue: Backup Failures

**Symptoms**:
- Backup metrics show failures
- Alert: "BackupFailure"
- Missing backup files

**Diagnosis**:
```bash
# Check backup directory
docker exec mcp-writing-servers ls -lah /var/backups

# Check disk space
docker exec mcp-writing-servers df -h /var/backups

# Check backup logs
docker exec mcp-writing-servers cat /var/backups/logs/backup.log

# Check permissions
docker exec mcp-writing-servers ls -ld /var/backups
```

**Solutions**:
```bash
# 1. Fix permissions
docker exec -u root mcp-writing-servers chown -R nodejs:nodejs /var/backups

# 2. Free disk space
docker exec mcp-writing-servers find /var/backups -type f -mtime +30 -delete

# 3. Manually trigger backup
docker exec mcp-writing-servers node src/mcps/database-admin-server/backup.js

# 4. Verify backup works
docker exec writing-postgres pg_dump -U writer mcp_writing_db | gzip > /tmp/manual-backup-$(date +%Y%m%d).sql.gz
```

### Issue: High Memory Usage

**Symptoms**:
- Container using > 90% of allocated memory
- OOM (Out of Memory) errors
- Slow performance

**Diagnosis**:
```bash
# Check container memory usage
docker stats mcp-writing-servers --no-stream

# Check Node.js heap usage
curl http://localhost:3010/metrics | grep memory

# Check for memory leaks
docker exec mcp-writing-servers node -e "console.log(process.memoryUsage())"
```

**Solutions**:
```bash
# 1. Increase memory limit in docker-compose.yml
# Add under mcp-writing-servers service:
#   deploy:
#     resources:
#       limits:
#         memory: 4G

# 2. Restart service to clear memory
docker-compose restart mcp-writing-servers

# 3. Check for large query results
# Review logs for large recordCount values
docker exec mcp-writing-servers cat /app/logs/combined.log | jq 'select(.recordCount > 1000)'

# 4. Implement pagination for large queries
# (Code change required)
```

---

## Maintenance Procedures

### Weekly Maintenance

**Every Monday at 02:00 AM**

```bash
#!/bin/bash
# Weekly maintenance script

# 1. Clean old logs
find /var/log/mcp-writing-servers -type f -mtime +14 -delete

# 2. Clean old backups
docker exec mcp-writing-servers find /var/backups -type f -mtime +30 -delete

# 3. Vacuum database
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "VACUUM ANALYZE;"

# 4. Update statistics
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "ANALYZE;"

# 5. Check for updates
docker-compose pull

# 6. Health check
/opt/mcp-writing-servers/scripts/health-check.sh

# 7. Generate weekly report
echo "Weekly Maintenance Report - $(date)" > /var/log/weekly-maintenance.log
curl http://localhost:3010/metrics >> /var/log/weekly-maintenance.log
```

### Monthly Maintenance

**First Sunday of each month at 02:00 AM**

```bash
#!/bin/bash
# Monthly maintenance script

# 1. Full backup
pg_dump -U writer -h localhost -p 5432 mcp_writing_db | gzip > /var/backups/monthly/backup-$(date +%Y%m).sql.gz

# 2. Analyze slow queries
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 50;
" > /var/log/slow-queries-$(date +%Y%m).txt

# 3. Disk usage report
df -h > /var/log/disk-usage-$(date +%Y%m).txt

# 4. Security audit
npm audit > /var/log/security-audit-$(date +%Y%m).txt

# 5. Update dependencies (in test environment first)
# npm update && npm audit fix
```

---

## Backup & Restore

### Manual Backup

```bash
# Full database backup
docker exec writing-postgres pg_dump -U writer -Fc mcp_writing_db > backup-$(date +%Y%m%d-%H%M%S).dump

# Compressed SQL backup
docker exec writing-postgres pg_dump -U writer mcp_writing_db | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Specific table backup
docker exec writing-postgres pg_dump -U writer -t audit_logs mcp_writing_db > audit_logs-backup-$(date +%Y%m%d).sql
```

### Automated Backup

Backups run automatically daily at 02:00 AM (configured in database-admin-server).

**Verify automated backup**:
```bash
# Check last backup
curl http://localhost:3010/health | jq '.lastBackup'

# List backup files
docker exec mcp-writing-servers ls -lh /var/backups/

# Check backup logs
docker exec mcp-writing-servers cat /var/backups/logs/backup.log
```

### Restore from Backup

**⚠️ WARNING: This will overwrite existing data. Create a backup first!**

```bash
# 1. Create safety backup
docker exec writing-postgres pg_dump -U writer -Fc mcp_writing_db > pre-restore-backup-$(date +%Y%m%d-%H%M%S).dump

# 2. Stop services that depend on database
docker-compose stop mcp-writing-servers

# 3. Restore from custom format backup
docker exec -i writing-postgres pg_restore -U writer -d mcp_writing_db -c /path/to/backup.dump

# OR restore from SQL backup
gunzip < backup-20251117.sql.gz | docker exec -i writing-postgres psql -U writer -d mcp_writing_db

# 4. Restart services
docker-compose start mcp-writing-servers

# 5. Verify restore
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "SELECT COUNT(*) FROM books;"

# 6. Health check
curl http://localhost:3010/health
```

### Point-in-Time Recovery

If using PostgreSQL continuous archiving (WAL archiving):

```bash
# 1. Stop PostgreSQL
docker-compose stop postgres

# 2. Restore base backup
# [Steps depend on your WAL archiving setup]

# 3. Create recovery.conf
# [Configuration for point-in-time recovery]

# 4. Start PostgreSQL
docker-compose start postgres

# 5. Monitor recovery
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "SELECT pg_is_in_recovery();"
```

---

## Performance Tuning

### Query Optimization

```sql
-- Find missing indexes
SELECT
  schemaname,
  tablename,
  seq_scan,
  idx_scan,
  seq_scan - idx_scan AS too_many_seq,
  CASE
    WHEN seq_scan - idx_scan > 0
    THEN 'Missing Index?'
    ELSE 'OK'
  END AS assessment
FROM pg_stat_user_tables
WHERE seq_scan - idx_scan > 0
ORDER BY too_many_seq DESC
LIMIT 20;

-- Analyze table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS external_size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### Connection Pool Tuning

**File**: `pgbouncer.ini`

```ini
# Adjust based on load
default_pool_size = 25        # Increase if pool exhaustion
max_client_conn = 200         # Maximum client connections
reserve_pool_size = 5         # Emergency connections
```

### PostgreSQL Configuration Tuning

```bash
# Check current settings
docker exec writing-postgres psql -U postgres -c "SHOW ALL;"

# Update settings (add to docker-compose.yml postgres command)
# -c shared_buffers=512MB        # 25% of RAM
# -c effective_cache_size=2GB    # 50-75% of RAM
# -c maintenance_work_mem=256MB  # For VACUUM, CREATE INDEX
# -c work_mem=16MB               # Per operation memory
```

---

## Security Operations

### Credential Rotation

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update PostgreSQL
docker exec writing-postgres psql -U postgres -c "ALTER USER writer PASSWORD '$NEW_PASSWORD';"

# 3. Update .env file
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW_PASSWORD/" .env

# 4. Update userlist.txt for PgBouncer
echo "\"writer\" \"$NEW_PASSWORD\"" > userlist.txt

# 5. Restart services
docker-compose restart pgbouncer mcp-writing-servers

# 6. Verify connectivity
curl http://localhost:3010/health | jq '.database.connected'
```

### Security Audit

```bash
# 1. Check for vulnerabilities
npm audit

# 2. Fix vulnerabilities
npm audit fix

# 3. Scan Docker image
docker scan mcp-writing-servers:latest

# 4. Check file permissions
docker exec mcp-writing-servers find /app -type f -perm -002

# 5. Review audit logs
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "
  SELECT
    operation,
    table_name,
    COUNT(*) as count
  FROM audit_logs
  WHERE timestamp > NOW() - INTERVAL '7 days'
  GROUP BY operation, table_name
  ORDER BY count DESC;
"
```

### Access Control Review

```bash
# Review database users
docker exec writing-postgres psql -U postgres -c "\du"

# Review table permissions
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "\dp"

# Review restricted tables configuration
docker exec mcp-writing-servers env | grep RESTRICTED_TABLES
```

---

## Escalation Procedures

### When to Escalate

Escalate to next level if:
- Issue not resolved within SLA time
- Issue severity increases
- Multiple components affected
- Data loss suspected
- Security incident confirmed

### Escalation Path

1. **On-Call Engineer** (Primary)
   - Handle Severity 3 incidents
   - Escalate Severity 1-2 if not resolved in 30 minutes

2. **DevOps Lead**
   - Handle escalated Severity 2 incidents
   - All Severity 1 incidents
   - Infrastructure decisions

3. **Database Team**
   - Database performance issues
   - Data corruption
   - Backup/restore operations

4. **Security Team**
   - Security incidents
   - Data breach
   - Unauthorized access

5. **Engineering Manager**
   - Extended outages (> 2 hours)
   - Multiple service failures
   - Major incidents requiring coordination

---

## Contact Information

### On-Call Rotation

Refer to PagerDuty schedule: https://[company].pagerduty.com

### Team Contacts

- **DevOps Team**: devops@example.com, #devops
- **Database Team**: db-team@example.com, #database
- **Security Team**: security@example.com, #security
- **Engineering Manager**: eng-manager@example.com

### External Vendors

- **Cloud Provider Support**: [Support portal link]
- **Database Support**: [Vendor support contact]
- **Monitoring Tool Support**: [Vendor support contact]

---

## Appendix

### Useful Queries

```sql
-- Recent operations by user
SELECT
  user_id,
  operation,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration
FROM audit_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY user_id, operation
ORDER BY count DESC;

-- Failed operations
SELECT *
FROM audit_logs
WHERE success = false
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Table sizes
SELECT
  nspname || '.' || relname AS "relation",
  pg_size_pretty(pg_relation_size(C.oid)) AS "size"
FROM pg_class C
LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
WHERE nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_relation_size(C.oid) DESC
LIMIT 20;
```

### Monitoring Dashboard Links

- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Logs (Kibana)**: http://localhost:5601

---

**Document Version**: 1.0
**Last Updated**: 2025-11-17
**Author**: FictionLab Team
**Status**: Active
**Next Review**: 2025-12-17
