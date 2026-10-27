/**
 * Pre-migration backup guard in DatabaseMigrator.runMigrations
 */
jest.mock('../database-backup', () => ({
  createBackup: jest.fn(),
  getBackupDirectory: jest.fn(() => '/tmp/backups'),
}));
jest.mock('../logger', () => ({
  logWithCategory: jest.fn(),
  LogCategory: { SYSTEM: 'system' },
}));
jest.mock('../prerequisites', () => ({ getFixedEnv: jest.fn(() => ({})) }));
jest.mock('../env-config', () => ({}));

import { DatabaseMigrator } from '../database-migrator';
import * as databaseBackup from '../database-backup';

const createBackup = databaseBackup.createBackup as jest.Mock;

function makeMigrator(applied: string[], available: string[]) {
  const m = new DatabaseMigrator('/repo', { POSTGRES_USER: 'u', POSTGRES_DB: 'db' } as any);
  const proto: any = m;
  const order: string[] = [];
  proto.checkDatabaseReady = jest.fn().mockResolvedValue(true);
  proto.ensureMigrationsTable = jest.fn().mockResolvedValue(undefined);
  proto.getAppliedMigrations = jest.fn().mockResolvedValue(applied);
  proto.getAvailableMigrations = jest.fn().mockResolvedValue(
    available.map((f, i) => ({ filename: f, version: i + 1, name: f, fullPath: `/repo/migrations/${f}` }))
  );
  proto.applyMigration = jest.fn().mockImplementation(async (mig: any) => {
    order.push(`migrate:${mig.filename}`);
  });
  createBackup.mockImplementation(async () => {
    order.push('backup');
    return { success: true, message: 'ok', path: '/tmp/backups/db_pre-migration_x.dump' };
  });
  return { m, proto, order };
}

describe('DatabaseMigrator pre-migration backup', () => {
  beforeEach(() => createBackup.mockReset());

  it('backs up before running any pending migration', async () => {
    const { m, order } = makeMigrator(['001.sql'], ['001.sql', '002.sql', '003.sql']);
    const messages: string[] = [];
    const result = await m.runMigrations((msg) => messages.push(msg));
    expect(result.success).toBe(true);
    expect(order).toEqual(['backup', 'migrate:002.sql', 'migrate:003.sql']);
    expect(createBackup).toHaveBeenCalledTimes(1);
    const [customPath, compressed] = createBackup.mock.calls[0];
    expect(customPath).toMatch(/pre-migration_.*\.dump$/);
    expect(compressed).toBe(true);
    expect(result.backupPath).toBe('/tmp/backups/db_pre-migration_x.dump');
    expect(messages.some((x) => x.includes('/tmp/backups/db_pre-migration_x.dump'))).toBe(true);
  });

  it('does not migrate when the backup fails', async () => {
    const { m, proto } = makeMigrator([], ['001.sql']);
    createBackup.mockResolvedValue({ success: false, message: 'fail', error: 'docker down' });
    const result = await m.runMigrations();
    expect(result.success).toBe(false);
    expect(proto.applyMigration).not.toHaveBeenCalled();
    expect(result.error).toContain('docker down');
    expect(result.error).toContain('database is unchanged');
  });

  it('takes no backup when there are no pending migrations', async () => {
    const { m, proto } = makeMigrator(['001.sql'], ['001.sql']);
    const result = await m.runMigrations();
    expect(result.success).toBe(true);
    expect(createBackup).not.toHaveBeenCalled();
    expect(proto.applyMigration).not.toHaveBeenCalled();
  });

  it('names the backup file and restore steps when a migration fails', async () => {
    const { m, proto } = makeMigrator([], ['001.sql']);
    proto.applyMigration.mockRejectedValue(new Error('syntax error'));
    const result = await m.runMigrations();
    expect(result.success).toBe(false);
    expect(result.error).toContain('syntax error');
    expect(result.error).toContain('/tmp/backups/db_pre-migration_x.dump');
    expect(result.error).toContain('Restore');
    expect(result.backupPath).toBe('/tmp/backups/db_pre-migration_x.dump');
  });
});
