/**
 * Render tests for SystemStrip (issue #214): populated service dots, the
 * empty/loading state before the first status fetch resolves, and that the
 * Start/Stop/Restart button group calls the same mcpSystem IPC
 * dashboard-handlers.ts used to call.
 *
 * SystemStrip has no plugin dependency (it always renders, per the design
 * supplement), so there's no "plugin-missing" state to test here -- that
 * case is covered by RunningPanel/NextPanel/BlockedPanel's own tests.
 */

import * as React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SystemStrip, deriveAggregateStatus } from '../SystemStrip';

function installElectronAPI(overrides: Partial<any> = {}) {
  const api = {
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    mcpSystem: {
      getDetailedStatus: jest.fn().mockResolvedValue({
        overall: { running: true, healthy: true, ready: true, message: 'All systems operational' },
        services: [
          { serviceName: 'PostgreSQL Database', containerName: 'fictionlab-postgres', status: 'healthy', health: 'healthy', message: 'ok' },
          { serviceName: 'MCP Writing Servers', containerName: 'fictionlab-mcp-servers', status: 'healthy', health: 'healthy', message: 'ok' },
          { serviceName: 'MCP Connector', containerName: 'fictionlab-mcp-connector', status: 'healthy', health: 'healthy', message: 'ok' },
        ],
        timestamp: new Date(),
      }),
      start: jest.fn().mockResolvedValue({ success: true }),
      stop: jest.fn().mockResolvedValue({ success: true }),
      restart: jest.fn().mockResolvedValue({ success: true }),
      onProgress: jest.fn(),
      removeProgressListener: jest.fn(),
    },
    clientSelection: {
      getSelection: jest.fn().mockResolvedValue({ clients: [], selectedAt: new Date().toISOString() }),
    },
    ...overrides,
  };
  Object.defineProperty(window, 'electronAPI', { value: api, writable: true, configurable: true });
  return api;
}

describe('SystemStrip', () => {
  it('renders a health dot per service plus the derived Docker dot once status loads', async () => {
    installElectronAPI();
    render(<SystemStrip />);

    expect(await screen.findByText('Postgres')).toBeInTheDocument();
    expect(screen.getByText('Writing Srv')).toBeInTheDocument();
    expect(screen.getByText('Connector')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
  });

  it('renders just the always-present controls before the first status fetch resolves', () => {
    const api = installElectronAPI();
    api.mcpSystem.getDetailedStatus = jest.fn(() => new Promise(() => {})); // never resolves
    render(<SystemStrip />);

    // No service dots yet, but the button group and Docker dot (derived from
    // a null `detailed`) still render -- the strip never blocks on data.
    expect(screen.queryByText('Postgres')).not.toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start System' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop System' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart System' })).toBeInTheDocument();
  });

  it('calls mcpSystem.start() via the same IPC dashboard-handlers.ts used, and refetches status', async () => {
    const api = installElectronAPI();
    const user = userEvent.setup();
    render(<SystemStrip />);

    await screen.findByText('Postgres');
    api.mcpSystem.getDetailedStatus.mockClear();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Start System' }));
    });

    expect(api.mcpSystem.start).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.mcpSystem.getDetailedStatus).toHaveBeenCalled());
  });
});

describe('deriveAggregateStatus (bead mea-lj0)', () => {
  it('reports healthy when overall.healthy is true', () => {
    expect(deriveAggregateStatus({ running: true, healthy: true, ready: true, message: 'ok' })).toEqual({
      status: 'healthy',
      text: 'All Systems Operational',
    });
  });

  it('reports warning with the service message when running but not yet healthy', () => {
    expect(
      deriveAggregateStatus({ running: true, healthy: false, ready: false, message: 'Starting Postgres...' })
    ).toEqual({ status: 'warning', text: 'Starting Postgres...' });
  });

  it('falls back to a generic warning message when running-but-unhealthy has no message', () => {
    expect(deriveAggregateStatus({ running: true, healthy: false, ready: false, message: '' })).toEqual({
      status: 'warning',
      text: 'System Degraded',
    });
  });

  it('reports error when not running, using the service message', () => {
    expect(
      deriveAggregateStatus({ running: false, healthy: false, ready: false, message: 'Docker not detected' })
    ).toEqual({ status: 'error', text: 'Docker not detected' });
  });

  it('reports error with "System Offline" when not running and no message', () => {
    expect(deriveAggregateStatus({ running: false, healthy: false, ready: false, message: '' })).toEqual({
      status: 'error',
      text: 'System Offline',
    });
  });

  it('reports "Status Unknown" when overall is undefined (status not fetched yet)', () => {
    expect(deriveAggregateStatus(undefined)).toEqual({ status: 'error', text: 'Status Unknown' });
  });
});

describe('SystemStrip -> TopBar aggregate push (bead mea-lj0)', () => {
  it('pushes the derived healthy aggregate to window.topBar.updateEnvironmentStatus on fetch', async () => {
    installElectronAPI();
    const updateEnvironmentStatus = jest.fn();
    (window as any).topBar = { updateEnvironmentStatus };

    render(<SystemStrip />);

    await waitFor(() =>
      expect(updateEnvironmentStatus).toHaveBeenCalledWith('healthy', 'All Systems Operational')
    );

    delete (window as any).topBar;
  });

  it('does not throw when window.topBar is unavailable', async () => {
    installElectronAPI();
    delete (window as any).topBar;

    render(<SystemStrip />);
    await screen.findByText('Postgres');
    // No assertion beyond "didn't throw".
  });

  it('shows "Checking…" then a last-checked timestamp after a manual dashboard-refresh', async () => {
    installElectronAPI();
    render(<SystemStrip />);
    await screen.findByText('Postgres');

    act(() => {
      window.dispatchEvent(new CustomEvent('dashboard-refresh'));
    });

    // The refresh resolves near-instantly with mocked IPC, but the
    // "Checking…"/"Checked <time>" text is the visible-feedback contract
    // under test -- assert the end state landed rather than racing the
    // synchronous flip back to false.
    await waitFor(() => expect(screen.getByText(/^Checked /)).toBeInTheDocument());
  });
});
