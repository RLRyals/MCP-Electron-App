/**
 * Renderer CSP tests (issue #225 / bead mea-1783883500211-1-dda839c4).
 *
 * The renderer CSP had no img-src directive, so it fell back to
 * default-src 'self' — which blocks every practical way of rendering a
 * locally-stored plugin image (data:, blob:, file:). This locks down the
 * fix: img-src is added scoped to 'self' plus the fictionlab-media: custom
 * protocol, default-src is untouched, and no remote origin is permitted.
 */

import * as fs from 'fs';
import * as path from 'path';

function readCspContent(): string {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
  const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  if (!match) {
    throw new Error('Could not find Content-Security-Policy meta tag in index.html');
  }
  return match[1];
}

describe('index.html Content-Security-Policy', () => {
  const csp = readCspContent();
  const directives = Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      })
  );

  it('has an img-src directive', () => {
    expect(directives['img-src']).toBeDefined();
  });

  it("img-src allows 'self'", () => {
    expect(directives['img-src']).toContain("'self'");
  });

  it('img-src allows the fictionlab-media: custom protocol', () => {
    expect(directives['img-src']).toContain('fictionlab-media:');
  });

  it('img-src permits no remote origin (http:, https:, or *)', () => {
    for (const value of directives['img-src']) {
      expect(value).not.toBe('http:');
      expect(value).not.toBe('https:');
      expect(value).not.toBe('*');
    }
  });

  it('leaves default-src unchanged (self only)', () => {
    expect(directives['default-src']).toEqual(["'self'"]);
  });
});
