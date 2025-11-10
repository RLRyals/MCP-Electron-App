/**
 * Wizard Types
 * Type definitions for the setup wizard system
 */

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
  buildPipeline?: {
    completed: boolean;
    clonedRepositories?: string[];
    builtRepositories?: string[];
    dockerImages?: string[];
    verifiedArtifacts?: string[];
  };
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
 * Migration record interface for tracking applied migrations
 */
export interface MigrationRecord {
  version: string;
  appliedAt: string;  // ISO timestamp
  stepsRerun: WizardStep[];
  success: boolean;
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
  installationVersion?: string;     // Version when wizard was completed
  lastMigrationVersion?: string;    // Last migration that was applied
  migrationHistory?: MigrationRecord[];  // History of applied migrations
}
