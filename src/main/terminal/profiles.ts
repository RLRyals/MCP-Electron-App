/**
 * Terminal launch profiles (mea-bkr).
 *
 * A profile is where a spawned terminal session runs (cwd), what it runs
 * (command/args), and what environment overrides it gets (e.g. a pinned
 * ANTHROPIC_MODEL). Profiles are persisted as JSON in the app's userData
 * directory so they survive restarts and can be hand-edited; on first run
 * (or if the file is missing/corrupt) DEFAULT_PROFILES seeds the list.
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { TerminalProfile } from './types';

const PROFILES_FILE_NAME = 'terminal-profiles.json';

/**
 * Casey pins claude-sonnet-5 by default -- the session model this app's own
 * dispatched agents run under (see ~/.claude/CLAUDE.md). Editable per-profile
 * via the persisted JSON file; not a hardcoded requirement.
 */
export const DEFAULT_PROFILES: TerminalProfile[] = [
  {
    id: 'default',
    name: 'Claude Code',
    cwd: os.homedir(),
    command: 'claude',
  },
  {
    id: 'casey',
    name: 'Casey',
    cwd: path.join(os.homedir(), '.claude', 'casey'),
    command: 'claude',
    env: { ANTHROPIC_MODEL: 'claude-sonnet-5' },
  },
];

export function getProfilesFilePath(userDataDir: string): string {
  return path.join(userDataDir, PROFILES_FILE_NAME);
}

export async function loadProfiles(userDataDir: string): Promise<TerminalProfile[]> {
  const filePath = getProfilesFilePath(userDataDir);
  if (await fs.pathExists(filePath)) {
    try {
      const raw = await fs.readJson(filePath);
      if (Array.isArray(raw) && raw.length > 0) {
        return raw;
      }
    } catch {
      // Corrupt/unreadable file - fall through to defaults rather than crash.
    }
  }
  return DEFAULT_PROFILES;
}

export async function saveProfiles(userDataDir: string, profiles: TerminalProfile[]): Promise<void> {
  await fs.ensureDir(userDataDir);
  await fs.writeJson(getProfilesFilePath(userDataDir), profiles, { spaces: 2 });
}
