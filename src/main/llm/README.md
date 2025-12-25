# LLM Provider System

## Overview

The LLM Provider System provides a unified abstraction layer for integrating multiple Large Language Model (LLM) providers into FictionLab workflows. This architecture allows workflows to use different LLM providers for different nodes, enabling authors to leverage the best model for each specific task.

## Architecture

### Core Components

1. **LLMProviderManager** (`provider-manager.ts`) - Central registry and router
2. **CredentialStore** (`credential-store.ts`) - Secure credential storage
3. **Provider Adapters** (`adapters/*.ts`) - Provider-specific implementations

### Provider Adapter Interface

All provider adapters must implement the `LLMProviderAdapter` interface:

```typescript
export interface LLMProviderAdapter {
  /**
   * Execute a prompt with the given provider
   */
  execute(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Validate provider credentials
   */
  validateCredentials(credentials: any): Promise<boolean>;

  /**
   * Whether this provider supports streaming responses
   */
  readonly streamSupport: boolean;

  /**
   * Provider type identifier
   */
  readonly providerType: string;
}
```

### Request/Response Format

**LLMRequest**:
```typescript
interface LLMRequest {
  provider: LLMProviderConfig;  // Provider configuration
  prompt: string;               // User prompt
  context?: any;                // Workflow context (optional)
  systemPrompt?: string;        // System prompt (optional)
  options?: {                   // Additional options
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
  };
}
```

**LLMResponse**:
```typescript
interface LLMResponse {
  success: boolean;
  output?: string;              // Response text
  error?: string;               // Error message if failed
  usage?: {                     // Token usage (if available)
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: any;               // Provider-specific metadata
}
```

## Supported Providers

### 1. Claude Code CLI (Default)

**Type**: `claude-code-cli`

**Configuration**:
```typescript
{
  type: 'claude-code-cli',
  name: 'Claude Code (Default)',
  config: {
    model: 'claude-sonnet-4-5' | 'claude-opus-4',
    skill?: string,
    headless: boolean,
    outputFormat: 'json' | 'text'
  }
}
```

**Requirements**:
- Claude Code CLI installed and available in PATH
- Active Claude subscription
- Verify with: `claude --version`

**Notes**:
- Wraps existing `ClaudeCodeExecutor`
- Supports skills and agent execution
- Best for fiction writing workflows

### 2. Claude API

**Type**: `claude-api`

**Configuration**:
```typescript
{
  type: 'claude-api',
  name: 'My Claude API Key',
  config: {
    apiKey: string,
    model: 'claude-sonnet-4-5' | 'claude-opus-4' | 'claude-3-5-sonnet-20241022',
    maxTokens: number,
    temperature: number
  }
}
```

**Requirements**:
- Anthropic API key from https://console.anthropic.com/
- `@anthropic-ai/sdk` package installed

**SDK Usage**:
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: config.apiKey,
});

const response = await client.messages.create({
  model: config.model,
  max_tokens: config.maxTokens,
  temperature: config.temperature,
  messages: [{ role: 'user', content: prompt }],
});
```

### 3. OpenAI

**Type**: `openai`

**Configuration**:
```typescript
{
  type: 'openai',
  name: 'My OpenAI Account',
  config: {
    apiKey: string,
    model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'gpt-4o',
    maxTokens: number,
    temperature: number
  }
}
```

**Requirements**:
- OpenAI API key from https://platform.openai.com/api-keys
- `openai` package installed

**SDK Usage**:
```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: config.apiKey,
});

const response = await client.chat.completions.create({
  model: config.model,
  max_tokens: config.maxTokens,
  temperature: config.temperature,
  messages: [{ role: 'user', content: prompt }],
});
```

### 4. Google Gemini

**Type**: `google-gemini`

**Configuration**:
```typescript
{
  type: 'google-gemini',
  name: 'Google AI Studio',
  config: {
    apiKey: string,
    model: 'gemini-pro' | 'gemini-ultra' | 'gemini-1.5-pro',
    maxTokens: number,
    temperature: number
  }
}
```

**Requirements**:
- Google AI Studio API key from https://makersuite.google.com/app/apikey
- `@google/generative-ai` package installed

**SDK Usage**:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(config.apiKey);
const model = genAI.getGenerativeModel({ model: config.model });

const result = await model.generateContent(prompt);
```

### 5. OpenRouter

**Type**: `openrouter`

**Configuration**:
```typescript
{
  type: 'openrouter',
  name: 'OpenRouter Account',
  config: {
    apiKey: string,
    model: string,  // e.g., 'anthropic/claude-2', 'openai/gpt-4'
    maxTokens: number,
    temperature: number
  }
}
```

**Requirements**:
- OpenRouter API key from https://openrouter.ai/keys
- `axios` package installed

**API Format**: OpenAI-compatible
```typescript
const response = await axios.post(
  'https://openrouter.ai/api/v1/chat/completions',
  {
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  },
  {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://fictionlab.app',
      'X-Title': 'FictionLab',
    },
  }
);
```

### 6. Local LLM (Ollama / LM Studio)

**Type**: `local-llm`

**Configuration**:
```typescript
{
  type: 'local-llm',
  name: 'Local Ollama',
  config: {
    endpoint: string,  // e.g., 'http://localhost:11434'
    model: string,     // e.g., 'llama2', 'mistral'
    maxTokens: number,
    temperature: number,
    apiFormat: 'ollama' | 'openai-compatible'
  }
}
```

**Requirements**:
- Ollama installed: https://ollama.ai/
- OR LM Studio running: https://lmstudio.ai/
- `axios` package installed

**Ollama API Format**:
```typescript
const response = await axios.post(`${config.endpoint}/api/generate`, {
  model: config.model,
  prompt: prompt,
  options: {
    temperature: config.temperature,
    num_predict: config.maxTokens,
  },
});
```

**OpenAI-Compatible Format** (LM Studio):
```typescript
const response = await axios.post(`${config.endpoint}/v1/chat/completions`, {
  model: config.model,
  messages: [{ role: 'user', content: prompt }],
  max_tokens: config.maxTokens,
  temperature: config.temperature,
});
```

## Adding a New Provider

### Step 1: Create Provider Type Definition

Add to `src/types/llm-providers.ts`:

```typescript
export interface MyNewProvider {
  type: 'my-new-provider';
  name: string;
  config: {
    apiKey: string;
    model: string;
    customOption?: string;
  };
}

// Add to union type
export type LLMProviderConfig =
  | ClaudeCodeCLIProvider
  | ClaudeAPIProvider
  | OpenAIProvider
  | GoogleProvider
  | OpenRouterProvider
  | LocalLLMProvider
  | MyNewProvider;  // Add here
```

### Step 2: Create Adapter Implementation

Create `src/main/llm/adapters/my-new-provider-adapter.ts`:

```typescript
import { LLMProviderAdapter, LLMRequest, LLMResponse } from '../../../types/llm-providers';
import { MyNewProvider } from '../../../types/llm-providers';
import { logWithCategory, LogCategory } from '../../logger';

export class MyNewProviderAdapter implements LLMProviderAdapter {
  readonly providerType = 'my-new-provider';
  readonly streamSupport = false;  // Set to true if streaming supported

  async execute(request: LLMRequest): Promise<LLMResponse> {
    const provider = request.provider as MyNewProvider;

    try {
      logWithCategory('info', LogCategory.WORKFLOW,
        `Executing prompt with ${provider.name} (${provider.config.model})`);

      // Build system prompt
      let fullPrompt = request.prompt;
      if (request.systemPrompt) {
        fullPrompt = `${request.systemPrompt}\n\n${request.prompt}`;
      }

      // Call provider API
      const response = await this.callProviderAPI(provider, fullPrompt, request.options);

      return {
        success: true,
        output: response.text,
        usage: response.usage,  // Optional
        metadata: response.metadata,  // Optional
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `MyNewProvider execution failed: ${error.message}`);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async validateCredentials(credentials: any): Promise<boolean> {
    try {
      // Test API connection with minimal request
      const testResponse = await this.callProviderAPI(
        credentials,
        'Test connection',
        { maxTokens: 10 }
      );
      return testResponse !== null;
    } catch (error) {
      return false;
    }
  }

  private async callProviderAPI(
    provider: MyNewProvider,
    prompt: string,
    options?: any
  ): Promise<any> {
    // Implement actual API call here
    // Use provider.config.apiKey, provider.config.model, etc.
    throw new Error('Not implemented');
  }
}
```

### Step 3: Register Adapter

Add to `src/main/llm/provider-manager.ts` constructor:

```typescript
import { MyNewProviderAdapter } from './adapters/my-new-provider-adapter';

constructor(credentialStore: CredentialStore) {
  this.credentialStore = credentialStore;

  // Register all adapters
  this.adapters.set('claude-code-cli', new ClaudeCodeCLIAdapter());
  this.adapters.set('claude-api', new ClaudeAPIAdapter());
  this.adapters.set('openai', new OpenAIAdapter());
  this.adapters.set('google-gemini', new GoogleGeminiAdapter());
  this.adapters.set('openrouter', new OpenRouterAdapter());
  this.adapters.set('local-llm', new LocalLLMAdapter());
  this.adapters.set('my-new-provider', new MyNewProviderAdapter());  // Add here
}
```

### Step 4: Update UI Provider Selector

Add to `src/renderer/components/ProviderSelector.tsx`:

```typescript
const providerTypeOptions = [
  { value: 'claude-code-cli', label: 'Claude Code CLI' },
  { value: 'claude-api', label: 'Claude API' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google-gemini', label: 'Google Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'local-llm', label: 'Local LLM (Ollama/LM Studio)' },
  { value: 'my-new-provider', label: 'My New Provider' },  // Add here
];
```

### Step 5: Add Configuration Panel (Optional)

If your provider needs custom configuration fields, create a dedicated config panel in the ProviderConfigDialog.

### Step 6: Write Tests

Create `src/main/llm/adapters/__tests__/my-new-provider-adapter.test.ts`:

```typescript
import { MyNewProviderAdapter } from '../my-new-provider-adapter';
import { LLMRequest } from '../../../../types/llm-providers';

describe('MyNewProviderAdapter', () => {
  let adapter: MyNewProviderAdapter;

  beforeEach(() => {
    adapter = new MyNewProviderAdapter();
  });

  test('should execute prompt successfully', async () => {
    const request: LLMRequest = {
      provider: {
        type: 'my-new-provider',
        name: 'Test Provider',
        config: {
          apiKey: 'test-key',
          model: 'test-model',
        },
      },
      prompt: 'Test prompt',
    };

    // Mock API call
    jest.spyOn(adapter as any, 'callProviderAPI').mockResolvedValue({
      text: 'Test response',
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
    });

    const response = await adapter.execute(request);

    expect(response.success).toBe(true);
    expect(response.output).toBe('Test response');
  });

  test('should validate credentials', async () => {
    const provider = {
      type: 'my-new-provider',
      name: 'Test',
      config: { apiKey: 'valid-key', model: 'test' },
    };

    jest.spyOn(adapter as any, 'callProviderAPI').mockResolvedValue({ text: 'OK' });

    const isValid = await adapter.validateCredentials(provider);
    expect(isValid).toBe(true);
  });
});
```

## Security Best Practices

### Credential Storage

1. **Never log API keys**:
```typescript
// BAD
console.log(`Using API key: ${apiKey}`);

// GOOD
logWithCategory('info', LogCategory.WORKFLOW,
  `Using provider: ${provider.name} (model: ${provider.config.model})`);
```

2. **Always encrypt at rest**:
```typescript
// Credentials are automatically encrypted by CredentialStore
const encrypted = safeStorage.encryptString(JSON.stringify(provider));
```

3. **Mask in UI**:
```typescript
const maskedKey = apiKey.slice(0, 3) + '...' + apiKey.slice(-3);
```

### Error Handling

Always wrap API calls in try/catch and return structured errors:

```typescript
try {
  const response = await apiCall();
  return { success: true, output: response.text };
} catch (error: any) {
  logWithCategory('error', LogCategory.WORKFLOW, `API call failed: ${error.message}`);
  return { success: false, error: error.message };
}
```

### Rate Limiting

Implement retry logic with exponential backoff for rate limit errors:

```typescript
async executeWithRetry(request: LLMRequest, maxRetries = 3): Promise<LLMResponse> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await this.execute(request);
    } catch (error: any) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

## Debugging

### Enable Debug Logging

Set environment variable:
```bash
DEBUG=fictionlab:llm npm run dev
```

### Test Provider in Isolation

```typescript
const providerManager = new LLMProviderManager(credentialStore);

const testRequest: LLMRequest = {
  provider: {
    type: 'my-provider',
    name: 'Test',
    config: { /* ... */ },
  },
  prompt: 'Hello, world!',
};

const response = await providerManager.executePrompt(
  testRequest.provider,
  testRequest.prompt,
  {}
);

console.log('Response:', response);
```

### Common Issues

1. **"Provider not found"**: Adapter not registered in ProviderManager
2. **"Invalid credentials"**: API key incorrect or expired
3. **"Module not found"**: SDK package not installed (`npm install <package>`)
4. **"Request timeout"**: Network issue or provider down
5. **"Rate limit exceeded"**: Too many requests, implement backoff

## Performance Optimization

### Caching Responses

For expensive prompts that don't change:

```typescript
private responseCache = new Map<string, LLMResponse>();

async execute(request: LLMRequest): Promise<LLMResponse> {
  const cacheKey = this.getCacheKey(request);

  if (this.responseCache.has(cacheKey)) {
    return this.responseCache.get(cacheKey)!;
  }

  const response = await this.callAPI(request);
  this.responseCache.set(cacheKey, response);
  return response;
}
```

### Streaming Responses

For long responses, implement streaming:

```typescript
async executeStream(
  request: LLMRequest,
  onChunk: (chunk: string) => void
): Promise<LLMResponse> {
  const stream = await this.createStream(request);

  let fullText = '';
  for await (const chunk of stream) {
    fullText += chunk;
    onChunk(chunk);
  }

  return { success: true, output: fullText };
}
```

## Examples

### Basic Provider Usage

```typescript
const provider: ClaudeAPIProvider = {
  type: 'claude-api',
  name: 'My Claude API',
  config: {
    apiKey: process.env.CLAUDE_API_KEY!,
    model: 'claude-sonnet-4-5',
    maxTokens: 4096,
    temperature: 0.7,
  },
};

const request: LLMRequest = {
  provider,
  prompt: 'Write a short story about a detective.',
  systemPrompt: 'You are a creative fiction writer.',
};

const response = await providerManager.executePrompt(
  provider,
  request.prompt,
  {},
  request.systemPrompt
);

if (response.success) {
  console.log('Story:', response.output);
} else {
  console.error('Error:', response.error);
}
```

### Using Different Providers in Workflow

```typescript
const workflow = {
  nodes: [
    {
      id: '1',
      type: 'planning',
      name: 'Outline Story',
      provider: {
        type: 'claude-api',
        name: 'Claude for Planning',
        config: { model: 'claude-sonnet-4-5', /* ... */ },
      },
    },
    {
      id: '2',
      type: 'writing',
      name: 'Write First Draft',
      provider: {
        type: 'openai',
        name: 'GPT-4 for Writing',
        config: { model: 'gpt-4', /* ... */ },
      },
    },
    {
      id: '3',
      type: 'gate',
      name: 'Quality Check',
      provider: {
        type: 'local-llm',
        name: 'Local Llama for Review',
        config: { endpoint: 'http://localhost:11434', model: 'llama2' },
      },
    },
  ],
};
```

## API Reference

### LLMProviderManager

**Methods**:
- `executePrompt(provider, prompt, context, systemPrompt)` - Execute a prompt
- `validateCredentials(provider)` - Test provider credentials
- `listProviders()` - Get all configured providers
- `getAdapter(providerType)` - Get adapter for a provider type

**Events**:
- `provider-started` - Execution started
- `provider-completed` - Execution completed
- `provider-failed` - Execution failed

### CredentialStore

**Methods**:
- `saveCredentials(id, provider)` - Save encrypted credentials
- `getCredentials(id)` - Retrieve and decrypt credentials
- `deleteCredentials(id)` - Delete stored credentials
- `listCredentials()` - List all stored credential IDs

## License

This code is part of FictionLab and follows the project's license terms.
