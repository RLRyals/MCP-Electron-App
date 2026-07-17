/**
 * SystemStrip
 * The demoted, one-row system health strip (issue #214 section 4). Collapses
 * the old per-service cards into compact health dots, keeps Start/Stop/
 * Restart System as a single button group (reusing the same mcpSystem IPC
 * dashboard-handlers.ts used to call), and hosts the "⚙ Setup actions"
 * overflow menu. Always renders regardless of plugin state -- it has no
 * plugin dependency.
 *
 * Refresh model (design supplement item 6): 15s poll backstop via
 * mcpSystem.getDetailedStatus(), plus an immediate refetch on the
 * 'dashboard-refresh' event (DashboardView's top-bar Refresh action) and
 * right after any start/stop/restart completes.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { showNotification } from '../../dashboard-handlers.js';
import { SetupActionsMenu } from './SetupActionsMenu.js';

interface DetailedServiceStatus {
  serviceName: string;
  containerName: string;
  status: 'starting' | 'running' | 'healthy' | 'unhealthy' | 'stopped' | 'missing';
  health: 'healthy' | 'unhealthy' | 'starting' | 'none' | 'unknown';
  url?: string;
  port?: number;
  message: string;
}

interface DetailedSystemStatus {
  overall: { running: boolean; healthy: boolean; ready: boolean; message: string };
  services: DetailedServiceStatus[];
  timestamp: Date;
}

interface MCPSystemProgress {
  message: string;
  percent: number;
  step: string;
  status: 'starting' | 'checking' | 'ready' | 'error';
}

type SystemAction = 'start' | 'stop' | 'restart';

const POLL_INTERVAL_MS = 15000;

const ACTION_PAST_TENSE: Record<SystemAction, string> = {
  start: 'started',
  stop: 'stopped',
  restart: 'restarted',
};

const ACTION_LABEL: Record<SystemAction, string> = {
  start: 'Start System',
  stop: 'Stop System',
  restart: 'Restart System',
};

const ACTION_IN_PROGRESS_LABEL: Record<SystemAction, string> = {
  start: 'Starting…',
  stop: 'Stopping…',
  restart: 'Restarting…',
};

function dotColor(status: DetailedServiceStatus['status']): string {
  switch (status) {
    case 'healthy':
      return 'var(--status-success)';
    case 'running':
      return 'var(--status-running)';
    case 'starting':
      return 'var(--status-warning)';
    case 'unhealthy':
      return 'var(--status-error)';
    case 'stopped':
    case 'missing':
    default:
      return 'var(--status-neutral)';
  }
}

export interface AggregateStatus {
  status: 'healthy' | 'warning' | 'error';
  text: string;
}

/**
 * Derive the TopBar's aggregate health text/color from the same `overall`
 * summary the health dots already use (bead mea-lj0). Exported for direct
 * unit coverage of the derivation rule, independent of the fetch/render
 * plumbing around it.
 */
export function deriveAggregateStatus(overall: DetailedSystemStatus['overall'] | undefined): AggregateStatus {
  if (!overall) {
    return { status: 'error', text: 'Status Unknown' };
  }
  if (overall.healthy) {
    return { status: 'healthy', text: 'All Systems Operational' };
  }
  if (overall.running) {
    return { status: 'warning', text: overall.message || 'System Degraded' };
  }
  return { status: 'error', text: overall.message || 'System Offline' };
}

/**
 * Push the derived aggregate to the TopBar's environment indicator (bead
 * mea-lj0). The indicator used to read its status from `#dashboard-status-
 * text` / `#dashboard-status-indicator` DOM elements that issue #214's
 * cockpit redesign deleted along with the old Dashboard markup -- nothing
 * has driven it since, so it was permanently stuck on its "Status Unknown"
 * default regardless of real health. SystemStrip is the strip that already
 * owns the live health fetch, so it's the natural (and only, today) source
 * to drive it from, via the same `window.topBar` global renderer.ts exposes
 * (mirrors the guarded-call convention WorkflowsViewReact.tsx already uses
 * for topBar.refreshProjectSelector()).
 */
function notifyTopBarOfStatus(overall: DetailedSystemStatus['overall'] | undefined): void {
  const topBar = (window as any).topBar;
  if (!topBar || typeof topBar.updateEnvironmentStatus !== 'function') return;
  const aggregate = deriveAggregateStatus(overall);
  topBar.updateEnvironmentStatus(aggregate.status, aggregate.text);
}

/**
 * There's no dedicated "Docker daemon" IPC channel exposed to the renderer
 * (checkDockerRunning() in src/main/prerequisites.ts is main-process-only --
 * verified by grep, 2026-07-10). The design supplement's ASCII layout shows
 * a 4th "Docker" dot alongside the three real services; this derives it
 * from the same `overall` summary getDetailedServiceStatus() already
 * computes (itself built from the same container/health data as the
 * per-service dots) rather than inventing a new IPC call.
 */
function overallDotColor(overall: DetailedSystemStatus['overall'] | undefined): string {
  if (!overall) return 'var(--status-neutral)';
  if (overall.healthy) return 'var(--status-success)';
  if (overall.running) return 'var(--status-warning)';
  return 'var(--status-neutral)';
}

export const SystemStrip: React.FC = () => {
  const [detailed, setDetailed] = useState<DetailedSystemStatus | null>(null);
  const [actionInProgress, setActionInProgress] = useState<SystemAction | null>(null);
  const [progressText, setProgressText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const actionInProgressRef = useRef<SystemAction | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI?.mcpSystem?.getDetailedStatus) return;
      const result: DetailedSystemStatus = await electronAPI.mcpSystem.getDetailedStatus();
      setDetailed(result);
      setLastChecked(new Date());
      notifyTopBarOfStatus(result?.overall);
    } catch (error) {
      console.error('[SystemStrip] Failed to fetch detailed status:', error);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const pollInterval = setInterval(fetchStatus, POLL_INTERVAL_MS);
    // The Refresh top-bar action (DashboardView's handleAction('refresh'))
    // dispatches this event. Unlike the silent poll above, a manual refresh
    // needs VISIBLE feedback (bead mea-lj0) -- the health dots update either
    // way, but with nothing already unhealthy, that update is invisible, so
    // clicking Refresh looked like it did nothing.
    const handleRefresh = async () => {
      setIsRefreshing(true);
      try {
        await fetchStatus();
      } finally {
        setIsRefreshing(false);
      }
    };
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('dashboard-refresh', handleRefresh);
    };
  }, [fetchStatus]);

  const runAction = useCallback(async (action: SystemAction) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.mcpSystem) return;

    actionInProgressRef.current = action;
    setActionInProgress(action);
    setProgressText(ACTION_IN_PROGRESS_LABEL[action]);

    const onProgress = (progress: MCPSystemProgress) => {
      if (actionInProgressRef.current === action) {
        setProgressText(progress.message);
      }
    };
    electronAPI.mcpSystem.onProgress(onProgress);

    try {
      const result = await electronAPI.mcpSystem[action]();
      if (result?.success) {
        showNotification(`MCP system ${ACTION_PAST_TENSE[action]} successfully!`, 'success');
      } else {
        showNotification(`Failed to ${action} system: ${result?.error || result?.message}`, 'error');
      }
      await fetchStatus();
    } catch (error) {
      console.error(`[SystemStrip] Failed to ${action} system:`, error);
      showNotification(`Failed to ${action} system`, 'error');
    } finally {
      electronAPI.mcpSystem.removeProgressListener();
      actionInProgressRef.current = null;
      setActionInProgress(null);
      setProgressText('');
    }
  }, [fetchStatus]);

  const goToServices = () => {
    (window as any).__viewRouter__?.navigateTo?.('settings-services');
  };

  const stripStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '8px 16px',
    minHeight: '40px',
    background: 'var(--color-bg-secondary)',
    borderBottom: '1px solid var(--color-border)',
  };

  const dotsContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    cursor: 'pointer',
    flexWrap: 'wrap',
  };

  const dotItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
  };

  const dotStyle = (color: string): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  });

  const actionsContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid var(--color-border)',
  };

  const actionButtonStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-primary)',
    border: 'none',
    borderRight: '1px solid var(--color-border)',
    opacity: disabled ? 0.5 : 1,
  });

  const progressTextStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
  };

  // Manual-refresh feedback (bead mea-lj0): "Checking…" while in flight,
  // then a last-checked timestamp -- takes priority over nothing so the
  // Refresh button visibly does something even when no dot changes color.
  // Falls back to any Start/Stop/Restart progress text when one is running.
  const statusLineText = progressText
    ? progressText
    : isRefreshing
    ? 'Checking…'
    : lastChecked
    ? `Checked ${lastChecked.toLocaleTimeString()}`
    : '';

  const services = detailed?.services || [];
  // "Writing Srv" / "Connector" per the design supplement's ASCII layout --
  // getDetailedServiceStatus() names them "MCP Writing Servers" / "MCP Connector".
  const shortName = (serviceName: string): string => {
    if (serviceName.includes('Writing')) return 'Writing Srv';
    if (serviceName.includes('Connector')) return 'Connector';
    if (serviceName.includes('PostgreSQL')) return 'Postgres';
    return serviceName;
  };

  return (
    <div style={stripStyle} className="dashboard-system-strip">
      <div style={dotsContainerStyle} onClick={goToServices} title="Go to Settings > Services">
        {services.map((service) => (
          <span key={service.serviceName} style={dotItemStyle}>
            <span style={dotStyle(dotColor(service.status))} />
            {shortName(service.serviceName)}
          </span>
        ))}
        <span style={dotItemStyle}>
          <span style={dotStyle(overallDotColor(detailed?.overall))} />
          Docker
        </span>
      </div>

      <div style={actionsContainerStyle}>
        {statusLineText && (
          <span style={progressTextStyle} aria-live="polite">
            {statusLineText}
          </span>
        )}
        <div style={buttonGroupStyle} role="group" aria-label="System controls">
          {(['start', 'stop', 'restart'] as SystemAction[]).map((action) => (
            <button
              key={action}
              type="button"
              style={actionButtonStyle(actionInProgress !== null)}
              disabled={actionInProgress !== null}
              onClick={() => runAction(action)}
            >
              {actionInProgress === action ? ACTION_IN_PROGRESS_LABEL[action] : ACTION_LABEL[action]}
            </button>
          ))}
        </div>
        <SetupActionsMenu />
      </div>
    </div>
  );
};

export default SystemStrip;
