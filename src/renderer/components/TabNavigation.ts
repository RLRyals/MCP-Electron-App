/**
 * TabNavigation Component
 * Manages tab-based navigation system for the FictionLab dashboard
 *
 * Features:
 * - Tab switching with smooth transitions
 * - Persistent tab state (survives app restart)
 * - Active state indication
 * - Keyboard navigation support
 * - Event system for tab changes
 */

export interface Tab {
  id: string;
  name: string;
  icon?: string;
  badge?: number;
}

export interface TabNavigationOptions {
  tabs: Tab[];
  defaultTab?: string;
  storageKey?: string;
  onTabChange?: (tabId: string) => void;
}

export class TabNavigation {
  private tabs: Tab[];
  private activeTabId: string;
  private storageKey: string;
  private onTabChange?: (tabId: string) => void;
  private tabElements: Map<string, HTMLElement> = new Map();
  private contentElements: Map<string, HTMLElement> = new Map();

  constructor(options: TabNavigationOptions) {
    this.tabs = options.tabs;
    this.storageKey = options.storageKey || 'fictionlab-active-tab';
    this.onTabChange = options.onTabChange;

    // Load the last active tab from localStorage, or use default
    const savedTab = this.loadActiveTab();
    const defaultTab = options.defaultTab || (this.tabs.length > 0 ? this.tabs[0].id : '');

    // Verify the saved tab exists, otherwise use default
    this.activeTabId = this.tabs.find(t => t.id === savedTab) ? savedTab : defaultTab;
  }

  /**
   * Initialize the tab navigation in the DOM
   */
  public initialize(): void {
    this.renderTabs();
    this.attachEventListeners();
    this.showTab(this.activeTabId);
  }

  /**
   * Render tab buttons in the navigation bar
   */
  private renderTabs(): void {
    const tabContainer = document.getElementById('tab-navigation');
    if (!tabContainer) {
      console.error('Tab navigation container not found');
      return;
    }

    tabContainer.innerHTML = '';

    this.tabs.forEach(tab => {
      const tabButton = document.createElement('button');
      tabButton.className = 'tab-button';
      tabButton.dataset.tabId = tab.id;
      tabButton.setAttribute('role', 'tab');
      tabButton.setAttribute('aria-selected', 'false');
      tabButton.setAttribute('aria-controls', `tab-panel-${tab.id}`);
      tabButton.id = `tab-${tab.id}`;

      // Add icon if provided
      if (tab.icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'tab-icon';
        iconSpan.textContent = tab.icon;
        tabButton.appendChild(iconSpan);
      }

      // Add tab name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'tab-name';
      nameSpan.textContent = tab.name;
      tabButton.appendChild(nameSpan);

      // Add badge if provided
      if (tab.badge !== undefined && tab.badge > 0) {
        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'tab-badge';
        badgeSpan.textContent = tab.badge.toString();
        tabButton.appendChild(badgeSpan);
      }

      this.tabElements.set(tab.id, tabButton);
      tabContainer.appendChild(tabButton);
    });
  }

  /**
   * Attach event listeners to tab buttons
   */
  private attachEventListeners(): void {
    this.tabElements.forEach((element, tabId) => {
      // Create handler function to ensure proper binding
      const clickHandler = (e: Event) => {
        e.preventDefault();
        console.log(`Tab clicked: ${tabId}`);
        this.switchTab(tabId);
      };

      element.addEventListener('click', clickHandler);
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key >= '1' && e.key <= '5') {
        const index = parseInt(e.key) - 1;
        if (index < this.tabs.length) {
          e.preventDefault();
          this.switchTab(this.tabs[index].id);
        }
      }
    });
  }

  /**
   * Switch to a specific tab
   */
  public switchTab(tabId: string): void {
    console.log(`switchTab called with: ${tabId}`);

    if (!this.tabs.find(t => t.id === tabId)) {
      console.error(`Tab with id "${tabId}" not found`);
      return;
    }

    if (this.activeTabId === tabId) {
      console.log(`Already on tab: ${tabId}`);
      return; // Already on this tab
    }

    console.log(`Switching from ${this.activeTabId} to ${tabId}`);

    // Hide current tab
    this.hideTab(this.activeTabId);

    // Show new tab
    this.showTab(tabId);

    // Update active tab
    this.activeTabId = tabId;

    // Save to localStorage
    this.saveActiveTab(tabId);

    // Trigger callback
    if (this.onTabChange) {
      this.onTabChange(tabId);
    }

    // Emit custom event
    window.dispatchEvent(new CustomEvent('tab-changed', {
      detail: { tabId, tabName: this.getTabName(tabId) }
    }));
  }

  /**
   * Show a specific tab
   */
  private showTab(tabId: string): void {
    // Update tab button state
    const tabButton = this.tabElements.get(tabId);
    if (tabButton) {
      tabButton.classList.add('active');
      tabButton.setAttribute('aria-selected', 'true');
    }

    // Show tab content
    const tabPanel = document.getElementById(`tab-panel-${tabId}`);
    if (tabPanel) {
      tabPanel.classList.add('active');
      tabPanel.classList.remove('hidden');
      tabPanel.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Hide a specific tab
   */
  private hideTab(tabId: string): void {
    // Update tab button state
    const tabButton = this.tabElements.get(tabId);
    if (tabButton) {
      tabButton.classList.remove('active');
      tabButton.setAttribute('aria-selected', 'false');
    }

    // Hide tab content
    const tabPanel = document.getElementById(`tab-panel-${tabId}`);
    if (tabPanel) {
      tabPanel.classList.remove('active');
      tabPanel.classList.add('hidden');
      tabPanel.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Update badge count for a specific tab
   */
  public updateBadge(tabId: string, count: number): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.badge = count;
    }

    const tabButton = this.tabElements.get(tabId);
    if (!tabButton) return;

    let badgeElement = tabButton.querySelector('.tab-badge') as HTMLElement;

    if (count > 0) {
      if (!badgeElement) {
        badgeElement = document.createElement('span');
        badgeElement.className = 'tab-badge';
        tabButton.appendChild(badgeElement);
      }
      badgeElement.textContent = count.toString();
      badgeElement.style.display = 'inline-block';
    } else if (badgeElement) {
      badgeElement.style.display = 'none';
    }
  }

  /**
   * Get the name of a tab by its ID
   */
  private getTabName(tabId: string): string {
    const tab = this.tabs.find(t => t.id === tabId);
    return tab ? tab.name : '';
  }

  /**
   * Get the currently active tab ID
   */
  public getActiveTab(): string {
    return this.activeTabId;
  }

  /**
   * Save active tab to localStorage
   */
  private saveActiveTab(tabId: string): void {
    try {
      localStorage.setItem(this.storageKey, tabId);
    } catch (error) {
      console.error('Failed to save active tab:', error);
    }
  }

  /**
   * Load active tab from localStorage
   */
  private loadActiveTab(): string {
    try {
      return localStorage.getItem(this.storageKey) || '';
    } catch (error) {
      console.error('Failed to load active tab:', error);
      return '';
    }
  }

  /**
   * Clear saved tab state
   */
  public clearSavedState(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear saved tab state:', error);
    }
  }

  /**
   * Destroy the tab navigation instance
   */
  public destroy(): void {
    // Remove event listeners
    this.tabElements.forEach((element) => {
      element.replaceWith(element.cloneNode(true));
    });

    this.tabElements.clear();
    this.contentElements.clear();
  }
}

/**
 * Create and initialize the default tab navigation for FictionLab
 */
export function createDefaultTabNavigation(): TabNavigation {
  const tabs: Tab[] = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'setup', name: 'Setup', icon: '⚙️' },
    { id: 'database', name: 'Database', icon: '💾' },
    { id: 'services', name: 'Services', icon: '🔧' },
    { id: 'logs', name: 'Logs', icon: '📋' }
  ];

  const tabNavigation = new TabNavigation({
    tabs,
    defaultTab: 'dashboard',
    storageKey: 'fictionlab-active-tab',
    onTabChange: (tabId) => {
      console.log(`Switched to tab: ${tabId}`);
    }
  });

  return tabNavigation;
}
