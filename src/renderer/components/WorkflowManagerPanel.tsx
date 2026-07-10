/**
 * WorkflowManagerPanel Component
 * VS Code/Obsidian-style right panel with collapsible sections
 * for Available Workflows and Active Workflows
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  onDeleteWorkflow?: (workflowId: string) => void;
  onReimportWorkflow?: (workflowId: string) => void;
  /** Called when an active workflow is selected - loads it in the canvas with current node highlighted */
  onSelectActiveWorkflow?: (workflowId: string, currentNodeId?: string, completedNodeIds?: string[], registryId?: string) => void;
}

export const WorkflowManagerPanel: React.FC<WorkflowManagerPanelProps> = ({
  isOpen,
  width,
  onWidthChange,
  onClose,
  availableWorkflows,
  onSelectAvailableWorkflow,
  selectedAvailableWorkflowId,
  onDeleteWorkflow,
  onReimportWorkflow,
  onSelectActiveWorkflow,
}) => {
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflowInstance[]>([]);
  const [selectedActiveWorkflow, setSelectedActiveWorkflow] = useState<ActiveWorkflowInstance | null>(null);
  // Tracks whether the last workflow:list-active call failed (see issue #178) -
  // surfaces MCP/connection failures instead of silently showing a stale/empty list.
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState({
    available: true,
    active: true,
  });
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Filter available workflows by search query
  const filteredAvailableWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return availableWorkflows;
    const query = searchQuery.toLowerCase();
    return availableWorkflows.filter(w =>
      w.name.toLowerCase().includes(query) ||
      (w.description && w.description.toLowerCase().includes(query))
    );
  }, [availableWorkflows, searchQuery]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;

    const handleClickOutside = (e: MouseEvent) => {
      setOpenMenuId(null);
    };

    // Add listener on next tick to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuId]);

  // Load active workflows
  const loadActiveWorkflows = useCallback(async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.invoke) {
        console.warn('[WorkflowManagerPanel] Electron API not available');
        return;
      }

      const result = await electronAPI.invoke('workflow:list-active');
      console.log('[WorkflowManagerPanel] Loaded active workflows:', result);

      if (Array.isArray(result)) {
        setActiveWorkflows(result);
        setHasConnectionError(false);
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

    // Surface workflow:list-active failures (see issue #178) instead of
    // leaving a broken MCP connection indistinguishable from "nothing running"
    const handleListActiveError = () => {
      setHasConnectionError(true);
    };
    electronAPI.on('workflow:list-active-error', handleListActiveError);

    // Poll every 5 seconds as backup
    const pollInterval = setInterval(loadActiveWorkflows, 5000);

    return () => {
      electronAPI.off('workflow:instance-updated', handleWorkflowUpdate);
      electronAPI.off('workflow:list-active-error', handleListActiveError);
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
      await electronAPI.invoke('workflow:pause', registryId);
      loadActiveWorkflows();
    } catch (error) {
      console.error('[WorkflowManagerPanel] Failed to pause workflow:', error);
    }
  };

  const handleResume = async (registryId: string) => {
    try {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.invoke('workflow:resume', registryId);
      loadActiveWorkflows();
    } catch (error) {
      console.error('[WorkflowManagerPanel] Failed to resume workflow:', error);
    }
  };

  const handleCancel = async (registryId: string) => {
    try {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.invoke('workflow:cancel', registryId);
      loadActiveWorkflows();
    } catch (error) {
      console.error('[WorkflowManagerPanel] Failed to cancel workflow:', error);
    }
  };

  const handleJumpToNode = async (registryId: string, nodeId: string) => {
    try {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.invoke('workflow:jump-to-node', { registryId, nodeId });
      loadActiveWorkflows();
    } catch (error) {
      console.error('[WorkflowManagerPanel] Failed to jump to node:', error);
    }
  };

  // Handle active workflow selection - highlight card AND load in canvas
  const handleSelectActiveWorkflow = (workflow: ActiveWorkflowInstance) => {
    setSelectedActiveWorkflow(workflow);
    // Load the workflow definition in canvas with current node highlighted and completed nodes marked
    if (onSelectActiveWorkflow) {
      onSelectActiveWorkflow(workflow.workflowId, workflow.currentNodeId, workflow.completedNodeIds, workflow.id);
    }
  };

  if (!isOpen) return null;

  // Styles
  const panelStyle: React.CSSProperties = {
    position: 'relative',
    height: '100%',
    width: `${width}px`,
    background: 'var(--color-bg-tertiary)',
    borderLeft: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '200px',
    maxWidth: '600px',
    // Note: overflow is NOT hidden so that dropdown menus can render outside the panel
  };

  const resizeHandleStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '4px',
    cursor: 'ew-resize',
    background: isResizing ? 'var(--color-accent)' : 'transparent',
    transition: 'background 0.15s ease',
    zIndex: 10,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--color-border, rgba(255, 255, 255, 0.1))',
    background: 'var(--color-bg-secondary)',
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
    borderLeft: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
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
          if (!isResizing) e.currentTarget.style.background = 'var(--color-accent)';
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
          {hasConnectionError && (
            <div
              style={{
                ...emptyStateStyle,
                color: '#f87171',
                textAlign: 'left',
                padding: '6px 12px',
                fontSize: '11px',
              }}
              title="workflow:list-active failed - the workflow server may be unreachable or still starting. Active workflow status may be stale. See the main-process log for details."
            >
              Connection issue — status may be stale
            </div>
          )}
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
                onSelect={handleSelectActiveWorkflow}
                isSelected={selectedActiveWorkflow?.id === workflow.id}
              />
            ))
          )}
        </CollapsibleSection>

        {/* Available Workflows Section */}
        <CollapsibleSection
          title="Available Workflows"
          count={filteredAvailableWorkflows.length}
          isExpanded={sectionsExpanded.available}
          onToggle={() => toggleSection('available')}
        >
          {/* Search Input */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 28px 6px 10px',
                  fontSize: '12px',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '4px',
                  color: 'var(--color-text-primary, rgba(255, 255, 255, 0.9))',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-tertiary, rgba(255, 255, 255, 0.5))',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {availableWorkflows.length === 0 ? (
            <div style={emptyStateStyle}>
              No workflows imported
            </div>
          ) : filteredAvailableWorkflows.length === 0 ? (
            <div style={emptyStateStyle}>
              No workflows match "{searchQuery}"
            </div>
          ) : (
            filteredAvailableWorkflows.map(workflow => {
              const isSelected = workflow.id === selectedAvailableWorkflowId;
              const isMenuOpen = openMenuId === workflow.id;
              return (
                <div
                  key={workflow.id}
                  style={{
                    ...availableItemStyle(isSelected),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'relative',
                  }}
                  onClick={() => onSelectAvailableWorkflow?.(workflow.id)}
                  title={workflow.description || workflow.name}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {workflow.name}
                    </span>
                    {workflow.version && (
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--color-text-tertiary, rgba(255, 255, 255, 0.5))',
                        flexShrink: 0,
                      }}>
                        v{workflow.version}
                      </span>
                    )}
                  </div>
                  {/* More Actions Button */}
                  {(onDeleteWorkflow || onReimportWorkflow) && (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isMenuOpen) {
                            setOpenMenuId(null);
                            setMenuPosition(null);
                          } else {
                            // Calculate position for fixed dropdown
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPosition({
                              top: rect.bottom + 4,
                              left: rect.right - 140, // 140 is minWidth of dropdown
                            });
                            setOpenMenuId(workflow.id);
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-text-tertiary, rgba(255, 255, 255, 0.5))',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '14px',
                          borderRadius: '3px',
                          lineHeight: 1,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.color = 'var(--color-text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--color-text-tertiary)';
                        }}
                        title="More actions"
                      >
                        ⋯
                      </button>
                      {/* Dropdown Menu - rendered via portal to avoid overflow clipping */}
                      {isMenuOpen && menuPosition && createPortal(
                        <div
                          style={{
                            position: 'fixed',
                            top: menuPosition.top,
                            left: menuPosition.left,
                            background: 'var(--color-bg-secondary)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                            zIndex: 10000,
                            minWidth: '140px',
                            overflow: 'hidden',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onReimportWorkflow && (
                            <button
                              onClick={() => {
                                onReimportWorkflow(workflow.id);
                                setOpenMenuId(null);
                                setMenuPosition(null);
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '8px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-text-secondary, rgba(255, 255, 255, 0.7))',
                                cursor: 'pointer',
                                fontSize: '12px',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              Refresh from source
                            </button>
                          )}
                          {onDeleteWorkflow && (
                            <button
                              onClick={() => {
                                if (confirm(`Delete workflow "${workflow.name}"?`)) {
                                  onDeleteWorkflow(workflow.id);
                                }
                                setOpenMenuId(null);
                                setMenuPosition(null);
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '8px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                fontSize: '12px',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              Delete workflow
                            </button>
                          )}
                        </div>,
                        document.body
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
};

export default WorkflowManagerPanel;
