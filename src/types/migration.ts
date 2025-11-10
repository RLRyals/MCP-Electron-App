/**
 * Migration Types
 * Type definitions for the migration system
 */

import { WizardStep } from './wizard';

/**
 * Migration definition interface
 * Defines a version-specific migration that re-runs certain wizard steps
 */
export interface Migration {
  version: string;
  description: string;
  steps: WizardStep[];
  skipIfFresh?: boolean;        // Skip this migration for fresh installations
  critical?: boolean;           // If true, migration must be run immediately
  fromVersion?: string;         // Only apply if upgrading from this specific version
  validator?: MigrationValidator;
}

/**
 * Migration validator function type
 * Returns true if migration should be applied, false otherwise
 */
export type MigrationValidator = () => Promise<boolean>;

/**
 * Migration result interface
 * Records the outcome of a migration execution
 */
export interface MigrationResult {
  version: string;
  success: boolean;
  appliedAt: string;            // ISO timestamp
  stepsRerun: WizardStep[];
  error?: string;
}

/**
 * Pending migrations status
 * Information about migrations that need to be applied
 */
export interface PendingMigrationsStatus {
  hasPending: boolean;
  migrations: Migration[];
  criticalCount: number;
  optionalCount: number;
}
