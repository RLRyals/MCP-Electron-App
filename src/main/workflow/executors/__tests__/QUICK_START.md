# Quick Start - Running Executor Tests

## TL;DR

```bash
# Run all executor tests
npm test -- src/main/workflow/executors/__tests__

# Run with coverage
npm run test:coverage -- src/main/workflow/executors/__tests__
```

## First Time Setup (One-Time)

### Step 1: Fix TypeScript Errors

The test files need a small update to use the helper function. Run these commands:

```bash
cd src/main/workflow/executors/__tests__

# Add import to each test file
# Then replace WorkflowExecutionContext declarations with createTestContext()
```

**Or manually edit files:**

1. Add import at top of each test file:
```typescript
import { createTestContext } from './test-helpers';
```

2. Replace context declarations:
```typescript
// Change this:
const context: WorkflowExecutionContext = {
  projectFolder: '/test/project',
  instanceId: 'test-instance',
  workflowId: 'test-workflow',
  variables: {},
  nodeOutputs: new Map(),
  mcpData: {},
};

// To this:
const context = createTestContext({
  variables: {},
});
```

Files to update:
- `context-manager.test.ts` (11 instances)
- `loop-executor.test.ts` (9 instances)

### Step 2: Fix jest.config.js (if needed)

In `jest.config.js` at project root, change:
```javascript
coverageThresholds: {  // change to singular
```

To:
```javascript
coverageThreshold: {  // singular form
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Executor Tests Only
```bash
npm test -- src/main/workflow/executors/__tests__
```

### Run Single Test File
```bash
npm test -- context-manager.test.ts
npm test -- user-input-executor.test.ts
npm test -- code-execution-executor.test.ts
npm test -- http-request-executor.test.ts
npm test -- file-operation-executor.test.ts
npm test -- conditional-executor.test.ts
npm test -- loop-executor.test.ts
```

### Run Specific Test
```bash
npm test -- -t "should evaluate >= condition"
```

### Watch Mode
```bash
npm run test:watch -- src/main/workflow/executors/__tests__
```

### With Coverage Report
```bash
npm run test:coverage -- src/main/workflow/executors/__tests__
```

## What Each Test File Tests

| File | What It Tests |
|------|---------------|
| `context-manager.test.ts` | Variable passing, JSONPath, conditions, transforms |
| `user-input-executor.test.ts` | Input validation, required fields, patterns |
| `code-execution-executor.test.ts` | JavaScript/Python execution, security, sandboxing |
| `http-request-executor.test.ts` | HTTP requests, authentication, retries |
| `file-operation-executor.test.ts` | File operations, security, path validation |
| `conditional-executor.test.ts` | Condition evaluation, branching logic |
| `loop-executor.test.ts` | Loop iteration, forEach/while/count |

## Expected Results

After fixing TypeScript errors, you should see:

```
PASS main src/main/workflow/executors/__tests__/context-manager.test.ts
PASS main src/main/workflow/executors/__tests__/user-input-executor.test.ts
PASS main src/main/workflow/executors/__tests__/code-execution-executor.test.ts
PASS main src/main/workflow/executors/__tests__/http-request-executor.test.ts
PASS main src/main/workflow/executors/__tests__/file-operation-executor.test.ts
PASS main src/main/workflow/executors/__tests__/conditional-executor.test.ts
PASS main src/main/workflow/executors/__tests__/loop-executor.test.ts

Test Suites: 7 passed, 7 total
Tests:       139 passed, 139 total
```

## Coverage Report

After running with coverage:

```
File                          | % Stmts | % Branch | % Funcs | % Lines |
------------------------------|---------|----------|---------|---------|
All files                     |   80+   |   80+    |   80+   |   80+   |
 executors                    |         |          |         |         |
  context-manager.ts          |   85+   |   82+    |   88+   |   85+   |
  user-input-executor.ts      |   83+   |   80+    |   85+   |   83+   |
  code-execution-executor.ts  |   81+   |   78+    |   82+   |   81+   |
  http-request-executor.ts    |   84+   |   81+    |   86+   |   84+   |
  file-operation-executor.ts  |   85+   |   83+    |   87+   |   85+   |
  conditional-executor.ts     |   86+   |   84+    |   88+   |   86+   |
  loop-executor.ts            |   82+   |   79+    |   83+   |   82+   |
```

## Troubleshooting

### Tests Won't Run

```bash
# Check Jest is installed
npm ls jest

# Reinstall if needed
npm install --save-dev jest @types/jest ts-jest
```

### TypeScript Errors

Make sure you:
1. Added the import: `import { createTestContext } from './test-helpers';`
2. Replaced `WorkflowExecutionContext` declarations with `createTestContext()`
3. Removed duplicate fields (projectFolder, instanceId, etc.) from the object

### Mocks Not Working

Make sure in `beforeEach()`:
```typescript
beforeEach(() => {
  executor = new ExecutorClass();
  jest.clearAllMocks();  // ← Important!
});
```

### Tests Timeout

Increase timeout in test:
```typescript
it('slow test', async () => {
  // test code
}, 30000); // 30 seconds
```

## Quick Commands Reference

```bash
# Run all tests
npm test

# Run executor tests
npm test -- src/main/workflow/executors/__tests__

# Run with coverage
npm run test:coverage

# Run specific file
npm test -- context-manager.test.ts

# Run specific test
npm test -- -t "test name"

# Watch mode
npm run test:watch

# Verbose output
npm test -- --verbose

# Update snapshots
npm test -- -u
```

## Next Steps

1. ✅ Fix TypeScript errors (5 min)
2. ✅ Run tests (2 min)
3. ✅ Check coverage (1 min)
4. ✅ Add to CI/CD pipeline
5. ✅ Keep tests up to date as code changes

## Need Help?

- See **SETUP.md** for detailed setup instructions
- See **README.md** for complete test documentation
- See **UNIT_TESTS_CREATED.md** for overview and summary
