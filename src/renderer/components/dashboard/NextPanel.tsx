/**
 * NextPanel ("what's queued/ready")
 * Kanban ready-column cards, priority desc then position asc. Any card
 * carrying a due_at is pinned to the top as a DueTile (ADHD design
 * constraint -- due work must be a visible tile, never buried in a plain
 * list) with overdue/today highlighting.
 */

import * as React from 'react';
import { useMemo } from 'react';
import { DueTile } from './DueTile.js';
import { KanbanCardRow } from './KanbanCardRow.js';
import { PluginPlaceholder } from './PluginPlaceholder.js';
import type { KanbanCard } from './types.js';
import { priorityWeight } from './types.js';

export interface NextPanelProps {
  /** Already filtered to the ready column. */
  cards: KanbanCard[];
  pluginActive: boolean;
  loading: boolean;
  onCardClick: (card: KanbanCard) => void;
}

export const NextPanel: React.FC<NextPanelProps> = ({ cards, pluginActive, loading, onCardClick }) => {
  const { dueCards, otherCards } = useMemo(() => {
    const due: KanbanCard[] = [];
    const other: KanbanCard[] = [];
    for (const card of cards) {
      if (card.due_at) due.push(card);
      else other.push(card);
    }
    due.sort((a, b) => new Date(a.due_at as string).getTime() - new Date(b.due_at as string).getTime());
    other.sort((a, b) => {
      const priorityDiff = priorityWeight(b.priority) - priorityWeight(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.position ?? 0) - (b.position ?? 0);
    });
    return { dueCards: due, otherCards: other };
  }, [cards]);

  const emptyStyle: React.CSSProperties = {
    padding: '16px 4px',
    fontSize: '12px',
    color: 'var(--color-text-tertiary)',
    textAlign: 'center',
  };

  if (!pluginActive) {
    return (
      <div className="dashboard-panel dashboard-panel-next">
        <PluginPlaceholder label="Enable the kanban plugin to see queued work items." />
      </div>
    );
  }

  return (
    <div className="dashboard-panel dashboard-panel-next">
      {dueCards.map((card) => (
        <DueTile key={card.id} card={card} onClick={() => onCardClick(card)} />
      ))}
      {otherCards.map((card) => (
        <KanbanCardRow key={card.id} card={card} onClick={() => onCardClick(card)} />
      ))}
      {!loading && cards.length === 0 && <div style={emptyStyle}>Nothing queued</div>}
    </div>
  );
};

export default NextPanel;
