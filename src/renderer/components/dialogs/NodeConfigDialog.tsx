/**
 * NodeConfigDialog Component
 *
 * Fully accessible tabbed dialog for configuring workflow nodes.
 * Implements WCAG 2.1 Level AA and Section 508 compliance.
 *
 * Features:
 * - Five accessible tabs with keyboard navigation
 * - Full ARIA support (roles, states, properties)
 * - Focus management and tab trapping
 * - Form validation with accessible error messages
 * - Keyboard shortcuts (Esc to cancel, Ctrl+Enter to save)
 * - High contrast mode support
 *
 * Usage:
 * ```tsx
 * <NodeConfigDialog
 *   node={selectedNode}
 *   availableProviders={providers}
 *   onSave={(node) => handleSave(node)}
 *   onCancel={() => setDialogOpen(false)}
 * />
 * ```
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { WorkflowNode } from '../../../types/workflow-nodes';
import type { LLMProviderConfig } from '../../../types/llm-providers';
import { AgentSkillSelector } from '../AgentSkillSelector.js';
import { AgentSkillActionButtons } from '../AgentSkillActionButtons.js';
import { CreateAgentDialog } from './CreateAgentDialog.js';
import { CreateSkillDialog } from './CreateSkillDialog.js';
import { DocumentEditDialog } from './DocumentEditDialog.js';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface NodeConfigDialogProps {
  node: WorkflowNode | null;
  availableProviders: LLMProviderConfig[];
  onSave: (node: WorkflowNode) => void;
  onCancel: () => void;
}

type TabId = 'basic' | 'config' | 'provider' | 'context' | 'advanced';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  visible: boolean;
}

interface ValidationError {
  field: string;
  message: string;
  tabId: TabId;
}

// Node type configurations
const NODE_TYPE_CONFIGS = [
  { value: 'planning', label: 'Planning Agent', icon: '📋' },
  { value: 'writing', label: 'Writing Agent', icon: '✍️' },
  { value: 'gate', label: 'Gate Agent', icon: '🚪' },
  { value: 'user-input', label: 'User Input', icon: '👤' },
  { value: 'code', label: 'Code Execution', icon: '⚙️' },
  { value: 'http', label: 'HTTP Request', icon: '🌐' },
  { value: 'file', label: 'File Operation', icon: '📁' },
  { value: 'conditional', label: 'Conditional', icon: '🔀' },
  { value: 'loop', label: 'Loop', icon: '🔄' },
  { value: 'subworkflow', label: 'Sub-Workflow', icon: '📦' },
] as const;

// ============================================================================
// Main Component
// ============================================================================

export const NodeConfigDialog: React.FC<NodeConfigDialogProps> = ({
  node,
  availableProviders,
  onSave,
  onCancel,
}) => {
  // ============================================================================
  // State Management
  // ============================================================================

  const [formData, setFormData] = useState<WorkflowNode | null>(node);
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [contextMode, setContextMode] = useState<'simple' | 'advanced'>('simple');

  // Agent/Skill management state
  const [installedAgents, setInstalledAgents] = useState<string[]>([]);
  const [installedSkills, setInstalledSkills] = useState<string[]>([]);
  const [editingAgent, setEditingAgent] = useState<{ name: string; content: string; filePath: string } | null>(null);
  const [editingSkill, setEditingSkill] = useState<{ name: string; content: string; filePath: string } | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [creatingSkill, setCreatingSkill] = useState(false);

  // ============================================================================
  // Refs for Focus Management
  // ============================================================================

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const errorAnnouncerRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // Tab Configuration
  // ============================================================================

  const tabs: Tab[] = [
    { id: 'basic', label: 'Basic Info', icon: '📝', visible: true },
    { id: 'config', label: 'Configuration', icon: '⚙️', visible: true },
    {
      id: 'provider',
      label: 'LLM Provider',
      icon: '🤖',
      visible: isAgentNode(formData),
    },
    { id: 'context', label: 'Context & Variables', icon: '🔗', visible: true },
    { id: 'advanced', label: 'Advanced', icon: '🔧', visible: true },
  ];

  const visibleTabs = tabs.filter(tab => tab.visible);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function isAgentNode(node: WorkflowNode | null): boolean {
    if (!node) return false;
    return node.type === 'planning' || node.type === 'writing' || node.type === 'gate';
  }

  // ============================================================================
  // Effects
  // ============================================================================

  // Initialize form data when node changes
  useEffect(() => {
    if (node) {
      setFormData(node);
      setContextMode(node.contextConfig?.mode || 'simple');
      setIsDirty(false);
      setErrors([]);
    }
  }, [node]);

  // Auto-focus name input on mount
  useEffect(() => {
    if (nameInputRef.current && node) {
      // Delay to ensure dialog is fully rendered
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [node]);

  // Load installed agents and skills
  useEffect(() => {
    const loadInstalled = async () => {
      try {
        const agents = await (window as any).electronAPI.workflows.getInstalledAgents();
        const skills = await (window as any).electronAPI.workflows.getInstalledSkills();
        setInstalledAgents(agents || []);
        setInstalledSkills(skills || []);
      } catch (error) {
        console.error('Failed to load installed agents/skills:', error);
      }
    };

    if (node) {
      loadInstalled();
    }
  }, [node]);

  // Announce errors to screen readers
  useEffect(() => {
    if (errors.length > 0 && errorAnnouncerRef.current) {
      const errorMessage = `${errors.length} validation ${errors.length === 1 ? 'error' : 'errors'} found. Please fix and try again.`;
      errorAnnouncerRef.current.textContent = errorMessage;
    }
  }, [errors]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData(prev => {
      if (!prev) return prev;

      const updated = { ...prev, [field]: value };

      // When changing to an agent node type, ensure provider exists
      if (field === 'type' && (value === 'planning' || value === 'writing' || value === 'gate')) {
        const agentNode = updated as any;
        if (!agentNode.provider) {
          agentNode.provider = {
            type: 'claude-code-cli',
            name: 'Claude Code (Your Subscription)',
            config: { model: 'claude-sonnet-4-5', outputFormat: 'text' }
          };
        }
        // Also ensure agent and gate fields exist
        if (!agentNode.agent) agentNode.agent = 'general-purpose';
        if (agentNode.gate === undefined) agentNode.gate = (value === 'gate');

        // Add default prompt if missing (REQUIRED field)
        if (!agentNode.prompt) {
          const defaultPrompts: Record<string, string> = {
            'planning': 'Please analyze the following and create a detailed plan:\n\n{{input}}\n\nProvide a structured, actionable plan.',
            'writing': 'Please write content based on the following:\n\n{{input}}\n\nCreate clear, engaging content.',
            'gate': 'Please evaluate the following work:\n\n{{input}}\n\nProvide a quality score (0-100) and feedback.'
          };
          agentNode.prompt = defaultPrompts[value] || 'Process the following:\n\n{{input}}';
        }
      }

      return updated;
    });
    setIsDirty(true);

    // Clear errors for this field
    setErrors(prev => prev.filter(err => err.field !== field));
  }, []); // Remove formData dependency - we use prev parameter instead

  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
  }, []);

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, tabId: TabId) => {
    const currentIndex = visibleTabs.findIndex(tab => tab.id === tabId);

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % visibleTabs.length;
        setActiveTab(visibleTabs[nextIndex].id);
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = currentIndex === 0 ? visibleTabs.length - 1 : currentIndex - 1;
        setActiveTab(visibleTabs[prevIndex].id);
        break;

      case 'Home':
        e.preventDefault();
        setActiveTab(visibleTabs[0].id);
        break;

      case 'End':
        e.preventDefault();
        setActiveTab(visibleTabs[visibleTabs.length - 1].id);
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        setActiveTab(tabId);
        break;
    }
  }, [visibleTabs]);

  const handleDialogKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Escape to cancel
    if (e.key === 'Escape') {
      handleCancel();
      return;
    }

    // Ctrl+Enter to save
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
      return;
    }

    // Tab key trapping
    if (e.key === 'Tab') {
      const focusableElements = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        // Shift+Tab - going backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab - going forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      const confirmDiscard = window.confirm('You have unsaved changes. Discard changes and close?');
      if (!confirmDiscard) {
        // User clicked "Cancel" on the confirm dialog, so don't close
        return;
      }
      // User clicked "OK", so proceed to close
    }
    onCancel();
  }, [isDirty, onCancel]);

  // ============================================================================
  // Agent/Skill Handlers
  // ============================================================================

  const handleEditAgent = async (agentName: string) => {
    if (!agentName) {
      alert('Please select an agent first');
      return;
    }

    if (!installedAgents.includes(agentName)) {
      alert('Agent not found on disk. Create it first.');
      return;
    }

    try {
      const { content, filePath } = await (window as any).electronAPI.document.readAgent(agentName);
      setEditingAgent({ name: agentName, content, filePath });
    } catch (error: any) {
      alert(`Failed to load agent: ${error.message}`);
    }
  };

  const handleSaveAgent = async (content: string) => {
    if (!editingAgent) return;

    try {
      await (window as any).electronAPI.document.writeAgent(editingAgent.name, content);
      setEditingAgent(null);

      // Refresh installed agents list
      const agents = await (window as any).electronAPI.workflows.getInstalledAgents();
      setInstalledAgents(agents || []);
    } catch (error: any) {
      alert(`Failed to save agent: ${error.message}`);
    }
  };

  const handleImportAgentFile = async () => {
    try {
      const result = await (window as any).electronAPI.document.importAgentFile();
      if (result.canceled) return;

      // Prompt for name with validation
      const agentName = prompt(
        'Import agent as (lowercase, numbers, dashes only):',
        result.fileName
      );

      if (!agentName || !/^[a-z0-9-]+$/.test(agentName)) {
        alert('Invalid name. Use lowercase, numbers, and dashes only.');
        return;
      }

      // Confirm overwrite if exists
      if (installedAgents.includes(agentName)) {
        const confirmed = confirm(`Agent '${agentName}' already exists. Overwrite?`);
        if (!confirmed) return;
      }

      await (window as any).electronAPI.document.writeAgent(agentName, result.content);

      // Refresh and auto-select
      const agents = await (window as any).electronAPI.workflows.getInstalledAgents();
      setInstalledAgents(agents || []);
      setFormData({ ...formData, agent: agentName } as any);
      setIsDirty(true);
    } catch (error: any) {
      alert(`Failed to import agent: ${error.message}`);
    }
  };

  const handleImportAgentFolder = async () => {
    try {
      const result = await (window as any).electronAPI.document.importAgentFolder();
      if (result.canceled) return;

      // Process each agent from folder
      let imported = 0;
      let skipped = 0;

      for (const agent of result.agents) {
        // Check if exists
        if (installedAgents.includes(agent.fileName)) {
          const confirmed = confirm(`Agent '${agent.fileName}' already exists. Overwrite?`);
          if (!confirmed) {
            skipped++;
            continue;
          }
        }

        await (window as any).electronAPI.document.writeAgent(agent.fileName, agent.content);
        imported++;
      }

      // Refresh
      const agents = await (window as any).electronAPI.workflows.getInstalledAgents();
      setInstalledAgents(agents || []);

      alert(`Imported ${imported} agent(s). Skipped ${skipped}.`);
    } catch (error: any) {
      alert(`Failed to import agents: ${error.message}`);
    }
  };

  const handleEditSkill = async (skillName: string) => {
    if (!skillName) {
      alert('Please select a skill first');
      return;
    }

    if (!installedSkills.includes(skillName)) {
      alert('Skill not found on disk. Create it first.');
      return;
    }

    try {
      const { content, filePath } = await (window as any).electronAPI.document.readSkill(skillName);
      setEditingSkill({ name: skillName, content, filePath });
    } catch (error: any) {
      alert(`Failed to load skill: ${error.message}`);
    }
  };

  const handleSaveSkill = async (content: string) => {
    if (!editingSkill) return;

    try {
      await (window as any).electronAPI.document.writeSkill(editingSkill.name, content);
      setEditingSkill(null);

      // Refresh installed skills list
      const skills = await (window as any).electronAPI.workflows.getInstalledSkills();
      setInstalledSkills(skills || []);
    } catch (error: any) {
      alert(`Failed to save skill: ${error.message}`);
    }
  };

  const handleImportSkillFile = async () => {
    try {
      const result = await (window as any).electronAPI.document.importSkillFile();
      if (result.canceled) return;

      // Prompt for name with validation
      const skillName = prompt(
        'Import skill as (lowercase, numbers, dashes only):',
        result.fileName
      );

      if (!skillName || !/^[a-z0-9-]+$/.test(skillName)) {
        alert('Invalid name. Use lowercase, numbers, and dashes only.');
        return;
      }

      // Confirm overwrite if exists
      if (installedSkills.includes(skillName)) {
        const confirmed = confirm(`Skill '${skillName}' already exists. Overwrite?`);
        if (!confirmed) return;
      }

      await (window as any).electronAPI.document.writeSkill(skillName, result.content);

      // Refresh and auto-select
      const skills = await (window as any).electronAPI.workflows.getInstalledSkills();
      setInstalledSkills(skills || []);
      setFormData({ ...formData, skill: skillName } as any);
      setIsDirty(true);
    } catch (error: any) {
      alert(`Failed to import skill: ${error.message}`);
    }
  };

  const handleImportSkillFolder = async () => {
    try {
      const result = await (window as any).electronAPI.document.importSkillFolder();
      if (result.canceled) return;

      // Process each skill from folder
      let imported = 0;
      let skipped = 0;

      for (const skill of result.skills) {
        // Check if exists
        if (installedSkills.includes(skill.fileName)) {
          const confirmed = confirm(`Skill '${skill.fileName}' already exists. Overwrite?`);
          if (!confirmed) {
            skipped++;
            continue;
          }
        }

        await (window as any).electronAPI.document.writeSkill(skill.fileName, skill.content);
        imported++;
      }

      // Refresh
      const skills = await (window as any).electronAPI.workflows.getInstalledSkills();
      setInstalledSkills(skills || []);

      alert(`Imported ${imported} skill(s). Skipped ${skipped}.`);
    } catch (error: any) {
      alert(`Failed to import skills: ${error.message}`);
    }
  };

  // ============================================================================
  // Validation
  // ============================================================================

  const validate = useCallback((): boolean => {
    if (!formData) return false;

    const newErrors: ValidationError[] = [];

    // Basic Info validation
    if (!formData.name?.trim()) {
      newErrors.push({
        field: 'name',
        message: 'Node name is required',
        tabId: 'basic',
      });
    }

    // Type-specific validation
    if (formData.type === 'code') {
      const codeNode = formData as any;
      if (!codeNode.code?.trim()) {
        newErrors.push({
          field: 'code',
          message: 'Code is required for code execution nodes',
          tabId: 'config',
        });
      }
    }

    if (isAgentNode(formData)) {
      const agentNode = formData as any;
      if (!agentNode.agent?.trim()) {
        newErrors.push({
          field: 'agent',
          message: 'Agent name is required for agent nodes',
          tabId: 'config',
        });
      }
      if (!agentNode.prompt?.trim()) {
        newErrors.push({
          field: 'prompt',
          message: 'Prompt is required for agent nodes. This is what gets sent to the AI.',
          tabId: 'config',
        });
      }
      if (!agentNode.provider) {
        newErrors.push({
          field: 'provider',
          message: 'LLM provider is required for agent nodes',
          tabId: 'provider',
        });
      }
    }

    setErrors(newErrors);

    // If there are errors, focus on the first error tab
    if (newErrors.length > 0) {
      setActiveTab(newErrors[0].tabId);
    }

    return newErrors.length === 0;
  }, [formData]);

  const handleSave = useCallback(() => {
    console.log('[NodeConfigDialog] ===== SAVE BUTTON CLICKED =====');
    console.log('[NodeConfigDialog] formData:', formData);

    if (!formData) {
      console.log('[NodeConfigDialog] Save blocked: formData is null');
      return;
    }

    console.log('[NodeConfigDialog] Calling validate()...');
    const isValid = validate();
    console.log('[NodeConfigDialog] Validation result:', isValid);
    console.log('[NodeConfigDialog] Validation errors:', errors);

    if (isValid) {
      console.log('[NodeConfigDialog] Validation passed, calling onSave with:', formData);
      onSave(formData);
      console.log('[NodeConfigDialog] onSave called successfully');
    } else {
      console.log('[NodeConfigDialog] Validation FAILED, NOT calling onSave');
      console.log('[NodeConfigDialog] Please fix the errors shown in the form');
    }
  }, [formData, validate, onSave, errors]);

  // ============================================================================
  // Render Guards
  // ============================================================================

  if (!node || !formData) {
    return null;
  }

  // ============================================================================
  // Render Helper Functions
  // ============================================================================

  const getFieldError = (field: string): ValidationError | undefined => {
    return errors.find(err => err.field === field);
  };

  const hasTabErrors = (tabId: TabId): boolean => {
    return errors.some(err => err.tabId === tabId);
  };

  // ============================================================================
  // Tab Content Renderers
  // ============================================================================

  const renderBasicInfoTab = () => {
    const nameError = getFieldError('name');
    const nodeTypeConfig = NODE_TYPE_CONFIGS.find(c => c.value === formData.type);

    return (
      <div role="tabpanel" id="panel-basic" aria-labelledby="tab-basic">
        {/* Node Name */}
        <div style={styles.field}>
          <label htmlFor="node-name" style={styles.label}>
            Node Name <span style={styles.required} aria-label="required">*</span>
          </label>
          <input
            ref={nameInputRef}
            id="node-name"
            type="text"
            style={nameError ? { ...styles.input, ...styles.inputError } : styles.input}
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            placeholder="e.g., Market Research Phase"
            required
            aria-required="true"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'node-name-error' : undefined}
          />
          {nameError && (
            <div
              id="node-name-error"
              style={styles.errorText}
              role="alert"
              aria-live="polite"
            >
              {nameError.message}
            </div>
          )}
        </div>

        {/* Node Description */}
        <div style={styles.field}>
          <label htmlFor="node-description" style={styles.label}>
            Description
          </label>
          <textarea
            id="node-description"
            style={styles.textarea}
            value={formData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Describe what this node does..."
            rows={3}
            aria-label="Node description"
          />
        </div>

        {/* Node Type Selector */}
        <div style={styles.field}>
          <label htmlFor="node-type" style={styles.label}>
            Node Type <span style={styles.required} aria-label="required">*</span>
          </label>
          <select
            id="node-type"
            style={styles.select}
            value={formData.type}
            onChange={(e) => handleFieldChange('type', e.target.value)}
            required
            aria-required="true"
            aria-label="Node type"
          >
            {NODE_TYPE_CONFIGS.map(config => (
              <option key={config.value} value={config.value}>
                {config.icon} {config.label}
              </option>
            ))}
          </select>
          <div style={styles.helpText}>
            Selected: {nodeTypeConfig?.icon} {nodeTypeConfig?.label}
          </div>
        </div>

        {/* Node Position (read-only info) */}
        <div style={styles.field}>
          <label style={styles.label}>Position</label>
          <div style={styles.readOnlyField}>
            X: {Math.round(formData.position.x)}, Y: {Math.round(formData.position.y)}
          </div>
        </div>
      </div>
    );
  };

  const renderConfigTab = () => {
    if (!formData) return null;

    const agentError = getFieldError('agent');
    const codeError = getFieldError('code');

    return (
      <div role="tabpanel" id="panel-config" aria-labelledby="tab-config">
        {/* Planning, Writing, Gate Nodes */}
        {isAgentNode(formData) && (
          <>
            <div style={styles.field}>
              <label htmlFor="config-agent" style={styles.label}>
                Agent <span style={styles.required}>*</span>
              </label>

              <AgentSkillSelector
                type="agent"
                value={(formData as any).agent || ''}
                onChange={(value: string) => {
                  setFormData({ ...formData, agent: value } as any);
                  setIsDirty(true);
                  setErrors(errors.filter(err => err.field !== 'agent'));
                }}
                installedOptions={installedAgents}
                error={agentError?.message}
                required={true}
              />

              <AgentSkillActionButtons
                type="agent"
                selectedName={(formData as any).agent || ''}
                installedOptions={installedAgents}
                onEdit={() => handleEditAgent((formData as any).agent)}
                onCreate={() => setCreatingAgent(true)}
                onImportFile={() => handleImportAgentFile()}
                onImportFolder={() => handleImportAgentFolder()}
              />

              {agentError && (
                <div
                  id="config-agent-error"
                  style={styles.errorText}
                  role="alert"
                  aria-live="polite"
                >
                  {agentError.message}
                </div>
              )}
            </div>

            <div style={styles.field}>
              <label htmlFor="config-skill" style={styles.label}>
                Skill (Optional)
              </label>

              <AgentSkillSelector
                type="skill"
                value={(formData as any).skill || ''}
                onChange={(value: string) => {
                  setFormData({ ...formData, skill: value || undefined } as any);
                  setIsDirty(true);
                }}
                installedOptions={installedSkills}
                required={false}
              />

              <AgentSkillActionButtons
                type="skill"
                selectedName={(formData as any).skill || ''}
                installedOptions={installedSkills}
                onEdit={() => handleEditSkill((formData as any).skill)}
                onCreate={() => setCreatingSkill(true)}
                onImportFile={() => handleImportSkillFile()}
                onImportFolder={() => handleImportSkillFolder()}
              />
            </div>

            {formData.type === 'gate' && (
              <div style={styles.field}>
                <label htmlFor="config-condition" style={styles.label}>
                  Gate Condition
                </label>
                <textarea
                  id="config-condition"
                  style={{ ...styles.input, minHeight: '80px', fontFamily: 'monospace' }}
                  value={(formData as any).condition || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, condition: e.target.value } as any);
                    setIsDirty(true);
                  }}
                  placeholder="JSONPath or JavaScript expression"
                />
              </div>
            )}

            <div style={styles.field}>
              <label htmlFor="config-prompt" style={styles.label}>
                Prompt Template <span style={styles.required}>*</span>
              </label>
              <div style={{ marginBottom: '8px', fontSize: '13px', color: '#666' }}>
                This is the exact prompt that will be sent to the AI. Use {'{{variableName}}'} to insert context variables.
              </div>
              <textarea
                id="config-prompt"
                style={{ ...styles.input, minHeight: '200px', fontFamily: 'monospace', fontSize: '13px' }}
                value={(formData as any).prompt || ''}
                onChange={(e) => {
                  setFormData({ ...formData, prompt: e.target.value } as any);
                  setIsDirty(true);
                  setErrors(errors.filter(err => err.field !== 'prompt'));
                }}
                placeholder="Example: Analyze the following text:\n\n{{userInput}}\n\nProvide detailed feedback and suggestions."
                aria-required="true"
              />
              {getFieldError('prompt') && (
                <div
                  id="config-prompt-error"
                  style={styles.errorText}
                  role="alert"
                  aria-live="polite"
                >
                  {getFieldError('prompt')?.message}
                </div>
              )}
            </div>

            <div style={styles.field}>
              <label htmlFor="config-output-var" style={styles.label}>
                Output Variable Name
              </label>
              <input
                id="config-output-var"
                type="text"
                style={styles.input}
                value={(formData as any).outputVariable || ''}
                onChange={(e) => {
                  setFormData({ ...formData, outputVariable: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="e.g., characterAnalysis, worldBuildingNotes"
              />
            </div>
          </>
        )}

        {/* User Input Node */}
        {formData.type === 'user-input' && (
          <>
            <div style={styles.field}>
              <label htmlFor="config-prompt" style={styles.label}>
                Input Prompt <span style={styles.required}>*</span>
              </label>
              <input
                id="config-prompt"
                type="text"
                style={styles.input}
                value={(formData as any).prompt || ''}
                onChange={(e) => {
                  setFormData({ ...formData, prompt: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="What would you like to ask the user?"
                aria-required="true"
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="config-input-type" style={styles.label}>
                Input Type
              </label>
              <select
                id="config-input-type"
                style={styles.select}
                value={(formData as any).inputType || 'text'}
                onChange={(e) => {
                  setFormData({ ...formData, inputType: e.target.value } as any);
                  setIsDirty(true);
                }}
              >
                <option value="text">Single Line Text</option>
                <option value="number">Number</option>
                {/* Disabled - GUI-only options (WorkflowExecutionPanel not integrated) */}
                {/* <option value="textarea">Multi-line Text</option> */}
                {/* <option value="select">Dropdown Select</option> */}
                {/* <option value="checkbox">Checkbox</option> */}
              </select>
              <div style={styles.helpText}>
                Note: Only "Single Line Text" and "Number" work in Claude Code terminal execution.
              </div>
            </div>

            <div style={styles.field}>
              <label htmlFor="config-default-value" style={styles.label}>
                Default Value
              </label>
              <input
                id="config-default-value"
                type="text"
                style={styles.input}
                value={(formData as any).defaultValue || ''}
                onChange={(e) => {
                  setFormData({ ...formData, defaultValue: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="Optional default value"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                <input
                  type="checkbox"
                  checked={(formData as any).required || false}
                  onChange={(e) => {
                    setFormData({ ...formData, required: e.target.checked } as any);
                    setIsDirty(true);
                  }}
                  style={{ marginRight: '8px' }}
                />
                Required Field
              </label>
            </div>

            {/* Validation Rules */}
            {((formData as any).inputType === 'text' || (formData as any).inputType === 'textarea') && (
              <>
                <div style={styles.fieldGroup}>
                  <h4 style={styles.sectionHeader}>Validation Rules</h4>

                  <div style={styles.fieldRow}>
                    <div style={styles.field}>
                      <label htmlFor="config-min-length" style={styles.label}>
                        Minimum Length
                      </label>
                      <input
                        id="config-min-length"
                        type="number"
                        min="0"
                        style={styles.input}
                        value={(formData as any).validation?.minLength || ''}
                        onChange={(e) => {
                          const minLength = e.target.value ? parseInt(e.target.value) : undefined;
                          setFormData({
                            ...formData,
                            validation: { ...(formData as any).validation, minLength }
                          } as any);
                          setIsDirty(true);
                        }}
                        placeholder="e.g., 10"
                      />
                    </div>

                    <div style={styles.field}>
                      <label htmlFor="config-max-length" style={styles.label}>
                        Maximum Length
                      </label>
                      <input
                        id="config-max-length"
                        type="number"
                        min="0"
                        style={styles.input}
                        value={(formData as any).validation?.maxLength || ''}
                        onChange={(e) => {
                          const maxLength = e.target.value ? parseInt(e.target.value) : undefined;
                          setFormData({
                            ...formData,
                            validation: { ...(formData as any).validation, maxLength }
                          } as any);
                          setIsDirty(true);
                        }}
                        placeholder="e.g., 5000"
                      />
                    </div>
                  </div>

                  <div style={styles.field}>
                    <label htmlFor="config-pattern" style={styles.label}>
                      Pattern (RegEx)
                    </label>
                    <input
                      id="config-pattern"
                      type="text"
                      style={styles.input}
                      value={(formData as any).validation?.pattern || ''}
                      onChange={(e) => {
                        const pattern = e.target.value || undefined;
                        setFormData({
                          ...formData,
                          validation: { ...(formData as any).validation, pattern }
                        } as any);
                        setIsDirty(true);
                      }}
                      placeholder="e.g., ^[A-Za-z0-9]+$"
                    />
                  </div>
                </div>
              </>
            )}

            {(formData as any).inputType === 'number' && (
              <>
                <div style={styles.fieldGroup}>
                  <h4 style={styles.sectionHeader}>Validation Rules</h4>

                  <div style={styles.fieldRow}>
                    <div style={styles.field}>
                      <label htmlFor="config-min-value" style={styles.label}>
                        Minimum Value
                      </label>
                      <input
                        id="config-min-value"
                        type="number"
                        style={styles.input}
                        value={(formData as any).validation?.min ?? ''}
                        onChange={(e) => {
                          const min = e.target.value ? parseFloat(e.target.value) : undefined;
                          setFormData({
                            ...formData,
                            validation: { ...(formData as any).validation, min }
                          } as any);
                          setIsDirty(true);
                        }}
                        placeholder="e.g., 0"
                      />
                    </div>

                    <div style={styles.field}>
                      <label htmlFor="config-max-value" style={styles.label}>
                        Maximum Value
                      </label>
                      <input
                        id="config-max-value"
                        type="number"
                        style={styles.input}
                        value={(formData as any).validation?.max ?? ''}
                        onChange={(e) => {
                          const max = e.target.value ? parseFloat(e.target.value) : undefined;
                          setFormData({
                            ...formData,
                            validation: { ...(formData as any).validation, max }
                          } as any);
                          setIsDirty(true);
                        }}
                        placeholder="e.g., 100"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {(formData as any).inputType === 'select' && (
              <div style={styles.field}>
                <label htmlFor="config-options" style={styles.label}>
                  Options (one per line)
                </label>
                <textarea
                  id="config-options"
                  style={{ ...styles.input, minHeight: '80px' }}
                  value={((formData as any).options || []).join('\n')}
                  onChange={(e) => {
                    const options = e.target.value.split('\n').filter(o => o.trim());
                    setFormData({ ...formData, options } as any);
                    setIsDirty(true);
                  }}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                />
              </div>
            )}
          </>
        )}

        {/* File Node */}
        {formData.type === 'file' && (
          <>
            <div style={styles.field}>
              <label htmlFor="config-file-operation" style={styles.label}>
                File Operation <span style={styles.required}>*</span>
              </label>
              <select
                id="config-file-operation"
                style={styles.select}
                value={(formData as any).operation || 'read'}
                onChange={(e) => {
                  setFormData({ ...formData, operation: e.target.value } as any);
                  setIsDirty(true);
                }}
                aria-required="true"
              >
                <option value="read">Read File</option>
                <option value="write">Write File</option>
                <option value="append">Append to File</option>
                <option value="copy">Copy File</option>
                <option value="move">Move File</option>
                <option value="delete">Delete File</option>
              </select>
            </div>

            <div style={styles.field}>
              <label htmlFor="config-file-path" style={styles.label}>
                File Path <span style={styles.required}>*</span>
              </label>
              <input
                id="config-file-path"
                type="text"
                style={styles.input}
                value={(formData as any).path || ''}
                onChange={(e) => {
                  setFormData({ ...formData, path: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="{{projectFolder}}/output.txt"
                aria-required="true"
              />
            </div>

            {['write', 'append'].includes((formData as any).operation) && (
              <div style={styles.field}>
                <label htmlFor="config-file-content" style={styles.label}>
                  Content
                </label>
                <textarea
                  id="config-file-content"
                  style={{ ...styles.input, minHeight: '100px', fontFamily: 'monospace' }}
                  value={(formData as any).content || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, content: e.target.value } as any);
                    setIsDirty(true);
                  }}
                  placeholder="File content or {{variableName}}"
                />
              </div>
            )}

            {['copy', 'move'].includes((formData as any).operation) && (
              <div style={styles.field}>
                <label htmlFor="config-file-target" style={styles.label}>
                  Target Path <span style={styles.required}>*</span>
                </label>
                <input
                  id="config-file-target"
                  type="text"
                  style={styles.input}
                  value={(formData as any).targetPath || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, targetPath: e.target.value } as any);
                    setIsDirty(true);
                  }}
                  placeholder="{{projectFolder}}/backup/output.txt"
                  aria-required="true"
                />
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>
                <input
                  type="checkbox"
                  checked={(formData as any).restrictToProjectFolder !== false}
                  onChange={(e) => {
                    setFormData({ ...formData, restrictToProjectFolder: e.target.checked } as any);
                    setIsDirty(true);
                  }}
                  style={{ marginRight: '8px' }}
                />
                Restrict to Project Folder (Security)
              </label>
            </div>
          </>
        )}

        {/* HTTP Node */}
        {formData.type === 'http' && (
          <>
            <div style={styles.field}>
              <label htmlFor="config-http-method" style={styles.label}>
                HTTP Method <span style={styles.required}>*</span>
              </label>
              <select
                id="config-http-method"
                style={styles.select}
                value={(formData as any).method || 'GET'}
                onChange={(e) => {
                  setFormData({ ...formData, method: e.target.value } as any);
                  setIsDirty(true);
                }}
                aria-required="true"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div style={styles.field}>
              <label htmlFor="config-http-url" style={styles.label}>
                URL <span style={styles.required}>*</span>
              </label>
              <input
                id="config-http-url"
                type="text"
                style={styles.input}
                value={(formData as any).url || ''}
                onChange={(e) => {
                  setFormData({ ...formData, url: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="https://api.example.com/endpoint"
                aria-required="true"
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="config-http-headers" style={styles.label}>
                Headers (JSON)
              </label>
              <textarea
                id="config-http-headers"
                style={{ ...styles.input, minHeight: '80px', fontFamily: 'monospace' }}
                value={JSON.stringify((formData as any).headers || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value);
                    setFormData({ ...formData, headers } as any);
                    setIsDirty(true);
                  } catch (err) {
                    // Invalid JSON, keep editing
                  }
                }}
                placeholder='{"Authorization": "Bearer {{apiToken}}"}'
              />
            </div>

            {['POST', 'PUT', 'PATCH'].includes((formData as any).method) && (
              <div style={styles.field}>
                <label htmlFor="config-http-body" style={styles.label}>
                  Request Body (JSON)
                </label>
                <textarea
                  id="config-http-body"
                  style={{ ...styles.input, minHeight: '100px', fontFamily: 'monospace' }}
                  value={JSON.stringify((formData as any).body || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const body = JSON.parse(e.target.value);
                      setFormData({ ...formData, body } as any);
                      setIsDirty(true);
                    } catch (err) {
                      // Invalid JSON, keep editing
                    }
                  }}
                  placeholder='{"key": "{{value}}"}'
                />
              </div>
            )}
          </>
        )}

        {/* Code Node */}
        {formData.type === 'code' && (
          <>
            <div style={styles.field}>
              <label htmlFor="config-code-language" style={styles.label}>
                Language
              </label>
              <select
                id="config-code-language"
                style={styles.select}
                value={(formData as any).language || 'javascript'}
                onChange={(e) => {
                  setFormData({ ...formData, language: e.target.value } as any);
                  setIsDirty(true);
                }}
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
              </select>
            </div>

            <div style={styles.field}>
              <label htmlFor="config-code" style={styles.label}>
                Code <span style={styles.required}>*</span>
              </label>
              <textarea
                id="config-code"
                style={codeError ?
                  { ...styles.input, ...styles.inputError, minHeight: '200px', fontFamily: 'Consolas, Monaco, monospace', fontSize: '13px' } :
                  { ...styles.input, minHeight: '200px', fontFamily: 'Consolas, Monaco, monospace', fontSize: '13px' }
                }
                value={(formData as any).code || ''}
                onChange={(e) => {
                  setFormData({ ...formData, code: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="// Your code here&#10;// Use context.variableName to access workflow variables&#10;// Return value will be stored in outputVariable"
                aria-required="true"
                aria-invalid={!!codeError}
                aria-describedby={codeError ? 'config-code-error' : undefined}
              />
              {codeError && (
                <div
                  id="config-code-error"
                  style={styles.errorText}
                  role="alert"
                  aria-live="polite"
                >
                  {codeError.message}
                </div>
              )}
            </div>

            <div style={styles.field}>
              <label htmlFor="config-code-output-var" style={styles.label}>
                Output Variable Name
              </label>
              <input
                id="config-code-output-var"
                type="text"
                style={styles.input}
                value={(formData as any).outputVariable || ''}
                onChange={(e) => {
                  setFormData({ ...formData, outputVariable: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="result"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                <input
                  type="checkbox"
                  checked={(formData as any).sandbox !== false}
                  onChange={(e) => {
                    setFormData({ ...formData, sandbox: e.target.checked } as any);
                    setIsDirty(true);
                  }}
                  style={{ marginRight: '8px' }}
                />
                Run in Sandbox (Security)
              </label>
            </div>
          </>
        )}

        {/* Conditional Node */}
        {formData.type === 'conditional' && (
          <>
            <div style={styles.field}>
              <label htmlFor="config-condition" style={styles.label}>
                Condition Expression <span style={styles.required}>*</span>
              </label>
              <textarea
                id="config-condition"
                style={{ ...styles.input, minHeight: '80px', fontFamily: 'monospace' }}
                value={(formData as any).condition || ''}
                onChange={(e) => {
                  setFormData({ ...formData, condition: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="{{score}} > 80"
                aria-required="true"
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>
                Use {'{{variableName}}'} syntax or JavaScript expressions
              </small>
            </div>

            <div style={styles.field}>
              <label htmlFor="config-condition-type" style={styles.label}>
                Condition Type
              </label>
              <select
                id="config-condition-type"
                style={styles.select}
                value={(formData as any).conditionType || 'expression'}
                onChange={(e) => {
                  setFormData({ ...formData, conditionType: e.target.value } as any);
                  setIsDirty(true);
                }}
              >
                <option value="expression">Expression</option>
                <option value="javascript">JavaScript</option>
                <option value="jsonpath">JSONPath</option>
              </select>
            </div>
          </>
        )}

        {/* Loop Node */}
        {formData.type === 'loop' && (
          <>
            <div style={styles.field}>
              <label htmlFor="config-loop-type" style={styles.label}>
                Loop Type <span style={styles.required}>*</span>
              </label>
              <select
                id="config-loop-type"
                style={styles.select}
                value={(formData as any).loopType || 'forEach'}
                onChange={(e) => {
                  setFormData({ ...formData, loopType: e.target.value } as any);
                  setIsDirty(true);
                }}
                aria-required="true"
              >
                <option value="forEach">For Each (iterate over collection)</option>
                <option value="while">While (condition-based)</option>
                <option value="count">Count (fixed iterations)</option>
              </select>
            </div>

            {(formData as any).loopType === 'forEach' && (
              <div style={styles.field}>
                <label htmlFor="config-loop-collection" style={styles.label}>
                  Collection Variable <span style={styles.required}>*</span>
                </label>
                <input
                  id="config-loop-collection"
                  type="text"
                  style={styles.input}
                  value={(formData as any).collection || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, collection: e.target.value } as any);
                    setIsDirty(true);
                  }}
                  placeholder="{{chapters}}"
                  aria-required="true"
                />
              </div>
            )}

            {(formData as any).loopType === 'while' && (
              <div style={styles.field}>
                <label htmlFor="config-loop-condition" style={styles.label}>
                  While Condition <span style={styles.required}>*</span>
                </label>
                <input
                  id="config-loop-condition"
                  type="text"
                  style={styles.input}
                  value={(formData as any).condition || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, condition: e.target.value } as any);
                    setIsDirty(true);
                  }}
                  placeholder="{{currentChapter}} < {{totalChapters}}"
                  aria-required="true"
                />
              </div>
            )}

            {(formData as any).loopType === 'count' && (
              <div style={styles.field}>
                <label htmlFor="config-loop-count" style={styles.label}>
                  Iteration Count <span style={styles.required}>*</span>
                </label>
                <input
                  id="config-loop-count"
                  type="number"
                  style={styles.input}
                  value={(formData as any).count || 1}
                  onChange={(e) => {
                    setFormData({ ...formData, count: parseInt(e.target.value) || 1 } as any);
                    setIsDirty(true);
                  }}
                  min="1"
                  aria-required="true"
                />
              </div>
            )}

            <div style={styles.field}>
              <label htmlFor="config-loop-iterator" style={styles.label}>
                Iterator Variable Name
              </label>
              <input
                id="config-loop-iterator"
                type="text"
                style={styles.input}
                value={(formData as any).iteratorVariable || 'item'}
                onChange={(e) => {
                  setFormData({ ...formData, iteratorVariable: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="item, chapter, index"
              />
            </div>
          </>
        )}

        {/* Subworkflow Node */}
        {formData.type === 'subworkflow' && (
          <>
            <div style={styles.field}>
              <label htmlFor="config-subworkflow-id" style={styles.label}>
                Sub-Workflow ID <span style={styles.required}>*</span>
              </label>
              <input
                id="config-subworkflow-id"
                type="text"
                style={styles.input}
                value={(formData as any).subWorkflowId || ''}
                onChange={(e) => {
                  setFormData({ ...formData, subWorkflowId: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="chapter-writing-workflow"
                aria-required="true"
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="config-subworkflow-version" style={styles.label}>
                Version (Optional)
              </label>
              <input
                id="config-subworkflow-version"
                type="text"
                style={styles.input}
                value={(formData as any).version || ''}
                onChange={(e) => {
                  setFormData({ ...formData, version: e.target.value } as any);
                  setIsDirty(true);
                }}
                placeholder="1.0.0 (leave empty for latest)"
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="config-subworkflow-mapping" style={styles.label}>
                Input/Output Mapping (JSON)
              </label>
              <textarea
                id="config-subworkflow-mapping"
                style={{ ...styles.input, minHeight: '100px', fontFamily: 'monospace' }}
                value={JSON.stringify((formData as any).variableMapping || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const variableMapping = JSON.parse(e.target.value);
                    setFormData({ ...formData, variableMapping } as any);
                    setIsDirty(true);
                  } catch (err) {
                    // Invalid JSON, keep editing
                  }
                }}
                placeholder='{"inputVar": "{{parentVar}}", "output": "result"}'
              />
            </div>
          </>
        )}
      </div>
    );
  };

  const renderProviderTab = () => {
    if (!isAgentNode(formData)) {
      return null;
    }

    const agentNode = formData as any;
    const provider = agentNode.provider || {
      type: 'claude-code-cli',
      name: 'Claude Code (Your Subscription)',
      config: { model: 'claude-sonnet-4-5', outputFormat: 'json' }
    };

    return (
      <div role="tabpanel" id="panel-provider" aria-labelledby="tab-provider">
        <div style={styles.field}>
          <label htmlFor="config-provider-type" style={styles.label}>
            Provider Type <span style={styles.required}>*</span>
          </label>
          <select
            id="config-provider-type"
            style={styles.select}
            value={provider.type}
            onChange={(e) => {
              const newType = e.target.value as any;
              let newProvider: any = {
                type: newType,
                name: '',
                config: {}
              };

              // Set defaults based on provider type
              if (newType === 'claude-code-cli') {
                newProvider.name = 'Claude Code (Your Subscription)';
                newProvider.config = { model: 'claude-sonnet-4-5', outputFormat: 'json' };
              } else if (newType === 'claude-api') {
                newProvider.name = 'Claude API';
                newProvider.config = { apiKey: '', model: 'claude-sonnet-4-5', maxTokens: 4096, temperature: 1.0 };
              } else if (newType === 'openai') {
                newProvider.name = 'OpenAI';
                newProvider.config = { apiKey: '', model: 'gpt-4o', maxTokens: 4096, temperature: 1.0 };
              }

              setFormData({ ...formData, provider: newProvider } as any);
              setIsDirty(true);
            }}
          >
            <option value="claude-code-cli">Claude Code CLI (Your Subscription)</option>
            <option value="claude-api">Claude API (Anthropic)</option>
            <option value="openai">OpenAI</option>
            <option value="google">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
            <option value="local">Local LLM</option>
          </select>
        </div>

        <div style={styles.field}>
          <label htmlFor="config-provider-name" style={styles.label}>
            Provider Name
          </label>
          <input
            id="config-provider-name"
            type="text"
            style={styles.input}
            value={provider.name || ''}
            onChange={(e) => {
              setFormData({
                ...formData,
                provider: { ...provider, name: e.target.value }
              } as any);
              setIsDirty(true);
            }}
            placeholder="e.g., My Claude API, Work OpenAI"
          />
        </div>

        {/* Claude Code CLI Config */}
        {provider.type === 'claude-code-cli' && (
          <>
            <div style={styles.field}>
              <label htmlFor="config-model" style={styles.label}>
                Model
              </label>
              <select
                id="config-model"
                style={styles.select}
                value={provider.config?.model || 'claude-sonnet-4-5'}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    provider: {
                      ...provider,
                      config: { ...provider.config, model: e.target.value }
                    }
                  } as any);
                  setIsDirty(true);
                }}
              >
                <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
                <option value="claude-opus-4-5">Claude Opus 4.5</option>
              </select>
            </div>

            <div style={styles.field}>
              <label htmlFor="config-output-format" style={styles.label}>
                Output Format
              </label>
              <select
                id="config-output-format"
                style={styles.select}
                value={provider.config?.outputFormat || 'json'}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    provider: {
                      ...provider,
                      config: { ...provider.config, outputFormat: e.target.value }
                    }
                  } as any);
                  setIsDirty(true);
                }}
              >
                <option value="json">JSON</option>
                <option value="text">Text</option>
              </select>
            </div>
          </>
        )}

        {/* Claude API / OpenAI / Google Config */}
        {(provider.type === 'claude-api' || provider.type === 'openai' || provider.type === 'google') && (
          <>
            <div style={styles.field}>
              <label htmlFor="config-api-key" style={styles.label}>
                API Key <span style={styles.required}>*</span>
              </label>
              <input
                id="config-api-key"
                type="password"
                style={styles.input}
                value={provider.config?.apiKey || ''}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    provider: {
                      ...provider,
                      config: { ...provider.config, apiKey: e.target.value }
                    }
                  } as any);
                  setIsDirty(true);
                }}
                placeholder="Enter your API key"
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="config-model-api" style={styles.label}>
                Model
              </label>
              <select
                id="config-model-api"
                style={styles.select}
                value={provider.config?.model || ''}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    provider: {
                      ...provider,
                      config: { ...provider.config, model: e.target.value }
                    }
                  } as any);
                  setIsDirty(true);
                }}
              >
                {provider.type === 'claude-api' && (
                  <>
                    <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
                    <option value="claude-opus-4">Claude Opus 4</option>
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  </>
                )}
                {provider.type === 'openai' && (
                  <>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                )}
                {provider.type === 'google' && (
                  <>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-pro">Gemini Pro</option>
                    <option value="gemini-ultra">Gemini Ultra</option>
                  </>
                )}
              </select>
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label htmlFor="config-max-tokens" style={styles.label}>
                  Max Tokens
                </label>
                <input
                  id="config-max-tokens"
                  type="number"
                  min="1"
                  style={styles.input}
                  value={provider.config?.maxTokens || 4096}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      provider: {
                        ...provider,
                        config: { ...provider.config, maxTokens: parseInt(e.target.value) }
                      }
                    } as any);
                    setIsDirty(true);
                  }}
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="config-temperature" style={styles.label}>
                  Temperature
                </label>
                <input
                  id="config-temperature"
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  style={styles.input}
                  value={provider.config?.temperature || 1.0}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      provider: {
                        ...provider,
                        config: { ...provider.config, temperature: parseFloat(e.target.value) }
                      }
                    } as any);
                    setIsDirty(true);
                  }}
                />
              </div>
            </div>
          </>
        )}

        {(provider.type === 'openrouter' || provider.type === 'local') && (
          <div style={styles.infoBox}>
            <strong>Note:</strong> {provider.type === 'openrouter' ? 'OpenRouter' : 'Local LLM'} configuration will be fully implemented soon.
          </div>
        )}
      </div>
    );
  };

  const renderContextTab = () => {
    return (
      <div role="tabpanel" id="panel-context" aria-labelledby="tab-context">
        <div style={styles.field}>
          <label style={styles.label}>Context Mode</label>
          <div style={styles.modeToggle}>
            <button
              type="button"
              style={contextMode === 'simple' ? { ...styles.modeButton, ...styles.modeButtonActive } : styles.modeButton}
              onClick={() => setContextMode('simple')}
              aria-pressed={contextMode === 'simple'}
            >
              Simple
            </button>
            <button
              type="button"
              style={contextMode === 'advanced' ? { ...styles.modeButton, ...styles.modeButtonActive } : styles.modeButton}
              onClick={() => setContextMode('advanced')}
              aria-pressed={contextMode === 'advanced'}
            >
              Advanced
            </button>
          </div>
        </div>

        <div style={styles.placeholderPanel}>
          <div style={styles.placeholderIcon}>🔗</div>
          <h3 style={styles.placeholderTitle}>
            Context & Variables - {contextMode === 'simple' ? 'Simple' : 'Advanced'} Mode
          </h3>
          <p style={styles.placeholderText}>
            This panel will be populated by a separate component for managing context and variables.
          </p>
          {contextMode === 'simple' ? (
            <>
              <p style={styles.placeholderText}>
                <strong>Simple Mode:</strong> Automatically inherits all context from previous nodes.
              </p>
              <ul style={styles.placeholderList}>
                <li>No manual configuration needed</li>
                <li>All previous node outputs available</li>
                <li>Suitable for most workflows</li>
              </ul>
            </>
          ) : (
            <>
              <p style={styles.placeholderText}>
                <strong>Advanced Mode:</strong> Explicit input/output mapping with transformations.
              </p>
              <ul style={styles.placeholderList}>
                <li>Input mapping (JSONPath expressions)</li>
                <li>Output mapping (extract specific fields)</li>
                <li>Variable transformations (JavaScript)</li>
                <li>Fine-grained control over data flow</li>
              </ul>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderAdvancedTab = () => {
    return (
      <div role="tabpanel" id="panel-advanced" aria-labelledby="tab-advanced">
        {/* Requires Approval */}
        <div style={styles.checkboxField}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={formData.requiresApproval}
              onChange={(e) => handleFieldChange('requiresApproval', e.target.checked)}
              style={styles.checkbox}
              aria-label="Requires user approval before execution"
            />
            <span>Requires User Approval</span>
          </label>
          <div style={styles.helpText}>
            If enabled, workflow execution will pause at this node for user approval.
          </div>
        </div>

        {/* Skip Condition */}
        <div style={styles.field}>
          <label htmlFor="skip-condition" style={styles.label}>
            Skip Condition (JSONPath)
          </label>
          <input
            id="skip-condition"
            type="text"
            style={styles.input}
            value={formData.skipCondition || ''}
            onChange={(e) => handleFieldChange('skipCondition', e.target.value || undefined)}
            placeholder="e.g., $.previousNode.status === 'skipped'"
            aria-describedby="skip-condition-help"
          />
          <div id="skip-condition-help" style={styles.helpText}>
            JSONPath expression. If evaluates to true, this node will be skipped.
          </div>
        </div>

        {/* Timeout */}
        <div style={styles.field}>
          <label htmlFor="timeout" style={styles.label}>
            Timeout (milliseconds)
          </label>
          <input
            id="timeout"
            type="number"
            style={styles.input}
            value={formData.timeoutMs || ''}
            onChange={(e) => handleFieldChange('timeoutMs', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="e.g., 30000"
            min="0"
            aria-describedby="timeout-help"
          />
          <div id="timeout-help" style={styles.helpText}>
            Maximum time (in milliseconds) before the node execution times out. Leave empty for no timeout.
          </div>
        </div>

        {/* Retry Configuration */}
        <div style={styles.fieldGroup}>
          <h4 style={styles.sectionTitle}>Retry Configuration</h4>

          <div style={styles.field}>
            <label htmlFor="max-retries" style={styles.label}>
              Max Retries
            </label>
            <input
              id="max-retries"
              type="number"
              style={styles.input}
              value={formData.retryConfig?.maxRetries ?? 0}
              onChange={(e) => handleFieldChange('retryConfig', {
                ...formData.retryConfig,
                maxRetries: parseInt(e.target.value) || 0,
              })}
              min="0"
              max="10"
              aria-describedby="max-retries-help"
            />
            <div id="max-retries-help" style={styles.helpText}>
              Number of times to retry on failure (0 = no retries).
            </div>
          </div>

          {formData.retryConfig && formData.retryConfig.maxRetries > 0 && (
            <>
              <div style={styles.field}>
                <label htmlFor="retry-delay" style={styles.label}>
                  Retry Delay (ms)
                </label>
                <input
                  id="retry-delay"
                  type="number"
                  style={styles.input}
                  value={formData.retryConfig?.retryDelayMs ?? 1000}
                  onChange={(e) => handleFieldChange('retryConfig', {
                    ...formData.retryConfig,
                    retryDelayMs: parseInt(e.target.value) || 1000,
                  })}
                  min="0"
                />
              </div>

              <div style={styles.field}>
                <label htmlFor="backoff-multiplier" style={styles.label}>
                  Backoff Multiplier
                </label>
                <input
                  id="backoff-multiplier"
                  type="number"
                  style={styles.input}
                  value={formData.retryConfig?.backoffMultiplier ?? 1}
                  onChange={(e) => handleFieldChange('retryConfig', {
                    ...formData.retryConfig,
                    backoffMultiplier: parseFloat(e.target.value) || 1,
                  })}
                  min="1"
                  max="10"
                  step="0.1"
                  aria-describedby="backoff-help"
                />
                <div id="backoff-help" style={styles.helpText}>
                  Exponential backoff: delay × (multiplier ^ attempt)
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  console.log('[NodeConfigDialog RENDER] Dialog is rendering!', { node, formData });

  return (
    <div
      style={styles.overlay}
      onClick={handleCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        {/* Screen reader announcements */}
        <div
          ref={errorAnnouncerRef}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          style={styles.srOnly}
        />

        {/* Dialog Header */}
        <div style={styles.header}>
          <div>
            <h2 id="dialog-title" style={styles.title}>
              Configure Node
            </h2>
            <p id="dialog-description" style={styles.subtitle}>
              {formData.name || 'New Node'}
            </p>
          </div>
          <button
            ref={firstFocusableRef}
            style={styles.closeButton}
            onClick={handleCancel}
            aria-label="Close dialog"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={styles.tabBar} role="tablist" aria-label="Node configuration tabs">
          {visibleTabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            const hasErrors = hasTabErrors(tab.id);

            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                style={
                  isActive
                    ? { ...styles.tab, ...styles.tabActive }
                    : hasErrors
                    ? { ...styles.tab, ...styles.tabError }
                    : styles.tab
                }
                onClick={() => handleTabChange(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
              >
                <span style={styles.tabIcon} aria-hidden="true">
                  {tab.icon}
                </span>
                <span style={styles.tabLabel}>{tab.label}</span>
                {hasErrors && (
                  <span
                    style={styles.errorBadge}
                    aria-label={`${errors.filter(e => e.tabId === tab.id).length} errors`}
                  >
                    !
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div style={styles.content}>
          {activeTab === 'basic' && renderBasicInfoTab()}
          {activeTab === 'config' && renderConfigTab()}
          {activeTab === 'provider' && renderProviderTab()}
          {activeTab === 'context' && renderContextTab()}
          {activeTab === 'advanced' && renderAdvancedTab()}
        </div>

        {/* Dialog Footer */}
        <div style={styles.footer}>
          <button
            style={styles.cancelButton}
            onClick={handleCancel}
            aria-label="Cancel and close dialog"
          >
            Cancel
          </button>
          <button
            ref={lastFocusableRef}
            style={styles.saveButton}
            onClick={handleSave}
            aria-label="Save changes and close dialog"
          >
            Save Changes
          </button>
        </div>

        {/* Keyboard Hints */}
        <div style={styles.hint}>
          Press <kbd style={styles.kbd}>Ctrl+Enter</kbd> to save, <kbd style={styles.kbd}>Esc</kbd> to cancel
        </div>
      </div>

      {/* Agent Edit Dialog */}
      {editingAgent && (
        <DocumentEditDialog
          type="agent"
          name={editingAgent.name}
          content={editingAgent.content}
          filePath={editingAgent.filePath}
          onSave={handleSaveAgent}
          onCancel={() => setEditingAgent(null)}
        />
      )}

      {/* Skill Edit Dialog */}
      {editingSkill && (
        <DocumentEditDialog
          type="skill"
          name={editingSkill.name}
          content={editingSkill.content}
          filePath={editingSkill.filePath}
          onSave={handleSaveSkill}
          onCancel={() => setEditingSkill(null)}
        />
      )}

      {/* Create Agent Dialog */}
      {creatingAgent && (
        <CreateAgentDialog
          installedAgents={installedAgents}
          onSave={async (name, content) => {
            await (window as any).electronAPI.document.writeAgent(name, content);
            const agents = await (window as any).electronAPI.workflows.getInstalledAgents();
            setInstalledAgents(agents || []);
            setFormData({ ...formData, agent: name } as any);
            setIsDirty(true);
            setCreatingAgent(false);
          }}
          onCancel={() => setCreatingAgent(false)}
        />
      )}

      {/* Create Skill Dialog */}
      {creatingSkill && (
        <CreateSkillDialog
          installedSkills={installedSkills}
          onSave={async (name, content) => {
            await (window as any).electronAPI.document.writeSkill(name, content);
            const skills = await (window as any).electronAPI.workflows.getInstalledSkills();
            setInstalledSkills(skills || []);
            setFormData({ ...formData, skill: name } as any);
            setIsDirty(true);
            setCreatingSkill(false);
          }}
          onCancel={() => setCreatingSkill(false)}
        />
      )}
    </div>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  // Screen reader only (visually hidden but accessible)
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },

  // Overlay
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '20px',
  },

  // Dialog Container
  dialog: {
    background: '#ffffff',
    borderRadius: '12px',
    maxWidth: '900px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    outline: 'none',
  },

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px',
    borderBottom: '1px solid #e5e7eb',
  },

  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
  },

  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#6b7280',
  },

  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '28px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
    transition: 'color 0.2s',
    outline: 'none',
  },

  // Tab Bar
  tabBar: {
    display: 'flex',
    borderBottom: '2px solid #e5e7eb',
    padding: '0 24px',
    gap: '4px',
    overflowX: 'auto',
  },

  // Tab Button
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
    outline: 'none',
    position: 'relative',
  },

  tabActive: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6',
    fontWeight: 600,
  },

  tabError: {
    color: '#dc2626',
  },

  tabIcon: {
    fontSize: '16px',
  },

  tabLabel: {},

  errorBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#dc2626',
    color: 'white',
    fontSize: '12px',
    fontWeight: 700,
    marginLeft: '4px',
  },

  // Content Area
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },

  // Form Fields
  field: {
    marginBottom: '20px',
  },

  fieldGroup: {
    marginBottom: '24px',
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },

  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#374151',
  },

  sectionHeader: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },

  fieldRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
  },

  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
  },

  required: {
    color: '#dc2626',
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

  inputError: {
    borderColor: '#dc2626',
    boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.1)',
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

  checkboxField: {
    marginBottom: '16px',
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

  readOnlyField: {
    padding: '10px 12px',
    fontSize: '14px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    color: '#6b7280',
  },

  helpText: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
  },

  errorText: {
    fontSize: '12px',
    color: '#dc2626',
    marginTop: '4px',
    fontWeight: 500,
  },

  // Mode Toggle
  modeToggle: {
    display: 'flex',
    gap: '8px',
  },

  modeButton: {
    flex: 1,
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#6b7280',
    background: '#f9fafb',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  modeButtonActive: {
    color: '#3b82f6',
    background: '#eff6ff',
    borderColor: '#3b82f6',
    fontWeight: 600,
  },

  // Placeholder Panel
  placeholderPanel: {
    padding: '32px',
    textAlign: 'center',
    background: '#f9fafb',
    borderRadius: '8px',
    border: '2px dashed #d1d5db',
  },

  placeholderIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },

  placeholderTitle: {
    margin: '0 0 12px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#374151',
  },

  placeholderText: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.6,
  },

  placeholderList: {
    textAlign: 'left',
    margin: '16px auto',
    maxWidth: '500px',
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.8,
  },

  infoBox: {
    marginTop: '16px',
    padding: '12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    color: '#1e40af',
    fontSize: '13px',
  },

  // Footer
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #e5e7eb',
  },

  cancelButton: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    background: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  },

  saveButton: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'white',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  },

  // Keyboard Hints
  hint: {
    padding: '12px 24px',
    fontSize: '12px',
    color: '#9ca3af',
    textAlign: 'center',
    borderTop: '1px solid #e5e7eb',
    background: '#f9fafb',
  },

  kbd: {
    padding: '2px 6px',
    fontSize: '11px',
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '3px',
    fontFamily: 'monospace',
    boxShadow: '0 1px 0 rgba(0, 0, 0, 0.05)',
  },
};

// High contrast mode support
if (window.matchMedia?.('(prefers-contrast: high)').matches) {
  styles.tab = {
    ...styles.tab,
    outline: '2px solid transparent',
  };

  // Add visible focus styles for high contrast
  Object.assign(styles, {
    'tab:focus': {
      outline: '2px solid currentColor',
      outlineOffset: '2px',
    },
    'input:focus': {
      outline: '2px solid currentColor',
      outlineOffset: '1px',
    },
  });
}
