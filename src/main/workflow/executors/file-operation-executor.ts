/**
 * File Operation Executor
 *
 * Implements NodeExecutor interface for FileOperationNode.
 * Supports file operations: read, write, copy, move, delete, exists.
 * Enforces project folder restriction for safety.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { NodeExecutor } from './base-executor';
import { WorkflowNode, NodeOutput, FileOperationNode, isFileOperationNode } from '../../../types/workflow-nodes';
import { ContextManager } from '../context-manager';
import { logWithCategory, LogCategory } from '../../logger';

export class FileOperationExecutor implements NodeExecutor {
  readonly nodeType = 'file';
  private contextManager: ContextManager;

  constructor() {
    this.contextManager = new ContextManager();
  }

  async execute(node: WorkflowNode, context: any): Promise<NodeOutput> {
    const startTime = Date.now();

    // Type guard
    if (!isFileOperationNode(node)) {
      return this.createErrorOutput(node, 'Invalid node type for FileOperationExecutor');
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing file operation node: ${node.name} (${node.operation})`);

    try {
      // Validate and resolve file paths with variable substitution
      const resolvedPaths = this.resolvePaths(node, context);

      // Enforce project folder safety restriction
      if (node.requireProjectFolder) {
        this.validateProjectFolderRestriction(resolvedPaths, context);
      }

      // Execute the appropriate file operation
      let result: any;
      switch (node.operation) {
        case 'read':
          result = await this.executeRead(resolvedPaths, node);
          break;
        case 'write':
          result = await this.executeWrite(resolvedPaths, node, context);
          break;
        case 'copy':
          result = await this.executeCopy(resolvedPaths);
          break;
        case 'move':
          result = await this.executeMove(resolvedPaths);
          break;
        case 'delete':
          result = await this.executeDelete(resolvedPaths);
          break;
        case 'exists':
          result = await this.executeExists(resolvedPaths);
          break;
        default:
          throw new Error(`Unsupported file operation: ${node.operation}`);
      }

      const duration = Date.now() - startTime;
      logWithCategory('info', LogCategory.WORKFLOW,
        `File operation completed: ${node.operation} in ${duration}ms`);

      return {
        nodeId: node.id,
        nodeName: node.name,
        timestamp: new Date(),
        status: 'success',
        output: result,
        variables: this.extractVariables(result, node.operation),
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `File operation failed: ${error.message}`, error);

      return this.createErrorOutput(node, error.message, error.stack);
    }
  }

  /**
   * Resolve file paths with variable substitution
   */
  private resolvePaths(node: FileOperationNode, context: any): {
    sourcePath?: string;
    targetPath?: string;
  } {
    const resolved: { sourcePath?: string; targetPath?: string } = {};

    // Support both old 'path' field and new 'sourcePath'/'targetPath' fields
    const nodeAny = node as any;
    const pathField = nodeAny.path;

    // For write operations, use 'path' field as targetPath
    if (node.operation === 'write' && pathField) {
      const substituted = this.contextManager.substitute(pathField, context);
      resolved.targetPath = path.resolve(substituted);
      logWithCategory('debug', LogCategory.WORKFLOW,
        `Resolved write path: ${pathField} -> ${resolved.targetPath}`);
    }
    // For read operations, use 'path' field as sourcePath
    else if ((node.operation === 'read' || node.operation === 'delete' || node.operation === 'exists') && pathField) {
      const substituted = this.contextManager.substitute(pathField, context);
      resolved.sourcePath = path.resolve(substituted);
      logWithCategory('debug', LogCategory.WORKFLOW,
        `Resolved read path: ${pathField} -> ${resolved.sourcePath}`);
    }

    // Also handle explicit sourcePath/targetPath fields (new format)
    if (node.sourcePath) {
      const substituted = this.contextManager.substitute(node.sourcePath, context);
      resolved.sourcePath = path.resolve(substituted);
    }

    if (node.targetPath) {
      const substituted = this.contextManager.substitute(node.targetPath, context);
      resolved.targetPath = path.resolve(substituted);
    }

    return resolved;
  }

  /**
   * Validate paths are within project folder (safety feature)
   */
  private validateProjectFolderRestriction(
    paths: { sourcePath?: string; targetPath?: string },
    context: any
  ): void {
    const projectFolder = context.projectFolder;

    if (!projectFolder) {
      throw new Error('Project folder not defined in context, but requireProjectFolder is enabled');
    }

    const resolvedProjectFolder = path.resolve(projectFolder);

    // Validate source path
    if (paths.sourcePath) {
      if (!this.isPathWithinFolder(paths.sourcePath, resolvedProjectFolder)) {
        throw new Error(
          `Security violation: Source path "${paths.sourcePath}" is outside project folder "${resolvedProjectFolder}"`
        );
      }
    }

    // Validate target path
    if (paths.targetPath) {
      if (!this.isPathWithinFolder(paths.targetPath, resolvedProjectFolder)) {
        throw new Error(
          `Security violation: Target path "${paths.targetPath}" is outside project folder "${resolvedProjectFolder}"`
        );
      }
    }
  }

  /**
   * Check if a path is within a parent folder
   */
  private isPathWithinFolder(filePath: string, folderPath: string): boolean {
    const relative = path.relative(folderPath, filePath);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  /**
   * Execute READ operation
   */
  private async executeRead(
    paths: { sourcePath?: string },
    node: FileOperationNode
  ): Promise<any> {
    if (!paths.sourcePath) {
      throw new Error('Source path is required for read operation');
    }

    try {
      const encoding = node.encoding || 'utf8';

      if (encoding === 'utf8') {
        const content = await fs.readFile(paths.sourcePath, 'utf8');
        return {
          success: true,
          operation: 'read',
          path: paths.sourcePath,
          fileContent: content,
          encoding: 'utf8',
          size: Buffer.byteLength(content, 'utf8'),
        };
      } else {
        // Binary read
        const buffer = await fs.readFile(paths.sourcePath);
        return {
          success: true,
          operation: 'read',
          path: paths.sourcePath,
          fileContent: buffer,
          encoding: 'binary',
          size: buffer.length,
        };
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${paths.sourcePath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${paths.sourcePath}`);
      }
      throw error;
    }
  }

  /**
   * Execute WRITE operation
   */
  private async executeWrite(
    paths: { targetPath?: string },
    node: FileOperationNode,
    context: any
  ): Promise<any> {
    if (!paths.targetPath) {
      throw new Error('Target path is required for write operation');
    }

    // Get content from node config or context variable
    let content: string | Buffer;

    if (node.content) {
      // Content specified directly in node

      // Log template info
      const varRefs = node.content.match(/\{\{(.+?)\}\}/g) || [];
      if (varRefs.length > 0) {
        logWithCategory('debug', LogCategory.WORKFLOW,
          `[FILE WRITE] Template has ${varRefs.length} variables: ${varRefs.join(', ')}`);
        logWithCategory('debug', LogCategory.WORKFLOW,
          `[FILE WRITE] Available: ${JSON.stringify(Object.keys(context.variables || {}))}`);
      }

      content = this.contextManager.substitute(node.content, context);

      // Check if substitution failed
      const remainingVars = String(content).match(/\{\{(.+?)\}\}/g);
      if (remainingVars) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `[FILE WRITE] WARNING: Unsubstituted variables: ${remainingVars.join(', ')}`);
      }
    } else {
      // Try to get content from context
      if (context.content !== undefined) {
        content = context.content;
      } else {
        throw new Error('No content provided for write operation');
      }
    }

    // Check if file exists and handle overwrite/auto-increment
    let finalPath = paths.targetPath;
    const exists = await fs.pathExists(paths.targetPath);

    if (exists && node.overwrite === false) {
      // Auto-increment filename: concept.md -> concept-1.md -> concept-2.md
      const parsedPath = path.parse(paths.targetPath);
      let counter = 1;
      let newPath: string;

      do {
        newPath = path.join(
          parsedPath.dir,
          `${parsedPath.name}-${counter}${parsedPath.ext}`
        );
        counter++;
      } while (await fs.pathExists(newPath));

      finalPath = newPath;

      logWithCategory('info', LogCategory.WORKFLOW,
        `[FILE WRITE] File exists, auto-incremented to: ${finalPath}`);
    }

    try {
      // Ensure parent directory exists
      await fs.ensureDir(path.dirname(finalPath));

      // Write file
      if (Buffer.isBuffer(content)) {
        await fs.writeFile(finalPath, content);
      } else {
        await fs.writeFile(finalPath, content, 'utf8');
      }

      return {
        success: true,
        operation: 'write',
        path: finalPath,
        bytesWritten: Buffer.byteLength(content),
        existed: exists,
      };
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${paths.targetPath}`);
      }
      throw error;
    }
  }

  /**
   * Execute COPY operation
   */
  private async executeCopy(paths: {
    sourcePath?: string;
    targetPath?: string;
  }): Promise<any> {
    if (!paths.sourcePath || !paths.targetPath) {
      throw new Error('Both source and target paths are required for copy operation');
    }

    try {
      // Ensure target directory exists
      await fs.ensureDir(path.dirname(paths.targetPath));

      // Copy file
      await fs.copy(paths.sourcePath, paths.targetPath, { overwrite: true });

      const stats = await fs.stat(paths.targetPath);

      return {
        success: true,
        operation: 'copy',
        sourcePath: paths.sourcePath,
        targetPath: paths.targetPath,
        size: stats.size,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Source file not found: ${paths.sourcePath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied`);
      }
      throw error;
    }
  }

  /**
   * Execute MOVE operation
   */
  private async executeMove(paths: {
    sourcePath?: string;
    targetPath?: string;
  }): Promise<any> {
    if (!paths.sourcePath || !paths.targetPath) {
      throw new Error('Both source and target paths are required for move operation');
    }

    try {
      // Ensure target directory exists
      await fs.ensureDir(path.dirname(paths.targetPath));

      // Move file
      await fs.move(paths.sourcePath, paths.targetPath, { overwrite: true });

      return {
        success: true,
        operation: 'move',
        sourcePath: paths.sourcePath,
        targetPath: paths.targetPath,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Source file not found: ${paths.sourcePath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied`);
      }
      throw error;
    }
  }

  /**
   * Execute DELETE operation
   */
  private async executeDelete(paths: { sourcePath?: string }): Promise<any> {
    if (!paths.sourcePath) {
      throw new Error('Source path is required for delete operation');
    }

    try {
      const exists = await fs.pathExists(paths.sourcePath);

      if (!exists) {
        return {
          success: true,
          operation: 'delete',
          path: paths.sourcePath,
          existed: false,
          message: 'File did not exist',
        };
      }

      await fs.remove(paths.sourcePath);

      return {
        success: true,
        operation: 'delete',
        path: paths.sourcePath,
        existed: true,
      };
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${paths.sourcePath}`);
      }
      throw error;
    }
  }

  /**
   * Execute EXISTS operation
   */
  private async executeExists(paths: { sourcePath?: string }): Promise<any> {
    if (!paths.sourcePath) {
      throw new Error('Source path is required for exists operation');
    }

    const exists = await fs.pathExists(paths.sourcePath);

    let stats = null;
    if (exists) {
      try {
        stats = await fs.stat(paths.sourcePath);
      } catch {
        // Stats not available
      }
    }

    return {
      success: true,
      operation: 'exists',
      path: paths.sourcePath,
      exists,
      isFile: stats ? stats.isFile() : undefined,
      isDirectory: stats ? stats.isDirectory() : undefined,
      size: stats ? stats.size : undefined,
    };
  }

  /**
   * Extract variables from operation result
   */
  private extractVariables(result: any, operation: string): Record<string, any> {
    const variables: Record<string, any> = {
      success: result.success,
      operation,
    };

    // Operation-specific variable extraction
    switch (operation) {
      case 'read':
        variables.fileContent = result.fileContent;
        variables.size = result.size;
        variables.encoding = result.encoding;
        break;
      case 'exists':
        variables.exists = result.exists;
        variables.isFile = result.isFile;
        variables.isDirectory = result.isDirectory;
        break;
      case 'write':
        variables.bytesWritten = result.bytesWritten;
        variables.path = result.path;
        break;
      case 'copy':
      case 'move':
        variables.sourcePath = result.sourcePath;
        variables.targetPath = result.targetPath;
        break;
      case 'delete':
        variables.existed = result.existed;
        variables.path = result.path;
        break;
    }

    return variables;
  }

  /**
   * Create error output
   */
  private createErrorOutput(
    node: WorkflowNode,
    errorMessage: string,
    errorStack?: string
  ): NodeOutput {
    return {
      nodeId: node.id,
      nodeName: node.name,
      timestamp: new Date(),
      status: 'failed',
      output: null,
      variables: {},
      error: errorMessage,
      errorStack,
    };
  }
}
