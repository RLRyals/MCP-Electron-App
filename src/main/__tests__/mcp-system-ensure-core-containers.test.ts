/**
 * Tests for ensureCoreContainers()'s full-stack restoration behavior (mea-5fh).
 *
 * The launch/focus gate only asks ensureCoreContainers() to bring up
 * postgres/pgbouncer. If mcp-connector/mcp-writing-servers were previously
 * part of this compose project (recreate dropped them, or the user manually
 * stopped them and forgot to restart), that must not be silently left down -
 * ensureCoreContainers() should notice via `docker compose ps -a` and restore
 * them alongside the core containers.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { promisify } from 'util';

let testUserDataDir: string;
let testResourcesDir: string;

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

// See mcp-system-compose-sync.test.ts for why this custom-symbol dance is needed.
const execPromiseImpl = jest.fn();
function execMock(..._args: any[]) { /* never called directly - only via promisify.custom */ }
(execMock as any)[(promisify as any).custom] = execPromiseImpl;
jest.mock('child_process', () => ({ exec: execMock }));

function containerLine(name: string, service: string, state: string) {
  return JSON.stringify({ Name: name, Service: service, State: state, Health: state === 'running' ? 'healthy' : undefined });
}

describe('ensureCoreContainers - full-stack restoration (mea-5fh)', () => {
  beforeEach(async () => {
    testUserDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fictionlab-ensure-core-'));
    testResourcesDir = process.cwd();
    jest.resetModules();
    execPromiseImpl.mockReset();
  });

  afterEach(async () => {
    await fs.remove(testUserDataDir);
  });

  it('restores mcp-connector/mcp-writing-servers when they previously existed but are stopped, even though core is already healthy', async () => {
    const commandsRun: string[] = [];
    let upCalled = false;

    execPromiseImpl.mockImplementation((cmd: string) => {
      commandsRun.push(cmd);

      if (cmd.includes(' ps -a ')) {
        // Full history: all four containers have existed in this project.
        return Promise.resolve({
          stdout: [
            containerLine('fictionlab-postgres', 'postgres', 'running'),
            containerLine('fictionlab-pgbouncer', 'pgbouncer', 'running'),
            containerLine('fictionlab-mcp-connector', 'mcp-connector', upCalled ? 'running' : 'exited'),
            containerLine('fictionlab-mcp-servers', 'mcp-writing-servers', upCalled ? 'running' : 'exited'),
          ].join('\n'),
          stderr: '',
        });
      }

      if (cmd.includes(' ps ')) {
        // Plain ps (running only): core is healthy from the start; the other
        // two only show up as running once `up` has been called for them.
        const lines = [
          containerLine('fictionlab-postgres', 'postgres', 'running'),
          containerLine('fictionlab-pgbouncer', 'pgbouncer', 'running'),
        ];
        if (upCalled) {
          lines.push(containerLine('fictionlab-mcp-connector', 'mcp-connector', 'running'));
          lines.push(containerLine('fictionlab-mcp-servers', 'mcp-writing-servers', 'running'));
        }
        return Promise.resolve({ stdout: lines.join('\n'), stderr: '' });
      }

      if (cmd.includes(' up ')) {
        upCalled = true;
      }

      return Promise.resolve({ stdout: '', stderr: '' });
    });

    const mcpSystem = require('../mcp-system');
    const result = await mcpSystem.ensureCoreContainers();

    expect(result.success).toBe(true);
    expect(result.message).toContain('mcp-connector');
    expect(result.message).toContain('mcp-writing-servers');

    const upCommand = commandsRun.find(c => c.includes(' up '));
    expect(upCommand).toBeDefined();
    expect(upCommand).toContain('postgres');
    expect(upCommand).toContain('pgbouncer');
    expect(upCommand).toContain('mcp-connector');
    expect(upCommand).toContain('mcp-writing-servers');

    expect(commandsRun.some(c => c.includes(' build ') && c.includes('mcp-writing-servers'))).toBe(true);
  }, 15000);

  it('does nothing extra when mcp-connector/mcp-writing-servers were never part of this project', async () => {
    execPromiseImpl.mockImplementation((cmd: string) => {
      if (cmd.includes(' ps -a ') || cmd.includes(' ps ')) {
        return Promise.resolve({
          stdout: [
            containerLine('fictionlab-postgres', 'postgres', 'running'),
            containerLine('fictionlab-pgbouncer', 'pgbouncer', 'running'),
          ].join('\n'),
          stderr: '',
        });
      }
      return Promise.resolve({ stdout: '', stderr: '' });
    });

    const mcpSystem = require('../mcp-system');
    const result = await mcpSystem.ensureCoreContainers();

    expect(result).toEqual({ success: true, message: 'Core containers already running and healthy' });
    expect(execPromiseImpl).toHaveBeenCalledTimes(2); // ps (fast-path) + ps -a (full-stack detection)
  });
});
