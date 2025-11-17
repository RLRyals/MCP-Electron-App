# Monitoring & Observability Guide
## Database Admin Server - MCP Writing System

## Overview

This guide provides comprehensive monitoring and observability setup for the database-admin-server in the MCP Writing System. It covers health checks, metrics collection, logging, alerting, and integration with popular monitoring tools.

**Related Documents**:
- [Phase 7 Deployment Guide](./PHASE-7-DEPLOYMENT-GUIDE.md)
- [DATABASE-CRUD-SPECIFICATION.md](./DATABASE-CRUD-SPECIFICATION.md)

---

## Table of Contents

1. [Health Checks](#health-checks)
2. [Metrics Collection](#metrics-collection)
3. [Logging Strategy](#logging-strategy)
4. [Monitoring Tools Integration](#monitoring-tools-integration)
5. [Alerting Rules](#alerting-rules)
6. [Dashboards](#dashboards)
7. [Performance Monitoring](#performance-monitoring)
8. [Audit Trail](#audit-trail)

---

## Health Checks

### Primary Health Endpoint

The database-admin-server exposes a comprehensive health check endpoint at `/health`.

**Endpoint**: `GET http://localhost:3010/health`

**Response Format**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-17T10:30:00.000Z",
  "uptime": 86400,
  "version": "1.0.0",
  "database": {
    "connected": true,
    "poolSize": 20,
    "activeConnections": 3,
    "idleConnections": 17,
    "waitingClients": 0,
    "latency": 2.5
  },
  "backupDirectory": {
    "path": "/var/backups",
    "exists": true,
    "writable": true,
    "diskSpaceAvailable": "45.2 GB",
    "diskSpaceUsed": "4.8 GB",
    "diskSpacePercentUsed": 9.6
  },
  "lastBackup": {
    "timestamp": "2025-11-17T02:00:00.000Z",
    "success": true,
    "duration": 45000,
    "size": "256 MB"
  },
  "environment": "production",
  "nodeVersion": "v18.19.0"
}
```

### Docker Health Check

Configure health checks in `docker-compose.yml`:

```yaml
services:
  mcp-writing-servers:
    healthcheck:
      test: ["CMD", "sh", "-c", "wget --quiet --tries=1 --spider http://localhost:3010/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Database Connectivity Check

**Script**: `scripts/health-check-db.sh`

```bash
#!/bin/bash
# Database connectivity health check

set -e

# Check PostgreSQL
echo "Checking PostgreSQL..."
docker exec writing-postgres pg_isready -U writer -d mcp_writing_db

# Check PgBouncer
echo "Checking PgBouncer..."
docker exec writing-pgbouncer psql -U writer -h localhost -p 6432 -d mcp_writing_db -c "SHOW POOLS;" > /dev/null

# Check database-admin-server
echo "Checking database-admin-server..."
HEALTH_STATUS=$(curl -s http://localhost:3010/health | jq -r .status)

if [ "$HEALTH_STATUS" = "healthy" ]; then
  echo "✓ All systems healthy"
  exit 0
else
  echo "✗ Health check failed: $HEALTH_STATUS"
  exit 1
fi
```

### Component Health Checks

Monitor individual components:

```bash
# PostgreSQL
curl http://localhost:3010/health | jq '.database'

# Backup System
curl http://localhost:3010/health | jq '.backupDirectory'

# Last Backup Status
curl http://localhost:3010/health | jq '.lastBackup'

# Memory Usage
curl http://localhost:3010/health | jq '.memory'
```

---

## Metrics Collection

### Metrics Endpoint

The database-admin-server exposes Prometheus-compatible metrics at `/metrics`.

**Endpoint**: `GET http://localhost:3010/metrics`

### Key Metrics

#### Request Metrics

```prometheus
# Total number of requests by operation type
db_admin_request_count{operation="query"} 15432
db_admin_request_count{operation="insert"} 3421
db_admin_request_count{operation="update"} 1823
db_admin_request_count{operation="delete"} 234
db_admin_request_count{operation="batch_insert"} 156

# Request latency histogram (milliseconds)
db_admin_request_duration_ms_bucket{operation="query",le="10"} 12000
db_admin_request_duration_ms_bucket{operation="query",le="50"} 14500
db_admin_request_duration_ms_bucket{operation="query",le="100"} 15200
db_admin_request_duration_ms_bucket{operation="query",le="500"} 15400
db_admin_request_duration_ms_bucket{operation="query",le="+Inf"} 15432

# Request duration percentiles
db_admin_request_duration_ms{operation="query",quantile="0.5"} 8.5
db_admin_request_duration_ms{operation="query",quantile="0.95"} 45.2
db_admin_request_duration_ms{operation="query",quantile="0.99"} 89.7
```

#### Error Metrics

```prometheus
# Error count by error code
db_admin_errors_total{code="DB_400_VALIDATION"} 23
db_admin_errors_total{code="DB_403_ACCESS_DENIED"} 5
db_admin_errors_total{code="DB_404_NOT_FOUND"} 12
db_admin_errors_total{code="DB_500_DATABASE"} 2

# Error rate (errors per second)
db_admin_error_rate 0.05
```

#### Database Metrics

```prometheus
# Database query duration (milliseconds)
db_admin_query_duration_ms{query_type="SELECT",quantile="0.95"} 35.2
db_admin_query_duration_ms{query_type="INSERT",quantile="0.95"} 52.8
db_admin_query_duration_ms{query_type="UPDATE",quantile="0.95"} 48.3

# Connection pool metrics
db_admin_pool_size 20
db_admin_pool_active_connections 3
db_admin_pool_idle_connections 17
db_admin_pool_waiting_clients 0
db_admin_pool_utilization_percent 15.0

# Connection pool wait time (milliseconds)
db_admin_pool_wait_time_ms{quantile="0.95"} 2.1
```

#### Backup Metrics

```prometheus
# Backup operations
db_admin_backup_success_total 30
db_admin_backup_failure_total 0

# Backup duration (seconds)
db_admin_backup_duration_seconds{quantile="0.95"} 47.5

# Backup size (bytes)
db_admin_backup_size_bytes 268435456

# Time since last successful backup (seconds)
db_admin_backup_last_success_timestamp 3600
```

#### System Metrics

```prometheus
# Memory usage (bytes)
db_admin_memory_heap_used_bytes 134217728
db_admin_memory_heap_total_bytes 268435456
db_admin_memory_rss_bytes 314572800

# CPU usage (percentage)
db_admin_cpu_usage_percent 5.2

# Uptime (seconds)
db_admin_uptime_seconds 86400
```

### Custom Metrics Implementation

**File**: `src/mcps/database-admin-server/metrics.js`

```javascript
const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, Memory, etc.)
client.collectDefaultMetrics({ register });

// Custom counters
const requestCounter = new client.Counter({
  name: 'db_admin_request_count',
  help: 'Total number of requests',
  labelNames: ['operation'],
  registers: [register]
});

// Custom histograms
const requestDuration = new client.Histogram({
  name: 'db_admin_request_duration_ms',
  help: 'Request duration in milliseconds',
  labelNames: ['operation'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [register]
});

// Error counter
const errorCounter = new client.Counter({
  name: 'db_admin_errors_total',
  help: 'Total number of errors',
  labelNames: ['code'],
  registers: [register]
});

// Connection pool gauge
const poolGauge = new client.Gauge({
  name: 'db_admin_pool_active_connections',
  help: 'Number of active database connections',
  registers: [register]
});

// Middleware to track metrics
function metricsMiddleware(operation) {
  const end = requestDuration.startTimer({ operation });

  return {
    success: () => {
      requestCounter.inc({ operation });
      end();
    },
    error: (errorCode) => {
      requestCounter.inc({ operation });
      errorCounter.inc({ code: errorCode });
      end();
    }
  };
}

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

module.exports = { metricsMiddleware, register };
```

---

## Logging Strategy

### Log Levels

The database-admin-server uses structured logging with the following levels:

- **ERROR**: Critical errors requiring immediate attention
- **WARN**: Warning conditions that should be reviewed
- **INFO**: General informational messages
- **DEBUG**: Detailed diagnostic information (disabled in production)

### Structured Logging Format

All logs are output in JSON format for easy parsing:

```json
{
  "timestamp": "2025-11-17T10:30:00.000Z",
  "level": "INFO",
  "service": "database-admin-server",
  "operation": "db_query_records",
  "message": "Query executed successfully",
  "duration": 45,
  "table": "books",
  "recordCount": 25,
  "requestId": "req_abc123xyz",
  "userId": "user_789"
}
```

### Log Implementation

**File**: `src/mcps/database-admin-server/logger.js`

```javascript
const winston = require('winston');

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'database-admin-server',
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File output (errors only)
    new winston.transports.File({
      filename: '/app/logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // File output (all logs)
    new winston.transports.File({
      filename: '/app/logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

// Request logging middleware
function logRequest(operation, details) {
  const startTime = Date.now();

  return {
    success: (result) => {
      logger.info('Operation completed', {
        operation,
        duration: Date.now() - startTime,
        ...details,
        success: true,
        recordCount: result.data?.length || result.count
      });
    },
    error: (error) => {
      logger.error('Operation failed', {
        operation,
        duration: Date.now() - startTime,
        ...details,
        success: false,
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack
        }
      });
    }
  };
}

module.exports = { logger, logRequest };
```

### Log Queries

Query logs using standard tools:

```bash
# View recent errors
docker exec mcp-writing-servers tail -f /app/logs/error.log | jq

# Filter by operation
docker exec mcp-writing-servers cat /app/logs/combined.log | jq 'select(.operation == "db_query_records")'

# Calculate average duration
docker exec mcp-writing-servers cat /app/logs/combined.log | jq -s 'map(.duration) | add / length'

# Find slow queries
docker exec mcp-writing-servers cat /app/logs/combined.log | jq 'select(.duration > 100)'
```

### Log Rotation

Configure log rotation to prevent disk space issues:

**File**: `/etc/logrotate.d/database-admin-server`

```
/app/logs/*.log {
  daily
  rotate 14
  compress
  delaycompress
  notifempty
  create 0640 nodejs nodejs
  sharedscripts
  postrotate
    docker exec mcp-writing-servers kill -USR1 $(cat /app/logs/app.pid)
  endscript
}
```

---

## Monitoring Tools Integration

### Prometheus Integration

#### Prometheus Configuration

**File**: `prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'database-admin-server'
    static_configs:
      - targets: ['localhost:3010']
    metrics_path: '/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s
```

#### Docker Compose Integration

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    network_mode: host
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped

volumes:
  prometheus_data:
```

### Grafana Integration

#### Grafana Setup

```yaml
services:
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    network_mode: host
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  grafana_data:
```

#### Datasource Configuration

**File**: `grafana/datasources/prometheus.yml`

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
    editable: true
```

### ELK Stack Integration (Optional)

For centralized log management:

```yaml
services:
  elasticsearch:
    image: elasticsearch:8.11.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es_data:/usr/share/elasticsearch/data
    network_mode: host

  logstash:
    image: logstash:8.11.0
    container_name: logstash
    volumes:
      - ./logstash/config:/usr/share/logstash/pipeline:ro
    network_mode: host
    depends_on:
      - elasticsearch

  kibana:
    image: kibana:8.11.0
    container_name: kibana
    network_mode: host
    depends_on:
      - elasticsearch

volumes:
  es_data:
```

**Logstash Configuration**: `logstash/config/logstash.conf`

```
input {
  file {
    path => "/app/logs/combined.log"
    codec => json
  }
}

filter {
  if [level] == "ERROR" {
    mutate {
      add_tag => ["error"]
    }
  }
}

output {
  elasticsearch {
    hosts => ["http://localhost:9200"]
    index => "database-admin-server-%{+YYYY.MM.dd}"
  }
}
```

---

## Alerting Rules

### Prometheus Alert Rules

**File**: `prometheus/alerts.yml`

```yaml
groups:
  - name: database_admin_server
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(db_admin_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on database-admin-server"
          description: "Error rate is {{ $value }} errors/sec (threshold: 0.05)"

      # Critical error rate
      - alert: CriticalErrorRate
        expr: rate(db_admin_errors_total[5m]) > 0.10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "CRITICAL: Very high error rate"
          description: "Error rate is {{ $value }} errors/sec (threshold: 0.10)"

      # Slow queries
      - alert: SlowQueries
        expr: histogram_quantile(0.95, db_admin_request_duration_ms_bucket) > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow queries detected"
          description: "P95 latency is {{ $value }}ms (threshold: 100ms)"

      # Database connection failure
      - alert: DatabaseConnectionFailure
        expr: db_admin_pool_active_connections == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failure"
          description: "No active database connections detected"

      # Connection pool exhaustion
      - alert: ConnectionPoolExhaustion
        expr: db_admin_pool_utilization_percent > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Connection pool nearly exhausted"
          description: "Pool utilization is {{ $value }}% (threshold: 90%)"

      # Backup failure
      - alert: BackupFailure
        expr: increase(db_admin_backup_failure_total[1h]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database backup failed"
          description: "Backup failure detected in the last hour"

      # No recent backup
      - alert: NoRecentBackup
        expr: time() - db_admin_backup_last_success_timestamp > 86400
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "No recent backup"
          description: "Last successful backup was {{ $value | humanizeDuration }} ago"

      # Low disk space
      - alert: LowDiskSpace
        expr: db_admin_disk_space_percent_used > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space on backup directory"
          description: "Disk usage is {{ $value }}% (threshold: 90%)"

      # Service down
      - alert: ServiceDown
        expr: up{job="database-admin-server"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database Admin Server is down"
          description: "Service has been down for more than 1 minute"

      # High memory usage
      - alert: HighMemoryUsage
        expr: (db_admin_memory_heap_used_bytes / db_admin_memory_heap_total_bytes) > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Heap usage is {{ $value | humanizePercentage }}"
```

### Alertmanager Configuration

**File**: `alertmanager/config.yml`

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: '${SLACK_WEBHOOK_URL}'

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'team-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true

receivers:
  - name: 'team-notifications'
    slack_configs:
      - channel: '#mcp-alerts'
        title: 'Database Admin Server Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'critical-alerts'
    slack_configs:
      - channel: '#mcp-critical'
        title: 'CRITICAL: Database Admin Server'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    email_configs:
      - to: 'oncall@example.com'
        from: 'alerts@example.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: '${SMTP_USERNAME}'
        auth_password: '${SMTP_PASSWORD}'
```

---

## Dashboards

### Grafana Dashboard - Database Admin Server

**File**: `grafana/dashboards/database-admin-server.json`

Dashboard includes:

1. **Overview Panel**
   - Service status
   - Uptime
   - Version
   - Total requests

2. **Request Metrics**
   - Requests per second (by operation)
   - Request latency (P50, P95, P99)
   - Error rate
   - Success rate

3. **Database Metrics**
   - Query duration
   - Connection pool utilization
   - Active connections
   - Waiting clients

4. **Backup Metrics**
   - Last backup status
   - Backup success rate
   - Backup duration
   - Disk space usage

5. **System Metrics**
   - CPU usage
   - Memory usage
   - Heap utilization
   - Event loop lag

### Dashboard Import

```bash
# Import dashboard via API
curl -X POST \
  http://localhost:3000/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  -d @grafana/dashboards/database-admin-server.json
```

---

## Performance Monitoring

### Real-Time Performance Tracking

```bash
# Monitor request latency
watch -n 1 'curl -s http://localhost:3010/metrics | grep db_admin_request_duration_ms | grep quantile'

# Monitor error rate
watch -n 1 'curl -s http://localhost:3010/metrics | grep db_admin_errors_total'

# Monitor connection pool
watch -n 1 'curl -s http://localhost:3010/metrics | grep db_admin_pool'
```

### Performance Benchmarks

```bash
# Run performance tests
npm run test:performance

# Generate performance report
npm run test:performance -- --reporter html > performance-report.html
```

### Query Analysis

```sql
-- Find slow queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Analyze table statistics
SELECT
  schemaname,
  tablename,
  seq_scan,
  idx_scan,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;
```

---

## Audit Trail

### Audit Log Structure

All CRUD operations are logged to the `audit_logs` table:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  operation VARCHAR(10) NOT NULL,  -- CREATE, READ, UPDATE, DELETE
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255),
  user_id VARCHAR(255),
  changes JSONB,
  success BOOLEAN NOT NULL,
  error TEXT,
  duration_ms INTEGER,
  ip_address INET,
  user_agent TEXT
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_operation_table ON audit_logs(operation, table_name);
CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_success ON audit_logs(success, timestamp DESC);
```

### Audit Log Queries

```sql
-- Recent failed operations
SELECT *
FROM audit_logs
WHERE success = false
ORDER BY timestamp DESC
LIMIT 100;

-- Operations by user
SELECT
  user_id,
  operation,
  COUNT(*) as operation_count
FROM audit_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_id, operation
ORDER BY operation_count DESC;

-- Changes to specific table
SELECT *
FROM audit_logs
WHERE table_name = 'books'
  AND operation = 'UPDATE'
  AND timestamp > NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;

-- Audit trail for specific record
SELECT
  timestamp,
  operation,
  changes,
  user_id
FROM audit_logs
WHERE table_name = 'books'
  AND record_id = '123'
ORDER BY timestamp ASC;
```

### Audit Log Retention

```sql
-- Delete audit logs older than retention period
DELETE FROM audit_logs
WHERE timestamp < NOW() - INTERVAL '${AUDIT_LOG_RETENTION_DAYS} days';

-- Archive old audit logs
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE timestamp < NOW() - INTERVAL '90 days';

DELETE FROM audit_logs
WHERE timestamp < NOW() - INTERVAL '90 days';
```

### Audit Log Export

```bash
# Export audit logs to CSV
docker exec writing-postgres psql -U writer -d mcp_writing_db -c "\COPY (SELECT * FROM audit_logs WHERE timestamp > NOW() - INTERVAL '30 days') TO STDOUT WITH CSV HEADER" > audit_logs_export.csv

# Export as JSON
docker exec writing-postgres psql -U writer -d mcp_writing_db -t -c "SELECT json_agg(row_to_json(audit_logs.*)) FROM audit_logs WHERE timestamp > NOW() - INTERVAL '30 days';" > audit_logs_export.json
```

---

## Best Practices

### Monitoring Best Practices

1. **Set appropriate alert thresholds** - Balance between noise and visibility
2. **Monitor trends** - Look for gradual degradation, not just spikes
3. **Regular review** - Review metrics weekly, adjust as needed
4. **Document incidents** - Keep runbook of issues and resolutions
5. **Test alerts** - Verify alerting works before incidents occur

### Performance Monitoring

1. **Baseline performance** - Establish normal operating ranges
2. **Track percentiles** - Use P95/P99, not just averages
3. **Monitor upstream** - Watch database performance, not just app metrics
4. **Capacity planning** - Monitor growth trends for planning

### Logging Best Practices

1. **Structured logging** - Always use JSON format
2. **Appropriate log levels** - Don't log everything as INFO
3. **Include context** - Request IDs, user IDs, timestamps
4. **Sanitize sensitive data** - Never log passwords or tokens
5. **Log rotation** - Prevent disk space issues

---

## Troubleshooting

### No Metrics Available

**Issue**: `/metrics` endpoint returns 404 or empty

**Solutions**:
```bash
# Verify metrics module is loaded
docker exec mcp-writing-servers node -e "console.log(require('./src/mcps/database-admin-server/metrics'))"

# Check metrics endpoint directly
curl -v http://localhost:3010/metrics

# Restart service
docker-compose restart mcp-writing-servers
```

### Alert Not Firing

**Issue**: Expected alert doesn't trigger

**Solutions**:
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Test alert expression
curl 'http://localhost:9090/api/v1/query?query=rate(db_admin_errors_total[5m])'

# Check Alertmanager
curl http://localhost:9093/api/v2/alerts
```

### High Cardinality Metrics

**Issue**: Too many metric labels causing memory issues

**Solutions**:
- Limit label values
- Use aggregation
- Remove unnecessary labels
- Increase Prometheus memory

---

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Winston Logging Library](https://github.com/winstonjs/winston)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-17
**Author**: FictionLab Team
**Status**: Active
