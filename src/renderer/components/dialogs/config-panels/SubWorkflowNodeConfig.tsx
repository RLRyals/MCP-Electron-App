/**
 * SubWorkflowNodeConfig Component
 * Configuration panel for Sub-Workflow workflow nodes
 *
 * Features:
 * - Workflow selector dropdown
 * - Version selector (specific version or latest)
 * - Input mapping preview
 * - Timeout override configuration
 * - Full accessibility support
 */

import React from 'react';
import { SubWorkflowNode } from '../../../../types/workflow-nodes';

export interface SubWorkflowNodeConfigProps {
  node: SubWorkflowNode;
  onChange: (updates: Partial<SubWorkflowNode>) => void;
  errors: Record<string, string>;
  availableWorkflows?: Array<{
    id: string;
    name: string;
    description?: string;
    versions?: Array<{ version: string; createdAt: string }>;
  }>;
}

export const SubWorkflowNodeConfig: React.FC<SubWorkflowNodeConfigProps> = ({
  node,
  onChange,
  errors,
  availableWorkflows = [],
}) => {
  const handleChange = (field: keyof SubWorkflowNode, value: any) => {
    onChange({ [field]: value });
  };

  const selectedWorkflow = availableWorkflows.find((wf) => wf.id === node.subWorkflowId);

  return (
    <div style={styles.container}>
      {/* Workflow Selector */}
      <div style={styles.field}>
        <label htmlFor="workflow-select" style={styles.label}>
          Sub-Workflow *
        </label>
        <select
          id="workflow-select"
          style={errors.subWorkflowId ? { ...styles.select, ...styles.inputError } : styles.select}
          value={node.subWorkflowId}
          onChange={(e) => handleChange('subWorkflowId', e.target.value)}
          aria-required="true"
          aria-invalid={!!errors.subWorkflowId}
          aria-describedby={errors.subWorkflowId ? 'workflow-select-error' : 'workflow-select-help'}
        >
          <option value="">Select a workflow...</option>
          {availableWorkflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflow.name}
            </option>
          ))}
        </select>
        {errors.subWorkflowId && (
          <div id="workflow-select-error" style={styles.errorText} role="alert">
            {errors.subWorkflowId}
          </div>
        )}
        <div id="workflow-select-help" style={styles.helperTextBlock}>
          The workflow to execute as a nested step
        </div>
      </div>

      {/* Selected Workflow Info */}
      {selectedWorkflow && (
        <div style={styles.infoBox}>
          <div style={styles.infoContent}>
            <strong>{selectedWorkflow.name}</strong>
            {selectedWorkflow.description && (
              <div style={styles.workflowDescription}>{selectedWorkflow.description}</div>
            )}
          </div>
        </div>
      )}

      {/* Version Selector */}
      <div style={styles.field}>
        <label htmlFor="version-select" style={styles.label}>
          Workflow Version
        </label>
        <select
          id="version-select"
          style={styles.select}
          value={node.subWorkflowVersion || 'latest'}
          onChange={(e) => handleChange('subWorkflowVersion', e.target.value === 'latest' ? undefined : e.target.value)}
          aria-describedby="version-select-help"
        >
          <option value="latest">Latest Version (Recommended)</option>
          {selectedWorkflow?.versions?.map((version) => (
            <option key={version.version} value={version.version}>
              Version {version.version} ({new Date(version.createdAt).toLocaleDateString()})
            </option>
          ))}
        </select>
        <div id="version-select-help" style={styles.helperTextBlock}>
          Use latest version or pin to a specific version for stability
        </div>
      </div>

      {/* Input Mapping Preview */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Input/Output Mapping</h3>

        <div style={styles.infoBox}>
          <span style={styles.infoIcon}>ℹ</span>
          <div style={styles.infoContent}>
            <strong>Context Mapping:</strong> Configure input and output mappings in the "Context"
            tab. Inputs define what data flows into the sub-workflow, and outputs define what
            data flows back to the parent workflow.
          </div>
        </div>

        {/* Display current context config preview */}
        {node.contextConfig.mode === 'advanced' && (
          <div style={styles.mappingPreview}>
            <div style={styles.mappingSection}>
              <div style={styles.mappingTitle}>Inputs:</div>
              {node.contextConfig.inputs && node.contextConfig.inputs.length > 0 ? (
                <ul style={styles.mappingList}>
                  {node.contextConfig.inputs.map((mapping, index) => (
                    <li key={index} style={styles.mappingItem}>
                      <code style={styles.mappingCode}>
                        {mapping.source} → {mapping.target}
                      </code>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={styles.emptyMapping}>No input mappings configured</div>
              )}
            </div>

            <div style={styles.mappingSection}>
              <div style={styles.mappingTitle}>Outputs:</div>
              {node.contextConfig.outputs && node.contextConfig.outputs.length > 0 ? (
                <ul style={styles.mappingList}>
                  {node.contextConfig.outputs.map((mapping, index) => (
                    <li key={index} style={styles.mappingItem}>
                      <code style={styles.mappingCode}>
                        {mapping.source} → {mapping.target}
                      </code>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={styles.emptyMapping}>No output mappings configured</div>
              )}
            </div>
          </div>
        )}

        {node.contextConfig.mode === 'simple' && (
          <div style={styles.simpleModeNote}>
            <strong>Simple Mode:</strong> All context data is automatically passed to the
            sub-workflow and all results are merged back. Switch to Advanced mode in the
            Context tab for explicit control.
          </div>
        )}
      </div>

      {/* Timeout Override */}
      <div style={styles.field}>
        <label htmlFor="timeout-override" style={styles.label}>
          Timeout Override (ms)
        </label>
        <input
          id="timeout-override"
          type="number"
          style={styles.input}
          value={node.timeoutMs ?? ''}
          onChange={(e) => handleChange('timeoutMs', e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="e.g., 300000 (5 minutes)"
          min="1000"
          max="3600000"
          aria-describedby="timeout-override-help"
        />
        <div id="timeout-override-help" style={styles.helperTextBlock}>
          Maximum time for the sub-workflow to complete (in milliseconds). Leave empty to use default.
        </div>
      </div>

      {/* Warning Box */}
      {!node.subWorkflowId && (
        <div style={styles.warningBox}>
          <span style={styles.warningIcon}>⚠</span>
          <div style={styles.warningContent}>
            <strong>Required:</strong> You must select a sub-workflow to execute. The workflow
            cannot run until a valid sub-workflow is selected.
          </div>
        </div>
      )}

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
          Pause execution for manual review before executing the sub-workflow
        </div>
      </div>

      {/* Best Practices */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Best Practices</h3>

        <ul style={styles.bestPracticesList}>
          <li style={styles.bestPracticeItem}>
            <strong>Version Pinning:</strong> Use "Latest" for active development, but pin to a
            specific version for production workflows to ensure stability.
          </li>
          <li style={styles.bestPracticeItem}>
            <strong>Context Mapping:</strong> Use Advanced mode to explicitly define what data
            flows in and out for better clarity and debugging.
          </li>
          <li style={styles.bestPracticeItem}>
            <strong>Timeout:</strong> Set appropriate timeouts based on the expected execution
            time of the sub-workflow to prevent hanging.
          </li>
          <li style={styles.bestPracticeItem}>
            <strong>Avoid Circular References:</strong> Ensure the sub-workflow doesn't call
            back to this workflow to prevent infinite loops.
          </li>
        </ul>
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
  workflowDescription: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#4b5563',
  },
  warningBox: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: '6px',
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: '20px',
    flexShrink: 0,
  },
  warningContent: {
    fontSize: '13px',
    color: '#92400e',
    lineHeight: '1.5',
  },
  mappingPreview: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  mappingSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  mappingTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
  },
  mappingList: {
    margin: 0,
    padding: '0 0 0 20px',
    listStyle: 'none',
  },
  mappingItem: {
    fontSize: '12px',
    color: '#4b5563',
    marginBottom: '4px',
  },
  mappingCode: {
    fontSize: '12px',
    fontFamily: 'monospace',
    background: '#f3f4f6',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  emptyMapping: {
    fontSize: '12px',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  simpleModeNote: {
    fontSize: '13px',
    color: '#4b5563',
    lineHeight: '1.5',
  },
  bestPracticesList: {
    margin: 0,
    padding: '0 0 0 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  bestPracticeItem: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: '1.5',
  },
};
