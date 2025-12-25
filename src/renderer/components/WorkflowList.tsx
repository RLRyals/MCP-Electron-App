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
  graph_json?: any; // Graph-based workflow representation
}

export interface WorkflowListProps {
  workflows: WorkflowListItem[];
  selectedId?: string;
  onSelect: (workflowId: string) => void;
  onDelete?: (workflowId: string) => void;
  onReimport?: (workflowId: string) => void;
}

export const WorkflowList: React.FC<WorkflowListProps> = ({
  workflows,
  selectedId,
  onSelect,
  onDelete,
  onReimport,
}) => {
  const [filterTags, setFilterTags] = React.useState<string[]>([]);
  const [availableTags, setAvailableTags] = React.useState<string[]>([]);

  // Extract all unique tags from workflows
  React.useEffect(() => {
    const tags = new Set<string>();
    workflows.forEach(w => {
      if (w.tags && Array.isArray(w.tags)) {
        w.tags.forEach(tag => tags.add(String(tag)));
      }
    });
    setAvailableTags(Array.from(tags).sort());
  }, [workflows]);

  // Filter workflows by selected tags
  const filteredWorkflows = React.useMemo(() => {
    if (filterTags.length === 0) return workflows;
    return workflows.filter(w => {
      if (!w.tags || !Array.isArray(w.tags)) return false;
      return filterTags.some(filterTag => w.tags!.includes(filterTag));
    });
  }, [workflows, filterTags]);

  const toggleFilterTag = (tag: string) => {
    setFilterTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

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
    transition: 'box-shadow 0.2s ease',
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

  const actionButtonStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: 600,
    borderRadius: '4px',
    border: '1px solid #d1d5db',
    background: 'white',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const deleteButtonStyle: React.CSSProperties = {
    ...actionButtonStyle,
    borderColor: '#f87171',
    color: '#dc2626',
  };

  const filterContainerStyle: React.CSSProperties = {
    padding: '12px',
    borderBottom: '1px solid #e5e7eb',
    background: 'white',
  };

  const filterTagStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: '4px 12px',
    margin: '4px 4px 4px 0',
    fontSize: '11px',
    borderRadius: '12px',
    cursor: 'pointer',
    background: isActive ? '#3b82f6' : '#f3f4f6',
    color: isActive ? 'white' : '#6b7280',
    border: isActive ? '1px solid #3b82f6' : '1px solid #e5e7eb',
    transition: 'all 0.2s ease',
  });

  const workflowActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(0,0,0,0.1)',
  };

  // Separate system and user workflows from filtered set
  const systemWorkflows = filteredWorkflows.filter(w => w.is_system);
  const userWorkflows = filteredWorkflows.filter(w => !w.is_system);

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
      {/* Tag Filter */}
      {availableTags.length > 0 && (
        <div style={filterContainerStyle}>
          <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', color: '#6b7280' }}>
            FILTER BY TAG
          </div>
          <div>
            {availableTags.map(tag => (
              <span
                key={tag}
                style={filterTagStyle(filterTags.includes(tag))}
                onClick={() => toggleFilterTag(tag)}
              >
                {tag}
              </span>
            ))}
          </div>
          {filterTags.length > 0 && (
            <button
              style={{ ...actionButtonStyle, marginTop: '8px' }}
              onClick={() => setFilterTags([])}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {systemWorkflows.length > 0 && (
        <>
          <div style={sectionHeaderStyle}>System Workflows</div>
          {systemWorkflows.map(workflow => {
            const isSelected = workflow.id === selectedId;
            return (
              <div
                key={workflow.id}
                className={`workflow-list-item ${isSelected ? 'selected' : ''}`}
                style={workflowItemStyle(isSelected, true)}
                onClick={() => onSelect(workflow.id)}
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
                {/* Action Buttons */}
                {(onDelete || onReimport) && (
                  <div style={workflowActionsStyle} onClick={(e) => e.stopPropagation()}>
                    {onReimport && (
                      <button
                        style={actionButtonStyle}
                        onClick={() => onReimport(workflow.id)}
                        title="Reload from source folder"
                      >
                        🔄 Refresh
                      </button>
                    )}
                    {onDelete && (
                      <button
                        style={deleteButtonStyle}
                        onClick={() => {
                          if (confirm(`Delete workflow "${workflow.name}"?`)) {
                            onDelete(workflow.id);
                          }
                        }}
                        title="Delete this workflow"
                      >
                        🗑️ Delete
                      </button>
                    )}
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
                className={`workflow-list-item ${isSelected ? 'selected' : ''}`}
                style={workflowItemStyle(isSelected, false)}
                onClick={() => onSelect(workflow.id)}
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
                {/* Action Buttons */}
                {(onDelete || onReimport) && (
                  <div style={workflowActionsStyle} onClick={(e) => e.stopPropagation()}>
                    {onReimport && (
                      <button
                        style={actionButtonStyle}
                        onClick={() => onReimport(workflow.id)}
                        title="Reload from source folder"
                      >
                        🔄 Refresh
                      </button>
                    )}
                    {onDelete && (
                      <button
                        style={deleteButtonStyle}
                        onClick={() => {
                          if (confirm(`Delete workflow "${workflow.name}"?`)) {
                            onDelete(workflow.id);
                          }
                        }}
                        title="Delete this workflow"
                      >
                        🗑️ Delete
                      </button>
                    )}
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
