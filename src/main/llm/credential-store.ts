/**
 * Credential Store
 *
 * Securely stores LLM provider credentials using Electron's safeStorage API.
 * Credentials are encrypted at rest and only decrypted when needed.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { app, safeStorage } from 'electron';
import { LLMProviderConfig } from '../../types/llm-providers';
import { logWithCategory, LogCategory } from '../logger';

/**
 * Stored credential entry
 */
interface StoredCredential {
  id: string;
  type: LLMProviderConfig['type'];
  name: string;
  encryptedData: string; // Base64 encoded encrypted JSON
  createdAt: string;
  updatedAt: string;
}

/**
 * Credential Store
 */
export class CredentialStore {
  private storePath: string;
  private credentials: Map<string, StoredCredential> = new Map();
  private initialized: boolean = false;

  constructor() {
    // Store credentials in user data folder
    const userDataPath = app.getPath('userData');
    this.storePath = path.join(userDataPath, 'llm-providers.enc.json');
  }

  /**
   * Initialize credential store
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create store file if it doesn't exist
      if (!await fs.pathExists(this.storePath)) {
        await fs.writeJson(this.storePath, {}, { spaces: 2 });
      }

      // Load existing credentials
      const data = await fs.readJson(this.storePath);
      for (const [id, cred] of Object.entries(data)) {
        this.credentials.set(id, cred as StoredCredential);
      }

      this.initialized = true;
      logWithCategory('info', LogCategory.WORKFLOW,
        `Credential store initialized with ${this.credentials.size} providers`);

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to initialize credential store: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save provider credentials (encrypted)
   */
  async saveCredentials(id: string, provider: LLMProviderConfig): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Encrypt provider config
      const json = JSON.stringify(provider);
      const buffer = Buffer.from(json, 'utf8');
      const encrypted = safeStorage.encryptString(json);

      const credential: StoredCredential = {
        id,
        type: provider.type,
        name: provider.name,
        encryptedData: encrypted.toString('base64'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Update in memory
      this.credentials.set(id, credential);

      // Persist to disk
      await this.persist();

      logWithCategory('info', LogCategory.WORKFLOW,
        `Saved encrypted credentials for provider: ${id}`);

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to save credentials: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get provider credentials (decrypted)
   */
  async getCredentials(id: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const credential = this.credentials.get(id);
    if (!credential) {
      throw new Error(`Provider credentials not found: ${id}`);
    }

    try {
      // Decrypt
      const encryptedBuffer = Buffer.from(credential.encryptedData, 'base64');
      const decrypted = safeStorage.decryptString(encryptedBuffer);
      const provider = JSON.parse(decrypted);

      // Return config (contains API keys, etc.)
      return provider.config;

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to decrypt credentials: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get full provider config (decrypted)
   */
  async getProvider(id: string): Promise<LLMProviderConfig | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const credential = this.credentials.get(id);
    if (!credential) {
      return null;
    }

    try {
      const encryptedBuffer = Buffer.from(credential.encryptedData, 'base64');
      const decrypted = safeStorage.decryptString(encryptedBuffer);
      return JSON.parse(decrypted) as LLMProviderConfig;

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to get provider: ${error.message}`);
      return null;
    }
  }

  /**
   * List all saved providers (without decrypting sensitive data)
   */
  async listProviders(): Promise<LLMProviderConfig[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const providers: LLMProviderConfig[] = [];

    for (const [id, credential] of this.credentials) {
      try {
        const provider = await this.getProvider(id);
        if (provider) {
          // Mask sensitive fields
          const masked = this.maskSensitiveFields(provider);
          providers.push(masked);
        }
      } catch (error) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Failed to load provider ${id}: ${error}`);
      }
    }

    return providers;
  }

  /**
   * Delete provider credentials
   */
  async deleteCredentials(id: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.credentials.has(id)) {
      throw new Error(`Provider credentials not found: ${id}`);
    }

    // Remove from memory
    this.credentials.delete(id);

    // Persist to disk
    await this.persist();

    logWithCategory('info', LogCategory.WORKFLOW,
      `Deleted provider credentials: ${id}`);
  }

  /**
   * Persist credentials to disk
   */
  private async persist(): Promise<void> {
    try {
      const data: Record<string, StoredCredential> = {};

      for (const [id, cred] of this.credentials) {
        data[id] = cred;
      }

      await fs.writeJson(this.storePath, data, { spaces: 2 });

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to persist credentials: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mask sensitive fields in provider config (for display)
   */
  private maskSensitiveFields(provider: LLMProviderConfig): LLMProviderConfig {
    const masked = { ...provider };

    if ('config' in masked && masked.config) {
      const config = { ...masked.config };

      // Mask API keys
      if ('apiKey' in config && typeof config.apiKey === 'string') {
        const key = config.apiKey;
        if (key.length > 8) {
          config.apiKey = `${key.substring(0, 3)}...${key.substring(key.length - 4)}`;
        } else {
          config.apiKey = '***';
        }
      }

      masked.config = config;
    }

    return masked;
  }

  /**
   * Generate unique provider ID
   */
  generateId(): string {
    return `provider_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Check if safeStorage is available
   */
  static isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }
}
