import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { DEFAULT_PROFILES, getProfilesFilePath, loadProfiles, saveProfiles } from '../profiles';

describe('terminal profiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'terminal-profiles-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('DEFAULT_PROFILES includes a Casey profile rooted at ~/.claude/casey', () => {
    const casey = DEFAULT_PROFILES.find((p) => p.id === 'casey');
    expect(casey).toBeDefined();
    expect(casey!.cwd).toBe(path.join(os.homedir(), '.claude', 'casey'));
    expect(casey!.command).toBe('claude');
    expect(casey!.env?.ANTHROPIC_MODEL).toBeTruthy();
  });

  it('loadProfiles returns DEFAULT_PROFILES when no file exists yet', async () => {
    const profiles = await loadProfiles(tmpDir);
    expect(profiles).toEqual(DEFAULT_PROFILES);
  });

  it('saveProfiles then loadProfiles round-trips custom profiles', async () => {
    const custom = [
      { id: 'custom', name: 'Custom', cwd: tmpDir, command: 'bash' },
    ];
    await saveProfiles(tmpDir, custom);
    const loaded = await loadProfiles(tmpDir);
    expect(loaded).toEqual(custom);
    expect(await fs.pathExists(getProfilesFilePath(tmpDir))).toBe(true);
  });

  it('falls back to DEFAULT_PROFILES when the saved file is corrupt JSON', async () => {
    await fs.ensureDir(tmpDir);
    await fs.writeFile(getProfilesFilePath(tmpDir), '{not valid json', 'utf-8');
    const profiles = await loadProfiles(tmpDir);
    expect(profiles).toEqual(DEFAULT_PROFILES);
  });

  it('falls back to DEFAULT_PROFILES when the saved file is an empty array', async () => {
    await saveProfiles(tmpDir, []);
    const profiles = await loadProfiles(tmpDir);
    expect(profiles).toEqual(DEFAULT_PROFILES);
  });
});
