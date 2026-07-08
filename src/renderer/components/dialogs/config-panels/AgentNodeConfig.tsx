/**
 * AgentNodeConfig Component
 * Configuration panel for Agent workflow nodes (planning, writing, gate types)
 *
 * Features:
 * - Agent selector with custom input support
 * - Skill selector with custom input support
 * - Edit Agent and Edit Skill buttons
 * - System prompt textarea for optional override
 * - Gate-specific configuration when applicable
 * - Full accessibility support
 */

import React from 'react';
import { AgentWorkflowNode } from '../../../../types/workflow-nodes';

export interface AgentNodeConfigProps {
  node: AgentWorkflowNode;
  onChange: (updates: Partial<AgentWorkflowNode>) => void;
  errors: Record<string, string>;
  onEditAgent?: (agentName: string) => void;
  onEditSkill?: (skillName: string) => void;
}

export const AgentNodeConfig: React.FC<AgentNodeConfigProps> = ({
  node,
  onChange,
  errors,
  onEditAgent,
  onEditSkill,
}) => {
  const handleChange = (field: keyof AgentWorkflowNode, value: any) => {
    onChange({ [field]: value });
  };

  const handleProviderChange = (field: string, value: any) => {
    onChange({
      provider: {
        ...node.provider,
        [field]: value,
      },
    });
  };

  return (
    <div style={styles.container}>
      {/* Agent Selection */}
      <div style={styles.field}>
        <label htmlFor="agent-input" style={styles.label}>
          Agent *
          <span style={styles.helperText}> (Name of the agent to use)</span>
        </label>
        <div style={styles.inputWithButton}>
          <input
            id="agent-input"
            type="text"
            style={errors.agent ? { ...styles.inputFlex, ...styles.inputError } : styles.inputFlex}
            value={node.agent}
            onChange={(e) => handleChange('agent', e.target.value)}
            placeholder="e.g., series-architect-agent"
            aria-required="true"
            aria-invalid={!!errors.agent}
            aria-describedby={errors.agent ? 'agent-error' : 'agent-help'}
          />
          {onEditAgent && node.agent && (
            <button
              type="button"
              style={styles.editButton}
              onClick={() => onEditAgent(node.agent)}
              title="Edit agent file"
              aria-label="Edit agent file"
            >
              Edit Agent
            </button>
          )}
        </div>
        {errors.agent && (
          <div id="agent-error" style={styles.errorText} role="alert">
            {errors.agent}
          </div>
        )}
        <div id="agent-help" style={styles.helperTextBlock}>
          The agent defines the AI behavior and capabilities for this node
        </div>
      </div>

      {/* Skill Selection */}
      <div style={styles.field}>
        <label htmlFor="skill-input" style={styles.label}>
          Skill (Optional)
          <span style={styles.helperText}> (Specialized skill for the agent)</span>
        </label>
        <div style={styles.inputWithButton}>
          <input
            id="skill-input"
            type="text"
            style={styles.inputFlex}
            value={node.skill || ''}
            onChange={(e) => handleChange('skill', e.target.value || undefined)}
            placeholder="e.g., series-planning-skill"
            aria-describedby="skill-help"
          />
          {onEditSkill && node.skill && (
            <button
              type="button"
              style={styles.editButton}
              onClick={() => onEditSkill(node.skill!)}
              title="Edit skill file"
              aria-label="Edit skill file"
            >
              Edit Skill
            </button>
          )}
        </div>
        <div id="skill-help" style={styles.helperTextBlock}>
          Skills provide specialized capabilities to agents
        </div>
      </div>

      {/* LLM Provider Configuration */}
      <div style={styles.field}>
        <label htmlFor="provider-name" style={styles.label}>
          LLM Provider *
        </label>
        <input
          id="provider-name"
          type="text"
          style={errors.provider ? { ...styles.input, ...styles.inputError } : styles.input}
          value={node.provider.name}
          onChange={(e) => handleProviderChange('name', e.target.value)}
          placeholder="e.g., anthropic, openai"
          aria-required="true"
          aria-invalid={!!errors.provider}
          aria-describedby={errors.provider ? 'provider-error' : 'provider-help'}
        />
        {errors.provider && (
          <div id="provider-error" style={styles.errorText} role="alert">
            {errors.provider}
          </div>
        )}
        <div id="provider-help" style={styles.helperTextBlock}>
          The AI provider for this node (e.g., anthropic, openai, ollama)
        </div>
      </div>

      <div style={styles.field}>
        <label htmlFor="provider-model" style={styles.label}>
          Model *
        </label>
        <input
          id="provider-model"
          type="text"
          style={errors.model ? { ...styles.input, ...styles.inputError } : styles.input}
          value={(node.provider?.config as any)?.model || ''}
          onChange={(e) => handleProviderChange('model', e.target.value)}
          placeholder="e.g., claude-sonnet-4-5-20250929"
          aria-required="true"
          aria-invalid={!!errors.model}
          aria-describedby="model-help"
        />
        {errors.model && (
          <div style={styles.errorText} role="alert">
            {errors.model}
          </div>
        )}
        <div id="model-help" style={styles.helperTextBlock}>
          The specific model version to use
        </div>
      </div>

      {/* Gate-specific Configuration */}
      {node.type === 'gate' && (
        <>
          <div style={styles.field}>
            <label style={styles.checkboxLabel}>
              <input
                id="gate-enabled"
                type="checkbox"
                checked={node.gate}
                onChange={(e) => handleChange('gate', e.target.checked)}
                style={styles.checkbox}
              />
              <span>Enable Quality Gate</span>
            </label>
          </div>

          {node.gate && (
            <div style={styles.field}>
              <label htmlFor="gate-condition" style={styles.label}>
                Gate Condition *
                <span style={styles.helperText}> (Condition for gate to pass)</span>
              </label>
              <input
                id="gate-condition"
                type="text"
                style={errors.gateCondition ? { ...styles.input, ...styles.inputError } : styles.input}
                value={node.gateCondition || ''}
                onChange={(e) => handleChange('gateCondition', e.target.value)}
                placeholder="e.g., $.score >= 80"
                aria-required="true"
                aria-invalid={!!errors.gateCondition}
                aria-describedby={errors.gateCondition ? 'gate-condition-error' : 'gate-condition-help'}
              />
              {errors.gateCondition && (
                <div id="gate-condition-error" style={styles.errorText} role="alert">
                  {errors.gateCondition}
                </div>
              )}
              <div id="gate-condition-help" style={styles.helperTextBlock}>
                JSONPath expression that must evaluate to true for the gate to pass
              </div>
            </div>
          )}
        </>
      )}

      {/* System Prompt Override (Advanced) */}
      <div style={styles.field}>
        <label htmlFor="system-prompt" style={styles.label}>
          System Prompt Override (Optional)
        </label>
        <textarea
          id="system-prompt"
          style={styles.textarea}
          value={(node.provider?.config as any)?.systemPrompt || ''}
          onChange={(e) => handleProviderChange('systemPrompt', e.target.value || undefined)}
          placeholder="Enter custom system prompt to override agent defaults..."
          rows={6}
          aria-describedby="system-prompt-help"
        />
        <div id="system-prompt-help" style={styles.helperTextBlock}>
          Override the default system prompt from the agent configuration
        </div>
      </div>

      {/* Approval Required */}
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
          Pause execution for manual review before proceeding
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
  inputWithButton: {
    display: 'flex',
    gap: '8px',
    alignItems: 'stretch',
  },
  inputFlex: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  inputError: {
    borderColor: '#ef4444',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
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
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    boxSizing: 'border-box',
  },
  editButton: {
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
};
