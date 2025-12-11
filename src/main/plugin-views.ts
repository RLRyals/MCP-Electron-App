/**
 * Plugin View Manager
 *
 * Manages plugin UI views in separate windows
 */

import { BrowserWindow } from 'electron';
import path from 'path';
import { logWithCategory, LogCategory } from './logger';

export interface PluginViewInfo {
  pluginId: string;
  viewName: string;
  url: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

class PluginViewManager {
  private windows: Map<string, BrowserWindow> = new Map();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Show a plugin view in a separate window
   */
  async showPluginView(info: PluginViewInfo): Promise<void> {
    const windowKey = `${info.pluginId}:${info.viewName}`;
    logWithCategory('info', LogCategory.SYSTEM, `Attempting to show plugin window: ${windowKey}`);
    logWithCategory('debug', LogCategory.SYSTEM, `Plugin view URL: ${info.url}`);

    try {
      // Check if window already exists
      let window = this.windows.get(windowKey);

      if (window && !window.isDestroyed()) {
        // Window exists, just focus it
        logWithCategory('debug', LogCategory.SYSTEM, `Focusing existing window for ${windowKey}`);
        window.focus();
        return;
      }

      logWithCategory('debug', LogCategory.SYSTEM, `Creating new window for ${windowKey}`);

      // Get preload script path
      const preloadPath = path.join(__dirname, '../preload/plugin-view-preload.js');
      logWithCategory('debug', LogCategory.SYSTEM, `Preload path: ${preloadPath}`);

      // Create new window
      window = new BrowserWindow({
        width: info.bounds?.width || 1200,
        height: info.bounds?.height || 800,
        title: `${info.pluginId} - ${info.viewName}`,
        parent: this.mainWindow || undefined,
        modal: false,
        show: false, // Don't show until ready
        webPreferences: {
          preload: preloadPath,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
        },
      });

      // Store the window
      this.windows.set(windowKey, window);

      // Handle window close
      window.on('closed', () => {
        logWithCategory('info', LogCategory.SYSTEM, `Plugin window closed: ${windowKey}`);
        this.windows.delete(windowKey);
      });

      // Load plugin UI
      logWithCategory('debug', LogCategory.SYSTEM, `Loading plugin UI from: ${info.url}`);
      await window.loadFile(info.url);

      // Show window once loaded
      window.show();

      logWithCategory('info', LogCategory.SYSTEM, `Successfully showing plugin window: ${windowKey}`);
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to show plugin window ${windowKey}: ${error.message}`);
      logWithCategory('error', LogCategory.SYSTEM, `Error stack: ${error.stack}`);

      // Clean up window on error
      const window = this.windows.get(windowKey);
      if (window && !window.isDestroyed()) {
        try {
          logWithCategory('debug', LogCategory.SYSTEM, `Closing failed plugin window`);
          window.close();
          this.windows.delete(windowKey);
        } catch (cleanupError: any) {
          logWithCategory('error', LogCategory.SYSTEM, `Error during window cleanup: ${cleanupError.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Hide a plugin window (minimize it)
   */
  hidePluginView(pluginId: string, viewName: string): void {
    const windowKey = `${pluginId}:${viewName}`;
    const window = this.windows.get(windowKey);

    if (window && !window.isDestroyed()) {
      window.hide();
      logWithCategory('info', LogCategory.SYSTEM, `Hidden plugin window: ${windowKey}`);
    }
  }

  /**
   * Close and destroy a plugin window
   */
  closePluginView(pluginId: string, viewName: string): void {
    const windowKey = `${pluginId}:${viewName}`;
    const window = this.windows.get(windowKey);

    if (window && !window.isDestroyed()) {
      window.close();
      this.windows.delete(windowKey);
      logWithCategory('info', LogCategory.SYSTEM, `Closed plugin window: ${windowKey}`);
    }
  }

  /**
   * Cleanup all plugin windows
   */
  cleanup(): void {
    for (const [key, window] of this.windows.entries()) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
    this.windows.clear();
  }
}

export const pluginViewManager = new PluginViewManager();
