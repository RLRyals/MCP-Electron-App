/**
 * Wires Chromium's spellchecker suggestions into the native right-click
 * context menu. Electron underlines misspelled words automatically, but it
 * does NOT populate the context menu with suggestions/corrections on its
 * own -- that requires listening for 'context-menu' and reading
 * params.misspelledWord / params.dictionarySuggestions ourselves
 * (mea-qpg).
 */

import { Menu, MenuItemConstructorOptions, WebContents } from 'electron';

export function attachSpellCheckContextMenu(webContents: WebContents): void {
  webContents.on('context-menu', (_event, params) => {
    const menuItems: MenuItemConstructorOptions[] = [];

    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length > 0) {
        for (const suggestion of params.dictionarySuggestions) {
          menuItems.push({
            label: suggestion,
            click: () => webContents.replaceMisspelling(suggestion),
          });
        }
      } else {
        menuItems.push({ label: 'No suggestions', enabled: false });
      }

      menuItems.push(
        { type: 'separator' },
        {
          label: 'Add to Dictionary',
          click: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        },
        { type: 'separator' }
      );
    }

    if (params.isEditable) {
      menuItems.push(
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll', enabled: params.editFlags.canSelectAll }
      );
    } else if (params.selectionText) {
      menuItems.push({ label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy });
    }

    if (menuItems.length === 0) {
      return;
    }

    Menu.buildFromTemplate(menuItems).popup();
  });
}
