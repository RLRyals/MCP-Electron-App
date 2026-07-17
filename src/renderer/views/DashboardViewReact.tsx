/**
 * DashboardViewReact
 * The Dashboard cockpit (issue #214): Running / Next / Blocked panels + a
 * system health strip, replacing the old infra-control-panel Dashboard
 * (status bar, quick actions grid, database management, hardcoded service
 * cards, an unfed Recent Activity list).
 *
 * The panel grid is now kanban-only: running/blocked workflow runs used to
 * be centralized here too (deduped against kanban cards sharing a
 * workflow_registry_id), until the workflow plugin grew its own dashboard
 * widget for that (bead mea-cjl.4, packages/workflow-plugin/src/renderer/
 * dashboard-widget.tsx in fictionlab-workflow). That cross-plugin dedupe
 * has no home anymore -- it needed both lists in one place, and the
 * workflow plugin can't reach into kanban's data without coupling to its
 * IPC contract. A kanban card mirroring a running workflow may now appear
 * in both the kanban panel grid below and the workflow widget above.
 *
 * Plugin containment: this file lives in the host and renders kanban data
 * purely over IPC (`plugin:fictionlab-kanban:*` channels via
 * electronAPI.invoke/on) -- it never imports plugin code. Any
 * plugin-contributed dashboard widgets (workflow's Running/Blocked cards,
 * and future ones) render above this grid rather than replacing it, since
 * kanban's content isn't covered by any widget yet.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RunningPanel } from '../components/dashboard/RunningPanel.js';
import { NextPanel } from '../components/dashboard/NextPanel.js';
import { BlockedPanel } from '../components/dashboard/BlockedPanel.js';
import { SystemStrip } from '../components/dashboard/SystemStrip.js';
import { NoPluginsEmptyState } from '../components/dashboard/NoPluginsEmptyState.js';
import { DashboardWidgetSlot } from '../components/dashboard/DashboardWidgetSlot.js';
import { KANBAN_PLUGIN_ID, DEFAULT_BOARD_KEY, isPluginActive } from '../components/dashboard/types.js';
import type { KanbanCard } from '../components/dashboard/types.js';
import { loadActiveDashboardWidgets } from '../services/dashboardWidgetLoader.js';
import type { LoadedDashboardWidget } from '../services/dashboardWidgetLoader.js';

const KANBAN_PLUGIN_PREFIX = `plugin:${KANBAN_PLUGIN_ID}:`;

const WIDE_LAYOUT_QUERY = '(min-width: 1100px)';

export const DashboardApp: React.FC = () => {
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>([]);
  const [kanbanPluginActive, setKanbanPluginActive] = useState(false);
  const [kanbanLoading, setKanbanLoading] = useState(true);
  // null = not yet checked (default to the "plugins installed" layout until
  // resolved, so nothing flashes empty on first paint).
  const [installedPluginCount, setInstalledPluginCount] = useState<number | null>(null);
  const [dashboardWidgets, setDashboardWidgets] = useState<LoadedDashboardWidget[]>([]);
  const [isWide, setIsWide] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_LAYOUT_QUERY).matches : true
  );

  const kanbanPluginActiveRef = useRef(kanbanPluginActive);
  kanbanPluginActiveRef.current = kanbanPluginActive;

  // ---- Plugin gating -------------------------------------------------
  const checkPlugins = useCallback(async () => {
    setKanbanPluginActive(await isPluginActive(KANBAN_PLUGIN_ID));
  }, []);

  // ---- Widget-slot API (bead mea-cjl.1): pluginless empty state + any
  // plugin-contributed dashboard widgets ---------------------------------
  const checkInstalledPlugins = useCallback(async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.plugins?.list) {
      setInstalledPluginCount(0);
      return;
    }
    try {
      const plugins = await electronAPI.plugins.list();
      setInstalledPluginCount(Array.isArray(plugins) ? plugins.length : 0);
    } catch (error) {
      console.error('[DashboardApp] Failed to list installed plugins:', error);
      setInstalledPluginCount(0);
    }
  }, []);

  const loadWidgets = useCallback(async () => {
    const widgets = await loadActiveDashboardWidgets();
    setDashboardWidgets(widgets);
  }, []);

  useEffect(() => {
    checkPlugins();
    checkInstalledPlugins();
    loadWidgets();
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.on || !electronAPI?.off) return;
    const handlePluginStateChanged = () => {
      checkPlugins();
      checkInstalledPlugins();
      loadWidgets();
    };
    electronAPI.on('plugin-state-changed', handlePluginStateChanged);
    return () => electronAPI.off('plugin-state-changed', handlePluginStateChanged);
  }, [checkPlugins, checkInstalledPlugins, loadWidgets]);

  // ---- Kanban cards (RUNNING in_progress/claimed, NEXT ready, BLOCKED) --
  const loadKanbanCards = useCallback(async () => {
    if (!kanbanPluginActiveRef.current) return;
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI?.invoke) return;
      const result = await electronAPI.invoke(`${KANBAN_PLUGIN_PREFIX}board:list-cards`, {
        board_key: DEFAULT_BOARD_KEY,
        include_workflow_phase: true,
      });
      if (Array.isArray(result)) {
        setKanbanCards(result);
      } else if (Array.isArray(result?.cards)) {
        // Defensive: some list endpoints in this codebase wrap results as
        // { cards: [...] } rather than a bare array (e.g. workflow:list vs
        // workflow:list-active). Handle both shapes since the plugin's
        // exact response envelope can't be verified from the host.
        setKanbanCards(result.cards);
      }
    } catch (error) {
      console.error('[DashboardApp] Failed to load kanban cards:', error);
    } finally {
      setKanbanLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!kanbanPluginActive) {
      setKanbanCards([]);
      setKanbanLoading(false);
      return;
    }

    setKanbanLoading(true);
    loadKanbanCards();

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.on || !electronAPI?.off) return;

    const handleCardUpdated = () => loadKanbanCards();
    electronAPI.on('kanban:card-updated', handleCardUpdated);

    const handleDashboardRefresh = () => loadKanbanCards();
    window.addEventListener('dashboard-refresh', handleDashboardRefresh);

    return () => {
      electronAPI.off('kanban:card-updated', handleCardUpdated);
      window.removeEventListener('dashboard-refresh', handleDashboardRefresh);
    };
  }, [kanbanPluginActive, loadKanbanCards]);

  // ---- Responsive layout ----------------------------------------------
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(WIDE_LAYOUT_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // Safari < 14 / jsdom fallback
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  // ---- Derived slices ---------------------------------------------------
  const runningKanbanCards = useMemo(
    () => kanbanCards.filter((c) => c.status === 'in_progress' || c.status === 'claimed'),
    [kanbanCards]
  );

  const nextKanbanCards = useMemo(() => kanbanCards.filter((c) => c.status === 'ready'), [kanbanCards]);

  const blockedKanbanCards = useMemo(
    () =>
      kanbanCards.filter(
        (c) => c.status === 'blocked' || (c.status === 'review' && c.review_policy === 'review-required')
      ),
    [kanbanCards]
  );

  const blockedHasItems = kanbanPluginActive && blockedKanbanCards.length > 0;

  // ---- Actions -----------------------------------------------------------
  // Card deep-link (bead mea-5bq): navigate to the Board view AND tell it
  // which card to open. The card id crosses the app->plugin boundary via
  // ViewRouter's existing `navigateTo(viewId, params)` -> `view.mount(container,
  // params)` contract; the fictionlab-kanban plugin (>= 1.1.2) reads
  // `params.cardId` in its mount() and opens that card's drawer. Older plugin
  // versions ignore the extra param and just show the board (previous behavior).
  const handleCardClick = useCallback((card: KanbanCard) => {
    (window as any).__viewRouter__?.navigateTo?.('kanban', { cardId: card.id });
  }, []);

  // ---- Layout -------------------------------------------------------------
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--color-bg-primary)',
    overflow: 'auto',
  };

  const panelsContainerStyle: React.CSSProperties = {
    display: isWide ? 'grid' : 'flex',
    gridTemplateColumns: isWide ? 'repeat(3, 1fr)' : undefined,
    flexDirection: isWide ? undefined : 'column',
    gap: '16px',
    padding: '16px',
  };

  const columnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
  };

  const runningColumn = (
    <div style={{ ...columnStyle, order: !isWide ? (blockedHasItems ? 1 : 0) : undefined }} key="running">
      <div style={headingStyle}>Running ({runningKanbanCards.length})</div>
      <RunningPanel
        kanbanCards={runningKanbanCards}
        kanbanPluginActive={kanbanPluginActive}
        loading={kanbanLoading}
        onCardClick={handleCardClick}
      />
    </div>
  );

  const nextColumn = (
    <div style={{ ...columnStyle, order: !isWide ? (blockedHasItems ? 2 : 1) : undefined }} key="next">
      <div style={headingStyle}>Next ({nextKanbanCards.length})</div>
      <NextPanel
        cards={nextKanbanCards}
        pluginActive={kanbanPluginActive}
        loading={kanbanLoading}
        onCardClick={handleCardClick}
      />
    </div>
  );

  const blockedColumn = (
    <div style={{ ...columnStyle, order: !isWide ? (blockedHasItems ? 0 : 2) : undefined }} key="blocked">
      <div style={headingStyle}>Blocked ({blockedKanbanCards.length})</div>
      <BlockedPanel
        kanbanCards={blockedKanbanCards}
        kanbanPluginActive={kanbanPluginActive}
        loading={kanbanLoading}
        onCardClick={handleCardClick}
      />
    </div>
  );

  // No plugins installed at all -> collapse to the health strip + an
  // install-plugins affordance (epic mea-cjl target: pluginless core).
  // installedPluginCount === null means "not checked yet"; default to the
  // panel grid below rather than flashing the empty state.
  const noPluginsInstalled = installedPluginCount === 0;

  const widgetsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px',
  };

  return (
    <div style={containerStyle}>
      <SystemStrip />
      {noPluginsInstalled ? (
        <NoPluginsEmptyState />
      ) : (
        <>
          {dashboardWidgets.length > 0 && (
            <div style={widgetsContainerStyle} className="dashboard-widgets">
              {dashboardWidgets.map((widget) => (
                <DashboardWidgetSlot
                  key={`${widget.pluginId}:${widget.widgetId}`}
                  WidgetClass={widget.WidgetClass}
                  pluginId={widget.pluginId}
                />
              ))}
            </div>
          )}
          <div style={panelsContainerStyle} className="dashboard-cockpit-panels">
            {runningColumn}
            {nextColumn}
            {blockedColumn}
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardApp;
