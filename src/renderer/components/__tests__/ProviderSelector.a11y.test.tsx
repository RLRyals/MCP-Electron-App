/**
 * ProviderSelector Accessibility Tests
 *
 * Tests dropdown accessibility, slider controls, collapsible sections, and form interactions
 * Follows WCAG 2.1 Level AA standards
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ProviderSelector, ProviderSelectorProps } from '../ProviderSelector';
import type { LLMProviderConfig } from '../../../types/llm-providers';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock window.electron
global.window = Object.create(window);
Object.defineProperty(window, 'electron', {
  value: {
    invoke: jest.fn(),
  },
  writable: true,
});

// ============================================================================
// Mock Data
// ============================================================================

const mockProviders: LLMProviderConfig[] = [
  {
    id: 'provider-1',
    name: 'Claude Sonnet 4.5',
    type: 'claude-api',
    config: {
      model: 'claude-sonnet-4-5',
      apiKey: 'sk-test-key-1234567890',
      temperature: 0.7,
      maxTokens: 4096,
    },
  },
  {
    id: 'provider-2',
    name: 'GPT-4o',
    type: 'openai',
    config: {
      model: 'gpt-4o',
      apiKey: 'sk-test-openai-key',
      temperature: 0.8,
      maxTokens: 8192,
      topP: 0.95,
    },
  },
  {
    id: 'provider-3',
    name: 'Local Ollama',
    type: 'local',
    config: {
      model: 'llama2',
      endpoint: 'http://localhost:11434',
    },
  },
];

const mockProps: ProviderSelectorProps = {
  selectedProvider: mockProviders[0],
  availableProviders: mockProviders,
  onChange: jest.fn(),
  onAddProvider: jest.fn(),
};

const renderProviderSelector = (props: Partial<ProviderSelectorProps> = {}) => {
  return render(<ProviderSelector {...mockProps} {...props} />);
};

// ============================================================================
// Automated Accessibility Tests
// ============================================================================

describe('ProviderSelector - Automated Accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have no accessibility violations on initial render', async () => {
    const { container } = renderProviderSelector();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with no provider selected', async () => {
    const { container } = renderProviderSelector({ selectedProvider: null });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with advanced settings open', async () => {
    const { container } = renderProviderSelector();
    const user = userEvent.setup();

    const advancedToggle = screen.getByText(/Advanced Settings/i);
    await user.click(advancedToggle);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with OpenAI provider (includes Top P)', async () => {
    const { container } = renderProviderSelector({
      selectedProvider: mockProviders[1],
    });
    const user = userEvent.setup();

    const advancedToggle = screen.getByText(/Advanced Settings/i);
    await user.click(advancedToggle);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with local provider', async () => {
    const { container } = renderProviderSelector({
      selectedProvider: mockProviders[2],
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ============================================================================
// Dropdown Accessibility Tests
// ============================================================================

describe('ProviderSelector - Dropdown Accessibility', () => {
  it('should have accessible provider dropdown', () => {
    renderProviderSelector();

    const select = screen.getByLabelText(/LLM Provider/i);
    expect(select).toBeInTheDocument();
    expect(select).toHaveAttribute('aria-required', 'true');
  });

  it('should have proper select element attributes', () => {
    renderProviderSelector();

    const select = screen.getByLabelText(/LLM Provider/i);
    expect(select).toHaveAttribute('id', 'provider-select');
    expect(select).toHaveAttribute('role', 'combobox');
  });

  it('should have accessible option groups', () => {
    renderProviderSelector();

    const select = screen.getByLabelText(/LLM Provider/i) as HTMLSelectElement;
    const optgroups = select.querySelectorAll('optgroup');

    expect(optgroups.length).toBeGreaterThan(0);

    optgroups.forEach(optgroup => {
      expect(optgroup).toHaveAttribute('label');
      expect(optgroup.getAttribute('label')!.length).toBeGreaterThan(0);
    });
  });

  it('should have accessible model dropdown', () => {
    renderProviderSelector();

    const modelSelect = screen.getByLabelText(/Model \*/i);
    expect(modelSelect).toBeInTheDocument();
    expect(modelSelect).toHaveAttribute('aria-required', 'true');
  });

  it('should use text input for OpenRouter and Local providers', () => {
    renderProviderSelector({ selectedProvider: mockProviders[2] });

    const modelInput = screen.getByLabelText(/Model/i);
    expect(modelInput).toHaveAttribute('type', 'text');
    expect(modelInput).toHaveAttribute('placeholder');
  });

  it('should have helpful placeholder for different provider types', () => {
    const { rerender } = renderProviderSelector({
      selectedProvider: mockProviders[2],
    });

    const localInput = screen.getByLabelText(/Model/i);
    expect(localInput).toHaveAttribute('placeholder', 'e.g., llama2, mistral');

    // Test OpenRouter placeholder (mock an OpenRouter provider)
    const openRouterProvider: LLMProviderConfig = {
      id: 'or-1',
      name: 'OpenRouter',
      type: 'openrouter',
      config: { model: '' },
    };

    rerender(
      <ProviderSelector
        {...mockProps}
        selectedProvider={openRouterProvider}
        availableProviders={[openRouterProvider]}
      />
    );

    const orInput = screen.getByLabelText(/Model/i);
    expect(orInput).toHaveAttribute('placeholder', 'e.g., anthropic/claude-3.5-sonnet');
  });
});

// ============================================================================
// Slider Accessibility Tests
// ============================================================================

describe('ProviderSelector - Slider Accessibility', () => {
  beforeEach(async () => {
    renderProviderSelector();
    const advancedToggle = screen.getByText(/Advanced Settings/i);
    await userEvent.click(advancedToggle);
  });

  describe('Temperature Slider', () => {
    it('should have proper ARIA attributes', () => {
      const slider = screen.getByLabelText(/Temperature:/i);

      expect(slider).toHaveAttribute('type', 'range');
      expect(slider).toHaveAttribute('aria-valuemin', '0');
      expect(slider).toHaveAttribute('aria-valuemax', '2');
      expect(slider).toHaveAttribute('aria-valuenow');
    });

    it('should display current value in label', () => {
      const label = screen.getByText(/Temperature: 0\.70/i);
      expect(label).toBeInTheDocument();
    });

    it('should have min and max attributes', () => {
      const slider = screen.getByLabelText(/Temperature:/i);

      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', '2');
      expect(slider).toHaveAttribute('step', '0.1');
    });

    it('should have descriptive labels for min/max values', () => {
      expect(screen.getByText('0.0 (Focused)')).toBeInTheDocument();
      expect(screen.getByText('2.0 (Creative)')).toBeInTheDocument();
    });

    it('should update aria-valuenow when value changes', async () => {
      const user = userEvent.setup();
      const slider = screen.getByLabelText(/Temperature:/i) as HTMLInputElement;

      await user.type(slider, '{ArrowRight}');

      const valuenow = parseFloat(slider.getAttribute('aria-valuenow')!);
      expect(valuenow).toBeGreaterThanOrEqual(0);
      expect(valuenow).toBeLessThanOrEqual(2);
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const slider = screen.getByLabelText(/Temperature:/i);

      const initialValue = slider.getAttribute('value');

      await user.click(slider);
      await user.keyboard('{ArrowRight}');

      const newValue = slider.getAttribute('value');
      expect(newValue).not.toBe(initialValue);
    });
  });

  describe('Top P Slider (OpenAI providers)', () => {
    beforeEach(async () => {
      renderProviderSelector({ selectedProvider: mockProviders[1] });
      const advancedToggle = screen.getByText(/Advanced Settings/i);
      await userEvent.click(advancedToggle);
    });

    it('should have proper ARIA attributes', () => {
      const slider = screen.getByLabelText(/Top P:/i);

      expect(slider).toHaveAttribute('type', 'range');
      expect(slider).toHaveAttribute('aria-valuemin', '0');
      expect(slider).toHaveAttribute('aria-valuemax', '1');
      expect(slider).toHaveAttribute('aria-valuenow');
    });

    it('should have descriptive labels', () => {
      expect(screen.getByText('0.0 (Deterministic)')).toBeInTheDocument();
      expect(screen.getByText('1.0 (Diverse)')).toBeInTheDocument();
    });

    it('should have appropriate step value', () => {
      const slider = screen.getByLabelText(/Top P:/i);
      expect(slider).toHaveAttribute('step', '0.01');
    });
  });
});

// ============================================================================
// Collapsible Section Accessibility
// ============================================================================

describe('ProviderSelector - Collapsible Sections', () => {
  it('should have proper aria-expanded attribute', () => {
    renderProviderSelector();

    const advancedToggle = screen.getByText(/Advanced Settings/i);
    expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('should update aria-expanded when toggled', async () => {
    renderProviderSelector();
    const user = userEvent.setup();

    const advancedToggle = screen.getByText(/Advanced Settings/i);

    await user.click(advancedToggle);
    expect(advancedToggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(advancedToggle);
    expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('should be keyboard accessible', async () => {
    renderProviderSelector();
    const user = userEvent.setup();

    const advancedToggle = screen.getByText(/Advanced Settings/i);

    advancedToggle.focus();
    await user.keyboard('{Enter}');

    expect(advancedToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('should show/hide content based on expanded state', async () => {
    renderProviderSelector();
    const user = userEvent.setup();

    expect(screen.queryByLabelText(/Temperature:/i)).not.toBeInTheDocument();

    const advancedToggle = screen.getByText(/Advanced Settings/i);
    await user.click(advancedToggle);

    expect(screen.getByLabelText(/Temperature:/i)).toBeInTheDocument();
  });

  it('should have button type to prevent form submission', () => {
    renderProviderSelector();

    const advancedToggle = screen.getByText(/Advanced Settings/i);
    expect(advancedToggle).toHaveAttribute('type', 'button');
  });
});

// ============================================================================
// Form Field Associations
// ============================================================================

describe('ProviderSelector - Form Field Associations', () => {
  it('should associate labels with inputs using htmlFor', () => {
    renderProviderSelector();

    const label = screen.getByText(/LLM Provider/i);
    expect(label).toHaveAttribute('for', 'provider-select');

    const select = screen.getByLabelText(/LLM Provider/i);
    expect(select).toHaveAttribute('id', 'provider-select');
  });

  it('should have proper label for max tokens input', async () => {
    renderProviderSelector();
    const user = userEvent.setup();

    const advancedToggle = screen.getByText(/Advanced Settings/i);
    await user.click(advancedToggle);

    const maxTokensInput = screen.getByLabelText(/Max Tokens/i);
    expect(maxTokensInput).toHaveAttribute('id', 'max-tokens-input');
    expect(maxTokensInput).toHaveAttribute('type', 'number');
  });

  it('should have helpful placeholder for max tokens', async () => {
    renderProviderSelector();
    const user = userEvent.setup();

    const advancedToggle = screen.getByText(/Advanced Settings/i);
    await user.click(advancedToggle);

    const maxTokensInput = screen.getByLabelText(/Max Tokens/i);
    expect(maxTokensInput).toHaveAttribute('placeholder');
  });
});

// ============================================================================
// Number Input Accessibility
// ============================================================================

describe('ProviderSelector - Number Input Accessibility', () => {
  beforeEach(async () => {
    renderProviderSelector();
    const advancedToggle = screen.getByText(/Advanced Settings/i);
    await userEvent.click(advancedToggle);
  });

  it('should have proper min/max attributes for max tokens', () => {
    const maxTokensInput = screen.getByLabelText(/Max Tokens/i);

    expect(maxTokensInput).toHaveAttribute('type', 'number');
    expect(maxTokensInput).toHaveAttribute('min', '1');
    expect(maxTokensInput).toHaveAttribute('max', '100000');
  });

  it('should support keyboard input', async () => {
    const user = userEvent.setup();
    const maxTokensInput = screen.getByLabelText(/Max Tokens/i);

    await user.clear(maxTokensInput);
    await user.type(maxTokensInput, '2048');

    expect(mockProps.onChange).toHaveBeenCalled();
  });

  it('should support arrow key incrementing', async () => {
    const user = userEvent.setup();
    const maxTokensInput = screen.getByLabelText(/Max Tokens/i) as HTMLInputElement;

    await user.click(maxTokensInput);
    const initialValue = parseInt(maxTokensInput.value);

    await user.keyboard('{ArrowUp}');

    // Value should have increased
    expect(parseInt(maxTokensInput.value)).toBeGreaterThan(initialValue);
  });
});

// ============================================================================
// Provider Info Display Accessibility
// ============================================================================

describe('ProviderSelector - Provider Info Display', () => {
  it('should display provider information accessibly', () => {
    renderProviderSelector();

    expect(screen.getByText(/Type:/i)).toBeInTheDocument();
    expect(screen.getByText(/Status:/i)).toBeInTheDocument();
  });

  it('should mask API keys for security', () => {
    renderProviderSelector();

    expect(screen.getByText(/API Key:/i)).toBeInTheDocument();

    // Should show masked version (sk-...7890)
    const apiKeyDisplay = screen.getByText(/sk-\.{3}/);
    expect(apiKeyDisplay).toBeInTheDocument();

    // Should not show full key
    expect(screen.queryByText(/sk-test-key-1234567890/)).not.toBeInTheDocument();
  });

  it('should have accessible test connection button', () => {
    renderProviderSelector();

    const testButton = screen.getByText(/Test Connection/i);
    expect(testButton).toBeInTheDocument();
    expect(testButton).toHaveAttribute('type', 'button');
  });

  it('should disable test button during testing', async () => {
    (window.electron.invoke as jest.Mock).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({ valid: true }), 1000))
    );

    renderProviderSelector();
    const user = userEvent.setup();

    const testButton = screen.getByText(/Test Connection/i);
    await user.click(testButton);

    expect(testButton).toBeDisabled();
  });

  it('should announce status changes to screen readers', async () => {
    (window.electron.invoke as jest.Mock).mockResolvedValue({ valid: true });

    renderProviderSelector();
    const user = userEvent.setup();

    const testButton = screen.getByText(/Test Connection/i);
    await user.click(testButton);

    // Wait for status to update
    await screen.findByText(/Verified/i);

    const verifiedStatus = screen.getByText(/Verified/i);
    expect(verifiedStatus).toBeInTheDocument();
  });
});

// ============================================================================
// Help Text Accessibility
// ============================================================================

describe('ProviderSelector - Help Text', () => {
  it('should show helpful text when no provider is selected', () => {
    renderProviderSelector({ selectedProvider: null });

    const helpText = screen.getByText(/Select an LLM provider/i);
    expect(helpText).toBeInTheDocument();
  });

  it('should not show help text when provider is selected', () => {
    renderProviderSelector();

    expect(screen.queryByText(/Select an LLM provider/i)).not.toBeInTheDocument();
  });
});

// ============================================================================
// Keyboard Navigation Tests
// ============================================================================

describe('ProviderSelector - Keyboard Navigation', () => {
  it('should support Tab navigation through all controls', async () => {
    renderProviderSelector();
    const user = userEvent.setup();

    const providerSelect = screen.getByLabelText(/LLM Provider/i);
    providerSelect.focus();

    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByLabelText(/Model/i));
  });

  it('should support Tab navigation in advanced settings', async () => {
    renderProviderSelector();
    const user = userEvent.setup();

    const advancedToggle = screen.getByText(/Advanced Settings/i);
    await user.click(advancedToggle);

    const temperatureSlider = screen.getByLabelText(/Temperature:/i);
    temperatureSlider.focus();

    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByLabelText(/Max Tokens/i));
  });

  it('should allow Enter/Space to toggle advanced section', async () => {
    renderProviderSelector();
    const user = userEvent.setup();

    const advancedToggle = screen.getByText(/Advanced Settings/i);
    advancedToggle.focus();

    await user.keyboard(' ');
    expect(advancedToggle).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard(' ');
    expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');
  });
});

// ============================================================================
// Dynamic Content Updates
// ============================================================================

describe('ProviderSelector - Dynamic Content', () => {
  it('should maintain accessibility when provider changes', async () => {
    const { container, rerender } = renderProviderSelector({
      selectedProvider: mockProviders[0],
    });

    const results1 = await axe(container);
    expect(results1).toHaveNoViolations();

    rerender(
      <ProviderSelector
        {...mockProps}
        selectedProvider={mockProviders[1]}
      />
    );

    const results2 = await axe(container);
    expect(results2).toHaveNoViolations();
  });

  it('should maintain accessibility when model field changes type', async () => {
    const { container, rerender } = renderProviderSelector({
      selectedProvider: mockProviders[0],
    });

    // Initially dropdown
    expect(screen.getByLabelText(/Model/i)).toHaveAttribute('role', 'combobox');

    rerender(
      <ProviderSelector
        {...mockProps}
        selectedProvider={mockProviders[2]}
      />
    );

    // Now text input
    expect(screen.getByLabelText(/Model/i)).toHaveAttribute('type', 'text');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ============================================================================
// Add Provider Action
// ============================================================================

describe('ProviderSelector - Add Provider Action', () => {
  it('should have accessible Add New Provider option', () => {
    renderProviderSelector();

    const select = screen.getByLabelText(/LLM Provider/i) as HTMLSelectElement;
    const addOption = Array.from(select.options).find(
      option => option.value === '__add_new__'
    );

    expect(addOption).toBeTruthy();
    expect(addOption!.textContent).toContain('Add New Provider');
  });

  it('should trigger onAddProvider when Add New is selected', async () => {
    renderProviderSelector();
    const user = userEvent.setup();

    const select = screen.getByLabelText(/LLM Provider/i);
    await user.selectOptions(select, '__add_new__');

    expect(mockProps.onAddProvider).toHaveBeenCalled();
  });
});

// ============================================================================
// Visual Indicator Tests
// ============================================================================

describe('ProviderSelector - Visual Indicators', () => {
  it('should include provider type icons in labels', () => {
    renderProviderSelector();

    const select = screen.getByLabelText(/LLM Provider/i) as HTMLSelectElement;
    const optgroups = select.querySelectorAll('optgroup');

    optgroups.forEach(optgroup => {
      const label = optgroup.getAttribute('label')!;
      // Label should include emoji icons (🔷, 🟢, etc.)
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it('should show status badges accessibly', async () => {
    (window.electron.invoke as jest.Mock).mockResolvedValue({ valid: true });

    renderProviderSelector();
    const user = userEvent.setup();

    const testButton = screen.getByText(/Test Connection/i);
    await user.click(testButton);

    await screen.findByText(/Verified/i);

    const verifiedBadge = screen.getByText(/Verified/i);
    expect(verifiedBadge).toBeVisible();
  });
});
