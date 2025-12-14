/**
 * ViewRouter Component
 * Central routing logic for view switching and history management
 *
 * Features:
 * - View lazy loading (instantiate on first navigation)
 * - View caching for fast re-navigation
 * - History management (back/forward)
 * - View lifecycle (mount/unmount)
 * - Integrates with Sidebar and TopBar
 */

import type { Sidebar } from './Sidebar.js';
import type { TopBar, TopBarConfig } from './TopBar.js';

export interface View {
  mount(container: HTMLElement, params?: any): Promise<void>;
  unmount?(): Promise<void>;
  handleAction?(actionId: string): void;
  getTopBarConfig?(): TopBarConfig;
}

export interface ViewClass {
  new (): View;
}

export interface ViewRouterOptions {
  container: HTMLElement;
  sidebar: Sidebar;
  topBar: TopBar;
}

export class ViewRouter {
  private container: HTMLElement;
  private sidebar: Sidebar;
  private topBar: TopBar;

  // View registry
  private viewClasses: Map<string, ViewClass> = new Map();
  private viewInstances: Map<string, View> = new Map();

  // State
  private currentViewId: string | null = null;
  private history: string[] = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 20;

  constructor(options: ViewRouterOptions) {
    this.container = options.container;
    this.sidebar = options.sidebar;
    this.topBar = options.topBar;
  }

  /**
   * Initialize the router
   */
  public initialize(): void {
    this.registerDefaultViews();
    console.log('[ViewRouter] Initialized');
  }

  /**
   * Register default views
   */
  private async registerDefaultViews(): Promise<void> {
    // Import and register view classes dynamically
    try {
      // Dashboard view (existing DashboardTab)
      const { DashboardView } = await import('../views/DashboardView.js');
      this.registerView('dashboard', DashboardView);

      // Settings views (wrappers for existing tab components)
      const { SetupView } = await import('../views/SetupView.js');
      const { DatabaseView } = await import('../views/DatabaseView.js');
      const { ServicesView } = await import('../views/ServicesView.js');
      const { LogsView } = await import('../views/LogsView.js');
      this.registerView('settings-setup', SetupView);
      this.registerView('settings-database', DatabaseView);
      this.registerView('settings-services', ServicesView);
      this.registerView('settings-logs', LogsView);

      // New views
      const { PluginsLauncher } = await import('../views/PluginsLauncher.js');
      const { WorkflowsView } = await import('../views/WorkflowsView.js');
      const { LibraryView } = await import('../views/LibraryView.js');
      this.registerView('plugins', PluginsLauncher);
      this.registerView('workflows', WorkflowsView);
      this.registerView('library', LibraryView);

      // Help and About views
      const { HelpView } = await import('../views/HelpView.js');
      const { AboutView } = await import('../views/AboutView.js');
      this.registerView('help', HelpView);
      this.registerView('about', AboutView);

      console.log('[ViewRouter] Default views registered');
    } catch (error) {
      console.error('[ViewRouter] Failed to register views:', error);
    }
  }

  /**
   * Register a view class
   */
  public registerView(viewId: string, ViewClass: ViewClass): void {
    this.viewClasses.set(viewId, ViewClass);
    console.log('[ViewRouter] Registered view:', viewId);
  }

  /**
   * Navigate to a view
   */
  public async navigateTo(viewId: string, params?: any): Promise<void> {
    console.log('[ViewRouter] Navigating to:', viewId, params);

    // Handle plugin views
    if (viewId.startsWith('plugin-') || (viewId === 'plugin' && params?.pluginId)) {
      await this.navigateToPlugin(params?.pluginId || viewId.replace('plugin-', ''), params?.viewName || 'default');
      return;
    }

    // Check if view is registered
    if (!this.viewClasses.has(viewId)) {
      console.error('[ViewRouter] View not registered:', viewId);
      this.showErrorView(`View "${viewId}" not found`);
      return;
    }

    // Unmount current view
    if (this.currentViewId) {
      await this.unmountCurrentView();
    }

    // Get or create view instance
    let view = this.viewInstances.get(viewId);
    if (!view) {
      const ViewClass = this.viewClasses.get(viewId)!;
      view = new ViewClass();
      this.viewInstances.set(viewId, view);
    }

    // Mount the view
    try {
      // Show loading state
      this.showLoadingView();

      await view.mount(this.container, params);

      // Clear loading state after successful mount
      // (view.mount already populated container with its content)

      this.currentViewId = viewId;

      // Update history
      this.addToHistory(viewId);

      // Update sidebar active state
      this.sidebar.setActiveView(viewId);

      // Update top bar
      this.updateTopBar(view, viewId);

      console.log('[ViewRouter] Successfully navigated to:', viewId);
    } catch (error) {
      console.error('[ViewRouter] Failed to mount view:', viewId, error);
      this.showErrorView(`Failed to load view: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Navigate to a plugin view
   */
  private async navigateToPlugin(pluginId: string, viewName: string): Promise<void> {
    console.log('[ViewRouter] Navigating to plugin:', pluginId, viewName);

    // Unmount current view
    if (this.currentViewId) {
      await this.unmountCurrentView();
    }

    // Use PluginContainer to load the plugin
    try {
      const { PluginContainer } = await import('./PluginContainer.js');
      const pluginContainer = new PluginContainer(this.container);
      await pluginContainer.loadPlugin(pluginId, viewName);

      const viewId = `plugin-${pluginId}`;
      this.currentViewId = viewId;

      // Update history
      this.addToHistory(viewId);

      // Update sidebar
      this.sidebar.setActiveView(viewId);

      // Update top bar for plugin
      this.topBar.setContext(viewId, {
        title: `Plugin: ${pluginId}`,
        breadcrumb: ['Plugins', pluginId],
        actions: [],
        global: {
          projectSelector: false,
          environmentIndicator: true,
        },
      });

      console.log('[ViewRouter] Successfully loaded plugin:', pluginId);
    } catch (error) {
      console.error('[ViewRouter] Failed to load plugin:', pluginId, error);
      this.showErrorView(`Failed to load plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Unmount the current view
   */
  private async unmountCurrentView(): Promise<void> {
    if (!this.currentViewId) return;

    const view = this.viewInstances.get(this.currentViewId);
    if (view && view.unmount) {
      try {
        await view.unmount();
      } catch (error) {
        console.error('[ViewRouter] Error unmounting view:', this.currentViewId, error);
      }
    }
  }

  /**
   * Update the top bar for the current view
   */
  private updateTopBar(view: View, viewId: string): void {
    let config: TopBarConfig = {
      title: this.getViewTitle(viewId),
      actions: [],
      global: {
        projectSelector: true,
        environmentIndicator: true,
      },
    };

    // Get config from view if available
    if (view.getTopBarConfig) {
      const viewConfig = view.getTopBarConfig();
      config = { ...config, ...viewConfig };
    }

    this.topBar.setContext(viewId, config);
  }

  /**
   * Get a user-friendly title for a view ID
   */
  private getViewTitle(viewId: string): string {
    const titles: Record<string, string> = {
      'dashboard': 'Dashboard',
      'workflows': 'Workflows',
      'library': 'Library',
      'plugins': 'Plugins',
      'settings-setup': 'Setup',
      'settings-database': 'Database',
      'settings-services': 'Services',
      'settings-logs': 'Logs',
      'help': 'Help',
      'about': 'About',
    };

    return titles[viewId] || viewId;
  }

  /**
   * Add a view to history
   */
  private addToHistory(viewId: string): void {
    // Remove any forward history
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add new entry
    this.history.push(viewId);

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  /**
   * Navigate back in history
   */
  public async back(): Promise<void> {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const viewId = this.history[this.historyIndex];
      await this.navigateTo(viewId);
      console.log('[ViewRouter] Navigated back to:', viewId);
    } else {
      console.log('[ViewRouter] Cannot navigate back - at beginning of history');
    }
  }

  /**
   * Navigate forward in history
   */
  public async forward(): Promise<void> {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const viewId = this.history[this.historyIndex];
      await this.navigateTo(viewId);
      console.log('[ViewRouter] Navigated forward to:', viewId);
    } else {
      console.log('[ViewRouter] Cannot navigate forward - at end of history');
    }
  }

  /**
   * Get the currently active view
   */
  public getActiveView(): View | null {
    if (!this.currentViewId) return null;
    return this.viewInstances.get(this.currentViewId) || null;
  }

  /**
   * Get the current view ID
   */
  public getCurrentViewId(): string | null {
    return this.currentViewId;
  }

  /**
   * Show a loading view
   */
  private showLoadingView(): void {
    this.container.innerHTML = `
      <div class="view-loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading...</div>
      </div>
    `;
  }

  /**
   * Show an error view
   */
  private showErrorView(message: string): void {
    this.container.innerHTML = `
      <div class="error-message">
        <h2>Error</h2>
        <p>${message}</p>
        <button class="top-bar-action" onclick="window.location.reload()">
          Reload Application
        </button>
      </div>
    `;
  }

  /**
   * Clear view cache (force reload on next navigation)
   */
  public clearCache(viewId?: string): void {
    if (viewId) {
      this.viewInstances.delete(viewId);
      console.log('[ViewRouter] Cleared cache for view:', viewId);
    } else {
      this.viewInstances.clear();
      console.log('[ViewRouter] Cleared all view cache');
    }
  }

  /**
   * Refresh the current view
   */
  public async refresh(): Promise<void> {
    if (this.currentViewId) {
      const viewId = this.currentViewId;
      this.clearCache(viewId);
      await this.navigateTo(viewId);
      console.log('[ViewRouter] Refreshed view:', viewId);
    }
  }

  /**
   * Destroy the router
   */
  public destroy(): void {
    this.viewInstances.clear();
    this.viewClasses.clear();
    this.history = [];
    this.historyIndex = -1;
    this.currentViewId = null;
  }
}
