/**
 * Plugin UI Integration (Renderer Side)
 *
 * Handles plugin action events and shows plugin UIs
 */

// Map of action names to view names
const ACTION_TO_VIEW_MAP: Record<string, string> = {
  'new-series': 'StudioDashboard',
  'show-jobs': 'JobMonitor',
  'show-usage': 'UsageTracker',
  'show-settings': 'StudioSettings',
};

/**
 * Initialize plugin action listeners
 */
export function initializePluginHandlers(): void {
  console.log('Initializing plugin handlers...');

  // Check if plugin API is available
  if (!(window as any).electronAPI || !(window as any).electronAPI.plugins) {
    console.error('Plugin API not available in window.electronAPI');
    console.log('Available APIs:', Object.keys((window as any).electronAPI || {}));
    return;
  }

  console.log('Plugin API found, registering onAction listener...');

  // Listen for plugin actions from main process
  (window as any).electronAPI.plugins.onAction((data: { pluginId: string; action: string }) => {
    console.log(`Plugin action received: ${data.pluginId} -> ${data.action}`);
    handlePluginAction(data.pluginId, data.action);
  });

  console.log('Plugin handlers initialized successfully');
}

/**
 * Handle a plugin action by showing the appropriate view
 */
async function handlePluginAction(pluginId: string, action: string): Promise<void> {
  const viewName = ACTION_TO_VIEW_MAP[action];

  if (!viewName) {
    console.warn(`Unknown plugin action: ${action}`);
    return;
  }

  try {
    // Show the plugin view
    await (window as any).electronAPI.plugins.showView(pluginId, viewName);
    console.log(`Showing plugin view: ${pluginId}:${viewName}`);
  } catch (error) {
    console.error(`Failed to show plugin view:`, error);
  }
}

/**
 * Close a plugin view
 */
export async function closePluginView(pluginId: string, viewName: string): Promise<void> {
  try {
    await (window as any).electronAPI.plugins.closeView(pluginId, viewName);
    console.log(`Closed plugin view: ${pluginId}:${viewName}`);
  } catch (error) {
    console.error(`Failed to close plugin view:`, error);
  }
}

/**
 * Hide a plugin view
 */
export async function hidePluginView(pluginId: string, viewName: string): Promise<void> {
  try {
    await (window as any).electronAPI.plugins.hideView(pluginId, viewName);
    console.log(`Hidden plugin view: ${pluginId}:${viewName}`);
  } catch (error) {
    console.error(`Failed to hide plugin view:`, error);
  }
}
