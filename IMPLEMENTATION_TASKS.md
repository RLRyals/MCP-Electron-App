# MCP Electron App - Performance & Claude Desktop Implementation Tasks

This document contains detailed task breakdowns for implementing performance improvements and Claude Desktop support. Each task is designed to be small, testable, and suitable for Claude Code Web.

---

## 🎯 Task Overview & Dependencies

```
Track 1: Database Performance (Independent)
├── Task 1.1: PostgreSQL Performance Tuning
└── Task 1.2: Add PgBouncer Connection Pooling

Track 2: MCP Server Build Optimization (Independent)
├── Task 2.1: Create Multi-stage Dockerfile
├── Task 2.2: Create Server Orchestrator
└── Task 2.3: Update docker-compose for Image-based Build

Track 3: Service Reliability (Independent)
├── Task 3.1: Add MCP Connector Health Check
└── Task 3.2: Optimize Docker Network Settings

Track 4: Claude Desktop Support (Depends on Tracks 1-3)
├── Task 4.1: Create MCP stdio Adapter
├── Task 4.2: Add stdio Bridge Service (depends on 4.1)
├── Task 4.3: Add Auto-configuration Module (depends on 4.1, 4.2)
└── Task 4.4: Add UI Integration (depends on 4.3)
```

---

## 📋 Track 1: Database Performance

### Task 1.1: Add PostgreSQL Performance Tuning

**Priority**: High
**Difficulty**: Easy
**Estimated Time**: 15-30 minutes
**Dependencies**: None
**Labels**: `enhancement`, `performance`, `database`

**Description**:
Optimize PostgreSQL configuration for better query performance and memory usage. This will improve response times for long conversations with many context retrievals.

**Changes Required**:
1. Update `docker-compose.yml` PostgreSQL service
2. Add performance tuning parameters to the `command` section

**Current Code** (`docker-compose.yml:8`):
```yaml
command: postgres -c max_connections=200
```

**New Code**:
```yaml
command: >
  postgres
  -c max_connections=200
  -c shared_buffers=256MB
  -c effective_cache_size=1GB
  -c work_mem=10MB
  -c random_page_cost=1.1
```

**Expected Benefits**:
- 20-30% improvement in query performance
- Better memory utilization
- Reduced I/O overhead

**Testing**:
1. Start the app and verify PostgreSQL starts successfully
2. Check PostgreSQL logs: `docker logs writing-postgres`
3. Verify health check passes
4. Test MCP operations work normally

**Acceptance Criteria**:
- [ ] PostgreSQL starts with new parameters
- [ ] Health check passes
- [ ] No errors in PostgreSQL logs
- [ ] MCP servers can connect to database

---

### Task 1.2: Add PgBouncer Connection Pooling

**Priority**: High
**Difficulty**: Medium
**Estimated Time**: 45-60 minutes
**Dependencies**: Task 1.1 (same config file)
**Labels**: `enhancement`, `performance`, `database`

**Description**:
Add PgBouncer as a connection pooling layer between MCP servers and PostgreSQL. This reduces connection overhead by up to 30x, essential for handling multiple concurrent MCP operations efficiently.

**Changes Required**:
1. Add new `pgbouncer` service to `docker-compose.yml`
2. Update `mcp-writing-servers` to use PgBouncer instead of direct PostgreSQL connection

**New Service to Add** (add after PostgreSQL service, before mcp-connector):
```yaml
  # PgBouncer for connection pooling
  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    container_name: writing-pgbouncer
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_DBNAME: ${POSTGRES_DB}
      DATABASES_USER: ${POSTGRES_USER}
      DATABASES_PASSWORD: ${POSTGRES_PASSWORD}
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 200
      DEFAULT_POOL_SIZE: 25
    ports:
      - "6432:6432"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - writing-network
    restart: unless-stopped
```

**Update MCP Servers** (`docker-compose.yml:59`):
```yaml
# Change from:
DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable

# To:
DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@pgbouncer:6432/${POSTGRES_DB}?sslmode=disable
```

**Update Dependencies** (`docker-compose.yml:71-73`):
```yaml
depends_on:
  postgres:
    condition: service_healthy
  pgbouncer:
    condition: service_started
```

**Expected Benefits**:
- 30x reduction in connection overhead
- Better handling of concurrent requests
- Lower database CPU usage

**Testing**:
1. Start the app and verify all services start
2. Check PgBouncer logs: `docker logs writing-pgbouncer`
3. Verify MCP servers connect through PgBouncer
4. Test multiple concurrent MCP operations
5. Check PgBouncer stats: `docker exec -it writing-pgbouncer psql -p 6432 -U ${POSTGRES_USER} pgbouncer -c "SHOW STATS"`

**Acceptance Criteria**:
- [ ] PgBouncer container starts successfully
- [ ] MCP servers connect through PgBouncer (port 6432)
- [ ] No connection errors in logs
- [ ] All MCP operations work normally
- [ ] PgBouncer stats show active connections

---

## 📋 Track 2: MCP Server Build Optimization

### Task 2.1: Create Multi-stage Dockerfile for MCP Writing Servers

**Priority**: High
**Difficulty**: Medium
**Estimated Time**: 45-60 minutes
**Dependencies**: None
**Labels**: `enhancement`, `performance`, `docker`

**Description**:
Replace the bind mount approach with an optimized multi-stage Docker image build. This will dramatically improve startup times (10-100x faster on Windows) and create a production-ready build.

**File to Create**:
Repository: `mcp-writing-servers` (user's separate repo)
Path: `Dockerfile` (in root of mcp-writing-servers repo)

**Note**: This file needs to be created in the **mcp-writing-servers repository**, not the MCP-Electron-App repository.

**New Dockerfile**:
```dockerfile
# Multi-stage build for optimal performance
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Stage 1: Install dependencies (cached layer)
FROM base AS deps

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production \
    --prefer-offline \
    --no-audit \
    --ignore-scripts && \
    npm cache clean --force

# Stage 2: Build stage (if you have TypeScript or build steps)
FROM base AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# If you have a build step, run it here
# RUN npm run build

# Stage 3: Production runtime
FROM base AS runtime

WORKDIR /app

# Copy built application
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose ports for all MCP servers
EXPOSE 3001 3002 3003 3004 3005 3006 3007 3008 3009

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start all MCP servers (will be updated in Task 2.2)
CMD ["node", "server.js"]
```

**Expected Benefits**:
- 10-100x faster container startup
- Consistent production environment
- Smaller image size with layer caching
- Better security (non-root user)

**Testing**:
1. Build the image: `docker build -t mcp-writing-servers:test .`
2. Verify build completes without errors
3. Check image size: `docker images mcp-writing-servers:test`
4. Test container starts: `docker run --rm mcp-writing-servers:test node --version`

**Acceptance Criteria**:
- [ ] Dockerfile builds successfully
- [ ] Image size is reasonable (< 500MB)
- [ ] Container starts without errors
- [ ] Non-root user is configured

**Documentation Location**: Add instructions to the mcp-writing-servers README

---

### Task 2.2: Create Server Orchestrator Script

**Priority**: High
**Difficulty**: Medium
**Estimated Time**: 45-60 minutes
**Dependencies**: None (but used by Task 2.1)
**Labels**: `enhancement`, `architecture`

**Description**:
Create a Node.js script that starts and manages all 9 MCP servers as child processes. This replaces the need for individual service definitions and provides centralized logging and process management.

**File to Create**:
Repository: `mcp-writing-servers`
Path: `server.js` (in root of mcp-writing-servers repo)

**New File Content**:
```javascript
// server.js - MCP Server Orchestrator
const { spawn } = require('child_process');
const path = require('path');

// List of all MCP servers
const servers = [
  { name: 'book-planning', port: 3001, file: './src/mcps/book-planning-server/index.js' },
  { name: 'series-planning', port: 3002, file: './src/mcps/series-planning-server/index.js' },
  { name: 'chapter-planning', port: 3003, file: './src/mcps/chapter-planning-server/index.js' },
  { name: 'character-planning', port: 3004, file: './src/mcps/character-planning-server/index.js' },
  { name: 'scene', port: 3005, file: './src/mcps/scene-server/index.js' },
  { name: 'core-continuity', port: 3006, file: './src/mcps/core-continuity-server/index.js' },
  { name: 'review', port: 3007, file: './src/mcps/review-server/index.js' },
  { name: 'reporting', port: 3008, file: './src/mcps/reporting-server/index.js' },
  { name: 'author', port: 3009, file: './src/mcps/author-server/index.js' },
];

console.log('Starting MCP Server Orchestrator...');
console.log(`Managing ${servers.length} MCP servers\n`);

const childProcesses = [];

// Start all servers
servers.forEach(server => {
  console.log(`[${server.name}] Starting on port ${server.port}...`);

  const child = spawn('node', [server.file], {
    env: {
      ...process.env,
      PORT: server.port,
      SERVER_NAME: server.name
    },
    stdio: ['inherit', 'inherit', 'inherit']
  });

  childProcesses.push({ process: child, config: server });

  child.on('error', (error) => {
    console.error(`[${server.name}] Failed to start:`, error);
  });

  child.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`[${server.name}] Exited with code ${code}, signal ${signal}`);
      // Exit orchestrator if any server fails
      process.exit(code || 1);
    } else {
      console.log(`[${server.name}] Exited normally`);
    }
  });
});

console.log('\nAll servers started. Orchestrator running...');

// Graceful shutdown handler
function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  childProcesses.forEach(({ process, config }) => {
    console.log(`[${config.name}] Stopping...`);
    process.kill('SIGTERM');
  });

  // Give processes 5 seconds to shut down gracefully
  setTimeout(() => {
    console.log('Forcing shutdown...');
    childProcesses.forEach(({ process }) => {
      process.kill('SIGKILL');
    });
    process.exit(0);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Keep process alive
process.stdin.resume();
```

**Expected Benefits**:
- Centralized process management
- Unified logging
- Graceful shutdown handling
- Easier debugging

**Testing**:
1. Run locally: `node server.js`
2. Verify all 9 servers start
3. Check each server responds on its port
4. Test graceful shutdown with Ctrl+C
5. Verify all child processes terminate

**Acceptance Criteria**:
- [ ] Script starts all 9 MCP servers
- [ ] Each server runs on correct port
- [ ] Logs show server startup messages
- [ ] Graceful shutdown works correctly
- [ ] Script exits with error if any server fails

**Update Needed**: Verify the paths in the `servers` array match your actual file structure.

---

### Task 2.3: Update docker-compose for Image-based Build

**Priority**: High
**Difficulty**: Easy
**Estimated Time**: 20-30 minutes
**Dependencies**: Tasks 2.1, 2.2
**Labels**: `enhancement`, `docker`

**Description**:
Update the `mcp-writing-servers` service in docker-compose.yml to use the new image-based build instead of bind mounts. Also add production optimizations.

**Changes Required**:
Update `docker-compose.yml` mcp-writing-servers service (lines 51-79)

**Current Code**:
```yaml
  mcp-writing-servers:
    build:
      context: ${MCP_WRITING_SERVERS_DIR}
      dockerfile: Dockerfile
    container_name: mcp-writing-servers
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable
      NODE_ENV: production
    ports:
      - "3001:3001"
      - "3002:3002"
      - "3003:3003"
      - "3004:3004"
      - "3005:3005"
      - "3006:3006"
      - "3007:3007"
      - "3008:3008"
      - "3009:3009"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ${MCP_WRITING_SERVERS_DIR}:/app
      - /app/node_modules
    networks:
      - writing-network
    restart: unless-stopped
```

**New Code**:
```yaml
  mcp-writing-servers:
    build:
      context: ${MCP_WRITING_SERVERS_DIR}
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    container_name: mcp-writing-servers
    environment:
      # Use pgbouncer for connection pooling (if Task 1.2 is complete)
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@pgbouncer:6432/${POSTGRES_DB}?sslmode=disable
      NODE_ENV: production
      # Performance optimizations
      NODE_OPTIONS: "--max-old-space-size=2048"
    ports:
      - "3001:3001"  # book-planning
      - "3002:3002"  # series-planning
      - "3003:3003"  # chapter-planning
      - "3004:3004"  # character-planning
      - "3005:3005"  # scene
      - "3006:3006"  # core-continuity
      - "3007:3007"  # review
      - "3008:3008"  # reporting
      - "3009:3009"  # author
    depends_on:
      postgres:
        condition: service_healthy
      pgbouncer:
        condition: service_started
    networks:
      - writing-network
    restart: unless-stopped
    # Healthcheck to ensure service is ready
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Note**: Remove the `volumes` section entirely - we're now using the image-based approach!

**Expected Benefits**:
- 10-100x faster startup on Windows
- No bind mount performance overhead
- Production-ready build
- Health check monitoring

**Testing**:
1. Rebuild containers: `docker-compose build`
2. Start services: `docker-compose up -d`
3. Check health: `docker-compose ps`
4. Verify all MCP servers are healthy
5. Test MCP operations work correctly

**Acceptance Criteria**:
- [ ] Container builds from Dockerfile (no bind mount)
- [ ] All 9 MCP servers start successfully
- [ ] Health check passes
- [ ] Startup time is significantly faster than before
- [ ] All MCP operations work normally

---

## 📋 Track 3: Service Reliability

### Task 3.1: Add MCP Connector Health Check

**Priority**: Medium
**Difficulty**: Easy
**Estimated Time**: 15-20 minutes
**Dependencies**: None
**Labels**: `enhancement`, `reliability`

**Description**:
Add health check configuration to the MCP Connector service to enable Docker to monitor service health and enable automatic restarts if needed.

**Changes Required**:
Update `docker-compose.yml` mcp-connector service (add after line 49)

**Add This Section** (after `extra_hosts`, before the next service):
```yaml
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:50880/ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Also Update** `mcp-connector` environment section (add after NODE_ENV):
```yaml
    environment:
      PORT: 50880
      MCP_AUTH_TOKEN: ${MCP_AUTH_TOKEN}
      NODE_ENV: production
```

**Expected Benefits**:
- Automatic detection of connector failures
- Better monitoring and diagnostics
- Improved reliability

**Testing**:
1. Start services: `docker-compose up -d`
2. Check health status: `docker ps` (should show "healthy")
3. View health check logs: `docker inspect writing-mcp-connector`
4. Verify connector responds to requests

**Acceptance Criteria**:
- [ ] Health check configuration added
- [ ] Container shows as "healthy" in `docker ps`
- [ ] Health check endpoint responds correctly
- [ ] Connector service operates normally

---

### Task 3.2: Optimize Docker Network Settings

**Priority**: Low
**Difficulty**: Easy
**Estimated Time**: 10-15 minutes
**Dependencies**: None
**Labels**: `enhancement`, `performance`

**Description**:
Add optimized network driver settings to reduce latency and improve network performance between containers.

**Changes Required**:
Update `docker-compose.yml` networks section (lines 104-106)

**Current Code**:
```yaml
networks:
  writing-network:
    driver: bridge
```

**New Code**:
```yaml
networks:
  writing-network:
    driver: bridge
    name: writing-network
    # Optimize bridge network settings
    driver_opts:
      com.docker.network.bridge.name: br-writing
      com.docker.network.driver.mtu: 1500
```

**Expected Benefits**:
- Minor latency improvements
- Better network stability
- Consistent network naming

**Testing**:
1. Recreate network: `docker-compose down && docker-compose up -d`
2. Check network: `docker network inspect writing-network`
3. Verify all services communicate normally
4. Test MCP operations

**Acceptance Criteria**:
- [ ] Network configuration updated
- [ ] Network created with optimized settings
- [ ] All services connect to network
- [ ] No network errors in logs

---

## 📋 Track 4: Claude Desktop Support

### Task 4.1: Create MCP stdio Adapter Script

**Priority**: High
**Difficulty**: Hard
**Estimated Time**: 2-3 hours
**Dependencies**: None (but needed by 4.2, 4.3)
**Labels**: `feature`, `claude-desktop`, `stdio`

**Description**:
Create a Node.js adapter that bridges between Claude Desktop's stdio protocol and the HTTP-based MCP servers. This is the core component that enables Claude Desktop to communicate with the Dockerized MCP servers.

**File to Create**:
Repository: `mcp-writing-servers`
Path: `mcp-stdio-adapter.js` (in root of mcp-writing-servers repo)

**New File**:
```javascript
#!/usr/bin/env node

/**
 * MCP stdio Adapter
 *
 * Bridges between Claude Desktop's stdio protocol and HTTP-based MCP servers.
 * Reads JSON-RPC messages from stdin, forwards to MCP servers via HTTP,
 * and writes responses back to stdout.
 */

const http = require('http');
const readline = require('readline');

// Configuration
const MCP_SERVERS = [
  { name: 'book-planning', url: 'http://localhost:3001' },
  { name: 'series-planning', url: 'http://localhost:3002' },
  { name: 'chapter-planning', url: 'http://localhost:3003' },
  { name: 'character-planning', url: 'http://localhost:3004' },
  { name: 'scene', url: 'http://localhost:3005' },
  { name: 'core-continuity', url: 'http://localhost:3006' },
  { name: 'review', url: 'http://localhost:3007' },
  { name: 'reporting', url: 'http://localhost:3008' },
  { name: 'author', url: 'http://localhost:3009' },
];

// Default to first server if not specified
const DEFAULT_SERVER = process.env.MCP_SERVER || 'book-planning';

// Get server URL from environment or use default
function getServerUrl() {
  const serverName = DEFAULT_SERVER;
  const server = MCP_SERVERS.find(s => s.name === serverName);
  if (!server) {
    console.error(`Unknown server: ${serverName}`, { severity: 'error' });
    process.exit(1);
  }
  return server.url;
}

const SERVER_URL = getServerUrl();

// Logging to stderr (stdout is reserved for JSON-RPC)
function log(message, data = {}) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    message,
    ...data
  }));
}

// Send JSON-RPC request to HTTP endpoint
function sendToMCPServer(request) {
  return new Promise((resolve, reject) => {
    const url = new URL('/mcp', SERVER_URL);
    const postData = JSON.stringify(request);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (err) {
          reject(new Error(`Invalid JSON response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Send JSON-RPC response to stdout
function sendResponse(response) {
  console.log(JSON.stringify(response));
}

// Main stdio handler
async function handleStdioMessage(line) {
  try {
    const request = JSON.parse(line);

    log('Received request', {
      method: request.method,
      id: request.id
    });

    // Forward request to MCP server
    const response = await sendToMCPServer(request);

    log('Sending response', {
      id: response.id,
      hasError: !!response.error
    });

    // Send response to Claude Desktop
    sendResponse(response);

  } catch (err) {
    log('Error processing message', {
      error: err.message,
      severity: 'error'
    });

    // Send error response
    sendResponse({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: err.message,
      },
    });
  }
}

// Initialize stdio interface
function startStdioAdapter() {
  log('MCP stdio Adapter starting', {
    server: DEFAULT_SERVER,
    url: SERVER_URL
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    if (line.trim()) {
      handleStdioMessage(line);
    }
  });

  rl.on('close', () => {
    log('stdio interface closed');
    process.exit(0);
  });

  // Handle signals
  process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down');
    rl.close();
  });

  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down');
    rl.close();
  });

  log('stdio Adapter ready');
}

// Start the adapter
startStdioAdapter();
```

**Expected Benefits**:
- Enables Claude Desktop to communicate with MCP servers
- Ultra-low latency stdio protocol (1-5ms)
- Simple, lightweight bridge

**Testing**:
1. Make script executable: `chmod +x mcp-stdio-adapter.js`
2. Test with echo: `echo '{"jsonrpc":"2.0","method":"ping","id":1}' | node mcp-stdio-adapter.js`
3. Verify response is returned
4. Test with MCP servers running
5. Check error handling with invalid JSON

**Acceptance Criteria**:
- [ ] Script reads from stdin correctly
- [ ] Forwards JSON-RPC to HTTP endpoint
- [ ] Returns responses to stdout
- [ ] Error handling works correctly
- [ ] Logs to stderr (not stdout)

**Documentation**: Add usage instructions to mcp-writing-servers README

---

### Task 4.2: Add Claude Desktop stdio Bridge Service

**Priority**: High
**Difficulty**: Medium
**Estimated Time**: 30-45 minutes
**Dependencies**: Task 4.1
**Labels**: `feature`, `claude-desktop`, `docker`

**Description**:
Add a socat-based TCP-to-stdio bridge service that allows Claude Desktop to connect to the Dockerized MCP servers using the stdio protocol over TCP.

**Changes Required**:
Add new service to `docker-compose.yml` (add before the `networks:` section)

**New Service**:
```yaml
  # Claude Desktop Bridge (stdio-to-http adapter)
  claude-bridge:
    build:
      context: ${MCP_WRITING_SERVERS_DIR}
      dockerfile: Dockerfile.claude-bridge
    container_name: claude-bridge
    command: node /app/mcp-stdio-adapter.js
    environment:
      MCP_SERVER: ${CLAUDE_DEFAULT_MCP_SERVER:-book-planning}
      NODE_ENV: production
    ports:
      - "8888:8888"
    depends_on:
      mcp-writing-servers:
        condition: service_healthy
    networks:
      - writing-network
    restart: unless-stopped
    stdin_open: true
    tty: true
```

**New Dockerfile to Create**:
Repository: `mcp-writing-servers`
Path: `Dockerfile.claude-bridge`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install socat for TCP-to-stdio bridging
RUN apk add --no-cache socat

# Copy the stdio adapter script
COPY mcp-stdio-adapter.js /app/

# Make script executable
RUN chmod +x /app/mcp-stdio-adapter.js

# Expose bridge port
EXPOSE 8888

# Use socat to bridge TCP to stdio
CMD socat TCP-LISTEN:8888,fork,reuseaddr EXEC:"node /app/mcp-stdio-adapter.js"
```

**Update .env Template** (add new variable):
```bash
# Claude Desktop Configuration
CLAUDE_DEFAULT_MCP_SERVER=book-planning
```

**Expected Benefits**:
- Enables TCP-based stdio connection
- Claude Desktop can connect over network
- Maintains stdio protocol benefits

**Testing**:
1. Build and start: `docker-compose build claude-bridge && docker-compose up -d claude-bridge`
2. Test TCP connection: `telnet localhost 8888`
3. Send test message: `{"jsonrpc":"2.0","method":"ping","id":1}`
4. Verify response received
5. Check container logs: `docker logs claude-bridge`

**Acceptance Criteria**:
- [ ] Bridge container starts successfully
- [ ] Port 8888 accessible from host
- [ ] Can send JSON-RPC via TCP
- [ ] Receives responses correctly
- [ ] Logs show proper operation

---

### Task 4.3: Add Claude Desktop Auto-configuration Module

**Priority**: High
**Difficulty**: Hard
**Estimated Time**: 2-3 hours
**Dependencies**: Tasks 4.1, 4.2
**Labels**: `feature`, `claude-desktop`, `configuration`

**Description**:
Create a TypeScript module similar to `typingmind-auto-config.ts` that generates Claude Desktop configuration files automatically. This enables one-click setup for Claude Desktop users.

**File to Create**:
Path: `src/main/claude-desktop-auto-config.ts`

**New File** (see next comment for full code due to length)

**Expected Benefits**:
- Automatic Claude Desktop configuration
- Same ease-of-use as Typing Mind setup
- Platform-specific config file handling

**Testing**:
1. Run configuration function
2. Verify config file created in correct location
3. Check JSON format is valid
4. Test with Claude Desktop app
5. Verify all MCP servers are accessible

**Acceptance Criteria**:
- [ ] Module generates valid Claude Desktop config
- [ ] Config written to correct platform-specific location
- [ ] All 9 MCP servers included
- [ ] Config format matches Claude Desktop requirements
- [ ] Error handling for file permissions

---

### Task 4.4: Add Claude Desktop UI Integration

**Priority**: Medium
**Difficulty**: Medium
**Estimated Time**: 1-2 hours
**Dependencies**: Task 4.3
**Labels**: `feature`, `ui`, `claude-desktop`

**Description**:
Add UI components to the Electron app for Claude Desktop configuration, similar to the existing Typing Mind UI. This includes setup wizard integration, dashboard status, and configuration management.

**Changes Required**:

1. **Add IPC Handlers** (`src/main/index.ts`):
```typescript
// Claude Desktop handlers
ipcMain.handle('claude-desktop:auto-configure', async () => {
  return await autoConfigureClaudeDesktop();
});

ipcMain.handle('claude-desktop:is-configured', async () => {
  return await isClaudeDesktopConfigured();
});

ipcMain.handle('claude-desktop:get-config', async () => {
  return await getClaudeDesktopConfig();
});

ipcMain.handle('claude-desktop:reset-config', async () => {
  return await resetClaudeDesktopConfig();
});

ipcMain.handle('claude-desktop:get-config-path', () => {
  return getClaudeDesktopConfigPath();
});

ipcMain.handle('claude-desktop:open-config-folder', async () => {
  const { shell } = require('electron');
  const configPath = getClaudeDesktopConfigPath();
  await shell.showItemInFolder(configPath);
});
```

2. **Update Preload API** (`src/preload/preload.ts`):
```typescript
claudeDesktop: {
  autoConfigure: () => ipcRenderer.invoke('claude-desktop:auto-configure'),
  isConfigured: () => ipcRenderer.invoke('claude-desktop:is-configured'),
  getConfig: () => ipcRenderer.invoke('claude-desktop:get-config'),
  resetConfig: () => ipcRenderer.invoke('claude-desktop:reset-config'),
  getConfigPath: () => ipcRenderer.invoke('claude-desktop:get-config-path'),
  openConfigFolder: () => ipcRenderer.invoke('claude-desktop:open-config-folder'),
}
```

3. **Add UI Section** (`src/renderer/index.html`):
Add after Typing Mind section in the Client Selection step:

```html
<!-- Claude Desktop Configuration -->
<div id="claude-desktop-config-section" style="display:none;" class="config-section">
  <h3>Claude Desktop Configuration</h3>

  <div class="status-box" id="claude-desktop-status">
    <p>Status: <span id="claude-desktop-status-text">Not Configured</span></p>
  </div>

  <div class="config-options">
    <button id="claude-desktop-auto-config-btn" class="btn btn-primary">
      Auto-Configure Claude Desktop
    </button>

    <button id="claude-desktop-open-folder-btn" class="btn btn-secondary">
      Open Config Folder
    </button>

    <button id="claude-desktop-reset-btn" class="btn btn-warning" style="display:none;">
      Reset Configuration
    </button>
  </div>

  <div class="info-box">
    <h4>What this does:</h4>
    <ul>
      <li>Creates Claude Desktop config file at the correct location</li>
      <li>Configures all 9 MCP servers for stdio access</li>
      <li>Uses ultra-low latency connection (1-5ms)</li>
    </ul>

    <p><strong>Note:</strong> Claude Desktop must be installed separately.
       <a href="#" id="claude-desktop-download-link">Download Claude Desktop</a>
    </p>
  </div>

  <div class="config-preview" id="claude-desktop-config-preview" style="display:none;">
    <h4>Configuration Preview:</h4>
    <pre><code id="claude-desktop-config-content"></code></pre>
  </div>
</div>
```

4. **Add Event Handlers** (`src/renderer/client-selection-handlers.ts`):
```typescript
// Claude Desktop handlers
const claudeDesktopAutoConfigBtn = document.getElementById('claude-desktop-auto-config-btn');
const claudeDesktopOpenFolderBtn = document.getElementById('claude-desktop-open-folder-btn');
const claudeDesktopResetBtn = document.getElementById('claude-desktop-reset-btn');
const claudeDesktopDownloadLink = document.getElementById('claude-desktop-download-link');

// Auto-configure
claudeDesktopAutoConfigBtn?.addEventListener('click', async () => {
  try {
    showProgress('Configuring Claude Desktop...');
    const result = await window.electronAPI.claudeDesktop.autoConfigure();

    if (result.success) {
      showSuccess('Claude Desktop configured successfully!');
      await updateClaudeDesktopStatus();
    } else {
      showError(`Configuration failed: ${result.error}`);
    }
  } catch (error) {
    showError(`Error: ${error.message}`);
  }
});

// Open config folder
claudeDesktopOpenFolderBtn?.addEventListener('click', async () => {
  await window.electronAPI.claudeDesktop.openConfigFolder();
});

// Reset config
claudeDesktopResetBtn?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to reset Claude Desktop configuration?')) {
    try {
      await window.electronAPI.claudeDesktop.resetConfig();
      showSuccess('Configuration reset successfully');
      await updateClaudeDesktopStatus();
    } catch (error) {
      showError(`Error: ${error.message}`);
    }
  }
});

// Download link
claudeDesktopDownloadLink?.addEventListener('click', (e) => {
  e.preventDefault();
  window.electronAPI.shell.openExternal('https://claude.ai/download');
});

// Update status
async function updateClaudeDesktopStatus() {
  try {
    const isConfigured = await window.electronAPI.claudeDesktop.isConfigured();
    const statusText = document.getElementById('claude-desktop-status-text');
    const resetBtn = document.getElementById('claude-desktop-reset-btn');
    const previewSection = document.getElementById('claude-desktop-config-preview');

    if (isConfigured) {
      statusText.textContent = '✓ Configured';
      statusText.style.color = 'green';
      resetBtn.style.display = 'inline-block';

      // Show config preview
      const config = await window.electronAPI.claudeDesktop.getConfig();
      document.getElementById('claude-desktop-config-content').textContent =
        JSON.stringify(config, null, 2);
      previewSection.style.display = 'block';
    } else {
      statusText.textContent = 'Not Configured';
      statusText.style.color = 'orange';
      resetBtn.style.display = 'none';
      previewSection.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating Claude Desktop status:', error);
  }
}

// Initialize on page load
updateClaudeDesktopStatus();
```

**Expected Benefits**:
- User-friendly Claude Desktop setup
- Visual confirmation of configuration
- Easy access to config files
- Consistent UX with Typing Mind setup

**Testing**:
1. Open app and navigate to Client Selection
2. Select Claude Desktop option
3. Click "Auto-Configure" button
4. Verify configuration created
5. Test "Open Config Folder" button
6. Verify status updates correctly
7. Test reset functionality

**Acceptance Criteria**:
- [ ] UI section displays correctly
- [ ] Auto-configure button works
- [ ] Status updates in real-time
- [ ] Config folder opens correctly
- [ ] Reset function works
- [ ] Config preview displays

---

## 🔄 Suggested Implementation Order

For **maximum efficiency** and **minimal disruption**, implement in this order:

### Phase 1: Database Performance (Low Risk)
1. Task 1.1 - PostgreSQL tuning ✅ Start here
2. Task 1.2 - PgBouncer ✅ Next

**Test Phase 1** before proceeding

### Phase 2: Service Reliability (Low Risk)
3. Task 3.1 - MCP Connector health check ✅
4. Task 3.2 - Network optimization ✅

**Test Phase 2** before proceeding

### Phase 3: Build Optimization (Medium Risk)
5. Task 2.1 - Multi-stage Dockerfile ✅
6. Task 2.2 - Server orchestrator ✅
7. Task 2.3 - Update docker-compose ✅

**Test Phase 3** thoroughly before proceeding

### Phase 4: Claude Desktop Support (High Complexity)
8. Task 4.1 - stdio adapter ✅
9. Task 4.2 - Bridge service ✅
10. Task 4.3 - Auto-config module ✅
11. Task 4.4 - UI integration ✅

**Final integration testing**

---

## 📊 Testing Strategy

For each task:
1. **Unit Test**: Test component in isolation
2. **Integration Test**: Test with related components
3. **System Test**: Test entire app with changes
4. **Regression Test**: Verify existing features still work

### Key Test Cases

**Database Performance**:
- [ ] PostgreSQL starts with tuning parameters
- [ ] PgBouncer handles concurrent connections
- [ ] MCP servers connect successfully
- [ ] Long conversations maintain performance

**Build Optimization**:
- [ ] Docker image builds successfully
- [ ] Container startup time improved
- [ ] All MCP servers start via orchestrator
- [ ] Memory usage is reasonable

**Claude Desktop**:
- [ ] stdio adapter processes JSON-RPC
- [ ] Bridge accepts TCP connections
- [ ] Config file generated correctly
- [ ] Claude Desktop connects successfully
- [ ] All 9 MCP servers accessible

---

## 📝 Documentation Updates Needed

After implementation, update:
1. `README.md` - Add Claude Desktop setup instructions
2. `ARCHITECTURE.md` - Update architecture diagrams
3. `docs/MCP_CONFIGURATION.md` - Add stdio bridge documentation
4. User Guide - Add Claude Desktop section
5. Release Notes - Document all changes

---

## 🐛 Known Potential Issues

1. **Windows Docker**: Bind mount performance (resolved by Task 2.3)
2. **Port Conflicts**: Ensure ports 6432, 8888 are available
3. **Health Check Timing**: May need adjustment for slower systems
4. **stdio Protocol**: Different from HTTP/SSE, requires testing
5. **File Permissions**: Claude Desktop config file location may vary

---

## 📈 Success Metrics

After implementation, you should see:
- **Query Performance**: 20-30% faster database queries
- **Connection Overhead**: 30x reduction with PgBouncer
- **Startup Time**: 10-100x faster container startup
- **Latency**: 1-5ms for Claude Desktop connections
- **Token Efficiency**: Better context handling in long conversations
- **User Experience**: One-click setup for both clients

---

## 🎯 Priority Labels for GitHub

- `P0-Critical`: Must have for release
- `P1-High`: Important for user experience
- `P2-Medium`: Nice to have
- `P3-Low`: Future enhancement

**Recommended Labels**:
- Tasks 1.1, 1.2, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3 → `P1-High`
- Task 4.4 → `P2-Medium`
- Tasks 3.1, 3.2 → `P3-Low`

---

## 💬 Questions for Clarification

Before starting implementation, verify:
1. [ ] Confirm mcp-writing-servers repo structure matches assumptions
2. [ ] Verify server file paths in server.js (Task 2.2)
3. [ ] Confirm target Claude Desktop version
4. [ ] Verify port availability (6432, 8888)
5. [ ] Confirm platform priority (Windows, macOS, Linux)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-15
**Next Review**: After Phase 1 completion
