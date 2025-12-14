/**
 * ServicesView
 * Wrapper for existing ServicesTab component
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { initializeServicesTab } from '../components/ServicesTab.js';

export class ServicesView implements View {
  private container: HTMLElement | null = null;

  /**
   * Mount the services view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Render the full services HTML content
    container.innerHTML = this.renderServicesHTML();

    // Initialize the existing services functionality
    try {
      await initializeServicesTab();
      console.log('[ServicesView] Services tab initialized');
    } catch (error) {
      console.error('[ServicesView] Failed to initialize services:', error);
      container.innerHTML = `
        <div class="error-message">
          <h2>Failed to load Services</h2>
          <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  /**
   * Render the services tab HTML
   */
  private renderServicesHTML(): string {
    return `
      <div class="tab-panel-content">
        <div class="dashboard-card">
          <div class="dashboard-header">
            <h2>Service Management</h2>
            <div class="dashboard-actions" style="gap: 10px;">
              <button id="services-refresh-all" class="action-button icon-only" title="Refresh all service statuses">🔄</button>
            </div>
          </div>

          <div class="service-cards" style="grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px;">
            ${this.renderPostgreSQLCard()}
            ${this.renderMCPServersCard()}
            ${this.renderTypingMindCard()}
            ${this.renderDockerCard()}
          </div>

          <div class="dashboard-footer" style="margin-top: 30px;">
            <span id="services-last-updated" class="last-updated">Last updated: --:--:--</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderPostgreSQLCard(): string {
    return `
      <div class="service-card" style="border: 2px solid rgba(255, 255, 255, 0.2);">
        <div class="service-card-header">
          <div class="service-name">
            <h4>PostgreSQL Database</h4>
          </div>
          <span id="postgres-status-badge" class="service-status-badge status-offline">Offline</span>
        </div>
        <div class="service-card-body">
          <div class="service-info" style="margin-bottom: 15px;">
            <div class="service-detail" id="postgres-port-info">Port: 5432</div>
            <div class="service-detail" id="postgres-version-info">Version: PostgreSQL 17</div>
          </div>
          <div class="service-info" style="margin-bottom: 15px;">
            <h5 style="margin-bottom: 5px; font-size: 0.9rem; opacity: 0.9;">Resource Usage</h5>
            <div id="postgres-resource-usage" style="font-size: 0.85rem; opacity: 0.9;">
              <div class="resource-item">Not running</div>
            </div>
          </div>
          <div class="service-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button id="postgres-start" class="service-action-btn" title="Start PostgreSQL service">Start</button>
            <button id="postgres-stop" class="service-action-btn" title="Stop PostgreSQL service">Stop</button>
            <button id="postgres-restart" class="service-action-btn" title="Restart PostgreSQL service">Restart</button>
            <button id="postgres-view-logs" class="service-action-btn" title="View PostgreSQL logs">View Logs</button>
            <button id="postgres-view-connection" class="service-action-btn" title="View connection details">Connection Info</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderMCPServersCard(): string {
    return `
      <div class="service-card" style="border: 2px solid rgba(255, 255, 255, 0.2);">
        <div class="service-card-header">
          <div class="service-name">
            <h4>MCP Servers</h4>
          </div>
          <span id="mcp-servers-status-badge" class="service-status-badge status-offline">Offline</span>
        </div>
        <div class="service-card-body">
          <div class="service-info" style="margin-bottom: 15px;">
            <div class="service-detail" id="mcp-servers-port-info">Connector Port: 50880</div>
            <div class="service-detail" id="mcp-servers-version-info">Version: Latest</div>
          </div>
          <div class="service-info" style="margin-bottom: 15px;">
            <h5 style="margin-bottom: 5px; font-size: 0.9rem; opacity: 0.9;">Resource Usage</h5>
            <div id="mcp-servers-resource-usage" style="font-size: 0.85rem; opacity: 0.9;">
              <div class="resource-item">Not running</div>
            </div>
          </div>
          <div class="service-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button id="mcp-servers-start" class="service-action-btn" title="Start MCP Servers">Start</button>
            <button id="mcp-servers-stop" class="service-action-btn" title="Stop MCP Servers">Stop</button>
            <button id="mcp-servers-restart" class="service-action-btn" title="Restart MCP Servers">Restart</button>
            <button id="mcp-servers-view-logs" class="service-action-btn" title="View MCP Servers logs">View Logs</button>
            <button id="mcp-servers-health-check" class="service-action-btn" title="Check health status">Health Check</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderTypingMindCard(): string {
    return `
      <div class="service-card" style="border: 2px solid rgba(255, 255, 255, 0.2);">
        <div class="service-card-header">
          <div class="service-name">
            <h4>Typing Mind</h4>
          </div>
          <span id="typing-mind-status-badge" class="service-status-badge status-offline">Offline</span>
        </div>
        <div class="service-card-body">
          <div class="service-info" style="margin-bottom: 15px;">
            <div class="service-detail" id="typing-mind-url-info">Port: 8080</div>
            <div class="service-detail" id="typing-mind-version-info">Version: Latest</div>
          </div>
          <div class="service-info" style="margin-bottom: 15px;">
            <h5 style="margin-bottom: 5px; font-size: 0.9rem; opacity: 0.9;">Resource Usage</h5>
            <div id="typing-mind-resource-usage" style="font-size: 0.85rem; opacity: 0.9;">
              <div class="resource-item">Not running</div>
            </div>
          </div>
          <div class="service-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button id="typing-mind-start" class="service-action-btn" title="Start Typing Mind">Start</button>
            <button id="typing-mind-stop" class="service-action-btn" title="Stop Typing Mind">Stop</button>
            <button id="typing-mind-restart" class="service-action-btn" title="Restart Typing Mind">Restart</button>
            <button id="typing-mind-view-logs" class="service-action-btn" title="View Typing Mind logs">View Logs</button>
            <button id="typing-mind-open-browser" class="service-action-btn" title="Open in browser">Open Browser</button>
            <button id="typing-mind-configure" class="service-action-btn" title="Configure Typing Mind">Configure</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderDockerCard(): string {
    return `
      <div class="service-card" style="border: 2px solid rgba(255, 255, 255, 0.2);">
        <div class="service-card-header">
          <div class="service-name">
            <h4>Docker Desktop</h4>
          </div>
          <span id="docker-status-badge" class="service-status-badge status-offline">Offline</span>
        </div>
        <div class="service-card-body">
          <div class="service-info" style="margin-bottom: 15px;">
            <div class="service-detail" id="docker-version-info">Docker Desktop</div>
            <div class="service-detail" id="docker-health-info">Status: Checking...</div>
          </div>
          <div class="service-info" style="margin-bottom: 15px;">
            <p style="font-size: 0.85rem; opacity: 0.9;">
              Container runtime for all FictionLab services
            </p>
          </div>
          <div class="service-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button id="docker-service-start" class="service-action-btn" title="Start Docker Desktop">Start</button>
            <button id="docker-service-stop" class="service-action-btn" title="Stop Docker Desktop">Stop</button>
            <button id="docker-service-restart" class="service-action-btn" title="Restart Docker Desktop">Restart</button>
            <button id="docker-service-health-check" class="service-action-btn" title="Check Docker health">Health Check</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Unmount the services view
   */
  async unmount(): Promise<void> {
    this.container = null;
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Services',
      breadcrumb: ['Settings', 'Services'],
      actions: [
        { id: 'start-all', label: 'Start All', icon: '▶️', variant: 'primary' },
        { id: 'stop-all', label: 'Stop All', icon: '⏹️', variant: 'danger' },
        { id: 'restart-all', label: 'Restart All', icon: '🔄' },
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
    console.log('[ServicesView] Action:', actionId);

    switch (actionId) {
      case 'start-all':
        window.dispatchEvent(new CustomEvent('services-start-all'));
        break;
      case 'stop-all':
        window.dispatchEvent(new CustomEvent('services-stop-all'));
        break;
      case 'restart-all':
        window.dispatchEvent(new CustomEvent('services-restart-all'));
        break;
      default:
        console.warn('[ServicesView] Unknown action:', actionId);
    }
  }
}
