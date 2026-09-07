import * as path from 'path';
import { remapWorktreeSourcePath } from '../worktree-path';

describe('remapWorktreeSourcePath', () => {
  it('maps a dispatch worktree path to the canonical repo checkout', () => {
    const input = path.join('C:', 'github', 'FictionLab-Downloads-worktrees', 'fld-6qs', 'workflows', 'book-formatting');
    const expected = path.join('C:', 'github', 'FictionLab-Downloads', 'workflows', 'book-formatting');

    expect(remapWorktreeSourcePath(input)).toBe(expected);
  });

  it('maps a worktree path pointing at the repo root itself (no trailing subpath)', () => {
    const input = path.join('C:', 'github', 'Foo-worktrees', 'some-branch');
    const expected = path.join('C:', 'github', 'Foo');
    expect(remapWorktreeSourcePath(input)).toBe(expected);
  });

  it('returns null for a path that is not inside a -worktrees directory', () => {
    const input = path.join('C:', 'github', 'FictionLab-Downloads', 'workflows', 'book-formatting');
    expect(remapWorktreeSourcePath(input)).toBeNull();
  });

  it('returns null for a "-worktrees" directory with nothing after it', () => {
    const input = path.join('C:', 'github', 'Foo-worktrees');
    expect(remapWorktreeSourcePath(input)).toBeNull();
  });

  it('is case-insensitive on the "-worktrees" suffix', () => {
    const input = path.join('C:', 'github', 'Foo-Worktrees', 'branch', 'workflows', 'x');
    const expected = path.join('C:', 'github', 'Foo', 'workflows', 'x');
    expect(remapWorktreeSourcePath(input)).toBe(expected);
  });
});
