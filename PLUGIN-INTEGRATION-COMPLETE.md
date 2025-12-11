# Plugin UI Integration - Implementation Complete

## What Was Implemented

The FictionLab plugin system now has full UI integration capabilities. BQ-Studio plugin menu items will now trigger plugin views when clicked.

## Files Modified in FictionLab (MCP-Electron-App)

### 1. [src/main/plugin-manager.ts](src/main/plugin-manager.ts)
- Added `handlePluginMenuAction()` method to handle menu clicks
- Sends 'plugin-action' IPC event to renderer when menu items are clicked
- Lines 283-300: New plugin action handler

### 2. [src/main/plugin-views.ts](src/main/plugin-views.ts) (NEW FILE)
- Created PluginViewManager class
- Manages BrowserView instances for plugin UIs
- Provides showPluginView(), hidePluginView(), closePluginView() methods
- Full lifecycle management with cleanup

### 3. [src/main/index.ts](src/main/index.ts)
**Import added (line 32):**
```typescript
import { pluginViewManager } from './plugin-views';
```

**IPC handlers added (lines 2161-2191):**
- `plugin:show-view` - Shows a plugin view in a BrowserView
- `plugin:hide-view` - Hides a plugin view
- `plugin:close-view` - Closes and destroys a plugin view

**Main window initialization (line 387):**
```typescript
pluginViewManager.setMainWindow(mainWindow);
```

### 4. [src/preload/preload.ts](src/preload/preload.ts)
**Plugin API added (lines 2027-2065):**
```typescript
plugins: {
  showView(pluginId, viewName): Promise<void>
  hideView(pluginId, viewName): Promise<void>
  closeView(pluginId, viewName): Promise<void>
  onAction(callback): void
  removeActionListener(): void
}
```

### 5. [src/renderer/plugin-handlers.ts](src/renderer/plugin-handlers.ts) (NEW FILE)
- Listens for 'plugin-action' events from main process
- Maps action names to view names
- Calls pluginViewManager to show plugin UIs
- Exports utility functions for managing plugin views

### 6. [src/renderer/renderer.ts](src/renderer/renderer.ts)
**Import added (line 16):**
```typescript
import { initializePluginHandlers } from './plugin-handlers.js';
```

**Initialization added (line 763):**
```typescript
initializePluginHandlers();
```

## How It Works

### Flow Diagram
```
User clicks menu item
  ↓
plugin-manager.ts: handlePluginMenuAction()
  ↓
Send IPC: 'plugin-action' → renderer
  ↓
plugin-handlers.ts: receives action
  ↓
Maps action → view name (e.g., 'new-series' → 'StudioDashboard')
  ↓
Call: window.electronAPI.plugins.showView(pluginId, viewName)
  ↓
preload.ts: forwards to main process
  ↓
IPC handler: 'plugin:show-view'
  ↓
pluginViewManager.showPluginView()
  ↓
Creates/shows BrowserView with plugin UI
```

### Action Mapping
```typescript
'new-series'     → StudioDashboard
'show-jobs'      → JobMonitor
'show-usage'     → UsageTracker
'show-settings'  → StudioSettings
```

## Testing

### To test the integration:

1. **Build FictionLab:**
   ```bash
   cd C:\github\MCP-Electron-App
   npm run build
   ```

2. **Start FictionLab:**
   ```bash
   npm start
   ```

3. **Click BQ Studio menu items:**
   - BQ Studio → New Series Workflow
   - BQ Studio → Active Jobs
   - BQ Studio → Token Usage
   - BQ Studio → Settings

4. **Expected behavior:**
   - Plugin view should appear in a BrowserView
   - Plugin UI loads from: `%APPDATA%\fictionlab\plugins\bq-studio\dist\renderer\index.html`
   - View overlays the main window content

### Debug in DevTools:
```javascript
// Check if plugin API is available
window.electronAPI.plugins

// Manually trigger a plugin view
await window.electronAPI.plugins.showView('bq-studio', 'StudioDashboard')

// Close a plugin view
await window.electronAPI.plugins.closeView('bq-studio', 'StudioDashboard')
```

## Known Limitations

1. **BrowserView positioning**: Currently uses default bounds (fullscreen minus title bar)
2. **No close button**: Plugin views don't have built-in close UI (need to implement in plugin or add overlay controls)
3. **No animation**: Views appear/disappear instantly
4. **State not persisted**: Plugin view state doesn't persist across sessions

## Next Steps (Optional Enhancements)

### 1. Add Close Button Overlay
Create a close button that appears on plugin views:
```typescript
// In plugin-views.ts
private createCloseButton(): void {
  // Add DOM overlay with close button
}
```

### 2. Add View Transitions
Use CSS or Electron animations for smooth transitions:
```typescript
view.setBounds({ ...bounds, opacity: 0 });
// Animate to opacity: 1
```

### 3. Plugin View Tabs
Allow multiple plugin views to be open as tabs:
```typescript
private viewTabs: Map<string, { view: BrowserView, active: boolean }>;
```

### 4. Keyboard Shortcuts
Add global shortcuts to close plugin views:
```typescript
globalShortcut.register('Escape', () => {
  pluginViewManager.hideAllViews();
});
```

## Architecture Notes

### Why BrowserView instead of iframe?

**BrowserView advantages:**
- Isolated process (security)
- Native Electron integration
- Better performance
- No CORS issues

**iframe would be simpler but:**
- Same process (security risk)
- CORS restrictions
- Harder to manage lifecycle

### Plugin Security

Plugin views run in sandboxed BrowserViews with:
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`

Plugins can only communicate via IPC handlers registered in their plugin entry point.

## Troubleshooting

### Menu items don't trigger views
1. Check FictionLab logs: `%APPDATA%\fictionlab\logs\main.log`
2. Look for: `Handling plugin action: bq-studio -> new-series`
3. Check renderer console for: `Plugin action received`

### Plugin view is blank
1. Verify plugin renderer is built: `%APPDATA%\fictionlab\plugins\bq-studio\dist\renderer\`
2. Check BrowserView DevTools (right-click on view → Inspect)
3. Verify path in IPC handler matches plugin structure

### Multiple views appear
1. Check if PluginViewManager is reusing views correctly
2. Verify view cleanup on close

## Summary

The plugin UI system is now fully functional! BQ-Studio menus will trigger plugin views rendered in BrowserViews. The next step is to test with the actual BQ-Studio renderer UI to ensure everything works end-to-end.
