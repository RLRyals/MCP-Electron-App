/**
 * Regression tests for DashboardView's wiring to dashboard-handlers.ts
 * (issue #132: Migrate Dashboard Card to Dashboard Tab).
 *
 * DashboardView is the thin View-interface wrapper ViewRouter mounts for the
 * `dashboard` route; it delegates real content to DashboardTab, which in turn
 * defers system-status polling and button handling to dashboard-handlers.ts.
 * Two real gaps existed in that wrapper:
 *
 *  - dashboard-handlers.ts exports cleanupDashboard() specifically documented
 *    as "called when navigating away" (it stops the 5s status-polling
 *    setInterval and removes an IPC progress listener), but nothing ever
 *    called it -- so leaving the Dashboard view left status polling running
 *    forever in the background instead of stopping with the view.
 *  - The top-bar "Refresh" and "Export Report" actions only dispatched
 *    CustomEvents that nothing listened for -- clicking them did nothing.
 *
 * dashboard-handlers.ts is mocked wholesale so these tests can assert on the
 * wiring itself without needing a full window.electronAPI IPC surface (that
 * surface is exercised by dashboard-handlers' own callers, not here).
 */

jest.mock('../../dashboard-handlers.js', () => ({
  cleanupDashboard: jest.fn(),
  updateSystemStatus: jest.fn().mockResolvedValue(undefined),
  exportDashboardDiagnosticReport: jest.fn().mockResolvedValue(undefined),
}));

import { DashboardView } from '../DashboardView';
import * as dashboardHandlers from '../../dashboard-handlers.js';

describe('DashboardView', () => {
  let container: HTMLElement;
  let view: DashboardView;

  beforeEach(() => {
    document.body.innerHTML = '<main id="content-area"></main>';
    container = document.getElementById('content-area')!;
    view = new DashboardView();
  });

  afterEach(async () => {
    // Always tear down, even for tests that mount but don't explicitly
    // unmount, so DashboardTab's real setInterval doesn't leak between tests.
    await view.unmount();
    document.body.innerHTML = '';
  });

  it('mounts a #dashboard-card container for DashboardTab to render into', async () => {
    await view.mount(container);
    expect(container.querySelector('#dashboard-card')).not.toBeNull();
  });

  it('stops dashboard-handlers status polling on unmount', async () => {
    await view.mount(container);
    await view.unmount();

    expect(dashboardHandlers.cleanupDashboard).toHaveBeenCalledTimes(1);
  });

  it('does not throw if cleanupDashboard itself throws', async () => {
    (dashboardHandlers.cleanupDashboard as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await view.mount(container);
    await expect(view.unmount()).resolves.toBeUndefined();
  });

  it('triggers a real status refresh on the "refresh" top-bar action', async () => {
    await view.mount(container);
    view.handleAction('refresh');

    expect(dashboardHandlers.updateSystemStatus).toHaveBeenCalledTimes(1);
  });

  it('triggers a real diagnostic export on the "export" top-bar action', async () => {
    await view.mount(container);
    view.handleAction('export');

    expect(dashboardHandlers.exportDashboardDiagnosticReport).toHaveBeenCalledTimes(1);
  });

  it('exposes the Dashboard title and Refresh/Export Report top-bar actions', () => {
    const config = view.getTopBarConfig();

    expect(config.title).toBe('Dashboard');
    expect(config.actions?.map((a) => a.id)).toEqual(['refresh', 'export']);
  });
});
