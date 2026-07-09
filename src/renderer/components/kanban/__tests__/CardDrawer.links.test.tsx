/**
 * CardDrawer link-rendering tests (issue #198).
 *
 * Covers the acceptance criteria that are exercisable at the component
 * level: `url`/`github_issue`/`card`/`file` links render clickable (or fall
 * back to plain text when a `card` link's target no longer exists), the
 * `issue_ref` open affordance, body linkify, and that the pre-existing
 * add-link form still submits the same payload it always did.
 *
 * window.electronAPI.invoke is a single jest.fn() that routes by channel --
 * same shape the real preload exposes -- so each test only needs to stub
 * the responses it cares about.
 */
import * as React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardDrawer } from '../CardDrawer';
import type { KanbanCardDetail, KanbanIdentity } from '../../../../types/kanban';
import type { CurrentUserSetting } from '../../../../types/identity';

const KANBAN_PLUGIN = 'plugin:fictionlab-kanban:';

const currentUser: CurrentUserSetting = { id: 'rebecca', displayName: 'Rebecca' };
const identities: KanbanIdentity[] = [];

function baseCard(overrides: Record<string, any> = {}) {
  return {
    id: 'card-1',
    board_id: 'board-1',
    title: 'Fix the thing',
    body: '',
    status: 'in_progress',
    assignee: null,
    agent_claimable: false,
    priority: 'normal',
    labels: [],
    position: 0,
    claimed_by: null,
    claimed_at: null,
    workflow_registry_id: null,
    spec_ref: null,
    issue_ref: null,
    review_policy: 'auto-done',
    due_at: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    created_by: 'rebecca',
    metadata: {},
    comment_count: 0,
    link_count: 0,
    ...overrides,
  };
}

function detailFor(cardOverrides: Record<string, any>, links: any[] = []): KanbanCardDetail {
  return {
    card: baseCard(cardOverrides),
    comments: [],
    links,
    activity: [],
  } as any;
}

/** Builds the routed invoke() mock and returns it plus a spy for assertions. */
function setupInvoke(detail: KanbanCardDetail, opts: { knownCardIds?: string[] } = {}) {
  const knownCardIds = new Set(opts.knownCardIds || []);
  const invoke = jest.fn(async (channel: string, args?: any) => {
    if (channel === `${KANBAN_PLUGIN}board:get-card`) {
      const id = args?.card_id;
      if (id === detail.card.id) return detail;
      if (knownCardIds.has(id)) return { card: { id, title: `Card ${id}` }, comments: [], links: [], activity: [] };
      return { card: null };
    }
    if (channel === `${KANBAN_PLUGIN}board:add-card-link`) {
      return { id: 'new-link', card_id: args?.card_id, link_type: args?.link_type, ref: args?.ref, label: args?.label };
    }
    if (channel === `${KANBAN_PLUGIN}board:update-card`) {
      return { ...detail.card, ...args };
    }
    if (channel === 'app:open-external') {
      return { success: true };
    }
    if (channel === 'app:reveal-in-folder') {
      return { success: true };
    }
    return undefined;
  });
  (window as any).electronAPI.invoke = invoke;
  return invoke;
}

const renderDrawer = (props: Partial<React.ComponentProps<typeof CardDrawer>> = {}) => {
  return render(
    <CardDrawer
      cardId="card-1"
      workflowPhase={null}
      currentUser={currentUser}
      identities={identities}
      onClose={jest.fn()}
      onMutated={jest.fn()}
      {...props}
    />
  );
};

describe('CardDrawer -- Links section (issue #198)', () => {
  it('renders a url link as a clickable anchor that opens via app:open-external', async () => {
    const detail = detailFor({}, [
      { id: 'l1', card_id: 'card-1', link_type: 'url', ref: 'https://example.com/dashboard', label: null, created_at: '' },
    ]);
    const invoke = setupInvoke(detail);
    renderDrawer();

    const link = await screen.findByRole('link', { name: 'https://example.com/dashboard' });
    const user = userEvent.setup();
    await user.click(link);

    expect(invoke).toHaveBeenCalledWith('app:open-external', 'https://example.com/dashboard');
  });

  it('renders a github_issue shorthand link and opens the canonical GitHub URL', async () => {
    const detail = detailFor({}, [
      { id: 'l2', card_id: 'card-1', link_type: 'github_issue', ref: 'RLRyals/MCP-Electron-App#190', label: 'PR #190', created_at: '' },
    ]);
    const invoke = setupInvoke(detail);
    renderDrawer();

    const link = await screen.findByRole('link', { name: 'PR #190' });
    const user = userEvent.setup();
    await user.click(link);

    expect(invoke).toHaveBeenCalledWith('app:open-external', 'https://github.com/RLRyals/MCP-Electron-App/issues/190');
  });

  it('renders a github_issue full-URL link and opens it as-is', async () => {
    const detail = detailFor({}, [
      { id: 'l2b', card_id: 'card-1', link_type: 'github_issue', ref: 'https://github.com/RLRyals/MCP-Electron-App/pull/197', label: null, created_at: '' },
    ]);
    const invoke = setupInvoke(detail);
    renderDrawer();

    const link = await screen.findByRole('link', { name: 'https://github.com/RLRyals/MCP-Electron-App/pull/197' });
    const user = userEvent.setup();
    await user.click(link);

    expect(invoke).toHaveBeenCalledWith('app:open-external', 'https://github.com/RLRyals/MCP-Electron-App/issues/197');
  });

  it('renders a card link to an existing card as clickable and navigates via onNavigateToCard', async () => {
    const detail = detailFor({}, [
      { id: 'l3', card_id: 'card-1', link_type: 'card', ref: 'card-2', label: 'Related card', created_at: '' },
    ]);
    setupInvoke(detail, { knownCardIds: ['card-2'] });
    const onNavigateToCard = jest.fn();
    renderDrawer({ onNavigateToCard });

    const link = await screen.findByRole('link', { name: 'Related card' });
    const user = userEvent.setup();
    await user.click(link);

    expect(onNavigateToCard).toHaveBeenCalledWith('card-2');
  });

  it('falls back to plain text for a card link whose target no longer exists', async () => {
    const detail = detailFor({}, [
      { id: 'l4', card_id: 'card-1', link_type: 'card', ref: 'deleted-card', label: 'Gone card', created_at: '' },
    ]);
    setupInvoke(detail, { knownCardIds: [] }); // deleted-card resolves to { card: null }
    const onNavigateToCard = jest.fn();
    renderDrawer({ onNavigateToCard });

    await screen.findByText('Gone card');
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Gone card' })).not.toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Gone card'));
    expect(onNavigateToCard).not.toHaveBeenCalled();
  });

  it('renders a file link that reveals in folder rather than opening/executing it', async () => {
    const detail = detailFor({}, [
      { id: 'l5', card_id: 'card-1', link_type: 'file', ref: 'C:/repo/outputs/book_1/spec.md', label: null, created_at: '' },
    ]);
    const invoke = setupInvoke(detail);
    renderDrawer();

    const link = await screen.findByRole('link', { name: 'C:/repo/outputs/book_1/spec.md' });
    const user = userEvent.setup();
    await user.click(link);

    expect(invoke).toHaveBeenCalledWith('app:reveal-in-folder', 'C:/repo/outputs/book_1/spec.md');
    expect(invoke).not.toHaveBeenCalledWith('app:open-external', expect.anything());
  });

  it('renders a non-URL spec ref as plain text (not clickable)', async () => {
    const detail = detailFor({}, [
      { id: 'l6', card_id: 'card-1', link_type: 'spec', ref: 'outputs/book_1/spec.md', label: null, created_at: '' },
    ]);
    setupInvoke(detail);
    renderDrawer();

    await screen.findByText('outputs/book_1/spec.md');
    expect(screen.queryByRole('link', { name: 'outputs/book_1/spec.md' })).not.toBeInTheDocument();
  });

  it('the existing add-link form still submits the same board:add-card-link payload', async () => {
    const detail = detailFor({}, []);
    const invoke = setupInvoke(detail);
    renderDrawer();

    await screen.findByDisplayValue('Fix the thing'); // card finished loading

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('ref'), 'https://example.com/new-link');
    await user.type(screen.getByPlaceholderText('label (optional)'), 'New link');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(`${KANBAN_PLUGIN}board:add-card-link`, {
        card_id: 'card-1',
        link_type: 'url',
        ref: 'https://example.com/new-link',
        label: 'New link',
      });
    });
  });
});

describe('CardDrawer -- issue_ref open affordance (issue #198)', () => {
  it('shows no Open button when issue_ref is empty', async () => {
    const detail = detailFor({ issue_ref: null });
    setupInvoke(detail);
    renderDrawer();

    await screen.findByDisplayValue('Fix the thing');
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
  });

  it('shows an Open button when issue_ref parses as owner/repo#N, and it opens the canonical URL', async () => {
    const detail = detailFor({ issue_ref: 'RLRyals/MCP-Electron-App#198' });
    const invoke = setupInvoke(detail);
    renderDrawer();

    const openButton = await screen.findByRole('button', { name: 'Open' });
    const user = userEvent.setup();
    await user.click(openButton);

    expect(invoke).toHaveBeenCalledWith('app:open-external', 'https://github.com/RLRyals/MCP-Electron-App/issues/198');
  });
});

describe('CardDrawer -- body linkify (issue #198)', () => {
  it('renders a bare URL in the body as a clickable link without entering edit mode', async () => {
    const detail = detailFor({ body: 'See https://example.com/notes for context.' });
    const invoke = setupInvoke(detail);
    const { container } = renderDrawer();

    const link = await screen.findByRole('link', { name: 'https://example.com/notes' });
    const user = userEvent.setup();
    await user.click(link);

    expect(invoke).toHaveBeenCalledWith('app:open-external', 'https://example.com/notes');
    // Clicking the link must not have bubbled up to the body's own onClick
    // (which would swap it into the editable textarea). The body editor is
    // the only <textarea> in the drawer without a placeholder.
    const unplaceholderedTextareas = Array.from(container.querySelectorAll('textarea')).filter(
      (t) => !t.getAttribute('placeholder')
    );
    expect(unplaceholderedTextareas).toHaveLength(0);
  });
});
