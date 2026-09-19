#!/usr/bin/env node
// mea-90i: verify published release assets against update manifests and
// checksums-*.txt. Run from a directory holding the downloaded release assets.
const fs = require('fs');
const crypto = require('crypto');

let fail = 0;
const err = (m) => { console.log('::error::' + m); fail = 1; };
const hash = (f, algo, enc) => crypto.createHash(algo).update(fs.readFileSync(f)).digest(enc);
const unquote = (v) => v.replace(/^["']|["']$/g, '');

for (const m of ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']) {
  if (!fs.existsSync(m)) { err(m + ' missing'); continue; }
  let cur = null;
  const check = (e) => {
    if (!e.url) return;
    if (!fs.existsSync(e.url)) { err(m + ': ' + e.url + ' not published'); return; }
    let ok = true;
    if (e.size && fs.statSync(e.url).size !== Number(e.size)) { err(m + ': size mismatch ' + e.url); ok = false; }
    if (e.sha512 && hash(e.url, 'sha512', 'base64') !== e.sha512) { err(m + ': sha512 mismatch ' + e.url); ok = false; }
    if (ok) console.log('ok: ' + m + ' -> ' + e.url);
  };
  for (const l of fs.readFileSync(m, 'utf8').split(/\r?\n/)) {
    const mm = l.match(/^\s*(-\s+)?(url|sha512|size):\s*(.+?)\s*$/);
    if (!mm) continue;
    if (mm[2] === 'url' && mm[1]) { if (cur) check(cur); cur = {}; }
    if (cur) cur[mm[2]] = unquote(mm[3]);
  }
  if (cur) check(cur);
}

for (const c of fs.readdirSync('.').filter((f) => /^checksums-.*\.txt$/.test(f))) {
  const text = fs.readFileSync(c, 'utf8').replace(/^\uFEFF/, '');
  for (const l of text.split(/\r?\n/).filter((x) => x.trim())) {
    const [h, ...rest] = l.trim().split(/\s+/);
    const f = rest.join(' ').replace(/^\*/, '');
    if (!fs.existsSync(f)) { err(c + ': ' + f + ' not published'); continue; }
    if (hash(f, 'sha256', 'hex') !== h) err(c + ': sha256 mismatch ' + f);
    else console.log('ok: ' + c + ' -> ' + f);
  }
}
process.exit(fail);
