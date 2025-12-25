/**
 * WorkflowCanvas Component - N8N-Style Graph-Based Workflow Editor
 * React Flow visualization for graph-based workflows with manual connections
 *
 * Features:
 * - Graph-based nodes (not sequential array)
 * - Manual edge creation via drag-and-drop
 * - Delete nodes and edges
 * - Conditional edge labels (Pass, Fail, Loop Back)
 * - Edge editing for conditions
 * - Persistent node positions
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import ReactFlow, {
  Node,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  BackgroundVariant,
  MarkerType,
  NodeDragHandler,
  EdgeMouseHandler,
  OnSelectionChangeParams,
} from 'reactflow';
// Note: reactflow styles are loaded via <link> tag in index.html

import { PhaseNode, PhaseNodeData } from './nodes/PhaseNode.js';
import { NodeConfigDialog } from './dialogs/NodeConfigDialog.js';
import { DocumentEditDialog } from './dialogs/DocumentEditDialog.js';
import type { WorkflowNode } from '../../types/workflow-nodes.js';
import type { LLMProviderConfig } from '../../types/llm-providers.js';

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

// Register custom node types - all 10 types use PhaseNode
const nodeTypes = {
  planning: PhaseNode,
  writing: PhaseNode,
  gate: PhaseNode,
  'user-input': PhaseNode,
  user: PhaseNode, // Legacy support
  code: PhaseNode,
  http: PhaseNode,
  file: PhaseNode,
  conditional: PhaseNode,
  loop: PhaseNode,
  subworkflow: PhaseNode,
};

// Edge label dialog state
interface EdgeEditState {
  edgeId: string;
  label: string;
  condition: string;
  type: 'default' | 'conditional' | 'loop-back';
}

export interface WorkflowCanvasProps {
  workflow: {
    id: string;
    name: string;
    version: string;
    graph_json?: {
      nodes: Array<{
        id: string;
        type: 'planning' | 'writing' | 'gate' | 'user-input' | 'user' | 'code' | 'http' | 'file' | 'conditional' | 'loop' | 'subworkflow';
        name: string;
        agent: string;
        skill?: string;
        subWorkflowId?: string;
        description: string;
        gate: boolean;
        gateCondition?: string;
        requiresApproval: boolean;
        position: { x: number; y: number };
      }>;
      edges: Array<{
        id: string;
        source: string;
        target: string;
        type?: 'default' | 'conditional' | 'loop-back';
        label?: string;
        condition?: string;
        animated?: boolean;
      }>;
    };
    // Legacy support for phases_json (will be migrated to graph_json)
    phases_json?: Array<{
      id: number;
      name: string;
      type: 'planning' | 'writing' | 'gate' | 'user-input' | 'user' | 'code' | 'http' | 'file' | 'conditional' | 'loop' | 'subworkflow';
      agent: string;
      skill?: string;
      subWorkflowId?: string;
      description: string;
      gate: boolean;
      gateCondition?: string;
      requiresApproval: boolean;
      position?: { x: number; y: number };
    }>;
  };
  executionStatus?: Map<string, 'pending' | 'in_progress' | 'completed' | 'failed'>;
  onNodeClick?: (nodeId: string, phase: any) => void;
  onWorkflowChange?: (workflow: any) => void;
  onOpenSubWorkflow?: (subWorkflowId: string) => void;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = React.memo(({
  workflow,
  executionStatus,
  onNodeClick,
  onWorkflowChange,
  onOpenSubWorkflow,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const nodesRef = useRef<Node[]>([]);
  const [editingEdge, setEditingEdge] = useState<EdgeEditState | null>(null);
  const [editingDocument, setEditingDocument] = useState<{
    type: 'agent' | 'skill';
    name: string;
    content: string;
    filePath: string;
  } | null>(null);
  const [availableProviders, setAvailableProviders] = useState<LLMProviderConfig[]>([]);
  const [editingNode, setEditingNode] = useState<WorkflowNode | null>(null);

  // Load available providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI || !electronAPI.invoke) {
          return;
        }

        const providers = await electronAPI.invoke('llm-providers:get-all').catch(() => []);
        setAvailableProviders(providers || []);
      } catch (error) {
        // Silent error handling
      }
    };

    loadProviders();
  }, []);

  // Get graph data from workflow (WorkflowNode format only)
  const graphData = useMemo(() => {
    if (!workflow) return { nodes: [], edges: [] };

    // Use graph_json (WorkflowNode format)
    if (workflow.graph_json) {
      return workflow.graph_json;
    }

    // No graph data available
    return { nodes: [], edges: [] };
  }, [workflow?.id, workflow?.version, workflow?.graph_json]);

  // Build React Flow nodes from graph data
  // Nodes are already in WorkflowNode format - simple and direct!
  const baseNodes = useMemo(() => {
    return graphData.nodes.map((node, index) => {
      // Auto-layout nodes that don't have positions
      const defaultPosition = {
        x: 100,
        y: 100 + (index * 150)
      };

      const nodeAny = node as any;  // For accessing type-specific fields

      return {
        id: String(node.id),
        type: node.type,
        position: node.position || defaultPosition,
        baseData: {
          label: node.name || 'Unnamed',
          phase: {
            id: typeof node.id === 'string' ? parseInt(node.id, 10) : node.id,
            name: node.name || 'Unnamed',
            type: node.type,
            agent: nodeAny.agent || 'Unknown',
            skill: nodeAny.skill,
            subWorkflowId: nodeAny.subWorkflowId,
            description: node.description || '',
            gate: nodeAny.gate || false,
            gateCondition: nodeAny.gateCondition,
            requiresApproval: node.requiresApproval || false,
          },
        },
      };
    });
  }, [graphData.nodes]);

  // Build React Flow edges from graph data with execution status
  const baseEdges = useMemo(() => {
    return graphData.edges.map((edge) => {
      const sourceStatus = executionStatus?.get(edge.source) || 'pending';
      const isSelected = selectedEdges.includes(edge.id);

      // Extract edge properties with fallbacks for both graph_json and phases_json sources
      const edgeLabel = 'label' in edge ? edge.label : undefined;
      const edgeAnimated = 'animated' in edge ? edge.animated : undefined;
      const edgeCondition = 'condition' in edge ? edge.condition : undefined;
      const edgeType = 'type' in edge ? edge.type : 'default';

      // Determine edge color based on status and selection
      let strokeColor = '#d1d5db'; // default gray
      if (isSelected) {
        strokeColor = '#3b82f6'; // blue when selected
      } else if (sourceStatus === 'completed') {
        strokeColor = '#4ade80'; // green when completed
      }

      return {
        id: edge.id,
        source: String(edge.source),
        target: String(edge.target),
        type: 'smoothstep',
        label: edgeLabel || undefined,
        animated: edgeAnimated !== undefined ? edgeAnimated : sourceStatus === 'in_progress',
        selectable: true,
        focusable: true,
        style: {
          stroke: strokeColor,
          strokeWidth: isSelected ? 3 : 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
        data: {
          condition: edgeCondition || undefined,
          edgeType: edgeType || 'default',
        },
      };
    });
  }, [graphData.edges, executionStatus, selectedEdges]);


  // Handle edit node (new NodeConfigDialog)
  const handleEditNode = useCallback((nodeId: string) => {
    const node = graphData.nodes.find(n => String(n.id) === nodeId);
    if (node) {
      // Convert legacy node format to WorkflowNode format
      const workflowNode: WorkflowNode = {
        id: String(node.id),
        name: node.name,
        description: node.description || '',
        type: node.type as any,
        position: node.position,
        requiresApproval: node.requiresApproval,
        contextConfig: {
          mode: 'simple',
        },
        // Type-specific fields
        ...(node.type === 'planning' || node.type === 'writing' || node.type === 'gate' ? {
          agent: node.agent,
          skill: node.skill,
          gate: node.gate || false,
          gateCondition: node.gateCondition,
          provider: availableProviders[0] || {} as LLMProviderConfig,
        } : {}),
        ...(node.type === 'subworkflow' ? {
          subWorkflowId: node.subWorkflowId || '',
        } : {}),
      } as WorkflowNode;

      setEditingNode(workflowNode);
    }
  }, [graphData.nodes, availableProviders]);


  // Handle save edited node (new NodeConfigDialog)
  const handleSaveNode = useCallback(async (updatedNode: WorkflowNode) => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.invoke) {
        alert('Electron API is not available. Cannot save node.');
        return;
      }

      // Validate workflow.id exists
      if (!workflow?.id) {
        alert('Workflow ID is missing. Cannot save node.');
        return;
      }

      // Check if this is a new node (not yet in database)
      const existingNode = graphData.nodes.find(n => String(n.id) === updatedNode.id);

      if (!existingNode) {
        // NEW NODE: Add to database
        // OPTIMISTIC UPDATE: Add node to UI immediately
        if (onWorkflowChange) {
          const newGraphNode = {
            id: updatedNode.id,
            type: updatedNode.type,
            name: updatedNode.name,
            agent: (updatedNode as any).agent || '',
            skill: (updatedNode as any).skill,
            subWorkflowId: (updatedNode as any).subWorkflowId,
            description: updatedNode.description,
            gate: (updatedNode as any).gate || false,
            gateCondition: (updatedNode as any).gateCondition,
            requiresApproval: updatedNode.requiresApproval,
            position: updatedNode.position || { x: 100, y: 100 }, // Ensure position exists
            data: {
              // Add required data structure for WorkflowGraphNode
              phase: {
                id: parseInt(updatedNode.id, 10) || 0,
                name: updatedNode.name,
                fullName: updatedNode.name,
                type: updatedNode.type,
                agent: (updatedNode as any).agent || '',
                skill: (updatedNode as any).skill,
                description: updatedNode.description || '',
              },
            },
          };

          const optimisticWorkflow = {
            ...workflow,
            graph_json: {
              nodes: [...(graphData.nodes || []), newGraphNode],
              edges: graphData.edges || [],
            },
          };

          onWorkflowChange(optimisticWorkflow);
        }

        // Now save to database
        const result = await electronAPI.invoke('workflow:add-node', {
          workflowId: workflow.id,
          newNode: updatedNode,
        });

        // Update with actual server data (to get any server-generated fields)
        if (result?.workflow) {
          if (onWorkflowChange) {
            onWorkflowChange(result.workflow);
          }
        }
      } else {
        // EXISTING NODE: Update in database
        const result = await electronAPI.invoke('workflow:update-node', {
          workflowId: workflow.id,
          nodeId: updatedNode.id,
          updates: updatedNode,
        });

        // Check if update succeeded
        if (result?.success) {
          // Update local workflow state
          if (onWorkflowChange) {
            const updatedNodes = graphData.nodes.map(n => {
              if (String(n.id) === updatedNode.id) {
                // Convert WorkflowNode back to graph node format
                const updatedGraphNode = {
                  id: updatedNode.id,
                  type: updatedNode.type,
                  name: updatedNode.name,
                  description: updatedNode.description,
                  position: updatedNode.position || n.position,
                  requiresApproval: updatedNode.requiresApproval,
                  // Type-specific fields
                  agent: (updatedNode as any).agent || '',
                  skill: (updatedNode as any).skill,
                  subWorkflowId: (updatedNode as any).subWorkflowId,
                  gate: (updatedNode as any).gate || false,
                  gateCondition: (updatedNode as any).gateCondition,
                };
                return updatedGraphNode;
              }
              return n;
            });

            const updatedWorkflow = {
              ...workflow,
              graph_json: {
                nodes: updatedNodes,
                edges: graphData.edges,
              },
            };
            onWorkflowChange(updatedWorkflow);
          }
        }
      }

      setEditingNode(null);
    } catch (error: any) {
      alert(`Failed to save node: ${error?.message || error}`);
    }
  }, [workflow, graphData, onWorkflowChange]);

  // Handle open sub-workflow
  const handleOpenSubWorkflow = useCallback((subWorkflowId: string) => {
    if (onOpenSubWorkflow) {
      onOpenSubWorkflow(subWorkflowId);
    }
  }, [onOpenSubWorkflow]);

  // Handle save document (agent or skill)
  const handleSaveDocument = useCallback(async (content: string) => {
    if (!editingDocument) return;

    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.invoke) {
        return;
      }

      if (editingDocument.type === 'agent') {
        await electronAPI.invoke('document:write-agent', editingDocument.name, content);
      } else {
        await electronAPI.invoke('document:write-skill', editingDocument.name, content, editingDocument.filePath);
      }

      setEditingDocument(null);
    } catch (error) {
      alert(`Failed to save ${editingDocument.type}: ${error}`);
      throw error;
    }
  }, [editingDocument]);

  // Handle add new node
  const handleAddNode = useCallback((position: { x: number; y: number }) => {
    // Generate new node ID
    const maxId = graphData.nodes.length > 0
      ? Math.max(...graphData.nodes.map(n => typeof n.id === 'string' ? parseInt(n.id, 10) : n.id))
      : 0;
    const newNodeId = (maxId + 1).toString();

    // Create new WorkflowNode with default values
    const newNode: WorkflowNode = {
      id: newNodeId,
      name: 'New Node',
      description: '',
      type: 'user-input',  // Default to user-input since it has fewer required fields
      position,
      requiresApproval: false,
      contextConfig: {
        mode: 'simple',
      },
      // Default fields for user-input node
      prompt: 'Enter your input:',
      inputType: 'text',
      required: false,
    };

    // Open NodeConfigDialog for the new node
    setEditingNode(newNode);
  }, [graphData.nodes, availableProviders]);

  // Handle delete selected nodes/edges
  const handleDelete = useCallback(async () => {
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    const confirmMessage = selectedNodes.length > 0
      ? `Delete ${selectedNodes.length} node(s) and their connected edges?`
      : `Delete ${selectedEdges.length} edge(s)?`;

    if (!window.confirm(confirmMessage)) return;

    // Store original workflow for potential rollback
    const originalWorkflow = workflow;

    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.invoke) {
        return;
      }

      // 1. OPTIMISTIC UPDATE: Remove items from UI immediately
      if (onWorkflowChange && workflow) {
        // Filter out deleted nodes
        const remainingNodes = graphData.nodes.filter(n => !selectedNodes.includes(String(n.id)));

        // Filter out deleted edges AND edges connected to deleted nodes
        const remainingEdges = graphData.edges.filter(e => {
          const edgeDeleted = selectedEdges.includes(e.id);
          const sourceDeleted = selectedNodes.includes(e.source);
          const targetDeleted = selectedNodes.includes(e.target);
          return !edgeDeleted && !sourceDeleted && !targetDeleted;
        });

        const optimisticWorkflow = {
          ...workflow,
          graph_json: {
            nodes: remainingNodes,
            edges: remainingEdges,
          },
        };

        onWorkflowChange(optimisticWorkflow);
      }

      // Clear selection immediately
      setSelectedNodes([]);
      setSelectedEdges([]);

      // 2. Then delete from backend
      let result: any = null;

      // Delete nodes (and their connected edges)
      for (const nodeId of selectedNodes) {
        result = await electronAPI.invoke('workflow:delete-node', {
          workflowId: workflow.id,
          nodeId,
        });
      }

      // Delete edges
      for (const edgeId of selectedEdges) {
        result = await electronAPI.invoke('workflow:delete-edge', {
          workflowId: workflow.id,
          edgeId,
        });
      }

      // 3. Update with actual server data (to sync any server-side changes)
      if (onWorkflowChange && result?.workflow) {
        onWorkflowChange(result.workflow);
      }
    } catch (error) {
      alert(`Failed to delete: ${error}`);
      // Rollback on error - restore original workflow
      if (onWorkflowChange && originalWorkflow) {
        onWorkflowChange(originalWorkflow);
      }
    }
  }, [selectedNodes, selectedEdges, workflow, graphData, onWorkflowChange]);

  // Handle keyboard shortcuts (Delete key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't trigger delete if user is typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
          return;
        }
        handleDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDelete]);

  // Handle right-click on canvas pane to add new node
  const handlePaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();

    // Get the ReactFlow instance's viewport transform to convert screen coords to flow coords
    const reactFlowBounds = event.currentTarget.getBoundingClientRect();
    const position = {
      x: event.clientX - reactFlowBounds.left - 50,
      y: event.clientY - reactFlowBounds.top - 50,
    };

    handleAddNode(position);
  }, [handleAddNode]);

  // Update nodes with current execution status (this is fast - only updates data prop)
  const nodesWithStatus = useMemo(() => {
    return baseNodes.map(node => ({
      ...node,
      data: {
        ...node.baseData,
        status: executionStatus?.get(node.id) || 'pending',
        onEdit: () => handleEditNode(node.id), // Use new NodeConfigDialog
        onOpenSubWorkflow: node.baseData.phase.subWorkflowId
          ? () => handleOpenSubWorkflow(node.baseData.phase.subWorkflowId!)
          : undefined,
      },
    }));
  }, [baseNodes, executionStatus, handleEditNode, handleOpenSubWorkflow]);

  // Update React Flow state when memoized values change
  useEffect(() => {
    if (nodesWithStatus.length > 0) {
      setNodes(nodesWithStatus);
      nodesRef.current = nodesWithStatus;
    }
  }, [nodesWithStatus, setNodes]);

  useEffect(() => {
    if (baseEdges.length >= 0) {
      setEdges(baseEdges);
    }
  }, [baseEdges, setEdges]);

  // Debounced save function for node positions
  const savePositions = useMemo(
    () => debounce(async (workflowId: string, positions: Record<string, { x: number; y: number }>) => {
      try {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI || !electronAPI.invoke) {
          return;
        }

        setIsSaving(true);
        await electronAPI.invoke('workflow:update-positions', {
          workflowId,
          positions
        });
      } catch (error) {
        alert(`Failed to save node positions: ${error}`);
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    []
  );

  // Handle node drag stop - save new positions
  const onNodeDragStop: NodeDragHandler = useCallback(
    (_event, _node, currentNodes) => {
      if (!workflow) return;

      // Collect all current node positions from React Flow's current state
      const positions: Record<string, { x: number; y: number }> = {};
      currentNodes.forEach(node => {
        positions[node.id] = { x: node.position.x, y: node.position.y };
      });

      setIsSaving(true);
      savePositions(workflow.id, positions);
    },
    [workflow, savePositions]
  );

  // Handle new connections (user drags from output to input handle)
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      try {
        const electronAPI = (window as any).electronAPI;
        if (!electronAPI || !electronAPI.invoke) {
          return;
        }

        // 1. Create edge ID
        const newEdgeId = `edge-${connection.source}-${connection.target}-${Date.now()}`;

        // 2. OPTIMISTIC UPDATE: Add edge to UI immediately
        const newEdge = {
          id: newEdgeId,
          source: connection.source,
          target: connection.target,
          type: 'default' as const,
        };

        if (onWorkflowChange && workflow) {
          const optimisticWorkflow = {
            ...workflow,
            graph_json: {
              nodes: graphData.nodes,
              edges: [...(graphData.edges || []), newEdge],
            },
          };

          onWorkflowChange(optimisticWorkflow);
        }

        // 3. Then save to backend (don't wait for full response before updating UI)
        const result = await electronAPI.invoke('workflow:add-edge', {
          workflowId: workflow.id,
          source: connection.source,
          target: connection.target,
          type: 'default',
        });

        // 4. Update with actual server data (to sync any server-generated fields)
        if (onWorkflowChange && result?.workflow) {
          onWorkflowChange(result.workflow);
        }
      } catch (error) {
        alert(`Failed to create connection: ${error}`);
        // Rollback on error - restore original workflow
        if (onWorkflowChange && workflow) {
          onWorkflowChange(workflow);
        }
      }
    },
    [workflow, graphData, onWorkflowChange]
  );

  // Handle edge click for editing
  const onEdgeClick: EdgeMouseHandler = useCallback((event, edge) => {
    event.stopPropagation();
    setEditingEdge({
      edgeId: edge.id,
      label: edge.label as string || '',
      condition: (edge.data as any)?.condition || '',
      type: (edge.data as any)?.edgeType || 'default',
    });
  }, []);

  // Handle save edge
  const handleSaveEdge = useCallback(async () => {
    if (!editingEdge) return;

    // Store original workflow for potential rollback
    const originalWorkflow = workflow;

    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.invoke) {
        return;
      }

      // 1. OPTIMISTIC UPDATE: Update edge in UI immediately
      if (onWorkflowChange && workflow) {
        const updatedEdges = graphData.edges.map(edge => {
          if (edge.id === editingEdge.edgeId) {
            return {
              ...edge,
              label: editingEdge.label,
              condition: editingEdge.condition,
              type: editingEdge.type,
            };
          }
          return edge;
        });

        const optimisticWorkflow = {
          ...workflow,
          graph_json: {
            nodes: graphData.nodes,
            edges: updatedEdges,
          },
        };

        onWorkflowChange(optimisticWorkflow);
      }

      // Close dialog immediately
      setEditingEdge(null);

      // 2. Then save to backend
      const result = await electronAPI.invoke('workflow:update-edge', {
        workflowId: workflow.id,
        edgeId: editingEdge.edgeId,
        updates: {
          label: editingEdge.label,
          condition: editingEdge.condition,
          type: editingEdge.type,
        },
      });

      // 3. Update with actual server data (to sync any server-side changes)
      if (onWorkflowChange && result?.workflow) {
        onWorkflowChange(result.workflow);
      }
    } catch (error) {
      alert(`Failed to save edge: ${error}`);
      // Rollback on error - restore original workflow
      if (onWorkflowChange && originalWorkflow) {
        onWorkflowChange(originalWorkflow);
      }
    }
  }, [editingEdge, workflow, graphData, onWorkflowChange]);

  // Handle selection change
  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes.map(n => n.id));
    setSelectedEdges(params.edges.map(e => e.id));
  }, []);

  // Handle node clicks
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
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
    <>
      <div style={{ width: '100%', height: '600px', background: '#f9fafb', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
        {/* Add Node Button - Accessible alternative to right-click */}
        <button
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            padding: '10px 16px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
          onClick={() => {
            // Calculate position for new node to avoid overlapping
            // Find a clear spot by checking for occupied positions
            const VERTICAL_SPACING = 180;
            const HORIZONTAL_SPACING = 300;
            const BASE_X = 100;
            const BASE_Y = 100;

            let newPosition = { x: BASE_X, y: BASE_Y };

            if (graphData.nodes.length > 0) {
              // Try stacking vertically first
              const maxY = Math.max(...graphData.nodes.map(n => n.position?.y || 0));
              newPosition = { x: BASE_X, y: maxY + VERTICAL_SPACING };

              // Check if this position is occupied (within 50px)
              const isOccupied = graphData.nodes.some(n => {
                const pos = n.position || { x: 0, y: 0 };
                const distance = Math.sqrt(
                  Math.pow(pos.x - newPosition.x, 2) +
                  Math.pow(pos.y - newPosition.y, 2)
                );
                return distance < 50;
              });

              // If occupied, shift horizontally
              if (isOccupied) {
                newPosition.x += HORIZONTAL_SPACING;
              }
            }

            handleAddNode(newPosition);
          }}
          title="Add new node to workflow"
        >
          + Add Node
        </button>

        {/* Delete Button - Shows when selection exists */}
        {(selectedNodes.length > 0 || selectedEdges.length > 0) && (
          <button
            style={{
              position: 'absolute',
              top: '10px',
              left: '120px',
              padding: '10px 16px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
            onClick={handleDelete}
            title="Delete selected nodes/edges (Delete key)"
          >
            Delete ({selectedNodes.length + selectedEdges.length})
          </button>
        )}

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
            Saving...
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
          onPaneContextMenu={handlePaneContextMenu}
          onEdgeClick={onEdgeClick}
          onSelectionChange={onSelectionChange}
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

      {/* Node Config Dialog */}
      {editingNode && (
        <NodeConfigDialog
          node={editingNode}
          availableProviders={availableProviders}
          onSave={handleSaveNode}
          onCancel={() => setEditingNode(null)}
        />
      )}

      {/* Document Edit Dialog (Agent/Skill) */}
      {editingDocument && (
        <DocumentEditDialog
          type={editingDocument.type}
          name={editingDocument.name}
          content={editingDocument.content}
          filePath={editingDocument.filePath}
          onSave={handleSaveDocument}
          onCancel={() => setEditingDocument(null)}
        />
      )}

      {/* Edge Edit Dialog */}
      {editingEdge && (
        <div style={styles.overlay} onClick={() => setEditingEdge(null)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <h2 style={styles.title}>Edit Edge</h2>
              <button style={styles.closeButton} onClick={() => setEditingEdge(null)}>✕</button>
            </div>

            <div style={styles.content}>
              <div style={styles.field}>
                <label style={styles.label}>Edge Type</label>
                <select
                  style={styles.select}
                  value={editingEdge.type}
                  onChange={(e) => setEditingEdge({ ...editingEdge, type: e.target.value as any })}
                >
                  <option value="default">Default (Sequential)</option>
                  <option value="conditional">Conditional (Branch)</option>
                  <option value="loop-back">Loop Back</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Label (Optional)</label>
                <input
                  type="text"
                  style={styles.input}
                  value={editingEdge.label}
                  onChange={(e) => setEditingEdge({ ...editingEdge, label: e.target.value })}
                  placeholder="e.g., Pass, Fail, Retry"
                />
              </div>

              {editingEdge.type === 'conditional' && (
                <div style={styles.field}>
                  <label style={styles.label}>Condition (JSONPath)</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={editingEdge.condition}
                    onChange={(e) => setEditingEdge({ ...editingEdge, condition: e.target.value })}
                    placeholder="e.g., $.score >= 70"
                  />
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Use JSONPath expressions like: $.score &gt;= 70, $.status == 'approved'
                  </div>
                </div>
              )}
            </div>

            <div style={styles.footer}>
              <button style={styles.cancelButton} onClick={() => setEditingEdge(null)}>
                Cancel
              </button>
              <button style={styles.saveButton} onClick={handleSaveEdge}>
                Save Edge
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '20px',
  },
  dialog: {
    background: 'white',
    borderRadius: '12px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#1f2937',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'color 0.2s',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  field: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    background: 'white',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #e5e7eb',
  },
  cancelButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  saveButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
