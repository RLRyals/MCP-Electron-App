/**
 * Terminal profile: describes what command a spawned PTY session should
 * run, in which directory, and with which environment overrides.
 *
 * This shape (id/name/cwd/command/args/env) is the persisted config format
 * loaded/saved by profiles.ts -- extend it, don't replace it, so existing
 * saved profile files keep loading.
 */
export interface TerminalProfile {
  id: string;
  name: string;
  cwd: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface SpawnTerminalParams {
  sessionId: string;
  profileId?: string;
  cols?: number;
  rows?: number;
}

export interface WriteTerminalParams {
  sessionId: string;
  data: string;
}

export interface ResizeTerminalParams {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface KillTerminalParams {
  sessionId: string;
}

export interface TerminalDataEvent {
  sessionId: string;
  data: string;
}

export interface TerminalExitEvent {
  sessionId: string;
  exitCode: number;
  signal?: number;
}
