# LLM Provider System - Testing Guide

## Prerequisites

Before running the tests, ensure the following dependencies are installed:

### Required Dependencies

```bash
# Core testing dependencies (already in package.json)
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev @testing-library/jest-dom
npm install --save-dev jest-environment-jsdom

# LLM SDK dependencies (for type checking, mocked in tests)
npm install --save @anthropic-ai/sdk
npm install --save openai
npm install --save @google/generative-ai
```

## Installation

If dependencies are not installed, run:

```bash
npm install
```

This will install all dependencies from `package.json`, including:
- Testing framework (Jest, ts-jest)
- LLM SDKs (Anthropic, OpenAI, Google)
- Type definitions

## Running Tests

### All Tests

Run the entire test suite:

```bash
npm test
```

### Specific Test Files

Run individual test files:

```bash
# Provider Manager tests
npm test -- provider-manager.test

# Credential Store tests
npm test -- credential-store.test

# Claude API adapter tests
npm test -- claude-api-adapter.test

# OpenAI adapter tests
npm test -- openai-adapter.test

# Integration tests
npm test -- adapter-integration.test
```

### Watch Mode

Run tests in watch mode (re-runs on file changes):

```bash
npm run test:watch
```

### Coverage Report

Generate and view coverage report:

```bash
npm run test:coverage
```

This creates a coverage report in `./coverage/lcov-report/index.html`

### Specific Test Suites

Run tests matching a pattern:

```bash
# Run only LLM-related tests
npm test -- --testPathPattern=llm

# Run only adapter tests
npm test -- --testPathPattern=adapters
```

## Test Organization

```
src/main/llm/__tests__/
├── provider-manager.test.ts        # Provider management
├── credential-store.test.ts        # Credential storage
└── adapters/__tests__/
    ├── claude-api-adapter.test.ts  # Claude API
    ├── openai-adapter.test.ts      # OpenAI
    └── adapter-integration.test.ts # Cross-adapter tests
```

## What Gets Tested

### 1. Provider Manager
- Adapter registration and lookup
- Prompt execution routing
- Credential management
- Provider validation
- Event emission
- Error handling

### 2. Credential Store
- Initialization
- Encryption/decryption (using Electron's safeStorage)
- CRUD operations (Create, Read, Update, Delete)
- API key masking
- ID generation
- Persistence to disk

### 3. LLM Adapters
- Claude API adapter
- OpenAI adapter
- Google Gemini adapter (in integration tests)
- Common adapter interface
- Provider-specific configurations
- Error handling (401, 429, 500, network errors)

### 4. Integration
- Provider switching
- Context propagation
- Event handling
- Fallback mechanisms

## Mock Strategy

All external APIs are mocked to prevent actual network calls:

```typescript
// Example: Mocking Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mocked response' }],
        usage: { input_tokens: 10, output_tokens: 20 }
      })
    }
  }))
}));
```

## Debugging Tests

### Enable Verbose Output

```bash
npm test -- --verbose
```

### Run Single Test

```bash
npm test -- -t "should execute prompt with Claude API"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "--runInBand",
    "--no-cache",
    "${file}"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### View Test Output

If tests are failing, check:

1. **Error messages** - Jest provides detailed error messages
2. **Stack traces** - Show where the failure occurred
3. **Diffs** - Show expected vs actual values
4. **Console output** - Mocked, but can be enabled for debugging

## Common Issues

### Issue: "Cannot find module '@anthropic-ai/sdk'"

**Solution**: Install the package:
```bash
npm install @anthropic-ai/sdk
```

### Issue: "safeStorage is not available"

**Solution**: This is expected in tests. The mock in `credential-store.test.ts` handles this.

### Issue: Tests timeout

**Solution**: Increase timeout in jest.config.js:
```javascript
testTimeout: 30000 // 30 seconds
```

Or for specific test:
```typescript
it('should complete long operation', async () => {
  // test code
}, 30000); // 30 second timeout
```

### Issue: Mock not working

**Solution**: Ensure mock is defined before importing:
```typescript
// Correct order
jest.mock('@anthropic-ai/sdk');
import { ClaudeAPIAdapter } from '../claude-api-adapter';

// Incorrect order - won't work
import { ClaudeAPIAdapter } from '../claude-api-adapter';
jest.mock('@anthropic-ai/sdk');
```

### Issue: Type errors in tests

**Solution**: Install type definitions:
```bash
npm install --save-dev @types/jest
```

## CI/CD Integration

### GitHub Actions

Example workflow:

```yaml
name: Run Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  // Reset any shared state
});
```

### 2. Descriptive Test Names

```typescript
// Good
it('should mask API keys in listProviders response', async () => {
  // test
});

// Bad
it('should work', async () => {
  // test
});
```

### 3. Test Both Success and Failure

```typescript
describe('execute', () => {
  it('should succeed with valid credentials', async () => {
    // success case
  });

  it('should fail with invalid API key', async () => {
    // error case
  });
});
```

### 4. Use Proper Assertions

```typescript
// Good - specific assertion
expect(result.usage.totalTokens).toBe(30);

// Bad - vague assertion
expect(result.usage).toBeTruthy();
```

### 5. Mock at the Right Level

```typescript
// Good - mock external dependency
jest.mock('@anthropic-ai/sdk');

// Bad - don't mock code under test
jest.mock('../provider-manager');
```

## Coverage Goals

Aim for:
- **70%+ line coverage**
- **70%+ function coverage**
- **70%+ branch coverage**
- **70%+ statement coverage**

View current coverage:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Adding New Tests

### For New Adapter

1. Create test file:
```
src/main/llm/adapters/__tests__/your-adapter.test.ts
```

2. Follow existing patterns:
```typescript
import { YourAdapter } from '../your-adapter';

jest.mock('your-sdk');

describe('YourAdapter', () => {
  let adapter: YourAdapter;

  beforeEach(() => {
    adapter = new YourAdapter();
  });

  // Add tests
});
```

3. Add to integration tests

### For New Feature

1. Add test cases to appropriate file
2. Ensure mocks are updated
3. Run tests to verify
4. Update coverage

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Library](https://testing-library.com/)
- [Jest Mocking Guide](https://jestjs.io/docs/mock-functions)

## Quick Reference

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Run specific file
npm test -- provider-manager.test

# Run specific test
npm test -- -t "should validate credentials"

# Debug mode
npm test -- --no-coverage --verbose

# Update snapshots
npm test -- -u
```

## Getting Help

If you encounter issues:

1. Check error messages carefully
2. Review test file for similar examples
3. Check README.md for test documentation
4. Review mock setup in setupTests.ts
5. Verify dependencies are installed
6. Check jest.config.js configuration

## Next Steps

After running tests successfully:

1. Review coverage report
2. Add tests for uncovered code
3. Refactor tests if needed
4. Update documentation
5. Commit test changes
