/**
 * Kanban card link parsing/rendering helpers (issue #198).
 *
 * Pure functions only -- no Electron/DOM access -- so they're unit
 * testable directly and shared between CardDrawer's Links section, the
 * `issue_ref` "open" affordance, and body linkify.
 *
 * These decide only whether/how something is RENDERED as clickable in the
 * renderer. The main process (`src/main/handlers/link-handlers.ts`) is the
 * authoritative gate that actually enforces http(s)-only before calling
 * `shell.openExternal` -- nothing here is a security boundary by itself.
 */

const HTTP_URL_RE = /^https?:\/\//i;

/** True when `value` parses as an http(s) URL. Never true for file://, javascript:, bare paths, etc. */
export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!HTTP_URL_RE.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// `owner/repo#123` -- GitHub-style shorthand for an issue or PR number.
// GitHub itself resolves /issues/N to the PR page when N is actually a PR,
// so constructing a single canonical /issues/ URL works for both.
const SHORTHAND_RE = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)$/;

// A full GitHub issue or PR URL, capturing owner/repo/number.
const GITHUB_URL_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)(?:[/?#].*)?$/i;

/**
 * Resolve a `github_issue`-type ref (or an `issue_ref` field value) to an
 * openable https://github.com/... URL. Accepts either the `owner/repo#123`
 * shorthand or a full GitHub issue/PR URL. Returns null when the value is
 * neither -- callers should render plain text / hide the open affordance.
 */
export function parseGithubIssueRef(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const shorthand = trimmed.match(SHORTHAND_RE);
  if (shorthand) {
    const [, owner, repo, number] = shorthand;
    return `https://github.com/${owner}/${repo}/issues/${number}`;
  }

  const fullUrl = trimmed.match(GITHUB_URL_RE);
  if (fullUrl) {
    const [, owner, repo, number] = fullUrl;
    return `https://github.com/${owner}/${repo}/issues/${number}`;
  }

  return null;
}

/**
 * Resolve a card-link ref to an openable http(s) URL given its `link_type`,
 * or null when it isn't openable this way. `card` (navigates within the
 * drawer) and `file` (reveal-in-folder) are handled separately by the
 * caller -- they never go through this function.
 */
export function resolveLinkUrl(linkType: string, ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (linkType === 'github_issue') return parseGithubIssueRef(ref);
  if (linkType === 'url' || linkType === 'spec') {
    return isHttpUrl(ref) ? ref.trim() : null;
  }
  return null;
}

// Bare http(s) URL, stopping at whitespace or characters that are almost
// never part of a URL when it appears inline in prose (matching brackets,
// quotes).
const BARE_URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

export type BodySegment = { type: 'text'; value: string } | { type: 'url'; value: string };

/**
 * Split body text into alternating text/url segments so bare http(s) URLs
 * can be rendered as clickable links at display time (never mutates the
 * stored body -- issue #198 plan step 3).
 */
export function linkifyBody(text: string | null | undefined): BodySegment[] {
  if (!text) return [];
  const segments: BodySegment[] = [];
  let lastIndex = 0;
  BARE_URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BARE_URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    // Trim common trailing sentence punctuation that's (almost) never part
    // of the URL itself, e.g. "see https://x.com/y." or "https://x.com/y,".
    let url = match[0];
    let trailing = '';
    while (url.length > 1 && /[.,;:!?]/.test(url[url.length - 1])) {
      trailing = url[url.length - 1] + trailing;
      url = url.slice(0, -1);
    }
    segments.push({ type: 'url', value: url });
    lastIndex = match.index + url.length;
    if (trailing) {
      segments.push({ type: 'text', value: trailing });
      lastIndex = match.index + match[0].length;
    }
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}
