/**
 * KanbanCardTile
 * The face of a single card inside a board lane -- title, priority/labels,
 * assignee, due-date chip, review_policy badge, and (if linked) a compact
 * live workflow-phase chip. Draggable for lane-to-lane move.
 */

import * as React from 'react';
import type { KanbanCard, KanbanIdentity, KanbanReviewPolicy } from '../../../types/kanban.js';
import { PRIORITY_COLORS } from '../../../types/kanban.js';
import type { ActiveWorkflowInstance } from '../../../types/workflow.js';

export interface KanbanCardTileProps {
  card: KanbanCard;
  workflowPhase?: ActiveWorkflowInstance | null;
  /** The assignee's identity kind (human/persona/agent), when list_identities is available (issue #181 §4). */
  identityKind?: KanbanIdentity['kind'];
  onSelect: (card: KanbanCard) => void;
  onDragStart: (card: KanbanCard) => void;
}

const IDENTITY_KIND_COLORS: Record<KanbanIdentity['kind'], string> = {
  human: '#3b82f6',
  persona: '#a855f7',
  agent: '#10b981',
};

function dueChip(due_at: string | null, status: string): { label: string; color: string } | null {
  if (!due_at) return null;
  if (status === 'done' || status === 'archived') return null;
  const dueDate = new Date(due_at);
  const now = new Date();
  const overdue = dueDate.getTime() < now.getTime();
  const label = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return overdue
    ? { label: `Overdue ${label}`, color: '#ef4444' }
    : { label: `Due ${label}`, color: '#3b82f6' };
}

function reviewBadge(policy: KanbanReviewPolicy): { label: string; color: string } {
  return policy === 'review-required'
    ? { label: 'review-required', color: '#f59e0b' }
    : { label: 'auto-done', color: '#6b7280' };
}

export const KanbanCardTile: React.FC<KanbanCardTileProps> = ({ card, workflowPhase, identityKind, onSelect, onDragStart }) => {
  const due = dueChip(card.due_at, card.status);
  const review = reviewBadge(card.review_policy);

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
    borderRadius: '8px',
    padding: '10px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--color-text-primary, rgba(255, 255, 255, 0.9))',
    marginBottom: '6px',
    wordBreak: 'break-word',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'center',
    marginTop: '6px',
  };

  const chipBase: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '10px',
    color: 'white',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      style={cardStyle}
      className="kanban-card-tile"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', card.id);
        onDragStart(card);
      }}
      onClick={() => onSelect(card)}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent, #00D4AA)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border, rgba(255, 255, 255, 0.1))'; }}
      title={card.title}
    >
      <div style={titleStyle}>{card.title}</div>

      <div style={rowStyle}>
        <span style={{ ...chipBase, background: PRIORITY_COLORS[card.priority] }}>{card.priority}</span>
        <span style={{ ...chipBase, background: review.color }}>{review.label}</span>
        {due && <span style={{ ...chipBase, background: due.color }}>{due.label}</span>}
        {card.labels.map((label) => (
          <span key={label} style={{ ...chipBase, background: '#374151' }}>{label}</span>
        ))}
      </div>

      {workflowPhase && (
        <div style={{ ...rowStyle, alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: workflowPhase.status === 'running' ? '#3b82f6' : '#6b7280',
              animation: workflowPhase.status === 'running' ? 'kanban-pulse 1.5s infinite' : 'none',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary, rgba(255,255,255,0.5))' }}>
            {workflowPhase.currentNodeName || 'Starting...'} ({workflowPhase.progressPercent ?? 0}%)
          </span>
        </div>
      )}

      <div style={{ ...rowStyle, fontSize: '10px', color: 'var(--color-text-tertiary, rgba(255,255,255,0.5))' }}>
        {card.assignee && <span title="Assignee">👤 {card.assignee}</span>}
        {card.assignee && identityKind && (
          <span
            title={`Identity kind: ${identityKind}`}
            style={{ ...chipBase, fontSize: '9px', padding: '1px 5px', background: IDENTITY_KIND_COLORS[identityKind] }}
          >
            {identityKind}
          </span>
        )}
        {card.comment_count > 0 && <span title="Comments">💬 {card.comment_count}</span>}
        {card.link_count > 0 && <span title="Links">🔗 {card.link_count}</span>}
      </div>

      <style>{`
        @keyframes kanban-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default KanbanCardTile;
