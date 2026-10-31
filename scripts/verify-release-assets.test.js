'use strict';

// mea-5wd: the verifier must not let the top-level sha512 (first file) overwrite
// the last files[] entry's sha512.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'verify-release-assets.js');
const sha = (s) => crypto.createHash('sha512').update(s).digest('base64');

function run(files, manifestFiles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vra-'));
  for (const [n, b] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), b);
  const yml = (entries, first) => [
    'version: 1.0.0',
    'files:',
    ...entries.flatMap(([u, b]) => [`  - url: ${u}`, `    sha512: ${sha(b)}`, `    size: ${b.length}`]),
    `path: ${first[0]}`,
    `sha512: ${sha(first[1])}`,
    'releaseDate: x',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'latest.yml'), yml(manifestFiles, manifestFiles[0]));
  fs.writeFileSync(path.join(dir, 'latest-mac.yml'), yml(manifestFiles, manifestFiles[0]));
  fs.writeFileSync(path.join(dir, 'latest-linux.yml'), yml(manifestFiles, manifestFiles[0]));
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' });
  return { status: r.status, out: r.stdout };
}

describe('verify-release-assets', () => {
  const files = { 'a.dmg': 'first-bytes', 'b.deb': 'second-bytes-longer' };
  const entries = [['a.dmg', 'first-bytes'], ['b.deb', 'second-bytes-longer']];

  it('passes a two-file manifest with correct bytes (top-level sha512 differs from last entry)', () => {
    const r = run(files, entries);
    expect(r.out).not.toMatch(/::error::/);
    expect(r.status).toBe(0);
  });

  it('fails when the last entry bytes are wrong', () => {
    const r = run({ ...files, 'b.deb': 'tampered-second-bytes' }, entries);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/mismatch b\.deb/);
  });

  it('fails when the first (top-level path) file bytes are wrong', () => {
    const r = run({ ...files, 'a.dmg': 'tampered' }, entries);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/mismatch a\.dmg/);
  });
});
