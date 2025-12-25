# Local LLM Integration Guide

This guide shows how to integrate and use the Local LLM adapter in the FictionLab workflow system.

## Quick Start

### 1. Install a Local LLM Provider

Choose one of the following:

#### Option A: Ollama (Recommended for beginners)

```bash
# macOS/Linux
curl https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download

# Start Ollama
ollama serve

# Pull a model (in another terminal)
ollama pull llama2
```

#### Option B: LM Studio

1. Download from [lmstudio.ai](https://lmstudio.ai/)
2. Install and launch
3. Download a model from the UI
4. Go to "Local Server" tab and click "Start Server"

### 2. Test Your Local LLM

#### Test Ollama

```bash
# Check if Ollama is running
curl http://localhost:11434/api/version

# List available models
curl http://localhost:11434/api/tags

# Test generation
curl http://localhost:11434/api/generate -d '{
  "model": "llama2",
  "prompt": "Why is the sky blue?",
  "stream": false
}'
```

#### Test LM Studio

```bash
# List models
curl http://localhost:1234/v1/models

# Test chat completion
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "your-model-name",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Using in FictionLab

### 1. Create Provider Configuration

In your workflow or settings UI, create a Local LLM provider:

```typescript
import { LocalLLMProvider } from './types/llm-providers';

// For Ollama
const ollamaProvider: LocalLLMProvider = {
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

// For LM Studio
const lmStudioProvider: LocalLLMProvider = {
  type: 'local',
  name: 'LM Studio Mistral',
  config: {
    endpoint: 'http://localhost:1234',
    model: 'mistral-7b-instruct-v0.2',
    apiFormat: 'openai-compatible',
    maxTokens: 1500,
    temperature: 0.8
  }
};
```

### 2. Validate Provider

Before using, validate that the provider is working:

```typescript
import { getProviderManager } from './main/llm/provider-manager';

const manager = getProviderManager();
await manager.initialize();

const validation = await manager.validateProvider(ollamaProvider);

if (!validation.valid) {
  console.error('Provider validation failed:', validation.error);
  // Show error to user
} else {
  console.log('Provider validated successfully!');
  // Save provider
  const providerId = await manager.saveProvider(ollamaProvider);
}
```

### 3. Execute Prompts

Use the provider in your workflows:

```typescript
const response = await manager.executePrompt(
  ollamaProvider,
  'Write a short story about a robot learning to write.',
  {
    phaseNumber: 1,
    skill: 'creative-writing'
  },
  'You are a creative writing assistant.'
);

if (response.success) {
  console.log('Generated text:', response.output);
  console.log('Tokens used:', response.usage?.totalTokens);
} else {
  console.error('Execution failed:', response.error);
}
```

### 4. Use in Workflow Nodes

Assign the local LLM provider to workflow nodes:

```typescript
import { WorkflowNode, NodeExecutionResult } from './types/workflow';

const characterAnalysisNode: WorkflowNode = {
  id: 'node-1',
  type: 'llm',
  name: 'Character Analysis',
  config: {
    llmProvider: ollamaProvider,
    prompt: 'Analyze the character development in: {{input.chapterText}}',
    systemPrompt: 'You are a fiction writing assistant.',
    outputKey: 'characterAnalysis'
  },
  inputs: ['chapterText'],
  outputs: ['characterAnalysis']
};
```

## Configuration Options

### Model Selection

Choose models based on your use case:

| Use Case | Ollama Model | LM Studio Model |
|----------|--------------|-----------------|
| General Writing | `llama2` | `llama-2-7b-chat` |
| Code Generation | `codellama` | `codellama-7b-instruct` |
| Complex Analysis | `mixtral` | `mixtral-8x7b-instruct` |
| Fast Responses | `mistral` | `mistral-7b-instruct` |
| Small Tasks | `phi` | `phi-2` |

### Parameter Tuning

```typescript
config: {
  endpoint: 'http://localhost:11434',
  model: 'llama2',
  apiFormat: 'ollama',

  // Controls randomness (0.0 = deterministic, 1.0 = very random)
  temperature: 0.7,  // Default: 0.7, Range: 0.0 - 1.0

  // Maximum tokens in response
  maxTokens: 2000,   // Adjust based on model's context window
}
```

### Temperature Guidelines

- **0.0 - 0.3**: Focused, consistent, factual responses
- **0.4 - 0.7**: Balanced creativity and consistency (recommended for most tasks)
- **0.8 - 1.0**: Highly creative, varied responses

## Workflow Integration Patterns

### Pattern 1: Multi-Step Analysis

```typescript
// Phase 1: Extract themes
const themesResponse = await manager.executePrompt(
  provider,
  'Extract major themes from: {{chapterText}}',
  { phaseNumber: 1, chapterText: '...' }
);

// Phase 2: Analyze characters
const charactersResponse = await manager.executePrompt(
  provider,
  'Analyze characters based on themes: {{themes}}',
  { phaseNumber: 2, themes: themesResponse.output }
);
```

### Pattern 2: Iterative Refinement

```typescript
let draft = initialText;

for (let i = 0; i < 3; i++) {
  const response = await manager.executePrompt(
    provider,
    `Improve this text:\n\n${draft}`,
    { iteration: i }
  );
  draft = response.output;
}
```

### Pattern 3: Parallel Processing

```typescript
// Process multiple chapters in parallel
const chapters = ['chapter1.txt', 'chapter2.txt', 'chapter3.txt'];

const analyses = await Promise.all(
  chapters.map(chapter =>
    manager.executePrompt(
      provider,
      `Analyze: ${chapter}`,
      { chapter }
    )
  )
);
```

## Troubleshooting

### Provider Won't Connect

```typescript
// Check if service is running
const validation = await manager.validateProvider(provider);
console.log(validation);

// Common issues:
// - Ollama not started: Run `ollama serve`
// - LM Studio server not started: Enable in UI
// - Wrong port: Check endpoint URL
```

### Model Not Found

```bash
# For Ollama - list available models
ollama list

# Pull a new model
ollama pull llama2
```

### Slow Responses

```typescript
// Use smaller model
config: {
  model: 'mistral',  // Instead of 'mixtral'
  maxTokens: 500,    // Reduce max tokens
}
```

### Out of Memory

- Use smaller models (7B instead of 13B/70B)
- Reduce `maxTokens`
- Close other applications
- Use GPU acceleration if available

## Best Practices

### 1. Model Selection
- Start with smaller models (7B) for faster responses
- Use larger models (13B+) for complex tasks
- Consider task-specific models (CodeLlama for code)

### 2. Prompt Engineering
- Be specific and clear
- Provide context in system prompt
- Use examples for complex tasks
- Keep prompts concise for local models

### 3. Resource Management
- Don't run multiple large models simultaneously
- Monitor memory usage
- Use appropriate `maxTokens` limits
- Implement request queuing for high load

### 4. Error Handling
- Always validate before execution
- Handle timeouts gracefully
- Provide fallback options
- Log errors for debugging

### 5. Performance Optimization
- Cache frequent queries
- Batch similar requests
- Use streaming for long responses
- Implement request throttling

## Hardware Requirements

### Minimum
- **CPU**: Modern multi-core processor
- **RAM**: 8GB (for 7B models)
- **Storage**: 10GB+ free space

### Recommended
- **CPU**: 8+ cores
- **RAM**: 16GB+ (for 13B+ models)
- **GPU**: NVIDIA GPU with 8GB+ VRAM
- **Storage**: 50GB+ SSD

### Optimal
- **CPU**: High-end multi-core
- **RAM**: 32GB+
- **GPU**: NVIDIA RTX 3090/4090 or similar
- **Storage**: Fast NVMe SSD

## Security Considerations

### Local-Only
- Local LLMs run entirely on your machine
- No data sent to external services
- Full privacy and control

### Network Access
- Default endpoints use localhost only
- No authentication required for local access
- Consider firewall rules if exposing to network

### Data Protection
- Credentials stored encrypted
- Local model data stays local
- No telemetry or tracking

## Next Steps

1. **Install a local LLM provider** (Ollama or LM Studio)
2. **Test the connection** using the validation examples
3. **Create a provider configuration** in your app
4. **Try simple prompts** to verify functionality
5. **Integrate into workflows** for your use cases

## Additional Resources

- **Adapter Code**: `src/main/llm/adapters/local-llm-adapter.ts`
- **Type Definitions**: `src/types/llm-providers.ts`
- **Usage Examples**: `src/main/llm/adapters/local-llm-adapter.test.example.ts`
- **Detailed README**: `src/main/llm/adapters/LOCAL_LLM_ADAPTER_README.md`

## Support

For issues or questions:
- Check the logs: `{userData}/logs/main.log`
- Verify service is running: Test endpoints directly
- Check model availability: List models via API
- Review error messages: They provide specific guidance
