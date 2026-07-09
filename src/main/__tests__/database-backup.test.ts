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
  // Point the "scheduled task" directory at a fake path by default so tests
  // that don't care about it (most of them) see it as present-but-empty via
  // the shared readdir mock, instead of touching a real C:\Backups\fictionlab.
  process.env.FICTIONLAB_SCHEDULED_BACKUP_DIR = 'C:/fake-scheduled-backups';
});

afterEach(() => {
  delete process.env.FICTIONLAB_SCHEDULED_BACKUP_DIR;
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

  it('scopes the pg_dump command to specific tables via repeated -t flags (table-level backup, issue #130)', async () => {
    mockExecAsync.mockResolvedValue({ stdout: 'BINARYDUMP', stderr: '' });
    mockedFs.writeFile.mockResolvedValue(undefined as any);
    mockedFs.stat.mockResolvedValue({ size: 2048 } as any);

    const result = await databaseBackup.createBackup(undefined, true, ['characters', 'scenes']);

    expect(result.success).toBe(true);
    expect(result.message).toContain('characters');
    expect(result.message).toContain('scenes');

    const [command] = mockExecAsync.mock.calls[0];
    expect(command).toContain('-t "characters"');
    expect(command).toContain('-t "scenes"');
  });

  it('runs a full backup (no -t flags) when tables is an empty array', async () => {
    mockExecAsync.mockResolvedValue({ stdout: 'BINARYDUMP', stderr: '' });
    mockedFs.writeFile.mockResolvedValue(undefined as any);
    mockedFs.stat.mockResolvedValue({ size: 2048 } as any);

    await databaseBackup.createBackup(undefined, true, []);

    const [command] = mockExecAsync.mock.calls[0];
    expect(command).not.toContain('-t ');
  });

  it('rejects an unsafe table name without ever invoking pg_dump (injection guard)', async () => {
    const result = await databaseBackup.createBackup(undefined, true, ['characters; DROP TABLE users; --']);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid table name');
    expect(mockExecAsync).not.toHaveBeenCalled();
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
    expect(result.backups[0].source).toBe('app');
    expect(result.backups[1].compressed).toBe(false);
    expect(result.backups[1].source).toBe('app');
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

describe('listBackups -- scheduled-task merge (issue #130)', () => {
  const APP_DIR_MARKER = 'fake-userdata';
  const SCHEDULED_DIR = 'C:/fake-scheduled-backups';

  it('merges backups from the app dir and the scheduled-task dir, tagging each source', async () => {
    mockedFs.readdir.mockImplementation(async (dir: any) => {
      const dirStr = String(dir);
      if (dirStr.includes(APP_DIR_MARKER)) {
        return ['mcp_writing_db_2026-01-01.sql'] as any;
      }
      if (dirStr === SCHEDULED_DIR) {
        return [
          'fictionlab-mcp_writing_db-20260201-030000.dump',
          'fictionlab-globals-20260201-030000.sql', // must be excluded
          'backup-log.txt', // must be excluded
        ] as any;
      }
      return [] as any;
    });
    mockedFs.stat.mockImplementation(async (p: any) => {
      const pathStr = String(p);
      if (pathStr.includes('2026-01-01')) return { mtime: new Date('2026-01-01'), size: 111 } as any;
      return { mtime: new Date('2026-02-01'), size: 222 } as any;
    });

    const result = await databaseBackup.listBackups();

    expect(result.success).toBe(true);
    expect(result.backups).toHaveLength(2);

    const scheduled = result.backups.find(b => b.source === 'scheduled-task');
    expect(scheduled).toBeDefined();
    expect(scheduled?.filename).toBe('fictionlab-mcp_writing_db-20260201-030000.dump');
    expect(scheduled?.database).toBe('mcp_writing_db');
    expect(scheduled?.compressed).toBe(true);

    const appBackup = result.backups.find(b => b.source === 'app');
    expect(appBackup).toBeDefined();
    expect(appBackup?.filename).toBe('mcp_writing_db_2026-01-01.sql');

    // Newest first regardless of source
    expect(result.backups[0].source).toBe('scheduled-task');
  });

  it('does not fail listBackups when the scheduled-task directory does not exist', async () => {
    mockedFs.pathExists.mockImplementation(async (p: any) => {
      // App dir existence check (ensureBackupDirectory) should still say "true"-equivalent;
      // fs-extra's ensureDir doesn't call pathExists, so this only affects the scheduled dir check.
      return String(p) !== SCHEDULED_DIR;
    });
    mockedFs.readdir.mockResolvedValue(['mcp_writing_db_2026-01-01.sql'] as any);
    mockedFs.stat.mockResolvedValue({ mtime: new Date('2026-01-01'), size: 100 } as any);

    const result = await databaseBackup.listBackups();

    expect(result.success).toBe(true);
    expect(result.backups).toHaveLength(1);
    expect(result.backups[0].source).toBe('app');
  });

  it('does not fail listBackups when the scheduled-task directory cannot be read', async () => {
    mockedFs.readdir.mockImplementation(async (dir: any) => {
      if (String(dir) === SCHEDULED_DIR) {
        throw new Error('EACCES: permission denied');
      }
      return ['mcp_writing_db_2026-01-01.sql'] as any;
    });
    mockedFs.stat.mockResolvedValue({ mtime: new Date('2026-01-01'), size: 100 } as any);

    const result = await databaseBackup.listBackups();

    expect(result.success).toBe(true);
    expect(result.backups).toHaveLength(1);
    expect(result.backups[0].source).toBe('app');
  });
});

describe('getScheduledTaskBackupDirectory', () => {
  it('defaults to C:\\Backups\\fictionlab when no override is set', () => {
    delete process.env.FICTIONLAB_SCHEDULED_BACKUP_DIR;
    expect(databaseBackup.getScheduledTaskBackupDirectory()).toBe('C:\\Backups\\fictionlab');
  });

  it('honors the FICTIONLAB_SCHEDULED_BACKUP_DIR override', () => {
    process.env.FICTIONLAB_SCHEDULED_BACKUP_DIR = 'D:/custom/path';
    expect(databaseBackup.getScheduledTaskBackupDirectory()).toBe('D:/custom/path');
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

describe('validateBackupFile (issue #130)', () => {
  it('reports missing files as invalid without erroring', async () => {
    mockedFs.pathExists.mockResolvedValue(false as any);

    const result = await databaseBackup.validateBackupFile('C:/backups/missing.dump');

    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('reports empty files as invalid', async () => {
    mockedFs.stat.mockResolvedValue({ size: 0 } as any);

    const result = await databaseBackup.validateBackupFile('C:/backups/empty.sql');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('empty');
  });

  it('accepts a .dump file with a valid PGDMP header', async () => {
    mockedFs.stat.mockResolvedValue({ size: 100 } as any);
    mockedFs.readFile.mockResolvedValue(Buffer.from('PGDMP' + '\x00'.repeat(20)) as any);

    const result = await databaseBackup.validateBackupFile('C:/backups/good.dump');

    expect(result.valid).toBe(true);
  });

  it('rejects a .dump file with a bad header', async () => {
    mockedFs.stat.mockResolvedValue({ size: 100 } as any);
    mockedFs.readFile.mockResolvedValue(Buffer.from('NOT A DUMP FILE AT ALL') as any);

    const result = await databaseBackup.validateBackupFile('C:/backups/corrupt.dump');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('custom-format header');
  });

  it('accepts a .gz file with a valid gzip header', async () => {
    mockedFs.stat.mockResolvedValue({ size: 100 } as any);
    mockedFs.readFile.mockResolvedValue(Buffer.from([0x1f, 0x8b, 0x08, 0x00]) as any);

    const result = await databaseBackup.validateBackupFile('C:/backups/good.sql.gz');

    expect(result.valid).toBe(true);
  });

  it('rejects a .gz file without a gzip header', async () => {
    mockedFs.stat.mockResolvedValue({ size: 100 } as any);
    mockedFs.readFile.mockResolvedValue(Buffer.from('plain text, not gzip') as any);

    const result = await databaseBackup.validateBackupFile('C:/backups/corrupt.sql.gz');

    expect(result.valid).toBe(false);
    expect(result.message).toContain('gzip header');
  });

  it('accepts a plain .sql file with the standard pg_dump header comment', async () => {
    mockedFs.stat.mockResolvedValue({ size: 100 } as any);
    mockedFs.readFile.mockResolvedValue(Buffer.from('--\n-- PostgreSQL database dump\n--\n\nSET statement_timeout = 0;\n') as any);

    const result = await databaseBackup.validateBackupFile('C:/backups/good.sql');

    expect(result.valid).toBe(true);
  });

  it('rejects a plain .sql file that does not look like a pg_dump backup', async () => {
    mockedFs.stat.mockResolvedValue({ size: 100 } as any);
    mockedFs.readFile.mockResolvedValue(Buffer.from('this is just some random text file') as any);

    const result = await databaseBackup.validateBackupFile('C:/backups/notreally.sql');

    expect(result.valid).toBe(false);
  });

  it('returns a failure result (not a throw) if reading the file errors', async () => {
    mockedFs.stat.mockResolvedValue({ size: 100 } as any);
    mockedFs.readFile.mockRejectedValue(new Error('EIO'));

    const result = await databaseBackup.validateBackupFile('C:/backups/broken.dump');

    expect(result.success).toBe(false);
    expect(result.error).toContain('EIO');
  });
});

describe('downloadBackup (issue #130)', () => {
  it('copies the backup to the chosen location and returns its new path/size', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: 'D:/exports/mine.sql.gz' });
    mockedFs.copy.mockResolvedValue(undefined as any);
    mockedFs.stat.mockResolvedValue({ size: 4096 } as any);

    const result = await databaseBackup.downloadBackup('C:/backups/mcp_writing_db_2026-01-01.sql.gz');

    expect(result.success).toBe(true);
    expect(result.path).toBe('D:/exports/mine.sql.gz');
    expect(result.size).toBe(4096);
    expect(mockedFs.copy).toHaveBeenCalledWith('C:/backups/mcp_writing_db_2026-01-01.sql.gz', 'D:/exports/mine.sql.gz');
  });

  it('returns a canceled (not error) result when the save dialog is dismissed', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: true });

    const result = await databaseBackup.downloadBackup('C:/backups/mine.sql.gz');

    expect(result.success).toBe(false);
    expect(result.canceled).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockedFs.copy).not.toHaveBeenCalled();
  });

  it('fails without prompting a dialog if the source backup no longer exists', async () => {
    mockedFs.pathExists.mockResolvedValue(false as any);

    const result = await databaseBackup.downloadBackup('C:/backups/gone.sql.gz');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(mockShowSaveDialog).not.toHaveBeenCalled();
  });

  it('returns a failure result (not a throw) if the copy fails', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: 'D:/exports/mine.sql.gz' });
    mockedFs.copy.mockRejectedValue(new Error('disk full'));

    const result = await databaseBackup.downloadBackup('C:/backups/mine.sql.gz');

    expect(result.success).toBe(false);
    expect(result.error).toContain('disk full');
  });
});
