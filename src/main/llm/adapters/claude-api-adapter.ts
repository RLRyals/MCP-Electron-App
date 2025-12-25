/**
 * Claude API Adapter
 *
 * Adapter for executing prompts using Anthropic's Claude API
 * Requires API key and supports Claude models via direct API calls
 */

import Anthropic from '@anthropic-ai/sdk';
import { LLMProviderAdapter } from '../provider-manager';
import { LLMRequest, LLMResponse, ProviderValidationResult, ClaudeAPIProvider } from '../../../types/llm-providers';
import { logWithCategory, LogCategory } from '../../logger';

export class ClaudeAPIAdapter implements LLMProviderAdapter {
  type: ClaudeAPIProvider['type'] = 'claude-api';
  streamSupport = true;

  /**
   * Execute request with Claude API
   */
  async execute(request: LLMRequest): Promise<LLMResponse> {
    const provider = request.provider as ClaudeAPIProvider;

    try {
      // Get API key from multiple sources (in order of priority):
      // 1. From credentials (user configured in app)
      // 2. From provider config (embedded in workflow)
      // 3. From environment (if running through Claude Code)
      const apiKey = request.credentials?.apiKey
        || provider.config.apiKey
        || process.env.ANTHROPIC_API_KEY;

      if (!apiKey || apiKey.trim() === '') {
        throw new Error(
          'No Anthropic API key configured. ' +
          '\n\n📌 HOW TO FIX:\n' +
          '1. Get your API key from https://console.anthropic.com/settings/keys\n' +
          '2. In FictionLab, go to Settings → LLM Providers\n' +
          '3. Click "Add Provider" and select "Claude API"\n' +
          '4. Paste your API key and save\n' +
          '5. Re-run this workflow\n\n' +
          '💡 Cost: ~$0.10-$2.00 per workflow run (pay-as-you-go)'
        );
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Using API key from: ${request.credentials?.apiKey ? 'user config' : provider.config.apiKey ? 'workflow config' : 'environment'}`);


      // Initialize Anthropic client
      const anthropic = new Anthropic({
        apiKey: apiKey,
      });

      // Build messages array
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      // Add context messages if available
      if (request.context?.messages) {
        messages.push(...request.context.messages);
      }

      // Add current prompt
      messages.push({
        role: 'user',
        content: request.prompt,
      });

      // Determine model
      const model = provider.config.model || 'claude-sonnet-4-5';

      // Map model names to Anthropic API model identifiers
      const modelMapping: Record<string, string> = {
        'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
        'claude-opus-4': 'claude-opus-4-20250514',
        'claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
      };

      const apiModel = modelMapping[model] || model;

      logWithCategory('info', LogCategory.WORKFLOW,
        `Executing Claude API request with model: ${apiModel}`);

      // Call Claude API
      const response = await anthropic.messages.create({
        model: apiModel,
        max_tokens: provider.config.maxTokens || 4096,
        temperature: provider.config.temperature !== undefined ? provider.config.temperature : 1.0,
        system: request.systemPrompt || undefined,
        messages: messages,
      });

      // Extract text content from response
      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      // Build usage stats
      const usage = {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      };

      logWithCategory('info', LogCategory.WORKFLOW,
        `Claude API response received. Tokens: ${usage.totalTokens} (${usage.promptTokens} prompt + ${usage.completionTokens} completion)`);

      return {
        success: true,
        output: content,
        model: response.model,
        usage: usage,
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Claude API execution failed: ${error.message}`);

      // Check for specific error types
      let errorMessage = error.message;

      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your credentials.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (error.status === 500 || error.status === 529) {
        errorMessage = 'Claude API service error. Please try again later.';
      }

      return {
        success: false,
        output: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate Claude API credentials
   */
  async validateCredentials(credentials: any): Promise<ProviderValidationResult> {
    try {
      const apiKey = credentials?.apiKey;

      if (!apiKey) {
        return {
          valid: false,
          error: 'No API key provided',
        };
      }

      // Initialize Anthropic client
      const anthropic = new Anthropic({
        apiKey: apiKey,
      });

      // Test with a minimal request
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
      });

      logWithCategory('info', LogCategory.WORKFLOW,
        `Claude API credentials validated successfully. Model: ${response.model}`);

      return {
        valid: true,
        model: response.model,
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Claude API validation failed: ${error.message}`);

      // Provide helpful error messages
      let errorMessage = error.message;

      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your Anthropic API key.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded during validation.';
      } else if (error.status === 500 || error.status === 529) {
        errorMessage = 'Claude API service unavailable. Please try again later.';
      }

      return {
        valid: false,
        error: errorMessage,
      };
    }
  }
}
