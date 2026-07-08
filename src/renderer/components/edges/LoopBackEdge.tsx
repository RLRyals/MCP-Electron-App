/**
 * LoopBackEdge Component - Custom edge for loop-back connections
 *
 * Routes loop-back edges around the workflow based on layout orientation:
 * - Horizontal layout (target left of source): Routes ABOVE the nodes
 * - Vertical layout (target above source): Routes to the LEFT of the nodes
 *
 * Features:
 * - Auto-detects layout orientation based on node positions
 * - Adapts routing as nodes are rearranged
 * - Dashed line styling with distinct colors per loop
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
  // Determine if this edge flows backward
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

    // Backward flow - determine layout orientation
    const edgeData = data as LoopBackEdgeData | undefined;
    const loopIndex = edgeData?.loopIndex ?? 0;

    // Calculate based on the connected nodes only (not global)
    const localMinY = Math.min(sourceY, targetY);
    const localMinX = Math.min(sourceX, targetX);

    // Calculate the horizontal and vertical distances
    const horizontalDist = Math.abs(sourceX - targetX);
    const verticalDist = Math.abs(sourceY - targetY);

    // Determine if this is more horizontal or vertical layout
    const isHorizontalLayout = horizontalDist > verticalDist * 0.5;

    // Fixed offset from the connected nodes - same for all loopback edges
    // This ensures consistent spacing regardless of which nodes are connected
    const fixedOffset = 80;
    const curveRadius = 12;

    let pathString: string;
    let labelPosX: number;
    let labelPosY: number;

    if (isHorizontalLayout) {
      // HORIZONTAL LAYOUT: Route ABOVE the connected nodes
      const loopY = localMinY - fixedOffset;
      const exitExtension = 20;

      const sourceExitX = sourceX + exitExtension;
      const targetEntryX = targetX - exitExtension;

      pathString = [
        `M ${sourceX} ${sourceY}`,
        `L ${sourceExitX - curveRadius} ${sourceY}`,
        `Q ${sourceExitX} ${sourceY} ${sourceExitX} ${sourceY - curveRadius}`,
        `L ${sourceExitX} ${loopY + curveRadius}`,
        `Q ${sourceExitX} ${loopY} ${sourceExitX - curveRadius} ${loopY}`,
        `L ${targetEntryX + curveRadius} ${loopY}`,
        `Q ${targetEntryX} ${loopY} ${targetEntryX} ${loopY + curveRadius}`,
        `L ${targetEntryX} ${targetY - curveRadius}`,
        `Q ${targetEntryX} ${targetY} ${targetEntryX + curveRadius} ${targetY}`,
        `L ${targetX} ${targetY}`,
      ].join(' ');

      labelPosX = (sourceExitX + targetEntryX) / 2;
      labelPosY = loopY - 10;
    } else {
      // VERTICAL LAYOUT: Route to the LEFT of the connected nodes
      const loopX = localMinX - fixedOffset;
      const exitExtension = 20;

      const sourceExitY = sourceY - exitExtension;
      const targetEntryY = targetY + exitExtension;

      pathString = [
        `M ${sourceX} ${sourceY}`,
        `L ${sourceX} ${sourceExitY + curveRadius}`,
        `Q ${sourceX} ${sourceExitY} ${sourceX - curveRadius} ${sourceExitY}`,
        `L ${loopX + curveRadius} ${sourceExitY}`,
        `Q ${loopX} ${sourceExitY} ${loopX} ${sourceExitY - curveRadius}`,
        `L ${loopX} ${targetEntryY + curveRadius}`,
        `Q ${loopX} ${targetEntryY} ${loopX + curveRadius} ${targetEntryY}`,
        `L ${targetX - curveRadius} ${targetEntryY}`,
        `Q ${targetX} ${targetEntryY} ${targetX} ${targetEntryY - curveRadius}`,
        `L ${targetX} ${targetY}`,
      ].join(' ');

      labelPosX = loopX - 10;
      labelPosY = (sourceExitY + targetEntryY) / 2;
    }

    return { path: pathString, labelX: labelPosX, labelY: labelPosY };
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
