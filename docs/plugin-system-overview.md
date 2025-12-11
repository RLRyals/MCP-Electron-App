# FictionLab Plugin System Overview

## Introduction

The FictionLab Plugin System allows developers to extend the application with custom functionality while maintaining security and stability. This document provides an architectural overview of the plugin system.

## Architecture

### Components

1. **Plugin Loader** ([plugin-loader.ts](../src/main/plugin-loader.ts))
   - Discovers plugins in the plugins directory
   - Validates manifests and checks version compatibility
   - Loads plugin modules dynamically
   - Handles dependency resolution

2. **Plugin Registry** ([plugin-registry.ts](../src/main/plugin-registry.ts))
   - Manages the collection of loaded plugins
   - Tracks plugin states (loading, active, inactive, error)
   - Handles activation and deactivation
   - Emits events for plugin lifecycle changes

3. **Plugin Context** ([plugin-context.ts](../src/main/plugin-context.ts))
   - Provides the runtime environment for plugins
   - Wraps core services with permission enforcement
   - Implements the PluginContext interface
   - Manages plugin-specific resources

4. **Plugin Manager** ([plugin-manager.ts](../src/main/plugin-manager.ts))
   - High-level API for the plugin system
   - Integrates with the main application
   - Handles UI integration (menus, notifications)
   - Coordinates database initialization

5. **Database Connection** ([database-connection.ts](../src/main/database-connection.ts))
   - Manages PostgreSQL connection pool
   - Provides database access to plugins
   - Handles connection lifecycle

## Plugin Lifecycle

```
┌─────────────────┐
│  Discovery      │  Plugin Loader scans plugins directory
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Validation     │  Manifest validation, version checks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Loading        │  Require plugin module, instantiate
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Registration   │  Add to plugin registry
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Activation     │  Call onActivate(), setup services
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Running        │  Handle events, process requests
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Deactivation   │  Call onDeactivate(), cleanup
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Unloading      │  Clear module cache, remove from registry
└─────────────────┘
```

## Permission System

Plugins declare required permissions in `plugin.json`:

```json
{
  "permissions": {
    "database": true | false | string[],
    "mcp": string[],
    "fileSystem": true | false | "readonly",
    "network": boolean,
    "childProcesses": boolean,
    "docker": boolean
  }
}
```

Permission enforcement is implemented in the service wrappers within PluginContext:

- **Database**: Checks for `database` permission and validates schema access
- **MCP**: Verifies server ID is in allowed list
- **File System**: Enforces read-only mode if specified
- **Other services**: Check for specific permission flags

## Service Architecture

### PluginContext Structure

```typescript
PluginContext
├── services
│   ├── database: FictionLabDatabase
│   ├── mcp: MCPConnectionManager
│   ├── fileSystem: FileSystemService
│   ├── docker: DockerService (optional)
│   └── environment: EnvironmentService
├── workspace: WorkspaceInfo
├── ipc: PluginIPC
├── ui: PluginUI
├── plugin: PluginMetadata
├── config: PluginConfigStorage
└── logger: PluginLogger
```

Each service is a wrapper that:
1. Checks permissions before executing operations
2. Logs operations for auditing
3. Handles errors gracefully
4. Provides a clean API to plugins

## Integration Points

### Main Application Integration

The plugin system integrates with the main application at these points:

1. **App Initialization** ([index.ts](../src/main/index.ts))
   - After main window is created
   - Database pool is initialized
   - Plugin manager discovers and loads plugins
   - Plugins are activated automatically

2. **Menu System**
   - Plugin menu items are added dynamically
   - Updates when plugins are activated/deactivated

3. **IPC Handlers**
   - Plugin management IPC handlers (activate, deactivate, reload)
   - Plugin-specific handlers registered with prefixes

4. **App Shutdown**
   - Plugins are deactivated before app quits
   - Database connections closed
   - Resources cleaned up

## Database Integration

### Connection Pool

A single PostgreSQL connection pool is shared across:
- Main application
- All plugins
- MCP servers (via API)

Benefits:
- Efficient resource usage
- Centralized connection management
- Consistent transaction handling

### Plugin Schemas

Each plugin gets its own database schema:
- Schema name: `plugin_[plugin_id]`
- Automatically created on request
- Isolated from other plugins
- Can access shared schemas if permitted

Example:
```sql
-- Plugin: workflow-automation
CREATE SCHEMA plugin_workflow_automation;

CREATE TABLE plugin_workflow_automation.jobs (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER REFERENCES public.workflow_instances(workflow_id),
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Considerations

### Permission Enforcement

1. **Declaration**: Plugins declare permissions in manifest
2. **Validation**: Loader validates permission format
3. **Enforcement**: Services check permissions at runtime
4. **Auditing**: All operations are logged

### IPC Channel Isolation

Plugin IPC channels are automatically prefixed:
- Plugin ID: `my-plugin`
- Channel: `do-action`
- Full channel: `plugin:my-plugin:do-action`

This prevents:
- Channel name conflicts
- Plugins intercepting other plugins' messages
- Security vulnerabilities from name collisions

### File System Sandboxing

Plugins have limited file system access:
- Can read/write in plugin data directory
- Can access workspace with permission
- Cannot access system directories without explicit paths
- Read-only mode prevents modifications

## Event System

The Plugin Registry emits events for monitoring:

```typescript
registry.on('plugin-loaded', (pluginId, state) => { });
registry.on('plugin-activated', (pluginId, state) => { });
registry.on('plugin-deactivated', (pluginId) => { });
registry.on('plugin-error', (pluginId, error) => { });
registry.on('menu-item-registered', (pluginId, item) => { });
registry.on('notification', (pluginId, notification) => { });
```

These events allow:
- UI updates when plugins change
- Error monitoring and alerting
- Analytics and usage tracking
- Debugging and troubleshooting

## Error Handling

### Plugin Errors

Errors are categorized by type:
- `MANIFEST_INVALID`: Invalid or missing manifest
- `MANIFEST_NOT_FOUND`: No plugin.json file
- `ENTRY_POINT_NOT_FOUND`: Entry file doesn't exist
- `ENTRY_POINT_INVALID`: Entry doesn't export valid plugin
- `ACTIVATION_FAILED`: Error in onActivate()
- `DEACTIVATION_FAILED`: Error in onDeactivate()
- `PERMISSION_DENIED`: Attempted unauthorized operation
- `DEPENDENCY_MISSING`: Required dependency not available
- `VERSION_MISMATCH`: Incompatible version
- `ALREADY_LOADED`: Plugin already in registry
- `NOT_LOADED`: Plugin not found in registry

### Error Recovery

- Non-fatal errors are logged and displayed to user
- Plugin activation errors set status to 'error'
- Other plugins continue running
- Failed plugins can be reloaded after fixing issues

## Performance Considerations

### Lazy Loading

- Plugins discovered at startup
- Loaded on-demand or during initialization
- Module caching for fast access

### Resource Management

- Single database connection pool shared
- IPC handlers cleaned up on deactivation
- Timers and intervals should be cleared
- Event listeners should be removed

### Monitoring

Plugin statistics available:
```typescript
{
  total: number,
  active: number,
  inactive: number,
  error: number,
  loading: number
}
```

## Development Workflow

### 1. Create Plugin

```bash
mkdir ~/.fictionlab/plugins/my-plugin
cd ~/.fictionlab/plugins/my-plugin
npm init -y
# Create plugin files
npm run build
```

### 2. Test Plugin

- Restart FictionLab
- Check logs for activation
- Test functionality
- Verify cleanup on deactivation

### 3. Debug Plugin

- Use `context.logger` for debugging
- Check main process logs
- Use DevTools for renderer debugging
- Monitor plugin statistics

### 4. Reload Plugin

```javascript
// Via IPC from renderer
await window.api.invoke('plugins:reload', 'my-plugin');
```

Or restart FictionLab.

## Best Practices

### For Plugin Developers

1. **Clean up resources** in `onDeactivate()`
2. **Handle errors gracefully** with try-catch
3. **Log important operations** for debugging
4. **Validate user input** before processing
5. **Use typed interfaces** from plugin-api.ts
6. **Request minimal permissions** needed
7. **Test activation/deactivation** thoroughly
8. **Document IPC handlers** for users

### For FictionLab Developers

1. **Never break the plugin API** without major version
2. **Validate plugin manifests** strictly
3. **Enforce permissions** consistently
4. **Log security events** for auditing
5. **Provide clear error messages** to users
6. **Document API changes** in release notes
7. **Test with example plugins** before release
8. **Monitor plugin performance** impact

## Files Reference

### Core Files

- [src/types/plugin-api.ts](../src/types/plugin-api.ts) - TypeScript type definitions
- [src/main/plugin-loader.ts](../src/main/plugin-loader.ts) - Discovery and loading
- [src/main/plugin-registry.ts](../src/main/plugin-registry.ts) - State management
- [src/main/plugin-context.ts](../src/main/plugin-context.ts) - Runtime context
- [src/main/plugin-manager.ts](../src/main/plugin-manager.ts) - High-level API
- [src/main/database-connection.ts](../src/main/database-connection.ts) - DB pool management

### Example Plugin

- [examples/hello-world-plugin/](../examples/hello-world-plugin/) - Complete example

### Documentation

- [docs/plugin-development-guide.md](./plugin-development-guide.md) - Developer guide
- [docs/plugin-system-overview.md](./plugin-system-overview.md) - This document

## Future Enhancements

Potential improvements for future versions:

1. **Plugin Marketplace**
   - Central registry of plugins
   - One-click installation
   - Automatic updates

2. **Enhanced Permissions**
   - More granular file system access
   - Network domain restrictions
   - Process sandboxing

3. **Plugin Dependencies**
   - NPM-style dependency resolution
   - Automatic dependency installation
   - Version conflict detection

4. **Hot Reloading**
   - Reload plugins without restart
   - Preserve state during reload
   - Development mode enhancements

5. **Plugin Communication**
   - Inter-plugin messaging
   - Shared event bus
   - Plugin collaboration APIs

6. **Performance Monitoring**
   - CPU/memory usage tracking
   - Slow operation detection
   - Resource limit enforcement

7. **Plugin Sandboxing**
   - Process isolation for plugins
   - Separate V8 contexts
   - Enhanced security boundaries

## Conclusion

The FictionLab Plugin System provides a robust, secure, and extensible foundation for adding custom functionality to the application. It balances flexibility for developers with safety for users, enabling a rich ecosystem of plugins while maintaining system stability.

For plugin development, see the [Plugin Development Guide](./plugin-development-guide.md).
