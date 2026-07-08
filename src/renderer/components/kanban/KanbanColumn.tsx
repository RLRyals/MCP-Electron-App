/**
 * KanbanColumn
 * A single lane: header (name, count, advisory WIP badge), a persistent
 * title-only quick-add input (the low-friction ad-hoc capture requirement,
 * S11 §7 / issue #179 §3), and the lane's card tiles. Also the drop target
 * for drag-to-move.
 */

import * as React from 'react';
import { useState } from 'react';
import type { KanbanCard, KanbanColumn as KanbanColumnType, KanbanIdentity } from '../../../types/kanban.js';
import type { ActiveWorkflowInstance } from '../../../types/workflow.js';
import { KanbanCardTile } from './KanbanCardTile.js';

export interface KanbanColumnProps {
  column: KanbanColumnType;
  cards: KanbanCard[];
  workflowPhases: Map<string, ActiveWorkflowInstance>;
  /** assignee id -> identity kind, for the human/persona/agent chip (issue #181 §4). Empty when list_identities isn't available yet. */
  identityKindById?: Map<string, KanbanIdentity['kind']>;
  onSelectCard: (card: KanbanCard) => void;
  onQuickAdd: (statusKey: string, title: string) => void;
  onDropCard: (cardId: string, statusKey: string) => void;
  quickAddInputRef?: (el: HTMLInputElement | null) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  cards,
  workflowPhases,
  identityKindById,
  onSelectCard,
  onQuickAdd,
  onDropCard,
  quickAddInputRef,
}) => {
  const [quickAddValue, setQuickAddValue] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  const wipExceeded = column.wip_limit != null && cards.length > column.wip_limit;

  const columnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '260px',
    maxWidth: '280px',
    flex: '0 0 auto',
    background: isDragOver ? 'rgba(0, 212, 170, 0.06)' : 'transparent',
    border: isDragOver ? '1px dashed var(--color-accent, #00D4AA)' : '1px solid transparent',
    borderRadius: '10px',
    padding: '8px',
    height: '100%',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
    padding: '0 2px',
  };

  const nameStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: 'var(--color-text-secondary, rgba(255,255,255,0.7))',
  };

  const countStyle: React.CSSProperties = {
    fontSize: '11px',
    color: wipExceeded ? '#ef4444' : 'var(--color-text-tertiary, rgba(255,255,255,0.5))',
    fontWeight: wipExceeded ? 700 : 400,
  };

  const quickAddStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    marginBottom: '8px',
    fontSize: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
    borderRadius: '6px',
    color: 'var(--color-text-primary, rgba(255,255,255,0.9))',
  };

  const listStyle: React.CSSProperties = {
    overflowY: 'auto',
    flex: 1,
    minHeight: '40px',
  };

  const submitQuickAdd = () => {
    const title = quickAddValue.trim();
    if (!title) return;
    onQuickAdd(column.status_key, title);
    setQuickAddValue('');
  };

  return (
    <div
      style={columnStyle}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const cardId = e.dataTransfer.getData('text/plain') || draggingCardId;
        if (cardId) onDropCard(cardId, column.status_key);
      }}
    >
      <div style={headerStyle}>
        <span style={nameStyle}>{column.name}</span>
        <span style={countStyle}>
          {cards.length}
          {column.wip_limit != null ? ` / ${column.wip_limit}` : ''}
        </span>
      </div>

      <input
        ref={quickAddInputRef}
        type="text"
        placeholder="+ Quick add..."
        style={quickAddStyle}
        value={quickAddValue}
        onChange={(e) => setQuickAddValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitQuickAdd();
          }
        }}
      />

      <div style={listStyle}>
        {cards.map((card) => (
          <KanbanCardTile
            key={card.id}
            card={card}
            workflowPhase={card.workflow_registry_id ? workflowPhases.get(card.workflow_registry_id) : null}
            identityKind={card.assignee ? identityKindById?.get(card.assignee) : undefined}
            onSelect={onSelectCard}
            onDragStart={(c) => setDraggingCardId(c.id)}
          />
        ))}
        {cards.length === 0 && (
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary, rgba(255,255,255,0.35))', padding: '8px 2px' }}>
            No cards
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
