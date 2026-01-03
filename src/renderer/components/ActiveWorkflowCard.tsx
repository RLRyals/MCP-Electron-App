/**
 * ActiveWorkflowCard Component
 * Displays an individual active workflow with progress and controls
 */

import * as React from 'react';
import { useState } from 'react';
import type { ActiveWorkflowInstance, WorkflowSource } from '../../types/workflow.js';

export interface ActiveWorkflowCardProps {
  workflow: ActiveWorkflowInstance;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onJumpToNode?: (id: string, nodeId: string) => void;
  onSelect?: (workflow: ActiveWorkflowInstance) => void;
  isSelected?: boolean;
}

const getSourceBadge = (source: WorkflowSource): { label: string; color: string } => {
  switch (source) {
    case 'claude_code':
      return { label: 'CC', color: '#7c3aed' }; // Purple for Claude Code
    case 'fictionlab_ui':
      return { label: 'FL', color: '#00D4AA' }; // Accent color for FictionLab
    case 'typingmind':
      return { label: 'TM', color: '#3b82f6' }; // Blue for TypingMind
    default:
      return { label: '?', color: '#6b7280' };
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'running':
      return '#3b82f6'; // Blue
    case 'paused':
      return '#f59e0b'; // Amber
    case 'completed':
      return '#10b981'; // Green
    case 'failed':
      return '#ef4444'; // Red
    case 'cancelled':
      return '#6b7280'; // Gray
    default:
      return '#6b7280';
  }
};

export const ActiveWorkflowCard: React.FC<ActiveWorkflowCardProps> = ({
  workflow,
  onPause,
  onResume,
  onCancel,
  onJumpToNode,
  onSelect,
  isSelected = false,
}) => {
  const [showJumpMenu, setShowJumpMenu] = useState(false);
  const sourceBadge = getSourceBadge(workflow.source);
  const statusColor = getStatusColor(workflow.status);

  const cardStyle: React.CSSProperties = {
    background: isSelected ? 'rgba(0, 212, 170, 0.1)' : 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${isSelected ? 'var(--color-accent, #00D4AA)' : 'var(--color-border, rgba(255, 255, 255, 0.1))'}`,
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  };

  const workflowNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-text-primary, rgba(255, 255, 255, 0.9))',
    flex: 1,
    marginRight: '8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 600,
    padding: '2px 4px',
    borderRadius: '3px',
    background: sourceBadge.color,
    color: 'white',
  };

  const projectPathStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--color-text-tertiary, rgba(255, 255, 255, 0.5))',
    marginBottom: '8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const currentNodeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  };

  const nodeIndicatorStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: statusColor,
    animation: workflow.status === 'running' ? 'pulse 1.5s infinite' : 'none',
  };

  const nodeNameStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-text-secondary, rgba(255, 255, 255, 0.7))',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const progressContainerStyle: React.CSSProperties = {
    marginBottom: '12px',
  };

  const progressBarStyle: React.CSSProperties = {
    height: '4px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '4px',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    background: statusColor,
    width: `${workflow.progressPercent}%`,
    transition: 'width 0.3s ease',
  };

  const progressTextStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--color-text-tertiary, rgba(255, 255, 255, 0.5))',
    textAlign: 'right',
  };

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '4px',
    position: 'relative',
  };

  const buttonStyle: React.CSSProperties = {
    flex: 1,
    padding: '6px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
    borderRadius: '4px',
    color: 'var(--color-text-primary, rgba(255, 255, 255, 0.9))',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.15s ease',
  };

  const jumpMenuStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    background: 'var(--color-bg-secondary, #0D1F35)',
    border: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
    borderRadius: '6px',
    padding: '4px',
    marginBottom: '4px',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 10,
  };

  const jumpMenuItemStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: '11px',
    color: 'var(--color-text-secondary, rgba(255, 255, 255, 0.7))',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background 0.15s ease',
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card selection if clicking on buttons
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    onSelect?.(workflow);
  };

  return (
    <div
      style={cardStyle}
      className="active-workflow-card"
      onClick={handleCardClick}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--color-accent, #00D4AA)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--color-border, rgba(255, 255, 255, 0.1))';
        }
      }}
    >
      {/* Header with workflow name and source badge */}
      <div style={headerStyle}>
        <span style={workflowNameStyle} title={workflow.workflowName}>
          {workflow.workflowName}
        </span>
        <span style={badgeStyle} title={`Source: ${workflow.source}`}>
          {sourceBadge.label}
        </span>
      </div>

      {/* Project folder path */}
      <div style={projectPathStyle} title={workflow.projectFolder}>
        {workflow.projectName}
      </div>

      {/* Current node and status */}
      <div style={currentNodeStyle}>
        <span style={nodeIndicatorStyle} />
        <span style={nodeNameStyle} title={workflow.currentNodeName}>
          {workflow.currentNodeName || 'Starting...'}
        </span>
      </div>

      {/* Progress bar */}
      <div style={progressContainerStyle}>
        <div style={progressBarStyle}>
          <div style={progressFillStyle} />
        </div>
        <div style={progressTextStyle}>
          {workflow.completedNodes}/{workflow.totalNodes} nodes ({workflow.progressPercent}%)
        </div>
      </div>

      {/* Control buttons */}
      <div style={controlsStyle}>
        {workflow.status === 'running' ? (
          <button
            style={buttonStyle}
            onClick={(e) => { e.stopPropagation(); onPause(workflow.id); }}
            title="Pause workflow"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
          >
            ⏸
          </button>
        ) : workflow.status === 'paused' ? (
          <button
            style={buttonStyle}
            onClick={(e) => { e.stopPropagation(); onResume(workflow.id); }}
            title="Resume workflow"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
          >
            ▶
          </button>
        ) : null}

        <button
          style={buttonStyle}
          onClick={(e) => { e.stopPropagation(); onCancel(workflow.id); }}
          title="Cancel workflow"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
        >
          ⏹
        </button>

        {onJumpToNode && workflow.availableNodes.length > 0 && (
          <button
            style={buttonStyle}
            onClick={(e) => { e.stopPropagation(); setShowJumpMenu(!showJumpMenu); }}
            title="Jump to node"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
          >
            ⤵
          </button>
        )}

        {/* Jump to node dropdown */}
        {showJumpMenu && onJumpToNode && (
          <div style={jumpMenuStyle} className="jump-menu">
            {workflow.availableNodes.map((node) => (
              <div
                key={node.id}
                style={jumpMenuItemStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToNode(workflow.id, node.id);
                  setShowJumpMenu(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {node.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default ActiveWorkflowCard;
