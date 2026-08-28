#!/usr/bin/env node
'use strict';

// CI: auto-cut the app release when a package.json version bump lands on
// develop and no matching release tag exists yet (mea-36t). Mirrors the
// proven pattern from fictionlab-workflow's flw-ma0
// (.github/workflows/build-plugin.yml job auto-tag-releases +
// scripts/auto-tag-releases.js): decide in a pure function, keep every side
// effect (git tag/push, gh workflow run) behind an injectable execFile so
// the decision logic is unit-testable without touching git or gh.
//
// This repo has exactly one package.json (unlike fictionlab-workflow's
// multi-plugin monorepo), so there is no drift-detection module to reuse --
// the whole decide/act pair lives here.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');

// Matches the exact `vX.Y.Z[-prerelease][+build]` shape release.yml expects
// (its workflow_dispatch `version` input and its `prerelease:` alpha/beta/rc
// check both key off this). A version that doesn't match this is an
// authoring error in package.json, not a missing-release gap -- this script
// never tags around one.
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readVersion(pkgPath = path.join(REPO_ROOT, 'package.json')) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

/**
 * Pure decision step: given the package.json version and whether its tag
 * already exists on the remote, decide what to do. No I/O -- fully
 * unit-testable.
 *
 * - malformed/missing version -> fail loudly (never tag around it)
 * - tag already exists         -> skip (this is the idempotency proof:
 *                                 merging this PR with no version bump must
 *                                 log "v0.5.1 already released" and exit 0)
 * - tag does not exist yet     -> tag
 */
function decide({ version, tagExists }) {
  if (typeof version !== 'string' || !SEMVER_RE.test(version)) {
    return { action: 'fail', reason: `malformed package.json version: ${JSON.stringify(version)}` };
  }

  const tag = computeTag(version);

  if (tagExists) {
    return { action: 'skip', tag, reason: `${tag} already released` };
  }

  return { action: 'tag', tag };
}

function computeTag(version) {
  return `v${version}`;
}

function remoteTagExists(tag, { execFile = execFileSync } = {}) {
  const out = execFile('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], { encoding: 'utf8' });
  return out.trim().length > 0;
}

function tagAndDispatch({ tag, sha, execFile = execFileSync } = {}) {
  console.log(`Tagging ${sha} -> ${tag}`);
  execFile('git', ['tag', tag, sha], { stdio: 'inherit' });

  console.log(`Pushing ${tag}`);
  execFile('git', ['push', 'origin', tag], { stdio: 'inherit' });

  // A tag pushed with GITHUB_TOKEN does NOT fire release.yml's
  // `push: tags:` trigger -- GitHub's Actions recursion guard skips new
  // event-based runs for anything the GITHUB_TOKEN itself did. An explicit
  // workflow_dispatch call (this one) IS delivered even from GITHUB_TOKEN.
  // Dispatching with --ref pointing at the tag we just pushed means every
  // build job in release.yml checks out the tagged commit, and
  // softprops/action-gh-release's default tag_name (github.ref_name)
  // resolves to this exact tag too.
  console.log(`Dispatching release.yml for ${tag}`);
  execFile('gh', ['workflow', 'run', 'release.yml', '--ref', tag, '-f', `version=${tag}`], { stdio: 'inherit' });
}

function main() {
  const version = readVersion();
  const preflight = decide({ version, tagExists: false });

  if (preflight.action === 'fail') {
    console.error(preflight.reason);
    process.exitCode = 1;
    return;
  }

  const tag = preflight.tag;
  const tagExists = remoteTagExists(tag);
  const decision = decide({ version, tagExists });

  if (decision.action === 'skip') {
    console.log(decision.reason);
    return;
  }

  const sha = process.env.GITHUB_SHA;
  if (!sha) {
    console.error('GITHUB_SHA is not set; refusing to tag without a resolved commit.');
    process.exitCode = 1;
    return;
  }

  tagAndDispatch({ tag: decision.tag, sha });
}

if (require.main === module) {
  main();
}

module.exports = {
  readVersion,
  computeTag,
  decide,
  remoteTagExists,
  tagAndDispatch,
  main,
};
