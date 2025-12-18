/**
 * ProjectCreationDialog Component
 * Dialog for creating new projects
 */

import React, { useState } from 'react';
import type { Project } from '../../types/project';

export interface ProjectCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export const ProjectCreationDialog: React.FC<ProjectCreationDialogProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBrowseFolder = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.dialog) {
      console.error('[ProjectCreationDialog] Dialog API not available');
      return;
    }

    try {
      const result = await electronAPI.dialog.showOpenDialog({
        title: 'Select Project Folder',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Select Folder'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        setFolderPath(result.filePaths[0]);
      }
    } catch (err: any) {
      console.error('[ProjectCreationDialog] Failed to open folder dialog:', err);
      setError('Failed to open folder dialog');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!folderPath) {
      setError('Project folder is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const electronAPI = (window as any).electronAPI;
      const project = await electronAPI.invoke('project:create', {
        name: name.trim(),
        folder_path: folderPath,
      });

      console.log('[ProjectCreationDialog] Project created:', project);
      onProjectCreated(project);

      // Reset form
      setName('');
      setDescription('');
      setFolderPath('');
      onClose();
    } catch (err: any) {
      console.error('[ProjectCreationDialog] Failed to create project:', err);
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setFolderPath('');
    setError(null);
    onClose();
  };

  // Styles
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const dialogStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    minWidth: '500px',
    maxWidth: '600px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: '20px',
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '20px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '8px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '80px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  };

  const errorStyle: React.CSSProperties = {
    padding: '12px',
    background: '#fef2f2',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    color: '#991b1b',
    fontSize: '14px',
    marginBottom: '16px',
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px',
  };

  const buttonStyle = (variant: 'primary' | 'secondary' = 'secondary', disabled = false): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    background: variant === 'primary' ? '#3b82f6' : '#e5e7eb',
    color: variant === 'primary' ? 'white' : '#374151',
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={overlayStyle} onClick={handleCancel}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>Create New Project</h2>

        {error && (
          <div style={errorStyle}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Urban Fantasy Series"
              style={inputStyle}
              autoFocus
              disabled={creating}
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your project..."
              style={textareaStyle}
              disabled={creating}
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>
              Project Folder *
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={folderPath}
                readOnly
                placeholder="Click Browse to select folder..."
                style={{ ...inputStyle, flex: 1, background: '#f9fafb' }}
                disabled={creating}
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                style={{
                  ...buttonStyle('secondary', creating),
                  minWidth: '100px'
                }}
                disabled={creating}
              >
                Browse...
              </button>
            </div>
            {folderPath && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#6b7280',
                wordBreak: 'break-all'
              }}>
                Selected: {folderPath}
              </div>
            )}
          </div>

          <div style={buttonGroupStyle}>
            <button
              type="button"
              onClick={handleCancel}
              style={buttonStyle('secondary', creating)}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={buttonStyle('primary', creating)}
              disabled={creating || !name.trim() || !folderPath}
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
