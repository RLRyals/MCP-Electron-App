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

import React, { useCallback, useEffect } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';

import { PhaseNode, PhaseNodeData } from './nodes/PhaseNode';

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

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflow,
  executionStatus,
  onNodeClick,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Convert workflow phases to React Flow nodes and edges
  useEffect(() => {
    if (!workflow || !workflow.phases_json) {
      console.warn('[WorkflowCanvas] No workflow or phases provided');
      return;
    }

    console.log('[WorkflowCanvas] Building graph for workflow:', workflow.name);

    // Create nodes from phases
    const flowNodes: Node<PhaseNodeData>[] = workflow.phases_json.map((phase, index) => {
      const status = executionStatus?.get(phase.id) || 'pending';

      // Auto-layout: horizontal arrangement if no position specified
      const position = phase.position || {
        x: index * 250,
        y: Math.floor(index / 5) * 200,
      };

      return {
        id: phase.id.toString(),
        type: phase.type,
        position,
        data: {
          label: phase.name,
          phase,
          status,
        },
      };
    });

    // Create edges between sequential phases
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

    console.log('[WorkflowCanvas] Created', flowNodes.length, 'nodes and', flowEdges.length, 'edges');
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [workflow, executionStatus, setNodes, setEdges]);

  // Handle new connections (for editing mode - future feature)
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle node clicks
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
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
    <div style={{ width: '100%', height: '600px', background: '#f9fafb', borderRadius: '8px', overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
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
};
