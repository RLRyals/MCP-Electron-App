/**
 * WorkflowExecutionPanel - Integration Examples
 *
 * This file demonstrates various ways to integrate the WorkflowExecutionPanel
 * component into your application.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { WorkflowExecutionPanel } from './WorkflowExecutionPanel';
import { WorkflowCanvas } from './WorkflowCanvas';
import type { WorkflowDefinition } from '../../types/workflow';

/**
 * Helper function to convert WorkflowDefinition to the format WorkflowCanvas expects
 */
const toCanvasWorkflow = (workflow: WorkflowDefinition) => ({
  id: workflow.id,
  name: workflow.name,
  version: workflow.version,
  phases_json: workflow.phases.map(phase => ({
    id: phase.id,
    name: phase.name,
    type: phase.type,
    agent: phase.agent,
    skill: phase.skill,
    description: phase.description,
    gate: phase.gate,
    gateCondition: phase.gateCondition,
    requiresApproval: phase.requiresApproval,
    position: phase.position,
  })),
});

/**
 * EXAMPLE 1: Full-Screen Execution Panel
 * Use this when you want the execution panel to take over the entire view
 */
export const FullScreenExecutionExample: React.FC = () => {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);

  const handleStartWorkflow = async (workflowDef: WorkflowDefinition) => {
    try {
      const electronAPI = (window as any).electronAPI;
      const id = await electronAPI.invoke('workflow:start', {
        workflowDefId: workflowDef.id,
        seriesId: 1,
        userId: 1,
      });

      setInstanceId(id);
      setWorkflow(workflowDef);
    } catch (error) {
      console.error('Failed to start workflow:', error);
    }
  };

  const handleClose = () => {
    setInstanceId(null);
    setWorkflow(null);
  };

  if (!instanceId || !workflow) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h2>No workflow running</h2>
        <p style={{ color: '#6b7280', marginTop: '8px' }}>
          Load a workflow and click the button below to start execution
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh' }}>
      <WorkflowExecutionPanel
        instanceId={instanceId}
        workflow={workflow}
        onClose={handleClose}
      />
    </div>
  );
};

/**
 * EXAMPLE 2: Split View (Canvas + Execution Panel)
 * This is the RECOMMENDED integration for WorkflowsViewReact
 * Shows the workflow canvas on the left and execution panel on the right
 */
export const SplitViewExecutionExample: React.FC = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [runningInstance, setRunningInstance] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<Map<string, 'pending' | 'in_progress' | 'completed' | 'failed'>>(new Map());

  // Listen for phase events to update canvas status
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    const handlePhaseStarted = (data: any) => {
      setExecutionStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(data.phaseNumber, 'in_progress');
        return newMap;
      });
    };

    const handlePhaseCompleted = (data: any) => {
      setExecutionStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(data.phaseNumber, 'completed');
        return newMap;
      });
    };

    const handlePhaseFailed = (data: any) => {
      setExecutionStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(data.phaseNumber, 'failed');
        return newMap;
      });
    };

    electronAPI.on('workflow:phase-started', handlePhaseStarted);
    electronAPI.on('workflow:phase-completed', handlePhaseCompleted);
    electronAPI.on('workflow:phase-failed', handlePhaseFailed);

    return () => {
      electronAPI.off('workflow:phase-started', handlePhaseStarted);
      electronAPI.off('workflow:phase-completed', handlePhaseCompleted);
      electronAPI.off('workflow:phase-failed', handlePhaseFailed);
    };
  }, []);

  const handleStartWorkflow = async () => {
    if (!selectedWorkflow) return;

    try {
      const electronAPI = (window as any).electronAPI;
      const instanceId = await electronAPI.invoke('workflow:start', {
        workflowDefId: selectedWorkflow.id,
        seriesId: 1,
        userId: 1,
      });

      setRunningInstance(instanceId);
      setExecutionStatus(new Map()); // Reset status
    } catch (error) {
      console.error('Failed to start workflow:', error);
    }
  };

  const handleCloseExecution = () => {
    setRunningInstance(null);
    setExecutionStatus(new Map());
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left: Workflow Canvas */}
      <div style={{ flex: runningInstance ? 1 : 2, borderRight: '1px solid #e5e7eb' }}>
        {selectedWorkflow ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <button
                onClick={handleStartWorkflow}
                disabled={!!runningInstance}
                style={{
                  padding: '10px 20px',
                  background: runningInstance ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: runningInstance ? 'not-allowed' : 'pointer',
                }}
              >
                {runningInstance ? 'Running...' : 'Start Workflow'}
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <WorkflowCanvas
                workflow={toCanvasWorkflow(selectedWorkflow)}
                executionStatus={executionStatus}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ color: '#9ca3af' }}>Select a workflow to visualize</p>
          </div>
        )}
      </div>

      {/* Right: Execution Panel (when running) */}
      {runningInstance && selectedWorkflow && (
        <div style={{ flex: 1 }}>
          <WorkflowExecutionPanel
            instanceId={runningInstance}
            workflow={selectedWorkflow}
            onClose={handleCloseExecution}
          />
        </div>
      )}
    </div>
  );
};

/**
 * EXAMPLE 3: Tabbed Interface
 * Shows canvas and execution panel in separate tabs
 */
export const TabbedExecutionExample: React.FC = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [runningInstance, setRunningInstance] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'canvas' | 'execution'>('canvas');

  const handleStartWorkflow = async () => {
    if (!selectedWorkflow) return;

    try {
      const electronAPI = (window as any).electronAPI;
      const instanceId = await electronAPI.invoke('workflow:start', {
        workflowDefId: selectedWorkflow.id,
        seriesId: 1,
        userId: 1,
      });

      setRunningInstance(instanceId);
      setActiveTab('execution'); // Switch to execution tab
    } catch (error) {
      console.error('Failed to start workflow:', error);
    }
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '12px 24px',
    background: isActive ? '#3b82f6' : '#f3f4f6',
    color: isActive ? 'white' : '#6b7280',
    border: 'none',
    borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
        <button
          style={tabStyle(activeTab === 'canvas')}
          onClick={() => setActiveTab('canvas')}
        >
          Workflow Canvas
        </button>
        <button
          style={tabStyle(activeTab === 'execution')}
          onClick={() => setActiveTab('execution')}
          disabled={!runningInstance}
        >
          Execution Panel {runningInstance && '●'}
        </button>
        {!runningInstance && (
          <button
            onClick={handleStartWorkflow}
            disabled={!selectedWorkflow}
            style={{
              marginLeft: 'auto',
              padding: '12px 24px',
              background: selectedWorkflow ? '#10b981' : '#9ca3af',
              color: 'white',
              border: 'none',
              cursor: selectedWorkflow ? 'pointer' : 'not-allowed',
            }}
          >
            Start Workflow
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'canvas' && selectedWorkflow && (
          <WorkflowCanvas workflow={toCanvasWorkflow(selectedWorkflow)} />
        )}
        {activeTab === 'execution' && runningInstance && selectedWorkflow && (
          <WorkflowExecutionPanel
            instanceId={runningInstance}
            workflow={selectedWorkflow}
            onClose={() => {
              setRunningInstance(null);
              setActiveTab('canvas');
            }}
          />
        )}
      </div>
    </div>
  );
};

/**
 * EXAMPLE 4: Modal/Overlay Execution Panel
 * Shows execution panel as a modal overlay over the canvas
 */
export const ModalExecutionExample: React.FC = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [runningInstance, setRunningInstance] = useState<string | null>(null);

  const handleStartWorkflow = async () => {
    if (!selectedWorkflow) return;

    try {
      const electronAPI = (window as any).electronAPI;
      const instanceId = await electronAPI.invoke('workflow:start', {
        workflowDefId: selectedWorkflow.id,
        seriesId: 1,
        userId: 1,
      });

      setRunningInstance(instanceId);
    } catch (error) {
      console.error('Failed to start workflow:', error);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      {/* Background: Canvas */}
      <div style={{ height: '100%' }}>
        {selectedWorkflow && (
          <WorkflowCanvas workflow={toCanvasWorkflow(selectedWorkflow)} />
        )}
        <button
          onClick={handleStartWorkflow}
          disabled={!selectedWorkflow || !!runningInstance}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '12px 24px',
            background: runningInstance || !selectedWorkflow ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: runningInstance || !selectedWorkflow ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          }}
        >
          {runningInstance ? 'Running...' : 'Start Workflow'}
        </button>
      </div>

      {/* Overlay: Execution Panel */}
      {runningInstance && selectedWorkflow && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '1200px',
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <WorkflowExecutionPanel
              instanceId={runningInstance}
              workflow={selectedWorkflow}
              onClose={() => setRunningInstance(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * EXAMPLE 5: Responsive Mobile-Friendly Layout
 * Automatically switches between split and stacked views based on screen size
 */
export const ResponsiveExecutionExample: React.FC = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [runningInstance, setRunningInstance] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleStartWorkflow = async () => {
    if (!selectedWorkflow) return;

    try {
      const electronAPI = (window as any).electronAPI;
      const instanceId = await electronAPI.invoke('workflow:start', {
        workflowDefId: selectedWorkflow.id,
        seriesId: 1,
        userId: 1,
      });

      setRunningInstance(instanceId);
    } catch (error) {
      console.error('Failed to start workflow:', error);
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    height: '100vh',
  };

  const panelStyle: React.CSSProperties = {
    flex: 1,
    borderRight: isMobile ? 'none' : '1px solid #e5e7eb',
    borderBottom: isMobile ? '1px solid #e5e7eb' : 'none',
    minHeight: isMobile ? '50vh' : 'auto',
  };

  return (
    <div style={containerStyle}>
      {/* Canvas Panel */}
      <div style={panelStyle}>
        {selectedWorkflow ? (
          <>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <button onClick={handleStartWorkflow} disabled={!!runningInstance}>
                {runningInstance ? 'Running...' : 'Start Workflow'}
              </button>
            </div>
            <WorkflowCanvas workflow={toCanvasWorkflow(selectedWorkflow)} />
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p>Select a workflow</p>
          </div>
        )}
      </div>

      {/* Execution Panel (only show when running) */}
      {runningInstance && selectedWorkflow && (
        <div style={{ flex: 1 }}>
          <WorkflowExecutionPanel
            instanceId={runningInstance}
            workflow={selectedWorkflow}
            onClose={() => setRunningInstance(null)}
          />
        </div>
      )}
    </div>
  );
};

/**
 * INTEGRATION CHECKLIST
 *
 * When integrating WorkflowExecutionPanel, ensure you:
 *
 * ✓ Import the component and required types
 * ✓ Manage instanceId state (from workflow:start IPC)
 * ✓ Pass the complete WorkflowDefinition object
 * ✓ Handle the onClose callback
 * ✓ Setup IPC event listeners if you need to update canvas status
 * ✓ Provide error handling for workflow:start failures
 * ✓ Consider responsive layout for different screen sizes
 * ✓ Test with workflows that have approval gates
 * ✓ Test with multi-phase workflows
 * ✓ Verify streaming output displays correctly
 */
