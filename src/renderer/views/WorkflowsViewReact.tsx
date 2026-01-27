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

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as ReactDOM from 'react-dom/client';
import type { View } from '../components/ViewRouter.js';
import type { TopBarConfig } from '../components/TopBar.js';
import type { WorkflowListItem } from '../components/WorkflowList.js';
import { WorkflowCanvas } from '../components/WorkflowCanvas.js';
import { WorkflowImportDialog, ImportResult } from '../components/WorkflowImportDialog.js';
import { WorkflowExportDialog } from '../components/WorkflowExportDialog.js';
import { ProjectCreationDialog } from '../components/ProjectCreationDialog.js';
import { WorkflowManagerPanel } from '../components/WorkflowManagerPanel.js';
import { getActiveSeriesId, appState } from '../store/app-state.js';
import type { WorkflowUpdate } from '../../types/workflow.js';
import type { Project } from '../../types/project.js';

// Plugin IPC channel prefix for workflow plugin
const WORKFLOW_PLUGIN = 'plugin:fictionlab-workflow:';

// Temporary stub - series management is now in MCP-Writing-Servers
interface Series {
  id: number;
  name: string;
  description?: string;
  project_id?: number | null;
}

// Main React Component
const WorkflowsApp: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowListItem | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<Map<string, 'pending' | 'in_progress' | 'completed' | 'failed'>>(new Map());

  // Workflow Manager Panel state
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(320);

  // Active workflow tracking - which node is currently being executed
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Track which active workflow instance is displayed on the canvas
  const [activeRegistryId, setActiveRegistryId] = useState<string | null>(null);
  const activeRegistryIdRef = useRef<string | null>(null);

  // Keep ref in sync with state so event handlers always see the latest value
  useEffect(() => { activeRegistryIdRef.current = activeRegistryId; }, [activeRegistryId]);

  // Load workflows function (can be reused)
  const loadWorkflows = useCallback(async (skipCache: boolean = false) => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.invoke) {
        console.warn('[WorkflowsViewReact] Electron API not available');
        return;
      }

      const result = await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:list`, skipCache ? { skipCache: true } : undefined);
      console.log('[WorkflowsViewReact] Loaded workflows:', result);

      // Handle empty array (server not available) vs actual workflows
      if (Array.isArray(result)) {
        setWorkflows(result);
      } else {
        setWorkflows([]);
      }
    } catch (error) {
      console.error('[WorkflowsViewReact] Failed to load workflows:', error);
      setWorkflows([]);
    }
  }, []);

  // Load workflows on mount and setup event listeners with proper cleanup
  useEffect(() => {
    loadWorkflows();

    // Load app state
    appState.refresh().catch(error => {
      console.error('[WorkflowsViewReact] Failed to load app state:', error);
    });

    // Subscribe to TopBar events
    const topBar = (window as any).topBar;
    if (topBar) {
      topBar.on('create-project', () => {
        console.log('[WorkflowsViewReact] Create project event');
        setShowProjectDialog(true);
      });

      topBar.on('project-selected', async (data: { projectId: number; projectName: string }) => {
        console.log('[WorkflowsViewReact] Project selected event:', data);

        // Refresh app state to ensure projects are loaded
        console.log('[WorkflowsViewReact] Calling appState.refresh()...');
        await appState.refresh();
        console.log('[WorkflowsViewReact] appState.refresh() completed');
        console.log('[WorkflowsViewReact] Projects in state after refresh:', appState.getState().projects);

        // Set active project
        console.log('[WorkflowsViewReact] Setting active project to:', data.projectId);
        appState.setActiveProject(data.projectId);
        console.log('[WorkflowsViewReact] Active project ID after set:', appState.getActiveProjectId());
        console.log('[WorkflowsViewReact] Active project object:', appState.getActiveProject());

        // Refresh TopBar to show selected project
        console.log('[WorkflowsViewReact] Calling topBar.refreshProjectSelector()...');
        await topBar.refreshProjectSelector();
        console.log('[WorkflowsViewReact] topBar.refreshProjectSelector() completed');

        if (typeof (window as any).showNotification === 'function') {
          (window as any).showNotification(`Project "${data.projectName}" selected`, 'success');
        }
      });

      topBar.on('series-selected', async (data: { seriesId: number; seriesName: string }) => {
        console.log('[WorkflowsViewReact] Series selected event:', data);
        appState.setActiveSeries(data.seriesId);
        topBar.refreshProjectSelector();

        if (typeof (window as any).showNotification === 'function') {
          (window as any).showNotification(`Series "${data.seriesName}" selected`, 'success');
        }
      });
    }

    // Setup event listener for real-time workflow canvas updates
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.on || !electronAPI.off) return;

    const handleInstanceUpdated = (update: WorkflowUpdate) => {
      // Only process updates for the workflow instance currently shown on canvas
      if (!activeRegistryIdRef.current || update.registryId !== activeRegistryIdRef.current) {
        return;
      }

      console.log('[WorkflowsViewReact] Instance updated (canvas):', update.type, update.data);

      switch (update.type) {
        case 'node_changed': {
          const newNodeId = update.data.currentNodeId;
          if (newNodeId) {
            setActiveNodeId(newNodeId);
            setExecutionStatus(prev => {
              const newMap = new Map(prev);
              newMap.set(newNodeId, 'in_progress');
              return newMap;
            });
          }
          break;
        }

        case 'progress': {
          const { completedNodeIds, currentNodeId } = update.data;
          if (completedNodeIds && completedNodeIds.length > 0) {
            setExecutionStatus(prev => {
              const newMap = new Map(prev);
              for (const nodeId of completedNodeIds) {
                newMap.set(nodeId, 'completed');
              }
              return newMap;
            });
          }
          if (currentNodeId) {
            setActiveNodeId(currentNodeId);
            setExecutionStatus(prev => {
              const newMap = new Map(prev);
              newMap.set(currentNodeId, 'in_progress');
              return newMap;
            });
          }
          break;
        }

        case 'completed': {
          setActiveNodeId(null);
          break;
        }

        case 'failed': {
          const failedNodeId = update.data.currentNodeId;
          if (failedNodeId) {
            setExecutionStatus(prev => {
              const newMap = new Map(prev);
              newMap.set(failedNodeId, 'failed');
              return newMap;
            });
          }
          setActiveNodeId(null);
          break;
        }
      }
    };

    electronAPI.on('workflow:instance-updated', handleInstanceUpdated);

    // Cleanup on unmount
    return () => {
      electronAPI.off('workflow:instance-updated', handleInstanceUpdated);
    };
  }, []);

  const handleSelectWorkflow = async (workflowId: string) => {
    try {
      console.log('[WorkflowsViewReact] Fetching workflow with id:', workflowId);
      const electronAPI = (window as any).electronAPI;
      const workflow = await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:get`, { id: workflowId });

      console.log('[WorkflowsViewReact] Selected workflow result:', workflow);

      setSelectedWorkflow(workflow);
      // Reset execution status and active node when switching workflows
      setExecutionStatus(new Map());
      setActiveNodeId(null);
      setActiveRegistryId(null);
    } catch (error) {
      console.error('[WorkflowsViewReact] Failed to get workflow:', error);
    }
  };

  // Handle active workflow selection - load workflow and highlight current node
  const handleSelectActiveWorkflow = async (workflowId: string, currentNodeId?: string, completedNodeIds?: string[], registryId?: string) => {
    try {
      console.log('[WorkflowsViewReact] Selecting active workflow:', workflowId, 'currentNode:', currentNodeId, 'completedNodes:', completedNodeIds, 'registryId:', registryId);
      const electronAPI = (window as any).electronAPI;
      const workflow = await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:get`, { id: workflowId });

      console.log('[WorkflowsViewReact] Loaded active workflow:', workflow);

      setSelectedWorkflow(workflow);
      setActiveNodeId(currentNodeId || null);
      setActiveRegistryId(registryId || null);

      // Populate executionStatus from completedNodeIds
      const newStatus = new Map<string, 'pending' | 'in_progress' | 'completed' | 'failed'>();
      if (completedNodeIds && completedNodeIds.length > 0) {
        for (const nodeId of completedNodeIds) {
          newStatus.set(nodeId, 'completed');
        }
      }
      // Mark current node as in_progress
      if (currentNodeId) {
        newStatus.set(currentNodeId, 'in_progress');
      }
      setExecutionStatus(newStatus);
    } catch (error) {
      console.error('[WorkflowsViewReact] Failed to load active workflow:', error);
    }
  };

  const handleImport = async (folderPath: string, customId?: string, customName?: string): Promise<ImportResult> => {
    try {
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:import-from-folder`, folderPath, customId, customName);

      if (result.success) {
        // Reload workflows list, skipping cache to get fresh data
        const freshWorkflows = await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:list`, { skipCache: true });
        if (Array.isArray(freshWorkflows)) {
          setWorkflows(freshWorkflows);
        }
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

      // Get active project ID from app state
      const activeProjectId = appState.getActiveProjectId();

      // Validate project is selected
      if (!activeProjectId) {
        if (typeof (window as any).showNotification === 'function') {
          (window as any).showNotification('Please select a project first (use the project selector in the top bar)', 'error');
        } else {
          alert('Please select a project first (use the project selector in the top bar)');
        }
        return;
      }

      // Get full project object to access folder_path
      const activeProject = appState.getActiveProject();
      console.log('[WorkflowsViewReact] Active project for workflow start:', activeProject);

      if (!activeProject) {
        if (typeof (window as any).showNotification === 'function') {
          (window as any).showNotification('No active project found. Please select a project from the top bar.', 'error');
        } else {
          alert('No active project found. Please select a project from the top bar.');
        }
        return;
      }

      // Handle both folder_path and folder_location for backward compatibility
      const projectFolder = (activeProject as any).folder_path || (activeProject as any).folder_location;

      if (!projectFolder) {
        if (typeof (window as any).showNotification === 'function') {
          (window as any).showNotification('Selected project does not have a folder path configured', 'error');
        } else {
          alert('Selected project does not have a folder path configured');
        }
        return;
      }

      console.log('[WorkflowsViewReact] Starting workflow with project folder:', projectFolder);

      const instanceId = await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:execute`, {
        workflowId: selectedWorkflow.id,
        options: {
          seriesId: activeProjectId, // Using projectId as seriesId for now
          userId: 1, // TODO: Get from user session
          projectFolder: projectFolder, // Add project folder for file operations
        }
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

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      const electronAPI = (window as any).electronAPI;

      await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:delete`, workflowId);

      console.log('[WorkflowsViewReact] Deleted workflow:', workflowId);

      // Reload workflows list (skip cache to get fresh data)
      await loadWorkflows(true);

      // Clear selection if we deleted the selected workflow
      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(null);
      }

      if (typeof (window as any).showNotification === 'function') {
        (window as any).showNotification('Workflow deleted successfully', 'success');
      }
    } catch (error: any) {
      console.error('[WorkflowsViewReact] Failed to delete workflow:', error);
      if (typeof (window as any).showNotification === 'function') {
        (window as any).showNotification(`Failed to delete workflow: ${error.message}`, 'error');
      }
    }
  };

  const handleReimportWorkflow = async (workflowId: string) => {
    try {
      const electronAPI = (window as any).electronAPI;

      await electronAPI.invoke(`${WORKFLOW_PLUGIN}workflow:reimport`, workflowId);

      console.log('[WorkflowsViewReact] Reimported workflow:', workflowId);

      // Reload workflows list (skip cache to get fresh data)
      await loadWorkflows(true);

      // Reload selected workflow if it was the reimported one
      if (selectedWorkflow?.id === workflowId) {
        handleSelectWorkflow(workflowId);
      }

      if (typeof (window as any).showNotification === 'function') {
        (window as any).showNotification('Workflow refreshed from source', 'success');
      }
    } catch (error: any) {
      console.error('[WorkflowsViewReact] Failed to reimport workflow:', error);
      if (typeof (window as any).showNotification === 'function') {
        (window as any).showNotification(`Failed to refresh workflow: ${error.message}`, 'error');
      }
    }
  };

  const handleProjectCreated = async (project: Project) => {
    console.log('[WorkflowsViewReact] Project created:', project);

    // Add project to app state
    appState.addProject(project);

    // Set as active project
    appState.setActiveProject(project.id);

    // Refresh TopBar display
    const topBar = (window as any).topBar;
    if (topBar && typeof topBar.refreshProjectSelector === 'function') {
      await topBar.refreshProjectSelector();
    }

    if (typeof (window as any).showNotification === 'function') {
      (window as any).showNotification(`Project "${project.name}" created successfully`, 'success');
    }
  };

  const handleSeriesCreated = async (series: Series) => {
    console.log('[WorkflowsViewReact] Series created:', series);

    // Refresh app state
    await appState.refresh();

    // Auto-select the newly created series
    appState.setActiveSeries(series.id);

    // Refresh TopBar display
    const topBar = (window as any).topBar;
    if (topBar && typeof topBar.refreshProjectSelector === 'function') {
      topBar.refreshProjectSelector();
    }

    if (typeof (window as any).showNotification === 'function') {
      (window as any).showNotification(`Series "${series.name}" created successfully and selected`, 'success');
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

  const buttonStyle = (variant: 'primary' | 'secondary' | 'success' = 'secondary', disabled = false): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: variant === 'primary' ? '#3b82f6' : variant === 'success' ? '#10b981' : '#ffffff',
    color: variant === 'primary' || variant === 'success' ? '#ffffff' : '#374151',
    border: variant === 'primary' || variant === 'success' ? 'none' : '1px solid #d1d5db',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s ease',
  });

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  };

  const mainContentStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  };

  const canvasContainerStyle: React.CSSProperties = {
    flex: 1,
    padding: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
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
          style={buttonStyle('secondary', !selectedWorkflow)}
          onClick={() => setShowExportDialog(true)}
          disabled={!selectedWorkflow}
        >
          📤 Export Workflow
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
          onClick={() => loadWorkflows(true)}
        >
          🔄 Refresh
        </button>
        <div style={{ flex: 1 }} /> {/* Spacer */}
        <button
          style={buttonStyle(isPanelOpen ? 'primary' : 'secondary')}
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          title={isPanelOpen ? 'Hide panel' : 'Show panel'}
        >
          {isPanelOpen ? '◀ Hide Panel' : '▶ Show Panel'}
        </button>
      </div>

      {/* Main Content */}
      <div style={contentStyle}>
        <div style={mainContentStyle}>
          {/* Canvas area */}
          <div style={canvasContainerStyle}>
          {selectedWorkflow ? (
            <>
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                background: '#f3f4f6',
                borderRadius: '8px',
                flexShrink: 0,
              }}>
                <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
                  {String(selectedWorkflow.name || 'Unnamed Workflow')}
                </div>
                {selectedWorkflow.description && typeof selectedWorkflow.description === 'string' && (
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    {selectedWorkflow.description}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  Version {String(selectedWorkflow.version || '1.0')} • {selectedWorkflow.graph_json?.nodes?.length || 0} nodes
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
              {(() => {
                try {
                  return (
                    <WorkflowCanvas
                      workflow={{
                        id: selectedWorkflow.id,
                        name: String(selectedWorkflow.name),
                        version: String(selectedWorkflow.version),
                        graph_json: selectedWorkflow.graph_json ? {
                          nodes: selectedWorkflow.graph_json.nodes || [],
                          edges: selectedWorkflow.graph_json.edges || []
                        } : undefined
                      }}
                      executionStatus={executionStatus}
                      activeNodeId={activeNodeId}
                      onNodeClick={(nodeId: string, phase: any) => {
                        console.log('[WorkflowsViewReact] Node clicked:', nodeId, phase);
                      }}
                      onWorkflowChange={(updatedWorkflow: any) => {
                        console.log('[WorkflowsViewReact] Workflow changed:', updatedWorkflow);
                        // Update the selected workflow with the new data
                        setSelectedWorkflow({
                          ...selectedWorkflow,
                          ...updatedWorkflow,
                        });
                        // Reload workflows list to ensure it's in sync
                        loadWorkflows();
                      }}
                      availableWorkflows={workflows.map(w => ({
                        id: w.id,
                        name: String(w.name),
                        description: w.description,
                        version: w.version
                      }))}
                    />
                  );
                } catch (error) {
                  console.error('[WorkflowsViewReact] Error rendering WorkflowCanvas:', error);
                  return <div style={{ padding: '20px', color: 'red' }}>Error rendering workflow: {String(error)}</div>;
                }
              })()}
              </div>
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
              Select a workflow from the panel to visualize
            </div>
          )}
          </div>

          {/* Workflow Manager Panel */}
          <WorkflowManagerPanel
            isOpen={isPanelOpen}
            width={panelWidth}
            onWidthChange={setPanelWidth}
            onClose={() => setIsPanelOpen(false)}
            availableWorkflows={workflows}
            onSelectAvailableWorkflow={handleSelectWorkflow}
            selectedAvailableWorkflowId={selectedWorkflow?.id}
            onDeleteWorkflow={handleDeleteWorkflow}
            onReimportWorkflow={handleReimportWorkflow}
            onSelectActiveWorkflow={handleSelectActiveWorkflow}
          />
        </div>
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <WorkflowImportDialog
          onImport={handleImport}
          onClose={() => setShowImportDialog(false)}
        />
      )}

      {/* Export Dialog */}
      {showExportDialog && selectedWorkflow && (
        <WorkflowExportDialog
          workflowId={selectedWorkflow.id}
          workflowName={String(selectedWorkflow.name)}
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Project Creation Dialog */}
      <ProjectCreationDialog
        isOpen={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        onProjectCreated={handleProjectCreated}
      />
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
