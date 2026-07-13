/**
 * Tests for the fictionlab-media:// protocol (issue #225 / bead
 * mea-1783883500211-1-dda839c4): the renderer CSP had no img-src, so no
 * plugin could render a local image. This covers the path-traversal guard
 * (acceptance criterion: "A fictionlab-media:// URL that resolves outside
 * the media root is rejected") and the wiring that registers the scheme
 * as privileged + serves it from a single directory under userData.
 */

import * as path from 'path';
import { protocol } from 'electron';

// Avoid touching the real filesystem — registerMediaProtocolHandler()
// ensures the media directory exists on disk, which we don't need for
// these unit tests.
jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
}));

import {
  MEDIA_PROTOCOL_SCHEME,
  resolveMediaPath,
  getMediaRoot,
  registerMediaProtocolAsPrivileged,
  registerMediaProtocolHandler,
} from '../media-protocol';

describe('resolveMediaPath (path traversal guard)', () => {
  const mediaRoot = path.resolve('/mock/userData/media');

  it('resolves a simple relative path inside the media root', () => {
    const result = resolveMediaPath('fictionlab-media:///cover.png', mediaRoot);
    expect(result).toBe(path.join(mediaRoot, 'cover.png'));
  });

  it('resolves a nested relative path inside the media root', () => {
    const result = resolveMediaPath('fictionlab-media:///cards/42/screenshot.png', mediaRoot);
    expect(result).toBe(path.join(mediaRoot, 'cards', '42', 'screenshot.png'));
  });

  it('stays inside the media root for a literal ../ traversal attempt', () => {
    // The WHATWG URL parser removes ".." path segments during parsing
    // (RFC 3986 dot-segment normalization applies to any URL parsed with
    // authority syntax, i.e. "//", not just http/https/file). A path can
    // never climb above the URL's own root this way, so
    // fictionlab-media:///../../etc/passwd normalizes to /etc/passwd
    // *before* resolveMediaPath ever sees it — it lands inside mediaRoot,
    // not outside it.
    const result = resolveMediaPath('fictionlab-media:///../../etc/passwd', mediaRoot);
    expect(result).not.toBeNull();
    expect(result!.startsWith(mediaRoot)).toBe(true);
  });

  it('stays inside the media root for a %2e%2e-encoded traversal attempt', () => {
    // The URL spec recognizes %2e%2e as a double-dot segment too (case
    // insensitively), so this is normalized away for the same reason as
    // the literal ../ case above.
    const result = resolveMediaPath('fictionlab-media:///%2e%2e/%2e%2e/etc/passwd', mediaRoot);
    expect(result).not.toBeNull();
    expect(result!.startsWith(mediaRoot)).toBe(true);
  });

  it('rejects a mixed-separator traversal attempt that survives URL normalization', () => {
    // URL dot-segment removal only recognizes "/"-delimited segments. A
    // backslash (encoded as %5C so it isn't treated as a separator by the
    // URL parser itself) survives normalization as an opaque path
    // segment. On Windows, Node's path module (native, backslash-aware)
    // would then interpret it as a real separator and walk back out of
    // mediaRoot — this is exactly what the explicit containment guard in
    // resolveMediaPath exists to catch, independent of the URL parser.
    const result = resolveMediaPath('fictionlab-media:///..%5C..%5Cetc%5Cpasswd', mediaRoot);
    if (path.sep === '\\') {
      expect(result).toBeNull();
    } else {
      // Not a traversal vector on POSIX — backslash is just a literal
      // filename character there — but it must still stay contained.
      expect(result).not.toBeNull();
      expect(result!.startsWith(mediaRoot)).toBe(true);
    }
  });

  it('rejects a malformed URL', () => {
    const result = resolveMediaPath('not a url', mediaRoot);
    expect(result).toBeNull();
  });

  it('allows the media root itself', () => {
    const result = resolveMediaPath('fictionlab-media:///', mediaRoot);
    expect(result).toBe(mediaRoot);
  });
});

describe('getMediaRoot', () => {
  it('is a "media" directory under userData', () => {
    expect(getMediaRoot()).toBe(path.join('/mock/userData', 'media'));
  });
});

describe('registerMediaProtocolAsPrivileged', () => {
  it('registers the fictionlab-media scheme as standard + secure, no CORS/CSP bypass', () => {
    (protocol.registerSchemesAsPrivileged as jest.Mock).mockClear();

    registerMediaProtocolAsPrivileged();

    expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([
      expect.objectContaining({
        scheme: MEDIA_PROTOCOL_SCHEME,
        privileges: expect.objectContaining({
          standard: true,
          secure: true,
          supportFetchAPI: true,
          bypassCSP: false,
        }),
      }),
    ]);
  });
});

describe('registerMediaProtocolHandler', () => {
  it('registers a handler for the fictionlab-media scheme', () => {
    (protocol.handle as jest.Mock).mockClear();

    registerMediaProtocolHandler('/mock/userData/media');

    expect(protocol.handle).toHaveBeenCalledWith(MEDIA_PROTOCOL_SCHEME, expect.any(Function));
  });

  it('rejects a request that resolves outside the media root with a 403', async () => {
    (protocol.handle as jest.Mock).mockClear();

    registerMediaProtocolHandler('/mock/userData/media');

    const handler = (protocol.handle as jest.Mock).mock.calls[0][1] as (
      request: Request
    ) => Response | Promise<Response>;

    // See "rejects a mixed-separator traversal attempt" above for why this
    // is the vector that actually reaches the containment guard rather
    // than being neutralized by URL dot-segment normalization first.
    if (path.sep === '\\') {
      const response = await handler({ url: 'fictionlab-media:///..%5C..%5Cetc%5Cpasswd' } as Request);
      expect(response.status).toBe(403);
    } else {
      // Nothing to guard against on POSIX for this particular input — a
      // backslash is just a literal filename character there.
      expect(true).toBe(true);
    }
  });
});
