/**
 * ContextVariablesTab Component
 * Tab 4 of NodeConfigDialog - Context & Variables configuration
 *
 * Purpose: Configure how variables flow in/out of nodes, supporting both:
 * - Simple Mode: Automatic variable passing (user-friendly)
 * - Advanced Mode: Explicit JSONPath mappings (power users)
 *
 * Features:
 * - Mode toggle (Simple/Advanced)
 * - Input/Output mapping configuration
 * - Variable browser integration
 * - JSONPath helper and validation
 * - Transform function editor
 */

import React, { useState } from 'react';
import { WorkflowNode, ContextMapping } from '../../../types/workflow-nodes';
import { VariableReference } from '../../../types/workflow-context';

export interface ContextVariablesTabProps {
  node: WorkflowNode;
  onChange: (updates: Partial<WorkflowNode>) => void;
  availableVariables: VariableReference[]; // From previous nodes
  errors: Record<string, string>;
}

export const ContextVariablesTab: React.FC<ContextVariablesTabProps> = ({
  node,
  onChange,
  availableVariables,
  errors,
}) => {
  const [mode, setMode] = useState<'simple' | 'advanced'>(node.contextConfig.mode);
  const [inputMappings, setInputMappings] = useState<ContextMapping[]>(
    node.contextConfig.inputs || []
  );
  const [outputMappings, setOutputMappings] = useState<ContextMapping[]>(
    node.contextConfig.outputs || []
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showVariableBrowser, setShowVariableBrowser] = useState(true);
  const [activeField, setActiveField] = useState<'input' | 'output' | null>(null);

  // Handle mode toggle
  const handleModeToggle = () => {
    const newMode = mode === 'simple' ? 'advanced' : 'simple';
    setMode(newMode);
    onChange({
      contextConfig: {
        ...node.contextConfig,
        mode: newMode,
      },
    });
  };

  // Add input mapping
  const handleAddInputMapping = () => {
    const newMapping: ContextMapping = {
      source: '',
      target: '',
    };
    const updated = [...inputMappings, newMapping];
    setInputMappings(updated);
    setEditingIndex(updated.length - 1);
    setActiveField('input');
    updateNodeContext({ inputs: updated });
  };

  // Update input mapping
  const handleUpdateInputMapping = (index: number, field: keyof ContextMapping, value: string) => {
    const updated = [...inputMappings];
    updated[index] = { ...updated[index], [field]: value };
    setInputMappings(updated);
    updateNodeContext({ inputs: updated });
  };

  // Delete input mapping
  const handleDeleteInputMapping = (index: number) => {
    const updated = inputMappings.filter((_, i) => i !== index);
    setInputMappings(updated);
    setEditingIndex(null);
    updateNodeContext({ inputs: updated });
  };

  // Add output mapping
  const handleAddOutputMapping = () => {
    const newMapping: ContextMapping = {
      source: '',
      target: '',
    };
    const updated = [...outputMappings, newMapping];
    setOutputMappings(updated);
    setEditingIndex(updated.length - 1);
    setActiveField('output');
    updateNodeContext({ outputs: updated });
  };

  // Update output mapping
  const handleUpdateOutputMapping = (index: number, field: keyof ContextMapping, value: string) => {
    const updated = [...outputMappings];
    updated[index] = { ...updated[index], [field]: value };
    setOutputMappings(updated);
    updateNodeContext({ outputs: updated });
  };

  // Delete output mapping
  const handleDeleteOutputMapping = (index: number) => {
    const updated = outputMappings.filter((_, i) => i !== index);
    setOutputMappings(updated);
    setEditingIndex(null);
    updateNodeContext({ outputs: updated });
  };

  // Update node context config
  const updateNodeContext = (updates: { inputs?: ContextMapping[]; outputs?: ContextMapping[] }) => {
    onChange({
      contextConfig: {
        ...node.contextConfig,
        ...updates,
      },
    });
  };

  // Insert variable into active field
  const handleInsertVariable = (path: string) => {
    // This would insert the variable path into the currently focused field
    // For now, we'll just show the path
    console.log('Insert variable:', path);
  };

  // Validate JSONPath or variable reference
  const validateSource = (source: string): boolean => {
    if (!source) return false;
    // Check for {{variable}} syntax
    if (source.startsWith('{{') && source.endsWith('}}')) return true;
    // Check for $.jsonpath syntax
    if (source.startsWith('$.')) return true;
    return false;
  };

  // Validate target variable name (must be valid JS identifier)
  const validateTarget = (target: string): boolean => {
    if (!target) return false;
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(target);
  };

  return (
    <div style={styles.container}>
      {/* Mode Toggle */}
      <div style={styles.modeToggleContainer}>
        <div style={styles.modeToggleLabel}>Variable Mode</div>
        <button
          style={styles.modeToggle}
          onClick={handleModeToggle}
          aria-pressed={mode === 'advanced'}
          title={`Switch to ${mode === 'simple' ? 'Advanced' : 'Simple'} Mode`}
        >
          <div
            style={{
              ...styles.modeToggleSlider,
              left: mode === 'advanced' ? '50%' : '0',
            }}
          />
          <span style={mode === 'simple' ? styles.modeToggleOptionActive : styles.modeToggleOption}>
            Simple
          </span>
          <span style={mode === 'advanced' ? styles.modeToggleOptionActive : styles.modeToggleOption}>
            Advanced
          </span>
        </button>
      </div>

      {/* Simple Mode Display */}
      {mode === 'simple' && (
        <div style={styles.simpleModeContainer}>
          <div style={styles.infoBox}>
            <div style={styles.infoIcon}>ℹ️</div>
            <div>
              <div style={styles.infoTitle}>Automatic Variable Passing</div>
              <div style={styles.infoText}>
                All outputs from previous nodes are automatically available to this node. No configuration needed.
              </div>
            </div>
          </div>

          <div style={styles.availableSection}>
            <h3 style={styles.sectionTitle}>What's Available to This Node</h3>
            <ul style={styles.availableList}>
              <li style={styles.availableItem}>
                <strong>Previous Node Outputs:</strong> All outputs from nodes executed before this one
              </li>
              <li style={styles.availableItem}>
                <strong>Global Variables:</strong> Variables set during workflow execution
              </li>
              <li style={styles.availableItem}>
                <strong>MCP Data:</strong> Series, books, characters, scenes, chapters
              </li>
              <li style={styles.availableItem}>
                <strong>Project Folder:</strong> Current project's file system path
              </li>
            </ul>
          </div>

          <div style={styles.hint}>
            💡 <strong>Tip:</strong> Switch to Advanced Mode for custom variable mappings and transformations
          </div>
        </div>
      )}

      {/* Advanced Mode UI */}
      {mode === 'advanced' && (
        <div style={styles.advancedModeContainer}>
          <div style={styles.mainContent}>
            {/* Input Mappings Section */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>
                  Input Variables
                  <span
                    style={styles.helpIcon}
                    title="Map variables from previous nodes or global context to this node's input"
                  >
                    ℹ️
                  </span>
                </h3>
                <button style={styles.addButton} onClick={handleAddInputMapping}>
                  + Add Input Mapping
                </button>
              </div>

              {inputMappings.length === 0 ? (
                <div style={styles.emptyState}>
                  No input mappings defined. Click "Add Input Mapping" to create one.
                </div>
              ) : (
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeaderRow}>
                        <th style={styles.tableHeader}>Source (JSONPath)</th>
                        <th style={styles.tableHeader}>Target (Variable Name)</th>
                        <th style={styles.tableHeader}>Transform (Optional)</th>
                        <th style={styles.tableHeaderActions}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inputMappings.map((mapping, index) => (
                        <tr key={index} style={styles.tableRow}>
                          <td style={styles.tableCell}>
                            <input
                              type="text"
                              style={
                                validateSource(mapping.source || '')
                                  ? styles.tableCellInput
                                  : { ...styles.tableCellInput, ...styles.inputError }
                              }
                              value={mapping.source || ''}
                              onChange={(e) => handleUpdateInputMapping(index, 'source', e.target.value)}
                              placeholder="$.previousNode.field or {{variable}}"
                              aria-label="Source JSONPath"
                              aria-invalid={!validateSource(mapping.source || '')}
                            />
                            {!validateSource(mapping.source) && mapping.source && (
                              <div style={styles.validationIcon} title="Invalid JSONPath syntax">
                                ✗
                              </div>
                            )}
                            {validateSource(mapping.source) && (
                              <div style={styles.validationIconSuccess} title="Valid">
                                ✓
                              </div>
                            )}
                          </td>
                          <td style={styles.tableCell}>
                            <input
                              type="text"
                              style={
                                validateTarget(mapping.target)
                                  ? styles.tableCellInput
                                  : { ...styles.tableCellInput, ...styles.inputError }
                              }
                              value={mapping.target}
                              onChange={(e) => handleUpdateInputMapping(index, 'target', e.target.value)}
                              placeholder="variableName"
                              aria-label="Target variable name"
                              aria-invalid={!validateTarget(mapping.target)}
                            />
                            {!validateTarget(mapping.target) && mapping.target && (
                              <div style={styles.validationIcon} title="Invalid variable name">
                                ✗
                              </div>
                            )}
                            {validateTarget(mapping.target) && (
                              <div style={styles.validationIconSuccess} title="Valid">
                                ✓
                              </div>
                            )}
                          </td>
                          <td style={styles.tableCell}>
                            <input
                              type="text"
                              style={styles.tableCellInput}
                              value={mapping.transform || ''}
                              onChange={(e) =>
                                handleUpdateInputMapping(index, 'transform', (e.target.value || undefined) as any)
                              }
                              placeholder="x => x.toUpperCase()"
                              aria-label="Transform function"
                            />
                          </td>
                          <td style={styles.tableCellActions}>
                            <button
                              style={styles.deleteButton}
                              onClick={() => handleDeleteInputMapping(index)}
                              title="Delete mapping"
                              aria-label="Delete input mapping"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* JSONPath Helper */}
              <div style={styles.helperBox}>
                <div style={styles.helperTitle}>
                  JSONPath Examples
                  <span style={styles.helpIcon} title="JSONPath syntax for accessing data">
                    ℹ️
                  </span>
                </div>
                <ul style={styles.helperList}>
                  <li>
                    <code style={styles.code}>$.previousNode.field</code> - Access field from previous node
                  </li>
                  <li>
                    <code style={styles.code}>$.books[0].title</code> - Access first book's title
                  </li>
                  <li>
                    <code style={styles.code}>{'{{variableName}}'}</code> - Reference global variable
                  </li>
                </ul>
              </div>
            </div>

            {/* Output Mappings Section */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>
                  Output Variables
                  <span
                    style={styles.helpIcon}
                    title="Extract specific values from this node's output to make available to subsequent nodes"
                  >
                    ℹ️
                  </span>
                </h3>
                <button style={styles.addButton} onClick={handleAddOutputMapping}>
                  + Add Output Mapping
                </button>
              </div>

              {outputMappings.length === 0 ? (
                <div style={styles.emptyState}>
                  No output mappings defined. The entire output will be available as "output" variable.
                </div>
              ) : (
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeaderRow}>
                        <th style={styles.tableHeader}>Source (JSONPath)</th>
                        <th style={styles.tableHeader}>Target (Variable Name)</th>
                        <th style={styles.tableHeader}>Transform (Optional)</th>
                        <th style={styles.tableHeaderActions}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outputMappings.map((mapping, index) => (
                        <tr key={index} style={styles.tableRow}>
                          <td style={styles.tableCell}>
                            <input
                              type="text"
                              style={
                                validateSource(mapping.source || '')
                                  ? styles.tableCellInput
                                  : { ...styles.tableCellInput, ...styles.inputError }
                              }
                              value={mapping.source || ''}
                              onChange={(e) => handleUpdateOutputMapping(index, 'source', e.target.value)}
                              placeholder="$.output.field"
                              aria-label="Source JSONPath"
                              aria-invalid={!validateSource(mapping.source || '')}
                            />
                            {!validateSource(mapping.source) && mapping.source && (
                              <div style={styles.validationIcon} title="Invalid JSONPath syntax">
                                ✗
                              </div>
                            )}
                            {validateSource(mapping.source) && (
                              <div style={styles.validationIconSuccess} title="Valid">
                                ✓
                              </div>
                            )}
                          </td>
                          <td style={styles.tableCell}>
                            <input
                              type="text"
                              style={
                                validateTarget(mapping.target)
                                  ? styles.tableCellInput
                                  : { ...styles.tableCellInput, ...styles.inputError }
                              }
                              value={mapping.target}
                              onChange={(e) => handleUpdateOutputMapping(index, 'target', e.target.value)}
                              placeholder="variableName"
                              aria-label="Target variable name"
                              aria-invalid={!validateTarget(mapping.target)}
                            />
                            {!validateTarget(mapping.target) && mapping.target && (
                              <div style={styles.validationIcon} title="Invalid variable name">
                                ✗
                              </div>
                            )}
                            {validateTarget(mapping.target) && (
                              <div style={styles.validationIconSuccess} title="Valid">
                                ✓
                              </div>
                            )}
                          </td>
                          <td style={styles.tableCell}>
                            <input
                              type="text"
                              style={styles.tableCellInput}
                              value={mapping.transform || ''}
                              onChange={(e) =>
                                handleUpdateOutputMapping(index, 'transform', (e.target.value || undefined) as any)
                              }
                              placeholder="x => x.toUpperCase()"
                              aria-label="Transform function"
                            />
                          </td>
                          <td style={styles.tableCellActions}>
                            <button
                              style={styles.deleteButton}
                              onClick={() => handleDeleteOutputMapping(index)}
                              title="Delete mapping"
                              aria-label="Delete output mapping"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Transform Helper */}
              <div style={styles.helperBox}>
                <div style={styles.helperTitle}>
                  Transform Examples
                  <span style={styles.helpIcon} title="JavaScript functions to transform values">
                    ℹ️
                  </span>
                </div>
                <ul style={styles.helperList}>
                  <li>
                    <code style={styles.code}>x =&gt; x.toUpperCase()</code> - Convert to uppercase
                  </li>
                  <li>
                    <code style={styles.code}>x =&gt; JSON.parse(x)</code> - Parse JSON string
                  </li>
                  <li>
                    <code style={styles.code}>x =&gt; x.split(',').map(s =&gt; s.trim())</code> - Split and
                    trim
                  </li>
                </ul>
                <div style={styles.warning}>
                  ⚠️ <strong>Warning:</strong> JavaScript code will be executed during workflow runtime
                </div>
              </div>
            </div>
          </div>

          {/* Variable Browser Sidebar */}
          {showVariableBrowser && (
            <div style={styles.sidebar}>
              <div style={styles.sidebarHeader}>
                <h3 style={styles.sidebarTitle}>Available Variables</h3>
                <button
                  style={styles.sidebarToggle}
                  onClick={() => setShowVariableBrowser(false)}
                  title="Hide variable browser"
                >
                  ✕
                </button>
              </div>

              <div style={styles.variableList}>
                {availableVariables.length === 0 ? (
                  <div style={styles.emptyState}>No variables available yet</div>
                ) : (
                  availableVariables.map((variable, index) => (
                    <div
                      key={index}
                      style={styles.variableItem}
                      onClick={() => handleInsertVariable(variable.path)}
                      title={`Click to insert: ${variable.path}`}
                    >
                      <div style={styles.variableName}>{variable.path}</div>
                      <div style={styles.variableInfo}>
                        <span style={styles.variableType}>{variable.type}</span>
                        <span style={styles.variableSource}>
                          {variable.nodeName} ({variable.nodeType})
                        </span>
                      </div>
                      {variable.value !== undefined && (
                        <div style={styles.variableValue}>
                          {typeof variable.value === 'object'
                            ? JSON.stringify(variable.value).substring(0, 50) + '...'
                            : String(variable.value).substring(0, 50)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Show Variable Browser Button (when hidden) */}
          {!showVariableBrowser && (
            <button
              style={styles.showSidebarButton}
              onClick={() => setShowVariableBrowser(true)}
              title="Show variable browser"
            >
              📋 Show Variables
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
  },

  // Mode Toggle
  modeToggleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  modeToggleLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  },
  modeToggle: {
    position: 'relative',
    display: 'flex',
    width: '200px',
    height: '40px',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
    padding: '4px',
    transition: 'all 0.3s',
  },
  modeToggleSlider: {
    position: 'absolute',
    top: '4px',
    width: '50%',
    height: 'calc(100% - 8px)',
    background: '#3b82f6',
    borderRadius: '6px',
    transition: 'left 0.3s',
    zIndex: 1,
  },
  modeToggleOption: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: '#6b7280',
    zIndex: 2,
    transition: 'color 0.3s',
  },
  modeToggleOptionActive: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    zIndex: 2,
    transition: 'color 0.3s',
  },

  // Simple Mode
  simpleModeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  infoBox: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
  },
  infoIcon: {
    fontSize: '24px',
  },
  infoTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1e40af',
    marginBottom: '4px',
  },
  infoText: {
    fontSize: '14px',
    color: '#1e40af',
    lineHeight: '1.5',
  },
  availableSection: {
    padding: '16px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  },
  availableList: {
    margin: '12px 0 0 0',
    padding: '0 0 0 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  availableItem: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.5',
  },
  hint: {
    padding: '12px 16px',
    background: '#fef3c7',
    border: '1px solid #fde047',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#92400e',
  },

  // Advanced Mode
  advancedModeContainer: {
    display: 'flex',
    gap: '20px',
    flex: 1,
    minHeight: 0,
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    overflowY: 'auto',
    paddingRight: '8px',
  },

  // Section
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  helpIcon: {
    fontSize: '14px',
    cursor: 'help',
    opacity: 0.6,
  },
  addButton: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#3b82f6',
    background: 'white',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
    background: '#f9fafb',
    border: '1px dashed #d1d5db',
    borderRadius: '8px',
  },

  // Table
  tableContainer: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  tableHeaderRow: {
    background: '#f9fafb',
  },
  tableHeader: {
    padding: '12px',
    textAlign: 'left',
    fontWeight: 600,
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
  },
  tableHeaderActions: {
    padding: '12px',
    textAlign: 'center',
    fontWeight: 600,
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
    width: '80px',
  },
  tableRow: {
    borderBottom: '1px solid #e5e7eb',
  },
  tableCell: {
    padding: '12px',
    position: 'relative',
  },
  tableCellInput: {
    width: '100%',
    padding: '8px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'monospace',
  },
  tableCellActions: {
    padding: '12px',
    textAlign: 'center',
  },
  deleteButton: {
    padding: '6px 12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'transform 0.2s',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  validationIcon: {
    position: 'absolute',
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#ef4444',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  validationIconSuccess: {
    position: 'absolute',
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#10b981',
    fontSize: '14px',
    fontWeight: 'bold',
  },

  // Helper Boxes
  helperBox: {
    padding: '12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
  },
  helperTitle: {
    fontWeight: 600,
    color: '#374151',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  helperList: {
    margin: '0',
    padding: '0 0 0 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  code: {
    padding: '2px 6px',
    background: '#e5e7eb',
    borderRadius: '3px',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  warning: {
    marginTop: '8px',
    padding: '8px',
    background: '#fef3c7',
    border: '1px solid #fde047',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#92400e',
  },

  // Sidebar (Variable Browser)
  sidebar: {
    width: '300px',
    display: 'flex',
    flexDirection: 'column',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
  },
  sidebarTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
  },
  sidebarToggle: {
    background: 'transparent',
    border: 'none',
    fontSize: '16px',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '4px',
  },
  variableList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  variableItem: {
    padding: '12px',
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  variableName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1f2937',
    fontFamily: 'monospace',
    marginBottom: '4px',
  },
  variableInfo: {
    display: 'flex',
    gap: '8px',
    fontSize: '11px',
    marginBottom: '4px',
  },
  variableType: {
    padding: '2px 6px',
    background: '#dbeafe',
    color: '#1e40af',
    borderRadius: '3px',
    fontWeight: 600,
  },
  variableSource: {
    color: '#6b7280',
  },
  variableValue: {
    fontSize: '11px',
    color: '#6b7280',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  showSidebarButton: {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    transition: 'all 0.2s',
  },
};
