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

  try {
    // Listen for plugin actions from main process
    (window as any).electronAPI.plugins.onAction((data: { pluginId: string; action: string }) => {
      console.log(`Plugin action received: ${data.pluginId} -> ${data.action}`);

      // Handle the plugin action asynchronously but don't block the event
      handlePluginAction(data.pluginId, data.action).catch((error) => {
        console.error('Uncaught error in plugin action handler:', error);
        showPluginNotification('error', 'Plugin Error', 'An unexpected error occurred while handling the plugin action.');
      });
    });

    console.log('Plugin handlers initialized successfully');
  } catch (error) {
    console.error('Error registering plugin action listener:', error);
  }
}

/**
 * Handle a plugin action by showing the appropriate view
 */
async function handlePluginAction(pluginId: string, action: string): Promise<void> {
  console.log(`handlePluginAction called: ${pluginId} -> ${action}`);

  const viewName = ACTION_TO_VIEW_MAP[action];

  if (!viewName) {
    console.warn(`Unknown plugin action: ${action}`);
    // Show a notification to the user
    showPluginNotification('info', `Plugin action triggered: ${action}`, 'This plugin view is not yet configured.');
    return;
  }

  try {
    // Check if the plugin API has the showView method
    if (!(window as any).electronAPI?.plugins?.showView) {
      throw new Error('Plugin showView API not available');
    }

    console.log(`Attempting to show plugin view: ${pluginId}:${viewName}`);

    // Show the plugin view
    await (window as any).electronAPI.plugins.showView(pluginId, viewName);
    console.log(`Successfully showing plugin view: ${pluginId}:${viewName}`);
  } catch (error) {
    console.error(`Failed to show plugin view:`, error);

    // Show error notification to user instead of breaking the UI
    showPluginNotification(
      'error',
      'Plugin View Error',
      `Unable to show ${viewName}. The plugin view system may not be fully initialized yet.`
    );
  }
}

/**
 * Show a notification to the user
 */
function showPluginNotification(type: 'info' | 'error' | 'success', title: string, message: string): void {
  // Use the global showNotification function if available
  if (typeof (window as any).showNotification === 'function') {
    (window as any).showNotification(`${title}: ${message}`, type);
  } else {
    // Fallback to console
    console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
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
