# FictionLab App - Architecture Documentation

This document provides a technical overview of the FictionLab App architecture, module design, and system interactions.

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Diagram](#architecture-diagram)
- [Electron Architecture](#electron-architecture)
- [Module Overview](#module-overview)
- [IPC Communication](#ipc-communication)
- [Docker Integration](#docker-integration)
- [Database Schema](#database-schema)
- [File System Structure](#file-system-structure)
- [Security Model](#security-model)
- [State Management](#state-management)
- [Error Handling](#error-handling)
- [Logging System](#logging-system)

---

## System Overview

The FictionLab App is a desktop application that manages the MCP (Model Context Protocol) Writing System. It provides a graphical interface for setting up, configuring, and managing:

- PostgreSQL database (via Docker)
- MCP Servers (via Docker)
- AI client integrations (Typing Mind, Claude Desktop)
- System updates and maintenance

### Key Components

1. **Electron App** - Desktop application framework
2. **Docker Desktop** - Container runtime for services
3. **PostgreSQL** - Database for MCP data
4. **MCP Servers** - Context protocol servers
5. **AI Clients** - User interfaces (Typing Mind, Claude Desktop)

### Technology Stack

- **Frontend:** HTML, CSS, JavaScript (vanilla)
- **Backend:** TypeScript, Node.js (Electron main process)
- **Build:** TypeScript Compiler, Electron Builder
- **Runtime:** Electron, Docker
- **Database:** PostgreSQL (containerized)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FictionLab App                          │
│                                                                   │
│  ┌───────────────────┐         ┌─────────────────────────────┐  │
│  │  Renderer Process │◄───IPC──┤     Main Process             │  │
│  │                   │         │                               │  │
│  │  - HTML/CSS/JS    │         │  - Prerequisites Check       │  │
│  │  - User Interface │         │  - Docker Management         │  │
│  │  - Dashboard      │         │  - Environment Config        │  │
│  │  - Setup Wizard   │         │  - Client Selection          │  │
│  │                   │         │  - Typing Mind Downloader    │  │
│  └───────────────────┘         │  - MCP System Control        │  │
│                                │  - Updater                    │  │
│  ┌───────────────────┐         │  - Logger & Diagnostics      │  │
│  │  Preload Script   │         │                               │  │
│  │                   │         └──────────┬────────────────────┘  │
│  │  - Context Bridge │                    │                       │
│  │  - IPC Handlers   │                    │ Docker API            │
│  └───────────────────┘                    │ File System           │
│                                           │ Child Process          │
└───────────────────────────────────────────┼───────────────────────┘
                                           │
                                           ▼
                        ┌──────────────────────────────────┐
                        │       Docker Desktop              │
                        │                                   │
                        │  ┌─────────────────────────────┐ │
                        │  │   PostgreSQL Container       │ │
                        │  │   Port: 5432                 │ │
                        │  │   Volume: mcp-postgres-data  │ │
                        │  └─────────────────────────────┘ │
                        │                                   │
                        │  ┌─────────────────────────────┐ │
                        │  │   MCP Servers Container      │ │
                        │  │   Connected to PostgreSQL    │ │
                        │  └─────────────────────────────┘ │
                        │                                   │
                        │  ┌─────────────────────────────┐ │
                        │  │   Typing Mind Container      │ │
                        │  │   Port: 3000                 │ │
                        │  └─────────────────────────────┘ │
                        │                                   │
                        └───────────────────────────────────┘
                                           │
                                           ▼
                        ┌──────────────────────────────────┐
                        │       AI Clients                  │
                        │                                   │
                        │  - Typing Mind (browser)          │
                        │  - Claude Desktop (native app)    │
                        │                                   │
                        └───────────────────────────────────┘
```

---

## Electron Architecture

### Three-Process Model

The app follows Electron's security best practices with three isolated processes:

#### 1. Main Process (`src/main/`)

**Responsibilities:**
- Application lifecycle management
- Window creation and management
- System-level operations (Docker, file system)
- IPC handler registration
- Native API access

**Key Files:**
- `index.ts` - Entry point, window creation, IPC setup
- `*.ts` - Feature modules (docker, env-config, etc.)

**Environment:** Node.js with full system access

#### 2. Renderer Process (`src/renderer/`)

**Responsibilities:**
- User interface rendering
- User interaction handling
- State display and updates
- IPC client communication

**Key Files:**
- `index.html` - Main UI markup
- `renderer.ts` - UI logic and event handlers

**Environment:** Chromium browser, sandboxed

#### 3. Preload Script (`src/preload/`)

**Responsibilities:**
- Secure bridge between main and renderer
- Context isolation enforcement
- Limited API exposure via `contextBridge`

**Key Files:**
- `preload.ts` - IPC bridge, API exposure

**Environment:** Isolated context with controlled access

### Security Configuration

```typescript
webPreferences: {
  preload: path.join(__dirname, '../preload/preload.js'),
  contextIsolation: true,    // Separate preload/renderer contexts
  nodeIntegration: false,    // Disable Node in renderer
  sandbox: true,             // Enable sandbox
}
```

**Content Security Policy:**
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">
```

---

## Module Overview

### 1. Prerequisites Check (`prerequisites.ts`)

**Purpose:** Verify system requirements before setup

**Features:**
- Docker Desktop detection
- Docker version checking
- Git installation check
- WSL status (Windows)
- Platform information

**IPC Handlers:**
- `prerequisites:check-docker`
- `prerequisites:check-docker-running`
- `prerequisites:check-git`
- `prerequisites:check-wsl`
- `prerequisites:check-all`

### 2. Docker Management (`docker.ts`)

**Purpose:** Control Docker Desktop and manage health

**Features:**
- Start/stop/restart Docker Desktop
- Wait for Docker to be ready
- Health checks
- Container status monitoring
- Progress callbacks for long operations

**IPC Handlers:**
- `docker:start`
- `docker:stop`
- `docker:restart`
- `docker:wait-ready`
- `docker:health-check`
- `docker:containers-status`

**Platform-Specific Behavior:**
- **Windows:** Uses `Docker Desktop.exe`
- **macOS:** Uses `open -a Docker`
- **Linux:** Uses `systemctl` for Docker service

### 3. Environment Configuration (`env-config.ts`)

**Purpose:** Manage `.env` file for Docker Compose

**Features:**
- Load/save configuration
- Generate secure passwords
- Generate auth tokens
- Port availability checking
- Configuration validation
- Password strength calculation

**IPC Handlers:**
- `env:get-config`
- `env:save-config`
- `env:generate-password`
- `env:generate-token`
- `env:check-port`
- `env:validate-config`

**Configuration Schema:**
```typescript
interface EnvConfig {
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_PORT: number;
  MCP_CONNECTOR_PORT: number;
  TYPING_MIND_PORT: number;
  MCP_AUTH_TOKEN: string;
}
```

### 4. Installation Wizard (`installation-wizard.ts`)

**Purpose:** Guide users through Docker Desktop installation

**Features:**
- Platform-specific instructions
- Download URL generation
- Command copying to clipboard
- Step-by-step guidance
- "Why Docker?" explanation

**IPC Handlers:**
- `wizard:get-instructions`
- `wizard:get-download-url`
- `wizard:open-download`
- `wizard:copy-command`

### 5. Client Selection (`client-selection.ts`)

**Purpose:** Manage AI client installation choices

**Features:**
- Available clients list (Typing Mind, Claude Desktop)
- Save/load user selection
- Client status checking
- Client metadata management

**IPC Handlers:**
- `client:get-options`
- `client:save-selection`
- `client:get-selection`
- `client:get-status`
- `client:clear-selection`

**Client Data Structure:**
```typescript
interface ClientOption {
  id: string;
  name: string;
  description: string;
  type: 'web' | 'desktop';
  requiresDownload: boolean;
  requiresManualInstall: boolean;
  features: string[];
  requirements: string[];
}
```

### 6. Typing Mind Downloader (`typingmind-downloader.ts`)

**Purpose:** Download and install Typing Mind via Git

**Features:**
- Git clone Typing Mind repository
- Progress tracking
- Cancellation support
- Version detection
- Update checking

**IPC Handlers:**
- `typingmind:download`
- `typingmind:cancel-download`
- `typingmind:is-installed`
- `typingmind:get-version`
- `typingmind:check-updates`

**Download Process:**
1. Check Git availability
2. Clone repository to working directory
3. Report progress via callback
4. Verify successful installation

### 7. Docker Images (`docker-images.ts`)

**Purpose:** Pre-load bundled Docker images for offline use

**Features:**
- Load Docker images from tar files
- Bulk image loading
- Check image existence
- Disk space verification
- Progress tracking

**IPC Handlers:**
- `docker-images:load-all`
- `docker-images:load-image`
- `docker-images:check-exists`
- `docker-images:list`
- `docker-images:get-bundled`

**Bundled Images:**
- `postgres:16-alpine` - PostgreSQL database
- `mcp-servers:latest` - MCP servers (custom image)

### 8. MCP System Control (`mcp-system.ts`)

**Purpose:** Orchestrate Docker Compose services

**Features:**
- Start/stop/restart all services
- Individual service control
- Health monitoring
- Service logs retrieval
- Port conflict detection
- Service URL generation

**IPC Handlers:**
- `mcp-system:start`
- `mcp-system:stop`
- `mcp-system:restart`
- `mcp-system:status`
- `mcp-system:urls`
- `mcp-system:logs`
- `mcp-system:check-ports`

**Docker Compose Services:**
- `postgres` - PostgreSQL database
- `mcp-servers` - MCP protocol servers
- `mcp-connector` (optional) - HTTP connector
- `typing-mind` (optional) - Typing Mind UI

**Startup Sequence:**
1. Load environment configuration
2. Start Docker Compose
3. Wait for PostgreSQL to be healthy
4. Start MCP servers
5. Start optional services (Typing Mind)
6. Report ready status

### 9. Updater (`updater.ts`)

**Purpose:** Check for and install updates

**Features:**
- Check app updates (GitHub Releases)
- Check MCP servers updates (Docker Hub)
- Check Typing Mind updates (Git)
- Auto-check preferences
- Update all or individual components

**IPC Handlers:**
- `updater:check-all`
- `updater:check-mcp-servers`
- `updater:check-typing-mind`
- `updater:update-all`
- `updater:update-mcp-servers`
- `updater:update-typing-mind`
- `updater:get-preferences`
- `updater:set-preferences`

**Update Sources:**
- **FictionLab App:** GitHub Releases API
- **MCP Servers:** Docker Hub API
- **Typing Mind:** Git repository

### 10. Logger & Diagnostics (`logger.ts`, `diagnostics.ts`)

**Purpose:** Comprehensive logging and diagnostic tools

**Features:**
- Categorized logging (INFO, WARN, ERROR, DEBUG)
- Log rotation
- Log file access
- Diagnostic report generation
- System testing
- GitHub issue template generation

**IPC Handlers:**
- `logger:open`
- `logger:open-directory`
- `logger:export`
- `logger:test-system`
- `logger:get-logs`
- `logger:generate-issue-template`

**Log Categories:**
```typescript
enum LogCategory {
  SYSTEM = 'SYSTEM',
  PREREQUISITES = 'PREREQUISITES',
  DOCKER = 'DOCKER',
  DOCKER_IMAGE = 'DOCKER_IMAGE',
  SCRIPT = 'SCRIPT',
}
```

### 11. Setup Wizard (`setup-wizard.ts`)

**Purpose:** Orchestrate first-time setup flow

**Features:**
- Multi-step wizard state management
- Step validation
- Progress tracking
- Skip functionality
- State persistence

**Wizard Steps:**
1. Welcome
2. Prerequisites Check
3. Environment Configuration
4. Client Selection
5. Docker Images Download
6. Typing Mind Installation
7. Setup Complete

---

## IPC Communication

### Communication Flow

```
Renderer Process          Preload Script          Main Process
     │                          │                        │
     │  User clicks button      │                        │
     ├──────────────────────────►│                        │
     │  Call exposed API         │                        │
     │  window.electron.invoke() │                        │
     │                          │  ipcRenderer.invoke()  │
     │                          ├────────────────────────►│
     │                          │                        │
     │                          │  IPC Handler processes │
     │                          │  (async operation)     │
     │                          │                        │
     │                          │◄────────────────────────┤
     │                          │  Return result          │
     │◄──────────────────────────┤                        │
     │  Update UI                │                        │
```

### IPC Patterns

**1. Request-Response (Handle):**
```typescript
// Main Process
ipcMain.handle('docker:start', async () => {
  return await docker.startDockerDesktop();
});

// Renderer (via preload)
const result = await window.electron.invoke('docker:start');
```

**2. Event Broadcasting (Send):**
```typescript
// Main Process
mainWindow.webContents.send('docker:progress', {
  step: 'Starting Docker',
  progress: 50
});

// Renderer (via preload)
window.electron.on('docker:progress', (data) => {
  updateProgressBar(data.progress);
});
```

**3. Progress Callbacks:**
```typescript
// Pattern for long-running operations
const progressCallback = (progress) => {
  if (mainWindow) {
    mainWindow.webContents.send('operation:progress', progress);
  }
};

await longOperation(progressCallback);
```

### Exposed API (Preload)

```typescript
contextBridge.exposeInMainWorld('electron', {
  // Request-response
  invoke: (channel: string, ...args: any[]) =>
    ipcRenderer.invoke(channel, ...args),

  // Event listening
  on: (channel: string, callback: Function) =>
    ipcRenderer.on(channel, (_, data) => callback(data)),

  // Remove listener
  removeListener: (channel: string, callback: Function) =>
    ipcRenderer.removeListener(channel, callback)
});
```

---

## Docker Integration

### Docker Compose Configuration

The app uses Docker Compose to orchestrate multi-container deployment:

**Compose File:** `docker-compose.yml` (generated in MCP working directory)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "${POSTGRES_PORT}:5432"
    volumes:
      - mcp-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  mcp-servers:
    image: mcp-servers:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      MCP_AUTH_TOKEN: ${MCP_AUTH_TOKEN}
    ports:
      - "${MCP_CONNECTOR_PORT}:50880"

  typing-mind:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - ./typing-mind:/app
    ports:
      - "${TYPING_MIND_PORT}:3000"
    command: npm start

volumes:
  mcp-postgres-data:
```

### Container Management

**Starting Services:**
```typescript
async function startMCPSystem() {
  // 1. Verify Docker is running
  const dockerCheck = await docker.checkDockerRunning();

  // 2. Load environment configuration
  const config = await envConfig.loadEnvConfig();

  // 3. Start Docker Compose
  await exec('docker-compose up -d', { cwd: workingDir });

  // 4. Wait for services to be healthy
  await waitForPostgresHealth();
  await waitForMCPServersHealth();

  // 5. Return status
  return { success: true, services: ['postgres', 'mcp-servers'] };
}
```

**Health Checking:**
```typescript
async function waitForPostgresHealth() {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const result = await exec('docker exec mcp-postgres pg_isready -U mcp_user');
    if (result.exitCode === 0) {
      return true;
    }
    await sleep(1000);
  }
  throw new Error('PostgreSQL health check timeout');
}
```

### Volume Management

**Persistent Data:**
- `mcp-postgres-data` - PostgreSQL database files
- Bind mount: `./typing-mind` - Typing Mind source code

**Volume Backup:**
```bash
docker run --rm -v mcp-postgres-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

---

## Database Schema

The PostgreSQL database uses the MCP protocol schema:

### Tables

**1. `contexts`**
```sql
CREATE TABLE contexts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**2. `resources`**
```sql
CREATE TABLE resources (
  id SERIAL PRIMARY KEY,
  context_id INTEGER REFERENCES contexts(id),
  type VARCHAR(50) NOT NULL,
  uri TEXT NOT NULL,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**3. `tools`**
```sql
CREATE TABLE tools (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  schema JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_resources_context ON resources(context_id);
CREATE INDEX idx_resources_type ON resources(type);
CREATE INDEX idx_resources_uri ON resources(uri);
```

---

## File System Structure

### Application Data

```
MCP-Electron-App/
├── src/                          # Source code
│   ├── main/                     # Main process
│   │   ├── index.ts              # Entry point
│   │   ├── prerequisites.ts      # Prerequisites checking
│   │   ├── docker.ts             # Docker management
│   │   ├── env-config.ts         # Environment config
│   │   ├── installation-wizard.ts
│   │   ├── client-selection.ts
│   │   ├── typingmind-downloader.ts
│   │   ├── docker-images.ts
│   │   ├── mcp-system.ts
│   │   ├── updater.ts
│   │   ├── logger.ts
│   │   ├── diagnostics.ts
│   │   ├── setup-wizard.ts
│   │   └── utils/                # Utility functions
│   ├── renderer/                 # Renderer process
│   │   ├── index.html            # Main UI
│   │   └── renderer.ts           # UI logic
│   └── preload/                  # Preload scripts
│       └── preload.ts            # IPC bridge
├── resources/                    # Build resources
│   ├── docker-images/            # Bundled Docker images
│   └── icons/                    # App icons
├── dist/                         # Compiled TypeScript
├── out/                          # Built installers
├── docs/                         # Documentation
├── package.json
├── tsconfig.json
└── README.md
```

### User Data Locations

**Windows:**
```
%APPDATA%\mcp-electron-app\
├── config.json                   # App configuration
├── client-selection.json         # Selected clients
├── update-preferences.json       # Update settings
└── logs\                         # Application logs
    └── app.log

%USERPROFILE%\mcp-writing-system\
├── .env                          # Environment variables
├── docker-compose.yml            # Docker Compose config
└── typing-mind\                  # Typing Mind source (if installed)
```

**macOS:**
```
~/Library/Application Support/mcp-electron-app/
~/Library/Logs/mcp-electron-app/
~/mcp-writing-system/
```

**Linux:**
```
~/.config/mcp-electron-app/
~/.local/share/mcp-electron-app/logs/
~/mcp-writing-system/
```

---

## Security Model

### Electron Security

**1. Context Isolation:**
- Renderer process cannot access Node.js directly
- Preload script runs in isolated context
- Only exposed APIs are available to renderer

**2. Sandboxing:**
- Renderer process runs in Chromium sandbox
- Limited system access
- Cannot spawn processes or access filesystem

**3. Content Security Policy:**
- Restricts script sources to 'self' only
- Prevents XSS attacks
- Blocks inline scripts (except whitelisted)

### Secrets Management

**1. Password Generation:**
```typescript
function generatePassword(length = 32): string {
  // Uses crypto.randomBytes for secure random generation
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
  // Avoids shell-unsafe characters
  return randomString(length, charset);
}
```

**2. Token Generation:**
```typescript
function generateAuthToken(): string {
  // 64 character hexadecimal token
  return crypto.randomBytes(32).toString('hex');
}
```

**3. Storage:**
- Secrets stored in `.env` file with restrictive permissions
- Never logged or displayed in UI (masked)
- Not included in diagnostic reports

### Docker Security

**1. Network Isolation:**
- Docker Compose creates isolated network
- Services communicate via internal network only
- Ports exposed only as configured

**2. Volume Security:**
- Named volumes for data persistence
- Proper permissions on mounted directories

---

## State Management

### App State

State is distributed across:

**1. Main Process:**
- In-memory: Current operation status, window references
- Persistent: Configuration files (JSON)

**2. Renderer Process:**
- DOM state: UI elements, form values
- Event-driven: Updates via IPC messages

**3. Filesystem:**
- Configuration files
- Environment variables (.env)
- Logs

### State Synchronization

```typescript
// Main process updates → Renderer via IPC
mainWindow.webContents.send('state-update', newState);

// Renderer requests state → Main process via IPC
const state = await window.electron.invoke('get-state');

// State persistence
await saveConfig(newState);
```

---

## Error Handling

### Error Propagation

```typescript
// Main process
ipcMain.handle('operation', async () => {
  try {
    const result = await riskyOperation();
    return { success: true, data: result };
  } catch (error) {
    logger.error('Operation failed', error);
    return { success: false, error: error.message };
  }
});

// Renderer process
const result = await window.electron.invoke('operation');
if (!result.success) {
  showError(result.error);
}
```

### Error Dialog

Critical errors show native dialog:
```typescript
import { dialog } from 'electron';

dialog.showErrorBox(
  'Critical Error',
  'Docker Desktop is not installed. Please install Docker Desktop to continue.'
);
```

### Error Logging

All errors are logged with context:
```typescript
logger.error('Docker operation failed', {
  operation: 'start',
  error: error.message,
  stack: error.stack
});
```

---

## Logging System

### Log Levels

- **INFO:** Normal operations, user actions
- **WARN:** Potential issues, degraded operation
- **ERROR:** Failures, exceptions
- **DEBUG:** Detailed diagnostic information

### Log Categories

```typescript
enum LogCategory {
  SYSTEM,       // App lifecycle, general operations
  PREREQUISITES,// Prerequisites checking
  DOCKER,       // Docker operations
  DOCKER_IMAGE, // Image loading
  SCRIPT,       // Scripts (Typing Mind download, etc.)
}
```

### Log Format

```
[2024-01-15 14:23:45] [INFO] [DOCKER] Starting Docker Desktop...
[2024-01-15 14:24:02] [INFO] [DOCKER] Docker Desktop started successfully
[2024-01-15 14:24:05] [ERROR] [SYSTEM] Failed to load configuration: ENOENT
```

### Log Rotation

- Max file size: 10MB
- Keep: 5 log files
- Rotation: Automatic when size exceeded

### Diagnostic Export

Generates ZIP file containing:
- All log files
- System information
- Configuration (sanitized - no secrets)
- Docker status
- Service status

---

## Build and Deployment

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and [RELEASE-PROCESS.md](RELEASE-PROCESS.md) for release workflow.

---

## Future Architecture Improvements

### Planned Enhancements

1. **State Management Library:**
   - Implement Redux or similar for complex state
   - Better state synchronization between processes

2. **Plugin System:**
   - Allow third-party extensions
   - Pluggable AI clients

3. **Database Migrations:**
   - Automated schema updates
   - Version management

4. **WebSocket Communication:**
   - Real-time updates from Docker containers
   - Live log streaming

5. **Testing Infrastructure:**
   - Unit tests for all modules
   - Integration tests for IPC
   - E2E tests for UI flows

---

## Questions?

For more information:
- **User Documentation:** [USER-GUIDE.md](USER-GUIDE.md)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Issues:** [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues)
