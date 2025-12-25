# Workflow Executor Test Suite

This directory contains comprehensive unit tests for all workflow node executors using Jest.

## Test Files

### 1. context-manager.test.ts
Tests for the ContextManager class that handles variable passing and context building between workflow nodes.

**Coverage:**
- JSONPath evaluation (`$.path`, `{{variable}}`)
- Condition evaluation (>=, <=, ==, !=, >, <)
- Variable substitution in templates
- Simple mode context building (automatic variable passing)
- Advanced mode context building (explicit JSONPath mappings)
- Output extraction (simple and advanced modes)
- Transform functions on mapped values
- Error handling and missing variables
- Available variables listing

**Key Test Cases:**
- Variable references with `{{}}` syntax
- Nested JSONPath expressions
- Array access and wildcards
- Numeric and string comparisons
- Transform function application
- Missing variable detection

### 2. user-input-executor.test.ts
Tests for the UserInputExecutor that handles user input capture during workflow execution.

**Coverage:**
- Text input validation (required, minLength, maxLength, pattern)
- Number validation (min, max, type checking)
- Select input validation (valid options)
- Textarea validation
- Default value handling
- Error messages and validation failures

**Key Test Cases:**
- Required field validation
- Length constraints (min/max)
- Pattern matching with regex
- Email validation example
- Number range validation
- Select option validation
- Empty and optional fields

### 3. code-execution-executor.test.ts
Tests for the CodeExecutionExecutor that runs JavaScript and Python code in sandboxed environments.

**Coverage:**
- JavaScript execution (sandboxed with vm2)
- Python execution (subprocess)
- Security validation (dangerous patterns)
- Context availability in code
- Console output capture
- Timeout enforcement
- Module whitelisting
- Error handling

**Key Test Cases:**
- Simple JavaScript execution
- Context variable access
- Array and object operations
- Console.log capture
- Security blocks (child_process, eval, Function)
- Python code execution
- Module whitelisting
- Timeout handling

**Mocked Dependencies:**
- `child_process.spawn` for Python execution tests

### 4. http-request-executor.test.ts
Tests for the HttpRequestExecutor that makes HTTP requests with authentication and retry logic.

**Coverage:**
- All HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Authentication types (none, basic, bearer, api-key)
- Variable substitution in URL, headers, and body
- Response parsing (JSON, text, buffer)
- Retry logic with exponential backoff
- Timeout handling
- Error handling

**Key Test Cases:**
- GET/POST/PUT/PATCH/DELETE requests
- Variable substitution in all fields
- Basic, Bearer, and API-Key authentication
- Custom headers
- JSON body parsing
- Retry on 5xx errors
- No retry on 4xx errors
- Network error handling

**Mocked Dependencies:**
- `axios` for HTTP requests

### 5. file-operation-executor.test.ts
Tests for the FileOperationExecutor that handles file system operations with security restrictions.

**Coverage:**
- All operations (read, write, copy, move, delete, exists)
- UTF-8 and binary encoding
- Project folder restriction (security)
- Path traversal attack prevention
- Variable substitution in paths
- Error handling (ENOENT, EACCES)

**Key Test Cases:**
- Read file (UTF-8 and binary)
- Write file with overwrite control
- Copy and move operations
- Delete existing and non-existent files
- File existence checks
- Project folder boundary enforcement
- Path traversal attack blocking
- Variable substitution in paths

**Mocked Dependencies:**
- `fs-extra` for file system operations

### 6. conditional-executor.test.ts
Tests for the ConditionalExecutor that evaluates conditions for workflow branching.

**Coverage:**
- JSONPath condition evaluation
- JavaScript condition evaluation
- All comparison operators (>=, <=, ==, !=, >, <, ===, !==)
- Boolean result validation
- Error handling with graceful degradation

**Key Test Cases:**
- Numeric comparisons
- String equality checks
- Boolean conditions
- Complex JavaScript expressions
- Array operations (includes)
- Object property access
- Nested conditions with AND/OR
- Error handling (defaults to false)

### 7. loop-executor.test.ts
Tests for the LoopExecutor that manages loop iterations (forEach, while, count).

**Coverage:**
- forEach loop (array iteration)
- While loop (condition-based)
- Count loop (fixed iterations)
- Loop context management
- Iterator and index variables
- Max iterations safety
- Loop stack for nested loops
- Summary generation

**Key Test Cases:**
- Array iteration with objects
- Empty collections
- Fixed count iterations
- Condition-based loops
- Max iteration safety
- Index variable tracking
- Loop stack management
- Success/failure summary

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- context-manager.test.ts
```

### Run tests for executors only
```bash
npm test -- src/main/workflow/executors/__tests__
```

## Coverage Goals

The test suite aims for 80%+ coverage across all executors:
- **Lines:** 80%+
- **Functions:** 80%+
- **Branches:** 80%+
- **Statements:** 80%+

Current coverage can be viewed by running:
```bash
npm run test:coverage
```

## Test Structure

All tests follow this structure:

```typescript
import { ExecutorName } from '../executor-name';

describe('ExecutorName', () => {
  let executor: ExecutorName;

  beforeEach(() => {
    executor = new ExecutorName();
  });

  describe('feature/method', () => {
    it('should test specific behavior', async () => {
      // Arrange
      const node = { /* test node config */ };
      const context = { /* test context */ };

      // Act
      const result = await executor.execute(node, context);

      // Assert
      expect(result.status).toBe('success');
      expect(result.output).toBeDefined();
    });
  });
});
```

## Mocking Strategy

### External Dependencies
- **axios:** Mocked for HTTP requests
- **fs-extra:** Mocked for file operations
- **child_process:** Mocked for Python execution
- **vm2:** Real implementation used (sandboxing tested)

### Mock Patterns
1. **Setup:** Use `jest.mock()` at file level
2. **Type safety:** Cast mocks with `jest.Mocked<typeof module>`
3. **Reset:** Clear mocks in `beforeEach()` with `jest.clearAllMocks()`
4. **Assertions:** Verify calls with `toHaveBeenCalledWith()`

## Best Practices

1. **Test both success and failure paths**
   - Happy path: valid inputs → success
   - Error path: invalid inputs → graceful failure

2. **Test edge cases**
   - Empty inputs
   - Null/undefined values
   - Boundary conditions
   - Maximum values

3. **Use descriptive test names**
   - Start with "should"
   - Describe the expected behavior
   - Include the condition/context

4. **Keep tests isolated**
   - No shared state between tests
   - Clean up in afterEach if needed
   - Use beforeEach for setup

5. **Mock external dependencies**
   - Don't make real HTTP requests
   - Don't access real file system
   - Don't spawn real processes

## Adding New Tests

When adding a new executor, create a test file following this pattern:

1. Create `<executor-name>.test.ts` in `__tests__` directory
2. Import the executor and required types
3. Mock external dependencies
4. Write test suites for each major feature
5. Test success cases, error cases, and edge cases
6. Run coverage to ensure 80%+ coverage

## Debugging Tests

### Run single test
```bash
npm test -- -t "should execute successfully"
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["${fileBasename}", "--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### View detailed output
```bash
npm test -- --verbose
```

## Continuous Integration

Tests run automatically in CI/CD pipeline:
- On every commit
- On pull requests
- Before deployment

Minimum coverage thresholds must be met for CI to pass.
