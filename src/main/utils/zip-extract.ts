/**
 * Zip extraction utility.
 *
 * Deliberately Electron-free (only `child_process`/`fs-extra`) so it can be
 * imported by Electron-light modules without dragging in the main process's
 * full bootstrap chain (`ipcMain`, `app`, the plugin manager, etc.).
 * Originally lived inline in handlers/plugin-update-handlers.ts; pulled out
 * here so the GitHub-release plugin updater (bead mea-6tt,
 * plugin-github-updater.ts) can reuse it without importing that handler
 * file's `electron`/`plugin-manager` dependencies -- which pull in
 * `main/index.ts`'s app-bootstrap side effects and made plugin-github-updater
 * tests noisy (stray post-teardown logging from `ensureDockerReadyForLaunch`).
 */

import * as fs from 'fs-extra';

/**
 * Extract a zip file to a destination directory (created if missing).
 * Uses PowerShell's Expand-Archive on Windows, `unzip` elsewhere.
 */
export async function extractZip(zipPath: string, destPath: string): Promise<void> {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  await fs.ensureDir(destPath);

  if (process.platform === 'win32') {
    // Use PowerShell on Windows
    await execAsync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`,
      { timeout: 60000 }
    );
  } else {
    // Use unzip on Unix
    await execAsync(`unzip -o "${zipPath}" -d "${destPath}"`, { timeout: 60000 });
  }
}
