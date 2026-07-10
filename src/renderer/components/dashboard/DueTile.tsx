/**
 * DueTile
 * A kanban card with a due date, rendered as its own prominent tile rather
 * than folded into a plain list row. ADHD design constraint from issue
 * #214: anything with a due date must be a visible tile, not buried --
 * overdue = --status-error border+label, due today = --status-warning.
 */

import * as React from 'react';
import type { KanbanCard } from './types.js';
import { isOverdue, isDueToday, PRIORITY_LABELS } from './types.js';

export interface DueTileProps {
  card: KanbanCard;
  onClick: () => void;
}

function formatDueDate(dueAt: string): string {
  const date = new Date(dueAt);
  if (isNaN(date.getTime())) return dueAt;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const DueTile: React.FC<DueTileProps> = ({ card, onClick }) => {
  const overdue = isOverdue(card.due_at);
  const dueToday = !overdue && isDueToday(card.due_at);

  const accent = overdue ? 'var(--status-error)' : dueToday ? 'var(--status-warning)' : 'var(--color-border)';
  const dueLabel = overdue ? 'Overdue' : dueToday ? 'Due today' : card.due_at ? `Due ${formatDueDate(card.due_at)}` : '';

  const tileStyle: React.CSSProperties = {
    background: 'var(--color-bg-tertiary)',
    border: `1px solid ${accent}`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: '6px',
    padding: '8px 10px',
    marginBottom: '6px',
    cursor: 'pointer',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--color-text-primary)',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const metaRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '11px',
  };

  const dueLabelStyle: React.CSSProperties = {
    color: accent,
    fontWeight: 600,
  };

  const priorityStyle: React.CSSProperties = {
    color: 'var(--color-text-tertiary)',
  };

  return (
    <div
      style={tileStyle}
      className="dashboard-due-tile"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={card.title}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div style={titleStyle}>{card.title}</div>
      <div style={metaRowStyle}>
        <span style={dueLabelStyle}>{dueLabel}</span>
        {card.priority && (
          <span style={priorityStyle}>{PRIORITY_LABELS[card.priority] || card.priority}</span>
        )}
      </div>
    </div>
  );
};

export default DueTile;
