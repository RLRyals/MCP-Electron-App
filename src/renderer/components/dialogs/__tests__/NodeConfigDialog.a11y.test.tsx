/**
 * NodeConfigDialog Accessibility Tests
 *
 * Comprehensive accessibility testing following WCAG 2.1 Level AA standards
 * Tests keyboard navigation, ARIA attributes, focus management, and screen reader support
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NodeConfigDialog, NodeConfigDialogProps } from '../NodeConfigDialog';
import type { WorkflowNode } from '../../../../types/workflow-nodes';
import type { LLMProviderConfig } from '../../../../types/llm-providers';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// ============================================================================
// Mock Data
// ============================================================================

const mockPlanningNode: WorkflowNode = {
  id: 'node-1',
  type: 'planning',
  name: 'Market Research Phase',
  description: 'Research market trends and audience',
  position: { x: 100, y: 100 },
  agent: 'market-research-agent',
  skill: 'trend-analysis',
  provider: {
    name: 'anthropic',
    model: 'claude-sonnet-4-5',
  },
  requiresApproval: false,
};

const mockUserInputNode: WorkflowNode = {
  id: 'node-2',
  type: 'user-input',
  name: 'Genre Selection',
  description: 'User selects genre',
  position: { x: 200, y: 200 },
  requiresApproval: false,
};

const mockProviders: LLMProviderConfig[] = [
  {
    id: 'provider-1',
    name: 'Claude Sonnet 4.5',
    type: 'claude-api',
    config: {
      model: 'claude-sonnet-4-5',
      apiKey: 'test-key',
    },
  },
];

const mockProps: NodeConfigDialogProps = {
  node: mockPlanningNode,
  availableProviders: mockProviders,
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

// ============================================================================
// Test Setup Helpers
// ============================================================================

const renderDialog = (props: Partial<NodeConfigDialogProps> = {}) => {
  return render(<NodeConfigDialog {...mockProps} {...props} />);
};

const getAllFocusableElements = (container: HTMLElement): HTMLElement[] => {
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ) as HTMLElement[];
};

// ============================================================================
// Automated Accessibility Tests (jest-axe)
// ============================================================================

describe('NodeConfigDialog - Automated Accessibility', () => {
  it('should have no accessibility violations on initial render', async () => {
    const { container } = renderDialog();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations when displaying validation errors', async () => {
    const { container } = renderDialog();
    const user = userEvent.setup();

    // Clear required field to trigger error
    const nameInput = screen.getByLabelText(/Node Name/i);
    await user.clear(nameInput);

    // Try to save to trigger validation
    const saveButton = screen.getByText('Save Changes');
    await user.click(saveButton);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with user input node type', async () => {
    const { container } = renderDialog({ node: mockUserInputNode });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations on each tab', async () => {
    const { container } = renderDialog();

    const tabs = ['Basic Info', 'Configuration', 'LLM Provider', 'Context & Variables', 'Advanced'];

    for (const tabName of tabs) {
      const tab = screen.queryByRole('tab', { name: new RegExp(tabName, 'i') });
      if (tab) {
        await userEvent.click(tab);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      }
    }
  });
});

// ============================================================================
// ARIA Attributes Tests
// ============================================================================

describe('NodeConfigDialog - ARIA Attributes', () => {
  describe('Dialog Structure', () => {
    it('should have proper dialog role and ARIA attributes', () => {
      renderDialog();

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description');
    });

    it('should have accessible dialog title and description', () => {
      renderDialog();

      const title = screen.getByText('Configure Node');
      expect(title).toHaveAttribute('id', 'dialog-title');

      const description = screen.getByText(mockPlanningNode.name);
      expect(description).toHaveAttribute('id', 'dialog-description');
    });
  });

  describe('Tab Navigation', () => {
    it('should have proper tablist role and ARIA attributes', () => {
      renderDialog();

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
      expect(tablist).toHaveAttribute('aria-label', 'Node configuration tabs');
    });

    it('should mark active tab with aria-selected', () => {
      renderDialog();

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      expect(basicTab).toHaveAttribute('aria-selected', 'true');

      const configTab = screen.getByRole('tab', { name: /Configuration/i });
      expect(configTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should associate tabs with their panels using aria-controls', () => {
      renderDialog();

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      expect(basicTab).toHaveAttribute('aria-controls', 'panel-basic');
      expect(basicTab).toHaveAttribute('id', 'tab-basic');
    });

    it('should have tabindex 0 for active tab and -1 for inactive tabs', () => {
      renderDialog();

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      expect(basicTab).toHaveAttribute('tabindex', '0');

      const configTab = screen.getByRole('tab', { name: /Configuration/i });
      expect(configTab).toHaveAttribute('tabindex', '-1');
    });

    it('should update tabindex when active tab changes', async () => {
      renderDialog();
      const user = userEvent.setup();

      const configTab = screen.getByRole('tab', { name: /Configuration/i });
      await user.click(configTab);

      expect(configTab).toHaveAttribute('tabindex', '0');

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      expect(basicTab).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('Tab Panels', () => {
    it('should have proper tabpanel role and ARIA attributes', () => {
      renderDialog();

      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveAttribute('id', 'panel-basic');
      expect(panel).toHaveAttribute('aria-labelledby', 'tab-basic');
    });
  });

  describe('Form Fields', () => {
    it('should mark required fields with aria-required', () => {
      renderDialog();

      const nameInput = screen.getByLabelText(/Node Name/i);
      expect(nameInput).toHaveAttribute('aria-required', 'true');
      expect(nameInput).toHaveAttribute('required');
    });

    it('should mark invalid fields with aria-invalid', async () => {
      renderDialog();
      const user = userEvent.setup();

      const nameInput = screen.getByLabelText(/Node Name/i);
      await user.clear(nameInput);

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('should associate error messages with fields using aria-describedby', async () => {
      renderDialog();
      const user = userEvent.setup();

      const nameInput = screen.getByLabelText(/Node Name/i);
      await user.clear(nameInput);

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      expect(nameInput).toHaveAttribute('aria-describedby', 'node-name-error');
      const errorMessage = screen.getByRole('alert', { name: /Node name is required/i });
      expect(errorMessage).toHaveAttribute('id', 'node-name-error');
    });

    it('should have accessible labels for all form inputs', () => {
      renderDialog();

      // All inputs should have labels
      const nameInput = screen.getByLabelText(/Node Name/i);
      expect(nameInput).toBeInTheDocument();

      const descInput = screen.getByLabelText(/Description/i);
      expect(descInput).toBeInTheDocument();

      const typeSelect = screen.getByLabelText(/Node Type/i);
      expect(typeSelect).toBeInTheDocument();
    });

    it('should use htmlFor to associate labels with inputs', () => {
      renderDialog();

      const label = screen.getByText(/Node Name/);
      expect(label).toHaveAttribute('for', 'node-name');

      const input = screen.getByLabelText(/Node Name/i);
      expect(input).toHaveAttribute('id', 'node-name');
    });
  });

  describe('Error Announcements', () => {
    it('should announce errors to screen readers with aria-live', async () => {
      renderDialog();
      const user = userEvent.setup();

      const nameInput = screen.getByLabelText(/Node Name/i);
      await user.clear(nameInput);

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Error message should have role="alert" which implicitly has aria-live="assertive"
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Tab Error Indicators', () => {
    it('should provide accessible error count for tabs with errors', async () => {
      renderDialog();
      const user = userEvent.setup();

      const nameInput = screen.getByLabelText(/Node Name/i);
      await user.clear(nameInput);

      const saveButton = screen.getByText('Save Changes');
      await user.click(saveButton);

      // Error badge should have aria-label
      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      const errorBadge = within(basicTab).getByLabelText(/error/i);
      expect(errorBadge).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Keyboard Navigation Tests
// ============================================================================

describe('NodeConfigDialog - Keyboard Navigation', () => {
  describe('Tab Navigation with Arrow Keys', () => {
    it('should navigate to next tab with ArrowRight', async () => {
      renderDialog();
      const user = userEvent.setup();

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      basicTab.focus();

      await user.keyboard('{ArrowRight}');

      const configTab = screen.getByRole('tab', { name: /Configuration/i });
      expect(configTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should navigate to previous tab with ArrowLeft', async () => {
      renderDialog();
      const user = userEvent.setup();

      // First go to second tab
      const configTab = screen.getByRole('tab', { name: /Configuration/i });
      await user.click(configTab);
      configTab.focus();

      await user.keyboard('{ArrowLeft}');

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      expect(basicTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap to first tab when pressing ArrowRight on last tab', async () => {
      renderDialog();
      const user = userEvent.setup();

      // Navigate to last visible tab
      const advancedTab = screen.getByRole('tab', { name: /Advanced/i });
      await user.click(advancedTab);
      advancedTab.focus();

      await user.keyboard('{ArrowRight}');

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      expect(basicTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap to last tab when pressing ArrowLeft on first tab', async () => {
      renderDialog();
      const user = userEvent.setup();

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      basicTab.focus();

      await user.keyboard('{ArrowLeft}');

      const advancedTab = screen.getByRole('tab', { name: /Advanced/i });
      expect(advancedTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should support ArrowDown for tab navigation', async () => {
      renderDialog();
      const user = userEvent.setup();

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      basicTab.focus();

      await user.keyboard('{ArrowDown}');

      const configTab = screen.getByRole('tab', { name: /Configuration/i });
      expect(configTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should support ArrowUp for tab navigation', async () => {
      renderDialog();
      const user = userEvent.setup();

      const configTab = screen.getByRole('tab', { name: /Configuration/i });
      await user.click(configTab);
      configTab.focus();

      await user.keyboard('{ArrowUp}');

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      expect(basicTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should navigate to first tab with Home key', async () => {
      renderDialog();
      const user = userEvent.setup();

      const advancedTab = screen.getByRole('tab', { name: /Advanced/i });
      await user.click(advancedTab);
      advancedTab.focus();

      await user.keyboard('{Home}');

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      expect(basicTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should navigate to last tab with End key', async () => {
      renderDialog();
      const user = userEvent.setup();

      const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
      basicTab.focus();

      await user.keyboard('{End}');

      const advancedTab = screen.getByRole('tab', { name: /Advanced/i });
      expect(advancedTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should activate tab with Enter key', async () => {
      renderDialog();
      const user = userEvent.setup();

      const configTab = screen.getByRole('tab', { name: /Configuration/i });
      configTab.focus();

      await user.keyboard('{Enter}');

      expect(configTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should activate tab with Space key', async () => {
      renderDialog();
      const user = userEvent.setup();

      const configTab = screen.getByRole('tab', { name: /Configuration/i });
      configTab.focus();

      await user.keyboard(' ');

      expect(configTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Dialog-level Keyboard Shortcuts', () => {
    it('should close dialog with Escape key', async () => {
      renderDialog();
      const user = userEvent.setup();

      await user.keyboard('{Escape}');

      expect(mockProps.onCancel).toHaveBeenCalled();
    });

    it('should save with Ctrl+Enter', async () => {
      renderDialog();
      const user = userEvent.setup();

      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(mockProps.onSave).toHaveBeenCalled();
    });
  });

  describe('Focus Trap', () => {
    it('should trap focus within dialog', async () => {
      const { container } = renderDialog();
      const user = userEvent.setup();

      const focusableElements = getAllFocusableElements(container);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Focus last element
      lastElement.focus();
      expect(document.activeElement).toBe(lastElement);

      // Tab should cycle to first element
      await user.keyboard('{Tab}');
      expect(document.activeElement).toBe(firstElement);
    });

    it('should trap focus backward (Shift+Tab)', async () => {
      const { container } = renderDialog();
      const user = userEvent.setup();

      const focusableElements = getAllFocusableElements(container);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Focus first element
      firstElement.focus();
      expect(document.activeElement).toBe(firstElement);

      // Shift+Tab should cycle to last element
      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(document.activeElement).toBe(lastElement);
    });
  });
});

// ============================================================================
// Focus Management Tests
// ============================================================================

describe('NodeConfigDialog - Focus Management', () => {
  it('should auto-focus name input on mount', async () => {
    renderDialog();

    // Wait for focus to be set (with delay)
    await new Promise(resolve => setTimeout(resolve, 150));

    const nameInput = screen.getByLabelText(/Node Name/i);
    expect(document.activeElement).toBe(nameInput);
  });

  it('should maintain focus on tab change', async () => {
    renderDialog();
    const user = userEvent.setup();

    const configTab = screen.getByRole('tab', { name: /Configuration/i });
    await user.click(configTab);

    // The clicked tab should maintain focus
    expect(document.activeElement).toBe(configTab);
  });

  it('should focus first error field when validation fails', async () => {
    renderDialog();
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText(/Node Name/i);
    await user.clear(nameInput);

    const saveButton = screen.getByText('Save Changes');
    await user.click(saveButton);

    // Should switch to the tab containing the error
    const basicTab = screen.getByRole('tab', { name: /Basic Info/i });
    expect(basicTab).toHaveAttribute('aria-selected', 'true');
  });
});

// ============================================================================
// Screen Reader Support Tests
// ============================================================================

describe('NodeConfigDialog - Screen Reader Support', () => {
  it('should announce validation errors', async () => {
    renderDialog();
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText(/Node Name/i);
    await user.clear(nameInput);

    const saveButton = screen.getByText('Save Changes');
    await user.click(saveButton);

    // Error should be announced via role="alert"
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('should have descriptive accessible names for all interactive elements', () => {
    renderDialog();

    const closeButton = screen.getByLabelText('Close dialog');
    expect(closeButton).toBeInTheDocument();

    const cancelButton = screen.getByLabelText('Cancel and close dialog');
    expect(cancelButton).toBeInTheDocument();

    const saveButton = screen.getByLabelText('Save changes and close dialog');
    expect(saveButton).toBeInTheDocument();
  });

  it('should hide decorative icons from screen readers', () => {
    renderDialog();

    // Tab icons should have aria-hidden
    const tabs = screen.getAllByRole('tab');
    tabs.forEach(tab => {
      const icon = within(tab).queryByText(/[📝⚙️🤖🔗🔧]/);
      if (icon) {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      }
    });
  });

  it('should provide screen-reader-only text for required indicators', () => {
    renderDialog();

    const requiredIndicator = screen.getByLabelText('required');
    expect(requiredIndicator).toBeInTheDocument();
  });

  it('should have proper heading hierarchy', () => {
    renderDialog();

    const title = screen.getByRole('heading', { name: /Configure Node/i });
    expect(title).toBeInTheDocument();
  });
});

// ============================================================================
// Mode Toggle Accessibility Tests
// ============================================================================

describe('NodeConfigDialog - Mode Toggles', () => {
  it('should have proper aria-pressed for mode toggle buttons', async () => {
    renderDialog();
    const user = userEvent.setup();

    // Navigate to Context tab
    const contextTab = screen.getByRole('tab', { name: /Context/i });
    await user.click(contextTab);

    const simpleButton = screen.getByText('Simple');
    const advancedButton = screen.getByText('Advanced');

    expect(simpleButton).toHaveAttribute('aria-pressed', 'true');
    expect(advancedButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('should update aria-pressed when mode changes', async () => {
    renderDialog();
    const user = userEvent.setup();

    const contextTab = screen.getByRole('tab', { name: /Context/i });
    await user.click(contextTab);

    const advancedButton = screen.getByText('Advanced');
    await user.click(advancedButton);

    expect(advancedButton).toHaveAttribute('aria-pressed', 'true');

    const simpleButton = screen.getByText('Simple');
    expect(simpleButton).toHaveAttribute('aria-pressed', 'false');
  });
});

// ============================================================================
// Advanced Tab Accessibility
// ============================================================================

describe('NodeConfigDialog - Advanced Tab Accessibility', () => {
  beforeEach(async () => {
    renderDialog();
    const advancedTab = screen.getByRole('tab', { name: /Advanced/i });
    await userEvent.click(advancedTab);
  });

  it('should have accessible checkbox labels', () => {
    const checkbox = screen.getByLabelText(/Requires User Approval/i);
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('type', 'checkbox');
  });

  it('should associate help text with inputs using aria-describedby', () => {
    const skipInput = screen.getByLabelText(/Skip Condition/i);
    expect(skipInput).toHaveAttribute('aria-describedby', 'skip-condition-help');

    const helpText = screen.getByText(/JSONPath expression/i);
    expect(helpText).toHaveAttribute('id', 'skip-condition-help');
  });

  it('should have proper min/max attributes on number inputs', () => {
    const timeoutInput = screen.getByLabelText(/Timeout/i);
    expect(timeoutInput).toHaveAttribute('type', 'number');
    expect(timeoutInput).toHaveAttribute('min', '0');
  });
});
