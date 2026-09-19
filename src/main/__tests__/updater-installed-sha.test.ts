/** bead mea-ndz: self-heal current version from the clone's HEAD. */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'updsha-'));
const LATEST = 'f'.repeat(40);
let headSha = '1234567890abcdef1234567890abcdef12345678';

jest.mock('electron', () => ({ app: { getPath: jest.fn(() => tmp), getVersion: jest.fn(() => '1.0.0') } }));
jest.mock('child_process', () => ({
  exec: Object.assign(
    jest.fn((cmd: string, opts: any, cb: any) => cb(null, { stdout: headSha + '\n', stderr: '' })),
    { [require('util').promisify.custom]: jest.fn(async () => ({ stdout: headSha + '\n', stderr: '' })) }
  ),
}));
jest.mock('../logger', () => {
  const l = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return { __esModule: true, default: l, logWithCategory: jest.fn(), LogCategory: { SYSTEM: 'SYSTEM', DOCKER: 'DOCKER' } };
});
jest.mock('../mcp-system', () => ({}));
jest.mock('../prerequisites', () => ({ checkDockerRunning: jest.fn() }));
jest.mock('../database-migrator', () => ({ DatabaseMigrator: jest.fn() }));
jest.mock('../client-selection', () => ({}));
jest.mock('../env-config', () => ({}));
jest.mock('../release-notes', () => ({ getChangeList: jest.fn() }));

import { checkForMCPServersUpdate } from '../updater';

const repoDir = path.join(tmp, 'repositories', 'mcp-writing-servers');

beforeEach(() => {
  fs.removeSync(path.join(tmp, '.system-metadata.json'));
  fs.removeSync(repoDir);
  (global as any).fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ sha: LATEST, commit: { committer: { date: '2026-09-01T00:00:00Z' }, message: 'subject\nbody' } }),
  }));
});
afterAll(() => fs.removeSync(tmp));

it('metadata lacks sha but clone exists -> uses clone HEAD', async () => {
  fs.ensureDirSync(path.join(repoDir, '.git'));
  const r = await checkForMCPServersUpdate();
  expect(r.currentVersion).toBe('1234567');
  expect(r.available).toBe(true);
  headSha = LATEST;
  const r2 = await checkForMCPServersUpdate();
  expect(r2.available).toBe(false);
  headSha = '1234567890abcdef1234567890abcdef12345678';
});

it('no clone -> Not installed', async () => {
  const r = await checkForMCPServersUpdate();
  expect(r.currentVersion).toBe('Not installed');
});
