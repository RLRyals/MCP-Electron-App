/**
 * Local LLM Adapter - Usage Examples
 *
 * This file demonstrates how to use the Local LLM adapter
 * with different configurations (Ollama, LM Studio, etc.)
 */

import { LocalLLMAdapter } from './local-llm-adapter';
import { LocalLLMProvider, LLMRequest } from '../../../types/llm-providers';

/**
 * Example 1: Using Ollama with llama2 model
 */
async function exampleOllama() {
  const adapter = new LocalLLMAdapter();

  // Configure provider for Ollama
  const provider: LocalLLMProvider = {
    type: 'local',
    name: 'My Local Ollama',
    config: {
      endpoint: 'http://localhost:11434',
      model: 'llama2',
      apiFormat: 'ollama',
      maxTokens: 2000,
      temperature: 0.7,
    },
  };

  // Validate first
  console.log('Validating Ollama connection...');
  const validation = await adapter.validateCredentials(provider.config);

  if (!validation.valid) {
    console.error('Validation failed:', validation.error);
    return;
  }

  console.log('Validation successful!');

  // Build request
  const request: LLMRequest = {
    provider,
    prompt: 'Write a short story about a robot learning to write.',
    systemPrompt: 'You are a creative writing assistant.',
    context: {},
    streaming: false,
  };

  // Execute
  console.log('Executing request...');
  const response = await adapter.execute(request);

  if (response.success) {
    console.log('Response:', response.output);
    console.log('Usage:', response.usage);
  } else {
    console.error('Execution failed:', response.error);
  }
}

/**
 * Example 2: Using LM Studio with OpenAI-compatible API
 */
async function exampleLMStudio() {
  const adapter = new LocalLLMAdapter();

  // Configure provider for LM Studio
  const provider: LocalLLMProvider = {
    type: 'local',
    name: 'LM Studio - Mistral',
    config: {
      endpoint: 'http://localhost:1234',
      model: 'mistral-7b-instruct',
      apiFormat: 'openai-compatible',
      maxTokens: 1500,
      temperature: 0.8,
    },
  };

  // Validate first
  console.log('Validating LM Studio connection...');
  const validation = await adapter.validateCredentials(provider.config);

  if (!validation.valid) {
    console.error('Validation failed:', validation.error);
    return;
  }

  console.log('Validation successful!');

  // Build request
  const request: LLMRequest = {
    provider,
    prompt: 'Explain the concept of recursion in programming.',
    systemPrompt: 'You are a programming tutor.',
    context: {},
    streaming: false,
  };

  // Execute
  console.log('Executing request...');
  const response = await adapter.execute(request);

  if (response.success) {
    console.log('Response:', response.output);
    console.log('Usage:', response.usage);
  } else {
    console.error('Execution failed:', response.error);
  }
}

/**
 * Example 3: Using with workflow context
 */
async function exampleWorkflowContext() {
  const adapter = new LocalLLMAdapter();

  const provider: LocalLLMProvider = {
    type: 'local',
    name: 'Ollama Mixtral',
    config: {
      endpoint: 'http://localhost:11434',
      model: 'mixtral',
      apiFormat: 'ollama',
      maxTokens: 4000,
      temperature: 0.5,
    },
  };

  // Build request with workflow context
  const request: LLMRequest = {
    provider,
    prompt: 'Analyze the character development in the provided chapter.',
    systemPrompt: 'You are a fiction writing assistant helping an author develop their novel.',
    context: {
      phaseNumber: 3,
      skill: 'character-analysis',
      workflowId: 'workflow-123',
      chapterText: 'The protagonist walked through the ancient forest...',
    },
    streaming: false,
  };

  // Execute
  const response = await adapter.execute(request);

  if (response.success) {
    console.log('Analysis:', response.output);
  } else {
    console.error('Failed:', response.error);
  }
}

/**
 * Run examples
 */
async function main() {
  console.log('=== Example 1: Ollama ===');
  await exampleOllama().catch(console.error);

  console.log('\n=== Example 2: LM Studio ===');
  await exampleLMStudio().catch(console.error);

  console.log('\n=== Example 3: Workflow Context ===');
  await exampleWorkflowContext().catch(console.error);
}

// Uncomment to run examples
// main();
