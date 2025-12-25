/**
 * ProviderSelector Component
 *
 * Component for selecting and configuring LLM providers for agent nodes.
 * Provides dropdown selection, model configuration, and advanced settings.
 */

import React, { useState } from 'react';
import { LLMProviderConfig } from '../../types/llm-providers';

export interface ProviderSelectorProps {
  selectedProvider: LLMProviderConfig | null;
  availableProviders: LLMProviderConfig[];
  onChange: (provider: LLMProviderConfig) => void;
  onAddProvider: () => void;
}

/**
 * Model options by provider type
 */
const MODEL_OPTIONS = {
  'claude-code-cli': [
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
  ],
  'claude-api': [
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-opus-4', label: 'Claude Opus 4' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Oct 2024)' },
  ],
  'openai': [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  'google': [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-pro', label: 'Gemini Pro' },
    { value: 'gemini-ultra', label: 'Gemini Ultra' },
  ],
  'openrouter': [], // Free text input
  'local': [], // Free text input
};

/**
 * Provider type display names
 */
const PROVIDER_TYPE_NAMES: Record<LLMProviderConfig['type'], string> = {
  'claude-code-cli': 'Claude Code CLI',
  'claude-api': 'Claude API',
  'openai': 'OpenAI',
  'google': 'Google Gemini',
  'openrouter': 'OpenRouter',
  'local': 'Local LLM',
};

/**
 * Provider type icons
 */
const PROVIDER_TYPE_ICONS: Record<LLMProviderConfig['type'], string> = {
  'claude-code-cli': '🤖',
  'claude-api': '🔷',
  'openai': '🟢',
  'google': '🔵',
  'openrouter': '🔀',
  'local': '💻',
};

/**
 * Default max tokens by provider
 */
const DEFAULT_MAX_TOKENS: Record<LLMProviderConfig['type'], number> = {
  'claude-code-cli': 4096,
  'claude-api': 4096,
  'openai': 4096,
  'google': 8192,
  'openrouter': 4096,
  'local': 2048,
};

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProvider,
  availableProviders,
  onChange,
  onAddProvider,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'testing' | 'verified' | 'invalid'>('idle');

  // Group providers by type
  const providersByType = availableProviders.reduce((acc, provider) => {
    if (!acc[provider.type]) {
      acc[provider.type] = [];
    }
    acc[provider.type].push(provider);
    return acc;
  }, {} as Record<LLMProviderConfig['type'], LLMProviderConfig[]>);

  /**
   * Handle provider selection change
   */
  const handleProviderChange = (providerId: string) => {
    if (providerId === '__add_new__') {
      onAddProvider();
      return;
    }

    const provider = availableProviders.find(p => p.id === providerId);
    if (provider) {
      onChange(provider);
      setValidationStatus('idle');
    }
  };

  /**
   * Handle model selection change
   */
  const handleModelChange = (model: string) => {
    if (!selectedProvider) return;

    const updated = {
      ...selectedProvider,
      config: {
        ...selectedProvider.config,
        model,
      },
    } as LLMProviderConfig;

    onChange(updated);
  };

  /**
   * Handle advanced settings change
   */
  const handleAdvancedChange = (field: 'temperature' | 'maxTokens' | 'topP', value: number) => {
    if (!selectedProvider) return;

    const updated = {
      ...selectedProvider,
      config: {
        ...selectedProvider.config,
        [field]: value,
      },
    } as LLMProviderConfig;

    onChange(updated);
  };

  /**
   * Test provider connection
   */
  const handleTestConnection = async () => {
    if (!selectedProvider) return;

    setValidationStatus('testing');

    try {
      const result = await (window.electronAPI as any).invoke('provider:test', selectedProvider);
      setValidationStatus(result.valid ? 'verified' : 'invalid');
    } catch (error) {
      setValidationStatus('invalid');
    }
  };

  /**
   * Get current model value
   */
  const getCurrentModel = (): string => {
    if (!selectedProvider) return '';
    return (selectedProvider.config as any).model || '';
  };

  /**
   * Get current temperature
   */
  const getCurrentTemperature = (): number => {
    if (!selectedProvider) return 0.7;
    return (selectedProvider.config as any).temperature ?? 0.7;
  };

  /**
   * Get current max tokens
   */
  const getCurrentMaxTokens = (): number => {
    if (!selectedProvider) return 4096;
    return (selectedProvider.config as any).maxTokens ?? DEFAULT_MAX_TOKENS[selectedProvider.type];
  };

  /**
   * Get current top P
   */
  const getCurrentTopP = (): number => {
    if (!selectedProvider) return 1.0;
    return (selectedProvider.config as any).topP ?? 1.0;
  };

  /**
   * Get masked API key for display
   */
  const getMaskedApiKey = (): string | null => {
    if (!selectedProvider) return null;

    const config = selectedProvider.config as any;
    if (!config.apiKey) return null;

    const key = config.apiKey;
    if (key.length > 8) {
      return `${key.substring(0, 3)}...${key.substring(key.length - 4)}`;
    }
    return '***';
  };

  /**
   * Render validation status indicator
   */
  const renderValidationStatus = () => {
    switch (validationStatus) {
      case 'testing':
        return <span style={styles.statusBadge}>⏳ Testing...</span>;
      case 'verified':
        return <span style={{ ...styles.statusBadge, ...styles.statusVerified }}>✓ Verified</span>;
      case 'invalid':
        return <span style={{ ...styles.statusBadge, ...styles.statusInvalid }}>⚠️ Invalid</span>;
      default:
        return null;
    }
  };

  /**
   * Render model selector based on provider type
   */
  const renderModelSelector = () => {
    if (!selectedProvider) return null;

    const modelOptions = MODEL_OPTIONS[selectedProvider.type];
    const currentModel = getCurrentModel();

    // For OpenRouter and Local LLM, use text input
    if (selectedProvider.type === 'openrouter' || selectedProvider.type === 'local') {
      return (
        <div style={styles.field}>
          <label htmlFor="model-input" style={styles.label}>
            Model *
          </label>
          <input
            id="model-input"
            type="text"
            style={styles.input}
            value={currentModel}
            onChange={(e) => handleModelChange(e.target.value)}
            placeholder={
              selectedProvider.type === 'openrouter'
                ? 'e.g., anthropic/claude-3.5-sonnet'
                : 'e.g., llama2, mistral'
            }
            aria-required="true"
          />
        </div>
      );
    }

    // For other providers, use dropdown
    return (
      <div style={styles.field}>
        <label htmlFor="model-select" style={styles.label}>
          Model *
        </label>
        <select
          id="model-select"
          style={styles.select}
          value={currentModel}
          onChange={(e) => handleModelChange(e.target.value)}
          aria-required="true"
        >
          <option value="">Select a model...</option>
          {modelOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Provider Selection */}
      <div style={styles.field}>
        <label htmlFor="provider-select" style={styles.label}>
          LLM Provider *
        </label>
        <select
          id="provider-select"
          style={styles.select}
          value={selectedProvider?.id || ''}
          onChange={(e) => handleProviderChange(e.target.value)}
          aria-required="true"
        >
          <option value="">Select a provider...</option>

          {/* Group providers by type */}
          {Object.entries(providersByType).map(([type, providers]) => (
            <optgroup
              key={type}
              label={`${PROVIDER_TYPE_ICONS[type as LLMProviderConfig['type']]} ${PROVIDER_TYPE_NAMES[type as LLMProviderConfig['type']]}`}
            >
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} {renderValidationStatus()}
                </option>
              ))}
            </optgroup>
          ))}

          {/* Add New Provider option */}
          <option value="__add_new__">+ Add New Provider...</option>
        </select>
      </div>

      {/* Provider Info (shown when provider selected) */}
      {selectedProvider && (
        <div style={styles.providerInfo}>
          <div style={styles.providerInfoRow}>
            <span style={styles.providerInfoLabel}>Type:</span>
            <span style={styles.providerInfoValue}>
              {PROVIDER_TYPE_ICONS[selectedProvider.type]} {PROVIDER_TYPE_NAMES[selectedProvider.type]}
            </span>
          </div>

          {getMaskedApiKey() && (
            <div style={styles.providerInfoRow}>
              <span style={styles.providerInfoLabel}>API Key:</span>
              <span style={styles.providerInfoValue}>{getMaskedApiKey()}</span>
            </div>
          )}

          <div style={styles.providerInfoRow}>
            <span style={styles.providerInfoLabel}>Status:</span>
            <span style={styles.providerInfoValue}>
              {renderValidationStatus()}
              <button
                type="button"
                style={styles.testButton}
                onClick={handleTestConnection}
                disabled={validationStatus === 'testing'}
              >
                Test Connection
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Model Selection */}
      {selectedProvider && renderModelSelector()}

      {/* Advanced Settings */}
      {selectedProvider && (
        <div style={styles.advancedSection}>
          <button
            type="button"
            style={styles.advancedToggle}
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </button>

          {showAdvanced && (
            <div style={styles.advancedContent}>
              {/* Temperature */}
              <div style={styles.field}>
                <label htmlFor="temperature-slider" style={styles.label}>
                  Temperature: {getCurrentTemperature().toFixed(2)}
                </label>
                <input
                  id="temperature-slider"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={getCurrentTemperature()}
                  onChange={(e) => handleAdvancedChange('temperature', parseFloat(e.target.value))}
                  style={styles.slider}
                  aria-valuemin={0}
                  aria-valuemax={2}
                  aria-valuenow={getCurrentTemperature()}
                />
                <div style={styles.sliderLabels}>
                  <span>0.0 (Focused)</span>
                  <span>2.0 (Creative)</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div style={styles.field}>
                <label htmlFor="max-tokens-input" style={styles.label}>
                  Max Tokens
                </label>
                <input
                  id="max-tokens-input"
                  type="number"
                  style={styles.input}
                  value={getCurrentMaxTokens()}
                  onChange={(e) => handleAdvancedChange('maxTokens', parseInt(e.target.value, 10))}
                  min="1"
                  max="100000"
                  placeholder={`Default: ${DEFAULT_MAX_TOKENS[selectedProvider.type]}`}
                />
              </div>

              {/* Top P (only for certain providers) */}
              {(selectedProvider.type === 'openai' ||
                selectedProvider.type === 'openrouter' ||
                selectedProvider.type === 'local') && (
                <div style={styles.field}>
                  <label htmlFor="top-p-slider" style={styles.label}>
                    Top P: {getCurrentTopP().toFixed(2)}
                  </label>
                  <input
                    id="top-p-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={getCurrentTopP()}
                    onChange={(e) => handleAdvancedChange('topP', parseFloat(e.target.value))}
                    style={styles.slider}
                    aria-valuemin={0}
                    aria-valuemax={1}
                    aria-valuenow={getCurrentTopP()}
                  />
                  <div style={styles.sliderLabels}>
                    <span>0.0 (Deterministic)</span>
                    <span>1.0 (Diverse)</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      {!selectedProvider && (
        <div style={styles.helpText}>
          Select an LLM provider to configure model settings. If you don't have a provider configured,
          click "Add New Provider..." to set one up.
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
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
  providerInfo: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  providerInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
  },
  providerInfoLabel: {
    fontWeight: 600,
    color: '#6b7280',
  },
  providerInfoValue: {
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusBadge: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '4px',
    background: '#f3f4f6',
    color: '#6b7280',
  },
  statusVerified: {
    background: '#d1fae5',
    color: '#065f46',
  },
  statusInvalid: {
    background: '#fee2e2',
    color: '#991b1b',
  },
  testButton: {
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6366f1',
    background: 'white',
    border: '1px solid #c7d2fe',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  advancedSection: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '16px',
  },
  advancedToggle: {
    background: 'transparent',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    color: '#6366f1',
    cursor: 'pointer',
    padding: '4px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'color 0.2s',
  },
  advancedContent: {
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '4px',
  },
  helpText: {
    fontSize: '13px',
    color: '#6b7280',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '12px',
    lineHeight: 1.5,
  },
};
