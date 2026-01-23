/**
 * LoopBackEdge Component - Custom edge for loop-back connections
 *
 * Routes loop-back edges (right-to-left in horizontal layouts) below the workflow
 * to prevent visual overlap with forward-flowing edges.
 *
 * Features:
 * - Detects backward-flowing edges and routes them below the graph
 * - Dashed line styling with distinct colors
 * - Supports multiple loop edges with automatic offset calculation
 * - Labels displayed on the edge path
 */

import React, { useMemo } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  BaseEdge,
  EdgeLabelRenderer,
} from 'reactflow';

// Color palette for multiple loop edges
const LOOP_COLORS = [
  '#f97316', // Orange - first loop
  '#8b5cf6', // Purple - second loop
  '#06b6d4', // Cyan - third loop
  '#ec4899', // Pink - fourth loop
];

export interface LoopBackEdgeData {
  loopIndex?: number; // Index among loop-back edges (for offset calculation)
  condition?: string;
  edgeType?: string;
}

export const LoopBackEdge: React.FC<EdgeProps<LoopBackEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  data,
  selected,
}) => {
  // Determine if this edge flows backward (right-to-left in horizontal layout)
  // or downward-to-upward in vertical sections
  const isBackward = sourceX > targetX || (sourceX === targetX && sourceY > targetY);

  // Calculate the path and label position
  const { path, labelX, labelY } = useMemo(() => {
    if (!isBackward) {
      // Forward flow - use standard smoothstep
      const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 10,
      });
      return { path: edgePath, labelX, labelY };
    }

    // Backward flow - custom path that routes BELOW the workflow
    const loopIndex = data?.loopIndex ?? 0;
    const baseOffset = 60; // Base vertical offset below lowest node
    const offsetIncrement = 50; // Additional offset for each loop
    const verticalOffset = baseOffset + (loopIndex * offsetIncrement);
    const curveRadius = 15;

    // Find the lowest Y position between source and target
    const maxY = Math.max(sourceY, targetY);
    const loopY = maxY + verticalOffset;

    // Build the path:
    // 1. Go down from source
    // 2. Curve right
    // 3. Go horizontal to above target
    // 4. Curve up
    // 5. Go up to target

    // For horizontal layouts: source is on the right, target is on the left
    // We route: source → down → left → up → target

    const path = `
      M ${sourceX} ${sourceY}
      L ${sourceX} ${loopY - curveRadius}
      Q ${sourceX} ${loopY} ${sourceX - curveRadius} ${loopY}
      L ${targetX + curveRadius} ${loopY}
      Q ${targetX} ${loopY} ${targetX} ${loopY - curveRadius}
      L ${targetX} ${targetY}
    `;

    // Label position at the bottom of the loop
    const labelX = (sourceX + targetX) / 2;
    const labelY = loopY + 12;

    return { path, labelX, labelY };
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, isBackward, data?.loopIndex]);

  // Get color based on loop index
  const loopIndex = data?.loopIndex ?? 0;
  const strokeColor = LOOP_COLORS[loopIndex % LOOP_COLORS.length];

  // Style for loop-back edges: dashed with distinct color
  const edgeStyle = {
    ...style,
    stroke: selected ? '#3b82f6' : strokeColor,
    strokeWidth: selected ? 3 : 2.5,
    strokeDasharray: isBackward ? '6 4' : undefined, // Dashed only for backward edges
  };

  // Just pass the original markerEnd - color is handled by style
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={edgeStyle}
        markerEnd={markerEnd}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              fontSize: 10,
              fontWeight: 500,
              color: selected ? '#3b82f6' : strokeColor,
              background: 'white',
              padding: '2px 6px',
              borderRadius: 8,
              border: `1px solid ${selected ? '#3b82f6' : strokeColor}`,
              whiteSpace: 'nowrap',
            }}
          >
            ↺ {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default LoopBackEdge;
