/**
 * Render tests for PhaseNode's sub-workflow link affordance (mea-0uq):
 * clicking a subworkflow-type node's link should invoke
 * `data.onOpenSubWorkflow`, and a reference that doesn't resolve to a known
 * workflow (`data.subWorkflowMissing`) should render as a disabled,
 * non-clickable indicator with an explanatory tooltip instead of crashing.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { PhaseNode, PhaseNodeData } from '../PhaseNode';

function makeData(overrides: Partial<PhaseNodeData> = {}): PhaseNodeData {
  return {
    label: 'Dramatica Pipeline',
    phase: {
      id: 1,
      name: 'Dramatica Pipeline',
      type: 'subworkflow',
      agent: 'unused',
      description: '',
      gate: false,
      requiresApproval: false,
      subWorkflowId: 'dramatica-pipeline',
    },
    status: 'pending',
    ...overrides,
  };
}

function renderNode(data: PhaseNodeData) {
  return render(
    <ReactFlowProvider>
      <PhaseNode
        id="node-1"
        data={data}
        type="subworkflow"
        selected={false}
        isConnectable
        zIndex={0}
        dragging={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </ReactFlowProvider>
  );
}

describe('PhaseNode sub-workflow link', () => {
  it('renders a clickable link that calls onOpenSubWorkflow when the reference resolves', async () => {
    const user = userEvent.setup();
    const onOpenSubWorkflow = jest.fn();
    renderNode(makeData({ onOpenSubWorkflow }));

    const link = screen.getByTitle('Click to open sub-workflow');
    expect(link).toHaveTextContent('dramatica-pipeline');

    await user.click(link);
    expect(onOpenSubWorkflow).toHaveBeenCalledTimes(1);
  });

  it('renders a disabled indicator with a not-found tooltip when the reference is missing, and does not crash on click', async () => {
    const user = userEvent.setup();
    const onOpenSubWorkflow = jest.fn();
    // Missing reference: WorkflowCanvas never wires onOpenSubWorkflow for this case.
    renderNode(makeData({ subWorkflowMissing: true, onOpenSubWorkflow: undefined }));

    const link = screen.getByTitle('Referenced workflow "dramatica-pipeline" not found');
    expect(link).toHaveTextContent('dramatica-pipeline (not found)');

    await user.click(link);
    expect(onOpenSubWorkflow).not.toHaveBeenCalled();
  });

  it('renders no sub-workflow link for non-subworkflow node types', () => {
    renderNode({
      ...makeData(),
      phase: { ...makeData().phase, type: 'planning', subWorkflowId: undefined },
    });

    expect(screen.queryByText(/dramatica-pipeline/)).not.toBeInTheDocument();
  });
});
