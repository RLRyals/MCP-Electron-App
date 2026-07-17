/**
 * DashboardViewReact
 * The Dashboard cockpit (issue #214): Running / Next / Blocked panels + a
 * system health strip, replacing the old infra-control-panel Dashboard
 * (status bar, quick actions grid, database management, hardcoded service
 * cards, an unfed Recent Activity list).
 *
 * Follows the WorkflowsViewReact host-bundled React view idiom, but data
 * fetching for workflows + kanban cards is centralized here (rather than
 * duplicated per panel) because the dedupe rule (a kanban card is
 * suppressed if its workflow_registry_id matches an already-shown run)
 * needs both lists computed together, and Running/Blocked both need
 * different slices of the *same* workflow list.
 *
 * Plugin containment: this file lives in the host and aggregates host +
 * plugin data purely over IPC (`plugin:fictionlab-kanban:*` channels via
 * electronAPI.invoke/on) -- it never imports plugin code.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ActiveWorkflowInstance, WorkflowUpdate } from '../../types/workflow.js';
import { RunningPanel } from '../components/dashboard/RunningPanel.js';
import { NextPanel } from '../components/dashboard/NextPanel.js';
import { BlockedPanel } from '../components/dashboard/BlockedPanel.js';
import { SystemStrip } from '../components/dashboard/SystemStrip.js';
import { NoPluginsEmptyState } from '../components/dashboard/NoPluginsEmptyState.js';
import { DashboardWidgetSlot } from '../components/dashboard/DashboardWidgetSlot.js';
import {
  KANBAN_PLUGIN_ID,
  WORKFLOW_PLUGIN_ID,
  DEFAULT_BOARD_KEY,
  isPluginActive,
} from '../components/dashboard/types.js';
import type { KanbanCard } from '../components/dashboard/types.js';
import { loadActiveDashboardWidgets } from '../services/dashboardWidgetLoader.js';
import type { LoadedDashboardWidget } from '../services/dashboardWidgetLoader.js';

const KANBAN_PLUGIN_PREFIX = `plugin:${KANBAN_PLUGIN_ID}:`;

// Workflow list poll interval. Design supplement item 6 only mandates a 15s
// poll backstop for the strip, but WorkflowManagerPanel.tsx already
// established (and documented, see its loadActiveWorkflows() effect) that
// workflow:instance-updated alone isn't enough: a workflow driven by an
// external Claude Code session never goes through the IPC handlers that
// call broadcastWorkflowUpdate(), so the push channel never fires for it
// (see also WorkflowsViewReact.tsx's identical poll-fallback comment,
// issue #178). Reusing that exact 5s poll here for the same IPC channel
// avoids reintroducing that already-fixed-elsewhere bug in the cockpit.
const WORKFLOW_POLL_INTERVAL_MS = 5000;

const WIDE_LAYOUT_QUERY = '(min-width: 1100px)';

export const DashboardApp: React.FC = () => {
  const [workflows, setWorkflows] = useState<ActiveWorkflowInstance[]>([]);
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>([]);
  const [workflowPluginActive, setWorkflowPluginActive] = useState(false);
  const [kanbanPluginActive, setKanbanPluginActive] = useState(false);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [kanbanLoading, setKanbanLoading] = useState(true);
  // null = not yet checked (default to the "plugins installed" layout until
  // resolved, so nothing flashes empty on first paint).
  const [installedPluginCount, setInstalledPluginCount] = useState<number | null>(null);
  const [dashboardWidgets, setDashboardWidgets] = useState<LoadedDashboardWidget[]>([]);
  const [isWide, setIsWide] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_LAYOUT_QUERY).matches : true
  );

  const workflowPluginActiveRef = useRef(workflowPluginActive);
  const kanbanPluginActiveRef = useRef(kanbanPluginActive);
  workflowPluginActiveRef.current = workflowPluginActive;
  kanbanPluginActiveRef.current = kanbanPluginActive;

  // ---- Plugin gating -------------------------------------------------
  const checkPlugins = useCallback(async () => {
    const [wfActive, kbActive] = await Promise.all([
      isPluginActive(WORKFLOW_PLUGIN_ID),
      isPluginActive(KANBAN_PLUGIN_ID),
    ]);
    setWorkflowPluginActive(wfActive);
    setKanbanPluginActive(kbActive);
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

  // ---- Workflow list (RUNNING + BLOCKED-failed) -----------------------
  const loadWorkflows = useCallback(async () => {
    if (!workflowPluginActiveRef.current) return;
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI?.invoke) return;
      const result = await electronAPI.invoke('workflow:list-active');
      if (Array.isArray(result)) {
        setWorkflows(result);
      }
    } catch (error) {
      console.error('[DashboardApp] Failed to load active workflows:', error);
    } finally {
      setWorkflowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!workflowPluginActive) {
      setWorkflows([]);
      setWorkflowsLoading(false);
      return;
    }

    setWorkflowsLoading(true);
    loadWorkflows();

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.on || !electronAPI?.off) return;

    const handleUpdate = (_update: WorkflowUpdate) => loadWorkflows();
    electronAPI.on('workflow:instance-updated', handleUpdate);

    const pollInterval = setInterval(loadWorkflows, WORKFLOW_POLL_INTERVAL_MS);
    const handleDashboardRefresh = () => loadWorkflows();
    window.addEventListener('dashboard-refresh', handleDashboardRefresh);

    return () => {
      electronAPI.off('workflow:instance-updated', handleUpdate);
      clearInterval(pollInterval);
      window.removeEventListener('dashboard-refresh', handleDashboardRefresh);
    };
  }, [workflowPluginActive, loadWorkflows]);

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
  const runningWorkflows = useMemo(
    () => workflows.filter((w) => w.status === 'running' || w.status === 'paused'),
    [workflows]
  );
  const failedWorkflows = useMemo(() => workflows.filter((w) => w.status === 'failed'), [workflows]);

  // Dedupe rule: a kanban card whose workflow_registry_id matches an
  // already-shown running/paused workflow is suppressed from the Running
  // panel's card list -- the ActiveWorkflowCard already represents it.
  const runningRegistryIds = useMemo(
    () => new Set(runningWorkflows.map((w) => w.id)),
    [runningWorkflows]
  );

  const runningKanbanCards = useMemo(
    () =>
      kanbanCards.filter(
        (c) =>
          (c.status === 'in_progress' || c.status === 'claimed') &&
          !(c.workflow_registry_id && runningRegistryIds.has(c.workflow_registry_id))
      ),
    [kanbanCards, runningRegistryIds]
  );

  const nextKanbanCards = useMemo(() => kanbanCards.filter((c) => c.status === 'ready'), [kanbanCards]);

  const blockedKanbanCards = useMemo(
    () =>
      kanbanCards.filter(
        (c) => c.status === 'blocked' || (c.status === 'review' && c.review_policy === 'review-required')
      ),
    [kanbanCards]
  );

  const blockedHasItems =
    (kanbanPluginActive && blockedKanbanCards.length > 0) || (workflowPluginActive && failedWorkflows.length > 0);

  // ---- Actions -----------------------------------------------------------
  const invokeWorkflowAction = useCallback(
    async (channel: string, registryId: string) => {
      try {
        const electronAPI = (window as any).electronAPI;
        await electronAPI.invoke(channel, registryId);
        loadWorkflows();
      } catch (error) {
        console.error(`[DashboardApp] Failed to invoke ${channel}:`, error);
      }
    },
    [loadWorkflows]
  );

  const handlePause = useCallback((id: string) => invokeWorkflowAction('workflow:pause', id), [invokeWorkflowAction]);
  const handleResume = useCallback((id: string) => invokeWorkflowAction('workflow:resume', id), [invokeWorkflowAction]);
  const handleCancel = useCallback((id: string) => invokeWorkflowAction('workflow:cancel', id), [invokeWorkflowAction]);

  // Card deep-link (bead mea-5bq): navigate to the Board view AND tell it
  // which card to open. The card id crosses the app->plugin boundary via
  // ViewRouter's existing `navigateTo(viewId, params)` -> `view.mount(container,
  // params)` contract; the fictionlab-kanban plugin (>= 1.1.2) reads
  // `params.cardId` in its mount() and opens that card's drawer. Older plugin
  // versions ignore the extra param and just show the board (previous behavior).
  const handleCardClick = useCallback((card: KanbanCard) => {
    (window as any).__viewRouter__?.navigateTo?.('kanban', { cardId: card.id });
  }, []);

  const handleWorkflowClick = useCallback((_workflow: ActiveWorkflowInstance) => {
    (window as any).__viewRouter__?.navigateTo?.('workflows');
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
      <div style={headingStyle}>Running ({runningWorkflows.length + runningKanbanCards.length})</div>
      <RunningPanel
        workflows={runningWorkflows}
        kanbanCards={runningKanbanCards}
        workflowPluginActive={workflowPluginActive}
        kanbanPluginActive={kanbanPluginActive}
        loading={workflowsLoading || kanbanLoading}
        onPause={handlePause}
        onResume={handleResume}
        onCancel={handleCancel}
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
      <div style={headingStyle}>Blocked ({blockedKanbanCards.length + failedWorkflows.length})</div>
      <BlockedPanel
        kanbanCards={blockedKanbanCards}
        failedWorkflows={failedWorkflows}
        kanbanPluginActive={kanbanPluginActive}
        workflowPluginActive={workflowPluginActive}
        loading={workflowsLoading || kanbanLoading}
        onCardClick={handleCardClick}
        onWorkflowClick={handleWorkflowClick}
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
      ) : dashboardWidgets.length > 0 ? (
        <div style={widgetsContainerStyle} className="dashboard-widgets">
          {dashboardWidgets.map((widget) => (
            <DashboardWidgetSlot
              key={`${widget.pluginId}:${widget.widgetId}`}
              WidgetClass={widget.WidgetClass}
              pluginId={widget.pluginId}
            />
          ))}
        </div>
      ) : (
        <div style={panelsContainerStyle} className="dashboard-cockpit-panels">
          {runningColumn}
          {nextColumn}
          {blockedColumn}
        </div>
      )}
    </div>
  );
};

export default DashboardApp;
