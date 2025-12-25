/**
 * LoopNodeConfig Component
 * Configuration panel for Loop workflow nodes
 *
 * Features:
 * - Loop type selector (forEach, while, count)
 * - Dynamic fields based on loop type
 * - Iterator and index variable configuration
 * - Safety settings (max iterations, stop on error)
 * - Full accessibility support
 */

import React from 'react';
import { LoopNode } from '../../../../types/workflow-nodes';

export interface LoopNodeConfigProps {
  node: LoopNode;
  onChange: (updates: Partial<LoopNode>) => void;
  errors: Record<string, string>;
}

export const LoopNodeConfig: React.FC<LoopNodeConfigProps> = ({
  node,
  onChange,
  errors,
}) => {
  const handleChange = (field: keyof LoopNode, value: any) => {
    onChange({ [field]: value });
  };

  const handleLoopTypeChange = (loopType: LoopNode['loopType']) => {
    // Clear type-specific fields when switching loop types
    const updates: Partial<LoopNode> = { loopType };

    if (loopType !== 'forEach') {
      updates.collection = undefined;
    }
    if (loopType !== 'while') {
      updates.whileCondition = undefined;
      updates.maxIterations = undefined;
    }
    if (loopType !== 'count') {
      updates.count = undefined;
    }

    onChange(updates);
  };

  return (
    <div style={styles.container}>
      {/* Loop Type */}
      <div style={styles.field}>
        <label htmlFor="loop-type" style={styles.label}>
          Loop Type *
        </label>
        <select
          id="loop-type"
          style={styles.select}
          value={node.loopType}
          onChange={(e) => handleLoopTypeChange(e.target.value as LoopNode['loopType'])}
          aria-describedby="loop-type-help"
        >
          <option value="forEach">For Each (iterate over collection)</option>
          <option value="while">While (repeat while condition is true)</option>
          <option value="count">Count (repeat N times)</option>
        </select>
        <div id="loop-type-help" style={styles.helperTextBlock}>
          The type of loop iteration
        </div>
      </div>

      {/* forEach Configuration */}
      {node.loopType === 'forEach' && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>For Each Configuration</h3>

          <div style={styles.field}>
            <label htmlFor="collection-path" style={styles.label}>
              Collection Path *
              <span style={styles.helperText}> (JSONPath to array)</span>
            </label>
            <input
              id="collection-path"
              type="text"
              style={errors.collection ? { ...styles.input, ...styles.inputError } : styles.input}
              value={node.collection || ''}
              onChange={(e) => handleChange('collection', e.target.value)}
              placeholder="e.g., $.books or {{booksArray}}"
              aria-required="true"
              aria-invalid={!!errors.collection}
              aria-describedby={errors.collection ? 'collection-error' : 'collection-help'}
            />
            {errors.collection && (
              <div id="collection-error" style={styles.errorText} role="alert">
                {errors.collection}
              </div>
            )}
            <div id="collection-help" style={styles.helperTextBlock}>
              JSONPath expression pointing to an array to iterate over
            </div>
          </div>
        </div>
      )}

      {/* while Configuration */}
      {node.loopType === 'while' && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>While Configuration</h3>

          <div style={styles.field}>
            <label htmlFor="while-condition" style={styles.label}>
              While Condition *
              <span style={styles.helperText}> (Loop continues while true)</span>
            </label>
            <textarea
              id="while-condition"
              style={errors.whileCondition ? { ...styles.textarea, ...styles.inputError } : styles.textarea}
              value={node.whileCondition || ''}
              onChange={(e) => handleChange('whileCondition', e.target.value)}
              placeholder="e.g., $.hasMore === true"
              rows={3}
              spellCheck={false}
              aria-required="true"
              aria-invalid={!!errors.whileCondition}
              aria-describedby={errors.whileCondition ? 'while-condition-error' : 'while-condition-help'}
            />
            {errors.whileCondition && (
              <div id="while-condition-error" style={styles.errorText} role="alert">
                {errors.whileCondition}
              </div>
            )}
            <div id="while-condition-help" style={styles.helperTextBlock}>
              JSONPath expression that must evaluate to true to continue looping
            </div>
          </div>

          <div style={styles.field}>
            <label htmlFor="max-iterations" style={styles.label}>
              Max Iterations *
              <span style={styles.helperText}> (Safety limit)</span>
            </label>
            <input
              id="max-iterations"
              type="number"
              style={errors.maxIterations ? { ...styles.input, ...styles.inputError } : styles.input}
              value={node.maxIterations ?? ''}
              onChange={(e) => handleChange('maxIterations', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="e.g., 100"
              min="1"
              max="10000"
              aria-required="true"
              aria-invalid={!!errors.maxIterations}
              aria-describedby={errors.maxIterations ? 'max-iterations-error' : 'max-iterations-help'}
            />
            {errors.maxIterations && (
              <div id="max-iterations-error" style={styles.errorText} role="alert">
                {errors.maxIterations}
              </div>
            )}
            <div id="max-iterations-help" style={styles.helperTextBlock}>
              Maximum number of iterations to prevent infinite loops
            </div>
          </div>
        </div>
      )}

      {/* count Configuration */}
      {node.loopType === 'count' && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Count Configuration</h3>

          <div style={styles.field}>
            <label htmlFor="iteration-count" style={styles.label}>
              Number of Iterations *
            </label>
            <input
              id="iteration-count"
              type="number"
              style={errors.count ? { ...styles.input, ...styles.inputError } : styles.input}
              value={node.count ?? ''}
              onChange={(e) => handleChange('count', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="e.g., 10"
              min="1"
              max="10000"
              aria-required="true"
              aria-invalid={!!errors.count}
              aria-describedby={errors.count ? 'count-error' : 'count-help'}
            />
            {errors.count && (
              <div id="count-error" style={styles.errorText} role="alert">
                {errors.count}
              </div>
            )}
            <div id="count-help" style={styles.helperTextBlock}>
              How many times to repeat the loop
            </div>
          </div>
        </div>
      )}

      {/* Iterator Variables */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Loop Variables</h3>

        <div style={styles.field}>
          <label htmlFor="iterator-var" style={styles.label}>
            Iterator Variable Name *
            <span style={styles.helperText}> (Current item in loop)</span>
          </label>
          <input
            id="iterator-var"
            type="text"
            style={errors.iteratorVariable ? { ...styles.input, ...styles.inputError } : styles.input}
            value={node.iteratorVariable}
            onChange={(e) => handleChange('iteratorVariable', e.target.value)}
            placeholder={
              node.loopType === 'forEach'
                ? 'e.g., currentBook'
                : 'e.g., iteration'
            }
            aria-required="true"
            aria-invalid={!!errors.iteratorVariable}
            aria-describedby={errors.iteratorVariable ? 'iterator-var-error' : 'iterator-var-help'}
          />
          {errors.iteratorVariable && (
            <div id="iterator-var-error" style={styles.errorText} role="alert">
              {errors.iteratorVariable}
            </div>
          )}
          <div id="iterator-var-help" style={styles.helperTextBlock}>
            {node.loopType === 'forEach'
              ? 'Variable name for the current item in each iteration'
              : 'Variable name for the current iteration data'}
          </div>
        </div>

        <div style={styles.field}>
          <label htmlFor="index-var" style={styles.label}>
            Index Variable Name (Optional)
          </label>
          <input
            id="index-var"
            type="text"
            style={styles.input}
            value={node.indexVariable || ''}
            onChange={(e) => handleChange('indexVariable', e.target.value || undefined)}
            placeholder="e.g., bookIndex"
            aria-describedby="index-var-help"
          />
          <div id="index-var-help" style={styles.helperTextBlock}>
            Variable name for the iteration index (0-based)
          </div>
        </div>
      </div>

      {/* Loop Body Information */}
      <div style={styles.infoBox}>
        <span style={styles.infoIcon}>ℹ</span>
        <div style={styles.infoContent}>
          <strong>About Loop Body:</strong> Connect edges from this node to define what executes
          in each iteration. The loop continues until the condition is met or max iterations reached.
          Connect back to this node to repeat, or to another node to exit the loop.
        </div>
      </div>

      {/* Execution Settings */}
      <div style={styles.field}>
        <label style={styles.checkboxLabel}>
          <input
            id="requires-approval"
            type="checkbox"
            checked={node.requiresApproval}
            onChange={(e) => handleChange('requiresApproval', e.target.checked)}
            style={styles.checkbox}
          />
          <span>Requires User Approval</span>
        </label>
        <div style={styles.helperTextBlock}>
          Pause execution for manual review before starting the loop
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
  textarea: {
    width: '100%',
    padding: '12px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    resize: 'vertical',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: '1.5',
    boxSizing: 'border-box',
    background: '#f9fafb',
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
  infoBox: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: '#dbeafe',
    border: '1px solid #93c5fd',
    borderRadius: '6px',
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: '20px',
    flexShrink: 0,
  },
  infoContent: {
    fontSize: '13px',
    color: '#1e3a8a',
    lineHeight: '1.5',
  },
};
