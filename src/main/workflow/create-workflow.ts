/**
 * Create Workflow helpers
 *
 * Pure, dependency-free helpers for authoring a brand-new workflow in-app.
 * Kept separate from the IPC handler so the id-slugging, uniqueness, and
 * minimal-definition logic can be unit-tested without Electron/MCP.
 *
 * A newly-created workflow is persisted through the SAME upsert path the
 * folder importer uses (the `import_workflow_definition` MCP tool), so the
 * plugin's `workflow:list` / `workflow:get` (which read the same DB via the
 * workflow-manager MCP) pick up the row immediately.
 */

import type { DatabaseWorkflowDefinition } from '../../types/workflow';

/** Version stamped on every freshly-created workflow (bumped on export). */
export const DEFAULT_NEW_WORKFLOW_VERSION = '0.1.0';

/** Fallback slug when a name contains no slug-able characters. */
export const FALLBACK_WORKFLOW_SLUG = 'workflow';

/**
 * Convert a human workflow name into a `workflow_id`-safe slug.
 * - lowercased
 * - any run of non-alphanumeric characters becomes a single dash
 * - leading/trailing dashes trimmed
 * Falls back to {@link FALLBACK_WORKFLOW_SLUG} if nothing usable remains.
 */
export function slugifyWorkflowName(name: string): string {
  const slug = (name || '')
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')     // non-alphanumeric -> dash
    .replace(/-{2,}/g, '-')          // collapse repeats
    .replace(/^-+|-+$/g, '');        // trim edges
  return slug || FALLBACK_WORKFLOW_SLUG;
}

/**
 * Resolve a unique `workflow_id` given a base slug and the set of ids already
 * in the database. If the base is taken, appends `-2`, `-3`, ... until free.
 * This prevents the importer's `ON CONFLICT (workflow_id, version) DO UPDATE`
 * from silently overwriting an existing workflow.
 */
export function resolveUniqueWorkflowId(baseSlug: string, existingIds: Iterable<string>): string {
  const base = baseSlug || FALLBACK_WORKFLOW_SLUG;
  const taken = existingIds instanceof Set ? existingIds : new Set(existingIds);
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

/**
 * Build a minimal, valid workflow definition ready to hand to the importer's
 * upsert path. The graph is intentionally empty (`{ nodes: [], edges: [] }`):
 * the runner accepts an empty graph at persistence time and only rejects it at
 * execution ("Workflow has no nodes to execute"), so the canvas editor can add
 * the first node/edge before the workflow is ever run.
 */
export function buildNewWorkflowDefinition(params: {
  id: string;
  name: string;
  description?: string;
  version?: string;
  createdBy?: string;
}): DatabaseWorkflowDefinition {
  return {
    id: params.id,
    name: params.name,
    version: params.version || DEFAULT_NEW_WORKFLOW_VERSION,
    description: params.description || '',
    graph_json: { nodes: [], edges: [] },
    dependencies_json: {
      agents: [],
      skills: [],
      mcpServers: [],
      subWorkflows: [],
    },
    tags: [],
    marketplace_metadata: {},
    is_system: false,
    created_by: params.createdBy || 'FictionLab',
  };
}
