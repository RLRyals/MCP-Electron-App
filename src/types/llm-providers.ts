/**
 * LLM Provider Type System
 *
 * Supports multiple LLM providers with per-node selection:
 * - Claude Code CLI (headless with user subscription)
 * - Claude API (Anthropic API with key)
 * - OpenAI (GPT models with API key)
 * - Google Gemini (Google AI with API key)
 * - OpenRouter (unified API for multiple models)
 * - Local LLMs (Ollama, LM Studio, etc.)
 */

/**
 * Base provider configuration
 */
export interface BaseLLMProviderConfig {
  id?: string;          // Unique ID for saved provider configs
  type: 'claude-code-cli' | 'claude-api' | 'openai' | 'google' | 'openrouter' | 'local';
  name: string;         // Display name (e.g., "My Claude API Key", "Work OpenAI")
}

/**
 * Claude Code CLI Provider
 * Uses headless Claude Code with user's subscription
 */
export interface ClaudeCodeCLIProvider extends BaseLLMProviderConfig {
  type: 'claude-code-cli';

  config: {
    model?: 'claude-sonnet-4-5' | 'claude-opus-4-5';
    outputFormat: 'json' | 'text';
  };
}

/**
 * Claude API Provider (Anthropic API)
 */
export interface ClaudeAPIProvider extends BaseLLMProviderConfig {
  type: 'claude-api';

  config: {
    apiKey: string;  // Will be encrypted in storage
    model: 'claude-sonnet-4-5' | 'claude-opus-4' | 'claude-3-5-sonnet-20241022';
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * OpenAI Provider
 */
export interface OpenAIProvider extends BaseLLMProviderConfig {
  type: 'openai';

  config: {
    apiKey: string;
    model: 'gpt-4-turbo' | 'gpt-4' | 'gpt-3.5-turbo' | 'gpt-4o';
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * Google Gemini Provider
 */
export interface GoogleProvider extends BaseLLMProviderConfig {
  type: 'google';

  config: {
    apiKey: string;
    model: 'gemini-pro' | 'gemini-ultra' | 'gemini-1.5-pro';
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * OpenRouter Provider
 * Unified API for multiple models
 */
export interface OpenRouterProvider extends BaseLLMProviderConfig {
  type: 'openrouter';

  config: {
    apiKey: string;
    model: string;  // Any OpenRouter model (e.g., 'anthropic/claude-3.5-sonnet')
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * Local LLM Provider (Ollama, LM Studio, etc.)
 */
export interface LocalLLMProvider extends BaseLLMProviderConfig {
  type: 'local';

  config: {
    endpoint: string;  // e.g., 'http://localhost:11434'
    model: string;     // Model name (e.g., 'llama2', 'mistral')
    apiFormat: 'ollama' | 'openai-compatible';
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * Union type for all LLM providers
 */
export type LLMProviderConfig =
  | ClaudeCodeCLIProvider
  | ClaudeAPIProvider
  | OpenAIProvider
  | GoogleProvider
  | OpenRouterProvider
  | LocalLLMProvider;

/**
 * Provider credentials storage (encrypted)
 */
export interface ProviderCredentials {
  id: string;
  userId: string;
  providerType: LLMProviderConfig['type'];
  name: string;
  encryptedConfig: string;  // Encrypted JSON of provider config
  createdAt: Date;
  updatedAt: Date;
}

/**
 * LLM request structure
 */
export interface LLMRequest {
  provider: LLMProviderConfig;
  credentials?: any;  // Decrypted credentials
  prompt: string;
  context: any;       // Workflow context
  systemPrompt?: string;
  streaming?: boolean;
}

/**
 * LLM response structure
 */
export interface LLMResponse {
  success: boolean;
  output: any;        // Model output (text, JSON, etc.)
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;     // Actual model used
}

/**
 * Provider validation result
 */
export interface ProviderValidationResult {
  valid: boolean;
  error?: string;
  model?: string;     // Model name if validation succeeded
}

/**
 * Type guard functions
 */
export function isClaudeCodeCLIProvider(provider: LLMProviderConfig): provider is ClaudeCodeCLIProvider {
  return provider.type === 'claude-code-cli';
}

export function isClaudeAPIProvider(provider: LLMProviderConfig): provider is ClaudeAPIProvider {
  return provider.type === 'claude-api';
}

export function isOpenAIProvider(provider: LLMProviderConfig): provider is OpenAIProvider {
  return provider.type === 'openai';
}

export function isGoogleProvider(provider: LLMProviderConfig): provider is GoogleProvider {
  return provider.type === 'google';
}

export function isOpenRouterProvider(provider: LLMProviderConfig): provider is OpenRouterProvider {
  return provider.type === 'openrouter';
}

export function isLocalLLMProvider(provider: LLMProviderConfig): provider is LocalLLMProvider {
  return provider.type === 'local';
}
