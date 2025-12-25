# Local LLM Adapter - Quick Reference

## File Location
`src/main/llm/adapters/local-llm-adapter.ts`

## Quick Setup (Ollama)

### 1. Install Ollama
```bash
# Install
curl https://ollama.ai/install.sh | sh

# Start service
ollama serve

# Pull model (in another terminal)
ollama pull llama2
```

### 2. Test Connection
```bash
curl http://localhost:11434/api/version
```

### 3. Create Provider
```typescript
const provider = {
  type: 'local',
  name: 'Ollama Llama 2',
  config: {
    endpoint: 'http://localhost:11434',
    model: 'llama2',
    apiFormat: 'ollama',
    maxTokens: 2000,
    temperature: 0.7
  }
};
```

### 4. Use in Code
```typescript
import { getProviderManager } from './main/llm/provider-manager';

const manager = getProviderManager();
await manager.initialize();

// Validate
const validation = await manager.validateProvider(provider);
if (!validation.valid) throw new Error(validation.error);

// Execute
const response = await manager.executePrompt(
  provider,
  'Your prompt here',
  {},
  'Optional system prompt'
);

console.log(response.output);
```

## Quick Setup (LM Studio)

### 1. Install LM Studio
Download from [lmstudio.ai](https://lmstudio.ai/)

### 2. Start Server
1. Open LM Studio
2. Download a model
3. Go to "Local Server" tab
4. Click "Start Server"

### 3. Create Provider
```typescript
const provider = {
  type: 'local',
  name: 'LM Studio',
  config: {
    endpoint: 'http://localhost:1234',
    model: 'your-model-name',
    apiFormat: 'openai-compatible',
    maxTokens: 1500,
    temperature: 0.8
  }
};
```

## Common Endpoints

| Service | Default Endpoint | API Format |
|---------|-----------------|------------|
| Ollama | `http://localhost:11434` | `ollama` |
| LM Studio | `http://localhost:1234` | `openai-compatible` |
| LocalAI | `http://localhost:8080` | `openai-compatible` |

## Popular Models

| Model | Size | Use Case | Command |
|-------|------|----------|---------|
| llama2 | 7B | General purpose | `ollama pull llama2` |
| mistral | 7B | Fast responses | `ollama pull mistral` |
| mixtral | 47B | Complex tasks | `ollama pull mixtral` |
| codellama | 7B | Code generation | `ollama pull codellama` |
| phi | 2.7B | Lightweight | `ollama pull phi` |

## Configuration Parameters

```typescript
config: {
  endpoint: string;      // Required: Service URL
  model: string;         // Required: Model name
  apiFormat: string;     // Required: 'ollama' | 'openai-compatible'
  maxTokens?: number;    // Optional: Max response tokens (default: model-specific)
  temperature?: number;  // Optional: 0.0-1.0 (default: 0.7)
}
```

## Temperature Guide

- `0.0 - 0.3`: Focused, deterministic
- `0.4 - 0.7`: Balanced (recommended)
- `0.8 - 1.0`: Creative, varied

## Error Handling

```typescript
try {
  const response = await manager.executePrompt(provider, prompt, {});

  if (!response.success) {
    console.error('Error:', response.error);
    // Handle error
  }

} catch (error) {
  console.error('Execution failed:', error);
}
```

## Common Errors & Solutions

### "Cannot connect to endpoint"
```bash
# Check if service is running
curl http://localhost:11434/api/version  # Ollama
curl http://localhost:1234/v1/models     # LM Studio

# Start service
ollama serve  # Ollama
# Or start LM Studio server via UI
```

### "Model not found"
```bash
# List available models
ollama list  # Ollama

# Pull model
ollama pull llama2

# For LM Studio: Check model is loaded in UI
```

### "Out of memory"
```typescript
// Use smaller model
config: {
  model: 'mistral',      // Instead of 'mixtral'
  maxTokens: 500,        // Reduce tokens
}
```

## Validation Example

```typescript
const validation = await manager.validateProvider(provider);

if (!validation.valid) {
  console.error('Validation failed:', validation.error);
  // Shows: specific error and available models if applicable
} else {
  console.log('Valid! Model:', validation.model);
}
```

## Integration with Workflows

```typescript
// In workflow node configuration
const node = {
  id: 'analysis-node',
  type: 'llm',
  config: {
    llmProvider: provider,  // Your local LLM config
    prompt: 'Analyze: {{input.text}}',
    systemPrompt: 'You are an editor.',
    outputKey: 'analysis'
  }
};
```

## Logging

Logs are written to: `{userData}/logs/main.log`

```typescript
// Logs include:
// - Request initiation
// - Validation results
// - API responses
// - Errors with details
```

## Performance Tips

1. **Use smaller models** for faster responses
2. **Reduce maxTokens** for quicker generation
3. **Enable GPU** if available (check provider docs)
4. **Use SSD storage** for model loading
5. **Close unused apps** to free memory

## Testing Commands

### Test Ollama
```bash
# Generate text
curl http://localhost:11434/api/generate -d '{
  "model": "llama2",
  "prompt": "Why is the sky blue?",
  "stream": false
}'

# List models
curl http://localhost:11434/api/tags
```

### Test LM Studio
```bash
# Chat completion
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-model",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# List models
curl http://localhost:1234/v1/models
```

## TypeScript Types

```typescript
import {
  LocalLLMProvider,
  LLMRequest,
  LLMResponse,
  ProviderValidationResult
} from './types/llm-providers';
```

## Class Methods

```typescript
class LocalLLMAdapter {
  // Execute prompt
  async execute(request: LLMRequest): Promise<LLMResponse>

  // Validate configuration
  async validateCredentials(credentials: any): Promise<ProviderValidationResult>

  // Properties
  type: 'local'
  streamSupport: true
}
```

## Response Format

```typescript
interface LLMResponse {
  success: boolean;
  output: any;           // Generated text
  error?: string;        // Error message if failed
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;        // Actual model used
}
```

## Complete Example

```typescript
import { getProviderManager } from './main/llm/provider-manager';
import { LocalLLMProvider } from './types/llm-providers';

async function runLocalLLM() {
  // 1. Setup
  const manager = getProviderManager();
  await manager.initialize();

  // 2. Configure
  const provider: LocalLLMProvider = {
    type: 'local',
    name: 'Ollama Llama 2',
    config: {
      endpoint: 'http://localhost:11434',
      model: 'llama2',
      apiFormat: 'ollama',
      maxTokens: 2000,
      temperature: 0.7
    }
  };

  // 3. Validate
  const validation = await manager.validateProvider(provider);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.error}`);
  }

  // 4. Execute
  const response = await manager.executePrompt(
    provider,
    'Write a short story about a robot.',
    {},
    'You are a creative writer.'
  );

  // 5. Handle response
  if (response.success) {
    console.log('Story:', response.output);
    console.log('Tokens used:', response.usage?.totalTokens);
  } else {
    console.error('Failed:', response.error);
  }
}

// Run
runLocalLLM().catch(console.error);
```

## Links

- **Implementation**: `src/main/llm/adapters/local-llm-adapter.ts`
- **Examples**: `src/main/llm/adapters/local-llm-adapter.test.example.ts`
- **Technical Docs**: `src/main/llm/adapters/LOCAL_LLM_ADAPTER_README.md`
- **Integration Guide**: `LOCAL_LLM_INTEGRATION_GUIDE.md`
- **Full Summary**: `LOCAL_LLM_ADAPTER_IMPLEMENTATION.md`

## Quick Troubleshooting

| Problem | Check | Solution |
|---------|-------|----------|
| Can't connect | Is service running? | `ollama serve` or start LM Studio |
| Model not found | Is model installed? | `ollama pull llama2` or load in UI |
| Out of memory | Is model too large? | Use smaller model (7B instead of 13B+) |
| Slow responses | Hardware adequate? | Use smaller model, reduce maxTokens |
| Timeout | Request too complex? | Reduce prompt length or maxTokens |

## Support Resources

- **Ollama Docs**: [https://github.com/jmorganca/ollama](https://github.com/jmorganca/ollama)
- **LM Studio Docs**: [https://lmstudio.ai/docs](https://lmstudio.ai/docs)
- **LocalAI Docs**: [https://localai.io/](https://localai.io/)
