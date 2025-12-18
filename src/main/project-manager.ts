/**
 * Project Manager
 *
 * Handles CRUD operations for projects via MCP server.
 * Projects are just folder locations where users save their work.
 * They can optionally link to existing series/books but don't create them.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { app } from 'electron';
import { logWithCategory, LogCategory } from './logger';
import { getDatabaseUrl } from './database-connection';
import type {
  Project,
  CreateProjectData,
  UpdateProjectData
} from '../types/project';

export class ProjectManager {
  private mcpServerPath: string;
  private requestId: number = 0;

  constructor() {
    // Path to project-manager MCP server
    const userDataPath = app.getPath('userData');
    const mcpServersDir = path.join(userDataPath, 'repositories', 'mcp-writing-servers');
    this.mcpServerPath = path.join(
      mcpServersDir,
      'src',
      'mcps',
      'project-manager-server',
      'index.js'
    );
  }

  /**
   * Call MCP tool via stdio
   */
  private async callTool(toolName: string, args: any): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const requestId = ++this.requestId;

      logWithCategory('debug', LogCategory.SYSTEM,
        `Calling MCP tool: ${toolName} (request ${requestId})`);

      // Get database URL for the MCP server
      let databaseUrl: string;
      try {
        databaseUrl = await getDatabaseUrl();
      } catch (error: any) {
        reject(new Error(`Failed to get database URL: ${error.message}`));
        return;
      }

      // Spawn MCP server in stdio mode
      const mcpProcess = spawn('node', [this.mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MCP_STDIO_MODE: 'true',
          DATABASE_URL: databaseUrl
        }
      });

      let stdout = '';
      let stderr = '';
      let toolResponse: any = null;

      // Send MCP request
      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      mcpProcess.stdin?.write(JSON.stringify(request) + '\n');
      mcpProcess.stdin?.end();

      // Collect stdout
      mcpProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr (for logs)
      mcpProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      mcpProcess.on('close', (code) => {
        if (code !== 0) {
          logWithCategory('error', LogCategory.SYSTEM,
            `MCP server exited with code ${code}: ${stderr}`);
          reject(new Error(`MCP server failed: ${stderr}`));
          return;
        }

        try {
          // Parse JSON-RPC response
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const response = JSON.parse(line);
              if (response.id === requestId) {
                toolResponse = response;
                break;
              }
            } catch (e) {
              // Skip non-JSON lines (debug output)
            }
          }

          if (!toolResponse) {
            reject(new Error('No valid JSON-RPC response received'));
            return;
          }

          if (toolResponse.error) {
            reject(new Error(toolResponse.error.message));
            return;
          }

          logWithCategory('debug', LogCategory.SYSTEM,
            `MCP tool ${toolName} completed successfully`);

          // Extract content from MCP response
          const content = toolResponse.result?.content;
          if (Array.isArray(content) && content.length > 0) {
            // Parse text content as JSON if possible
            const textContent = content.find((c: any) => c.type === 'text')?.text;
            if (textContent) {
              try {
                resolve(JSON.parse(textContent));
              } catch {
                resolve(textContent);
              }
            } else {
              resolve(content);
            }
          } else {
            resolve(toolResponse.result);
          }

        } catch (error: any) {
          reject(new Error(`Failed to parse MCP response: ${error.message}`));
        }
      });

      mcpProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn MCP server: ${error.message}`));
      });
    });
  }

  // ============================================
  // PROJECT OPERATIONS
  // ============================================

  /**
   * Create a new project - just stores name and folder path
   */
  async createProject(data: CreateProjectData): Promise<Project> {
    logWithCategory('info', LogCategory.SYSTEM, `Creating project: ${data.name}`);

    try {
      const result = await this.callTool('create_project', {
        project_name: data.name,
        folder_location: data.folder_path || null,
        author_id: data.author_id || null,
        series_id: data.series_id || null,
        book_id: data.book_id || null
      });

      logWithCategory('info', LogCategory.SYSTEM, `Project created successfully: ${result.id}`);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to create project: ${error.message}`);
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  /**
   * List all projects - queries database directly via database-admin
   */
  async listProjects(): Promise<Project[]> {
    logWithCategory('debug', LogCategory.SYSTEM, 'Listing all projects via database');

    try {
      // Import database admin to query the projects table
      const { queryRecords } = await import('./database-admin');

      const result = await queryRecords({
        table: 'projects',
        orderBy: [{ column: 'created_at', direction: 'DESC' }]
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to query projects');
      }

      // The data field contains the parsed JSON response from MCP
      let data = result.data;

      // DEBUG: Log the actual data structure we received
      logWithCategory('debug', LogCategory.SYSTEM, `[ProjectManager] Raw result.data type: ${typeof data}, isArray: ${Array.isArray(data)}`);
      if (data && typeof data === 'object') {
        logWithCategory('debug', LogCategory.SYSTEM, `[ProjectManager] result.data keys: ${Object.keys(data).join(', ')}`);
        logWithCategory('debug', LogCategory.SYSTEM, `[ProjectManager] result.data.records exists: ${!!data.records}, isArray: ${Array.isArray(data.records)}`);
      }
      logWithCategory('debug', LogCategory.SYSTEM, `[ProjectManager] Full result.data: ${JSON.stringify(data).substring(0, 500)}`);

      // Handle case where database-admin returned unparsed response with content array
      if (data && data.content && Array.isArray(data.content) && data.content[0]?.text) {
        logWithCategory('warn', LogCategory.SYSTEM, `[ProjectManager] Received unparsed MCP response, parsing manually...`);
        try {
          const textContent = data.content[0].text;
          // Extract JSON from formatted text
          const jsonStartIndex = textContent.search(/[\{\[]/);
          const jsonText = jsonStartIndex >= 0 ? textContent.substring(jsonStartIndex) : textContent;
          data = JSON.parse(jsonText);
          logWithCategory('info', LogCategory.SYSTEM, `[ProjectManager] Successfully parsed MCP response manually`);
        } catch (parseError: any) {
          logWithCategory('error', LogCategory.SYSTEM, `[ProjectManager] Failed to parse MCP content: ${parseError.message}`);
        }
      }

      let projects: Project[] = [];

      if (Array.isArray(data)) {
        logWithCategory('debug', LogCategory.SYSTEM, `[ProjectManager] Data is array with ${data.length} items`);
        projects = data;
      } else if (data && Array.isArray(data.records)) {
        logWithCategory('debug', LogCategory.SYSTEM, `[ProjectManager] Using data.records with ${data.records.length} items`);
        projects = data.records;
      } else if (data && Array.isArray(data.projects)) {
        logWithCategory('debug', LogCategory.SYSTEM, `[ProjectManager] Using data.projects with ${data.projects.length} items`);
        projects = data.projects;
      } else {
        logWithCategory('warn', LogCategory.SYSTEM, `[ProjectManager] Could not find projects array in response`);
      }

      logWithCategory('debug', LogCategory.SYSTEM, `Retrieved ${projects.length} projects from database`);
      return projects;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to list projects: ${error.message}`);
      throw new Error(`Failed to list projects: ${error.message}`);
    }
  }

  /**
   * Get a single project by ID
   */
  async getProject(id: number): Promise<Project | null> {
    logWithCategory('debug', LogCategory.SYSTEM, `Getting project: ${id}`);

    try {
      const result = await this.callTool('get_project', { id });
      return result || null;
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to get project: ${error.message}`);
      throw new Error(`Failed to get project: ${error.message}`);
    }
  }

  /**
   * Update a project
   */
  async updateProject(id: number, data: UpdateProjectData): Promise<void> {
    logWithCategory('info', LogCategory.SYSTEM, `Updating project: ${id}`);

    try {
      await this.callTool('update_project', {
        id,
        name: data.name,
        folder_path: data.folder_path,
        author_id: data.author_id,
        series_id: data.series_id,
        book_id: data.book_id
      });

      logWithCategory('info', LogCategory.SYSTEM, `Project updated successfully: ${id}`);
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to update project: ${error.message}`);
      throw new Error(`Failed to update project: ${error.message}`);
    }
  }

  /**
   * Delete a project (just the reference, not the folder on disk)
   */
  async deleteProject(id: number): Promise<void> {
    logWithCategory('info', LogCategory.SYSTEM, `Deleting project: ${id}`);

    try {
      await this.callTool('delete_project', { id });
      logWithCategory('info', LogCategory.SYSTEM, `Project deleted successfully: ${id}`);
    } catch (error: any) {
      logWithCategory('error', LogCategory.SYSTEM, `Failed to delete project: ${error.message}`);
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }
}
