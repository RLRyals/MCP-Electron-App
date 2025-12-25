# LLM Provider System Tests

This directory contains comprehensive integration tests for the LLM provider system, including provider management, credential storage, and various LLM adapters.

## Test Structure

```
src/main/llm/__tests__/
├── README.md                           # This file
├── provider-manager.test.ts            # ProviderManager tests
├── credential-store.test.ts            # CredentialStore tests
└── adapters/__tests__/
    ├── claude-api-adapter.test.ts      # Claude API adapter tests
    ├── openai-adapter.test.ts          # OpenAI adapter tests
    └── adapter-integration.test.ts     # Cross-adapter integration tests
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test suites
```bash
# Provider Manager tests
npm test provider-manager.test.ts

# Credential Store tests
npm test credential-store.test.ts

# Claude API adapter tests
npm test claude-api-adapter.test.ts

# OpenAI adapter tests
npm test openai-adapter.test.ts

# Integration tests
npm test adapter-integration.test.ts
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Generate coverage report
```bash
npm run test:coverage
```

## Test Coverage

### 1. Provider Manager Tests (`provider-manager.test.ts`)

Tests the central LLM provider management system:

- **Initialization**
  - Creates manager instance
  - Loads and registers adapters
  - Prevents re-initialization
  - Handles adapter loading errors

- **Adapter Registration**
  - Registers adapters correctly
  - Replaces existing adapters of same type

- **Prompt Execution**
  - Executes with Claude API provider
  - Executes with Claude Code CLI (no credentials)
  - Routes to correct adapter
  - Passes credentials and context
  - Emits success/error events
  - Auto-initializes if needed

- **Provider Validation**
  - Validates with valid credentials
  - Returns error for unknown adapters
  - Handles validation errors

- **Provider Management**
  - Lists available providers
  - Saves provider credentials
  - Generates IDs when needed
  - Deletes providers
  - Lists saved providers
  - Gets specific provider by ID

### 2. Credential Store Tests (`credential-store.test.ts`)

Tests secure credential storage using Electron's safeStorage:

- **Initialization**
  - Creates store with correct path
  - Creates store file if missing
  - Loads existing credentials
  - Prevents re-initialization
  - Handles initialization errors

- **Save Credentials**
  - Encrypts and saves credentials
  - Persists to disk
  - Updates existing credentials
  - Handles encryption errors

- **Get Credentials**
  - Decrypts and returns credentials
  - Throws error for missing provider
  - Handles decryption errors

- **Get Provider**
  - Returns full provider config
  - Returns null for missing provider
  - Handles decryption errors gracefully

- **List Providers**
  - Lists all providers with masked credentials
  - Masks long API keys (first 3, last 4 chars)
  - Masks short API keys with '***'
  - Skips providers that fail to load
  - Preserves non-sensitive fields

- **Delete Credentials**
  - Deletes provider credentials
  - Persists changes to disk
  - Throws error for missing provider

- **ID Generation**
  - Generates unique IDs
  - Uses correct format (provider_timestamp_random)

- **Encryption Availability**
  - Checks if safeStorage is available

### 3. Claude API Adapter Tests (`claude-api-adapter.test.ts`)

Tests the Claude API adapter implementation:

- **Adapter Properties**
  - Has correct type ('claude-api')
  - Supports streaming

- **Execution**
  - Executes with valid credentials
  - Uses credentials from request
  - Includes system prompt
  - Includes context messages
  - Uses custom maxTokens and temperature
  - Handles multiple text blocks
  - Returns proper error if no API key
  - Handles authentication errors (401)
  - Handles rate limit errors (429)
  - Handles server errors (500)

- **Credential Validation**
  - Validates valid credentials
  - Fails with no API key
  - Fails with invalid API key
  - Handles rate limiting during validation
  - Handles service unavailability

- **Model Mapping**
  - Maps model names to API identifiers
  - Supports claude-sonnet-4-5
  - Supports claude-opus-4
  - Uses exact name if not in mapping

### 4. OpenAI Adapter Tests (`openai-adapter.test.ts`)

Tests the OpenAI adapter implementation:

- **Adapter Properties**
  - Has correct type ('openai')
  - Supports streaming

- **Execution**
  - Executes with valid credentials
  - Includes system prompt
  - Includes context as system message
  - Uses custom maxTokens and temperature
  - Works with different models (GPT-4, GPT-4-Turbo, GPT-3.5-Turbo, GPT-4o)
  - Handles empty response content
  - Handles response without usage stats
  - Handles authentication errors (401)
  - Handles rate limit errors (429)
  - Handles server errors (500)
  - Handles network errors (ENOTFOUND, ECONNREFUSED)

- **Credential Validation**
  - Validates valid credentials
  - Validates even if model not found
  - Uses default model if not specified
  - Fails with no API key
  - Fails with non-string API key
  - Fails with invalid API key
  - Handles network errors during validation

### 5. Integration Tests (`adapter-integration.test.ts`)

Tests cross-adapter functionality and integration:

- **Common Interface**
  - All adapters have required properties
  - All adapters have correct type
  - All adapters execute successfully
  - All adapters include usage statistics
  - All adapters validate credentials

- **Provider Switching**
  - Switches between Claude and OpenAI
  - Maintains provider-specific configurations
  - Preserves temperature and other settings

- **Provider Fallback**
  - Handles primary provider failure gracefully
  - Allows manual fallback to different provider

- **Event Handling**
  - Emits execution-complete on success
  - Emits execution-error on failure

- **Context Handling**
  - Passes context correctly to all adapters
  - Preserves context structure across providers

## Mocking Strategy

### External SDKs
All external LLM SDKs are mocked to avoid actual API calls:

- `@anthropic-ai/sdk` - Anthropic Claude API
- `openai` - OpenAI API
- `@google/generative-ai` - Google Gemini API

### Electron APIs
- `electron.app` - Mocked for user data path
- `electron.safeStorage` - Mocked for encryption/decryption

### Internal Modules
- `logger` - Mocked to prevent console output
- `credential-store` - Mocked in provider-manager tests
- `claude-code-executor` - Mocked for CLI adapter tests

## Test Patterns

### 1. Successful Execution
```typescript
const provider: ClaudeAPIProvider = {
  type: 'claude-api',
  name: 'Test',
  config: { apiKey: 'test-key', model: 'claude-sonnet-4-5' }
};

const result = await manager.executePrompt(provider, 'Test', {});
expect(result.success).toBe(true);
expect(result.output).toBeTruthy();
```

### 2. Error Handling
```typescript
mockAdapter.execute.mockRejectedValue(new Error('API Error'));
await expect(
  manager.executePrompt(provider, 'Test', {})
).rejects.toThrow('API Error');
```

### 3. Credential Validation
```typescript
const result = await adapter.validateCredentials(credentials);
expect(result.valid).toBe(true);
expect(result.model).toBeDefined();
```

### 4. Event Testing
```typescript
const eventSpy = jest.fn();
manager.on('execution-complete', eventSpy);
await manager.executePrompt(provider, 'Test', {});
expect(eventSpy).toHaveBeenCalled();
```

## Adding New Tests

### For a New Adapter

1. Create test file: `src/main/llm/adapters/__tests__/[adapter-name].test.ts`

2. Follow this structure:
```typescript
import { YourAdapter } from '../your-adapter';
import { LLMRequest, YourProvider } from '../../../../types/llm-providers';

jest.mock('[external-sdk]');

describe('YourAdapter', () => {
  let adapter: YourAdapter;

  beforeEach(() => {
    adapter = new YourAdapter();
    // Setup mocks
  });

  describe('adapter properties', () => {
    it('should have correct type', () => {
      expect(adapter.type).toBe('your-type');
    });
  });

  describe('execute', () => {
    it('should execute successfully', async () => {
      // Test implementation
    });
  });

  describe('validateCredentials', () => {
    it('should validate credentials', async () => {
      // Test implementation
    });
  });
});
```

3. Add to integration tests in `adapter-integration.test.ts`

### For Provider Manager Features

Add tests to `provider-manager.test.ts` in the appropriate describe block.

### For Credential Store Features

Add tests to `credential-store.test.ts` in the appropriate describe block.

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main/develop branches
- Pre-commit hooks (if configured)

## Coverage Goals

- **Lines**: 70%+
- **Functions**: 70%+
- **Branches**: 70%+
- **Statements**: 70%+

Current coverage can be viewed by running:
```bash
npm run test:coverage
```

## Troubleshooting

### Tests Hanging
- Increase timeout in jest.config.js (currently 10000ms)
- Check for unresolved promises in tests

### Mock Not Working
- Ensure mock is defined before importing module
- Use `jest.clearAllMocks()` in beforeEach
- Check mock implementation matches actual SDK

### Type Errors
- Update TypeScript definitions
- Check tsconfig.json test settings
- Ensure @types packages are installed

### Electron APIs Unavailable
- Check setupTests.ts for proper mocks
- Ensure test environment is 'node' for main process tests

## Related Documentation

- [Provider Manager](../provider-manager.ts)
- [Credential Store](../credential-store.ts)
- [LLM Provider Types](../../../types/llm-providers.ts)
- [Adapter Implementations](../adapters/)

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain or improve coverage
4. Update this README if adding new test files
