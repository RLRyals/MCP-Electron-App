/**
 * Workflow Parser
 *
 * Parses workflow definitions from various formats:
 * - YAML files
 * - JSON files
 * - HTML visualization files (system_visualization.html)
 *
 * Converts to standardized WorkflowDefinition type.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { JSDOM } from 'jsdom';
import {
  WorkflowDefinition,
  WorkflowPhase,
  WorkflowDependencies,
  PhaseType,
} from '../../types/workflow';
import { logWithCategory, LogCategory } from '../logger';

export class WorkflowParser {
  /**
   * Parse workflow from file (auto-detect format)
   */
  async parseWorkflow(filePath: string): Promise<WorkflowDefinition> {
    if (!await fs.pathExists(filePath)) {
      throw new Error(`Workflow file not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.yaml':
      case '.yml':
        return this.parseYAML(filePath);
      case '.json':
        return this.parseJSON(filePath);
      case '.html':
        return this.parseHTML(filePath);
      default:
        throw new Error(`Unsupported workflow file format: ${ext}`);
    }
  }

  /**
   * Parse YAML workflow file
   */
  private async parseYAML(filePath: string): Promise<WorkflowDefinition> {
    logWithCategory('info', LogCategory.SYSTEM, `Parsing YAML workflow: ${filePath}`);

    const content = await fs.readFile(filePath, 'utf-8');
    const data = yaml.load(content) as any;

    return this.validateAndNormalize(data, filePath);
  }

  /**
   * Parse JSON workflow file
   */
  private async parseJSON(filePath: string): Promise<WorkflowDefinition> {
    logWithCategory('info', LogCategory.SYSTEM, `Parsing JSON workflow: ${filePath}`);

    const data = await fs.readJson(filePath);

    return this.validateAndNormalize(data, filePath);
  }

  /**
   * Parse HTML visualization file (system_visualization.html)
   *
   * Extracts phase data from embedded JavaScript array
   */
  private async parseHTML(filePath: string): Promise<WorkflowDefinition> {
    logWithCategory('info', LogCategory.SYSTEM, `Parsing HTML visualization: ${filePath}`);

    const html = await fs.readFile(filePath, 'utf-8');
    const dom = new JSDOM(html, { runScripts: 'outside-only' });

    // Extract phases array from JavaScript
    const scriptContent = html.match(/const phases = \[([\s\S]*?)\];/);
    if (!scriptContent) {
      throw new Error('Could not find phases array in HTML file');
    }

    // Parse the JavaScript array as JSON (with some cleanup)
    const phasesJSON = `[${scriptContent[1]}]`;
    const phases: any[] = eval(`(${phasesJSON})`);

    // Extract workflow metadata from HTML
    const title = dom.window.document.querySelector('header h1')?.textContent || 'Unnamed Workflow';
    const description = dom.window.document.querySelector('header p')?.textContent || '';

    // Convert phases to WorkflowPhase format
    const workflowPhases: WorkflowPhase[] = phases.map((phase) => ({
      id: phase.id,
      name: phase.name.replace(/\n/g, ' '),
      fullName: phase.fullName,
      type: this.mapPhaseType(phase.type),
      agent: phase.agent,
      skill: this.extractSkillFromPhase(phase),
      subWorkflowId: this.extractSubWorkflowId(phase),
      description: phase.description,
      process: Array.isArray(phase.process) ? phase.process : [phase.process],
      output: phase.output,
      mcp: phase.mcp || 'No database interaction',
      gate: phase.gate || false,
      gateCondition: phase.gateCondition,
      requiresApproval: phase.type === 'user' || phase.gateCondition?.includes('APPROVE'),
      position: { x: 0, y: 0 }, // Will be calculated later
    }));

    // Discover dependencies
    const dependencies = this.extractDependencies(workflowPhases);

    // Generate workflow ID from filename
    const id = path.basename(filePath, path.extname(filePath));

    return {
      id,
      name: this.cleanWorkflowName(title),
      version: '1.0.0', // Default version
      description: description.trim(),
      phases: workflowPhases,
      dependencies,
      metadata: {
        author: 'FictionLab',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ['imported', 'html'],
      },
    };
  }

  /**
   * Map phase type from string to PhaseType enum
   */
  private mapPhaseType(typeString: string): PhaseType {
    const typeMap: Record<string, PhaseType> = {
      'planning': 'planning',
      'gate': 'gate',
      'writing': 'writing',
      'loop': 'loop',
      'user': 'user',
      'subworkflow': 'subworkflow',
    };

    return typeMap[typeString.toLowerCase()] || 'planning';
  }

  /**
   * Extract skill name from phase data
   */
  private extractSkillFromPhase(phase: any): string | undefined {
    // Look for skill mentions in description or process
    const text = JSON.stringify(phase).toLowerCase();

    const skillPatterns = [
      /market-driven-planning-skill/,
      /series-planning-skill/,
      /book-planning-skill/,
      /chapter-planning-skill/,
      /scene-writing-skill/,
      /revision-manager-skill/,
      /automated-qa-checklist/,
      /review-qa-skill/,
    ];

    for (const pattern of skillPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  /**
   * Extract sub-workflow ID if this phase represents a nested workflow
   */
  private extractSubWorkflowId(phase: any): string | undefined {
    // Check if description mentions sub-workflow or nested phases
    if (phase.description?.includes('6-phase') || phase.description?.includes('sub-workflow')) {
      // Generate sub-workflow ID from phase name
      return `${phase.id}-sub-workflow`;
    }

    return undefined;
  }

  /**
   * Extract dependencies from phases
   */
  private extractDependencies(phases: WorkflowPhase[]): WorkflowDependencies {
    const agents = new Set<string>();
    const skills = new Set<string>();
    const mcpServers = new Set<string>();
    const subWorkflows: string[] = [];

    for (const phase of phases) {
      // Collect agents
      if (phase.agent && phase.agent !== 'User' && phase.agent !== 'System') {
        const agentSlug = this.agentNameToSlug(phase.agent);
        agents.add(agentSlug);
      }

      // Collect skills
      if (phase.skill) {
        skills.add(phase.skill);
      }

      // Collect MCPs from mcp field
      const mcpMatches = phase.mcp.match(/([\w-]+)-server/g);
      if (mcpMatches) {
        mcpMatches.forEach(mcp => mcpServers.add(mcp));
      }

      // Collect sub-workflows
      if (phase.subWorkflowId) {
        subWorkflows.push(phase.subWorkflowId);
      }
    }

    // Always include workflow-manager MCP
    mcpServers.add('workflow-manager');

    return {
      agents: Array.from(agents),
      skills: Array.from(skills),
      mcpServers: Array.from(mcpServers),
      subWorkflows: subWorkflows.length > 0 ? subWorkflows : undefined,
    };
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
   * Clean workflow name from HTML title
   */
  private cleanWorkflowName(title: string): string {
    // Remove emojis and extra text
    return title
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Validate and normalize workflow data
   */
  private validateAndNormalize(data: any, filePath: string): WorkflowDefinition {
    // Required fields
    if (!data.name) {
      throw new Error(`Workflow missing 'name' field: ${filePath}`);
    }
    if (!data.phases || !Array.isArray(data.phases)) {
      throw new Error(`Workflow missing 'phases' array: ${filePath}`);
    }

    // Ensure all phases have required fields
    const phases: WorkflowPhase[] = data.phases.map((phase: any, index: number) => {
      if (typeof phase.id === 'undefined') {
        phase.id = index;
      }
      if (!phase.name) {
        throw new Error(`Phase ${index} missing 'name' field`);
      }
      if (!phase.agent) {
        throw new Error(`Phase ${phase.name} missing 'agent' field`);
      }

      return {
        id: phase.id,
        name: phase.name,
        fullName: phase.fullName || phase.name,
        type: phase.type || 'planning',
        agent: phase.agent,
        skill: phase.skill,
        subWorkflowId: phase.subWorkflowId,
        description: phase.description || '',
        process: Array.isArray(phase.process) ? phase.process : [phase.process || ''],
        output: phase.output || '',
        mcp: phase.mcp || 'No database interaction',
        gate: phase.gate || false,
        gateCondition: phase.gateCondition,
        requiresApproval: phase.requiresApproval || false,
        position: phase.position || { x: 0, y: 0 },
      };
    });

    // Extract or use provided dependencies
    const dependencies: WorkflowDependencies = data.dependencies || this.extractDependencies(phases);

    return {
      id: data.id || path.basename(filePath, path.extname(filePath)),
      name: data.name,
      version: data.version || '1.0.0',
      description: data.description || '',
      phases,
      dependencies,
      metadata: {
        author: data.metadata?.author,
        created: data.metadata?.created || new Date().toISOString(),
        updated: data.metadata?.updated || new Date().toISOString(),
        tags: data.metadata?.tags || [],
      },
    };
  }

  /**
   * Serialize workflow to YAML
   */
  async exportToYAML(workflow: WorkflowDefinition, outputPath: string): Promise<void> {
    const yamlContent = yaml.dump(workflow, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });

    await fs.writeFile(outputPath, yamlContent, 'utf-8');
    logWithCategory('info', LogCategory.SYSTEM, `Exported workflow to YAML: ${outputPath}`);
  }

  /**
   * Serialize workflow to JSON
   */
  async exportToJSON(workflow: WorkflowDefinition, outputPath: string): Promise<void> {
    await fs.writeJson(outputPath, workflow, { spaces: 2 });
    logWithCategory('info', LogCategory.SYSTEM, `Exported workflow to JSON: ${outputPath}`);
  }
}
