/**
 * Client Selection Module
 * Manages MCP client selection and installation metadata
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { app } from 'electron';
import { logWithCategory, LogCategory } from './logger';

/**
 * Client metadata interface
 */
export interface ClientMetadata {
  id: string;
  name: string;
  type: 'web-based' | 'native';
  description: string;
  features: string[];
  requirements: string[];
  downloadSize: string;
  installation: 'automatic' | 'manual';
}

/**
 * Client selection interface
 */
export interface ClientSelection {
  clients: string[];
  selectedAt: string;
  version?: string;
}

/**
 * Client installation status interface
 */
export interface ClientStatus {
  id: string;
  name: string;
  selected: boolean;
  installed: boolean;
  installationDate?: string;
  version?: string;
}

/**
 * Available MCP clients metadata
 */
export const AVAILABLE_CLIENTS: Record<string, ClientMetadata> = {
  'typingmind': {
    id: 'typingmind',
    name: 'Typing Mind',
    type: 'web-based',
    description: 'Browser-based AI chat interface with MCP support',
    features: [
      'Web-based interface',
      'Multiple AI model support',
      'Built-in prompt library',
      'Character/agent system',
      'Runs locally via Docker'
    ],
    requirements: [
      'Docker Desktop',
      'MCP Connector (included)',
      '~63MB download'
    ],
    downloadSize: '~63MB',
    installation: 'automatic'
  },
  'claude-desktop': {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    type: 'native',
    description: 'Official Anthropic desktop app for Claude',
    features: [
      'Native desktop application',
      'Direct Claude access',
      'MCP server support',
      'Fast and responsive',
      'Official Anthropic app'
    ],
    requirements: [
      'Manual installation required',
      'MCP server configuration',
      'Anthropic account'
    ],
    downloadSize: 'N/A (separate install)',
    installation: 'manual'
  }
};

/**
 * Get the path to the client selection file
 */
function getClientSelectionPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'client-selection.json');
}

/**
 * Get all available clients
 */
export function getAvailableClients(): ClientMetadata[] {
  logWithCategory('info', LogCategory.SYSTEM, 'Getting available clients');
  return Object.values(AVAILABLE_CLIENTS);
}

/**
 * Get a specific client by ID
 */
export function getClientById(clientId: string): ClientMetadata | null {
  const client = AVAILABLE_CLIENTS[clientId];
  if (!client) {
    logWithCategory('warn', LogCategory.SYSTEM, `Client not found: ${clientId}`);
    return null;
  }
  return client;
}

/**
 * Load saved client selection
 */
export async function loadClientSelection(): Promise<ClientSelection | null> {
  const selectionPath = getClientSelectionPath();

  try {
    if (!await fs.pathExists(selectionPath)) {
      logWithCategory('info', LogCategory.SYSTEM, 'No client selection file found');
      return null;
    }

    const data = await fs.readJson(selectionPath);
    logWithCategory('info', LogCategory.SYSTEM, `Loaded client selection: ${data.clients.join(', ')}`);
    return data;
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to load client selection', error);
    return null;
  }
}

/**
 * Save client selection
 */
export async function saveClientSelection(clients: string[]): Promise<{ success: boolean; error?: string }> {
  const selectionPath = getClientSelectionPath();

  try {
    // Validate client IDs
    for (const clientId of clients) {
      if (!AVAILABLE_CLIENTS[clientId]) {
        const error = `Invalid client ID: ${clientId}`;
        logWithCategory('error', LogCategory.SYSTEM, error);
        return { success: false, error };
      }
    }

    const selection: ClientSelection = {
      clients,
      selectedAt: new Date().toISOString(),
      version: app.getVersion()
    };

    // Ensure the directory exists
    await fs.ensureDir(path.dirname(selectionPath));

    // Save the selection
    await fs.writeJson(selectionPath, selection, { spaces: 2 });

    logWithCategory('info', LogCategory.SYSTEM, `Saved client selection: ${clients.join(', ')}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to save client selection', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Get the status of all clients
 */
export async function getClientStatus(): Promise<ClientStatus[]> {
  const selection = await loadClientSelection();
  const selectedClients = selection?.clients || [];

  const statuses: ClientStatus[] = [];

  for (const [id, metadata] of Object.entries(AVAILABLE_CLIENTS)) {
    const isSelected = selectedClients.includes(id);

    // For now, we just track selection. Installation tracking will be added in future issues
    statuses.push({
      id,
      name: metadata.name,
      selected: isSelected,
      installed: false, // Will be implemented in installation issues
      installationDate: isSelected ? selection?.selectedAt : undefined
    });
  }

  logWithCategory('info', LogCategory.SYSTEM, 'Retrieved client status');
  return statuses;
}

/**
 * Clear client selection
 */
export async function clearClientSelection(): Promise<{ success: boolean; error?: string }> {
  const selectionPath = getClientSelectionPath();

  try {
    if (await fs.pathExists(selectionPath)) {
      await fs.remove(selectionPath);
      logWithCategory('info', LogCategory.SYSTEM, 'Cleared client selection');
    }
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to clear client selection', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Get client selection file path (for debugging)
 */
export function getSelectionFilePath(): string {
  return getClientSelectionPath();
}
