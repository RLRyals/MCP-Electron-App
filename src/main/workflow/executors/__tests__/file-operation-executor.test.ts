/**
 * File Operation Executor Tests
 *
 * Tests for file operations (read, write, copy, move, delete, exists),
 * project folder restriction, encoding support, and error handling.
 */

import { FileOperationExecutor } from '../file-operation-executor';
import { FileOperationNode } from '../../../../types/workflow-nodes';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Mock fs-extra
jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('FileOperationExecutor', () => {
  let executor: FileOperationExecutor;
  let testDir: string;

  beforeEach(() => {
    executor = new FileOperationExecutor();
    testDir = path.join(os.tmpdir(), 'workflow-test-' + Date.now());
    jest.clearAllMocks();
  });

  describe('read operation', () => {
    it('should read file content as UTF-8', async () => {
      const fileContent = 'Hello, World!';
      mockedFs.readFile.mockResolvedValueOnce(fileContent as any);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Read File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'read',
        sourcePath: path.join(testDir, 'test.txt'),
        requireProjectFolder: false,
        encoding: 'utf8',
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.fileContent).toBe(fileContent);
      expect(result.variables.encoding).toBe('utf8');
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.any(String),
        'utf8'
      );
    });

    it('should read file as binary', async () => {
      const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      mockedFs.readFile.mockResolvedValueOnce(buffer as any);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Read File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'read',
        sourcePath: path.join(testDir, 'binary.bin'),
        requireProjectFolder: false,
        encoding: 'binary',
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.encoding).toBe('binary');
      expect(result.variables.size).toBe(buffer.length);
    });

    it('should handle file not found error', async () => {
      const error: any = new Error('File not found');
      error.code = 'ENOENT';
      mockedFs.readFile.mockRejectedValueOnce(error);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Read File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'read',
        sourcePath: path.join(testDir, 'missing.txt'),
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('File not found');
    });

    it('should handle permission denied error', async () => {
      const error: any = new Error('Permission denied');
      error.code = 'EACCES';
      mockedFs.readFile.mockRejectedValueOnce(error);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Read File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'read',
        sourcePath: path.join(testDir, 'protected.txt'),
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('write operation', () => {
    it('should write file content', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(false);
      mockedFs.ensureDir.mockResolvedValueOnce(undefined as any);
      mockedFs.writeFile.mockResolvedValueOnce(undefined as any);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Write File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'write',
        targetPath: path.join(testDir, 'output.txt'),
        content: 'Test content',
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.success).toBe(true);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        'Test content',
        'utf8'
      );
    });

    it('should substitute variables in content', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(false);
      mockedFs.ensureDir.mockResolvedValueOnce(undefined as any);
      mockedFs.writeFile.mockResolvedValueOnce(undefined as any);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Write File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'write',
        targetPath: path.join(testDir, 'output.txt'),
        content: 'Hello, {{userName}}!',
        requireProjectFolder: false,
      };

      const context = {
        projectFolder: testDir,
        variables: { userName: 'Alice' },
      };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        'Hello, Alice!',
        'utf8'
      );
    });

    it('should fail when file exists and overwrite is false', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(true);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Write File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'write',
        targetPath: path.join(testDir, 'existing.txt'),
        content: 'Content',
        overwrite: false,
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('already exists');
    });

    it('should use content from context if not in node', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(false);
      mockedFs.ensureDir.mockResolvedValueOnce(undefined as any);
      mockedFs.writeFile.mockResolvedValueOnce(undefined as any);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Write File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'write',
        targetPath: path.join(testDir, 'output.txt'),
        requireProjectFolder: false,
      };

      const context = {
        projectFolder: testDir,
        content: 'Content from context',
      };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        'Content from context',
        'utf8'
      );
    });
  });

  describe('copy operation', () => {
    it('should copy file', async () => {
      mockedFs.ensureDir.mockResolvedValueOnce(undefined as any);
      mockedFs.copy.mockResolvedValueOnce(undefined as any);
      mockedFs.stat.mockResolvedValueOnce({ size: 1024 } as any);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Copy File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'copy',
        sourcePath: path.join(testDir, 'source.txt'),
        targetPath: path.join(testDir, 'dest.txt'),
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.success).toBe(true);
      expect(result.variables.sourcePath).toBeDefined();
      expect(result.variables.targetPath).toBeDefined();
      expect(mockedFs.copy).toHaveBeenCalled();
    });

    it('should handle source file not found', async () => {
      const error: any = new Error('Source not found');
      error.code = 'ENOENT';
      mockedFs.ensureDir.mockResolvedValueOnce(undefined as any);
      mockedFs.copy.mockRejectedValueOnce(error);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Copy File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'copy',
        sourcePath: path.join(testDir, 'missing.txt'),
        targetPath: path.join(testDir, 'dest.txt'),
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Source file not found');
    });
  });

  describe('move operation', () => {
    it('should move file', async () => {
      mockedFs.ensureDir.mockResolvedValueOnce(undefined as any);
      mockedFs.move.mockResolvedValueOnce(undefined as any);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Move File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'move',
        sourcePath: path.join(testDir, 'source.txt'),
        targetPath: path.join(testDir, 'moved.txt'),
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.success).toBe(true);
      expect(mockedFs.move).toHaveBeenCalled();
    });
  });

  describe('delete operation', () => {
    it('should delete existing file', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(true);
      mockedFs.remove.mockResolvedValueOnce(undefined as any);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Delete File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'delete',
        sourcePath: path.join(testDir, 'to-delete.txt'),
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.existed).toBe(true);
      expect(mockedFs.remove).toHaveBeenCalled();
    });

    it('should handle deleting non-existent file', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(false);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Delete File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'delete',
        sourcePath: path.join(testDir, 'missing.txt'),
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.existed).toBe(false);
      expect(mockedFs.remove).not.toHaveBeenCalled();
    });
  });

  describe('exists operation', () => {
    it('should check if file exists', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(true);
      mockedFs.stat.mockResolvedValueOnce({
        isFile: () => true,
        isDirectory: () => false,
        size: 2048,
      } as any);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Check File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'exists',
        sourcePath: path.join(testDir, 'check.txt'),
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.exists).toBe(true);
      expect(result.variables.isFile).toBe(true);
      expect(result.variables.isDirectory).toBe(false);
    });

    it('should handle non-existent file', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(false);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Check File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'exists',
        sourcePath: path.join(testDir, 'missing.txt'),
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.exists).toBe(false);
    });
  });

  describe('project folder restriction', () => {
    it('should allow operations within project folder', async () => {
      mockedFs.readFile.mockResolvedValueOnce('content' as any);

      const projectFolder = path.resolve('/test/project');
      const filePath = path.join(projectFolder, 'subfolder', 'file.txt');

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Read File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'read',
        sourcePath: filePath,
        requireProjectFolder: true,
        encoding: 'utf8',
      };

      const context = { projectFolder };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
    });

    it('should block operations outside project folder', async () => {
      const projectFolder = path.resolve('/test/project');
      const filePath = path.resolve('/etc/passwd');

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Read File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'read',
        sourcePath: filePath,
        requireProjectFolder: true,
      };

      const context = { projectFolder };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Security violation');
    });

    it('should block path traversal attacks', async () => {
      const projectFolder = path.resolve('/test/project');
      const filePath = path.join(projectFolder, '..', '..', 'etc', 'passwd');

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Read File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'read',
        sourcePath: filePath,
        requireProjectFolder: true,
      };

      const context = { projectFolder };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Security violation');
    });

    it('should fail when project folder not defined', async () => {
      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Read File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'read',
        sourcePath: '/some/path/file.txt',
        requireProjectFolder: true,
      };

      const context = {};
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Project folder not defined');
    });
  });

  describe('variable substitution in paths', () => {
    it('should substitute variables in source path', async () => {
      mockedFs.readFile.mockResolvedValueOnce('content' as any);

      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Read File',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'read',
        sourcePath: '{{basePath}}/{{fileName}}',
        requireProjectFolder: false,
        encoding: 'utf8',
      };

      const context = {
        projectFolder: testDir,
        variables: {
          basePath: testDir,
          fileName: 'test.txt',
        },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test.txt'),
        'utf8'
      );
    });
  });

  describe('error handling', () => {
    it('should handle unsupported operation', async () => {
      const node: FileOperationNode = {
        id: 'file-1',
        name: 'Invalid Operation',
        description: 'Test file operation',
        type: 'file',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        operation: 'invalid' as any,
        sourcePath: '/test/file.txt',
        requireProjectFolder: false,
      };

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Unsupported file operation');
    });

    it('should handle invalid node type', async () => {
      const node = {
        id: 'file-1',
        name: 'Invalid Node',
        type: 'invalid-type',
      } as any;

      const context = { projectFolder: testDir };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Invalid node type');
    });
  });
});
