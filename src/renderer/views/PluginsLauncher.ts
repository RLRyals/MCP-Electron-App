/**
 * PluginsLauncher
 * Grid/list view of all plugins with search and filter
 * Allows pinning/unpinning and launching plugins
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig} from '../components/TopBar.js';
import { PluginInstallWizard } from '../components/PluginInstallWizard.js';

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

    // Plugin data structure: { id, manifest: { pluginType, name, version, icon, description }, status }
    const manifest = plugin.manifest || {};
    const isUtility = manifest.pluginType === 'utility';
    const name = manifest.name || plugin.id;
    const description = manifest.description || 'No description';
    const version = manifest.version || '1.0.0';
    const icon = manifest.icon || '🔌';

    return `
      <div class="plugin-card ${isActive ? 'active' : 'inactive'}" data-plugin-id="${plugin.id}">
        <div class="plugin-icon">${icon}</div>
        <div class="plugin-info">
          <h3 class="plugin-name">${this.escapeHtml(name)}</h3>
          <p class="plugin-description">${this.escapeHtml(description)}</p>
          <div class="plugin-meta">
            <span class="plugin-version">v${version}</span>
            <span class="plugin-status ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
            ${isUtility ? '<span class="plugin-type">Utility</span>' : ''}
          </div>
        </div>
        <div class="plugin-actions">
          ${isActive && !isUtility ? `
            <button class="plugin-action-btn primary" data-action="launch" title="Launch Plugin">
              Launch
            </button>
            <button class="plugin-action-btn ${isPinned ? 'pinned' : ''}"
                    data-action="pin"
                    title="${isPinned ? 'Unpin' : 'Pin'}">
              ${isPinned ? '📌' : '📍'}
            </button>
          ` : ''}
          ${isUtility ? `
            <span class="plugin-utility-label">Backend Service</span>
          ` : ''}
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

      // Settings button (for utility plugins)
      const settingsBtn = card.querySelector('[data-action="settings"]');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            // Build the IPC channel name based on plugin ID
            const channelName = `plugin:${pluginId}:show-settings`;
            console.log('[PluginsLauncher] Invoking settings handler:', channelName);

            const result = await (window as any).electronAPI.invoke(channelName);
            if (result && result.success) {
              console.log('[PluginsLauncher] Settings configured:', result);

              // Show success notification
              if ((window as any).showNotification) {
                (window as any).showNotification(result.message || 'Settings saved successfully', 'success');
              }
            }
          } catch (error) {
            console.error('[PluginsLauncher] Failed to show settings:', error);

            // Show error notification
            if ((window as any).showNotification) {
              (window as any).showNotification(
                `Failed to open settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'error'
              );
            }
          }
        });
      }

      // Pin button
      const pinBtn = card.querySelector('[data-action="pin"]');
      if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePin(pluginId);
        });
      }

      // Card click to launch (if active and not a utility plugin)
      const plugin = this.plugins.find(p => p.id === pluginId);
      const pluginType = plugin?.manifest?.pluginType;
      if (plugin && plugin.status === 'active' && pluginType !== 'utility') {
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
        { id: 'import', label: 'Import Plugin', icon: '📥' },
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
  async handleAction(actionId: string): Promise<void> {
    switch (actionId) {
      case 'refresh':
        this.loadPlugins().then(() => {
          this.render();
          this.attachEventListeners();
        });
        break;
      case 'import':
        console.log('[PluginsLauncher] Import action triggered');
        // Show the plugin install wizard
        console.log('[PluginsLauncher] Creating PluginInstallWizard...');
        const wizard = new PluginInstallWizard({
          onComplete: async (success, pluginId) => {
            if (success) {
              // Refresh plugin list
              await this.loadPlugins();
              this.render();
              this.attachEventListeners();

              // Notify that a plugin was installed (for sidebar/router updates)
              window.dispatchEvent(new CustomEvent('plugin-installed', { detail: { pluginId } }));

              // Show success notification
              if ((window as any).showNotification) {
                (window as any).showNotification(
                  `Plugin ${pluginId || ''} installed successfully! Reloading...`,
                  'success'
                );
              }

              // Reload app to activate plugin
              setTimeout(() => {
                const electronAPI = (window as any).electronAPI;
                if (electronAPI && electronAPI.app && electronAPI.app.relaunch) {
                  electronAPI.app.relaunch();
                }
              }, 1500);
            }
          },
          onCancel: () => {
            console.log('[PluginsLauncher] Install wizard cancelled');
          }
        });
        console.log('[PluginsLauncher] Wizard created, calling show()...');
        wizard.show();
        console.log('[PluginsLauncher] Wizard.show() called');
        break;
      case 'manage':
        // Show plugin management dialog
        this.showPluginManagementDialog();
        break;
      default:
        console.warn('[PluginsLauncher] Unknown action:', actionId);
    }
  }

  /**
   * Show plugin management dialog
   */
  private async showPluginManagementDialog(): Promise<void> {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'plugin-manage-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'plugin-manage-dialog';
    dialog.style.cssText = `
      background: var(--bg-secondary, #1e1e1e);
      border-radius: 12px;
      padding: 24px;
      min-width: 500px;
      max-width: 700px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;

    dialog.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: var(--text-primary, #fff);">Manage Plugins</h2>
        <button id="close-manage-dialog" style="background: none; border: none; color: var(--text-secondary, #888); font-size: 24px; cursor: pointer;">&times;</button>
      </div>
      <div id="github-token-section" style="
        background: var(--bg-tertiary, #2a2a2a);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
        color: var(--text-primary, #fff);
        font-size: 13px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div>
            <strong>GitHub Plugins Token</strong>
            <div id="github-token-status" style="color: var(--text-secondary, #888); margin-top: 2px;">Checking…</div>
          </div>
          <button id="github-token-edit-btn" style="
            background: var(--bg-quaternary, #3a3a3a);
            color: var(--text-primary, #fff);
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
          ">Set Token…</button>
        </div>
        <div id="github-token-edit-row" style="display: none; margin-top: 10px; gap: 8px; align-items: center;">
          <input type="password" id="github-token-input" placeholder="Fine-grained PAT (Contents: read-only)" style="
            flex: 1;
            padding: 6px 8px;
            border-radius: 6px;
            border: 1px solid var(--border-color, #444);
            background: var(--bg-secondary, #1e1e1e);
            color: var(--text-primary, #fff);
            font-size: 12px;
            width: 70%;
          ">
          <button id="github-token-save-btn" style="
            background: var(--accent-color, #4a7dfc);
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
          ">Save</button>
        </div>
        <p style="color: var(--text-tertiary, #666); margin: 8px 0 0 0; font-size: 11px;">
          Scoped to RLRyals/fictionlab-workflow only, read-only Contents access. Required to check/install updates for private-repo plugins (fictionlab-workflow, fictionlab-kanban).
        </p>
      </div>
      <div id="plugin-list-container" style="color: var(--text-primary, #fff);">
        <div style="text-align: center; padding: 20px;">Loading plugins...</div>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Close button handler
    const closeBtn = dialog.querySelector('#close-manage-dialog');
    closeBtn?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // GitHub Plugins Token (bead mea-6tt): masked status + set/change.
    await this.setupGithubTokenSection(dialog);

    // Load plugins
    const container = dialog.querySelector('#plugin-list-container');
    if (!container) return;

    try {
      const plugins = await (window as any).electronAPI.plugins.listInstalled();

      if (plugins.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--text-secondary, #888);">
            <p>No plugins installed</p>
            <p style="font-size: 14px;">Use "Import Plugin" to install plugins</p>
          </div>
        `;
        return;
      }

      container.innerHTML = '';

      for (const plugin of plugins) {
        const card = document.createElement('div');
        card.className = 'plugin-manage-card';
        card.style.cssText = `
          background: var(--bg-tertiary, #2a2a2a);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
        `;

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h3 style="margin: 0 0 4px 0; color: var(--text-primary, #fff);">${this.escapeHtml(plugin.name)}</h3>
              <p style="margin: 0 0 8px 0; color: var(--text-secondary, #888); font-size: 13px;">${this.escapeHtml(plugin.description || 'No description')}</p>
              <div style="font-size: 12px; color: var(--text-tertiary, #666);">
                <span>Version: ${this.escapeHtml(plugin.version)}</span>
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap;">
              <button class="plugin-github-check-btn" data-plugin-id="${this.escapeHtml(plugin.id)}" title="Check GitHub releases for an update" style="
                background: var(--bg-quaternary, #3a3a3a);
                color: var(--text-primary, #fff);
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
              ">Check for Updates</button>
              <button class="plugin-folder-btn" data-plugin-id="${this.escapeHtml(plugin.id)}" title="Update this plugin in place from a local plugin folder" style="
                background: var(--bg-quaternary, #3a3a3a);
                color: var(--text-primary, #fff);
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
              ">Update…</button>
              <button class="plugin-open-btn" data-plugin-id="${this.escapeHtml(plugin.id)}" title="Open plugin folder in file explorer" style="
                background: var(--bg-quaternary, #3a3a3a);
                color: var(--text-primary, #fff);
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
              ">Open</button>
              <button class="plugin-uninstall-btn" data-plugin-id="${this.escapeHtml(plugin.id)}" style="
                background: var(--danger-color, #d32f2f);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
              ">Uninstall</button>
            </div>
          </div>
          <div class="plugin-status" data-plugin-id="${this.escapeHtml(plugin.id)}" style="margin-top: 8px; font-size: 12px; display: none;"></div>
        `;

        container.appendChild(card);
      }

      // Add event listeners for "Update…" buttons.
      // Flow lives in the main process (src/main/handlers/plugin-update-handlers.ts):
      // pick folder -> validate (id + strictly-greater semver, refused before
      // any file is touched) -> native confirm (current -> new version) ->
      // atomic swap with .bak rollback -> native "Restart Now / Later" prompt.
      // This handler just reflects whatever the main process reports back.
      container.querySelectorAll('.plugin-folder-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const pluginId = (e.target as HTMLElement).getAttribute('data-plugin-id');
          if (!pluginId) return;

          const statusEl = container.querySelector(`.plugin-status[data-plugin-id="${pluginId}"]`) as HTMLElement;
          const button = e.target as HTMLButtonElement;

          button.disabled = true;
          button.textContent = 'Select Folder...';

          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = 'var(--text-secondary, #888)';
            statusEl.textContent = 'Select the updated plugin folder containing plugin.json...';
          }

          try {
            const result = await (window as any).electronAPI.plugins.updateFromFolder(pluginId);

            if (result.cancelled) {
              button.disabled = false;
              button.textContent = 'Update…';
              if (statusEl) statusEl.style.display = 'none';
              return;
            }

            if (result.refused) {
              // Refused before any file was touched: id mismatch, downgrade,
              // or an invalid bundle. Nothing changed on disk.
              if (statusEl) {
                statusEl.style.color = 'var(--danger-color, #d32f2f)';
                statusEl.textContent = result.message || 'Update refused.';
              }
              button.disabled = false;
              button.textContent = 'Update…';
              return;
            }

            if (statusEl) {
              statusEl.style.color = 'var(--success-color, #4caf50)';
              statusEl.textContent = result.message || 'Update successful.';
            }
            button.textContent = result.restarting ? 'Restarting…' : 'Updated';
            // Leave the button disabled: either FictionLab is about to
            // relaunch, or the swap is done and re-running it against the
            // now-current version would just be refused as "not an upgrade".
          } catch (error: any) {
            if (statusEl) {
              statusEl.style.color = 'var(--danger-color, #d32f2f)';
              statusEl.textContent = `Update failed: ${error.message}`;
            }
            button.disabled = false;
            button.textContent = 'Update…';
          }
        });
      });

      // Add event listeners for "Check for Updates" buttons (bead mea-6tt:
      // GitHub-release plugin updater). Flow lives in the main process
      // (plugin-github-updater.ts + handlers/plugin-github-update-handlers.ts):
      // resolve update source -> fetch latest release -> compare versions ->
      // on "Install", download the matching asset, gate on its declared
      // dependencies, then reuse the same atomic swap as the folder updater.
      container.querySelectorAll('.plugin-github-check-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const pluginId = (e.target as HTMLElement).getAttribute('data-plugin-id');
          if (!pluginId) return;

          const statusEl = container.querySelector(`.plugin-status[data-plugin-id="${pluginId}"]`) as HTMLElement;
          const button = e.target as HTMLButtonElement;

          button.disabled = true;
          button.textContent = 'Checking…';
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = 'var(--text-secondary, #888)';
            statusEl.textContent = 'Checking GitHub for a newer release…';
          }

          try {
            const result = await (window as any).electronAPI.plugins.checkGithubUpdate(pluginId);
            button.disabled = false;
            button.textContent = 'Check for Updates';

            if (!statusEl) return;

            switch (result.status) {
              case 'update-available':
                statusEl.style.color = 'var(--accent-color, #4a7dfc)';
                statusEl.innerHTML = '';
                statusEl.textContent = `Update available: ${result.currentVersion ?? 'unknown'} → ${result.latestVersion}. `;
                {
                  const installBtn = document.createElement('button');
                  installBtn.textContent = 'Install Update';
                  installBtn.style.cssText = 'margin-left: 6px; background: var(--accent-color, #4a7dfc); color: white; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;';
                  installBtn.addEventListener('click', () => this.installGithubUpdate(pluginId, statusEl, installBtn));
                  statusEl.appendChild(installBtn);
                }
                break;
              case 'up-to-date':
                statusEl.style.color = 'var(--success-color, #4caf50)';
                statusEl.textContent = `Already up to date (v${result.currentVersion}).`;
                break;
              case 'token-required':
                statusEl.style.color = 'var(--danger-color, #d32f2f)';
                statusEl.textContent = 'This plugin\'s repo is private. Set a GitHub Plugins Token above to check for updates.';
                break;
              case 'no-update-source':
                statusEl.style.color = 'var(--text-secondary, #888)';
                statusEl.textContent = 'No update source configured for this plugin.';
                break;
              case 'no-releases':
                statusEl.style.color = 'var(--text-secondary, #888)';
                statusEl.textContent = 'No published releases found yet.';
                break;
              case 'no-matching-asset':
                statusEl.style.color = 'var(--danger-color, #d32f2f)';
                statusEl.textContent = result.error || 'Release found but no matching asset.';
                break;
              default:
                statusEl.style.color = 'var(--danger-color, #d32f2f)';
                statusEl.textContent = result.error || 'Update check failed.';
            }
          } catch (error: any) {
            button.disabled = false;
            button.textContent = 'Check for Updates';
            if (statusEl) {
              statusEl.style.display = 'block';
              statusEl.style.color = 'var(--danger-color, #d32f2f)';
              statusEl.textContent = `Update check failed: ${error.message}`;
            }
          }
        });
      });

      // Add event listeners for "Open Folder" buttons
      container.querySelectorAll('.plugin-open-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const pluginId = (e.target as HTMLElement).getAttribute('data-plugin-id');
          if (!pluginId) return;

          try {
            await (window as any).electronAPI.plugins.openFolder(pluginId);
          } catch (error: any) {
            alert(`Could not open folder: ${error.message}`);
          }
        });
      });

      // Add event listeners for uninstall buttons
      container.querySelectorAll('.plugin-uninstall-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const pluginId = (e.target as HTMLElement).getAttribute('data-plugin-id');
          if (!pluginId) return;

          if (!confirm(`Are you sure you want to uninstall "${pluginId}"? This cannot be undone.`)) {
            return;
          }

          const button = e.target as HTMLButtonElement;
          const card = button.closest('.plugin-manage-card');

          button.disabled = true;
          button.textContent = 'Uninstalling...';

          try {
            await (window as any).electronAPI.plugins.uninstall(pluginId);
            card?.remove();

            // Refresh if no plugins left
            const remaining = container.querySelectorAll('.plugin-manage-card');
            if (remaining.length === 0) {
              container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary, #888);">
                  <p>No plugins installed</p>
                  <p style="font-size: 14px;">Use "Import Plugin" to install plugins</p>
                </div>
              `;
            }
          } catch (error: any) {
            alert(`Uninstall failed: ${error.message}`);
            button.disabled = false;
            button.textContent = 'Uninstall';
          }
        });
      });
    } catch (error: any) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--danger-color, #d32f2f);">
          <p>Failed to load plugins</p>
          <p style="font-size: 14px;">${this.escapeHtml(error.message)}</p>
        </div>
      `;
    }
  }

  /**
   * Install a checked GitHub-release update for a plugin (bead mea-6tt).
   * Called from the "Install Update" button injected by the "Check for
   * Updates" handler above.
   */
  private async installGithubUpdate(pluginId: string, statusEl: HTMLElement, installBtn: HTMLButtonElement): Promise<void> {
    installBtn.disabled = true;
    installBtn.textContent = 'Installing…';

    try {
      const result = await (window as any).electronAPI.plugins.installGithubUpdate(pluginId);

      if (result.success) {
        statusEl.style.color = 'var(--success-color, #4caf50)';
        statusEl.textContent = result.restarting
          ? `Updated to v${result.version}. Restarting…`
          : `Updated to v${result.version}. Restart FictionLab whenever you're ready to load it.`;
        return;
      }

      statusEl.style.color = 'var(--danger-color, #d32f2f)';
      if (result.status === 'dependency-blocked') {
        statusEl.textContent = `Update blocked: ${(result.blockers || []).join(' ')}`;
      } else if (result.status === 'refused') {
        statusEl.textContent = result.message || 'Update refused.';
      } else {
        statusEl.textContent = result.error || 'Update failed.';
      }
      installBtn.disabled = false;
      installBtn.textContent = 'Install Update';
    } catch (error: any) {
      statusEl.style.color = 'var(--danger-color, #d32f2f)';
      statusEl.textContent = `Update failed: ${error.message}`;
      installBtn.disabled = false;
      installBtn.textContent = 'Install Update';
    }
  }

  /**
   * Wire up the masked GitHub Plugins Token display + set/change control
   * (bead mea-6tt). The full token is only ever sent from this input,
   * directly to `plugins.setGithubToken` -- it is never fetched back for
   * display; the status line only shows `configured` + last 4 characters.
   */
  private async setupGithubTokenSection(dialog: HTMLElement): Promise<void> {
    const statusEl = dialog.querySelector('#github-token-status') as HTMLElement;
    const editBtn = dialog.querySelector('#github-token-edit-btn') as HTMLButtonElement;
    const editRow = dialog.querySelector('#github-token-edit-row') as HTMLElement;
    const input = dialog.querySelector('#github-token-input') as HTMLInputElement;
    const saveBtn = dialog.querySelector('#github-token-save-btn') as HTMLButtonElement;
    if (!statusEl || !editBtn || !editRow || !input || !saveBtn) return;

    const refreshStatus = async () => {
      try {
        const status = await (window as any).electronAPI.plugins.getGithubTokenStatus();
        statusEl.textContent = status.configured
          ? `Configured (••••${status.last4})`
          : 'Not configured — private-repo plugin updates unavailable.';
      } catch (error: any) {
        statusEl.textContent = `Could not read token status: ${error.message}`;
      }
    };

    editBtn.addEventListener('click', () => {
      editRow.style.display = editRow.style.display === 'none' ? 'flex' : 'none';
      if (editRow.style.display === 'flex') input.focus();
    });

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      try {
        const result = await (window as any).electronAPI.plugins.setGithubToken(input.value);
        if (result.success) {
          input.value = '';
          editRow.style.display = 'none';
          await refreshStatus();
          if ((window as any).showNotification) {
            (window as any).showNotification('GitHub Plugins Token saved', 'success');
          }
        } else if ((window as any).showNotification) {
          (window as any).showNotification(`Failed to save token: ${result.error}`, 'error');
        }
      } catch (error: any) {
        if ((window as any).showNotification) {
          (window as any).showNotification(`Failed to save token: ${error.message}`, 'error');
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });

    await refreshStatus();
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
