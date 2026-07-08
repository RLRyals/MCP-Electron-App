# Verbose Logging Guide

This guide explains how to enable/disable verbose logging for troubleshooting.

## Overview

The app has two logging modes:

- **Normal mode (default)**: Shows `INFO`, `WARN`, and `ERROR` messages
- **Verbose mode**: Shows all messages including `DEBUG` level details

**Important**: File logs always capture ALL messages (including debug) regardless of the mode. The mode only affects what's shown in the console and UI.

## How Environment Config Logging Works

To reduce log noise, environment configuration (`.env` file) is only logged in full when:
1. **First time loaded** after app start
2. **When the config changes** (different values)
3. **When verbose mode is enabled** (resets the log detection)

Otherwise, you'll see a brief debug message: `"Loaded .env configuration (unchanged, skipping detailed log)"`

## Enable/Disable Verbose Logging

### Method 1: Using the UI (Recommended)

1. Navigate to **Settings → Logs** in the app
2. Click the **"Enable Verbose"** button (with 🔬 icon)
3. The button will turn orange and change to **"Disable Verbose"**
4. When enabled:
   - All debug messages will be shown in the logs
   - Environment config will be logged in full on next load
5. Click again to disable

### Method 2: Programmatically (Advanced)

If you have access to the renderer console or are debugging:

```javascript
// Enable verbose logging
await window.api.logger.enableVerbose();

// Disable verbose logging
await window.api.logger.disableVerbose();

// Check current log level
const level = await window.api.logger.getLogLevel();
console.log('Current log level:', level);

// Set specific log level
await window.api.logger.setLogLevel('debug'); // or 'info', 'warn', 'error'
```

## Providing Logs for Troubleshooting

When reporting issues, please provide logs:

1. **Enable verbose logging** using the button in Settings → Logs
2. **Reproduce the issue** you're experiencing
3. **Export logs** using one of these methods:
   - Click **"Export Logs"** button in Settings → Logs (exports current view)
   - Click **"Export Report"** button (exports comprehensive diagnostic report)
   - Manually locate log files at: `%APPDATA%\fictionlab\logs\main.log` (Windows)
4. **Attach the exported file** to your GitHub issue or support request

## Log File Locations

- **Windows**: `%APPDATA%\fictionlab\logs\main.log`
- **macOS**: `~/Library/Logs/fictionlab/main.log`
- **Linux**: `~/.config/fictionlab/logs/main.log`

## Understanding Log Levels

- **ERROR** 🔴: Critical issues that prevent functionality
- **WARN** 🟡: Potential problems or important notices
- **INFO** 🔵: General informational messages (default visibility)
- **DEBUG** 🔍: Detailed diagnostic information (verbose mode only)

## Tips

- **Keep verbose mode OFF** during normal use to reduce noise
- **Enable verbose mode** when troubleshooting specific issues
- **Log files are rotated** automatically (keeps last 5 files, max 10MB each)
- **Debug messages in file logs** are always available even when verbose is off

## Technical Details

### What Happens When You Enable Verbose Mode

1. Console log level is set to `debug` (from `info`)
2. Environment config logging detection is reset (forces full log on next load)
3. All subsequent debug-level logs become visible in the UI and console

### What's Logged at Each Level

**Normal Mode (`info`):**
- Application startup/shutdown
- Service status changes
- Configuration saves (only when changed)
- Warnings and errors

**Verbose Mode (`debug`):**
- All of the above, plus:
- Detailed function execution traces
- Full environment configuration on every load
- Port availability checks
- Database connection attempts
- MCP server communication details

## Related Files

- Implementation: [src/main/logger.ts](../src/main/logger.ts)
- Environment config: [src/main/env-config.ts](../src/main/env-config.ts)
- UI component: [src/renderer/components/LogsTab.ts](../src/renderer/components/LogsTab.ts)
- IPC handlers: [src/main/index.ts](../src/main/index.ts) (search for `logger:enable-verbose`)
