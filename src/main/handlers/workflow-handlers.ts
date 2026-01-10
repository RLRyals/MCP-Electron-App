import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { logWithCategory, LogCategory } from '../logger';
import { PersistentMCPClient } from '../workflow/persistent-mcp-client';
import { DependencyResolver } from '../workflow/dependency-resolver';
import type { WorkflowUpdate } from '../../types/workflow';

// Singleton instance of PersistentMCPClient for workflow operations
let workflowClient: PersistentMCPClient | null = null;
let workflowClientStartPromise: Promise<void> | null = null;

/**
 * Get or create the singleton PersistentMCPClient for workflow operations
 */
async function getWorkflowClient(): Promise<PersistentMCPClient> {
  if (workflowClient && workflowClient.isReady()) {
    return workflowClient;
  }

  if (workflowClientStartPromise) {
    await workflowClientStartPromise;
    if (workflowClient && workflowClient.isReady()) {
      return workflowClient;
    }
  }

  workflowClient = new PersistentMCPClient();
  workflowClientStartPromise = workflowClient.start();

  try {
    await workflowClientStartPromise;
    logWithCategory('info', LogCategory.WORKFLOW, 'PersistentMCPClient started for workflow handlers');
    return workflowClient;
  } catch (error: any) {
    workflowClient = null;
    workflowClientStartPromise = null;
    throw error;
  }
}

/**
 * Register workflow-related IPC handlers
 */
export function registerWorkflowHandlers() {
  // Update node positions in workflow canvas
  ipcMain.handle('workflow:update-positions', async (_event, { workflowId, positions }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Update positions for workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      await client.updateNodePositions(workflowId, positions);
      logWithCategory('info', LogCategory.WORKFLOW, `IPC: Positions updated for workflow ${workflowId}`);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Update positions failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Get workflow definition
  ipcMain.handle('workflow:get-definition', async (_event, workflowId, version?) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Get definition for workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const definition = await client.getWorkflowDefinition(workflowId, version);
      return definition;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Get definition failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Add node to workflow (graph-based)
  ipcMain.handle('workflow:add-node', async (_event, { workflowId, node }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Add node to workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      if (!node) {
        throw new Error('No node provided to add');
      }
      const { id, type, ...nodeData } = node;
      const result = await client.addNode(workflowId, String(id), type, nodeData);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Add node failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Update node in workflow (graph-based)
  ipcMain.handle('workflow:update-node', async (_event, { workflowId, nodeId, updates }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Update node ${nodeId} in workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.updateNode(workflowId, String(nodeId), updates);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Update node failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Delete node from workflow (graph-based)
  ipcMain.handle('workflow:delete-node', async (_event, { workflowId, nodeId }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Delete node ${nodeId} from workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.deleteNode(workflowId, String(nodeId));
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Delete node failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Add edge to workflow (graph-based)
  ipcMain.handle('workflow:add-edge', async (_event, { workflowId, edge }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Add edge to workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.createEdge(
        workflowId,
        edge.id,
        edge.source,
        edge.target,
        edge.type,
        edge.label,
        edge.condition
      );
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Add edge failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Update edge in workflow (graph-based)
  ipcMain.handle('workflow:update-edge', async (_event, { workflowId, edgeId, updates }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Update edge ${edgeId} in workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.updateEdge(workflowId, edgeId, updates);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Update edge failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Delete edge from workflow (graph-based)
  ipcMain.handle('workflow:delete-edge', async (_event, { workflowId, edgeId }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Delete edge ${edgeId} from workflow ${workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.deleteEdge(workflowId, edgeId);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Delete edge failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Preview workflow from folder
  ipcMain.handle('workflow:preview', async (_event, folderPath: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Preview workflow from ${folderPath}`);
    try {
      const { FolderImporter } = await import('../workflow/folder-importer');
      const importer = new FolderImporter();
      const preview = await importer.previewWorkflow(folderPath);
      return preview;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Preview workflow failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Get installed agents from ~/.claude/agents/
  ipcMain.handle('workflow:get-installed-agents', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Get installed agents');
    try {
      const resolver = new DependencyResolver();
      const agents = await resolver.getInstalledAgents();
      logWithCategory('info', LogCategory.WORKFLOW, `IPC: Found ${agents.length} installed agents`);
      return agents;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Get installed agents failed', { error: error.message, stack: error.stack });
      return [];
    }
  });

  // Get installed skills from ~/.claude/skills/
  ipcMain.handle('workflow:get-installed-skills', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Get installed skills');
    try {
      const resolver = new DependencyResolver();
      const skills = await resolver.getInstalledSkills();
      logWithCategory('info', LogCategory.WORKFLOW, `IPC: Found ${skills.length} installed skills`);
      return skills;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Get installed skills failed', { error: error.message, stack: error.stack });
      return [];
    }
  });

  // Get installed output-styles from ~/.claude/output-styles/
  ipcMain.handle('workflow:get-installed-output-styles', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Get installed output-styles');
    try {
      const resolver = new DependencyResolver();
      const outputStyles = await resolver.getInstalledOutputStyles();
      logWithCategory('info', LogCategory.WORKFLOW, `IPC: Found ${outputStyles.length} installed output-styles`);
      return outputStyles;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Get installed output-styles failed', { error: error.message, stack: error.stack });
      return [];
    }
  });

  // ============================================
  // Document Handlers (Agents, Skills, Output Styles)
  // ============================================

  // Read agent file from ~/.claude/agents/
  ipcMain.handle('document:read-agent', async (_event, agentName: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Read agent file: ${agentName}`);
    try {
      const homeDir = os.homedir();
      const agentPath = path.join(homeDir, '.claude', 'agents', `${agentName}.md`);

      if (!await fs.pathExists(agentPath)) {
        throw new Error(`Agent file not found: ${agentPath}`);
      }

      const content = await fs.readFile(agentPath, 'utf-8');
      return { content, filePath: agentPath };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Read agent failed', { error: error.message });
      throw error;
    }
  });

  // Write agent file to ~/.claude/agents/
  ipcMain.handle('document:write-agent', async (_event, agentName: string, content: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Write agent file: ${agentName}`);
    try {
      const homeDir = os.homedir();
      const agentsDir = path.join(homeDir, '.claude', 'agents');
      const agentPath = path.join(agentsDir, `${agentName}.md`);

      // Ensure agents directory exists
      await fs.ensureDir(agentsDir);

      await fs.writeFile(agentPath, content, 'utf-8');
      return { success: true, filePath: agentPath };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Write agent failed', { error: error.message });
      throw error;
    }
  });

  // Read skill file from ~/.claude/skills/
  // Supports both single file (.md) and directory format (SKILL.md)
  ipcMain.handle('document:read-skill', async (_event, skillName: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Read skill file: ${skillName}`);
    try {
      const homeDir = os.homedir();
      const skillsDir = path.join(homeDir, '.claude', 'skills');

      // Try single file format first
      const singleFilePath = path.join(skillsDir, `${skillName}.md`);
      if (await fs.pathExists(singleFilePath)) {
        const content = await fs.readFile(singleFilePath, 'utf-8');
        return { content, filePath: singleFilePath };
      }

      // Try directory format
      const directoryPath = path.join(skillsDir, skillName, 'SKILL.md');
      if (await fs.pathExists(directoryPath)) {
        const content = await fs.readFile(directoryPath, 'utf-8');
        return { content, filePath: directoryPath };
      }

      throw new Error(`Skill file not found: ${skillName} (tried ${singleFilePath} and ${directoryPath})`);
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Read skill failed', { error: error.message });
      throw error;
    }
  });

  // Write skill file to ~/.claude/skills/
  // Uses provided filePath or auto-detects format
  ipcMain.handle('document:write-skill', async (_event, skillName: string, content: string, filePath?: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Write skill file: ${skillName}`);
    try {
      const homeDir = os.homedir();
      const skillsDir = path.join(homeDir, '.claude', 'skills');

      let targetPath: string;

      if (filePath) {
        // Use provided path
        targetPath = filePath;
      } else {
        // Auto-detect format - check if directory format exists
        const directoryPath = path.join(skillsDir, skillName, 'SKILL.md');
        if (await fs.pathExists(directoryPath)) {
          targetPath = directoryPath;
        } else {
          // Default to single file format
          targetPath = path.join(skillsDir, `${skillName}.md`);
        }
      }

      // Ensure parent directory exists
      await fs.ensureDir(path.dirname(targetPath));

      await fs.writeFile(targetPath, content, 'utf-8');
      return { success: true, filePath: targetPath };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Write skill failed', { error: error.message });
      throw error;
    }
  });

  // Read output-style file from ~/.claude/output-styles/
  ipcMain.handle('document:read-output-style', async (_event, styleName: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Read output-style file: ${styleName}`);
    try {
      const homeDir = os.homedir();
      const stylePath = path.join(homeDir, '.claude', 'output-styles', `${styleName}.md`);

      if (!await fs.pathExists(stylePath)) {
        throw new Error(`Output-style file not found: ${stylePath}`);
      }

      const content = await fs.readFile(stylePath, 'utf-8');
      return { content, filePath: stylePath };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Read output-style failed', { error: error.message });
      throw error;
    }
  });

  // Write output-style file to ~/.claude/output-styles/
  ipcMain.handle('document:write-output-style', async (_event, styleName: string, content: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Write output-style file: ${styleName}`);
    try {
      const homeDir = os.homedir();
      const stylesDir = path.join(homeDir, '.claude', 'output-styles');
      const stylePath = path.join(stylesDir, `${styleName}.md`);

      // Ensure output-styles directory exists
      await fs.ensureDir(stylesDir);

      await fs.writeFile(stylePath, content, 'utf-8');
      return { success: true, filePath: stylePath };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Write output-style failed', { error: error.message });
      throw error;
    }
  });

  // Delete output-style file
  ipcMain.handle('document:delete-output-style', async (_event, styleName: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Delete output-style file: ${styleName}`);
    try {
      const homeDir = os.homedir();
      const stylePath = path.join(homeDir, '.claude', 'output-styles', `${styleName}.md`);

      if (!await fs.pathExists(stylePath)) {
        throw new Error(`Output-style file not found: ${stylePath}`);
      }

      await fs.remove(stylePath);
      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Delete output-style failed', { error: error.message });
      throw error;
    }
  });

  // ============================================
  // Active Workflow Management Handlers
  // ============================================

  /**
   * Broadcast workflow updates to all renderer windows
   */
  function broadcastWorkflowUpdate(update: WorkflowUpdate) {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('workflow:instance-updated', update);
    });
  }

  // List all active workflows
  ipcMain.handle('workflow:list-active', async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: List active workflows');
    try {
      const client = await getWorkflowClient();
      const result = await client.listActiveWorkflows();
      logWithCategory('info', LogCategory.WORKFLOW, `IPC: Found ${result?.length || 0} active workflows`);
      return result || [];
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: List active workflows failed', { error: error.message });
      // Return empty array on error - MCP tools may not be implemented yet
      return [];
    }
  });

  // Pause a workflow
  ipcMain.handle('workflow:pause', async (_event, registryId: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Pause workflow ${registryId}`);
    try {
      const client = await getWorkflowClient();
      await client.pauseWorkflow(registryId);

      // Broadcast update
      broadcastWorkflowUpdate({
        registryId,
        type: 'status',
        data: { status: 'paused' },
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Pause workflow failed', { error: error.message });
      throw error;
    }
  });

  // Resume a workflow
  ipcMain.handle('workflow:resume', async (_event, registryId: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Resume workflow ${registryId}`);
    try {
      const client = await getWorkflowClient();
      await client.resumeWorkflow(registryId);

      // Broadcast update
      broadcastWorkflowUpdate({
        registryId,
        type: 'status',
        data: { status: 'running' },
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Resume workflow failed', { error: error.message });
      throw error;
    }
  });

  // Cancel a workflow
  ipcMain.handle('workflow:cancel', async (_event, registryId: string) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Cancel workflow ${registryId}`);
    try {
      const client = await getWorkflowClient();
      await client.cancelWorkflow(registryId);

      // Broadcast update
      broadcastWorkflowUpdate({
        registryId,
        type: 'status',
        data: { status: 'cancelled' },
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Cancel workflow failed', { error: error.message });
      throw error;
    }
  });

  // Jump to a specific node in a workflow
  ipcMain.handle('workflow:jump-to-node', async (_event, { registryId, nodeId }: { registryId: string; nodeId: string }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Jump to node ${nodeId} in workflow ${registryId}`);
    try {
      const client = await getWorkflowClient();
      await client.jumpToNode(registryId, nodeId);

      // Broadcast update
      broadcastWorkflowUpdate({
        registryId,
        type: 'node_changed',
        data: { currentNodeId: nodeId },
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Jump to node failed', { error: error.message });
      throw error;
    }
  });

  // Register an active workflow (called when starting a workflow)
  ipcMain.handle('workflow:register-active', async (_event, params: {
    workflowId: string;
    workflowName: string;
    source: 'fictionlab_ui' | 'claude_code' | 'typingmind';
    projectFolder: string;
    projectName: string;
    totalNodes: number;
  }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Register active workflow ${params.workflowId}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.registerActiveWorkflow(params);
      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Register active workflow failed', { error: error.message });
      throw error;
    }
  });

  // Update workflow progress (called during execution)
  ipcMain.handle('workflow:update-progress', async (_event, {
    registryId,
    nodeId,
    nodeName,
    progressPercent,
    completedNodes,
  }: {
    registryId: string;
    nodeId: string;
    nodeName: string;
    progressPercent: number;
    completedNodes: number;
  }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Update progress for ${registryId}: ${progressPercent}%`);
    try {
      const client = await getWorkflowClient();
      await client.updateWorkflowProgress(registryId, nodeId, nodeName, progressPercent, completedNodes);

      // Broadcast update
      broadcastWorkflowUpdate({
        registryId,
        type: 'progress',
        data: {
          currentNodeId: nodeId,
          currentNodeName: nodeName,
          progressPercent,
          completedNodes,
        },
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Update progress failed', { error: error.message });
      throw error;
    }
  });

  logWithCategory('info', LogCategory.SYSTEM, 'Workflow IPC handlers registered (including active workflow management)');
}
