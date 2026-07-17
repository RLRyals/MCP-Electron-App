/**
 * Plugin dashboard-widget contribution API (bead mea-cjl.1).
 *
 * Mirrors pluginViewLoader.ts's mainView mechanism but for a smaller
 * contribution point: any installed, ACTIVE plugin whose manifest declares
 * BOTH
 *   - `entry.renderer`     (the same self-contained browser ES module used
 *     for its main view; see plugin-api.ts), and
 *   - `ui.dashboardWidget` (the widget id)
 * gets that bundle's NAMED export `dashboardWidget` (not the default
 * export, which is reserved for `ui.mainView`) dynamically imported and
 * duck-typed against the DashboardWidget contract below. The Dashboard
 * mounts one instance per loaded widget (see DashboardWidgetSlot.tsx).
 *
 * Failure behavior mirrors pluginViewLoader.ts: a missing bundle, an import
 * error, or a bundle that doesn't export a mountable widget class is logged
 * and simply skipped -- no slot is rendered for it.
 *
 * Unlike pluginViewLoader.ts, this has no persistent registry to reconcile:
 * the Dashboard is a single React tree that re-mounts/unmounts widgets
 * itself as its own widget list changes, so callers just re-invoke
 * loadActiveDashboardWidgets() (e.g. on 'plugin-state-changed') and re-render.
 */

export interface DashboardWidget {
  mount(container: HTMLElement): Promise<void>;
  unmount?(): Promise<void>;
}

export interface DashboardWidgetClass {
  new (): DashboardWidget;
}

export interface DashboardWidgetDescriptor {
  pluginId: string;
  pluginVersion: string;
  widgetId: string;
}

export interface LoadedDashboardWidget extends DashboardWidgetDescriptor {
  WidgetClass: DashboardWidgetClass;
}

/**
 * Read the descriptors of every active plugin that declares a renderer
 * bundle + dashboard widget id, straight from the manifests the main
 * process already exposes over `plugin:list`.
 */
export async function listDashboardWidgetDescriptors(): Promise<DashboardWidgetDescriptor[]> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.plugins?.list) return [];

  let plugins: any[];
  try {
    plugins = await electronAPI.plugins.list();
  } catch (error) {
    console.error('[DashboardWidgetLoader] Failed to list plugins:', error);
    return [];
  }
  if (!Array.isArray(plugins)) return [];

  const descriptors: DashboardWidgetDescriptor[] = [];
  for (const plugin of plugins) {
    const manifest = plugin?.manifest;
    const widgetId = manifest?.ui?.dashboardWidget;
    if (plugin?.status !== 'active' || !widgetId || !manifest?.entry?.renderer) continue;
    descriptors.push({
      pluginId: plugin.id,
      pluginVersion: manifest.version || '0.0.0',
      widgetId,
    });
  }
  return descriptors;
}

/**
 * Import a plugin's renderer bundle and return its named-exported
 * `dashboardWidget` class, or null when anything about it is unusable
 * (logged, never thrown).
 */
async function importDashboardWidgetClass(
  descriptor: DashboardWidgetDescriptor
): Promise<DashboardWidgetClass | null> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.plugins?.getRendererUrl) {
    console.error('[DashboardWidgetLoader] plugins.getRendererUrl API not available');
    return null;
  }

  try {
    // Main process resolves manifest entry.renderer against the plugin's
    // install directory, enforces the bundle stays inside it, and verifies
    // it exists -- see `plugin:get-renderer-url` in src/main/index.ts. This
    // is the exact same bundle pluginViewLoader.ts imports for the mainView.
    const { url } = await electronAPI.plugins.getRendererUrl(descriptor.pluginId);

    // Version query defeats the ES module cache across plugin updates.
    const moduleUrl = `${url}?v=${encodeURIComponent(descriptor.pluginVersion)}`;
    const module = await import(/* webpackIgnore: true */ moduleUrl);

    const WidgetClass = module?.dashboardWidget;
    if (typeof WidgetClass !== 'function' || typeof WidgetClass.prototype?.mount !== 'function') {
      console.error(
        `[DashboardWidgetLoader] Plugin ${descriptor.pluginId} renderer bundle has no named 'dashboardWidget' export with a mount() method`
      );
      return null;
    }
    return WidgetClass as DashboardWidgetClass;
  } catch (error) {
    console.error(
      `[DashboardWidgetLoader] Failed to load dashboard widget bundle for plugin ${descriptor.pluginId}:`,
      error
    );
    return null;
  }
}

/**
 * Load the dashboard widget classes contributed by every currently-active
 * plugin. Call on mount and again on 'plugin-state-changed'.
 */
export async function loadActiveDashboardWidgets(): Promise<LoadedDashboardWidget[]> {
  const descriptors = await listDashboardWidgetDescriptors();
  const loaded: LoadedDashboardWidget[] = [];
  for (const descriptor of descriptors) {
    const WidgetClass = await importDashboardWidgetClass(descriptor);
    if (!WidgetClass) continue;
    loaded.push({ ...descriptor, WidgetClass });
  }
  return loaded;
}
