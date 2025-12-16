/**
 * Claude Code Workflow Exporter
 *
 * Exports workflows in Claude Code format with full agent + skill + workflow structure.
 * This allows users to "pack up their toys" and use workflows in different AI tools.
 *
 * Export Structure:
 * ~/.claude/
 *   agents/
 *     {agent-name}.md (all referenced agents)
 *   skills/
 *     {skill-name}.md (all referenced skills)
 *   workflows/
 *     {workflow-name}.yaml (workflow definition)
 *   README.md (workflow overview)
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { MCPWorkflowClient, WorkflowDefinition } from '../mcp-workflow-client';
import { WorkflowParser } from '../../parsers/workflow-parser';
import { logWithCategory, LogCategory } from '../../logger';

export interface ExportResult {
  success: boolean;
  outputPath: string;
  message: string;
  exportedFiles: {
    workflow: string;
    agents: string[];
    skills: string[];
    readme: string;
  };
  error?: string;
}

export interface ExportOptions {
  version?: string;
  includeAgents?: boolean;
  includeSkills?: boolean;
  format?: 'yaml' | 'json';
  outputPath?: string;
}

export class ClaudeCodeExporter {
  private workflowClient: MCPWorkflowClient;
  private parser: WorkflowParser;
  private agentsPath: string;
  private skillsPath: string;

  constructor() {
    this.workflowClient = new MCPWorkflowClient();
    this.parser = new WorkflowParser();

    // Agents are stored in userData/agents
    const userDataPath = app.getPath('userData');
    this.agentsPath = path.join(userDataPath, 'agents');

    // Skills are stored in ~/.claude/skills
    const homeDir = os.homedir();
    this.skillsPath = path.join(homeDir, '.claude', 'skills');
  }

  /**
   * Export workflow to Claude Code format
   */
  async export(
    workflowId: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Starting Claude Code export for workflow: ${workflowId}`);

      // 1. Get workflow from MCP
      const workflow = await this.getWorkflowDefinition(workflowId, options.version);
      if (!workflow) {
        return {
          success: false,
          outputPath: '',
          message: `Workflow not found: ${workflowId}`,
          exportedFiles: { workflow: '', agents: [], skills: [], readme: '' },
          error: 'Workflow not found'
        };
      }

      // 2. Determine output path
      const outputPath = options.outputPath || this.getDefaultOutputPath(workflow.name);
      await fs.ensureDir(outputPath);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Export output path: ${outputPath}`);

      // 3. Find all referenced agents and skills
      const agents = await this.findReferencedAgents(workflow);
      const skills = await this.findReferencedSkills(workflow);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Found ${agents.length} agents, ${skills.length} skills`);

      // 4. Export workflow YAML/JSON
      const workflowFile = await this.exportWorkflowFile(workflow, outputPath, options.format);

      // 5. Copy agents (if enabled)
      const agentFiles: string[] = [];
      if (options.includeAgents !== false) {
        agentFiles.push(...await this.copyAgents(agents, outputPath));
      }

      // 6. Copy skills (if enabled)
      const skillFiles: string[] = [];
      if (options.includeSkills !== false) {
        skillFiles.push(...await this.copySkills(skills, outputPath));
      }

      // 7. Generate README
      const readmeFile = await this.generateReadme(workflow, agents, skills, outputPath);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Export complete: ${workflowFile}`);

      return {
        success: true,
        outputPath,
        message: `Workflow exported successfully to ${outputPath}`,
        exportedFiles: {
          workflow: workflowFile,
          agents: agentFiles,
          skills: skillFiles,
          readme: readmeFile
        }
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Export failed: ${error.message}`, { stack: error.stack });

      return {
        success: false,
        outputPath: options.outputPath || '',
        message: `Export failed: ${error.message}`,
        exportedFiles: { workflow: '', agents: [], skills: [], readme: '' },
        error: error.message
      };
    }
  }

  /**
   * Get workflow definition from MCP server
   */
  private async getWorkflowDefinition(
    workflowId: string,
    version?: string
  ): Promise<WorkflowDefinition | null> {
    try {
      return await this.workflowClient.getWorkflowDefinition(workflowId, version);
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to get workflow definition: ${error.message}`);
      return null;
    }
  }

  /**
   * Find all agents referenced in workflow phases
   */
  private async findReferencedAgents(workflow: WorkflowDefinition): Promise<string[]> {
    const agents = new Set<string>();

    // Extract agents from phases_json
    if (workflow.phases_json && Array.isArray(workflow.phases_json)) {
      for (const phase of workflow.phases_json) {
        if (phase.agent && phase.agent !== 'User' && phase.agent !== 'System') {
          const agentSlug = this.agentNameToSlug(phase.agent);
          agents.add(agentSlug);
        }
      }
    }

    // Also check dependencies_json
    if (workflow.dependencies_json?.agents) {
      for (const agent of workflow.dependencies_json.agents) {
        agents.add(agent);
      }
    }

    return Array.from(agents);
  }

  /**
   * Find all skills referenced in workflow phases
   */
  private async findReferencedSkills(workflow: WorkflowDefinition): Promise<string[]> {
    const skills = new Set<string>();

    // Extract skills from phases_json
    if (workflow.phases_json && Array.isArray(workflow.phases_json)) {
      for (const phase of workflow.phases_json) {
        if (phase.skill) {
          skills.add(phase.skill);
        }
      }
    }

    // Also check dependencies_json
    if (workflow.dependencies_json?.skills) {
      for (const skill of workflow.dependencies_json.skills) {
        skills.add(skill);
      }
    }

    return Array.from(skills);
  }

  /**
   * Convert agent name to slug format
   */
  private agentNameToSlug(agentName: string): string {
    return agentName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
  }

  /**
   * Export workflow file in YAML or JSON format
   */
  private async exportWorkflowFile(
    workflow: WorkflowDefinition,
    outputPath: string,
    format: 'yaml' | 'json' = 'yaml'
  ): Promise<string> {
    const workflowsDir = path.join(outputPath, 'workflows');
    await fs.ensureDir(workflowsDir);

    const filename = `${workflow.id}.${format}`;
    const filepath = path.join(workflowsDir, filename);

    // Convert database format to file format
    const exportData = this.convertToExportFormat(workflow);

    if (format === 'yaml') {
      await this.parser.exportToYAML(exportData, filepath);
    } else {
      await this.parser.exportToJSON(exportData, filepath);
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Exported workflow file: ${filepath}`);

    return filepath;
  }

  /**
   * Convert workflow from database format to export format
   */
  private convertToExportFormat(workflow: WorkflowDefinition): any {
    // Convert phases_json back to phases array
    const phases = workflow.phases_json?.map((phase: any) => ({
      id: phase.id,
      name: phase.name,
      fullName: phase.name,
      type: phase.type,
      agent: phase.agent,
      skill: phase.skill,
      subWorkflowId: phase.subWorkflowId,
      description: phase.description,
      process: [],
      output: '',
      mcp: 'Workflow manager',
      gate: phase.gate || false,
      gateCondition: phase.gateCondition,
      requiresApproval: phase.requiresApproval || false,
      position: phase.position
    })) || [];

    return {
      id: workflow.id,
      name: workflow.name,
      version: workflow.version,
      description: workflow.description || '',
      phases,
      dependencies: workflow.dependencies_json || {
        agents: [],
        skills: [],
        mcpServers: [],
        subWorkflows: []
      },
      metadata: {
        author: workflow.created_by || 'FictionLab',
        created: (workflow.marketplace_metadata as any)?.created || new Date().toISOString(),
        updated: (workflow.marketplace_metadata as any)?.updated || new Date().toISOString(),
        tags: workflow.tags || []
      }
    };
  }

  /**
   * Copy agent markdown files to export directory
   */
  private async copyAgents(agents: string[], outputPath: string): Promise<string[]> {
    const agentsDir = path.join(outputPath, 'agents');
    await fs.ensureDir(agentsDir);

    const copiedFiles: string[] = [];

    for (const agent of agents) {
      const sourceFile = path.join(this.agentsPath, `${agent}.md`);

      if (await fs.pathExists(sourceFile)) {
        const destFile = path.join(agentsDir, `${agent}.md`);
        await fs.copy(sourceFile, destFile);
        copiedFiles.push(destFile);

        logWithCategory('debug', LogCategory.WORKFLOW,
          `Copied agent: ${agent}.md`);
      } else {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Agent not found: ${agent}.md (skipping)`);
      }
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Copied ${copiedFiles.length}/${agents.length} agents`);

    return copiedFiles;
  }

  /**
   * Copy skill files to export directory
   */
  private async copySkills(skills: string[], outputPath: string): Promise<string[]> {
    const skillsDir = path.join(outputPath, 'skills');
    await fs.ensureDir(skillsDir);

    const copiedFiles: string[] = [];

    for (const skill of skills) {
      // Skills can be either:
      // 1. Single file: skill-name.md
      // 2. Directory: skill-name/SKILL.md

      const sourceFile = path.join(this.skillsPath, `${skill}.md`);
      const sourceDir = path.join(this.skillsPath, skill);

      if (await fs.pathExists(sourceFile)) {
        // Single file format
        const destFile = path.join(skillsDir, `${skill}.md`);
        await fs.copy(sourceFile, destFile);
        copiedFiles.push(destFile);

        logWithCategory('debug', LogCategory.WORKFLOW,
          `Copied skill file: ${skill}.md`);

      } else if (await fs.pathExists(sourceDir)) {
        // Directory format
        const destDir = path.join(skillsDir, skill);
        await fs.copy(sourceDir, destDir);
        copiedFiles.push(destDir);

        logWithCategory('debug', LogCategory.WORKFLOW,
          `Copied skill directory: ${skill}/`);

      } else {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Skill not found: ${skill} (skipping)`);
      }
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Copied ${copiedFiles.length}/${skills.length} skills`);

    return copiedFiles;
  }

  /**
   * Generate README.md for exported workflow
   */
  private async generateReadme(
    workflow: WorkflowDefinition,
    agents: string[],
    skills: string[],
    outputPath: string
  ): Promise<string> {
    const readmePath = path.join(outputPath, 'README.md');

    const content = `# ${workflow.name}

${workflow.description || 'No description available'}

## Version

${workflow.version}

## Overview

This workflow package contains everything needed to run the "${workflow.name}" workflow in Claude Code or other compatible AI tools.

## Structure

\`\`\`
.
├── workflows/
│   └── ${workflow.id}.yaml          # Workflow definition
├── agents/                          # Agent personas (${agents.length} total)
${agents.map(a => `│   └── ${a}.md`).join('\n')}
├── skills/                          # Executable skills (${skills.length} total)
${skills.map(s => `│   └── ${s}.md`).join('\n')}
└── README.md                        # This file
\`\`\`

## Dependencies

### Agents (${agents.length})
${agents.length > 0 ? agents.map(a => `- ${a}`).join('\n') : 'None'}

### Skills (${skills.length})
${skills.length > 0 ? skills.map(s => `- ${s}`).join('\n') : 'None'}

### MCP Servers
${workflow.dependencies_json?.mcpServers?.length > 0
  ? workflow.dependencies_json.mcpServers.map(m => `- ${m}`).join('\n')
  : 'None'}

## Phases (${workflow.phases_json?.length || 0})

${workflow.phases_json?.map((phase: any, index: number) => `
${index + 1}. **${phase.name}** (${phase.type})
   - Agent: ${phase.agent}
   ${phase.skill ? `- Skill: ${phase.skill}` : ''}
   - Description: ${phase.description || 'N/A'}
`).join('') || 'No phases defined'}

## Installation

### For Claude Code

1. Copy agents to your agents directory:
   \`\`\`bash
   cp agents/* ~/.claude/agents/
   \`\`\`

2. Copy skills to your skills directory:
   \`\`\`bash
   cp skills/* ~/.claude/skills/
   \`\`\`

3. Import the workflow:
   \`\`\`bash
   cp workflows/${workflow.id}.yaml ~/.claude/workflows/
   \`\`\`

### For FictionLab

1. Import the workflow package through the UI:
   - Open FictionLab
   - Navigate to Workflows
   - Click "Import Workflow Package"
   - Select this folder

## Usage

This workflow is designed to be executed by AI agents with the appropriate skills and MCP server connections.

${(workflow.marketplace_metadata as any)?.usage || ''}

## Metadata

- **Author**: ${workflow.created_by || 'Unknown'}
- **Created**: ${(workflow.marketplace_metadata as any)?.created || 'Unknown'}
- **Updated**: ${(workflow.marketplace_metadata as any)?.updated || 'Unknown'}
- **Tags**: ${workflow.tags?.join(', ') || 'None'}

## License

${(workflow.marketplace_metadata as any)?.license || 'See FictionLab documentation for licensing information'}

---

Generated with [FictionLab MCP Electron App](https://github.com/RLRyals/MCP-Electron-App)
Exported: ${new Date().toISOString()}
`;

    await fs.writeFile(readmePath, content, 'utf-8');

    logWithCategory('info', LogCategory.WORKFLOW,
      `Generated README: ${readmePath}`);

    return readmePath;
  }

  /**
   * Get default output path for export
   */
  private getDefaultOutputPath(workflowName: string): string {
    const homeDir = os.homedir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const safeName = workflowName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    return path.join(homeDir, '.claude', 'exports', `${safeName}-${timestamp}`);
  }

  /**
   * List all exportable workflows
   */
  async listExportableWorkflows(filters?: {
    tags?: string[];
    is_system?: boolean;
  }): Promise<WorkflowDefinition[]> {
    try {
      return await this.workflowClient.getWorkflowDefinitions(filters);
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to list workflows: ${error.message}`);
      return [];
    }
  }

  /**
   * Validate export package
   */
  async validateExport(exportPath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check directory exists
    if (!await fs.pathExists(exportPath)) {
      errors.push('Export directory does not exist');
      return { valid: false, errors, warnings };
    }

    // Check required directories
    const requiredDirs = ['workflows'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(exportPath, dir);
      if (!await fs.pathExists(dirPath)) {
        errors.push(`Missing required directory: ${dir}`);
      }
    }

    // Check for workflow file
    const workflowsDir = path.join(exportPath, 'workflows');
    if (await fs.pathExists(workflowsDir)) {
      const files = await fs.readdir(workflowsDir);
      const hasWorkflow = files.some(f => f.endsWith('.yaml') || f.endsWith('.json'));
      if (!hasWorkflow) {
        errors.push('No workflow file found in workflows/');
      }
    }

    // Check optional directories
    const optionalDirs = ['agents', 'skills'];
    for (const dir of optionalDirs) {
      const dirPath = path.join(exportPath, dir);
      if (!await fs.pathExists(dirPath)) {
        warnings.push(`Optional directory missing: ${dir}`);
      }
    }

    // Check for README
    const readmePath = path.join(exportPath, 'README.md');
    if (!await fs.pathExists(readmePath)) {
      warnings.push('README.md not found');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
