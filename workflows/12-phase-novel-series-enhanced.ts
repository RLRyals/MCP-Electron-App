/**
 * 12-Phase Novel Series Writing Workflow - Enhanced Node Definitions
 *
 * This file provides the complete enhanced node definitions for the 12-phase workflow
 * using the new WorkflowNode type system with full configuration support.
 *
 * Features:
 * - User input nodes with validation
 * - Loop nodes for chapter iteration
 * - File operation nodes for manuscript assembly
 * - Quality gate nodes with conditions
 * - Conditional nodes for series progression
 * - Retry configurations for critical nodes
 * - Context mapping (simple mode by default)
 */

import type {
  WorkflowNode,
  UserInputNode,
  AgentWorkflowNode,
  LoopNode,
  FileOperationNode,
  ConditionalNode,
  RetryConfig,
  ContextConfig
} from '../src/types/workflow-nodes';

import type { LLMProviderConfig } from '../src/types/llm-providers';

// Default LLM provider (Claude Code CLI with user subscription)
const defaultProvider: LLMProviderConfig = {
  type: 'claude-code-cli',
  name: 'Claude Code CLI (Default)',
  config: {
    model: 'claude-sonnet-4-5',
    outputFormat: 'json'
  }
};

// Default retry configuration for critical nodes
const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 2
};

// Simple context mode (automatic context passing)
const simpleContext: ContextConfig = {
  mode: 'simple'
};

// Enhanced node definitions
export const enhancedNodes: WorkflowNode[] = [
  // Node 0: User Input - Capture Book/Series Idea
  {
    id: 'node-0',
    name: 'Book/Series Idea Capture',
    description: 'Capture the author\'s initial book or series idea including genre, main character concept, setting, and key plot points.',
    type: 'user-input',
    position: { x: 100, y: 50 },

    // Input configuration
    prompt: 'Please describe your book or series idea. Include genre, main character concept, setting, and any key plot points or themes you have in mind.',
    inputType: 'textarea',
    required: true,
    validation: {
      minLength: 50,
      maxLength: 5000
    },
    defaultValue: '',

    // Execution settings
    requiresApproval: false,
    contextConfig: simpleContext
  } as UserInputNode,

  // Node 1: Market Research
  {
    id: 'node-1',
    name: 'Market Research',
    description: 'Research current urban fantasy market trends, identify comp titles, analyze reader expectations, and define target audience.',
    type: 'planning',
    position: { x: 100, y: 200 },

    // LLM Provider
    provider: defaultProvider,

    // Agent and skill
    agent: 'market-research-agent',
    skill: 'urban-fantasy-market-analysis',

    // Not a gate
    gate: false,

    // Execution settings
    requiresApproval: false,
    retryConfig: defaultRetryConfig,
    timeoutMs: 300000, // 5 minutes
    contextConfig: simpleContext
  } as AgentWorkflowNode,

  // Node 2: Series Architecture
  {
    id: 'node-2',
    name: 'Series Architecture',
    description: 'Plan the overall 5-book series structure including character arcs, world progression, and overarching plot threads.',
    type: 'planning',
    position: { x: 100, y: 350 },

    provider: defaultProvider,
    agent: 'series-architect-agent',
    skill: 'five-book-series-planning',
    gate: false,

    requiresApproval: true, // Author should review series plan
    retryConfig: defaultRetryConfig,
    timeoutMs: 300000,
    contextConfig: simpleContext
  } as AgentWorkflowNode,

  // Node 3: Book 1 Planning
  {
    id: 'node-3',
    name: 'Book 1 Planning',
    description: 'Create detailed outline for Book 1 with chapter-by-chapter breakdown, scene structure, and character development beats.',
    type: 'planning',
    position: { x: 100, y: 500 },

    provider: defaultProvider,
    agent: 'book-planner-agent',
    skill: 'detailed-book-planning',
    gate: false,

    requiresApproval: true, // Author should review book outline
    retryConfig: defaultRetryConfig,
    timeoutMs: 300000,
    contextConfig: simpleContext
  } as AgentWorkflowNode,

  // Node 4: NPE Validation (Quality Gate)
  {
    id: 'node-4',
    name: 'NPE Validation',
    description: 'Validate planning quality using NPE (No Pulp Errors) checklist. Ensures solid structure before writing begins.',
    type: 'gate',
    position: { x: 100, y: 650 },

    provider: defaultProvider,
    agent: 'npe-validator-agent',
    skill: 'validate-novel-structure',

    // Gate configuration
    gate: true,
    gateCondition: '$.score >= 80', // JSONPath condition

    requiresApproval: true, // Author must review validation results
    retryConfig: {
      maxRetries: 5, // Allow more retries for validation
      retryDelayMs: 2000,
      backoffMultiplier: 1.5
    },
    timeoutMs: 180000, // 3 minutes
    contextConfig: simpleContext
  } as AgentWorkflowNode,

  // Node 5: Chapter Writing Loop
  {
    id: 'node-5',
    name: 'Chapter Writing Loop',
    description: 'Iteratively write each chapter of Book 1 based on the detailed outline. Loop through all 25-30 chapters.',
    type: 'loop',
    position: { x: 100, y: 800 },

    // Loop configuration
    loopType: 'forEach',
    collection: '$.book1Planning.chapters', // JSONPath to chapters array
    iteratorVariable: 'currentChapter',
    indexVariable: 'chapterIndex',
    maxIterations: 50, // Safety limit

    requiresApproval: false,
    timeoutMs: 600000, // 10 minutes per chapter
    contextConfig: simpleContext
  } as LoopNode,

  // Node 6: Manuscript Assembly
  {
    id: 'node-6',
    name: 'Manuscript Assembly',
    description: 'Assemble all chapters into a complete manuscript file with proper formatting and metadata.',
    type: 'file',
    position: { x: 100, y: 950 },

    // File operation configuration
    operation: 'write',
    targetPath: '{{projectFolder}}/Book1_Manuscript.txt',
    content: '{{assembledManuscript}}', // Variable from context
    encoding: 'utf8',
    overwrite: true,
    requireProjectFolder: true,

    requiresApproval: false,
    retryConfig: defaultRetryConfig,
    contextConfig: simpleContext
  } as FileOperationNode,

  // Node 7: Developmental Edit
  {
    id: 'node-7',
    name: 'Developmental Edit',
    description: 'High-level editing focused on story structure, pacing, plot coherence, and character arcs.',
    type: 'writing',
    position: { x: 100, y: 1100 },

    provider: defaultProvider,
    agent: 'developmental-editor-agent',
    skill: 'manuscript-dev-edit',
    gate: false,

    requiresApproval: true, // Author should review dev edit suggestions
    retryConfig: defaultRetryConfig,
    timeoutMs: 600000, // 10 minutes for full manuscript review
    contextConfig: simpleContext
  } as AgentWorkflowNode,

  // Node 8: Line Edit
  {
    id: 'node-8',
    name: 'Line Edit',
    description: 'Sentence-level editing for style, clarity, flow, grammar, and word choice.',
    type: 'writing',
    position: { x: 100, y: 1250 },

    provider: defaultProvider,
    agent: 'line-editor-agent',
    skill: 'manuscript-line-edit',
    gate: false,

    requiresApproval: true, // Author should review line edits
    retryConfig: defaultRetryConfig,
    timeoutMs: 600000,
    contextConfig: simpleContext
  } as AgentWorkflowNode,

  // Node 9: Final Quality Gate
  {
    id: 'node-9',
    name: 'Final Quality Gate',
    description: 'Final validation before publication. Checks readiness across all quality dimensions.',
    type: 'gate',
    position: { x: 100, y: 1400 },

    provider: defaultProvider,
    agent: 'final-validator-agent',
    skill: 'manuscript-quality-check',

    // Gate configuration
    gate: true,
    gateCondition: '$.readiness >= 90',

    requiresApproval: true,
    retryConfig: {
      maxRetries: 5,
      retryDelayMs: 2000,
      backoffMultiplier: 1.5
    },
    timeoutMs: 300000,
    contextConfig: simpleContext
  } as AgentWorkflowNode,

  // Node 10: Export for Publication
  {
    id: 'node-10',
    name: 'Export for Publication',
    description: 'Prepare and export the final manuscript in publication-ready format.',
    type: 'file',
    position: { x: 100, y: 1550 },

    // File operation configuration
    operation: 'copy',
    sourcePath: '{{projectFolder}}/Book1_Manuscript.txt',
    targetPath: '{{projectFolder}}/exports/Book1_Final.txt',
    requireProjectFolder: true,

    requiresApproval: false,
    retryConfig: defaultRetryConfig,
    contextConfig: simpleContext
  } as FileOperationNode,

  // Node 11: Series Progression Check
  {
    id: 'node-11',
    name: 'Series Progression Check',
    description: 'Determine if the series is complete or if more books need to be written (up to 5 total).',
    type: 'conditional',
    position: { x: 100, y: 1700 },

    // Conditional configuration
    condition: '$.currentBookNumber < 5',
    conditionType: 'jsonpath',

    requiresApproval: false,
    contextConfig: simpleContext
  } as ConditionalNode,

  // Node 12: Series Completion
  {
    id: 'node-12',
    name: 'Series Completion',
    description: 'Generate final series completion report with statistics and next steps for publication.',
    type: 'planning',
    position: { x: 100, y: 1850 },

    provider: defaultProvider,
    agent: 'series-completion-agent',
    skill: 'series-wrap-up',
    gate: false,

    requiresApproval: true, // Author should review final report
    retryConfig: defaultRetryConfig,
    timeoutMs: 300000,
    contextConfig: simpleContext
  } as AgentWorkflowNode
];

// Edge definitions for visual graph
export const enhancedEdges = [
  { id: 'e0-1', source: 'node-0', target: 'node-1', type: 'sequential' },
  { id: 'e1-2', source: 'node-1', target: 'node-2', type: 'sequential' },
  { id: 'e2-3', source: 'node-2', target: 'node-3', type: 'sequential' },
  { id: 'e3-4', source: 'node-3', target: 'node-4', type: 'sequential' },
  { id: 'e4-5', source: 'node-4', target: 'node-5', type: 'conditional', label: 'score >= 80', condition: '$.score >= 80' },
  { id: 'e4-3', source: 'node-4', target: 'node-3', type: 'conditional', label: 'score < 80 (retry)', condition: '$.score < 80' },
  { id: 'e5-6', source: 'node-5', target: 'node-6', type: 'sequential' },
  { id: 'e6-7', source: 'node-6', target: 'node-7', type: 'sequential' },
  { id: 'e7-8', source: 'node-7', target: 'node-8', type: 'sequential' },
  { id: 'e8-9', source: 'node-8', target: 'node-9', type: 'sequential' },
  { id: 'e9-10', source: 'node-9', target: 'node-10', type: 'conditional', label: 'readiness >= 90', condition: '$.readiness >= 90' },
  { id: 'e9-7', source: 'node-9', target: 'node-7', type: 'conditional', label: 'readiness < 90 (retry)', condition: '$.readiness < 90' },
  { id: 'e10-11', source: 'node-10', target: 'node-11', type: 'sequential' },
  { id: 'e11-3', source: 'node-11', target: 'node-3', type: 'conditional', label: 'currentBookNumber < 5 (next book)', condition: '$.currentBookNumber < 5' },
  { id: 'e11-12', source: 'node-11', target: 'node-12', type: 'conditional', label: 'currentBookNumber >= 5 (complete)', condition: '$.currentBookNumber >= 5' }
];

// Complete workflow definition with enhanced nodes
export const twelvePhaseNovelSeriesWorkflow = {
  id: '12-phase-novel-series',
  name: '12-Phase Novel Series Writing Workflow',
  version: '1.0.0',
  description: 'Complete workflow to write a 5-book urban fantasy series from initial idea to publication-ready manuscript.',

  metadata: {
    author: 'FictionLab',
    created: '2025-12-20T00:00:00.000Z',
    updated: '2025-12-20T00:00:00.000Z',
    tags: ['fiction', 'urban-fantasy', 'series', 'novel-writing', 'complete-workflow']
  },

  dependencies: {
    agents: [
      'market-research-agent',
      'series-architect-agent',
      'book-planner-agent',
      'npe-validator-agent',
      'chapter-writer-agent',
      'developmental-editor-agent',
      'line-editor-agent',
      'final-validator-agent',
      'series-completion-agent'
    ],
    skills: [
      'urban-fantasy-market-analysis',
      'five-book-series-planning',
      'detailed-book-planning',
      'validate-novel-structure',
      'chapter-writing',
      'manuscript-dev-edit',
      'manuscript-line-edit',
      'manuscript-quality-check',
      'series-wrap-up'
    ],
    mcpServers: [
      'workflow-manager',
      'file-system'
    ]
  },

  // Enhanced nodes with full configuration
  nodes: enhancedNodes,

  // Edge connections
  edges: enhancedEdges,

  // Graph metadata for visualization
  graph: {
    metadata: {
      workflowId: '12-phase-novel-series',
      workflowName: '12-Phase Novel Series Writing Workflow',
      version: '1.0.0'
    }
  }
};

// Export default
export default twelvePhaseNovelSeriesWorkflow;
