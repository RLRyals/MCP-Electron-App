# Hello World Plugin

A simple example plugin for FictionLab that demonstrates the plugin API.

## Features

- Shows how to implement the `FictionLabPlugin` interface
- Registers custom IPC handlers
- Shows notifications
- Registers menu items with keyboard shortcuts
- Persists state using plugin configuration
- Uses the plugin logger
- Demonstrates read-only file system access

## Installation

### For Development

1. Build the plugin:
   ```bash
   npm install
   npm run build
   ```

2. Copy the plugin to FictionLab's plugins directory:
   ```bash
   # Windows
   xcopy /E /I . "%APPDATA%\fictionlab\plugins\hello-world\"

   # macOS/Linux
   cp -r . ~/Library/Application\ Support/fictionlab/plugins/hello-world/
   ```

3. Restart FictionLab

### For Distribution

Package the plugin directory with these files:
- `plugin.json` - Plugin manifest
- `dist/` - Compiled JavaScript
- `package.json` - Package metadata
- `README.md` - Documentation

Users can extract to their FictionLab plugins directory.

## Usage

Once installed and activated, the plugin adds:

### Menu Items
- **Plugins > Hello World > Show Hello Message** (Ctrl+Shift+H) - Shows a greeting
- **Plugins > Hello World > About Plugin** - Shows plugin information
- **Plugins > Hello World > Reset Counter** - Resets the click counter

### IPC Handlers

The plugin registers several IPC handlers that can be called from the renderer:

```javascript
// Get plugin info
const info = await window.api.invoke('plugin:hello-world:get-info');

// Say hello
const result = await window.api.invoke('plugin:hello-world:say-hello', 'Alice');

// Get statistics
const stats = await window.api.invoke('plugin:hello-world:get-stats');

// Test file system
const fsTest = await window.api.invoke('plugin:hello-world:test-filesystem');

// Reset counter
await window.api.invoke('plugin:hello-world:reset-count');
```

## Development

### Building
```bash
npm run build
```

### Watching for changes
```bash
npm run watch
```

### Cleaning build artifacts
```bash
npm run clean
```

## Plugin Structure

```
hello-world-plugin/
├── plugin.json          # Plugin manifest
├── package.json         # NPM package configuration
├── tsconfig.json        # TypeScript configuration
├── README.md            # This file
├── src/
│   └── index.ts         # Plugin source code
└── dist/
    └── index.js         # Compiled output (created by build)
```

## Learning Points

This plugin demonstrates:

1. **Plugin Lifecycle**
   - `onActivate()` - Initialize plugin, register handlers
   - `onDeactivate()` - Cleanup, save state

2. **Configuration Storage**
   - Persist state across sessions
   - Get/set configuration values

3. **IPC Communication**
   - Register custom handlers
   - Automatic channel prefixing (`plugin:hello-world:*`)

4. **UI Integration**
   - Show notifications
   - Register menu items
   - Show dialogs

5. **Logging**
   - Use plugin logger for debugging
   - Automatic log prefixing

6. **Services**
   - Environment service (app version, dev mode)
   - File system service (readonly mode)
   - Workspace information

## Next Steps

To build your own plugin:

1. Copy this example as a template
2. Update `plugin.json` with your plugin details
3. Implement your plugin logic in `src/index.ts`
4. Request necessary permissions in `plugin.json`
5. Build and test
6. Distribute to users

See the [Plugin Development Guide](../../docs/plugin-development-guide.md) for detailed documentation.
