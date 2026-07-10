/**
 * Regression tests for the mobile off-canvas navigation toggle (issue #131).
 *
 * layout.css / sidebar.css already styled `.sidebar` as an off-canvas
 * overlay below 768px (`left: -100%` unless `.sidebar` also has `.open`)
 * and a `.mobile-menu-toggle` button, but nothing in Sidebar.ts ever
 * rendered that button or toggled `.open` -- so on a narrow window the
 * sidebar was completely unreachable, failing the "Works on all screen
 * sizes" acceptance criterion. These tests guard the fix.
 */

import { Sidebar } from '../Sidebar';

function click(el: Element | null): void {
  expect(el).not.toBeNull();
  el!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('Sidebar mobile navigation toggle', () => {
  let container: HTMLElement;
  let sidebar: Sidebar;

  beforeEach(async () => {
    document.body.innerHTML = '<aside id="sidebar"></aside>';
    container = document.getElementById('sidebar')!;
    sidebar = new Sidebar({ container, defaultView: 'dashboard' });
    await sidebar.initialize();
  });

  afterEach(() => {
    sidebar.destroy();
    document.body.innerHTML = '';
  });

  it('renders a single mobile menu toggle button on the document body', () => {
    const toggles = document.querySelectorAll('.mobile-menu-toggle');
    expect(toggles.length).toBe(1);
    expect(toggles[0].getAttribute('aria-label')).toBe('Toggle navigation menu');
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the sidebar overlay when the toggle is clicked', () => {
    const toggle = document.querySelector('.mobile-menu-toggle')!;

    expect(container.classList.contains('open')).toBe(false);
    click(toggle);
    expect(container.classList.contains('open')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the sidebar overlay when the toggle is clicked again', () => {
    const toggle = document.querySelector('.mobile-menu-toggle')!;

    click(toggle); // open
    click(toggle); // close
    expect(container.classList.contains('open')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('auto-closes the overlay after a navigation item is selected', () => {
    const toggle = document.querySelector('.mobile-menu-toggle')!;
    click(toggle); // open the overlay
    expect(container.classList.contains('open')).toBe(true);

    const dashboardItem = container.querySelector('[data-view-id="dashboard"]');
    click(dashboardItem);

    expect(container.classList.contains('open')).toBe(false);
  });

  it('closes the overlay when clicking outside the sidebar and toggle', () => {
    const toggle = document.querySelector('.mobile-menu-toggle')!;
    click(toggle);
    expect(container.classList.contains('open')).toBe(true);

    click(document.body);

    expect(container.classList.contains('open')).toBe(false);
  });

  it('removes the toggle button on destroy', () => {
    sidebar.destroy();
    expect(document.querySelector('.mobile-menu-toggle')).toBeNull();
  });
});

/**
 * Regression tests for issue #211: attachEventListeners() stacked a fresh
 * copy of its delegated listeners on every call (constructor,
 * pinned-plugins-changed, pinPlugin, unpinPlugin, updateBadge,
 * setPluginNavItems) instead of replacing them. With an even number of
 * listeners registered, every click toggle ran an even number of times and
 * canceled itself out — the footer Collapse button and the Settings
 * submenu both appeared dead. setPluginNavItems() (new in d7738b7) is now
 * called at startup via renderer.ts's plugin-view sync, so this reliably
 * reproduced on every boot with any plugin active.
 */
describe('Sidebar duplicate event listener regression (#211)', () => {
  let container: HTMLElement;
  let sidebar: Sidebar;

  beforeEach(async () => {
    document.body.innerHTML = '<aside id="sidebar"></aside>';
    container = document.getElementById('sidebar')!;
    sidebar = new Sidebar({ container, defaultView: 'dashboard' });
    await sidebar.initialize();
  });

  afterEach(() => {
    sidebar.destroy();
    document.body.innerHTML = '';
  });

  it('toggles the sidebar collapsed state exactly once per click after setPluginNavItems() re-attaches listeners', () => {
    // Mirrors renderer.ts's startup plugin-view sync, which calls
    // setPluginNavItems() after construction/initialize().
    sidebar.setPluginNavItems([]);

    expect(container.classList.contains('collapsed')).toBe(false);

    const collapseButton = container.querySelector('[data-action="toggle-collapse"]');
    click(collapseButton);
    expect(container.classList.contains('collapsed')).toBe(true);

    click(collapseButton);
    expect(container.classList.contains('collapsed')).toBe(false);
  });

  it('opens and closes the Settings submenu on repeated clicks after setPluginNavItems() re-attaches listeners', () => {
    sidebar.setPluginNavItems([]);

    const settingsItem = container.querySelector('[data-view-id="settings"]') as HTMLElement;
    const collapsibleWrapper = settingsItem.parentElement as HTMLElement;

    expect(collapsibleWrapper.classList.contains('expanded')).toBe(false);

    click(settingsItem);
    expect(collapsibleWrapper.classList.contains('expanded')).toBe(true);

    click(settingsItem);
    expect(collapsibleWrapper.classList.contains('expanded')).toBe(false);
  });

  it('still toggles exactly once per click after several plugin state-change cycles (no re-accumulation)', () => {
    // Simulate repeated plugin-installed/uninstalled/state-change syncs,
    // each of which calls setPluginNavItems() -> render() +
    // attachEventListeners() in renderer.ts. Asserted via a spy on the
    // private toggle handler rather than final class state, so the check
    // is deterministic regardless of how many re-attach cycles ran
    // (accumulated-listener counts can otherwise land on an odd number and
    // coincidentally reproduce the correct end state).
    sidebar.setPluginNavItems([{ id: 'kanban', label: 'Kanban', icon: '🗂️' }]);
    sidebar.setPluginNavItems([]);
    sidebar.setPluginNavItems([{ id: 'kanban', label: 'Kanban', icon: '🗂️' }]);
    sidebar.pinPlugin('kanban');
    sidebar.unpinPlugin('kanban');
    sidebar.updateBadge('dashboard', 3);

    const toggleCollapseSpy = jest.spyOn(sidebar as any, 'toggleCollapse');
    const collapseButton = container.querySelector('[data-action="toggle-collapse"]');
    click(collapseButton);

    expect(toggleCollapseSpy).toHaveBeenCalledTimes(1);
  });

  it('emits exactly one navigate event per nav item click', () => {
    sidebar.setPluginNavItems([]);

    const navigateSpy = jest.fn();
    sidebar.on('navigate', navigateSpy);

    const dashboardItem = container.querySelector('[data-view-id="dashboard"]');
    click(dashboardItem);

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('dashboard');
  });

  it('does not leak the document-level Ctrl+1-9 keydown listener past destroy()', () => {
    sidebar.setPluginNavItems([]);

    // Spy on the private navigateTo handler directly, rather than going
    // through the public `on('navigate', ...)` listener map — destroy()
    // clears that map unconditionally, which would make this assertion
    // pass even if the underlying document keydown listener were still
    // leaking (the actual bug being regression-tested here).
    const navigateToSpy = jest.spyOn(sidebar as any, 'navigateTo');

    sidebar.destroy();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true })
    );

    expect(navigateToSpy).not.toHaveBeenCalled();
  });
});
