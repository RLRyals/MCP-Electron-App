/**
 * TopBar environment indicator regression tests (bead mea-lj0).
 *
 * The bug: renderEnvironmentIndicator() read status from `#dashboard-
 * status-text` / `#dashboard-status-indicator` DOM elements that issue
 * #214's cockpit redesign deleted along with the old Dashboard markup.
 * Nothing has driven the indicator since, so it was permanently stuck on
 * "Status Unknown" (rendered as an 'error'-colored dot) regardless of real
 * service health. The fix: SystemStrip now pushes the live aggregate via
 * `updateEnvironmentStatus()`, and the indicator renders from that pushed
 * state (persisted on the TopBar instance) instead of a stale DOM read.
 */

import { TopBar } from '../TopBar';

function setupTopBar(): { topBar: TopBar; container: HTMLElement } {
  document.body.innerHTML = '<div id="top-bar"></div>';
  const container = document.getElementById('top-bar')!;
  const topBar = new TopBar({ container });
  topBar.initialize();
  topBar.setContext('dashboard', {
    title: 'Dashboard',
    global: { environmentIndicator: true },
  });
  return { topBar, container };
}

describe('TopBar environment indicator', () => {
  it('renders a neutral "Status Unknown" (no health class) before anything ever pushes a status', () => {
    const { container } = setupTopBar();

    const text = container.querySelector('.environment-text');
    const dot = container.querySelector('.environment-dot');

    expect(text?.textContent).toBe('Status Unknown');
    expect(dot?.classList.contains('error')).toBe(false);
    expect(dot?.classList.contains('healthy')).toBe(false);
    expect(dot?.classList.contains('warning')).toBe(false);
  });

  it('reflects a healthy push immediately (patches the live DOM, not just state)', () => {
    const { topBar, container } = setupTopBar();

    topBar.updateEnvironmentStatus('healthy', 'All Systems Operational');

    const text = container.querySelector('.environment-text');
    const dot = container.querySelector('.environment-dot');
    expect(text?.textContent).toBe('All Systems Operational');
    expect(dot?.classList.contains('healthy')).toBe(true);
  });

  it('degrades to warning/error text+class on subsequent pushes (never stuck on the first status)', () => {
    const { topBar, container } = setupTopBar();

    topBar.updateEnvironmentStatus('healthy', 'All Systems Operational');
    topBar.updateEnvironmentStatus('warning', 'MCP Writing Servers starting');

    const dot = container.querySelector('.environment-dot');
    const text = container.querySelector('.environment-text');
    expect(dot?.classList.contains('warning')).toBe(true);
    expect(dot?.classList.contains('healthy')).toBe(false);
    expect(text?.textContent).toBe('MCP Writing Servers starting');
  });

  it('survives a full re-render (view navigation) instead of resetting to Status Unknown', () => {
    const { topBar, container } = setupTopBar();

    topBar.updateEnvironmentStatus('healthy', 'All Systems Operational');
    // setContext triggers a full render() -- rebuilds the markup from
    // scratch, the exact path that used to lose the pushed status because
    // the old implementation re-read a DOM element instead of stored state.
    topBar.setContext('settings-services', {
      title: 'Services',
      global: { environmentIndicator: true },
    });

    const text = container.querySelector('.environment-text');
    const dot = container.querySelector('.environment-dot');
    expect(text?.textContent).toBe('All Systems Operational');
    expect(dot?.classList.contains('healthy')).toBe(true);
  });

  it('escapes text content (defense in depth -- overall.message ultimately comes from service data)', () => {
    const { topBar, container } = setupTopBar();

    topBar.updateEnvironmentStatus('error', '<img src=x onerror=alert(1)>');

    const text = container.querySelector('.environment-text');
    expect(text?.innerHTML).not.toContain('<img');
    expect(text?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
