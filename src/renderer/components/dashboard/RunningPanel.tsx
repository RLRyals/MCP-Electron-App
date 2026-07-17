/**
 * RunningPanel ("what's running now")
 * In-progress/claimed kanban cards. Running/blocked workflow runs used to
 * appear here too (reusing ActiveWorkflowCard) until the workflow plugin
 * grew its own dashboard widget for that (bead mea-cjl.4) — see
 * DashboardViewReact.tsx for how the widget and this now-kanban-only panel
 * grid render together.
 */

import * as React from 'react';
import { KanbanCardRow } from './KanbanCardRow.js';
import { PluginPlaceholder } from './PluginPlaceholder.js';
import type { KanbanCard } from './types.js';

export interface RunningPanelProps {
  /** Already filtered to status in_progress/claimed. */
  kanbanCards: KanbanCard[];
  kanbanPluginActive: boolean;
  loading: boolean;
  onCardClick: (card: KanbanCard) => void;
}

export const RunningPanel: React.FC<RunningPanelProps> = ({
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
    <div className="dashboard-panel dashboard-panel-running">
      {kanbanPluginActive ? (
        kanbanCards.map((card) => (
          <KanbanCardRow key={card.id} card={card} onClick={() => onCardClick(card)} />
        ))
      ) : (
        <PluginPlaceholder label="Enable the kanban plugin to see in-progress work items." />
      )}

      {isEmpty && <div style={emptyStyle}>Nothing running</div>}
    </div>
  );
};

export default RunningPanel;
