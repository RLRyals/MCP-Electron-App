/**
 * Dispatch-worktree source path remapping (mea-38o).
 *
 * Dispatched bead/PR work happens in an isolated git worktree named
 * `<repo>-worktrees\<branch-or-id>\...` (see e.g. the dev-work-tracking
 * dispatch convention), never in the repo's live checkout. When a workflow
 * gets imported from inside one of those worktrees, workflow_imports.source_path
 * records the worktree path - but the worktree is removed once its PR merges,
 * so that recorded path goes stale forever. The canonical, permanent location
 * for the same files is the repo's live checkout, sitting alongside the
 * `-worktrees` directory: `<repo>\...`.
 */

import * as path from 'path';

const WORKTREE_DIR_SUFFIX = /^(.*)-worktrees$/i;

/**
 * If sourcePath sits inside a `<repo>-worktrees\<branch>\...` dispatch
 * worktree, return the equivalent path in `<repo>`'s live checkout. Returns
 * null if sourcePath doesn't match that convention (nothing to remap).
 */
export function remapWorktreeSourcePath(sourcePath: string): string | null {
  const normalized = path.normalize(sourcePath);
  const segments = normalized.split(path.sep);

  const worktreesIndex = segments.findIndex(seg => WORKTREE_DIR_SUFFIX.test(seg));
  // Need a "-worktrees" segment AND at least one more segment after it (the
  // branch/bead-id directory) for there to be anything left to remap.
  if (worktreesIndex === -1 || worktreesIndex + 1 >= segments.length) {
    return null;
  }

  const repoName = segments[worktreesIndex].match(WORKTREE_DIR_SUFFIX)?.[1];
  if (!repoName) {
    return null;
  }

  const canonicalSegments = [
    ...segments.slice(0, worktreesIndex),
    repoName,
    // Skip both the "-worktrees" segment and the branch/bead-id segment.
    ...segments.slice(worktreesIndex + 2),
  ];

  return canonicalSegments.join(path.sep);
}
