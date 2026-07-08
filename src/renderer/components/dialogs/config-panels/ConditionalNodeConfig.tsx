/**
 * ConditionalNodeConfig Component
 * Configuration panel for Conditional workflow nodes
 *
 * Features:
 * - Condition type selector (JSONPath, JavaScript)
 * - Condition expression input
 * - Helper text and syntax examples
 * - Test condition button (syntax validation)
 * - Full accessibility support
 */

import React, { useState } from 'react';
import { ConditionalNode } from '../../../../types/workflow-nodes';

export interface ConditionalNodeConfigProps {
  node: ConditionalNode;
  onChange: (updates: Partial<ConditionalNode>) => void;
  errors: Record<string, string>;
}

export const ConditionalNodeConfig: React.FC<ConditionalNodeConfigProps> = ({
  node,
  onChange,
  errors,
}) => {
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  const handleChange = (field: keyof ConditionalNode, value: any) => {
    onChange({ [field]: value });
    // Clear test result when condition changes
    if (field === 'condition' || field === 'conditionType') {
      setTestResult(null);
    }
  };

  const handleTestCondition = () => {
    if (!node.condition.trim()) {
      setTestResult({
        valid: false,
        message: 'Please enter a condition expression',
      });
      return;
    }

    try {
      if (node.conditionType === 'javascript') {
        // Basic JavaScript syntax validation
        new Function(`return ${node.condition}`);
        setTestResult({
          valid: true,
          message: 'JavaScript syntax is valid',
        });
      } else {
        // Basic JSONPath validation (check for common patterns)
        if (!node.condition.startsWith('$')) {
          setTestResult({
            valid: false,
            message: 'JSONPath expressions should start with $',
          });
          return;
        }
        setTestResult({
          valid: true,
          message: 'JSONPath syntax appears valid',
        });
      }
    } catch (error) {
      setTestResult({
        valid: false,
        message: `Syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const jsonPathExamples = [
    { expr: '$.score >= 70', desc: 'Check if score is at least 70' },
    { expr: '$.status === "approved"', desc: 'Check if status equals "approved"' },
    { expr: '$.items.length > 0', desc: 'Check if items array is not empty' },
    { expr: '$.user.role === "admin"', desc: 'Check if user is admin' },
  ];

  const javascriptExamples = [
    { expr: 'context.score >= 70 && context.grade === "A"', desc: 'Multiple conditions with AND' },
    { expr: 'context.items.some(item => item.status === "pending")', desc: 'Check if any item is pending' },
    { expr: 'context.total > 100 || context.priority === "high"', desc: 'Multiple conditions with OR' },
    { expr: '!context.errors || context.errors.length === 0', desc: 'Check if no errors exist' },
  ];

  const examples = node.conditionType === 'jsonpath' ? jsonPathExamples : javascriptExamples;

  return (
    <div style={styles.container}>
      {/* Condition Type */}
      <div style={styles.field}>
        <label htmlFor="condition-type" style={styles.label}>
          Condition Type *
        </label>
        <select
          id="condition-type"
          style={styles.select}
          value={node.conditionType}
          onChange={(e) => handleChange('conditionType', e.target.value as ConditionalNode['conditionType'])}
          aria-describedby="condition-type-help"
        >
          <option value="jsonpath">JSONPath</option>
          <option value="javascript">JavaScript</option>
        </select>
        <div id="condition-type-help" style={styles.helperTextBlock}>
          The expression language for the condition
        </div>
      </div>

      {/* Condition Expression */}
      <div style={styles.field}>
        <label htmlFor="condition-input" style={styles.label}>
          Condition Expression *
          <span style={styles.helperText}> (Must evaluate to true/false)</span>
        </label>
        <textarea
          id="condition-input"
          style={errors.condition ? { ...styles.textarea, ...styles.inputError } : styles.textarea}
          value={node.condition}
          onChange={(e) => handleChange('condition', e.target.value)}
          placeholder={
            node.conditionType === 'jsonpath'
              ? 'e.g., $.score >= 70'
              : 'e.g., context.score >= 70 && context.grade === "A"'
          }
          rows={4}
          spellCheck={false}
          aria-required="true"
          aria-invalid={!!errors.condition}
          aria-describedby={errors.condition ? 'condition-error' : 'condition-help'}
        />
        {errors.condition && (
          <div id="condition-error" style={styles.errorText} role="alert">
            {errors.condition}
          </div>
        )}
        <div id="condition-help" style={styles.helperTextBlock}>
          {node.conditionType === 'jsonpath'
            ? 'JSONPath expression to evaluate against workflow context. Must return a boolean.'
            : 'JavaScript expression with access to the "context" variable. Must return a boolean.'}
        </div>
      </div>

      {/* Test Condition Button */}
      <div style={styles.field}>
        <button
          type="button"
          style={styles.testButton}
          onClick={handleTestCondition}
          aria-label="Test condition syntax"
        >
          Test Condition Syntax
        </button>
        {testResult && (
          <div
            style={testResult.valid ? styles.testResultSuccess : styles.testResultError}
            role="status"
            aria-live="polite"
          >
            <span style={styles.testResultIcon}>{testResult.valid ? '✓' : '✗'}</span>
            {testResult.message}
          </div>
        )}
      </div>

      {/* Syntax Guide */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          {node.conditionType === 'jsonpath' ? 'JSONPath Syntax' : 'JavaScript Syntax'}
        </h3>

        <div style={styles.syntaxGuide}>
          {node.conditionType === 'jsonpath' ? (
            <>
              <p style={styles.syntaxText}>
                JSONPath allows you to query and evaluate values from the workflow context:
              </p>
              <ul style={styles.syntaxList}>
                <li><code>$</code> - Root context object</li>
                <li><code>$.field</code> - Access a field</li>
                <li><code>$.nested.field</code> - Access nested fields</li>
                <li><code>$.array[0]</code> - Access array element</li>
                <li><code>$.array.length</code> - Get array length</li>
              </ul>
              <p style={styles.syntaxText}>
                <strong>Comparison operators:</strong> <code>===</code>, <code>!==</code>, <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code>
              </p>
              <p style={styles.syntaxText}>
                <strong>Logical operators:</strong> <code>&amp;&amp;</code> (and), <code>||</code> (or), <code>!</code> (not)
              </p>
            </>
          ) : (
            <>
              <p style={styles.syntaxText}>
                JavaScript expressions have access to the <code>context</code> variable containing all workflow data:
              </p>
              <ul style={styles.syntaxList}>
                <li><code>context</code> - The workflow context object</li>
                <li><code>context.field</code> - Access a field</li>
                <li><code>context.array.length</code> - Access array properties</li>
                <li><code>context.array.some(...)</code> - Use array methods</li>
              </ul>
              <p style={styles.syntaxText}>
                You can use standard JavaScript operators and methods. The expression must return a boolean value.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Examples */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Example Expressions</h3>

        <div style={styles.examplesList}>
          {examples.map((example, index) => (
            <div key={index} style={styles.exampleItem}>
              <code style={styles.exampleCode}>{example.expr}</code>
              <div style={styles.exampleDesc}>{example.desc}</div>
              <button
                type="button"
                style={styles.useExampleButton}
                onClick={() => handleChange('condition', example.expr)}
                aria-label={`Use example: ${example.expr}`}
              >
                Use This
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Branch Information */}
      <div style={styles.infoBox}>
        <span style={styles.infoIcon}>ℹ</span>
        <div style={styles.infoContent}>
          <strong>About Branches:</strong> Connect edges from this node labeled "true" and "false"
          to define what happens when the condition passes or fails.
        </div>
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
          Pause execution for manual review before evaluating the condition
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
  textarea: {
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
  testButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#6366f1',
    background: 'white',
    border: '1px solid #c7d2fe',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    alignSelf: 'flex-start',
  },
  testResultSuccess: {
    padding: '10px 12px',
    background: '#d1fae5',
    border: '1px solid #6ee7b7',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#065f46',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  testResultError: {
    padding: '10px 12px',
    background: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#991b1b',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  testResultIcon: {
    fontSize: '16px',
    fontWeight: 'bold',
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
  syntaxGuide: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: '1.6',
  },
  syntaxText: {
    margin: '8px 0',
  },
  syntaxList: {
    margin: '8px 0',
    paddingLeft: '24px',
  },
  examplesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  exampleItem: {
    padding: '12px',
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  exampleCode: {
    fontSize: '13px',
    fontFamily: 'monospace',
    color: '#1f2937',
    background: '#f3f4f6',
    padding: '4px 8px',
    borderRadius: '4px',
    display: 'block',
  },
  exampleDesc: {
    fontSize: '12px',
    color: '#6b7280',
  },
  useExampleButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#3b82f6',
    background: 'transparent',
    border: '1px solid #93c5fd',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    alignSelf: 'flex-start',
  },
  infoBox: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: '#dbeafe',
    border: '1px solid #93c5fd',
    borderRadius: '6px',
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: '20px',
    flexShrink: 0,
  },
  infoContent: {
    fontSize: '13px',
    color: '#1e3a8a',
    lineHeight: '1.5',
  },
};
