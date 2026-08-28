'use strict';

const { computeTag, decide, remoteTagExists, tagAndDispatch } = require('./auto-tag-release');

describe('computeTag', () => {
  it('prefixes the package.json version with v', () => {
    expect(computeTag('0.5.1')).toBe('v0.5.1');
  });
});

describe('decide', () => {
  it('tags when the version is valid and no matching tag exists remotely', () => {
    expect(decide({ version: '0.6.0', tagExists: false })).toEqual({ action: 'tag', tag: 'v0.6.0' });
  });

  it('is idempotent: skips with the exact idempotency-proof message when the tag already exists', () => {
    // This is the mea-9zb no-bump-merge case: merging this PR itself (no
    // version bump) must log exactly this and exit 0.
    expect(decide({ version: '0.5.1', tagExists: true })).toEqual({
      action: 'skip',
      tag: 'v0.5.1',
      reason: 'v0.5.1 already released',
    });
  });

  it('fails loudly on a malformed version instead of tagging around it', () => {
    expect(decide({ version: 'not-a-version', tagExists: false })).toEqual({
      action: 'fail',
      reason: 'malformed package.json version: "not-a-version"',
    });
  });

  it('fails loudly when the version is missing entirely', () => {
    const result = decide({ version: undefined, tagExists: false });
    expect(result.action).toBe('fail');
    expect(result.reason).toMatch(/malformed package\.json version/);
  });

  it('accepts a pre-release version (semver prerelease/build metadata)', () => {
    expect(decide({ version: '1.2.3-beta.1', tagExists: false })).toEqual({
      action: 'tag',
      tag: 'v1.2.3-beta.1',
    });
  });
});

describe('remoteTagExists', () => {
  it('returns true when git ls-remote finds the tag', () => {
    const execFile = () => 'abc123\trefs/tags/v0.6.0\n';
    expect(remoteTagExists('v0.6.0', { execFile })).toBe(true);
  });

  it('returns false when git ls-remote finds nothing', () => {
    const execFile = () => '';
    expect(remoteTagExists('v0.6.0', { execFile })).toBe(false);
  });
});

describe('tagAndDispatch', () => {
  it('tags the resolved sha, pushes it, then dispatches release.yml via workflow_dispatch (not push)', () => {
    const calls = [];
    const execFile = (cmd, args) => calls.push([cmd, ...args]);

    tagAndDispatch({ tag: 'v0.6.0', sha: 'deadbeef', execFile });

    expect(calls).toEqual([
      ['git', 'tag', 'v0.6.0', 'deadbeef'],
      ['git', 'push', 'origin', 'v0.6.0'],
      ['gh', 'workflow', 'run', 'release.yml', '--ref', 'v0.6.0', '-f', 'version=v0.6.0'],
    ]);
  });
});
