/**
 * CardDrawer
 * The card detail panel (S11 §7 / issue #179 §3): title, body (markdown-ish,
 * rendered as preformatted text), status, assignee, priority, labels, due
 * date, review_policy (with escalate-only control), comments thread,
 * activity log, links, and claim/move/assign controls. Also the live
 * workflow-phase tie-in when a card carries workflow_registry_id.
 */

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import {
  CARD_STATUSES,
  STATUS_LABELS,
  type KanbanCardDetail,
  type KanbanCardStatus,
  type KanbanPriority,
  type KanbanLinkType,
} from '../../../types/kanban.js';
import type { ActiveWorkflowInstance } from '../../../types/workflow.js';

const KANBAN_PLUGIN = 'plugin:fictionlab-kanban:';

export interface CardDrawerProps {
  cardId: string;
  workflowPhase: ActiveWorkflowInstance | null;
  onClose: () => void;
  /** Called after any mutation succeeds, so the parent board can re-fetch immediately. */
  onMutated: () => void;
}

async function invoke<T = any>(channel: string, args?: any): Promise<T> {
  const electronAPI = (window as any).electronAPI;
  return electronAPI.invoke(`${KANBAN_PLUGIN}${channel}`, args);
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '420px',
  maxWidth: '90vw',
  background: 'var(--color-bg-secondary, #0D1F35)',
  borderLeft: '1px solid var(--color-border, rgba(255,255,255,0.1))',
  boxShadow: '-4px 0 16px rgba(0,0,0,0.35)',
  zIndex: 2000,
  display: 'flex',
  flexDirection: 'column',
  color: 'var(--color-text-primary, rgba(255,255,255,0.9))',
};

const sectionStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  color: 'var(--color-text-tertiary, rgba(255,255,255,0.5))',
  marginBottom: '4px',
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  fontSize: '13px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
  borderRadius: '6px',
  color: 'inherit',
};

const buttonStyle: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: '12px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
  borderRadius: '5px',
  color: 'inherit',
  cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'var(--color-accent, #00D4AA)',
  color: '#03110d',
  border: 'none',
  fontWeight: 600,
};

export const CardDrawer: React.FC<CardDrawerProps> = ({ cardId, workflowPhase, onClose, onMutated }) => {
  const [detail, setDetail] = useState<KanbanCardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [editingBody, setEditingBody] = useState(false);
  const [priorityDraft, setPriorityDraft] = useState<KanbanPriority>('normal');
  const [labelsDraft, setLabelsDraft] = useState('');
  const [dueDraft, setDueDraft] = useState('');
  const [specRefDraft, setSpecRefDraft] = useState('');
  const [issueRefDraft, setIssueRefDraft] = useState('');
  const [assigneeDraft, setAssigneeDraft] = useState('');

  const [newComment, setNewComment] = useState('');
  const [claimAgent, setClaimAgent] = useState('');
  const [linkType, setLinkType] = useState<KanbanLinkType>('url');
  const [linkRef, setLinkRef] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<KanbanCardDetail>('board:get-card', { card_id: cardId });
      if (!result?.card) {
        setError('Card not found');
        setDetail(null);
        return;
      }
      setDetail(result);
      setTitleDraft(result.card.title);
      setBodyDraft(result.card.body || '');
      setPriorityDraft(result.card.priority);
      setLabelsDraft(result.card.labels.join(', '));
      setDueDraft(result.card.due_at ? result.card.due_at.slice(0, 16) : '');
      setSpecRefDraft(result.card.spec_ref || '');
      setIssueRefDraft(result.card.issue_ref || '');
      setAssigneeDraft(result.card.assignee || '');
    } catch (e: any) {
      setError(e?.message || 'Failed to load card');
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => { load(); }, [load]);

  const runMutation = async (fn: () => Promise<any>) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
      await load();
      onMutated();
    } catch (e: any) {
      setError(e?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !detail) {
    return (
      <div style={panelStyle}>
        <div style={sectionStyle}>Loading...</div>
      </div>
    );
  }

  if (!detail?.card) {
    return (
      <div style={panelStyle}>
        <div style={sectionStyle}>
          <div style={{ marginBottom: '8px' }}>{error || 'Card not found'}</div>
          <button style={buttonStyle} onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const card = detail.card;

  const saveFieldChanges = () => {
    const patch: Record<string, any> = { card_id: cardId, actor: 'rebecca' };
    let dirty = false;
    if (titleDraft !== card.title) { patch.title = titleDraft; dirty = true; }
    if (bodyDraft !== (card.body || '')) { patch.body = bodyDraft; dirty = true; }
    if (priorityDraft !== card.priority) { patch.priority = priorityDraft; dirty = true; }
    const labelsArr = labelsDraft.split(',').map((l) => l.trim()).filter(Boolean);
    if (JSON.stringify(labelsArr) !== JSON.stringify(card.labels)) { patch.labels = labelsArr; dirty = true; }
    if (specRefDraft !== (card.spec_ref || '')) { patch.spec_ref = specRefDraft; dirty = true; }
    if (issueRefDraft !== (card.issue_ref || '')) { patch.issue_ref = issueRefDraft; dirty = true; }
    const dueIso = dueDraft ? new Date(dueDraft).toISOString() : '__clear__';
    const currentDueTrimmed = card.due_at ? card.due_at.slice(0, 16) : '';
    if (dueDraft !== currentDueTrimmed) { patch.due_at = dueIso; dirty = true; }
    if (!dirty) return;
    runMutation(() => invoke('board:update-card', patch));
  };

  return (
    <div style={panelStyle}>
      <div style={{ ...sectionStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input
          style={{ ...inputStyle, fontSize: '15px', fontWeight: 700, border: 'none', background: 'transparent', padding: 0 }}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={saveFieldChanges}
        />
        <button style={buttonStyle} onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {error && <div style={{ ...sectionStyle, color: '#ef4444', fontSize: '12px' }}>{error}</div>}

        {/* Status / review_policy / workflow tie-in */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: '#374151' }}>
              {STATUS_LABELS[card.status]}
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '10px',
                background: card.review_policy === 'review-required' ? '#f59e0b' : '#6b7280',
                color: card.review_policy === 'review-required' ? '#1a1200' : 'white',
              }}
              title="Risk-based review policy: review-required cards land in Rebecca's review queue when moved to review; auto-done cards may reach done directly."
            >
              {card.review_policy}
            </span>
            {card.review_policy === 'auto-done' && (
              <button
                style={buttonStyle}
                disabled={saving}
                onClick={() => runMutation(() => invoke('board:update-card', { card_id: cardId, actor: 'rebecca', review_policy: 'review-required' }))}
              >
                Escalate to review-required
              </button>
            )}
          </div>

          {workflowPhase && (
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              <span style={labelStyle}>Live workflow phase</span>
              <div>{workflowPhase.currentNodeName || 'Starting...'} — {workflowPhase.progressPercent ?? 0}%
                {' '}({workflowPhase.completedNodes}/{workflowPhase.totalNodes} nodes, {workflowPhase.status})
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '4px' }}>
                <div style={{ height: '100%', width: `${workflowPhase.progressPercent ?? 0}%`, background: '#3b82f6', borderRadius: '2px' }} />
              </div>
            </div>
          )}

          <label style={labelStyle}>Move to</label>
          <select
            style={inputStyle}
            value={card.status}
            disabled={saving}
            onChange={(e) => runMutation(() => invoke('board:move-card', { card_id: cardId, to_status: e.target.value as KanbanCardStatus, actor: 'rebecca' }))}
          >
            {CARD_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Assignee / claim */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Assignee</label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <input
              style={inputStyle}
              value={assigneeDraft}
              onChange={(e) => setAssigneeDraft(e.target.value)}
              placeholder="unassigned"
            />
            <button
              style={buttonStyle}
              disabled={saving}
              onClick={() => runMutation(() => invoke('board:update-card', { card_id: cardId, actor: 'rebecca', assignee: assigneeDraft || '__clear__' }))}
            >
              Save
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <button style={buttonStyle} disabled={saving} onClick={() => runMutation(() => invoke('board:update-card', { card_id: cardId, actor: 'rebecca', assignee: 'rebecca' }))}>
              Assign to me
            </button>
            <button style={buttonStyle} disabled={saving} onClick={() => runMutation(() => invoke('board:update-card', { card_id: cardId, actor: 'rebecca', assignee: '__clear__' }))}>
              Clear assignee
            </button>
          </div>

          <label style={labelStyle}>Claim as agent (testing / manual override)</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input style={inputStyle} value={claimAgent} onChange={(e) => setClaimAgent(e.target.value)} placeholder="claude-code:session-label" />
            <button
              style={buttonStyle}
              disabled={saving || !claimAgent.trim()}
              onClick={() => runMutation(() => invoke('board:claim-card', { card_id: cardId, agent: claimAgent.trim() }))}
            >
              Claim
            </button>
          </div>
        </div>

        {/* Priority / labels / due date / refs */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Priority</label>
          <select style={{ ...inputStyle, marginBottom: '10px' }} value={priorityDraft} onChange={(e) => setPriorityDraft(e.target.value as KanbanPriority)} onBlur={saveFieldChanges}>
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>

          <label style={labelStyle}>Labels (comma-separated)</label>
          <input style={{ ...inputStyle, marginBottom: '10px' }} value={labelsDraft} onChange={(e) => setLabelsDraft(e.target.value)} onBlur={saveFieldChanges} />

          <label style={labelStyle}>Due date</label>
          <input
            type="datetime-local"
            style={{ ...inputStyle, marginBottom: '10px' }}
            value={dueDraft}
            onChange={(e) => setDueDraft(e.target.value)}
            onBlur={saveFieldChanges}
          />

          <label style={labelStyle}>Spec ref</label>
          <input style={{ ...inputStyle, marginBottom: '10px' }} value={specRefDraft} onChange={(e) => setSpecRefDraft(e.target.value)} onBlur={saveFieldChanges} />

          <label style={labelStyle}>Issue ref</label>
          <input style={inputStyle} value={issueRefDraft} onChange={(e) => setIssueRefDraft(e.target.value)} onBlur={saveFieldChanges} />
        </div>

        {/* Body */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Body (spec / plan / acceptance criteria)</label>
          {editingBody ? (
            <textarea
              style={{ ...inputStyle, minHeight: '160px', fontFamily: 'inherit', resize: 'vertical' }}
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
              onBlur={() => { setEditingBody(false); saveFieldChanges(); }}
              autoFocus
            />
          ) : (
            <div
              style={{ whiteSpace: 'pre-wrap', fontSize: '13px', cursor: 'text', minHeight: '40px' }}
              onClick={() => setEditingBody(true)}
            >
              {bodyDraft || <span style={{ color: 'var(--color-text-tertiary, rgba(255,255,255,0.4))' }}>Click to add a body...</span>}
            </div>
          )}
        </div>

        {/* Links */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Links</label>
          {detail.links.length === 0 && <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary, rgba(255,255,255,0.4))' }}>None</div>}
          {detail.links.map((link) => (
            <div key={link.id} style={{ fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ opacity: 0.6 }}>[{link.link_type}]</span> {link.label || link.ref}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
            <select style={{ ...inputStyle, flex: '0 0 90px' }} value={linkType} onChange={(e) => setLinkType(e.target.value as KanbanLinkType)}>
              <option value="url">url</option>
              <option value="github_issue">github_issue</option>
              <option value="spec">spec</option>
              <option value="file">file</option>
              <option value="workflow_run">workflow_run</option>
              <option value="card">card</option>
            </select>
            <input style={inputStyle} placeholder="ref" value={linkRef} onChange={(e) => setLinkRef(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            <input style={inputStyle} placeholder="label (optional)" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
            <button
              style={buttonStyle}
              disabled={saving || !linkRef.trim()}
              onClick={() => runMutation(async () => {
                await invoke('board:add-card-link', { card_id: cardId, link_type: linkType, ref: linkRef.trim(), label: linkLabel.trim() || undefined });
                setLinkRef('');
                setLinkLabel('');
              })}
            >
              Add
            </button>
          </div>
        </div>

        {/* Comments */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Comments</label>
          {detail.comments.length === 0 && <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary, rgba(255,255,255,0.4))' }}>None yet</div>}
          {detail.comments.map((c) => (
            <div key={c.id} style={{ marginBottom: '8px', fontSize: '12px' }}>
              <div style={{ fontWeight: 600 }}>{c.author} <span style={{ fontWeight: 400, opacity: 0.5 }}>{new Date(c.created_at).toLocaleString()}</span></div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
            </div>
          ))}
          <textarea
            style={{ ...inputStyle, minHeight: '60px', fontFamily: 'inherit', marginTop: '6px' }}
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button
            style={{ ...primaryButtonStyle, marginTop: '6px' }}
            disabled={saving || !newComment.trim()}
            onClick={() => runMutation(async () => {
              await invoke('board:comment-card', { card_id: cardId, author: 'rebecca', body: newComment.trim() });
              setNewComment('');
            })}
          >
            Add comment
          </button>
        </div>

        {/* Activity log */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Activity</label>
          {detail.activity.length === 0 && <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary, rgba(255,255,255,0.4))' }}>None</div>}
          {detail.activity.map((a) => (
            <div key={a.id} style={{ fontSize: '11px', marginBottom: '4px', color: 'var(--color-text-secondary, rgba(255,255,255,0.65))' }}>
              <span style={{ opacity: 0.6 }}>{new Date(a.created_at).toLocaleString()}</span> — {a.actor} {a.action}
              {a.from_status && a.to_status ? ` (${a.from_status} → ${a.to_status})` : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CardDrawer;
