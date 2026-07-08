/**
 * PhaseEditDialog Component
 * Modal dialog for editing workflow phase properties
 *
 * Features:
 * - Edit phase name, agent, skill, description
 * - Change phase type
 * - Toggle gate and approval settings
 * - Select sub-workflow for subworkflow type
 */

import React, { useState, useEffect } from 'react';

export interface PhaseData {
  id: number;
  name: string;
  type:
    | 'planning'
    | 'writing'
    | 'gate'
    | 'user-input'
    | 'user'
    | 'code'
    | 'http'
    | 'file'
    | 'conditional'
    | 'loop'
    | 'subworkflow';
  agent: string;
  skill?: string;
  description: string;
  gate: boolean;
  gateCondition?: string;
  requiresApproval: boolean;
  subWorkflowId?: string;
  position?: { x: number; y: number };
}

export interface PhaseEditDialogProps {
  phase: PhaseData;
  workflows?: Array<{ id: string; name: string }>;
  onSave: (updatedPhase: PhaseData) => void;
  onCancel: () => void;
  onEditAgent?: (agentName: string) => void;
  onEditSkill?: (skillName: string) => void;
}

export const PhaseEditDialog: React.FC<PhaseEditDialogProps> = ({
  phase,
  workflows = [],
  onSave,
  onCancel,
  onEditAgent,
  onEditSkill,
}) => {
  const [formData, setFormData] = useState<PhaseData>(phase);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData(phase);
  }, [phase]);

  const handleChange = (field: keyof PhaseData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-clear subWorkflowId if type is not subworkflow
      if (field === 'type' && value !== 'subworkflow') {
        delete updated.subWorkflowId;
      }

      return updated;
    });

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Phase name is required';
    }

    if (!formData.agent?.trim()) {
      newErrors.agent = 'Agent is required';
    }

    if (formData.type === 'subworkflow' && !formData.subWorkflowId) {
      newErrors.subWorkflowId = 'Sub-workflow must be selected for subworkflow type';
    }

    if (formData.gate && !formData.gateCondition?.trim()) {
      newErrors.gateCondition = 'Gate condition is required when gate is enabled';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div style={styles.header}>
          <h2 style={styles.title}>Edit Phase</h2>
          <button style={styles.closeButton} onClick={onCancel}>✕</button>
        </div>

        <div style={styles.content}>
          {/* Phase Name */}
          <div style={styles.field}>
            <label style={styles.label}>Phase Name *</label>
            <input
              type="text"
              style={errors.name ? { ...styles.input, ...styles.inputError } : styles.input}
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Market Research"
              autoFocus
            />
            {errors.name && <div style={styles.errorText}>{errors.name}</div>}
          </div>

          {/* Phase Type */}
          <div style={styles.field}>
            <label style={styles.label}>Phase Type *</label>
            <select
              style={styles.select}
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
            >
              <option value="planning">📋 Planning</option>
              <option value="writing">✍️ Writing</option>
              <option value="gate">🚪 Gate</option>
              <option value="user">👤 User</option>
              <option value="loop">🔄 Loop</option>
              <option value="subworkflow">🔗 Sub-Workflow</option>
            </select>
          </div>

          {/* Agent */}
          <div style={styles.field}>
            <label style={styles.label}>Agent *</label>
            <div style={styles.inputWithButton}>
              <input
                type="text"
                style={errors.agent ? { ...styles.inputFlex, ...styles.inputError } : styles.inputFlex}
                value={formData.agent}
                onChange={(e) => handleChange('agent', e.target.value)}
                placeholder="e.g., market-research-agent"
              />
              {onEditAgent && formData.agent && (
                <button
                  type="button"
                  style={styles.editFileButton}
                  onClick={() => onEditAgent(formData.agent)}
                  title="Edit agent file"
                >
                  📝 Edit
                </button>
              )}
            </div>
            {errors.agent && <div style={styles.errorText}>{errors.agent}</div>}
          </div>

          {/* Skill */}
          <div style={styles.field}>
            <label style={styles.label}>Skill (Optional)</label>
            <div style={styles.inputWithButton}>
              <input
                type="text"
                style={styles.inputFlex}
                value={formData.skill || ''}
                onChange={(e) => handleChange('skill', e.target.value || undefined)}
                placeholder="e.g., market-driven-planning-skill"
              />
              {onEditSkill && formData.skill && (
                <button
                  type="button"
                  style={styles.editFileButton}
                  onClick={() => onEditSkill(formData.skill!)}
                  title="Edit skill file"
                >
                  📝 Edit
                </button>
              )}
            </div>
          </div>

          {/* Sub-Workflow Selection (only for subworkflow type) */}
          {formData.type === 'subworkflow' && (
            <div style={styles.field}>
              <label style={styles.label}>Sub-Workflow *</label>
              <select
                style={errors.subWorkflowId ? { ...styles.select, ...styles.inputError } : styles.select}
                value={formData.subWorkflowId || ''}
                onChange={(e) => handleChange('subWorkflowId', e.target.value)}
              >
                <option value="">Select a workflow...</option>
                {workflows.map(wf => (
                  <option key={wf.id} value={wf.id}>{wf.name}</option>
                ))}
              </select>
              {errors.subWorkflowId && <div style={styles.errorText}>{errors.subWorkflowId}</div>}
            </div>
          )}

          {/* Description */}
          <div style={styles.field}>
            <label style={styles.label}>Description</label>
            <textarea
              style={styles.textarea}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe what this phase does..."
              rows={3}
            />
          </div>

          {/* Gate Checkbox */}
          <div style={styles.checkboxField}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.gate}
                onChange={(e) => handleChange('gate', e.target.checked)}
                style={styles.checkbox}
              />
              <span>Quality Gate</span>
            </label>
          </div>

          {/* Gate Condition (only if gate is checked) */}
          {formData.gate && (
            <div style={styles.field}>
              <label style={styles.label}>Gate Condition *</label>
              <input
                type="text"
                style={errors.gateCondition ? { ...styles.input, ...styles.inputError } : styles.input}
                value={formData.gateCondition || ''}
                onChange={(e) => handleChange('gateCondition', e.target.value)}
                placeholder="e.g., Score >= 80 to PASS"
              />
              {errors.gateCondition && <div style={styles.errorText}>{errors.gateCondition}</div>}
            </div>
          )}

          {/* Requires Approval Checkbox */}
          <div style={styles.checkboxField}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.requiresApproval}
                onChange={(e) => handleChange('requiresApproval', e.target.checked)}
                style={styles.checkbox}
              />
              <span>Requires User Approval</span>
            </label>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button style={styles.saveButton} onClick={handleSave}>
            Save Changes
          </button>
        </div>

        <div style={styles.hint}>
          Press <kbd style={styles.kbd}>Ctrl+Enter</kbd> to save, <kbd style={styles.kbd}>Esc</kbd> to cancel
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
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '20px',
  },
  dialog: {
    background: 'white',
    borderRadius: '12px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#1f2937',
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
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  field: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  inputWithButton: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  editFileButton: {
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6366f1',
    background: 'white',
    border: '1px solid #c7d2fe',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    background: 'white',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: '12px',
    color: '#ef4444',
    marginTop: '4px',
  },
  checkboxField: {
    marginBottom: '16px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #e5e7eb',
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
