/**
 * Tests for the per-service control guard in mcp-system.ts (issue #124).
 *
 * controlService / getContainerResourceUsage receive their arguments over
 * IPC, where TypeScript's compile-time types are erased -- and both values
 * end up interpolated into a shell command line. These tests pin the
 * runtime whitelist that keeps a compromised renderer from injecting
 * arbitrary shell commands or targeting non-FictionLab containers.
 */

// mcp-system.ts pulls in Electron and a wide slice of the main process at
// import time; none of that is under test here.
jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(() => '0.0.0-test'),
    getPath: jest.fn(() => require('os').tmpdir()),
    getAppPath: jest.fn(() => process.cwd()),
    isPackaged: false,
  },
}));
jest.mock('child_process', () => ({ exec: jest.fn() }));
jest.mock('../logger', () => ({
  logWithCategory: jest.fn(),
  LogCategory: { DOCKER: 'DOCKER', SYSTEM: 'SYSTEM' },
}));
jest.mock('../env-config', () => ({ loadEnvConfig: jest.fn() }));
jest.mock('../client-selection', () => ({ loadClientSelection: jest.fn() }));
jest.mock('../typingmind-auto-config', () => ({}));
jest.mock('../mcp-config-generator', () => ({ getMCPConfigPath: jest.fn(() => '/tmp/mcp-config.json') }));
jest.mock('../pgbouncer-config', () => ({}));
jest.mock('../prerequisites', () => ({
  checkDockerRunning: jest.fn(),
  getFixedEnv: jest.fn(() => process.env),
  getPlatform: jest.fn(() => 'windows'),
}));
jest.mock('../docker', () => ({ startAndWaitForDocker: jest.fn() }));

import { exec } from 'child_process';
import {
  validateServiceControlRequest,
  controlService,
  getContainerResourceUsage,
} from '../mcp-system';

describe('validateServiceControlRequest (issue #124 runtime whitelist)', () => {
  it.each([
    ['postgres', 'start'],
    ['postgres', 'stop'],
    ['postgres', 'restart'],
    ['mcp-writing-servers', 'start'],
    ['mcp-connector', 'restart'],
  ])('accepts %s / %s', (service, action) => {
    expect(validateServiceControlRequest(service, action)).toBeNull();
  });

  it('rejects unknown service names', () => {
    expect(validateServiceControlRequest('pgadmin', 'start')).toMatch(/Unknown service/);
  });

  it('rejects shell metacharacters smuggled into the service name', () => {
    expect(validateServiceControlRequest('postgres; rm -rf /', 'start')).toMatch(/Unknown service/);
    expect(validateServiceControlRequest('postgres && curl evil', 'restart')).toMatch(/Unknown service/);
  });

  it('rejects prototype-chain property names', () => {
    expect(validateServiceControlRequest('__proto__', 'start')).toMatch(/Unknown service/);
    expect(validateServiceControlRequest('constructor', 'stop')).toMatch(/Unknown service/);
  });

  it('rejects unknown actions', () => {
    expect(validateServiceControlRequest('postgres', 'up')).toMatch(/Invalid service action/);
    expect(validateServiceControlRequest('postgres', 'start; whoami')).toMatch(/Invalid service action/);
  });
});

describe('controlService rejection path', () => {
  beforeEach(() => {
    (exec as unknown as jest.Mock).mockClear();
  });

  it('fails without shelling out when the service name is not whitelisted', async () => {
    const result = await controlService('evil; whoami' as any, 'start');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown service/);
    expect(exec).not.toHaveBeenCalled();
  });

  it('fails without shelling out when the action is not whitelisted', async () => {
    const result = await controlService('postgres', 'up --build' as any);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid service action/);
    expect(exec).not.toHaveBeenCalled();
  });
});

describe('getContainerResourceUsage rejection path', () => {
  beforeEach(() => {
    (exec as unknown as jest.Mock).mockClear();
  });

  it('returns null without shelling out for unknown service names', async () => {
    const result = await getContainerResourceUsage('evil; whoami' as any);

    expect(result).toBeNull();
    expect(exec).not.toHaveBeenCalled();
  });
});
