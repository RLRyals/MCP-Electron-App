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
  repoUrl?: string; // Optional repo URL for cloning
  dependencies?: string[]; // List of dependent repo IDs
  isCustom?: boolean; // Whether this is a user-added client
  enabled?: boolean; // Whether this client is enabled
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
 * Custom client configuration interface
 */
export interface ClientConfig {
  customClients: ClientMetadata[];
  overrides: Record<string, Partial<ClientMetadata>>; // Overrides for default clients (e.g. repoUrl)
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
  repoUrl?: string;
}

/**
 * Available MCP clients metadata (Defaults)
 */
export const DEFAULT_CLIENTS: Record<string, ClientMetadata> = {
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
    installation: 'automatic',
    repoUrl: 'https://github.com/TypingMind/typingmind.git'
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
 * Get the path to the client configuration file
 */
function getClientConfigPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'client-config.json');
}

/**
 * Load client configuration (custom clients and overrides)
 */
export async function loadClientConfig(): Promise<ClientConfig> {
  const configPath = getClientConfigPath();
  try {
    if (!await fs.pathExists(configPath)) {
      return { customClients: [], overrides: {} };
    }
    return await fs.readJson(configPath);
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to load client config', error);
    return { customClients: [], overrides: {} };
  }
}

/**
 * Save client configuration
 */
export async function saveClientConfig(config: ClientConfig): Promise<void> {
  const configPath = getClientConfigPath();
  try {
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, config, { spaces: 2 });
  } catch (error) {
    logWithCategory('error', LogCategory.SYSTEM, 'Failed to save client config', error);
    throw error;
  }
}

/**
 * Get all available clients (merging defaults with config)
 */
export async function getAvailableClients(): Promise<ClientMetadata[]> {
  logWithCategory('info', LogCategory.SYSTEM, 'Getting available clients');
  
  const config = await loadClientConfig();
  const clients: ClientMetadata[] = [];

  // Add default clients with overrides
  for (const [id, defaultClient] of Object.entries(DEFAULT_CLIENTS)) {
    const override = config.overrides[id] || {};
    clients.push({ ...defaultClient, ...override });
  }

  // Add custom clients
  clients.push(...config.customClients);

  return clients;
}

/**
 * Get a specific client by ID
 */
export async function getClientById(clientId: string): Promise<ClientMetadata | null> {
  const clients = await getAvailableClients();
  const client = clients.find(c => c.id === clientId);
  
  if (!client) {
    logWithCategory('warn', LogCategory.SYSTEM, `Client not found: ${clientId}`);
    return null;
  }
  return client;
}

/**
 * Add a custom client
 */
export async function addCustomClient(client: ClientMetadata): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await loadClientConfig();
    
    // Check if ID already exists
    if (DEFAULT_CLIENTS[client.id] || config.customClients.find(c => c.id === client.id)) {
      return { success: false, error: 'Client ID already exists' };
    }

    client.isCustom = true;
    config.customClients.push(client);
    await saveClientConfig(config);
    
    logWithCategory('info', LogCategory.SYSTEM, `Added custom client: ${client.name}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Remove a custom client
 */
export async function removeCustomClient(clientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await loadClientConfig();
    
    const initialLength = config.customClients.length;
    config.customClients = config.customClients.filter(c => c.id !== clientId);
    
    if (config.customClients.length === initialLength) {
      return { success: false, error: 'Custom client not found' };
    }

    await saveClientConfig(config);
    
    // Also remove from selection if present
    const selection = await loadClientSelection();
    if (selection && selection.clients.includes(clientId)) {
      const newClients = selection.clients.filter(id => id !== clientId);
      await saveClientSelection(newClients);
    }

    logWithCategory('info', LogCategory.SYSTEM, `Removed custom client: ${clientId}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Update client configuration (e.g. repo URL)
 */
export async function updateClientConfig(clientId: string, updates: Partial<ClientMetadata>): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await loadClientConfig();
    
    // Check if it's a default client
    if (DEFAULT_CLIENTS[clientId]) {
      config.overrides[clientId] = { ...config.overrides[clientId], ...updates };
    } else {
      // Check if it's a custom client
      const index = config.customClients.findIndex(c => c.id === clientId);
      if (index !== -1) {
        config.customClients[index] = { ...config.customClients[index], ...updates };
      } else {
        return { success: false, error: 'Client not found' };
      }
    }

    await saveClientConfig(config);
    logWithCategory('info', LogCategory.SYSTEM, `Updated client config: ${clientId}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
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
    const availableClients = await getAvailableClients();
    const availableIds = availableClients.map(c => c.id);
    
    for (const clientId of clients) {
      if (!availableIds.includes(clientId)) {
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
  const availableClients = await getAvailableClients();

  const statuses: ClientStatus[] = [];

  for (const client of availableClients) {
    const isSelected = selectedClients.includes(client.id);

    // For now, we just track selection. Installation tracking will be added in future issues
    statuses.push({
      id: client.id,
      name: client.name,
      selected: isSelected,
      installed: false, // Will be implemented in installation issues
      installationDate: isSelected ? selection?.selectedAt : undefined,
      repoUrl: client.repoUrl
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
