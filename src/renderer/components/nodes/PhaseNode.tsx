/**
 * PhaseNode Component
 * Custom React Flow node for workflow phases
 *
 * Displays:
 * - Phase name, agent, skill
 * - Status with color coding
 * - Handles for connections
 */

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export interface PhaseNodeData {
  label: string;
  phase: {
    id: number;
    name: string;
    type: 'planning' | 'gate' | 'writing' | 'loop' | 'user' | 'subworkflow';
    agent: string;
    skill?: string;
    description: string;
    gate: boolean;
    requiresApproval: boolean;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export const PhaseNode: React.FC<NodeProps<PhaseNodeData>> = ({ data }) => {
  const getStatusColor = () => {
    switch (data.status) {
      case 'completed':
        return '#4ade80'; // green
      case 'in_progress':
        return '#60a5fa'; // blue
      case 'failed':
        return '#f87171'; // red
      default:
        return '#9ca3af'; // gray
    }
  };

  const getTypeIcon = () => {
    switch (data.phase.type) {
      case 'planning':
        return '📋';
      case 'gate':
        return '🚪';
      case 'writing':
        return '✍️';
      case 'loop':
        return '🔄';
      case 'user':
        return '👤';
      case 'subworkflow':
        return '🔗';
      default:
        return '•';
    }
  };

  const nodeStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: '8px',
    border: `2px solid ${getStatusColor()}`,
    background: 'white',
    minWidth: '180px',
    boxShadow: data.status === 'in_progress' ? '0 4px 12px rgba(96, 165, 250, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.3s ease',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: '14px',
    color: '#1f2937',
    lineHeight: '1.2',
  };

  const agentStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '2px',
  };

  const skillStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#9ca3af',
    fontStyle: 'italic',
    marginBottom: '6px',
  };

  const statusBadgeStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 700,
    color: getStatusColor(),
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: '1px solid #e5e7eb',
  };

  return (
    <div style={nodeStyle}>
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: getStatusColor(),
          width: '8px',
          height: '8px',
          border: '2px solid white',
        }}
      />

      <div style={headerStyle}>
        <span style={{ fontSize: '16px' }}>{getTypeIcon()}</span>
        <div style={labelStyle}>{String(data.label || 'Unnamed Phase')}</div>
      </div>

      <div style={agentStyle}>Agent: {String(data.phase.agent || 'Unknown')}</div>

      {data.phase.skill && (
        <div style={skillStyle}>Skill: {String(data.phase.skill)}</div>
      )}

      {data.phase.gate && (
        <div style={{ fontSize: '11px', color: '#f59e0b', marginBottom: '4px' }}>
          🚪 Quality Gate
        </div>
      )}

      {data.phase.requiresApproval && (
        <div style={{ fontSize: '11px', color: '#8b5cf6', marginBottom: '4px' }}>
          ✋ Requires Approval
        </div>
      )}

      <div style={statusBadgeStyle}>{String(data.status || 'pending').replace('_', ' ')}</div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: getStatusColor(),
          width: '8px',
          height: '8px',
          border: '2px solid white',
        }}
      />
    </div>
  );
};
