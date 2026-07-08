import React, { useState, useEffect } from 'react';

interface CreateSkillDialogProps {
  installedSkills: string[];
  onSave: (name: string, content: string) => Promise<void>;
  onCancel: () => void;
}

export const CreateSkillDialog: React.FC<CreateSkillDialogProps> = ({
  installedSkills,
  onSave,
  onCancel
}) => {
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState<'blank' | 'copy'>('blank');
  const [copyFrom, setCopyFrom] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Validation
  const validateName = (value: string): string | null => {
    if (!value.trim()) return 'Skill name is required';
    if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase, numbers, and dashes only';
    if (installedSkills.includes(value)) return 'Skill already exists';
    return null;
  };

  // Template content
  const getBlankTemplate = (skillName: string) => `---
name: ${skillName || 'skill-name'}
description: [Brief description of what this skill does]
metadata:
  version: "1.0"
  agents: []
---

# ${skillName ? skillName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Skill Name'}

## Overview

[Describe the skill's purpose and what it helps accomplish]

## Workflow

[Describe the workflow steps and how this skill operates]

## Requirements

- [List any prerequisites or dependencies]

## Usage

[Explain how to use this skill effectively]
`;

  // Load copy-from content when selected
  useEffect(() => {
    if (templateType === 'copy' && copyFrom) {
      (async () => {
        try {
          const result = await (window as any).electronAPI.document.readSkill(copyFrom);
          setContent(result.content || '');
        } catch (error) {
          console.error('Failed to load skill:', error);
          setContent(getBlankTemplate(name));
        }
      })();
    } else if (templateType === 'blank') {
      setContent(getBlankTemplate(name));
    }
  }, [templateType, copyFrom, name]);

  const handleSave = async () => {
    const nameError = validateName(name);
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }

    setIsSaving(true);
    try {
      await onSave(name, content);
    } catch (error: any) {
      alert(`Failed to create skill: ${error.message}`);
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    } as React.CSSProperties,
    dialog: {
      backgroundColor: 'white',
      borderRadius: '8px',
      width: '90%',
      maxWidth: '700px',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
    } as React.CSSProperties,
    header: {
      padding: '20px 24px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    } as React.CSSProperties,
    title: {
      fontSize: '18px',
      fontWeight: 600,
      margin: 0
    } as React.CSSProperties,
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '20px',
      cursor: 'pointer',
      color: '#6b7280',
      padding: '4px 8px'
    } as React.CSSProperties,
    content: {
      padding: '24px',
      overflowY: 'auto',
      flex: 1
    } as React.CSSProperties,
    field: {
      marginBottom: '20px'
    } as React.CSSProperties,
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: 500,
      marginBottom: '6px',
      color: '#374151'
    } as React.CSSProperties,
    input: {
      width: '100%',
      padding: '8px 12px',
      fontSize: '14px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      boxSizing: 'border-box'
    } as React.CSSProperties,
    inputError: {
      borderColor: '#ef4444'
    } as React.CSSProperties,
    select: {
      width: '100%',
      padding: '8px 12px',
      fontSize: '14px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      backgroundColor: 'white',
      cursor: 'pointer'
    } as React.CSSProperties,
    textarea: {
      width: '100%',
      padding: '8px 12px',
      fontSize: '13px',
      fontFamily: 'monospace',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      resize: 'vertical',
      boxSizing: 'border-box'
    } as React.CSSProperties,
    error: {
      color: '#ef4444',
      fontSize: '12px',
      marginTop: '4px'
    } as React.CSSProperties,
    helperText: {
      fontSize: '12px',
      color: '#6b7280',
      marginTop: '4px'
    } as React.CSSProperties,
    footer: {
      padding: '16px 24px',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px'
    } as React.CSSProperties,
    button: {
      padding: '8px 16px',
      fontSize: '14px',
      fontWeight: 500,
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    } as React.CSSProperties,
    cancelButton: {
      background: 'white',
      color: '#374151'
    } as React.CSSProperties,
    saveButton: {
      background: '#3b82f6',
      color: 'white',
      borderColor: '#3b82f6'
    } as React.CSSProperties,
    saveButtonDisabled: {
      background: '#9ca3af',
      borderColor: '#9ca3af',
      cursor: 'not-allowed'
    } as React.CSSProperties
  };

  const saveDisabled = !name || !!errors.name || isSaving;

  return (
    <div style={styles.overlay} onClick={onCancel} onKeyDown={handleKeyDown}>
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-skill-title"
      >
        <div style={styles.header}>
          <h2 id="create-skill-title" style={styles.title}>
            Create New Skill
          </h2>
          <button
            style={styles.closeButton}
            onClick={onCancel}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div style={styles.content}>
          {/* Name Field */}
          <div style={styles.field}>
            <label htmlFor="skill-name" style={styles.label}>
              Skill Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="skill-name"
              type="text"
              style={errors.name ? { ...styles.input, ...styles.inputError } : styles.input}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors({});
              }}
              placeholder="e.g., my-custom-skill"
              autoFocus
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'skill-name-error' : 'skill-name-helper'}
            />
            {errors.name && (
              <div id="skill-name-error" style={styles.error} role="alert">
                {errors.name}
              </div>
            )}
            <div id="skill-name-helper" style={styles.helperText}>
              Use lowercase, numbers, and dashes only
            </div>
          </div>

          {/* Template Type */}
          <div style={styles.field}>
            <label htmlFor="template-type" style={styles.label}>
              Template
            </label>
            <select
              id="template-type"
              style={styles.select}
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as 'blank' | 'copy')}
            >
              <option value="blank">Blank Skill</option>
              <option value="copy">Copy from Existing...</option>
            </select>
          </div>

          {/* Copy From */}
          {templateType === 'copy' && (
            <div style={styles.field}>
              <label htmlFor="copy-from" style={styles.label}>
                Copy From
              </label>
              <select
                id="copy-from"
                style={styles.select}
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
              >
                <option value="">Select skill to copy...</option>
                {installedSkills.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Content Editor */}
          <div style={styles.field}>
            <label htmlFor="skill-content" style={styles.label}>
              Initial Content
            </label>
            <textarea
              id="skill-content"
              style={styles.textarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              placeholder="Enter skill definition..."
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.button, ...styles.cancelButton }}
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            style={
              saveDisabled
                ? { ...styles.button, ...styles.saveButtonDisabled }
                : { ...styles.button, ...styles.saveButton }
            }
            onClick={handleSave}
            disabled={saveDisabled}
          >
            {isSaving ? 'Creating...' : 'Create Skill'}
          </button>
        </div>
      </div>
    </div>
  );
};
