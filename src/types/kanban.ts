/**
 * Kanban board types (S11)
 *
 * Mirrors the response shapes of the `kanban` MCP server's tools exactly
 * (see MCP-Writing-Servers `src/mcps/kanban-server/handlers/*.js`) --
 * snake_case, matching the raw Postgres rows the handlers RETURNING * /
 * SELECT * through unmodified (unlike the workflow-manager client, kanban
 * does not remap to camelCase).
 */

export const CARD_STATUSES = [
  'backlog',
  'ready',
  'claimed',
  'in_progress',
  'review',
  'blocked',
  'done',
  'archived',
] as const;
export type KanbanCardStatus = (typeof CARD_STATUSES)[number];

export type KanbanPriority = 'low' | 'normal' | 'high' | 'urgent';
export type KanbanReviewPolicy = 'auto-done' | 'review-required';
export type KanbanLinkType = 'spec' | 'github_issue' | 'workflow_run' | 'file' | 'url' | 'card';

export interface KanbanBoard {
  id: string;
  board_key: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  metadata: Record<string, any>;
}

export interface KanbanColumn {
  id: string;
  board_id: string;
  status_key: KanbanCardStatus;
  name: string;
  position: number;
  color: string | null;
  wip_limit: number | null;
  is_agent_pickup: boolean;
  created_at: string;
  card_count?: number;
}

export interface KanbanCard {
  id: string;
  board_id: string;
  title: string;
  body: string | null;
  status: KanbanCardStatus;
  assignee: string | null;
  agent_claimable: boolean;
  priority: KanbanPriority;
  labels: string[];
  position: number;
  claimed_by: string | null;
  claimed_at: string | null;
  workflow_registry_id: string | null;
  spec_ref: string | null;
  issue_ref: string | null;
  review_policy: KanbanReviewPolicy;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  metadata: Record<string, any>;
  comment_count: number;
  link_count: number;
  // Present only when include_workflow_phase / get_card joins active_workflows
  workflow_phase?: string | null;
  workflow_progress_percent?: number | null;
  workflow_status?: string | null;
  workflow_current_node_name?: string | null;
}

export interface KanbanComment {
  id: string;
  card_id: string;
  author: string;
  body: string;
  created_at: string;
  metadata: Record<string, any>;
}

export interface KanbanCardLink {
  id: string;
  card_id: string;
  link_type: KanbanLinkType;
  ref: string;
  label: string | null;
  created_at: string;
}

export interface KanbanActivity {
  id: number;
  board_id: string | null;
  card_id: string | null;
  actor: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  detail: Record<string, any>;
  created_at: string;
}

export interface KanbanCardDetail {
  card: KanbanCard;
  comments: KanbanComment[];
  links: KanbanCardLink[];
  activity: KanbanActivity[];
}

export interface KanbanClaimResult {
  claimed: boolean;
  card?: KanbanCard;
  reason?: 'not_found' | 'reserved_for_human' | 'already_claimed' | 'wrong_status';
}

/** Payload broadcast on the `kanban:card-updated` channel (main -> renderer). */
export interface KanbanUpdate {
  cardId: string | null;
  source: 'ipc' | 'listen';
  timestamp: string;
}

export const DUE_FILTER_OPTIONS = ['overdue', 'upcoming'] as const;
export type KanbanDueFilter = (typeof DUE_FILTER_OPTIONS)[number];

export type KanbanAssigneeFilter = 'mine' | 'all' | 'unassigned' | string;

export const STATUS_LABELS: Record<KanbanCardStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready to work',
  claimed: 'Claimed',
  in_progress: 'In progress',
  review: 'In review',
  blocked: 'Blocked / decision',
  done: 'Done',
  archived: 'Archived',
};

export const PRIORITY_COLORS: Record<KanbanPriority, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  normal: '#3b82f6',
  low: '#6b7280',
};

/**
 * Identities (companion MCP-Writing-Servers issue #62's `list_identities` /
 * `upsert_identity` tools, same kanban server). The renderer feature-detects
 * this tool -- when the board's `list-identities` channel resolves, the
 * assignee picker becomes a dropdown grouped by `kind` and cards show a kind
 * chip; when it isn't available yet (tool not deployed), the renderer falls
 * back to free-text assignee entry and no chip is shown.
 */
export type IdentityKind = 'human' | 'persona' | 'agent';

export interface KanbanIdentity {
  id: string;
  display_name: string;
  kind: IdentityKind;
  active?: boolean;
}
