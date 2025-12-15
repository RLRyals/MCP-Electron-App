/**
 * WorkflowCanvas Component
 * React Flow visualization for workflows
 *
 * Features:
 * - Converts workflow phases to React Flow nodes
 * - Creates edges between sequential phases
 * - Shows execution status with color coding
 * - Animates edges during execution
 * - Supports custom node types
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  MarkerType,
  NodeDragHandler,
} from 'reactflow';
// Note: reactflow styles are loaded via <link> tag in index.html

import { PhaseNode, PhaseNodeData } from './nodes/PhaseNode.js';

// Simple debounce utility
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Register custom node types
const nodeTypes = {
  planning: PhaseNode,
  writing: PhaseNode,
  gate: PhaseNode,
  user: PhaseNode,
  subworkflow: PhaseNode,
  loop: PhaseNode,
};

export interface WorkflowCanvasProps {
  workflow: {
    id: string;
    name: string;
    version: string;
    phases_json: Array<{
      id: number;
      name: string;
      type: 'planning' | 'gate' | 'writing' | 'loop' | 'user' | 'subworkflow';
      agent: string;
      skill?: string;
      description: string;
      gate: boolean;
      gateCondition?: string;
      requiresApproval: boolean;
      position?: { x: number; y: number };
    }>;
  };
  executionStatus?: Map<number, 'pending' | 'in_progress' | 'completed' | 'failed'>;
  onNodeClick?: (nodeId: string, phase: any) => void;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = React.memo(({
  workflow,
  executionStatus,
  onNodeClick,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isSaving, setIsSaving] = useState(false);
  const nodesRef = useRef<Node[]>([]);

  // Build initial node structure once per workflow (stable positions and structure)
  const baseNodes = useMemo(() => {
    if (!workflow || !workflow.phases_json) {
      return [];
    }

    return workflow.phases_json.map((phase, index) => {
      // Auto-layout: horizontal arrangement if no position specified
      const position = phase.position || {
        x: index * 250,
        y: Math.floor(index / 5) * 200,
      };

      // Create a sanitized phase object with only the fields we need
      const sanitizedPhase = {
        id: phase.id,
        name: String(phase.name || 'Unnamed'),
        type: phase.type,
        agent: String(phase.agent || 'Unknown'),
        skill: phase.skill ? String(phase.skill) : undefined,
        description: String(phase.description || ''),
        gate: Boolean(phase.gate),
        requiresApproval: Boolean(phase.requiresApproval),
      };

      return {
        id: phase.id.toString(),
        type: phase.type,
        position,
        baseData: {
          label: String(phase.name || 'Unnamed'),
          phase: sanitizedPhase,
        },
      };
    });
  }, [workflow?.id, workflow?.version]); // Only rebuild if workflow identity changes

  // Update nodes with current execution status (this is fast - only updates data prop)
  const nodesWithStatus = useMemo(() => {
    return baseNodes.map(node => ({
      ...node,
      data: {
        ...node.baseData,
        status: executionStatus?.get(node.baseData.phase.id) || 'pending',
      },
    }));
  }, [baseNodes, executionStatus]);

  // Build edges with status-based styling
  const edgesWithStatus = useMemo(() => {
    if (!workflow || !workflow.phases_json) {
      return [];
    }

    const flowEdges: Edge[] = [];
    for (let i = 0; i < workflow.phases_json.length - 1; i++) {
      const sourcePhase = workflow.phases_json[i];
      const targetPhase = workflow.phases_json[i + 1];
      const sourceStatus = executionStatus?.get(sourcePhase.id) || 'pending';

      flowEdges.push({
        id: `e${sourcePhase.id}-${targetPhase.id}`,
        source: sourcePhase.id.toString(),
        target: targetPhase.id.toString(),
        type: 'smoothstep',
        animated: sourceStatus === 'in_progress',
        style: {
          stroke: sourceStatus === 'completed' ? '#4ade80' : '#d1d5db',
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: sourceStatus === 'completed' ? '#4ade80' : '#d1d5db',
        },
      });
    }

    return flowEdges;
  }, [workflow?.phases_json, executionStatus]);

  // Update React Flow state when memoized values change
  useEffect(() => {
    if (nodesWithStatus.length > 0) {
      console.log('[WorkflowCanvas] Updating', nodesWithStatus.length, 'nodes');
      setNodes(nodesWithStatus);
      nodesRef.current = nodesWithStatus;
    }
  }, [nodesWithStatus, setNodes]);

  useEffect(() => {
    if (edgesWithStatus.length > 0) {
      console.log('[WorkflowCanvas] Updating', edgesWithStatus.length, 'edges');
      setEdges(edgesWithStatus);
    }
  }, [edgesWithStatus, setEdges]);

  // Debounced save function for node positions
  const savePositions = useMemo(
    () => debounce(async (workflowId: string, positions: Record<string, { x: number; y: number }>) => {
      try {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI || !electronAPI.invoke) {
          console.warn('[WorkflowCanvas] Electron API not available');
          return;
        }

        setIsSaving(true);
        await electronAPI.invoke('workflow:update-positions', {
          workflowId,
          positions
        });
        console.log('[WorkflowCanvas] Saved node positions');
      } catch (error) {
        console.error('[WorkflowCanvas] Failed to save positions:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    []
  );

  // Handle node drag stop - save new positions
  const onNodeDragStop: NodeDragHandler = useCallback(
    (_event, _node) => {
      if (!workflow) return;

      // Collect all current node positions
      const positions: Record<string, { x: number; y: number }> = {};
      nodesRef.current.forEach(node => {
        const phaseId = (node.data as PhaseNodeData).phase.id;
        positions[phaseId] = { x: node.position.x, y: node.position.y };
      });

      console.log('[WorkflowCanvas] Node dragged, saving positions...');
      setIsSaving(true);
      savePositions(workflow.id, positions);
    },
    [workflow, savePositions]
  );

  // Handle new connections (for editing mode - future feature)
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle node clicks
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      console.log('[WorkflowCanvas] Node clicked:', node.id);
      if (onNodeClick && node.data) {
        onNodeClick(node.id, (node.data as PhaseNodeData).phase);
      }
    },
    [onNodeClick]
  );

  if (!workflow) {
    return (
      <div style={{
        width: '100%',
        height: '600px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
      }}>
        Select a workflow to visualize
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', background: '#f9fafb', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
      {isSaving && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000,
        }}>
          Saving positions...
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        minZoom={0.2}
        maxZoom={2}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
});
