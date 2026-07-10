/**
 * KanbanCardRow
 * Plain-list row for a kanban card inside a cockpit panel (no due date, or
 * a due date already rendered elsewhere as a DueTile). Also carries the
 * optional workflow-phase join fields (workflow_phase/
 * workflow_progress_percent) so a card known to have a workflow attached
 * shows that context even though the running instance itself is
 * represented by ActiveWorkflowCard elsewhere (dedupe rule).
 */

import * as React from 'react';
import type { KanbanCard } from './types.js';
import { PRIORITY_LABELS } from './types.js';

export interface KanbanCardRowProps {
  card: KanbanCard;
  onClick: () => void;
  /** One-line explanation of what this card is waiting on (Blocked panel only). */
  waitingOn?: string;
}

export const KanbanCardRow: React.FC<KanbanCardRowProps> = ({ card, onClick, waitingOn }) => {
  const rowStyle: React.CSSProperties = {
    background: 'var(--color-bg-tertiary)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    padding: '8px 10px',
    marginBottom: '6px',
    cursor: 'pointer',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--color-text-primary)',
    marginBottom: waitingOn || card.workflow_phase ? '4px' : 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const metaStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
  };

  const waitingStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--status-warning)',
  };

  return (
    <div
      style={rowStyle}
      className="dashboard-kanban-row"
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
      {waitingOn && <div style={waitingStyle}>{waitingOn}</div>}
      {card.workflow_phase && (
        <div style={metaStyle}>
          <span>Workflow: {card.workflow_phase}</span>
          {typeof card.workflow_progress_percent === 'number' && (
            <span>{card.workflow_progress_percent}%</span>
          )}
        </div>
      )}
      {!waitingOn && !card.workflow_phase && card.priority && (
        <div style={metaStyle}>
          <span>{PRIORITY_LABELS[card.priority] || card.priority}</span>
        </div>
      )}
    </div>
  );
};

export default KanbanCardRow;
