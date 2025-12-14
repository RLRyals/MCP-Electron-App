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
   */
  async importFromFolder(folderPath: string): Promise<ImportResult> {
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

      // 2. Parse workflow definition
      const workflow = await this.parser.parseWorkflow(workflowFile);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Parsed workflow: ${workflow.name} v${workflow.version}`);

      // 3. Check dependencies
      const depCheck = await this.depResolver.checkDependencies({
        agents: workflow.dependencies.agents,
        skills: workflow.dependencies.skills,
        mcpServers: workflow.dependencies.mcpServers,
        subWorkflows: workflow.dependencies.subWorkflows || []
      });

      logWithCategory('info', LogCategory.WORKFLOW,
        `Dependency check complete: ` +
        `${depCheck.agents.missing.length} agents missing, ` +
        `${depCheck.skills.missing.length} skills missing`);

      // 4. Install missing components
      const installedCounts = await this.installComponents(
        folderPath,
        depCheck.agents.missing,
        depCheck.skills.missing
      );

      logWithCategory('info', LogCategory.WORKFLOW,
        `Installed ${installedCounts.agents} agents, ${installedCounts.skills} skills`);

      // 5. Convert workflow to database format
      const workflowDefinition = this.convertToWorkflowDefinition(workflow);

      // 6. Import workflow definition to database via MCP
      const result = await this.workflowClient.importWorkflowDefinition(workflowDefinition);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Workflow imported to database: ${result.workflow_def_id} v${result.version}`);

      // 7. Record import
      await this.recordImport(result.workflow_def_id, folderPath, installedCounts);

      return {
        success: true,
        workflowId: result.workflow_def_id,
        version: result.version,
        message: result.message,
        installedComponents: installedCounts,
        missingDependencies: {
          agents: depCheck.agents.missing.filter(a => !installedCounts.agents),
          skills: depCheck.skills.missing.filter(s => !installedCounts.skills),
          mcpServers: depCheck.mcpServers.missing,
          subWorkflows: depCheck.subWorkflows.missing
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
   */
  private convertToWorkflowDefinition(workflow: any): any {
    // Convert phases array to the format expected by database
    const phases_json = workflow.phases.map((phase: any) => ({
      id: phase.id,
      name: phase.name,
      type: phase.type,
      agent: phase.agent,
      skill: phase.skill,
      subWorkflowId: phase.subWorkflowId,
      description: phase.description,
      gate: phase.gate,
      gateCondition: phase.gateCondition,
      requiresApproval: phase.requiresApproval,
      position: phase.position
    }));

    // Create graph_json for visualization
    const graph_json = {
      nodes: phases_json.map((phase: any) => ({
        id: phase.id.toString(),
        type: phase.type,
        data: { label: phase.name, phase },
        position: phase.position
      })),
      edges: phases_json.slice(0, -1).map((phase: any, index: number) => ({
        id: `e${index}-${index + 1}`,
        source: index.toString(),
        target: (index + 1).toString()
      }))
    };

    return {
      id: workflow.id,
      name: workflow.name,
      version: workflow.version,
      description: workflow.description,
      graph_json,
      dependencies_json: {
        agents: workflow.dependencies.agents,
        skills: workflow.dependencies.skills,
        mcpServers: workflow.dependencies.mcpServers,
        subWorkflows: workflow.dependencies.subWorkflows
      },
      phases_json,
      tags: workflow.metadata?.tags || [],
      marketplace_metadata: workflow.metadata || {},
      created_by: workflow.metadata?.author || 'FictionLab',
      is_system: false
    };
  }

  /**
   * Install agents and skills from workflow folder
   */
  private async installComponents(
    folderPath: string,
    missingAgents: string[],
    missingSkills: string[]
  ): Promise<{ agents: number; skills: number }> {
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

    return { agents: agentsInstalled, skills: skillsInstalled };
  }

  /**
   * Record import in workflow_imports table
   */
  private async recordImport(
    workflowDefId: string,
    sourcePath: string,
    installed: { agents: number; skills: number }
  ): Promise<void> {
    try {
      const pool = getDatabasePool();

      await pool.query(`
        INSERT INTO workflow_imports (
          workflow_def_id, source_type, source_path, installation_log
        ) VALUES ($1, $2, $3, $4)
      `, [
        workflowDefId,
        'folder',
        sourcePath,
        { timestamp: new Date().toISOString(), installed }
      ]);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Recorded import in database for workflow: ${workflowDefId}`);
    } catch (error: any) {
      // Log but don't fail the import if recording fails
      logWithCategory('warn', LogCategory.WORKFLOW,
        `Failed to record import: ${error.message}`);
    }
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
