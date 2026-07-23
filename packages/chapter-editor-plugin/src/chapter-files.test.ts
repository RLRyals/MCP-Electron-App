import {
  getCommentsSidecarPath,
  isChapterMarkdownFile,
  parseComments,
  serializeComments,
  ChapterComment,
} from './chapter-files';

describe('getCommentsSidecarPath', () => {
  it('appends .comments.json next to the chapter file', () => {
    expect(getCommentsSidecarPath('C:/book/chapter-01.md')).toBe('C:/book/chapter-01.md.comments.json');
  });
});

describe('isChapterMarkdownFile', () => {
  it('accepts .md and .markdown, case-insensitively', () => {
    expect(isChapterMarkdownFile('chapter-01.md')).toBe(true);
    expect(isChapterMarkdownFile('chapter-01.MD')).toBe(true);
    expect(isChapterMarkdownFile('chapter-01.markdown')).toBe(true);
  });

  it('rejects non-markdown files', () => {
    expect(isChapterMarkdownFile('chapter-01.txt')).toBe(false);
    expect(isChapterMarkdownFile('chapter-01.md.comments.json')).toBe(false);
    expect(isChapterMarkdownFile('notes')).toBe(false);
  });
});

describe('parseComments / serializeComments', () => {
  const comments: ChapterComment[] = [
    { id: 'a1', anchorText: 'the door creaked', commentText: 'too on-the-nose', createdAt: '2026-07-22T00:00:00.000Z' },
  ];

  it('round-trips through serialize/parse', () => {
    expect(parseComments(serializeComments(comments))).toEqual(comments);
  });

  it('rejects a non-array payload', () => {
    expect(() => parseComments(JSON.stringify({ not: 'an array' }))).toThrow(
      'Comments sidecar must be a JSON array'
    );
  });
});
