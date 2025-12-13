/**
 * TopBar Component
 * Contextual top bar with breadcrumbs, actions, and global controls
 *
 * Features:
 * - Dynamic title/breadcrumb based on active view
 * - Contextual action buttons (Save, Run, Export, etc.)
 * - Global controls (project selector, environment indicator, user menu)
 * - Responsive action grouping
 */

export interface TopBarAction {
  id: string;
  label: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}

export interface TopBarConfig {
  title?: string;
  breadcrumb?: string[];
  actions?: TopBarAction[];
  global?: {
    projectSelector?: boolean;
    environmentIndicator?: boolean;
    userMenu?: boolean;
  };
}

export interface TopBarOptions {
  container: HTMLElement;
}

export class TopBar {
  private container: HTMLElement;
  private currentConfig: TopBarConfig = {};
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(options: TopBarOptions) {
    this.container = options.container;
  }

  /**
   * Initialize the top bar
   */
  public initialize(): void {
    this.render();
    this.attachEventListeners();
    console.log('[TopBar] Initialized');
  }

  /**
   * Set the context (update title, actions, etc.)
   */
  public setContext(viewId: string, config: TopBarConfig): void {
    this.currentConfig = config;
    this.render();
    this.attachEventListeners();
    console.log('[TopBar] Context updated for view:', viewId, config);
  }

  /**
   * Render the top bar HTML
   */
  private render(): void {
    const { title, breadcrumb, actions, global } = this.currentConfig;

    // Check if we're on Windows (frameless window)
    const isWindows = navigator.platform.toLowerCase().includes('win');

    if (isWindows) {
      // Two-row layout for Windows
      this.container.innerHTML = `
        <div class="top-bar-row top-bar-main-row">
          <div class="top-bar-left">
            <div class="top-bar-logo">
              <img src="icon.png" alt="FictionLab" style="width: 24px; height: 24px;">
            </div>
            ${this.renderMainMenu()}
          </div>
        </div>

        ${title || breadcrumb ? `
          <div class="top-bar-row top-bar-title-row">
            ${this.renderTitleOrBreadcrumb(title, breadcrumb)}
            <div class="top-bar-center">
            ${actions ? this.renderActions(actions) : ''}
          </div>

            <div class="top-bar-right">
              ${global?.projectSelector ? this.renderProjectSelector() : ''}
              ${global?.environmentIndicator ? this.renderEnvironmentIndicator() : ''}
              ${global?.userMenu ? this.renderUserMenu() : ''}
              ${this.renderWindowControls()}
            </div>
          </div>
        ` : ''}
      `;
    } else {
      // Single-row layout for Mac/Linux
      this.container.innerHTML = `
        <div class="top-bar-left">
          <div class="top-bar-logo">
            <img src="icon.png" alt="FictionLab" style="width: 24px; height: 24px;">
          </div>
          ${this.renderTitleOrBreadcrumb(title, breadcrumb)}
        </div>

        <div class="top-bar-center">
          ${actions ? this.renderActions(actions) : ''}
        </div>

        <div class="top-bar-right">
          ${global?.projectSelector ? this.renderProjectSelector() : ''}
          ${global?.environmentIndicator ? this.renderEnvironmentIndicator() : ''}
          ${global?.userMenu ? this.renderUserMenu() : ''}
        </div>
      `;
    }
  }

  /**
   * Render title or breadcrumb
   */
  private renderTitleOrBreadcrumb(title?: string, breadcrumb?: string[]): string {
    if (breadcrumb && breadcrumb.length > 0) {
      const breadcrumbItems = breadcrumb.map((item, index) => {
        const isLast = index === breadcrumb.length - 1;
        const activeClass = isLast ? 'active' : '';
        return `
          <span class="breadcrumb-item ${activeClass}" data-breadcrumb-index="${index}">
            ${item}
          </span>
          ${!isLast ? '<span class="breadcrumb-separator">›</span>' : ''}
        `;
      }).join('');

      return `<div class="top-bar-breadcrumb">${breadcrumbItems}</div>`;
    }

    if (title) {
      return `<div class="top-bar-title">${this.escapeHtml(title)}</div>`;
    }

    return '';
  }

  /**
   * Render main menu (Windows only - for frameless window)
   */
  private renderMainMenu(): string {
    const menuItems = [
      { id: 'file', label: 'File' },
      { id: 'edit', label: 'Edit' },
      { id: 'view', label: 'View' },
      { id: 'plugins', label: 'Plugins' },
      { id: 'diagnostics', label: 'Diagnostics' },
      { id: 'help', label: 'Help' },
    ];

    return `
      <nav class="top-bar-menu">
        ${menuItems.map(item => `
          <div class="menu-item" data-menu-id="${item.id}">
            ${item.label}
          </div>
        `).join('')}
      </nav>
    `;
  }

  /**
   * Render window controls (minimize, maximize, close) for Windows
   */
  private renderWindowControls(): string {
    return `
      <div class="window-controls">
        <button class="window-control-btn minimize" data-window-action="minimize" title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button class="window-control-btn maximize" data-window-action="maximize" title="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button class="window-control-btn close" data-window-action="close" title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1"/>
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * Render action buttons
   */
  private renderActions(actions: TopBarAction[]): string {
    if (actions.length === 0) return '';

    return actions.map(action => {
      const variant = action.variant || 'default';
      const disabledAttr = action.disabled ? 'disabled' : '';
      const icon = action.icon ? `<span class="action-icon">${action.icon}</span>` : '';
      const label = `<span class="action-label">${this.escapeHtml(action.label)}</span>`;

      return `
        <button class="top-bar-action ${variant}"
                data-action-id="${action.id}"
                ${disabledAttr}>
          ${icon}
          ${label}
        </button>
      `;
    }).join('');
  }

  /**
   * Render project/series selector
   */
  private renderProjectSelector(): string {
    // TODO: Get actual project data from state management
    const currentProject = 'No Project Selected';

    return `
      <div class="project-selector" data-action="toggle-project-selector">
        <span class="project-selector-icon">📁</span>
        <span class="project-selector-text">${this.escapeHtml(currentProject)}</span>
        <span class="project-selector-arrow">▼</span>
      </div>
      <div class="project-dropdown" id="project-dropdown">
        <div class="project-dropdown-item active" data-project-id="none">
          No Project Selected
        </div>
        <!-- Dynamic project items will be inserted here -->
      </div>
    `;
  }

  /**
   * Render environment indicator
   */
  private renderEnvironmentIndicator(): string {
    // TODO: Get actual environment status from system health check
    const status: 'healthy' | 'warning' | 'error' = 'healthy';
    const statusText = status === 'healthy' ? 'All Systems Operational' :
                      status === 'warning' ? 'Some Issues Detected' :
                      'System Error';

    return `
      <div class="environment-indicator">
        <span class="environment-dot ${status}"></span>
        <span class="environment-text">${statusText}</span>
      </div>
    `;
  }

  /**
   * Render user menu
   */
  private renderUserMenu(): string {
    // TODO: Get actual user data
    const userName = 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();

    return `
      <div class="user-menu" data-action="toggle-user-menu">
        <div class="user-avatar">${userInitials}</div>
        <span class="user-name">${this.escapeHtml(userName)}</span>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Action button clicks
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle action button click
      const actionButton = target.closest('.top-bar-action') as HTMLElement;
      if (actionButton && !actionButton.hasAttribute('disabled')) {
        const actionId = actionButton.dataset.actionId;
        if (actionId) {
          console.log('[TopBar] Action clicked:', actionId);
          this.emit('action-clicked', actionId);
        }
      }

      // Handle breadcrumb click
      const breadcrumbItem = target.closest('.breadcrumb-item:not(.active)') as HTMLElement;
      if (breadcrumbItem) {
        const index = parseInt(breadcrumbItem.dataset.breadcrumbIndex || '0');
        console.log('[TopBar] Breadcrumb clicked:', index);
        this.emit('breadcrumb-clicked', index);
      }

      // Handle project selector toggle
      if (target.closest('[data-action="toggle-project-selector"]')) {
        this.toggleProjectSelector();
      }

      // Handle project selection
      const projectItem = target.closest('.project-dropdown-item') as HTMLElement;
      if (projectItem) {
        const projectId = projectItem.dataset.projectId;
        if (projectId) {
          console.log('[TopBar] Project selected:', projectId);
          this.emit('project-selected', projectId);
          this.closeProjectSelector();
        }
      }

      // Handle user menu toggle
      if (target.closest('[data-action="toggle-user-menu"]')) {
        console.log('[TopBar] User menu clicked');
        this.emit('user-menu-clicked');
      }

      // Handle window controls (minimize, maximize, close)
      const windowControlBtn = target.closest('.window-control-btn') as HTMLElement;
      if (windowControlBtn) {
        const action = windowControlBtn.dataset.windowAction;
        if (action) {
          this.handleWindowControl(action);
        }
      }

      // Handle menu item clicks
      const menuItem = target.closest('.menu-item') as HTMLElement;
      if (menuItem) {
        const menuId = menuItem.dataset.menuId;
        if (menuId) {
          console.log('[TopBar] Menu clicked:', menuId);
          this.emit('menu-clicked', menuId);
        }
      }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.project-selector') && !target.closest('.project-dropdown')) {
        this.closeProjectSelector();
      }
    });
  }

  /**
   * Toggle project selector dropdown
   */
  private toggleProjectSelector(): void {
    const dropdown = this.container.querySelector('#project-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('open');
    }
  }

  /**
   * Close project selector dropdown
   */
  private closeProjectSelector(): void {
    const dropdown = this.container.querySelector('#project-dropdown');
    if (dropdown) {
      dropdown.classList.remove('open');
    }
  }

  /**
   * Handle window control actions (minimize, maximize, close)
   */
  private handleWindowControl(action: string): void {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) {
      console.error('[TopBar] electronAPI not available');
      return;
    }

    switch (action) {
      case 'minimize':
        electronAPI.window?.minimize();
        break;
      case 'maximize':
        electronAPI.window?.maximize();
        break;
      case 'close':
        electronAPI.window?.close();
        break;
      default:
        console.warn('[TopBar] Unknown window action:', action);
    }
  }

  /**
   * Update a specific action (enable/disable, change label, etc.)
   */
  public updateAction(actionId: string, updates: Partial<TopBarAction>): void {
    if (!this.currentConfig.actions) return;

    const action = this.currentConfig.actions.find(a => a.id === actionId);
    if (action) {
      Object.assign(action, updates);
      this.render();
      this.attachEventListeners();
    }
  }

  /**
   * Set loading state for an action
   */
  public setActionLoading(actionId: string, loading: boolean): void {
    const actionButton = this.container.querySelector(`[data-action-id="${actionId}"]`) as HTMLButtonElement;
    if (actionButton) {
      if (loading) {
        actionButton.disabled = true;
        const originalContent = actionButton.innerHTML;
        actionButton.dataset.originalContent = originalContent;
        actionButton.innerHTML = '<span class="loading-spinner"></span>';
      } else {
        actionButton.disabled = false;
        const originalContent = actionButton.dataset.originalContent;
        if (originalContent) {
          actionButton.innerHTML = originalContent;
          delete actionButton.dataset.originalContent;
        }
      }
    }
  }

  /**
   * Show a notification in the top bar (temporary)
   */
  public showNotification(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000): void {
    const notification = document.createElement('div');
    notification.className = `top-bar-notification ${type}`;
    notification.textContent = message;

    this.container.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, duration);
  }

  /**
   * Update environment indicator status
   */
  public updateEnvironmentStatus(status: 'healthy' | 'warning' | 'error', text?: string): void {
    const indicator = this.container.querySelector('.environment-indicator');
    if (indicator) {
      const dot = indicator.querySelector('.environment-dot');
      const textEl = indicator.querySelector('.environment-text');

      if (dot) {
        dot.className = `environment-dot ${status}`;
      }

      if (textEl && text) {
        textEl.textContent = text;
      }
    }
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
          console.error(`[TopBar] Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Destroy the top bar
   */
  public destroy(): void {
    this.container.innerHTML = '';
    this.listeners.clear();
  }
}
