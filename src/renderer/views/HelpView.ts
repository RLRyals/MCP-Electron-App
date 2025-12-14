/**
 * HelpView
 * Help and documentation view
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';

export class HelpView implements View {
  private container: HTMLElement | null = null;

  /**
   * Mount the help view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Clear any existing content
    container.innerHTML = '';

    // Create help content
    const helpContent = document.createElement('div');
    helpContent.className = 'help-view-container';
    helpContent.innerHTML = `
      <div class="help-content">
        <section class="help-section">
          <h2>Getting Started</h2>
          <p>Welcome to FictionLab! This application helps non-technical genre fiction authors easily set up and connect to DIY MCP servers.</p>
        </section>

        <section class="help-section">
          <h2>Quick Start Guide</h2>
          <ol>
            <li><strong>Setup:</strong> Configure your system prerequisites (Docker, Git, WSL if needed)</li>
            <li><strong>Services:</strong> Start and manage your MCP services</li>
            <li><strong>Database:</strong> Configure and manage your PostgreSQL database</li>
            <li><strong>Clients:</strong> Connect your preferred client (Claude Desktop, Typing Mind, etc.)</li>
          </ol>
        </section>

        <section class="help-section">
          <h2>Navigation</h2>
          <ul>
            <li><strong>Dashboard:</strong> Overview of your system status and quick actions</li>
            <li><strong>Workflows:</strong> Manage your writing workflows</li>
            <li><strong>Library:</strong> Access your content library</li>
            <li><strong>Plugins:</strong> Browse and manage installed plugins</li>
            <li><strong>Settings:</strong> Configure setup, services, database, and view logs</li>
          </ul>
        </section>

        <section class="help-section">
          <h2>Common Tasks</h2>
          <h3>Starting Services</h3>
          <p>Navigate to Settings → Services and click "Start All Services" to launch your MCP system.</p>

          <h3>Viewing Logs</h3>
          <p>Navigate to Settings → Logs to view application and service logs for troubleshooting.</p>

          <h3>Database Management</h3>
          <p>Navigate to Settings → Database to manage your PostgreSQL database, run queries, and view data.</p>
        </section>

        <section class="help-section">
          <h2>Support</h2>
          <p>For more information and support:</p>
          <ul>
            <li>GitHub Repository: <a href="https://github.com/RLRyals/MCP-Electron-App" target="_blank">MCP-Electron-App</a></li>
            <li>Report Issues: <a href="https://github.com/RLRyals/MCP-Electron-App/issues" target="_blank">GitHub Issues</a></li>
          </ul>
        </section>
      </div>
    `;

    container.appendChild(helpContent);
  }

  /**
   * Unmount the help view
   */
  async unmount(): Promise<void> {
    this.container = null;
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Help',
      breadcrumb: ['Help'],
      actions: [],
      global: {
        projectSelector: false,
        environmentIndicator: false,
      },
    };
  }
}
