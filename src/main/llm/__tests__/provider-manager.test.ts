/**
 * Unit tests for LLMProviderManager
 *
 * Tests provider registration, adapter lookup, execution routing,
 * credential management, and error handling.
 */

import { LLMProviderManager, LLMProviderAdapter } from '../provider-manager';
import { CredentialStore } from '../credential-store';
import {
  LLMProviderConfig,
  LLMRequest,
  LLMResponse,
  ProviderValidationResult,
  ClaudeAPIProvider,
  OpenAIProvider,
  ClaudeCodeCLIProvider,
} from '../../../types/llm-providers';

// Mock dependencies
jest.mock('../credential-store');
jest.mock('../../logger', () => ({
  LogCategory: {
    WORKFLOW: 'WORKFLOW',
  },
  logWithCategory: jest.fn(),
}));

// Mock adapters
jest.mock('../adapters/claude-code-cli-adapter');
jest.mock('../adapters/claude-api-adapter');
jest.mock('../adapters/openai-adapter');
jest.mock('../adapters/google-gemini-adapter');
jest.mock('../adapters/openrouter-adapter');
jest.mock('../adapters/local-llm-adapter');

describe('LLMProviderManager', () => {
  let manager: LLMProviderManager;
  let mockCredentialStore: jest.Mocked<CredentialStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new LLMProviderManager();
    mockCredentialStore = (manager as any).credentialStore;
  });

  describe('initialization', () => {
    it('should create manager instance', () => {
      expect(manager).toBeInstanceOf(LLMProviderManager);
      expect((manager as any).initialized).toBe(false);
    });

    it('should initialize and load adapters', async () => {
      await manager.initialize();
      expect((manager as any).initialized).toBe(true);
      expect((manager as any).adapters.size).toBeGreaterThan(0);
    });

    it('should not reinitialize if already initialized', async () => {
      await manager.initialize();
      const firstAdapters = (manager as any).adapters;
      await manager.initialize();
      const secondAdapters = (manager as any).adapters;
      expect(firstAdapters).toBe(secondAdapters);
    });

    it('should handle adapter loading errors gracefully', async () => {
      // Force an error during adapter loading
      const { ClaudeAPIAdapter } = require('../adapters/claude-api-adapter');
      ClaudeAPIAdapter.mockImplementationOnce(() => {
        throw new Error('Failed to load adapter');
      });

      await expect(manager.initialize()).rejects.toThrow();
    });
  });

  describe('registerAdapter', () => {
    it('should register an adapter', () => {
      const mockAdapter: LLMProviderAdapter = {
        type: 'claude-api',
        streamSupport: true,
        execute: jest.fn(),
        validateCredentials: jest.fn(),
      };

      manager.registerAdapter(mockAdapter);

      const adapters = (manager as any).adapters;
      expect(adapters.has('claude-api')).toBe(true);
      expect(adapters.get('claude-api')).toBe(mockAdapter);
    });

    it('should replace existing adapter of same type', () => {
      const mockAdapter1: LLMProviderAdapter = {
        type: 'openai',
        streamSupport: true,
        execute: jest.fn(),
        validateCredentials: jest.fn(),
      };

      const mockAdapter2: LLMProviderAdapter = {
        type: 'openai',
        streamSupport: false,
        execute: jest.fn(),
        validateCredentials: jest.fn(),
      };

      manager.registerAdapter(mockAdapter1);
      manager.registerAdapter(mockAdapter2);

      const adapters = (manager as any).adapters;
      expect(adapters.get('openai')).toBe(mockAdapter2);
    });
  });

  describe('executePrompt', () => {
    let mockAdapter: jest.Mocked<LLMProviderAdapter>;

    beforeEach(async () => {
      mockAdapter = {
        type: 'claude-api',
        streamSupport: true,
        execute: jest.fn(),
        validateCredentials: jest.fn(),
      };

      manager.registerAdapter(mockAdapter);
      (manager as any).initialized = true;
    });

    it('should execute prompt with Claude API provider', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test Claude',
        id: 'provider_123',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      const mockResponse: LLMResponse = {
        success: true,
        output: 'Test response',
        model: 'claude-sonnet-4-5',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };

      mockAdapter.execute.mockResolvedValue(mockResponse);
      mockCredentialStore.getCredentials.mockResolvedValue(provider.config);

      const result = await manager.executePrompt(
        provider,
        'Test prompt',
        {},
        'System prompt'
      );

      expect(result).toEqual(mockResponse);
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          provider,
          prompt: 'Test prompt',
          context: {},
          systemPrompt: 'System prompt',
          streaming: false,
        })
      );
    });

    it('should not load credentials for Claude Code CLI', async () => {
      const cliAdapter: jest.Mocked<LLMProviderAdapter> = {
        type: 'claude-code-cli',
        streamSupport: true,
        execute: jest.fn(),
        validateCredentials: jest.fn(),
      };

      manager.registerAdapter(cliAdapter);

      const provider: ClaudeCodeCLIProvider = {
        type: 'claude-code-cli',
        name: 'Claude Code CLI',
        config: {
          outputFormat: 'json',
        },
      };

      const mockResponse: LLMResponse = {
        success: true,
        output: 'CLI response',
      };

      cliAdapter.execute.mockResolvedValue(mockResponse);

      await manager.executePrompt(provider, 'Test prompt', {});

      expect(mockCredentialStore.getCredentials).not.toHaveBeenCalled();
      expect(cliAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: null,
        })
      );
    });

    it('should throw error if adapter not found', async () => {
      const provider: any = {
        type: 'unknown-provider',
        name: 'Unknown',
        config: {},
      };

      await expect(
        manager.executePrompt(provider, 'Test prompt', {})
      ).rejects.toThrow('No adapter found for provider type: unknown-provider');
    });

    it('should emit success event on successful execution', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        id: 'provider_123',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      const mockResponse: LLMResponse = {
        success: true,
        output: 'Response',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };

      mockAdapter.execute.mockResolvedValue(mockResponse);
      mockCredentialStore.getCredentials.mockResolvedValue(provider.config);

      const eventSpy = jest.fn();
      manager.on('execution-complete', eventSpy);

      await manager.executePrompt(provider, 'Test', {});

      expect(eventSpy).toHaveBeenCalledWith({
        provider: 'claude-api',
        success: true,
        usage: mockResponse.usage,
      });
    });

    it('should emit error event on execution failure', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        id: 'provider_123',
        config: {
          apiKey: 'invalid-key',
          model: 'claude-sonnet-4-5',
        },
      };

      mockAdapter.execute.mockRejectedValue(new Error('Invalid API key'));
      mockCredentialStore.getCredentials.mockResolvedValue(provider.config);

      const eventSpy = jest.fn();
      manager.on('execution-error', eventSpy);

      await expect(
        manager.executePrompt(provider, 'Test', {})
      ).rejects.toThrow('Invalid API key');

      expect(eventSpy).toHaveBeenCalledWith({
        provider: 'claude-api',
        error: 'Invalid API key',
      });
    });

    it('should auto-initialize if not initialized', async () => {
      const newManager = new LLMProviderManager();
      const provider: ClaudeCodeCLIProvider = {
        type: 'claude-code-cli',
        name: 'Test',
        config: { outputFormat: 'json' },
      };

      // Mock the adapter loading
      const mockLoadAdapters = jest.spyOn(newManager as any, 'loadAdapters');
      mockLoadAdapters.mockResolvedValue([]);

      await newManager.executePrompt(provider, 'Test', {});

      expect((newManager as any).initialized).toBe(true);
    });
  });

  describe('validateProvider', () => {
    let mockAdapter: jest.Mocked<LLMProviderAdapter>;

    beforeEach(() => {
      mockAdapter = {
        type: 'openai',
        streamSupport: true,
        execute: jest.fn(),
        validateCredentials: jest.fn(),
      };

      manager.registerAdapter(mockAdapter);
      (manager as any).initialized = true;
    });

    it('should validate provider with valid credentials', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test OpenAI',
        id: 'provider_456',
        config: {
          apiKey: 'valid-key',
          model: 'gpt-4-turbo',
        },
      };

      const mockValidation: ProviderValidationResult = {
        valid: true,
        model: 'gpt-4-turbo',
      };

      mockAdapter.validateCredentials.mockResolvedValue(mockValidation);
      mockCredentialStore.getCredentials.mockResolvedValue(provider.config);

      const result = await manager.validateProvider(provider);

      expect(result).toEqual(mockValidation);
      expect(mockAdapter.validateCredentials).toHaveBeenCalled();
    });

    it('should return error if adapter not found', async () => {
      const provider: any = {
        type: 'unknown',
        name: 'Unknown',
        config: {},
      };

      const result = await manager.validateProvider(provider);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('No adapter found');
    });

    it('should handle validation errors', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        id: 'provider_456',
        config: {
          apiKey: 'invalid-key',
          model: 'gpt-4-turbo',
        },
      };

      mockAdapter.validateCredentials.mockRejectedValue(
        new Error('Invalid credentials')
      );
      mockCredentialStore.getCredentials.mockResolvedValue(provider.config);

      const result = await manager.validateProvider(provider);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('getAvailableProviders', () => {
    it('should return empty array if not initialized', () => {
      const newManager = new LLMProviderManager();
      const providers = newManager.getAvailableProviders();
      expect(providers).toEqual([]);
    });

    it('should return list of available providers', () => {
      const mockAdapters: LLMProviderAdapter[] = [
        {
          type: 'claude-api',
          streamSupport: true,
          execute: jest.fn(),
          validateCredentials: jest.fn(),
        },
        {
          type: 'openai',
          streamSupport: true,
          execute: jest.fn(),
          validateCredentials: jest.fn(),
        },
        {
          type: 'google',
          streamSupport: false,
          execute: jest.fn(),
          validateCredentials: jest.fn(),
        },
      ];

      mockAdapters.forEach((adapter) => manager.registerAdapter(adapter));
      (manager as any).initialized = true;

      const providers = manager.getAvailableProviders();

      expect(providers).toHaveLength(3);
      expect(providers).toContainEqual({
        type: 'claude-api',
        streamSupport: true,
      });
      expect(providers).toContainEqual({
        type: 'openai',
        streamSupport: true,
      });
      expect(providers).toContainEqual({
        type: 'google',
        streamSupport: false,
      });
    });
  });

  describe('saveProvider', () => {
    it('should save provider with existing ID', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        id: 'existing_123',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      mockCredentialStore.saveCredentials.mockResolvedValue();

      const providerId = await manager.saveProvider(provider);

      expect(providerId).toBe('existing_123');
      expect(mockCredentialStore.saveCredentials).toHaveBeenCalledWith(
        'existing_123',
        provider
      );
    });

    it('should generate ID if not provided', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      mockCredentialStore.generateId.mockReturnValue('generated_456');
      mockCredentialStore.saveCredentials.mockResolvedValue();

      const providerId = await manager.saveProvider(provider);

      expect(providerId).toBe('generated_456');
      expect(mockCredentialStore.saveCredentials).toHaveBeenCalledWith(
        'generated_456',
        provider
      );
    });
  });

  describe('deleteProvider', () => {
    it('should delete provider credentials', async () => {
      mockCredentialStore.deleteCredentials.mockResolvedValue();

      await manager.deleteProvider('provider_123');

      expect(mockCredentialStore.deleteCredentials).toHaveBeenCalledWith(
        'provider_123'
      );
    });
  });

  describe('listSavedProviders', () => {
    it('should return list of saved providers', async () => {
      const mockProviders: LLMProviderConfig[] = [
        {
          type: 'claude-api',
          name: 'Provider 1',
          id: 'p1',
          config: { apiKey: 'sk-...123', model: 'claude-sonnet-4-5' },
        },
        {
          type: 'openai',
          name: 'Provider 2',
          id: 'p2',
          config: { apiKey: 'sk-...456', model: 'gpt-4-turbo' },
        },
      ];

      mockCredentialStore.listProviders.mockResolvedValue(mockProviders);

      const providers = await manager.listSavedProviders();

      expect(providers).toEqual(mockProviders);
      expect(mockCredentialStore.listProviders).toHaveBeenCalled();
    });
  });

  describe('getProvider', () => {
    it('should get specific provider by ID', async () => {
      const mockProvider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test Provider',
        id: 'provider_123',
        config: { apiKey: 'sk-test', model: 'claude-sonnet-4-5' },
      };

      mockCredentialStore.getProvider.mockResolvedValue(mockProvider);

      const provider = await manager.getProvider('provider_123');

      expect(provider).toEqual(mockProvider);
      expect(mockCredentialStore.getProvider).toHaveBeenCalledWith('provider_123');
    });

    it('should return null if provider not found', async () => {
      mockCredentialStore.getProvider.mockResolvedValue(null);

      const provider = await manager.getProvider('nonexistent');

      expect(provider).toBeNull();
    });
  });
});

describe('getProviderManager', () => {
  it('should return singleton instance', () => {
    const { getProviderManager } = require('../provider-manager');
    const instance1 = getProviderManager();
    const instance2 = getProviderManager();

    expect(instance1).toBe(instance2);
    expect(instance1).toBeInstanceOf(LLMProviderManager);
  });
});
