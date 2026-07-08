/**
 * KanbanViewReact
 * S11 Kanban board — host-bundled React view gated on the `fictionlab-kanban`
 * plugin (the same idiom as WorkflowsViewReact / `fictionlab-workflow`, per
 * the resolved Option A decision, GH issue #179).
 *
 * Board with columns, "mine"-default assignee filter (+ due/overdue filter,
 * the S14 fold-in minimum), quick-add, drag-to-move, and a card detail
 * drawer. Live refresh: primary is the `kanban:card-updated` push channel
 * (fired both by this view's own mutations AND by the plugin's Postgres
 * LISTEN on `kanban_changed`, which catches externally-driven mutations --
 * see packages/kanban-plugin/src/index.ts in fictionlab-workflow); a 5s
 * poll is the backstop; window-focus and every user-initiated mutation
 * additionally force an immediate re-fetch (issue #179 §4 hard requirement,
 * independent of push/poll -- the board must never sit stale the way the
 * Active Workflows panel does per issue #178).
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import { KanbanColumn } from '../components/kanban/KanbanColumn.js';
import { CardDrawer } from '../components/kanban/CardDrawer.js';
import type {
  KanbanBoard,
  KanbanColumn as KanbanColumnType,
  KanbanCard,
  KanbanAssigneeFilter,
  KanbanDueFilter,
  KanbanUpdate,
} from '../../types/kanban.js';
import type { ActiveWorkflowInstance, WorkflowUpdate } from '../../types/workflow.js';

const KANBAN_PLUGIN = 'plugin:fictionlab-kanban:';
const BOARD_KEY = 'dev-backlog';
const POLL_INTERVAL_MS = 5000;

let activeKanbanAppActions: { refresh: () => void; focusQuickAdd: () => void } | null = null;

async function invoke<T = any>(channel: string, args?: any): Promise<T> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.invoke) throw new Error('Electron API not available');
  return electronAPI.invoke(`${KANBAN_PLUGIN}${channel}`, args);
}

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  padding: '10px 16px',
  borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))',
  flexWrap: 'wrap',
};

const filterButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px',
  fontSize: '12px',
  borderRadius: '14px',
  border: `1px solid ${active ? 'var(--color-accent, #00D4AA)' : 'var(--color-border, rgba(255,255,255,0.15))'}`,
  background: active ? 'rgba(0, 212, 170, 0.12)' : 'transparent',
  color: active ? 'var(--color-accent, #00D4AA)' : 'var(--color-text-secondary, rgba(255,255,255,0.7))',
  cursor: 'pointer',
});

const boardStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  padding: '12px 16px',
  overflowX: 'auto',
  height: '100%',
  boxSizing: 'border-box',
};

const KanbanApp: React.FC = () => {
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [columns, setColumns] = useState<KanbanColumnType[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<KanbanAssigneeFilter>('mine');
  const [dueFilter, setDueFilter] = useState<KanbanDueFilter | 'none'>('none');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workflowPhases, setWorkflowPhases] = useState<Map<string, ActiveWorkflowInstance>>(new Map());

  const quickAddRef = useRef<HTMLInputElement | null>(null);
  const assigneeFilterRef = useRef(assigneeFilter);
  const dueFilterRef = useRef(dueFilter);
  assigneeFilterRef.current = assigneeFilter;
  dueFilterRef.current = dueFilter;

  const resolveAssigneeParam = (filter: KanbanAssigneeFilter): string | undefined => {
    if (filter === 'mine') return 'rebecca';
    if (filter === 'all') return undefined;
    if (filter === 'unassigned') return '__unassigned__';
    return filter; // a specific agent id
  };

  const loadBoard = useCallback(async () => {
    try {
      const result = await invoke<{ board: KanbanBoard; columns: KanbanColumnType[] }>('board:get-board', { board_key: BOARD_KEY });
      if (result?.board) {
        setBoard(result.board);
        setColumns([...(result.columns || [])].sort((a, b) => a.position - b.position));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load board');
    }
  }, []);

  const loadCards = useCallback(async () => {
    try {
      const args: Record<string, any> = { board_key: BOARD_KEY, limit: 500 };
      const assignee = resolveAssigneeParam(assigneeFilterRef.current);
      if (assignee !== undefined) args.assignee = assignee;
      if (dueFilterRef.current !== 'none') args.due_filter = dueFilterRef.current;
      args.include_workflow_phase = true;
      const result = await invoke<{ cards: KanbanCard[] }>('board:list-cards', args);
      setCards(result?.cards || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load cards');
    }
  }, []);

  const loadWorkflowPhases = useCallback(async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI?.invoke) return;
      // Host-owned channel (un-prefixed), same one WorkflowManagerPanel uses --
      // zero new workflow-side plumbing, per S11 §7's workflow tie-in requirement.
      const result = await electronAPI.invoke('workflow:list-active');
      if (Array.isArray(result)) {
        setWorkflowPhases(new Map(result.map((w: ActiveWorkflowInstance) => [w.id, w])));
      }
    } catch {
      // Non-fatal -- the board still works without live workflow phases.
    }
  }, []);

  const refresh = useCallback(() => {
    loadBoard();
    loadCards();
    loadWorkflowPhases();
  }, [loadBoard, loadCards, loadWorkflowPhases]);

  // Initial load + re-load when filters change.
  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => { loadCards(); }, [loadCards, assigneeFilter, dueFilter]);
  useEffect(() => { loadWorkflowPhases(); }, [loadWorkflowPhases]);

  // Live refresh: kanban:card-updated push (primary, fed by LISTEN + this
  // view's own mutations), 5s poll (backstop), window-focus (hard
  // requirement independent of mechanism, issue #179 §4).
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.on || !electronAPI?.off) return;

    const handleKanbanUpdate = (_update: KanbanUpdate) => {
      loadCards();
      loadBoard();
    };
    const handleWorkflowUpdate = (_update: WorkflowUpdate) => {
      loadWorkflowPhases();
    };
    const handleFocus = () => refresh();

    electronAPI.on('kanban:card-updated', handleKanbanUpdate);
    electronAPI.on('workflow:instance-updated', handleWorkflowUpdate);
    window.addEventListener('focus', handleFocus);

    const pollInterval = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      electronAPI.off('kanban:card-updated', handleKanbanUpdate);
      electronAPI.off('workflow:instance-updated', handleWorkflowUpdate);
      window.removeEventListener('focus', handleFocus);
      clearInterval(pollInterval);
    };
  }, [loadCards, loadBoard, loadWorkflowPhases, refresh]);

  useEffect(() => {
    activeKanbanAppActions = {
      refresh,
      focusQuickAdd: () => quickAddRef.current?.focus(),
    };
    return () => { activeKanbanAppActions = null; };
  }, [refresh]);

  const handleQuickAdd = useCallback((statusKey: string, title: string) => {
    invoke('board:create-card', { board_key: BOARD_KEY, title, status: statusKey })
      .then(refresh)
      .catch((e: any) => setError(e?.message || 'Failed to create card'));
  }, [refresh]);

  const handleDropCard = useCallback((cardId: string, statusKey: string) => {
    invoke('board:move-card', { card_id: cardId, to_status: statusKey, actor: 'rebecca' })
      .then(refresh)
      .catch((e: any) => setError(e?.message || 'Failed to move card'));
  }, [refresh]);

  const selectedCard = selectedCardId ? cards.find((c) => c.id === selectedCardId) || null : null;

  const agentOptions = Array.from(
    new Set(cards.map((c) => c.assignee).filter((a): a is string => !!a && a !== 'rebecca'))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={filterBarStyle}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary, rgba(255,255,255,0.5))', marginRight: '4px' }}>
          {board?.name || 'Board'}
        </span>
        <button style={filterButtonStyle(assigneeFilter === 'mine')} onClick={() => setAssigneeFilter('mine')}>Mine (rebecca)</button>
        <button style={filterButtonStyle(assigneeFilter === 'all')} onClick={() => setAssigneeFilter('all')}>All</button>
        <button style={filterButtonStyle(assigneeFilter === 'unassigned')} onClick={() => setAssigneeFilter('unassigned')}>Unassigned</button>
        {agentOptions.map((agent) => (
          <button key={agent} style={filterButtonStyle(assigneeFilter === agent)} onClick={() => setAssigneeFilter(agent)}>{agent}</button>
        ))}

        <span style={{ width: '1px', height: '18px', background: 'var(--color-border, rgba(255,255,255,0.15))', margin: '0 4px' }} />

        <button style={filterButtonStyle(dueFilter === 'none')} onClick={() => setDueFilter('none')}>Any due date</button>
        <button style={filterButtonStyle(dueFilter === 'overdue')} onClick={() => setDueFilter('overdue')}>Overdue</button>
        <button style={filterButtonStyle(dueFilter === 'upcoming')} onClick={() => setDueFilter('upcoming')}>Due soon</button>

        {error && <span style={{ fontSize: '11px', color: '#ef4444', marginLeft: 'auto' }}>{error}</span>}
      </div>

      <div style={boardStyle}>
        {columns.map((column, index) => (
          <KanbanColumn
            key={column.id}
            column={column}
            cards={cards.filter((c) => c.status === column.status_key)}
            workflowPhases={workflowPhases}
            onSelectCard={(card) => setSelectedCardId(card.id)}
            onQuickAdd={handleQuickAdd}
            onDropCard={handleDropCard}
            quickAddInputRef={index === 0 ? (el) => { quickAddRef.current = el; } : undefined}
          />
        ))}
        {columns.length === 0 && (
          <div style={{ padding: '24px', color: 'var(--color-text-tertiary, rgba(255,255,255,0.5))' }}>
            {error ? 'Could not load the board.' : 'Loading board...'}
          </div>
        )}
      </div>

      {selectedCard && (
        <CardDrawer
          cardId={selectedCard.id}
          workflowPhase={selectedCard.workflow_registry_id ? workflowPhases.get(selectedCard.workflow_registry_id) || null : null}
          onClose={() => setSelectedCardId(null)}
          onMutated={refresh}
        />
      )}
    </div>
  );
};

// View class wrapper for ViewRouter
export class KanbanViewReact implements View {
  private container: HTMLElement | null = null;
  private root: ReactDOM.Root | null = null;

  async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.root = ReactDOM.createRoot(container);
    this.root.render(<KanbanApp />);
    console.log('[KanbanViewReact] Mounted');
  }

  async unmount(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.container = null;
    console.log('[KanbanViewReact] Unmounted');
  }

  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Board',
      actions: [
        { id: 'new-card', label: 'New Card', icon: '➕' },
        { id: 'refresh', label: 'Refresh', icon: '🔄' },
      ],
      global: {
        projectSelector: false,
        environmentIndicator: true,
      },
    };
  }

  handleAction(actionId: string): void {
    if (!activeKanbanAppActions) {
      console.warn('[KanbanViewReact] Action dispatched but no mounted app instance to handle it:', actionId);
      return;
    }
    switch (actionId) {
      case 'refresh':
        activeKanbanAppActions.refresh();
        break;
      case 'new-card':
        activeKanbanAppActions.focusQuickAdd();
        break;
      default:
        console.warn('[KanbanViewReact] Unknown action:', actionId);
    }
  }
}
