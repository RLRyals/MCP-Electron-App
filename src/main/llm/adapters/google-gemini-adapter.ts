/**
 * Google Gemini Adapter
 *
 * Adapter for executing prompts with Google's Gemini API
 * Supports gemini-pro, gemini-ultra, and gemini-1.5-pro models
 */

import { LLMProviderAdapter } from '../provider-manager';
import { LLMRequest, LLMResponse, ProviderValidationResult, GoogleProvider } from '../../../types/llm-providers';
import { logWithCategory, LogCategory } from '../../logger';

// Google Generative AI SDK types
type GoogleGenerativeAI = any;
type GenerativeModel = any;
type GenerateContentResult = any;

export class GoogleGeminiAdapter implements LLMProviderAdapter {
  type: GoogleProvider['type'] = 'google';
  streamSupport = true;

  /**
   * Execute request with Google Gemini API
   */
  async execute(request: LLMRequest): Promise<LLMResponse> {
    const provider = request.provider as GoogleProvider;

    try {
      // Get API key from credentials or config
      const apiKey = request.credentials?.apiKey || provider.config.apiKey;

      if (!apiKey) {
        return {
          success: false,
          output: null,
          error: 'Google API key is required',
        };
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Executing Google Gemini request with model: ${provider.config.model}`);

      // Import Google Generative AI SDK
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI: GoogleGenerativeAI = new GoogleGenerativeAI(apiKey);

      // Get the model
      const model: GenerativeModel = genAI.getGenerativeModel({
        model: provider.config.model,
      });

      // Build generation config
      const generationConfig: any = {};

      if (provider.config.maxTokens) {
        generationConfig.maxOutputTokens = provider.config.maxTokens;
      }

      if (provider.config.temperature !== undefined) {
        generationConfig.temperature = provider.config.temperature;
      }

      // Combine system prompt and user prompt
      let fullPrompt = request.prompt;
      if (request.systemPrompt) {
        fullPrompt = `${request.systemPrompt}\n\n${request.prompt}`;
      }

      // Add context if available
      if (request.context) {
        fullPrompt = `Context:\n${JSON.stringify(request.context, null, 2)}\n\n${fullPrompt}`;
      }

      // Generate content
      const result: GenerateContentResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig,
      });

      const response = result.response;
      const text = response.text();

      // Extract usage metadata if available
      let usage;
      if (response.usageMetadata) {
        usage = {
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          completionTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
        };
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Google Gemini request completed successfully`);

      return {
        success: true,
        output: text,
        model: provider.config.model,
        usage,
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Google Gemini execution failed: ${error.message}`);

      // Handle specific Google API errors
      let errorMessage = error.message;

      if (error.message?.includes('API_KEY_INVALID')) {
        errorMessage = 'Invalid Google API key';
      } else if (error.message?.includes('QUOTA_EXCEEDED')) {
        errorMessage = 'Google API quota exceeded';
      } else if (error.message?.includes('PERMISSION_DENIED')) {
        errorMessage = 'Permission denied - check API key permissions';
      } else if (error.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'Rate limit exceeded - please try again later';
      }

      return {
        success: false,
        output: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate Google API credentials
   */
  async validateCredentials(credentials: any): Promise<ProviderValidationResult> {
    try {
      const apiKey = credentials?.apiKey;

      if (!apiKey) {
        return {
          valid: false,
          error: 'Google API key is required',
        };
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        'Validating Google API credentials');

      // Import Google Generative AI SDK
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI: GoogleGenerativeAI = new GoogleGenerativeAI(apiKey);

      // Try to get available models to validate the API key
      // Use gemini-pro as it's widely available
      const model: GenerativeModel = genAI.getGenerativeModel({
        model: 'gemini-pro',
      });

      // Send a minimal test request
      const result: GenerateContentResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        generationConfig: {
          maxOutputTokens: 10,
        },
      });

      // If we got a response, the API key is valid
      if (result.response) {
        logWithCategory('info', LogCategory.WORKFLOW,
          'Google API credentials validated successfully');

        return {
          valid: true,
          model: credentials.model || 'gemini-pro',
        };
      }

      return {
        valid: false,
        error: 'Failed to validate Google API key',
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Google API validation failed: ${error.message}`);

      // Handle specific validation errors
      let errorMessage = 'Invalid Google API key or configuration';

      if (error.message?.includes('API_KEY_INVALID')) {
        errorMessage = 'Invalid Google API key';
      } else if (error.message?.includes('PERMISSION_DENIED')) {
        errorMessage = 'API key does not have required permissions';
      } else if (error.message?.includes('MODULE_NOT_FOUND')) {
        errorMessage = 'Google Generative AI SDK not installed. Please run: npm install @google/generative-ai';
      }

      return {
        valid: false,
        error: errorMessage,
      };
    }
  }
}
