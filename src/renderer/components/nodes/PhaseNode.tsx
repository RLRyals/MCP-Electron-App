/**
 * PhaseNode Component
 * Custom React Flow node for workflow phases
 *
 * Displays:
 * - Phase name, agent, skill
 * - Status with color coding
 * - Handles for connections
 */

import React, { useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

// Add hover styles for edit button
if (typeof document !== 'undefined' && !document.getElementById('phase-node-styles')) {
  const style = document.createElement('style');
  style.id = 'phase-node-styles';
  style.textContent = `
    .phase-node-container:hover .phase-edit-button {
      opacity: 1 !important;
    }
    .phase-edit-button:hover {
      background: #f3f4f6 !important;
    }
    .sub-workflow-link:hover {
      color: #2563eb !important;
    }
  `;
  document.head.appendChild(style);
}

export interface PhaseNodeData {
  label: string;
  phase: {
    id: number;
    name: string;
    type: 'planning' | 'writing' | 'gate' | 'user-input' | 'user' | 'code' | 'http' | 'file' | 'conditional' | 'loop' | 'subworkflow';
    agent: string;
    skill?: string;
    subWorkflowId?: string;
    description: string;
    gate: boolean;
    requiresApproval: boolean;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  onEdit?: () => void;
  onOpenSubWorkflow?: () => void;
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
      case 'writing':
        return '✍️';
      case 'gate':
        return '🚪';
      case 'user-input':
      case 'user':
        return '👤';
      case 'code':
        return '⚙️';
      case 'http':
        return '🌐';
      case 'file':
        return '📁';
      case 'conditional':
        return '🔀';
      case 'loop':
        return '🔄';
      case 'subworkflow':
        return '📦';
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
    cursor: 'pointer',
    position: 'relative',
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

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onEdit) {
      data.onEdit();
    }
  };

  const handleSubWorkflowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onOpenSubWorkflow) {
      data.onOpenSubWorkflow();
    }
  };

  return (
    <div className="phase-node-container" style={nodeStyle} onDoubleClick={handleDoubleClick}>
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

      {/* Edit button - appears on hover */}
      <button
        className="phase-edit-button"
        style={editButtonStyle}
        onClick={(e) => {
          e.stopPropagation();
          if (data.onEdit) data.onEdit();
        }}
        title="Edit phase (double-click)"
      >
        ✏️
      </button>

      <div style={headerStyle}>
        <span style={{ fontSize: '16px' }}>{getTypeIcon()}</span>
        <div style={labelStyle}>{String(data.label || 'Unnamed Phase')}</div>
      </div>

      {/* Only show agent for nodes that actually use agents */}
      {data.phase.agent && !['user-input', 'user', 'file', 'http'].includes(data.phase.type) && (
        <div style={agentStyle}>Agent: {String(data.phase.agent)}</div>
      )}

      {data.phase.skill && (
        <div style={skillStyle}>Skill: {String(data.phase.skill)}</div>
      )}

      {/* Sub-workflow indicator with click-to-open */}
      {data.phase.type === 'subworkflow' && data.phase.subWorkflowId && (
        <div
          className="sub-workflow-link"
          style={subWorkflowLinkStyle}
          onClick={handleSubWorkflowClick}
          title="Click to open sub-workflow"
        >
          🔗 {data.phase.subWorkflowId}
        </div>
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

const editButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '4px',
  right: '4px',
  padding: '4px 6px',
  background: 'white',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '12px',
  cursor: 'pointer',
  opacity: 0,
  transition: 'opacity 0.2s',
};

const subWorkflowLinkStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#3b82f6',
  marginBottom: '4px',
  cursor: 'pointer',
  textDecoration: 'underline',
  transition: 'color 0.2s',
};
