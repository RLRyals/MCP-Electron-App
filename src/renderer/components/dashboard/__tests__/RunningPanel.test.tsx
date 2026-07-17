/**
 * Render tests for RunningPanel (issue #214, kanban-only since bead
 * mea-cjl.4 moved the workflow half to the workflow plugin's own dashboard
 * widget): populated, empty, and plugin-missing states.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { RunningPanel } from '../RunningPanel';
import type { KanbanCard } from '../types';

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
  it('renders a row per kanban card', () => {
    render(
      <RunningPanel
        kanbanCards={[makeCard({ id: 'card-2', title: 'Fix cover art' })]}
        kanbanPluginActive
        loading={false}
        onCardClick={noop}
      />
    );

    expect(screen.getByText('Fix cover art')).toBeInTheDocument();
  });

  it('shows the empty state when active but nothing running', () => {
    render(
      <RunningPanel
        kanbanCards={[]}
        kanbanPluginActive
        loading={false}
        onCardClick={noop}
      />
    );

    expect(screen.getByText('Nothing running')).toBeInTheDocument();
  });

  it('shows a plugin-missing placeholder when kanban is inactive', () => {
    render(
      <RunningPanel
        kanbanCards={[]}
        kanbanPluginActive={false}
        loading={false}
        onCardClick={noop}
      />
    );

    expect(screen.getByText(/Enable the kanban plugin/)).toBeInTheDocument();
    // Gated off, so there's nothing left to call "empty" -- the placeholder
    // already explains why nothing is showing.
    expect(screen.queryByText('Nothing running')).not.toBeInTheDocument();
  });
});
