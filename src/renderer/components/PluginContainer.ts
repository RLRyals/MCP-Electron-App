/**
 * PluginContainer Component
 * Embeds plugin UI using <webview> tag for isolation
 *
 * Features:
 * - Loads plugin HTML via IPC
 * - Creates isolated context with partition attribute
 * - Message passing between host and plugin
 * - Error boundary for plugin crashes
 * - Loading states and timeout detection
 */

export class PluginContainer {
  private container: HTMLElement;
  private webview: Electron.WebviewTag | null = null;
  private currentPluginId: string | null = null;
  private loadTimeout: NodeJS.Timeout | null = null;
  private readonly LOAD_TIMEOUT_MS = 30000; // 30 seconds

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Load a plugin into the container
   */
  public async loadPlugin(pluginId: string, viewName: string): Promise<void> {
    console.log('[PluginContainer] Loading plugin:', pluginId, 'view:', viewName);

    // Clear previous plugin
    this.unloadPlugin();

    // Show loading state
    this.showLoading();

    // Set timeout for loading
    this.loadTimeout = setTimeout(() => {
      this.showError('Plugin loading timed out after 30 seconds');
    }, this.LOAD_TIMEOUT_MS);

    try {
      // Fetch plugin URL from main process
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.plugins || !electronAPI.plugins.getViewUrl) {
        throw new Error('Electron API not available');
      }

      const { url, metadata } = await electronAPI.plugins.getViewUrl(pluginId, viewName);
      console.log('[PluginContainer] Plugin URL:', url, 'Metadata:', metadata);

      // Create webview element
      await this.createWebview(url, pluginId, viewName, metadata);

      this.currentPluginId = pluginId;
      console.log('[PluginContainer] Plugin loaded successfully:', pluginId);
    } catch (error) {
      console.error('[PluginContainer] Failed to load plugin:', error);
      this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      if (this.loadTimeout) {
        clearTimeout(this.loadTimeout);
        this.loadTimeout = null;
      }
    }
  }

  /**
   * Create and configure the webview element
   */
  private async createWebview(
    url: string,
    pluginId: string,
    viewName: string,
    metadata: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create webview element
      this.webview = document.createElement('webview');

      // Convert Windows path to file:// URL
      const fileUrl = `file:///${url.replace(/\\/g, '/')}?view=${encodeURIComponent(viewName)}`;
      this.webview.src = fileUrl;

      // Set partition for isolation
      this.webview.partition = `plugin-${pluginId}`;

      // Set preload script (same as plugin windows used)
      // Note: Path needs to be resolved relative to app root
      const preloadPath = './preload/plugin-view-preload.js';
      this.webview.preload = preloadPath;

      // Enable node integration if needed (controlled by preload script)
      this.webview.setAttribute('nodeintegration', 'false');
      this.webview.setAttribute('nodeintegrationinsubframes', 'false');
      this.webview.setAttribute('webpreferences', 'contextIsolation=true');

      // Set styles for full-size display
      this.webview.style.width = '100%';
      this.webview.style.height = '100%';
      this.webview.style.border = 'none';
      this.webview.style.display = 'block';

      // Event listeners
      this.webview.addEventListener('did-start-loading', () => {
        console.log('[PluginContainer] Plugin started loading');
      });

      this.webview.addEventListener('did-finish-load', () => {
        console.log('[PluginContainer] Plugin finished loading');
        resolve();
      });

      this.webview.addEventListener('did-fail-load', (event: any) => {
        console.error('[PluginContainer] Plugin failed to load:', event);
        if (event.errorCode !== -3) { // -3 is ERR_ABORTED, which is often benign
          reject(new Error(`Failed to load plugin: ${event.errorDescription || 'Unknown error'}`));
        }
      });

      this.webview.addEventListener('crashed', () => {
        console.error('[PluginContainer] Plugin crashed');
        this.showError('Plugin crashed. Please try reloading.');
      });

      this.webview.addEventListener('unresponsive', () => {
        console.warn('[PluginContainer] Plugin became unresponsive');
        this.showError('Plugin is not responding. Please wait or reload.');
      });

      this.webview.addEventListener('responsive', () => {
        console.log('[PluginContainer] Plugin became responsive again');
      });

      // Console message forwarding (for debugging)
      this.webview.addEventListener('console-message', (e: any) => {
        console.log(`[Plugin ${pluginId}]`, e.message);
      });

      // IPC message handling
      this.webview.addEventListener('ipc-message', (event: any) => {
        if (event.channel === 'plugin-message') {
          this.handlePluginMessage(event.args[0]);
        }
      });

      // Clear loading state and append webview
      this.container.innerHTML = '';
      this.container.appendChild(this.webview);
    });
  }

  /**
   * Unload the current plugin
   */
  public unloadPlugin(): void {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }

    if (this.webview) {
      try {
        // Remove event listeners to prevent memory leaks
        this.webview.remove();
      } catch (error) {
        console.error('[PluginContainer] Error removing webview:', error);
      }
      this.webview = null;
    }

    this.currentPluginId = null;
  }

  /**
   * Send a message to the plugin
   */
  public sendMessageToPlugin(message: any): void {
    if (this.webview && this.currentPluginId) {
      try {
        this.webview.send('host-message', message);
        console.log('[PluginContainer] Sent message to plugin:', message);
      } catch (error) {
        console.error('[PluginContainer] Failed to send message to plugin:', error);
      }
    } else {
      console.warn('[PluginContainer] Cannot send message - no plugin loaded');
    }
  }

  /**
   * Handle messages from the plugin
   */
  private handlePluginMessage(message: any): void {
    console.log('[PluginContainer] Received message from plugin:', message);

    // Handle specific message types
    if (message.type === 'ready') {
      console.log('[PluginContainer] Plugin reported ready');
    } else if (message.type === 'error') {
      console.error('[PluginContainer] Plugin reported error:', message.error);
      this.showError(`Plugin error: ${message.error}`);
    }

    // Emit event for external listeners
    window.dispatchEvent(new CustomEvent('plugin-message', {
      detail: { pluginId: this.currentPluginId, message }
    }));
  }

  /**
   * Show loading state
   */
  private showLoading(): void {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-secondary);">
        <div class="loading-spinner" style="width: 40px; height: 40px; border-width: 4px; margin-bottom: 16px;"></div>
        <p>Loading plugin...</p>
      </div>
    `;
  }

  /**
   * Show error state
   */
  private showError(message: string): void {
    this.container.innerHTML = `
      <div class="error-message" style="margin: var(--spacing-lg);">
        <h2>Plugin Error</h2>
        <p>${this.escapeHtml(message)}</p>
        <button class="top-bar-action primary" onclick="window.location.reload()">
          Reload Application
        </button>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get the current plugin ID
   */
  public getCurrentPluginId(): string | null {
    return this.currentPluginId;
  }

  /**
   * Check if a plugin is currently loaded
   */
  public isPluginLoaded(): boolean {
    return this.currentPluginId !== null && this.webview !== null;
  }

  /**
   * Reload the current plugin
   */
  public async reloadPlugin(): Promise<void> {
    if (this.webview && this.currentPluginId) {
      try {
        this.webview.reload();
        console.log('[PluginContainer] Plugin reloaded');
      } catch (error) {
        console.error('[PluginContainer] Failed to reload plugin:', error);
        this.showError('Failed to reload plugin');
      }
    }
  }

  /**
   * Open DevTools for the plugin
   */
  public openDevTools(): void {
    if (this.webview) {
      try {
        this.webview.openDevTools();
        console.log('[PluginContainer] Opened DevTools for plugin');
      } catch (error) {
        console.error('[PluginContainer] Failed to open DevTools:', error);
      }
    }
  }

  /**
   * Destroy the container
   */
  public destroy(): void {
    this.unloadPlugin();
    this.container.innerHTML = '';
  }
}
