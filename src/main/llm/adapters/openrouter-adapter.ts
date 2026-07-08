/**
 * OpenRouter Adapter
 *
 * Adapter for executing LLM requests via OpenRouter API
 * OpenRouter provides unified access to multiple LLM providers
 * Uses OpenAI-compatible API format
 */

import axios, { AxiosError } from 'axios';
import { LLMProviderAdapter } from '../provider-manager';
import { LLMRequest, LLMResponse, ProviderValidationResult, OpenRouterProvider } from '../../../types/llm-providers';
import { logWithCategory, LogCategory } from '../../logger';

export class OpenRouterAdapter implements LLMProviderAdapter {
  type: OpenRouterProvider['type'] = 'openrouter';
  streamSupport = true;

  private readonly baseURL = 'https://openrouter.ai/api/v1';
  private readonly modelsEndpoint = '/models';
  private readonly chatEndpoint = '/chat/completions';

  /**
   * Execute request with OpenRouter API
   */
  async execute(request: LLMRequest): Promise<LLMResponse> {
    const provider = request.provider as OpenRouterProvider;
    const credentials = request.credentials || provider.config;

    if (!credentials?.apiKey) {
      return {
        success: false,
        output: null,
        error: 'OpenRouter API key is required',
      };
    }

    try {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Executing OpenRouter request with model: ${credentials.model || 'default'}`);

      // Build messages array
      const messages: Array<{ role: string; content: string }> = [];

      // Add system prompt if provided
      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt,
        });
      }

      // Add user prompt
      messages.push({
        role: 'user',
        content: request.prompt,
      });

      // Build request payload
      const payload = {
        model: credentials.model || 'anthropic/claude-3.5-sonnet',
        messages,
        max_tokens: credentials.maxTokens || 4096,
        temperature: credentials.temperature ?? 0.7,
        stream: false,
      };

      // Make API request
      const response = await axios.post(
        `${this.baseURL}${this.chatEndpoint}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${credentials.apiKey}`,
            'HTTP-Referer': 'FictionLab',
            'Content-Type': 'application/json',
          },
          timeout: 120000, // 2 minute timeout
        }
      );

      // Extract response
      const completion = response.data;

      if (!completion.choices || completion.choices.length === 0) {
        return {
          success: false,
          output: null,
          error: 'No completion returned from OpenRouter',
        };
      }

      const output = completion.choices[0].message?.content || '';

      // Extract usage information
      const usage = completion.usage ? {
        promptTokens: completion.usage.prompt_tokens || 0,
        completionTokens: completion.usage.completion_tokens || 0,
        totalTokens: completion.usage.total_tokens || 0,
      } : undefined;

      logWithCategory('info', LogCategory.WORKFLOW,
        `OpenRouter request completed successfully${usage ? ` (${usage.totalTokens} tokens)` : ''}`);

      return {
        success: true,
        output,
        model: completion.model || credentials.model,
        usage,
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `OpenRouter execution failed: ${error.message}`);

      // Handle axios errors with detailed information
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;
        const errorData = axiosError.response?.data as any;

        let errorMessage = 'OpenRouter API request failed';

        if (statusCode === 401) {
          errorMessage = 'Invalid API key';
        } else if (statusCode === 402) {
          errorMessage = 'Insufficient credits';
        } else if (statusCode === 429) {
          errorMessage = 'Rate limit exceeded';
        } else if (statusCode === 400) {
          errorMessage = errorData?.error?.message || 'Invalid request';
        } else if (statusCode === 404) {
          errorMessage = 'Model not found or not available';
        } else if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        } else if (axiosError.message) {
          errorMessage = axiosError.message;
        }

        return {
          success: false,
          output: null,
          error: errorMessage,
        };
      }

      return {
        success: false,
        output: null,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Validate OpenRouter API credentials
   * Tests by fetching the models list
   */
  async validateCredentials(credentials: any): Promise<ProviderValidationResult> {
    if (!credentials?.apiKey) {
      return {
        valid: false,
        error: 'API key is required',
      };
    }

    try {
      logWithCategory('info', LogCategory.WORKFLOW,
        'Validating OpenRouter API credentials...');

      // Test API key by fetching models list
      const response = await axios.get(
        `${this.baseURL}${this.modelsEndpoint}`,
        {
          headers: {
            'Authorization': `Bearer ${credentials.apiKey}`,
            'HTTP-Referer': 'FictionLab',
          },
          timeout: 10000, // 10 second timeout for validation
        }
      );

      // Check if we got a valid response
      if (response.data && Array.isArray(response.data.data)) {
        const modelCount = response.data.data.length;

        logWithCategory('info', LogCategory.WORKFLOW,
          `OpenRouter API key validated successfully (${modelCount} models available)`);

        // Try to find the specified model if provided
        let modelStatus = `${modelCount} models available`;
        if (credentials.model) {
          const modelExists = response.data.data.some(
            (m: any) => m.id === credentials.model
          );
          if (modelExists) {
            modelStatus = credentials.model;
          } else {
            logWithCategory('warn', LogCategory.WORKFLOW,
              `Specified model '${credentials.model}' not found in available models`);
            modelStatus = `Model '${credentials.model}' not found`;
          }
        }

        return {
          valid: true,
          model: modelStatus,
        };
      }

      return {
        valid: false,
        error: 'Invalid response from OpenRouter API',
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `OpenRouter credential validation failed: ${error.message}`);

      // Handle axios errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;

        if (statusCode === 401) {
          return {
            valid: false,
            error: 'Invalid API key',
          };
        } else if (statusCode === 402) {
          return {
            valid: false,
            error: 'Insufficient credits',
          };
        } else if (statusCode === 429) {
          return {
            valid: false,
            error: 'Rate limit exceeded',
          };
        }

        return {
          valid: false,
          error: axiosError.message || 'API request failed',
        };
      }

      return {
        valid: false,
        error: error.message || 'Unknown error',
      };
    }
  }
}
