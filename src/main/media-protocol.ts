/**
 * Privileged `fictionlab-media://` protocol for plugin-owned local images.
 *
 * The renderer CSP (`src/renderer/index.html`) has no `img-src` directive by
 * default, which falls back to `default-src 'self'` — that blocks every
 * practical way of rendering a locally-stored image (`data:`, `blob:`,
 * `file:` are all disallowed). Rather than widen `default-src` or allow
 * `data:`/`blob:` globally, we register a narrowly-scoped custom protocol
 * that streams files from a single directory under `userData` (no
 * base64-in-memory bloat, cacheable, and easy to guard against path
 * traversal).
 *
 * Usage:
 *  - `registerMediaProtocolAsPrivileged()` MUST be called at module load
 *    time, before `app.whenReady()` resolves (Electron requirement for
 *    `protocol.registerSchemesAsPrivileged`).
 *  - `registerMediaProtocolHandler()` should be called once inside the
 *    `app.whenReady()` callback, before the main window is created.
 */

import { app, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { pathToFileURL } from 'url';
import { logWithCategory, LogCategory } from './logger';

/** Custom scheme reserved for plugin-owned local media. */
export const MEDIA_PROTOCOL_SCHEME = 'fictionlab-media';

/**
 * Registers the scheme as privileged (standard + secure + fetch-capable).
 * Must run before `app` is ready — call this at module top-level / before
 * `app.whenReady()` is invoked, never inside the `whenReady` callback.
 */
export function registerMediaProtocolAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: false,
        bypassCSP: false,
      },
    },
  ]);
}

/** `<userData>/media` — the only directory this protocol will ever serve from. */
export function getMediaRoot(): string {
  return path.join(app.getPath('userData'), 'media');
}

/**
 * Resolves a `fictionlab-media://` request URL to an absolute path inside
 * `mediaRoot`, or `null` if the URL is malformed or would resolve outside
 * of `mediaRoot` (path traversal, e.g. `../../etc/passwd` or its
 * URL-encoded equivalents).
 *
 * Pure/pathname-only — does not touch the filesystem — so it's cheap to
 * unit test independent of Electron.
 */
export function resolveMediaPath(requestUrl: string, mediaRoot: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(requestUrl).pathname);
  } catch {
    return null;
  }

  const rootResolved = path.resolve(mediaRoot);
  const absResolved = path.resolve(path.join(rootResolved, pathname));
  const rootWithSep = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;

  if (absResolved !== rootResolved && !absResolved.startsWith(rootWithSep)) {
    // Escapes the media root — reject.
    return null;
  }

  return absResolved;
}

/**
 * Registers the request handler for the `fictionlab-media://` scheme.
 * Call once from `app.whenReady()`, before the main window is created.
 */
export function registerMediaProtocolHandler(mediaRoot: string = getMediaRoot()): void {
  fs.ensureDirSync(mediaRoot);

  protocol.handle(MEDIA_PROTOCOL_SCHEME, (request) => {
    const absPath = resolveMediaPath(request.url, mediaRoot);

    if (!absPath) {
      logWithCategory('warn', LogCategory.GENERAL, 'Rejected fictionlab-media request outside media root', {
        url: request.url,
      });
      return new Response(null, { status: 403 });
    }

    return net.fetch(pathToFileURL(absPath).toString());
  });
}
