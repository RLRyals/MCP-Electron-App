/**
 * Host-side PTY session manager (mea-bkr).
 *
 * Spawns real, interactive processes via node-pty (ConPTY on Windows) and
 * tracks them by session id so IPC handlers can write keystrokes, resize,
 * and kill them. node-pty is an optionalDependency (native module; its
 * prebuilds don't cover every platform, and we don't want a failed native
 * install to break `npm install`/CI elsewhere in the app) -- it is loaded
 * lazily and defensively so a platform without it degrades to
 * isSupported() === false instead of crashing at import time.
 */
import { logWithCategory, LogCategory } from '../logger';
import type { TerminalProfile } from './types';

// Lazily resolved: only imported for its types, never eagerly required.
type PtyModule = typeof import('node-pty');
type IPty = import('node-pty').IPty;

let ptyModule: PtyModule | null = null;
let ptyLoadError: Error | null = null;
let ptyLoadAttempted = false;

function loadPty(): PtyModule | null {
  if (ptyLoadAttempted) {
    return ptyModule;
  }
  ptyLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ptyModule = require('node-pty');
  } catch (error: any) {
    ptyLoadError = error;
    logWithCategory('error', LogCategory.TERMINAL, 'node-pty unavailable on this platform', {
      error: error?.message,
    });
  }
  return ptyModule;
}

/**
 * Build the child process environment: profile overrides on top of the
 * current process env, with ELECTRON_RUN_AS_NODE always stripped.
 *
 * Binding gotcha (shared-store electron-gui-blocked-in-agent-sessions):
 * Claude Code / agent sessions run with ELECTRON_RUN_AS_NODE=1. If a spawned
 * `claude` (or any) child process inherits it, it starts in plain-Node mode
 * with no real terminal semantics -- this must be stripped for every PTY
 * spawn, not just for launching the whole Electron app.
 */
export function buildSpawnEnv(profileEnv?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  Object.assign(env, profileEnv || {});
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

interface PtySession {
  id: string;
  ptyProcess: IPty;
  profile: TerminalProfile;
}

export type TerminalDataListener = (sessionId: string, data: string) => void;
export type TerminalExitListener = (sessionId: string, exitCode: number, signal?: number) => void;

export class PtyManager {
  private sessions = new Map<string, PtySession>();

  isSupported(): boolean {
    return loadPty() !== null;
  }

  getUnsupportedReason(): string | undefined {
    return ptyLoadError?.message;
  }

  spawn(
    sessionId: string,
    profile: TerminalProfile,
    cols: number,
    rows: number,
    onData: TerminalDataListener,
    onExit: TerminalExitListener
  ): void {
    const pty = loadPty();
    if (!pty) {
      throw new Error(
        `Terminal spawning is unavailable on this platform: ${ptyLoadError?.message || 'node-pty failed to load'}`
      );
    }
    if (this.sessions.has(sessionId)) {
      throw new Error(`Terminal session ${sessionId} already exists`);
    }

    const ptyProcess = pty.spawn(profile.command, profile.args || [], {
      name: 'xterm-color',
      cols,
      rows,
      cwd: profile.cwd,
      env: buildSpawnEnv(profile.env),
      useConpty: process.platform === 'win32',
    });

    this.sessions.set(sessionId, { id: sessionId, ptyProcess, profile });
    logWithCategory('info', LogCategory.TERMINAL, `Spawned terminal ${sessionId} (profile ${profile.id}, pid ${ptyProcess.pid})`);

    ptyProcess.onData((data) => onData(sessionId, data));
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.sessions.delete(sessionId);
      logWithCategory('info', LogCategory.TERMINAL, `Terminal ${sessionId} exited (code ${exitCode}, signal ${signal})`);
      onExit(sessionId, exitCode, signal);
    });
  }

  write(sessionId: string, data: string): void {
    this.mustGet(sessionId).ptyProcess.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.mustGet(sessionId).ptyProcess.resize(cols, rows);
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.ptyProcess.kill();
    this.sessions.delete(sessionId);
  }

  killAll(): void {
    for (const sessionId of Array.from(this.sessions.keys())) {
      this.kill(sessionId);
    }
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  private mustGet(sessionId: string): PtySession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No terminal session with id ${sessionId}`);
    }
    return session;
  }
}
