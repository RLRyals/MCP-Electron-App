/**
 * Unit tests for src/main/database-backup.ts -- the module backing the
 * `database-backup:*` IPC handlers registered in src/main/index.ts (issue
 * #126, Database Tab Foundation and IPC Handlers). #130 (Backup Management
 * UI) builds its UI on top of these handlers.
 *
 * All I/O (child_process exec, fs-extra, Electron dialog/app) is mocked --
 * no real Docker container, Postgres instance, or filesystem access is
 * required. This also documents (via the exec command assertions) that
 * backups operate against the `fictionlab-postgres` container and are
 * written under Electron's userData directory, not the
 * `C:\Backups\fictionlab` path used by the separate "FictionLab DB Daily
 * Backup" Windows Task -- confirming the two don't collide.
 */

const mockExecAsync = jest.fn();
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: () => mockExecAsync,
}));

jest.mock('../logger', () => ({
  LogCategory: { SYSTEM: 'SYSTEM' },
  logWithCategory: jest.fn(),
}));

jest.mock('../prerequisites', () => ({
  getFixedEnv: jest.fn(() => ({ PATH: '/usr/bin' })),
}));

const mockLoadEnvConfig = jest.fn();
jest.mock('../env-config', () => ({
  loadEnvConfig: (...args: any[]) => mockLoadEnvConfig(...args),
}));

const mockShowSaveDialog = jest.fn();
const mockShowOpenDialog = jest.fn();
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => 'C:/fake-userdata'),
  },
  dialog: {
    showSaveDialog: (...args: any[]) => mockShowSaveDialog(...args),
    showOpenDialog: (...args: any[]) => mockShowOpenDialog(...args),
  },
  shell: {
    openPath: jest.fn(),
  },
}));

import * as fs from 'fs-extra';
jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

import * as databaseBackup from '../database-backup';

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadEnvConfig.mockResolvedValue({
    POSTGRES_DB: 'mcp_writing_db',
    POSTGRES_USER: 'postgres',
    POSTGRES_PASSWORD: 'secret',
  });
  mockedFs.ensureDir.mockResolvedValue(undefined as any);
  mockedFs.pathExists.mockResolvedValue(true as any);
});

describe('createBackup', () => {
  it('runs pg_dump inside the fictionlab-postgres container and writes the output to disk', async () => {
    mockExecAsync.mockResolvedValue({ stdout: 'BINARYDUMP', stderr: '' });
    mockedFs.writeFile.mockResolvedValue(undefined as any);
    mockedFs.stat.mockResolvedValue({ size: 2048 } as any);

    const result = await databaseBackup.createBackup();

    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();
    expect(result.size).toBe(2048);

    const [command] = mockExecAsync.mock.calls[0];
    expect(command).toContain('docker exec fictionlab-postgres pg_dump');
    expect(command).toContain('-U postgres');
    expect(command).toContain('-d mcp_writing_db');

    expect(mockedFs.writeFile).toHaveBeenCalledWith(expect.any(String), 'BINARYDUMP');
  });

  it('writes backups under the Electron userData directory by default (not C:\\Backups\\fictionlab)', async () => {
    mockExecAsync.mockResolvedValue({ stdout: 'BINARYDUMP', stderr: '' });
    mockedFs.writeFile.mockResolvedValue(undefined as any);
    mockedFs.stat.mockResolvedValue({ size: 1024 } as any);

    const result = await databaseBackup.createBackup();

    expect(result.path).toContain('fake-userdata');
    expect(result.path).not.toContain('Backups');
  });

  it('honors a custom backup path when provided', async () => {
    mockExecAsync.mockResolvedValue({ stdout: 'BINARYDUMP', stderr: '' });
    mockedFs.writeFile.mockResolvedValue(undefined as any);
    mockedFs.stat.mockResolvedValue({ size: 512 } as any);

    const result = await databaseBackup.createBackup('D:/custom/my-backup.sql.gz');

    expect(result.path).toBe('D:/custom/my-backup.sql.gz');
    expect(mockedFs.writeFile).toHaveBeenCalledWith('D:/custom/my-backup.sql.gz', 'BINARYDUMP');
  });

  it('uses plain SQL pg_dump (no -Fc/-Z) when compressed=false', async () => {
    mockExecAsync.mockResolvedValue({ stdout: 'PLAINSQL', stderr: '' });
    mockedFs.writeFile.mockResolvedValue(undefined as any);
    mockedFs.stat.mockResolvedValue({ size: 100 } as any);

    await databaseBackup.createBackup(undefined, false);

    const [command] = mockExecAsync.mock.calls[0];
    expect(command).not.toContain('-Fc');
  });

  it('returns a failure result (not a throw) when pg_dump fails', async () => {
    mockExecAsync.mockRejectedValue(new Error('docker: container not found'));

    const result = await databaseBackup.createBackup();

    expect(result.success).toBe(false);
    expect(result.error).toContain('container not found');
    expect(mockedFs.writeFile).not.toHaveBeenCalled();
  });
});

describe('restoreBackup', () => {
  it('rejects when the backup file does not exist', async () => {
    mockedFs.pathExists.mockResolvedValue(false as any);

    const result = await databaseBackup.restoreBackup('C:/missing.sql.gz');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(mockExecAsync).not.toHaveBeenCalled();
  });

  it('copies the backup into the container and runs pg_restore for a compressed backup', async () => {
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

    const result = await databaseBackup.restoreBackup('C:/backups/mcp_writing_db_2026-01-01.sql.gz');

    expect(result.success).toBe(true);
    const commands = mockExecAsync.mock.calls.map((call) => call[0]);
    expect(commands.some((c) => c.startsWith('docker cp'))).toBe(true);
    expect(commands.some((c) => c.includes('pg_restore'))).toBe(true);
  });

  it('runs psql (not pg_restore) for an uncompressed .sql backup', async () => {
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

    await databaseBackup.restoreBackup('C:/backups/mcp_writing_db_2026-01-01.sql');

    const commands = mockExecAsync.mock.calls.map((call) => call[0]);
    expect(commands.some((c) => c.includes('psql') && c.includes('-f'))).toBe(true);
    expect(commands.some((c) => c.includes('pg_restore'))).toBe(false);
  });

  it('drops and recreates the database first when dropExisting is true', async () => {
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

    await databaseBackup.restoreBackup('C:/backups/mcp_writing_db_2026-01-01.sql.gz', true);

    const commands = mockExecAsync.mock.calls.map((call) => call[0]);
    expect(commands.some((c) => c.includes('pg_terminate_backend'))).toBe(true);
    expect(commands.some((c) => c.includes('dropdb'))).toBe(true);
    expect(commands.some((c) => c.includes('createdb'))).toBe(true);
  });

  it('treats stderr containing ERROR as a failed restore', async () => {
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: 'ERROR: relation does not exist' });

    const result = await databaseBackup.restoreBackup('C:/backups/mcp_writing_db_2026-01-01.sql.gz');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ERROR');
  });

  it('does not fail the restore if only the container cleanup step throws', async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // docker cp
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // pg_restore
      .mockRejectedValueOnce(new Error('rm failed')); // cleanup

    const result = await databaseBackup.restoreBackup('C:/backups/mcp_writing_db_2026-01-01.sql.gz');

    expect(result.success).toBe(true);
  });
});

describe('listBackups', () => {
  it('returns only .sql/.sql.gz files, sorted newest first', async () => {
    mockedFs.readdir.mockResolvedValue(['ignore.txt', 'mcp_writing_db_2026-01-01.sql', 'mcp_writing_db_2026-02-01.sql.gz'] as any);
    mockedFs.stat.mockImplementation(async (p: any) => {
      const path = String(p);
      if (path.includes('2026-01-01')) return { mtime: new Date('2026-01-01'), size: 100 } as any;
      return { mtime: new Date('2026-02-01'), size: 200 } as any;
    });

    const result = await databaseBackup.listBackups();

    expect(result.success).toBe(true);
    expect(result.backups).toHaveLength(2);
    expect(result.backups[0].filename).toBe('mcp_writing_db_2026-02-01.sql.gz');
    expect(result.backups[0].compressed).toBe(true);
    expect(result.backups[1].compressed).toBe(false);
  });

  it('returns an empty, successful result when the directory has no backups', async () => {
    mockedFs.readdir.mockResolvedValue([] as any);

    const result = await databaseBackup.listBackups();

    expect(result).toEqual({ success: true, backups: [] });
  });

  it('returns a failure result if the directory cannot be read', async () => {
    mockedFs.readdir.mockRejectedValue(new Error('EACCES'));

    const result = await databaseBackup.listBackups();

    expect(result.success).toBe(false);
    expect(result.backups).toEqual([]);
    expect(result.error).toContain('EACCES');
  });
});

describe('deleteBackup', () => {
  it('deletes an existing backup file', async () => {
    mockedFs.remove.mockResolvedValue(undefined as any);

    const result = await databaseBackup.deleteBackup('C:/backups/old.sql');

    expect(result.success).toBe(true);
    expect(mockedFs.remove).toHaveBeenCalledWith('C:/backups/old.sql');
  });

  it('fails without touching the filesystem if the file is missing', async () => {
    mockedFs.pathExists.mockResolvedValue(false as any);

    const result = await databaseBackup.deleteBackup('C:/backups/missing.sql');

    expect(result.success).toBe(false);
    expect(mockedFs.remove).not.toHaveBeenCalled();
  });
});

describe('save/open dialogs', () => {
  it('returns null (not a throw) when the save dialog is canceled', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: true });

    const result = await databaseBackup.selectBackupSaveLocation();

    expect(result).toBeNull();
  });

  it('returns the chosen path from the save dialog', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: 'C:/chosen/backup.sql.gz' });

    const result = await databaseBackup.selectBackupSaveLocation();

    expect(result).toBe('C:/chosen/backup.sql.gz');
  });

  it('returns null when the restore-file open dialog is canceled', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    const result = await databaseBackup.selectBackupFileForRestore();

    expect(result).toBeNull();
  });

  it('returns the chosen path from the open dialog', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:/chosen/restore.sql'] });

    const result = await databaseBackup.selectBackupFileForRestore();

    expect(result).toBe('C:/chosen/restore.sql');
  });
});

describe('getBackupDirectoryPath', () => {
  it('resolves under the Electron userData directory', () => {
    expect(databaseBackup.getBackupDirectoryPath()).toBe(require('path').join('C:/fake-userdata', 'backups'));
  });
});
