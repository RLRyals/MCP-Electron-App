/**
 * Single owner of <userData>/.system-metadata.json (bead mea-ndz).
 *
 * Both updater.ts (mcpServers.sha, customClients, updatePreferences) and
 * mcp-system.ts (lastStarted, version) write this file. Every write goes
 * through updateSystemMetadata(): a serialized read-merge-write, so one
 * writer can never wipe another's keys.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { app } from 'electron';

export function getSystemMetadataPath(): string {
  return path.join(app.getPath('userData'), '.system-metadata.json');
}

export async function readSystemMetadata<T extends object = Record<string, any>>(): Promise<T> {
  try {
    const p = getSystemMetadataPath();
    if (!(await fs.pathExists(p))) return {} as T;
    return JSON.parse(await fs.readFile(p, 'utf-8'));
  } catch {
    return {} as T;
  }
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Load the current file, apply `mutate` (in place), write it back.
 * Calls are queued so concurrent writers cannot interleave.
 */
export function updateSystemMetadata<T extends object = Record<string, any>>(
  mutate: (metadata: T) => void
): Promise<void> {
  const run = async (): Promise<void> => {
    const p = getSystemMetadataPath();
    const metadata = await readSystemMetadata<T>();
    mutate(metadata);
    await fs.ensureDir(path.dirname(p));
    await fs.writeJson(p, metadata, { spaces: 2 });
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}
