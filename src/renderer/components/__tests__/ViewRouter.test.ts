/**
 * Regression tests for the view-switch fade/slide transition (issue #131).
 *
 * layout.css already defined a `fadeIn` keyframe and a (never-applied)
 * `.view.active` rule, but ViewRouter replaced #content-area's innerHTML
 * directly on every navigation with no class toggling at all, so views
 * popped in instantly -- failing the "Smooth transitions between tabs"
 * acceptance criterion. ViewRouter.playViewTransition() now (re)applies
 * `.view-transition-enter` (layout.css) on every successful navigation;
 * these tests guard that wiring without touching the real, dynamically
 * `import()`-ed default view registry (registerDefaultViews()), which
 * needs a bundler/runtime this unit test environment doesn't have.
 *
 * Sidebar/TopBar are imported as types only (erased at compile time) and
 * faked at runtime: TopBar.ts pulls in store/app-state.js via a bare `.js`
 * specifier meant for the browser's native ESM loader, which ts-jest's
 * CommonJS resolution can't follow -- unrelated to the behavior under test
 * here (ViewRouter's own transition wiring), so a minimal fake sidesteps it.
 */

import { ViewRouter, type View } from '../ViewRouter';
import type { Sidebar } from '../Sidebar';
import type { TopBar } from '../TopBar';

class StubView implements View {
  public mountCount = 0;
  public unmountCount = 0;

  async mount(container: HTMLElement): Promise<void> {
    this.mountCount++;
    container.innerHTML = '<div data-testid="stub-view">Stub content</div>';
  }

  async unmount(): Promise<void> {
    this.unmountCount++;
  }

  getTopBarConfig() {
    return { title: 'Stub', actions: [], global: {} };
  }
}

describe('ViewRouter view transition', () => {
  let contentArea: HTMLElement;
  let router: ViewRouter;

  beforeEach(() => {
    document.body.innerHTML = `
      <aside id="sidebar"></aside>
      <header id="top-bar"></header>
      <main id="content-area"></main>
    `;
    contentArea = document.getElementById('content-area')!;
    const fakeSidebar = { setActiveView: jest.fn() } as unknown as Sidebar;
    const fakeTopBar = { setContext: jest.fn() } as unknown as TopBar;
    router = new ViewRouter({ container: contentArea, sidebar: fakeSidebar, topBar: fakeTopBar });
    router.registerView('stub', StubView);
  });

  it('mounts the registered view into the content area', async () => {
    await router.navigateTo('stub');
    expect(contentArea.querySelector('[data-testid="stub-view"]')).not.toBeNull();
  });

  it('applies the fade/slide-in transition class after a successful navigation', async () => {
    await router.navigateTo('stub');
    expect(contentArea.classList.contains('view-transition-enter')).toBe(true);
  });

  it('restarts the transition class on every navigation (not just the first)', async () => {
    await router.navigateTo('stub');
    expect(contentArea.classList.contains('view-transition-enter')).toBe(true);

    // Simulate the class having been "consumed" between navigations the way
    // an animationend handler or a fresh mount would; the important
    // contract is that navigateTo() re-adds it every time, not just once.
    contentArea.classList.remove('view-transition-enter');

    await router.navigateTo('stub');
    expect(contentArea.classList.contains('view-transition-enter')).toBe(true);
  });
});
