/**
 * Unit tests for OpenAIAdapter
 *
 * Tests execution with valid credentials, validation,
 * different models, and error handling.
 */

import OpenAI from 'openai';
import { OpenAIAdapter } from '../openai-adapter';
import {
  LLMRequest,
  LLMResponse,
  OpenAIProvider,
} from '../../../../types/llm-providers';

// Mock OpenAI SDK
jest.mock('openai');

jest.mock('../../../logger', () => ({
  LogCategory: {
    WORKFLOW: 'WORKFLOW',
  },
  logWithCategory: jest.fn(),
}));

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new OpenAIAdapter();

    // Create mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
      models: {
        list: jest.fn(),
      },
    } as any;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () => mockOpenAI
    );
  });

  describe('adapter properties', () => {
    it('should have correct type', () => {
      expect(adapter.type).toBe('openai');
    });

    it('should support streaming', () => {
      expect(adapter.streamSupport).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute request with valid credentials', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test OpenAI',
        config: {
          apiKey: 'sk-test-key',
          model: 'gpt-4-turbo',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Hello, GPT!',
        context: {},
      };

      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4-turbo',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await adapter.execute(request);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello! How can I help you today?');
      expect(result.model).toBe('gpt-4-turbo');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'user',
            content: 'Hello, GPT!',
          },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      });
    });

    it('should include system prompt if provided', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'User message',
        context: {},
        systemPrompt: 'You are a helpful assistant',
      };

      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4-turbo',
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      await adapter.execute(request);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'User message' },
          ],
        })
      );
    });

    it('should include context as system message', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
        },
      };

      const context = {
        projectName: 'Test Project',
        phase: 1,
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'User message',
        context,
      };

      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4-turbo',
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      await adapter.execute(request);

      const calls = mockOpenAI.chat.completions.create.mock.calls[0];
      const messages = (calls[0] as any).messages;

      expect(messages).toContainEqual(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('projectName'),
        })
      );
    });

    it('should use custom maxTokens and temperature', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
          maxTokens: 2048,
          temperature: 0.3,
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        model: 'gpt-4-turbo',
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      await adapter.execute(request);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2048,
          temperature: 0.3,
        })
      );
    });

    it('should work with different models', async () => {
      const models: Array<OpenAIProvider['config']['model']> = [
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'gpt-4o',
      ];

      for (const model of models) {
        const provider: OpenAIProvider = {
          type: 'openai',
          name: 'Test',
          config: {
            apiKey: 'test-key',
            model,
          },
        };

        const request: LLMRequest = {
          provider,
          credentials: provider.config,
          prompt: 'Test',
          context: {},
        };

        const mockResponse = {
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
          model,
        };

        mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

        const result = await adapter.execute(request);

        expect(result.success).toBe(true);
        expect(result.model).toBe(model);
      }
    });

    it('should handle empty response content', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const mockResponse = {
        choices: [{ message: { content: null } }],
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        model: 'gpt-4-turbo',
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await adapter.execute(request);

      expect(result.success).toBe(true);
      expect(result.output).toBe('');
    });

    it('should handle response without usage', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
        model: 'gpt-4-turbo',
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await adapter.execute(request);

      expect(result.success).toBe(true);
      expect(result.usage).toBeUndefined();
    });

    it('should handle 401 authentication error', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'invalid-key',
          model: 'gpt-4-turbo',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const error: any = new Error('Authentication failed');
      error.status = 401;

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      const result = await adapter.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Invalid API key. Please check your OpenAI API credentials.'
      );
    });

    it('should handle 429 rate limit error', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const error: any = new Error('Rate limit exceeded');
      error.status = 429;

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      const result = await adapter.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded. Please try again later.');
    });

    it('should handle 500 server error', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const error: any = new Error('Internal server error');
      error.status = 500;

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      const result = await adapter.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('OpenAI service error. Please try again later.');
    });

    it('should handle network errors', async () => {
      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const error: any = new Error('Network error');
      error.code = 'ENOTFOUND';

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      const result = await adapter.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Unable to connect to OpenAI API. Please check your internet connection.'
      );
    });
  });

  describe('validateCredentials', () => {
    it('should validate valid credentials', async () => {
      const credentials = {
        apiKey: 'sk-valid-key',
        model: 'gpt-4-turbo',
      };

      const mockModelsResponse = {
        data: [
          { id: 'gpt-4-turbo', object: 'model', created: 1234567890 },
          { id: 'gpt-4', object: 'model', created: 1234567890 },
          { id: 'gpt-3.5-turbo', object: 'model', created: 1234567890 },
        ],
      };

      mockOpenAI.models.list.mockResolvedValue(mockModelsResponse as any);

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(true);
      expect(result.model).toBe('gpt-4-turbo');
      expect(mockOpenAI.models.list).toHaveBeenCalled();
    });

    it('should validate even if requested model not found', async () => {
      const credentials = {
        apiKey: 'sk-valid-key',
        model: 'gpt-5-turbo',
      };

      const mockModelsResponse = {
        data: [
          { id: 'gpt-4-turbo', object: 'model', created: 1234567890 },
          { id: 'gpt-4', object: 'model', created: 1234567890 },
        ],
      };

      mockOpenAI.models.list.mockResolvedValue(mockModelsResponse as any);

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(true);
    });

    it('should use default model if not specified', async () => {
      const credentials = {
        apiKey: 'sk-valid-key',
      };

      const mockModelsResponse = {
        data: [{ id: 'gpt-4-turbo', object: 'model', created: 1234567890 }],
      };

      mockOpenAI.models.list.mockResolvedValue(mockModelsResponse as any);

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(true);
      expect(result.model).toBe('gpt-4-turbo');
    });

    it('should fail validation with no API key', async () => {
      const credentials = {
        model: 'gpt-4-turbo',
      };

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required');
    });

    it('should fail validation with non-string API key', async () => {
      const credentials = {
        apiKey: 12345,
        model: 'gpt-4-turbo',
      };

      const result = await adapter.validateCredentials(credentials as any);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required');
    });

    it('should fail validation with invalid API key', async () => {
      const credentials = {
        apiKey: 'invalid-key',
        model: 'gpt-4-turbo',
      };

      const error: any = new Error('Invalid API key');
      error.status = 401;

      mockOpenAI.models.list.mockRejectedValue(error);

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should handle network errors during validation', async () => {
      const credentials = {
        apiKey: 'test-key',
        model: 'gpt-4-turbo',
      };

      const error: any = new Error('Network error');
      error.code = 'ECONNREFUSED';

      mockOpenAI.models.list.mockRejectedValue(error);

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Unable to connect to OpenAI API. Please check your internet connection.'
      );
    });
  });
});
