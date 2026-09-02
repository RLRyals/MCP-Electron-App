/**
 * Tests for syncComposeIfChanged() (mea-a3o).
 *
 * Verifies the upgrade path where the ONLY change in a release is
 * docker-compose.yml: it must be detected by content hash (not version
 * number) and, when the stack is already running, the stack must be
 * recreated automatically rather than waiting for a manual restart.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { promisify } from 'util';

let testUserDataDir: string;
let testResourcesDir: string;

// mcp-system.ts pulls in Electron and a wide slice of the main process at
// import time; none of that is under test here. In dev mode
// (isPackaged: false) getBundledResourcesPath() resolves to
// `<app.getAppPath()>/../..`, so point getAppPath() two levels below the
// real repo root (which does contain the real docker-compose.yml) and
// getPath('userData') at a scratch tmp dir for the "deployed" copy.
jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(() => '0.0.0-test'),
    getPath: jest.fn(() => testUserDataDir),
    getAppPath: jest.fn(() => path.join(testResourcesDir, 'a', 'b')),
    isPackaged: false,
  },
}));
jest.mock('../logger', () => ({
  logWithCategory: jest.fn(),
  LogCategory: { DOCKER: 'DOCKER', SYSTEM: 'SYSTEM' },
}));
jest.mock('../client-selection', () => ({ loadClientSelection: jest.fn() }));
jest.mock('../typingmind-auto-config', () => ({}));
jest.mock('../mcp-config-generator', () => ({
  getMCPConfigPath: jest.fn(() => '/tmp/mcp-config.json'),
  generateMCPConfig: jest.fn(() => ({ success: true })),
}));
jest.mock('../pgbouncer-config', () => ({ generatePgBouncerConfig: jest.fn(() => ({ success: true })) }));
jest.mock('../prerequisites', () => ({
  checkDockerRunning: jest.fn(() => ({ running: true })),
  getFixedEnv: jest.fn(() => process.env),
  getPlatform: jest.fn(() => 'windows'),
}));
jest.mock('../docker', () => ({ startAndWaitForDocker: jest.fn(() => ({ success: true })) }));

const testConfig = {
  MCP_AUTH_TOKEN: 'token',
  POSTGRES_PASSWORD: 'password',
  POSTGRES_DB: 'db',
  POSTGRES_USER: 'user',
  POSTGRES_PORT: 5432,
  PGBOUNCER_PORT: 6432,
  MCP_CONNECTOR_PORT: 3000,
  HTTP_SSE_PORT: 3001,
  DB_ADMIN_PORT: 3010,
  NPE_PORT: 3006,
  WORKFLOW_MANAGER_PORT: 3007,
  OUTLINE_PORT: 3008,
  KANBAN_PORT: 3011,
  STORY_ANALYSIS_PORT: 3012,
  SERIES_PORT: 3002,
  CHAPTER_PORT: 3003,
  CHARACTER_PORT: 3004,
  SCENE_PORT: 3005,
  AUTHOR_PORT: 3009,
};
jest.mock('../env-config', () => ({
  loadEnvConfig: jest.fn(() => testConfig),
  checkAllPortsAndSuggestAlternatives: jest.fn(() => ({ hasConflicts: false, conflicts: [] })),
}));

// child_process.exec is promisified in mcp-system.ts at module load time
// (`const execAsync = promisify(exec)`). Node's real child_process.exec has
// a custom `util.promisify.custom` implementation that resolves to
// `{stdout, stderr}`; a plain jest.fn() mock loses that, so we attach the
// same custom symbol here to keep execDockerCompose()'s `.stdout` reads working.
const execPromiseImpl = jest.fn();
function execMock(..._args: any[]) { /* never called directly - only via promisify.custom */ }
(execMock as any)[(promisify as any).custom] = execPromiseImpl;
jest.mock('child_process', () => ({ exec: execMock }));

describe('syncComposeIfChanged', () => {
  let dockerDir: string;
  let deployedCompose: string;
  let bundledCompose: string;

  beforeEach(async () => {
    testUserDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fictionlab-compose-sync-'));
    testResourcesDir = process.cwd();
    dockerDir = path.join(testUserDataDir, 'docker');
    await fs.ensureDir(dockerDir);
    deployedCompose = path.join(dockerDir, 'docker-compose.yml');
    bundledCompose = path.join(testResourcesDir, 'docker-compose.yml');

    jest.resetModules();
    execPromiseImpl.mockReset();
  });

  afterEach(async () => {
    await fs.remove(testUserDataDir);
  });

  it('reports no change when the deployed compose matches the bundled one', async () => {
    await fs.copy(bundledCompose, deployedCompose);

    const mcpSystem = require('../mcp-system');
    const result = await mcpSystem.syncComposeIfChanged();

    expect(result).toEqual({ changed: false, recreated: false });
    expect(execPromiseImpl).not.toHaveBeenCalled();
  });

  it('is a no-op when there is no deployed compose yet (fresh install)', async () => {
    // deployedCompose intentionally not written
    const mcpSystem = require('../mcp-system');
    const result = await mcpSystem.syncComposeIfChanged();

    expect(result).toEqual({ changed: false, recreated: false });
    expect(execPromiseImpl).not.toHaveBeenCalled();
  });

  it('detects a changed compose but does not force a recreate when the stack is not running', async () => {
    await fs.writeFile(deployedCompose, 'services:\n  old-service:\n    image: old\n');

    execPromiseImpl.mockImplementation((cmd: string) => {
      if (cmd.includes(' ps ')) {
        return Promise.resolve({ stdout: '', stderr: '' });
      }
      return Promise.resolve({ stdout: '', stderr: '' });
    });

    const mcpSystem = require('../mcp-system');
    const result = await mcpSystem.syncComposeIfChanged();

    expect(result).toEqual({ changed: true, recreated: false });
  });

  it('recreates the stack (down then up) when the compose changed and containers are running', async () => {
    await fs.writeFile(deployedCompose, 'services:\n  old-service:\n    image: old\n');

    const commandsRun: string[] = [];
    execPromiseImpl.mockImplementation((cmd: string) => {
      commandsRun.push(cmd);
      if (cmd.includes(' ps ')) {
        return Promise.resolve({
          stdout: JSON.stringify({ Name: 'fictionlab-postgres', Service: 'postgres', State: 'running', Health: 'healthy' }) + '\n',
          stderr: '',
        });
      }
      return Promise.resolve({ stdout: '', stderr: '' });
    });

    const mcpSystem = require('../mcp-system');
    const result = await mcpSystem.syncComposeIfChanged();

    expect(result.changed).toBe(true);
    expect(result.recreated).toBe(true);
    expect(commandsRun.some(c => c.includes(' down'))).toBe(true);
    expect(commandsRun.some(c => c.includes(' up '))).toBe(true);

    // The bundled compose must have been copied over the deployed one.
    const deployedContentAfter = await fs.readFile(deployedCompose, 'utf-8');
    const bundledContent = await fs.readFile(bundledCompose, 'utf-8');
    expect(deployedContentAfter).toBe(bundledContent);
  }, 15000);
});
