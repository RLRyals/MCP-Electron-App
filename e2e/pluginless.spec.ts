/**
 * Pluginless core smoke test (bead mea-eed)
 *
 * FictionLab's core promise is: set up Docker, the database, and the local
 * TypingMind MCP Connector container (fictionlab-mcp-connector, :50880) --
 * with NO plugins installed. Plugins (workflow, kanban) are optional. The
 * kanban-view containment migration (the plugin now owns the kanban view as
 * of fictionlab-workflow 1.1.0, replacing the old host-bundled view) makes a
 * regression here likely: a hard/static reference back to a plugin-owned
 * view from core code would either break the pluginless renderer boot or
 * leave a dangling nav entry / "plugin not found" error.
 *
 * This extends the launch-only smoke test (e2e/smoke.spec.ts, issue #208)
 * with assertions specific to the pluginless state:
 *   - the app still boots cleanly with zero plugins
 *   - the sidebar carries no plugin-provided nav entries (no "workflows",
 *     no "plugin-*") -- core items only
 *   - core surfaces unrelated to any plugin are still reachable: the
 *     Settings > Services tab (container list) and Settings > Setup
 *     (setup-wizard path)
 *   - no "plugin not found" / "plugin required" error text leaks onto a
 *     core screen
 *
 * Like smoke.spec.ts, this runs in FICTIONLAB_E2E_SMOKE=1 mode, which skips
 * the Docker/Postgres readiness gate, first-run wizard routing, and DB pool
 * init -- see that file's header comment for the full rationale. That mode
 * also never calls pluginManager.initialize() (registry stays null, so
 * plugins:get-all resolves to []), which is already a "zero plugins" state
 * as observed by the renderer. On top of that, this test launches with a
 * freshly created, empty --user-data-dir so the plugins directory
 * (`{userData}/plugins`) is genuinely absent on disk too -- belt and
 * suspenders against a future refactor that reads the plugins directory
 * directly instead of going through pluginManager.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const APP_ROOT = path.resolve(__dirname, '..');

function launchEnv(): NodeJS.ProcessEnv {
  // See smoke.spec.ts: strip ELECTRON_RUN_AS_NODE, force smoke mode.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.FICTIONLAB_E2E_SMOKE = '1';
  return env;
}

let electronApp: ElectronApplication;
let window: Page;
let closed = false;
let userDataDir: string;
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // Fresh, empty profile dir per run so {userData}/plugins is genuinely
  // absent -- not just skipped by smoke mode.
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fictionlab-e2e-pluginless-'));

  electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: APP_ROOT,
    env: launchEnv(),
  });

  window = await electronApp.firstWindow({ timeout: 30_000 });

  window.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  window.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2_000);
});

test.afterAll(async () => {
  if (electronApp && !closed) {
    await electronApp.close();
    closed = true;
  }
  if (userDataDir) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('app boots with zero plugins and zero console.error / pageerror events', async () => {
  expect(window).toBeTruthy();
  const title = await window.title();
  expect(title).toBe('FictionLab');

  // Same #186-class regression gate as smoke.spec.ts: a hard/static
  // reference to a plugin-owned module in core code throws at renderer
  // module-evaluation time regardless of what's on disk.
  expect(consoleErrors, `console.error events during load:\n${consoleErrors.join('\n')}`).toEqual([]);
  expect(pageErrors, `pageerror events during load:\n${pageErrors.join('\n')}`).toEqual([]);
});

test('sidebar renders core-only navigation -- no workflows, no plugin-provided items', async () => {
  const sidebar = window.locator('#sidebar');
  await expect(sidebar).toBeVisible({ timeout: 10_000 });

  const nav = window.locator('#sidebar .sidebar-navigation');
  await expect(nav).toBeVisible({ timeout: 10_000 });

  // Core items that must always exist, plugins or not.
  await expect(window.locator('#sidebar [data-view-id="dashboard"]')).toBeVisible();
  await expect(window.locator('#sidebar [data-view-id="settings"]')).toBeVisible();
  await expect(window.locator('#sidebar [data-view-id="plugins"]')).toBeVisible();
  await expect(window.locator('#sidebar [data-view-id="help"]')).toBeVisible();

  // "workflows" is only pushed onto the nav tree when fictionlab-workflow
  // is installed (src/renderer/components/Sidebar.ts, createNavigationTree).
  // A hard reference to it appearing here pluginless is the regression this
  // test exists to catch.
  await expect(window.locator('#sidebar [data-view-id="workflows"]')).toHaveCount(0);

  // Plugin-provided nav entries (e.g. the kanban board) carry a
  // "plugin-<id>" view id (Sidebar.setPluginNavItems / ViewRouter). None
  // should exist with zero plugins installed.
  await expect(window.locator('#sidebar [data-view-id^="plugin-"]')).toHaveCount(0);

  // Settings still carries its full set of core (non-plugin) children.
  await expect(window.locator('#sidebar [data-view-id="settings-setup"]')).toHaveCount(1);
  await expect(window.locator('#sidebar [data-view-id="settings-database"]')).toHaveCount(1);
  await expect(window.locator('#sidebar [data-view-id="settings-services"]')).toHaveCount(1);
  await expect(window.locator('#sidebar [data-view-id="settings-logs"]')).toHaveCount(1);
});

test('Settings > Services renders the core container list', async () => {
  // Settings is a collapsible section -- expand it before its children are
  // clickable (collapsed children have a zero-height bounding box).
  await window.locator('#sidebar [data-view-id="settings"]').click();
  const servicesLink = window.locator('#sidebar [data-view-id="settings-services"]');
  await expect(servicesLink).toBeVisible({ timeout: 5_000 });
  await servicesLink.click();

  // ServicesView.getTopBarConfig() sets a breadcrumb (['Settings',
  // 'Services']), which TopBar.renderTitleOrBreadcrumb() renders instead of
  // (not in addition to) a plain .top-bar-title -- assert on the breadcrumb.
  // Generous timeout: ServicesTab.initialize() makes several live status/
  // resource-usage IPC round trips (Docker/Postgres/MCP servers) as part of
  // mounting, which this test doesn't stub out.
  await expect(window.locator('.top-bar-breadcrumb')).toContainText('Services', { timeout: 30_000 });

  // The three core containers this app orchestrates (docker-compose.yml):
  // PostgreSQL, the two MCP servers (Connector + Writing Servers), and
  // Docker Desktop itself. Structural assertion only -- these render
  // synchronously with the view's initial HTML regardless of live status.
  await expect(window.locator('#content-area .service-card')).toHaveCount(3, { timeout: 10_000 });

  const bodyText = await window.locator('#content-area').innerText();
  expect(bodyText.toLowerCase()).not.toContain('plugin not found');
  expect(bodyText.toLowerCase()).not.toContain('plugin required');
});

test('Settings > Setup (setup-wizard path) is reachable', async () => {
  const setupLink = window.locator('#sidebar [data-view-id="settings-setup"]');
  await expect(setupLink).toBeVisible({ timeout: 5_000 });
  await setupLink.click();

  // SetupView.getTopBarConfig() also sets a breadcrumb -- see the Services
  // test above for why this checks .top-bar-breadcrumb, not .top-bar-title.
  await expect(window.locator('.top-bar-breadcrumb')).toContainText('Setup', { timeout: 30_000 });
  await expect(window.locator('#content-area .tab-panel-content')).toBeVisible({ timeout: 10_000 });

  const bodyText = await window.locator('#content-area').innerText();
  expect(bodyText.toLowerCase()).not.toContain('plugin not found');
  expect(bodyText.toLowerCase()).not.toContain('plugin required');
});

test('app closes cleanly', async () => {
  const child = electronApp.process();
  expect(child.killed).toBe(false);

  await electronApp.close();
  closed = true;

  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(child.killed || child.exitCode !== null).toBe(true);
});
