/**
 * Terminal IPC handlers (mea-bkr).
 *
 * Exposes host-side PTY spawning to any renderer/plugin via the same
 * registerHandler + electronAPI.invoke pattern workflow-handlers.ts uses for
 * workflow:* channels (see workflow-handlers.ts:117) -- terminal-plugin (the
 * renderer/xterm.js view; lives in the fictionlab-workflow monorepo, not
 * this repo) calls these directly through window.electronAPI.invoke/on.
 *
 * Channel contract:
 *   terminal:list-profiles()                              -> TerminalProfile[]
 *   terminal:spawn({sessionId, profileId?, cols?, rows?})  -> { success, profile }
 *   terminal:write({sessionId, data})                      -> { success }
 *   terminal:resize({sessionId, cols, rows})                -> { success }
 *   terminal:kill({sessionId})                             -> { success }
 *   'terminal:data' (pushed)  { sessionId, data }
 *   'terminal:exit' (pushed)  { sessionId, exitCode, signal }
 */
import { app, BrowserWindow } from 'electron';
import { registerHandler } from '../ipc-registry';
import { logWithCategory, LogCategory } from '../logger';
import { PtyManager } from '../terminal/pty-manager';
import { loadProfiles, DEFAULT_PROFILES } from '../terminal/profiles';
import type {
  SpawnTerminalParams,
  WriteTerminalParams,
  ResizeTerminalParams,
  KillTerminalParams,
  TerminalDataEvent,
  TerminalExitEvent,
} from '../terminal/types';

const ptyManager = new PtyManager();

function broadcast(channel: string, payload: TerminalDataEvent | TerminalExitEvent) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, payload);
  });
}

export function registerTerminalHandlers() {
  registerHandler('terminal:list-profiles', 'List available terminal launch profiles', async () => {
    try {
      return await loadProfiles(app.getPath('userData'));
    } catch (error: any) {
      logWithCategory('error', LogCategory.TERMINAL, 'IPC: terminal:list-profiles failed', { error: error.message });
      return DEFAULT_PROFILES;
    }
  });

  registerHandler('terminal:spawn', 'Spawn a PTY-backed terminal session', async (_event, params: SpawnTerminalParams) => {
    const { sessionId, profileId, cols = 80, rows = 24 } = params || ({} as SpawnTerminalParams);
    logWithCategory('info', LogCategory.TERMINAL, `IPC: terminal:spawn ${sessionId} (profile ${profileId || 'default'})`);
    try {
      if (!sessionId) {
        throw new Error('sessionId is required');
      }
      const profiles = await loadProfiles(app.getPath('userData'));
      const profile = (profileId && profiles.find((p) => p.id === profileId)) || profiles[0];
      if (!profile) {
        throw new Error('No terminal profiles configured');
      }

      ptyManager.spawn(
        sessionId,
        profile,
        cols,
        rows,
        (id, data) => broadcast('terminal:data', { sessionId: id, data }),
        (id, exitCode, signal) => broadcast('terminal:exit', { sessionId: id, exitCode, signal })
      );

      return { success: true, profile };
    } catch (error: any) {
      logWithCategory('error', LogCategory.TERMINAL, 'IPC: terminal:spawn failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  registerHandler('terminal:write', 'Write keystrokes to a terminal session', async (_event, params: WriteTerminalParams) => {
    try {
      ptyManager.write(params.sessionId, params.data);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.TERMINAL, 'IPC: terminal:write failed', { error: error.message });
      throw error;
    }
  });

  registerHandler('terminal:resize', 'Resize a terminal session', async (_event, params: ResizeTerminalParams) => {
    try {
      ptyManager.resize(params.sessionId, params.cols, params.rows);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.TERMINAL, 'IPC: terminal:resize failed', { error: error.message });
      throw error;
    }
  });

  registerHandler('terminal:kill', 'Kill a terminal session', async (_event, params: KillTerminalParams) => {
    try {
      ptyManager.kill(params.sessionId);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.TERMINAL, 'IPC: terminal:kill failed', { error: error.message });
      throw error;
    }
  });

  logWithCategory('info', LogCategory.TERMINAL, 'Terminal IPC handlers registered');
}

/**
 * Kill every live PTY session. Called from app 'before-quit' so closing the
 * app never leaves an orphaned claude/shell process behind.
 */
export function killAllTerminals(): void {
  ptyManager.killAll();
}
