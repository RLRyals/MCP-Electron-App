/**
 * Unit tests for CredentialStore
 *
 * Tests initialization, credential encryption/decryption,
 * provider listing with masking, and deletion.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { app, safeStorage } from 'electron';
import { CredentialStore } from '../credential-store';
import { LLMProviderConfig, ClaudeAPIProvider, OpenAIProvider } from '../../../types/llm-providers';

// Mock dependencies
jest.mock('fs-extra');
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(),
  },
  safeStorage: {
    encryptString: jest.fn(),
    decryptString: jest.fn(),
    isEncryptionAvailable: jest.fn(),
  },
}));

jest.mock('../../logger', () => ({
  LogCategory: {
    WORKFLOW: 'WORKFLOW',
  },
  logWithCategory: jest.fn(),
}));

describe('CredentialStore', () => {
  let store: CredentialStore;
  const mockUserDataPath = '/mock/user/data';
  const mockStorePath = path.join(mockUserDataPath, 'llm-providers.enc.json');

  beforeEach(() => {
    jest.clearAllMocks();
    (app.getPath as jest.Mock).mockReturnValue(mockUserDataPath);
    (safeStorage.encryptString as jest.Mock).mockImplementation((str: string) =>
      Buffer.from(`encrypted_${str}`)
    );
    (safeStorage.decryptString as jest.Mock).mockImplementation((buf: Buffer) =>
      buf.toString().replace('encrypted_', '')
    );
    (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true);

    store = new CredentialStore();
  });

  describe('initialization', () => {
    it('should create store instance with correct path', () => {
      expect(store).toBeInstanceOf(CredentialStore);
      expect((store as any).storePath).toBe(mockStorePath);
    });

    it('should create store file if it does not exist', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(false);
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
      (fs.readJson as jest.Mock).mockResolvedValue({});

      await store.initialize();

      expect(fs.writeJson).toHaveBeenCalledWith(mockStorePath, {}, { spaces: 2 });
      expect((store as any).initialized).toBe(true);
    });

    it('should load existing credentials', async () => {
      const mockData = {
        provider_123: {
          id: 'provider_123',
          type: 'claude-api',
          name: 'Test Provider',
          encryptedData: 'encrypted_data',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue(mockData);

      await store.initialize();

      expect((store as any).credentials.size).toBe(1);
      expect((store as any).credentials.has('provider_123')).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({});

      await store.initialize();
      const readJsonCallCount = (fs.readJson as jest.Mock).mock.calls.length;

      await store.initialize();

      expect((fs.readJson as jest.Mock).mock.calls.length).toBe(readJsonCallCount);
    });

    it('should handle initialization errors', async () => {
      (fs.pathExists as jest.Mock).mockRejectedValue(new Error('File system error'));

      await expect(store.initialize()).rejects.toThrow('File system error');
    });
  });

  describe('saveCredentials', () => {
    beforeEach(async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({});
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
      await store.initialize();
    });

    it('should encrypt and save provider credentials', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test Claude',
        id: 'provider_123',
        config: {
          apiKey: 'sk-test-key-123',
          model: 'claude-sonnet-4-5',
        },
      };

      await store.saveCredentials('provider_123', provider);

      expect(safeStorage.encryptString).toHaveBeenCalledWith(
        JSON.stringify(provider)
      );

      const credentials = (store as any).credentials;
      expect(credentials.has('provider_123')).toBe(true);

      const saved = credentials.get('provider_123');
      expect(saved.id).toBe('provider_123');
      expect(saved.type).toBe('claude-api');
      expect(saved.name).toBe('Test Claude');
      expect(saved.encryptedData).toBeDefined();
    });

    it('should persist to disk after saving', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test OpenAI',
        config: {
          apiKey: 'sk-openai-key',
          model: 'gpt-4-turbo',
        },
      };

      await store.saveCredentials('provider_456', provider);

      expect(fs.writeJson).toHaveBeenCalledWith(
        mockStorePath,
        expect.objectContaining({
          provider_456: expect.objectContaining({
            id: 'provider_456',
            type: 'openai',
            name: 'Test OpenAI',
          }),
        }),
        { spaces: 2 }
      );
    });

    it('should update existing credentials', async () => {
      const provider1: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Original',
        config: {
          apiKey: 'old-key',
          model: 'claude-sonnet-4-5',
        },
      };

      const provider2: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Updated',
        config: {
          apiKey: 'new-key',
          model: 'claude-opus-4',
        },
      };

      await store.saveCredentials('provider_123', provider1);
      await store.saveCredentials('provider_123', provider2);

      const credentials = (store as any).credentials;
      const saved = credentials.get('provider_123');
      expect(saved.name).toBe('Updated');
    });

    it('should handle encryption errors', async () => {
      (safeStorage.encryptString as jest.Mock).mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      await expect(store.saveCredentials('test', provider)).rejects.toThrow(
        'Encryption failed'
      );
    });
  });

  describe('getCredentials', () => {
    beforeEach(async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({});
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
      await store.initialize();
    });

    it('should decrypt and return credentials', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        id: 'provider_123',
        config: {
          apiKey: 'sk-test-key',
          model: 'claude-sonnet-4-5',
          maxTokens: 4096,
        },
      };

      await store.saveCredentials('provider_123', provider);

      const credentials = await store.getCredentials('provider_123');

      expect(credentials).toEqual(provider.config);
      expect(safeStorage.decryptString).toHaveBeenCalled();
    });

    it('should throw error if provider not found', async () => {
      await expect(store.getCredentials('nonexistent')).rejects.toThrow(
        'Provider credentials not found: nonexistent'
      );
    });

    it('should handle decryption errors', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      await store.saveCredentials('provider_123', provider);

      (safeStorage.decryptString as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await expect(store.getCredentials('provider_123')).rejects.toThrow(
        'Decryption failed'
      );
    });
  });

  describe('getProvider', () => {
    beforeEach(async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({});
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
      await store.initialize();
    });

    it('should return full provider config', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test OpenAI',
        id: 'provider_456',
        config: {
          apiKey: 'sk-openai',
          model: 'gpt-4-turbo',
          temperature: 0.7,
        },
      };

      await store.saveCredentials('provider_456', provider);

      const retrieved = await store.getProvider('provider_456');

      expect(retrieved).toEqual(provider);
    });

    it('should return null if provider not found', async () => {
      const result = await store.getProvider('nonexistent');
      expect(result).toBeNull();
    });

    it('should handle decryption errors and return null', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      await store.saveCredentials('provider_123', provider);

      (safeStorage.decryptString as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await store.getProvider('provider_123');
      expect(result).toBeNull();
    });
  });

  describe('listProviders', () => {
    beforeEach(async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({});
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
      await store.initialize();
    });

    it('should list all providers with masked credentials', async () => {
      const provider1: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Claude Provider',
        id: 'p1',
        config: {
          apiKey: 'sk-ant-api03-very-long-key-1234567890abcdef',
          model: 'claude-sonnet-4-5',
        },
      };

      const provider2: OpenAIProvider = {
        type: 'openai',
        name: 'OpenAI Provider',
        id: 'p2',
        config: {
          apiKey: 'sk-proj-another-long-key-0987654321',
          model: 'gpt-4-turbo',
        },
      };

      await store.saveCredentials('p1', provider1);
      await store.saveCredentials('p2', provider2);

      const providers = await store.listProviders();

      expect(providers).toHaveLength(2);

      // Check that API keys are masked
      const claudeProvider = providers.find(p => p.id === 'p1') as ClaudeAPIProvider;
      expect(claudeProvider.config.apiKey).not.toBe(provider1.config.apiKey);
      expect(claudeProvider.config.apiKey).toContain('...');

      const openaiProvider = providers.find(p => p.id === 'p2') as OpenAIProvider;
      expect(openaiProvider.config.apiKey).not.toBe(provider2.config.apiKey);
      expect(openaiProvider.config.apiKey).toContain('...');
    });

    it('should handle providers that fail to load', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      await store.saveCredentials('provider_123', provider);

      // Simulate decryption failure for one provider
      let callCount = 0;
      (safeStorage.decryptString as jest.Mock).mockImplementation((buf: Buffer) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Decryption failed');
        }
        return buf.toString().replace('encrypted_', '');
      });

      const providers = await store.listProviders();

      // Should skip the failed provider
      expect(providers).toHaveLength(0);
    });
  });

  describe('deleteCredentials', () => {
    beforeEach(async () => {
      (fs.pathExists as jest.Mock).mockResolvedValue(true);
      (fs.readJson as jest.Mock).mockResolvedValue({});
      (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
      await store.initialize();
    });

    it('should delete provider credentials', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      await store.saveCredentials('provider_123', provider);
      expect((store as any).credentials.has('provider_123')).toBe(true);

      await store.deleteCredentials('provider_123');

      expect((store as any).credentials.has('provider_123')).toBe(false);
      expect(fs.writeJson).toHaveBeenCalled();
    });

    it('should throw error if provider not found', async () => {
      await expect(store.deleteCredentials('nonexistent')).rejects.toThrow(
        'Provider credentials not found: nonexistent'
      );
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = store.generateId();
      const id2 = store.generateId();

      expect(id1).toMatch(/^provider_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^provider_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with correct format', () => {
      const id = store.generateId();
      expect(id).toMatch(/^provider_\d{13,}_[a-z0-9]{9}$/);
    });
  });

  describe('maskSensitiveFields', () => {
    it('should mask long API keys', () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'sk-ant-api03-1234567890abcdef',
          model: 'claude-sonnet-4-5',
        },
      };

      const masked = (store as any).maskSensitiveFields(provider);

      expect(masked.config.apiKey).not.toBe(provider.config.apiKey);
      expect(masked.config.apiKey).toMatch(/^sk-\.\.\..*$/);
    });

    it('should mask short API keys', () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'short',
          model: 'claude-sonnet-4-5',
        },
      };

      const masked = (store as any).maskSensitiveFields(provider);

      expect(masked.config.apiKey).toBe('***');
    });

    it('should not modify other fields', () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'sk-test-key-12345',
          model: 'gpt-4-turbo',
          temperature: 0.7,
          maxTokens: 2048,
        },
      };

      const masked = (store as any).maskSensitiveFields(provider);

      expect(masked.config.model).toBe('gpt-4-turbo');
      expect(masked.config.temperature).toBe(0.7);
      expect(masked.config.maxTokens).toBe(2048);
    });
  });

  describe('isAvailable', () => {
    it('should return true when encryption is available', () => {
      (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(true);

      expect(CredentialStore.isAvailable()).toBe(true);
    });

    it('should return false when encryption is not available', () => {
      (safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(false);

      expect(CredentialStore.isAvailable()).toBe(false);
    });
  });
});
