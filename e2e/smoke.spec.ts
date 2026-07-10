/**
 * Electron smoke test (Issue #208)
 *
 * Launches the BUILT app with Playwright's Electron support and asserts that
 * the main window actually renders. This is the gate that would have caught
 * the 2026-07-08 blue-screen (#186): a broken renderer ESM import passes
 * `tsc` and `npm run build` cleanly but produces a dead renderer module graph
 * at load time - nothing short of actually opening the window and watching
 * the console catches that class of failure.
 *
 * Runs in FICTIONLAB_E2E_SMOKE=1 mode (see src/main/index.ts), which skips the
 * Docker/Postgres readiness gate, first-run wizard routing, database pool
 * init, and plugin discovery, and goes straight to the main application
 * window. That backend is a separate concern from "does the renderer boot" -
 * see the #187/#208 issue threads. The window must render regardless of
 * backend availability, matching the pre-any-backend #186 failure mode.
 *
 * ELECTRON_RUN_AS_NODE gotcha (shared-store lesson
 * electron-gui-blocked-in-agent-sessions, 2026-07-07): Claude Code / CI agent
 * sessions run with ELECTRON_RUN_AS_NODE=1 in the environment. If that var is
 * inherited by the spawned Electron process, Electron starts in plain-Node
 * mode and NO window ever opens - the test then hangs or fails mysteriously
 * on firstWindow(). We must explicitly strip it from the launch env.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import * as path from 'path';

const APP_ROOT = path.resolve(__dirname, '..');

function launchEnv(): NodeJS.ProcessEnv {
  // Copy process.env and explicitly delete ELECTRON_RUN_AS_NODE - do not rely
  // on it simply being "falsy", an inherited "1" (or any value) short-circuits
  // Electron's normal bootstrap into plain-Node mode with no window.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.FICTIONLAB_E2E_SMOKE = '1';
  return env;
}

let electronApp: ElectronApplication;
let window: Page;
let closed = false;
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: ['.'],
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

  // Let the renderer finish its initial boot (Sidebar.initialize(), view
  // mount, etc.) so any deferred console.error/pageerror has a chance to fire
  // before we assert on the collected arrays.
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2_000);
});

test.afterAll(async () => {
  if (electronApp && !closed) {
    await electronApp.close();
    closed = true;
  }
});

test('main window appears with the correct title', async () => {
  expect(window).toBeTruthy();
  const title = await window.title();
  expect(title).toBe('FictionLab');
});

test('renderer boots with zero console.error / pageerror events', async () => {
  // This is the assertion that catches the #186-class renderer module-load
  // failure: tsc/build succeed, but a wrong import (e.g. a named import of a
  // default export) throws at module-evaluation time and the window is left
  // blank while the console fills with errors.
  expect(consoleErrors, `console.error events during load:\n${consoleErrors.join('\n')}`).toEqual([]);
  expect(pageErrors, `pageerror events during load:\n${pageErrors.join('\n')}`).toEqual([]);
});

test('sidebar (root UI element) is visible', async () => {
  const sidebar = window.locator('#sidebar');
  await expect(sidebar).toBeVisible({ timeout: 10_000 });

  // The Sidebar component renders its nav tree into a `.sidebar-navigation`
  // element once Sidebar.initialize() completes - confirms the renderer did
  // real work, not just that an empty shell element exists in index.html.
  const nav = window.locator('#sidebar .sidebar-navigation');
  await expect(nav).toBeVisible({ timeout: 10_000 });

  const dashboardItem = window.locator('#sidebar [data-view-id="dashboard"]');
  await expect(dashboardItem).toBeVisible();
});

test('app closes cleanly', async () => {
  // Capture the child process handle before closing - once electronApp.close()
  // tears down the CDP connection, electronApp.process() is no longer safe to
  // call.
  const child = electronApp.process();
  expect(child.killed).toBe(false);

  await electronApp.close();
  closed = true;

  // Give the OS a beat to reap the process, then confirm it actually exited
  // rather than being merely detached (guards against orphaned Electron
  // processes lingering after the test run).
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(child.killed || child.exitCode !== null).toBe(true);
});
