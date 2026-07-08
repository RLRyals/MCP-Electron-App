/**
 * Unit tests for the IPC handler registry (src/main/ipc-registry.ts).
 *
 * NOTE ON RUNNING THESE TESTS: as of this writing, `npm test` cannot execute ANY .ts test
 * file in this repo — there is no jest.config.js / ts-jest transform wired up (pre-existing,
 * confirmed via `git log` showing a jest config has never existed, and reproduced by running
 * the existing `src/main/__tests__/example.test.ts` on a clean checkout, which fails with a
 * raw babel parse error). That gap is unrelated to IPC introspection (issue #164) and is not
 * fixed here to avoid scope creep; see repo/issue tracker for a follow-up. This file follows
 * the same conventions as the other tests under tests/main/ so it is ready to run once that
 * infra gap is closed.
 */

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

import { ipcMain } from 'electron';
import {
  registerHandler,
  recordHandler,
  unrecordHandler,
  getRegisteredHandlers,
  __clearRegistryForTests,
} from '../../src/main/ipc-registry';

describe('ipc-registry', () => {
  beforeEach(() => {
    __clearRegistryForTests();
    (ipcMain.handle as jest.Mock).mockClear();
  });

  it('registerHandler is a pure pass-through to ipcMain.handle', async () => {
    const handler = jest.fn().mockResolvedValue('pong');

    registerHandler('ping', 'Health-check ping/pong', handler);

    expect(ipcMain.handle).toHaveBeenCalledTimes(1);
    expect(ipcMain.handle).toHaveBeenCalledWith('ping', handler);
  });

  it('help (getRegisteredHandlers) returns every registered handler, sorted by channel', () => {
    registerHandler('workflow:list-active', 'List active workflow instances', jest.fn());
    registerHandler('docker:start', 'Start Docker services', jest.fn());

    const all = getRegisteredHandlers();

    expect(all).toHaveLength(2);
    // sorted alphabetically: 'docker:start' < 'workflow:list-active'
    expect(all.map((entry) => entry.channel)).toEqual(['docker:start', 'workflow:list-active']);
    expect(all).toEqual([
      { channel: 'docker:start', description: 'Start Docker services', source: 'app' },
      { channel: 'workflow:list-active', description: 'List active workflow instances', source: 'app' },
    ]);
  });

  it('supports a prefix filter, returning only matching channels', () => {
    registerHandler('workflow:list-active', 'List active workflow instances', jest.fn());
    registerHandler('workflow:pause', 'Pause an active workflow', jest.fn());
    registerHandler('docker:start', 'Start Docker services', jest.fn());

    const workflowOnly = getRegisteredHandlers('workflow:');

    expect(workflowOnly).toHaveLength(2);
    expect(workflowOnly.every((entry) => entry.channel.startsWith('workflow:'))).toBe(true);

    const none = getRegisteredHandlers('nonexistent:');
    expect(none).toHaveLength(0);
  });

  it('records plugin-namespaced channels with a plugin:<id> source via recordHandler', () => {
    recordHandler('plugin:my-plugin:do-thing', '', 'plugin:my-plugin');

    const all = getRegisteredHandlers();
    expect(all).toEqual([
      { channel: 'plugin:my-plugin:do-thing', description: '', source: 'plugin:my-plugin' },
    ]);

    // ipcMain.handle is NOT called by recordHandler alone -- the plugin IPC bridge calls
    // ipcMain.handle itself and separately records the channel.
    expect(ipcMain.handle).not.toHaveBeenCalled();
  });

  it('unrecordHandler removes a channel from the registry without touching ipcMain', () => {
    recordHandler('plugin:my-plugin:do-thing', '', 'plugin:my-plugin');
    expect(getRegisteredHandlers()).toHaveLength(1);

    unrecordHandler('plugin:my-plugin:do-thing');

    expect(getRegisteredHandlers()).toHaveLength(0);
  });
});
