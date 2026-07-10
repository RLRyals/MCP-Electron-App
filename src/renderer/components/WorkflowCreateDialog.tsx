/**
 * WorkflowCreateDialog
 *
 * Small modal for authoring a brand-new, empty workflow in-app.
 * Collects a name (required) and an optional description, then delegates
 * persistence to the parent via onCreate. On success the parent refreshes the
 * workflow list and auto-selects the new workflow so the canvas opens.
 */

import * as React from 'react';
import { useState } from 'react';

export interface WorkflowCreateDialogProps {
  /** Persist the new workflow. Should reject with an Error on failure. */
  onCreate: (name: string, description?: string) => Promise<void>;
  onClose: () => void;
}

export const WorkflowCreateDialog: React.FC<WorkflowCreateDialogProps> = ({ onCreate, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a workflow name');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      await onCreate(trimmedName, description.trim() || undefined);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to create workflow');
      setIsCreating(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: '10px',
    padding: '24px',
    width: '440px',
    maxWidth: '90vw',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const buttonStyle = (primary: boolean, disabled = false): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: primary ? 'var(--status-running)' : '#ffffff',
    color: primary ? '#ffffff' : '#374151',
    border: primary ? 'none' : '1px solid #d1d5db',
    opacity: disabled ? 0.6 : 1,
  });

  return (
    <div style={overlayStyle} onClick={() => { if (!isCreating) onClose(); }}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
          🆕 New Workflow
        </div>
        <div style={{ fontSize: '13px', color: 'var(--status-neutral)', marginBottom: '20px' }}>
          Creates an empty workflow. Add nodes and edges on the canvas, then Start or Export when ready.
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle} htmlFor="new-workflow-name">Name</label>
          <input
            id="new-workflow-name"
            style={inputStyle}
            value={name}
            autoFocus
            placeholder="My Workflow"
            disabled={isCreating}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle} htmlFor="new-workflow-description">Description (optional)</label>
          <textarea
            id="new-workflow-description"
            style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
            value={description}
            placeholder="What does this workflow do?"
            disabled={isCreating}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button style={buttonStyle(false, isCreating)} onClick={onClose} disabled={isCreating}>
            Cancel
          </button>
          <button style={buttonStyle(true, isCreating || !name.trim())} onClick={handleSubmit} disabled={isCreating || !name.trim()}>
            {isCreating ? 'Creating…' : 'Create Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
};
