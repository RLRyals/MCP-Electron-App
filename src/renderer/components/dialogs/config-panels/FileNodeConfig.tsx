/**
 * FileNodeConfig Component
 * Configuration panel for File Operation workflow nodes
 *
 * Features:
 * - Operation selector (read, write, copy, move, delete, exists)
 * - Source and target path inputs
 * - File browser buttons
 * - Content source configuration for write operations
 * - Encoding selector
 * - Safety checkbox for project folder restriction
 * - Full accessibility support
 */

import React from 'react';
import { FileOperationNode } from '../../../../types/workflow-nodes';

export interface FileNodeConfigProps {
  node: FileOperationNode;
  onChange: (updates: Partial<FileOperationNode>) => void;
  errors: Record<string, string>;
  onBrowseFile?: (currentPath?: string) => Promise<string | undefined>;
}

export const FileNodeConfig: React.FC<FileNodeConfigProps> = ({
  node,
  onChange,
  errors,
  onBrowseFile,
}) => {
  const handleChange = (field: keyof FileOperationNode, value: any) => {
    onChange({ [field]: value });
  };

  const handleBrowseSource = async () => {
    if (!onBrowseFile) return;
    const path = await onBrowseFile(node.sourcePath);
    if (path) {
      handleChange('sourcePath', path);
    }
  };

  const handleBrowseTarget = async () => {
    if (!onBrowseFile) return;
    const path = await onBrowseFile(node.targetPath);
    if (path) {
      handleChange('targetPath', path);
    }
  };

  const needsSource = ['read', 'write', 'copy', 'move', 'delete', 'exists'].includes(node.operation);
  const needsTarget = ['copy', 'move'].includes(node.operation);
  const needsContent = node.operation === 'write';
  const needsEncoding = ['read', 'write'].includes(node.operation);

  return (
    <div style={styles.container}>
      {/* Operation Selector */}
      <div style={styles.field}>
        <label htmlFor="operation-select" style={styles.label}>
          File Operation *
        </label>
        <select
          id="operation-select"
          style={styles.select}
          value={node.operation}
          onChange={(e) => handleChange('operation', e.target.value as FileOperationNode['operation'])}
          aria-describedby="operation-help"
        >
          <option value="read">Read File</option>
          <option value="write">Write File</option>
          <option value="copy">Copy File</option>
          <option value="move">Move File</option>
          <option value="delete">Delete File</option>
          <option value="exists">Check if File Exists</option>
        </select>
        <div id="operation-help" style={styles.helperTextBlock}>
          The file system operation to perform
        </div>
      </div>

      {/* Source Path */}
      {needsSource && (
        <div style={styles.field}>
          <label htmlFor="source-path" style={styles.label}>
            {node.operation === 'write' ? 'File Path' : 'Source Path'} *
            <span style={styles.helperText}> (Supports {'{{variables}}'} substitution)</span>
          </label>
          <div style={styles.inputWithButton}>
            <input
              id="source-path"
              type="text"
              style={errors.sourcePath ? { ...styles.inputFlex, ...styles.inputError } : styles.inputFlex}
              value={node.sourcePath || ''}
              onChange={(e) => handleChange('sourcePath', e.target.value)}
              placeholder="e.g., /path/to/file.txt or {{filepath}}"
              aria-required="true"
              aria-invalid={!!errors.sourcePath}
              aria-describedby={errors.sourcePath ? 'source-path-error' : 'source-path-help'}
            />
            {onBrowseFile && (
              <button
                type="button"
                style={styles.browseButton}
                onClick={handleBrowseSource}
                aria-label="Browse for file"
              >
                Browse
              </button>
            )}
          </div>
          {errors.sourcePath && (
            <div id="source-path-error" style={styles.errorText} role="alert">
              {errors.sourcePath}
            </div>
          )}
          <div id="source-path-help" style={styles.helperTextBlock}>
            Path to the file. Use {'{{variables}}'} for dynamic paths.
          </div>
        </div>
      )}

      {/* Target Path (for copy/move) */}
      {needsTarget && (
        <div style={styles.field}>
          <label htmlFor="target-path" style={styles.label}>
            Target Path *
            <span style={styles.helperText}> (Destination location)</span>
          </label>
          <div style={styles.inputWithButton}>
            <input
              id="target-path"
              type="text"
              style={errors.targetPath ? { ...styles.inputFlex, ...styles.inputError } : styles.inputFlex}
              value={node.targetPath || ''}
              onChange={(e) => handleChange('targetPath', e.target.value)}
              placeholder="e.g., /path/to/destination.txt"
              aria-required="true"
              aria-invalid={!!errors.targetPath}
              aria-describedby={errors.targetPath ? 'target-path-error' : 'target-path-help'}
            />
            {onBrowseFile && (
              <button
                type="button"
                style={styles.browseButton}
                onClick={handleBrowseTarget}
                aria-label="Browse for destination"
              >
                Browse
              </button>
            )}
          </div>
          {errors.targetPath && (
            <div id="target-path-error" style={styles.errorText} role="alert">
              {errors.targetPath}
            </div>
          )}
          <div id="target-path-help" style={styles.helperTextBlock}>
            Where to copy/move the file
          </div>
        </div>
      )}

      {/* Content (for write operations) */}
      {needsContent && (
        <div style={styles.field}>
          <label htmlFor="file-content" style={styles.label}>
            File Content
            <span style={styles.helperText}> (Literal text or {'{{variable}}'})</span>
          </label>
          <textarea
            id="file-content"
            style={styles.textarea}
            value={node.content || ''}
            onChange={(e) => handleChange('content', e.target.value)}
            placeholder="Enter file content or {{variableName}} to use a variable"
            rows={10}
            aria-describedby="file-content-help"
          />
          <div id="file-content-help" style={styles.helperTextBlock}>
            The content to write to the file. Can be literal text or a variable reference.
          </div>
        </div>
      )}

      {/* Encoding (for read/write) */}
      {needsEncoding && (
        <div style={styles.field}>
          <label htmlFor="encoding-select" style={styles.label}>
            Encoding
          </label>
          <select
            id="encoding-select"
            style={styles.select}
            value={node.encoding || 'utf8'}
            onChange={(e) => handleChange('encoding', e.target.value as FileOperationNode['encoding'])}
            aria-describedby="encoding-help"
          >
            <option value="utf8">UTF-8 (text)</option>
            <option value="binary">Binary</option>
          </select>
          <div id="encoding-help" style={styles.helperTextBlock}>
            How to encode/decode file contents
          </div>
        </div>
      )}

      {/* Overwrite (for write operations) */}
      {node.operation === 'write' && (
        <div style={styles.field}>
          <label style={styles.checkboxLabel}>
            <input
              id="overwrite-checkbox"
              type="checkbox"
              checked={node.overwrite ?? true}
              onChange={(e) => handleChange('overwrite', e.target.checked)}
              style={styles.checkbox}
            />
            <span>Overwrite Existing File</span>
          </label>
          <div style={styles.helperTextBlock}>
            If unchecked, the operation will fail if the file already exists
          </div>
        </div>
      )}

      {/* Safety Settings */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Safety Settings</h3>

        <div style={styles.field}>
          <label style={styles.checkboxLabel}>
            <input
              id="restrict-checkbox"
              type="checkbox"
              checked={node.requireProjectFolder}
              onChange={(e) => handleChange('requireProjectFolder', e.target.checked)}
              style={styles.checkbox}
            />
            <span>Restrict to Project Folder</span>
          </label>
          <div style={styles.helperTextBlock}>
            Only allow file operations within the project directory for security
          </div>
        </div>

        {!node.requireProjectFolder && (
          <div style={styles.warningBox}>
            <span style={styles.warningIcon}>⚠</span>
            <div style={styles.warningContent}>
              <strong>Warning:</strong> Allowing operations outside the project folder can be dangerous.
              Ensure you trust the file paths being used.
            </div>
          </div>
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
          Pause execution for manual review before performing file operation
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
  browseButton: {
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6366f1',
    background: 'white',
    border: '1px solid #c7d2fe',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
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
  warningBox: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: '6px',
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: '20px',
    flexShrink: 0,
  },
  warningContent: {
    fontSize: '13px',
    color: '#92400e',
    lineHeight: '1.5',
  },
};
