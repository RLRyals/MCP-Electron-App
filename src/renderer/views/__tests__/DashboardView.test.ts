/**
 * Regression tests for DashboardView's wiring (issue #214: Dashboard
 * cockpit).
 *
 * DashboardView is now a thin View-interface wrapper -- like
 * WorkflowsViewReact, but split into a wrapper (this file's subject) +
 * content component (DashboardViewReact.tsx's DashboardApp) because the
 * issue explicitly specified mounting DashboardApp "through the existing
 * DashboardView wrapper" rather than folding the View class directly into
 * the .tsx file the way WorkflowsViewReact does. It creates a ReactDOM
 * root in mount() and tears it down in unmount(), and forwards top-bar
 * actions: 'refresh' dispatches a 'dashboard-refresh' CustomEvent that
 * DashboardApp's panels + SystemStrip subscribe to.
 *
 * The top-bar 'export' action (and its dashboard-handlers.ts
 * exportDashboardDiagnosticReport() handler) was removed in mea-ctr -- the
 * same diagnostic report is already reachable from the Diagnostics menu and
 * the Settings > Logs page.
 *
 * DashboardViewReact.js is mocked wholesale (real DashboardApp render
 * behavior is covered by its own panel/strip component tests under
 * src/renderer/components/dashboard/__tests__/) so these tests can assert
 * on the wrapper's plumbing in isolation, same rationale the pre-#214
 * version of this file used for dashboard-handlers.js.
 */

jest.mock('../DashboardViewReact.js', () => ({
  DashboardApp: () => null,
}));

import { DashboardView } from '../DashboardView';

describe('DashboardView', () => {
  let container: HTMLElement;
  let view: DashboardView;

  beforeEach(() => {
    document.body.innerHTML = '<main id="content-area"></main>';
    container = document.getElementById('content-area')!;
    view = new DashboardView();
  });

  afterEach(async () => {
    await view.unmount();
    document.body.innerHTML = '';
  });

  it('mounts a React root into the content-area container', async () => {
    await view.mount(container);
    // The mocked DashboardApp renders null, but React still claims the
    // container as its root (no leftover static markup from the old
    // DashboardTab innerHTML stack).
    expect(container.innerHTML).toBe('');
  });

  it('unmounts the React root cleanly, including when called twice', async () => {
    await view.mount(container);
    await expect(view.unmount()).resolves.toBeUndefined();
    await expect(view.unmount()).resolves.toBeUndefined();
  });

  it('dispatches a dashboard-refresh CustomEvent on the "refresh" top-bar action', async () => {
    await view.mount(container);
    const listener = jest.fn();
    window.addEventListener('dashboard-refresh', listener);

    view.handleAction('refresh');

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('dashboard-refresh', listener);
  });

  it('exposes the Dashboard title and Refresh top-bar action', () => {
    const config = view.getTopBarConfig();

    expect(config.title).toBe('Dashboard');
    expect(config.actions?.map((a) => a.id)).toEqual(['refresh']);
  });
});
