/**
 * ChapterEditorView — the fictionlab-chapter-editor plugin's main view.
 *
 * A Tiptap Core (+ @tiptap/markdown + the MIT
 * @sereneinserenade/tiptap-comment-extension) hand-editing surface over
 * chapter markdown files: highlight + comment, cut/paste, open/save. Reads
 * and writes the same .md files the chapter-writer-7step skill pipeline
 * already produces — comment marks live only in the live editor doc and are
 * intentionally never serialized into the saved markdown (see
 * chapter-files.ts), so that pipeline keeps reading plain prose underneath
 * this view, unchanged. Comment text instead round-trips through a sidecar
 * `<chapter>.md.comments.json` file the main-process ipc-handlers manage.
 *
 * TTS/STT (Listen + selection-anchored speak-a-fix, the fld-vce pattern) is
 * an explicit follow-on once this base editing view ships — not built here.
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import * as ReactDOM from 'react-dom/client';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import CommentExtension from '@sereneinserenade/tiptap-comment-extension';
import type { View, TopBarConfig } from './types/host';

const CHAPTER_EDITOR_PLUGIN = 'plugin:fictionlab-chapter-editor:';

export interface ChapterComment {
  id: string;
  anchorText: string;
  commentText: string;
  createdAt: string;
}

async function invoke<T = any>(channel: string, args?: any): Promise<T> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.invoke) throw new Error('Electron API not available');
  return electronAPI.invoke(`${CHAPTER_EDITOR_PLUGIN}${channel}`, args);
}

function makeCommentId(): string {
  return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Best-effort re-anchor: find the comment's saved substring in the freshly
 * markdown-parsed doc and re-apply the comment mark there. Position offsets
 * don't survive a markdown round-trip (the doc is rebuilt from scratch on
 * every load), but the literal text usually does. Silently skips comments
 * whose anchor text no longer appears (edited away) rather than throwing —
 * the comment itself stays in state/sidecar so it isn't lost, just unanchored.
 */
function reanchorComment(editor: NonNullable<ReturnType<typeof useEditor>>, comment: ChapterComment): void {
  const { doc } = editor.state;
  const fullText = doc.textContent;
  const index = fullText.indexOf(comment.anchorText);
  if (index === -1 || !comment.anchorText) return;

  let from = -1;
  let remaining = index;
  doc.descendants((node, pos) => {
    if (from !== -1 || !node.isText) return true;
    const len = node.text?.length ?? 0;
    if (remaining < len) {
      from = pos + remaining;
      return false;
    }
    remaining -= len;
    return true;
  });
  if (from === -1) return;

  const to = from + comment.anchorText.length;
  editor.chain().setTextSelection({ from, to }).setComment(comment.id).run();
}

let activeChapterEditorActions: { save: () => void; openFile: () => void } | null = null;

export const ChapterEditorApp: React.FC = () => {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [comments, setComments] = useState<ChapterComment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('No chapter open.');
  const [dirty, setDirty] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      CommentExtension.configure({
        HTMLAttributes: { class: 'chapter-editor-comment' },
        onCommentActivated: (commentId: string | null) => setActiveCommentId(commentId),
      }),
    ],
    content: '',
    contentType: 'markdown',
    onUpdate: () => setDirty(true),
  } as any);

  const openFile = useCallback(async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.dialog?.showOpenDialog) {
      setStatus('Dialog API not available.');
      return;
    }
    const result = await electronAPI.dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (result?.canceled || !result?.filePaths?.length) return;
    const picked = result.filePaths[0];
    setStatus('Loading…');
    try {
      const { content } = await invoke<{ content: string }>('chapter-editor:read-chapter', { filePath: picked });
      const loadedComments = await invoke<ChapterComment[]>('chapter-editor:read-comments', { filePath: picked });
      editor?.commands.setContent(content, { contentType: 'markdown' } as any);
      setComments(loadedComments);
      setActiveCommentId(null);
      setFilePath(picked);
      setDirty(false);
      setStatus(`Opened ${picked}`);
    } catch (error: any) {
      setStatus(`Failed to open: ${error.message}`);
    }
  }, [editor]);

  // Re-anchor every saved comment right after a fresh load. Deliberately
  // scoped to the filePath transition (not every render) -- once a comment
  // mark is applied in the live doc it must survive further edits
  // undisturbed rather than being re-searched-and-reapplied on each keystroke.
  useEffect(() => {
    if (!editor || !filePath) return;
    comments.forEach((comment) => reanchorComment(editor, comment));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, filePath]);

  const save = useCallback(async () => {
    if (!editor || !filePath) return;
    setStatus('Saving…');
    try {
      const markdown = (editor as any).getMarkdown();
      await invoke('chapter-editor:write-chapter', { filePath, content: markdown });
      await invoke('chapter-editor:write-comments', { filePath, comments });
      setDirty(false);
      setStatus(`Saved ${filePath}`);
    } catch (error: any) {
      setStatus(`Failed to save: ${error.message}`);
    }
  }, [editor, filePath, comments]);

  useEffect(() => {
    activeChapterEditorActions = { save, openFile };
    return () => {
      activeChapterEditorActions = null;
    };
  }, [save, openFile]);

  const addComment = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const anchorText = editor.state.doc.textBetween(from, to, ' ');
    const id = makeCommentId();
    editor.chain().focus().setComment(id).run();
    const comment: ChapterComment = { id, anchorText, commentText: '', createdAt: new Date().toISOString() };
    setComments((current) => [...current, comment]);
    setActiveCommentId(id);
    setDirty(true);
  }, [editor]);

  const updateCommentText = useCallback((commentId: string, value: string) => {
    setComments((current) => current.map((c) => (c.id === commentId ? { ...c, commentText: value } : c)));
    setDirty(true);
  }, []);

  const removeComment = useCallback(
    (commentId: string) => {
      editor?.chain().focus().unsetComment(commentId).run();
      setComments((current) => current.filter((c) => c.id !== commentId));
      if (activeCommentId === commentId) setActiveCommentId(null);
      setDirty(true);
    },
    [editor, activeCommentId]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#ddd', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 8, padding: 12, borderBottom: '1px solid #3a3a3a', alignItems: 'center', flexShrink: 0 }}>
        <button onClick={openFile}>Open Chapter…</button>
        <button onClick={save} disabled={!filePath || !dirty}>
          Save{dirty ? ' *' : ''}
        </button>
        <div style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{status}</div>
      </div>

      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0 }}>
        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: 16 }}>
          {editor && (
            <>
              <BubbleMenu editor={editor}>
                <button onClick={addComment}>💬 Comment</button>
              </BubbleMenu>
              <EditorContent editor={editor} data-testid="chapter-editor-content" />
            </>
          )}
          {!editor && <div>Loading editor…</div>}
        </div>

        <div style={{ width: 280, borderLeft: '1px solid #3a3a3a', padding: 12, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Comments</div>
          {comments.length === 0 && (
            <div style={{ fontSize: 12, color: '#888' }}>No comments yet. Select text and click Comment.</div>
          )}
          {comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                border: comment.id === activeCommentId ? '1px solid #8ab4f8' : '1px solid #3a3a3a',
                borderRadius: 6,
                padding: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                “{comment.anchorText.slice(0, 60)}
                {comment.anchorText.length > 60 ? '…' : ''}”
              </div>
              <textarea
                value={comment.commentText}
                onFocus={() => setActiveCommentId(comment.id)}
                onChange={(e) => updateCommentText(comment.id, e.target.value)}
                placeholder="Why it's wrong / what to change…"
                style={{ width: '100%', minHeight: 48, resize: 'vertical' }}
              />
              <button onClick={() => removeComment(comment.id)} style={{ fontSize: 11, marginTop: 4 }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// View class wrapper for the host ViewRouter. The DEFAULT export is the
// contract: the host's plugin-view loader instantiates `module.default` and
// duck-types it against its own View interface (agent-factory-plugin's
// AgentFactoryView is the precedent this mirrors).
export default class ChapterEditorView implements View {
  private root: ReactDOM.Root | null = null;

  async mount(container: HTMLElement): Promise<void> {
    this.root = ReactDOM.createRoot(container);
    this.root.render(<ChapterEditorApp />);
    console.log('[ChapterEditorView] Mounted');
  }

  async unmount(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    activeChapterEditorActions = null;
    console.log('[ChapterEditorView] Unmounted');
  }

  getTopBarConfig(): TopBarConfig {
    return {
      title: 'Chapter Editor',
      actions: [
        { id: 'open-chapter', label: 'Open Chapter…', icon: '📂' },
        { id: 'save-chapter', label: 'Save', icon: '💾' },
      ],
      global: {
        projectSelector: false,
        environmentIndicator: true,
      },
    };
  }

  handleAction(actionId: string): void {
    if (!activeChapterEditorActions) {
      console.warn('[ChapterEditorView] Action dispatched but no mounted app instance to handle it:', actionId);
      return;
    }
    switch (actionId) {
      case 'open-chapter':
        activeChapterEditorActions.openFile();
        break;
      case 'save-chapter':
        activeChapterEditorActions.save();
        break;
      default:
        console.warn('[ChapterEditorView] Unknown action:', actionId);
    }
  }
}
