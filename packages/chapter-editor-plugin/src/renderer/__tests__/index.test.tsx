import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { ChapterEditorApp } from '../index';
import ChapterEditorView from '../index';

describe('ChapterEditorApp', () => {
  it('renders the toolbar with Open/Save controls', async () => {
    render(<ChapterEditorApp />);

    expect(screen.getByText('Open Chapter…')).toBeInTheDocument();
    expect(screen.getByText('No chapter open.')).toBeInTheDocument();

    // Save is disabled until a file is open.
    const saveButton = screen.getByRole('button', { name: /^Save$/ });
    expect(saveButton).toBeDisabled();

    await waitFor(() => expect(screen.getByText('No comments yet. Select text and click Comment.')).toBeInTheDocument());
  });

  it('opens the native file dialog scoped to markdown files', async () => {
    const user = userEvent.setup();
    render(<ChapterEditorApp />);

    await user.click(screen.getByText('Open Chapter…'));

    expect((window as any).electronAPI.dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      })
    );
  });

  it('reads a picked chapter and its comments sidecar through the plugin IPC channel', async () => {
    const user = userEvent.setup();
    (window as any).electronAPI.dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['C:/book/chapter-01.md'],
    });
    (window as any).electronAPI.invoke.mockImplementation((channel: string) => {
      if (channel === 'plugin:fictionlab-chapter-editor:chapter-editor:read-chapter') {
        return Promise.resolve({ content: '# Chapter One\n\nOnce upon a time.' });
      }
      if (channel === 'plugin:fictionlab-chapter-editor:chapter-editor:read-comments') {
        return Promise.resolve([]);
      }
      return Promise.resolve(undefined);
    });

    render(<ChapterEditorApp />);
    await user.click(screen.getByText('Open Chapter…'));

    await waitFor(() => expect(screen.getByText('Opened C:/book/chapter-01.md')).toBeInTheDocument());
    expect((window as any).electronAPI.invoke).toHaveBeenCalledWith(
      'plugin:fictionlab-chapter-editor:chapter-editor:read-chapter',
      { filePath: 'C:/book/chapter-01.md' }
    );
  });
});

describe('ChapterEditorView', () => {
  it('mounts and unmounts without throwing', async () => {
    const container = document.createElement('div');
    const view = new ChapterEditorView();

    await act(async () => {
      await view.mount(container);
    });
    expect(container.querySelector('button')).not.toBeNull();

    await act(async () => {
      await view.unmount();
    });
  });

  it('exposes a top bar config with open/save actions', () => {
    const view = new ChapterEditorView();
    const config = view.getTopBarConfig();
    expect(config.actions?.map((a) => a.id)).toEqual(['open-chapter', 'save-chapter']);
  });
});
