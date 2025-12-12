/**
 * PluginsLauncher
 * Grid/list view of all plugins with search and filter
 * Allows pinning/unpinning and launching plugins
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';

export class PluginsLauncher implements View {
  private container: HTMLElement | null = null;
  private plugins: any[] = [];
  private viewMode: 'grid' | 'list' = 'grid';
  private searchQuery: string = '';

  /**
   * Mount the plugins launcher view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Fetch plugins from electronAPI
    await this.loadPlugins();

    // Render the view
    this.render();

    // Attach event listeners
    this.attachEventListeners();

    console.log('[PluginsLauncher] Mounted with', this.plugins.length, 'plugins');
  }

  /**
   * Load plugins from the plugin manager
   */
  private async loadPlugins(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && electronAPI.plugins && electronAPI.plugins.list) {
        this.plugins = await electronAPI.plugins.list();
      } else {
        console.warn('[PluginsLauncher] Plugin API not available');
        this.plugins = [];
      }
    } catch (error) {
      console.error('[PluginsLauncher] Failed to load plugins:', error);
      this.plugins = [];
    }
  }

  /**
   * Render the plugins launcher
   */
  private render(): void {
    if (!this.container) return;

    const filteredPlugins = this.filterPlugins();

    this.container.innerHTML = `
      <div class="plugins-launcher">
        <div class="plugins-header">
          <div class="plugins-search">
            <span class="search-icon">🔍</span>
            <input type="text"
                   id="plugin-search"
                   placeholder="Search plugins..."
                   value="${this.escapeHtml(this.searchQuery)}">
          </div>
          <div class="plugins-controls">
            <button class="view-toggle ${this.viewMode === 'grid' ? 'active' : ''}"
                    data-view="grid"
                    title="Grid View">
              ⊞
            </button>
            <button class="view-toggle ${this.viewMode === 'list' ? 'active' : ''}"
                    data-view="list"
                    title="List View">
              ☰
            </button>
          </div>
        </div>

        <div class="plugins-container ${this.viewMode}">
          ${filteredPlugins.length > 0
            ? filteredPlugins.map(plugin => this.renderPluginCard(plugin)).join('')
            : this.renderEmptyState()}
        </div>
      </div>
    `;
  }

  /**
   * Render a single plugin card
   */
  private renderPluginCard(plugin: any): string {
    const isPinned = this.isPluginPinned(plugin.id);
    const isActive = plugin.status === 'active';

    return `
      <div class="plugin-card ${isActive ? 'active' : 'inactive'}" data-plugin-id="${plugin.id}">
        <div class="plugin-icon">${plugin.icon || '🔌'}</div>
        <div class="plugin-info">
          <h3 class="plugin-name">${this.escapeHtml(plugin.name || plugin.id)}</h3>
          <p class="plugin-description">${this.escapeHtml(plugin.description || 'No description')}</p>
          <div class="plugin-meta">
            <span class="plugin-version">v${plugin.version || '1.0.0'}</span>
            <span class="plugin-status ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        <div class="plugin-actions">
          ${isActive ? `
            <button class="plugin-action-btn primary" data-action="launch" title="Launch Plugin">
              Launch
            </button>
          ` : ''}
          <button class="plugin-action-btn ${isPinned ? 'pinned' : ''}"
                  data-action="pin"
                  title="${isPinned ? 'Unpin' : 'Pin'}">
            ${isPinned ? '📌' : '📍'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): string {
    return `
      <div class="plugins-empty">
        <div class="empty-icon">🔌</div>
        <h3>No Plugins Found</h3>
        <p>${this.searchQuery ? 'No plugins match your search criteria.' : 'No plugins are currently installed.'}</p>
      </div>
    `;
  }

  /**
   * Filter plugins based on search query
   */
  private filterPlugins(): any[] {
    if (!this.searchQuery) return this.plugins;

    const query = this.searchQuery.toLowerCase();
    return this.plugins.filter(plugin => {
      const name = (plugin.name || plugin.id || '').toLowerCase();
      const description = (plugin.description || '').toLowerCase();
      return name.includes(query) || description.includes(query);
    });
  }

  /**
   * Check if a plugin is pinned
   */
  private isPluginPinned(pluginId: string): boolean {
    try {
      const pinned = localStorage.getItem('fictionlab-pinned-plugins');
      if (!pinned) return false;
      const pinnedPlugins = JSON.parse(pinned);
      return pinnedPlugins.includes(pluginId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Toggle plugin pin status
   */
  private togglePin(pluginId: string): void {
    try {
      const pinned = localStorage.getItem('fictionlab-pinned-plugins');
      let pinnedPlugins = pinned ? JSON.parse(pinned) : [];

      if (pinnedPlugins.includes(pluginId)) {
        // Unpin
        pinnedPlugins = pinnedPlugins.filter((id: string) => id !== pluginId);
      } else {
        // Pin (max 5)
        if (pinnedPlugins.length >= 5) {
          alert('Maximum of 5 pinned plugins reached. Unpin a plugin first.');
          return;
        }
        pinnedPlugins.push(pluginId);
      }

      localStorage.setItem('fictionlab-pinned-plugins', JSON.stringify(pinnedPlugins));

      // Re-render to update UI
      this.render();
      this.attachEventListeners();

      // Notify sidebar to update
      window.dispatchEvent(new CustomEvent('pinned-plugins-changed'));
    } catch (error) {
      console.error('[PluginsLauncher] Failed to toggle pin:', error);
    }
  }

  /**
   * Launch a plugin
   */
  private launchPlugin(pluginId: string): void {
    const viewRouter = (window as any).__viewRouter__;
    if (viewRouter) {
      viewRouter.navigateTo('plugin', { pluginId, viewName: 'default' });
    } else {
      console.error('[PluginsLauncher] ViewRouter not found');
    }
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Search input
    const searchInput = this.container.querySelector('#plugin-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.render();
        this.attachEventListeners();
      });
    }

    // View toggle
    this.container.querySelectorAll('.view-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const view = target.dataset.view as 'grid' | 'list';
        this.viewMode = view;
        this.render();
        this.attachEventListeners();
      });
    });

    // Plugin actions
    this.container.querySelectorAll('.plugin-card').forEach(card => {
      const pluginId = (card as HTMLElement).dataset.pluginId;
      if (!pluginId) return;

      // Launch button
      const launchBtn = card.querySelector('[data-action="launch"]');
      if (launchBtn) {
        launchBtn.addEventListener('click', () => this.launchPlugin(pluginId));
      }

      // Pin button
      const pinBtn = card.querySelector('[data-action="pin"]');
      if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePin(pluginId);
        });
      }

      // Card click to launch (if active)
      const plugin = this.plugins.find(p => p.id === pluginId);
      if (plugin && plugin.status === 'active') {
        card.addEventListener('click', (e) => {
          // Don't trigger if clicking on action buttons
          if ((e.target as HTMLElement).closest('.plugin-action-btn')) return;
          this.launchPlugin(pluginId);
        });
      }
    });
  }

  /**
   * Unmount the view
   */
  async unmount(): Promise<void> {
    this.container = null;
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Plugins',
      actions: [
        { id: 'refresh', label: 'Refresh', icon: '🔄' },
        { id: 'manage', label: 'Manage Plugins', icon: '⚙️' },
      ],
      global: {
        projectSelector: false,
        environmentIndicator: true,
      },
    };
  }

  /**
   * Handle action from top bar
   */
  handleAction(actionId: string): void {
    switch (actionId) {
      case 'refresh':
        this.loadPlugins().then(() => {
          this.render();
          this.attachEventListeners();
        });
        break;
      case 'manage':
        // TODO: Open plugin management dialog
        console.log('[PluginsLauncher] Manage plugins');
        break;
      default:
        console.warn('[PluginsLauncher] Unknown action:', actionId);
    }
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
