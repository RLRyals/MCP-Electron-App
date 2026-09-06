/**
 * Auto re-import staleness check (mea-ov6)
 *
 * DESIGN (Rebecca, 2026-09-05): the YAML workflow repo is source CONTROL,
 * the DB is source of TRUTH -- workflows run from the DB, and FictionLab owns
 * keeping the DB copy in sync with disk. This module compares the on-disk
 * workflow (found via workflow_imports.source_path, recorded per workflow_id
 * at import time) against the DB-served version, and re-imports through the
 * guarded import_workflow_definition path (mws-l3i: version snapshot +
 * overwrite guard) when disk is strictly newer.
 *
 * It NEVER passes force=true. If disk is the same-or-lower version, or the
 * guard refuses for any other reason, that refusal is surfaced as a result
 * rather than silently bypassed -- see workflow-handlers.ts's
 * broadcastReimportResult for how it reaches the renderer.
 */

import { PersistentMCPClient } from './persistent-mcp-client';
import { FolderImporter } from './folder-importer';
import { logWithCategory, LogCategory } from '../logger';

export type ReimportStatus = 'reimported' | 'up-to-date' | 'no-source' | 'refused' | 'error';

export interface ReimportCheckResult {
  workflowId: string;
  status: ReimportStatus;
  diskVersion?: string;
  dbVersion?: string;
  previousVersion?: string;
  message: string;
}

/**
 * Compares two dotted-numeric version strings (e.g. "1.2.0"). Returns -1, 0, or 1.
 * Mirrors the comparator in MCP-Writing-Servers' definition-handlers.js
 * (compareVersions) so "is disk newer" is decided identically on both sides --
 * workflow versions aren't guaranteed to be strict semver.
 */
function compareVersions(a: string, b: string): number {
  const partsA = String(a).split('.');
  const partsB = String(b).split('.');
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const na = Number(partsA[i] ?? 0);
    const nb = Number(partsB[i] ?? 0);

    if (Number.isNaN(na) || Number.isNaN(nb)) {
      if (a === b) return 0;
      return a > b ? 1 : -1;
    }
    if (na !== nb) return na > nb ? 1 : -1;
  }
  return 0;
}

/**
 * Check one workflow's disk vs. DB version, and re-import through the
 * guarded path if disk is newer. Never passes force=true.
 */
export async function checkAndReimportWorkflow(
  workflowId: string,
  client: PersistentMCPClient
): Promise<ReimportCheckResult> {
  try {
    const sourcePath = await client.getWorkflowImportSource(workflowId);
    if (!sourcePath) {
      return { workflowId, status: 'no-source', message: 'No recorded import source; nothing to compare.' };
    }

    const dbDefinition: any = await client.getWorkflowDefinition(workflowId);
    const dbVersion = dbDefinition?.version;
    if (!dbVersion) {
      return { workflowId, status: 'error', message: `Could not read current DB version for ${workflowId}.` };
    }

    const importer = new FolderImporter();
    const diskVersion = await importer.getFolderVersion(sourcePath);
    if (!diskVersion) {
      return {
        workflowId,
        status: 'error',
        dbVersion,
        message: `Could not read on-disk workflow at recorded source path: ${sourcePath}`,
      };
    }

    if (compareVersions(diskVersion, dbVersion) <= 0) {
      return {
        workflowId,
        status: 'up-to-date',
        diskVersion,
        dbVersion,
        message: `DB copy (v${dbVersion}) is already current with disk (v${diskVersion}).`,
      };
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Auto re-import: ${workflowId} disk v${diskVersion} is newer than DB v${dbVersion}, re-importing`);

    const result = await importer.importFromFolder(sourcePath);
    if (!result.success) {
      // The guard refused (e.g. a concurrent write landed a same/lower version
      // between our check and the import call, or disk content diverged in a
      // way the guard didn't like) -- surface it, never auto-force.
      return { workflowId, status: 'refused', diskVersion, dbVersion, message: result.message };
    }

    return {
      workflowId,
      status: 'reimported',
      diskVersion: result.version || diskVersion,
      dbVersion,
      previousVersion: dbVersion,
      message: `Imported ${workflowId} v${result.version || diskVersion} (previous v${dbVersion} snapshotted).`,
    };
  } catch (error: any) {
    logWithCategory('error', LogCategory.WORKFLOW,
      `Auto re-import check failed for ${workflowId}: ${error.message}`);
    return { workflowId, status: 'error', message: error.message };
  }
}

// Rapid focus events (e.g. alt-tabbing) shouldn't re-spawn an import-source
// lookup + file read + possible re-import for every workflow on every event.
const FOCUS_CHECK_COOLDOWN_MS = 60_000;
let lastFocusCheckAt = 0;

/**
 * Check every imported workflow for staleness. Used by the app-focus hook
 * and the manual "check for updates" IPC handler.
 * Skips workflows with no recorded import source (nothing to compare against)
 * and ones already up to date -- only returns actionable/notable results.
 */
export async function checkAndReimportAllWorkflows(
  client: PersistentMCPClient,
  opts: { force?: boolean } = {}
): Promise<ReimportCheckResult[]> {
  const now = Date.now();
  if (!opts.force && now - lastFocusCheckAt < FOCUS_CHECK_COOLDOWN_MS) {
    return [];
  }
  lastFocusCheckAt = now;

  const definitions = await client.getWorkflowDefinitions();
  const results: ReimportCheckResult[] = [];

  for (const def of definitions || []) {
    const workflowId = (def as any).workflow_id || (def as any).id;
    if (!workflowId) continue;

    const result = await checkAndReimportWorkflow(workflowId, client);
    if (result.status !== 'no-source' && result.status !== 'up-to-date') {
      results.push(result);
    }
  }

  return results;
}
