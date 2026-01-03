/**
 * WorkflowManagerPanel Component
 * VS Code/Obsidian-style right panel with collapsible sections
 * for Available Workflows and Active Workflows
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { CollapsibleSection } from './CollapsibleSection.js';
import { ActiveWorkflowCard } from './ActiveWorkflowCard.js';
import type { ActiveWorkflowInstance, WorkflowUpdate } from '../../types/workflow.js';
import type { WorkflowListItem } from './WorkflowList.js';

export interface WorkflowManagerPanelProps {
  isOpen: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  availableWorkflows: WorkflowListItem[];
  onSelectAvailableWorkflow?: (workflowId: string) => void;
  selectedAvailableWorkflowId?: string;
}

// Plugin IPC channel prefix
const WORKFLOW_PLUGIN = 'plugin:fictionlab-workflow:';

export const WorkflowManagerPanel: React.FC<WorkflowManagerPanelProps> = ({
  isOpen,
  width,
  onWidthChange,
  onClose,
  availableWorkflows,
  onSelectAvailableWorkflow,
  selectedAvailableWorkflowId,
}) => {
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflowInstance[]>([]);
  const [selectedActiveWorkflow, setSelectedActiveWorkflow] = useState<ActiveWorkflowInstance | null>(null);
  const [sectionsExpanded, setSectionsExpanded] = useState({
    available: true,
    active: true,
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load active workflows
  const loadActiveWorkflows = useCallback(async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.invoke) {
        console.warn('[WorkflowManagerPanel] Electron API not available');
        return;
      }

      const result = await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:list-active`);
      console.log('[WorkflowManagerPanel] Loaded active workflows:', result);

      if (Array.isArray(result)) {
        setActiveWorkflows(result);
      }
    } catch (error) {
      console.error('[WorkflowManagerPanel] Failed to load active workflows:', error);
      // Don't clear existing workflows on error - they may just be stale
    }
  }, []);

  // Load active workflows on mount and setup listeners
  useEffect(() => {
    if (!isOpen) return;

    loadActiveWorkflows();

    // Setup event listeners for real-time updates
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.on || !electronAPI.off) return;

    const handleWorkflowUpdate = (update: WorkflowUpdate) => {
      console.log('[WorkflowManagerPanel] Workflow update:', update);

      setActiveWorkflows(prev => {
        const index = prev.findIndex(w => w.id === update.registryId);

        if (update.type === 'completed' || update.type === 'failed') {
          // Remove completed/failed workflows from active list
          return prev.filter(w => w.id !== update.registryId);
        }

        if (index === -1) {
          // New workflow - add it if we have full data
          if (update.data && update.data.id) {
            return [...prev, update.data as ActiveWorkflowInstance];
          }
          return prev;
        }

        // Update existing workflow
        const updated = [...prev];
        updated[index] = { ...updated[index], ...update.data };
        return updated;
      });
    };

    electronAPI.on('workflow:instance-updated', handleWorkflowUpdate);

    // Poll every 5 seconds as backup
    const pollInterval = setInterval(loadActiveWorkflows, 5000);

    return () => {
      electronAPI.off('workflow:instance-updated', handleWorkflowUpdate);
      clearInterval(pollInterval);
    };
  }, [isOpen, loadActiveWorkflows]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 200), 600);
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width, onWidthChange]);

  // Toggle section
  const toggleSection = (section: 'available' | 'active') => {
    setSectionsExpanded(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Workflow control handlers
  const handlePause = async (registryId: string) => {
    try {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:pause`, registryId);
      loadActiveWorkflows();
    } catch (error) {
      console.error('[WorkflowManagerPanel] Failed to pause workflow:', error);
    }
  };

  const handleResume = async (registryId: string) => {
    try {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:resume`, registryId);
      loadActiveWorkflows();
    } catch (error) {
      console.error('[WorkflowManagerPanel] Failed to resume workflow:', error);
    }
  };

  const handleCancel = async (registryId: string) => {
    try {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:cancel`, registryId);
      loadActiveWorkflows();
    } catch (error) {
      console.error('[WorkflowManagerPanel] Failed to cancel workflow:', error);
    }
  };

  const handleJumpToNode = async (registryId: string, nodeId: string) => {
    try {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:jump-to-node`, { registryId, nodeId });
      loadActiveWorkflows();
    } catch (error) {
      console.error('[WorkflowManagerPanel] Failed to jump to node:', error);
    }
  };

  if (!isOpen) return null;

  // Styles
  const panelStyle: React.CSSProperties = {
    position: 'relative',
    height: '100%',
    width: `${width}px`,
    background: 'var(--color-bg-tertiary, #152840)',
    borderLeft: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '200px',
    maxWidth: '600px',
    overflow: 'hidden',
  };

  const resizeHandleStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '4px',
    cursor: 'ew-resize',
    background: isResizing ? 'var(--color-accent, #00D4AA)' : 'transparent',
    transition: 'background 0.15s ease',
    zIndex: 10,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
    background: 'var(--color-bg-secondary, #0D1F35)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--color-text-primary, rgba(255, 255, 255, 0.9))',
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-secondary, rgba(255, 255, 255, 0.7))',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '4px',
    borderRadius: '4px',
    transition: 'all 0.15s ease',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
  };

  const emptyStateStyle: React.CSSProperties = {
    padding: '16px',
    textAlign: 'center',
    color: 'var(--color-text-tertiary, rgba(255, 255, 255, 0.5))',
    fontSize: '12px',
  };

  const availableItemStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    fontSize: '13px',
    color: 'var(--color-text-secondary, rgba(255, 255, 255, 0.7))',
    cursor: 'pointer',
    borderRadius: '4px',
    background: isSelected ? 'rgba(0, 212, 170, 0.1)' : 'transparent',
    borderLeft: isSelected ? '2px solid var(--color-accent, #00D4AA)' : '2px solid transparent',
    marginBottom: '2px',
    transition: 'all 0.15s ease',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  return (
    <div ref={panelRef} style={panelStyle} className="workflow-manager-panel">
      {/* Resize handle */}
      <div
        style={resizeHandleStyle}
        className={`panel-resize-handle ${isResizing ? 'active' : ''}`}
        onMouseDown={handleResizeStart}
        onMouseEnter={(e) => {
          if (!isResizing) e.currentTarget.style.background = 'var(--color-accent, #00D4AA)';
        }}
        onMouseLeave={(e) => {
          if (!isResizing) e.currentTarget.style.background = 'transparent';
        }}
      />

      {/* Panel header */}
      <div style={headerStyle} className="panel-header">
        <span style={titleStyle}>Workflow Manager</span>
        <button
          style={closeButtonStyle}
          onClick={onClose}
          title="Close panel"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable content */}
      <div style={contentStyle}>
        {/* Active Workflows Section */}
        <CollapsibleSection
          title="Active Workflows"
          count={activeWorkflows.length}
          isExpanded={sectionsExpanded.active}
          onToggle={() => toggleSection('active')}
        >
          {activeWorkflows.length === 0 ? (
            <div style={emptyStateStyle}>
              No active workflows
            </div>
          ) : (
            activeWorkflows.map(workflow => (
              <ActiveWorkflowCard
                key={workflow.id}
                workflow={workflow}
                onPause={handlePause}
                onResume={handleResume}
                onCancel={handleCancel}
                onJumpToNode={handleJumpToNode}
                onSelect={setSelectedActiveWorkflow}
                isSelected={selectedActiveWorkflow?.id === workflow.id}
              />
            ))
          )}
        </CollapsibleSection>

        {/* Available Workflows Section */}
        <CollapsibleSection
          title="Available Workflows"
          count={availableWorkflows.length}
          isExpanded={sectionsExpanded.available}
          onToggle={() => toggleSection('available')}
        >
          {availableWorkflows.length === 0 ? (
            <div style={emptyStateStyle}>
              No workflows imported
            </div>
          ) : (
            availableWorkflows.map(workflow => (
              <div
                key={workflow.id}
                style={availableItemStyle(workflow.id === selectedAvailableWorkflowId)}
                onClick={() => onSelectAvailableWorkflow?.(workflow.id)}
                title={workflow.description || workflow.name}
                onMouseEnter={(e) => {
                  if (workflow.id !== selectedAvailableWorkflowId) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (workflow.id !== selectedAvailableWorkflowId) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {workflow.name}
              </div>
            ))
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
};

export default WorkflowManagerPanel;
