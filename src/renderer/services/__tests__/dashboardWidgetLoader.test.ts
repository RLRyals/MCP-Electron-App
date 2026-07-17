/**
 * dashboardWidgetLoader tests (bead mea-cjl.1).
 *
 * Covers the descriptor-filtering logic (the pure business rule: which
 * active plugins actually contribute a dashboard widget) plus the graceful-
 * degradation branches -- no electronAPI, list() throws, non-array result.
 * The dynamic-import success path (importing a real bundle's named
 * `dashboardWidget` export) is intentionally left untested here, mirroring
 * pluginViewLoader.ts's own equivalent gap: there is no fixture bundle to
 * import in a jsdom test environment, only mockable IPC surfaces.
 */

import { listDashboardWidgetDescriptors, loadActiveDashboardWidgets } from '../dashboardWidgetLoader';

function installElectronAPI(overrides: Partial<any> = {}) {
  (window as any).electronAPI = {
    plugins: {
      list: jest.fn().mockResolvedValue([]),
      getRendererUrl: jest.fn(),
    },
    ...overrides,
  };
}

afterEach(() => {
  delete (window as any).electronAPI;
  jest.restoreAllMocks();
});

describe('listDashboardWidgetDescriptors', () => {
  it('returns [] when electronAPI.plugins.list is unavailable', async () => {
    (window as any).electronAPI = {};
    await expect(listDashboardWidgetDescriptors()).resolves.toEqual([]);
  });

  it('returns [] when plugins.list() throws', async () => {
    installElectronAPI({
      plugins: { list: jest.fn().mockRejectedValue(new Error('ipc down')) },
    });
    await expect(listDashboardWidgetDescriptors()).resolves.toEqual([]);
  });

  it('returns [] when plugins.list() resolves to a non-array', async () => {
    installElectronAPI({ plugins: { list: jest.fn().mockResolvedValue(null) } });
    await expect(listDashboardWidgetDescriptors()).resolves.toEqual([]);
  });

  it('skips inactive plugins', async () => {
    installElectronAPI({
      plugins: {
        list: jest.fn().mockResolvedValue([
          {
            id: 'fictionlab-workflow',
            status: 'inactive',
            manifest: { version: '1.0.0', ui: { dashboardWidget: 'workflow-widget' }, entry: { renderer: 'dist-renderer/index.js' } },
          },
        ]),
      },
    });
    await expect(listDashboardWidgetDescriptors()).resolves.toEqual([]);
  });

  it('skips active plugins with no ui.dashboardWidget', async () => {
    installElectronAPI({
      plugins: {
        list: jest.fn().mockResolvedValue([
          {
            id: 'fictionlab-workflow',
            status: 'active',
            manifest: { version: '1.0.0', ui: {}, entry: { renderer: 'dist-renderer/index.js' } },
          },
        ]),
      },
    });
    await expect(listDashboardWidgetDescriptors()).resolves.toEqual([]);
  });

  it('skips active plugins with a dashboardWidget id but no entry.renderer', async () => {
    installElectronAPI({
      plugins: {
        list: jest.fn().mockResolvedValue([
          {
            id: 'fictionlab-workflow',
            status: 'active',
            manifest: { version: '1.0.0', ui: { dashboardWidget: 'workflow-widget' }, entry: {} },
          },
        ]),
      },
    });
    await expect(listDashboardWidgetDescriptors()).resolves.toEqual([]);
  });

  it('includes an active plugin that declares both ui.dashboardWidget and entry.renderer', async () => {
    installElectronAPI({
      plugins: {
        list: jest.fn().mockResolvedValue([
          {
            id: 'fictionlab-workflow',
            status: 'active',
            manifest: {
              version: '2.1.0',
              ui: { dashboardWidget: 'workflow-widget' },
              entry: { renderer: 'dist-renderer/index.js' },
            },
          },
        ]),
      },
    });
    await expect(listDashboardWidgetDescriptors()).resolves.toEqual([
      { pluginId: 'fictionlab-workflow', pluginVersion: '2.1.0', widgetId: 'workflow-widget' },
    ]);
  });

  it('defaults pluginVersion to 0.0.0 when the manifest omits version', async () => {
    installElectronAPI({
      plugins: {
        list: jest.fn().mockResolvedValue([
          {
            id: 'fictionlab-workflow',
            status: 'active',
            manifest: { ui: { dashboardWidget: 'workflow-widget' }, entry: { renderer: 'dist-renderer/index.js' } },
          },
        ]),
      },
    });
    const descriptors = await listDashboardWidgetDescriptors();
    expect(descriptors[0].pluginVersion).toBe('0.0.0');
  });
});

describe('loadActiveDashboardWidgets', () => {
  it('returns [] and never calls getRendererUrl when no plugin contributes a widget', async () => {
    const getRendererUrl = jest.fn();
    installElectronAPI({ plugins: { list: jest.fn().mockResolvedValue([]), getRendererUrl } });
    await expect(loadActiveDashboardWidgets()).resolves.toEqual([]);
    expect(getRendererUrl).not.toHaveBeenCalled();
  });

  it('skips a descriptor when plugins.getRendererUrl is unavailable', async () => {
    installElectronAPI({
      plugins: {
        list: jest.fn().mockResolvedValue([
          {
            id: 'fictionlab-workflow',
            status: 'active',
            manifest: { version: '1.0.0', ui: { dashboardWidget: 'workflow-widget' }, entry: { renderer: 'dist-renderer/index.js' } },
          },
        ]),
        // getRendererUrl deliberately omitted
      },
    });
    await expect(loadActiveDashboardWidgets()).resolves.toEqual([]);
  });

  it('skips a descriptor when getRendererUrl rejects', async () => {
    installElectronAPI({
      plugins: {
        list: jest.fn().mockResolvedValue([
          {
            id: 'fictionlab-workflow',
            status: 'active',
            manifest: { version: '1.0.0', ui: { dashboardWidget: 'workflow-widget' }, entry: { renderer: 'dist-renderer/index.js' } },
          },
        ]),
        getRendererUrl: jest.fn().mockRejectedValue(new Error('not found')),
      },
    });
    await expect(loadActiveDashboardWidgets()).resolves.toEqual([]);
  });
});
