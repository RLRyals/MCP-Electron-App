/**
 * Workflow Parser
 *
 * Parses workflow definitions from:
 * - YAML files
 * - JSON files
 *
 * Converts to standardized WorkflowDefinition type.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
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
      default:
        throw new Error(`Unsupported workflow file format: ${ext}. Use .json or .yaml`);
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
   * Validate and normalize workflow data
   */
  private validateAndNormalize(data: any, filePath: string): WorkflowDefinition {
    // Required fields
    if (!data.name) {
      throw new Error(`Workflow missing 'name' field: ${filePath}`);
    }

    // Support new graph_json format OR legacy phases format
    if (!data.graph_json && !data.phases) {
      throw new Error(`Workflow missing 'graph_json' or 'phases' field: ${filePath}`);
    }

    let phases: WorkflowPhase[];

    // Convert graph_json nodes to phases format
    if (data.graph_json && data.graph_json.nodes) {
      logWithCategory('info', LogCategory.SYSTEM, `Converting graph_json format to phases`);

      phases = data.graph_json.nodes.map((node: any, index: number) => {
        const nodeId = typeof node.id === 'string' ? parseInt(node.id, 10) : (node.id || index);

        return {
          id: nodeId,
          name: node.name || 'Unnamed Node',
          fullName: node.name || 'Unnamed Node',
          type: node.type || 'planning',
          agent: node.agent || 'general-purpose',
          skill: node.skill,
          subWorkflowId: node.subWorkflowId,
          description: node.description || '',
          process: node.prompt ? [node.prompt] : (node.process || ['']),
          output: node.outputVariable || node.output || '',
          mcp: node.mcpOperation || node.mcp || 'No database interaction',
          gate: node.type === 'gate' || false,
          gateCondition: node.condition || node.gateCondition,
          requiresApproval: node.requiresApproval || false,
          position: node.position || { x: 0, y: 0 },
        };
      });
    } else {
      // Legacy phases format
      phases = data.phases.map((phase: any, index: number) => {
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
    }

    // Use provided dependencies or create empty
    const dependencies: WorkflowDependencies = data.dependencies || {
      agents: [],
      skills: [],
      mcpServers: ['workflow-manager'],
      subWorkflows: undefined,
    };

    return {
      id: data.id || data.workflow_def_id || path.basename(filePath, path.extname(filePath)),
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
