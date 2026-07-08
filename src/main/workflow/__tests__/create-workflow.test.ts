/**
 * Unit tests for the in-app "create workflow" helpers.
 * Covers id slugging, (workflow_id) uniqueness / auto-suffixing, and the
 * minimal-definition validity that the runner requires.
 */

import {
  slugifyWorkflowName,
  resolveUniqueWorkflowId,
  buildNewWorkflowDefinition,
  DEFAULT_NEW_WORKFLOW_VERSION,
  FALLBACK_WORKFLOW_SLUG,
} from '../create-workflow';

describe('slugifyWorkflowName', () => {
  it('lowercases and dashes a normal name', () => {
    expect(slugifyWorkflowName('My Cool Workflow')).toBe('my-cool-workflow');
  });

  it('collapses runs of non-alphanumeric characters into a single dash', () => {
    expect(slugifyWorkflowName('Draft  &  Review!!!')).toBe('draft-review');
  });

  it('trims leading and trailing separators', () => {
    expect(slugifyWorkflowName('  --Novel Outline--  ')).toBe('novel-outline');
  });

  it('keeps digits', () => {
    expect(slugifyWorkflowName('Book 2 Pipeline')).toBe('book-2-pipeline');
  });

  it('falls back when the name has no slug-able characters', () => {
    expect(slugifyWorkflowName('!!!')).toBe(FALLBACK_WORKFLOW_SLUG);
    expect(slugifyWorkflowName('')).toBe(FALLBACK_WORKFLOW_SLUG);
  });
});

describe('resolveUniqueWorkflowId', () => {
  it('returns the base slug when it is free', () => {
    expect(resolveUniqueWorkflowId('my-workflow', new Set())).toBe('my-workflow');
  });

  it('auto-suffixes with -2 when the base is taken', () => {
    expect(resolveUniqueWorkflowId('my-workflow', new Set(['my-workflow']))).toBe('my-workflow-2');
  });

  it('increments past consecutive existing suffixes', () => {
    const taken = new Set(['my-workflow', 'my-workflow-2', 'my-workflow-3']);
    expect(resolveUniqueWorkflowId('my-workflow', taken)).toBe('my-workflow-4');
  });

  it('accepts any iterable of existing ids (not just a Set)', () => {
    expect(resolveUniqueWorkflowId('wf', ['wf', 'wf-2'])).toBe('wf-3');
  });

  it('never returns an id already present (no silent overwrite)', () => {
    const taken = new Set(['wf', 'wf-2']);
    const resolved = resolveUniqueWorkflowId('wf', taken);
    expect(taken.has(resolved)).toBe(false);
  });
});

describe('buildNewWorkflowDefinition', () => {
  it('produces a minimal, valid definition with an empty graph', () => {
    const def = buildNewWorkflowDefinition({ id: 'my-workflow', name: 'My Workflow' });

    expect(def.id).toBe('my-workflow');
    expect(def.name).toBe('My Workflow');
    expect(def.version).toBe(DEFAULT_NEW_WORKFLOW_VERSION);
    expect(def.version).toBe('0.1.0');

    // Empty graph is intentional: the runner accepts it at persist time and only
    // rejects it at execution ("Workflow has no nodes to execute").
    expect(def.graph_json).toEqual({ nodes: [], edges: [] });

    // Dependencies present and empty so export/round-trip has all expected keys.
    expect(def.dependencies_json).toEqual({
      agents: [],
      skills: [],
      mcpServers: [],
      subWorkflows: [],
    });

    expect(def.tags).toEqual([]);
    expect(def.marketplace_metadata).toEqual({});
    expect(def.is_system).toBe(false);
    expect(def.created_by).toBeTruthy();
  });

  it('applies description and createdBy overrides', () => {
    const def = buildNewWorkflowDefinition({
      id: 'wf',
      name: 'WF',
      description: 'does things',
      createdBy: 'Rebecca',
    });
    expect(def.description).toBe('does things');
    expect(def.created_by).toBe('Rebecca');
  });

  it('defaults description to an empty string when omitted', () => {
    const def = buildNewWorkflowDefinition({ id: 'wf', name: 'WF' });
    expect(def.description).toBe('');
  });

  it('produces a graph the canvas add-first-node path can extend', () => {
    // Mirrors the MCP add_node guard: graphJson.nodes.push(newNode) must be safe.
    const def = buildNewWorkflowDefinition({ id: 'wf', name: 'WF' });
    const graph = def.graph_json as { nodes: any[]; edges: any[] };
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(() => graph.nodes.push({ id: '1' })).not.toThrow();
  });
});
