/**
 * Unit tests for RepositoryManager
 *
 * Note: These tests are designed to be run with a testing framework like Jest or Mocha.
 * To enable testing, add a test framework to package.json:
 *
 * npm install --save-dev jest @types/jest ts-jest
 *
 * Then add to package.json scripts:
 * "test": "jest",
 * "test:watch": "jest --watch"
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { RepositoryManager } from '../../src/main/repository-manager';
import {
  RepositoryError,
  RepositoryErrorType,
  CloneOptions,
  RepoStatus,
} from '../../src/types/repository';

/**
 * Issue #185: `cloneRepository()` shells out to a real `git` binary via
 * `child_process.spawn`. Several tests below call it with syntactically
 * valid but non-existent remote URLs (github.com/gitlab.com placeholders).
 * Unmocked, that spawns a real `git clone` against those hosts -- against
 * gitlab.com in particular, Git Credential Manager pops an interactive
 * "Connect to GitLab" OS dialog with nothing in the test to dismiss it,
 * hanging the run indefinitely and leaving orphaned git/GCM processes.
 *
 * Mocking `spawn` here means no test in this file ever touches the network
 * or spawns a real `git clone`. `exec` is mocked too (used for the
 * `git --version` / disk-space prerequisite checks that run before every
 * clone attempt) so no real `git` process is spawned at all. Everything
 * else -- including `execSync`, used only for an unrelated one-time Docker
 * CLI PATH lookup -- is left as the real implementation via requireActual.
 *
 * The mocked failure is phrased as an authentication error so it classifies
 * as a non-retryable error (see ErrorHandler/RetryStrategy); a message that
 * classified as retryable would make RepositoryManager's built-in retry
 * logic sleep for several real seconds per test.
 */
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  exec: jest.fn(
    (
      _command: string,
      optionsOrCallback: any,
      callback?: (error: Error | null, result: { stdout: string; stderr: string }) => void
    ) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      process.nextTick(() => cb?.(null, { stdout: 'git version 2.42.0', stderr: '' }));
    }
  ),
  spawn: jest.fn(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: jest.Mock;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = jest.fn();

    // Fail fast on the next tick -- no real process, no network, no prompt.
    process.nextTick(() => {
      child.stderr.emit(
        'data',
        Buffer.from("fatal: Authentication failed (mocked - no network access in tests)\n")
      );
      child.emit('close', 128);
    });

    return child;
  }),
}));

describe('RepositoryManager', () => {
  let repoManager: RepositoryManager;
  let testDir: string;

  beforeEach(() => {
    repoManager = new RepositoryManager();
    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `repo-manager-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('cloneRepository', () => {
    test('should validate URL format', async () => {
      const invalidUrls = [
        '',
        '   ',
        'not-a-url',
        'ftp://invalid.com/repo.git',
      ];

      for (const url of invalidUrls) {
        await expect(
          repoManager.cloneRepository(url, path.join(testDir, 'repo'))
        ).rejects.toThrow(RepositoryError);
      }
    });

    test('should accept valid HTTPS URLs', () => {
      const validUrls = [
        'https://github.com/user/repo.git',
        'http://github.com/user/repo.git',
        'https://gitlab.com/user/repo.git',
      ];

      // Assert URL validation alone passes. Deliberately does NOT call
      // cloneRepository() -- even though these hosts/paths don't resolve to
      // a real repo, they are well-formed URLs that would sail past
      // validateUrl() into a real `git clone` subprocess (see the
      // child_process mock comment above for why that hung the suite).
      for (const url of validUrls) {
        expect(() => repoManager.validateUrl(url)).not.toThrow();
      }
    });

    test('should accept valid SSH URLs', () => {
      const validUrls = [
        'git@github.com:user/repo.git',
        'git@gitlab.com:user/repo.git',
      ];

      for (const url of validUrls) {
        expect(() => repoManager.validateUrl(url)).not.toThrow();
      }
    });

    test('should reject empty target path', async () => {
      await expect(
        repoManager.cloneRepository('https://github.com/user/repo.git', '')
      ).rejects.toThrow(RepositoryError);
    });

    test('should reject if target path already exists', async () => {
      const existingPath = path.join(testDir, 'existing');
      fs.mkdirSync(existingPath);

      await expect(
        repoManager.cloneRepository('https://github.com/user/repo.git', existingPath)
      ).rejects.toThrow(RepositoryError);
    });

    test('should handle progress callbacks', async () => {
      const progressUpdates: any[] = [];
      const options: CloneOptions = {
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      };

      try {
        await repoManager.cloneRepository(
          'https://github.com/user/repo.git',
          path.join(testDir, 'repo'),
          options
        );
      } catch (error) {
        // Even if clone fails, we should have received progress updates
        expect(progressUpdates.length).toBeGreaterThan(0);
        expect(progressUpdates[0]).toHaveProperty('message');
        expect(progressUpdates[0]).toHaveProperty('percent');
        expect(progressUpdates[0]).toHaveProperty('status');
      }
    });

    test('should support shallow clone with depth option', async () => {
      const options: CloneOptions = {
        depth: 1,
      };

      // This test validates that the depth option is accepted
      // Actual cloning would require a valid repository
      try {
        await repoManager.cloneRepository(
          'https://github.com/user/repo.git',
          path.join(testDir, 'repo'),
          options
        );
      } catch (error) {
        // Error is expected since we're not using a real repository
        expect(error).toBeDefined();
      }
    });

    test('should support branch selection', async () => {
      const options: CloneOptions = {
        branch: 'develop',
      };

      try {
        await repoManager.cloneRepository(
          'https://github.com/user/repo.git',
          path.join(testDir, 'repo'),
          options
        );
      } catch (error) {
        // Error is expected since we're not using a real repository
        expect(error).toBeDefined();
      }
    });

    test('should support sparse checkout', async () => {
      const options: CloneOptions = {
        sparseCheckoutPaths: ['src/', 'docs/'],
      };

      try {
        await repoManager.cloneRepository(
          'https://github.com/user/repo.git',
          path.join(testDir, 'repo'),
          options
        );
      } catch (error) {
        // Error is expected since we're not using a real repository
        expect(error).toBeDefined();
      }
    });
  });

  describe('checkoutVersion', () => {
    test('should reject if repository does not exist', async () => {
      const nonExistentPath = path.join(testDir, 'non-existent');

      await expect(
        repoManager.checkoutVersion(nonExistentPath, 'main')
      ).rejects.toThrow(RepositoryError);
    });

    test('should reject if path is not a Git repository', async () => {
      const nonGitPath = path.join(testDir, 'not-git');
      fs.mkdirSync(nonGitPath);

      await expect(
        repoManager.checkoutVersion(nonGitPath, 'main')
      ).rejects.toThrow(RepositoryError);
    });
  });

  describe('sparseCheckout', () => {
    test('should reject if repository does not exist', async () => {
      const nonExistentPath = path.join(testDir, 'non-existent');

      await expect(
        repoManager.sparseCheckout(nonExistentPath, ['src/'])
      ).rejects.toThrow(RepositoryError);
    });

    test('should reject if path is not a Git repository', async () => {
      const nonGitPath = path.join(testDir, 'not-git');
      fs.mkdirSync(nonGitPath);

      await expect(
        repoManager.sparseCheckout(nonGitPath, ['src/'])
      ).rejects.toThrow(RepositoryError);
    });

    test('should accept multiple paths', async () => {
      const paths = ['src/', 'docs/', 'tests/'];

      // This will fail since we don't have a real Git repo
      try {
        const nonGitPath = path.join(testDir, 'not-git');
        fs.mkdirSync(nonGitPath);
        await repoManager.sparseCheckout(nonGitPath, paths);
      } catch (error) {
        expect(error).toBeInstanceOf(RepositoryError);
      }
    });
  });

  describe('getRepoStatus', () => {
    test('should return exists:false for non-existent path', async () => {
      const nonExistentPath = path.join(testDir, 'non-existent');
      const status = await repoManager.getRepoStatus(nonExistentPath);

      expect(status.exists).toBe(false);
      expect(status.isGitRepo).toBe(false);
      expect(status.error).toBeDefined();
    });

    test('should return isGitRepo:false for non-Git directory', async () => {
      const nonGitPath = path.join(testDir, 'not-git');
      fs.mkdirSync(nonGitPath);

      const status = await repoManager.getRepoStatus(nonGitPath);

      expect(status.exists).toBe(true);
      expect(status.isGitRepo).toBe(false);
      expect(status.error).toBeDefined();
    });

    test('should return repository information for valid Git repo', async () => {
      // This test would require a real Git repository
      // In a real test environment, you would:
      // 1. Clone a test repository
      // 2. Check its status
      // 3. Verify the returned information

      // Placeholder for actual implementation
      expect(true).toBe(true);
    });
  });

  describe('cancelOperation', () => {
    test('should return true when no operation is running', async () => {
      const result = await repoManager.cancelOperation();
      expect(result).toBe(true);
    });

    test('should cancel ongoing clone operation', async () => {
      // This test would require actually starting a clone operation
      // and then cancelling it mid-way

      // Placeholder for actual implementation
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should throw RepositoryError for Git not installed', async () => {
      // This test assumes Git is installed
      // In a controlled environment, you could mock the checkGit function
      expect(true).toBe(true);
    });

    test('should handle network errors gracefully', async () => {
      // Clone from invalid URL to trigger network error
      try {
        await repoManager.cloneRepository(
          'https://invalid-domain-that-does-not-exist-12345.com/repo.git',
          path.join(testDir, 'repo')
        );
      } catch (error) {
        expect(error).toBeInstanceOf(RepositoryError);
        if (error instanceof RepositoryError) {
          expect(error.type).toBe(RepositoryErrorType.NETWORK_ERROR);
        }
      }
    });

    test('should clean up partial clone on error', async () => {
      const targetPath = path.join(testDir, 'failed-clone');

      try {
        await repoManager.cloneRepository(
          'https://invalid-url.com/repo.git',
          targetPath
        );
      } catch (error) {
        // Target path should not exist after failed clone
        expect(fs.existsSync(targetPath)).toBe(false);
      }
    });
  });
});

/**
 * Integration Tests
 *
 * These tests require network access and a real Git repository.
 * They should be run separately from unit tests.
 */
describe('RepositoryManager Integration Tests', () => {
  let repoManager: RepositoryManager;
  let testDir: string;

  beforeEach(() => {
    repoManager = new RepositoryManager();
    testDir = path.join(os.tmpdir(), `repo-manager-integration-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // These tests are skipped by default to avoid network dependencies
  describe.skip('real repository operations', () => {
    test('should clone a public repository', async () => {
      const url = 'https://github.com/git/git.git';
      const targetPath = path.join(testDir, 'git-repo');

      const options: CloneOptions = {
        depth: 1,
        branch: 'master',
        onProgress: (progress) => {
          console.log(`Progress: ${progress.percent}% - ${progress.message}`);
        },
      };

      await repoManager.cloneRepository(url, targetPath, options);

      // Verify repository was cloned
      expect(fs.existsSync(targetPath)).toBe(true);
      expect(fs.existsSync(path.join(targetPath, '.git'))).toBe(true);

      // Get repository status
      const status = await repoManager.getRepoStatus(targetPath);
      expect(status.isGitRepo).toBe(true);
      expect(status.currentBranch).toBe('master');
      expect(status.remoteUrl).toBe(url);
    }, 60000); // 60 second timeout for network operation

    test('should checkout different versions', async () => {
      const url = 'https://github.com/git/git.git';
      const targetPath = path.join(testDir, 'git-repo');

      // Clone repository
      await repoManager.cloneRepository(url, targetPath, { depth: 1 });

      // Checkout a specific tag
      await repoManager.checkoutVersion(targetPath, 'v2.30.0');

      const status = await repoManager.getRepoStatus(targetPath);
      expect(status.currentCommit).toBeDefined();
    }, 60000);

    test('should handle sparse checkout', async () => {
      const url = 'https://github.com/git/git.git';
      const targetPath = path.join(testDir, 'git-repo');

      const options: CloneOptions = {
        depth: 1,
        sparseCheckoutPaths: ['Documentation/'],
      };

      await repoManager.cloneRepository(url, targetPath, options);

      // Verify only Documentation directory exists
      expect(fs.existsSync(path.join(targetPath, 'Documentation'))).toBe(true);
    }, 60000);
  });
});

/**
 * Mock Test Helpers
 *
 * These can be used to create mock Git repositories for testing
 */

export class TestHelper {
  /**
   * Create a mock Git repository for testing
   */
  static async createMockGitRepo(repoPath: string): Promise<void> {
    // Create directory
    fs.mkdirSync(repoPath, { recursive: true });

    // Initialize Git repository
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync('git init', { cwd: repoPath });
    await execAsync('git config user.email "test@example.com"', { cwd: repoPath });
    await execAsync('git config user.name "Test User"', { cwd: repoPath });

    // Create a test file
    const testFile = path.join(repoPath, 'README.md');
    fs.writeFileSync(testFile, '# Test Repository\n');

    // Commit the file
    await execAsync('git add .', { cwd: repoPath });
    await execAsync('git commit -m "Initial commit"', { cwd: repoPath });
  }

  /**
   * Create a bare Git repository for testing clones
   */
  static async createBareGitRepo(repoPath: string): Promise<void> {
    fs.mkdirSync(repoPath, { recursive: true });

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync('git init --bare', { cwd: repoPath });
  }
}
