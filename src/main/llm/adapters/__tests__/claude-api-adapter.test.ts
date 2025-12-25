/**
 * Unit tests for ClaudeAPIAdapter
 *
 * Tests execution with valid credentials, validation,
 * error handling, and token usage tracking.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAPIAdapter } from '../claude-api-adapter';
import {
  LLMRequest,
  LLMResponse,
  ClaudeAPIProvider,
} from '../../../../types/llm-providers';

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk');

jest.mock('../../../logger', () => ({
  LogCategory: {
    WORKFLOW: 'WORKFLOW',
  },
  logWithCategory: jest.fn(),
}));

describe('ClaudeAPIAdapter', () => {
  let adapter: ClaudeAPIAdapter;
  let mockAnthropic: jest.Mocked<Anthropic>;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ClaudeAPIAdapter();

    // Create mock Anthropic instance
    mockAnthropic = {
      messages: {
        create: jest.fn(),
      },
    } as any;

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () => mockAnthropic
    );
  });

  describe('adapter properties', () => {
    it('should have correct type', () => {
      expect(adapter.type).toBe('claude-api');
    });

    it('should support streaming', () => {
      expect(adapter.streamSupport).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute request with valid credentials', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test Claude',
        config: {
          apiKey: 'sk-ant-test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Hello, Claude!',
        context: {},
      };

      const mockResponse = {
        id: 'msg_123',
        model: 'claude-sonnet-4-5-20250929',
        content: [
          {
            type: 'text',
            text: 'Hello! How can I help you today?',
          },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
        role: 'assistant',
        stop_reason: 'end_turn',
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      const result = await adapter.execute(request);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello! How can I help you today?');
      expect(result.model).toBe('claude-sonnet-4-5-20250929');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 1.0,
        system: undefined,
        messages: [
          {
            role: 'user',
            content: 'Hello, Claude!',
          },
        ],
      });
    });

    it('should use credentials from request', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'config-key',
          model: 'claude-sonnet-4-5',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: {
          apiKey: 'credentials-key',
          model: 'claude-sonnet-4-5',
        },
        prompt: 'Test',
        context: {},
      };

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        model: 'claude-sonnet-4-5-20250929',
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      await adapter.execute(request);

      expect(Anthropic).toHaveBeenCalledWith({
        apiKey: 'credentials-key',
      });
    });

    it('should include system prompt if provided', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
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
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        model: 'claude-sonnet-4-5-20250929',
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      await adapter.execute(request);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
        })
      );
    });

    it('should include context messages', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Continue the conversation',
        context: {
          messages: [
            { role: 'user' as const, content: 'Previous message' },
            { role: 'assistant' as const, content: 'Previous response' },
          ],
        },
      };

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        model: 'claude-sonnet-4-5-20250929',
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      await adapter.execute(request);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'Previous message' },
            { role: 'assistant', content: 'Previous response' },
            { role: 'user', content: 'Continue the conversation' },
          ],
        })
      );
    });

    it('should use custom maxTokens and temperature', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
          maxTokens: 2048,
          temperature: 0.5,
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        model: 'claude-sonnet-4-5-20250929',
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      await adapter.execute(request);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2048,
          temperature: 0.5,
        })
      );
    });

    it('should handle multiple text blocks in response', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const mockResponse = {
        content: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: 'Second part' },
        ],
        usage: { input_tokens: 5, output_tokens: 10 },
        model: 'claude-sonnet-4-5-20250929',
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      const result = await adapter.execute(request);

      expect(result.output).toBe('First part\nSecond part');
    });

    it('should throw error if no API key provided', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: '',
          model: 'claude-sonnet-4-5',
        },
      };

      const request: LLMRequest = {
        provider,
        prompt: 'Test',
        context: {},
      };

      const result = await adapter.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No API key provided');
    });

    it('should handle 401 authentication error', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'invalid-key',
          model: 'claude-sonnet-4-5',
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

      mockAnthropic.messages.create.mockRejectedValue(error);

      const result = await adapter.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key. Please check your credentials.');
    });

    it('should handle 429 rate limit error', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
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

      mockAnthropic.messages.create.mockRejectedValue(error);

      const result = await adapter.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded. Please try again later.');
    });

    it('should handle 500 server error', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
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

      mockAnthropic.messages.create.mockRejectedValue(error);

      const result = await adapter.execute(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude API service error. Please try again later.');
    });
  });

  describe('validateCredentials', () => {
    it('should validate valid credentials', async () => {
      const credentials = {
        apiKey: 'sk-ant-valid-key',
        model: 'claude-sonnet-4-5',
      };

      const mockResponse = {
        id: 'msg_test',
        model: 'claude-sonnet-4-5-20250929',
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(true);
      expect(result.model).toBe('claude-sonnet-4-5-20250929');

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
    });

    it('should fail validation with no API key', async () => {
      const credentials = {
        model: 'claude-sonnet-4-5',
      };

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No API key provided');
    });

    it('should fail validation with invalid API key', async () => {
      const credentials = {
        apiKey: 'invalid-key',
        model: 'claude-sonnet-4-5',
      };

      const error: any = new Error('Invalid API key');
      error.status = 401;

      mockAnthropic.messages.create.mockRejectedValue(error);

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should handle rate limit during validation', async () => {
      const credentials = {
        apiKey: 'test-key',
        model: 'claude-sonnet-4-5',
      };

      const error: any = new Error('Rate limit');
      error.status = 429;

      mockAnthropic.messages.create.mockRejectedValue(error);

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Rate limit exceeded during validation.');
    });

    it('should handle service unavailable', async () => {
      const credentials = {
        apiKey: 'test-key',
        model: 'claude-sonnet-4-5',
      };

      const error: any = new Error('Service unavailable');
      error.status = 529;

      mockAnthropic.messages.create.mockRejectedValue(error);

      const result = await adapter.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Claude API service unavailable. Please try again later.'
      );
    });
  });

  describe('model mapping', () => {
    it('should map claude-sonnet-4-5 correctly', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        model: 'claude-sonnet-4-5-20250929',
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      await adapter.execute(request);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
        })
      );
    });

    it('should map claude-opus-4 correctly', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-opus-4',
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        model: 'claude-opus-4-20250514',
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      await adapter.execute(request);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-opus-4-20250514',
        })
      );
    });

    it('should use exact model name if not in mapping', async () => {
      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-3-5-sonnet-20241022' as any,
        },
      };

      const request: LLMRequest = {
        provider,
        credentials: provider.config,
        prompt: 'Test',
        context: {},
      };

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        model: 'claude-3-5-sonnet-20241022',
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse as any);

      await adapter.execute(request);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
        })
      );
    });
  });
});
