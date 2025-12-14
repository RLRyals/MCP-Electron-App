/**
 * WorkflowsViewReact
 * React-based workflow management view with visualization
 *
 * Features:
 * - List of saved workflows (sidebar)
 * - React Flow workflow visualization (canvas)
 * - Import workflow dialog
 * - Start workflow execution
 * - Real-time status updates
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { View } from '../components/ViewRouter';
import type { TopBarConfig } from '../components/TopBar';
import { WorkflowList, WorkflowListItem } from '../components/WorkflowList';
import { WorkflowCanvas } from '../components/WorkflowCanvas';
import { WorkflowImportDialog, ImportResult } from '../components/WorkflowImportDialog';

// Main React Component
const WorkflowsApp: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowListItem | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<Map<number, 'pending' | 'in_progress' | 'completed' | 'failed'>>(new Map());

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
    setupEventListeners();
  }, []);

  const loadWorkflows = async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.invoke) {
        console.warn('[WorkflowsViewReact] Electron API not available');
        return;
      }

      const result = await electronAPI.invoke('workflow:get-definitions');
      console.log('[WorkflowsViewReact] Loaded workflows:', result);
      setWorkflows(result || []);
    } catch (error) {
      console.error('[WorkflowsViewReact] Failed to load workflows:', error);
      setWorkflows([]);
    }
  };

  const setupEventListeners = () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.on) return;

    // Listen for workflow phase updates
    electronAPI.on('workflow:phase-started', (data: any) => {
      console.log('[WorkflowsViewReact] Phase started:', data);
      setExecutionStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(data.phaseNumber, 'in_progress');
        return newMap;
      });
    });

    electronAPI.on('workflow:phase-completed', (data: any) => {
      console.log('[WorkflowsViewReact] Phase completed:', data);
      setExecutionStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(data.phaseNumber, 'completed');
        return newMap;
      });
    });

    electronAPI.on('workflow:phase-failed', (data: any) => {
      console.log('[WorkflowsViewReact] Phase failed:', data);
      setExecutionStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(data.phaseNumber, 'failed');
        return newMap;
      });
    });
  };

  const handleSelectWorkflow = async (workflowId: string) => {
    try {
      const electronAPI = (window as any).electronAPI;
      const workflow = await electronAPI.invoke('workflow:get-definition', workflowId);
      console.log('[WorkflowsViewReact] Selected workflow:', workflow);
      setSelectedWorkflow(workflow);
      // Reset execution status when switching workflows
      setExecutionStatus(new Map());
    } catch (error) {
      console.error('[WorkflowsViewReact] Failed to get workflow:', error);
    }
  };

  const handleImport = async (folderPath: string): Promise<ImportResult> => {
    try {
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.invoke('workflow:import-from-folder', folderPath);

      if (result.success) {
        // Reload workflows list
        await loadWorkflows();
      }

      return result;
    } catch (error: any) {
      console.error('[WorkflowsViewReact] Import failed:', error);
      return {
        success: false,
        message: error.message || 'Unknown error occurred',
      };
    }
  };

  const handleStartWorkflow = async () => {
    if (!selectedWorkflow) return;

    try {
      const electronAPI = (window as any).electronAPI;

      // TODO: Get actual seriesId and userId from app context
      const instanceId = await electronAPI.invoke('workflow:start', {
        workflowDefId: selectedWorkflow.id,
        seriesId: 1,
        userId: 1,
      });

      console.log('[WorkflowsViewReact] Started workflow instance:', instanceId);

      // Show notification
      if (typeof (window as any).showNotification === 'function') {
        (window as any).showNotification('Workflow started successfully', 'success');
      }
    } catch (error: any) {
      console.error('[WorkflowsViewReact] Failed to start workflow:', error);
      if (typeof (window as any).showNotification === 'function') {
        (window as any).showNotification(`Failed to start workflow: ${error.message}`, 'error');
      }
    }
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#ffffff',
  };

  const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
  };

  const buttonStyle = (variant: 'primary' | 'secondary' = 'secondary', disabled = false): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: variant === 'primary' ? '#3b82f6' : '#ffffff',
    color: variant === 'primary' ? '#ffffff' : '#374151',
    border: variant === 'primary' ? 'none' : '1px solid #d1d5db',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s ease',
  });

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  };

  const sidebarStyle: React.CSSProperties = {
    width: '320px',
    borderRight: '1px solid #e5e7eb',
    overflow: 'auto',
  };

  const canvasContainerStyle: React.CSSProperties = {
    flex: 1,
    padding: '16px',
    overflow: 'auto',
  };

  return (
    <div style={containerStyle}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <button
          style={buttonStyle('secondary')}
          onClick={() => setShowImportDialog(true)}
        >
          📥 Import Workflow
        </button>
        <button
          style={buttonStyle('primary', !selectedWorkflow)}
          onClick={handleStartWorkflow}
          disabled={!selectedWorkflow}
        >
          ▶️ Start Workflow
        </button>
        <button
          style={buttonStyle('secondary')}
          onClick={loadWorkflows}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Main Content */}
      <div style={contentStyle}>
        {/* Sidebar with workflow list */}
        <div style={sidebarStyle}>
          <WorkflowList
            workflows={workflows}
            selectedId={selectedWorkflow?.id}
            onSelect={handleSelectWorkflow}
          />
        </div>

        {/* Canvas area */}
        <div style={canvasContainerStyle}>
          {selectedWorkflow ? (
            <>
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                background: '#f3f4f6',
                borderRadius: '8px',
              }}>
                <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
                  {selectedWorkflow.name}
                </div>
                {selectedWorkflow.description && (
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    {selectedWorkflow.description}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  Version {selectedWorkflow.version} • {selectedWorkflow.phases_json?.length || 0} phases
                </div>
              </div>
              <WorkflowCanvas
                workflow={selectedWorkflow}
                executionStatus={executionStatus}
                onNodeClick={(nodeId, phase) => {
                  console.log('[WorkflowsViewReact] Node clicked:', nodeId, phase);
                }}
              />
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9ca3af',
              fontSize: '14px',
            }}>
              Select a workflow from the sidebar to visualize
            </div>
          )}
        </div>
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <WorkflowImportDialog
          onImport={handleImport}
          onClose={() => setShowImportDialog(false)}
        />
      )}
    </div>
  );
};

// View class wrapper for ViewRouter
export class WorkflowsViewReact implements View {
  private container: HTMLElement | null = null;
  private root: ReactDOM.Root | null = null;

  async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    // Create React root and render
    this.root = ReactDOM.createRoot(container);
    this.root.render(<WorkflowsApp />);

    console.log('[WorkflowsViewReact] Mounted');
  }

  async unmount(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.container = null;
    console.log('[WorkflowsViewReact] Unmounted');
  }

  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Workflows',
      actions: [
        { id: 'import', label: 'Import Workflow', icon: '📥' },
        { id: 'refresh', label: 'Refresh', icon: '🔄' },
      ],
      global: {
        projectSelector: true,
        environmentIndicator: true,
      },
    };
  }

  handleAction(actionId: string): void {
    console.log('[WorkflowsViewReact] Action:', actionId);
    // Actions are handled by the React component directly via toolbar buttons
    // This is for top bar integration if needed
  }
}
