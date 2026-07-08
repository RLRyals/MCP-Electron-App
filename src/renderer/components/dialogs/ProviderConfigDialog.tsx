/**
 * ProviderConfigDialog Component
 *
 * Wizard dialog for adding/editing LLM provider credentials.
 * Multi-step process: Select Type → Enter Credentials → Name Profile → Test → Save
 */

import React, { useState, useEffect } from 'react';
import { LLMProviderConfig } from '../../../types/llm-providers';

export interface ProviderConfigDialogProps {
  onSave: (provider: LLMProviderConfig) => void;
  onCancel: () => void;
  editProvider?: LLMProviderConfig | null;
}

type ProviderType = LLMProviderConfig['type'];

interface TestResult {
  success: boolean;
  message: string;
  models?: string[];
}

/**
 * Provider type information
 */
const PROVIDER_INFO: Record<ProviderType, { name: string; icon: string; description: string }> = {
  'claude-code-cli': {
    name: 'Claude Code CLI',
    icon: '🤖',
    description: 'Use your Claude subscription via headless CLI (no API key needed)',
  },
  'claude-api': {
    name: 'Claude API',
    icon: '🔷',
    description: 'Anthropic API with your own API key for Claude models',
  },
  'openai': {
    name: 'OpenAI',
    icon: '🟢',
    description: 'OpenAI API for GPT-4, GPT-3.5, and other models',
  },
  'google': {
    name: 'Google Gemini',
    icon: '🔵',
    description: 'Google AI API for Gemini models',
  },
  'openrouter': {
    name: 'OpenRouter',
    icon: '🔀',
    description: 'Unified API for accessing multiple LLM providers',
  },
  'local': {
    name: 'Local LLM',
    icon: '💻',
    description: 'Connect to local models via Ollama, LM Studio, or OpenAI-compatible endpoints',
  },
};

export const ProviderConfigDialog: React.FC<ProviderConfigDialogProps> = ({
  onSave,
  onCancel,
  editProvider = null,
}) => {
  // Wizard state
  const [step, setStep] = useState(1);
  const [providerType, setProviderType] = useState<ProviderType | null>(
    editProvider?.type || null
  );

  // Credentials
  const [apiKey, setApiKey] = useState('');
  const [organization, setOrganization] = useState(''); // OpenAI only
  const [endpoint, setEndpoint] = useState('http://localhost:11434'); // Local LLM only
  const [apiFormat, setApiFormat] = useState<'ollama' | 'openai-compatible'>('ollama'); // Local LLM only
  const [showApiKey, setShowApiKey] = useState(false);

  // Profile
  const [profileName, setProfileName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');

  // Testing
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Initialize form when editing
   */
  useEffect(() => {
    if (editProvider) {
      setProviderType(editProvider.type);
      setProfileName(editProvider.name);

      const config = editProvider.config as any;

      if ('apiKey' in config) {
        setApiKey(config.apiKey || '');
      }

      if ('organization' in config) {
        setOrganization(config.organization || '');
      }

      if ('endpoint' in config) {
        setEndpoint(config.endpoint || 'http://localhost:11434');
      }

      if ('apiFormat' in config) {
        setApiFormat(config.apiFormat || 'ollama');
      }

      // Skip to step 3 when editing
      setStep(3);
    }
  }, [editProvider]);

  /**
   * Validate current step
   */
  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!providerType) {
        newErrors.providerType = 'Please select a provider type';
      }
    }

    if (step === 2) {
      // Validate credentials based on provider type
      if (providerType === 'claude-api' || providerType === 'openai' || providerType === 'google' || providerType === 'openrouter') {
        if (!apiKey.trim()) {
          newErrors.apiKey = 'API key is required';
        }
      }

      if (providerType === 'local') {
        if (!endpoint.trim()) {
          newErrors.endpoint = 'Endpoint URL is required';
        } else {
          try {
            new URL(endpoint);
          } catch {
            newErrors.endpoint = 'Invalid URL format';
          }
        }
      }
    }

    if (step === 3) {
      if (!profileName.trim()) {
        newErrors.profileName = 'Profile name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Navigate to next step
   */
  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  /**
   * Navigate to previous step
   */
  const handleBack = () => {
    setStep(Math.max(1, step - 1));
    setErrors({});
  };

  /**
   * Test provider connection
   */
  const handleTestConnection = async () => {
    if (!providerType) return;

    setTesting(true);
    setTestResult(null);

    try {
      // Build provider config
      const provider = buildProviderConfig();

      // Call IPC to test
      const result = await (window.electronAPI as any).invoke('provider:test', provider);

      setTestResult({
        success: result.valid,
        message: result.error || 'Connection successful!',
        models: result.models,
      });

    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  /**
   * Build provider config from form data
   */
  const buildProviderConfig = (): LLMProviderConfig => {
    const baseConfig = {
      id: editProvider?.id,
      name: profileName,
      type: providerType!,
    };

    switch (providerType) {
      case 'claude-code-cli':
        return {
          ...baseConfig,
          type: 'claude-code-cli',
          config: {
            model: 'claude-sonnet-4-5',
            outputFormat: 'json',
          },
        };

      case 'claude-api':
        return {
          ...baseConfig,
          type: 'claude-api',
          config: {
            apiKey,
            model: 'claude-sonnet-4-5',
            maxTokens: 4096,
            temperature: 0.7,
          },
        };

      case 'openai':
        return {
          ...baseConfig,
          type: 'openai',
          config: {
            apiKey,
            model: 'gpt-4-turbo',
            maxTokens: 4096,
            temperature: 0.7,
            ...(organization && { organization }),
          },
        } as any;

      case 'google':
        return {
          ...baseConfig,
          type: 'google',
          config: {
            apiKey,
            model: 'gemini-1.5-pro',
            maxTokens: 8192,
            temperature: 0.7,
          },
        };

      case 'openrouter':
        return {
          ...baseConfig,
          type: 'openrouter',
          config: {
            apiKey,
            model: 'anthropic/claude-3.5-sonnet',
            maxTokens: 4096,
            temperature: 0.7,
          },
        };

      case 'local':
        return {
          ...baseConfig,
          type: 'local',
          config: {
            endpoint,
            model: 'llama2',
            apiFormat,
            maxTokens: 2048,
            temperature: 0.7,
          },
        };

      default:
        throw new Error('Invalid provider type');
    }
  };

  /**
   * Save provider
   */
  const handleSave = async () => {
    if (!validateStep()) return;

    try {
      const provider = buildProviderConfig();

      // Call IPC to save
      const providerId = await (window.electronAPI as any).invoke('provider:add', provider);

      // Update provider with ID
      provider.id = providerId;

      onSave(provider);
    } catch (error: any) {
      setErrors({ save: error.message || 'Failed to save provider' });
    }
  };

  /**
   * Save without testing
   */
  const handleSaveWithoutTest = () => {
    setStep(5);
  };

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      if (step < 4) {
        handleNext();
      } else if (step === 4 && testResult?.success) {
        handleSave();
      }
    }
  };

  /**
   * Render step 1: Select Provider Type
   */
  const renderStep1 = () => (
    <div style={styles.stepContent}>
      <h3 style={styles.stepTitle}>Select Provider Type</h3>
      <p style={styles.stepDescription}>Choose the LLM provider you want to configure</p>

      <div style={styles.providerGrid}>
        {(Object.keys(PROVIDER_INFO) as ProviderType[]).map(type => (
          <label
            key={type}
            style={{
              ...styles.providerCard,
              ...(providerType === type ? styles.providerCardSelected : {}),
            }}
          >
            <input
              type="radio"
              name="providerType"
              value={type}
              checked={providerType === type}
              onChange={() => setProviderType(type)}
              style={styles.radioHidden}
            />
            <div style={styles.providerIcon}>{PROVIDER_INFO[type].icon}</div>
            <div style={styles.providerName}>{PROVIDER_INFO[type].name}</div>
            <div style={styles.providerDescription}>{PROVIDER_INFO[type].description}</div>
          </label>
        ))}
      </div>

      {errors.providerType && <div style={styles.errorText}>{errors.providerType}</div>}
    </div>
  );

  /**
   * Render step 2: Enter Credentials
   */
  const renderStep2 = () => {
    if (!providerType) return null;

    return (
      <div style={styles.stepContent}>
        <h3 style={styles.stepTitle}>Enter Credentials</h3>
        <p style={styles.stepDescription}>
          Configure {PROVIDER_INFO[providerType].name} connection details
        </p>

        {/* Claude Code CLI - No credentials needed */}
        {providerType === 'claude-code-cli' && (
          <div style={styles.infoBox}>
            <div style={styles.infoIcon}>ℹ️</div>
            <div>
              <strong>No API key required</strong>
              <p style={styles.infoText}>
                Claude Code CLI uses your existing Claude subscription. Make sure Claude Code is
                installed and you're logged in.
              </p>
            </div>
          </div>
        )}

        {/* API Key providers */}
        {(providerType === 'claude-api' ||
          providerType === 'openai' ||
          providerType === 'google' ||
          providerType === 'openrouter') && (
          <>
            <div style={styles.field}>
              <label htmlFor="api-key-input" style={styles.label}>
                API Key *
              </label>
              <div style={styles.passwordField}>
                <input
                  id="api-key-input"
                  type={showApiKey ? 'text' : 'password'}
                  style={errors.apiKey ? { ...styles.inputFlex, ...styles.inputError } : styles.inputFlex}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  autoFocus
                  aria-required="true"
                />
                <button
                  type="button"
                  style={styles.toggleButton}
                  onClick={() => setShowApiKey(!showApiKey)}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.apiKey && <div style={styles.errorText}>{errors.apiKey}</div>}
            </div>

            {/* OpenAI Organization (optional) */}
            {providerType === 'openai' && (
              <div style={styles.field}>
                <label htmlFor="organization-input" style={styles.label}>
                  Organization ID (Optional)
                </label>
                <input
                  id="organization-input"
                  type="text"
                  style={styles.input}
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="org-..."
                />
              </div>
            )}

            <div style={styles.warningBox}>
              <div style={styles.warningIcon}>⚠️</div>
              <div>
                <strong>Security Notice</strong>
                <p style={styles.warningText}>
                  Your API key will be encrypted and stored securely on your device. It will never be
                  transmitted to any third parties.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Local LLM - Endpoint configuration */}
        {providerType === 'local' && (
          <>
            <div style={styles.field}>
              <label htmlFor="endpoint-input" style={styles.label}>
                Endpoint URL *
              </label>
              <input
                id="endpoint-input"
                type="text"
                style={errors.endpoint ? { ...styles.input, ...styles.inputError } : styles.input}
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                autoFocus
                aria-required="true"
              />
              {errors.endpoint && <div style={styles.errorText}>{errors.endpoint}</div>}
            </div>

            <div style={styles.field}>
              <label htmlFor="api-format-select" style={styles.label}>
                API Format *
              </label>
              <select
                id="api-format-select"
                style={styles.select}
                value={apiFormat}
                onChange={(e) => setApiFormat(e.target.value as 'ollama' | 'openai-compatible')}
                aria-required="true"
              >
                <option value="ollama">Ollama</option>
                <option value="openai-compatible">OpenAI Compatible</option>
              </select>
            </div>
          </>
        )}
      </div>
    );
  };

  /**
   * Render step 3: Name Profile
   */
  const renderStep3 = () => (
    <div style={styles.stepContent}>
      <h3 style={styles.stepTitle}>Name Your Profile</h3>
      <p style={styles.stepDescription}>Give this provider configuration a memorable name</p>

      <div style={styles.field}>
        <label htmlFor="profile-name-input" style={styles.label}>
          Profile Name *
        </label>
        <input
          id="profile-name-input"
          type="text"
          style={errors.profileName ? { ...styles.input, ...styles.inputError } : styles.input}
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          placeholder="e.g., My Claude API Key, Work OpenAI"
          autoFocus
          aria-required="true"
        />
        {errors.profileName && <div style={styles.errorText}>{errors.profileName}</div>}
      </div>

      <div style={styles.field}>
        <label htmlFor="profile-description-input" style={styles.label}>
          Description (Optional)
        </label>
        <textarea
          id="profile-description-input"
          style={styles.textarea}
          value={profileDescription}
          onChange={(e) => setProfileDescription(e.target.value)}
          placeholder="Add notes about this provider configuration..."
          rows={3}
        />
      </div>
    </div>
  );

  /**
   * Render step 4: Test Connection
   */
  const renderStep4 = () => (
    <div style={styles.stepContent}>
      <h3 style={styles.stepTitle}>Test Connection</h3>
      <p style={styles.stepDescription}>Verify that your credentials work correctly</p>

      <div style={styles.testSection}>
        <button
          type="button"
          style={testing ? { ...styles.testButton, ...styles.testButtonDisabled } : styles.testButton}
          onClick={handleTestConnection}
          disabled={testing}
        >
          {testing ? '⏳ Testing Connection...' : '🔍 Test Connection'}
        </button>

        {testResult && (
          <div
            style={
              testResult.success
                ? { ...styles.resultBox, ...styles.resultSuccess }
                : { ...styles.resultBox, ...styles.resultError }
            }
          >
            <div style={styles.resultIcon}>{testResult.success ? '✓' : '✗'}</div>
            <div>
              <div style={styles.resultMessage}>{testResult.message}</div>
              {testResult.models && testResult.models.length > 0 && (
                <div style={styles.modelsDetected}>
                  <strong>Available models:</strong> {testResult.models.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={styles.skipSection}>
        <button type="button" style={styles.skipButton} onClick={handleSaveWithoutTest}>
          Skip and Save Without Testing
        </button>
        <p style={styles.skipWarning}>
          ⚠️ Not recommended. Your configuration may not work correctly.
        </p>
      </div>
    </div>
  );

  /**
   * Render step 5: Save
   */
  const renderStep5 = () => (
    <div style={styles.stepContent}>
      <h3 style={styles.stepTitle}>Ready to Save</h3>
      <p style={styles.stepDescription}>Review your configuration and save</p>

      <div style={styles.summaryBox}>
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>Provider Type:</span>
          <span style={styles.summaryValue}>
            {providerType && `${PROVIDER_INFO[providerType].icon} ${PROVIDER_INFO[providerType].name}`}
          </span>
        </div>
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>Profile Name:</span>
          <span style={styles.summaryValue}>{profileName}</span>
        </div>
        {testResult && (
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>Test Status:</span>
            <span style={styles.summaryValue}>
              {testResult.success ? '✓ Verified' : '✗ Failed'}
            </span>
          </div>
        )}
      </div>

      {errors.save && <div style={styles.errorText}>{errors.save}</div>}
    </div>
  );

  /**
   * Render step indicator
   */
  const renderStepIndicator = () => {
    const steps = ['Type', 'Credentials', 'Name', 'Test', 'Save'];
    const currentStepIndex = step - 1;

    return (
      <div style={styles.stepIndicator}>
        {steps.map((stepName, index) => (
          <div
            key={stepName}
            style={{
              ...styles.stepDot,
              ...(index === currentStepIndex ? styles.stepDotActive : {}),
              ...(index < currentStepIndex ? styles.stepDotCompleted : {}),
            }}
            aria-current={index === currentStepIndex ? 'step' : undefined}
          >
            {index < currentStepIndex ? '✓' : index + 1}
          </div>
        ))}
      </div>
    );
  };

  /**
   * Render current step
   */
  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {editProvider ? 'Edit Provider' : 'Add LLM Provider'}
          </h2>
          <button
            style={styles.closeButton}
            onClick={onCancel}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {renderStepIndicator()}

        <div style={styles.content}>{renderCurrentStep()}</div>

        <div style={styles.footer}>
          {step > 1 && step < 5 && (
            <button style={styles.backButton} onClick={handleBack}>
              ← Back
            </button>
          )}
          <div style={styles.footerSpacer} />
          <button style={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          {step < 4 && (
            <button style={styles.nextButton} onClick={handleNext}>
              Continue →
            </button>
          )}
          {step === 4 && testResult?.success && (
            <button style={styles.saveButton} onClick={handleSave}>
              Save Provider
            </button>
          )}
          {step === 5 && (
            <button style={styles.saveButton} onClick={handleSave}>
              Save Provider
            </button>
          )}
        </div>

        <div style={styles.hint}>
          Press <kbd style={styles.kbd}>Enter</kbd> to continue, <kbd style={styles.kbd}>Esc</kbd> to cancel
        </div>
      </div>
    </div>
  );
};

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
    maxWidth: '700px',
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
  stepIndicator: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 24px',
    borderBottom: '1px solid #e5e7eb',
  },
  stepDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#f3f4f6',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  stepDotActive: {
    background: '#3b82f6',
    color: 'white',
  },
  stepDotCompleted: {
    background: '#10b981',
    color: 'white',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  stepTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
  },
  stepDescription: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
  },
  providerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  providerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'white',
  },
  providerCardSelected: {
    borderColor: '#3b82f6',
    background: '#eff6ff',
  },
  radioHidden: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
  },
  providerIcon: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  providerName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '4px',
    textAlign: 'center',
  },
  providerDescription: {
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 1.4,
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
  inputFlex: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  passwordField: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  toggleButton: {
    padding: '10px 12px',
    fontSize: '16px',
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
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
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  infoBox: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
  },
  infoIcon: {
    fontSize: '24px',
  },
  infoText: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#1e40af',
    lineHeight: 1.5,
  },
  warningBox: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    background: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: '6px',
  },
  warningIcon: {
    fontSize: '24px',
  },
  warningText: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#92400e',
    lineHeight: 1.5,
  },
  testSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  testButton: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  testButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  resultBox: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    borderRadius: '6px',
  },
  resultSuccess: {
    background: '#d1fae5',
    border: '1px solid #6ee7b7',
  },
  resultError: {
    background: '#fee2e2',
    border: '1px solid #fca5a5',
  },
  resultIcon: {
    fontSize: '24px',
  },
  resultMessage: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  modelsDetected: {
    fontSize: '12px',
    color: '#374151',
  },
  skipSection: {
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center',
  },
  skipButton: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6b7280',
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  skipWarning: {
    margin: '8px 0 0 0',
    fontSize: '12px',
    color: '#dc2626',
  },
  summaryBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
  },
  summaryLabel: {
    fontWeight: 600,
    color: '#6b7280',
  },
  summaryValue: {
    color: '#1f2937',
  },
  errorText: {
    fontSize: '12px',
    color: '#ef4444',
  },
  footer: {
    display: 'flex',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #e5e7eb',
  },
  footerSpacer: {
    flex: 1,
  },
  backButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#6b7280',
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
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
  nextButton: {
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
  saveButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    background: '#10b981',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  hint: {
    padding: '12px 24px',
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'center',
    borderTop: '1px solid #e5e7eb',
  },
  kbd: {
    padding: '2px 6px',
    fontSize: '11px',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '3px',
    fontFamily: 'monospace',
  },
};
