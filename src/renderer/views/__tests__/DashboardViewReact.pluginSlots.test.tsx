/**
 * DashboardApp pluginless empty state + widget-slot rendering (bead
 * mea-cjl.1). Separate from DashboardViewReact.test.tsx (which locks the
 * card deep-link contract with one plugin active) because these tests vary
 * the installed-plugin COUNT itself, the new gating signal.
 */

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardApp } from '../DashboardViewReact';

jest.mock('../../services/dashboardWidgetLoader', () => ({
  loadActiveDashboardWidgets: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadActiveDashboardWidgets } = require('../../services/dashboardWidgetLoader');

class FakeWorkflowWidget {
  async mount(container: HTMLElement): Promise<void> {
    container.textContent = 'RUNNING / NEXT / BLOCKED';
  }
  async unmount(): Promise<void> {}
}

function installMocks(pluginList: any[]) {
  (window as any).electronAPI = {
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    plugins: {
      list: jest.fn().mockResolvedValue(pluginList),
      getRendererUrl: jest.fn(),
    },
    mcpSystem: {
      getDetailedStatus: jest.fn().mockResolvedValue({
        overall: { running: true, healthy: true, ready: true, message: 'ok' },
        services: [],
        timestamp: new Date(),
      }),
      start: jest.fn(),
      stop: jest.fn(),
      restart: jest.fn(),
      onProgress: jest.fn(),
      removeProgressListener: jest.fn(),
    },
    clientSelection: {
      getSelection: jest.fn().mockResolvedValue({ clients: [], selectedAt: new Date().toISOString() }),
    },
  };
  const navigateTo = jest.fn();
  (window as any).__viewRouter__ = { navigateTo };
  return { navigateTo };
}

afterEach(() => {
  delete (window as any).__viewRouter__;
  delete (window as any).electronAPI;
  jest.clearAllMocks();
});

describe('DashboardApp pluginless empty state (bead mea-cjl.1)', () => {
  it('with zero plugins installed, shows the health strip + install-plugins affordance, no cockpit columns', async () => {
    loadActiveDashboardWidgets.mockResolvedValue([]);
    const { navigateTo } = installMocks([]);

    render(<DashboardApp />);

    expect(await screen.findByText('No plugins installed')).toBeInTheDocument();
    expect(screen.queryByText(/^Running \(/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Next \(/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Blocked \(/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Install plugins' }));
    expect(navigateTo).toHaveBeenCalledWith('plugins');
  });

  it('with a plugin installed but no dashboard widget contributed, falls back to the cockpit columns', async () => {
    loadActiveDashboardWidgets.mockResolvedValue([]);
    installMocks([{ id: 'fictionlab-kanban', status: 'active' }]);

    render(<DashboardApp />);

    expect(await screen.findByText(/^Running \(/)).toBeInTheDocument();
    expect(screen.queryByText('No plugins installed')).not.toBeInTheDocument();
  });

  it('with a plugin contributing a dashboard widget, renders the widget slot instead of the cockpit columns', async () => {
    loadActiveDashboardWidgets.mockResolvedValue([
      { pluginId: 'fictionlab-workflow', pluginVersion: '1.0.0', widgetId: 'workflow-widget', WidgetClass: FakeWorkflowWidget },
    ]);
    installMocks([{ id: 'fictionlab-workflow', status: 'active' }]);

    render(<DashboardApp />);

    await waitFor(() => expect(screen.getByText('RUNNING / NEXT / BLOCKED')).toBeInTheDocument());
    expect(screen.queryByText('No plugins installed')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Running \(/)).not.toBeInTheDocument();
  });
});
