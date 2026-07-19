/**
 * Tests for mea-qpg: Electron underlines misspelled words natively but does
 * not populate the right-click context menu with suggestions on its own --
 * attachSpellCheckContextMenu wires the 'context-menu' event to build one
 * (suggestions + Add to Dictionary + the normal edit items), matching the
 * bead's acceptance criteria.
 */

import { Menu } from 'electron';

import { attachSpellCheckContextMenu } from '../spellcheck-context-menu';

function createMockWebContents() {
  let contextMenuHandler: ((event: unknown, params: any) => void) | undefined;

  return {
    on: jest.fn((event: string, handler: (event: unknown, params: any) => void) => {
      if (event === 'context-menu') {
        contextMenuHandler = handler;
      }
    }),
    replaceMisspelling: jest.fn(),
    session: {
      addWordToSpellCheckerDictionary: jest.fn(),
    },
    triggerContextMenu(params: any) {
      contextMenuHandler?.(undefined, params);
    },
  };
}

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    misspelledWord: '',
    dictionarySuggestions: [],
    isEditable: false,
    selectionText: '',
    editFlags: {
      canCut: false,
      canCopy: false,
      canPaste: false,
      canSelectAll: false,
    },
    ...overrides,
  };
}

describe('attachSpellCheckContextMenu', () => {
  beforeEach(() => {
    (Menu.buildFromTemplate as jest.Mock).mockClear();
  });

  it('registers a context-menu listener on the given webContents', () => {
    const webContents = createMockWebContents();
    attachSpellCheckContextMenu(webContents as any);
    expect(webContents.on).toHaveBeenCalledWith('context-menu', expect.any(Function));
  });

  it('lists dictionary suggestions on a misspelled word and replaces on click', () => {
    const webContents = createMockWebContents();
    attachSpellCheckContextMenu(webContents as any);

    webContents.triggerContextMenu(
      baseParams({
        misspelledWord: 'teh',
        dictionarySuggestions: ['the', 'tea'],
        isEditable: true,
        editFlags: { canCut: true, canCopy: true, canPaste: true, canSelectAll: true },
      })
    );

    const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
    const suggestionItems = template.filter((item: any) => item.label === 'the' || item.label === 'tea');
    expect(suggestionItems).toHaveLength(2);

    suggestionItems[0].click();
    expect(webContents.replaceMisspelling).toHaveBeenCalledWith('the');
  });

  it('includes an "Add to Dictionary" entry that adds the misspelled word', () => {
    const webContents = createMockWebContents();
    attachSpellCheckContextMenu(webContents as any);

    webContents.triggerContextMenu(
      baseParams({
        misspelledWord: 'fictionlab',
        dictionarySuggestions: ['fiction lab'],
        isEditable: true,
        editFlags: { canCut: true, canCopy: true, canPaste: true, canSelectAll: true },
      })
    );

    const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
    const addToDictionary = template.find((item: any) => item.label === 'Add to Dictionary');
    expect(addToDictionary).toBeDefined();

    addToDictionary.click();
    expect(webContents.session.addWordToSpellCheckerDictionary).toHaveBeenCalledWith('fictionlab');
  });

  it('shows a disabled placeholder when there are no dictionary suggestions', () => {
    const webContents = createMockWebContents();
    attachSpellCheckContextMenu(webContents as any);

    webContents.triggerContextMenu(
      baseParams({
        misspelledWord: 'asdfqwerty',
        dictionarySuggestions: [],
        isEditable: true,
        editFlags: { canCut: true, canCopy: true, canPaste: true, canSelectAll: true },
      })
    );

    const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
    const placeholder = template.find((item: any) => item.label === 'No suggestions');
    expect(placeholder).toEqual(expect.objectContaining({ enabled: false }));
  });

  it('shows the normal edit menu (cut/copy/paste/select all) on non-misspelled editable text', () => {
    const webContents = createMockWebContents();
    attachSpellCheckContextMenu(webContents as any);

    webContents.triggerContextMenu(
      baseParams({
        isEditable: true,
        editFlags: { canCut: true, canCopy: true, canPaste: true, canSelectAll: true },
      })
    );

    const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
    const labels = template.map((item: any) => item.label);
    expect(labels).toEqual(['Cut', 'Copy', 'Paste', undefined, 'Select All']);
    expect(template.every((item: any) => item.label !== 'Add to Dictionary')).toBe(true);
  });

  it('shows only Copy on a plain text selection outside an editable field', () => {
    const webContents = createMockWebContents();
    attachSpellCheckContextMenu(webContents as any);

    webContents.triggerContextMenu(
      baseParams({
        selectionText: 'some selected text',
        editFlags: { canCut: false, canCopy: true, canPaste: false, canSelectAll: false },
      })
    );

    const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
    expect(template).toEqual([{ label: 'Copy', role: 'copy', enabled: true }]);
  });

  it('does not open a menu when there is nothing to show', () => {
    const webContents = createMockWebContents();
    attachSpellCheckContextMenu(webContents as any);

    webContents.triggerContextMenu(baseParams());

    expect(Menu.buildFromTemplate).not.toHaveBeenCalled();
  });
});
