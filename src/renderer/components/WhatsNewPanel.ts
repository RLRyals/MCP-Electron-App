/**
 * What's New Panel (bead mea-1j9)
 *
 * A plain-DOM modal (same pattern as SetupTab.ts's showUpdateDialog, reusing
 * the `.error-dialog` CSS classes) that renders release changelogs after an
 * update:
 *   - App updates: the GitHub release body, rendered as a safe subset of
 *     markdown (headings, lists, bold/italic/code, http(s) links).
 *   - Managed-repo updates (MCP-Writing-Servers): the commit subjects
 *     between the previous and new SHA, as a plain list.
 *
 * All content is HTML-escaped before any markup is generated -- release
 * bodies and commit messages are untrusted remote text.
 */

export interface WhatsNewContent {
  title: string;
  subtitle?: string;
  /** Release notes in GitHub-flavored markdown (rendered as a safe subset). */
  markdown?: string;
  /** Plain-text list items (e.g. commit subjects), used when no markdown. */
  items?: string[];
  /** Shown when there is neither markdown nor items. */
  emptyMessage?: string;
  /** Optional "View on GitHub" link (http(s) only, opened externally). */
  linkUrl?: string;
}

/**
 * Minimal HTML-escape for untrusted text.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render inline markdown (bold, italic, inline code, http(s) links) on an
 * ALREADY-ESCAPED line. Links become <a data-external-url="..."> so clicks
 * can be routed through the app:open-external channel instead of navigating.
 */
function renderInline(escapedLine: string): string {
  let out = escapedLine;

  // Inline code first so its contents are not further transformed.
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links: [text](https://...) -- http(s) only, matching the gate on the
  // app:open-external channel (issue #198).
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="#" data-external-url="$2">$1</a>'
  );

  // Bold, then italic.
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

  return out;
}

/**
 * Render a safe subset of markdown to HTML. Escapes everything first, then
 * builds block structure (headings, bullet lists, fenced code, paragraphs).
 * Intentionally small -- release notes, not a full markdown engine.
 */
export function renderMarkdownSafe(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let inList = false;
  let inCode = false;
  const codeLines: string[] = [];

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    if (rawLine.trim().startsWith('```')) {
      if (inCode) {
        html.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
        codeLines.length = 0;
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(escapeHtml(rawLine));
      continue;
    }

    const line = escapeHtml(rawLine);
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
    const bulletMatch = rawLine.match(/^\s*[-*]\s+(.*)$/);

    if (headingMatch) {
      closeList();
      const level = Math.min(headingMatch[1].length + 2, 6); // #->h3 (panel already has its own h3 title area context)
      html.push(`<h${level}>${renderInline(escapeHtml(headingMatch[2]))}</h${level}>`);
    } else if (bulletMatch) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${renderInline(escapeHtml(bulletMatch[1]))}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      html.push(`<p>${renderInline(line)}</p>`);
    }
  }

  if (inCode) {
    // Unterminated fence -- flush what we have.
    html.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
  }
  closeList();

  return html.join('\n');
}

/**
 * Show the What's New modal. Idempotent per call; removes itself on close.
 */
export function showWhatsNewPanel(content: WhatsNewContent, onDismiss?: () => void): void {
  // Never stack two panels (e.g. startup notes + a manual click).
  const existing = document.getElementById('whats-new-panel');
  if (existing && existing.parentElement) {
    existing.parentElement.removeChild(existing);
  }

  let bodyHtml: string;
  if (content.markdown && content.markdown.trim()) {
    bodyHtml = renderMarkdownSafe(content.markdown);
  } else if (content.items && content.items.length > 0) {
    bodyHtml = `<ul>${content.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  } else {
    bodyHtml = `<p>${escapeHtml(content.emptyMessage || 'No release notes available for this update.')}</p>`;
  }

  const subtitleHtml = content.subtitle
    ? `<p style="opacity: 0.8; margin-top: -8px;">${escapeHtml(content.subtitle)}</p>`
    : '';

  const linkButtonHtml = content.linkUrl && /^https?:\/\//.test(content.linkUrl)
    ? `<button id="whats-new-view-release" class="button">View on GitHub</button>`
    : '';

  const dialog = document.createElement('div');
  dialog.className = 'error-dialog'; // Reuse error dialog styles (same as showUpdateDialog)
  dialog.id = 'whats-new-panel';
  dialog.innerHTML = `
    <div class="error-dialog-backdrop"></div>
    <div class="error-dialog-content">
      <h3>${escapeHtml(content.title)}</h3>
      ${subtitleHtml}
      <div class="whats-new-body" style="max-height: 50vh; overflow-y: auto; text-align: left; margin: 12px 0;">
        ${bodyHtml}
      </div>
      <div class="error-dialog-buttons">
        ${linkButtonHtml}
        <button id="whats-new-close" class="button primary">Got it</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const close = () => {
    if (dialog.parentElement) {
      dialog.parentElement.removeChild(dialog);
    }
    onDismiss?.();
  };

  dialog.querySelector('#whats-new-close')?.addEventListener('click', close);
  dialog.querySelector('.error-dialog-backdrop')?.addEventListener('click', close);

  const viewButton = dialog.querySelector('#whats-new-view-release');
  if (viewButton && content.linkUrl) {
    viewButton.addEventListener('click', () => {
      void (window.electronAPI as any).invoke?.('app:open-external', content.linkUrl);
    });
  }

  // Route markdown links through the external-open gate instead of
  // navigating the app window.
  dialog.querySelectorAll('a[data-external-url]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      const url = (anchor as HTMLElement).getAttribute('data-external-url');
      if (url && /^https?:\/\//.test(url)) {
        void (window.electronAPI as any).invoke?.('app:open-external', url);
      }
    });
  });
}

/**
 * Startup hook: ask main whether a new version's notes should be shown, show
 * them once, and persist lastSeenVersion. Quiet on every failure path --
 * this must never block or break app startup.
 */
export async function checkStartupWhatsNew(): Promise<void> {
  try {
    const api = (window.electronAPI as any).whatsNew;
    if (!api?.getStartup) {
      // Older preload without the whatsNew bridge -- nothing to do.
      return;
    }

    const payload = await api.getStartup();
    if (!payload) {
      return;
    }

    showWhatsNewPanel({
      title: `What's New in FictionLab ${payload.version}`,
      markdown: payload.notes,
      emptyMessage: 'This release has no notes.',
      linkUrl: payload.releaseUrl,
    });

    // Mark seen when shown (not on close) so a crash mid-session still
    // counts as "seen" -- criterion: not shown again for the same version.
    void api.markSeen(payload.version);
  } catch (error) {
    console.warn("What's New startup check failed:", error);
  }
}
