/**
 * AboutView
 * About and version information view
 * Implements View interface for ViewRouter compatibility
 */

import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';

export class AboutView implements View {
  private container: HTMLElement | null = null;

  /**
   * Mount the about view
   */
  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Clear any existing content
    container.innerHTML = '';

    // Get app version from electronAPI if available
    let appVersion = '1.0.0';
    let electronVersion = 'Unknown';
    let chromeVersion = 'Unknown';
    let nodeVersion = 'Unknown';

    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.getAppInfo) {
        const appInfo = await electronAPI.getAppInfo();
        appVersion = appInfo.version || appVersion;
        electronVersion = appInfo.versions?.electron || electronVersion;
        chromeVersion = appInfo.versions?.chrome || chromeVersion;
        nodeVersion = appInfo.versions?.node || nodeVersion;
      }
    } catch (error) {
      console.error('[AboutView] Failed to get app info:', error);
    }

    // Create about content
    const aboutContent = document.createElement('div');
    aboutContent.className = 'about-view-container';
    aboutContent.innerHTML = `
      <div class="about-content">
        <div class="about-header">
          <img src="icon.png" alt="FictionLab" class="about-logo">
          <h1>FictionLab</h1>
          <p class="about-version">Version ${appVersion}</p>
        </div>

        <section class="about-section">
          <h2>About This Application</h2>
          <p>FictionLab is an Electron-based application designed to help non-technical genre fiction authors easily set up and connect to DIY MCP (Model Context Protocol) servers.</p>
          <p>This tool simplifies the process of configuring and managing local AI infrastructure for creative writing workflows.</p>
        </section>

        <section class="about-section">
          <h2>Purpose</h2>
          <p>Created to help non-technical genre fiction authors easily setup both Typing Mind and Claude Desktop to connect to DIY MCPs.</p>
        </section>

        <section class="about-section">
          <h2>Target Users</h2>
          <p>Non-technical genre fiction authors who need simple, accessible tools for their writing workflow.</p>
        </section>

        <section class="about-section">
          <h2>Key Features</h2>
          <ul>
            <li>Easy setup for Typing Mind client</li>
            <li>Easy setup for Claude Desktop client</li>
            <li>Connection to DIY MCP servers</li>
            <li>PostgreSQL database management</li>
            <li>Service orchestration and monitoring</li>
            <li>Plugin system for extensibility</li>
          </ul>
        </section>

        <section class="about-section">
          <h2>Technology Stack</h2>
          <ul>
            <li><strong>Electron:</strong> ${electronVersion}</li>
            <li><strong>Chrome:</strong> ${chromeVersion}</li>
            <li><strong>Node.js:</strong> ${nodeVersion}</li>
          </ul>
        </section>

        <section class="about-section">
          <h2>GitHub</h2>
          <p><a href="https://github.com/RLRyals/MCP-Electron-App" target="_blank">https://github.com/RLRyals/MCP-Electron-App</a></p>
        </section>

        <section class="about-section">
          <h2>License</h2>
          <p>This application is open source. Check the repository for license details.</p>
        </section>

        <section class="about-section about-footer">
          <p>Built with by the FictionLab community</p>
          <p>&copy; ${new Date().getFullYear()} FictionLab. All rights reserved.</p>
        </section>
      </div>
    `;

    container.appendChild(aboutContent);
  }

  /**
   * Unmount the about view
   */
  async unmount(): Promise<void> {
    this.container = null;
  }

  /**
   * Get top bar configuration
   */
  getTopBarConfig(): TopBarConfig {
    return {
      title: 'About',
      breadcrumb: ['Help', 'About'],
      actions: [],
      global: {
        projectSelector: false,
        environmentIndicator: false,
      },
    };
  }
}
