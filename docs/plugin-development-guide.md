# FictionLab Plugin Development Guide

This guide explains how to create plugins for FictionLab, the MCP Electron App that provides infrastructure for non-technical genre fiction authors.

## Table of Contents

1. [Overview](#overview)
2. [Plugin Architecture](#plugin-architecture)
3. [Getting Started](#getting-started)
4. [Plugin Manifest](#plugin-manifest)
5. [Plugin Implementation](#plugin-implementation)
6. [Services & APIs](#services--apis)
7. [Permissions](#permissions)
8. [UI Integration](#ui-integration)
9. [Testing](#testing)
10. [Distribution](#distribution)
11. [Best Practices](#best-practices)

---

## Overview

FictionLab supports a plugin system that allows developers to extend the application with custom functionality. Plugins can:

- Add new features and workflows
- Integrate with MCP servers
- Access the PostgreSQL database
- Register custom UI components and menu items
- Provide specialized tools for authors

### Plugin Capabilities

- **Database Access**: Query and modify the PostgreSQL database
- **MCP Integration**: Call tools on MCP servers
- **File System**: Read/write files in the workspace
- **IPC Communication**: Register custom handlers for renderer communication
- **UI Elements**: Add menu items, show notifications and dialogs
- **Configuration**: Persist plugin-specific settings

---

## Plugin Architecture

### Plugin Lifecycle

```
Plugin Discovery → Load Manifest → Validate → Load Code → Activate → Running
                                                                     ↓
                                                        Deactivate ← User/System
```

1. **Discovery**: FictionLab scans the plugins directory for `plugin.json` files
2. **Load Manifest**: Validates the plugin manifest
3. **Validate**: Checks version compatibility, dependencies, and permissions
4. **Load Code**: Requires the entry point module
5. **Activate**: Calls `onActivate()` with PluginContext
6. **Running**: Plugin is active and can handle events
7. **Deactivate**: Calls `onDeactivate()` for cleanup

### Directory Structure

```
~/.fictionlab/plugins/         (Windows: %APPDATA%\fictionlab\plugins\)
└── your-plugin-id/
    ├── plugin.json            # Required: Plugin manifest
    ├── dist/
    │   └── index.js           # Required: Compiled entry point
    ├── src/                   # Optional: Source code
    ├── package.json           # Optional: NPM metadata
    ├── README.md              # Recommended: Documentation
    └── node_modules/          # Optional: Dependencies
```

---

## Getting Started

### 1. Create Plugin Directory

```bash
mkdir -p ~/.fictionlab/plugins/my-plugin
cd ~/.fictionlab/plugins/my-plugin
```

### 2. Initialize NPM Package

```bash
npm init -y
npm install --save-dev typescript @types/node
```

### 3. Create Plugin Manifest

Create `plugin.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A custom FictionLab plugin",
  "author": "Your Name",
  "fictionLabVersion": ">=0.1.0",
  "pluginType": "utility",
  "entry": {
    "main": "dist/index.js"
  },
  "permissions": {
    "database": false,
    "mcp": [],
    "fileSystem": false,
    "network": false,
    "childProcesses": false
  }
}
```

### 4. Create Plugin Code

Create `src/index.ts`:

```typescript
import { FictionLabPlugin, PluginContext } from '../../../src/types/plugin-api';

export default class MyPlugin implements FictionLabPlugin {
  readonly id = 'my-plugin';
  readonly name = 'My Plugin';
  readonly version = '1.0.0';

  async onActivate(context: PluginContext): Promise<void> {
    context.logger.info('Plugin activated!');

    context.ui.showNotification({
      type: 'success',
      message: 'My Plugin is now active',
      duration: 3000,
    });
  }

  async onDeactivate(): Promise<void> {
    // Cleanup
  }
}

module.exports = MyPlugin;
```

### 5. Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 6. Build and Test

```bash
npm run build  # or: tsc
# Restart FictionLab
```

---

## Plugin Manifest

The `plugin.json` file defines your plugin's metadata and requirements.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (lowercase, alphanumeric, hyphens) |
| `name` | string | Human-readable plugin name |
| `version` | string | Semantic version (e.g., "1.0.0") |
| `description` | string | Short description of functionality |
| `author` | string | Plugin author name or organization |
| `fictionLabVersion` | string | Compatible FictionLab version range (semver) |
| `pluginType` | string | Type: `execution-engine`, `client`, `reporting`, `utility`, `integration` |
| `entry.main` | string | Path to compiled entry point (relative to plugin root) |
| `permissions` | object | Requested permissions |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `entry.renderer` | string | Renderer process bundle path |
| `ui` | object | UI integration configuration |
| `mcpIntegration` | object | MCP server requirements |
| `dependencies` | object | Plugin and MCP dependencies |
| `configSchema` | object | Configuration schema definition |

### Example Manifest

```json
{
  "id": "workflow-automation",
  "name": "Workflow Automation Plugin",
  "version": "2.1.0",
  "description": "Automates multi-book series workflows",
  "author": "Author Tools Inc",
  "fictionLabVersion": ">=0.1.0",
  "pluginType": "execution-engine",

  "entry": {
    "main": "dist/index.js",
    "renderer": "dist/renderer.bundle.js"
  },

  "permissions": {
    "database": ["public", "workflow"],
    "mcp": ["workflow-manager", "book-planning"],
    "fileSystem": true,
    "network": true,
    "childProcesses": true
  },

  "dependencies": {
    "mcpServers": [
      { "id": "workflow-manager", "version": ">=1.0.0" }
    ],
    "plugins": ["reporting-plugin"]
  },

  "ui": {
    "mainView": "WorkflowDashboard",
    "menuItems": [
      {
        "label": "Workflow Automation",
        "submenu": ["New Workflow", "Active Jobs", "Settings"]
      }
    ],
    "settingsPanel": "WorkflowSettings"
  },

  "configSchema": {
    "maxConcurrentJobs": {
      "type": "number",
      "default": 3,
      "description": "Maximum concurrent workflow jobs"
    },
    "autoRetry": {
      "type": "boolean",
      "default": true,
      "description": "Automatically retry failed jobs"
    }
  }
}
```

---

## Plugin Implementation

### FictionLabPlugin Interface

All plugins must implement this interface:

```typescript
export interface FictionLabPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  onActivate(context: PluginContext): Promise<void>;
  onDeactivate(): Promise<void>;
  onConfigChange?(config: Record<string, any>): Promise<void>;
}
```

### Minimal Plugin

```typescript
import { FictionLabPlugin, PluginContext } from '../../../src/types/plugin-api';

export default class MinimalPlugin implements FictionLabPlugin {
  readonly id = 'minimal';
  readonly name = 'Minimal Plugin';
  readonly version = '1.0.0';

  async onActivate(context: PluginContext): Promise<void> {
    context.logger.info('Activated');
  }

  async onDeactivate(): Promise<void> {
    // Cleanup
  }
}

module.exports = MinimalPlugin;
```

### Plugin with State

```typescript
export default class StatefulPlugin implements FictionLabPlugin {
  readonly id = 'stateful';
  readonly name = 'Stateful Plugin';
  readonly version = '1.0.0';

  private context: PluginContext | null = null;
  private timer: NodeJS.Timeout | null = null;

  async onActivate(context: PluginContext): Promise<void> {
    this.context = context;

    // Load persisted state
    const lastRun = context.config.get<string>('lastRun');
    if (lastRun) {
      context.logger.info(`Last run: ${lastRun}`);
    }

    // Start background task
    this.timer = setInterval(() => {
      this.doWork();
    }, 60000);

    context.logger.info('Activated with state');
  }

  async onDeactivate(): Promise<void> {
    // Save state
    if (this.context) {
      await this.context.config.set('lastRun', new Date().toISOString());
    }

    // Cleanup
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.context = null;
  }

  private doWork(): void {
    this.context?.logger.debug('Doing background work...');
  }
}

module.exports = StatefulPlugin;
```

---

## Services & APIs

The `PluginContext` provides access to FictionLab services.

### Database Service

Access PostgreSQL database (requires `database` permission):

```typescript
// Simple query
const users = await context.services.database.query(
  'SELECT * FROM users WHERE active = $1',
  [true]
);

// Transaction
await context.services.database.transaction(async (client) => {
  await client.query('INSERT INTO series (name) VALUES ($1)', ['My Series']);
  await client.query('INSERT INTO books (series_id, title) VALUES ($1, $2)', [1, 'Book 1']);
});

// Create plugin schema
await context.services.database.createPluginSchema();
const schemaName = context.services.database.getPluginSchema(); // "plugin_my_plugin"

// Use plugin schema
await context.services.database.query(
  `CREATE TABLE ${schemaName}.plugin_data (id SERIAL PRIMARY KEY, data JSONB)`
);
```

### MCP Service

Call tools on MCP servers (requires `mcp` permission):

```typescript
// Call a tool
const result = await context.services.mcp.callTool(
  'workflow-manager',
  'create_workflow',
  {
    series_id: 1,
    user_id: 1,
    concept: 'Epic fantasy trilogy'
  }
);

// Check server status
const isRunning = await context.services.mcp.isServerRunning('book-planning');

// Get server info
const serverInfo = await context.services.mcp.getServerInfo('workflow-manager');
console.log(serverInfo.tools); // Available tools
```

### File System Service

Read/write files (requires `fileSystem` permission):

```typescript
// Read file
const content = await context.services.fileSystem.readFile('/path/to/file.txt');

// Write file
await context.services.fileSystem.writeFile('/path/to/output.json', JSON.stringify(data));

// Check existence
const exists = await context.services.fileSystem.exists('/path/to/file');

// Create directory
await context.services.fileSystem.mkdir('/path/to/dir', true); // recursive

// List directory
const files = await context.services.fileSystem.readdir('/path/to/dir');

// Get file stats
const stats = await context.services.fileSystem.stat('/path/to/file');
console.log(stats.size, stats.modified);
```

### Environment Service

Access environment information (always allowed):

```typescript
const appVersion = context.services.environment.getAppVersion();
const isDev = context.services.environment.isDevelopment();
const userDataPath = context.services.environment.getUserDataPath();
const envVar = context.services.environment.get('NODE_ENV');
```

### IPC Communication

Register handlers for renderer communication:

```typescript
// Register handler (automatically prefixed with "plugin:my-plugin:")
context.ipc.handle('do-something', async (event, arg1, arg2) => {
  context.logger.info(`Handler called with ${arg1}, ${arg2}`);
  return { success: true, result: 'done' };
});

// From renderer, call with full channel name:
// const result = await window.api.invoke('plugin:my-plugin:do-something', 'foo', 'bar');

// Get full channel name
const fullChannel = context.ipc.getChannelName('do-something');
// Returns: "plugin:my-plugin:do-something"
```

### Logger

Structured logging with automatic prefixing:

```typescript
context.logger.info('Information message');
context.logger.warn('Warning message');
context.logger.error('Error message', errorObject);
context.logger.debug('Debug message (dev only)');
```

### Configuration Storage

Persist plugin-specific configuration:

```typescript
// Get value with default
const maxJobs = context.config.get('maxJobs', 3);

// Set value
await context.config.set('maxJobs', 5);

// Check if key exists
if (context.config.has('apiKey')) {
  // ...
}

// Get all config
const allConfig = context.config.all();

// Delete key
await context.config.delete('oldSetting');

// Clear all
await context.config.clear();
```

---

## Permissions

Plugins must declare required permissions in `plugin.json`.

### Database Permission

```json
{
  "permissions": {
    "database": true  // Full access to all schemas
  }
}
```

or

```json
{
  "permissions": {
    "database": ["public", "workflow", "reporting"]  // Specific schemas only
  }
}
```

Plugins automatically get access to their own schema (`plugin_[plugin_id]`).

### MCP Permission

```json
{
  "permissions": {
    "mcp": ["workflow-manager", "book-planning", "chapter-planning"]
  }
}
```

### File System Permission

```json
{
  "permissions": {
    "fileSystem": true  // Read and write
  }
}
```

or

```json
{
  "permissions": {
    "fileSystem": "readonly"  // Read only
  }
}
```

### Other Permissions

```json
{
  "permissions": {
    "network": true,           // HTTP requests
    "childProcesses": true,    // Spawn processes
    "docker": true,            // Docker API access
    "clipboard": true,         // Clipboard access
    "dialogs": true            // Native dialogs
  }
}
```

---

## UI Integration

### Notifications

```typescript
context.ui.showNotification({
  type: 'success',  // 'info', 'success', 'warning', 'error'
  title: 'Task Complete',
  message: 'Your workflow has finished',
  duration: 5000,  // milliseconds, 0 = persistent
  actions: [
    {
      label: 'View Results',
      action: () => {
        // Handle action
      }
    }
  ]
});
```

### Dialogs

```typescript
const result = await context.ui.showDialog({
  type: 'question',
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  detail: 'This action cannot be undone.',
  buttons: ['Cancel', 'Proceed'],
  defaultId: 1,
  cancelId: 0
});

if (result.response === 1) {
  // User clicked "Proceed"
}
```

### Menu Items

```typescript
context.ui.registerMenuItem({
  id: 'my-menu-item',
  label: 'My Action',
  accelerator: 'CmdOrCtrl+Shift+M',
  click: () => {
    context.logger.info('Menu item clicked');
  }
});

// With submenu
context.ui.registerMenuItem({
  id: 'my-submenu',
  label: 'My Menu',
  submenu: [
    {
      id: 'action-1',
      label: 'Action 1',
      click: () => { /* ... */ }
    },
    {
      id: 'separator',
      type: 'separator'
    },
    {
      id: 'action-2',
      label: 'Action 2',
      enabled: false
    }
  ]
});
```

---

## Testing

### Manual Testing

1. Build plugin: `npm run build`
2. Copy to plugins directory
3. Restart FictionLab
4. Check logs for activation messages
5. Test functionality

### Automated Testing

Create `src/__tests__/plugin.test.ts`:

```typescript
import MyPlugin from '../index';

describe('MyPlugin', () => {
  let plugin: MyPlugin;
  let mockContext: any;

  beforeEach(() => {
    plugin = new MyPlugin();
    mockContext = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      config: {
        get: jest.fn(),
        set: jest.fn(),
      },
      // ... other mock services
    };
  });

  test('activates successfully', async () => {
    await plugin.onActivate(mockContext);
    expect(mockContext.logger.info).toHaveBeenCalled();
  });

  test('deactivates cleanly', async () => {
    await plugin.onActivate(mockContext);
    await plugin.onDeactivate();
    // Verify cleanup
  });
});
```

---

## Distribution

### Packaging

1. Build the plugin: `npm run build`
2. Create a distribution package with:
   - `plugin.json`
   - `dist/` directory
   - `README.md`
   - `LICENSE` (if applicable)

### Installation Instructions

Users install by:

1. Downloading/extracting plugin to `~/.fictionlab/plugins/[plugin-id]/`
2. Restarting FictionLab
3. Plugin loads automatically if valid

### Versioning

Follow semantic versioning:
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes

Update `version` in both `plugin.json` and your plugin class.

---

## Best Practices

### 1. Resource Management

✅ **Good**: Clean up resources in `onDeactivate()`

```typescript
async onDeactivate(): Promise<void> {
  if (this.timer) clearInterval(this.timer);
  if (this.dbConnection) await this.dbConnection.end();
  await this.context.config.set('state', this.state);
}
```

❌ **Bad**: Leaving resources open

### 2. Error Handling

✅ **Good**: Handle and log errors

```typescript
try {
  await context.services.database.query('SELECT ...');
} catch (error) {
  context.logger.error('Database query failed:', error);
  context.ui.showNotification({
    type: 'error',
    message: 'Operation failed. Check logs for details.'
  });
}
```

### 3. Permission Requests

✅ **Good**: Request only needed permissions

```json
{
  "permissions": {
    "database": ["public"],  // Only public schema
    "fileSystem": "readonly"  // Read-only
  }
}
```

❌ **Bad**: Request excessive permissions

### 4. Logging

✅ **Good**: Use appropriate log levels

```typescript
context.logger.info('Major operation complete');
context.logger.debug('Detailed debug info');
context.logger.error('Operation failed', error);
```

### 5. Configuration

✅ **Good**: Provide defaults, validate user config

```typescript
const maxRetries = context.config.get('maxRetries', 3);
if (maxRetries < 1 || maxRetries > 10) {
  context.logger.warn('Invalid maxRetries, using default: 3');
}
```

### 6. IPC Channel Names

✅ **Good**: Use descriptive, namespaced names

```typescript
context.ipc.handle('create-workflow', ...);
context.ipc.handle('get-status', ...);
```

❌ **Bad**: Generic or conflicting names

### 7. Dependencies

✅ **Good**: Declare plugin dependencies

```json
{
  "dependencies": {
    "plugins": ["base-plugin"],
    "mcpServers": ["workflow-manager"]
  }
}
```

---

## Examples

See the [hello-world-plugin](../examples/hello-world-plugin) for a complete working example.

---

## API Reference

For detailed API documentation, see [plugin-api.ts](../src/types/plugin-api.ts).

---

## Support

- **Issues**: Report bugs on [GitHub](https://github.com/RLRyals/MCP-Electron-App/issues)
- **Discussions**: Ask questions in GitHub Discussions
- **Documentation**: Check [docs/](../docs/) for more guides

---

## License

Plugins can use any license. FictionLab itself is licensed under [see repository LICENSE file].
