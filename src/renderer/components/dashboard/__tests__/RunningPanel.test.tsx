/**
 * Render tests for RunningPanel (issue #214): populated, empty, and
 * plugin-missing states for both its workflow half and its kanban half.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { RunningPanel } from '../RunningPanel';
import type { ActiveWorkflowInstance } from '../../../../types/workflow';
import type { KanbanCard } from '../types';

function makeWorkflow(overrides: Partial<ActiveWorkflowInstance> = {}): ActiveWorkflowInstance {
  return {
    id: 'wf-registry-1',
    workflowId: 'wf-def-1',
    workflowName: 'Chapter Drafting Pipeline',
    source: 'claude_code',
    projectFolder: '/projects/book-1',
    projectName: 'Book One',
    currentNodeId: 'node-2',
    currentNodeName: 'Draft Chapter',
    status: 'running',
    progressPercent: 40,
    totalNodes: 5,
    completedNodes: 2,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    availableNodes: [],
    ...overrides,
  };
}

function makeCard(overrides: Partial<KanbanCard> = {}): KanbanCard {
  return {
    id: 'card-1',
    title: 'Write chapter 4',
    status: 'in_progress',
    ...overrides,
  };
}

const noop = () => {};

describe('RunningPanel', () => {
  it('renders an ActiveWorkflowCard per running workflow and a row per non-deduped kanban card', () => {
    render(
      <RunningPanel
        workflows={[makeWorkflow()]}
        kanbanCards={[makeCard({ id: 'card-2', title: 'Fix cover art' })]}
        workflowPluginActive
        kanbanPluginActive
        loading={false}
        onPause={noop}
        onResume={noop}
        onCancel={noop}
        onCardClick={noop}
      />
    );

    expect(screen.getByText('Chapter Drafting Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Fix cover art')).toBeInTheDocument();
  });

  it('shows the empty state when both sources are active but have nothing running', () => {
    render(
      <RunningPanel
        workflows={[]}
        kanbanCards={[]}
        workflowPluginActive
        kanbanPluginActive
        loading={false}
        onPause={noop}
        onResume={noop}
        onCancel={noop}
        onCardClick={noop}
      />
    );

    expect(screen.getByText('Nothing running')).toBeInTheDocument();
  });

  it('shows plugin-missing placeholders for each half when its plugin is inactive', () => {
    render(
      <RunningPanel
        workflows={[]}
        kanbanCards={[]}
        workflowPluginActive={false}
        kanbanPluginActive={false}
        loading={false}
        onPause={noop}
        onResume={noop}
        onCancel={noop}
        onCardClick={noop}
      />
    );

    expect(screen.getByText(/Enable the fictionlab-workflow plugin/)).toBeInTheDocument();
    expect(screen.getByText(/Enable the kanban plugin/)).toBeInTheDocument();
    // Both halves are gated off, so there's nothing left to call "empty" --
    // the placeholders already explain why nothing is showing.
    expect(screen.queryByText('Nothing running')).not.toBeInTheDocument();
  });
});
