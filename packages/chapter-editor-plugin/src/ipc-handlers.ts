import { PluginContext } from '../../../src/types/plugin-api';
import {
  ChapterComment,
  getCommentsSidecarPath,
  isChapterMarkdownFile,
  parseComments,
  serializeComments,
} from './chapter-files';

/**
 * Registers every `chapter-editor:*` IPC handler and returns the list of
 * (unprefixed) channel names, so the plugin can clean them up on
 * onDeactivate via context.ipc.removeHandler(channel) — same shape as
 * agent-factory-plugin's / kanban-plugin's ipc-handlers.ts.
 *
 * File picking itself uses the host's existing generic
 * `window.electronAPI.dialog.showOpenDialog` from the renderer (not
 * plugin-scoped) — these handlers only read/write whatever path the
 * renderer already resolved, gated by this plugin's own `fileSystem`
 * permission (plugin.json).
 */
export function registerIPCHandlers(context: PluginContext): string[] {
  const logger = context.logger;
  const fs = context.services.fileSystem;
  const registered: string[] = [];

  const handle = (channel: string, handler: (event: any, args?: any) => Promise<any>) => {
    context.ipc.handle(channel, handler);
    registered.push(channel);
  };

  handle('chapter-editor:read-chapter', async (_event, args): Promise<{ content: string }> => {
    if (!args?.filePath || !isChapterMarkdownFile(args.filePath)) {
      throw new Error('A .md/.markdown filePath is required');
    }
    const content = await fs.readFile(args.filePath);
    return { content };
  });

  handle('chapter-editor:write-chapter', async (_event, args): Promise<{ success: true }> => {
    if (!args?.filePath || !isChapterMarkdownFile(args.filePath)) {
      throw new Error('A .md/.markdown filePath is required');
    }
    if (typeof args.content !== 'string') {
      throw new Error('content is required');
    }
    await fs.writeFile(args.filePath, args.content);
    return { success: true };
  });

  // Comments fail soft: a missing/corrupt sidecar must never block opening
  // the chapter itself, since the markdown file is the source of truth the
  // AI pipeline depends on.
  handle('chapter-editor:read-comments', async (_event, args): Promise<ChapterComment[]> => {
    if (!args?.filePath) throw new Error('filePath is required');
    const sidecarPath = getCommentsSidecarPath(args.filePath);
    try {
      if (!(await fs.exists(sidecarPath))) return [];
      const raw = await fs.readFile(sidecarPath);
      return parseComments(raw);
    } catch (error: any) {
      logger.warn(`[chapter-editor:read-comments] failed to read ${sidecarPath}:`, error.message);
      return [];
    }
  });

  handle('chapter-editor:write-comments', async (_event, args): Promise<{ success: true }> => {
    if (!args?.filePath) throw new Error('filePath is required');
    if (!Array.isArray(args.comments)) throw new Error('comments must be an array');
    const sidecarPath = getCommentsSidecarPath(args.filePath);
    await fs.writeFile(sidecarPath, serializeComments(args.comments));
    return { success: true };
  });

  return registered;
}
