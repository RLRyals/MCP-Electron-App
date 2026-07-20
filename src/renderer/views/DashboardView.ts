/**
 * DashboardView
 * Thin View-interface wrapper that mounts the Dashboard cockpit
 * (DashboardViewReact.tsx's DashboardApp) into the ViewRouter's
 * `dashboard` route -- the same host-bundled React view idiom
 * WorkflowsViewReact.tsx uses (a ReactDOM root created in mount(),
 * unmounted in unmount()).
 *
 * This file stays a plain .ts (not .tsx) file, so React.createElement is
 * used instead of JSX syntax for the one render call.
 *
 * Replaces the old DashboardTab innerHTML stack (issue #214): DashboardTab
 * and dashboard-handlers.ts's 5s status-polling / DOM-coupled action
 * handlers are gone -- DashboardApp owns its own polling/subscriptions, and
 * SystemStrip.tsx re-implements Start/Stop/Restart System directly against
 * the same mcpSystem IPC dashboard-handlers.ts used to call.
 *
 * The top bar's "Export Report" action was removed (mea-ctr): exporting a
 * diagnostic report is a rare action, not a primary-toolbar one. It remains
 * reachable from the Diagnostics menu ("Export Diagnostic Report") and the
 * Settings > Logs page, both of which already called the same
 * `logger.exportDiagnosticReport` IPC handler this view used to call too.
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { DashboardApp } from './DashboardViewReact.js';

export class DashboardView implements View {
  private container: HTMLElement | null = null;
  private root: ReactDOM.Root | null = null;

  async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.root = ReactDOM.createRoot(container);
    this.root.render(React.createElement(DashboardApp));
    console.log('[DashboardView] Mounted');
  }

  async unmount(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.container = null;
    console.log('[DashboardView] Unmounted');
  }

  handleAction(actionId: string): void {
    console.log('[DashboardView] Action:', actionId);

    switch (actionId) {
      case 'refresh':
        // DashboardApp's panels + SystemStrip all subscribe to this event
        // for an immediate manual refetch (see their 'dashboard-refresh'
        // listeners), same as the top-bar action always did.
        window.dispatchEvent(new CustomEvent('dashboard-refresh'));
        break;
      default:
        console.warn('[DashboardView] Unknown action:', actionId);
    }
  }

  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Dashboard',
      actions: [
        { id: 'refresh', label: 'Refresh', icon: '🔄' },
      ],
      global: {
        projectSelector: true,
        environmentIndicator: true,
      },
    };
  }
}
