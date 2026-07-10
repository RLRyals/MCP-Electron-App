/**
 * Render tests for BlockedPanel (issue #214): populated (blocked kanban
 * card + failed workflow run, each captioned with what it's waiting on),
 * empty, and plugin-missing states.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { BlockedPanel } from '../BlockedPanel';
import type { ActiveWorkflowInstance } from '../../../../types/workflow';
import type { KanbanCard } from '../types';

const noop = () => {};

function makeFailedWorkflow(overrides: Partial<ActiveWorkflowInstance> = {}): ActiveWorkflowInstance {
  return {
    id: 'wf-registry-9',
    workflowId: 'wf-def-9',
    workflowName: 'Cover Generation Pipeline',
    source: 'fictionlab_ui',
    projectFolder: '/projects/book-2',
    projectName: 'Book Two',
    currentNodeId: 'node-3',
    currentNodeName: 'Generate Cover',
    status: 'failed',
    progressPercent: 60,
    totalNodes: 5,
    completedNodes: 3,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    availableNodes: [],
    ...overrides,
  };
}

describe('BlockedPanel', () => {
  it('renders blocked/review-required kanban cards with a waiting-on caption and failed workflow runs', () => {
    const cards: KanbanCard[] = [
      { id: 1, title: 'Decide on title', status: 'blocked' },
      { id: 2, title: 'Approve final draft', status: 'review', review_policy: 'review-required' },
    ];

    render(
      <BlockedPanel
        kanbanCards={cards}
        failedWorkflows={[makeFailedWorkflow()]}
        kanbanPluginActive
        workflowPluginActive
        loading={false}
        onCardClick={noop}
        onWorkflowClick={noop}
      />
    );

    expect(screen.getByText('Decide on title')).toBeInTheDocument();
    expect(screen.getByText('Blocked — needs a decision')).toBeInTheDocument();
    expect(screen.getByText('Approve final draft')).toBeInTheDocument();
    expect(screen.getByText('In review — needs approval')).toBeInTheDocument();
    expect(screen.getByText('Cover Generation Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Workflow failed — needs attention')).toBeInTheDocument();
  });

  it('shows the "nothing blocked" empty state when both sources are active and clear', () => {
    render(
      <BlockedPanel
        kanbanCards={[]}
        failedWorkflows={[]}
        kanbanPluginActive
        workflowPluginActive
        loading={false}
        onCardClick={noop}
        onWorkflowClick={noop}
      />
    );

    expect(screen.getByText('Nothing blocked 🎉')).toBeInTheDocument();
  });

  it('shows plugin-missing placeholders when both plugins are inactive', () => {
    render(
      <BlockedPanel
        kanbanCards={[]}
        failedWorkflows={[]}
        kanbanPluginActive={false}
        workflowPluginActive={false}
        loading={false}
        onCardClick={noop}
        onWorkflowClick={noop}
      />
    );

    expect(screen.getByText(/Enable the kanban plugin/)).toBeInTheDocument();
    expect(screen.getByText(/Enable the fictionlab-workflow plugin/)).toBeInTheDocument();
    expect(screen.queryByText('Nothing blocked 🎉')).not.toBeInTheDocument();
  });
});
