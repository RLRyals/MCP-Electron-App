/**
 * Preload script
 * This script runs in a privileged context before the renderer process loads
 * It exposes a limited, secure API to the renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose a secure API to the renderer process
 * This API is the only way the renderer can communicate with the main process
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Send a ping to the main process and receive a pong
   */
  ping: (): Promise<string> => {
    return ipcRenderer.invoke('ping');
  },

  /**
   * Get the application version
   */
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('get-app-version');
  },

  /**
   * Get platform information
   */
  getPlatformInfo: (): Promise<{
    platform: string;
    arch: string;
    version: string;
  }> => {
    return ipcRenderer.invoke('get-platform-info');
  },
});

console.log('Preload script loaded successfully');
