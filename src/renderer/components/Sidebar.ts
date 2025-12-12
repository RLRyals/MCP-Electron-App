/**
 * Sidebar Component
 * Vertical navigation sidebar for FictionLab dashboard
 *
 * Features:
 * - Primary/secondary navigation items
 * - Collapsible Settings section
 * - Pinned plugins (max 5)
 * - Active view highlighting
 * - Keyboard navigation (Ctrl+1-9)
 * - Persistent state (localStorage)
 */

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  section?: 'primary' | 'secondary';
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children?: SidebarItem[];
  badge?: number;
}

export interface SidebarOptions {
  container: HTMLElement;
  defaultView?: string;
}

export class Sidebar {
  private container: HTMLElement;
  private defaultView: string;
  private activeViewId: string | null = null;
  private navigationTree: SidebarItem[];
  private listeners: Map<string, Set<Function>> = new Map();
  private pinnedPlugins: string[] = [];

  // Storage keys
  private readonly STORAGE_ACTIVE_VIEW = 'fictionlab-active-view';
  private readonly STORAGE_PINNED_PLUGINS = 'fictionlab-pinned-plugins';
  private readonly STORAGE_SETTINGS_EXPANDED = 'fictionlab-sidebar-settings-expanded';

  constructor(options: SidebarOptions) {
    this.container = options.container;
    this.defaultView = options.defaultView || 'dashboard';
    this.navigationTree = this.createNavigationTree();
    this.pinnedPlugins = this.loadPinnedPlugins();
  }

  /**
   * Initialize the sidebar
   */
  public initialize(): void {
    this.render();
    this.attachEventListeners();

    // Load saved active view or use default
    const savedView = localStorage.getItem(this.STORAGE_ACTIVE_VIEW);
    const initialView = savedView || this.defaultView;
    this.setActiveView(initialView);

    console.log('[Sidebar] Initialized with view:', initialView);
  }

  /**
   * Create the navigation tree structure
   */
  private createNavigationTree(): SidebarItem[] {
    return [
      // Primary Navigation
      { id: 'dashboard', label: 'Dashboard', icon: '📊', section: 'primary' },
      { id: 'workflows', label: 'Workflows', icon: '🔧', section: 'primary' },
      { id: 'library', label: 'Library', icon: '📚', section: 'primary' },
      { id: 'plugins', label: 'Plugins', icon: '🔌', section: 'primary' },
      {
        id: 'settings',
        label: 'Settings',
        icon: '⚙️',
        section: 'primary',
        collapsible: true,
        defaultExpanded: false,
        children: [
          { id: 'settings-setup', label: 'Setup', icon: '' },
          { id: 'settings-database', label: 'Database', icon: '' },
          { id: 'settings-services', label: 'Services', icon: '' },
          { id: 'settings-logs', label: 'Logs', icon: '' },
        ],
      },

      // Secondary Navigation
      { id: 'help', label: 'Help', icon: '❓', section: 'secondary' },
      { id: 'about', label: 'About', icon: 'ℹ️', section: 'secondary' },
    ];
  }

  /**
   * Render the sidebar HTML
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-logo">FL</div>
        <div class="sidebar-title">FictionLab</div>
      </div>

      <nav class="sidebar-navigation">
        ${this.renderPrimaryNavigation()}
        ${this.renderPinnedPlugins()}
        ${this.renderSecondaryNavigation()}
      </nav>

      <div class="sidebar-footer">
        <div class="nav-item" data-action="toggle-collapse">
          <span class="nav-item-icon">◀</span>
          <span class="nav-item-label">Collapse</span>
        </div>
      </div>
    `;
  }

  /**
   * Render primary navigation section
   */
  private renderPrimaryNavigation(): string {
    const primaryItems = this.navigationTree.filter(item => !item.section || item.section === 'primary');
    return `
      <div class="nav-section">
        ${primaryItems.map(item => this.renderNavigationItem(item)).join('')}
      </div>
    `;
  }

  /**
   * Render secondary navigation section
   */
  private renderSecondaryNavigation(): string {
    const secondaryItems = this.navigationTree.filter(item => item.section === 'secondary');
    if (secondaryItems.length === 0) return '';

    return `
      <div class="nav-section">
        <div class="nav-section-title">About</div>
        ${secondaryItems.map(item => this.renderNavigationItem(item)).join('')}
      </div>
    `;
  }

  /**
   * Render a single navigation item
   */
  private renderNavigationItem(item: SidebarItem, isChild: boolean = false): string {
    const hasChildren = item.children && item.children.length > 0;
    const isCollapsible = item.collapsible && hasChildren;
    const isExpanded = isCollapsible ? this.getCollapsibleState(item.id) : false;
    const activeClass = this.activeViewId === item.id ? 'active' : '';
    const collapsibleClass = isCollapsible ? 'nav-item-collapsible' : '';
    const expandedClass = isExpanded ? 'expanded' : '';
    const badge = item.badge ? `<span class="nav-item-badge">${item.badge}</span>` : '';

    let html = `
      <div class="${collapsibleClass} ${expandedClass}">
        <div class="nav-item ${activeClass}" data-view-id="${item.id}" role="button" tabindex="0">
          <span class="nav-item-icon">${item.icon}</span>
          <span class="nav-item-label">${item.label}</span>
          ${badge}
          ${isCollapsible ? '<span class="nav-item-collapse-icon">▶</span>' : ''}
        </div>
    `;

    if (hasChildren) {
      html += `
        <div class="nav-children ${expandedClass}">
          ${item.children!.map(child => this.renderNavigationItem(child, true)).join('')}
        </div>
      `;
    }

    html += `</div>`;

    return html;
  }

  /**
   * Render pinned plugins section
   */
  private renderPinnedPlugins(): string {
    if (this.pinnedPlugins.length === 0) {
      return '';
    }

    const pluginItems = this.pinnedPlugins.map(pluginId => `
      <div class="pinned-plugin-item ${this.activeViewId === `plugin-${pluginId}` ? 'active' : ''}"
           data-view-id="plugin-${pluginId}"
           data-plugin-id="${pluginId}">
        <span class="pinned-plugin-icon">📌</span>
        <span class="pinned-plugin-name">${pluginId}</span>
        <span class="pinned-plugin-unpin" data-action="unpin" title="Unpin">✕</span>
      </div>
    `).join('');

    return `
      <div class="pinned-plugins-section">
        <div class="pinned-plugins-header">
          <span>Pinned</span>
        </div>
        ${pluginItems}
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Navigation item clicks
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle navigation item click
      const navItem = target.closest('.nav-item') as HTMLElement;
      if (navItem && navItem.dataset.viewId) {
        const viewId = navItem.dataset.viewId;

        // Check if this is a collapsible item
        const parent = navItem.parentElement;
        if (parent?.classList.contains('nav-item-collapsible')) {
          // Toggle collapsed state
          const isExpanded = parent.classList.contains('expanded');
          this.toggleCollapsible(viewId, !isExpanded);

          // If Settings item, don't navigate
          if (viewId === 'settings') {
            return;
          }
        }

        this.navigateTo(viewId);
      }

      // Handle pinned plugin click
      const pinnedItem = target.closest('.pinned-plugin-item') as HTMLElement;
      if (pinnedItem && pinnedItem.dataset.pluginId) {
        const pluginId = pinnedItem.dataset.pluginId;
        this.navigateTo(`plugin-${pluginId}`);
      }

      // Handle unpin action
      if (target.dataset.action === 'unpin') {
        e.stopPropagation();
        const pinnedItem = target.closest('.pinned-plugin-item') as HTMLElement;
        if (pinnedItem?.dataset.pluginId) {
          this.unpinPlugin(pinnedItem.dataset.pluginId);
        }
      }

      // Handle collapse toggle
      if (target.closest('[data-action="toggle-collapse"]')) {
        this.toggleCollapse();
      }
    });

    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains('nav-item')) {
        // Enter/Space to activate
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          target.click();
        }

        // Arrow keys for navigation
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const items = Array.from(this.container.querySelectorAll('.nav-item'));
          const currentIndex = items.indexOf(target);
          const nextIndex = e.key === 'ArrowDown'
            ? (currentIndex + 1) % items.length
            : (currentIndex - 1 + items.length) % items.length;
          (items[nextIndex] as HTMLElement).focus();
        }
      }
    });

    // Global keyboard shortcuts (Ctrl+1-9)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        const primaryItems = this.navigationTree.filter(item => !item.section || item.section === 'primary');
        if (index < primaryItems.length) {
          e.preventDefault();
          this.navigateTo(primaryItems[index].id);
        }
      }
    });
  }

  /**
   * Navigate to a view
   */
  private navigateTo(viewId: string): void {
    console.log('[Sidebar] Navigating to:', viewId);
    this.setActiveView(viewId);
    this.emit('navigate', viewId);
  }

  /**
   * Set the active view
   */
  public setActiveView(viewId: string): void {
    this.activeViewId = viewId;

    // Update visual state
    this.container.querySelectorAll('.nav-item.active, .pinned-plugin-item.active').forEach(item => {
      item.classList.remove('active');
    });

    const activeItem = this.container.querySelector(`[data-view-id="${viewId}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }

    // Save to localStorage
    localStorage.setItem(this.STORAGE_ACTIVE_VIEW, viewId);
  }

  /**
   * Toggle collapsible section
   */
  private toggleCollapsible(itemId: string, expanded: boolean): void {
    const collapsibleItem = this.container.querySelector(`[data-view-id="${itemId}"]`)?.parentElement;
    if (!collapsibleItem) return;

    const childrenContainer = collapsibleItem.querySelector('.nav-children');
    if (!childrenContainer) return;

    if (expanded) {
      collapsibleItem.classList.add('expanded');
      childrenContainer.classList.add('expanded');
    } else {
      collapsibleItem.classList.remove('expanded');
      childrenContainer.classList.remove('expanded');
    }

    // Save state to localStorage
    if (itemId === 'settings') {
      localStorage.setItem(this.STORAGE_SETTINGS_EXPANDED, String(expanded));
    }
  }

  /**
   * Get collapsible state from localStorage
   */
  private getCollapsibleState(itemId: string): boolean {
    if (itemId === 'settings') {
      const saved = localStorage.getItem(this.STORAGE_SETTINGS_EXPANDED);
      return saved === 'true';
    }
    return false;
  }

  /**
   * Toggle sidebar collapse
   */
  private toggleCollapse(): void {
    this.container.classList.toggle('collapsed');
    const isCollapsed = this.container.classList.contains('collapsed');
    console.log('[Sidebar] Collapsed:', isCollapsed);
  }

  /**
   * Pin a plugin
   */
  public pinPlugin(pluginId: string): void {
    if (this.pinnedPlugins.includes(pluginId)) {
      console.log('[Sidebar] Plugin already pinned:', pluginId);
      return;
    }

    if (this.pinnedPlugins.length >= 5) {
      console.warn('[Sidebar] Maximum of 5 pinned plugins reached');
      return;
    }

    this.pinnedPlugins.push(pluginId);
    this.savePinnedPlugins();
    this.render();
    this.attachEventListeners();

    console.log('[Sidebar] Pinned plugin:', pluginId);
  }

  /**
   * Unpin a plugin
   */
  public unpinPlugin(pluginId: string): void {
    const index = this.pinnedPlugins.indexOf(pluginId);
    if (index === -1) {
      console.log('[Sidebar] Plugin not pinned:', pluginId);
      return;
    }

    this.pinnedPlugins.splice(index, 1);
    this.savePinnedPlugins();
    this.render();
    this.attachEventListeners();

    console.log('[Sidebar] Unpinned plugin:', pluginId);
  }

  /**
   * Get pinned plugins
   */
  public getPinnedPlugins(): string[] {
    return [...this.pinnedPlugins];
  }

  /**
   * Load pinned plugins from localStorage
   */
  private loadPinnedPlugins(): string[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_PINNED_PLUGINS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[Sidebar] Failed to load pinned plugins:', error);
      return [];
    }
  }

  /**
   * Save pinned plugins to localStorage
   */
  private savePinnedPlugins(): void {
    try {
      localStorage.setItem(this.STORAGE_PINNED_PLUGINS, JSON.stringify(this.pinnedPlugins));
    } catch (error) {
      console.error('[Sidebar] Failed to save pinned plugins:', error);
    }
  }

  /**
   * Update badge count for a view
   */
  public updateBadge(viewId: string, count: number): void {
    const item = this.navigationTree.find(item => {
      if (item.id === viewId) return true;
      if (item.children) {
        return item.children.some(child => child.id === viewId);
      }
      return false;
    });

    if (item) {
      item.badge = count > 0 ? count : undefined;
      this.render();
      this.attachEventListeners();
    }
  }

  /**
   * Event emitter - register a listener
   */
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Event emitter - unregister a listener
   */
  public off(event: string, callback: Function): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  /**
   * Event emitter - emit an event
   */
  private emit(event: string, ...args: any[]): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[Sidebar] Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Destroy the sidebar
   */
  public destroy(): void {
    this.container.innerHTML = '';
    this.listeners.clear();
  }
}
