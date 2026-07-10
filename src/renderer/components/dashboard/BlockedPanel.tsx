/**
 * BlockedPanel ("what needs a human decision")
 * Kanban blocked cards + review cards with review_policy === 'review-required',
 * plus failed workflow runs. This is the "what do you need from me" list --
 * every entry says what it's waiting on and deep-links into the Board view
 * (v1 scope: navigateTo('kanban') only, per the design supplement -- no
 * plugin-side card-drawer opening in this PR).
 */

import * as React from 'react';
import type { ActiveWorkflowInstance } from '../../../types/workflow.js';
import { KanbanCardRow } from './KanbanCardRow.js';
import { PluginPlaceholder } from './PluginPlaceholder.js';
import type { KanbanCard } from './types.js';

export interface BlockedPanelProps {
  /** Already filtered to status === 'blocked' OR (status === 'review' AND review_policy === 'review-required'). */
  kanbanCards: KanbanCard[];
  /** Already filtered to status === 'failed'. */
  failedWorkflows: ActiveWorkflowInstance[];
  kanbanPluginActive: boolean;
  workflowPluginActive: boolean;
  loading: boolean;
  onCardClick: (card: KanbanCard) => void;
  onWorkflowClick: (workflow: ActiveWorkflowInstance) => void;
}

function waitingOnLabel(card: KanbanCard): string {
  if (card.status === 'blocked') return 'Blocked — needs a decision';
  if (card.status === 'review') return 'In review — needs approval';
  return 'Needs attention';
}

export const BlockedPanel: React.FC<BlockedPanelProps> = ({
  kanbanCards,
  failedWorkflows,
  kanbanPluginActive,
  workflowPluginActive,
  loading,
  onCardClick,
  onWorkflowClick,
}) => {
  // Same "don't claim empty when every source is gated off" rule as
  // RunningPanel -- see its comment.
  const anyActive = kanbanPluginActive || workflowPluginActive;
  const isEmpty =
    !loading &&
    anyActive &&
    (!kanbanPluginActive || kanbanCards.length === 0) &&
    (!workflowPluginActive || failedWorkflows.length === 0);

  const emptyStyle: React.CSSProperties = {
    padding: '16px 4px',
    fontSize: '12px',
    color: 'var(--color-text-tertiary)',
    textAlign: 'center',
  };

  const failedRowStyle: React.CSSProperties = {
    background: 'var(--color-bg-tertiary)',
    border: '1px solid var(--status-error)',
    borderLeft: '3px solid var(--status-error)',
    borderRadius: '6px',
    padding: '8px 10px',
    marginBottom: '6px',
    cursor: 'pointer',
  };

  const failedTitleStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--color-text-primary)',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const failedMetaStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--status-error)',
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

      {workflowPluginActive ? (
        failedWorkflows.map((workflow) => (
          <div
            key={workflow.id}
            style={failedRowStyle}
            onClick={() => onWorkflowClick(workflow)}
            role="button"
            tabIndex={0}
            title={workflow.workflowName}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onWorkflowClick(workflow);
              }
            }}
          >
            <div style={failedTitleStyle}>{workflow.workflowName}</div>
            <div style={failedMetaStyle}>Workflow failed — needs attention</div>
            {/* TODO: no workflow retry/restart-run IPC exists yet (checked
                workflow-handlers.ts: only pause/resume/cancel/jump-to-node).
                Add a Retry button here once one ships -- do not invent one
                in this PR (issue #214 hard constraint). */}
          </div>
        ))
      ) : (
        <PluginPlaceholder label="Enable the fictionlab-workflow plugin to see failed workflow runs." />
      )}

      {isEmpty && <div style={emptyStyle}>Nothing blocked 🎉</div>}
    </div>
  );
};

export default BlockedPanel;
