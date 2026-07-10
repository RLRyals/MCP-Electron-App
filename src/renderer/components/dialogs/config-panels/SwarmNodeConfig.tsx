/**
 * SwarmNodeConfig Component
 * Configuration panel for Swarm workflow nodes
 *
 * Features:
 * - Agent list editor (add/remove swarm agents)
 * - Per-agent system prompt for unique perspectives
 * - Shared exploration prompt
 * - Consolidation strategy picker
 * - Minimum responses setting
 */

import React from 'react';
import type { SwarmNode, SwarmAgent } from '../../../../types/workflow-nodes';

export interface SwarmNodeConfigProps {
  node: SwarmNode;
  onChange: (updates: Partial<SwarmNode>) => void;
  errors: Record<string, string>;
}

export const SwarmNodeConfig: React.FC<SwarmNodeConfigProps> = ({
  node,
  onChange,
  errors,
}) => {
  const agents = node.agents || [];

  const addAgent = () => {
    const newAgent: SwarmAgent = {
      id: `swarm-${Date.now()}`,
      name: `Explorer ${agents.length + 1}`,
      agent: '',
      systemPrompt: '',
      provider: { type: 'claude-code-cli', name: 'Claude Code', config: { model: 'claude-sonnet-4-5', outputFormat: 'json' as const } },
    };
    onChange({ agents: [...agents, newAgent] });
  };

  const removeAgent = (id: string) => {
    onChange({ agents: agents.filter(a => a.id !== id) });
  };

  const updateAgent = (id: string, field: keyof SwarmAgent, value: any) => {
    onChange({
      agents: agents.map(a => a.id === id ? { ...a, [field]: value } : a),
    });
  };

  return (
    <div style={styles.container}>
      {/* Exploration Prompt */}
      <div style={styles.field}>
        <label htmlFor="exploration-prompt" style={styles.label}>
          Exploration Prompt *
        </label>
        <textarea
          id="exploration-prompt"
          style={styles.textarea}
          value={node.explorationPrompt || ''}
          onChange={(e) => onChange({ explorationPrompt: e.target.value })}
          placeholder="The shared problem all agents will independently explore. Use {{variableName}} for variable substitution."
          rows={4}
        />
        <span style={styles.hint}>All swarm agents receive this same prompt but explore from different perspectives</span>
      </div>

      {/* Consolidation Strategy */}
      <div style={styles.field}>
        <label htmlFor="consolidation-strategy" style={styles.label}>
          Consolidation Strategy *
        </label>
        <select
          id="consolidation-strategy"
          style={styles.select}
          value={node.consolidationStrategy}
          onChange={(e) => onChange({ consolidationStrategy: e.target.value as SwarmNode['consolidationStrategy'] })}
        >
          <option value="merge">Merge (synthesize best elements from all)</option>
          <option value="rank">Rank (agent ranks all proposals)</option>
          <option value="vote">Vote (agents rank each other's outputs)</option>
          <option value="best-score">Best Score (highest self-reported score wins)</option>
          <option value="agent">Agent (dedicated agent decides)</option>
        </select>
      </div>

      {/* Minimum Responses */}
      <div style={styles.field}>
        <label htmlFor="min-responses" style={styles.label}>
          Minimum Responses
        </label>
        <input
          id="min-responses"
          type="number"
          style={styles.input}
          value={node.minimumResponses || 1}
          min={1}
          onChange={(e) => onChange({ minimumResponses: parseInt(e.target.value) || 1 })}
        />
        <span style={styles.hint}>Minimum successful responses needed to proceed</span>
      </div>

      {/* Swarm Agents */}
      <div style={styles.field}>
        <div style={styles.sectionHeader}>
          <label style={styles.label}>Swarm Agents ({agents.length})</label>
          <button onClick={addAgent} style={styles.addButton}>+ Add Agent</button>
        </div>

        {agents.map((agent, index) => (
          <div key={agent.id} style={styles.agentCard}>
            <div style={styles.cardHeader}>
              <span style={styles.cardIndex}>#{index + 1}</span>
              <input
                style={styles.nameInput}
                value={agent.name}
                onChange={(e) => updateAgent(agent.id, 'name', e.target.value)}
                placeholder="Agent display name"
              />
              <button onClick={() => removeAgent(agent.id)} style={styles.removeButton}>x</button>
            </div>
            <div style={styles.cardBody}>
              <input
                style={styles.input}
                value={agent.agent}
                onChange={(e) => updateAgent(agent.id, 'agent', e.target.value)}
                placeholder="Agent definition name"
              />
              <textarea
                style={styles.textarea}
                value={agent.systemPrompt || ''}
                onChange={(e) => updateAgent(agent.id, 'systemPrompt', e.target.value)}
                placeholder="Unique perspective / system prompt for this explorer (e.g., 'Focus on market TRENDS...')"
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
  addButton: { padding: '4px 12px', borderRadius: '4px', border: '1px solid #d97706', background: '#fffbeb', color: '#d97706', fontSize: '12px', cursor: 'pointer' },
  agentCard: { border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '8px', overflow: 'hidden' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  cardIndex: { fontSize: '12px', fontWeight: 700, color: '#d97706', minWidth: '24px' },
  nameInput: { flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' },
  removeButton: { padding: '2px 8px', borderRadius: '4px', border: '1px solid #fca5a5', background: '#fef2f2', color: 'var(--status-error)', fontSize: '12px', cursor: 'pointer' },
  cardBody: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
};
