/**
 * LibraryView
 * Content browser for series, books, outlines, drafts, and other writing assets
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';

interface LibraryItem {
  id: string;
  type: 'series' | 'book' | 'outline' | 'draft' | 'asset';
  title: string;
  description?: string;
  status?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

type ContentType = 'all' | 'series' | 'books' | 'outlines' | 'drafts' | 'assets';
type ViewMode = 'grid' | 'list';

export class LibraryView implements View {
  private container: HTMLElement | null = null;
  private items: LibraryItem[] = [];
  private selectedType: ContentType = 'all';
  private viewMode: ViewMode = 'grid';
  private searchQuery: string = '';
  private selectedItem: LibraryItem | null = null;

  /**
   * Mount the library view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    await this.loadContent();
    this.render();
    this.attachEventListeners();
  }

  /**
   * Unmount the library view
   */
  async unmount(): Promise<void> {
    this.container = null;
    this.items = [];
    this.selectedItem = null;
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Library',
      breadcrumb: ['Library'],
      actions: [
        { id: 'refresh', label: 'Refresh', icon: '🔄' },
        { id: 'toggle-view', label: this.viewMode === 'grid' ? 'List View' : 'Grid View', icon: this.viewMode === 'grid' ? '📋' : '⊞' },
        { id: 'export', label: 'Export', icon: '📥' },
      ],
      global: {
        projectSelector: true,
        environmentIndicator: false,
      },
    };
  }

  /**
   * Handle top bar actions
   */
  async handleAction(actionId: string): Promise<void> {
    switch (actionId) {
      case 'refresh':
        await this.loadContent();
        this.render();
        break;
      case 'toggle-view':
        this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
        this.render();
        break;
      case 'export':
        this.showNotification('info', 'Export', 'Export functionality coming soon');
        break;
      default:
        console.warn('[LibraryView] Unknown action:', actionId);
    }
  }

  /**
   * Load content from database
   */
  private async loadContent(): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.databaseAdmin) {
        console.warn('[LibraryView] Database Admin API not available');
        this.items = [];
        return;
      }

      this.items = [];

      // Load content based on selected type
      if (this.selectedType === 'all' || this.selectedType === 'series') {
        await this.loadTable('series', 'series');
      }
      if (this.selectedType === 'all' || this.selectedType === 'books') {
        await this.loadTable('books', 'book');
      }
      if (this.selectedType === 'all' || this.selectedType === 'outlines') {
        await this.loadTable('outlines', 'outline');
      }
      if (this.selectedType === 'all' || this.selectedType === 'drafts') {
        await this.loadTable('drafts', 'draft');
      }

      console.log(`[LibraryView] Loaded ${this.items.length} items`);
    } catch (error) {
      console.error('[LibraryView] Failed to load content:', error);
      this.showNotification('error', 'Load Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Load items from a specific table
   */
  private async loadTable(tableName: string, type: LibraryItem['type']): Promise<void> {
    try {
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.databaseAdmin.queryRecords({
        table: tableName,
        limit: 100,
        offset: 0,
        orderBy: 'created_at DESC',
      });

      // Check different possible response formats
      const records = result?.records || result?.data?.records || result?.data?.data || result?.data || [];

      if (Array.isArray(records)) {
        const items: LibraryItem[] = records.map((record: any) => ({
          id: record.id || record.uuid || '',
          type,
          title: record.name || record.title || record.series_name || 'Untitled',
          description: record.description || record.summary || '',
          status: record.status || 'draft',
          created_at: record.created_at || new Date().toISOString(),
          updated_at: record.updated_at || new Date().toISOString(),
          metadata: record,
        }));

        this.items.push(...items);
      }
    } catch (error) {
      console.error(`[LibraryView] Failed to load ${tableName}:`, error);
      // Continue loading other tables even if one fails
    }
  }

  /**
   * Render the library view
   */
  private render(): void {
    if (!this.container) return;

    const filteredItems = this.getFilteredItems();

    this.container.innerHTML = `
      <div class="library-view">
        <!-- Filter Sidebar -->
        <aside class="library-filters">
          <div class="filter-section">
            <h3 class="filter-title">Content Type</h3>
            <div class="filter-options">
              ${this.renderTypeFilter('all', 'All Content', '📚')}
              ${this.renderTypeFilter('series', 'Series', '📖')}
              ${this.renderTypeFilter('books', 'Books', '📕')}
              ${this.renderTypeFilter('outlines', 'Outlines', '📝')}
              ${this.renderTypeFilter('drafts', 'Drafts', '✍️')}
              ${this.renderTypeFilter('assets', 'Assets', '🖼️')}
            </div>
          </div>

          <div class="filter-section">
            <h3 class="filter-title">Search</h3>
            <input
              type="text"
              class="library-search"
              placeholder="Search content..."
              value="${this.escapeHtml(this.searchQuery)}"
            />
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="library-content">
          <div class="library-header">
            <div class="library-stats">
              <span class="stat-item">
                <strong>${filteredItems.length}</strong> items
              </span>
            </div>
          </div>

          ${filteredItems.length === 0 ? this.renderEmptyState() : this.renderContentGrid(filteredItems)}
        </main>

        <!-- Detail Panel (shown when item selected) -->
        ${this.selectedItem ? this.renderDetailPanel(this.selectedItem) : ''}
      </div>
    `;
  }

  /**
   * Render type filter option
   */
  private renderTypeFilter(type: ContentType, label: string, icon: string): string {
    const count = type === 'all' ? this.items.length : this.items.filter(item => item.type === type.replace(/s$/, '') as LibraryItem['type']).length;
    const isActive = this.selectedType === type;

    return `
      <button
        class="filter-option ${isActive ? 'active' : ''}"
        data-type="${type}"
      >
        <span class="filter-icon">${icon}</span>
        <span class="filter-label">${label}</span>
        <span class="filter-count">${count}</span>
      </button>
    `;
  }

  /**
   * Get filtered items based on search and type
   */
  private getFilteredItems(): LibraryItem[] {
    let filtered = this.items;

    // Filter by type
    if (this.selectedType !== 'all') {
      const typeWithoutS = this.selectedType.replace(/s$/, '') as LibraryItem['type'];
      filtered = filtered.filter(item => item.type === typeWithoutS);
    }

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  /**
   * Render content grid/list
   */
  private renderContentGrid(items: LibraryItem[]): string {
    if (this.viewMode === 'grid') {
      return `
        <div class="library-grid">
          ${items.map(item => this.renderContentCard(item)).join('')}
        </div>
      `;
    } else {
      return `
        <div class="library-list">
          ${items.map(item => this.renderContentListItem(item)).join('')}
        </div>
      `;
    }
  }

  /**
   * Render content card (grid view)
   */
  private renderContentCard(item: LibraryItem): string {
    const icon = this.getTypeIcon(item.type);
    const statusClass = this.getStatusClass(item.status || 'draft');

    return `
      <div class="content-card" data-item-id="${item.id}" data-item-type="${item.type}">
        <div class="content-card-header">
          <span class="content-icon">${icon}</span>
          <span class="content-status ${statusClass}">${item.status || 'draft'}</span>
        </div>
        <div class="content-card-body">
          <h3 class="content-title">${this.escapeHtml(item.title)}</h3>
          <p class="content-description">${this.escapeHtml(item.description || 'No description')}</p>
        </div>
        <div class="content-card-footer">
          <div class="content-meta">
            <span class="content-type">${item.type}</span>
            <span class="content-date">${this.formatDate(item.updated_at)}</span>
          </div>
          <div class="content-actions">
            <button class="content-action-btn" data-action="view" title="View">👁️</button>
            <button class="content-action-btn" data-action="edit" title="Edit">✏️</button>
            <button class="content-action-btn" data-action="workflow" title="Run Workflow">⚡</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render content list item (list view)
   */
  private renderContentListItem(item: LibraryItem): string {
    const icon = this.getTypeIcon(item.type);
    const statusClass = this.getStatusClass(item.status || 'draft');

    return `
      <div class="content-list-item" data-item-id="${item.id}" data-item-type="${item.type}">
        <span class="content-icon">${icon}</span>
        <div class="content-info">
          <h3 class="content-title">${this.escapeHtml(item.title)}</h3>
          <p class="content-description">${this.escapeHtml(item.description || 'No description')}</p>
        </div>
        <span class="content-type">${item.type}</span>
        <span class="content-status ${statusClass}">${item.status || 'draft'}</span>
        <span class="content-date">${this.formatDate(item.updated_at)}</span>
        <div class="content-actions">
          <button class="content-action-btn" data-action="view" title="View">👁️</button>
          <button class="content-action-btn" data-action="edit" title="Edit">✏️</button>
          <button class="content-action-btn" data-action="workflow" title="Run Workflow">⚡</button>
        </div>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): string {
    return `
      <div class="library-empty">
        <div class="empty-icon">📚</div>
        <h2>No Content Found</h2>
        <p>Your library is empty. Create content using plugins or import existing work.</p>
      </div>
    `;
  }

  /**
   * Render detail panel for selected item
   */
  private renderDetailPanel(item: LibraryItem): string {
    const icon = this.getTypeIcon(item.type);

    return `
      <aside class="library-detail-panel">
        <div class="detail-header">
          <button class="detail-close" title="Close">&times;</button>
          <span class="detail-icon">${icon}</span>
          <h2 class="detail-title">${this.escapeHtml(item.title)}</h2>
        </div>
        <div class="detail-body">
          <div class="detail-section">
            <h3>Description</h3>
            <p>${this.escapeHtml(item.description || 'No description available')}</p>
          </div>
          <div class="detail-section">
            <h3>Details</h3>
            <dl class="detail-list">
              <dt>Type:</dt>
              <dd>${item.type}</dd>
              <dt>Status:</dt>
              <dd>${item.status || 'draft'}</dd>
              <dt>Created:</dt>
              <dd>${this.formatDate(item.created_at)}</dd>
              <dt>Updated:</dt>
              <dd>${this.formatDate(item.updated_at)}</dd>
            </dl>
          </div>
        </div>
        <div class="detail-footer">
          <button class="detail-action-btn primary">Open in Plugin</button>
          <button class="detail-action-btn">Run Workflow</button>
          <button class="detail-action-btn danger">Delete</button>
        </div>
      </aside>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Type filter clicks
    this.container.querySelectorAll('.filter-option').forEach(button => {
      button.addEventListener('click', async (e) => {
        const type = (e.currentTarget as HTMLElement).dataset.type as ContentType;
        if (type && type !== this.selectedType) {
          this.selectedType = type;
          await this.loadContent();
          this.render();
          this.attachEventListeners();
        }
      });
    });

    // Search input
    const searchInput = this.container.querySelector('.library-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.render();
        this.attachEventListeners();
      });
    }

    // Content card clicks
    this.container.querySelectorAll('.content-card, .content-list-item').forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        // Don't select if clicking action button
        if (target.classList.contains('content-action-btn') || target.closest('.content-action-btn')) {
          return;
        }

        const itemId = (card as HTMLElement).dataset.itemId;
        const item = this.items.find(i => i.id === itemId);
        if (item) {
          this.selectedItem = item;
          this.render();
          this.attachEventListeners();
        }
      });
    });

    // Action button clicks
    this.container.querySelectorAll('.content-action-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (e.currentTarget as HTMLElement).dataset.action;
        const card = (e.currentTarget as HTMLElement).closest('[data-item-id]') as HTMLElement;
        const itemId = card?.dataset.itemId;
        const item = this.items.find(i => i.id === itemId);

        if (item && action) {
          await this.handleContentAction(action, item);
        }
      });
    });

    // Detail panel close
    const closeButton = this.container.querySelector('.detail-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.selectedItem = null;
        this.render();
        this.attachEventListeners();
      });
    }
  }

  /**
   * Handle content action (view, edit, workflow)
   */
  private async handleContentAction(action: string, item: LibraryItem): Promise<void> {
    switch (action) {
      case 'view':
        this.selectedItem = item;
        this.render();
        this.attachEventListeners();
        break;
      case 'edit':
        this.showNotification('info', 'Edit', `Opening ${item.title} for editing...`);
        // TODO: Integrate with plugin system
        break;
      case 'workflow':
        this.showNotification('info', 'Workflow', `Running workflow for ${item.title}...`);
        // TODO: Show workflow selection dialog
        break;
      default:
        console.warn('[LibraryView] Unknown action:', action);
    }
  }

  /**
   * Get icon for content type
   */
  private getTypeIcon(type: LibraryItem['type']): string {
    const icons: Record<LibraryItem['type'], string> = {
      series: '📖',
      book: '📕',
      outline: '📝',
      draft: '✍️',
      asset: '🖼️',
    };
    return icons[type] || '📄';
  }

  /**
   * Get CSS class for status
   */
  private getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      published: 'status-published',
      draft: 'status-draft',
      archived: 'status-archived',
      active: 'status-active',
      pending: 'status-pending',
    };
    return statusMap[status.toLowerCase()] || 'status-default';
  }

  /**
   * Format date for display
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Show notification
   */
  private showNotification(type: 'success' | 'error' | 'info', title: string, message: string): void {
    console.log(`[LibraryView] ${type.toUpperCase()}: ${title} - ${message}`);
    // TODO: Integrate with global notification system
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
