/**
 * CSP img-src data: regression test (mea-i38)
 *
 * The renderer CSP's img-src had no `data:` source, so any plugin that
 * renders a data-URL image (e.g. a CSS `background-image:url(data:...)`
 * layer, as agent-factory 0.6.7 switched to) is silently blocked by the
 * browser with no visible error beyond a console CSP violation message.
 * Plugin mainViews/dashboard widgets are dynamically import()ed into THIS
 * document (src/renderer/services/pluginViewLoader.ts,
 * dashboardWidgetLoader.ts), so index.html's <meta> CSP governs them.
 *
 * jsdom (csp.test.ts) only checks the directive string is present - it does
 * not enforce CSP. This test proves the real Chromium/Electron CSP engine
 * actually allows a data: image to load under the shipped policy, the same
 * failure mode Casey's manual repro caught.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const APP_ROOT = path.resolve(__dirname, '..');
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function launchEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.FICTIONLAB_E2E_SMOKE = '1';
  return env;
}

let electronApp: ElectronApplication;
let window: Page;
let closed = false;
let userDataDir: string;

test.beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fictionlab-e2e-csp-'));
  electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: APP_ROOT,
    env: launchEnv(),
  });
  window = await electronApp.firstWindow({ timeout: 30_000 });
  await window.waitForLoadState('domcontentloaded');
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

test('img-src allows a data: URL image to load (CSS background-image and <img>)', async () => {
  const cspViolations: string[] = [];
  window.on('console', (msg) => {
    if (/content security policy|violates the following/i.test(msg.text())) {
      cspViolations.push(msg.text());
    }
  });

  const result = await window.evaluate((dataUrl) => {
    return new Promise<{ imgLoaded: boolean; bgApplied: string }>((resolve) => {
      const img = document.createElement('img');
      img.style.position = 'absolute';
      img.style.top = '-9999px';
      img.onload = () => {
        const bgProbe = document.createElement('div');
        bgProbe.style.backgroundImage = `url(${dataUrl})`;
        resolve({ imgLoaded: true, bgApplied: bgProbe.style.backgroundImage });
        img.remove();
      };
      img.onerror = () => {
        resolve({ imgLoaded: false, bgApplied: '' });
        img.remove();
      };
      document.body.appendChild(img);
      img.src = dataUrl;
    });
  }, TINY_PNG_DATA_URL);

  expect(result.imgLoaded, 'data: <img> should load under the current CSP').toBe(true);
  expect(result.bgApplied, 'CSS background-image:url(data:...) should be settable').toContain('data:image/png');
  expect(cspViolations, `CSP violations logged:\n${cspViolations.join('\n')}`).toEqual([]);
});
