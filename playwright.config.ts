import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the Electron E2E smoke test (Issue #208).
 *
 * This is a separate, self-contained test harness from jest (which has never
 * been configured in this repo - out of scope, see shared-store lesson
 * mcp-electron-app-jest-never-configured). It only drives e2e/*.spec.ts.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
});
