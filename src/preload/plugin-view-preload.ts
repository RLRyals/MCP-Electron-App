/**
 * Preload script for plugin BrowserViews
 *
 * Provides minimal API for plugin UIs running in BrowserViews
 */

import { contextBridge, ipcRenderer } from 'electron';

// Get view name from URL query parameter
const urlParams = new URLSearchParams(window.location.search);
const viewName = urlParams.get('view') || 'default';

// Expose a minimal API for plugin views
contextBridge.exposeInMainWorld('electronAPI', {
  // Get the view name passed from the main process
  getViewName: () => viewName,

  // Basic IPC communication
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },

  // Event listening
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },

  // Close this plugin view
  closeView: () => {
    ipcRenderer.send('plugin-view:close');
  },
});

console.log(`Plugin view preload script loaded for view: ${viewName}`);
