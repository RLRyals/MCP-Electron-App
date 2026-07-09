/**
 * SetupView
 * Wrapper for existing SetupTab component
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { initializeSetupTab } from '../components/SetupTab.js';
import { loadEnvConfig, setupEnvConfigListeners } from '../env-config-handlers.js';
import { loadClientOptions, setupClientSelectionListeners, setupClaudeDesktopListeners } from '../client-selection-handlers.js';

export class SetupView implements View {
  private container: HTMLElement | null = null;

  /**
   * Mount the setup view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Render the full setup HTML content
    container.innerHTML = this.renderSetupHTML();

    // Initialize the existing setup functionality
    try {
      await initializeSetupTab();
      console.log('[SetupView] Setup tab initialized');

      // Load app info (version, platform, etc.) now that the elements exist
      await this.loadAppInfo();

      // Re-setup event listeners for forms that were just rendered
      setupEnvConfigListeners();
      loadEnvConfig();

      setupClientSelectionListeners();
      loadClientOptions();

      setupClaudeDesktopListeners();

      console.log('[SetupView] Form event listeners attached');
    } catch (error) {
      console.error('[SetupView] Failed to initialize setup:', error);
      container.innerHTML = `
        <div class="error-message">
          <h2>Failed to load Setup</h2>
          <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  /**
   * Render the setup tab HTML
   */
  private renderSetupHTML(): string {
    return `
      <div class="tab-panel-content">
        ${this.renderWelcomeCard()}
        ${this.renderUpdateTools()}
        ${this.renderPrerequisites()}
        ${this.renderClientSelection()}
        ${this.renderClaudeDesktopConfig()}
        ${this.renderEnvConfig()}
      </div>
    `;
  }

  private renderWelcomeCard(): string {
    return `
      <div class="welcome-card">
        <h2>Welcome!</h2>
        <p>
          Your AI-powered writing workspace with advanced context management. FictionLab simplifies setup and management of your writing tools.
        </p>

        <div class="info-grid">
          <div class="info-item">
            <strong>Version</strong>
            <span id="app-version">Loading...</span>
          </div>
          <div class="info-item">
            <strong>Platform</strong>
            <span id="platform">Loading...</span>
          </div>
          <div class="info-item">
            <strong>Architecture</strong>
            <span id="architecture">Loading...</span>
          </div>
          <div class="info-item">
            <strong>Node Version</strong>
            <span id="node-version">Loading...</span>
          </div>
        </div>

        <button class="test-button" id="test-ipc">Test IPC Communication</button>
        <div class="test-result" id="test-result">
          IPC communication successful!
        </div>
      </div>
    `;
  }

  private renderUpdateTools(): string {
    return `
      <div class="env-config-card">
        <h2>Update Tools</h2>
        <p style="margin-bottom: 20px; opacity: 0.9;">
          Keep your FictionLab installation up to date with the latest features and improvements.
        </p>

        <div class="form-grid">
          <div class="form-group">
            <label>
              MCP-Writing-Servers
              <span class="tooltip" title="Update the MCP Writing Servers repository via git pull">ⓘ</span>
            </label>
            <div id="mcp-servers-current-version" style="margin-bottom: 8px; font-size: 0.9rem; opacity: 0.9;">Current Version: Loading...</div>
            <button type="button" class="test-button" id="update-mcp-servers" title="Pull latest changes from MCP-Writing-Servers repository">Update MCP-Writing-Servers</button>
            <div id="mcp-update-status" style="margin-top: 8px; font-size: 0.9rem; display: none;"></div>
          </div>

          <div class="form-group">
            <label>
              FictionLab
              <span class="tooltip" title="Check for FictionLab application updates">ⓘ</span>
            </label>
            <div id="fictionlab-current-version" style="margin-bottom: 8px; font-size: 0.9rem; opacity: 0.9;">Current Version: Loading...</div>
            <button type="button" class="test-button" id="check-fictionlab-updates" title="Check for FictionLab application updates">Check for Updates</button>
            <div id="fictionlab-update-status" style="margin-top: 8px; font-size: 0.9rem; display: none;"></div>
          </div>
        </div>
      </div>
    `;
  }

  private renderPrerequisites(): string {
    return `
      <div class="prerequisites-card">
        <h2>Prerequisites Check</h2>
        <p style="margin-bottom: 20px; opacity: 0.9;">
          Checking system prerequisites...
        </p>

        <div class="prereq-grid">
          <div class="prereq-item">
            <h3>
              <span class="status-icon loading" id="docker-status-icon"></span>
              Docker
            </h3>
            <div class="prereq-detail" id="docker-detail">Checking...</div>
            <div class="prereq-error" id="docker-error" style="display: none;"></div>
          </div>

          <div class="prereq-item">
            <h3>
              <span class="status-icon loading" id="git-status-icon"></span>
              Git
            </h3>
            <div class="prereq-detail" id="git-detail">Checking...</div>
            <div class="prereq-error" id="git-error" style="display: none;"></div>
          </div>

          <div class="prereq-item" id="wsl-item" style="display: none;">
            <h3>
              <span class="status-icon loading" id="wsl-status-icon"></span>
              WSL
            </h3>
            <div class="prereq-detail" id="wsl-detail">Checking...</div>
            <div class="prereq-error" id="wsl-error" style="display: none;"></div>
          </div>

          <div class="prereq-item" id="disk-space-item">
            <h3>
              <span class="status-icon loading" id="disk-space-status-icon"></span>
              Disk Space
            </h3>
            <div class="prereq-detail" id="disk-space-detail">Checking...</div>
            <div class="prereq-error" id="disk-space-error" style="display: none;"></div>
          </div>
        </div>

        <button class="test-button" id="check-prerequisites" title="Verify that Docker Desktop and Git are properly installed and running on your system">Check Prerequisites</button>
      </div>
    `;
  }

  private renderClientSelection(): string {
    return `
      <div class="client-selection-card" id="client-selection-card">
        <h2>Client Selection</h2>
        <p>
          Choose which AI clients you'd like to install and configure. You can select one or both clients based on your needs.
        </p>

        <div class="client-selection-loading" id="client-selection-loading">
          Loading available clients...
        </div>

        <div class="client-cards-container" id="client-cards-container">
          <!-- Client cards will be dynamically inserted here -->
        </div>

        <div class="selection-summary" id="selection-summary">
          0 clients selected
        </div>

        <div class="client-selection-actions">
          <button id="skip-client-selection" title="Skip client selection and configure AI clients later">Configure Later</button>
          <button id="clear-client-selection" disabled title="Clear all selected clients and start over">Clear Selection</button>
          <button id="save-client-selection" class="primary" disabled title="Save your client selection and proceed with installation">Save Selection</button>
        </div>

        <div class="client-selection-status" id="client-selection-status"></div>
      </div>
    `;
  }

  private renderClaudeDesktopConfig(): string {
    return `
      <div class="env-config-card" id="claude-desktop-card">
        <h2>Claude Desktop</h2>
        <p style="margin-bottom: 20px; opacity: 0.9;">
          Automatically configure Claude Desktop with your MCP server settings, or manage the configuration manually.
        </p>

        <div class="form-group">
          <label>
            Status
            <span class="tooltip" title="Whether Claude Desktop's MCP configuration file has been set up">ⓘ</span>
          </label>
          <div id="claude-desktop-status-text" style="font-size: 0.95rem; font-weight: 500;">Checking...</div>
        </div>

        <div class="client-selection-actions" style="justify-content: flex-start; margin-top: 15px;">
          <button type="button" class="test-button" id="claude-desktop-auto-config-btn" title="Automatically write MCP server settings into Claude Desktop's config file">Auto-Configure Claude Desktop</button>
          <button type="button" class="test-button" id="claude-desktop-open-folder-btn" title="Open the folder containing Claude Desktop's config file">Open Config Folder</button>
          <button type="button" class="test-button" id="claude-desktop-reset-btn" style="display: none;" title="Remove all MCP server settings from Claude Desktop's config">Reset Configuration</button>
        </div>

        <div id="claude-desktop-config-preview" style="display: none; margin-top: 15px;">
          <label>Current Configuration</label>
          <pre id="claude-desktop-config-content" class="error-stack"></pre>
        </div>

        <p style="margin-top: 15px; font-size: 0.85rem; opacity: 0.85;">
          Don't have Claude Desktop yet? <a href="#" id="claude-desktop-download-link">Download it here</a>.
        </p>
      </div>
    `;
  }

  private renderEnvConfig(): string {
    return `
      <div class="env-config-card">
        <h2>Environment Configuration</h2>
        <p style="margin-bottom: 20px; opacity: 0.9;">
          Configure environment variables for FictionLab. Settings will be saved to <code id="env-file-path">Loading...</code>
        </p>

        <form id="env-config-form">
          <div class="form-grid">
            <div class="form-group">
              <label for="postgres-db">
                Database Name
                <span class="tooltip" title="Name of the PostgreSQL database">ⓘ</span>
              </label>
              <input type="text" id="postgres-db" name="POSTGRES_DB" required>
              <span class="validation-error" id="postgres-db-error"></span>
            </div>

            <div class="form-group">
              <label for="postgres-user">
                Database User
                <span class="tooltip" title="PostgreSQL username">ⓘ</span>
              </label>
              <input type="text" id="postgres-user" name="POSTGRES_USER" required>
              <span class="validation-error" id="postgres-user-error"></span>
            </div>

            <div class="form-group">
              <label for="postgres-password">
                Database Password
                <span class="tooltip" title="PostgreSQL password (auto-generated for security)">ⓘ</span>
              </label>
              <div class="input-with-buttons">
                <input type="password" id="postgres-password" name="POSTGRES_PASSWORD" required>
                <button type="button" class="icon-button" id="toggle-password" title="Show/Hide Password">
                  <span class="eye-icon">👁️</span>
                </button>
                <button type="button" class="icon-button" id="regenerate-password" title="Regenerate Password">
                  <span class="regenerate-icon">🔄</span>
                </button>
              </div>
              <div class="password-strength" id="password-strength">
                <div class="strength-bar">
                  <div class="strength-fill" id="strength-fill"></div>
                </div>
                <span class="strength-text" id="strength-text">Weak</span>
              </div>
              <span class="validation-error" id="postgres-password-error"></span>
            </div>

            <div class="form-group">
              <label for="postgres-port">
                PostgreSQL Port
                <span class="tooltip" title="Port for PostgreSQL database (default: 5432)">ⓘ</span>
              </label>
              <div class="input-with-indicator">
                <input type="number" id="postgres-port" name="POSTGRES_PORT" min="1024" max="65535" required>
                <span class="port-indicator" id="postgres-port-indicator">
                  <span class="loading">⏳</span>
                </span>
              </div>
              <span class="validation-error" id="postgres-port-error"></span>
            </div>

            <div class="form-group">
              <label for="mcp-connector-port">
                MCP Connector Port
                <span class="tooltip" title="Port for MCP Connector service (HTTP/SSE)">ⓘ</span>
              </label>
              <div class="input-with-indicator">
                <input type="number" id="mcp-connector-port" name="MCP_CONNECTOR_PORT" min="1024" max="65535" required>
                <span class="port-indicator" id="mcp-connector-port-indicator">
                  <span class="loading">⏳</span>
                </span>
              </div>
              <span class="validation-error" id="mcp-connector-port-error"></span>
            </div>

            <div class="form-group">
              <label for="http-sse-port">
                HTTP/SSE Port
                <span class="tooltip" title="Port for HTTP/SSE MCP server endpoints">ⓘ</span>
              </label>
              <div class="input-with-indicator">
                <input type="number" id="http-sse-port" name="HTTP_SSE_PORT" min="1024" max="65535" required>
                <span class="port-indicator" id="http-sse-port-indicator">
                  <span class="loading">⏳</span>
                </span>
              </div>
              <span class="validation-error" id="http-sse-port-error"></span>
            </div>

            <div class="form-group">
              <label for="db-admin-port">
                DB Admin Port
                <span class="tooltip" title="Port for database administration interface">ⓘ</span>
              </label>
              <div class="input-with-indicator">
                <input type="number" id="db-admin-port" name="DB_ADMIN_PORT" min="1024" max="65535" required>
                <span class="port-indicator" id="db-admin-port-indicator">
                  <span class="loading">⏳</span>
                </span>
              </div>
              <span class="validation-error" id="db-admin-port-error"></span>
            </div>

            <div class="form-group">
              <label for="mcp-auth-token">
                MCP Auth Token
                <span class="tooltip" title="Authentication token for MCP services (required for TypingMind connection)">ⓘ</span>
              </label>
              <div class="input-with-buttons">
                <input type="password" id="mcp-auth-token" name="MCP_AUTH_TOKEN" required>
                <button type="button" class="icon-button" id="toggle-token" title="Show/Hide Token">
                  <span class="eye-icon">👁️</span>
                </button>
                <button type="button" class="icon-button" id="regenerate-token" title="Regenerate Token">
                  <span class="regenerate-icon">🔄</span>
                </button>
              </div>
              <span class="validation-error" id="mcp-auth-token-error"></span>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="secondary-button" id="reset-env-config">Reset to Defaults</button>
            <button type="submit" class="primary-button">Save Configuration</button>
          </div>

          <div class="config-status" id="config-status"></div>
        </form>
      </div>
    `;
  }

  /**
   * Unmount the setup view
   */
  async unmount(): Promise<void> {
    this.container = null;
  }

  /**
   * Load app info (version, platform, architecture, node version)
   */
  private async loadAppInfo(): Promise<void> {
    try {
      // Get app version
      const version = await (window as any).electronAPI.getAppVersion();
      const versionElement = document.getElementById('app-version');
      if (versionElement) {
        versionElement.textContent = version;
      }

      // Get platform info
      const platformInfo = await (window as any).electronAPI.getPlatformInfo();

      const platformElement = document.getElementById('platform');
      if (platformElement) {
        platformElement.textContent = platformInfo.platform;
      }

      const archElement = document.getElementById('architecture');
      if (archElement) {
        archElement.textContent = platformInfo.arch;
      }

      const nodeVersionElement = document.getElementById('node-version');
      if (nodeVersionElement) {
        nodeVersionElement.textContent = platformInfo.version;
      }

      console.log('[SetupView] App info loaded successfully');
    } catch (error) {
      console.error('[SetupView] Error loading app info:', error);
    }
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Setup',
      breadcrumb: ['Settings', 'Setup'],
      actions: [],
      global: {
        projectSelector: false,
        environmentIndicator: true,
      },
    };
  }
}
