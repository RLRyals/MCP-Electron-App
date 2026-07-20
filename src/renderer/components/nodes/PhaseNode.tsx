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
import { Handle, Position, type NodeProps } from '@xyflow/react';

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

import type { NodeExecutionStatus } from '../../../types/workflow.js';

export interface PhaseNodeData extends Record<string, unknown> {
  label: string;
  phase: {
    id: number;
    name: string;
    type: 'planning' | 'writing' | 'gate' | 'user-input' | 'user' | 'code' | 'http' | 'file' | 'conditional' | 'loop' | 'subworkflow' | 'parallel' | 'blackboard' | 'swarm';
    agent: string;
    skill?: string;
    subWorkflowId?: string;
    description: string;
    gate: boolean;
    requiresApproval: boolean;
  };
  status: NodeExecutionStatus;
  /** Current loop iteration (1-based) if this node is executing inside a loop */
  loopIteration?: number;
  /** True if this node is the currently executing node in an active workflow */
  isActiveNode?: boolean;
  /** True if phase.subWorkflowId is set but doesn't resolve to a known workflow */
  subWorkflowMissing?: boolean;
  onEdit?: () => void;
  onOpenSubWorkflow?: () => void;
}

export const PhaseNode = ({ data }: NodeProps) => {
  const nodeData = data as PhaseNodeData;
  // Determine effective status - if this is the active node, it's running
  const effectiveStatus: NodeExecutionStatus = nodeData.isActiveNode ? 'running' : (nodeData.status || 'pending');

  const getStatusColor = () => {
    switch (effectiveStatus) {
      case 'completed':
        return '#4ade80'; // green
      case 'running':
      case 'in_progress':
        return '#60a5fa'; // blue
      case 'failed':
        return '#f87171'; // red
      default:
        return '#9ca3af'; // gray
    }
  };

  const getStatusLabel = (): string => {
    const iteration = nodeData.loopIteration;
    const suffix = iteration !== undefined ? ` ${iteration}` : '';

    switch (effectiveStatus) {
      case 'running':
      case 'in_progress':
        return `RUNNING${suffix}`;
      case 'completed':
        return `COMPLETED${suffix}`;
      case 'failed':
        return `FAILED${suffix}`;
      default:
        return 'PENDING';
    }
  };

  const getTypeIcon = () => {
    switch (nodeData.phase.type) {
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
      case 'parallel':
        return '⚡';
      case 'blackboard':
        return '📝';
      case 'swarm':
        return '🐝';
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
    boxShadow: (effectiveStatus === 'in_progress' || effectiveStatus === 'running') ? '0 4px 12px rgba(96, 165, 250, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
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
    color: 'var(--status-neutral)',
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
    if (nodeData.onEdit) {
      nodeData.onEdit();
    }
  };

  const handleSubWorkflowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeData.onOpenSubWorkflow) {
      nodeData.onOpenSubWorkflow();
    }
  };

  // Use existing in_progress styling pattern for active node - just override the border color
  const activeNodeStyle: React.CSSProperties = nodeData.isActiveNode ? {
    border: '3px solid #60a5fa',
    boxShadow: '0 4px 12px rgba(96, 165, 250, 0.3)',
  } : {};

  return (
    <div className="phase-node-container" style={{ ...nodeStyle, ...activeNodeStyle }} onDoubleClick={handleDoubleClick}>
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
          if (nodeData.onEdit) nodeData.onEdit();
        }}
        title="Edit phase (double-click)"
      >
        ✏️
      </button>

      <div style={headerStyle}>
        <span style={{ fontSize: '16px' }}>{getTypeIcon()}</span>
        <div style={labelStyle}>{String(nodeData.label || 'Unnamed Phase')}</div>
      </div>

      {/* Only show agent for nodes that actually use agents (not compound nodes) */}
      {nodeData.phase.agent && !['user-input', 'user', 'file', 'http', 'parallel', 'blackboard', 'swarm'].includes(nodeData.phase.type) && (
        <div style={agentStyle}>Agent: {String(nodeData.phase.agent)}</div>
      )}

      {nodeData.phase.skill && (
        <div style={skillStyle}>Skill: {String(nodeData.phase.skill)}</div>
      )}

      {/* Sub-workflow indicator with click-to-open */}
      {nodeData.phase.type === 'subworkflow' && nodeData.phase.subWorkflowId && (
        nodeData.subWorkflowMissing ? (
          <div
            className="sub-workflow-link sub-workflow-link-missing"
            style={subWorkflowLinkMissingStyle}
            title={`Referenced workflow "${nodeData.phase.subWorkflowId}" not found`}
          >
            🔗 {nodeData.phase.subWorkflowId} (not found)
          </div>
        ) : (
          <div
            className="sub-workflow-link"
            style={subWorkflowLinkStyle}
            onClick={handleSubWorkflowClick}
            title="Click to open sub-workflow"
          >
            🔗 {nodeData.phase.subWorkflowId}
          </div>
        )
      )}

      {nodeData.phase.gate && (
        <div style={{ fontSize: '11px', color: 'var(--status-warning)', marginBottom: '4px' }}>
          🚪 Quality Gate
        </div>
      )}

      {nodeData.phase.requiresApproval && (
        <div style={{ fontSize: '11px', color: '#8b5cf6', marginBottom: '4px' }}>
          ✋ Requires Approval
        </div>
      )}

      {/* Compound node indicators */}
      {nodeData.phase.type === 'parallel' && (
        <div style={{ fontSize: '11px', color: '#6366f1', marginBottom: '4px' }}>
          ⚡ Parallel ({(nodeData.phase as any).branchCount || '?'} branches)
        </div>
      )}

      {nodeData.phase.type === 'blackboard' && (
        <div style={{ fontSize: '11px', color: '#0891b2', marginBottom: '4px' }}>
          📝 Blackboard ({(nodeData.phase as any).contributorCount || '?'} agents, {(nodeData.phase as any).maxRounds || '?'} rounds)
        </div>
      )}

      {nodeData.phase.type === 'swarm' && (
        <div style={{ fontSize: '11px', color: '#d97706', marginBottom: '4px' }}>
          🐝 Swarm ({(nodeData.phase as any).agentCount || '?'} explorers)
        </div>
      )}

      <div style={statusBadgeStyle}>{getStatusLabel()}</div>

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
  color: 'var(--status-running)',
  marginBottom: '4px',
  cursor: 'pointer',
  textDecoration: 'underline',
  transition: 'color 0.2s',
};

const subWorkflowLinkMissingStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#9ca3af',
  marginBottom: '4px',
  cursor: 'not-allowed',
  textDecoration: 'line-through',
  fontStyle: 'italic',
};
