/**
 * BlackboardNodeConfig Component
 * Configuration panel for Blackboard workflow nodes
 *
 * Features:
 * - Contributor list editor (add/remove contributors)
 * - Per-contributor role, agent, prompt, and order configuration
 * - Workspace format selector (document vs structured)
 * - Max rounds and convergence condition settings
 * - Initial content template editor
 */

import React from 'react';
import type { BlackboardNode, BlackboardContributor } from '../../../../types/workflow-nodes';

export interface BlackboardNodeConfigProps {
  node: BlackboardNode;
  onChange: (updates: Partial<BlackboardNode>) => void;
  errors: Record<string, string>;
}

export const BlackboardNodeConfig: React.FC<BlackboardNodeConfigProps> = ({
  node,
  onChange,
  errors,
}) => {
  const contributors = node.contributors || [];

  const addContributor = () => {
    const newContributor: BlackboardContributor = {
      id: `contrib-${Date.now()}`,
      name: `Contributor ${contributors.length + 1}`,
      role: '',
      agent: '',
      prompt: 'Review the current workspace and improve it based on your role.\n\nCurrent workspace:\n{{workspace}}\n\nThis is round {{round}}.',
      provider: { type: 'claude-code-cli', name: 'Claude Code', config: { model: 'claude-sonnet-4-5', outputFormat: 'text' as const } },
      order: 0,
    };
    onChange({ contributors: [...contributors, newContributor] });
  };

  const removeContributor = (id: string) => {
    onChange({ contributors: contributors.filter(c => c.id !== id) });
  };

  const updateContributor = (id: string, field: keyof BlackboardContributor, value: any) => {
    onChange({
      contributors: contributors.map(c => c.id === id ? { ...c, [field]: value } : c),
    });
  };

  return (
    <div style={styles.container}>
      {/* Workspace Format */}
      <div style={styles.field}>
        <label htmlFor="workspace-format" style={styles.label}>
          Workspace Format *
        </label>
        <select
          id="workspace-format"
          style={styles.select}
          value={node.workspaceFormat}
          onChange={(e) => onChange({ workspaceFormat: e.target.value as BlackboardNode['workspaceFormat'] })}
        >
          <option value="document">Document (text-based, best for creative writing)</option>
          <option value="structured">Structured (JSON, best for planning)</option>
        </select>
      </div>

      {/* Max Rounds */}
      <div style={styles.field}>
        <label htmlFor="max-rounds" style={styles.label}>
          Max Rounds *
        </label>
        <input
          id="max-rounds"
          type="number"
          style={styles.input}
          value={node.maxRounds || 3}
          min={1}
          max={10}
          onChange={(e) => onChange({ maxRounds: parseInt(e.target.value) || 3 })}
        />
        <span style={styles.hint}>Number of iteration rounds (recommended: 3)</span>
      </div>

      {/* Convergence Condition */}
      <div style={styles.field}>
        <label htmlFor="convergence-condition" style={styles.label}>
          Convergence Condition (optional)
        </label>
        <input
          id="convergence-condition"
          style={styles.input}
          value={node.convergenceCondition || ''}
          onChange={(e) => onChange({ convergenceCondition: e.target.value || undefined })}
          placeholder="e.g., $.workspace.stability >= 0.9"
        />
        <span style={styles.hint}>JSONPath condition to stop iterations early</span>
      </div>

      {/* Initial Content */}
      <div style={styles.field}>
        <label htmlFor="initial-content" style={styles.label}>
          Initial Workspace Content *
        </label>
        <textarea
          id="initial-content"
          style={styles.textarea}
          value={node.initialContent || ''}
          onChange={(e) => onChange({ initialContent: e.target.value })}
          placeholder="Template for the initial workspace content. Use {{variableName}} for variable substitution."
          rows={5}
        />
      </div>

      {/* Contributors */}
      <div style={styles.field}>
        <div style={styles.sectionHeader}>
          <label style={styles.label}>Contributors ({contributors.length})</label>
          <button onClick={addContributor} style={styles.addButton}>+ Add Contributor</button>
        </div>

        {contributors.map((contributor, index) => (
          <div key={contributor.id} style={styles.contributorCard}>
            <div style={styles.cardHeader}>
              <span style={styles.cardIndex}>#{index + 1}</span>
              <input
                style={styles.nameInput}
                value={contributor.name}
                onChange={(e) => updateContributor(contributor.id, 'name', e.target.value)}
                placeholder="Name"
              />
              <input
                style={{ ...styles.nameInput, maxWidth: '120px' }}
                value={contributor.role}
                onChange={(e) => updateContributor(contributor.id, 'role', e.target.value)}
                placeholder="Role"
              />
              <input
                type="number"
                style={{ ...styles.nameInput, maxWidth: '60px' }}
                value={contributor.order ?? 0}
                onChange={(e) => updateContributor(contributor.id, 'order', parseInt(e.target.value) || 0)}
                title="Execution order (same order = parallel)"
              />
              <button onClick={() => removeContributor(contributor.id)} style={styles.removeButton}>x</button>
            </div>
            <div style={styles.cardBody}>
              <input
                style={styles.input}
                value={contributor.agent}
                onChange={(e) => updateContributor(contributor.id, 'agent', e.target.value)}
                placeholder="Agent name"
              />
              <textarea
                style={styles.textarea}
                value={contributor.prompt}
                onChange={(e) => updateContributor(contributor.id, 'prompt', e.target.value)}
                placeholder="Prompt (use {{workspace}}, {{round}}, {{role}})"
                rows={3}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '13px', fontWeight: 600, color: '#374151' },
  hint: { fontSize: '11px', color: '#9ca3af' },
  input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' },
  select: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' },
  textarea: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', resize: 'vertical' as const, fontFamily: 'inherit' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  addButton: { padding: '4px 12px', borderRadius: '4px', border: '1px solid #0891b2', background: '#ecfeff', color: '#0891b2', fontSize: '12px', cursor: 'pointer' },
  contributorCard: { border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '8px', overflow: 'hidden' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  cardIndex: { fontSize: '12px', fontWeight: 700, color: '#0891b2', minWidth: '24px' },
  nameInput: { flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' },
  removeButton: { padding: '2px 8px', borderRadius: '4px', border: '1px solid #fca5a5', background: '#fef2f2', color: 'var(--status-error)', fontSize: '12px', cursor: 'pointer' },
  cardBody: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
};
