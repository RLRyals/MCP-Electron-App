/**
 * HttpNodeConfig Component
 * Configuration panel for HTTP Request workflow nodes
 *
 * Features:
 * - Method selector (GET, POST, PUT, PATCH, DELETE)
 * - URL input with variable substitution support
 * - Headers builder (key-value pairs)
 * - Body editor (for POST/PUT/PATCH)
 * - Authentication configuration
 * - Response type selector
 * - Full accessibility support
 */

import React, { useState } from 'react';
import { HttpRequestNode } from '../../../../types/workflow-nodes';

export interface HttpNodeConfigProps {
  node: HttpRequestNode;
  onChange: (updates: Partial<HttpRequestNode>) => void;
  errors: Record<string, string>;
}

export const HttpNodeConfig: React.FC<HttpNodeConfigProps> = ({
  node,
  onChange,
  errors,
}) => {
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');

  const handleChange = (field: keyof HttpRequestNode, value: any) => {
    onChange({ [field]: value });
  };

  const handleAuthChange = (field: string, value: any) => {
    onChange({
      auth: {
        type: (node.auth?.type as any) || 'none',
        config: {
          ...(node.auth?.config || {}),
          [field]: value,
        },
      },
    });
  };

  const handleAuthTypeChange = (type: any) => {
    onChange({
      auth: {
        type,
        config: {},
      },
    });
  };

  const addHeader = () => {
    if (!newHeaderKey.trim() || !newHeaderValue.trim()) return;

    const currentHeaders = node.headers || {};
    onChange({
      headers: {
        ...currentHeaders,
        [newHeaderKey.trim()]: newHeaderValue.trim(),
      },
    });
    setNewHeaderKey('');
    setNewHeaderValue('');
  };

  const removeHeader = (key: string) => {
    const currentHeaders = node.headers || {};
    const { [key]: removed, ...remaining } = currentHeaders;
    onChange({ headers: remaining });
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addHeader();
    }
  };

  const methodsWithBody = ['POST', 'PUT', 'PATCH'];
  const showBodyEditor = methodsWithBody.includes(node.method);

  return (
    <div style={styles.container}>
      {/* HTTP Method */}
      <div style={styles.field}>
        <label htmlFor="http-method" style={styles.label}>
          HTTP Method *
        </label>
        <select
          id="http-method"
          style={styles.select}
          value={node.method}
          onChange={(e) => handleChange('method', e.target.value as HttpRequestNode['method'])}
          aria-describedby="http-method-help"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
        <div id="http-method-help" style={styles.helperTextBlock}>
          The HTTP method for the request
        </div>
      </div>

      {/* URL */}
      <div style={styles.field}>
        <label htmlFor="http-url" style={styles.label}>
          URL *
          <span style={styles.helperText}> (Supports {'{{variables}}'} substitution)</span>
        </label>
        <input
          id="http-url"
          type="text"
          style={errors.url ? { ...styles.input, ...styles.inputError } : styles.input}
          value={node.url}
          onChange={(e) => handleChange('url', e.target.value)}
          placeholder="e.g., https://api.example.com/books/{{bookId}}"
          aria-required="true"
          aria-invalid={!!errors.url}
          aria-describedby={errors.url ? 'url-error' : 'url-help'}
        />
        {errors.url && (
          <div id="url-error" style={styles.errorText} role="alert">
            {errors.url}
          </div>
        )}
        <div id="url-help" style={styles.helperTextBlock}>
          The endpoint URL. Use {'{{variableName}}'} for dynamic values.
        </div>
      </div>

      {/* Headers Builder */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Headers</h3>

        {/* Existing Headers */}
        {node.headers && Object.keys(node.headers).length > 0 && (
          <div style={styles.headersList}>
            {Object.entries(node.headers).map(([key, value]) => (
              <div key={key} style={styles.headerItem}>
                <div style={styles.headerContent}>
                  <span style={styles.headerKey}>{key}:</span>
                  <span style={styles.headerValue}>{value}</span>
                </div>
                <button
                  type="button"
                  style={styles.removeButton}
                  onClick={() => removeHeader(key)}
                  aria-label={`Remove header ${key}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Header */}
        <div style={styles.field}>
          <label htmlFor="header-key" style={styles.label}>
            Add Header
          </label>
          <div style={styles.headerInputs}>
            <input
              id="header-key"
              type="text"
              style={{ ...styles.input, flex: 1 }}
              value={newHeaderKey}
              onChange={(e) => setNewHeaderKey(e.target.value)}
              onKeyDown={handleHeaderKeyDown}
              placeholder="Header name (e.g., Content-Type)"
              aria-label="Header key"
            />
            <input
              id="header-value"
              type="text"
              style={{ ...styles.input, flex: 1 }}
              value={newHeaderValue}
              onChange={(e) => setNewHeaderValue(e.target.value)}
              onKeyDown={handleHeaderKeyDown}
              placeholder="Header value (e.g., application/json)"
              aria-label="Header value"
            />
            <button
              type="button"
              style={styles.addButton}
              onClick={addHeader}
              disabled={!newHeaderKey.trim() || !newHeaderValue.trim()}
              aria-label="Add header"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Request Body (for POST/PUT/PATCH) */}
      {showBodyEditor && (
        <div style={styles.field}>
          <label htmlFor="http-body" style={styles.label}>
            Request Body
            <span style={styles.helperText}> (JSON or text)</span>
          </label>
          <textarea
            id="http-body"
            style={styles.codeEditor}
            value={typeof node.body === 'string' ? node.body : JSON.stringify(node.body, null, 2)}
            onChange={(e) => handleChange('body', e.target.value)}
            placeholder='{\n  "title": "{{bookTitle}}",\n  "author": "{{authorName}}"\n}'
            rows={10}
            spellCheck={false}
            aria-describedby="http-body-help"
          />
          <div id="http-body-help" style={styles.helperTextBlock}>
            The request body. Use {'{{variables}}'} for dynamic values.
          </div>
        </div>
      )}

      {/* Response Type */}
      <div style={styles.field}>
        <label htmlFor="response-type" style={styles.label}>
          Response Type
        </label>
        <select
          id="response-type"
          style={styles.select}
          value={node.responseType}
          onChange={(e) => handleChange('responseType', e.target.value as HttpRequestNode['responseType'])}
          aria-describedby="response-type-help"
        >
          <option value="json">JSON</option>
          <option value="text">Text</option>
          <option value="buffer">Buffer (binary)</option>
        </select>
        <div id="response-type-help" style={styles.helperTextBlock}>
          How to parse the response data
        </div>
      </div>

      {/* Authentication */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Authentication</h3>

        <div style={styles.field}>
          <label htmlFor="auth-type" style={styles.label}>
            Authentication Type
          </label>
          <select
            id="auth-type"
            style={styles.select}
            value={(node.auth?.type as string) || 'none'}
            onChange={(e) => handleAuthTypeChange(e.target.value as any)}
            aria-describedby="auth-type-help"
          >
            <option value="none">None</option>
            <option value="basic">Basic Auth</option>
            <option value="bearer">Bearer Token</option>
            <option value="api-key">API Key</option>
          </select>
          <div id="auth-type-help" style={styles.helperTextBlock}>
            The authentication method for this request
          </div>
        </div>

        {/* Basic Auth */}
        {node.auth?.type === 'basic' && (
          <>
            <div style={styles.field}>
              <label htmlFor="auth-username" style={styles.label}>
                Username
              </label>
              <input
                id="auth-username"
                type="text"
                style={styles.input}
                value={node.auth.config.username || ''}
                onChange={(e) => handleAuthChange('username', e.target.value)}
                placeholder="Username"
              />
            </div>
            <div style={styles.field}>
              <label htmlFor="auth-password" style={styles.label}>
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                style={styles.input}
                value={node.auth.config.password || ''}
                onChange={(e) => handleAuthChange('password', e.target.value)}
                placeholder="Password"
              />
            </div>
          </>
        )}

        {/* Bearer Token */}
        {node.auth?.type === 'bearer' && (
          <div style={styles.field}>
            <label htmlFor="auth-token" style={styles.label}>
              Bearer Token
            </label>
            <input
              id="auth-token"
              type="password"
              style={styles.input}
              value={node.auth.config.token || ''}
              onChange={(e) => handleAuthChange('token', e.target.value)}
              placeholder="Bearer token or {{variable}}"
            />
          </div>
        )}

        {/* API Key */}
        {node.auth?.type === 'api-key' && (
          <>
            <div style={styles.field}>
              <label htmlFor="auth-header" style={styles.label}>
                Header Name
              </label>
              <input
                id="auth-header"
                type="text"
                style={styles.input}
                value={node.auth.config.header || ''}
                onChange={(e) => handleAuthChange('header', e.target.value)}
                placeholder="e.g., X-API-Key"
              />
            </div>
            <div style={styles.field}>
              <label htmlFor="auth-key" style={styles.label}>
                API Key
              </label>
              <input
                id="auth-key"
                type="password"
                style={styles.input}
                value={node.auth.config.key || ''}
                onChange={(e) => handleAuthChange('key', e.target.value)}
                placeholder="API key or {{variable}}"
              />
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
          Pause execution for manual review before making the HTTP request
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
  headersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  headerItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
  },
  headerContent: {
    display: 'flex',
    gap: '8px',
    alignItems: 'baseline',
    flex: 1,
    overflow: 'hidden',
  },
  headerKey: {
    fontSize: '13px',
    color: '#374151',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  headerValue: {
    fontSize: '13px',
    color: '#6b7280',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  headerInputs: {
    display: 'flex',
    gap: '8px',
    alignItems: 'stretch',
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
  removeButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#ef4444',
    background: 'white',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
