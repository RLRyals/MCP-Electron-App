/**
 * Kanban card link handlers (issue #198).
 *
 * The Kanban card drawer's Links section, `issue_ref` field, and body
 * linkify all funnel through these two host-owned IPC channels rather than
 * calling Electron's `shell` module from the renderer directly -- the
 * renderer has no Node/Electron access (context isolation), so every
 * external-URL open or file reveal has to cross into the main process, and
 * this is the one narrow gate it crosses through.
 *
 * Security requirements (hard, per issue #198):
 *   - Only http/https URLs are ever allowed to reach `shell.openExternal`.
 *     Anything else (file:, javascript:, data:, a bare path, garbage) is
 *     rejected before Electron ever sees it.
 *   - `file`-type refs are NEVER opened/executed -- only revealed in the
 *     system file manager (`shell.showItemInFolder`), and only after
 *     confirming the path exists on disk, so a stale/garbage ref just
 *     fails cleanly instead of revealing an unrelated path or throwing a
 *     native dialog.
 *
 * Both exported functions take their side-effecting dependency as an
 * injectable parameter (default = the real `shell` method) so they can be
 * unit tested without spinning up Electron.
 */
import { shell, ipcMain } from 'electron';
import * as fs from 'fs';
import { logWithCategory, LogCategory } from '../logger';

export interface LinkHandlerResult {
  success: boolean;
}

/**
 * True when `value` parses as a well-formed http or https URL. Used both to
 * gate `app:open-external` here and (mirrored in the fictionlab-kanban
 * plugin's renderer bundle, `src/renderer/components/link-utils.ts` in
 * fictionlab-workflow) to decide whether a card
 * link is even rendered as clickable in the first place -- this is the
 * authoritative check since it runs in the process that actually calls
 * `shell.openExternal`.
 */
export function isAllowedExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/**
 * Open an http(s) URL in the system's default browser. Throws (rather than
 * silently no-op'ing) on anything that isn't a well-formed http/https URL,
 * so the renderer can surface the rejection instead of the click silently
 * doing nothing.
 */
export async function openExternalLink(
  url: unknown,
  opener: (url: string) => Promise<void> = shell.openExternal
): Promise<LinkHandlerResult> {
  if (!isAllowedExternalUrl(url)) {
    throw new Error(`Refusing to open non-http(s) URL: ${String(url)}`);
  }
  await opener(url.trim());
  return { success: true };
}

/**
 * Reveal a file in the system file manager, after confirming it exists.
 * Deliberately uses `shell.showItemInFolder` (reveal), never
 * `shell.openPath` (which would execute/open the file) -- `file`-type card
 * links must never execute arbitrary local paths from renderer input.
 */
export async function revealFileInFolder(
  filePath: unknown,
  exists: (p: string) => boolean = fs.existsSync,
  reveal: (p: string) => void = shell.showItemInFolder
): Promise<LinkHandlerResult> {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('File path must be a non-empty string');
  }
  const trimmed = filePath.trim();
  if (!exists(trimmed)) {
    throw new Error(`File does not exist: ${trimmed}`);
  }
  reveal(trimmed);
  return { success: true };
}

/**
 * Register the `app:open-external` and `app:reveal-in-folder` IPC handlers.
 * Host-owned (un-prefixed) channels -- called directly via the renderer's
 * generic `electronAPI.invoke`, same idiom as `app-settings:get-current-user`
 * (as the fictionlab-kanban plugin's board view does), not routed through
 * a plugin channel prefix.
 */
export function registerLinkHandlers(): void {
  ipcMain.handle('app:open-external', async (_event, url: unknown) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: app:open-external requested for ${String(url)}`);
    return openExternalLink(url);
  });

  ipcMain.handle('app:reveal-in-folder', async (_event, filePath: unknown) => {
    logWithCategory('info', LogCategory.SYSTEM, `IPC: app:reveal-in-folder requested for ${String(filePath)}`);
    return revealFileInFolder(filePath);
  });
}
