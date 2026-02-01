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
    subWorkflows: string[];
    readme: string;
  };
  error?: string;
}

export interface ExportOptions {
  version?: string;
  includeAgents?: boolean;
  includeSkills?: boolean;
  includeSubWorkflows?: boolean;
  includeReadme?: boolean;
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

    // Both agents and skills are stored in ~/.claude/
    const homeDir = os.homedir();
    this.agentsPath = path.join(homeDir, '.claude', 'agents');
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
          exportedFiles: { workflow: '', agents: [], skills: [], subWorkflows: [], readme: '' },
          error: 'Workflow not found'
        };
      }

      // Ensure workflow has an ID - use the workflowId parameter as fallback
      if (!workflow.id) {
        workflow.id = workflowId;
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Workflow missing 'id' field, using requested workflowId: ${workflow.id}`);
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Exporting workflow: id=${workflow.id}, name=${workflow.name}`);

      // 2. Determine output path
      const outputPath = options.outputPath || this.getDefaultOutputPath(workflow.name);
      await fs.ensureDir(outputPath);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Export output path: ${outputPath}`);

      // 3. Find all referenced agents, skills, and sub-workflows from main workflow
      const agents = new Set<string>(await this.findReferencedAgents(workflow));
      const skills = new Set<string>(await this.findReferencedSkills(workflow));
      const subWorkflowIds = this.findReferencedSubWorkflows(workflow);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Found ${agents.size} agents, ${skills.size} skills, ${subWorkflowIds.length} sub-workflows in main workflow`);

      // 3b. Also collect agents and skills from sub-workflows BEFORE copying
      if (options.includeSubWorkflows !== false && subWorkflowIds.length > 0) {
        await this.collectSubWorkflowDependencies(subWorkflowIds, agents, skills);
        logWithCategory('info', LogCategory.WORKFLOW,
          `After including sub-workflows: ${agents.size} agents, ${skills.size} skills total`);
      }

      const agentsArray = Array.from(agents);
      const skillsArray = Array.from(skills);

      // 4. Export workflow YAML/JSON
      const workflowFile = await this.exportWorkflowFile(workflow, outputPath, options.format);

      // 5. Copy agents (if enabled)
      const agentFiles: string[] = [];
      if (options.includeAgents !== false) {
        agentFiles.push(...await this.copyAgents(agentsArray, outputPath));
      }

      // 6. Copy skills (if enabled) - now includes sub-workflow skills
      const skillFiles: string[] = [];
      if (options.includeSkills !== false) {
        skillFiles.push(...await this.copySkills(skillsArray, outputPath));
      }

      // 7. Export sub-workflows (if enabled)
      const subWorkflowFiles: string[] = [];
      if (options.includeSubWorkflows !== false && subWorkflowIds.length > 0) {
        subWorkflowFiles.push(...await this.exportSubWorkflows(subWorkflowIds, outputPath, options.format));
      }

      // 8. Generate README (if enabled) - now includes all skills from sub-workflows
      let readmeFile = '';
      if (options.includeReadme !== false) {
        readmeFile = await this.generateReadme(workflow, agentsArray, skillsArray, subWorkflowIds, outputPath);
      }

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
          subWorkflows: subWorkflowFiles,
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
        exportedFiles: { workflow: '', agents: [], skills: [], subWorkflows: [], readme: '' },
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
   * Find all agents referenced in workflow
   * Prioritizes dependencies_json (authoritative) then graph_json nodes
   */
  private async findReferencedAgents(workflow: WorkflowDefinition): Promise<string[]> {
    const agents = new Set<string>();

    // Primary: Extract agents from dependencies_json (authoritative source)
    if (workflow.dependencies_json?.agents) {
      for (const agent of workflow.dependencies_json.agents) {
        agents.add(agent);
      }
    }

    // Secondary: Extract from graph_json nodes (agent property exists on agent node types)
    if (workflow.graph_json?.nodes && Array.isArray(workflow.graph_json.nodes)) {
      for (const node of workflow.graph_json.nodes) {
        // Check for agent property (exists on planning, writing, gate nodes)
        const nodeAgent = (node as any).agent;
        if (nodeAgent && nodeAgent !== 'User' && nodeAgent !== 'System') {
          const agentSlug = this.agentNameToSlug(nodeAgent);
          agents.add(agentSlug);
        }
      }
    }

    return Array.from(agents);
  }

  /**
   * Find all skills referenced in workflow
   * Prioritizes dependencies_json (authoritative) then graph_json nodes
   */
  private async findReferencedSkills(workflow: WorkflowDefinition): Promise<string[]> {
    const skills = new Set<string>();

    logWithCategory('info', LogCategory.WORKFLOW,
      `Finding skills for workflow: ${workflow.id}`);
    logWithCategory('info', LogCategory.WORKFLOW,
      `dependencies_json: ${JSON.stringify(workflow.dependencies_json, null, 2)}`);

    // Primary: Extract from dependencies_json (authoritative source)
    if (workflow.dependencies_json?.skills) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Found ${workflow.dependencies_json.skills.length} skills in dependencies_json: ${workflow.dependencies_json.skills.join(', ')}`);
      for (const skill of workflow.dependencies_json.skills) {
        skills.add(skill);
      }
    } else {
      logWithCategory('warn', LogCategory.WORKFLOW,
        `No skills found in dependencies_json`);
    }

    // Secondary: Extract from graph_json nodes (skill property exists on agent node types)
    if (workflow.graph_json?.nodes && Array.isArray(workflow.graph_json.nodes)) {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Checking ${workflow.graph_json.nodes.length} nodes for skill properties`);
      for (const node of workflow.graph_json.nodes) {
        // Check for skill property (exists on planning, writing, gate nodes)
        const nodeSkill = (node as any).skill;
        if (nodeSkill) {
          logWithCategory('info', LogCategory.WORKFLOW,
            `Found skill "${nodeSkill}" on node "${node.name}" (id: ${node.id})`);
          skills.add(nodeSkill);
        }
      }
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Total skills found: ${skills.size} - [${Array.from(skills).join(', ')}]`);

    return Array.from(skills);
  }

  /**
   * Recursively collect agents and skills from sub-workflows
   * This ensures all dependencies are gathered before copying files
   */
  private async collectSubWorkflowDependencies(
    subWorkflowIds: string[],
    agents: Set<string>,
    skills: Set<string>,
    visited: Set<string> = new Set()
  ): Promise<void> {
    for (const subWorkflowId of subWorkflowIds) {
      // Prevent infinite loops
      if (visited.has(subWorkflowId)) {
        continue;
      }
      visited.add(subWorkflowId);

      try {
        const subWorkflow = await this.getWorkflowDefinition(subWorkflowId);
        if (subWorkflow) {
          // Collect agents from sub-workflow
          const subAgents = await this.findReferencedAgents(subWorkflow);
          for (const agent of subAgents) {
            agents.add(agent);
          }

          // Collect skills from sub-workflow
          const subSkills = await this.findReferencedSkills(subWorkflow);
          for (const skill of subSkills) {
            skills.add(skill);
          }

          logWithCategory('info', LogCategory.WORKFLOW,
            `Collected from sub-workflow "${subWorkflowId}": ${subAgents.length} agents, ${subSkills.length} skills`);

          // Recursively collect from nested sub-workflows
          const nestedSubWorkflows = this.findReferencedSubWorkflows(subWorkflow);
          if (nestedSubWorkflows.length > 0) {
            await this.collectSubWorkflowDependencies(nestedSubWorkflows, agents, skills, visited);
          }
        } else {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Sub-workflow not found for dependency collection: ${subWorkflowId}`);
        }
      } catch (error: any) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Failed to collect dependencies from sub-workflow ${subWorkflowId}: ${error.message}`);
      }
    }
  }

  /**
   * Find all sub-workflows referenced in workflow dependencies
   */
  private findReferencedSubWorkflows(workflow: WorkflowDefinition): string[] {
    const subWorkflows = new Set<string>();

    // Get from dependencies_json
    if (workflow.dependencies_json?.subWorkflows) {
      for (const subWorkflow of workflow.dependencies_json.subWorkflows) {
        subWorkflows.add(subWorkflow);
      }
    }

    // Also check graph_json nodes for subworkflow type
    if (workflow.graph_json?.nodes && Array.isArray(workflow.graph_json.nodes)) {
      for (const node of workflow.graph_json.nodes) {
        if (node.type === 'subworkflow' && node.subWorkflowId) {
          subWorkflows.add(node.subWorkflowId);
        }
      }
    }

    return Array.from(subWorkflows);
  }

  /**
   * Export sub-workflows to export directory
   */
  private async exportSubWorkflows(
    subWorkflowIds: string[],
    outputPath: string,
    format: 'yaml' | 'json' = 'yaml'
  ): Promise<string[]> {
    const subWorkflowsDir = path.join(outputPath, 'sub-workflows');
    await fs.ensureDir(subWorkflowsDir);

    const exportedFiles: string[] = [];

    for (const subWorkflowId of subWorkflowIds) {
      try {
        // Get sub-workflow from MCP
        const subWorkflow = await this.getWorkflowDefinition(subWorkflowId);

        if (subWorkflow) {
          // Ensure sub-workflow has an ID
          if (!subWorkflow.id) {
            subWorkflow.id = subWorkflowId;
          }

          // Create directory for sub-workflow
          const subWorkflowDir = path.join(subWorkflowsDir, subWorkflowId);
          await fs.ensureDir(subWorkflowDir);

          // Export the sub-workflow file
          const exportData = this.convertToExportFormat(subWorkflow);
          const filename = `workflow.${format}`;
          const filepath = path.join(subWorkflowDir, filename);

          if (format === 'yaml') {
            await this.parser.exportToYAML(exportData, filepath);
          } else {
            await this.parser.exportToJSON(exportData, filepath);
          }

          exportedFiles.push(filepath);

          logWithCategory('info', LogCategory.WORKFLOW,
            `Exported sub-workflow: ${subWorkflowId}`);

          // Recursively export nested sub-workflows
          const nestedSubWorkflows = this.findReferencedSubWorkflows(subWorkflow);
          if (nestedSubWorkflows.length > 0) {
            // Filter out already exported ones to prevent infinite loops
            const newSubWorkflows = nestedSubWorkflows.filter(id => !subWorkflowIds.includes(id));
            if (newSubWorkflows.length > 0) {
              const nestedFiles = await this.exportSubWorkflows(newSubWorkflows, outputPath, format);
              exportedFiles.push(...nestedFiles);
            }
          }

          // Note: Agents and skills from sub-workflows are now collected upfront
          // via collectSubWorkflowDependencies() and copied before this method runs

        } else {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Sub-workflow not found: ${subWorkflowId} (skipping)`);
        }
      } catch (error: any) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Failed to export sub-workflow ${subWorkflowId}: ${error.message}`);
      }
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Exported ${exportedFiles.length}/${subWorkflowIds.length} sub-workflows`);

    return exportedFiles;
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
    // Validate workflow has required fields
    if (!workflow.id || workflow.id === 'undefined') {
      throw new Error(`Cannot export workflow: missing or invalid 'id' field. Workflow name: ${workflow.name}`);
    }

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
   * Uses graph_json as the primary source (modern format)
   * Extracts dependencies from graph_json nodes to ensure completeness
   */
  private convertToExportFormat(workflow: WorkflowDefinition): any {
    // Extract subWorkflows from graph_json nodes (authoritative source)
    const extractedSubWorkflows = this.findReferencedSubWorkflows(workflow);

    // Merge with any existing dependencies_json
    const baseDeps = workflow.dependencies_json || {
      agents: [],
      skills: [],
      mcpServers: [],
      subWorkflows: []
    };

    // Ensure subWorkflows includes all from graph_json
    const mergedSubWorkflows = new Set<string>([
      ...(baseDeps.subWorkflows || []),
      ...extractedSubWorkflows
    ]);

    return {
      id: workflow.id,
      name: workflow.name,
      version: workflow.version,
      description: workflow.description || '',
      // Export graph_json directly - this is the primary format
      graph_json: workflow.graph_json,
      dependencies: {
        agents: baseDeps.agents || [],
        skills: baseDeps.skills || [],
        mcpServers: baseDeps.mcpServers || [],
        subWorkflows: Array.from(mergedSubWorkflows)
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

    logWithCategory('info', LogCategory.WORKFLOW,
      `Copying ${skills.length} skills from ${this.skillsPath} to ${skillsDir}`);

    const copiedFiles: string[] = [];

    for (const skill of skills) {
      // Skills can be either:
      // 1. Single file: skill-name.md
      // 2. Directory: skill-name/SKILL.md

      const sourceFile = path.join(this.skillsPath, `${skill}.md`);
      const sourceDir = path.join(this.skillsPath, skill);

      logWithCategory('info', LogCategory.WORKFLOW,
        `Looking for skill "${skill}" at: ${sourceFile} OR ${sourceDir}`);

      if (await fs.pathExists(sourceFile)) {
        // Single file format
        const destFile = path.join(skillsDir, `${skill}.md`);
        await fs.copy(sourceFile, destFile);
        copiedFiles.push(destFile);

        logWithCategory('info', LogCategory.WORKFLOW,
          `Copied skill file: ${skill}.md`);

      } else if (await fs.pathExists(sourceDir)) {
        // Directory format
        const destDir = path.join(skillsDir, skill);
        await fs.copy(sourceDir, destDir);
        copiedFiles.push(destDir);

        logWithCategory('info', LogCategory.WORKFLOW,
          `Copied skill directory: ${skill}/`);

      } else {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Skill not found at either path: ${sourceFile} OR ${sourceDir} (skipping)`);
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
    subWorkflows: string[],
    outputPath: string
  ): Promise<string> {
    const readmePath = path.join(outputPath, 'README.md');

    // Build structure section dynamically
    const structureLines = [
      '.',
      '├── workflows/',
      `│   └── ${workflow.id}.yaml          # Main workflow definition`,
    ];

    if (agents.length > 0) {
      structureLines.push(`├── agents/                          # Agent personas (${agents.length} total)`);
      agents.forEach(a => structureLines.push(`│   └── ${a}.md`));
    }

    if (skills.length > 0) {
      structureLines.push(`├── skills/                          # Executable skills (${skills.length} total)`);
      skills.forEach(s => structureLines.push(`│   └── ${s}.md`));
    }

    if (subWorkflows.length > 0) {
      structureLines.push(`├── sub-workflows/                   # Sub-workflow definitions (${subWorkflows.length} total)`);
      subWorkflows.forEach(sw => structureLines.push(`│   └── ${sw}/workflow.yaml`));
    }

    structureLines.push('└── README.md                        # This file');

    const content = `# ${workflow.name}

${workflow.description || 'No description available'}

## Version

${workflow.version}

## Overview

This workflow package contains everything needed to run the "${workflow.name}" workflow in Claude Code or other compatible AI tools.
${subWorkflows.length > 0 ? `\nThis is a **composite workflow** that orchestrates ${subWorkflows.length} sub-workflow(s).` : ''}

## Structure

\`\`\`
${structureLines.join('\n')}
\`\`\`

## Dependencies

### Agents (${agents.length})
${agents.length > 0 ? agents.map(a => `- ${a}`).join('\n') : 'None'}

### Skills (${skills.length})
${skills.length > 0 ? skills.map(s => `- ${s}`).join('\n') : 'None'}

### Sub-Workflows (${subWorkflows.length})
${subWorkflows.length > 0 ? subWorkflows.map(sw => `- ${sw}`).join('\n') : 'None'}

### MCP Servers
${(workflow.dependencies_json?.mcpServers?.length ?? 0) > 0
  ? workflow.dependencies_json!.mcpServers!.map(m => `- ${m}`).join('\n')
  : 'None'}

## Nodes (${workflow.graph_json?.nodes?.length || 0})

${workflow.graph_json?.nodes?.map((node: any, index: number) => `
${index + 1}. **${node.name}** (${node.type})
   ${node.agent ? `- Agent: ${node.agent}` : ''}
   ${node.skill ? `- Skill: ${node.skill}` : ''}
   ${node.subWorkflowId ? `- Sub-Workflow: ${node.subWorkflowId}` : ''}
   - Description: ${node.description || 'N/A'}
`).join('') || 'No nodes defined'}

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
${subWorkflows.length > 0 ? `
4. Import sub-workflows:
   \`\`\`bash
   cp -r sub-workflows/* ~/.claude/workflows/
   \`\`\`
` : ''}

### For FictionLab

1. Import the workflow package through the UI:
   - Open FictionLab
   - Navigate to Workflows
   - Click "Import Workflow Package"
   - Select this folder
   ${subWorkflows.length > 0 ? '- Sub-workflows will be imported automatically' : ''}

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
