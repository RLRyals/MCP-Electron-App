/**
 * LLM Provider Manager
 *
 * Central registry and router for all LLM providers.
 * Manages provider adapters, credential storage, and execution routing.
 */

import { EventEmitter } from 'events';
import { LLMProviderConfig, LLMRequest, LLMResponse, ProviderValidationResult } from '../../types/llm-providers';
import { CredentialStore } from './credential-store';
import { logWithCategory, LogCategory } from '../logger';

/**
 * Provider adapter interface
 * All provider adapters must implement this interface
 */
export interface LLMProviderAdapter {
  /**
   * Execute a request with this provider
   */
  execute(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Validate provider credentials
   */
  validateCredentials(credentials: any): Promise<ProviderValidationResult>;

  /**
   * Whether this provider supports streaming responses
   */
  streamSupport: boolean;

  /**
   * Provider type
   */
  type: LLMProviderConfig['type'];
}

/**
 * LLM Provider Manager
 */
export class LLMProviderManager extends EventEmitter {
  private adapters: Map<LLMProviderConfig['type'], LLMProviderAdapter> = new Map();
  private credentialStore: CredentialStore;
  private initialized: boolean = false;

  constructor() {
    super();
    this.credentialStore = new CredentialStore();
  }

  /**
   * Initialize provider manager
   * Register all available provider adapters
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Dynamically import and register adapters
      const adapters = await this.loadAdapters();

      for (const adapter of adapters) {
        this.registerAdapter(adapter);
      }

      this.initialized = true;
      logWithCategory('info', LogCategory.WORKFLOW, `LLM Provider Manager initialized with ${this.adapters.size} adapters`);

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW, `Failed to initialize LLM Provider Manager: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load all provider adapters
   */
  private async loadAdapters(): Promise<LLMProviderAdapter[]> {
    const adapters: LLMProviderAdapter[] = [];

    try {
      // Import adapters dynamically
      const { ClaudeCodeCLIAdapter } = await import('./adapters/claude-code-cli-adapter');
      adapters.push(new ClaudeCodeCLIAdapter());

      const { ClaudeAPIAdapter } = await import('./adapters/claude-api-adapter');
      adapters.push(new ClaudeAPIAdapter());

      const { OpenAIAdapter } = await import('./adapters/openai-adapter');
      adapters.push(new OpenAIAdapter());

      const { GoogleGeminiAdapter } = await import('./adapters/google-gemini-adapter');
      adapters.push(new GoogleGeminiAdapter());

      const { OpenRouterAdapter } = await import('./adapters/openrouter-adapter');
      adapters.push(new OpenRouterAdapter());

      const { LocalLLMAdapter } = await import('./adapters/local-llm-adapter');
      adapters.push(new LocalLLMAdapter());

    } catch (error: any) {
      logWithCategory('warn', LogCategory.WORKFLOW, `Some adapters failed to load: ${error.message}`);
    }

    return adapters;
  }

  /**
   * Register a provider adapter
   */
  registerAdapter(adapter: LLMProviderAdapter): void {
    this.adapters.set(adapter.type, adapter);
    logWithCategory('info', LogCategory.WORKFLOW, `Registered LLM adapter: ${adapter.type}`);
  }

  /**
   * Execute a prompt with the specified provider
   */
  async executePrompt(
    provider: LLMProviderConfig,
    prompt: string,
    context: any,
    systemPrompt?: string
  ): Promise<LLMResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Get adapter for this provider type
    const adapter = this.adapters.get(provider.type);
    if (!adapter) {
      throw new Error(`No adapter found for provider type: ${provider.type}`);
    }

    // Get credentials if needed (not needed for Claude Code CLI)
    let credentials: any = null;
    if (provider.type !== 'claude-code-cli' && provider.id) {
      credentials = await this.credentialStore.getCredentials(provider.id);
    }

    // Build request
    const request: LLMRequest = {
      provider,
      credentials,
      prompt,
      context,
      systemPrompt,
      streaming: false,
    };

    // Log execution (without sensitive data)
    logWithCategory('info', LogCategory.WORKFLOW,
      `Executing LLM request with ${provider.type} (${provider.name})`);

    try {
      // Execute request
      const response = await adapter.execute(request);

      // Emit success event
      this.emit('execution-complete', {
        provider: provider.type,
        success: response.success,
        usage: response.usage,
      });

      return response;

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `LLM execution failed with ${provider.type}: ${error.message}`);

      // Emit error event
      this.emit('execution-error', {
        provider: provider.type,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Validate provider credentials
   */
  async validateProvider(provider: LLMProviderConfig): Promise<ProviderValidationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const adapter = this.adapters.get(provider.type);
    if (!adapter) {
      return {
        valid: false,
        error: `No adapter found for provider type: ${provider.type}`,
      };
    }

    try {
      // Get credentials if needed
      let credentials: any = null;
      if (provider.type !== 'claude-code-cli' && provider.id) {
        credentials = await this.credentialStore.getCredentials(provider.id);
      }

      const result = await adapter.validateCredentials(credentials || provider.config);
      return result;

    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * List available provider types
   */
  getAvailableProviders(): Array<{
    type: LLMProviderConfig['type'];
    streamSupport: boolean;
  }> {
    if (!this.initialized) {
      return [];
    }

    return Array.from(this.adapters.values()).map(adapter => ({
      type: adapter.type,
      streamSupport: adapter.streamSupport,
    }));
  }

  /**
   * Save provider credentials
   */
  async saveProvider(provider: LLMProviderConfig): Promise<string> {
    // Generate ID if not present
    const providerId = provider.id || this.credentialStore.generateId();

    // Save credentials (encrypted)
    await this.credentialStore.saveCredentials(providerId, provider);

    logWithCategory('info', LogCategory.WORKFLOW,
      `Saved provider credentials: ${provider.type} (${provider.name})`);

    return providerId;
  }

  /**
   * Delete provider credentials
   */
  async deleteProvider(providerId: string): Promise<void> {
    await this.credentialStore.deleteCredentials(providerId);

    logWithCategory('info', LogCategory.WORKFLOW,
      `Deleted provider credentials: ${providerId}`);
  }

  /**
   * List all saved providers
   */
  async listSavedProviders(): Promise<LLMProviderConfig[]> {
    return await this.credentialStore.listProviders();
  }

  /**
   * Get a specific saved provider
   */
  async getProvider(providerId: string): Promise<LLMProviderConfig | null> {
    return await this.credentialStore.getProvider(providerId);
  }
}

// Singleton instance
let instance: LLMProviderManager | null = null;

export function getProviderManager(): LLMProviderManager {
  if (!instance) {
    instance = new LLMProviderManager();
  }
  return instance;
}
