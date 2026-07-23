/**
 * Jest setup for the chapter-editor-plugin renderer test suite.
 * Runs once per test file, after the test framework is installed.
 */
import '@testing-library/jest-dom';

// Real Electron injects `window.electronAPI` via the preload contextBridge.
// jsdom has no such global, so index.tsx's `invoke()` would throw on a bare
// `undefined` before any test gets to run. Seed a jest.fn()-backed stub here
// (mirrors agent-factory-plugin's jest.setup.ts) -- individual tests
// reassign `.invoke` / `.dialog.showOpenDialog` to route responses per test.
beforeEach(() => {
  (window as any).electronAPI = {
    invoke: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    dialog: {
      showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    },
  };
});
