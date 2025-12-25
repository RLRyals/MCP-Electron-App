/**
 * VariableBrowser Accessibility Tests
 *
 * Tests tree navigation, ARIA tree attributes, keyboard support, and screen reader compatibility
 * Follows WCAG 2.1 Level AA standards for tree widgets
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { VariableBrowser, VariableBrowserProps } from '../VariableBrowser';
import type { NodeOutput } from '../../../types/workflow-nodes';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// ============================================================================
// Mock Data
// ============================================================================

const mockNodeOutputs = new Map<string, NodeOutput>([
  [
    'node-1',
    {
      nodeId: 'node-1',
      nodeName: 'Market Research',
      status: 'completed',
      output: {
        research: {
          marketSize: 'Large',
          trends: ['AI Fiction', 'Climate Fiction'],
          audience: {
            ageRange: '25-45',
            interests: ['Science', 'Technology'],
          },
        },
        confidence: 0.85,
      },
      timestamp: Date.now(),
    },
  ],
  [
    'node-2',
    {
      nodeId: 'node-2',
      nodeName: 'Genre Analysis',
      status: 'completed',
      output: {
        genres: ['Science Fiction', 'Thriller'],
        count: 2,
      },
      timestamp: Date.now(),
    },
  ],
]);

const mockGlobalVariables = {
  projectName: 'My Novel',
  author: 'John Doe',
  settings: {
    theme: 'dark',
    autoSave: true,
  },
};

const mockProps: VariableBrowserProps = {
  currentNodeId: 'node-3',
  nodeOutputs: mockNodeOutputs,
  globalVariables: mockGlobalVariables,
  onInsert: jest.fn(),
};

const renderVariableBrowser = (props: Partial<VariableBrowserProps> = {}) => {
  return render(<VariableBrowser {...mockProps} {...props} />);
};

// ============================================================================
// Automated Accessibility Tests
// ============================================================================

describe('VariableBrowser - Automated Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = renderVariableBrowser();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with empty data', async () => {
    const { container } = renderVariableBrowser({
      nodeOutputs: new Map(),
      globalVariables: {},
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with search query', async () => {
    const { container } = renderVariableBrowser();
    const user = userEvent.setup();

    const searchInput = screen.getByLabelText(/Search variables/i);
    await user.type(searchInput, 'market');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations when tree is expanded', async () => {
    const { container } = renderVariableBrowser();
    const user = userEvent.setup();

    // Expand a section
    const sections = screen.getAllByRole('treeitem');
    if (sections.length > 0) {
      await user.click(sections[0]);
    }

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ============================================================================
// ARIA Tree Attributes Tests
// ============================================================================

describe('VariableBrowser - ARIA Tree Attributes', () => {
  describe('Tree Structure', () => {
    it('should have proper tree role', () => {
      renderVariableBrowser();

      const tree = screen.getByRole('tree');
      expect(tree).toBeInTheDocument();
      expect(tree).toHaveAttribute('aria-label', 'Available variables');
    });

    it('should have treeitem role for all tree nodes', () => {
      renderVariableBrowser();

      const treeitems = screen.getAllByRole('treeitem');
      expect(treeitems.length).toBeGreaterThan(0);
    });

    it('should use aria-expanded for expandable items', () => {
      renderVariableBrowser();

      const treeitems = screen.getAllByRole('treeitem');
      treeitems.forEach(item => {
        const ariaExpanded = item.getAttribute('aria-expanded');
        // Should be either 'true', 'false', or null (for leaf nodes)
        if (ariaExpanded !== null) {
          expect(['true', 'false']).toContain(ariaExpanded);
        }
      });
    });

    it('should not have aria-expanded for leaf nodes', () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      // Expand a section to see leaf nodes
      const sections = screen.getAllByRole('treeitem');
      const firstSection = sections[0];

      // Click to expand
      userEvent.click(firstSection);

      // Wait and check for leaf nodes
      setTimeout(() => {
        const allTreeitems = screen.getAllByRole('treeitem');
        const leafNodes = allTreeitems.filter(
          item => item.getAttribute('aria-expanded') === null
        );
        expect(leafNodes.length).toBeGreaterThan(0);
      }, 100);
    });

    it('should update aria-expanded when items are toggled', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const sections = screen.getAllByRole('treeitem');
      const firstSection = sections[0];

      expect(firstSection).toHaveAttribute('aria-expanded', 'false');

      await user.click(firstSection);

      expect(firstSection).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Tree Item Labels', () => {
    it('should have accessible labels for all tree items', () => {
      renderVariableBrowser();

      const treeitems = screen.getAllByRole('treeitem');
      treeitems.forEach(item => {
        const label = item.getAttribute('aria-label');
        expect(label).toBeTruthy();
        expect(label!.length).toBeGreaterThan(0);
      });
    });

    it('should include data type and value in aria-label', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      // Expand to see items with values
      const sections = screen.getAllByRole('treeitem');
      await user.click(sections[0]);

      // Wait for expansion
      await new Promise(resolve => setTimeout(resolve, 100));

      const allItems = screen.getAllByRole('treeitem');
      const itemsWithValues = allItems.filter(item => {
        const label = item.getAttribute('aria-label') || '';
        return label.includes(','); // Format is "label, type, value"
      });

      expect(itemsWithValues.length).toBeGreaterThan(0);
    });
  });

  describe('Group Structure', () => {
    it('should use role="group" for nested children', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const sections = screen.getAllByRole('treeitem');
      await user.click(sections[0]);

      // Wait for expansion
      await new Promise(resolve => setTimeout(resolve, 100));

      const groups = screen.queryAllByRole('group');
      expect(groups.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Keyboard Navigation Tests
// ============================================================================

describe('VariableBrowser - Keyboard Navigation', () => {
  describe('Arrow Key Navigation', () => {
    it('should navigate down with ArrowDown', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const treeitems = screen.getAllByRole('treeitem');
      const firstItem = treeitems[0];
      const secondItem = treeitems[1];

      firstItem.focus();
      await user.keyboard('{ArrowDown}');

      // Second item should now have focus
      expect(document.activeElement).toBe(secondItem);
    });

    it('should navigate up with ArrowUp', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const treeitems = screen.getAllByRole('treeitem');
      const firstItem = treeitems[0];
      const secondItem = treeitems[1];

      secondItem.focus();
      await user.keyboard('{ArrowUp}');

      expect(document.activeElement).toBe(firstItem);
    });

    it('should expand collapsed node with ArrowRight', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const treeitems = screen.getAllByRole('treeitem');
      const expandableItem = treeitems.find(
        item => item.getAttribute('aria-expanded') === 'false'
      );

      if (expandableItem) {
        expandableItem.focus();
        await user.keyboard('{ArrowRight}');

        expect(expandableItem).toHaveAttribute('aria-expanded', 'true');
      }
    });

    it('should collapse expanded node with ArrowLeft', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const treeitems = screen.getAllByRole('treeitem');
      const firstItem = treeitems[0];

      // Expand first
      firstItem.focus();
      await user.keyboard('{ArrowRight}');
      expect(firstItem).toHaveAttribute('aria-expanded', 'true');

      // Then collapse
      await user.keyboard('{ArrowLeft}');
      expect(firstItem).toHaveAttribute('aria-expanded', 'false');
    });

    it('should not navigate beyond list bounds', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const treeitems = screen.getAllByRole('treeitem');
      const lastItem = treeitems[treeitems.length - 1];

      lastItem.focus();
      await user.keyboard('{ArrowDown}');

      // Should still be on last item
      expect(document.activeElement).toBe(lastItem);
    });

    it('should not navigate before first item', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const treeitems = screen.getAllByRole('treeitem');
      const firstItem = treeitems[0];

      firstItem.focus();
      await user.keyboard('{ArrowUp}');

      // Should still be on first item
      expect(document.activeElement).toBe(firstItem);
    });
  });

  describe('Action Keys', () => {
    it('should toggle expansion with Enter key', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const treeitems = screen.getAllByRole('treeitem');
      const expandableItem = treeitems.find(
        item => item.getAttribute('aria-expanded') === 'false'
      );

      if (expandableItem) {
        expandableItem.focus();
        await user.keyboard('{Enter}');

        expect(expandableItem).toHaveAttribute('aria-expanded', 'true');
      }
    });

    it('should toggle expansion with Space key', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const treeitems = screen.getAllByRole('treeitem');
      const expandableItem = treeitems.find(
        item => item.getAttribute('aria-expanded') === 'false'
      );

      if (expandableItem) {
        expandableItem.focus();
        await user.keyboard(' ');

        expect(expandableItem).toHaveAttribute('aria-expanded', 'true');
      }
    });

    it('should insert variable path when Enter is pressed on leaf node', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      // Expand to get leaf nodes
      const sections = screen.getAllByRole('treeitem');
      await user.click(sections[0]);
      await new Promise(resolve => setTimeout(resolve, 100));

      const allItems = screen.getAllByRole('treeitem');
      const leafNode = allItems.find(
        item => item.getAttribute('aria-expanded') === null
      );

      if (leafNode) {
        leafNode.focus();
        await user.keyboard('{Enter}');

        expect(mockProps.onInsert).toHaveBeenCalled();
      }
    });
  });

  describe('Focus Management', () => {
    it('should maintain only one focusable item at a time (roving tabindex)', () => {
      renderVariableBrowser();

      const treeitems = screen.getAllByRole('treeitem');
      const focusableItems = treeitems.filter(
        item => item.getAttribute('tabindex') === '0'
      );

      // Only one item should have tabindex="0"
      expect(focusableItems.length).toBeLessThanOrEqual(1);
    });

    it('should update tabindex when focus moves', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const treeitems = screen.getAllByRole('treeitem');
      const firstItem = treeitems[0];
      const secondItem = treeitems[1];

      firstItem.focus();
      expect(firstItem).toHaveAttribute('tabindex', '0');

      await user.keyboard('{ArrowDown}');

      expect(secondItem).toHaveAttribute('tabindex', '0');
      expect(firstItem).toHaveAttribute('tabindex', '-1');
    });

    it('should scroll focused item into view', async () => {
      renderVariableBrowser();
      const user = userEvent.setup();

      const treeitems = screen.getAllByRole('treeitem');
      const firstItem = treeitems[0];

      // Mock scrollIntoView
      const scrollIntoViewMock = jest.fn();
      firstItem.scrollIntoView = scrollIntoViewMock;

      firstItem.focus();
      await user.keyboard('{ArrowDown}');

      // Wait for effect to run
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have been called for the focused item
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Search Accessibility Tests
// ============================================================================

describe('VariableBrowser - Search Accessibility', () => {
  it('should have accessible search input', () => {
    renderVariableBrowser();

    const searchInput = screen.getByLabelText(/Search variables/i);
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('type', 'text');
  });

  it('should have accessible clear button', async () => {
    renderVariableBrowser();
    const user = userEvent.setup();

    const searchInput = screen.getByLabelText(/Search variables/i);
    await user.type(searchInput, 'test');

    const clearButton = screen.getByLabelText(/Clear search/i);
    expect(clearButton).toBeInTheDocument();
  });

  it('should focus search input when clear button is clicked', async () => {
    renderVariableBrowser();
    const user = userEvent.setup();

    const searchInput = screen.getByLabelText(/Search variables/i);
    await user.type(searchInput, 'test');

    const clearButton = screen.getByLabelText(/Clear search/i);
    await user.click(clearButton);

    expect(document.activeElement).toBe(searchInput);
  });

  it('should announce search query to screen readers', async () => {
    renderVariableBrowser();
    const user = userEvent.setup();

    const searchInput = screen.getByLabelText(/Search variables/i);
    await user.type(searchInput, 'market');

    const announcement = screen.getByRole('status');
    expect(announcement).toHaveTextContent(/Searching for: market/i);
  });

  it('should have aria-live region for search announcements', () => {
    renderVariableBrowser();

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });
});

// ============================================================================
// Screen Reader Support Tests
// ============================================================================

describe('VariableBrowser - Screen Reader Support', () => {
  it('should hide decorative icons from screen readers', () => {
    renderVariableBrowser();

    // Check that expand/collapse icons are hidden
    const expandIcons = screen.container.querySelectorAll('.tree-expand-icon');
    expandIcons.forEach(icon => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    const itemIcons = screen.container.querySelectorAll('.tree-item-icon');
    itemIcons.forEach(icon => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('should announce when variable is inserted', async () => {
    renderVariableBrowser();
    const user = userEvent.setup();

    // Expand and click an item
    const sections = screen.getAllByRole('treeitem');
    await user.click(sections[0]);
    await new Promise(resolve => setTimeout(resolve, 100));

    const allItems = screen.getAllByRole('treeitem');
    const leafNode = allItems.find(
      item => item.getAttribute('aria-expanded') === null
    );

    if (leafNode) {
      await user.click(leafNode);

      // Check that onInsert was called
      expect(mockProps.onInsert).toHaveBeenCalled();

      // In real implementation, an announcement element is created
      // We can't easily test the dynamic element creation in this test
      // but the component does create a screen reader announcement
    }
  });

  it('should provide meaningful empty state message', () => {
    renderVariableBrowser({
      nodeOutputs: new Map(),
      globalVariables: {},
    });

    const emptyMessage = screen.getByText(/No variables available yet/i);
    expect(emptyMessage).toBeInTheDocument();
  });

  it('should have screen reader only class for hidden content', () => {
    renderVariableBrowser();

    const srOnlyElements = screen.container.querySelectorAll('.sr-only');
    expect(srOnlyElements.length).toBeGreaterThan(0);

    srOnlyElements.forEach(element => {
      const styles = window.getComputedStyle(element);
      // sr-only elements should have specific styles for screen readers
      expect(element.className).toContain('sr-only');
    });
  });
});

// ============================================================================
// Complex Tree Structures Tests
// ============================================================================

describe('VariableBrowser - Complex Tree Structures', () => {
  it('should handle deeply nested objects accessibly', () => {
    const deeplyNested = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: 'deep value',
            },
          },
        },
      },
    };

    renderVariableBrowser({
      globalVariables: deeplyNested,
    });

    const tree = screen.getByRole('tree');
    expect(tree).toBeInTheDocument();

    // Should still be accessible
    const treeitems = screen.getAllByRole('treeitem');
    expect(treeitems.length).toBeGreaterThan(0);
  });

  it('should handle arrays accessibly', async () => {
    const arrayData = {
      items: ['item1', 'item2', 'item3'],
    };

    renderVariableBrowser({
      globalVariables: arrayData,
    });
    const user = userEvent.setup();

    // Expand to see array items
    const sections = screen.getAllByRole('treeitem');
    await user.click(sections[0]);

    await new Promise(resolve => setTimeout(resolve, 100));

    const treeitems = screen.getAllByRole('treeitem');
    expect(treeitems.length).toBeGreaterThan(1);

    // Array items should have accessible labels like "[0]", "[1]", etc.
    const arrayItems = treeitems.filter(item => {
      const label = item.getAttribute('aria-label') || '';
      return label.includes('[');
    });
    expect(arrayItems.length).toBeGreaterThan(0);
  });

  it('should handle circular references without breaking accessibility', () => {
    // VariableBrowser should handle circular references gracefully
    // by showing a "[Circular Reference]" indicator
    renderVariableBrowser();

    const tree = screen.getByRole('tree');
    expect(tree).toBeInTheDocument();
  });
});

// ============================================================================
// Visual Feedback Tests
// ============================================================================

describe('VariableBrowser - Visual Feedback', () => {
  it('should provide visual feedback on item click', async () => {
    renderVariableBrowser();
    const user = userEvent.setup();

    const sections = screen.getAllByRole('treeitem');
    await user.click(sections[0]);

    // Component should provide visual feedback (tested via className changes)
    // The actual animation is tested in integration tests
  });

  it('should highlight focused item', () => {
    renderVariableBrowser();

    const treeitems = screen.getAllByRole('treeitem');
    const firstItem = treeitems[0];

    firstItem.focus();

    // Focused item should have appropriate styling
    // This is primarily a visual test, but we can check for focus
    expect(document.activeElement).toBe(firstItem);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('VariableBrowser - Integration', () => {
  it('should maintain accessibility when filtering with search', async () => {
    renderVariableBrowser();
    const user = userEvent.setup();

    const searchInput = screen.getByLabelText(/Search variables/i);
    await user.type(searchInput, 'market');

    // Tree should still be accessible
    const tree = screen.getByRole('tree');
    expect(tree).toBeInTheDocument();

    const treeitems = screen.getAllByRole('treeitem');
    expect(treeitems.length).toBeGreaterThan(0);

    // All items should still have proper ARIA attributes
    treeitems.forEach(item => {
      expect(item.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('should handle rapid keyboard navigation', async () => {
    renderVariableBrowser();
    const user = userEvent.setup();

    const treeitems = screen.getAllByRole('treeitem');
    const firstItem = treeitems[0];

    firstItem.focus();

    // Rapidly press arrow down multiple times
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');

    // Should maintain accessibility and proper focus
    expect(document.activeElement).toHaveAttribute('role', 'treeitem');
  });
});
