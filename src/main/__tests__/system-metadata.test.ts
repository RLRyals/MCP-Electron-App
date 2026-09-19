/**
 * bead mea-ndz: saveStartupMetadata must not clobber updater-owned keys, and
 * checkForMCPServersUpdate must self-heal from the clone's HEAD.
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sysmeta-'));

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => tmp), getVersion: jest.fn(() => '9.9.9'), isPackaged: false },
}));

import { updateSystemMetadata, readSystemMetadata, getSystemMetadataPath } from '../system-metadata';

const metaPath = () => getSystemMetadataPath();

describe('system-metadata read-merge-write', () => {
  beforeEach(() => fs.removeSync(metaPath()));
  afterAll(() => fs.removeSync(tmp));

  it('startup-style write preserves mcpServers, customClients, updatePreferences', async () => {
    await updateSystemMetadata((m: any) => {
      m.mcpServers = { sha: 'abc1234' };
      m.customClients = { c: { sha: 'x' } };
      m.updatePreferences = { autoCheck: true };
    });
    await updateSystemMetadata((m: any) => {
      m.lastStarted = 'now';
      m.version = '9.9.9';
    });
    const m: any = await readSystemMetadata();
    expect(m.mcpServers.sha).toBe('abc1234');
    expect(m.customClients.c.sha).toBe('x');
    expect(m.updatePreferences.autoCheck).toBe(true);
    expect(m.lastStarted).toBe('now');
  });

  it('serializes concurrent writers', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => updateSystemMetadata((m: any) => { m['k' + i] = i; }))
    );
    const m: any = await readSystemMetadata();
    expect(Object.keys(m)).toHaveLength(20);
  });
});
