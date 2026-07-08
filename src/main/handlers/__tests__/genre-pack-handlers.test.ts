/**
 * Unit tests for the project:list-genre-packs handler logic.
 *
 * These tests exercise listGenrePacks() with an injected fake
 * GenrePackScanner so they don't depend on the real @fictionlab/workflow-runner
 * package being installed, or on any real plugin/resources directory.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { listGenrePacks, GenrePackScanner } from '../genre-pack-handlers';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => 'C:/fake-userdata'),
  },
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock('../../logger', () => ({
  LogCategory: { SYSTEM: 'SYSTEM' },
  logWithCategory: jest.fn(),
}));

jest.mock('fs-extra');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('listGenrePacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns [] and does not throw when the scanner cannot be loaded (plugin not installed)', async () => {
    const loadScanner = jest.fn().mockReturnValue(null);

    const result = await listGenrePacks(loadScanner);

    expect(result).toEqual([]);
    expect(loadScanner).toHaveBeenCalledWith(path.join('C:/fake-userdata', 'plugins', 'fictionlab-workflow'));
  });

  it('returns [] when the resources directory cannot be located', async () => {
    const scanner: GenrePackScanner = {
      getResourcesPath: jest.fn(() => {
        throw new Error('Could not locate resources directory');
      }),
      listAvailableGenrePacks: jest.fn(),
    };

    const result = await listGenrePacks(() => scanner);

    expect(result).toEqual([]);
    expect(scanner.listAvailableGenrePacks).not.toHaveBeenCalled();
  });

  it('returns [] when the genre-packs directory is empty or missing', async () => {
    const scanner: GenrePackScanner = {
      getResourcesPath: jest.fn(() => 'C:/resources'),
      listAvailableGenrePacks: jest.fn().mockResolvedValue([]),
    };

    const result = await listGenrePacks(() => scanner);

    expect(result).toEqual([]);
  });

  it('returns id + display name pairs read from each pack manifest.json', async () => {
    const scanner: GenrePackScanner = {
      getResourcesPath: jest.fn(() => 'C:/resources'),
      listAvailableGenrePacks: jest
        .fn()
        .mockResolvedValue(['gothic-romance-horror', 'urban-fantasy-police-procedural']),
    };

    mockedFs.readJson.mockImplementation(async (manifestPath: any) => {
      const p = String(manifestPath);
      if (p.includes('gothic-romance-horror')) {
        return { name: 'Steampunk Gothic Horror Romance' };
      }
      if (p.includes('urban-fantasy-police-procedural')) {
        return { name: 'Urban Fantasy Police Procedural' };
      }
      throw new Error(`unexpected manifest path: ${p}`);
    });

    const result = await listGenrePacks(() => scanner);

    expect(result).toEqual([
      { id: 'gothic-romance-horror', name: 'Steampunk Gothic Horror Romance' },
      { id: 'urban-fantasy-police-procedural', name: 'Urban Fantasy Police Procedural' },
    ]);
  });

  it('falls back to the directory id as the display name when a manifest is unreadable', async () => {
    const scanner: GenrePackScanner = {
      getResourcesPath: jest.fn(() => 'C:/resources'),
      listAvailableGenrePacks: jest.fn().mockResolvedValue(['broken-pack']),
    };

    mockedFs.readJson.mockRejectedValue(new Error('ENOENT'));

    const result = await listGenrePacks(() => scanner);

    expect(result).toEqual([{ id: 'broken-pack', name: 'broken-pack' }]);
  });

  it('returns [] when the scan itself throws', async () => {
    const scanner: GenrePackScanner = {
      getResourcesPath: jest.fn(() => 'C:/resources'),
      listAvailableGenrePacks: jest.fn().mockRejectedValue(new Error('EACCES')),
    };

    const result = await listGenrePacks(() => scanner);

    expect(result).toEqual([]);
  });
});
