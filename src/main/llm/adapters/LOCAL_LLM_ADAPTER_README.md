# Local LLM Adapter

The Local LLM Adapter enables integration with locally-running language models through standardized API interfaces. This adapter supports multiple local LLM solutions including Ollama, LM Studio, LocalAI, and any other service that provides either an Ollama-compatible or OpenAI-compatible API.

## Features

- **Dual API Format Support**: Works with both Ollama API and OpenAI-compatible APIs
- **Automatic Model Validation**: Verifies endpoint connectivity and model availability
- **Comprehensive Error Handling**: Clear error messages for common issues
- **Token Usage Tracking**: Reports token usage when available from the provider
- **Streaming Support**: Ready for streaming responses (streamSupport = true)
- **Flexible Configuration**: User-specified endpoints, models, and parameters

## Supported Providers

### Ollama (Native API)

[Ollama](https://ollama.ai/) provides a simple way to run LLMs locally.

**Default Endpoint**: `http://localhost:11434`

**API Format**: `ollama`

**Popular Models**:
- `llama2` - Meta's Llama 2
- `mixtral` - Mistral AI's Mixtral
- `mistral` - Mistral 7B
- `codellama` - Code-focused Llama variant
- `phi` - Microsoft's Phi model

### LM Studio (OpenAI-Compatible)

[LM Studio](https://lmstudio.ai/) provides a desktop app for running local LLMs with an OpenAI-compatible API.

**Default Endpoint**: `http://localhost:1234`

**API Format**: `openai-compatible`

### LocalAI (OpenAI-Compatible)

[LocalAI](https://localai.io/) is a drop-in replacement for OpenAI's API.

**Default Endpoint**: `http://localhost:8080`

**API Format**: `openai-compatible`

### Other OpenAI-Compatible Services

Any service that implements the OpenAI Chat Completions API can work with this adapter:
- Text Generation WebUI (with OpenAI extension)
- Jan
- KoboldCpp
- Custom implementations

## Configuration

### Provider Configuration Object

```typescript
interface LocalLLMProvider {
  type: 'local';
  name: string;  // Display name for this configuration

  config: {
    endpoint: string;      // Base URL of the local service
    model: string;         // Model name/identifier
    apiFormat: 'ollama' | 'openai-compatible';
    maxTokens?: number;    // Maximum tokens in response
    temperature?: number;  // Temperature (0.0 - 1.0)
  };
}
```

### Example Configurations

#### Ollama Configuration

```typescript
{
  type: 'local',
  name: 'Ollama Llama 2',
  config: {
    endpoint: 'http://localhost:11434',
    model: 'llama2',
    apiFormat: 'ollama',
    maxTokens: 2000,
    temperature: 0.7
  }
}
```

#### LM Studio Configuration

```typescript
{
  type: 'local',
  name: 'LM Studio Mistral',
  config: {
    endpoint: 'http://localhost:1234',
    model: 'mistral-7b-instruct-v0.2',
    apiFormat: 'openai-compatible',
    maxTokens: 1500,
    temperature: 0.8
  }
}
```

## API Details

### Ollama API Format

**Endpoint**: `{endpoint}/api/generate`

**Request Format**:
```json
{
  "model": "llama2",
  "prompt": "Combined system + user prompt",
  "stream": false,
  "options": {
    "num_predict": 2000,
    "temperature": 0.7
  }
}
```

**Response Format**:
```json
{
  "response": "Generated text...",
  "model": "llama2",
  "prompt_eval_count": 50,
  "eval_count": 200
}
```

### OpenAI-Compatible API Format

**Endpoint**: `{endpoint}/v1/chat/completions`

**Request Format**:
```json
{
  "model": "mistral-7b-instruct",
  "messages": [
    {"role": "system", "content": "System prompt"},
    {"role": "user", "content": "User prompt"}
  ],
  "stream": false,
  "max_tokens": 1500,
  "temperature": 0.8
}
```

**Response Format**:
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Generated text..."
      }
    }
  ],
  "model": "mistral-7b-instruct",
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 200,
    "total_tokens": 250
  }
}
```

## Validation

The adapter performs comprehensive validation before allowing execution:

### Ollama Validation
1. Checks if Ollama service is running (`/api/version`)
2. Lists available models (`/api/tags`)
3. Verifies requested model exists

### OpenAI-Compatible Validation
1. Attempts to list models (`/v1/models`)
2. Verifies requested model is available
3. Falls back to simple connectivity test if model listing unsupported

## Error Handling

The adapter provides clear error messages for common issues:

- **Connection Failed**: "Cannot connect to Ollama at {endpoint}. Is Ollama running?"
- **Model Not Found**: "Model '{model}' not found. Available models: {list}"
- **API Error**: Detailed error from the provider's API response
- **Timeout**: Requests timeout after 5 minutes (300 seconds)

## Usage in Workflows

### Basic Usage

```typescript
import { getProviderManager } from './llm/provider-manager';

const manager = getProviderManager();
await manager.initialize();

const provider = {
  type: 'local',
  name: 'My Ollama',
  config: {
    endpoint: 'http://localhost:11434',
    model: 'llama2',
    apiFormat: 'ollama'
  }
};

const response = await manager.executePrompt(
  provider,
  'Write a short story',
  {},
  'You are a creative writer'
);
```

### With Workflow Context

```typescript
const response = await manager.executePrompt(
  provider,
  'Analyze this character development',
  {
    phaseNumber: 3,
    skill: 'character-analysis',
    chapterText: '...'
  },
  'You are a fiction writing assistant'
);
```

## Installation Requirements

### Ollama

```bash
# macOS
brew install ollama

# Or download from https://ollama.ai/download

# Start Ollama
ollama serve

# Pull a model
ollama pull llama2
```

### LM Studio

1. Download from [lmstudio.ai](https://lmstudio.ai/)
2. Install and launch application
3. Download a model through the UI
4. Enable "Start Server" in the Local Server tab

## Performance Considerations

### Token Limits
- Local models typically have smaller context windows than cloud APIs
- Default `maxTokens` should be set based on your model's capabilities
- Llama 2: ~4K tokens
- Mixtral: ~32K tokens
- Check your specific model's documentation

### Response Times
- Local LLMs are slower than API-based services
- Response time depends on:
  - Model size
  - Hardware (GPU/CPU)
  - Context length
  - Generation parameters

### Timeout Settings
- Default timeout: 5 minutes (300 seconds)
- Adjust based on your hardware and typical query complexity
- Located in adapter code: `timeout: 300000`

## Debugging

Enable detailed logging to troubleshoot issues:

```typescript
import { logWithCategory, LogCategory } from '../../logger';

// Logs are automatically written for:
// - Request initiation
// - Validation steps
// - API responses
// - Errors
```

Check logs at: `{app.getPath('userData')}/logs/main.log`

## Common Issues

### "Cannot connect to endpoint"
- Verify the service is running
- Check the endpoint URL is correct
- Ensure no firewall blocking local connections

### "Model not found"
- For Ollama: Run `ollama list` to see available models
- For LM Studio: Check loaded model in the UI
- Model names are case-sensitive

### Slow Responses
- Use smaller models for faster responses
- Reduce `maxTokens` parameter
- Use GPU acceleration if available

### Out of Memory
- Switch to a smaller model
- Reduce context length
- Close other applications

## Future Enhancements

Potential improvements for future versions:

- [ ] Streaming response support (currently prepared but not implemented)
- [ ] Batch request processing
- [ ] Model capability detection
- [ ] Automatic endpoint discovery
- [ ] Context window management
- [ ] Response caching
- [ ] Multi-model fallback

## Related Files

- **Adapter**: `src/main/llm/adapters/local-llm-adapter.ts`
- **Type Definitions**: `src/types/llm-providers.ts`
- **Provider Manager**: `src/main/llm/provider-manager.ts`
- **Examples**: `src/main/llm/adapters/local-llm-adapter.test.example.ts`

## Support

For issues specific to:
- **This adapter**: Check the error logs and validate configuration
- **Ollama**: Visit [Ollama GitHub](https://github.com/jmorganca/ollama)
- **LM Studio**: Visit [LM Studio Docs](https://lmstudio.ai/docs)
- **LocalAI**: Visit [LocalAI GitHub](https://github.com/mudler/LocalAI)
