/**
 * DocumentEditDialog Component
 * Modal dialog for editing agent and skill markdown files
 *
 * Features:
 * - Full markdown editor with syntax highlighting
 * - Save/Cancel with keyboard shortcuts
 * - Auto-save option
 * - File path display
 */

import React, { useState, useEffect, useCallback } from 'react';

export interface DocumentEditDialogProps {
  type: 'agent' | 'skill';
  name: string;
  content: string;
  filePath: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export const DocumentEditDialog: React.FC<DocumentEditDialogProps> = ({
  type,
  name,
  content: initialContent,
  filePath,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(initialContent);
    setHasChanges(false);
  }, [initialContent]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(newContent !== initialContent);
  };

  const handleSave = async () => {
    if (!hasChanges) {
      onCancel();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(content);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmed) return;
    }
    onCancel();
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [hasChanges, content]
  );

  const typeLabel = type === 'agent' ? 'Agent' : 'Skill';
  const typeIcon = type === 'agent' ? '🤖' : '⚙️';

  return (
    <div style={styles.overlay} onClick={handleCancel}>
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={{ fontSize: '24px' }}>{typeIcon}</span>
            <div>
              <h2 style={styles.title}>
                Edit {typeLabel}: {name}
              </h2>
              <div style={styles.filePath}>{filePath}</div>
            </div>
          </div>
          <button style={styles.closeButton} onClick={handleCancel}>
            ✕
          </button>
        </div>

        {/* Editor */}
        <div style={styles.editorContainer}>
          <textarea
            style={styles.editor}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={`Enter ${typeLabel.toLowerCase()} content in markdown format...`}
            autoFocus
            spellCheck={false}
          />
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.footerLeft}>
            {hasChanges && <div style={styles.unsavedIndicator}>● Unsaved changes</div>}
          </div>
          <div style={styles.footerRight}>
            <button style={styles.cancelButton} onClick={handleCancel} disabled={isSaving}>
              Cancel
            </button>
            <button
              style={{
                ...styles.saveButton,
                opacity: !hasChanges || isSaving ? 0.6 : 1,
              }}
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Keyboard hints */}
        <div style={styles.hint}>
          Press <kbd style={styles.kbd}>Ctrl+S</kbd> to save, <kbd style={styles.kbd}>Esc</kbd>{' '}
          to cancel
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    padding: '20px',
  },
  dialog: {
    background: 'white',
    borderRadius: '12px',
    width: '90vw',
    maxWidth: '1200px',
    height: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 80px rgba(0, 0, 0, 0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px',
    borderBottom: '1px solid #e5e7eb',
  },
  headerLeft: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
    flex: 1,
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#1f2937',
  },
  filePath: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#6b7280',
    fontFamily: 'Consolas, Monaco, monospace',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'color 0.2s',
  },
  editorContainer: {
    flex: 1,
    overflow: 'hidden',
    padding: '24px',
    background: '#f9fafb',
  },
  editor: {
    width: '100%',
    height: '100%',
    padding: '20px',
    fontSize: '14px',
    lineHeight: '1.6',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    resize: 'none',
    background: 'white',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderTop: '1px solid #e5e7eb',
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    display: 'flex',
    gap: '12px',
  },
  unsavedIndicator: {
    fontSize: '13px',
    color: '#f59e0b',
    fontWeight: 600,
  },
  cancelButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  saveButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  hint: {
    padding: '12px 24px',
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'center',
    borderTop: '1px solid #e5e7eb',
  },
  kbd: {
    padding: '2px 6px',
    fontSize: '11px',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '3px',
    fontFamily: 'monospace',
  },
};
