/**
 * Regression tests for the Setup tab content rewrite (issue #123).
 *
 * SetupView already wrapped an existing legacy SetupTab component (client
 * selection, prerequisites, environment configuration, update tools), but it
 * was missing three things the issue's spec and acceptance criteria called
 * for:
 *
 *  - "Disk space check" under Prerequisites -- the backend already exposed
 *    `dockerImages.checkDiskSpace()` (used to validate bundled Docker images
 *    will fit), but nothing in the Setup tab surfaced it.
 *  - "Show current versions" under Update Tools -- FictionLab's version was
 *    shown on load, but MCP-Writing-Servers' current version was only ever
 *    displayed after clicking "Update", not proactively.
 *  - "Configure Claude Desktop" under Client Setup -- client-selection-handlers.ts
 *    already had fully-working Claude Desktop status/auto-configure/reset
 *    handlers (`setupClaudeDesktopListeners`), but nothing rendered the
 *    corresponding DOM or ever called that function, so the functionality
 *    was completely unreachable.
 *
 * These tests guard all three additions without re-testing the pre-existing
 * (already covered by manual QA) client selection / env config behavior.
 */

import { SetupView } from '../SetupView';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeElectronAPIMock(overrides: Record<string, any> = {}) {
  return {
    getAppVersion: jest.fn().mockResolvedValue('1.2.3'),
    getPlatformInfo: jest.fn().mockResolvedValue({ platform: 'win32', arch: 'x64', version: 'v20.0.0' }),
    prerequisites: {
      getPlatformInfo: jest.fn().mockResolvedValue({ platform: 'windows' }),
      checkAll: jest.fn().mockResolvedValue({
        docker: { installed: true, running: true, version: '24.0' },
        git: { installed: true, version: '2.40' },
        wsl: { installed: true, version: 'WSL2' },
        platform: 'windows',
      }),
    },
    dockerImages: {
      checkDiskSpace: jest.fn().mockResolvedValue({
        available: true,
        freeSpace: 100 * 1024 ** 3,
        requiredSpace: 20 * 1024 ** 3,
      }),
    },
    updater: {
      checkMCPServers: jest.fn().mockResolvedValue({ available: false, currentVersion: 'abc1234' }),
    },
    envConfig: {
      getConfig: jest.fn().mockResolvedValue({
        POSTGRES_DB: 'db',
        POSTGRES_USER: 'user',
        POSTGRES_PASSWORD: 'pass',
        POSTGRES_PORT: 5432,
        MCP_CONNECTOR_PORT: 3100,
        HTTP_SSE_PORT: 3200,
        DB_ADMIN_PORT: 3300,
        MCP_AUTH_TOKEN: 'tok',
      }),
      getEnvFilePath: jest.fn().mockResolvedValue('/fake/.env'),
      calculatePasswordStrength: jest.fn().mockResolvedValue('strong'),
      checkPort: jest.fn().mockResolvedValue(true),
    },
    clientSelection: {
      getOptions: jest.fn().mockResolvedValue([]),
      getSelection: jest.fn().mockResolvedValue({ clients: [] }),
    },
    claudeDesktop: {
      isConfigured: jest.fn().mockResolvedValue(false),
      getConfig: jest.fn().mockResolvedValue(null),
      autoConfigure: jest.fn().mockResolvedValue({ success: true }),
      openConfigFolder: jest.fn().mockResolvedValue(undefined),
      resetConfig: jest.fn().mockResolvedValue({ success: true }),
    },
    ...overrides,
  };
}

describe('SetupView content', () => {
  let container: HTMLElement;
  let view: SetupView;

  beforeEach(() => {
    document.body.innerHTML = '<main id="content-area"></main>';
    container = document.getElementById('content-area')!;
  });

  afterEach(async () => {
    await view?.unmount();
    document.body.innerHTML = '';
  });

  describe('disk space prerequisite check', () => {
    it('shows free/required space and a success icon when space is available', async () => {
      (window as any).electronAPI = makeElectronAPIMock();
      view = new SetupView();
      await view.mount(container);
      await flushPromises();

      const icon = document.getElementById('disk-space-status-icon')!;
      const detail = document.getElementById('disk-space-detail')!;

      expect(icon.classList.contains('success')).toBe(true);
      expect(icon.classList.contains('loading')).toBe(false);
      expect(detail.textContent).toBe('100.0 GB free (20.0 GB recommended)');
    });

    it('shows an error state with the low-space message when unavailable', async () => {
      (window as any).electronAPI = makeElectronAPIMock({
        dockerImages: {
          checkDiskSpace: jest.fn().mockResolvedValue({
            available: false,
            freeSpace: 5 * 1024 ** 3,
            requiredSpace: 20 * 1024 ** 3,
          }),
        },
      });
      view = new SetupView();
      await view.mount(container);
      await flushPromises();

      const icon = document.getElementById('disk-space-status-icon')!;
      const detail = document.getElementById('disk-space-detail')!;
      const error = document.getElementById('disk-space-error')!;

      expect(icon.classList.contains('error')).toBe(true);
      expect(detail.textContent).toBe('Low disk space: 5.0 GB free');
      expect(error.style.display).toBe('block');
      expect(error.textContent).toContain('20.0 GB is recommended');
    });

    it('is re-checked alongside Docker/Git/WSL when "Check Prerequisites" is clicked', async () => {
      const checkDiskSpace = jest.fn().mockResolvedValue({
        available: true,
        freeSpace: 50 * 1024 ** 3,
        requiredSpace: 20 * 1024 ** 3,
      });
      (window as any).electronAPI = makeElectronAPIMock({ dockerImages: { checkDiskSpace } });
      view = new SetupView();
      await view.mount(container);
      await flushPromises();

      expect(checkDiskSpace).toHaveBeenCalledTimes(1);

      document.getElementById('check-prerequisites')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();

      expect(checkDiskSpace).toHaveBeenCalledTimes(2);
    });
  });

  describe('Update Tools current versions', () => {
    it('shows the MCP-Writing-Servers current version on load without clicking Update', async () => {
      const checkMCPServers = jest.fn().mockResolvedValue({ available: true, currentVersion: 'deadbee', latestVersion: '1234567' });
      (window as any).electronAPI = makeElectronAPIMock({ updater: { checkMCPServers } });
      view = new SetupView();
      await view.mount(container);
      await flushPromises();

      expect(checkMCPServers).toHaveBeenCalled();
      expect(document.getElementById('mcp-servers-current-version')!.textContent).toBe('Current Version: deadbee');
    });

    it('falls back gracefully when the version check fails', async () => {
      (window as any).electronAPI = makeElectronAPIMock({
        updater: { checkMCPServers: jest.fn().mockRejectedValue(new Error('git not found')) },
      });
      view = new SetupView();
      await view.mount(container);
      await flushPromises();

      expect(document.getElementById('mcp-servers-current-version')!.textContent).toBe('Current Version: unavailable');
    });
  });

  describe('Claude Desktop configuration', () => {
    it('renders the Claude Desktop card and reflects "Not Configured" status', async () => {
      (window as any).electronAPI = makeElectronAPIMock({
        claudeDesktop: {
          isConfigured: jest.fn().mockResolvedValue(false),
          getConfig: jest.fn().mockResolvedValue(null),
          autoConfigure: jest.fn().mockResolvedValue({ success: true }),
          openConfigFolder: jest.fn().mockResolvedValue(undefined),
          resetConfig: jest.fn().mockResolvedValue({ success: true }),
        },
      });
      view = new SetupView();
      await view.mount(container);
      await flushPromises();

      expect(document.getElementById('claude-desktop-card')).not.toBeNull();
      const statusText = document.getElementById('claude-desktop-status-text')!;
      expect(statusText.textContent).toBe('Not Configured');
    });

    it('reflects "Configured" status and shows the config preview', async () => {
      (window as any).electronAPI = makeElectronAPIMock({
        claudeDesktop: {
          isConfigured: jest.fn().mockResolvedValue(true),
          getConfig: jest.fn().mockResolvedValue({ mcpServers: { foo: {} } }),
          autoConfigure: jest.fn().mockResolvedValue({ success: true }),
          openConfigFolder: jest.fn().mockResolvedValue(undefined),
          resetConfig: jest.fn().mockResolvedValue({ success: true }),
        },
      });
      view = new SetupView();
      await view.mount(container);
      await flushPromises();

      expect(document.getElementById('claude-desktop-status-text')!.textContent).toBe('✓ Configured');
      const preview = document.getElementById('claude-desktop-config-preview')!;
      expect(preview.style.display).toBe('block');
      expect(document.getElementById('claude-desktop-config-content')!.textContent).toContain('mcpServers');
    });

    it('calls claudeDesktop.autoConfigure() when the auto-configure button is clicked', async () => {
      const autoConfigure = jest.fn().mockResolvedValue({ success: true });
      (window as any).electronAPI = makeElectronAPIMock({
        claudeDesktop: {
          isConfigured: jest.fn().mockResolvedValue(false),
          getConfig: jest.fn().mockResolvedValue(null),
          autoConfigure,
          openConfigFolder: jest.fn().mockResolvedValue(undefined),
          resetConfig: jest.fn().mockResolvedValue({ success: true }),
        },
      });
      view = new SetupView();
      await view.mount(container);
      await flushPromises();

      document.getElementById('claude-desktop-auto-config-btn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();

      expect(autoConfigure).toHaveBeenCalledTimes(1);
    });
  });
});
