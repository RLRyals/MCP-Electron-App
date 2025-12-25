# Test Setup Guide

## Overview

This directory contains comprehensive unit tests for all workflow node executors. The tests use Jest as the testing framework and follow best practices for isolated, maintainable test code.

## Files Created

1. **test-helpers.ts** - Helper functions for creating test contexts
2. **context-manager.test.ts** - Tests for ContextManager
3. **user-input-executor.test.ts** - Tests for UserInputExecutor
4. **code-execution-executor.test.ts** - Tests for CodeExecutionExecutor
5. **http-request-executor.test.ts** - Tests for HttpRequestExecutor
6. **file-operation-executor.test.ts** - Tests for FileOperationExecutor
7. **conditional-executor.test.ts** - Tests for ConditionalExecutor
8. **loop-executor.test.ts** - Tests for LoopExecutor

## Required Setup

### 1. Fix TypeScript Compilation Errors

Some test files use `WorkflowExecutionContext` objects that need to include all required fields. Update test contexts to use the `createTestContext()` helper function from `test-helpers.ts`.

**Example fix:**

```typescript
// Before (incomplete context)
const globalContext: WorkflowExecutionContext = {
  projectFolder: '/test/project',
  instanceId: 'test-instance',
  workflowId: 'test-workflow',
  variables: {},
  nodeOutputs: new Map(),
  mcpData: {},
};

// After (using helper)
const globalContext = createTestContext({
  variables: {},
});
```

The `createTestContext()` helper automatically includes all required fields:
- `projectFolder`
- `instanceId`
- `workflowId`
- `variables`
- `nodeOutputs`
- `mcpData`
- `currentNodeId`
- `completedNodes`
- `loopStack`
- `startedAt`
- `userId`

### 2. Install Dependencies

Ensure Jest and related dependencies are installed:

```bash
npm install --save-dev jest @types/jest ts-jest
```

### 3. Fix jest.config.js

Update the Jest configuration if needed. The config file at project root should be set for version 29:

```javascript
// Change "coverageThresholds" to "coverageThreshold" (singular)
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
},
```

## Running Tests

### Run all executor tests
```bash
npm test -- src/main/workflow/executors/__tests__
```

### Run specific test file
```bash
npm test -- context-manager.test.ts
```

### Run with coverage
```bash
npm run test:coverage -- src/main/workflow/executors/__tests__
```

### Run in watch mode
```bash
npm run test:watch -- src/main/workflow/executors/__tests__
```

## Quick Fix Script

To quickly update all test files to use the test helper, run this sed command:

```bash
# Update context-manager.test.ts
sed -i 's/const globalContext: WorkflowExecutionContext = {$/const globalContext = createTestContext({/' context-manager.test.ts

# Update loop-executor.test.ts
sed -i 's/const context: WorkflowExecutionContext = {$/const context = createTestContext({/' loop-executor.test.ts
```

Or manually update each file by:
1. Adding import: `import { createTestContext } from './test-helpers';`
2. Replacing `const context: WorkflowExecutionContext = { ... }` with `const context = createTestContext({ ... })`
3. Removing the following fields from the object (they're auto-added):
   - `projectFolder` (unless you need a specific value)
   - `instanceId`
   - `workflowId`
   - `currentNodeId`
   - `completedNodes`
   - `loopStack`
   - `startedAt`
   - `userId`

## Test Structure

Each test file follows this pattern:

```typescript
import { ExecutorClass } from '../executor-file';
import { createTestContext } from './test-helpers';

describe('ExecutorClass', () => {
  let executor: ExecutorClass;

  beforeEach(() => {
    executor = new ExecutorClass();
    jest.clearAllMocks();
  });

  describe('method/feature', () => {
    it('should do something', async () => {
      const node = { /* node config */ };
      const context = createTestContext({ /* overrides */ });

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
    });
  });
});
```

## Mocking

### HTTP Requests (axios)
```typescript
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

mockedAxios.mockResolvedValueOnce({ status: 200, data: {} });
```

### File System (fs-extra)
```typescript
jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

mockedFs.readFile.mockResolvedValueOnce('content');
```

### Child Process (for Python execution)
```typescript
jest.mock('child_process', () => ({
  spawn: jest.fn(/* mock implementation */)
}));
```

## Coverage Goals

- **Lines:** 80%+
- **Functions:** 80%+
- **Branches:** 80%+
- **Statements:** 80%+

Check coverage with:
```bash
npm run test:coverage -- src/main/workflow/executors/__tests__
```

## Troubleshooting

### TypeScript Errors

If you see errors like "Type '...' is missing the following properties", make sure you're using `createTestContext()` helper.

### Module Resolution Errors

If Jest can't find modules, check:
1. `jest.config.js` has correct `moduleNameMapper`
2. `tsconfig.json` has correct `paths`
3. Files are in the correct directories

### Mock Not Working

Ensure:
1. Mocks are defined at file level (before imports)
2. `jest.clearAllMocks()` is called in `beforeEach()`
3. Mock is typed correctly: `as jest.Mocked<typeof module>`

### Tests Timeout

Increase timeout in jest.config.js:
```javascript
testTimeout: 30000, // 30 seconds
```

Or per-test:
```typescript
it('slow test', async () => {
  // test code
}, 30000); // 30 second timeout
```

## Next Steps

1. Fix TypeScript errors in test files (use `createTestContext()`)
2. Run tests to verify they pass
3. Check coverage and add tests for uncovered code
4. Integrate into CI/CD pipeline

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
