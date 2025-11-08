/**
 * Setup Configuration Validator
 * Validates the setup configuration against the schema
 */

import * as fs from 'fs';
import { SetupConfig, ConfigValidationResult, Repository, BuildStep, BuildOrder, ComponentFlag } from '../types/setup-config';

/**
 * Validate a repository definition
 */
function validateRepository(repo: Repository, index: number): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!repo.id || repo.id.trim() === '') {
    errors.push(`Repository[${index}]: id is required`);
  } else if (!/^[a-zA-Z0-9_-]+$/.test(repo.id)) {
    errors.push(`Repository[${index}]: id can only contain letters, numbers, underscores, and hyphens`);
  }

  if (!repo.name || repo.name.trim() === '') {
    errors.push(`Repository[${index}]: name is required`);
  }

  if (!repo.url || repo.url.trim() === '') {
    errors.push(`Repository[${index}]: url is required`);
  } else if (!isValidUrl(repo.url)) {
    errors.push(`Repository[${index}]: url must be a valid git repository URL`);
  }

  if (!repo.clonePath || repo.clonePath.trim() === '') {
    errors.push(`Repository[${index}]: clonePath is required`);
  } else if (repo.clonePath.includes('~')) {
    warnings.push(`Repository[${index}]: clonePath contains tilde (~) which may not expand correctly`);
  }

  if (repo.branch && repo.branch.trim() === '') {
    errors.push(`Repository[${index}]: branch must not be empty if specified`);
  }

  if (repo.version && repo.version.trim() === '') {
    errors.push(`Repository[${index}]: version must not be empty if specified`);
  }

  return { errors, warnings };
}

/**
 * Validate build step definition
 */
function validateBuildStep(step: BuildStep, index: number, repositoryIds: Set<string>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!step.id || step.id.trim() === '') {
    errors.push(`BuildStep[${index}]: id is required`);
  } else if (!/^[a-zA-Z0-9_-]+$/.test(step.id)) {
    errors.push(`BuildStep[${index}]: id can only contain letters, numbers, underscores, and hyphens`);
  }

  if (!step.name || step.name.trim() === '') {
    errors.push(`BuildStep[${index}]: name is required`);
  }

  if (!step.repositoryId || step.repositoryId.trim() === '') {
    errors.push(`BuildStep[${index}]: repositoryId is required`);
  } else if (!repositoryIds.has(step.repositoryId)) {
    errors.push(`BuildStep[${index}]: repositoryId '${step.repositoryId}' does not exist in repositories`);
  }

  if (!step.command || step.command.trim() === '') {
    errors.push(`BuildStep[${index}]: command is required`);
  }

  if (step.timeout !== undefined && step.timeout <= 0) {
    errors.push(`BuildStep[${index}]: timeout must be greater than 0`);
  }

  return { errors, warnings };
}

/**
 * Validate build order
 */
function validateBuildOrder(order: BuildOrder, repositoryIds: Set<string>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!order.order || order.order.length === 0) {
    errors.push('BuildOrder.order: must contain at least one repository');
  } else {
    const seenIds = new Set<string>();

    for (let i = 0; i < order.order.length; i++) {
      const repoId = order.order[i];

      if (!repoId || repoId.trim() === '') {
        errors.push(`BuildOrder.order[${i}]: repository ID cannot be empty`);
      } else if (!repositoryIds.has(repoId)) {
        errors.push(`BuildOrder.order[${i}]: repository ID '${repoId}' does not exist`);
      }

      if (seenIds.has(repoId)) {
        errors.push(`BuildOrder.order[${i}]: duplicate repository ID '${repoId}'`);
      }
      seenIds.add(repoId);
    }
  }

  // Validate dependencies
  if (order.dependencies) {
    for (const [repoId, deps] of Object.entries(order.dependencies)) {
      if (!repositoryIds.has(repoId)) {
        errors.push(`BuildOrder.dependencies: repository ID '${repoId}' does not exist`);
      }

      if (Array.isArray(deps)) {
        for (const depId of deps) {
          if (!repositoryIds.has(depId)) {
            errors.push(`BuildOrder.dependencies['${repoId}']: dependency '${depId}' does not exist`);
          }

          if (depId === repoId) {
            errors.push(`BuildOrder.dependencies['${repoId}']: cannot depend on itself`);
          }
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * Validate component flag
 */
function validateComponentFlag(flag: ComponentFlag, index: number, repositoryIds: Set<string>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!flag.id || flag.id.trim() === '') {
    errors.push(`ComponentFlag[${index}]: id is required`);
  } else if (!/^[a-zA-Z0-9_-]+$/.test(flag.id)) {
    errors.push(`ComponentFlag[${index}]: id can only contain letters, numbers, underscores, and hyphens`);
  }

  if (!flag.name || flag.name.trim() === '') {
    errors.push(`ComponentFlag[${index}]: name is required`);
  }

  if (!flag.repositoryIds || flag.repositoryIds.length === 0) {
    errors.push(`ComponentFlag[${index}]: repositoryIds must contain at least one repository`);
  } else {
    for (const repoId of flag.repositoryIds) {
      if (!repositoryIds.has(repoId)) {
        errors.push(`ComponentFlag[${index}]: repositoryId '${repoId}' does not exist in repositories`);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  // Check if it looks like a git URL (HTTP, HTTPS, or SSH)
  return /^(https?:\/\/|git@|ssh:\/\/)/.test(url);
}

/**
 * Validate the entire setup configuration
 */
export function validateSetupConfig(config: unknown): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if config is an object
  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      errors: ['Configuration must be a valid object'],
      warnings: [],
    };
  }

  const cfg = config as Record<string, unknown>;

  // Validate version
  if (typeof cfg.version !== 'string' || cfg.version.trim() === '') {
    errors.push('version is required and must be a non-empty string');
  }

  // Validate baseClonePath
  if (typeof cfg.baseClonePath !== 'string' || cfg.baseClonePath.trim() === '') {
    errors.push('baseClonePath is required and must be a non-empty string');
  }

  // Validate repositories
  if (!Array.isArray(cfg.repositories)) {
    errors.push('repositories must be an array');
  } else if (cfg.repositories.length === 0) {
    errors.push('repositories must contain at least one repository');
  } else {
    const repositoryIds = new Set<string>();

    for (let i = 0; i < cfg.repositories.length; i++) {
      const repo = cfg.repositories[i] as Record<string, unknown>;
      const { errors: repoErrors, warnings: repoWarnings } = validateRepository(repo as unknown as Repository, i);
      errors.push(...repoErrors);
      warnings.push(...repoWarnings);

      if (repo.id && typeof repo.id === 'string') {
        repositoryIds.add(repo.id);
      }
    }

    // Validate buildOrder
    if (cfg.buildOrder) {
      const { errors: orderErrors, warnings: orderWarnings } = validateBuildOrder(cfg.buildOrder as BuildOrder, repositoryIds);
      errors.push(...orderErrors);
      warnings.push(...orderWarnings);
    } else {
      errors.push('buildOrder is required');
    }

    // Validate buildSteps
    if (Array.isArray(cfg.buildSteps)) {
      const stepIds = new Set<string>();

      for (let i = 0; i < cfg.buildSteps.length; i++) {
        const step = cfg.buildSteps[i] as Record<string, unknown>;
        const { errors: stepErrors, warnings: stepWarnings } = validateBuildStep(step as unknown as BuildStep, i, repositoryIds);
        errors.push(...stepErrors);
        warnings.push(...stepWarnings);

        if (step.id && typeof step.id === 'string') {
          if (stepIds.has(step.id)) {
            errors.push(`BuildStep[${i}]: duplicate step ID '${step.id}'`);
          }
          stepIds.add(step.id);
        }
      }
    } else if (cfg.buildSteps !== undefined) {
      errors.push('buildSteps must be an array if provided');
    }

    // Validate components
    if (cfg.components) {
      if (!Array.isArray(cfg.components)) {
        errors.push('components must be an array');
      } else {
        const componentIds = new Set<string>();

        for (let i = 0; i < cfg.components.length; i++) {
          const component = cfg.components[i] as Record<string, unknown>;
          const { errors: compErrors, warnings: compWarnings } = validateComponentFlag(component as unknown as ComponentFlag, i, repositoryIds);
          errors.push(...compErrors);
          warnings.push(...compWarnings);

          if (component.id && typeof component.id === 'string') {
            if (componentIds.has(component.id)) {
              errors.push(`ComponentFlag[${i}]: duplicate component ID '${component.id}'`);
            }
            componentIds.add(component.id);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Load and validate setup configuration from a file path
 */
export function loadAndValidateConfig(filePath: string): { config: SetupConfig | null; validation: ConfigValidationResult } {
  let config: SetupConfig | null = null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    config = JSON.parse(content);
  } catch (error) {
    return {
      config: null,
      validation: {
        valid: false,
        errors: [`Failed to load configuration file: ${String(error)}`],
        warnings: [],
      },
    };
  }

  const validation = validateSetupConfig(config);

  return {
    config: validation.valid ? config : null,
    validation,
  };
}
