/**
 * Unit tests for BuildOrchestrator
 *
 * To run these tests, first install Jest and required dependencies:
 * npm install --save-dev jest @types/jest ts-jest
 *
 * Then add to package.json scripts:
 * "test": "jest",
 * "test:watch": "jest --watch",
 * "test:coverage": "jest --coverage"
 *
 * Create jest.config.js:
 * module.exports = {
 *   preset: 'ts-jest',
 *   testEnvironment: 'node',
 *   roots: ['<rootDir>/tests'],
 *   testMatch: ['**/*.test.ts'],
 *   moduleNameMapper: {
 *     '^@/(.*)$': '<rootDir>/src/$1'
 *   }
 * };
 */

import * as fs from 'fs';
import * as path from 'path';
import { BuildOrchestrator } from '../../src/main/build-orchestrator';
import {
  BuildStep,
  BuildStepType,
  BuildStepStatus,
  BuildChainConfig,
  NpmOptions,
  NpmBuildOptions,
  DockerBuildOptions,
  BuildProgressCallback,
} from '../../src/types/build';

// Mock dependencies
jest.mock('../../src/main/logger', () => ({
  LogCategory: {
    GENERAL: 'GENERAL',
    DOCKER: 'DOCKER',
    SCRIPT: 'SCRIPT',
  },
  logWithCategory: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('child_process');
jest.mock('fs');

describe('BuildOrchestrator', () => {
  let orchestrator: BuildOrchestrator;
  let progressCallback: jest.Mock<BuildProgressCallback>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock progress callback
    progressCallback = jest.fn();

    // Create orchestrator instance
    orchestrator = new BuildOrchestrator(progressCallback);
  });

  afterEach(() => {
    // Cancel any running processes
    orchestrator.cancel();
  });

  describe('constructor', () => {
    it('should create an instance with progress callback', () => {
      expect(orchestrator).toBeInstanceOf(BuildOrchestrator);
    });

    it('should create an instance without progress callback', () => {
      const orch = new BuildOrchestrator();
      expect(orch).toBeInstanceOf(BuildOrchestrator);
    });
  });

  describe('setProgressCallback', () => {
    it('should update the progress callback', () => {
      const newCallback = jest.fn();
      orchestrator.setProgressCallback(newCallback);

      // This would be tested indirectly by checking if the callback is called
      // during operations
    });
  });

  describe('npmInstall', () => {
    const mockRepoPath = '/mock/repo/path';
    const mockPackageJsonPath = path.join(mockRepoPath, 'package.json');

    beforeEach(() => {
      // Mock file system
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath === mockRepoPath || filePath === mockPackageJsonPath;
      });
    });

    it('should throw error if repository path does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(orchestrator.npmInstall('/invalid/path')).rejects.toThrow(
        'Repository path does not exist'
      );
    });

    it('should throw error if package.json not found', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath === mockRepoPath;
      });

      await expect(orchestrator.npmInstall(mockRepoPath)).rejects.toThrow(
        'package.json not found'
      );
    });

    it('should execute npm install with default options', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Installing dependencies...'));
            }
          }),
        },
        stderr: {
          on: jest.fn(),
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success
          }
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      await orchestrator.npmInstall(mockRepoPath);

      expect(mockSpawn).toHaveBeenCalledWith(
        'npm install',
        expect.objectContaining({
          cwd: mockRepoPath,
          shell: true,
        })
      );
    });

    it('should clean node_modules if clean option is true', async () => {
      const nodeModulesPath = path.join(mockRepoPath, 'node_modules');
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return [mockRepoPath, mockPackageJsonPath, nodeModulesPath].includes(filePath);
      });

      const mockRmSync = jest.fn();
      (fs.rmSync as jest.Mock) = mockRmSync;

      const options: NpmOptions = { clean: true };

      // Mock spawn for successful execution
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      await orchestrator.npmInstall(mockRepoPath, options);

      expect(mockRmSync).toHaveBeenCalledWith(
        nodeModulesPath,
        expect.objectContaining({ recursive: true, force: true })
      );
    });

    it('should use production flag when specified', async () => {
      const options: NpmOptions = { production: true };

      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      await orchestrator.npmInstall(mockRepoPath, options);

      expect(mockSpawn).toHaveBeenCalledWith(
        'npm install --production',
        expect.anything()
      );
    });

    it('should report progress during installation', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      await orchestrator.npmInstall(mockRepoPath);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          percent: expect.any(Number),
        })
      );
    });
  });

  describe('npmBuild', () => {
    const mockRepoPath = '/mock/repo/path';
    const mockPackageJsonPath = path.join(mockRepoPath, 'package.json');
    const mockPackageJson = {
      scripts: {
        build: 'tsc',
        'build:prod': 'tsc --prod',
      },
    };

    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath === mockRepoPath || filePath === mockPackageJsonPath;
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockPackageJson));
    });

    it('should throw error if repository path does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(orchestrator.npmBuild('/invalid/path')).rejects.toThrow(
        'Repository path does not exist'
      );
    });

    it('should throw error if build script not found', async () => {
      await expect(
        orchestrator.npmBuild(mockRepoPath, 'nonexistent')
      ).rejects.toThrow("Build script 'nonexistent' not found");
    });

    it('should execute npm build with default script', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      await orchestrator.npmBuild(mockRepoPath);

      expect(mockSpawn).toHaveBeenCalledWith(
        'npm run build',
        expect.objectContaining({
          cwd: mockRepoPath,
        })
      );
    });

    it('should execute npm build with custom script', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      await orchestrator.npmBuild(mockRepoPath, 'build:prod');

      expect(mockSpawn).toHaveBeenCalledWith(
        'npm run build:prod',
        expect.anything()
      );
    });
  });

  describe('dockerBuild', () => {
    const mockDockerfilePath = '/mock/docker/path';
    const mockDockerfile = path.join(mockDockerfilePath, 'Dockerfile');

    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.statSync as jest.Mock).mockReturnValue({
        isDirectory: () => true,
      });
    });

    it('should throw error if Dockerfile does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(
        orchestrator.dockerBuild('/invalid/dockerfile', 'test-image')
      ).rejects.toThrow('does not exist');
    });

    it('should execute docker build with basic options', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      await orchestrator.dockerBuild(mockDockerfilePath, 'test-image');

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('docker build'),
        expect.anything()
      );
    });

    it('should include build arguments', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      const options: DockerBuildOptions = {
        buildArgs: {
          NODE_VERSION: '18',
          BUILD_ENV: 'production',
        },
      };

      await orchestrator.dockerBuild(mockDockerfilePath, 'test-image', options);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('--build-arg NODE_VERSION=18'),
        expect.anything()
      );
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('--build-arg BUILD_ENV=production'),
        expect.anything()
      );
    });

    it('should include target stage', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      const options: DockerBuildOptions = {
        target: 'production',
      };

      await orchestrator.dockerBuild(mockDockerfilePath, 'test-image', options);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('--target production'),
        expect.anything()
      );
    });

    it('should support multiple tags', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      const options: DockerBuildOptions = {
        tags: ['test-image:latest', 'test-image:v1.0.0'],
      };

      await orchestrator.dockerBuild(mockDockerfilePath, 'test-image', options);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('-t test-image:latest'),
        expect.anything()
      );
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('-t test-image:v1.0.0'),
        expect.anything()
      );
    });
  });

  describe('executeBuildChain', () => {
    it('should execute steps in order', async () => {
      const steps: BuildStep[] = [
        {
          id: 'step1',
          name: 'Install Dependencies',
          type: BuildStepType.NPM_INSTALL,
          status: BuildStepStatus.PENDING,
          config: {},
        },
        {
          id: 'step2',
          name: 'Build Project',
          type: BuildStepType.NPM_BUILD,
          status: BuildStepStatus.PENDING,
          config: {},
        },
      ];

      // Mock successful execution
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      // Mock file system for npm commands
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ scripts: { build: 'tsc' } })
      );

      const result = await orchestrator.executeBuildChain(steps);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });

    it('should respect step dependencies', async () => {
      const steps: BuildStep[] = [
        {
          id: 'step1',
          name: 'Install Dependencies',
          type: BuildStepType.NPM_INSTALL,
          status: BuildStepStatus.PENDING,
          config: {},
        },
        {
          id: 'step2',
          name: 'Build Project',
          type: BuildStepType.NPM_BUILD,
          status: BuildStepStatus.PENDING,
          config: {},
          dependsOn: ['step1'],
        },
      ];

      // Mock successful execution
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ scripts: { build: 'tsc' } })
      );

      const result = await orchestrator.executeBuildChain(steps);

      expect(result.success).toBe(true);
      expect(steps[0].status).toBe(BuildStepStatus.COMPLETED);
      expect(steps[1].status).toBe(BuildStepStatus.COMPLETED);
    });

    it('should throw error on circular dependencies', async () => {
      const steps: BuildStep[] = [
        {
          id: 'step1',
          name: 'Step 1',
          type: BuildStepType.NPM_INSTALL,
          status: BuildStepStatus.PENDING,
          config: {},
          dependsOn: ['step2'],
        },
        {
          id: 'step2',
          name: 'Step 2',
          type: BuildStepType.NPM_BUILD,
          status: BuildStepStatus.PENDING,
          config: {},
          dependsOn: ['step1'],
        },
      ];

      await expect(orchestrator.executeBuildChain(steps)).rejects.toThrow(
        'Circular dependency detected'
      );
    });

    it('should stop on failure when stopOnFailure is true', async () => {
      const steps: BuildStep[] = [
        {
          id: 'step1',
          name: 'Failing Step',
          type: BuildStepType.NPM_INSTALL,
          status: BuildStepStatus.PENDING,
          config: {},
        },
        {
          id: 'step2',
          name: 'Should be skipped',
          type: BuildStepType.NPM_BUILD,
          status: BuildStepStatus.PENDING,
          config: {},
        },
      ];

      // Mock failed execution
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(1); // Failure
        }),
      });

      const childProcess = require('child_process');
      childProcess.spawn = mockSpawn;

      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const config: Partial<BuildChainConfig> = {
        stopOnFailure: true,
      };

      const result = await orchestrator.executeBuildChain(steps, config);

      expect(result.success).toBe(false);
      expect(result.failureCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(steps[1].status).toBe(BuildStepStatus.SKIPPED);
    });
  });

  describe('loadBuildConfig', () => {
    it('should load valid build config', () => {
      const mockConfig = {
        version: '1.0',
        chains: [
          {
            name: 'Test Chain',
            steps: [],
          },
        ],
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const config = orchestrator.loadBuildConfig('/mock/build.config.json');

      expect(config).toEqual(mockConfig);
      expect(config.chains).toHaveLength(1);
    });

    it('should throw error if config file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => {
        orchestrator.loadBuildConfig('/invalid/config.json');
      }).toThrow('Build config file not found');
    });

    it('should throw error on invalid JSON', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json{');

      expect(() => {
        orchestrator.loadBuildConfig('/mock/invalid.json');
      }).toThrow('Failed to parse build config');
    });
  });

  describe('cancel', () => {
    it('should cancel running process', () => {
      const mockKill = jest.fn();
      const mockProcess = {
        kill: mockKill,
        killed: false,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
      };

      // Set a mock current process
      (orchestrator as any).currentProcess = mockProcess;

      orchestrator.cancel();

      expect(mockKill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should do nothing if no process is running', () => {
      // Should not throw error
      expect(() => orchestrator.cancel()).not.toThrow();
    });
  });
});

describe('createBuildOrchestrator', () => {
  it('should create a new BuildOrchestrator instance', () => {
    const { createBuildOrchestrator } = require('../../src/main/build-orchestrator');
    const orchestrator = createBuildOrchestrator();

    expect(orchestrator).toBeInstanceOf(BuildOrchestrator);
  });

  it('should create instance with progress callback', () => {
    const { createBuildOrchestrator } = require('../../src/main/build-orchestrator');
    const callback = jest.fn();
    const orchestrator = createBuildOrchestrator(callback);

    expect(orchestrator).toBeInstanceOf(BuildOrchestrator);
  });
});
