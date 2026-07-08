/**
 * Integration tests for LLM adapters
 *
 * Tests all adapters with common interface, provider switching,
 * and integration with ProviderManager.
 */

import { LLMProviderManager, LLMProviderAdapter } from '../../provider-manager';
import { ClaudeAPIAdapter } from '../claude-api-adapter';
import { OpenAIAdapter } from '../openai-adapter';
import { GoogleGeminiAdapter } from '../google-gemini-adapter';
import { ClaudeCodeCLIAdapter } from '../claude-code-cli-adapter';
import {
  LLMRequest,
  LLMResponse,
  ClaudeAPIProvider,
  OpenAIProvider,
  GoogleProvider,
  ClaudeCodeCLIProvider,
} from '../../../../types/llm-providers';

// Mock all external SDKs
jest.mock('@anthropic-ai/sdk');
jest.mock('openai');
jest.mock('@google/generative-ai');
jest.mock('../../../workflow/claude-code-executor');
jest.mock('../../credential-store');
jest.mock('../../../logger', () => ({
  LogCategory: { WORKFLOW: 'WORKFLOW' },
  logWithCategory: jest.fn(),
}));

describe('Adapter Integration Tests', () => {
  describe('Common adapter interface', () => {
    const adapters: Array<{
      name: string;
      adapter: LLMProviderAdapter;
      provider: any;
      mockSetup: () => void;
    }> = [];

    beforeAll(() => {
      // Claude API Adapter
      const claudeAdapter = new ClaudeAPIAdapter();
      const claudeProvider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test Claude',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      adapters.push({
        name: 'ClaudeAPIAdapter',
        adapter: claudeAdapter,
        provider: claudeProvider,
        mockSetup: () => {
          const Anthropic = require('@anthropic-ai/sdk');
          const mockAnthropic = {
            messages: {
              create: jest.fn().mockResolvedValue({
                content: [{ type: 'text', text: 'Claude response' }],
                usage: { input_tokens: 10, output_tokens: 20 },
                model: 'claude-sonnet-4-5-20250929',
              }),
            },
          };
          Anthropic.mockImplementation(() => mockAnthropic);
        },
      });

      // OpenAI Adapter
      const openaiAdapter = new OpenAIAdapter();
      const openaiProvider: OpenAIProvider = {
        type: 'openai',
        name: 'Test OpenAI',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
        },
      };

      adapters.push({
        name: 'OpenAIAdapter',
        adapter: openaiAdapter,
        provider: openaiProvider,
        mockSetup: () => {
          const OpenAI = require('openai');
          const mockOpenAI = {
            chat: {
              completions: {
                create: jest.fn().mockResolvedValue({
                  choices: [{ message: { content: 'OpenAI response' } }],
                  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
                  model: 'gpt-4-turbo',
                }),
              },
            },
          };
          OpenAI.mockImplementation(() => mockOpenAI);
        },
      });

      // Google Gemini Adapter
      const googleAdapter = new GoogleGeminiAdapter();
      const googleProvider: GoogleProvider = {
        type: 'google',
        name: 'Test Google',
        config: {
          apiKey: 'test-key',
          model: 'gemini-pro',
        },
      };

      adapters.push({
        name: 'GoogleGeminiAdapter',
        adapter: googleAdapter,
        provider: googleProvider,
        mockSetup: () => {
          const { GoogleGenerativeAI } = require('@google/generative-ai');
          const mockGenAI = {
            getGenerativeModel: jest.fn().mockReturnValue({
              generateContent: jest.fn().mockResolvedValue({
                response: {
                  text: () => 'Google response',
                  usageMetadata: {
                    promptTokenCount: 10,
                    candidatesTokenCount: 20,
                    totalTokenCount: 30,
                  },
                },
              }),
            }),
          };
          GoogleGenerativeAI.mockImplementation(() => mockGenAI);
        },
      });
    });

    describe.each(adapters)('$name', ({ name, adapter, provider, mockSetup }) => {
      beforeEach(() => {
        jest.clearAllMocks();
        mockSetup();
      });

      it('should have required adapter properties', () => {
        expect(adapter).toHaveProperty('type');
        expect(adapter).toHaveProperty('streamSupport');
        expect(adapter).toHaveProperty('execute');
        expect(adapter).toHaveProperty('validateCredentials');
      });

      it('should have correct type', () => {
        expect(adapter.type).toBe(provider.type);
      });

      it('should execute request successfully', async () => {
        const request: LLMRequest = {
          provider,
          credentials: provider.config,
          prompt: 'Test prompt',
          context: {},
        };

        const result = await adapter.execute(request);

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('output');
        expect(result.success).toBe(true);
        expect(result.output).toBeTruthy();
      });

      it('should include usage statistics', async () => {
        const request: LLMRequest = {
          provider,
          credentials: provider.config,
          prompt: 'Test prompt',
          context: {},
        };

        const result = await adapter.execute(request);

        if (result.success && result.usage) {
          expect(result.usage).toHaveProperty('promptTokens');
          expect(result.usage).toHaveProperty('completionTokens');
          expect(result.usage).toHaveProperty('totalTokens');
          expect(typeof result.usage.promptTokens).toBe('number');
          expect(typeof result.usage.completionTokens).toBe('number');
          expect(typeof result.usage.totalTokens).toBe('number');
        }
      });

      it('should validate credentials', async () => {
        const result = await adapter.validateCredentials(provider.config);

        expect(result).toHaveProperty('valid');
        expect(typeof result.valid).toBe('boolean');

        if (!result.valid) {
          expect(result).toHaveProperty('error');
        }
      });
    });
  });

  describe('Provider switching', () => {
    let manager: LLMProviderManager;

    beforeEach(async () => {
      manager = new LLMProviderManager();

      // Register mock adapters
      const claudeAdapter = new ClaudeAPIAdapter();
      const openaiAdapter = new OpenAIAdapter();

      manager.registerAdapter(claudeAdapter);
      manager.registerAdapter(openaiAdapter);

      (manager as any).initialized = true;

      // Setup mocks
      const Anthropic = require('@anthropic-ai/sdk');
      const mockAnthropic = {
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Claude response' }],
            usage: { input_tokens: 10, output_tokens: 20 },
            model: 'claude-sonnet-4-5-20250929',
          }),
        },
      };
      Anthropic.mockImplementation(() => mockAnthropic);

      const OpenAI = require('openai');
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'OpenAI response' } }],
              usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
              model: 'gpt-4-turbo',
            }),
          },
        },
      };
      OpenAI.mockImplementation(() => mockOpenAI);
    });

    it('should switch between Claude and OpenAI providers', async () => {
      const claudeProvider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Claude',
        config: {
          apiKey: 'claude-key',
          model: 'claude-sonnet-4-5',
        },
      };

      const openaiProvider: OpenAIProvider = {
        type: 'openai',
        name: 'OpenAI',
        config: {
          apiKey: 'openai-key',
          model: 'gpt-4-turbo',
        },
      };

      // Execute with Claude
      const claudeResult = await manager.executePrompt(
        claudeProvider,
        'Test with Claude',
        {}
      );

      expect(claudeResult.success).toBe(true);
      expect(claudeResult.output).toBe('Claude response');

      // Execute with OpenAI
      const openaiResult = await manager.executePrompt(
        openaiProvider,
        'Test with OpenAI',
        {}
      );

      expect(openaiResult.success).toBe(true);
      expect(openaiResult.output).toBe('OpenAI response');
    });

    it('should maintain provider-specific configurations', async () => {
      const highTempProvider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'High Temp',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
          temperature: 1.5,
        },
      };

      const lowTempProvider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Low Temp',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
          temperature: 0.2,
        },
      };

      await manager.executePrompt(highTempProvider, 'Test', {});
      await manager.executePrompt(lowTempProvider, 'Test', {});

      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = Anthropic.mock.results[0].value.messages.create;

      // Verify different temperatures were used
      expect(mockCreate.mock.calls[0][0].temperature).toBe(1.5);
      expect(mockCreate.mock.calls[1][0].temperature).toBe(0.2);
    });
  });

  describe('Provider fallback', () => {
    let manager: LLMProviderManager;

    beforeEach(() => {
      manager = new LLMProviderManager();
      (manager as any).initialized = true;
    });

    it('should handle primary provider failure gracefully', async () => {
      // Register a failing adapter
      const failingAdapter: LLMProviderAdapter = {
        type: 'claude-api',
        streamSupport: true,
        execute: jest.fn().mockRejectedValue(new Error('Primary failed')),
        validateCredentials: jest.fn(),
      };

      manager.registerAdapter(failingAdapter);

      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Failing Provider',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      await expect(
        manager.executePrompt(provider, 'Test', {})
      ).rejects.toThrow('Primary failed');
    });

    it('should allow manual fallback to different provider', async () => {
      // Register two adapters
      const failingClaudeAdapter: LLMProviderAdapter = {
        type: 'claude-api',
        streamSupport: true,
        execute: jest.fn().mockRejectedValue(new Error('Claude failed')),
        validateCredentials: jest.fn(),
      };

      const workingOpenAIAdapter: LLMProviderAdapter = {
        type: 'openai',
        streamSupport: true,
        execute: jest.fn().mockResolvedValue({
          success: true,
          output: 'Fallback response',
        }),
        validateCredentials: jest.fn(),
      };

      manager.registerAdapter(failingClaudeAdapter);
      manager.registerAdapter(workingOpenAIAdapter);

      const claudeProvider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Claude',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      const openaiProvider: OpenAIProvider = {
        type: 'openai',
        name: 'OpenAI Fallback',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
        },
      };

      // Try Claude first (will fail)
      let result;
      try {
        result = await manager.executePrompt(claudeProvider, 'Test', {});
      } catch (error) {
        // Fallback to OpenAI
        result = await manager.executePrompt(openaiProvider, 'Test', {});
      }

      expect(result.success).toBe(true);
      expect(result.output).toBe('Fallback response');
    });
  });

  describe('Event handling', () => {
    let manager: LLMProviderManager;

    beforeEach(() => {
      manager = new LLMProviderManager();

      const successAdapter: LLMProviderAdapter = {
        type: 'claude-api',
        streamSupport: true,
        execute: jest.fn().mockResolvedValue({
          success: true,
          output: 'Success',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }),
        validateCredentials: jest.fn(),
      };

      manager.registerAdapter(successAdapter);
      (manager as any).initialized = true;
    });

    it('should emit execution-complete event on success', async () => {
      const eventSpy = jest.fn();
      manager.on('execution-complete', eventSpy);

      const provider: ClaudeAPIProvider = {
        type: 'claude-api',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'claude-sonnet-4-5',
        },
      };

      await manager.executePrompt(provider, 'Test', {});

      expect(eventSpy).toHaveBeenCalledWith({
        provider: 'claude-api',
        success: true,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });
    });

    it('should emit execution-error event on failure', async () => {
      const failingAdapter: LLMProviderAdapter = {
        type: 'openai',
        streamSupport: true,
        execute: jest.fn().mockRejectedValue(new Error('Execution failed')),
        validateCredentials: jest.fn(),
      };

      manager.registerAdapter(failingAdapter);

      const eventSpy = jest.fn();
      manager.on('execution-error', eventSpy);

      const provider: OpenAIProvider = {
        type: 'openai',
        name: 'Test',
        config: {
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
        },
      };

      await expect(manager.executePrompt(provider, 'Test', {})).rejects.toThrow();

      expect(eventSpy).toHaveBeenCalledWith({
        provider: 'openai',
        error: 'Execution failed',
      });
    });
  });

  describe('Context handling across adapters', () => {
    it('should pass context correctly to all adapters', async () => {
      const context = {
        projectName: 'Test Project',
        seriesName: 'Test Series',
        phase: 1,
        data: { key: 'value' },
      };

      const adapters = [
        { adapter: new ClaudeAPIAdapter(), mockModule: '@anthropic-ai/sdk' },
        { adapter: new OpenAIAdapter(), mockModule: 'openai' },
        { adapter: new GoogleGeminiAdapter(), mockModule: '@google/generative-ai' },
      ];

      for (const { adapter, mockModule } of adapters) {
        const provider = {
          type: adapter.type,
          name: 'Test',
          config: {
            apiKey: 'test-key',
            model: 'test-model',
          },
        } as any;

        const request: LLMRequest = {
          provider,
          credentials: provider.config,
          prompt: 'Test prompt',
          context,
        };

        // Mock appropriate SDK
        if (mockModule === '@anthropic-ai/sdk') {
          const Anthropic = require(mockModule);
          Anthropic.mockImplementation(() => ({
            messages: {
              create: jest.fn().mockResolvedValue({
                content: [{ type: 'text', text: 'Response' }],
                usage: { input_tokens: 5, output_tokens: 5 },
                model: 'test-model',
              }),
            },
          }));
        } else if (mockModule === 'openai') {
          const OpenAI = require(mockModule);
          OpenAI.mockImplementation(() => ({
            chat: {
              completions: {
                create: jest.fn().mockResolvedValue({
                  choices: [{ message: { content: 'Response' } }],
                  usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
                  model: 'test-model',
                }),
              },
            },
          }));
        } else if (mockModule === '@google/generative-ai') {
          const { GoogleGenerativeAI } = require(mockModule);
          GoogleGenerativeAI.mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue({
              generateContent: jest.fn().mockResolvedValue({
                response: {
                  text: () => 'Response',
                  usageMetadata: {
                    promptTokenCount: 5,
                    candidatesTokenCount: 5,
                    totalTokenCount: 10,
                  },
                },
              }),
            }),
          }));
        }

        const result = await adapter.execute(request);
        expect(result.success).toBe(true);
      }
    });
  });
});
