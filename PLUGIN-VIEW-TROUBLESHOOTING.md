# Plugin View System - Troubleshooting Guide

## Current Issue: App crashes when clicking plugin menu items

### Diagnosis

The plugin system has two approaches implemented:

1. **BrowserView Approach** (Current) - Uses Electron BrowserView
2. **iframe Approach** (Alternative, simpler) - Uses iframe in main renderer

### Why BrowserView might be crashing:

1. **React App requires window.electronAPI**
   - The BQ-Studio plugin UI is a React app expecting `window.electronAPI`
   - BrowserView needs a proper preload script (now added)

2. **Content Security Policy conflicts**
   - The plugin's HTML has CSP: `script-src 'self'`
   - This might conflict with BrowserView loading

3. **Module type mismatch**
   - The plugin uses `<script type="module">` which requires specific CSP settings

### Solution 1: Use the iframe approach instead (RECOMMENDED)

The iframe approach is simpler and more reliable. Here's how to switch to it:

#### Step 1: Create plugin iframe overlay in renderer

Create `C:\github\MCP-Electron-App\src\renderer\components\PluginViewOverlay.ts`:

```typescript
/**
 * Plugin View Overlay Component
 * Displays plugin UIs in an iframe overlay
 */

export function createPluginViewOverlay(): void {
  const existingOverlay = document.getElementById('plugin-view-overlay');
  if (existingOverlay) {
    return; // Already exists
  }

  const overlay = document.createElement('div');
  overlay.id = 'plugin-view-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: none;
  `;

  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    top: 40px;
    left: 10%;
    width: 80%;
    height: calc(100% - 80px);
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    padding: 12px 16px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    border-radius: 8px 8px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const title = document.createElement('span');
  title.id = 'plugin-view-title';
  title.style.cssText = 'font-weight: 600; font-size: 14px;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  `;
  closeBtn.onmouseover = () => closeBtn.style.background = '#e0e0e0';
  closeBtn.onmouseout = () => closeBtn.style.background = 'none';
  closeBtn.onclick = () => hidePluginView();

  header.appendChild(title);
  header.appendChild(closeBtn);

  const iframe = document.createElement('iframe');
  iframe.id = 'plugin-view-iframe';
  iframe.style.cssText = `
    flex: 1;
    border: none;
    border-radius: 0 0 8px 8px;
  `;
  iframe.sandbox.add('allow-scripts', 'allow-same-origin');

  container.appendChild(header);
  container.appendChild(iframe);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hidePluginView();
    }
  });
}

export function showPluginView(pluginId: string, viewName: string, url: string): void {
  createPluginViewOverlay();

  const overlay = document.getElementById('plugin-view-overlay') as HTMLElement;
  const iframe = document.getElementById('plugin-view-iframe') as HTMLIFrameElement;
  const title = document.getElementById('plugin-view-title') as HTMLElement;

  title.textContent = `${pluginId} - ${viewName}`;
  iframe.src = url;
  overlay.style.display = 'block';
}

export function hidePluginView(): void {
  const overlay = document.getElementById('plugin-view-overlay') as HTMLElement;
  if (overlay) {
    overlay.style.display = 'none';
  }
}
```

#### Step 2: Update plugin-handlers.ts to use iframe

```typescript
// In src/renderer/plugin-handlers.ts
import { showPluginView } from './components/PluginViewOverlay.js';

async function handlePluginAction(pluginId: string, action: string): Promise<void> {
  const viewName = ACTION_TO_VIEW_MAP[action];

  if (!viewName) {
    console.warn(`Unknown plugin action: ${action}`);
    return;
  }

  try {
    // Get plugin install path from main process
    const pluginPath = await (window as any).electronAPI.invoke('plugins:get-path', pluginId);
    const viewUrl = `file://${pluginPath}/dist/renderer/index.html`;

    // Show in iframe overlay
    showPluginView(pluginId, viewName, viewUrl);
  } catch (error) {
    console.error(`Failed to show plugin view:`, error);
  }
}
```

#### Step 3: Add IPC handler to get plugin path

In `src/main/index.ts`:

```typescript
ipcMain.handle('plugins:get-path', async (_event, pluginId: string) => {
  const pluginRegistry = pluginManager.getRegistry();
  const plugin = pluginRegistry?.getPlugin(pluginId);

  if (!plugin) {
    throw new Error(`Plugin ${pluginId} not found`);
  }

  return plugin.context.plugin.installPath;
});
```

### Solution 2: Fix BrowserView approach (Current implementation)

If you want to stick with BrowserView:

1. **Check logs** after clicking menu:
   ```bash
   cat "C:\Users\User\AppData\Roaming\fictionlab\logs\main.log" | tail -50
   ```

2. **Look for errors** related to:
   - "Failed to show plugin view"
   - "Plugin renderer not found"
   - Any stack traces

3. **Enable DevTools for BrowserView**:

   Add to `plugin-views.ts` after creating view:
   ```typescript
   view.webContents.openDevTools({ mode: 'detach' });
   ```

4. **Check preload script is being loaded**:
   - Ensure `dist/preload/plugin-view-preload.js` exists after build
   - Check logs for "Preload path: ..."

### Testing Checklist

- [ ] FictionLab builds without errors
- [ ] Plugin is loaded and active (check logs)
- [ ] Menu items appear in "BQ Studio" menu
- [ ] Clicking menu doesn't crash app
- [ ] Plugin view appears (either BrowserView or iframe)
- [ ] Plugin UI loads correctly
- [ ] Can close plugin view

### Debug Commands

```bash
# Watch logs in real-time
Get-Content "C:\Users\User\AppData\Roaming\fictionlab\logs\main.log" -Wait

# Check plugin files
dir "C:\Users\User\AppData\Roaming\fictionlab\plugins\bq-studio\dist\renderer"

# Rebuild FictionLab
cd C:\github\MCP-Electron-App
npm run build

# Start FictionLab
npm start
```

## Recommendation

**Use the iframe approach (Solution 1)** - it's simpler, more reliable, and easier to debug. The BrowserView approach adds unnecessary complexity for displaying plugin UIs.
