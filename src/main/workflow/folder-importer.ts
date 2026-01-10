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
import { app } from 'electron';
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
      const workflowFile = await this.findWorkflowFile(folderPath);
      if (!workflowFile) {
        return null;
      }

      const workflow = await this.parser.parseWorkflow(workflowFile);

      // Check for existing workflows with same ID
      let suggestedId = workflow.id;
      let isDuplicate = false;

      try {
        const existingWorkflows = await this.workflowClient.getWorkflowDefinitions();
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
          message: 'No workflow.yaml or workflow.json found in folder'
        };
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Found workflow file: ${workflowFile}`);

      // 2. Read raw workflow file for graph_json
      const rawWorkflowData = await fs.readJson(workflowFile);

      // 3. Parse workflow definition (for internal processing)
      const workflow = await this.parser.parseWorkflow(workflowFile);

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

      // 4a. Try to import missing sub-workflows from sibling folders
      const subWorkflowsInstalled = await this.importSubWorkflowsFromSiblings(
        folderPath,
        depCheck.subWorkflows.missing
      );

      // 4b. Install missing agents and skills
      const installedCounts = await this.installComponents(
        folderPath,
        depCheck.agents.missing,
        depCheck.skills.missing
      );
      installedCounts.subWorkflows = subWorkflowsInstalled;

      logWithCategory('info', LogCategory.WORKFLOW,
        `Installed ${installedCounts.agents} agents, ${installedCounts.skills} skills, ${installedCounts.subWorkflows} sub-workflows`);

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
   * Find workflow.yaml or workflow.json in folder
   */
  private async findWorkflowFile(folderPath: string): Promise<string | null> {
    const candidates = ['workflow.yaml', 'workflow.yml', 'workflow.json'];

    for (const filename of candidates) {
      const filePath = path.join(folderPath, filename);
      if (await fs.pathExists(filePath)) {
        return filePath;
      }
    }

    return null;
  }

  /**
   * Convert WorkflowDefinition to database format
   * Uses graph_json as the primary format (phases_json is deprecated)
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
      // Deprecated: phases_json only included for MCP backward compatibility
      // Will be removed when MCP server is updated
      phases_json: rawData.phases_json || [],
      tags: rawData.tags || workflow.metadata?.tags || [],
      marketplace_metadata: workflow.metadata || {},
      created_by: workflow.metadata?.author || 'FictionLab',
      is_system: rawData.is_system || false
    };
  }

  /**
   * Install agents and skills from workflow folder
   */
  private async installComponents(
    folderPath: string,
    missingAgents: string[],
    missingSkills: string[]
  ): Promise<{ agents: number; skills: number; subWorkflows: number }> {
    let agentsInstalled = 0;
    let skillsInstalled = 0;

    const userDataPath = app.getPath('userData');
    const homeDir = require('os').homedir();

    // Install agents
    const agentsDir = path.join(folderPath, 'agents');
    if (await fs.pathExists(agentsDir)) {
      for (const agent of missingAgents) {
        const sourceFile = path.join(agentsDir, `${agent}.md`);
        if (await fs.pathExists(sourceFile)) {
          const destDir = path.join(userDataPath, 'agents');
          await fs.ensureDir(destDir);
          await fs.copy(sourceFile, path.join(destDir, `${agent}.md`));
          agentsInstalled++;
          logWithCategory('info', LogCategory.WORKFLOW,
            `Installed agent: ${agent}`);
        } else {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Agent file not found in workflow folder: ${agent}.md`);
        }
      }
    } else {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `No agents folder found in workflow package`);
    }

    // Install skills
    const skillsDir = path.join(folderPath, 'skills');
    if (await fs.pathExists(skillsDir)) {
      for (const skill of missingSkills) {
        const sourceFile = path.join(skillsDir, `${skill}.md`);
        if (await fs.pathExists(sourceFile)) {
          const destDir = path.join(homeDir, '.claude', 'skills');
          await fs.ensureDir(destDir);
          await fs.copy(sourceFile, path.join(destDir, `${skill}.md`));
          skillsInstalled++;
          logWithCategory('info', LogCategory.WORKFLOW,
            `Installed skill: ${skill}`);
        } else {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Skill file not found in workflow folder: ${skill}.md`);
        }
      }
    } else {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `No skills folder found in workflow package`);
    }

    return { agents: agentsInstalled, skills: skillsInstalled, subWorkflows: 0 };
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
   * Import sub-workflows from sibling folders
   * Looks for folders with matching workflow IDs in the parent directory
   */
  private async importSubWorkflowsFromSiblings(
    folderPath: string,
    missingSubWorkflows: string[]
  ): Promise<number> {
    if (missingSubWorkflows.length === 0) {
      return 0;
    }

    let imported = 0;
    const parentDir = path.dirname(folderPath);

    logWithCategory('info', LogCategory.WORKFLOW,
      `Looking for sub-workflows in parent directory: ${parentDir}`);

    // Check each sibling folder for matching sub-workflow
    for (const subWorkflowId of missingSubWorkflows) {
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

    const files = await fs.readdir(skillsDir);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => path.basename(file, '.md'));
  }
}
