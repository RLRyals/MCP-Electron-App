/**
 * Antigravity Workflow Exporter
 *
 * Converts FictionLab WorkflowDefinitions to Google Antigravity-compatible
 * workflow markdown files.
 *
 * Features:
 * - Splits workflows at quality gates and human approval points
 * - Generates MCP tool references for database operations
 * - Creates step-by-step instructions for AI agents
 * - Supports multimodal workflows (text, image generation, etc.)
 * - Maintains workflow continuity across segments
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import {
  WorkflowDefinition,
  WorkflowPhase,
  PhaseType,
} from '../../types/workflow';
import { logWithCategory, LogCategory } from '../logger';

export interface AntigravityWorkflow {
  filename: string;
  description: string;
  content: string;
  nextWorkflow?: string; // Reference to next workflow after human review
  dependencies: string[]; // MCP servers required
}

export interface AntigravityExportResult {
  workflows: AntigravityWorkflow[];
  installationGuide: string;
  workflowChain: string[]; // Order of workflow execution
}

export class AntigravityWorkflowExporter {
  private readonly MAX_CHARS = 12000; // Antigravity limit

  /**
   * Export a FictionLab workflow to Antigravity format
   */
  async exportWorkflow(
    workflow: WorkflowDefinition,
    outputDir: string
  ): Promise<AntigravityExportResult> {
    logWithCategory('info', LogCategory.SYSTEM, `Exporting workflow to Antigravity format: ${workflow.name}`);

    // Ensure output directory exists
    await fs.ensureDir(outputDir);

    // Split workflow at gates and approval points
    const segments = this.splitWorkflowAtGates(workflow);

    // Convert each segment to Antigravity format
    const antigravityWorkflows: AntigravityWorkflow[] = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = i < segments.length - 1 ? segments[i + 1] : null;

      const antigravityWorkflow = this.convertSegmentToAntigravity(
        segment,
        workflow,
        i,
        nextSegment
      );

      antigravityWorkflows.push(antigravityWorkflow);

      // Write workflow file
      const filePath = path.join(outputDir, antigravityWorkflow.filename);
      await fs.writeFile(filePath, antigravityWorkflow.content, 'utf-8');
      logWithCategory('info', LogCategory.SYSTEM, `Created workflow file: ${filePath}`);
    }

    // Generate installation guide
    const installationGuide = this.generateInstallationGuide(workflow, antigravityWorkflows);
    const guidePath = path.join(outputDir, 'INSTALLATION.md');
    await fs.writeFile(guidePath, installationGuide, 'utf-8');

    // Generate workflow chain visualization
    const workflowChain = antigravityWorkflows.map(wf => wf.filename);

    logWithCategory('info', LogCategory.SYSTEM, `Export complete: ${antigravityWorkflows.length} workflows created`);

    return {
      workflows: antigravityWorkflows,
      installationGuide,
      workflowChain,
    };
  }

  /**
   * Split workflow into segments at quality gates and approval points
   */
  private splitWorkflowAtGates(workflow: WorkflowDefinition): WorkflowPhase[][] {
    const segments: WorkflowPhase[][] = [];
    let currentSegment: WorkflowPhase[] = [];

    for (const phase of workflow.phases) {
      // Add phase to current segment
      currentSegment.push(phase);

      // Check if this phase ends a segment (gate or approval required)
      const isGate = phase.gate || phase.type === 'gate';
      const requiresApproval = phase.requiresApproval || phase.type === 'user';

      if (isGate || requiresApproval) {
        // End current segment
        segments.push(currentSegment);
        currentSegment = [];
      }
    }

    // Add remaining phases if any
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * Convert a workflow segment to Antigravity markdown format
   */
  private convertSegmentToAntigravity(
    segment: WorkflowPhase[],
    workflow: WorkflowDefinition,
    segmentIndex: number,
    nextSegment: WorkflowPhase[] | null
  ): AntigravityWorkflow {
    const firstPhase = segment[0];
    const lastPhase = segment[segment.length - 1];

    // Generate filename (kebab-case, safe for filesystem)
    const filename = this.generateFilename(workflow, firstPhase, segmentIndex);

    // Generate description for YAML frontmatter
    const description = this.generateDescription(segment, workflow);

    // Generate step-by-step instructions
    const steps = this.generateSteps(segment, workflow, nextSegment);

    // Collect MCP dependencies
    const dependencies = this.collectMCPDependencies(segment);

    // Build markdown content with YAML frontmatter
    const content = this.buildMarkdownContent(description, steps, dependencies, nextSegment);

    // Reference to next workflow if there's a gate/approval
    const nextWorkflow = nextSegment ? this.generateFilename(workflow, nextSegment[0], segmentIndex + 1) : undefined;

    return {
      filename,
      description,
      content,
      nextWorkflow,
      dependencies,
    };
  }

  /**
   * Generate safe filename for workflow
   */
  private generateFilename(workflow: WorkflowDefinition, firstPhase: WorkflowPhase, segmentIndex: number): string {
    const workflowSlug = this.slugify(workflow.name);
    const phaseSlug = this.slugify(firstPhase.name);
    return `${workflowSlug}-${segmentIndex + 1}-${phaseSlug}.md`;
  }

  /**
   * Generate workflow description
   */
  private generateDescription(segment: WorkflowPhase[], workflow: WorkflowDefinition): string {
    const firstPhase = segment[0];
    const lastPhase = segment[segment.length - 1];

    if (segment.length === 1) {
      return `${workflow.name}: ${firstPhase.name}`;
    } else {
      return `${workflow.name}: ${firstPhase.name} through ${lastPhase.name}`;
    }
  }

  /**
   * Generate step-by-step instructions for the workflow segment
   */
  private generateSteps(
    segment: WorkflowPhase[],
    workflow: WorkflowDefinition,
    nextSegment: WorkflowPhase[] | null
  ): string[] {
    const steps: string[] = [];

    // Add context about the workflow
    steps.push(`This is part of the "${workflow.name}" workflow.`);
    steps.push('');

    // Add steps for each phase
    for (let i = 0; i < segment.length; i++) {
      const phase = segment[i];
      const stepNumber = i + 1;

      // Phase header
      steps.push(`## Step ${stepNumber}: ${phase.name}`);
      steps.push('');
      steps.push(`**Agent:** ${phase.agent}`);
      if (phase.skill) {
        steps.push(`**Skill:** ${phase.skill}`);
      }
      steps.push('');

      // Phase description
      if (phase.description) {
        steps.push(phase.description);
        steps.push('');
      }

      // Process steps
      if (phase.process && phase.process.length > 0) {
        steps.push('**Process:**');
        phase.process.forEach((processStep, idx) => {
          steps.push(`${idx + 1}. ${processStep}`);
        });
        steps.push('');
      }

      // MCP integration
      if (phase.mcp && phase.mcp !== 'No database interaction') {
        steps.push('**Database Operations:**');
        steps.push(this.convertMCPToInstructions(phase.mcp));
        steps.push('');
      }

      // Expected output
      if (phase.output) {
        steps.push('**Expected Output:**');
        steps.push(phase.output);
        steps.push('');
      }

      // Sub-workflow reference
      if (phase.subWorkflowId) {
        steps.push(`**Note:** This phase involves a nested workflow. See \`/${phase.subWorkflowId}\` for details.`);
        steps.push('');
      }

      // Quality gate
      if (phase.gate) {
        steps.push('**Quality Gate:**');
        if (phase.gateCondition) {
          steps.push(`Validation criteria: ${phase.gateCondition}`);
        }
        steps.push('The output must pass validation before proceeding.');
        steps.push('');
      }

      // Approval required
      if (phase.requiresApproval || phase.type === 'user') {
        steps.push('**Human Review Required:**');
        steps.push('This phase requires human approval before proceeding to the next step.');
        steps.push('Review the generated artifacts and provide feedback.');
        steps.push('');
      }
    }

    // Add continuation instructions
    const lastPhase = segment[segment.length - 1];
    if (lastPhase.gate || lastPhase.requiresApproval) {
      steps.push('---');
      steps.push('');
      steps.push('## After Review');
      steps.push('');

      if (nextSegment) {
        const nextFilename = this.generateFilename(workflow, nextSegment[0], segment.length);
        const nextPhaseName = nextSegment[0].name;

        if (lastPhase.requiresApproval) {
          steps.push(`Once you've reviewed and approved the output, continue with:`);
          steps.push(`\`/${nextFilename.replace('.md', '')}\``);
          steps.push('');
          steps.push(`This will begin: **${nextPhaseName}**`);
        } else if (lastPhase.gate) {
          steps.push(`If validation passes, continue with:`);
          steps.push(`\`/${nextFilename.replace('.md', '')}\``);
          steps.push('');
          steps.push(`If validation fails, review the violations and re-run this workflow after making corrections.`);
        }
      } else {
        steps.push('Workflow complete! All phases have been executed.');
      }
    }

    return steps;
  }

  /**
   * Convert MCP description to actionable instructions
   */
  private convertMCPToInstructions(mcpDescription: string): string {
    // Parse MCP server references and convert to tool calls
    const instructions: string[] = [];

    // Extract MCP server names
    const serverMatches = mcpDescription.match(/([\w-]+)-server/g);
    if (serverMatches) {
      const servers = Array.from(new Set(serverMatches));

      instructions.push('Use the following MCP tools:');
      servers.forEach(server => {
        instructions.push(`- \`${server}\` tools for data operations`);
      });
      instructions.push('');
      instructions.push(mcpDescription);
    } else {
      instructions.push(mcpDescription);
    }

    return instructions.join('\n');
  }

  /**
   * Collect MCP server dependencies from segment
   */
  private collectMCPDependencies(segment: WorkflowPhase[]): string[] {
    const mcpServers = new Set<string>();

    for (const phase of segment) {
      const serverMatches = phase.mcp.match(/([\w-]+)-server/g);
      if (serverMatches) {
        serverMatches.forEach(server => mcpServers.add(server));
      }
    }

    return Array.from(mcpServers);
  }

  /**
   * Build complete markdown content with YAML frontmatter
   */
  private buildMarkdownContent(
    description: string,
    steps: string[],
    dependencies: string[],
    nextSegment: WorkflowPhase[] | null
  ): string {
    const lines: string[] = [];

    // YAML frontmatter
    lines.push('---');
    lines.push(`description: ${description}`);
    lines.push('---');
    lines.push('');

    // Add turbo mode hint if safe to auto-execute
    const hasApproval = nextSegment === null; // Only safe if no approval needed
    if (!hasApproval) {
      lines.push('<!-- // turbo mode: Use turbo mode for faster execution of safe commands -->');
      lines.push('');
    }

    // MCP Requirements section
    if (dependencies.length > 0) {
      lines.push('## Prerequisites');
      lines.push('');
      lines.push('This workflow requires the following MCP servers:');
      dependencies.forEach(dep => {
        lines.push(`- ${dep}`);
      });
      lines.push('');
      lines.push('Make sure these MCP servers are configured in your Antigravity settings.');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Main content
    lines.push(...steps);

    // Check character limit
    const content = lines.join('\n');
    if (content.length > this.MAX_CHARS) {
      logWithCategory('warn', LogCategory.SYSTEM,
        `Workflow content exceeds ${this.MAX_CHARS} character limit (${content.length} chars). Content may be truncated by Antigravity.`
      );
    }

    return content;
  }

  /**
   * Generate installation guide
   */
  private generateInstallationGuide(
    workflow: WorkflowDefinition,
    antigravityWorkflows: AntigravityWorkflow[]
  ): string {
    const lines: string[] = [];

    lines.push(`# ${workflow.name} - Antigravity Installation Guide`);
    lines.push('');
    lines.push(`**Description:** ${workflow.description}`);
    lines.push(`**Version:** ${workflow.version}`);
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push('');

    // Overview
    lines.push('## Overview');
    lines.push('');
    lines.push(`This workflow has been split into ${antigravityWorkflows.length} segments for use with Google Antigravity.`);
    lines.push('Each segment represents a portion of the workflow that runs until a quality gate or human approval point.');
    lines.push('');

    // Installation
    lines.push('## Installation');
    lines.push('');
    lines.push('1. Copy all workflow files to your Antigravity workflows directory:');
    lines.push('   ```');
    lines.push('   .agent/workflows/');
    lines.push('   ```');
    lines.push('');
    lines.push('2. Ensure all required MCP servers are configured:');
    lines.push('');

    // MCP Dependencies
    const allDependencies = new Set<string>();
    antigravityWorkflows.forEach(wf => {
      wf.dependencies.forEach(dep => allDependencies.add(dep));
    });

    Array.from(allDependencies).forEach(dep => {
      lines.push(`   - ${dep}`);
    });
    lines.push('');

    if (workflow.dependencies.agents.length > 0) {
      lines.push('3. Required agents:');
      workflow.dependencies.agents.forEach(agent => {
        lines.push(`   - ${agent}.md (in .claude/agents/)`);
      });
      lines.push('');
    }

    if (workflow.dependencies.skills.length > 0) {
      lines.push('4. Required skills:');
      workflow.dependencies.skills.forEach(skill => {
        lines.push(`   - ${skill} (in ~/.claude/skills/)`);
      });
      lines.push('');
    }

    // Workflow chain
    lines.push('## Workflow Execution Order');
    lines.push('');
    lines.push('Execute the workflows in this order:');
    lines.push('');

    antigravityWorkflows.forEach((wf, index) => {
      const stepNum = index + 1;
      const command = wf.filename.replace('.md', '');
      lines.push(`${stepNum}. \`/${command}\``);
      lines.push(`   - ${wf.description}`);
      if (wf.nextWorkflow) {
        lines.push(`   - After human review, continue with step ${stepNum + 1}`);
      } else {
        lines.push(`   - Final step in workflow`);
      }
      lines.push('');
    });

    // Usage instructions
    lines.push('## Usage');
    lines.push('');
    lines.push('1. Start the workflow by typing:');
    lines.push(`   \`/${antigravityWorkflows[0].filename.replace('.md', '')}\``);
    lines.push('');
    lines.push('2. Follow the step-by-step instructions provided by Antigravity');
    lines.push('');
    lines.push('3. When you reach a human review point:');
    lines.push('   - Review the generated artifacts');
    lines.push('   - Provide feedback if needed');
    lines.push('   - Execute the next workflow in the chain');
    lines.push('');

    // Notes
    lines.push('## Notes');
    lines.push('');
    lines.push('- **Turbo Mode:** Some workflows support `// turbo` for automated execution');
    lines.push('- **MCP Integration:** Database operations are handled through MCP tools');
    lines.push('- **Quality Gates:** Validation failures will halt workflow execution');
    lines.push('- **Multimodal:** Image generation and analysis require multimodal tool access');
    lines.push('');

    // Support
    lines.push('## Support');
    lines.push('');
    lines.push('For issues or questions:');
    lines.push('- Check that all MCP servers are running');
    lines.push('- Verify agent and skill files are in correct locations');
    lines.push('- Review workflow logs for error details');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Convert string to URL-safe slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Export workflow with preview (doesn't write files)
   */
  async previewExport(workflow: WorkflowDefinition): Promise<AntigravityExportResult> {
    const segments = this.splitWorkflowAtGates(workflow);
    const antigravityWorkflows: AntigravityWorkflow[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = i < segments.length - 1 ? segments[i + 1] : null;

      const antigravityWorkflow = this.convertSegmentToAntigravity(
        segment,
        workflow,
        i,
        nextSegment
      );

      antigravityWorkflows.push(antigravityWorkflow);
    }

    const installationGuide = this.generateInstallationGuide(workflow, antigravityWorkflows);
    const workflowChain = antigravityWorkflows.map(wf => wf.filename);

    return {
      workflows: antigravityWorkflows,
      installationGuide,
      workflowChain,
    };
  }
}
