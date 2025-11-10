/**
 * Migration Registry
 * Centralized registry of all version-specific migrations
 */

import { Migration } from '../types/migration';
import { WizardStep } from '../types/wizard';
import { logWithCategory, LogCategory } from './logger';

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
