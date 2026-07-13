/**
 * DashboardApp card deep-link regression test (bead mea-5bq).
 *
 * The bug: clicking a cockpit card navigated to the kanban view but dropped
 * the card id (`navigateTo('kanban')` with no params), so the board opened
 * without the clicked card's drawer. The fix threads the id across the
 * app->plugin boundary via ViewRouter's existing `navigateTo(viewId, params)`
 * -> `view.mount(container, params)` contract; the fictionlab-kanban plugin
 * (>= 1.1.2) reads `params.cardId` on mount and opens that drawer (covered
 * on its side by deep-link-utils tests in the fictionlab-workflow repo).
 *
 * This test locks the app side of that contract: a card click in each
 * cockpit panel must call `navigateTo('kanban', { cardId: <clicked id> })`.
 * Panel render behavior itself is covered by the per-panel tests in
 * src/renderer/components/dashboard/__tests__/.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardApp } from '../DashboardViewReact';
import type { KanbanCard } from '../../components/dashboard/types';

const KANBAN_LIST_CHANNEL = 'plugin:fictionlab-kanban:board:list-cards';

function installMocks(cards: KanbanCard[]) {
  const invoke = jest.fn(async (channel: string) => {
    if (channel === KANBAN_LIST_CHANNEL) return cards;
    return undefined;
  });

  (window as any).electronAPI = {
    invoke,
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    // isPluginActive() gate: kanban active, workflow inactive (workflow data
    // isn't needed to exercise the card-click path).
    plugins: {
      list: jest.fn().mockResolvedValue([{ id: 'fictionlab-kanban', status: 'active' }]),
    },
    // SystemStrip renders unconditionally inside DashboardApp.
    mcpSystem: {
      getDetailedStatus: jest.fn().mockResolvedValue({
        overall: { running: true, healthy: true, ready: true, message: 'ok' },
        services: [],
        timestamp: new Date(),
      }),
      start: jest.fn(),
      stop: jest.fn(),
      restart: jest.fn(),
      onProgress: jest.fn(),
      removeProgressListener: jest.fn(),
    },
    clientSelection: {
      getSelection: jest.fn().mockResolvedValue({ clients: [], selectedAt: new Date().toISOString() }),
    },
  };

  const navigateTo = jest.fn();
  (window as any).__viewRouter__ = { navigateTo };
  return { navigateTo };
}

afterEach(() => {
  delete (window as any).__viewRouter__;
});

describe('DashboardApp card deep-link (bead mea-5bq)', () => {
  it('clicking a Next-panel card navigates to kanban WITH that card id in the params', async () => {
    const { navigateTo } = installMocks([
      { id: 'card-42', title: 'Ship the deep link', status: 'ready', priority: 'high' },
    ]);

    render(<DashboardApp />);

    const row = await screen.findByTitle('Ship the deep link');
    await userEvent.click(row);

    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith('kanban', { cardId: 'card-42' });
  });

  it('passes each clicked card its OWN id (Running and Blocked panels share the same handler)', async () => {
    const { navigateTo } = installMocks([
      { id: 'card-run', title: 'In progress card', status: 'in_progress' },
      { id: 'card-blocked', title: 'Blocked card', status: 'blocked' },
    ]);

    render(<DashboardApp />);

    await userEvent.click(await screen.findByTitle('In progress card'));
    await userEvent.click(await screen.findByTitle('Blocked card'));

    expect(navigateTo).toHaveBeenNthCalledWith(1, 'kanban', { cardId: 'card-run' });
    expect(navigateTo).toHaveBeenNthCalledWith(2, 'kanban', { cardId: 'card-blocked' });
  });

  it('regression shape-lock: numeric ids pass through unchanged (plugin side normalizes to string)', async () => {
    const { navigateTo } = installMocks([
      { id: 7, title: 'Numeric id card', status: 'ready' },
    ]);

    render(<DashboardApp />);

    await userEvent.click(await screen.findByTitle('Numeric id card'));

    expect(navigateTo).toHaveBeenCalledWith('kanban', { cardId: 7 });
  });
});
