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
    logWithCategory('info', LogCategory.SYSTEM, `Attempting to show plugin view: ${viewKey}`);
    logWithCategory('debug', LogCategory.SYSTEM, `Plugin view URL: ${info.url}`);

    try {
      // Check if view already exists
      let view = this.views.get(viewKey);

      if (!view) {
        logWithCategory('debug', LogCategory.SYSTEM, `Creating new BrowserView for ${viewKey}`);

        // Get preload script path
        const preloadPath = path.join(__dirname, '../preload/plugin-view-preload.js');
        logWithCategory('debug', LogCategory.SYSTEM, `Preload path: ${preloadPath}`);

        // Create new BrowserView
        view = new BrowserView({
          webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // Need to disable sandbox for preload to work properly
          },
        });

        this.views.set(viewKey, view);
      } else {
        logWithCategory('debug', LogCategory.SYSTEM, `Reusing existing BrowserView for ${viewKey}`);
      }

      // Add to main window
      this.mainWindow.addBrowserView(view);
      logWithCategory('debug', LogCategory.SYSTEM, `Added BrowserView to main window`);

      // Set bounds
      const bounds = info.bounds || this.getDefaultBounds();
      view.setBounds(bounds);
      logWithCategory('debug', LogCategory.SYSTEM, `Set bounds: ${JSON.stringify(bounds)}`);

      // Load plugin UI
      logWithCategory('debug', LogCategory.SYSTEM, `Loading plugin UI from: ${info.url}`);
      await view.webContents.loadFile(info.url);
      logWithCategory('info', LogCategory.SYSTEM, `Successfully showing plugin view: ${viewKey}`);
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to show plugin view ${viewKey}: ${error.message}`);
      logWithCategory('error', LogCategory.SYSTEM, `Error stack: ${error.stack}`);
      throw error;
    }
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
