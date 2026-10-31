/**
 * Names of workflow runs that a restart/update would interrupt (bead mea-3ow).
 * Any failure (workflow plugin not installed, server unreachable) resolves to
 * [] so the pluginless baseline keeps its current one-click behaviour.
 *
 * mea-b5e: runs parked at an approval gate / paused have no process and resume
 * from persisted state, so they are reported separately (`parked`) and do not
 * count as "will be interrupted".
 */
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'canceled', 'error']);
const PARKED = /^(paused|waiting|awaiting|pending_approval|approval)/;

export interface ActiveRunSummary {
  /** Executing a node now - a restart interrupts these. */
  running: string[];
  /** Parked at an approval gate / paused - safe to restart, resumes from state. */
  parked: string[];
}

const runName = (r: any): string =>
  String(r.workflow_name ?? r.workflowName ?? r.workflow_id ?? r.id ?? 'unnamed workflow');

export async function getActiveRunSummary(list: () => Promise<any[]>): Promise<ActiveRunSummary> {
  const summary: ActiveRunSummary = { running: [], parked: [] };
  try {
    const runs = await list();
    for (const r of Array.isArray(runs) ? runs : []) {
      const status = String(r?.status ?? '').toLowerCase();
      if (TERMINAL.has(status)) continue;
      (PARKED.test(status) ? summary.parked : summary.running).push(runName(r));
    }
  } catch {
    // pluginless / unreachable: empty summary
  }
  return summary;
}

/** Names of every non-terminal run (running + parked). */
export async function getActiveRunNames(list: () => Promise<any[]>): Promise<string[]> {
  const s = await getActiveRunSummary(list);
  return [...s.running, ...s.parked];
}
