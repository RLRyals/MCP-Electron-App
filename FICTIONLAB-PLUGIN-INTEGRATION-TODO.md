# FictionLab Plugin Integration - Implementation Guide

**Status**: BQ-Studio plugin is 95% complete. FictionLab needs UI integration features.

**Current State**:
- ✅ FictionLab loads and activates BQ-Studio plugin
- ✅ Menu items appear correctly
- ✅ IPC handlers registered
- ✅ Database integration working
- ❌ Menu actions don't trigger plugin UI
- ❌ No plugin view rendering system

## Required Changes to FictionLab (MCP-Electron-App)

### 1. Add Plugin Action Handler to plugin-manager.ts

**File**: `C:\github\MCP-Electron-App\src\main\plugin-manager.ts`

**Current code (line 199-204)**:
```typescript
click: () => {
  // Send action to plugin
  logWithCategory('debug', LogCategory.SYSTEM,
    `Plugin menu action: ${plugin.id} - ${sub.action}`
  );
},
```

**Replace with**:
```typescript
click: () => {
  logWithCategory('debug', LogCategory.SYSTEM,
    `Plugin menu action: ${plugin.id} - ${sub.action}`
  );

  // Send action to plugin via IPC
  this.handlePluginMenuAction(plugin.id, sub.action || '');
},
```

**Add new method**:
```typescript
/**
 * Handle a menu action from a plugin
 */
private handlePluginMenuAction(pluginId: string, action: string): void {
  if (!this.registry) {
    return;
  }

  logWithCategory('info', LogCategory.SYSTEM, `Handling plugin action: ${pluginId} -> ${action}`);

  // Option 1: Send to renderer to show plugin UI
  if (this.mainWindow) {
    this.mainWindow.webContents.send('plugin-action', {
      pluginId,
      action,
    });
  }

  // Option 2: For headless actions, call plugin directly via IPC
  // The plugin has already registered IPC handlers that the renderer can call
}
```

### 2. Create Plugin View System

**New File**: `C:\github\MCP-Electron-App\src\main\plugin-views.ts`

```typescript
/**
 * Plugin View Manager
 *
 * Manages plugin UI views and iframe rendering
 */

import { BrowserWindow, BrowserView } from 'electron';
import path from 'path';
import { logWithCategory, LogCategory } from './logger';

export interface PluginViewInfo {
  pluginId: string;
  viewName: string;
  url: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

class PluginViewManager {
  private views: Map<string, BrowserView> = new Map();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Show a plugin view
   */
  async showPluginView(info: PluginViewInfo): Promise<void> {
    if (!this.mainWindow) {
      throw new Error('Main window not set');
    }

    const viewKey = `${info.pluginId}:${info.viewName}`;

    // Check if view already exists
    let view = this.views.get(viewKey);

    if (!view) {
      // Create new BrowserView
      view = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      this.views.set(viewKey, view);
    }

    // Add to main window
    this.mainWindow.addBrowserView(view);

    // Set bounds
    const bounds = info.bounds || this.getDefaultBounds();
    view.setBounds(bounds);

    // Load plugin UI
    await view.webContents.loadFile(info.url);

    logWithCategory('info', LogCategory.SYSTEM, `Showing plugin view: ${viewKey}`);
  }

  /**
   * Hide a plugin view
   */
  hidePluginView(pluginId: string, viewName: string): void {
    if (!this.mainWindow) {
      return;
    }

    const viewKey = `${pluginId}:${viewName}`;
    const view = this.views.get(viewKey);

    if (view) {
      this.mainWindow.removeBrowserView(view);
      logWithCategory('info', LogCategory.SYSTEM, `Hidden plugin view: ${viewKey}`);
    }
  }

  /**
   * Close and destroy a plugin view
   */
  closePluginView(pluginId: string, viewName: string): void {
    const viewKey = `${pluginId}:${viewName}`;
    const view = this.views.get(viewKey);

    if (view) {
      if (this.mainWindow) {
        this.mainWindow.removeBrowserView(view);
      }

      // @ts-ignore - webContents.destroy() exists
      view.webContents.destroy();
      this.views.delete(viewKey);

      logWithCategory('info', LogCategory.SYSTEM, `Closed plugin view: ${viewKey}`);
    }
  }

  /**
   * Get default bounds for plugin view
   */
  private getDefaultBounds(): { x: number; y: number; width: number; height: number } {
    if (!this.mainWindow) {
      return { x: 0, y: 0, width: 800, height: 600 };
    }

    const windowBounds = this.mainWindow.getBounds();

    // Full window minus title bar
    return {
      x: 0,
      y: 40, // Below title bar
      width: windowBounds.width,
      height: windowBounds.height - 40,
    };
  }

  /**
   * Cleanup all views
   */
  cleanup(): void {
    for (const [key, view] of this.views.entries()) {
      if (this.mainWindow) {
        this.mainWindow.removeBrowserView(view);
      }
      // @ts-ignore
      view.webContents.destroy();
    }
    this.views.clear();
  }
}

export const pluginViewManager = new PluginViewManager();
```

### 3. Add Plugin View IPC Handlers

**File**: `C:\github\MCP-Electron-App\src\main\index.ts` (or wherever IPC handlers are registered)

```typescript
import { pluginViewManager } from './plugin-views';

// Add these IPC handlers
ipcMain.handle('plugin:show-view', async (event, pluginId: string, viewName: string) => {
  const pluginRegistry = pluginManager.getRegistry();
  const plugin = pluginRegistry?.getPlugin(pluginId);

  if (!plugin) {
    throw new Error(`Plugin ${pluginId} not found`);
  }

  // Get plugin view path
  const pluginDir = plugin.installPath;
  const viewPath = path.join(pluginDir, 'dist', 'renderer', 'index.html');

  await pluginViewManager.showPluginView({
    pluginId,
    viewName,
    url: viewPath,
  });
});

ipcMain.handle('plugin:hide-view', (event, pluginId: string, viewName: string) => {
  pluginViewManager.hidePluginView(pluginId, viewName);
});

ipcMain.handle('plugin:close-view', (event, pluginId: string, viewName: string) => {
  pluginViewManager.closePluginView(pluginId, viewName);
});
```

### 4. Create Renderer-Side Plugin UI System

**New File**: `C:\github\MCP-Electron-App\src\renderer\plugin-ui.ts`

```typescript
/**
 * Plugin UI Integration (Renderer Side)
 *
 * Handles plugin action events and shows plugin UIs
 */

// Listen for plugin actions from main process
window.electronAPI.on('plugin-action', (data: { pluginId: string; action: string }) => {
  console.log(`Plugin action received: ${data.pluginId} -> ${data.action}`);

  handlePluginAction(data.pluginId, data.action);
});

async function handlePluginAction(pluginId: string, action: string): Promise<void> {
  // Map actions to view names
  const actionToView: Record<string, string> = {
    'new-series': 'StudioDashboard',
    'show-jobs': 'JobMonitor',
    'show-usage': 'UsageTracker',
    'show-settings': 'StudioSettings',
  };

  const viewName = actionToView[action];

  if (!viewName) {
    console.warn(`Unknown action: ${action}`);
    return;
  }

  try {
    // Show the plugin view
    await window.electronAPI.invoke('plugin:show-view', pluginId, viewName);
  } catch (error) {
    console.error(`Failed to show plugin view:`, error);
  }
}
```

### 5. Alternative: Embedded Plugin UI in Main Window

**Simpler approach - Show plugin UI in a div in the main window**

**File**: `C:\github\MCP-Electron-App\src\renderer\App.tsx` (or main renderer component)

```tsx
import { useState, useEffect } from 'react';

function App() {
  const [pluginView, setPluginView] = useState<{
    pluginId: string;
    viewName: string;
  } | null>(null);

  useEffect(() => {
    // Listen for plugin actions
    window.electronAPI.on('plugin-action', (data: { pluginId: string; action: string }) => {
      const actionToView: Record<string, string> = {
        'new-series': 'StudioDashboard',
        'show-jobs': 'JobMonitor',
        'show-usage': 'UsageTracker',
        'show-settings': 'StudioSettings',
      };

      const viewName = actionToView[data.action];
      if (viewName) {
        setPluginView({ pluginId: data.pluginId, viewName });
      }
    });
  }, []);

  return (
    <div className="app">
      {/* Existing FictionLab UI */}
      <MainContent />

      {/* Plugin View Overlay */}
      {pluginView && (
        <div className="plugin-view-overlay">
          <div className="plugin-view-header">
            <span>{pluginView.pluginId} - {pluginView.viewName}</span>
            <button onClick={() => setPluginView(null)}>Close</button>
          </div>
          <iframe
            src={`plugin://${pluginView.pluginId}/renderer/index.html`}
            style={{ width: '100%', height: 'calc(100% - 40px)', border: 'none' }}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      )}
    </div>
  );
}
```

### 6. Register Custom Protocol for Plugin Resources

**File**: `C:\github\MCP-Electron-App\src\main\index.ts`

```typescript
import { protocol } from 'electron';
import path from 'path';
import fs from 'fs';

// Register plugin:// protocol
app.whenReady().then(() => {
  protocol.registerFileProtocol('plugin', (request, callback) => {
    // plugin://bq-studio/renderer/index.html
    const url = request.url.replace('plugin://', '');
    const [pluginId, ...pathParts] = url.split('/');

    const pluginsDir = path.join(app.getPath('userData'), 'plugins');
    const filePath = path.join(pluginsDir, pluginId, ...pathParts);

    callback({ path: filePath });
  });
});
```

## Implementation Priority

### Phase 1: Minimum Viable Integration ✅ COMPLETE
1. ✅ Add `handlePluginMenuAction()` to plugin-manager.ts
2. ✅ Send 'plugin-action' IPC message to renderer
3. ✅ Add plugin handlers to renderer

### Phase 2: Basic View System ✅ COMPLETE
1. ✅ Create PluginViewManager with BrowserView
2. ✅ Add IPC handlers for plugin views
3. ✅ Add preload API for plugin actions

### Phase 3: Full Integration ✅ COMPLETE
1. ✅ Wire up menu actions to send IPC events
2. ✅ Initialize pluginViewManager with main window
3. ✅ Add renderer-side plugin action handling

### Phase 4: Testing & Polish (NEXT)
1. ⏳ Test menu click → plugin view flow
2. ⏳ Add view transitions/animations
3. ⏳ Add plugin view state persistence
4. ⏳ Add keyboard shortcuts

## Testing Checklist

After implementing each phase:

- [ ] Phase 1: Menu click triggers console log in renderer
- [ ] Phase 2: Plugin UI appears in iframe
- [ ] Phase 2: Plugin can call IPC handlers (test with is-authenticated)
- [ ] Phase 3: Plugin UI renders in BrowserView
- [ ] Phase 3: Multiple plugin views can coexist
- [ ] Phase 4: Smooth transitions between views
- [ ] Phase 4: Plugin state persists across sessions

## Quick Win: Show Alert on Menu Click

**Fastest way to test integration (5 minutes)**:

In `plugin-manager.ts`, line 200:
```typescript
click: () => {
  logWithCategory('debug', LogCategory.SYSTEM,
    `Plugin menu action: ${plugin.id} - ${sub.action}`
  );

  // Quick test: show dialog
  if (this.mainWindow) {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Plugin Action',
      message: `Plugin: ${plugin.id}\nAction: ${sub.action}`,
      detail: 'This will soon open the plugin UI!',
    });
  }
},
```

This will immediately show that the menu is working and give you a visual confirmation while you build the full UI system.

## Next Steps

1. **Implement Phase 1** in FictionLab to get menu actions working
2. **Choose view approach**: BrowserView (isolated) vs iframe (simpler)
3. **Test with BQ-Studio** plugin renderer
4. **Iterate** on UX and integration

Would you like me to start implementing these changes in the FictionLab repository?
