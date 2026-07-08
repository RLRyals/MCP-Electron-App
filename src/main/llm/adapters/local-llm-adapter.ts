/**
 * Local LLM Adapter
 *
 * Adapter for local LLM providers (Ollama, LM Studio, etc.)
 * Supports both Ollama API format and OpenAI-compatible format
 */

import { LLMProviderAdapter } from '../provider-manager';
import { LLMRequest, LLMResponse, ProviderValidationResult, LocalLLMProvider } from '../../../types/llm-providers';
import { logWithCategory, LogCategory } from '../../logger';
import axios, { AxiosError } from 'axios';

export class LocalLLMAdapter implements LLMProviderAdapter {
  type: LocalLLMProvider['type'] = 'local';
  streamSupport = true;

  /**
   * Execute request with local LLM
   */
  async execute(request: LLMRequest): Promise<LLMResponse> {
    const provider = request.provider as LocalLLMProvider;
    const { endpoint, model, apiFormat, maxTokens, temperature } = provider.config;

    try {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Executing local LLM request: ${apiFormat} format, model: ${model}`);

      // Route to appropriate API format
      if (apiFormat === 'ollama') {
        return await this.executeOllama(endpoint, model, request, maxTokens, temperature);
      } else {
        return await this.executeOpenAICompatible(endpoint, model, request, maxTokens, temperature);
      }

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Local LLM execution failed: ${error.message}`);

      return {
        success: false,
        output: null,
        error: error.message,
      };
    }
  }

  /**
   * Execute using Ollama API format
   */
  private async executeOllama(
    endpoint: string,
    model: string,
    request: LLMRequest,
    maxTokens?: number,
    temperature?: number
  ): Promise<LLMResponse> {
    try {
      // Build Ollama request
      const url = `${endpoint}/api/generate`;

      // Combine system prompt and user prompt
      let fullPrompt = request.prompt;
      if (request.systemPrompt) {
        fullPrompt = `${request.systemPrompt}\n\n${request.prompt}`;
      }

      const requestBody: any = {
        model,
        prompt: fullPrompt,
        stream: false,
      };

      // Add optional parameters
      const options: any = {};
      if (maxTokens) {
        options.num_predict = maxTokens;
      }
      if (temperature !== undefined) {
        options.temperature = temperature;
      }
      if (Object.keys(options).length > 0) {
        requestBody.options = options;
      }

      logWithCategory('debug', LogCategory.WORKFLOW,
        `Ollama request to ${url} with model ${model}`);

      // Make request
      const response = await axios.post(url, requestBody, {
        timeout: 300000, // 5 minutes timeout
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Extract response
      const output = response.data.response;

      logWithCategory('info', LogCategory.WORKFLOW,
        `Ollama request completed successfully`);

      return {
        success: true,
        output,
        model,
        usage: {
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0,
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
        },
      };

    } catch (error: any) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        // Server responded with error status
        const errorData = axiosError.response.data as any;
        throw new Error(`Ollama API error: ${errorData.error || axiosError.message}`);
      } else if (axiosError.request) {
        // Request made but no response received
        throw new Error(`Cannot connect to Ollama at ${endpoint}. Is Ollama running?`);
      } else {
        // Error in request setup
        throw new Error(`Request error: ${axiosError.message}`);
      }
    }
  }

  /**
   * Execute using OpenAI-compatible API format
   * Works with LM Studio, LocalAI, and other OpenAI-compatible endpoints
   */
  private async executeOpenAICompatible(
    endpoint: string,
    model: string,
    request: LLMRequest,
    maxTokens?: number,
    temperature?: number
  ): Promise<LLMResponse> {
    try {
      // Build OpenAI-compatible request
      const url = `${endpoint}/v1/chat/completions`;

      // Build messages array
      const messages: any[] = [];

      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt,
        });
      }

      messages.push({
        role: 'user',
        content: request.prompt,
      });

      const requestBody: any = {
        model,
        messages,
        stream: false,
      };

      // Add optional parameters
      if (maxTokens) {
        requestBody.max_tokens = maxTokens;
      }
      if (temperature !== undefined) {
        requestBody.temperature = temperature;
      }

      logWithCategory('debug', LogCategory.WORKFLOW,
        `OpenAI-compatible request to ${url} with model ${model}`);

      // Make request
      const response = await axios.post(url, requestBody, {
        timeout: 300000, // 5 minutes timeout
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Extract response
      const output = response.data.choices[0]?.message?.content || '';

      logWithCategory('info', LogCategory.WORKFLOW,
        `OpenAI-compatible request completed successfully`);

      return {
        success: true,
        output,
        model: response.data.model || model,
        usage: {
          promptTokens: response.data.usage?.prompt_tokens || 0,
          completionTokens: response.data.usage?.completion_tokens || 0,
          totalTokens: response.data.usage?.total_tokens || 0,
        },
      };

    } catch (error: any) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        // Server responded with error status
        const errorData = axiosError.response.data as any;
        throw new Error(`OpenAI-compatible API error: ${errorData.error?.message || axiosError.message}`);
      } else if (axiosError.request) {
        // Request made but no response received
        throw new Error(`Cannot connect to endpoint at ${endpoint}. Is the service running?`);
      } else {
        // Error in request setup
        throw new Error(`Request error: ${axiosError.message}`);
      }
    }
  }

  /**
   * Validate local LLM endpoint connectivity and model availability
   */
  async validateCredentials(credentials: any): Promise<ProviderValidationResult> {
    try {
      const { endpoint, model, apiFormat } = credentials;

      if (!endpoint) {
        return {
          valid: false,
          error: 'Endpoint URL is required',
        };
      }

      if (!model) {
        return {
          valid: false,
          error: 'Model name is required',
        };
      }

      if (!apiFormat) {
        return {
          valid: false,
          error: 'API format is required (ollama or openai-compatible)',
        };
      }

      logWithCategory('info', LogCategory.WORKFLOW,
        `Validating local LLM: ${apiFormat} at ${endpoint}`);

      // Route to appropriate validation
      if (apiFormat === 'ollama') {
        return await this.validateOllama(endpoint, model);
      } else {
        return await this.validateOpenAICompatible(endpoint, model);
      }

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Local LLM validation failed: ${error.message}`);

      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate Ollama endpoint
   */
  private async validateOllama(endpoint: string, model: string): Promise<ProviderValidationResult> {
    try {
      // First, check if Ollama is running by hitting the version endpoint
      const versionUrl = `${endpoint}/api/version`;

      try {
        await axios.get(versionUrl, { timeout: 5000 });
      } catch (error: any) {
        return {
          valid: false,
          error: `Cannot connect to Ollama at ${endpoint}. Is Ollama running?`,
        };
      }

      // Then, check if the model exists by listing models
      const modelsUrl = `${endpoint}/api/tags`;

      try {
        const response = await axios.get(modelsUrl, { timeout: 5000 });
        const models = response.data.models || [];

        // Check if requested model exists
        const modelExists = models.some((m: any) => m.name === model || m.name.startsWith(model));

        if (!modelExists) {
          return {
            valid: false,
            error: `Model "${model}" not found in Ollama. Available models: ${models.map((m: any) => m.name).join(', ')}`,
          };
        }

        logWithCategory('info', LogCategory.WORKFLOW,
          `Ollama validation successful: model "${model}" is available`);

        return {
          valid: true,
          model,
        };

      } catch (error: any) {
        return {
          valid: false,
          error: `Failed to list Ollama models: ${error.message}`,
        };
      }

    } catch (error: any) {
      return {
        valid: false,
        error: `Ollama validation error: ${error.message}`,
      };
    }
  }

  /**
   * Validate OpenAI-compatible endpoint
   */
  private async validateOpenAICompatible(endpoint: string, model: string): Promise<ProviderValidationResult> {
    try {
      // Try to list models from the endpoint
      const modelsUrl = `${endpoint}/v1/models`;

      try {
        const response = await axios.get(modelsUrl, { timeout: 5000 });
        const models = response.data.data || [];

        // Check if requested model exists
        const modelExists = models.some((m: any) => m.id === model);

        if (!modelExists && models.length > 0) {
          return {
            valid: false,
            error: `Model "${model}" not found. Available models: ${models.map((m: any) => m.id).join(', ')}`,
          };
        }

        logWithCategory('info', LogCategory.WORKFLOW,
          `OpenAI-compatible endpoint validation successful: model "${model}" is available`);

        return {
          valid: true,
          model,
        };

      } catch (error: any) {
        // Some endpoints might not support /v1/models
        // Try a simple connection test instead
        try {
          await axios.get(endpoint, { timeout: 5000 });

          logWithCategory('warn', LogCategory.WORKFLOW,
            `Endpoint is accessible but /v1/models not supported. Assuming model "${model}" exists.`);

          return {
            valid: true,
            model,
          };

        } catch (connectionError: any) {
          return {
            valid: false,
            error: `Cannot connect to endpoint at ${endpoint}. Is the service running?`,
          };
        }
      }

    } catch (error: any) {
      return {
        valid: false,
        error: `OpenAI-compatible endpoint validation error: ${error.message}`,
      };
    }
  }
}
