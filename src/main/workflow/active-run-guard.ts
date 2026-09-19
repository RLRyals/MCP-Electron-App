/**
 * Names of workflow runs that a restart/update would interrupt (bead mea-3ow).
 * Any failure (workflow plugin not installed, server unreachable) resolves to
 * [] so the pluginless baseline keeps its current one-click behaviour.
 */
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'canceled', 'error']);

export async function getActiveRunNames(list: () => Promise<any[]>): Promise<string[]> {
  try {
    const runs = await list();
    return (Array.isArray(runs) ? runs : [])
      .filter((r) => !TERMINAL.has(String(r?.status ?? '').toLowerCase()))
      .map((r) => String(r.workflow_name ?? r.workflowName ?? r.workflow_id ?? r.id ?? 'unnamed workflow'));
  } catch {
    return [];
  }
}
