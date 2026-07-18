/**
 * BlockedPanel ("what needs a human decision")
 * Kanban blocked cards + review cards with review_policy === 'review-required'.
 * Failed workflow runs used to appear here too until the workflow plugin
 * grew its own dashboard widget for that (bead mea-cjl.4) — see
 * DashboardViewReact.tsx for how the widget and this now-kanban-only panel
 * grid render together. This is the "what do you need from me" list --
 * every entry says what it's waiting on and deep-links into the Board view
 * (v1 scope: navigateTo('kanban') only, per the design supplement -- no
 * plugin-side card-drawer opening in this PR).
 */

import * as React from 'react';
import { KanbanCardRow } from './KanbanCardRow.js';
import { PluginPlaceholder } from './PluginPlaceholder.js';
import type { KanbanCard } from './types.js';

export interface BlockedPanelProps {
  /** Already filtered to status === 'blocked' OR (status === 'review' AND review_policy === 'review-required'). */
  kanbanCards: KanbanCard[];
  kanbanPluginActive: boolean;
  loading: boolean;
  onCardClick: (card: KanbanCard) => void;
}

function waitingOnLabel(card: KanbanCard): string {
  if (card.status === 'blocked') return 'Blocked — needs a decision';
  if (card.status === 'review') return 'In review — needs approval';
  return 'Needs attention';
}

export const BlockedPanel: React.FC<BlockedPanelProps> = ({
  kanbanCards,
  kanbanPluginActive,
  loading,
  onCardClick,
}) => {
  const isEmpty = !loading && kanbanPluginActive && kanbanCards.length === 0;

  const emptyStyle: React.CSSProperties = {
    padding: '16px 4px',
    fontSize: '12px',
    color: 'var(--color-text-tertiary)',
    textAlign: 'center',
  };

  return (
    <div className="dashboard-panel dashboard-panel-blocked">
      {kanbanPluginActive ? (
        kanbanCards.map((card) => (
          <KanbanCardRow
            key={card.id}
            card={card}
            waitingOn={waitingOnLabel(card)}
            onClick={() => onCardClick(card)}
          />
        ))
      ) : (
        <PluginPlaceholder label="Enable the kanban plugin to see blocked work items." />
      )}

      {isEmpty && <div style={emptyStyle}>Nothing blocked 🎉</div>}
    </div>
  );
};

export default BlockedPanel;
