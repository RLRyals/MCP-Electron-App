/**
 * Terminal PTY end-to-end test (mea-bkr).
 *
 * Exercises the real host-side PTY surface (terminal:spawn/write/resize/kill
 * + the terminal:data/terminal:exit push events) end to end through the
 * ACTUAL running app via Playwright's Electron support, the same harness
 * smoke.spec.ts / pluginless.spec.ts already use. This is the disclosed
 * "manual GUI verification pass" for this PR's slice of mea-bkr: it proves
 * a real ConPTY-backed child process is spawned, streams output back over
 * IPC, accepts written keystrokes, resizes, and is fully reaped (no
 * orphaned process) on kill.
 *
 * Deliberately spawns a plain `cmd.exe` shell via a throwaway profile
 * written directly to the isolated --user-data-dir's terminal-profiles.json
 * BEFORE launch (exercising the real profile-loading path), not the real
 * `claude` CLI: launching an actual interactive Claude Code session as a
 * child of an unattended dispatched agent session would itself start a new,
 * separately-billed session -- out of scope for an automated CI-safe check.
 * The terminal-plugin renderer view (xterm.js UI) does not exist yet (it
 * lives in the fictionlab-workflow monorepo, tracked as follow-up), so this
 * drives the IPC contract directly via window.electronAPI rather than
 * clicking through a terminal UI -- see this PR's description for what
 * remains before the full mea-bkr acceptance criteria (UI-driven profile
 * launch, resize, ctrl-C) are met.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const APP_ROOT = path.resolve(__dirname, '..');
const SESSION_ID = 'e2e-terminal-session';
const MARKER = 'E2E_PTY_MARKER_9f3ac1';

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

test.describe.configure({ mode: 'serial' });

test.skip(process.platform !== 'win32', 'This profile spawns cmd.exe; ConPTY is Windows-only per the mea-bkr spec.');

test.beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fictionlab-e2e-terminal-'));

  // Seed a throwaway profile through the real load path (profiles.ts reads
  // {userData}/terminal-profiles.json) instead of adding a test-only IPC
  // surface just to override the spawned command.
  fs.writeFileSync(
    path.join(userDataDir, 'terminal-profiles.json'),
    JSON.stringify([
      {
        id: 'e2e-shell',
        name: 'E2E Shell',
        cwd: os.tmpdir(),
        command: 'cmd.exe',
        args: [],
      },
    ]),
    'utf-8'
  );

  electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: APP_ROOT,
    env: launchEnv(),
  });

  window = await electronApp.firstWindow({ timeout: 30_000 });
  await window.waitForLoadState('domcontentloaded');

  // Collect pushed terminal:data / terminal:exit events on the page itself
  // so we can poll for them from the Node side.
  await window.evaluate(() => {
    (window as any).__e2eTerminalData = [];
    (window as any).__e2eTerminalExit = [];
    (window as any).electronAPI.on('terminal:data', (payload: any) => {
      (window as any).__e2eTerminalData.push(payload);
    });
    (window as any).electronAPI.on('terminal:exit', (payload: any) => {
      (window as any).__e2eTerminalExit.push(payload);
    });
  });
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

test('terminal:list-profiles picks up the seeded e2e-shell profile', async () => {
  const profiles = await window.evaluate(() => (window as any).electronAPI.invoke('terminal:list-profiles'));
  expect(profiles.map((p: any) => p.id)).toContain('e2e-shell');
});

test('terminal:spawn starts a real ConPTY-backed cmd.exe process', async () => {
  const result = await window.evaluate(
    ({ sessionId }) =>
      (window as any).electronAPI.invoke('terminal:spawn', { sessionId, profileId: 'e2e-shell', cols: 80, rows: 24 }),
    { sessionId: SESSION_ID }
  );
  expect(result.success).toBe(true);
  expect(result.profile.id).toBe('e2e-shell');
});

test('keystrokes written through terminal:write reach the real shell and its output streams back', async () => {
  await window.evaluate(
    ({ sessionId, marker }) =>
      (window as any).electronAPI.invoke('terminal:write', { sessionId, data: `echo ${marker}\r` }),
    { sessionId: SESSION_ID, marker: MARKER }
  );

  await window.waitForFunction(
    (marker) => (window as any).__e2eTerminalData.some((e: any) => e.data.includes(marker)),
    MARKER,
    { timeout: 15_000 }
  );
});

test('terminal:resize succeeds against the live session', async () => {
  const result = await window.evaluate(
    ({ sessionId }) => (window as any).electronAPI.invoke('terminal:resize', { sessionId, cols: 120, rows: 40 }),
    { sessionId: SESSION_ID }
  );
  expect(result.success).toBe(true);
});

test('terminal:kill terminates the process and a terminal:exit event confirms it was reaped (no orphan)', async () => {
  const result = await window.evaluate(
    ({ sessionId }) => (window as any).electronAPI.invoke('terminal:kill', { sessionId }),
    { sessionId: SESSION_ID }
  );
  expect(result.success).toBe(true);

  await window.waitForFunction(
    (sessionId) => (window as any).__e2eTerminalExit.some((e: any) => e.sessionId === sessionId),
    SESSION_ID,
    { timeout: 15_000 }
  );
});
