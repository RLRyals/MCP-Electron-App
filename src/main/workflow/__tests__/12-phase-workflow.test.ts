/**
 * 12-Phase Novel Series Workflow Integration Tests
 *
 * Tests for loading and validating the 12-phase workflow definition.
 * Validates node configurations, workflow structure, connections, loops, gates,
 * and ensures all required agents and skills are defined.
 */

import { MCPWorkflowClient, WorkflowDefinition, WorkflowPhase } from '../mcp-workflow-client';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock dependencies
jest.mock('../mcp-workflow-client');

describe('12-Phase Novel Series Workflow Tests', () => {
  let workflowDef: any;
  const workflowPath = path.join(process.cwd(), 'workflows', '12-phase-novel-series.json');

  beforeAll(async () => {
    // Load the actual workflow definition
    const workflowContent = await fs.readFile(workflowPath, 'utf8');
    workflowDef = JSON.parse(workflowContent);
  });

  describe('Workflow Definition Loading', () => {
    it('should load the 12-phase workflow definition', () => {
      expect(workflowDef).toBeDefined();
      expect(workflowDef.id).toBe('12-phase-novel-series');
      expect(workflowDef.name).toBe('12-Phase Novel Series Writing Workflow');
      expect(workflowDef.version).toBe('1.0.0');
    });

    it('should have correct metadata', () => {
      expect(workflowDef.metadata).toBeDefined();
      expect(workflowDef.metadata.author).toBe('FictionLab');
      expect(workflowDef.metadata.tags).toContain('fiction');
      expect(workflowDef.metadata.tags).toContain('urban-fantasy');
      expect(workflowDef.metadata.tags).toContain('series');
    });

    it('should have all 13 phases (0-12)', () => {
      expect(workflowDef.phases).toBeDefined();
      expect(workflowDef.phases).toHaveLength(13);

      // Verify phase IDs are sequential
      const phaseIds = workflowDef.phases.map((p: any) => p.id);
      expect(phaseIds).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });
  });

  describe('Phase Configurations', () => {
    it('should have valid phase 0 (User Input)', () => {
      const phase0 = workflowDef.phases[0];

      expect(phase0.id).toBe(0);
      expect(phase0.name).toBe('User Input: Book/Series Idea');
      expect(phase0.type).toBe('user');
      expect(phase0.agent).toBe('User');
      expect(phase0.requiresApproval).toBe(false);
      expect(phase0.gate).toBe(false);
    });

    it('should have valid phase 1 (Market Research)', () => {
      const phase1 = workflowDef.phases[1];

      expect(phase1.id).toBe(1);
      expect(phase1.name).toBe('Market Research');
      expect(phase1.type).toBe('planning');
      expect(phase1.agent).toBe('market-research-agent');
      expect(phase1.skill).toBe('urban-fantasy-market-analysis');
      expect(phase1.gate).toBe(false);
    });

    it('should have valid phase 2 (Series Architecture)', () => {
      const phase2 = workflowDef.phases[2];

      expect(phase2.id).toBe(2);
      expect(phase2.name).toBe('Series Architecture');
      expect(phase2.type).toBe('planning');
      expect(phase2.agent).toBe('series-architect-agent');
      expect(phase2.skill).toBe('five-book-series-planning');
      expect(phase2.requiresApproval).toBe(true);
    });

    it('should have valid phase 3 (Book 1 Planning)', () => {
      const phase3 = workflowDef.phases[3];

      expect(phase3.id).toBe(3);
      expect(phase3.name).toBe('Book 1 Planning');
      expect(phase3.type).toBe('planning');
      expect(phase3.agent).toBe('book-planner-agent');
      expect(phase3.skill).toBe('detailed-book-planning');
      expect(phase3.requiresApproval).toBe(true);
    });

    it('should have valid phase 4 (NPE Validation Gate)', () => {
      const phase4 = workflowDef.phases[4];

      expect(phase4.id).toBe(4);
      expect(phase4.name).toBe('NPE Validation');
      expect(phase4.type).toBe('gate');
      expect(phase4.agent).toBe('npe-validator-agent');
      expect(phase4.skill).toBe('validate-novel-structure');
      expect(phase4.gate).toBe(true);
      expect(phase4.gateCondition).toBe('$.score >= 80');
      expect(phase4.requiresApproval).toBe(true);
    });

    it('should have valid phase 5 (Chapter Writing Loop)', () => {
      const phase5 = workflowDef.phases[5];

      expect(phase5.id).toBe(5);
      expect(phase5.name).toBe('Chapter Writing Loop');
      expect(phase5.type).toBe('loop');
      expect(phase5.agent).toBe('chapter-writer-agent');
      expect(phase5.skill).toBe('chapter-writing');
      expect(phase5.description).toContain('25-30 chapters');
    });

    it('should have valid phase 6 (Manuscript Assembly)', () => {
      const phase6 = workflowDef.phases[6];

      expect(phase6.id).toBe(6);
      expect(phase6.name).toBe('Manuscript Assembly');
      expect(phase6.type).toBe('writing');
      expect(phase6.agent).toBe('manuscript-assembler-agent');
      expect(phase6.skill).toBe('manuscript-assembly');
    });

    it('should have valid phase 7 (Developmental Edit)', () => {
      const phase7 = workflowDef.phases[7];

      expect(phase7.id).toBe(7);
      expect(phase7.name).toBe('Developmental Edit');
      expect(phase7.type).toBe('writing');
      expect(phase7.agent).toBe('developmental-editor-agent');
      expect(phase7.skill).toBe('manuscript-dev-edit');
      expect(phase7.requiresApproval).toBe(true);
    });

    it('should have valid phase 8 (Line Edit)', () => {
      const phase8 = workflowDef.phases[8];

      expect(phase8.id).toBe(8);
      expect(phase8.name).toBe('Line Edit');
      expect(phase8.type).toBe('writing');
      expect(phase8.agent).toBe('line-editor-agent');
      expect(phase8.skill).toBe('manuscript-line-edit');
      expect(phase8.requiresApproval).toBe(true);
    });

    it('should have valid phase 9 (Final Quality Gate)', () => {
      const phase9 = workflowDef.phases[9];

      expect(phase9.id).toBe(9);
      expect(phase9.name).toBe('Final Quality Gate');
      expect(phase9.type).toBe('gate');
      expect(phase9.agent).toBe('final-validator-agent');
      expect(phase9.skill).toBe('manuscript-quality-check');
      expect(phase9.gate).toBe(true);
      expect(phase9.gateCondition).toBe('$.readiness >= 90');
      expect(phase9.requiresApproval).toBe(true);
    });

    it('should have valid phase 10 (Export)', () => {
      const phase10 = workflowDef.phases[10];

      expect(phase10.id).toBe(10);
      expect(phase10.name).toBe('Export for Publication');
      expect(phase10.type).toBe('writing');
      expect(phase10.agent).toBe('export-manager-agent');
      expect(phase10.skill).toBe('export-preparation');
    });

    it('should have valid phase 11 (Series Progression Check)', () => {
      const phase11 = workflowDef.phases[11];

      expect(phase11.id).toBe(11);
      expect(phase11.name).toBe('Series Progression Check');
      expect(phase11.type).toBe('planning');
      expect(phase11.agent).toBe('series-progression-agent');
      expect(phase11.skill).toBe('series-progression-check');
      expect(phase11.gateCondition).toBe('$.currentBookNumber < 5');
    });

    it('should have valid phase 12 (Series Completion)', () => {
      const phase12 = workflowDef.phases[12];

      expect(phase12.id).toBe(12);
      expect(phase12.name).toBe('Series Completion');
      expect(phase12.type).toBe('planning');
      expect(phase12.agent).toBe('series-completion-agent');
      expect(phase12.skill).toBe('series-wrap-up');
      expect(phase12.requiresApproval).toBe(true);
    });
  });

  describe('Phase Types Distribution', () => {
    it('should have correct distribution of phase types', () => {
      const phaseTypes = workflowDef.phases.reduce((acc: any, phase: any) => {
        acc[phase.type] = (acc[phase.type] || 0) + 1;
        return acc;
      }, {});

      expect(phaseTypes.user).toBe(1);
      expect(phaseTypes.planning).toBeGreaterThanOrEqual(4);
      expect(phaseTypes.writing).toBeGreaterThanOrEqual(4);
      expect(phaseTypes.gate).toBe(2);
      expect(phaseTypes.loop).toBe(1);
    });

    it('should have phases requiring approval', () => {
      const approvalPhases = workflowDef.phases.filter((p: any) => p.requiresApproval);

      expect(approvalPhases.length).toBeGreaterThan(0);
      expect(approvalPhases.some((p: any) => p.type === 'gate')).toBe(true);
    });

    it('should have gate phases with conditions', () => {
      const gatePhases = workflowDef.phases.filter((p: any) => p.gate === true);

      expect(gatePhases.length).toBe(2);

      gatePhases.forEach((phase: any) => {
        expect(phase.gateCondition).toBeDefined();
        expect(phase.gateCondition).toMatch(/\$\./); // Should use JSONPath
      });
    });
  });

  describe('Dependencies Validation', () => {
    it('should define all required agents', () => {
      expect(workflowDef.dependencies.agents).toBeDefined();
      expect(workflowDef.dependencies.agents).toHaveLength(12);

      const expectedAgents = [
        'market-research-agent',
        'series-architect-agent',
        'book-planner-agent',
        'npe-validator-agent',
        'chapter-writer-agent',
        'manuscript-assembler-agent',
        'developmental-editor-agent',
        'line-editor-agent',
        'final-validator-agent',
        'export-manager-agent',
        'series-progression-agent',
        'series-completion-agent'
      ];

      expectedAgents.forEach(agent => {
        expect(workflowDef.dependencies.agents).toContain(agent);
      });
    });

    it('should define all required skills', () => {
      expect(workflowDef.dependencies.skills).toBeDefined();
      expect(workflowDef.dependencies.skills).toHaveLength(12);

      const expectedSkills = [
        'urban-fantasy-market-analysis',
        'five-book-series-planning',
        'detailed-book-planning',
        'validate-novel-structure',
        'chapter-writing',
        'manuscript-assembly',
        'manuscript-dev-edit',
        'manuscript-line-edit',
        'manuscript-quality-check',
        'export-preparation',
        'series-progression-check',
        'series-wrap-up'
      ];

      expectedSkills.forEach(skill => {
        expect(workflowDef.dependencies.skills).toContain(skill);
      });
    });

    it('should define required MCP servers', () => {
      expect(workflowDef.dependencies.mcpServers).toBeDefined();
      expect(workflowDef.dependencies.mcpServers).toContain('workflow-manager');
      expect(workflowDef.dependencies.mcpServers).toContain('file-system');
    });

    it('should have matching agents and skills for each phase', () => {
      const phasesWithAgents = workflowDef.phases.filter((p: any) => p.agent && p.agent !== 'User');

      phasesWithAgents.forEach((phase: any) => {
        expect(workflowDef.dependencies.agents).toContain(phase.agent);

        if (phase.skill) {
          expect(workflowDef.dependencies.skills).toContain(phase.skill);
        }
      });
    });
  });

  describe('Workflow Graph Structure', () => {
    it('should have valid graph_json structure', () => {
      expect(workflowDef.graph_json).toBeDefined();
      expect(workflowDef.graph_json.nodes).toBeDefined();
      expect(workflowDef.graph_json.edges).toBeDefined();
    });

    it('should have nodes matching phases', () => {
      expect(workflowDef.graph_json.nodes).toHaveLength(13);

      workflowDef.phases.forEach((phase: any) => {
        const node = workflowDef.graph_json.nodes.find((n: any) => n.id === String(phase.id));
        expect(node).toBeDefined();
        expect(node.type).toBe(phase.type);
        expect(node.data.label).toBe(phase.name);
      });
    });

    it('should have valid node positions', () => {
      workflowDef.graph_json.nodes.forEach((node: any) => {
        expect(node.position).toBeDefined();
        expect(node.position.x).toBeGreaterThanOrEqual(0);
        expect(node.position.y).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have sequential edges', () => {
      const edges = workflowDef.graph_json.edges;
      expect(edges.length).toBeGreaterThan(0);

      // Check main flow (0 -> 1 -> 2 -> ... -> 10 -> 11)
      const sequentialEdge = edges.find((e: any) => e.source === '0' && e.target === '1');
      expect(sequentialEdge).toBeDefined();
      expect(sequentialEdge.type).toBe('sequential');
    });

    it('should have conditional edges for gates', () => {
      const edges = workflowDef.graph_json.edges;

      // NPE gate (phase 4) should have conditional edges
      const npePassEdge = edges.find((e: any) => e.source === '4' && e.target === '5');
      expect(npePassEdge).toBeDefined();
      expect(npePassEdge.type).toBe('conditional');
      expect(npePassEdge.label).toContain('score >= 80');

      const npeRetryEdge = edges.find((e: any) => e.source === '4' && e.target === '3');
      expect(npeRetryEdge).toBeDefined();
      expect(npeRetryEdge.type).toBe('conditional');
      expect(npeRetryEdge.label).toContain('score < 80');

      // Final gate (phase 9) should have conditional edges
      const finalPassEdge = edges.find((e: any) => e.source === '9' && e.target === '10');
      expect(finalPassEdge).toBeDefined();
      expect(finalPassEdge.type).toBe('conditional');

      const finalRetryEdge = edges.find((e: any) => e.source === '9' && e.target === '7');
      expect(finalRetryEdge).toBeDefined();
      expect(finalRetryEdge.type).toBe('conditional');
    });

    it('should have loop edges for book iteration', () => {
      const edges = workflowDef.graph_json.edges;

      // Series progression (phase 11) should loop back to book planning (phase 3)
      const loopEdge = edges.find((e: any) => e.source === '11' && e.target === '3');
      expect(loopEdge).toBeDefined();
      expect(loopEdge.type).toBe('conditional');
      expect(loopEdge.label).toContain('currentBookNumber < 5');

      // Exit loop to series completion (phase 12)
      const exitEdge = edges.find((e: any) => e.source === '11' && e.target === '12');
      expect(exitEdge).toBeDefined();
      expect(exitEdge.type).toBe('conditional');
    });

    it('should have no orphaned nodes', () => {
      const edges = workflowDef.graph_json.edges;
      const nodes = workflowDef.graph_json.nodes;

      // All nodes except first should have incoming edge
      const nodesWithIncoming = new Set(edges.map((e: any) => e.target));

      nodes.forEach((node: any, index: number) => {
        if (index > 0) { // Skip first node (user input)
          expect(nodesWithIncoming.has(node.id)).toBe(true);
        }
      });
    });

    it('should have valid edge IDs', () => {
      const edges = workflowDef.graph_json.edges;

      edges.forEach((edge: any) => {
        expect(edge.id).toBeDefined();
        expect(edge.id).toMatch(/^e\d+-\d+$/);
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
      });
    });
  });

  describe('Process Steps Validation', () => {
    it('should have process steps for each phase', () => {
      workflowDef.phases.forEach((phase: any) => {
        expect(phase.process).toBeDefined();
        expect(Array.isArray(phase.process)).toBe(true);
        expect(phase.process.length).toBeGreaterThan(0);
      });
    });

    it('should have detailed process steps for loop phase', () => {
      const loopPhase = workflowDef.phases.find((p: any) => p.type === 'loop');
      expect(loopPhase.process).toBeDefined();
      expect(loopPhase.process.length).toBeGreaterThan(5);

      const processText = loopPhase.process.join(' ');
      expect(processText).toContain('For each chapter');
      expect(processText).toContain('Load');
      expect(processText).toContain('Generate');
    });

    it('should have clear gate validation steps', () => {
      const gatePhases = workflowDef.phases.filter((p: any) => p.gate === true);

      gatePhases.forEach((phase: any) => {
        const processText = phase.process.join(' ').toLowerCase();
        expect(processText).toContain('score');
        // Gate phases should have checking/verification process
        expect(phase.process.length).toBeGreaterThan(3);
      });
    });
  });

  describe('Output and MCP Integration', () => {
    it('should specify output for each phase', () => {
      workflowDef.phases.forEach((phase: any) => {
        expect(phase.output).toBeDefined();
        expect(typeof phase.output).toBe('string');
        expect(phase.output.length).toBeGreaterThan(10);
      });
    });

    it('should specify MCP integration for data phases', () => {
      const dataPhases = workflowDef.phases.filter((p: any) =>
        p.type === 'planning' || p.type === 'writing' || p.type === 'gate'
      );

      dataPhases.forEach((phase: any) => {
        expect(phase.mcp).toBeDefined();
        expect(typeof phase.mcp).toBe('string');
      });
    });

    it('should use workflow-manager MCP for most phases', () => {
      const workflowManagerPhases = workflowDef.phases.filter((p: any) =>
        p.mcp && p.mcp.includes('workflow-manager')
      );

      expect(workflowManagerPhases.length).toBeGreaterThan(8);
    });

    it('should use file-system MCP for file operations', () => {
      const filePhases = workflowDef.phases.filter((p: any) =>
        p.mcp && p.mcp.includes('file-system')
      );

      expect(filePhases.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Completeness', () => {
    it('should cover complete series writing lifecycle', () => {
      const phaseNames = workflowDef.phases.map((p: any) => p.name.toLowerCase());
      const phasesText = phaseNames.join(' ');

      // Check for key stages
      expect(phasesText).toContain('market research');
      expect(phasesText).toContain('series architecture');
      expect(phasesText).toContain('planning');
      expect(phasesText).toContain('writing');
      expect(phasesText).toContain('edit');
      expect(phasesText).toContain('quality');
      expect(phasesText).toContain('export');
      expect(phasesText).toContain('completion');
    });

    it('should have appropriate phase descriptions', () => {
      workflowDef.phases.forEach((phase: any) => {
        expect(phase.description).toBeDefined();
        expect(phase.description.length).toBeGreaterThan(20);
        expect(phase.fullName).toBeDefined();
      });
    });

    it('should support 5-book series', () => {
      const seriesArchPhase = workflowDef.phases.find((p: any) => p.id === 2);
      expect(seriesArchPhase.description).toContain('5-book');

      const progressionPhase = workflowDef.phases.find((p: any) => p.id === 11);
      expect(progressionPhase.gateCondition).toContain('5');
    });

    it('should have realistic word count expectations', () => {
      const chapterLoop = workflowDef.phases.find((p: any) => p.id === 5);
      const description = chapterLoop.description + ' ' + chapterLoop.output;

      expect(description).toMatch(/\d{3,5}/); // Should mention word counts
    });
  });

  describe('Node Instantiation', () => {
    it('should be able to convert phases to workflow nodes', () => {
      workflowDef.phases.forEach((phase: any) => {
        // Basic node structure
        const node = {
          id: `phase-${phase.id}`,
          name: phase.name,
          description: phase.description,
          type: phase.type,
          position: phase.position || { x: 100, y: phase.id * 150 },
          requiresApproval: phase.requiresApproval || false,
          contextConfig: { mode: 'simple' as const }
        };

        expect(node.id).toBeDefined();
        expect(node.name).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.position).toBeDefined();
      });
    });

    it('should support conversion of agent phases', () => {
      const agentPhases = workflowDef.phases.filter((p: any) =>
        p.type === 'planning' || p.type === 'writing' || p.type === 'gate'
      );

      agentPhases.forEach((phase: any) => {
        expect(phase.agent).toBeDefined();

        // Agent phases should have enough info to create AgentWorkflowNode
        const isComplete = phase.agent &&
                          (phase.type === 'planning' || phase.type === 'writing' || phase.type === 'gate');
        expect(isComplete).toBe(true);
      });
    });
  });

  describe('Workflow Execution Flow', () => {
    it('should have clear start point', () => {
      const firstPhase = workflowDef.phases[0];
      expect(firstPhase.id).toBe(0);
      expect(firstPhase.type).toBe('user');
    });

    it('should have clear end point', () => {
      const lastPhase = workflowDef.phases[workflowDef.phases.length - 1];
      expect(lastPhase.id).toBe(12);
      expect(lastPhase.name).toContain('Completion');
    });

    it('should support iterative book production', () => {
      // Verify the book production loop structure
      const bookPlanningPhase = workflowDef.phases.find((p: any) => p.id === 3);
      const progressionPhase = workflowDef.phases.find((p: any) => p.id === 11);

      expect(bookPlanningPhase).toBeDefined();
      expect(progressionPhase).toBeDefined();

      // Check for loop edge in graph
      const loopEdge = workflowDef.graph_json.edges.find((e: any) =>
        e.source === '11' && e.target === '3'
      );
      expect(loopEdge).toBeDefined();
    });

    it('should support quality gates with retry', () => {
      // NPE gate retry
      const npeGate = workflowDef.phases.find((p: any) => p.id === 4);
      expect(npeGate.gate).toBe(true);

      const npeRetryEdge = workflowDef.graph_json.edges.find((e: any) =>
        e.source === '4' && e.target === '3'
      );
      expect(npeRetryEdge).toBeDefined();

      // Final gate retry
      const finalGate = workflowDef.phases.find((p: any) => p.id === 9);
      expect(finalGate.gate).toBe(true);

      const finalRetryEdge = workflowDef.graph_json.edges.find((e: any) =>
        e.source === '9' && e.target === '7'
      );
      expect(finalRetryEdge).toBeDefined();
    });
  });
});
