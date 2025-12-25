# Testing Quick Reference

## Quick Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:a11y         # Accessibility tests only
```

## Running Specific Tests

```bash
# Run a specific test file
npm test -- plugin-manager.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should load plugins"

# Run tests in a specific directory
npm test -- src/main/__tests__
```

## Writing Tests

### Main Process Test Template

```typescript
// src/main/__tests__/my-module.test.ts
import { MyModule } from '../my-module';
import { app } from 'electron';

// Mock Electron
jest.mock('electron', () => require('../__mocks__/electron'));

describe('MyModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something', () => {
    const module = new MyModule();
    expect(module.someMethod()).toBe(expected);
  });
});
```

### Renderer Process Test Template

```typescript
// src/renderer/__tests__/MyComponent.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from '../components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle clicks', () => {
    const handleClick = jest.fn();
    render(<MyComponent onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

## Common Matchers

```typescript
// Equality
expect(value).toBe(expected);          // Strict equality (===)
expect(value).toEqual(expected);       // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeGreaterThanOrEqual(3);
expect(value).toBeLessThan(5);
expect(value).toBeCloseTo(0.3);        // Floating point

// Strings
expect(string).toMatch(/pattern/);
expect(string).toContain('substring');

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toHaveProperty('key', value);

// Functions
expect(fn).toThrow();
expect(fn).toThrow('error message');
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledWith(arg1, arg2);
expect(fn).toHaveBeenCalledTimes(2);

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();

// DOM (renderer only)
expect(element).toBeInTheDocument();
expect(element).toHaveTextContent('text');
expect(element).toHaveAttribute('href', '/url');
expect(element).toHaveClass('className');
expect(element).toBeVisible();
expect(element).toBeDisabled();
```

## Mocking

### Mock Functions

```typescript
const mockFn = jest.fn();
const mockFn = jest.fn(() => 'return value');
const mockFn = jest.fn().mockReturnValue('value');
const mockFn = jest.fn().mockResolvedValue('async value');
const mockFn = jest.fn().mockRejectedValue(new Error('error'));
```

### Mock Modules

```typescript
// Mock entire module
jest.mock('../module');

// Mock with implementation
jest.mock('../module', () => ({
  functionName: jest.fn(() => 'mocked'),
}));

// Mock specific exports
import * as module from '../module';
jest.spyOn(module, 'functionName').mockReturnValue('mocked');
```

### Mock Electron

```typescript
// Already set up - just import
import { app, dialog, ipcMain } from 'electron';

// Use the mocks
app.getPath('userData');  // Returns '/mock/userData'
dialog.showOpenDialog();  // Returns mock dialog result
```

### Mock IPC (Renderer)

```typescript
const mockInvoke = window.electron.ipcRenderer.invoke as jest.Mock;
mockInvoke.mockResolvedValue({ success: true });
```

## Test Lifecycle

```typescript
describe('Test Suite', () => {
  beforeAll(() => {
    // Runs once before all tests
  });

  beforeEach(() => {
    // Runs before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Runs after each test
    jest.restoreAllMocks();
  });

  afterAll(() => {
    // Runs once after all tests
  });

  it('test case', () => {
    // Test code
  });
});
```

## Coverage Thresholds

Minimum required coverage: **70%**
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

Critical paths should aim for **90%+** coverage.

## Debugging

### VS Code Debugger

1. Set breakpoint in test file
2. Press F5 or use Debug panel
3. Select "Jest Debug" configuration

### Console Output

```typescript
// Unmock console for debugging
console.log.mockRestore();
console.log('Debug message');
```

### Only Run One Test

```typescript
it.only('should run only this test', () => {
  // Test code
});
```

### Skip a Test

```typescript
it.skip('should skip this test', () => {
  // Test code
});
```

## File Structure

```
src/
├── main/
│   ├── __tests__/              # Tests for main process
│   │   ├── example.test.ts
│   │   └── integration/        # Integration tests
│   ├── __mocks__/              # Mocks for main process
│   │   └── electron.ts
│   └── ...
├── renderer/
│   ├── __tests__/              # Tests for renderer process
│   │   ├── example.test.tsx
│   │   └── a11y/              # Accessibility tests
│   └── ...
├── __mocks__/                  # Global mocks
│   ├── styleMock.js
│   └── fileMock.js
└── setupTests.ts              # Test setup (renderer)
```

## Common Issues

### "Cannot find module 'electron'"
**Solution**: Add mock at top of test file:
```typescript
jest.mock('electron', () => require('../__mocks__/electron'));
```

### "Unexpected token" in CSS/images
**Solution**: Imports are already mocked via jest.config.js

### Test timeout
**Solution**: Increase timeout:
```typescript
it('test', async () => {
  // test code
}, 10000); // 10 second timeout
```

### React Flow errors
**Solution**: Mock React Flow components (see TESTING_GUIDE.md)

## Resources

- Full documentation: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- Jest docs: https://jestjs.io/
- Testing Library: https://testing-library.com/
- Example tests: `src/*/__tests__/example.test.*`
