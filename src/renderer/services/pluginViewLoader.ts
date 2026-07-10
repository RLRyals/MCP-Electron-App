/**
 * Plugin renderer-bundle loading (universal plugin architecture).
 *
 * Any installed, ACTIVE plugin whose manifest declares BOTH
 *   - `entry.renderer`  (a self-contained browser ES module shipped inside
 *     the plugin directory; see plugin-api.ts), and
 *   - `ui.mainView`     (the view id to register it under)
 * gets its bundle dynamically imported into the main window and its
 * DEFAULT-EXPORTED view class registered with the ViewRouter under that id.
 * The sidebar entry for the view comes from `ui.mainViewLabel` /
 * `ui.mainViewIcon` (falling back to the plugin name / a generic icon).
 *
 * This is the mechanism that lets plugin UI ship WITH the plugin instead of
 * being compiled into the app (fictionlab-workflow#8 — the kanban board is
 * the first view loaded this way). It is deliberately plugin-agnostic:
 * nothing in here knows about kanban.
 *
 * Failure behavior (graceful degradation): if the bundle is missing, fails
 * to import, or doesn't default-export a mountable view class, the view is
 * simply not registered — no sidebar entry appears and navigation to the id
 * shows the ViewRouter's "plugin required" screen instead of a blank window.
 */

import type { ViewRouter, ViewClass } from '../components/ViewRouter.js';

export interface PluginProvidedView {
  pluginId: string;
  pluginVersion: string;
  viewId: string;
  label: string;
  icon: string;
}

export interface PluginViewSyncResult {
  /** Views whose bundles are currently loaded + registered. */
  views: PluginProvidedView[];
  /** View ids newly registered by this sync. */
  added: string[];
  /** View ids unregistered by this sync (plugin uninstalled/deactivated). */
  removed: string[];
}

/** viewId -> what's currently loaded for it. */
const loadedViews = new Map<string, PluginProvidedView>();

/**
 * Read the descriptors of every active plugin that declares a renderer
 * bundle + main view, straight from the manifests the main process already
 * exposes over `plugin:list`.
 */
async function listPluginViewDescriptors(): Promise<PluginProvidedView[]> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.plugins?.list) return [];

  let plugins: any[];
  try {
    plugins = await electronAPI.plugins.list();
  } catch (error) {
    console.error('[PluginViewLoader] Failed to list plugins:', error);
    return [];
  }
  if (!Array.isArray(plugins)) return [];

  const descriptors: PluginProvidedView[] = [];
  for (const plugin of plugins) {
    const manifest = plugin?.manifest;
    const viewId = manifest?.ui?.mainView;
    if (plugin?.status !== 'active' || !viewId || !manifest?.entry?.renderer) continue;
    descriptors.push({
      pluginId: plugin.id,
      pluginVersion: manifest.version || '0.0.0',
      viewId,
      label: manifest.ui.mainViewLabel || manifest.name || plugin.id,
      icon: manifest.ui.mainViewIcon || '🧩',
    });
  }
  return descriptors;
}

/**
 * Import a plugin's renderer bundle and return its default-exported view
 * class, or null when anything about it is unusable (logged, never thrown).
 */
async function importPluginViewClass(descriptor: PluginProvidedView): Promise<ViewClass | null> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.plugins?.getRendererUrl) {
    console.error('[PluginViewLoader] plugins.getRendererUrl API not available');
    return null;
  }

  try {
    // Main process resolves manifest entry.renderer against the plugin's
    // install directory, enforces the bundle stays inside it, and verifies
    // it exists — see `plugin:get-renderer-url` in src/main/index.ts.
    const { url } = await electronAPI.plugins.getRendererUrl(descriptor.pluginId);

    // Version query defeats the ES module cache across plugin updates —
    // without it, an update-in-place would keep serving the old bundle
    // until a full window reload.
    const moduleUrl = `${url}?v=${encodeURIComponent(descriptor.pluginVersion)}`;
    const module = await import(/* webpackIgnore: true */ moduleUrl);

    const LoadedViewClass = module?.default;
    if (typeof LoadedViewClass !== 'function' || typeof LoadedViewClass.prototype?.mount !== 'function') {
      console.error(
        `[PluginViewLoader] Plugin ${descriptor.pluginId} renderer bundle has no default-exported view class with a mount() method`
      );
      return null;
    }
    return LoadedViewClass as ViewClass;
  } catch (error) {
    console.error(
      `[PluginViewLoader] Failed to load renderer bundle for plugin ${descriptor.pluginId}:`,
      error
    );
    return null;
  }
}

/**
 * Reconcile the ViewRouter with the currently-active plugin-provided views:
 * register new ones (importing their bundles), re-import on version change,
 * and unregister ones whose plugin went away. Call at startup and again on
 * every plugin install/uninstall/state-change event.
 */
export async function syncPluginProvidedViews(viewRouter: ViewRouter): Promise<PluginViewSyncResult> {
  const descriptors = await listPluginViewDescriptors();
  const added: string[] = [];

  for (const descriptor of descriptors) {
    // Whether or not the bundle loads, record the plugin behind the view id
    // so navigation to it can show a helpful "plugin required" screen.
    viewRouter.registerPluginViewRequirement(descriptor.viewId, descriptor.pluginId, descriptor.label);

    const existing = loadedViews.get(descriptor.viewId);
    if (existing && existing.pluginVersion === descriptor.pluginVersion) continue;

    const LoadedViewClass = await importPluginViewClass(descriptor);
    if (!LoadedViewClass) continue;

    viewRouter.registerView(descriptor.viewId, LoadedViewClass);
    loadedViews.set(descriptor.viewId, descriptor);
    if (!existing) added.push(descriptor.viewId);
    console.log(
      `[PluginViewLoader] Registered plugin view '${descriptor.viewId}' from ${descriptor.pluginId}@${descriptor.pluginVersion}`
    );
  }

  // Unregister views whose providing plugin is no longer active.
  const activeViewIds = new Set(descriptors.map((d) => d.viewId));
  const removed: string[] = [];
  for (const viewId of Array.from(loadedViews.keys())) {
    if (activeViewIds.has(viewId)) continue;
    viewRouter.unregisterView(viewId);
    loadedViews.delete(viewId);
    removed.push(viewId);
    console.log(`[PluginViewLoader] Unregistered plugin view '${viewId}' (plugin inactive/uninstalled)`);
  }

  return {
    views: descriptors.filter((d) => loadedViews.has(d.viewId)),
    added,
    removed,
  };
}

/** View ids currently registered from plugin bundles. */
export function getLoadedPluginViewIds(): string[] {
  return Array.from(loadedViews.keys());
}
