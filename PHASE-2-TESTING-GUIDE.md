# Phase 2: Plugin Embedding - Testing Guide

## Overview

Phase 2 focuses on testing and validating the plugin embedding system implemented in Phase 1. This guide provides comprehensive testing procedures to ensure plugins work correctly when embedded in the main window using `<webview>` tags.

---

## What Changed from Old System

### Before (Separate Windows)
- Each plugin opened in a separate `BrowserWindow`
- Managed by `plugin-views.ts` (now deprecated)
- IPC handlers: `plugin:show-view`, `plugin:hide-view`, `plugin:close-view`
- User had to manage multiple windows

### After (Embedded in Main Window)
- Plugins load in `<webview>` tags within main content area
- Managed by `PluginContainer.ts` component
- New IPC handler: `plugin:get-view-url` (returns URL for embedding)
- Single window with sidebar navigation
- Fast switching via ViewRouter

---

## Architecture Overview

### Component Flow

```
User Action (Click plugin in sidebar/menu)
    ↓
plugin-handlers.ts → handlePluginAction()
    ↓
ViewRouter.navigateTo('plugin', { pluginId, viewName })
    ↓
PluginContainer.loadPlugin(pluginId, viewName)
    ↓
IPC: plugin:get-view-url → Returns plugin HTML path
    ↓
Create <webview> element with:
  - src: file:///path/to/plugin/dist/renderer/index.html?view=ViewName
  - partition: plugin-${pluginId} (isolation)
  - preload: plugin-view-preload.js (same as before)
    ↓
Plugin renders in main content area
```

### File Structure

**Core Components:**
- [src/renderer/components/PluginContainer.ts](src/renderer/components/PluginContainer.ts) - Webview manager
- [src/renderer/components/ViewRouter.ts](src/renderer/components/ViewRouter.ts) - Navigation controller
- [src/renderer/plugin-handlers.ts](src/renderer/plugin-handlers.ts) - Plugin action dispatcher

**IPC Handlers:**
- [src/main/index.ts](src/main/index.ts#L2165-L2190) - `plugin:get-view-url` handler
- [src/preload/preload.ts](src/preload/preload.ts) - `electronAPI.plugins.getViewUrl()`

---

## Testing Checklist

### 1. Plugin Discovery & Loading

**Objective**: Verify plugins are discovered and listed correctly

**Steps**:
1. Launch the application
2. Navigate to **Plugins** section in sidebar
3. Verify PluginsLauncher view shows all available plugins
4. Check that each plugin card displays:
   - Icon (or default 🔌)
   - Name
   - Description
   - Version
   - Status (Active/Inactive)

**Expected Result**:
- All plugins in `%APPDATA%/fictionlab/plugins` directory are listed
- Active plugins show "Launch" button
- Inactive plugins are grayed out

**Known Plugins** (from logs):
- `bq-studio` - Active plugin for book series orchestration

---

### 2. Plugin Embedding (Main Test)

**Objective**: Verify plugins load in main window, not separate windows

**Steps**:
1. Click "Launch" on an active plugin (e.g., bq-studio)
2. **OR** Use menu: Plugins → [Plugin Name] → [View Name]
3. Observe where the plugin UI appears

**Expected Result**:
- ✅ Plugin loads **inside** main content area (right side)
- ✅ Sidebar remains visible on left
- ✅ Top bar updates with plugin title (e.g., "Plugin: BQ Studio")
- ✅ No new BrowserWindow opens
- ✅ Console log: `[PluginContainer] Plugin loaded successfully: bq-studio`

**Failure Indicators**:
- ❌ New window opens (old behavior - means integration failed)
- ❌ Error in console: `ViewRouter not initialized`
- ❌ White screen in content area
- ❌ Console error: `Failed to load plugin`

---

### 3. Plugin Isolation

**Objective**: Ensure plugins run in isolated context

**Steps**:
1. Load a plugin in main window
2. Open DevTools (F12 or Ctrl+Shift+I)
3. Check the `<webview>` element in DOM inspector
4. Right-click webview → "Inspect Element" (opens plugin DevTools)

**Expected Result**:
- Webview has `partition="plugin-bq-studio"` attribute
- Plugin has separate DevTools instance
- Plugin cannot access host window globals directly
- Plugin uses `preload` script for IPC (`plugin-view-preload.js`)

**Verify in Plugin DevTools**:
```javascript
// Plugin context (should be isolated)
window.location.href  // file:///path/to/plugin/dist/renderer/index.html?view=...
window.parent         // Should NOT access host window
```

---

### 4. Plugin Navigation

**Objective**: Test switching between plugins and views

**Steps**:
1. Load Plugin A
2. Navigate to Dashboard (sidebar)
3. Load Plugin B
4. Use back button (if available)
5. Navigate to Settings → Database

**Expected Result**:
- ViewRouter cleans up Plugin A when navigating away
- Plugin B loads fresh in content area
- Previous plugin doesn't leak memory
- Console logs show proper mount/unmount:
  ```
  [PluginContainer] Unloading previous plugin...
  [PluginContainer] Plugin loaded successfully: plugin-b
  ```

**Performance Check**:
- Navigation should feel instant (< 100ms for cached views)
- No flickering or white screens
- Smooth transitions

---

### 5. Plugin Error Handling

**Objective**: Verify error boundary and fallback UI

**Test Cases**:

#### A. Plugin Not Found
1. Manually trigger: `viewRouter.navigateTo('plugin', { pluginId: 'nonexistent', viewName: 'default' })`

**Expected**:
- Error notification shows: "Plugin nonexistent not found"
- Content area shows error message
- App doesn't crash

#### B. Plugin Load Timeout
1. Modify timeout in [PluginContainer.ts](src/renderer/components/PluginContainer.ts#L18): `LOAD_TIMEOUT_MS = 1000` (1 second)
2. Load a slow-loading plugin

**Expected**:
- After 1 second, error message: "Plugin loading timed out"
- User can retry or navigate away

#### C. Plugin Crash
1. Load a plugin
2. In plugin DevTools, run: `throw new Error('Test crash')`

**Expected**:
- Webview `crashed` event fires
- Error notification: "Plugin crashed. Please try reloading."
- App remains stable

---

### 6. Plugin Message Passing

**Objective**: Verify plugin-to-host communication works

**Steps**:
1. Load a plugin that uses IPC (e.g., database queries, notifications)
2. Trigger plugin actions (e.g., create new series, save data)
3. Monitor console logs in both host and plugin DevTools

**Expected Result**:
- Plugin sends IPC via `window.electronAPI` (provided by preload)
- Main process handles IPC requests
- Responses return to plugin correctly
- Example flow:
  ```
  Plugin: window.electronAPI.database.query(...)
  → Preload: ipcRenderer.invoke('database:query', ...)
  → Main: IpcMain handler executes
  → Returns data to plugin
  ```

**Verify in Console**:
- Host logs: `[IPC] Received request from plugin: database:query`
- Plugin logs: `Received response: { rows: [...] }`

---

### 7. Pinned Plugins

**Objective**: Test pinning/unpinning from launcher

**Steps**:
1. Go to Plugins view (sidebar)
2. Click pin button (📍) on a plugin
3. Verify sidebar shows "Pinned Plugins" section
4. Pin 4 more plugins (max 5)
5. Try pinning a 6th plugin

**Expected Result**:
- Pinned plugin appears in sidebar under "Pinned Plugins"
- Pin button changes to 📌 (pinned state)
- Max 5 plugins can be pinned
- Alert shows: "Maximum of 5 pinned plugins reached"
- Pinned state persists after app restart (localStorage)

**localStorage Check**:
```javascript
localStorage.getItem('fictionlab-pinned-plugins')
// Expected: ["bq-studio", "plugin-2", ...]
```

---

### 8. Top Bar Context

**Objective**: Verify top bar updates for each view

**Test Matrix**:

| View | Title | Breadcrumb | Actions | Project Selector |
|------|-------|------------|---------|------------------|
| Dashboard | "Dashboard" | - | Refresh, Export | ✅ |
| Plugin: bq-studio | "Plugin: BQ Studio" | - | Save, Cancel | ❌ |
| Settings → Database | "Database" | Settings > Database | Backup, Restore | ❌ |
| Plugins | "Plugins" | - | Refresh, Manage | ❌ |

**Steps**:
1. Navigate to each view
2. Check top bar title, breadcrumb, action buttons

**Expected Result**:
- Top bar dynamically updates for each view
- Actions are contextual (e.g., "Save" only in plugin views)
- Project selector shows/hides based on view type

---

### 9. Responsive Behavior

**Objective**: Test layout at different screen sizes

**Breakpoints**:
- Desktop: 1920x1080 → Sidebar 240px, fixed
- Laptop: 1366x768 → Sidebar 200px, collapsible
- Tablet: 768x1024 → Sidebar off-canvas (hamburger menu)
- Min: 800x600 → Off-canvas sidebar, mobile layout

**Steps**:
1. Resize browser window to each breakpoint
2. Load a plugin at each size
3. Navigate between views

**Expected Result**:
- Sidebar adapts to screen size
- Plugin webview scales to fill content area
- No horizontal scrollbars
- Plugin UI remains usable (plugin responsibility to be responsive)

---

### 10. Migration from Old System

**Objective**: Ensure smooth upgrade for existing users

**Steps**:
1. Before first launch, set old tab state:
   ```javascript
   localStorage.setItem('fictionlab-active-tab', 'database')
   ```
2. Launch app with new UI
3. Check active view

**Expected Result**:
- `migrateOldTabState()` runs on startup
- Old tab state converts to new view:
  - `dashboard` → `dashboard`
  - `setup` → `settings-setup`
  - `database` → `settings-database`
  - `services` → `settings-services`
  - `logs` → `settings-logs`
- New state saved: `localStorage.getItem('fictionlab-active-view')` === `'settings-database'`
- Old key removed: `localStorage.getItem('fictionlab-active-tab')` === `null`

---

## Performance Benchmarks

### Loading Times
- **View Router navigation**: < 50ms (cached views)
- **First plugin load**: < 2s (webview creation + plugin init)
- **Subsequent plugin loads**: < 500ms (cached)
- **Sidebar render**: < 30ms

### Memory Usage
- **Webview overhead**: ~50MB per plugin
- **Max recommended plugins open**: 5 simultaneously
- **Plugin cleanup**: Memory freed on unmount

---

## Debugging Tips

### Enable Verbose Logging

1. **Main Process**:
   ```javascript
   // In src/main/index.ts
   process.env.DEBUG = 'fictionlab:*'
   ```

2. **Renderer Process**:
   ```javascript
   // In browser console
   localStorage.setItem('debug', 'fictionlab:*')
   ```

### Inspect Plugin Webview

1. Right-click on plugin content area
2. Select "Inspect Element"
3. Opens dedicated DevTools for that plugin

### Check IPC Traffic

1. In main DevTools, set breakpoint in IPC handlers
2. Monitor `ipcMain.handle('plugin:get-view-url', ...)`
3. Check arguments and return values

### View Router State

```javascript
// In browser console
const viewRouter = window.__viewRouter__
viewRouter.getCurrentView()        // Current view ID
viewRouter.getHistory()            // Navigation history
viewRouter.getViewInstances()      // Cached view instances
```

---

## Known Issues & Limitations

### Current Limitations

1. **Webview Constraints**:
   - Cannot use certain Chrome APIs (e.g., notifications without permission)
   - Limited access to parent window (by design, for security)

2. **Plugin Compatibility**:
   - Plugins must work in isolated context
   - Cannot directly manipulate host DOM
   - Must use IPC for all host interactions

3. **Performance**:
   - Each webview is a separate Chromium instance
   - Recommend max 5 plugins open simultaneously
   - Closed plugins are cleaned up to free memory

### Deprecated Features

**DO NOT USE** (will be removed in future):
- `src/main/plugin-views.ts` - Separate window manager
- IPC: `plugin:show-view`, `plugin:hide-view`, `plugin:close-view`
- `src/renderer/components/TabNavigation.ts` - Old horizontal tabs

---

## Rollback Plan

If critical issues are found, emergency rollback is available:

### Enable Legacy UI

1. Open browser console
2. Run:
   ```javascript
   localStorage.setItem('fictionlab-use-legacy-ui', 'true')
   ```
3. Restart app

**Result**: Falls back to old tab-based UI with separate plugin windows

### Disable Rollback (Return to New UI)

```javascript
localStorage.removeItem('fictionlab-use-legacy-ui')
```

---

## Success Criteria

Phase 2 is complete when:

- [x] Build succeeds without TypeScript errors
- [ ] All plugins load in main window (no separate windows)
- [ ] Plugin isolation verified (partition, preload)
- [ ] Navigation works smoothly (ViewRouter)
- [ ] Error boundaries catch plugin crashes
- [ ] Pinned plugins persist across restarts
- [ ] Top bar updates contextually
- [ ] Responsive layout works at all breakpoints
- [ ] Migration from old tab state works
- [ ] No memory leaks on repeated navigation

---

## Next Phase Preview

**Phase 3: Settings Migration & Polish**
- Refine Settings submenu UI
- Add collapsible/expandable animations
- Keyboard shortcuts (Ctrl+1-9 for quick navigation)
- Polish transitions and loading states

**Phase 4: Workflows Feature**
- Implement workflow builder UI
- Workflow execution engine
- Database schema for workflows

**Phase 5: Library Feature**
- Content browser interface
- Filter/search functionality
- Integration with plugins

---

## Reporting Issues

When reporting issues, include:

1. **Steps to reproduce**
2. **Expected vs. actual behavior**
3. **Console logs** (both host and plugin DevTools)
4. **Screenshots/video** if UI-related
5. **Plugin manifest** (`plugin.json`) if plugin-specific
6. **Environment**:
   - OS: Windows 11
   - Electron version: (check Help → About)
   - Plugin versions: (check Plugins view)

---

## Quick Reference

### Key Files Modified in Phase 1

- [src/renderer/index.html](src/renderer/index.html#L1446-1462) - New layout structure
- [src/renderer/renderer.ts](src/renderer/renderer.ts#L797-815) - Component initialization
- [src/renderer/plugin-handlers.ts](src/renderer/plugin-handlers.ts#L64-78) - Plugin embedding
- [src/main/index.ts](src/main/index.ts#L2165-2190) - IPC handler
- [src/preload/preload.ts](src/preload/preload.ts) - API exposure

### Key Components Created

- [src/renderer/components/Sidebar.ts](src/renderer/components/Sidebar.ts) - Navigation
- [src/renderer/components/TopBar.ts](src/renderer/components/TopBar.ts) - Contextual header
- [src/renderer/components/ViewRouter.ts](src/renderer/components/ViewRouter.ts) - View manager
- [src/renderer/components/PluginContainer.ts](src/renderer/components/PluginContainer.ts) - Webview wrapper

### localStorage Keys

- `fictionlab-active-view` - Current view ID
- `fictionlab-pinned-plugins` - Array of pinned plugin IDs
- `fictionlab-sidebar-settings-expanded` - Settings submenu state
- `fictionlab-use-legacy-ui` - Rollback flag

---

**Last Updated**: 2025-12-12
**Phase 1 Completion**: ✅ Complete
**Phase 2 Status**: 🔄 Testing in progress
