/**
 * UserInputNodeConfig Component
 * Configuration panel for User Input workflow nodes
 *
 * Features:
 * - Prompt configuration (what to ask user)
 * - Input type selector (text, textarea, number, select)
 * - Validation rules (required, min/max length, pattern)
 * - Options builder for select type
 * - Default value input
 * - Full accessibility support
 */

import React, { useState } from 'react';
import { UserInputNode } from '../../../../types/workflow-nodes';

export interface UserInputNodeConfigProps {
  node: UserInputNode;
  onChange: (updates: Partial<UserInputNode>) => void;
  errors: Record<string, string>;
}

export const UserInputNodeConfig: React.FC<UserInputNodeConfigProps> = ({
  node,
  onChange,
  errors,
}) => {
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');

  const handleChange = (field: keyof UserInputNode, value: any) => {
    onChange({ [field]: value });
  };

  const handleValidationChange = (field: string, value: any) => {
    onChange({
      validation: {
        ...node.validation,
        [field]: value === '' ? undefined : value,
      },
    });
  };

  const addOption = () => {
    if (!newOptionLabel.trim() || !newOptionValue.trim()) return;

    const currentOptions = node.options || [];
    onChange({
      options: [...currentOptions, { label: newOptionLabel, value: newOptionValue }],
    });
    setNewOptionLabel('');
    setNewOptionValue('');
  };

  const removeOption = (index: number) => {
    const currentOptions = node.options || [];
    onChange({
      options: currentOptions.filter((_, i) => i !== index),
    });
  };

  return (
    <div style={styles.container}>
      {/* Prompt Text */}
      <div style={styles.field}>
        <label htmlFor="prompt-input" style={styles.label}>
          Prompt *
          <span style={styles.helperText}> (What to ask the user)</span>
        </label>
        <textarea
          id="prompt-input"
          style={errors.prompt ? { ...styles.textarea, ...styles.inputError } : styles.textarea}
          value={node.prompt}
          onChange={(e) => handleChange('prompt', e.target.value)}
          placeholder="e.g., What is the main character's name?"
          rows={3}
          aria-required="true"
          aria-invalid={!!errors.prompt}
          aria-describedby={errors.prompt ? 'prompt-error' : 'prompt-help'}
        />
        {errors.prompt && (
          <div id="prompt-error" style={styles.errorText} role="alert">
            {errors.prompt}
          </div>
        )}
        <div id="prompt-help" style={styles.helperTextBlock}>
          The question or instruction displayed to the user
        </div>
      </div>

      {/* Input Type */}
      <div style={styles.field}>
        <label htmlFor="input-type" style={styles.label}>
          Input Type *
        </label>
        <select
          id="input-type"
          style={styles.select}
          value={node.inputType}
          onChange={(e) => handleChange('inputType', e.target.value as UserInputNode['inputType'])}
          aria-describedby="input-type-help"
        >
          <option value="text">Text (single line)</option>
          <option value="textarea">Textarea (multiple lines)</option>
          <option value="number">Number</option>
          <option value="select">Select (dropdown)</option>
        </select>
        <div id="input-type-help" style={styles.helperTextBlock}>
          The type of input control to display
        </div>
      </div>

      {/* Required Checkbox */}
      <div style={styles.field}>
        <label style={styles.checkboxLabel}>
          <input
            id="required-checkbox"
            type="checkbox"
            checked={node.required}
            onChange={(e) => handleChange('required', e.target.checked)}
            style={styles.checkbox}
          />
          <span>Required Field</span>
        </label>
        <div style={styles.helperTextBlock}>
          User must provide a value before continuing
        </div>
      </div>

      {/* Validation Rules */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Validation Rules</h3>

        {/* Text/Textarea Length Constraints */}
        {(node.inputType === 'text' || node.inputType === 'textarea') && (
          <>
            <div style={styles.field}>
              <label htmlFor="min-length" style={styles.label}>
                Minimum Length
              </label>
              <input
                id="min-length"
                type="number"
                style={styles.input}
                value={node.validation?.minLength ?? ''}
                onChange={(e) => handleValidationChange('minLength', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g., 3"
                min="0"
                aria-describedby="min-length-help"
              />
              <div id="min-length-help" style={styles.helperTextBlock}>
                Minimum number of characters required
              </div>
            </div>

            <div style={styles.field}>
              <label htmlFor="max-length" style={styles.label}>
                Maximum Length
              </label>
              <input
                id="max-length"
                type="number"
                style={styles.input}
                value={node.validation?.maxLength ?? ''}
                onChange={(e) => handleValidationChange('maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g., 100"
                min="0"
                aria-describedby="max-length-help"
              />
              <div id="max-length-help" style={styles.helperTextBlock}>
                Maximum number of characters allowed
              </div>
            </div>

            <div style={styles.field}>
              <label htmlFor="pattern" style={styles.label}>
                Pattern (Regex)
              </label>
              <input
                id="pattern"
                type="text"
                style={styles.input}
                value={node.validation?.pattern ?? ''}
                onChange={(e) => handleValidationChange('pattern', e.target.value)}
                placeholder="e.g., ^[A-Z][a-z]+$"
                aria-describedby="pattern-help"
              />
              <div id="pattern-help" style={styles.helperTextBlock}>
                Regular expression pattern for validation
              </div>
            </div>
          </>
        )}

        {/* Number Constraints */}
        {node.inputType === 'number' && (
          <>
            <div style={styles.field}>
              <label htmlFor="min-value" style={styles.label}>
                Minimum Value
              </label>
              <input
                id="min-value"
                type="number"
                style={styles.input}
                value={node.validation?.min ?? ''}
                onChange={(e) => handleValidationChange('min', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., 0"
                aria-describedby="min-value-help"
              />
              <div id="min-value-help" style={styles.helperTextBlock}>
                Minimum numeric value allowed
              </div>
            </div>

            <div style={styles.field}>
              <label htmlFor="max-value" style={styles.label}>
                Maximum Value
              </label>
              <input
                id="max-value"
                type="number"
                style={styles.input}
                value={node.validation?.max ?? ''}
                onChange={(e) => handleValidationChange('max', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., 100"
                aria-describedby="max-value-help"
              />
              <div id="max-value-help" style={styles.helperTextBlock}>
                Maximum numeric value allowed
              </div>
            </div>
          </>
        )}
      </div>

      {/* Options Builder (for select type) */}
      {node.inputType === 'select' && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Select Options</h3>

          {/* Existing Options */}
          {node.options && node.options.length > 0 && (
            <div style={styles.optionsList}>
              {node.options.map((option, index) => (
                <div key={index} style={styles.optionItem}>
                  <div style={styles.optionContent}>
                    <span style={styles.optionLabel}>{option.label}</span>
                    <span style={styles.optionValue}>({option.value})</span>
                  </div>
                  <button
                    type="button"
                    style={styles.removeButton}
                    onClick={() => removeOption(index)}
                    aria-label={`Remove option ${option.label}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Option */}
          <div style={styles.field}>
            <label htmlFor="new-option-label" style={styles.label}>
              Add Option
            </label>
            <div style={styles.optionInputs}>
              <input
                id="new-option-label"
                type="text"
                style={{ ...styles.input, flex: 1 }}
                value={newOptionLabel}
                onChange={(e) => setNewOptionLabel(e.target.value)}
                placeholder="Label (e.g., Option 1)"
                aria-label="Option label"
              />
              <input
                id="new-option-value"
                type="text"
                style={{ ...styles.input, flex: 1 }}
                value={newOptionValue}
                onChange={(e) => setNewOptionValue(e.target.value)}
                placeholder="Value (e.g., option1)"
                aria-label="Option value"
              />
              <button
                type="button"
                style={styles.addButton}
                onClick={addOption}
                disabled={!newOptionLabel.trim() || !newOptionValue.trim()}
                aria-label="Add option"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Default Value */}
      <div style={styles.field}>
        <label htmlFor="default-value" style={styles.label}>
          Default Value
        </label>
        {node.inputType === 'number' ? (
          <input
            id="default-value"
            type="number"
            style={styles.input}
            value={node.defaultValue ?? ''}
            onChange={(e) => handleChange('defaultValue', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="e.g., 0"
            aria-describedby="default-value-help"
          />
        ) : node.inputType === 'select' ? (
          <select
            id="default-value"
            style={styles.select}
            value={(node.defaultValue as string) ?? ''}
            onChange={(e) => handleChange('defaultValue', e.target.value || undefined)}
            aria-describedby="default-value-help"
          >
            <option value="">None</option>
            {node.options?.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="default-value"
            type="text"
            style={styles.input}
            value={(node.defaultValue as string) ?? ''}
            onChange={(e) => handleChange('defaultValue', e.target.value || undefined)}
            placeholder="e.g., Default text"
            aria-describedby="default-value-help"
          />
        )}
        <div id="default-value-help" style={styles.helperTextBlock}>
          Pre-filled value when the user input is displayed
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#374151',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  },
  helperText: {
    fontWeight: 400,
    fontSize: '13px',
    color: '#6b7280',
  },
  helperTextBlock: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: 'white',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  inputError: {
    borderColor: '#ef4444',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
  },
  errorText: {
    fontSize: '12px',
    color: '#ef4444',
    fontWeight: 500,
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
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  optionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
  },
  optionContent: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: 500,
  },
  optionValue: {
    fontSize: '13px',
    color: '#6b7280',
  },
  optionInputs: {
    display: 'flex',
    gap: '8px',
    alignItems: 'stretch',
  },
  addButton: {
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'white',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  removeButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#ef4444',
    background: 'white',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
