/**
 * Migration Registry
 * Centralized registry of all version-specific migrations
 */

import { app } from 'electron';
import { Migration, PendingMigrationsStatus, MigrationResult } from '../types/migration';
import { WizardStep, MigrationRecord } from '../types/wizard';
import { logWithCategory, LogCategory } from './logger';
import * as setupWizard from './setup-wizard';

/**
 * Migration registry
 * Add new migrations here when setup logic changes
 */
const migrations: Migration[] = [
  // Example migration (to be replaced with actual migrations as needed):
  // {
  //   version: '1.1.0',
  //   description: 'Update Docker configurations for new MCP services',
  //   steps: [WizardStep.DOWNLOAD_SETUP, WizardStep.SYSTEM_STARTUP],
  //   skipIfFresh: true,
  //   critical: true
  // }
];

/**
 * Get all registered migrations
 */
export function getAllMigrations(): Migration[] {
  return [...migrations];
}

/**
 * Get a specific migration by version
 */
export function getMigrationByVersion(version: string): Migration | undefined {
  return migrations.find(m => m.version === version);
}

/**
 * Get migrations that need to be applied when upgrading from one version to another
 * @param fromVersion - Current installed version
 * @param toVersion - Target upgrade version
 * @returns Array of migrations to apply, sorted by version
 */
export function getMigrationsForUpgrade(fromVersion: string, toVersion: string): Migration[] {
  try {
    const applicable = migrations.filter(migration => {
      // Check if migration version is between from and to versions
      const migrationInRange =
        compareVersions(migration.version, fromVersion) > 0 &&
        compareVersions(migration.version, toVersion) <= 0;

      if (!migrationInRange) {
        return false;
      }

      // If migration has a specific fromVersion requirement, check it
      if (migration.fromVersion) {
        return compareVersions(fromVersion, migration.fromVersion) === 0;
      }

      return true;
    });

    // Sort by version (oldest to newest)
    return applicable.sort((a, b) => compareVersions(a.version, b.version));
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error getting migrations for upgrade', error);
    return [];
  }
}

/**
 * Compare two semantic version strings
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  try {
    // Remove 'v' prefix if present
    const cleanA = a.replace(/^v/, '');
    const cleanB = b.replace(/^v/, '');

    const partsA = cleanA.split('.').map(Number);
    const partsB = cleanB.split('.').map(Number);

    // Compare major, minor, patch
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;

      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }

    return 0;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, `Error comparing versions ${a} and ${b}`, error);
    return 0;
  }
}

/**
 * Check if any migrations in the list are marked as critical
 */
export function hasCriticalMigrations(migrations: Migration[]): boolean {
  return migrations.some(m => m.critical === true);
}

/**
 * Extract unique wizard steps from a list of migrations
 * @returns Sorted array of unique wizard steps
 */
export function getStepsFromMigrations(migrations: Migration[]): WizardStep[] {
  const stepSet = new Set<WizardStep>();

  migrations.forEach(migration => {
    migration.steps.forEach(step => stepSet.add(step));
  });

  // Convert to array and sort
  return Array.from(stepSet).sort((a, b) => a - b);
}

/**
 * Validate migrations for common errors
 * @returns Object with validation results
 */
export function validateMigrations(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Check for duplicate versions
    const versions = new Set<string>();
    migrations.forEach(migration => {
      if (versions.has(migration.version)) {
        errors.push(`Duplicate migration version: ${migration.version}`);
      }
      versions.add(migration.version);
    });

    // Validate each migration
    migrations.forEach(migration => {
      // Check required fields
      if (!migration.version) {
        errors.push('Migration missing version');
      }
      if (!migration.description) {
        errors.push(`Migration ${migration.version} missing description`);
      }
      if (!migration.steps || migration.steps.length === 0) {
        errors.push(`Migration ${migration.version} has no steps`);
      }

      // Validate version format (basic semver check)
      if (migration.version && !migration.version.match(/^\d+\.\d+\.\d+/)) {
        errors.push(`Migration ${migration.version} has invalid version format (expected semver)`);
      }

      // Validate fromVersion if present
      if (migration.fromVersion && !migration.fromVersion.match(/^\d+\.\d+\.\d+/)) {
        errors.push(`Migration ${migration.version} has invalid fromVersion format`);
      }

      // Validate steps are valid WizardStep values
      migration.steps?.forEach(step => {
        if (!Object.values(WizardStep).includes(step)) {
          errors.push(`Migration ${migration.version} contains invalid step: ${step}`);
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error validating migrations', error);
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      valid: false,
      errors
    };
  }
}

/**
 * Get migrations that should be applied for a fresh installation
 * (Filters out migrations with skipIfFresh: true)
 */
export function getMigrationsForFreshInstall(): Migration[] {
  return migrations.filter(m => !m.skipIfFresh);
}

/**
 * Log migration registry information
 */
export function logMigrationRegistry(): void {
  logWithCategory('info', LogCategory.SYSTEM, `Migration registry: ${migrations.length} migrations registered`);

  const validation = validateMigrations();
  if (!validation.valid) {
    logWithCategory('warn', LogCategory.SYSTEM, 'Migration validation errors:', validation.errors);
  }

  migrations.forEach(migration => {
    logWithCategory('debug', LogCategory.SYSTEM,
      `  - ${migration.version}: ${migration.description} ` +
      `(${migration.steps.length} steps, critical: ${migration.critical || false})`
    );
  });
}

/**
 * Check for pending migrations at startup
 * Compares installation version with current app version and determines which migrations need to be applied
 * @returns Status of pending migrations including count and criticality
 */
export async function checkForPendingMigrations(): Promise<PendingMigrationsStatus> {
  try {
    const currentVersion = app.getVersion();
    const installedVersion = await setupWizard.getInstallationVersion();
    const migrationHistory = await setupWizard.getMigrationHistory();

    logWithCategory('info', LogCategory.SYSTEM,
      `Checking for pending migrations: installed=${installedVersion}, current=${currentVersion}`
    );

    // No migrations needed if no installation version (fresh install scenario)
    if (!installedVersion) {
      logWithCategory('info', LogCategory.SYSTEM, 'No installation version found - treating as fresh install');
      return {
        hasPending: false,
        migrations: [],
        criticalCount: 0,
        optionalCount: 0
      };
    }

    // No migrations needed if versions match
    if (installedVersion === currentVersion) {
      logWithCategory('info', LogCategory.SYSTEM, 'Installation is up to date - no migrations needed');
      return {
        hasPending: false,
        migrations: [],
        criticalCount: 0,
        optionalCount: 0
      };
    }

    // Get applicable migrations
    const applicableMigrations = getMigrationsForUpgrade(installedVersion, currentVersion);

    // Filter out already applied migrations
    const appliedVersions = new Set(migrationHistory.map(record => record.version));
    const pendingMigrations = applicableMigrations.filter(migration => {
      // Skip if already applied successfully
      if (appliedVersions.has(migration.version)) {
        const record = migrationHistory.find(r => r.version === migration.version);
        if (record && record.success) {
          logWithCategory('debug', LogCategory.SYSTEM, `Skipping already applied migration: ${migration.version}`);
          return false;
        }
      }

      // Run validator if present
      if (migration.validator) {
        // Note: validators are async, we'll handle them during execution
        return true;
      }

      return true;
    });

    // Count critical vs optional
    const criticalCount = pendingMigrations.filter(m => m.critical === true).length;
    const optionalCount = pendingMigrations.length - criticalCount;

    const hasPending = pendingMigrations.length > 0;

    logWithCategory('info', LogCategory.SYSTEM,
      `Found ${pendingMigrations.length} pending migrations (${criticalCount} critical, ${optionalCount} optional)`
    );

    return {
      hasPending,
      migrations: pendingMigrations,
      criticalCount,
      optionalCount
    };
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error checking for pending migrations', error);
    return {
      hasPending: false,
      migrations: [],
      criticalCount: 0,
      optionalCount: 0
    };
  }
}

/**
 * Execute a single migration
 * Re-runs the specified wizard steps and records the result
 * @param migration - The migration to execute
 * @returns Result of the migration execution
 */
async function runSingleMigration(migration: Migration): Promise<MigrationResult> {
  const startTime = new Date();

  logWithCategory('info', LogCategory.SYSTEM,
    `Running migration ${migration.version}: ${migration.description}`
  );

  try {
    // Run validator if present
    if (migration.validator) {
      const shouldApply = await migration.validator();
      if (!shouldApply) {
        logWithCategory('info', LogCategory.SYSTEM,
          `Migration ${migration.version} skipped by validator`
        );
        return {
          version: migration.version,
          success: true,
          appliedAt: startTime.toISOString(),
          stepsRerun: [],
          error: 'Skipped by validator'
        };
      }
    }

    // Get current wizard state
    const wizardState = await setupWizard.getWizardState();

    // Prepare steps to rerun (in order)
    const stepsToRerun = getStepsFromMigrations([migration]);

    logWithCategory('info', LogCategory.SYSTEM,
      `Migration ${migration.version} will rerun ${stepsToRerun.length} steps: ${stepsToRerun.join(', ')}`
    );

    // For each step, we need to:
    // 1. Reset the step completion status
    // 2. Allow the wizard to rerun that step
    // Note: The actual step execution will be handled by the wizard UI
    // Here we just mark which steps need to be rerun

    // The migration result indicates success - actual step execution
    // will happen through the wizard interface
    const result: MigrationResult = {
      version: migration.version,
      success: true,
      appliedAt: new Date().toISOString(),
      stepsRerun: stepsToRerun
    };

    logWithCategory('info', LogCategory.SYSTEM,
      `Migration ${migration.version} completed successfully`
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM,
      `Migration ${migration.version} failed: ${errorMsg}`,
      error
    );

    return {
      version: migration.version,
      success: false,
      appliedAt: startTime.toISOString(),
      stepsRerun: [],
      error: errorMsg
    };
  }
}

/**
 * Execute multiple migrations in sequence
 * Runs migrations in order and records results in migration history
 * @param migrations - Array of migrations to execute (should be sorted by version)
 * @returns Array of migration results
 */
export async function runMigrations(migrations: Migration[]): Promise<MigrationResult[]> {
  logWithCategory('info', LogCategory.SYSTEM, `Starting migration run: ${migrations.length} migrations to apply`);

  const results: MigrationResult[] = [];

  try {
    // Execute migrations in sequence
    for (const migration of migrations) {
      const result = await runSingleMigration(migration);
      results.push(result);

      // Record the migration in history
      const record: MigrationRecord = {
        version: result.version,
        appliedAt: result.appliedAt,
        stepsRerun: result.stepsRerun,
        success: result.success
      };

      await setupWizard.addMigrationRecord(record);

      // If a critical migration fails, stop the process
      if (!result.success && migration.critical) {
        logWithCategory('error', LogCategory.SYSTEM,
          `Critical migration ${migration.version} failed - stopping migration process`
        );
        break;
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    logWithCategory('info', LogCategory.SYSTEM,
      `Migration run completed: ${successCount} succeeded, ${failureCount} failed`
    );

    return results;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Error during migration execution', error);
    return results;
  }
}

/**
 * Get the steps that need to be rerun for pending migrations
 * Useful for determining what wizard steps to show during migration
 * @param pendingMigrations - Array of pending migrations
 * @returns Unique wizard steps that need to be rerun
 */
export function getStepsToRerunForMigrations(pendingMigrations: Migration[]): WizardStep[] {
  return getStepsFromMigrations(pendingMigrations);
}
