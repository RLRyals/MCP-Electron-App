/**
 * Shared types + small helpers for the Dashboard cockpit (issue #214).
 *
 * Containment note: the kanban board (and its data model) lives entirely in
 * the fictionlab-kanban plugin repo, not in this host repo -- there is no
 * `src/types/kanban.ts` here to import (the issue's file map assumed one
 * existed; it doesn't -- verified by grep across src/, 2026-07-10). The
 * cockpit talks to kanban ONLY over `plugin:fictionlab-kanban:*` IPC
 * channels (never importing plugin code, per the containment constraint),
 * so `KanbanCard` below is a minimal shape inferred from issue #214's own
 * spec text (status/due_at/priority/position/review_policy/
 * workflow_registry_id/workflow_phase/workflow_progress_percent) rather than
 * a shape verified against the plugin's actual DB schema. If the plugin's
 * real field names differ, this file is the only place that needs updating.
 */

/** Card lifecycle states the cockpit cares about. Other board statuses
 * (e.g. 'backlog', 'done') exist but never surface in the cockpit panels. */
export type KanbanCardStatus = 'ready' | 'in_progress' | 'claimed' | 'review' | 'blocked' | string;

export type KanbanCardPriority = 'urgent' | 'high' | 'medium' | 'low' | string;

export interface KanbanCard {
  id: string | number;
  title: string;
  status: KanbanCardStatus;
  priority?: KanbanCardPriority | null;
  /** Manual ordering within a column -- used as the tiebreaker after priority. */
  position?: number | null;
  due_at?: string | null;
  /** e.g. 'review-required' -- gates whether a review-column card counts as Blocked. */
  review_policy?: string | null;
  /** Set when a workflow run is attached to this card. */
  workflow_registry_id?: string | null;
  workflow_phase?: string | null;
  workflow_progress_percent?: number | null;
  [key: string]: unknown;
}

/** Higher number sorts first ("priority desc"). Unknown/missing priority sorts last. */
export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function priorityWeight(priority: KanbanCardPriority | null | undefined): number {
  if (!priority) return 0;
  return PRIORITY_ORDER[priority] ?? 0;
}

/** Display labels for the panel headers / DueTile priority chip. */
export const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const KANBAN_PLUGIN_ID = 'fictionlab-kanban';

/**
 * Board scope (design supplement item 5): the cockpit should follow the
 * board switcher's current/default board, using the same localStorage key
 * the kanban plugin's own view reads. That key lives in the plugin repo,
 * which this host cannot read (containment) -- falling back to the
 * documented 'dev-backlog' constant per the design supplement's explicit
 * fallback allowance.
 *
 * TODO: replace with the kanban plugin's real "active board" localStorage
 * key once it's exposed to the host (e.g. via a manifest-declared constant
 * or a `plugin:fictionlab-kanban:board:get-active` IPC channel).
 */
export const DEFAULT_BOARD_KEY = 'dev-backlog';

export interface PluginListEntry {
  id: string;
  status: string;
  manifest?: unknown;
  error?: string;
}

/**
 * Whether a plugin is installed AND active, straight from `plugin:list`
 * (the same source pluginViewLoader.ts uses to decide which renderer
 * bundles to load). Used to gate cockpit panels that depend on
 * plugin-provided IPC, mirroring ViewRouter's page-level plugin gate.
 */
export async function isPluginActive(pluginId: string): Promise<boolean> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.plugins?.list) return false;
  try {
    const plugins: PluginListEntry[] = await electronAPI.plugins.list();
    if (!Array.isArray(plugins)) return false;
    return plugins.some((p) => p.id === pluginId && p.status === 'active');
  } catch (error) {
    console.error('[Dashboard] Failed to check plugin status for', pluginId, error);
    return false;
  }
}

/** Calendar-day comparison (ignores time-of-day) against "now". */
export function isOverdue(dueAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (isNaN(due.getTime())) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due.getTime() < startOfToday.getTime();
}

export function isDueToday(dueAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (isNaN(due.getTime())) return false;
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}
