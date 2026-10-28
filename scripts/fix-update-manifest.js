#!/usr/bin/env node
'use strict';
// mea-1ga: rewrite sha512/size in electron-updater manifests (latest*.yml) from
// the installer bytes actually on disk. electron-builder computes these for the
// dmg/deb before the file is finalized, so the manifest drifted from the
// uploaded bytes (v0.9.2-v0.11.3 'Verify published asset integrity' failures).
// Usage: node fix-update-manifest.js <dir> [manifest ...]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const unquote = (v) => v.replace(/^["']|["']$/g, '');

function fixManifestText(text, dir) {
  const lines = text.split(/\r?\n/);
  const entryRe = /^(\s*(?:-\s+)?)(url|path):\s*(.+?)\s*$/;
  let file = null;
  const changed = [];
  const out = lines.map((l) => {
    const em = l.match(entryRe);
    if (em) {
      const name = unquote(em[3]);
      file = fs.existsSync(path.join(dir, name)) ? path.join(dir, name) : null;
      return l;
    }
    const fm = l.match(/^(\s*)(sha512|size):\s*(.+?)\s*$/);
    if (!fm || !file) return l;
    const actual = fm[2] === 'size'
      ? String(fs.statSync(file).size)
      : crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64');
    if (unquote(fm[3]) !== actual) changed.push(path.basename(file) + ' ' + fm[2]);
    return fm[1] + fm[2] + ': ' + actual;
  });
  return { text: out.join('\n'), changed };
}

function fixManifests(dir, names) {
  const manifests = names && names.length
    ? names
    : fs.readdirSync(dir).filter((f) => /^latest.*\.yml$/.test(f));
  const all = [];
  for (const m of manifests) {
    const p = path.join(dir, m);
    const { text, changed } = fixManifestText(fs.readFileSync(p, 'utf8'), dir);
    if (changed.length) fs.writeFileSync(p, text);
    changed.forEach((c) => all.push(m + ': ' + c));
  }
  return all;
}

module.exports = { fixManifestText, fixManifests };

if (require.main === module) {
  const [dir, ...names] = process.argv.slice(2);
  if (!dir) { console.error('usage: fix-update-manifest.js <dir> [manifest ...]'); process.exit(2); }
  const changed = fixManifests(dir, names);
  console.log(changed.length ? 'corrected:\n  ' + changed.join('\n  ') : 'manifests already match file bytes');
}
