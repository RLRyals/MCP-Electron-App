/**
 * WorkflowExecutionPanel Component
 * Interactive panel for real-time workflow execution management
 *
 * Features:
 * - View agent outputs in real-time
 * - Provide input to running agents
 * - Approve/reject phase outputs
 * - Edit agent outputs before approval
 * - See execution logs and phase history
 * - Live streaming updates via IPC events
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkflowDefinition, WorkflowPhase } from '../../types/workflow.js';

/**
 * Phase execution data from backend
 */
interface PhaseExecutionData {
  instanceId: string;
  phaseNumber: number;
  phaseName: string;
  agent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Log entry from workflow execution
 */
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  phaseNumber?: number;
}

/**
 * Component props
 */
export interface WorkflowExecutionPanelProps {
  instanceId: string;
  workflow: WorkflowDefinition;
  onClose?: () => void;
}

/**
 * Main WorkflowExecutionPanel component
 */
export const WorkflowExecutionPanel: React.FC<WorkflowExecutionPanelProps> = ({
  instanceId,
  workflow,
  onClose,
}) => {
  // State management
  const [currentPhase, setCurrentPhase] = useState<PhaseExecutionData | null>(null);
  const [phaseHistory, setPhaseHistory] = useState<PhaseExecutionData[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [userInput, setUserInput] = useState('');
  const [editedOutput, setEditedOutput] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHistoryPhase, setSelectedHistoryPhase] = useState<PhaseExecutionData | null>(null);

  // User input modal state
  const [userInputRequest, setUserInputRequest] = useState<{
    requestId: string;
    nodeId: string;
    nodeName: string;
    prompt: string;
    inputType: string;
    required: boolean;
    validation?: any;
    options?: any[];
    defaultValue?: any;
    validationError?: string;
  } | null>(null);
  const [userInputValue, setUserInputValue] = useState<any>('');

  // Claude Code setup dialog state
  const [showClaudeSetup, setShowClaudeSetup] = useState(false);
  const [claudeStatus, setClaudeStatus] = useState<{
    installed: boolean;
    loggedIn: boolean;
    version?: string;
    userName?: string;
  } | null>(null);

  // Refs for auto-scrolling
  const logsEndRef = useRef<HTMLDivElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs
  const scrollLogsToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-scroll to bottom of output
  const scrollOutputToBottom = useCallback(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Add log entry
  const addLog = useCallback((level: LogEntry['level'], message: string, phaseNumber?: number) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      phaseNumber,
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  // Handle phase started event
  const handlePhaseStarted = useCallback((data: any) => {
    if (!data || data.instanceId !== instanceId) return;

    const phaseData: PhaseExecutionData = {
      instanceId: data.instanceId,
      phaseNumber: data.phaseNumber,
      phaseName: data.phaseName || `Phase ${data.phaseNumber}`,
      agent: data.agent || 'Unknown',
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    };

    setCurrentPhase(phaseData);
    setEditedOutput('');
    addLog('info', `Started: ${phaseData.phaseName}`, data.phaseNumber);
  }, [instanceId, addLog]);

  // Handle phase completed event
  const handlePhaseCompleted = useCallback((data: any) => {
    if (!data || data.instanceId !== instanceId) return;

    setCurrentPhase(prev => {
      if (!prev || prev.phaseNumber !== data.phaseNumber) return prev;

      const updated: PhaseExecutionData = {
        ...prev,
        status: 'completed',
        output: data.output || '',
        completedAt: new Date().toISOString(),
      };

      // Move to history
      setPhaseHistory(prevHistory => [...prevHistory, updated]);
      addLog('success', `Completed: ${prev.phaseName}`, data.phaseNumber);

      return null; // Clear current phase
    });
  }, [instanceId, addLog]);

  // Handle phase failed event
  const handlePhaseFailed = useCallback(async (data: any) => {
    if (!data || data.instanceId !== instanceId) return;

    // Check if this is a Claude Code setup error
    const errorMsg = data.error || '';
    if (errorMsg.includes('Claude Code CLI is not installed') || errorMsg.includes('not logged in to Claude')) {
      // Get Claude status and show setup dialog
      const electronAPI = (window as any).electronAPI;
      try {
        const status = await electronAPI.claudeCode.getStatus();
        setClaudeStatus(status);
        setShowClaudeSetup(true);
      } catch (err) {
        console.error('Failed to get Claude status:', err);
      }
    }

    setCurrentPhase(prev => {
      if (!prev || prev.phaseNumber !== data.phaseNumber) return prev;

      const updated: PhaseExecutionData = {
        ...prev,
        status: 'failed',
        error: data.error || 'Unknown error',
        completedAt: new Date().toISOString(),
      };

      // Move to history
      setPhaseHistory(prevHistory => [...prevHistory, updated]);
      addLog('error', `Failed: ${prev.phaseName} - ${data.error}`, data.phaseNumber);
      setError(data.error || 'Phase execution failed');

      return null;
    });
  }, [instanceId, addLog]);

  // Handle approval required event
  const handleApprovalRequired = useCallback((data: any) => {
    if (!data || data.instanceId !== instanceId) return;

    setCurrentPhase(prev => {
      if (!prev || prev.phaseNumber !== data.phaseNumber) return prev;

      const updated: PhaseExecutionData = {
        ...prev,
        output: data.output || prev.output || '',
      };

      setEditedOutput(data.output || '');
      addLog('warning', `Approval required: ${prev.phaseName}`, data.phaseNumber);

      return updated;
    });
  }, [instanceId, addLog]);

  // Handle phase output/event updates
  const handlePhaseEvent = useCallback((data: any) => {
    if (!data || data.instanceId !== instanceId) return;

    // Handle streaming output updates
    if (data.type === 'output' && data.output) {
      setCurrentPhase(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          output: (prev.output || '') + data.output,
        };
      });
    }

    // Handle other event types
    if (data.message) {
      addLog('info', data.message, data.phaseNumber);
    }
  }, [instanceId, addLog]);

  // Handle user input required event
  const handleUserInputRequired = useCallback((data: any) => {
    console.log('[WorkflowExecutionPanel] User input required event received:', data);
    if (!data) {
      console.warn('[WorkflowExecutionPanel] Received undefined user input event');
      return;
    }
    if (data.instanceId !== instanceId) {
      console.log('[WorkflowExecutionPanel] Event instanceId mismatch:', data.instanceId, 'vs', instanceId);
      return;
    }

    console.log('[WorkflowExecutionPanel] Setting user input request');
    setUserInputRequest(data);
    setUserInputValue(data.defaultValue || '');
    addLog('warning', `Input required: ${data.prompt}`, data.nodeId);
  }, [instanceId, addLog]);

  // Setup IPC event listeners
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.on || !electronAPI.off) {
      setError('Electron API not available');
      return;
    }

    // Register listeners
    electronAPI.on('workflow:phase-started', handlePhaseStarted);
    electronAPI.on('workflow:phase-completed', handlePhaseCompleted);
    electronAPI.on('workflow:phase-failed', handlePhaseFailed);
    electronAPI.on('workflow:approval-required', handleApprovalRequired);
    electronAPI.on('workflow:phase-event', handlePhaseEvent);
    electronAPI.on('workflow:user-input-required', handleUserInputRequired);

    addLog('info', `Workflow execution started: ${workflow.name}`);

    // Cleanup on unmount
    return () => {
      electronAPI.off('workflow:phase-started', handlePhaseStarted);
      electronAPI.off('workflow:phase-completed', handlePhaseCompleted);
      electronAPI.off('workflow:phase-failed', handlePhaseFailed);
      electronAPI.off('workflow:approval-required', handleApprovalRequired);
      electronAPI.off('workflow:phase-event', handlePhaseEvent);
      electronAPI.off('workflow:user-input-required', handleUserInputRequired);
    };
  }, [
    handlePhaseStarted,
    handlePhaseCompleted,
    handlePhaseFailed,
    handleApprovalRequired,
    handlePhaseEvent,
    handleUserInputRequired,
    workflow.name,
    addLog,
  ]);

  // Auto-scroll logs when new entries arrive
  useEffect(() => {
    scrollLogsToBottom();
  }, [logs, scrollLogsToBottom]);

  // Auto-scroll output when it updates
  useEffect(() => {
    if (currentPhase?.output) {
      scrollOutputToBottom();
    }
  }, [currentPhase?.output, scrollOutputToBottom]);

  // Send user input to workflow
  const handleSendInput = async () => {
    if (!userInput.trim() || !currentPhase) return;

    try {
      setIsLoading(true);
      const electronAPI = (window as any).electronAPI;

      await electronAPI.invoke('workflow:send-user-input', instanceId, userInput);

      addLog('info', `User input sent: ${userInput.substring(0, 50)}...`, currentPhase.phaseNumber);
      setUserInput('');
      setError(null);
    } catch (err: any) {
      setError(`Failed to send input: ${err.message}`);
      addLog('error', `Failed to send input: ${err.message}`, currentPhase.phaseNumber);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit user input from modal
  const handleSubmitUserInput = async () => {
    if (!userInputRequest) return;

    // Check if required field is empty
    if (userInputRequest.required && !userInputValue) return;

    try {
      setIsLoading(true);
      const electronAPI = (window as any).electronAPI;

      await electronAPI.invoke('workflow:send-user-input', userInputRequest.requestId, userInputValue);

      addLog('info', `Input submitted: ${String(userInputValue).substring(0, 50)}...`);
      setUserInputRequest(null);
      setUserInputValue('');
      setError(null);
    } catch (err: any) {
      setError(`Failed to send input: ${err.message}`);
      addLog('error', `Failed to send input: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Approve phase output
  const handleApprove = async () => {
    if (!currentPhase) return;

    try {
      setIsLoading(true);
      const electronAPI = (window as any).electronAPI;

      const outputToApprove = editedOutput || currentPhase.output || '';

      await electronAPI.invoke(
        'workflow:approve-phase',
        instanceId,
        currentPhase.phaseNumber,
        outputToApprove
      );

      addLog('success', `Phase approved: ${currentPhase.phaseName}`, currentPhase.phaseNumber);
      setError(null);
    } catch (err: any) {
      setError(`Failed to approve phase: ${err.message}`);
      addLog('error', `Failed to approve: ${err.message}`, currentPhase.phaseNumber);
    } finally {
      setIsLoading(false);
    }
  };

  // Reject phase output
  const handleReject = async () => {
    if (!currentPhase || !rejectReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    try {
      setIsLoading(true);
      const electronAPI = (window as any).electronAPI;

      await electronAPI.invoke(
        'workflow:reject-phase',
        instanceId,
        currentPhase.phaseNumber,
        rejectReason
      );

      addLog('warning', `Phase rejected: ${currentPhase.phaseName} - ${rejectReason}`, currentPhase.phaseNumber);
      setRejectReason('');
      setShowRejectDialog(false);
      setError(null);
    } catch (err: any) {
      setError(`Failed to reject phase: ${err.message}`);
      addLog('error', `Failed to reject: ${err.message}`, currentPhase.phaseNumber);
    } finally {
      setIsLoading(false);
    }
  };

  // Get current phase definition
  const getCurrentPhaseDefinition = (): WorkflowPhase | undefined => {
    if (!currentPhase) return undefined;
    return workflow.phases.find(p => p.id === currentPhase.phaseNumber);
  };

  const phaseDefinition = getCurrentPhaseDefinition();
  const requiresApproval = phaseDefinition?.requiresApproval || false;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h2 style={styles.title}>{workflow.name}</h2>
          <div style={styles.subtitle}>Instance: {instanceId}</div>
        </div>
        {onClose && (
          <button style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          <div style={styles.errorContent}>
            <strong>Error:</strong> {error}
          </div>
          <div style={styles.errorActions}>
            {error.includes('No Anthropic API key') && (
              <button
                style={styles.errorFixButton}
                onClick={() => {
                  // Open provider configuration
                  // This will be handled by parent component or settings
                  alert('Opening provider configuration...\n\n1. Get your API key from https://console.anthropic.com/settings/keys\n2. Click "Add Provider" in Settings\n3. Select "Claude API" and paste your key');
                }}
              >
                🔧 Fix Now
              </button>
            )}
            <button style={styles.errorDismiss} onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div style={styles.mainContent}>
        {/* Left panel: Output and controls */}
        <div style={styles.leftPanel}>
          {/* Phase Header */}
          {currentPhase && (
            <PhaseHeader
              phase={currentPhase}
              phaseDefinition={phaseDefinition}
            />
          )}

          {/* Output Viewer */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Agent Output</h3>
            <OutputViewer
              output={currentPhase?.output || ''}
              editedOutput={editedOutput}
              onEdit={setEditedOutput}
              isEditable={requiresApproval}
              isStreaming={currentPhase?.status === 'in_progress'}
            />
            <div ref={outputEndRef} />
          </div>

          {/* User Input Panel - VS Code style */}
          {userInputRequest && (
            <div style={styles.section}>
              <div style={styles.userInputPanel}>
                <div style={styles.userInputHeader}>
                  <h4 style={styles.userInputTitle}>⚠️ Input Required: {userInputRequest.nodeName}</h4>
                  <button
                    style={styles.userInputCloseBtn}
                    onClick={() => {
                      setUserInputRequest(null);
                      setUserInputValue('');
                    }}
                    disabled={isLoading}
                  >
                    ✕
                  </button>
                </div>
                <p style={styles.userInputPrompt}>{userInputRequest.prompt}</p>

                {/* Show validation requirements upfront */}
                {userInputRequest.validation && (userInputRequest.validation.minLength || userInputRequest.validation.maxLength) && (
                  <div style={styles.validationInfo}>
                    ℹ️ {userInputRequest.validation.minLength && `Minimum ${userInputRequest.validation.minLength} characters`}
                    {userInputRequest.validation.minLength && userInputRequest.validation.maxLength && ' • '}
                    {userInputRequest.validation.maxLength && `Maximum ${userInputRequest.validation.maxLength} characters`}
                  </div>
                )}

                {userInputRequest.validationError && (
                  <div style={styles.validationError}>
                    ❌ {userInputRequest.validationError}
                  </div>
                )}

                {userInputRequest.inputType === 'select' && userInputRequest.options ? (
                  <select
                    style={styles.userInputSelect}
                    value={userInputValue}
                    onChange={(e) => setUserInputValue(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="">-- Select --</option>
                    {userInputRequest.options.map((opt: any) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : userInputRequest.inputType === 'textarea' ? (
                  <>
                    <textarea
                      style={styles.userInputTextarea}
                      value={userInputValue}
                      onChange={(e) => setUserInputValue(e.target.value)}
                      placeholder="Enter your input..."
                      disabled={isLoading}
                      autoFocus
                    />
                    {/* Character counter for textarea */}
                    {(userInputRequest.validation?.minLength || userInputRequest.validation?.maxLength) && (
                      <div style={styles.characterCounter}>
                        {userInputValue.length}
                        {userInputRequest.validation?.maxLength && ` / ${userInputRequest.validation.maxLength}`}
                        {' characters'}
                        {userInputRequest.validation?.minLength && userInputValue.length < userInputRequest.validation.minLength && (
                          <span style={styles.characterCounterWarning}>
                            {' '}(need {userInputRequest.validation.minLength - userInputValue.length} more)
                          </span>
                        )}
                        {userInputRequest.validation?.maxLength && userInputValue.length > userInputRequest.validation.maxLength && (
                          <span style={styles.characterCounterWarning}>
                            {' '}({userInputValue.length - userInputRequest.validation.maxLength} over limit)
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : userInputRequest.inputType === 'number' ? (
                  <input
                    type="number"
                    style={styles.userInputField}
                    value={userInputValue}
                    onChange={(e) => setUserInputValue(e.target.value)}
                    placeholder="Enter a number..."
                    disabled={isLoading}
                    autoFocus
                  />
                ) : (
                  <input
                    type="text"
                    style={styles.userInputField}
                    value={userInputValue}
                    onChange={(e) => setUserInputValue(e.target.value)}
                    placeholder="Enter your input..."
                    disabled={isLoading}
                    autoFocus
                  />
                )}

                {userInputRequest.required && (
                  <div style={styles.userInputHint}>* This field is required</div>
                )}

                <div style={styles.userInputActions}>
                  <button
                    style={styles.userInputCancelBtn}
                    onClick={() => {
                      setUserInputRequest(null);
                      setUserInputValue('');
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    style={{
                      ...styles.userInputSubmitBtn,
                      opacity: (!userInputValue && userInputRequest.required) || isLoading ? 0.5 : 1
                    }}
                    onClick={handleSubmitUserInput}
                    disabled={(!userInputValue && userInputRequest.required) || isLoading}
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input Box */}
          {currentPhase && !userInputRequest && (
            <div style={styles.section}>
              <InputBox
                value={userInput}
                onChange={setUserInput}
                onSend={handleSendInput}
                disabled={isLoading || currentPhase.status !== 'in_progress'}
              />
            </div>
          )}

          {/* Approval Controls */}
          {currentPhase && requiresApproval && (
            <div style={styles.section}>
              <ApprovalControls
                onApprove={handleApprove}
                onReject={() => setShowRejectDialog(true)}
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        {/* Right panel: History and logs */}
        <div style={styles.rightPanel}>
          {/* Phase History */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Phase History</h3>
            <PhaseHistory
              history={phaseHistory}
              onSelect={setSelectedHistoryPhase}
              selected={selectedHistoryPhase}
            />
          </div>

          {/* Log Viewer */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Execution Logs</h3>
            <LogViewer logs={logs} />
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <RejectDialog
          reason={rejectReason}
          onReasonChange={setRejectReason}
          onConfirm={handleReject}
          onCancel={() => {
            setShowRejectDialog(false);
            setRejectReason('');
          }}
          disabled={isLoading}
        />
      )}

      {/* Claude Code Setup Dialog */}
      {showClaudeSetup && claudeStatus && (
        <div style={styles.dialogOverlay}>
          <div style={styles.dialogContent}>
            <h3 style={styles.dialogTitle}>⚠️ Claude Code CLI Setup Required</h3>

            {!claudeStatus.installed ? (
              <>
                <p style={styles.dialogDescription}>
                  Claude Code CLI is not installed. You need to install it to run workflows that use your Claude subscription.
                </p>
                <div style={{marginBottom: '16px', padding: '12px', background: '#f3f4f6', borderRadius: '6px'}}>
                  <p style={{margin: 0, fontSize: '13px', lineHeight: '1.6'}}>
                    <strong>Installation Steps:</strong><br/>
                    1. Open a terminal<br/>
                    2. Run: <code style={{background: '#e5e7eb', padding: '2px 6px', borderRadius: '3px'}}>npm install -g @anthropic-ai/claude-code</code><br/>
                    3. After installation, run: <code style={{background: '#e5e7eb', padding: '2px 6px', borderRadius: '3px'}}>claude auth login</code><br/>
                    4. Follow the prompts to log in with your Anthropic account
                  </p>
                </div>
                <div style={styles.dialogButtons}>
                  <button
                    style={styles.dialogButtonConfirm}
                    onClick={async () => {
                      const electronAPI = (window as any).electronAPI;
                      await electronAPI.claudeCode.openInstallPage();
                    }}
                  >
                    Open Claude Code Page
                  </button>
                  <button
                    style={styles.dialogButtonCancel}
                    onClick={() => setShowClaudeSetup(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : !claudeStatus.loggedIn ? (
              <>
                <p style={styles.dialogDescription}>
                  Claude Code CLI is installed but you're not logged in. You need to authenticate to use your Claude subscription.
                </p>
                <div style={{marginBottom: '16px', padding: '12px', background: '#f3f4f6', borderRadius: '6px'}}>
                  <p style={{margin: 0, fontSize: '13px', lineHeight: '1.6'}}>
                    <strong>Login Steps:</strong><br/>
                    1. Open a terminal<br/>
                    2. Run: <code style={{background: '#e5e7eb', padding: '2px 6px', borderRadius: '3px'}}>claude auth login</code><br/>
                    3. Follow the prompts to log in with your Anthropic account
                  </p>
                </div>
                <div style={styles.dialogButtons}>
                  <button
                    style={styles.dialogButtonCancel}
                    onClick={() => setShowClaudeSetup(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
};

/**
 * PhaseHeader Component
 * Displays current phase information
 */
interface PhaseHeaderProps {
  phase: PhaseExecutionData;
  phaseDefinition?: WorkflowPhase;
}

const PhaseHeader: React.FC<PhaseHeaderProps> = ({ phase, phaseDefinition }) => {
  const statusColor = {
    pending: '#9ca3af',
    in_progress: '#60a5fa',
    completed: '#4ade80',
    failed: '#f87171',
  }[phase.status];

  return (
    <div style={styles.phaseHeader}>
      <div style={styles.phaseHeaderTop}>
        <div style={styles.phaseHeaderLeft}>
          <h3 style={styles.phaseName}>{phase.phaseName}</h3>
          <div style={styles.phaseAgent}>Agent: {phase.agent}</div>
        </div>
        <div style={{ ...styles.statusBadge, background: statusColor }}>
          {phase.status.replace('_', ' ').toUpperCase()}
        </div>
      </div>
      {phaseDefinition && (
        <div style={styles.phaseDescription}>{phaseDefinition.description}</div>
      )}
      {phaseDefinition?.skill && (
        <div style={styles.phaseSkill}>Skill: {phaseDefinition.skill}</div>
      )}
    </div>
  );
};

/**
 * OutputViewer Component
 * Displays and allows editing of agent output
 */
interface OutputViewerProps {
  output: string;
  editedOutput: string;
  onEdit: (value: string) => void;
  isEditable: boolean;
  isStreaming: boolean;
}

const OutputViewer: React.FC<OutputViewerProps> = ({
  output,
  editedOutput,
  onEdit,
  isEditable,
  isStreaming,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);

  const displayContent = isEditMode ? editedOutput : output;

  return (
    <div style={styles.outputViewer}>
      {isEditable && !isStreaming && (
        <div style={styles.outputToolbar}>
          <button
            style={styles.outputToolbarButton}
            onClick={() => {
              if (!isEditMode) {
                onEdit(output);
              }
              setIsEditMode(!isEditMode);
            }}
          >
            {isEditMode ? '👁️ Preview' : '✏️ Edit'}
          </button>
        </div>
      )}
      {isEditMode ? (
        <textarea
          style={styles.outputTextarea}
          value={editedOutput}
          onChange={(e) => onEdit(e.target.value)}
          placeholder="Edit the output before approval..."
        />
      ) : (
        <div style={styles.outputContent}>
          {isStreaming && <div style={styles.streamingIndicator}>Streaming...</div>}
          <pre style={styles.outputPre}>{displayContent || 'No output yet...'}</pre>
        </div>
      )}
    </div>
  );
};

/**
 * InputBox Component
 * User input area for interacting with agents
 */
interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

const InputBox: React.FC<InputBoxProps> = ({ value, onChange, onSend, disabled }) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      onSend();
    }
  };

  return (
    <div style={styles.inputBox}>
      <h4 style={styles.inputLabel}>Your Input</h4>
      <textarea
        style={styles.inputTextarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type your input here... (Ctrl+Enter to send)"
        disabled={disabled}
      />
      <button
        style={{ ...styles.sendButton, opacity: disabled ? 0.5 : 1 }}
        onClick={onSend}
        disabled={disabled || !value.trim()}
      >
        📤 Send
      </button>
    </div>
  );
};

/**
 * ApprovalControls Component
 * Approve/Reject buttons for phase outputs
 */
interface ApprovalControlsProps {
  onApprove: () => void;
  onReject: () => void;
  disabled: boolean;
}

const ApprovalControls: React.FC<ApprovalControlsProps> = ({
  onApprove,
  onReject,
  disabled,
}) => {
  return (
    <div style={styles.approvalControls}>
      <h4 style={styles.inputLabel}>Review & Approve</h4>
      <div style={styles.approvalButtons}>
        <button
          style={{ ...styles.approveButton, opacity: disabled ? 0.5 : 1 }}
          onClick={onApprove}
          disabled={disabled}
        >
          ✓ Approve
        </button>
        <button
          style={{ ...styles.rejectButton, opacity: disabled ? 0.5 : 1 }}
          onClick={onReject}
          disabled={disabled}
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
};

/**
 * PhaseHistory Component
 * List of completed phases
 */
interface PhaseHistoryProps {
  history: PhaseExecutionData[];
  onSelect: (phase: PhaseExecutionData | null) => void;
  selected: PhaseExecutionData | null;
}

const PhaseHistory: React.FC<PhaseHistoryProps> = ({ history, onSelect, selected }) => {
  if (history.length === 0) {
    return <div style={styles.emptyState}>No completed phases yet</div>;
  }

  return (
    <div style={styles.historyList}>
      {history.map((phase, index) => (
        <div
          key={`${phase.phaseNumber}-${index}`}
          style={{
            ...styles.historyItem,
            ...(selected?.phaseNumber === phase.phaseNumber ? styles.historyItemSelected : {}),
          }}
          onClick={() => onSelect(selected?.phaseNumber === phase.phaseNumber ? null : phase)}
        >
          <div style={styles.historyItemHeader}>
            <span style={styles.historyItemName}>{phase.phaseName}</span>
            <span
              style={{
                ...styles.historyItemStatus,
                color: phase.status === 'completed' ? '#4ade80' : '#f87171',
              }}
            >
              {phase.status === 'completed' ? '✓' : '✕'}
            </span>
          </div>
          <div style={styles.historyItemAgent}>Agent: {phase.agent}</div>
          {selected?.phaseNumber === phase.phaseNumber && phase.output && (
            <div style={styles.historyItemOutput}>
              <pre style={styles.historyItemOutputPre}>{phase.output}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * LogViewer Component
 * Displays execution logs
 */
interface LogViewerProps {
  logs: LogEntry[];
}

const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  if (logs.length === 0) {
    return <div style={styles.emptyState}>No logs yet</div>;
  }

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return '#4ade80';
      case 'error':
        return '#f87171';
      case 'warning':
        return '#fbbf24';
      default:
        return '#9ca3af';
    }
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      default:
        return '•';
    }
  };

  return (
    <div style={styles.logList}>
      {logs.map((log, index) => (
        <div key={index} style={styles.logEntry}>
          <span style={{ ...styles.logLevel, color: getLevelColor(log.level) }}>
            {getLevelIcon(log.level)}
          </span>
          <span style={styles.logTimestamp}>
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          <span style={styles.logMessage}>{log.message}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * RejectDialog Component
 * Modal dialog for rejecting phases
 */
interface RejectDialogProps {
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  disabled: boolean;
}

const RejectDialog: React.FC<RejectDialogProps> = ({
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
  disabled,
}) => {
  return (
    <div style={styles.dialogOverlay}>
      <div style={styles.dialogContent}>
        <h3 style={styles.dialogTitle}>Reject Phase Output</h3>
        <p style={styles.dialogDescription}>
          Please provide a reason for rejecting this phase output:
        </p>
        <textarea
          style={styles.dialogTextarea}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Explain what needs to be improved..."
          autoFocus
        />
        <div style={styles.dialogButtons}>
          <button
            style={{ ...styles.dialogButtonCancel, opacity: disabled ? 0.5 : 1 }}
            onClick={onCancel}
            disabled={disabled}
          >
            Cancel
          </button>
          <button
            style={{ ...styles.dialogButtonConfirm, opacity: disabled ? 0.5 : 1 }}
            onClick={onConfirm}
            disabled={disabled || !reason.trim()}
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Styles
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#ffffff',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#1f2937',
  },
  subtitle: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#6b7280',
  },
  closeButton: {
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#6b7280',
    transition: 'color 0.2s ease',
  },
  errorBanner: {
    padding: '16px 24px',
    background: 'rgba(220, 38, 38, 0.1)',
    borderBottom: '1px solid rgba(220, 38, 38, 0.3)',
    color: '#dc2626',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
  },
  errorContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  errorActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  errorFixButton: {
    padding: '8px 16px',
    background: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s ease',
    whiteSpace: 'nowrap' as const,
  },
  errorDismiss: {
    padding: '4px 8px',
    background: 'transparent',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    color: '#dc2626',
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
    flex: 2,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #e5e7eb',
    overflow: 'auto',
    padding: '16px',
    gap: '16px',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    padding: '16px',
    gap: '16px',
    background: '#f9fafb',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  phaseHeader: {
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  phaseHeaderTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  phaseHeaderLeft: {
    flex: 1,
  },
  phaseName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2937',
  },
  phaseAgent: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#6b7280',
  },
  phaseDescription: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#4b5563',
    lineHeight: '1.5',
  },
  phaseSkill: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: 700,
    color: 'white',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  outputViewer: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  outputToolbar: {
    padding: '8px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  outputToolbarButton: {
    padding: '6px 12px',
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  outputContent: {
    position: 'relative',
    maxHeight: '400px',
    overflow: 'auto',
    background: '#ffffff',
  },
  streamingIndicator: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '4px 8px',
    background: '#60a5fa',
    color: 'white',
    fontSize: '10px',
    fontWeight: 600,
    borderRadius: '4px',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  outputPre: {
    margin: 0,
    padding: '16px',
    fontSize: '13px',
    lineHeight: '1.6',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#1f2937',
  },
  outputTextarea: {
    padding: '16px',
    fontSize: '13px',
    lineHeight: '1.6',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    border: 'none',
    resize: 'vertical',
    minHeight: '300px',
    outline: 'none',
  },
  inputBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputLabel: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: '#4b5563',
  },
  inputTextarea: {
    padding: '12px',
    fontSize: '13px',
    lineHeight: '1.5',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    resize: 'vertical',
    minHeight: '80px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  sendButton: {
    padding: '10px 20px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    alignSelf: 'flex-start',
  },
  approvalControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  approvalButtons: {
    display: 'flex',
    gap: '12px',
  },
  approveButton: {
    flex: 1,
    padding: '12px 24px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  rejectButton: {
    flex: 1,
    padding: '12px 24px',
    background: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '300px',
    overflow: 'auto',
  },
  historyItem: {
    padding: '12px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  historyItemSelected: {
    borderColor: '#3b82f6',
    background: '#eff6ff',
  },
  historyItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  historyItemName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1f2937',
  },
  historyItemStatus: {
    fontSize: '14px',
    fontWeight: 700,
  },
  historyItemAgent: {
    fontSize: '11px',
    color: '#6b7280',
  },
  historyItemOutput: {
    marginTop: '8px',
    padding: '8px',
    background: '#f9fafb',
    borderRadius: '4px',
    maxHeight: '200px',
    overflow: 'auto',
  },
  historyItemOutputPre: {
    margin: 0,
    fontSize: '11px',
    lineHeight: '1.5',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#374151',
  },
  logList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '300px',
    overflow: 'auto',
    padding: '8px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
  },
  logEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    lineHeight: '1.5',
  },
  logLevel: {
    fontWeight: 700,
    fontSize: '14px',
  },
  logTimestamp: {
    color: '#9ca3af',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: '11px',
  },
  logMessage: {
    flex: 1,
    color: '#374151',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '13px',
    fontStyle: 'italic',
  },
  dialogOverlay: {
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
  },
  dialogContent: {
    background: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
  },
  dialogTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
  },
  dialogDescription: {
    margin: '0 0 16px 0',
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.5',
  },
  dialogTextarea: {
    width: '100%',
    padding: '12px',
    fontSize: '13px',
    lineHeight: '1.5',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    resize: 'vertical',
    minHeight: '100px',
    outline: 'none',
    marginBottom: '16px',
  },
  dialogButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  dialogButtonCancel: {
    padding: '10px 20px',
    background: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  dialogButtonConfirm: {
    padding: '10px 20px',
    background: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  // User Input Panel styles - VS Code style inline panel
  userInputPanel: {
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '16px',
  },
  userInputHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  userInputTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#1f2937',
  },
  userInputCloseBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0 4px',
  },
  userInputPrompt: {
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#374151',
    marginBottom: '12px',
  },
  userInputField: {
    width: '100%',
    padding: '10px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  userInputTextarea: {
    width: '100%',
    padding: '10px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    outline: 'none',
    minHeight: '100px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  },
  userInputSelect: {
    width: '100%',
    padding: '10px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    outline: 'none',
  },
  userInputHint: {
    marginTop: '6px',
    fontSize: '11px',
    color: '#dc2626',
    fontStyle: 'italic',
  },
  userInputActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
    justifyContent: 'flex-end',
  },
  userInputCancelBtn: {
    padding: '8px 16px',
    background: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  userInputSubmitBtn: {
    padding: '8px 16px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  validationError: {
    padding: '12px',
    marginBottom: '12px',
    background: '#fee2e2',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '14px',
    fontWeight: 600,
  },
  validationInfo: {
    padding: '10px',
    marginBottom: '12px',
    background: '#dbeafe',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    color: '#1e40af',
    fontSize: '13px',
    fontWeight: 500,
  },
  characterCounter: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'right' as const,
  },
  characterCounterWarning: {
    color: '#dc2626',
    fontWeight: 600,
  },
};
