/**
 * RunningPanel ("what's running now")
 * Composes ActiveWorkflowCard (reused, not reinvented -- issue #214 hard
 * constraint) for live workflow runs with in_progress/claimed kanban cards.
 * A kanban card whose workflow_registry_id matches an already-shown run is
 * suppressed (dedupe rule) so the same piece of work never appears twice.
 */

import * as React from 'react';
import type { ActiveWorkflowInstance } from '../../../types/workflow.js';
import { ActiveWorkflowCard } from '../ActiveWorkflowCard.js';
import { KanbanCardRow } from './KanbanCardRow.js';
import { PluginPlaceholder } from './PluginPlaceholder.js';
import type { KanbanCard } from './types.js';

export interface RunningPanelProps {
  /** Already filtered to status running/paused. */
  workflows: ActiveWorkflowInstance[];
  /** Already filtered to status in_progress/claimed AND deduped against `workflows`. */
  kanbanCards: KanbanCard[];
  workflowPluginActive: boolean;
  kanbanPluginActive: boolean;
  loading: boolean;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onCardClick: (card: KanbanCard) => void;
}

export const RunningPanel: React.FC<RunningPanelProps> = ({
  workflows,
  kanbanCards,
  workflowPluginActive,
  kanbanPluginActive,
  loading,
  onPause,
  onResume,
  onCancel,
  onCardClick,
}) => {
  // Only claim "Nothing running" once at least one data source is actually
  // active and confirmed empty -- when every source is plugin-gated off,
  // the placeholders already explain the empty panel; showing "Nothing
  // running" on top of them would be misleading (nothing was checked).
  const anyActive = workflowPluginActive || kanbanPluginActive;
  const isEmpty =
    !loading &&
    anyActive &&
    (!workflowPluginActive || workflows.length === 0) &&
    (!kanbanPluginActive || kanbanCards.length === 0);

  const emptyStyle: React.CSSProperties = {
    padding: '16px 4px',
    fontSize: '12px',
    color: 'var(--color-text-tertiary)',
    textAlign: 'center',
  };

  return (
    <div className="dashboard-panel dashboard-panel-running">
      {workflowPluginActive ? (
        workflows.map((workflow) => (
          <ActiveWorkflowCard
            key={workflow.id}
            workflow={workflow}
            onPause={onPause}
            onResume={onResume}
            onCancel={onCancel}
          />
        ))
      ) : (
        <PluginPlaceholder label="Enable the fictionlab-workflow plugin to see running workflows." />
      )}

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
