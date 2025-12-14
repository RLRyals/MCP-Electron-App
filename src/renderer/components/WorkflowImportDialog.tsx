/**
 * WorkflowImportDialog Component
 * Dialog for importing workflows from folder
 *
 * Features:
 * - Folder picker button
 * - Show dependency check results
 * - Display what will be installed
 * - Confirm/cancel buttons
 */

import React, { useState } from 'react';

export interface ImportResult {
  success: boolean;
  workflowId?: string;
  version?: string;
  message: string;
  missingDependencies?: {
    agents: string[];
    skills: string[];
    mcpServers: string[];
  };
  installedComponents?: {
    agents: number;
    skills: number;
  };
}

export interface WorkflowImportDialogProps {
  onImport: (folderPath: string) => Promise<ImportResult>;
  onClose: () => void;
}

export const WorkflowImportDialog: React.FC<WorkflowImportDialogProps> = ({
  onImport,
  onClose,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleSelectFolder = async () => {
    try {
      // Use Electron dialog to select folder
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.dialog) {
        alert('Dialog API not available');
        return;
      }

      const result = await electronAPI.dialog.showOpenDialog({
        title: 'Select Workflow Folder',
        properties: ['openDirectory'],
        buttonLabel: 'Select Workflow Folder',
      });

      if (!result.canceled && result.filePaths.length > 0) {
        setSelectedFolder(result.filePaths[0]);
        setResult(null); // Reset previous results
      }
    } catch (error: any) {
      console.error('[WorkflowImportDialog] Failed to select folder:', error);
      alert(`Failed to select folder: ${error.message}`);
    }
  };

  const handleImport = async () => {
    if (!selectedFolder) {
      alert('Please select a workflow folder first');
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const importResult = await onImport(selectedFolder);
      setResult(importResult);

      if (importResult.success) {
        // Auto-close after 2 seconds on success
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      console.error('[WorkflowImportDialog] Import failed:', error);
      setResult({
        success: false,
        message: error.message || 'Unknown error occurred',
      });
    } finally {
      setImporting(false);
    }
  };

  // Styles
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const dialogStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    minWidth: '500px',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: '20px',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '8px',
  };

  const folderDisplayStyle: React.CSSProperties = {
    fontSize: '12px',
    padding: '10px 12px',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    color: '#6b7280',
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const,
    marginBottom: '12px',
  };

  const buttonStyle = (variant: 'primary' | 'secondary' | 'danger' = 'secondary', disabled = false): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    background: variant === 'primary' ? '#3b82f6' : variant === 'danger' ? '#ef4444' : '#e5e7eb',
    color: variant === 'primary' || variant === 'danger' ? 'white' : '#374151',
    opacity: disabled ? 0.5 : 1,
  });

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px',
  };

  const resultBoxStyle = (success: boolean): React.CSSProperties => ({
    padding: '16px',
    borderRadius: '8px',
    background: success ? '#ecfdf5' : '#fef2f2',
    border: `1px solid ${success ? '#10b981' : '#ef4444'}`,
    marginTop: '16px',
  });

  const resultTitleStyle = (success: boolean): React.CSSProperties => ({
    fontSize: '14px',
    fontWeight: 700,
    color: success ? '#065f46' : '#991b1b',
    marginBottom: '8px',
  });

  const resultMessageStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#374151',
    marginBottom: '8px',
  };

  const listStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    paddingLeft: '20px',
    marginTop: '8px',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>Import Workflow</div>

        <div style={sectionStyle}>
          <div style={labelStyle}>Select Workflow Folder</div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              style={buttonStyle('secondary')}
              onClick={handleSelectFolder}
              disabled={importing}
            >
              📁 Browse...
            </button>
          </div>
          {selectedFolder && (
            <div style={folderDisplayStyle}>
              {selectedFolder}
            </div>
          )}
        </div>

        {!selectedFolder && (
          <div style={{
            padding: '16px',
            background: '#f3f4f6',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#6b7280',
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Expected folder structure:</strong>
            </div>
            <pre style={{ fontSize: '11px', lineHeight: '1.6', margin: 0 }}>
{`/workflow-folder/
  ├── workflow.yaml (or workflow.json)
  ├── agents/
  │   └── agent-name.md
  ├── skills/
  │   └── skill-name.md
  └── README.md`}
            </pre>
          </div>
        )}

        {result && (
          <div style={resultBoxStyle(result.success)}>
            <div style={resultTitleStyle(result.success)}>
              {result.success ? '✅ Import Successful' : '❌ Import Failed'}
            </div>
            <div style={resultMessageStyle}>{result.message}</div>

            {result.success && result.installedComponents && (
              <div style={listStyle}>
                <div>Installed components:</div>
                <ul>
                  {result.installedComponents.agents > 0 && (
                    <li>{result.installedComponents.agents} agent(s)</li>
                  )}
                  {result.installedComponents.skills > 0 && (
                    <li>{result.installedComponents.skills} skill(s)</li>
                  )}
                </ul>
              </div>
            )}

            {result.missingDependencies && (
              <div style={listStyle}>
                <div>Missing dependencies:</div>
                <ul>
                  {result.missingDependencies.agents.length > 0 && (
                    <li>Agents: {result.missingDependencies.agents.join(', ')}</li>
                  )}
                  {result.missingDependencies.skills.length > 0 && (
                    <li>Skills: {result.missingDependencies.skills.join(', ')}</li>
                  )}
                  {result.missingDependencies.mcpServers.length > 0 && (
                    <li>MCP Servers: {result.missingDependencies.mcpServers.join(', ')}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={buttonGroupStyle}>
          <button
            style={buttonStyle('secondary')}
            onClick={onClose}
            disabled={importing}
          >
            {result?.success ? 'Close' : 'Cancel'}
          </button>
          {!result?.success && (
            <button
              style={buttonStyle('primary', !selectedFolder || importing)}
              onClick={handleImport}
              disabled={!selectedFolder || importing}
            >
              {importing ? 'Importing...' : 'Import Workflow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
