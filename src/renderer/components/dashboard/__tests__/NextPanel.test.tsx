/**
 * Render tests for NextPanel (issue #214): populated (due tiles pinned
 * above plain priority-sorted rows), empty, and plugin-missing states.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { NextPanel } from '../NextPanel';
import type { KanbanCard } from '../types';

const noop = () => {};

describe('NextPanel', () => {
  it('pins due-date cards above plain cards, and sorts plain cards priority desc then position asc', () => {
    const cards: KanbanCard[] = [
      { id: 1, title: 'Low priority, first position', status: 'ready', priority: 'low', position: 1 },
      { id: 2, title: 'High priority, later position', status: 'ready', priority: 'high', position: 5 },
      { id: 3, title: 'Overdue task', status: 'ready', due_at: '2020-01-01T00:00:00.000Z' },
    ];

    render(<NextPanel cards={cards} pluginActive loading={false} onCardClick={noop} />);

    const titles = screen.getAllByTitle(/./).map((el) => el.getAttribute('title'));
    // Due card first (pinned to top), then the plain cards ordered by
    // priority desc (high before low) regardless of position.
    expect(titles).toEqual([
      'Overdue task',
      'High priority, later position',
      'Low priority, first position',
    ]);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('shows the empty state when the plugin is active but there is nothing queued', () => {
    render(<NextPanel cards={[]} pluginActive loading={false} onCardClick={noop} />);
    expect(screen.getByText('Nothing queued')).toBeInTheDocument();
  });

  it('shows a plugin-missing placeholder instead of the empty state when kanban is inactive', () => {
    render(<NextPanel cards={[]} pluginActive={false} loading={false} onCardClick={noop} />);
    expect(screen.getByText(/Enable the kanban plugin/)).toBeInTheDocument();
    expect(screen.queryByText('Nothing queued')).not.toBeInTheDocument();
  });
});
