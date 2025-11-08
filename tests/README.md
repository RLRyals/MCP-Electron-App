# Tests

This directory contains unit tests for the MCP Electron App.

## Setup

To run the tests, you need to install Jest and its TypeScript dependencies:

```bash
npm install --save-dev jest @types/jest ts-jest
```

## Configuration

Create a `jest.config.js` file in the root of the project:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
```

## Running Tests

Add the following scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

Then run:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
tests/
├── main/              # Tests for main process modules
│   └── build-orchestrator.test.ts
├── renderer/          # Tests for renderer process modules
└── integration/       # Integration tests
```

## Writing Tests

Follow these guidelines when writing tests:

1. **File naming**: Use `.test.ts` suffix for test files
2. **Organization**: Group related tests using `describe` blocks
3. **Mocking**: Use Jest mocks for external dependencies
4. **Assertions**: Use Jest's built-in matchers
5. **Coverage**: Aim for 80%+ code coverage

### Example Test

```typescript
import { MyModule } from '../../src/main/my-module';

describe('MyModule', () => {
  let module: MyModule;

  beforeEach(() => {
    module = new MyModule();
  });

  it('should do something', () => {
    const result = module.doSomething();
    expect(result).toBe(true);
  });
});
```

## Continuous Integration

Tests should be run automatically in CI/CD pipelines before merging pull requests.
