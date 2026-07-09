import { BrowserWindow, dialog } from 'electron';
import { registerHandler } from '../ipc-registry';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { logWithCategory, LogCategory } from '../logger';
import { PersistentMCPClient } from '../workflow/persistent-mcp-client';
import { DependencyResolver } from '../workflow/dependency-resolver';
import { ClaudeCodeExporter, ExportOptions } from '../workflow/exporters/claude-code-exporter';
import {
  slugifyWorkflowName,
  resolveUniqueWorkflowId,
  buildNewWorkflowDefinition,
  DEFAULT_NEW_WORKFLOW_VERSION,
} from '../workflow/create-workflow';
import type { WorkflowUpdate, ActiveWorkflowInstance } from '../../types/workflow';

/**
 * Parse completed_node_ids from database (may be JSON string or array)
 */
function parseCompletedNodeIds(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Parse breadcrumb from database (may be JSON string or array)
 */
function parseBreadcrumb(value: any): import('../../types/workflow').WorkflowBreadcrumbEntry[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Map active workflow data from MCP snake_case to TypeScript camelCase
 */
function mapActiveWorkflow(data: any): ActiveWorkflowInstance {
  return {
    id: data.id,
    workflowId: data.workflow_id,
    workflowName: data.workflow_name,
    source: data.source,
    projectFolder: data.project_folder,
    projectName: data.project_name,
    currentNodeId: data.current_node_id,
    currentNodeName: data.current_node_name,
    status: data.status,
    progressPercent: data.progress_percent ?? 0,
    totalNodes: data.total_nodes ?? 0,
    completedNodes: data.completed_nodes ?? 0,
    completedNodeIds: parseCompletedNodeIds(data.completed_node_ids),
    startedAt: data.started_at,
    updatedAt: data.updated_at,
    availableNodes: data.available_nodes ?? [],
    metadata: data.metadata,
    breadcrumb: parseBreadcrumb(data.breadcrumb),
    parentWorkflowId: data.parent_workflow_id,
  };
}

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
  registerHandler('workflow:update-positions', "Update node positions in a workflow canvas", async (_event, { workflowId, positions }) => {
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
  registerHandler('workflow:get-definition', "Get a workflow definition by id (and optional version)", async (_event, workflowId, version?) => {
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

  // Create a brand-new (empty) workflow the canvas editor can immediately edit.
  // Lives alongside the graph editing verbs (add-node/add-edge/...) because it
  // must cooperate with them. Persists through the SAME upsert path the importer
  // uses (import_workflow_definition), so the plugin's workflow:list/get — which
  // read the same DB via the workflow-manager MCP — pick up the new row.
  registerHandler('workflow:create', "Create a new empty workflow definition", async (_event: Electron.IpcMainInvokeEvent, { name, description }: { name?: string; description?: string }) => {
    const trimmedName = (name || '').trim();
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Create workflow "${trimmedName}"`);
    try {
      if (!trimmedName) {
        throw new Error('Workflow name is required');
      }

      const client = await getWorkflowClient();

      // Collect existing workflow_ids so we can auto-suffix duplicates instead of
      // silently overwriting via ON CONFLICT (workflow_id, version) DO UPDATE.
      // If the lookup itself fails, we CANNOT proceed: import_workflow_definition
      // upserts on (workflow_id, version), so creating with an unverified slug
      // could silently replace an existing workflow's graph with an empty one.
      let existingIds: Set<string>;
      try {
        const defs = await client.getWorkflowDefinitions();
        existingIds = new Set(
          (defs || [])
            .map((d: any) => d.workflow_id || d.id)
            .filter((id: any): id is string => typeof id === 'string' && id.length > 0)
        );
      } catch (lookupError: any) {
        logWithCategory('error', LogCategory.WORKFLOW,
          `Could not load existing workflows for uniqueness check: ${lookupError.message}`);
        throw new Error(
          'Could not verify workflow name uniqueness (workflow service unavailable) — please try again.'
        );
      }

      const baseSlug = slugifyWorkflowName(trimmedName);
      const workflowId = resolveUniqueWorkflowId(baseSlug, existingIds);

      const definition = buildNewWorkflowDefinition({
        id: workflowId,
        name: trimmedName,
        description,
      });

      // Same upsert path as the folder importer.
      await client.importWorkflowDefinition(definition);
      logWithCategory('info', LogCategory.WORKFLOW,
        `IPC: Created workflow ${workflowId} v${DEFAULT_NEW_WORKFLOW_VERSION}`);

      // Return the same shape workflow:get returns: the raw DB row with id mapped
      // from workflow_id (the plugin's runner does the same mapping for UI use).
      const created = await client.getWorkflowDefinition(workflowId, DEFAULT_NEW_WORKFLOW_VERSION);
      return {
        ...(created as any),
        id: (created as any)?.workflow_id || workflowId,
      };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Create workflow failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  // Add node to workflow (graph-based)
  registerHandler('workflow:add-node', "Add a node to a workflow", async (_event, { workflowId, node }) => {
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
  registerHandler('workflow:update-node', "Update a workflow node", async (_event, { workflowId, nodeId, updates }) => {
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
  registerHandler('workflow:delete-node', "Delete a workflow node", async (_event, { workflowId, nodeId }) => {
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
  registerHandler('workflow:add-edge', "Add an edge to a workflow", async (_event, { workflowId, edge }) => {
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
  registerHandler('workflow:update-edge', "Update a workflow edge", async (_event, { workflowId, edgeId, updates }) => {
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
  registerHandler('workflow:delete-edge', "Delete a workflow edge", async (_event, { workflowId, edgeId }) => {
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
  registerHandler('workflow:preview', "Preview a workflow from a folder path", async (_event, folderPath: string) => {
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
  registerHandler('workflow:get-installed-agents', "List installed Claude Code agents", async () => {
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
  registerHandler('workflow:get-installed-skills', "List installed Claude Code skills", async () => {
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
  registerHandler('workflow:get-installed-output-styles', "List installed Claude Code output styles", async () => {
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
  registerHandler('document:read-agent', "", async (_event, agentName: string) => {
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
  registerHandler('document:write-agent', "", async (_event, agentName: string, content: string) => {
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
  registerHandler('document:read-skill', "", async (_event, skillName: string) => {
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
  registerHandler('document:write-skill', "", async (_event, skillName: string, content: string, filePath?: string) => {
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
  registerHandler('document:read-output-style', "", async (_event, styleName: string) => {
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
  registerHandler('document:write-output-style', "", async (_event, styleName: string, content: string) => {
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
  registerHandler('document:delete-output-style', "", async (_event, styleName: string) => {
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
  // Document Import Handlers (File/Folder Dialogs)
  // ============================================

  // Import output-style from single file
  // Returns { fileName, content } for renderer to process (allows user rename and confirmation)
  registerHandler('document:import-output-style-file', "", async (event) => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Import output-style file');
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) throw new Error('No window found');

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Output Style',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const sourcePath = result.filePaths[0];
      const content = await fs.readFile(sourcePath, 'utf-8');
      // Remove .md extension for fileName
      const fileName = path.basename(sourcePath, '.md');

      return { fileName, content };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Import output-style file failed', { error: error.message });
      throw error;
    }
  });

  // Import output-styles from folder
  // Returns array of { fileName, content } for renderer to process (allows user confirmation)
  registerHandler('document:import-output-style-folder', "", async (event) => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Import output-style folder');
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) throw new Error('No window found');

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Output Styles from Folder',
        properties: ['openDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const sourceDir = result.filePaths[0];
      const files = await fs.readdir(sourceDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      const outputStyles: { fileName: string; content: string }[] = [];

      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(sourceDir, file), 'utf-8');
        // Remove .md extension for fileName to match expected format
        const fileName = path.basename(file, '.md');
        outputStyles.push({ fileName, content });
      }

      return { outputStyles };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Import output-style folder failed', { error: error.message });
      throw error;
    }
  });

  // Import agent from single file
  // Returns { fileName, content } for renderer to process (allows user rename and confirmation)
  registerHandler('document:import-agent-file', "", async (event) => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Import agent file');
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) throw new Error('No window found');

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Agent',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const sourcePath = result.filePaths[0];
      const content = await fs.readFile(sourcePath, 'utf-8');
      // Remove .md extension for fileName
      const fileName = path.basename(sourcePath, '.md');

      return { fileName, content };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Import agent file failed', { error: error.message });
      throw error;
    }
  });

  // Import agents from folder
  // Returns array of { fileName, content } for renderer to process (allows user confirmation)
  registerHandler('document:import-agent-folder', "", async (event) => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Import agent folder');
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) throw new Error('No window found');

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Agents from Folder',
        properties: ['openDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const sourceDir = result.filePaths[0];
      const files = await fs.readdir(sourceDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      const agents: { fileName: string; content: string }[] = [];

      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(sourceDir, file), 'utf-8');
        // Remove .md extension for fileName to match expected format
        const fileName = path.basename(file, '.md');
        agents.push({ fileName, content });
      }

      return { agents };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Import agent folder failed', { error: error.message });
      throw error;
    }
  });

  // Import skill from single file
  // Returns { fileName, content } for renderer to process (allows user rename and confirmation)
  registerHandler('document:import-skill-file', "", async (event) => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Import skill file');
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) throw new Error('No window found');

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Skill',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const sourcePath = result.filePaths[0];
      const content = await fs.readFile(sourcePath, 'utf-8');
      // Remove .md extension for fileName
      const fileName = path.basename(sourcePath, '.md');

      return { fileName, content };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Import skill file failed', { error: error.message });
      throw error;
    }
  });

  // Import skills from folder (supports both single files and directory format)
  // Returns array of { fileName, content } for renderer to process (allows user confirmation)
  registerHandler('document:import-skill-folder', "", async (event) => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: Import skill folder');
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) throw new Error('No window found');

      const result = await dialog.showOpenDialog(window, {
        title: 'Import Skills from Folder',
        properties: ['openDirectory']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const sourceDir = result.filePaths[0];
      const entries = await fs.readdir(sourceDir, { withFileTypes: true });
      const skills: { fileName: string; content: string }[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          // Single file skill
          const content = await fs.readFile(path.join(sourceDir, entry.name), 'utf-8');
          // Remove .md extension for fileName to match expected format
          const fileName = path.basename(entry.name, '.md');
          skills.push({ fileName, content });
        } else if (entry.isDirectory()) {
          // Directory format skill - check for SKILL.md
          const skillMdPath = path.join(sourceDir, entry.name, 'SKILL.md');
          if (await fs.pathExists(skillMdPath)) {
            const content = await fs.readFile(skillMdPath, 'utf-8');
            // Use directory name as fileName
            skills.push({ fileName: entry.name, content });
          }
        }
      }

      return { skills };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Import skill folder failed', { error: error.message });
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

  /**
   * Surface a workflow:list-active failure to every renderer window.
   *
   * Without this, a broken/never-started workflow-manager-server child
   * process (e.g. its repo hasn't been cloned into userData/repositories
   * yet on a fresh install, or DATABASE_URL is unreachable) is invisible:
   * listActiveWorkflows() and this handler both swallow the error and
   * resolve to [], which looks identical to "no active workflows" in the
   * UI (see issue #178). Broadcasting lets the renderer distinguish
   * "genuinely idle" from "can't reach the workflow server" instead of
   * silently showing a stale/empty list forever.
   */
  function broadcastListActiveError(message: string) {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('workflow:list-active-error', { message, timestamp: new Date().toISOString() });
    });
  }

  // List all active workflows
  registerHandler('workflow:list-active', "List active workflow instances", async () => {
    logWithCategory('info', LogCategory.WORKFLOW, 'IPC: List active workflows');
    try {
      const client = await getWorkflowClient();
      const result = await client.listActiveWorkflows();
      logWithCategory('info', LogCategory.WORKFLOW, `IPC: Found ${result?.length || 0} active workflows`);
      // Map snake_case from MCP to camelCase for TypeScript
      return (result || []).map(mapActiveWorkflow);
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: List active workflows failed', { error: error.message });
      broadcastListActiveError(error.message || 'Unknown error');
      // Return empty array on error - MCP tools may not be implemented yet
      return [];
    }
  });

  // Pause a workflow
  registerHandler('workflow:pause', "Pause an active workflow", async (_event, registryId: string) => {
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
  registerHandler('workflow:resume', "Resume a paused workflow", async (_event, registryId: string) => {
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
  registerHandler('workflow:cancel', "Cancel an active workflow", async (_event, registryId: string) => {
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
  registerHandler('workflow:jump-to-node', "Jump an active workflow to a specific node", async (_event, { registryId, nodeId }: { registryId: string; nodeId: string }) => {
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
  registerHandler('workflow:register-active', "Register a new active workflow instance", async (_event, params: {
    workflowId: string;
    workflowName: string;
    source: 'fictionlab_ui' | 'claude_code' | 'typingmind';
    projectFolder: string;
    projectName: string;
    totalNodes: number;
    availableNodes?: { id: string; name: string }[];
    parentWorkflowId?: string;
  }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Register active workflow ${params.workflowId}${params.parentWorkflowId ? ` (parent: ${params.parentWorkflowId})` : ''}`);
    try {
      const client = await getWorkflowClient();
      const result = await client.registerActiveWorkflow(params);

      // Broadcast so the canvas can detect new workflows and auto-connect
      if (result?.registryId) {
        broadcastWorkflowUpdate({
          registryId: result.registryId,
          type: 'status',
          data: {
            status: 'running',
            workflowId: params.workflowId,
            workflowName: params.workflowName,
            parentWorkflowId: params.parentWorkflowId,
          },
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Register active workflow failed', { error: error.message });
      throw error;
    }
  });

  // Update workflow progress (called during execution)
  // Accepts both naming conventions: nodeId/nodeName OR currentNodeId/currentNodeName
  registerHandler('workflow:update-progress', "Update progress for an active workflow instance", async (_event, params: {
    registryId: string;
    nodeId?: string;
    nodeName?: string;
    currentNodeId?: string;
    currentNodeName?: string;
    progressPercent: number;
    completedNodes: number;
    breadcrumb?: string;  // JSON string of breadcrumb array for nested workflows
  }) => {
    // Support both naming conventions
    const nodeId = params.nodeId || params.currentNodeId || '';
    const nodeName = params.nodeName || params.currentNodeName || '';
    const { registryId, progressPercent, completedNodes, breadcrumb } = params;

    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Update progress for ${registryId}: ${progressPercent}% at node ${nodeId}`);
    try {
      const client = await getWorkflowClient();

      // Parse breadcrumb if provided
      let breadcrumbArray: import('../../types/workflow').WorkflowBreadcrumbEntry[] | undefined;
      if (breadcrumb) {
        try {
          breadcrumbArray = JSON.parse(breadcrumb);
        } catch (e) {
          logWithCategory('warn', LogCategory.WORKFLOW, 'Failed to parse breadcrumb JSON', { breadcrumb });
        }
      }

      await client.updateWorkflowProgress(registryId, nodeId, nodeName, progressPercent, completedNodes, breadcrumbArray);

      // Broadcast update
      broadcastWorkflowUpdate({
        registryId,
        type: 'progress',
        data: {
          currentNodeId: nodeId,
          currentNodeName: nodeName,
          progressPercent,
          completedNodes,
          breadcrumb: breadcrumbArray,
        },
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Update progress failed', { error: error.message });
      throw error;
    }
  });

  // Mark a node as started (sets current node)
  registerHandler('workflow:mark-node-started', "Mark a workflow node as started", async (_event, { registryId, nodeId, nodeName, loopIteration }: {
    registryId: string;
    nodeId: string;
    nodeName: string;
    loopIteration?: number;
  }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Mark node started ${nodeId} in workflow ${registryId}${loopIteration !== undefined ? ` (loop iteration ${loopIteration})` : ''}`);
    try {
      const client = await getWorkflowClient();
      await client.markNodeStarted(registryId, nodeId, nodeName);

      // Broadcast update (include loop iteration metadata if present)
      broadcastWorkflowUpdate({
        registryId,
        type: 'node_changed',
        data: {
          currentNodeId: nodeId,
          currentNodeName: nodeName,
          ...(loopIteration !== undefined ? { metadata: { loopIteration } } : {}),
        },
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Mark node started failed', { error: error.message });
      throw error;
    }
  });

  // Mark a node as completed (adds to completedNodeIds)
  registerHandler('workflow:mark-node-completed', "Mark a workflow node as completed", async (_event, { registryId, nodeId, loopIteration }: {
    registryId: string;
    nodeId: string;
    loopIteration?: number;
  }) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Mark node completed ${nodeId} in workflow ${registryId}${loopIteration !== undefined ? ` (loop iteration ${loopIteration})` : ''}`);
    try {
      const client = await getWorkflowClient();
      await client.markNodeCompleted(registryId, nodeId);

      // Broadcast update - renderer will merge this into existing completedNodeIds
      broadcastWorkflowUpdate({
        registryId,
        type: 'progress',
        data: {
          completedNodeIds: [nodeId],
          ...(loopIteration !== undefined ? { metadata: { loopIteration } } : {}),
        },
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Mark node completed failed', { error: error.message });
      throw error;
    }
  });

  // ============================================
  // Workflow Export Handler
  // ============================================

  // Export workflow to Claude Code format
  registerHandler('workflow:export-claude-code', "Export a workflow to Claude Code format", async (_event, workflowId: string, options?: ExportOptions) => {
    logWithCategory('info', LogCategory.WORKFLOW, `IPC: Export workflow ${workflowId} to Claude Code format`);
    try {
      const exporter = new ClaudeCodeExporter();
      const result = await exporter.export(workflowId, options || {});

      if (result.success) {
        logWithCategory('info', LogCategory.WORKFLOW, `IPC: Export successful to ${result.outputPath}`);
      } else {
        logWithCategory('error', LogCategory.WORKFLOW, `IPC: Export failed: ${result.error}`);
      }

      return result;
    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, 'IPC: Export workflow failed', { error: error.message, stack: error.stack });
      throw error;
    }
  });

  logWithCategory('info', LogCategory.SYSTEM, 'Workflow IPC handlers registered (including active workflow management)');
}
