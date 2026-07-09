/**
 * Unit tests for the Kanban card-link parsing/rendering helpers (issue #198).
 */
import { isHttpUrl, parseGithubIssueRef, resolveLinkUrl, linkifyBody } from '../link-utils';

describe('isHttpUrl', () => {
  it.each([
    ['http://example.com', true],
    ['https://example.com/path?q=1', true],
    ['  https://example.com  ', true],
  ])('%s -> %s', (value, expected) => {
    expect(isHttpUrl(value)).toBe(expected);
  });

  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'owner/repo#123',
    'not a url',
    '',
    null,
    undefined,
  ])('rejects %p', (value) => {
    expect(isHttpUrl(value as any)).toBe(false);
  });
});

describe('parseGithubIssueRef', () => {
  it('parses the owner/repo#123 shorthand into a canonical issues URL', () => {
    expect(parseGithubIssueRef('RLRyals/MCP-Electron-App#198')).toBe(
      'https://github.com/RLRyals/MCP-Electron-App/issues/198'
    );
  });

  it('parses a full GitHub issue URL', () => {
    expect(parseGithubIssueRef('https://github.com/RLRyals/MCP-Electron-App/issues/198')).toBe(
      'https://github.com/RLRyals/MCP-Electron-App/issues/198'
    );
  });

  it('parses a full GitHub PR URL onto the canonical /issues/ path (GitHub redirects issues<->pulls)', () => {
    expect(parseGithubIssueRef('https://github.com/RLRyals/MCP-Electron-App/pull/190')).toBe(
      'https://github.com/RLRyals/MCP-Electron-App/issues/190'
    );
  });

  it('parses a full GitHub URL with a trailing fragment/query', () => {
    expect(parseGithubIssueRef('https://github.com/RLRyals/MCP-Electron-App/issues/198#issuecomment-1')).toBe(
      'https://github.com/RLRyals/MCP-Electron-App/issues/198'
    );
  });

  it('returns null for values that are neither shorthand nor a GitHub issue/PR URL', () => {
    expect(parseGithubIssueRef('just some text')).toBeNull();
    expect(parseGithubIssueRef('https://example.com/not-github')).toBeNull();
    expect(parseGithubIssueRef('https://github.com/RLRyals/MCP-Electron-App')).toBeNull();
    expect(parseGithubIssueRef('')).toBeNull();
    expect(parseGithubIssueRef(null)).toBeNull();
    expect(parseGithubIssueRef(undefined)).toBeNull();
  });
});

describe('resolveLinkUrl', () => {
  it('resolves url-type refs that are http(s)', () => {
    expect(resolveLinkUrl('url', 'https://example.com')).toBe('https://example.com');
  });

  it('does not resolve url-type refs that are not http(s)', () => {
    expect(resolveLinkUrl('url', 'not-a-url')).toBeNull();
  });

  it('resolves spec-type refs only when the ref itself is a URL', () => {
    expect(resolveLinkUrl('spec', 'https://example.com/spec.md')).toBe('https://example.com/spec.md');
    expect(resolveLinkUrl('spec', 'outputs/book_1/spec.md')).toBeNull();
  });

  it('resolves github_issue-type refs via parseGithubIssueRef (shorthand and full URL)', () => {
    expect(resolveLinkUrl('github_issue', 'RLRyals/MCP-Electron-App#198')).toBe(
      'https://github.com/RLRyals/MCP-Electron-App/issues/198'
    );
    expect(resolveLinkUrl('github_issue', 'https://github.com/RLRyals/MCP-Electron-App/issues/198')).toBe(
      'https://github.com/RLRyals/MCP-Electron-App/issues/198'
    );
    expect(resolveLinkUrl('github_issue', 'not parseable')).toBeNull();
  });

  it('never resolves card or file refs (handled separately by the caller)', () => {
    expect(resolveLinkUrl('card', 'https://example.com')).toBeNull();
    expect(resolveLinkUrl('file', 'https://example.com')).toBeNull();
  });

  it('returns null for a null/empty ref', () => {
    expect(resolveLinkUrl('url', null)).toBeNull();
    expect(resolveLinkUrl('url', '')).toBeNull();
  });
});

describe('linkifyBody', () => {
  it('returns [] for empty/null/undefined text', () => {
    expect(linkifyBody('')).toEqual([]);
    expect(linkifyBody(null)).toEqual([]);
    expect(linkifyBody(undefined)).toEqual([]);
  });

  it('returns a single text segment when there are no URLs', () => {
    expect(linkifyBody('just plain text, no links here')).toEqual([
      { type: 'text', value: 'just plain text, no links here' },
    ]);
  });

  it('splits out a single bare URL', () => {
    expect(linkifyBody('see https://example.com/foo for details')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://example.com/foo' },
      { type: 'text', value: ' for details' },
    ]);
  });

  it('trims trailing sentence punctuation off the URL', () => {
    expect(linkifyBody('see https://example.com/foo.')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://example.com/foo' },
      { type: 'text', value: '.' },
    ]);
  });

  it('handles multiple URLs in the same body', () => {
    const result = linkifyBody('PR https://github.com/o/r/pull/1 fixes https://github.com/o/r/issues/2');
    expect(result.filter((s) => s.type === 'url').map((s) => s.value)).toEqual([
      'https://github.com/o/r/pull/1',
      'https://github.com/o/r/issues/2',
    ]);
  });

  it('handles a URL that is the entire body (no surrounding text)', () => {
    expect(linkifyBody('https://example.com')).toEqual([{ type: 'url', value: 'https://example.com' }]);
  });
});
