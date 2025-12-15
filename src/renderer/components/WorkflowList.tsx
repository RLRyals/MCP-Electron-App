/**
 * WorkflowList Component
 * Sidebar list of available workflows
 *
 * Features:
 * - Display workflow name, version, tags
 * - Highlight selected workflow
 * - Show system vs user workflows
 * - Click to select
 */

import React from 'react';

export interface WorkflowListItem {
  id: string;
  name: string;
  version: string;
  description?: string;
  tags?: string[];
  is_system?: boolean;
  phases_json: any[];
}

export interface WorkflowListProps {
  workflows: WorkflowListItem[];
  selectedId?: string;
  onSelect: (workflowId: string) => void;
}

export const WorkflowList: React.FC<WorkflowListProps> = ({
  workflows,
  selectedId,
  onSelect,
}) => {
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflowY: 'auto',
    padding: '12px',
    background: '#f9fafb',
    borderRight: '1px solid #e5e7eb',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: '#6b7280',
    padding: '8px 12px',
    marginTop: '16px',
    marginBottom: '8px',
  };

  const workflowItemStyle = (isSelected: boolean, isSystem: boolean): React.CSSProperties => ({
    padding: '12px',
    marginBottom: '8px',
    borderRadius: '6px',
    cursor: 'pointer',
    background: isSelected ? '#3b82f6' : 'white',
    border: `1px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
    color: isSelected ? 'white' : '#1f2937',
    transition: 'all 0.2s ease',
    boxShadow: isSelected ? '0 2px 8px rgba(59, 130, 246, 0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
  });

  const workflowNameStyle = (isSelected: boolean): React.CSSProperties => ({
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '4px',
    color: isSelected ? 'white' : '#1f2937',
  });

  const workflowMetaStyle = (isSelected: boolean): React.CSSProperties => ({
    fontSize: '11px',
    color: isSelected ? 'rgba(255,255,255,0.8)' : '#6b7280',
    marginBottom: '6px',
  });

  const tagsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginTop: '6px',
  };

  const tagStyle = (isSelected: boolean): React.CSSProperties => ({
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '12px',
    background: isSelected ? 'rgba(255,255,255,0.2)' : '#e5e7eb',
    color: isSelected ? 'white' : '#6b7280',
  });

  const badgeStyle = (isSelected: boolean): React.CSSProperties => ({
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    background: isSelected ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
    color: isSelected ? 'white' : '#6b7280',
    fontWeight: 600,
    display: 'inline-block',
    marginLeft: '6px',
  });

  const emptyStateStyle: React.CSSProperties = {
    padding: '24px',
    textAlign: 'center' as const,
    color: '#9ca3af',
  };

  // Separate system and user workflows
  const systemWorkflows = workflows.filter(w => w.is_system);
  const userWorkflows = workflows.filter(w => !w.is_system);

  if (workflows.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={emptyStateStyle}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No workflows available</div>
          <div style={{ fontSize: '12px', lineHeight: '1.6', maxWidth: '250px', margin: '0 auto' }}>
            No workflow definitions found.
            <br /><br />
            Click "Import Workflow" to import workflow definitions from a folder.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {systemWorkflows.length > 0 && (
        <>
          <div style={sectionHeaderStyle}>System Workflows</div>
          {systemWorkflows.map(workflow => {
            const isSelected = workflow.id === selectedId;
            return (
              <div
                key={workflow.id}
                style={workflowItemStyle(isSelected, true)}
                onClick={() => onSelect(workflow.id)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                  }
                }}
              >
                <div style={workflowNameStyle(isSelected)}>
                  {String(workflow.name || 'Unnamed')}
                  <span style={badgeStyle(isSelected)}>v{String(workflow.version || '1.0')}</span>
                </div>
                {workflow.description && typeof workflow.description === 'string' && (
                  <div style={{
                    fontSize: '12px',
                    color: isSelected ? 'rgba(255,255,255,0.9)' : '#4b5563',
                    marginBottom: '6px',
                    lineHeight: '1.4',
                  }}>
                    {workflow.description}
                  </div>
                )}
                <div style={workflowMetaStyle(isSelected)}>
                  {workflow.phases_json?.length || 0} phases
                </div>
                {workflow.tags && Array.isArray(workflow.tags) && workflow.tags.length > 0 && (
                  <div style={tagsContainerStyle}>
                    {workflow.tags.map((tag, idx) => (
                      <span key={idx} style={tagStyle(isSelected)}>
                        {String(tag)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {userWorkflows.length > 0 && (
        <>
          <div style={sectionHeaderStyle}>My Workflows</div>
          {userWorkflows.map(workflow => {
            const isSelected = workflow.id === selectedId;
            return (
              <div
                key={workflow.id}
                style={workflowItemStyle(isSelected, false)}
                onClick={() => onSelect(workflow.id)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                  }
                }}
              >
                <div style={workflowNameStyle(isSelected)}>
                  {String(workflow.name || 'Unnamed')}
                  <span style={badgeStyle(isSelected)}>v{String(workflow.version || '1.0')}</span>
                </div>
                {workflow.description && typeof workflow.description === 'string' && (
                  <div style={{
                    fontSize: '12px',
                    color: isSelected ? 'rgba(255,255,255,0.9)' : '#4b5563',
                    marginBottom: '6px',
                    lineHeight: '1.4',
                  }}>
                    {workflow.description}
                  </div>
                )}
                <div style={workflowMetaStyle(isSelected)}>
                  {workflow.phases_json?.length || 0} phases
                </div>
                {workflow.tags && Array.isArray(workflow.tags) && workflow.tags.length > 0 && (
                  <div style={tagsContainerStyle}>
                    {workflow.tags.map((tag, idx) => (
                      <span key={idx} style={tagStyle(isSelected)}>
                        {String(tag)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};
