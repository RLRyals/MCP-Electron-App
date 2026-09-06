/**
 * Folder Importer
 *
 * Imports workflows from marketplace folder structure:
 * /workflow-folder/
 *   ├── workflow.yaml (or workflow.json)
 *   ├── agents/
 *   │   └── agent-name.md
 *   ├── skills/
 *   │   └── skill-name.md
 *   └── README.md
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { WorkflowParser } from '../parsers/workflow-parser';
import { DependencyResolver } from './dependency-resolver';
import { MCPWorkflowClient } from './mcp-workflow-client';
import { logWithCategory, LogCategory } from '../logger';
import { getDatabasePool } from '../database-connection';

export interface ImportResult {
  success: boolean;
  workflowId?: string;
  version?: string;
  message: string;
  missingDependencies?: {
    agents: string[];
    skills: string[];
    mcpServers: string[];
    subWorkflows: string[];
  };
  installedComponents?: {
    agents: number;
    skills: number;
    subWorkflows: number;
  };
}

export class FolderImporter {
  private parser: WorkflowParser;
  private depResolver: DependencyResolver;
  private workflowClient: MCPWorkflowClient;

  constructor() {
    this.parser = new WorkflowParser();
    this.depResolver = new DependencyResolver();
    this.workflowClient = new MCPWorkflowClient();
  }

  /**
   * Preview workflow metadata without importing
   * Returns the workflow ID, name, version, and duplicate detection info
   */
  async previewWorkflow(folderPath: string): Promise<{
    id: string;
    name: string;
    version: string;
    suggestedId: string;
    isDuplicate: boolean
  } | null> {
    try {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Preview workflow from folder: ${folderPath}`);

      const workflowFile = await this.findWorkflowFile(folderPath);
      if (!workflowFile) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `No workflow file found in: ${folderPath}`);
        return null;
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Preview: Found workflow file: ${workflowFile}`);

      const workflow = await this.parser.parseWorkflow(workflowFile);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Preview: Parsed workflow - id: ${workflow.id}, name: ${workflow.name}`);

      // Check for existing workflows with same ID
      let suggestedId = workflow.id;
      let isDuplicate = false;

      try {
        const existingWorkflows = await this.workflowClient.getWorkflowDefinitions();
        // Defensive check - ensure we have an array before using .map()
        if (!Array.isArray(existingWorkflows)) {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `getWorkflowDefinitions returned non-array: ${typeof existingWorkflows}`);
          return {
            id: workflow.id,
            name: workflow.name,
            version: workflow.version,
            suggestedId: workflow.id,
            isDuplicate: false
          };
        }
        const existingIds = new Set(existingWorkflows.map(w => w.id));

        if (existingIds.has(workflow.id)) {
          isDuplicate = true;
          // Find next available ID by appending incrementing number
          let counter = 2;
          while (existingIds.has(`${workflow.id}-${counter}`)) {
            counter++;
          }
          suggestedId = `${workflow.id}-${counter}`;
        }
      } catch (error: any) {
        // If we can't check for duplicates (e.g., MCP not running),
        // just use the original ID
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Could not check for duplicate workflows: ${error.message}`);
      }

      return {
        id: workflow.id,
        name: workflow.name,
        version: workflow.version,
        suggestedId,
        isDuplicate
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to preview workflow: ${error.message}`);
      return null;
    }
  }

  /**
   * Import workflow from folder
   *
   * Expected structure:
   * /workflow-folder/
   *   ├── workflow.yaml (or workflow.json)
   *   ├── agents/
   *   │   └── agent-name.md
   *   ├── skills/
   *   │   └── skill-name.md
   *   └── README.md
   *
   * @param folderPath Path to workflow folder
   * @param customId Optional custom ID to use instead of the workflow's default ID
   * @param customName Optional custom name to use instead of the workflow's default name
   */
  async importFromFolder(folderPath: string, customId?: string, customName?: string): Promise<ImportResult> {
    try {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Starting workflow import from: ${folderPath}`);

      // 1. Find workflow definition file
      const workflowFile = await this.findWorkflowFile(folderPath);
      if (!workflowFile) {
        return {
          success: false,
          message: `No workflow file found in folder. Expected one of:\n` +
            `  - ${folderPath}/workflow.yaml\n` +
            `  - ${folderPath}/workflow.json\n` +
            `  - ${folderPath}/workflows/*.yaml (Claude Code export format)\n\n` +
            `Please check that you selected the correct folder.`
        };
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Found workflow file: ${workflowFile}`);

      // 2. Read raw workflow file for graph_json (supports both JSON and YAML)
      let rawWorkflowData: any;
      const ext = path.extname(workflowFile).toLowerCase();
      if (ext === '.yaml' || ext === '.yml') {
        const content = await fs.readFile(workflowFile, 'utf-8');
        rawWorkflowData = yaml.load(content);
      } else {
        rawWorkflowData = await fs.readJson(workflowFile);
      }

      // 3. Parse workflow definition (for internal processing)
      const workflow = await this.parser.parseWorkflow(workflowFile);

      // Store original ID for suffix detection
      const originalId = workflow.id;

      // Apply custom ID if provided
      if (customId) {
        workflow.id = customId;
        rawWorkflowData.id = customId;
        logWithCategory('info', LogCategory.WORKFLOW,
          `Using custom workflow ID: ${customId}`);
      }

      // Apply custom name if provided
      if (customName) {
        workflow.name = customName;
        rawWorkflowData.name = customName;
        logWithCategory('info', LogCategory.WORKFLOW,
          `Using custom workflow name: ${customName}`);
      }

      // Detect if we're creating a copy (has a suffix like "-2" or " (2)")
      const suffix = customId ? this.extractSuffix(customId, originalId) : null;
      if (suffix) {
        logWithCategory('info', LogCategory.WORKFLOW,
          `Detected duplicate import with suffix: "${suffix}"`);
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Parsed workflow: ${workflow.name} (${workflow.id}) v${workflow.version}`);

      // 4. Check dependencies
      const depCheck = await this.depResolver.checkDependencies({
        agents: workflow.dependencies.agents,
        skills: workflow.dependencies.skills,
        mcpServers: workflow.dependencies.mcpServers,
        subWorkflows: workflow.dependencies.subWorkflows || []
      });

      logWithCategory('info', LogCategory.WORKFLOW,
        `Dependency check complete: ` +
        `${depCheck.agents.missing.length} agents missing, ` +
        `${depCheck.skills.missing.length} skills missing, ` +
        `${depCheck.subWorkflows.missing.length} sub-workflows missing`);

      // 4a. Import sub-workflows
      // If we have a suffix, import ALL sub-workflows with the suffix (for independent copies)
      // Otherwise, import ALL sub-workflows from the package to ensure updated versions are picked up
      let subWorkflowsInstalled: number;
      const allSubWorkflows = workflow.dependencies.subWorkflows || [];

      if (suffix && allSubWorkflows.length > 0) {
        // Import all sub-workflows with the same suffix for a complete independent copy
        subWorkflowsInstalled = await this.importSubWorkflowsWithSuffix(
          folderPath,
          allSubWorkflows,
          suffix
        );

        // Update subWorkflowId references in graph_json to point to the new copies
        if (rawWorkflowData.graph_json?.nodes) {
          for (const node of rawWorkflowData.graph_json.nodes) {
            if (node.type === 'subworkflow' && node.subWorkflowId) {
              const oldId = node.subWorkflowId;
              node.subWorkflowId = `${oldId}${suffix}`;
              logWithCategory('debug', LogCategory.WORKFLOW,
                `Updated subWorkflowId reference: ${oldId} -> ${node.subWorkflowId}`);
            }
          }
        }

        // Update dependencies list
        workflow.dependencies.subWorkflows = allSubWorkflows.map(sw => `${sw}${suffix}`);
      } else {
        // Normal import - import ALL sub-workflows from package (not just missing ones)
        // This ensures updated sub-workflow versions are re-imported.
        // The MCP import_workflow_definition uses ON CONFLICT ... DO UPDATE,
        // so re-importing existing sub-workflows is safe and will update them in place.
        subWorkflowsInstalled = await this.importSubWorkflowsFromSiblings(
          folderPath,
          allSubWorkflows
        );
      }

      // 4b. Install all agents, skills, and output-styles from package
      const installedCounts = await this.installComponents(folderPath);
      installedCounts.subWorkflows = subWorkflowsInstalled;

      logWithCategory('info', LogCategory.WORKFLOW,
        `Installed ${installedCounts.agents} agents, ${installedCounts.skills} skills, ${installedCounts.subWorkflows} sub-workflows, ${installedCounts.outputStyles} output-styles`);

      // 5. Convert workflow to database format (use original graph_json from file)
      const workflowDefinition = this.convertToWorkflowDefinition(workflow, rawWorkflowData);

      // 6. Import workflow definition to database via MCP
      const result = await this.workflowClient.importWorkflowDefinition(workflowDefinition);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Workflow imported to database: ${result.workflow_id} v${result.version}`);

      // 7. Record import
      await this.recordImport(result.workflow_id, folderPath, installedCounts);

      // Re-check sub-workflows after import attempt
      const remainingSubWorkflows = await this.depResolver.checkSubWorkflows(
        depCheck.subWorkflows.missing
      );

      return {
        success: true,
        workflowId: result.workflow_id,
        version: result.version,
        message: result.message,
        installedComponents: installedCounts,
        missingDependencies: {
          agents: depCheck.agents.missing.filter(_a => !installedCounts.agents),
          skills: depCheck.skills.missing.filter(_s => !installedCounts.skills),
          mcpServers: depCheck.mcpServers.missing,
          subWorkflows: remainingSubWorkflows.missing
        }
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Import failed: ${error.message}`, { stack: error.stack });

      return {
        success: false,
        message: `Import failed: ${error.message}`
      };
    }
  }

  /**
   * Read just the version out of a workflow file on disk (mea-ov6).
   * Used by the auto re-import staleness check, which needs to compare
   * disk vs. DB version cheaply -- unlike previewWorkflow(), this does no
   * DB round-trip for duplicate-ID detection.
   */
  async getFolderVersion(folderPath: string): Promise<string | null> {
    try {
      const workflowFile = await this.findWorkflowFile(folderPath);
      if (!workflowFile) return null;
      const workflow = await this.parser.parseWorkflow(workflowFile);
      return workflow.version;
    } catch (error: any) {
      logWithCategory('warn', LogCategory.WORKFLOW,
        `getFolderVersion: failed to read version from ${folderPath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Find workflow.yaml or workflow.json in folder
   *
   * Checks multiple locations to support both:
   * 1. Direct format: /folder/workflow.yaml (marketplace format)
   * 2. Exported format: /folder/workflows/{id}.yaml (Claude Code export format)
   */
  private async findWorkflowFile(folderPath: string): Promise<string | null> {
    const candidates = ['workflow.yaml', 'workflow.yml', 'workflow.json'];

    logWithCategory('debug', LogCategory.WORKFLOW,
      `findWorkflowFile: Searching in ${folderPath}`);

    // 1. Check direct format first (standard marketplace format)
    for (const filename of candidates) {
      const filePath = path.join(folderPath, filename);
      logWithCategory('debug', LogCategory.WORKFLOW,
        `findWorkflowFile: Checking ${filePath}`);
      if (await fs.pathExists(filePath)) {
        logWithCategory('info', LogCategory.WORKFLOW,
          `findWorkflowFile: Found direct format: ${filePath}`);
        return filePath;
      }
    }

    // 2. Check exported format: /workflows/{id}.yaml or /workflows/{id}.json
    // This is the format produced by ClaudeCodeExporter
    const workflowsDir = path.join(folderPath, 'workflows');
    logWithCategory('debug', LogCategory.WORKFLOW,
      `findWorkflowFile: Checking workflows dir: ${workflowsDir}`);
    if (await fs.pathExists(workflowsDir)) {
      try {
        const files = await fs.readdir(workflowsDir);
        for (const file of files) {
          if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')) {
            const filePath = path.join(workflowsDir, file);
            logWithCategory('info', LogCategory.WORKFLOW,
              `Found workflow file in workflows/ subdirectory: ${filePath}`);
            return filePath;
          }
        }
      } catch (error: any) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Error reading workflows directory: ${error.message}`);
      }
    }

    // 3. Check sub-workflows directory (for nested export packages)
    const subWorkflowsDir = path.join(folderPath, 'sub-workflows');
    if (await fs.pathExists(subWorkflowsDir)) {
      // For sub-workflow packages, check each subdirectory for workflow.yaml
      try {
        const subdirs = await fs.readdir(subWorkflowsDir);
        for (const subdir of subdirs) {
          const subdirPath = path.join(subWorkflowsDir, subdir);
          const stat = await fs.stat(subdirPath);
          if (stat.isDirectory()) {
            for (const filename of candidates) {
              const filePath = path.join(subdirPath, filename);
              if (await fs.pathExists(filePath)) {
                logWithCategory('info', LogCategory.WORKFLOW,
                  `Found workflow file in sub-workflows/${subdir}/: ${filePath}`);
                // Return the parent path, not the sub-workflow itself
                // The user likely meant to import the main workflow
              }
            }
          }
        }
      } catch (error: any) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Error reading sub-workflows directory: ${error.message}`);
      }
    }

    return null;
  }

  /**
   * Convert WorkflowDefinition to database format
   */
  private convertToWorkflowDefinition(workflow: any, rawData: any): any {
    return {
      id: workflow.id,
      name: workflow.name,
      version: workflow.version,
      description: workflow.description,
      // Primary: graph_json from the file (already in WorkflowNode format!)
      graph_json: rawData.graph_json,
      dependencies_json: {
        agents: workflow.dependencies.agents,
        skills: workflow.dependencies.skills,
        mcpServers: workflow.dependencies.mcpServers,
        subWorkflows: workflow.dependencies.subWorkflows
      },
      tags: rawData.tags || workflow.metadata?.tags || [],
      marketplace_metadata: workflow.metadata || {},
      created_by: workflow.metadata?.author || 'FictionLab',
      is_system: rawData.is_system || false
    };
  }

  /**
   * Install agents, skills, and output-styles from workflow folder
   * Only installs components that don't already exist in ~/.claude/ directories
   */
  private async installComponents(
    folderPath: string
  ): Promise<{ agents: number; skills: number; subWorkflows: number; outputStyles: number }> {
    let agentsInstalled = 0;
    let skillsInstalled = 0;
    let outputStylesInstalled = 0;

    const homeDir = require('os').homedir();
    const claudeDir = path.join(homeDir, '.claude');

    // Install agents to ~/.claude/agents/ (where Claude Code reads them)
    // Only install if not already present
    const agentsDir = path.join(folderPath, 'agents');
    if (await fs.pathExists(agentsDir)) {
      const destAgentsDir = path.join(claudeDir, 'agents');
      await fs.ensureDir(destAgentsDir);

      const agentFiles = await fs.readdir(agentsDir);
      for (const file of agentFiles) {
        if (file.endsWith('.md')) {
          const sourceFile = path.join(agentsDir, file);
          const destFile = path.join(destAgentsDir, file);
          // Only install if not already present
          if (!await fs.pathExists(destFile)) {
            await fs.copy(sourceFile, destFile);
            agentsInstalled++;
            logWithCategory('info', LogCategory.WORKFLOW,
              `Installed agent: ${file}`);
          } else {
            logWithCategory('debug', LogCategory.WORKFLOW,
              `Agent already exists, skipping: ${file}`);
          }
        }
      }
    } else {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `No agents folder found in workflow package`);
    }

    // Install skills to ~/.claude/skills/
    // Supports both single file (.md) and directory format (skill-name/SKILL.md)
    // Only install if not already present
    const skillsDir = path.join(folderPath, 'skills');
    if (await fs.pathExists(skillsDir)) {
      const destSkillsDir = path.join(claudeDir, 'skills');
      await fs.ensureDir(destSkillsDir);

      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          // Single file skill -> convert to directory format for Claude Code
          const skillName = path.basename(entry.name, '.md');
          const sourceFile = path.join(skillsDir, entry.name);
          const destDir = path.join(destSkillsDir, skillName);
          const destFile = path.join(destDir, 'SKILL.md');
          const legacyDestFile = path.join(destSkillsDir, entry.name);
          // Only install if not already present (check both formats)
          if (!await fs.pathExists(destDir) && !await fs.pathExists(legacyDestFile)) {
            await fs.ensureDir(destDir);
            await fs.copy(sourceFile, destFile);
            skillsInstalled++;
            logWithCategory('info', LogCategory.WORKFLOW,
              `Installed skill: ${skillName}/SKILL.md`);
          } else {
            logWithCategory('debug', LogCategory.WORKFLOW,
              `Skill already exists, skipping: ${skillName}`);
          }
        } else if (entry.isDirectory()) {
          // Directory format skill - copy entire directory
          const sourceDir = path.join(skillsDir, entry.name);
          const destDir = path.join(destSkillsDir, entry.name);
          // Only install if not already present
          if (!await fs.pathExists(destDir)) {
            await fs.copy(sourceDir, destDir);
            skillsInstalled++;
            logWithCategory('info', LogCategory.WORKFLOW,
              `Installed skill (directory): ${entry.name}/`);
          } else {
            logWithCategory('debug', LogCategory.WORKFLOW,
              `Skill directory already exists, skipping: ${entry.name}/`);
          }
        }
      }
    } else {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `No skills folder found in workflow package`);
    }

    // Install output-styles to ~/.claude/output-styles/
    // Only install if not already present
    const outputStylesDir = path.join(folderPath, 'output-styles');
    if (await fs.pathExists(outputStylesDir)) {
      const destOutputStylesDir = path.join(claudeDir, 'output-styles');
      await fs.ensureDir(destOutputStylesDir);

      const styleFiles = await fs.readdir(outputStylesDir);
      for (const file of styleFiles) {
        if (file.endsWith('.md')) {
          const sourceFile = path.join(outputStylesDir, file);
          const destFile = path.join(destOutputStylesDir, file);
          // Only install if not already present
          if (!await fs.pathExists(destFile)) {
            await fs.copy(sourceFile, destFile);
            outputStylesInstalled++;
            logWithCategory('info', LogCategory.WORKFLOW,
              `Installed output-style: ${file}`);
          } else {
            logWithCategory('debug', LogCategory.WORKFLOW,
              `Output-style already exists, skipping: ${file}`);
          }
        }
      }
    } else {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `No output-styles folder found in workflow package`);
    }

    return { agents: agentsInstalled, skills: skillsInstalled, subWorkflows: 0, outputStyles: outputStylesInstalled };
  }

  /**
   * Record import in workflow_imports table
   */
  private async recordImport(
    workflowId: string,
    sourcePath: string,
    installed: { agents: number; skills: number }
  ): Promise<void> {
    try {
      const pool = getDatabasePool();

      await pool.query(`
        INSERT INTO fictionlab.workflow_imports (
          workflow_id, source_type, source_path, installation_log
        ) VALUES ($1, $2, $3, $4)
      `, [
        workflowId,
        'folder',
        sourcePath,
        { timestamp: new Date().toISOString(), installed }
      ]);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Recorded import in database for workflow: ${workflowId}`);
    } catch (error: any) {
      // Log but don't fail the import if recording fails
      logWithCategory('warn', LogCategory.WORKFLOW,
        `Failed to record import: ${error.message}`);
    }
  }

  /**
   * Import sub-workflows from the export package
   * Checks multiple locations:
   * 1. sub-workflows/ directory inside the export package (Claude Code export format)
   * 2. Sibling folders in the parent directory (marketplace format)
   *
   * Re-imports all specified sub-workflows (not just missing ones) to ensure
   * updated versions are picked up. The MCP import uses ON CONFLICT ... DO UPDATE
   * so re-importing existing sub-workflows is safe.
   */
  private async importSubWorkflowsFromSiblings(
    folderPath: string,
    subWorkflowIds: string[]
  ): Promise<number> {
    if (subWorkflowIds.length === 0) {
      return 0;
    }

    let imported = 0;
    // Track which sub-workflows still need to be found via sibling search
    const remaining = [...subWorkflowIds];

    // 1. First check sub-workflows/ directory inside the package (Claude Code export format)
    const subWorkflowsDir = path.join(folderPath, 'sub-workflows');
    if (await fs.pathExists(subWorkflowsDir)) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Found sub-workflows directory: ${subWorkflowsDir}`);

      for (const subWorkflowId of [...remaining]) {
        const subWorkflowPath = path.join(subWorkflowsDir, subWorkflowId);

        if (await fs.pathExists(subWorkflowPath)) {
          const workflowFile = await this.findWorkflowFile(subWorkflowPath);
          if (workflowFile) {
            try {
              logWithCategory('info', LogCategory.WORKFLOW,
                `Found sub-workflow ${subWorkflowId} in sub-workflows/ directory, importing...`);

              // Recursively import (this will handle nested sub-workflows too)
              const result = await this.importFromFolder(subWorkflowPath);
              if (result.success) {
                imported++;
                // Remove from remaining list so we don't try sibling search for it
                const idx = remaining.indexOf(subWorkflowId);
                if (idx > -1) remaining.splice(idx, 1);
                logWithCategory('info', LogCategory.WORKFLOW,
                  `Successfully imported sub-workflow from package: ${subWorkflowId}`);
              } else {
                logWithCategory('warn', LogCategory.WORKFLOW,
                  `Failed to import sub-workflow ${subWorkflowId}: ${result.message}`);
              }
            } catch (error: any) {
              logWithCategory('warn', LogCategory.WORKFLOW,
                `Error importing sub-workflow ${subWorkflowId}: ${error.message}`);
            }
          }
        }
      }
    }

    // 2. Check sibling folders in the parent directory for any remaining sub-workflows
    if (remaining.length > 0) {
      const parentDir = path.dirname(folderPath);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Looking for remaining ${remaining.length} sub-workflows in parent directory: ${parentDir}`);

      for (const subWorkflowId of remaining) {
        // Try common naming patterns
        const candidates = [
          path.join(parentDir, subWorkflowId),
          path.join(parentDir, subWorkflowId.replace(/-/g, '_')),
        ];

        for (const candidatePath of candidates) {
          if (await fs.pathExists(candidatePath)) {
            const workflowFile = await this.findWorkflowFile(candidatePath);
            if (workflowFile) {
              try {
                // Verify this is the right workflow
                const preview = await this.previewWorkflow(candidatePath);
                if (preview && (preview.id === subWorkflowId || preview.id.includes(subWorkflowId))) {
                  logWithCategory('info', LogCategory.WORKFLOW,
                    `Found sub-workflow ${subWorkflowId} at ${candidatePath}, importing...`);

                  // Recursively import (this will handle nested sub-workflows too)
                  const result = await this.importFromFolder(candidatePath);
                  if (result.success) {
                    imported++;
                    logWithCategory('info', LogCategory.WORKFLOW,
                      `Successfully imported sub-workflow: ${subWorkflowId}`);
                  } else {
                    logWithCategory('warn', LogCategory.WORKFLOW,
                      `Failed to import sub-workflow ${subWorkflowId}: ${result.message}`);
                  }
                  break; // Found and processed, move to next sub-workflow
                }
              } catch (error: any) {
                logWithCategory('warn', LogCategory.WORKFLOW,
                  `Error importing sub-workflow ${subWorkflowId}: ${error.message}`);
              }
            }
          }
        }
      }
    }

    return imported;
  }

  /**
   * Extract suffix from customId compared to originalId
   * Examples:
   *   extractSuffix("workflow-2", "workflow") => "-2"
   *   extractSuffix("workflow (2)", "workflow") => " (2)"
   *   extractSuffix("workflow", "workflow") => null
   */
  private extractSuffix(customId: string, originalId: string): string | null {
    if (customId === originalId) {
      return null;
    }

    // Check for "-N" suffix pattern
    const dashMatch = customId.match(new RegExp(`^${this.escapeRegExp(originalId)}(-\\d+)$`));
    if (dashMatch) {
      return dashMatch[1];
    }

    // Check for " (N)" suffix pattern
    const parenMatch = customId.match(new RegExp(`^${this.escapeRegExp(originalId)}( \\(\\d+\\))$`));
    if (parenMatch) {
      return parenMatch[1];
    }

    // If customId starts with originalId, extract whatever comes after
    if (customId.startsWith(originalId)) {
      return customId.slice(originalId.length);
    }

    return null;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Import sub-workflows with suffix for duplicate handling
   * When main workflow gets a suffix (e.g., "-2"), sub-workflows also get the same suffix
   */
  private async importSubWorkflowsWithSuffix(
    folderPath: string,
    subWorkflowIds: string[],
    suffix: string | null
  ): Promise<number> {
    if (subWorkflowIds.length === 0) {
      return 0;
    }

    let imported = 0;
    const subWorkflowsDir = path.join(folderPath, 'sub-workflows');

    if (!await fs.pathExists(subWorkflowsDir)) {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `No sub-workflows directory found at: ${subWorkflowsDir}`);
      return 0;
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Importing ${subWorkflowIds.length} sub-workflows${suffix ? ` with suffix "${suffix}"` : ''}`);

    for (const subWorkflowId of subWorkflowIds) {
      const subWorkflowPath = path.join(subWorkflowsDir, subWorkflowId);

      if (!await fs.pathExists(subWorkflowPath)) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Sub-workflow folder not found: ${subWorkflowPath}`);
        continue;
      }

      const workflowFile = await this.findWorkflowFile(subWorkflowPath);
      if (!workflowFile) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `No workflow file found in sub-workflow folder: ${subWorkflowPath}`);
        continue;
      }

      try {
        // Get preview to find original name
        const preview = await this.previewWorkflow(subWorkflowPath);
        if (!preview) {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Failed to preview sub-workflow: ${subWorkflowId}`);
          continue;
        }

        // Generate new ID and name with suffix
        const newId = suffix ? `${subWorkflowId}${suffix}` : subWorkflowId;
        const newName = suffix ? `${preview.name}${suffix}` : preview.name;

        logWithCategory('info', LogCategory.WORKFLOW,
          `Importing sub-workflow: ${subWorkflowId} -> ${newId} (${newName})`);

        // Import with new ID and name
        const result = await this.importFromFolder(subWorkflowPath, newId, newName);

        if (result.success) {
          imported++;
          logWithCategory('info', LogCategory.WORKFLOW,
            `Successfully imported sub-workflow: ${newId}`);
        } else {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Failed to import sub-workflow ${subWorkflowId}: ${result.message}`);
        }
      } catch (error: any) {
        logWithCategory('error', LogCategory.WORKFLOW,
          `Error importing sub-workflow ${subWorkflowId}: ${error.message}`);
      }
    }

    return imported;
  }

  /**
   * List available agents in a workflow folder
   */
  async listAgentsInFolder(folderPath: string): Promise<string[]> {
    const agentsDir = path.join(folderPath, 'agents');
    if (!await fs.pathExists(agentsDir)) {
      return [];
    }

    const files = await fs.readdir(agentsDir);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => path.basename(file, '.md'));
  }

  /**
   * List available skills in a workflow folder
   */
  async listSkillsInFolder(folderPath: string): Promise<string[]> {
    const skillsDir = path.join(folderPath, 'skills');
    if (!await fs.pathExists(skillsDir)) {
      return [];
    }

    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const skills: string[] = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        // Flat file format: skill-name.md
        skills.push(path.basename(entry.name, '.md'));
      } else if (entry.isDirectory()) {
        // Directory format: skill-name/SKILL.md
        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
        if (await fs.pathExists(skillMdPath)) {
          skills.push(entry.name);
        }
      }
    }
    return skills;
  }
}
