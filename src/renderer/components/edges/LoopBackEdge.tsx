/**
 * LoopBackEdge Component - Custom edge for loop-back connections
 *
 * Routes loop-back edges (right-to-left in horizontal layouts) ABOVE the workflow
 * to prevent visual overlap with forward-flowing edges.
 *
 * Features:
 * - Detects backward-flowing edges and routes them above the graph
 * - Dashed line styling with distinct colors
 * - Supports multiple loop edges with automatic offset calculation
 * - Labels displayed on the edge path
 */

import React, { useMemo } from 'react';
import {
  type EdgeProps,
  getSmoothStepPath,
  BaseEdge,
  EdgeLabelRenderer,
} from '@xyflow/react';

// Color palette for multiple loop edges
const LOOP_COLORS = [
  '#f97316', // Orange - first loop
  '#8b5cf6', // Purple - second loop
  '#06b6d4', // Cyan - third loop
  '#ec4899', // Pink - fourth loop
];

export interface LoopBackEdgeData extends Record<string, unknown> {
  loopIndex?: number; // Index among loop-back edges (for offset calculation)
  condition?: string;
  edgeType?: string;
  globalMinY?: number; // Global minimum Y of all nodes (for consistent offset baseline)
}

export const LoopBackEdge = ({
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
}: EdgeProps) => {
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

    // Backward flow - custom path that routes ABOVE the workflow
    const edgeData = data as LoopBackEdgeData | undefined;
    const loopIndex = edgeData?.loopIndex ?? 0;

    // Each loop edge gets a consistent offset from its own highest point
    // baseOffset should be enough to clear a typical node (~80px tall) plus padding
    const baseOffset = 80;
    const offsetIncrement = 35;
    const verticalOffset = baseOffset + (loopIndex * offsetIncrement);
    const curveRadius = 16;

    // Use the higher of source/target Y positions as the baseline
    const minY = Math.min(sourceY, targetY);
    const loopY = minY - verticalOffset;

    // Horizontal extension beyond source/target for cleaner curves
    const horizontalExtension = 25;

    // Build the path with proper curved corners:
    // 1. Exit source horizontally to the right
    // 2. Curve up
    // 3. Go horizontally to above target
    // 4. Curve down
    // 5. Enter target horizontally from the left

    // Calculate control points for smooth bezier curves
    const sourceExitX = sourceX + horizontalExtension;
    const targetEntryX = targetX - horizontalExtension;

    const path = [
      // Start at source handle
      `M ${sourceX} ${sourceY}`,
      // Go right horizontally
      `L ${sourceExitX - curveRadius} ${sourceY}`,
      // Curve up (90 degree turn)
      `Q ${sourceExitX} ${sourceY} ${sourceExitX} ${sourceY - curveRadius}`,
      // Go up to loop height
      `L ${sourceExitX} ${loopY + curveRadius}`,
      // Curve left at top
      `Q ${sourceExitX} ${loopY} ${sourceExitX - curveRadius} ${loopY}`,
      // Go horizontally across the top
      `L ${targetEntryX + curveRadius} ${loopY}`,
      // Curve down at target side
      `Q ${targetEntryX} ${loopY} ${targetEntryX} ${loopY + curveRadius}`,
      // Go down to target height
      `L ${targetEntryX} ${targetY - curveRadius}`,
      // Curve right to enter target
      `Q ${targetEntryX} ${targetY} ${targetEntryX + curveRadius} ${targetY}`,
      // Enter target horizontally
      `L ${targetX} ${targetY}`,
    ].join(' ');

    // Label position above the loop, centered
    const labelX = (sourceExitX + targetEntryX) / 2;
    const labelY = loopY - 12;

    return { path, labelX, labelY };
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, isBackward, data]);

  // Get color based on loop index
  const edgeData = data as LoopBackEdgeData | undefined;
  const loopIndex = edgeData?.loopIndex ?? 0;
  const strokeColor = LOOP_COLORS[loopIndex % LOOP_COLORS.length];

  // Style for loop-back edges: dashed with distinct color
  const edgeStyle = {
    ...style,
    stroke: selected ? '#3b82f6' : strokeColor,
    strokeWidth: selected ? 3 : 2.5,
    strokeDasharray: isBackward ? '6 4' : undefined, // Dashed only for backward edges
  };

  // Generate unique marker ID for this edge's color
  const markerId = `loop-arrow-${id}`;
  const currentColor = selected ? '#3b82f6' : strokeColor;

  return (
    <>
      {/* Custom SVG marker definition for colored arrow */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker
            id={markerId}
            markerWidth="12"
            markerHeight="12"
            viewBox="-10 -10 20 20"
            orient="auto"
            refX="0"
            refY="0"
          >
            <polyline
              stroke={currentColor}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              fill="none"
              points="-8,-6 0,0 -8,6"
            />
          </marker>
        </defs>
      </svg>
      <BaseEdge
        id={id}
        path={path}
        style={edgeStyle}
        markerEnd={`url(#${markerId})`}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              fontSize: 11,
              fontWeight: 600,
              color: selected ? '#3b82f6' : strokeColor,
              background: 'white',
              padding: '3px 8px',
              borderRadius: 10,
              border: `1.5px solid ${selected ? '#3b82f6' : strokeColor}`,
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
