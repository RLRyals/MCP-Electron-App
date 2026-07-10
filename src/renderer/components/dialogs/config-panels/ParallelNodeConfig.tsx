/**
 * ParallelNodeConfig Component
 * Configuration panel for Parallel workflow nodes
 *
 * Features:
 * - Branch list editor (add/remove branches)
 * - Per-branch agent, prompt, and provider configuration
 * - Consolidation strategy picker
 * - Failure strategy selector
 * - Max concurrency setting
 */

import React from 'react';
import type { ParallelNode, ParallelBranch } from '../../../../types/workflow-nodes';

export interface ParallelNodeConfigProps {
  node: ParallelNode;
  onChange: (updates: Partial<ParallelNode>) => void;
  errors: Record<string, string>;
}

export const ParallelNodeConfig: React.FC<ParallelNodeConfigProps> = ({
  node,
  onChange,
  errors,
}) => {
  const branches = node.branches || [];

  const addBranch = () => {
    const newBranch: ParallelBranch = {
      id: `branch-${Date.now()}`,
      name: `Branch ${branches.length + 1}`,
      agent: '',
      prompt: '',
      provider: { type: 'claude-code-cli', name: 'Claude Code', config: { model: 'claude-sonnet-4-5', outputFormat: 'json' as const } },
    };
    onChange({ branches: [...branches, newBranch] });
  };

  const removeBranch = (id: string) => {
    onChange({ branches: branches.filter(b => b.id !== id) });
  };

  const updateBranch = (id: string, field: keyof ParallelBranch, value: any) => {
    onChange({
      branches: branches.map(b => b.id === id ? { ...b, [field]: value } : b),
    });
  };

  return (
    <div style={styles.container}>
      {/* Failure Strategy */}
      <div style={styles.field}>
        <label htmlFor="failure-strategy" style={styles.label}>
          Failure Strategy *
        </label>
        <select
          id="failure-strategy"
          style={styles.select}
          value={node.failureStrategy}
          onChange={(e) => onChange({ failureStrategy: e.target.value as ParallelNode['failureStrategy'] })}
        >
          <option value="fail-fast">Fail Fast (stop all on first failure)</option>
          <option value="fail-tolerant">Fail Tolerant (continue with partial results)</option>
          <option value="require-all">Require All (all must succeed)</option>
        </select>
      </div>

      {/* Max Concurrency */}
      <div style={styles.field}>
        <label htmlFor="max-concurrency" style={styles.label}>
          Max Concurrency (0 = unlimited)
        </label>
        <input
          id="max-concurrency"
          type="number"
          style={styles.input}
          value={node.maxConcurrency || 0}
          min={0}
          onChange={(e) => onChange({ maxConcurrency: parseInt(e.target.value) || undefined })}
        />
      </div>

      {/* Consolidation Strategy */}
      <div style={styles.field}>
        <label htmlFor="consolidation-strategy" style={styles.label}>
          Consolidation Strategy *
        </label>
        <select
          id="consolidation-strategy"
          style={styles.select}
          value={node.consolidation?.strategy || 'concatenate'}
          onChange={(e) => onChange({
            consolidation: { ...node.consolidation, strategy: e.target.value as any }
          })}
        >
          <option value="concatenate">Concatenate (combine all outputs)</option>
          <option value="merge">Merge (deep-merge structured outputs)</option>
          <option value="select-best">Select Best (highest score wins)</option>
          <option value="agent-consolidate">Agent Consolidate (use an agent to synthesize)</option>
        </select>
      </div>

      {/* Branches */}
      <div style={styles.field}>
        <div style={styles.sectionHeader}>
          <label style={styles.label}>Branches ({branches.length})</label>
          <button onClick={addBranch} style={styles.addButton}>+ Add Branch</button>
        </div>

        {branches.map((branch, index) => (
          <div key={branch.id} style={styles.branchCard}>
            <div style={styles.branchHeader}>
              <span style={styles.branchIndex}>#{index + 1}</span>
              <input
                style={styles.branchNameInput}
                value={branch.name}
                onChange={(e) => updateBranch(branch.id, 'name', e.target.value)}
                placeholder="Branch name"
              />
              <button onClick={() => removeBranch(branch.id)} style={styles.removeButton}>x</button>
            </div>
            <div style={styles.branchBody}>
              <input
                style={styles.input}
                value={branch.agent}
                onChange={(e) => updateBranch(branch.id, 'agent', e.target.value)}
                placeholder="Agent name"
              />
              <textarea
                style={styles.textarea}
                value={branch.prompt}
                onChange={(e) => updateBranch(branch.id, 'prompt', e.target.value)}
                placeholder="Prompt for this branch..."
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
  input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' },
  select: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' },
  textarea: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', resize: 'vertical' as const, fontFamily: 'inherit' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  addButton: { padding: '4px 12px', borderRadius: '4px', border: '1px solid #6366f1', background: '#eef2ff', color: '#6366f1', fontSize: '12px', cursor: 'pointer' },
  branchCard: { border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '8px', overflow: 'hidden' },
  branchHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  branchIndex: { fontSize: '12px', fontWeight: 700, color: '#6366f1', minWidth: '24px' },
  branchNameInput: { flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' },
  removeButton: { padding: '2px 8px', borderRadius: '4px', border: '1px solid #fca5a5', background: '#fef2f2', color: 'var(--status-error)', fontSize: '12px', cursor: 'pointer' },
  branchBody: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
};
