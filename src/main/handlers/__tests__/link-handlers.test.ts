/**
 * Unit tests for the app:open-external / app:reveal-in-folder handlers
 * (issue #198 -- Kanban card links, issue_ref, and body URLs).
 *
 * The security requirements from the issue are hard requirements, so the
 * bulk of this suite is adversarial: confirm every non-http(s) shape
 * (file://, javascript:, data:, bare paths, garbage strings, non-string
 * input) is rejected BEFORE the injected opener/reveal function is ever
 * called, and that `revealFileInFolder` never reveals a path that doesn't
 * exist on disk.
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  shell: {
    openExternal: jest.fn().mockResolvedValue(undefined),
    showItemInFolder: jest.fn(),
  },
}));

jest.mock('../../logger', () => ({
  LogCategory: { SYSTEM: 'SYSTEM' },
  logWithCategory: jest.fn(),
}));

import { ipcMain } from 'electron';
import {
  isAllowedExternalUrl,
  openExternalLink,
  revealFileInFolder,
  registerLinkHandlers,
} from '../link-handlers';

describe('isAllowedExternalUrl', () => {
  it.each([
    ['http://example.com', true],
    ['https://example.com/path?q=1#frag', true],
    ['https://github.com/RLRyals/MCP-Electron-App/issues/198', true],
    ['  https://example.com  ', true], // trims before validating
  ])('%s -> %s', (value, expected) => {
    expect(isAllowedExternalUrl(value)).toBe(expected);
  });

  it.each([
    ['file:///etc/passwd'],
    ['javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['C:\\Users\\rebecca\\file.txt'],
    ['/etc/passwd'],
    ['not a url'],
    [''],
    [null],
    [undefined],
    [42],
    [{}],
  ])('rejects %p', (value) => {
    expect(isAllowedExternalUrl(value as any)).toBe(false);
  });
});

describe('openExternalLink', () => {
  it('calls the opener and resolves { success: true } for an http(s) URL', async () => {
    const opener = jest.fn().mockResolvedValue(undefined);
    const result = await openExternalLink('https://example.com/foo', opener);
    expect(opener).toHaveBeenCalledWith('https://example.com/foo');
    expect(result).toEqual({ success: true });
  });

  it('trims whitespace before handing the URL to the opener', async () => {
    const opener = jest.fn().mockResolvedValue(undefined);
    await openExternalLink('  https://example.com/foo  ', opener);
    expect(opener).toHaveBeenCalledWith('https://example.com/foo');
  });

  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'not-a-url',
    '',
  ])('rejects %p without ever calling the opener', async (value) => {
    const opener = jest.fn().mockResolvedValue(undefined);
    await expect(openExternalLink(value, opener)).rejects.toThrow(/non-http\(s\)/i);
    expect(opener).not.toHaveBeenCalled();
  });

  it('rejects non-string input without calling the opener', async () => {
    const opener = jest.fn().mockResolvedValue(undefined);
    await expect(openExternalLink(42 as any, opener)).rejects.toThrow();
    expect(opener).not.toHaveBeenCalled();
  });
});

describe('revealFileInFolder', () => {
  it('reveals a file that exists', async () => {
    const exists = jest.fn().mockReturnValue(true);
    const reveal = jest.fn();
    const result = await revealFileInFolder('C:/repo/file.txt', exists, reveal);
    expect(exists).toHaveBeenCalledWith('C:/repo/file.txt');
    expect(reveal).toHaveBeenCalledWith('C:/repo/file.txt');
    expect(result).toEqual({ success: true });
  });

  it('throws and never reveals when the file does not exist', async () => {
    const exists = jest.fn().mockReturnValue(false);
    const reveal = jest.fn();
    await expect(revealFileInFolder('C:/repo/missing.txt', exists, reveal)).rejects.toThrow(/does not exist/i);
    expect(reveal).not.toHaveBeenCalled();
  });

  it('throws on empty/non-string paths without calling exists or reveal', async () => {
    const exists = jest.fn().mockReturnValue(true);
    const reveal = jest.fn();
    await expect(revealFileInFolder('', exists, reveal)).rejects.toThrow();
    await expect(revealFileInFolder(undefined as any, exists, reveal)).rejects.toThrow();
    expect(exists).not.toHaveBeenCalled();
    expect(reveal).not.toHaveBeenCalled();
  });
});

describe('registerLinkHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers both app:open-external and app:reveal-in-folder', () => {
    registerLinkHandlers();
    const registeredChannels = (ipcMain.handle as jest.Mock).mock.calls.map((call) => call[0]);
    expect(registeredChannels).toEqual(
      expect.arrayContaining(['app:open-external', 'app:reveal-in-folder'])
    );
  });

  it('the registered app:open-external handler rejects a non-http(s) URL end to end', async () => {
    registerLinkHandlers();
    const call = (ipcMain.handle as jest.Mock).mock.calls.find((c) => c[0] === 'app:open-external');
    const handler = call![1];
    await expect(handler({} as any, 'file:///etc/passwd')).rejects.toThrow(/non-http\(s\)/i);
  });

  it('the registered app:reveal-in-folder handler rejects a nonexistent path end to end', async () => {
    registerLinkHandlers();
    const call = (ipcMain.handle as jest.Mock).mock.calls.find((c) => c[0] === 'app:reveal-in-folder');
    const handler = call![1];
    await expect(handler({} as any, 'C:/definitely/does/not/exist-198.txt')).rejects.toThrow(/does not exist/i);
  });
});
