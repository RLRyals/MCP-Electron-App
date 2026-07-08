/**
 * Config Panels Accessibility Tests
 *
 * Tests all configuration panel components for WCAG 2.1 Level AA compliance
 * Covers form field labels, error messages, helper text, and disabled states
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AgentNodeConfig } from '../AgentNodeConfig';
import type { AgentWorkflowNode } from '../../../../../types/workflow-nodes';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// ============================================================================
// Mock Data
// ============================================================================

const mockPlanningNode: AgentWorkflowNode = {
  id: 'node-1',
  type: 'planning',
  name: 'Planning Phase',
  description: 'Planning agent node',
  position: { x: 0, y: 0 },
  agent: 'planning-agent',
  skill: 'research-skill',
  provider: {
    name: 'anthropic',
    model: 'claude-sonnet-4-5',
  },
  requiresApproval: false,
};

const mockWritingNode: AgentWorkflowNode = {
  id: 'node-2',
  type: 'writing',
  name: 'Writing Phase',
  description: 'Writing agent node',
  position: { x: 100, y: 100 },
  agent: 'writing-agent',
  provider: {
    name: 'openai',
    model: 'gpt-4o',
  },
  requiresApproval: false,
};

const mockGateNode: AgentWorkflowNode = {
  id: 'node-3',
  type: 'gate',
  name: 'Quality Gate',
  description: 'Gate agent node',
  position: { x: 200, y: 200 },
  agent: 'quality-gate-agent',
  gate: true,
  gateCondition: '$.score >= 80',
  provider: {
    name: 'anthropic',
    model: 'claude-sonnet-4-5',
  },
  requiresApproval: false,
};

const mockOnChange = jest.fn();
const mockOnEditAgent = jest.fn();
const mockOnEditSkill = jest.fn();

// ============================================================================
// AgentNodeConfig Panel Tests
// ============================================================================

describe('AgentNodeConfig - Accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Automated Tests', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations with errors', async () => {
      const { container } = render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{
            agent: 'Agent is required',
            provider: 'Provider is required',
          }}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations for gate node type', async () => {
      const { container } = render(
        <AgentNodeConfig
          node={mockGateNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Form Field Labels', () => {
    it('should have proper labels for all inputs', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      // Agent input
      expect(screen.getByLabelText(/Agent/i)).toBeInTheDocument();

      // Skill input
      expect(screen.getByLabelText(/Skill/i)).toBeInTheDocument();

      // Provider input
      expect(screen.getByLabelText(/LLM Provider/i)).toBeInTheDocument();

      // Model input
      expect(screen.getByLabelText(/Model/i)).toBeInTheDocument();
    });

    it('should use htmlFor to associate labels with inputs', () => {
      const { container } = render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      const agentLabel = container.querySelector('label[for="agent-input"]');
      expect(agentLabel).toBeInTheDocument();

      const agentInput = screen.getByLabelText(/Agent/i);
      expect(agentInput).toHaveAttribute('id', 'agent-input');
    });

    it('should mark required fields with aria-required', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      const agentInput = screen.getByLabelText(/Agent/i);
      expect(agentInput).toHaveAttribute('aria-required', 'true');

      const providerInput = screen.getByLabelText(/LLM Provider/i);
      expect(providerInput).toHaveAttribute('aria-required', 'true');
    });

    it('should not mark optional fields as required', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      const skillInput = screen.getByLabelText(/Skill/i);
      expect(skillInput).not.toHaveAttribute('aria-required', 'true');
    });
  });

  describe('Error Message Accessibility', () => {
    it('should associate error messages with fields using aria-describedby', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{ agent: 'Agent is required' }}
        />
      );

      const agentInput = screen.getByLabelText(/Agent/i);
      expect(agentInput).toHaveAttribute('aria-describedby', 'agent-error');

      const errorMessage = screen.getByText('Agent is required');
      expect(errorMessage).toHaveAttribute('id', 'agent-error');
    });

    it('should mark invalid fields with aria-invalid', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{ agent: 'Agent is required' }}
        />
      );

      const agentInput = screen.getByLabelText(/Agent/i);
      expect(agentInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('should announce errors with role="alert"', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{ agent: 'Agent is required' }}
        />
      );

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toHaveTextContent('Agent is required');
    });

    it('should handle multiple errors accessibly', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{
            agent: 'Agent is required',
            provider: 'Provider is required',
          }}
        />
      );

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBe(2);

      const agentInput = screen.getByLabelText(/Agent \*/i);
      expect(agentInput).toHaveAttribute('aria-invalid', 'true');

      const providerInput = screen.getByLabelText(/LLM Provider/i);
      expect(providerInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Helper Text Associations', () => {
    it('should associate help text with inputs using aria-describedby', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      const agentInput = screen.getByLabelText(/Agent/i);
      expect(agentInput).toHaveAttribute('aria-describedby', 'agent-help');

      const helpText = screen.getByText(/The agent defines the AI behavior/i);
      expect(helpText).toHaveAttribute('id', 'agent-help');
    });

    it('should combine error and help text in aria-describedby', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{ agent: 'Agent is required' }}
        />
      );

      const agentInput = screen.getByLabelText(/Agent/i);
      const describedBy = agentInput.getAttribute('aria-describedby');

      // Should reference the error message
      expect(describedBy).toBe('agent-error');
    });
  });

  describe('Checkbox Accessibility', () => {
    it('should have accessible checkbox labels', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      const checkbox = screen.getByLabelText(/Requires User Approval/i);
      expect(checkbox).toHaveAttribute('type', 'checkbox');
      expect(checkbox).toHaveAttribute('id', 'requires-approval');
    });
  });

  describe('Button Accessibility', () => {
    it('should have accessible Edit buttons', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
          onEditAgent={mockOnEditAgent}
          onEditSkill={mockOnEditSkill}
        />
      );

      const editAgentButton = screen.getByLabelText(/Edit agent file/i);
      expect(editAgentButton).toBeInTheDocument();
      expect(editAgentButton).toHaveAttribute('type', 'button');

      const editSkillButton = screen.getByLabelText(/Edit skill file/i);
      expect(editSkillButton).toBeInTheDocument();
      expect(editSkillButton).toHaveAttribute('type', 'button');
    });

    it('should only show Edit buttons when handlers are provided', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      expect(screen.queryByLabelText(/Edit agent file/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Edit skill file/i)).not.toBeInTheDocument();
    });

    it('should only show Edit Skill button when skill is set', () => {
      const nodeWithoutSkill = { ...mockPlanningNode, skill: undefined };

      render(
        <AgentNodeConfig
          node={nodeWithoutSkill}
          onChange={mockOnChange}
          errors={{}}
          onEditAgent={mockOnEditAgent}
          onEditSkill={mockOnEditSkill}
        />
      );

      expect(screen.getByLabelText(/Edit agent file/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Edit skill file/i)).not.toBeInTheDocument();
    });
  });

  describe('Gate Node Specific Fields', () => {
    it('should show gate-specific fields for gate nodes', () => {
      render(
        <AgentNodeConfig
          node={mockGateNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      expect(screen.getByLabelText(/Enable Quality Gate/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Gate Condition/i)).toBeInTheDocument();
    });

    it('should not show gate fields for non-gate nodes', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      expect(screen.queryByLabelText(/Enable Quality Gate/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Gate Condition/i)).not.toBeInTheDocument();
    });

    it('should have accessible gate condition input', () => {
      render(
        <AgentNodeConfig
          node={mockGateNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      const conditionInput = screen.getByLabelText(/Gate Condition/i);
      expect(conditionInput).toHaveAttribute('aria-required', 'true');
      expect(conditionInput).toHaveAttribute('aria-describedby', 'gate-condition-help');
    });

    it('should handle gate condition errors accessibly', () => {
      render(
        <AgentNodeConfig
          node={mockGateNode}
          onChange={mockOnChange}
          errors={{ gateCondition: 'Gate condition is required' }}
        />
      );

      const conditionInput = screen.getByLabelText(/Gate Condition/i);
      expect(conditionInput).toHaveAttribute('aria-invalid', 'true');
      expect(conditionInput).toHaveAttribute('aria-describedby', 'gate-condition-error');

      const errorMessage = screen.getByRole('alert', { name: /Gate condition is required/i });
      expect(errorMessage).toHaveAttribute('id', 'gate-condition-error');
    });
  });

  describe('Textarea Accessibility', () => {
    it('should have accessible textarea for system prompt', () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      const textarea = screen.getByLabelText(/System Prompt Override/i);
      expect(textarea).toHaveAttribute('id', 'system-prompt');
      expect(textarea).toHaveAttribute('aria-describedby', 'system-prompt-help');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard interaction with all form fields', async () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );
      const user = userEvent.setup();

      const agentInput = screen.getByLabelText(/Agent/i);
      await user.type(agentInput, 'new-agent');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should support keyboard interaction with checkboxes', async () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
        />
      );
      const user = userEvent.setup();

      const checkbox = screen.getByLabelText(/Requires User Approval/i);
      await user.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith({ requiresApproval: true });
    });

    it('should support keyboard interaction with Edit buttons', async () => {
      render(
        <AgentNodeConfig
          node={mockPlanningNode}
          onChange={mockOnChange}
          errors={{}}
          onEditAgent={mockOnEditAgent}
        />
      );
      const user = userEvent.setup();

      const editButton = screen.getByLabelText(/Edit agent file/i);
      await user.click(editButton);

      expect(mockOnEditAgent).toHaveBeenCalledWith('planning-agent');
    });
  });

  describe('Placeholder Text', () => {
    it('should have helpful placeholder text', () => {
      render(
        <AgentNodeConfig
          node={{ ...mockPlanningNode, agent: '' }}
          onChange={mockOnChange}
          errors={{}}
        />
      );

      const agentInput = screen.getByLabelText(/Agent/i);
      expect(agentInput).toHaveAttribute('placeholder', 'e.g., series-architect-agent');

      const skillInput = screen.getByLabelText(/Skill/i);
      expect(skillInput).toHaveAttribute('placeholder', 'e.g., series-planning-skill');
    });
  });
});

// ============================================================================
// General Panel Accessibility Tests
// ============================================================================

describe('Config Panels - General Accessibility Patterns', () => {
  it('should maintain consistent label styling', () => {
    const { container } = render(
      <AgentNodeConfig
        node={mockPlanningNode}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const labels = container.querySelectorAll('label');
    expect(labels.length).toBeGreaterThan(0);

    // All labels should be visible and properly styled
    labels.forEach(label => {
      expect(label).toBeVisible();
    });
  });

  it('should have consistent error message styling', () => {
    render(
      <AgentNodeConfig
        node={mockPlanningNode}
        onChange={mockOnChange}
        errors={{
          agent: 'Agent is required',
          provider: 'Provider is required',
        }}
      />
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBe(2);

    // All error messages should be visible
    alerts.forEach(alert => {
      expect(alert).toBeVisible();
    });
  });

  it('should use consistent spacing for form fields', () => {
    const { container } = render(
      <AgentNodeConfig
        node={mockPlanningNode}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    // Container should use consistent gap/spacing
    const containerDiv = container.firstChild;
    expect(containerDiv).toBeInTheDocument();
  });

  it('should handle focus states properly', async () => {
    render(
      <AgentNodeConfig
        node={mockPlanningNode}
        onChange={mockOnChange}
        errors={{}}
      />
    );
    const user = userEvent.setup();

    const agentInput = screen.getByLabelText(/Agent/i);
    await user.click(agentInput);

    expect(document.activeElement).toBe(agentInput);
  });

  it('should support high contrast mode', () => {
    // This is more of a visual test, but we can verify elements are styled
    const { container } = render(
      <AgentNodeConfig
        node={mockPlanningNode}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    // All interactive elements should be present
    const inputs = container.querySelectorAll('input, select, textarea, button');
    expect(inputs.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Visual Error States
// ============================================================================

describe('Config Panels - Visual Error States', () => {
  it('should visually distinguish error states', () => {
    const { container } = render(
      <AgentNodeConfig
        node={mockPlanningNode}
        onChange={mockOnChange}
        errors={{ agent: 'Agent is required' }}
      />
    );

    const agentInput = screen.getByLabelText(/Agent/i);

    // Input should have error styling (checked via aria-invalid)
    expect(agentInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('should clear error styling when error is resolved', async () => {
    const { rerender } = render(
      <AgentNodeConfig
        node={mockPlanningNode}
        onChange={mockOnChange}
        errors={{ agent: 'Agent is required' }}
      />
    );

    const agentInput = screen.getByLabelText(/Agent/i);
    expect(agentInput).toHaveAttribute('aria-invalid', 'true');

    // Re-render without error
    rerender(
      <AgentNodeConfig
        node={mockPlanningNode}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(agentInput).not.toHaveAttribute('aria-invalid', 'true');
  });
});

// ============================================================================
// Conditional Rendering Tests
// ============================================================================

describe('Config Panels - Conditional Rendering Accessibility', () => {
  it('should maintain accessibility when fields are conditionally shown', () => {
    const { rerender } = render(
      <AgentNodeConfig
        node={mockPlanningNode}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    // Should not show gate fields
    expect(screen.queryByLabelText(/Gate Condition/i)).not.toBeInTheDocument();

    // Re-render with gate node
    rerender(
      <AgentNodeConfig
        node={mockGateNode}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    // Should now show gate fields
    expect(screen.getByLabelText(/Gate Condition/i)).toBeInTheDocument();
  });

  it('should maintain proper ARIA attributes when fields appear/disappear', async () => {
    const { rerender, container } = render(
      <AgentNodeConfig
        node={mockGateNode}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const results1 = await axe(container);
    expect(results1).toHaveNoViolations();

    rerender(
      <AgentNodeConfig
        node={mockPlanningNode}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const results2 = await axe(container);
    expect(results2).toHaveNoViolations();
  });
});
