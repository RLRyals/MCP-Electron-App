/**
 * OpenAI Adapter
 *
 * Adapter for executing prompts with OpenAI's GPT models
 * Supports GPT-4, GPT-4-Turbo, GPT-3.5-Turbo, and GPT-4o
 */

import { LLMProviderAdapter } from '../provider-manager';
import {
  LLMRequest,
  LLMResponse,
  ProviderValidationResult,
  OpenAIProvider,
} from '../../../types/llm-providers';
import { logWithCategory, LogCategory } from '../../logger';
import OpenAI from 'openai';

export class OpenAIAdapter implements LLMProviderAdapter {
  type: OpenAIProvider['type'] = 'openai';
  streamSupport = true;

  /**
   * Execute request with OpenAI API
   */
  async execute(request: LLMRequest): Promise<LLMResponse> {
    const provider = request.provider as OpenAIProvider;
    const { apiKey, model, maxTokens, temperature } = provider.config;

    try {
      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: apiKey,
      });

      logWithCategory('info', LogCategory.WORKFLOW,
        `Executing OpenAI request with model: ${model}`);

      // Build messages array
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Add system prompt if provided
      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt,
        });
      }

      // Add context as system message if available
      if (request.context && typeof request.context === 'object') {
        const contextStr = JSON.stringify(request.context, null, 2);
        messages.push({
          role: 'system',
          content: `Context: ${contextStr}`,
        });
      }

      // Add user prompt
      messages.push({
        role: 'user',
        content: request.prompt,
      });

      // Execute request
      const completion = await openai.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: maxTokens || 4096,
        temperature: temperature !== undefined ? temperature : 0.7,
      });

      // Extract response
      const responseText = completion.choices[0]?.message?.content || '';

      // Calculate usage
      const usage = completion.usage ? {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      } : undefined;

      logWithCategory('info', LogCategory.WORKFLOW,
        `OpenAI execution successful. Tokens used: ${usage?.totalTokens || 0}`);

      return {
        success: true,
        output: responseText,
        model: completion.model,
        usage,
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `OpenAI execution failed: ${error.message}`);

      // Handle specific OpenAI errors
      let errorMessage = error.message;

      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI API credentials.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (error.status === 500) {
        errorMessage = 'OpenAI service error. Please try again later.';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Unable to connect to OpenAI API. Please check your internet connection.';
      }

      return {
        success: false,
        output: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate OpenAI API credentials
   * Tests the API key by fetching available models
   */
  async validateCredentials(credentials: any): Promise<ProviderValidationResult> {
    try {
      const { apiKey, model } = credentials;

      if (!apiKey || typeof apiKey !== 'string') {
        return {
          valid: false,
          error: 'API key is required',
        };
      }

      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: apiKey,
      });

      logWithCategory('info', LogCategory.WORKFLOW,
        'Validating OpenAI credentials...');

      // Test the API key by fetching models
      const models = await openai.models.list();

      // Check if the requested model is available
      const modelsList = Array.from(models.data);
      const requestedModel = modelsList.find(m => m.id === model);

      if (!requestedModel && model) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Requested model ${model} not found in available models`);
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `OpenAI credentials validated. Found ${modelsList.length} models.`);

      return {
        valid: true,
        model: model || 'gpt-4-turbo',
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `OpenAI credential validation failed: ${error.message}`);

      let errorMessage = error.message;

      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI credentials.';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Unable to connect to OpenAI API. Please check your internet connection.';
      }

      return {
        valid: false,
        error: errorMessage,
      };
    }
  }
}
