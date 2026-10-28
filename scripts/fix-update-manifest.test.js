'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { fixManifests } = require('./fix-update-manifest');

describe('fixManifests', () => {
  it('rewrites a stale sha512/size to match the file on disk and leaves correct ones alone', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fum-'));
    fs.writeFileSync(path.join(dir, 'a.dmg'), 'real-bytes');
    fs.writeFileSync(path.join(dir, 'b.dmg'), 'other');
    const sha = (s) => crypto.createHash('sha512').update(s).digest('base64');
    fs.writeFileSync(path.join(dir, 'latest-mac.yml'), [
      'version: 1.0.0',
      'files:',
      '  - url: a.dmg',
      '    sha512: STALE',
      '    size: 1',
      '  - url: b.dmg',
      `    sha512: ${sha('other')}`,
      '    size: 5',
      'path: a.dmg',
      'sha512: STALE',
      'releaseDate: x',
    ].join('\n'));
    const changed = fixManifests(dir);
    expect(changed).toEqual(['latest-mac.yml: a.dmg sha512', 'latest-mac.yml: a.dmg size', 'latest-mac.yml: a.dmg sha512']);
    const out = fs.readFileSync(path.join(dir, 'latest-mac.yml'), 'utf8');
    expect(out).toContain(`sha512: ${sha('real-bytes')}`);
    expect(out).toContain('size: 10');
    expect(out).not.toContain('STALE');
    expect(fixManifests(dir)).toEqual([]);
  });
});
