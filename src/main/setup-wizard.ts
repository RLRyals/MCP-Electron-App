/**
 * Setup Wizard Module
 * Manages the first-run setup wizard state and progress
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { logWithCategory, LogCategory } from './logger';

/**
 * Wizard step enum
 */
export enum WizardStep {
  WELCOME = 1,
  PREREQUISITES = 2,
  ENVIRONMENT = 3,
  CLIENT_SELECTION = 4,
  DOWNLOAD_SETUP = 5,
  SYSTEM_STARTUP = 6,
  COMPLETE = 7
}

/**
 * Wizard step data interface
 */
export interface WizardStepData {
  // Step 2: Prerequisites
  prerequisites?: {
    docker: boolean;
    git: boolean;
    wsl?: boolean;
  };

  // Step 3: Environment configuration
  environment?: {
    saved: boolean;
    configPath?: string;
  };

  // Step 4: Client selection
  clients?: string[];

  // Step 5: Download & setup
  downloads?: {
    typingMindCompleted: boolean;
    dockerImagesCompleted: boolean;
  };

  // Step 6: System startup
  systemStartup?: {
    started: boolean;
    healthy: boolean;
  };
}

/**
 * Wizard state interface
 */
export interface WizardState {
  completed: boolean;
  currentStep: WizardStep;
  stepsCompleted: WizardStep[];
  data: WizardStepData;
  startedAt?: string;
  completedAt?: string;
  version?: string;
}

/**
 * Get the path to the wizard state file
 */
function getWizardStatePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'setup-wizard.json');
}

/**
 * Get the default wizard state
 */
function getDefaultWizardState(): WizardState {
  return {
    completed: false,
    currentStep: WizardStep.WELCOME,
    stepsCompleted: [],
    data: {},
    version: app.getVersion()
  };
}

/**
 * Check if this is the first run (wizard not completed)
 */
export async function isFirstRun(): Promise<boolean> {
  const statePath = getWizardStatePath();

  try {
    if (!await fs.pathExists(statePath)) {
      logWithCategory('info', LogCategory.SYSTEM, 'No wizard state file found - first run');
      return true;
    }

    const state: WizardState = await fs.readJson(statePath);
    const isFirst = !state.completed;

    logWithCategory('info', LogCategory.SYSTEM, `First run check: ${isFirst}`);
    return isFirst;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error checking first run status', error);
    // If we can't read the state, assume first run for safety
    return true;
  }
}

/**
 * Get the current wizard state
 */
export async function getWizardState(): Promise<WizardState> {
  const statePath = getWizardStatePath();

  try {
    if (!await fs.pathExists(statePath)) {
      logWithCategory('info', LogCategory.SYSTEM, 'No wizard state found, returning defaults');
      return getDefaultWizardState();
    }

    const state: WizardState = await fs.readJson(statePath);
    logWithCategory('info', LogCategory.SYSTEM, `Loaded wizard state: step ${state.currentStep}, completed: ${state.completed}`);
    return state;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error loading wizard state, returning defaults', error);
    return getDefaultWizardState();
  }
}

/**
 * Save wizard state
 */
export async function saveWizardState(
  step: WizardStep,
  data?: Partial<WizardStepData>
): Promise<{ success: boolean; error?: string }> {
  const statePath = getWizardStatePath();

  try {
    // Load current state
    const currentState = await getWizardState();

    // Update state
    const updatedState: WizardState = {
      ...currentState,
      currentStep: step,
      data: {
        ...currentState.data,
        ...data
      },
      version: app.getVersion()
    };

    // Add step to completed list if not already there
    if (!updatedState.stepsCompleted.includes(step) && step < WizardStep.COMPLETE) {
      updatedState.stepsCompleted.push(step);
      updatedState.stepsCompleted.sort((a, b) => a - b);
    }

    // Set startedAt if not set
    if (!updatedState.startedAt) {
      updatedState.startedAt = new Date().toISOString();
    }

    // Ensure directory exists
    await fs.ensureDir(path.dirname(statePath));

    // Save state
    await fs.writeJson(statePath, updatedState, { spaces: 2 });

    logWithCategory('info', LogCategory.SYSTEM, `Saved wizard state: step ${step}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to save wizard state', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Mark step as completed and move to next step
 */
export async function completeStep(
  step: WizardStep,
  data?: Partial<WizardStepData>
): Promise<{ success: boolean; error?: string; nextStep?: WizardStep }> {
  try {
    // Determine next step
    const nextStep = step < WizardStep.COMPLETE ? (step + 1) as WizardStep : WizardStep.COMPLETE;

    // Save state with next step
    const result = await saveWizardState(nextStep, data);

    if (result.success) {
      logWithCategory('info', LogCategory.SYSTEM, `Completed step ${step}, moving to step ${nextStep}`);
      return { success: true, nextStep };
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to complete step', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Go back to a previous step
 */
export async function goToStep(step: WizardStep): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await saveWizardState(step);

    if (result.success) {
      logWithCategory('info', LogCategory.SYSTEM, `Navigated to step ${step}`);
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to navigate to step', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Mark the wizard as complete
 */
export async function markWizardComplete(): Promise<{ success: boolean; error?: string }> {
  const statePath = getWizardStatePath();

  try {
    const currentState = await getWizardState();

    const completedState: WizardState = {
      ...currentState,
      completed: true,
      currentStep: WizardStep.COMPLETE,
      completedAt: new Date().toISOString()
    };

    // Mark all steps as completed
    completedState.stepsCompleted = [
      WizardStep.WELCOME,
      WizardStep.PREREQUISITES,
      WizardStep.ENVIRONMENT,
      WizardStep.CLIENT_SELECTION,
      WizardStep.DOWNLOAD_SETUP,
      WizardStep.SYSTEM_STARTUP,
      WizardStep.COMPLETE
    ];

    await fs.writeJson(statePath, completedState, { spaces: 2 });

    logWithCategory('info', LogCategory.SYSTEM, 'Setup wizard marked as complete');
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to mark wizard as complete', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Reset the wizard (start over)
 */
export async function resetWizard(): Promise<{ success: boolean; error?: string }> {
  const statePath = getWizardStatePath();

  try {
    // Delete the state file
    if (await fs.pathExists(statePath)) {
      await fs.remove(statePath);
    }

    logWithCategory('info', LogCategory.SYSTEM, 'Setup wizard reset');
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to reset wizard', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Get wizard progress percentage (0-100)
 */
export async function getWizardProgress(): Promise<number> {
  const state = await getWizardState();

  if (state.completed) {
    return 100;
  }

  // Calculate based on current step (7 total steps)
  const totalSteps = 7;
  const progress = ((state.currentStep - 1) / totalSteps) * 100;

  return Math.round(progress);
}

/**
 * Check if a specific step is completed
 */
export async function isStepCompleted(step: WizardStep): Promise<boolean> {
  const state = await getWizardState();
  return state.stepsCompleted.includes(step);
}

/**
 * Get wizard state file path (for debugging)
 */
export function getWizardStateFilePath(): string {
  return getWizardStatePath();
}

/**
 * Get step name for display
 */
export function getStepName(step: WizardStep): string {
  const names: Record<WizardStep, string> = {
    [WizardStep.WELCOME]: 'Welcome',
    [WizardStep.PREREQUISITES]: 'Prerequisites Check',
    [WizardStep.ENVIRONMENT]: 'Environment Configuration',
    [WizardStep.CLIENT_SELECTION]: 'Client Selection',
    [WizardStep.DOWNLOAD_SETUP]: 'Download & Setup',
    [WizardStep.SYSTEM_STARTUP]: 'System Startup',
    [WizardStep.COMPLETE]: 'Setup Complete'
  };

  return names[step] || 'Unknown';
}

/**
 * Get step description for display
 */
export function getStepDescription(step: WizardStep): string {
  const descriptions: Record<WizardStep, string> = {
    [WizardStep.WELCOME]: 'Welcome to MCP Writing System setup',
    [WizardStep.PREREQUISITES]: 'Checking system requirements',
    [WizardStep.ENVIRONMENT]: 'Configuring database and services',
    [WizardStep.CLIENT_SELECTION]: 'Choose your MCP clients',
    [WizardStep.DOWNLOAD_SETUP]: 'Downloading and preparing components',
    [WizardStep.SYSTEM_STARTUP]: 'Starting MCP services',
    [WizardStep.COMPLETE]: 'Setup complete!'
  };

  return descriptions[step] || '';
}

/**
 * Validate that wizard can proceed to next step
 */
export async function canProceedToNextStep(currentStep: WizardStep): Promise<{
  canProceed: boolean;
  reason?: string;
}> {
  const state = await getWizardState();

  switch (currentStep) {
    case WizardStep.WELCOME:
      // Can always proceed from welcome
      return { canProceed: true };

    case WizardStep.PREREQUISITES:
      // Check that prerequisites are met
      if (!state.data.prerequisites?.docker || !state.data.prerequisites?.git) {
        return {
          canProceed: false,
          reason: 'Docker and Git must be installed and running'
        };
      }
      return { canProceed: true };

    case WizardStep.ENVIRONMENT:
      // Check that environment is configured
      if (!state.data.environment?.saved) {
        return {
          canProceed: false,
          reason: 'Environment configuration must be saved'
        };
      }
      return { canProceed: true };

    case WizardStep.CLIENT_SELECTION:
      // At least one client should be selected (or can skip)
      return { canProceed: true };

    case WizardStep.DOWNLOAD_SETUP:
      // Check that downloads are complete
      const needsTypingMind = state.data.clients?.includes('typingmind');
      if (needsTypingMind && !state.data.downloads?.typingMindCompleted) {
        return {
          canProceed: false,
          reason: 'Downloads must complete successfully'
        };
      }
      if (!state.data.downloads?.dockerImagesCompleted) {
        return {
          canProceed: false,
          reason: 'Docker images must be loaded'
        };
      }
      return { canProceed: true };

    case WizardStep.SYSTEM_STARTUP:
      // Check that system is healthy
      if (!state.data.systemStartup?.started || !state.data.systemStartup?.healthy) {
        return {
          canProceed: false,
          reason: 'System must be running and healthy'
        };
      }
      return { canProceed: true };

    case WizardStep.COMPLETE:
      // Already at the end
      return { canProceed: true };

    default:
      return { canProceed: false, reason: 'Invalid step' };
  }
}
