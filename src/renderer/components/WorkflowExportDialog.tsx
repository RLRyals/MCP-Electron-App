/**
 * WorkflowExportDialog Component
 * Dialog for exporting workflows to Claude Code format
 *
 * Features:
 * - Format selection (YAML/JSON)
 * - Output path customization
 * - Options for including agents/skills/README
 * - Preview of export contents
 * - Success/error feedback with "Open Folder" button
 */

import React, { useState, useEffect } from 'react';

export interface ExportResult {
  success: boolean;
  outputPath: string;
  message: string;
  exportedFiles: {
    workflow: string;
    agents: string[];
    skills: string[];
    readme: string;
  };
  error?: string;
}

export interface WorkflowExportDialogProps {
  workflowId: string;
  workflowName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const WorkflowExportDialog: React.FC<WorkflowExportDialogProps> = ({
  workflowId,
  workflowName,
  isOpen,
  onClose,
}) => {
  const [format, setFormat] = useState<'yaml' | 'json'>('yaml');
  const [includeAgents, setIncludeAgents] = useState(true);
  const [includeSkills, setIncludeSkills] = useState(true);
  const [includeReadme, setIncludeReadme] = useState(true);
  const [customPath, setCustomPath] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [preview, setPreview] = useState<{
    agentCount: number;
    skillCount: number;
    phaseCount: number;
  } | null>(null);

  // Load preview data when dialog opens
  useEffect(() => {
    if (isOpen && workflowId) {
      loadPreview();
    }
  }, [isOpen, workflowId]);

  const loadPreview = async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.invoke) {
        console.warn('[WorkflowExportDialog] Electron API not available');
        return;
      }

      // Get workflow details to show preview
      const workflow = await electronAPI.invoke('workflow:get-definition', workflowId);

      if (workflow) {
        // Count agents and skills from phases
        const agents = new Set<string>();
        const skills = new Set<string>();

        if (workflow.phases_json && Array.isArray(workflow.phases_json)) {
          for (const phase of workflow.phases_json) {
            if (phase.agent && phase.agent !== 'User' && phase.agent !== 'System') {
              agents.add(phase.agent);
            }
            if (phase.skill) {
              skills.add(phase.skill);
            }
          }
        }

        setPreview({
          agentCount: agents.size,
          skillCount: skills.size,
          phaseCount: workflow.phases_json?.length || 0,
        });
      }
    } catch (error: any) {
      console.error('[WorkflowExportDialog] Failed to load preview:', error);
    }
  };

  const handleSelectPath = async () => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.dialog) {
        alert('Dialog API not available');
        return;
      }

      const result = await electronAPI.dialog.showOpenDialog({
        title: 'Select Export Location',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Select Export Location',
      });

      if (!result.canceled && result.filePaths.length > 0) {
        setCustomPath(result.filePaths[0]);
      }
    } catch (error: any) {
      console.error('[WorkflowExportDialog] Failed to select path:', error);
      alert(`Failed to select path: ${error.message}`);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setResult(null);

    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.invoke) {
        throw new Error('Electron API not available');
      }

      const exportResult = await electronAPI.invoke('workflow:export-claude-code', workflowId, {
        format,
        includeAgents,
        includeSkills,
        includeReadme,
        outputPath: customPath || undefined,
      });

      setResult(exportResult);

      if (exportResult.success) {
        // Auto-close after 3 seconds on success
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    } catch (error: any) {
      console.error('[WorkflowExportDialog] Export failed:', error);
      setResult({
        success: false,
        outputPath: '',
        message: error.message || 'Unknown error occurred',
        exportedFiles: { workflow: '', agents: [], skills: [], readme: '' },
        error: error.message,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!result?.outputPath) return;

    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.shell?.openPath) {
        await electronAPI.shell.openPath(result.outputPath);
      }
    } catch (error: any) {
      console.error('[WorkflowExportDialog] Failed to open folder:', error);
      alert(`Failed to open folder: ${error.message}`);
    }
  };

  if (!isOpen) return null;

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
    minWidth: '550px',
    maxWidth: '650px',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: '8px',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '24px',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '8px',
    display: 'block',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
    lineHeight: '1.5',
  };

  const pathDisplayStyle: React.CSSProperties = {
    fontSize: '12px',
    padding: '10px 12px',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    color: '#6b7280',
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const,
    marginTop: '8px',
  };

  const buttonStyle = (variant: 'primary' | 'secondary' | 'success' = 'secondary', disabled = false): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    background: variant === 'primary' ? '#3b82f6' : variant === 'success' ? '#10b981' : '#e5e7eb',
    color: variant === 'primary' || variant === 'success' ? 'white' : '#374151',
    opacity: disabled ? 0.5 : 1,
  });

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px',
  };

  const radioGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
  };

  const radioLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
  };

  const checkboxGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    marginTop: '8px',
  };

  const checkboxLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
  };

  const previewBoxStyle: React.CSSProperties = {
    padding: '16px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    marginTop: '8px',
  };

  const previewItemStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#4b5563',
    marginBottom: '6px',
    display: 'flex',
    justifyContent: 'space-between',
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
    marginBottom: '12px',
  };

  const fileListStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '8px',
  };

  const fileItemStyle: React.CSSProperties = {
    padding: '4px 0',
    fontFamily: 'monospace',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>Export Workflow</div>
        <div style={subtitleStyle}>{workflowName}</div>

        {!result && (
          <>
            {/* Format Selection */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Export Format</label>
              <div style={radioGroupStyle}>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    value="yaml"
                    checked={format === 'yaml'}
                    onChange={(e) => setFormat('yaml')}
                    disabled={exporting}
                  />
                  YAML (Recommended)
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    value="json"
                    checked={format === 'json'}
                    onChange={(e) => setFormat('json')}
                    disabled={exporting}
                  />
                  JSON
                </label>
              </div>
              <div style={descriptionStyle}>
                YAML format is more human-readable and is the recommended format for Claude Code.
              </div>
            </div>

            {/* Output Path */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Export Location</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <button
                  style={buttonStyle('secondary')}
                  onClick={handleSelectPath}
                  disabled={exporting}
                >
                  Browse...
                </button>
                <div style={{ flex: 1 }}>
                  {customPath ? (
                    <div style={pathDisplayStyle}>{customPath}</div>
                  ) : (
                    <div style={descriptionStyle}>
                      Default: ~/.claude/exports/{workflowName.toLowerCase().replace(/\s+/g, '-')}-[date]
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Options */}
            <div style={sectionStyle}>
              <label style={labelStyle}>Export Options</label>
              <div style={checkboxGroupStyle}>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={includeAgents}
                    onChange={(e) => setIncludeAgents(e.target.checked)}
                    disabled={exporting}
                  />
                  Include agent files ({preview?.agentCount || 0} agents)
                </label>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={includeSkills}
                    onChange={(e) => setIncludeSkills(e.target.checked)}
                    disabled={exporting}
                  />
                  Include skill files ({preview?.skillCount || 0} skills)
                </label>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={includeReadme}
                    onChange={(e) => setIncludeReadme(e.target.checked)}
                    disabled={exporting}
                  />
                  Generate README.md
                </label>
              </div>
            </div>

            {/* Preview */}
            {preview && (
              <div style={sectionStyle}>
                <label style={labelStyle}>Export Preview</label>
                <div style={previewBoxStyle}>
                  <div style={previewItemStyle}>
                    <span>Workflow file:</span>
                    <span style={{ fontWeight: 600 }}>{workflowId}.{format}</span>
                  </div>
                  <div style={previewItemStyle}>
                    <span>Phases:</span>
                    <span style={{ fontWeight: 600 }}>{preview.phaseCount}</span>
                  </div>
                  {includeAgents && (
                    <div style={previewItemStyle}>
                      <span>Agents:</span>
                      <span style={{ fontWeight: 600 }}>{preview.agentCount}</span>
                    </div>
                  )}
                  {includeSkills && (
                    <div style={previewItemStyle}>
                      <span>Skills:</span>
                      <span style={{ fontWeight: 600 }}>{preview.skillCount}</span>
                    </div>
                  )}
                  {includeReadme && (
                    <div style={previewItemStyle}>
                      <span>Documentation:</span>
                      <span style={{ fontWeight: 600 }}>README.md</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Result */}
        {result && (
          <div style={resultBoxStyle(result.success)}>
            <div style={resultTitleStyle(result.success)}>
              {result.success ? 'Export Successful' : 'Export Failed'}
            </div>
            <div style={resultMessageStyle}>{result.message}</div>

            {result.success && result.exportedFiles && (
              <div style={fileListStyle}>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>Exported files:</div>
                {result.exportedFiles.workflow && (
                  <div style={fileItemStyle}>Workflow: {result.exportedFiles.workflow}</div>
                )}
                {result.exportedFiles.agents.length > 0 && (
                  <div style={fileItemStyle}>Agents: {result.exportedFiles.agents.length} file(s)</div>
                )}
                {result.exportedFiles.skills.length > 0 && (
                  <div style={fileItemStyle}>Skills: {result.exportedFiles.skills.length} file(s)</div>
                )}
                {result.exportedFiles.readme && (
                  <div style={fileItemStyle}>README: {result.exportedFiles.readme}</div>
                )}
              </div>
            )}

            {result.success && (
              <div style={{ marginTop: '16px' }}>
                <button
                  style={buttonStyle('success')}
                  onClick={handleOpenFolder}
                >
                  Open Export Folder
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={buttonGroupStyle}>
          <button
            style={buttonStyle('secondary')}
            onClick={onClose}
            disabled={exporting}
          >
            {result?.success ? 'Close' : 'Cancel'}
          </button>
          {!result?.success && (
            <button
              style={buttonStyle('primary', exporting)}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Export Workflow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
