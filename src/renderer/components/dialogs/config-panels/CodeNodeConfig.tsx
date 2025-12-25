/**
 * CodeNodeConfig Component
 * Configuration panel for Code Execution workflow nodes
 *
 * Features:
 * - Language selector (JavaScript, Python)
 * - Code editor with monospace font
 * - Sandbox settings (enabled, allowed modules, memory limit, CPU timeout)
 * - Security configuration
 * - Full accessibility support
 */

import React, { useState } from 'react';
import { CodeExecutionNode } from '../../../../types/workflow-nodes';

export interface CodeNodeConfigProps {
  node: CodeExecutionNode;
  onChange: (updates: Partial<CodeExecutionNode>) => void;
  errors: Record<string, string>;
}

export const CodeNodeConfig: React.FC<CodeNodeConfigProps> = ({
  node,
  onChange,
  errors,
}) => {
  const [newModule, setNewModule] = useState('');

  const handleChange = (field: keyof CodeExecutionNode, value: any) => {
    onChange({ [field]: value });
  };

  const handleSandboxChange = (field: string, value: any) => {
    onChange({
      sandbox: {
        ...node.sandbox,
        [field]: value === '' ? undefined : value,
      },
    });
  };

  const addModule = () => {
    if (!newModule.trim()) return;

    const currentModules = node.sandbox.allowedModules || [];
    if (currentModules.includes(newModule.trim())) {
      setNewModule('');
      return;
    }

    handleSandboxChange('allowedModules', [...currentModules, newModule.trim()]);
    setNewModule('');
  };

  const removeModule = (moduleName: string) => {
    const currentModules = node.sandbox.allowedModules || [];
    handleSandboxChange(
      'allowedModules',
      currentModules.filter((m) => m !== moduleName)
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addModule();
    }
  };

  return (
    <div style={styles.container}>
      {/* Language Selection */}
      <div style={styles.field}>
        <label htmlFor="language-select" style={styles.label}>
          Language *
        </label>
        <select
          id="language-select"
          style={styles.select}
          value={node.language}
          onChange={(e) => handleChange('language', e.target.value as CodeExecutionNode['language'])}
          aria-describedby="language-help"
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
        </select>
        <div id="language-help" style={styles.helperTextBlock}>
          The programming language for code execution
        </div>
      </div>

      {/* Code Editor */}
      <div style={styles.field}>
        <label htmlFor="code-editor" style={styles.label}>
          Code *
          <span style={styles.helperText}> (Your executable code)</span>
        </label>
        <textarea
          id="code-editor"
          style={errors.code ? { ...styles.codeEditor, ...styles.inputError } : styles.codeEditor}
          value={node.code}
          onChange={(e) => handleChange('code', e.target.value)}
          placeholder={
            node.language === 'javascript'
              ? '// JavaScript code\nfunction process(input) {\n  // Your code here\n  return result;\n}'
              : '# Python code\ndef process(input):\n    # Your code here\n    return result'
          }
          rows={15}
          spellCheck={false}
          aria-required="true"
          aria-invalid={!!errors.code}
          aria-describedby={errors.code ? 'code-error' : 'code-help'}
        />
        {errors.code && (
          <div id="code-error" style={styles.errorText} role="alert">
            {errors.code}
          </div>
        )}
        <div id="code-help" style={styles.helperTextBlock}>
          The code to execute during workflow execution
        </div>
      </div>

      {/* Sandbox Settings */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Sandbox Settings</h3>

        {/* Sandbox Enabled */}
        <div style={styles.field}>
          <label style={styles.checkboxLabel}>
            <input
              id="sandbox-enabled"
              type="checkbox"
              checked={node.sandbox.enabled}
              onChange={(e) => handleSandboxChange('enabled', e.target.checked)}
              style={styles.checkbox}
            />
            <span>Enable Sandbox (Recommended)</span>
          </label>
          <div style={styles.helperTextBlock}>
            Run code in a restricted environment for security
          </div>
        </div>

        {node.sandbox.enabled && (
          <>
            {/* Allowed Modules */}
            <div style={styles.field}>
              <label htmlFor="allowed-modules" style={styles.label}>
                Allowed Modules
                <span style={styles.helperText}> (Whitelist for require/import)</span>
              </label>

              {/* Module Chips */}
              {node.sandbox.allowedModules && node.sandbox.allowedModules.length > 0 && (
                <div style={styles.chipContainer}>
                  {node.sandbox.allowedModules.map((moduleName, index) => (
                    <div key={index} style={styles.chip}>
                      <span style={styles.chipLabel}>{moduleName}</span>
                      <button
                        type="button"
                        style={styles.chipRemove}
                        onClick={() => removeModule(moduleName)}
                        aria-label={`Remove module ${moduleName}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Module Input */}
              <div style={styles.inputWithButton}>
                <input
                  id="allowed-modules"
                  type="text"
                  style={styles.inputFlex}
                  value={newModule}
                  onChange={(e) => setNewModule(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., fs, lodash, axios"
                  aria-describedby="allowed-modules-help"
                />
                <button
                  type="button"
                  style={styles.addButton}
                  onClick={addModule}
                  disabled={!newModule.trim()}
                  aria-label="Add module"
                >
                  Add
                </button>
              </div>
              <div id="allowed-modules-help" style={styles.helperTextBlock}>
                Modules that can be imported/required in the code. Press Enter or click Add.
              </div>
            </div>

            {/* Memory Limit */}
            <div style={styles.field}>
              <label htmlFor="memory-limit" style={styles.label}>
                Memory Limit (MB)
              </label>
              <input
                id="memory-limit"
                type="number"
                style={styles.input}
                value={node.sandbox.memoryLimitMb ?? ''}
                onChange={(e) => handleSandboxChange('memoryLimitMb', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g., 128"
                min="1"
                max="2048"
                aria-describedby="memory-limit-help"
              />
              <div id="memory-limit-help" style={styles.helperTextBlock}>
                Maximum memory allocation in megabytes (default: no limit)
              </div>
            </div>

            {/* CPU Timeout */}
            <div style={styles.field}>
              <label htmlFor="cpu-timeout" style={styles.label}>
                CPU Timeout (ms)
              </label>
              <input
                id="cpu-timeout"
                type="number"
                style={styles.input}
                value={node.sandbox.cpuTimeoutMs ?? ''}
                onChange={(e) => handleSandboxChange('cpuTimeoutMs', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g., 5000"
                min="100"
                max="300000"
                aria-describedby="cpu-timeout-help"
              />
              <div id="cpu-timeout-help" style={styles.helperTextBlock}>
                Maximum execution time in milliseconds (default: no limit)
              </div>
            </div>
          </>
        )}
      </div>

      {/* Execution Settings */}
      <div style={styles.field}>
        <label style={styles.checkboxLabel}>
          <input
            id="requires-approval"
            type="checkbox"
            checked={node.requiresApproval}
            onChange={(e) => handleChange('requiresApproval', e.target.checked)}
            style={styles.checkbox}
          />
          <span>Requires User Approval</span>
        </label>
        <div style={styles.helperTextBlock}>
          Pause execution for manual review before running code
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#374151',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  },
  helperText: {
    fontWeight: 400,
    fontSize: '13px',
    color: '#6b7280',
  },
  helperTextBlock: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  inputWithButton: {
    display: 'flex',
    gap: '8px',
    alignItems: 'stretch',
  },
  inputFlex: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: 'white',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  codeEditor: {
    width: '100%',
    padding: '12px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    resize: 'vertical',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: '1.5',
    boxSizing: 'border-box',
    background: '#f9fafb',
  },
  inputError: {
    borderColor: '#ef4444',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
  },
  errorText: {
    fontSize: '12px',
    color: '#ef4444',
    fontWeight: 500,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '8px',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    background: '#e0e7ff',
    border: '1px solid #c7d2fe',
    borderRadius: '16px',
    fontSize: '13px',
    color: '#4338ca',
  },
  chipLabel: {
    fontWeight: 500,
  },
  chipRemove: {
    background: 'transparent',
    border: 'none',
    color: '#4338ca',
    fontSize: '18px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: 0,
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'white',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
};
