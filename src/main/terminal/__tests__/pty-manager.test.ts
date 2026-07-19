jest.mock('../../logger', () => ({
  LogCategory: { TERMINAL: 'TERMINAL' },
  logWithCategory: jest.fn(),
}));

function makeFakePty() {
  const listeners: { data?: (d: string) => void; exit?: (e: { exitCode: number; signal?: number }) => void } = {};
  return {
    pid: 4242,
    onData: jest.fn((cb: (d: string) => void) => {
      listeners.data = cb;
    }),
    onExit: jest.fn((cb: (e: { exitCode: number; signal?: number }) => void) => {
      listeners.exit = cb;
    }),
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
    __listeners: listeners,
  };
}

const spawnMock = jest.fn();

jest.mock('node-pty', () => ({
  spawn: (...args: any[]) => spawnMock(...args),
}));

import { PtyManager, buildSpawnEnv } from '../pty-manager';
import type { TerminalProfile } from '../types';

const profile: TerminalProfile = {
  id: 'test-profile',
  name: 'Test',
  cwd: 'C:/somewhere',
  command: 'claude',
  env: { FOO: 'bar' },
};

describe('buildSpawnEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ELECTRON_RUN_AS_NODE: '1', EXISTING: 'yes' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('strips ELECTRON_RUN_AS_NODE even when inherited', () => {
    const env = buildSpawnEnv();
    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined();
    expect(env.EXISTING).toBe('yes');
  });

  it('merges profile env overrides on top of process env', () => {
    const env = buildSpawnEnv({ FOO: 'bar', EXISTING: 'overridden' });
    expect(env.FOO).toBe('bar');
    expect(env.EXISTING).toBe('overridden');
  });
});

describe('PtyManager', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('isSupported() is true when node-pty loads', () => {
    const manager = new PtyManager();
    expect(manager.isSupported()).toBe(true);
  });

  it('spawn() calls node-pty.spawn with the profile command/args/cwd/env', () => {
    const fake = makeFakePty();
    spawnMock.mockReturnValue(fake);
    const manager = new PtyManager();

    manager.spawn('session-1', profile, 80, 24, jest.fn(), jest.fn());

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnMock.mock.calls[0];
    expect(command).toBe('claude');
    expect(args).toEqual([]);
    expect(options.cwd).toBe('C:/somewhere');
    expect(options.cols).toBe(80);
    expect(options.rows).toBe(24);
    expect(options.env.FOO).toBe('bar');
    expect(manager.has('session-1')).toBe(true);
  });

  it('throws when spawning a duplicate session id', () => {
    spawnMock.mockReturnValue(makeFakePty());
    const manager = new PtyManager();
    manager.spawn('dup', profile, 80, 24, jest.fn(), jest.fn());
    expect(() => manager.spawn('dup', profile, 80, 24, jest.fn(), jest.fn())).toThrow(/already exists/i);
  });

  it('routes PTY data to the onData callback with the session id', () => {
    const fake = makeFakePty();
    spawnMock.mockReturnValue(fake);
    const manager = new PtyManager();
    const onData = jest.fn();

    manager.spawn('session-2', profile, 80, 24, onData, jest.fn());
    fake.__listeners.data!('hello world');

    expect(onData).toHaveBeenCalledWith('session-2', 'hello world');
  });

  it('removes the session and fires onExit when the PTY process exits', () => {
    const fake = makeFakePty();
    spawnMock.mockReturnValue(fake);
    const manager = new PtyManager();
    const onExit = jest.fn();

    manager.spawn('session-3', profile, 80, 24, jest.fn(), onExit);
    expect(manager.has('session-3')).toBe(true);

    fake.__listeners.exit!({ exitCode: 0, signal: undefined });

    expect(onExit).toHaveBeenCalledWith('session-3', 0, undefined);
    expect(manager.has('session-3')).toBe(false);
  });

  it('write()/resize() delegate to the underlying PTY process', () => {
    const fake = makeFakePty();
    spawnMock.mockReturnValue(fake);
    const manager = new PtyManager();
    manager.spawn('session-4', profile, 80, 24, jest.fn(), jest.fn());

    manager.write('session-4', 'ls\r');
    manager.resize('session-4', 120, 40);

    expect(fake.write).toHaveBeenCalledWith('ls\r');
    expect(fake.resize).toHaveBeenCalledWith(120, 40);
  });

  it('write()/resize() throw for an unknown session id', () => {
    const manager = new PtyManager();
    expect(() => manager.write('missing', 'x')).toThrow(/no terminal session/i);
    expect(() => manager.resize('missing', 10, 10)).toThrow(/no terminal session/i);
  });

  it('kill() terminates the process and removes the session; is a no-op for an unknown id', () => {
    const fake = makeFakePty();
    spawnMock.mockReturnValue(fake);
    const manager = new PtyManager();
    manager.spawn('session-5', profile, 80, 24, jest.fn(), jest.fn());

    manager.kill('session-5');
    expect(fake.kill).toHaveBeenCalled();
    expect(manager.has('session-5')).toBe(false);

    expect(() => manager.kill('never-spawned')).not.toThrow();
  });

  it('killAll() kills every live session, leaving none orphaned', () => {
    const fakeA = makeFakePty();
    const fakeB = makeFakePty();
    spawnMock.mockReturnValueOnce(fakeA).mockReturnValueOnce(fakeB);
    const manager = new PtyManager();

    manager.spawn('a', profile, 80, 24, jest.fn(), jest.fn());
    manager.spawn('b', profile, 80, 24, jest.fn(), jest.fn());
    manager.killAll();

    expect(fakeA.kill).toHaveBeenCalled();
    expect(fakeB.kill).toHaveBeenCalled();
    expect(manager.has('a')).toBe(false);
    expect(manager.has('b')).toBe(false);
  });
});
