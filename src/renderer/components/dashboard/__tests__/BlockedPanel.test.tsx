/**
 * Render tests for BlockedPanel (issue #214, kanban-only since bead
 * mea-cjl.4 moved failed-workflow rendering to the workflow plugin's own
 * dashboard widget): populated (blocked/review-required kanban cards, each
 * captioned with what it's waiting on), empty, and plugin-missing states.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { BlockedPanel } from '../BlockedPanel';
import type { KanbanCard } from '../types';

const noop = () => {};

describe('BlockedPanel', () => {
  it('renders blocked/review-required kanban cards with a waiting-on caption', () => {
    const cards: KanbanCard[] = [
      { id: 1, title: 'Decide on title', status: 'blocked' },
      { id: 2, title: 'Approve final draft', status: 'review', review_policy: 'review-required' },
    ];

    render(
      <BlockedPanel
        kanbanCards={cards}
        kanbanPluginActive
        loading={false}
        onCardClick={noop}
      />
    );

    expect(screen.getByText('Decide on title')).toBeInTheDocument();
    expect(screen.getByText('Blocked — needs a decision')).toBeInTheDocument();
    expect(screen.getByText('Approve final draft')).toBeInTheDocument();
    expect(screen.getByText('In review — needs approval')).toBeInTheDocument();
  });

  it('shows the "nothing blocked" empty state when active and clear', () => {
    render(
      <BlockedPanel
        kanbanCards={[]}
        kanbanPluginActive
        loading={false}
        onCardClick={noop}
      />
    );

    expect(screen.getByText('Nothing blocked 🎉')).toBeInTheDocument();
  });

  it('shows a plugin-missing placeholder when kanban is inactive', () => {
    render(
      <BlockedPanel
        kanbanCards={[]}
        kanbanPluginActive={false}
        loading={false}
        onCardClick={noop}
      />
    );

    expect(screen.getByText(/Enable the kanban plugin/)).toBeInTheDocument();
    expect(screen.queryByText('Nothing blocked 🎉')).not.toBeInTheDocument();
  });
});
