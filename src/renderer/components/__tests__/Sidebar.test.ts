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
