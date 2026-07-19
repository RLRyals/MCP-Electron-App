const sendMock = jest.fn();

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  app: { getPath: jest.fn(() => '/fake/userData') },
  BrowserWindow: {
    getAllWindows: jest.fn(() => [{ webContents: { send: sendMock } }]),
  },
}));

jest.mock('../../logger', () => ({
  LogCategory: { TERMINAL: 'TERMINAL' },
  logWithCategory: jest.fn(),
}));

const managerInstance = {
  spawn: jest.fn(),
  write: jest.fn(),
  resize: jest.fn(),
  kill: jest.fn(),
  killAll: jest.fn(),
  has: jest.fn(),
};

jest.mock('../../terminal/pty-manager', () => ({
  PtyManager: jest.fn(() => managerInstance),
}));

const FAKE_PROFILE = { id: 'default', name: 'Claude Code', cwd: '/home', command: 'claude' };

jest.mock('../../terminal/profiles', () => ({
  loadProfiles: jest.fn(async () => [FAKE_PROFILE]),
  DEFAULT_PROFILES: [FAKE_PROFILE],
}));

import { ipcMain } from 'electron';
import { registerTerminalHandlers, killAllTerminals } from '../terminal-handlers';

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`handler not registered for ${channel}`);
  return call[1] as (event: any, ...args: any[]) => any;
}

describe('terminal IPC handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registerTerminalHandlers();
  });

  it('registers every terminal:* channel', () => {
    const channels = (ipcMain.handle as jest.Mock).mock.calls.map((c) => c[0]);
    expect(channels).toEqual(
      expect.arrayContaining(['terminal:list-profiles', 'terminal:spawn', 'terminal:write', 'terminal:resize', 'terminal:kill'])
    );
  });

  it('terminal:list-profiles resolves the loaded profiles', async () => {
    const result = await getHandler('terminal:list-profiles')({});
    expect(result).toEqual([FAKE_PROFILE]);
  });

  it('terminal:spawn rejects a missing sessionId without calling the manager', async () => {
    await expect(getHandler('terminal:spawn')({}, { sessionId: '' })).rejects.toThrow(/sessionId is required/i);
    expect(managerInstance.spawn).not.toHaveBeenCalled();
  });

  it('terminal:spawn resolves the default profile and calls PtyManager.spawn', async () => {
    const result = await getHandler('terminal:spawn')({}, { sessionId: 'sess-1' });
    expect(result).toEqual({ success: true, profile: FAKE_PROFILE });
    expect(managerInstance.spawn).toHaveBeenCalledWith(
      'sess-1',
      FAKE_PROFILE,
      80,
      24,
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('terminal:spawn broadcasts PTY output to every open window via the onData callback', async () => {
    await getHandler('terminal:spawn')({}, { sessionId: 'sess-2' });
    const onData = managerInstance.spawn.mock.calls[0][4];
    onData('sess-2', 'hello');
    expect(sendMock).toHaveBeenCalledWith('terminal:data', { sessionId: 'sess-2', data: 'hello' });
  });

  it('terminal:spawn broadcasts exit events via the onExit callback', async () => {
    await getHandler('terminal:spawn')({}, { sessionId: 'sess-3' });
    const onExit = managerInstance.spawn.mock.calls[0][5];
    onExit('sess-3', 0, undefined);
    expect(sendMock).toHaveBeenCalledWith('terminal:exit', { sessionId: 'sess-3', exitCode: 0, signal: undefined });
  });

  it('terminal:write/terminal:resize/terminal:kill delegate to the manager', async () => {
    await getHandler('terminal:write')({}, { sessionId: 's', data: 'x' });
    await getHandler('terminal:resize')({}, { sessionId: 's', cols: 10, rows: 5 });
    await getHandler('terminal:kill')({}, { sessionId: 's' });

    expect(managerInstance.write).toHaveBeenCalledWith('s', 'x');
    expect(managerInstance.resize).toHaveBeenCalledWith('s', 10, 5);
    expect(managerInstance.kill).toHaveBeenCalledWith('s');
  });

  it('killAllTerminals() delegates to PtyManager.killAll()', () => {
    killAllTerminals();
    expect(managerInstance.killAll).toHaveBeenCalled();
  });
});
