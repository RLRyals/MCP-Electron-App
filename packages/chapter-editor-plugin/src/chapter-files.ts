import * as path from 'path';

/**
 * Comment persistence shape. Comment marks live only in the live Tiptap
 * document (a `commentId` mark on the highlighted range) -- they are
 * intentionally never serialized into the chapter's markdown, so the
 * chapter-writer-7step / chapter-drafter skill pipeline keeps reading plain
 * prose underneath this view, unchanged. Comment text instead round-trips
 * through a sidecar `<chapter>.comments.json` file next to the markdown.
 *
 * `anchorText` is the exact highlighted substring at comment-creation time,
 * used to best-effort re-anchor the comment mark after a fresh markdown
 * parse on load (position offsets don't survive a markdown round-trip, but
 * the substring usually still does). If the text no longer appears in the
 * document (edited away), the comment is still returned so the UI can show
 * it as unanchored rather than silently dropping it.
 */
export interface ChapterComment {
  id: string;
  anchorText: string;
  commentText: string;
  createdAt: string;
}

/** Sidecar path for a chapter's comments, kept next to the chapter file. */
export function getCommentsSidecarPath(chapterFilePath: string): string {
  return `${chapterFilePath}.comments.json`;
}

/** Only .md/.markdown files are valid chapter targets for this editor. */
export function isChapterMarkdownFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.md' || ext === '.markdown';
}

export function parseComments(raw: string): ChapterComment[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Comments sidecar must be a JSON array');
  }
  return parsed;
}

export function serializeComments(comments: ChapterComment[]): string {
  return JSON.stringify(comments, null, 2);
}
