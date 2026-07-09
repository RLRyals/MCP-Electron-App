/**
 * ServicesView
 * Wrapper for the ServicesTab component
 * Implements View interface for ViewRouter compatibility
 *
 * Content rewrite for issue #124 -- detailed per-service controls for
 * PostgreSQL, the two MCP servers (Connector + Writing Servers), Typing
 * Mind, and Docker Desktop, plus the pre-existing Ports settings section.
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { ServicesTab, initializeServicesTab } from '../components/ServicesTab.js';

export class ServicesView implements View {
  private container: HTMLElement | null = null;
  private servicesTab: ServicesTab | null = null;

  /**
   * Mount the services view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Render the full services HTML content
    container.innerHTML = this.renderServicesHTML();

    // Initialize the services functionality
    try {
      this.servicesTab = await initializeServicesTab();
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

        ${this.renderPortsSection()}
      </div>
    `;
  }

  /**
   * Render the Ports settings section: lists every configurable service port
   * with a live in-use indicator, an editable field, and controls to check for
   * conflicts, apply suggested alternatives, and save + restart.
   */
  private renderPortsSection(): string {
    return `
      <div class="dashboard-card" style="margin-top: 20px;">
        <div class="dashboard-header">
          <h2>Ports</h2>
          <div class="dashboard-actions" style="gap: 10px;">
            <button id="ports-check-all" class="action-button" title="Check all ports for conflicts">Check All</button>
            <button id="ports-use-suggested" class="action-button" title="Apply suggested available ports" style="display: none;">Use Suggested</button>
            <button id="ports-save" class="action-button primary" title="Save port configuration">Save</button>
          </div>
        </div>

        <div id="ports-status-message" style="margin-bottom: 10px;"></div>

        <div style="overflow-x: auto;">
          <table class="ports-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="text-align: left; border-bottom: 1px solid rgba(255,255,255,0.2);">
                <th style="padding: 8px;">Service</th>
                <th style="padding: 8px;">Port</th>
                <th style="padding: 8px;">Status</th>
              </tr>
            </thead>
            <tbody id="ports-table-body">
              <!-- Rows are injected by ServicesTab.ts -->
            </tbody>
          </table>
        </div>

        <div class="dashboard-footer" style="margin-top: 15px;">
          <span id="ports-last-checked" class="last-updated">Not checked yet</span>
        </div>
      </div>
    `;
  }

  /**
   * PostgreSQL Card: status, connection info (host/port/database), lifecycle
   * controls, logs, connection details, and live resource usage.
   */
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
            <div class="service-detail" id="postgres-host-info">Host: localhost</div>
            <div class="service-detail" id="postgres-port-info">Port: 5432</div>
            <div class="service-detail" id="postgres-database-info">Database: --</div>
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

  /**
   * MCP Servers Card: aggregate status plus individual rows for the MCP
   * Connector and MCP Writing Servers -- each with its own status, port,
   * start/stop/restart controls, view-logs button, and resource usage.
   */
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
            <h5 style="margin-bottom: 8px; font-size: 0.9rem; opacity: 0.9;">Individual Servers</h5>

            <div id="mcp-connector-row" style="border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 10px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <strong style="font-size: 0.9rem;">MCP Connector</strong>
                <span id="mcp-connector-status-badge" class="service-status-badge status-offline">Offline</span>
              </div>
              <div class="service-detail" id="mcp-connector-port-info">Port: --</div>
              <div id="mcp-connector-resource-usage" style="font-size: 0.8rem; opacity: 0.9; margin-top: 4px;">
                <div class="resource-item">Not running</div>
              </div>
              <div class="service-actions" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                <button id="mcp-connector-start" class="service-action-btn" title="Start MCP Connector">Start</button>
                <button id="mcp-connector-stop" class="service-action-btn" title="Stop MCP Connector">Stop</button>
                <button id="mcp-connector-restart" class="service-action-btn" title="Restart MCP Connector">Restart</button>
                <button id="mcp-connector-view-logs" class="service-action-btn" title="View MCP Connector logs">View Logs</button>
              </div>
            </div>

            <div id="mcp-writing-servers-row" style="border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <strong style="font-size: 0.9rem;">MCP Writing Servers</strong>
                <span id="mcp-writing-servers-status-badge" class="service-status-badge status-offline">Offline</span>
              </div>
              <div class="service-detail" id="mcp-writing-servers-port-info">Port: --</div>
              <div id="mcp-writing-servers-resource-usage" style="font-size: 0.8rem; opacity: 0.9; margin-top: 4px;">
                <div class="resource-item">Not running</div>
              </div>
              <div class="service-actions" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                <button id="mcp-writing-servers-start" class="service-action-btn" title="Start MCP Writing Servers">Start</button>
                <button id="mcp-writing-servers-stop" class="service-action-btn" title="Stop MCP Writing Servers">Stop</button>
                <button id="mcp-writing-servers-restart" class="service-action-btn" title="Restart MCP Writing Servers">Restart</button>
                <button id="mcp-writing-servers-view-logs" class="service-action-btn" title="View MCP Writing Servers logs">View Logs</button>
              </div>
            </div>
          </div>

          <div class="service-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button id="mcp-servers-health-check" class="service-action-btn" title="Check health status of all MCP servers">Health Check</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Typing Mind Card: Typing Mind itself is a cloud web app with nothing
   * local to run, so its status/start/stop/restart/logs reflect the local
   * MCP Connector it depends on to reach FictionLab's MCP servers.
   */
  private renderTypingMindCard(): string {
    return `
      <div class="service-card" style="border: 2px solid rgba(255, 255, 255, 0.2);">
        <div class="service-card-header">
          <div class="service-name">
            <h4>Typing Mind</h4>
          </div>
          <span id="typing-mind-status-badge" class="service-status-badge status-offline">Not Configured</span>
        </div>
        <div class="service-card-body">
          <div class="service-info" style="margin-bottom: 15px;">
            <div class="service-detail" id="typing-mind-url-info">https://www.typingmind.com</div>
            <div class="service-detail" id="typing-mind-port-info">Connector Port: --</div>
          </div>
          <p style="font-size: 0.8rem; opacity: 0.8; margin-bottom: 10px;">
            Typing Mind runs in the cloud. Start/Stop/Restart and Logs below control the local
            MCP Connector that Typing Mind talks to.
          </p>
          <div class="service-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button id="typing-mind-start" class="service-action-btn" title="Start the MCP Connector">Start</button>
            <button id="typing-mind-stop" class="service-action-btn" title="Stop the MCP Connector">Stop</button>
            <button id="typing-mind-restart" class="service-action-btn" title="Restart the MCP Connector">Restart</button>
            <button id="typing-mind-view-logs" class="service-action-btn" title="View MCP Connector logs">View Logs</button>
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
            <div class="service-detail" id="docker-version-info">Version: Checking...</div>
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
    if (this.servicesTab) {
      this.servicesTab.cleanup();
    }
    this.servicesTab = null;
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
