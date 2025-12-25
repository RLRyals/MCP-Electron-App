# Testing Infrastructure - Complete Setup

This document provides an overview of the complete testing infrastructure for the FictionLab Electron application.

## Files Created

### Configuration Files

1. **`jest.config.js`** - Main Jest configuration
   - Configured for TypeScript with ts-jest
   - Separate test environments for main (Node) and renderer (jsdom) processes
   - Coverage thresholds set to 70% minimum
   - Module name mapping for path aliases and static assets
   - Located at project root

2. **`.vscode/launch.json`** - VS Code debug configurations
   - Jest: Run All Tests
   - Jest: Debug Current File
   - Jest: Watch Mode
   - Jest: Coverage
   - Electron: Main (for debugging the app)

### Test Setup Files

3. **`src/setupTests.ts`** - Test setup for renderer process
   - Imports jest-dom matchers for DOM assertions
   - Mocks browser APIs (matchMedia, IntersectionObserver, ResizeObserver)
   - Mocks localStorage and sessionStorage
   - Provides test utilities (flushPromises, waitForNextUpdate)
   - Sets up global electron IPC mocks

### Mock Files

4. **`src/main/__mocks__/electron.ts`** - Electron API mocks
   - Mocks all major Electron modules (app, BrowserWindow, ipcMain, dialog, etc.)
   - Provides realistic mock implementations
   - Used automatically when importing from 'electron' in tests

5. **`src/__mocks__/styleMock.js`** - CSS imports mock
   - Returns empty object for all CSS imports
   - Prevents errors when importing styles in tests

6. **`src/__mocks__/fileMock.js`** - Static assets mock
   - Returns 'test-file-stub' for image/font imports
   - Prevents errors when importing static files

### Example Test Files

7. **`src/main/__tests__/example.test.ts`** - Main process test examples
   - Demonstrates basic assertions
   - Shows async testing patterns
   - Examples of mocking functions
   - Template for main process tests

8. **`src/renderer/__tests__/example.test.tsx`** - Renderer process test examples
   - React component testing with Testing Library
   - Event handling and user interaction tests
   - State management testing
   - Template for renderer tests

### Documentation

9. **`TESTING_GUIDE.md`** - Comprehensive testing documentation
   - How to run tests
   - Writing tests for main and renderer processes
   - Integration and accessibility testing
   - Mocking strategies
   - Coverage requirements
   - Best practices
   - Debugging techniques
   - Common issues and solutions

10. **`TESTING_QUICK_REFERENCE.md`** - Quick reference guide
    - Common commands
    - Test templates
    - Common matchers
    - Mocking examples
    - Quick troubleshooting

11. **`TESTING_INFRASTRUCTURE.md`** - This file
    - Overview of all testing files
    - Setup instructions
    - Architecture explanation

### Updated Files

12. **`package.json`** - Added test scripts and dependencies
    - Scripts: test, test:watch, test:coverage, test:unit, test:integration, test:a11y
    - Dependencies: jest, ts-jest, @testing-library/react, jest-dom, jest-axe

## Test Scripts

Run these commands from the project root:

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test types
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:a11y         # Accessibility tests
```

## Project Structure

```
c:\github\MCP-Electron-App\
├── .vscode/
│   └── launch.json                    # VS Code debug configurations
├── src/
│   ├── main/
│   │   ├── __tests__/                 # Main process tests
│   │   │   └── example.test.ts
│   │   └── __mocks__/                 # Main process mocks
│   │       └── electron.ts
│   ├── renderer/
│   │   └── __tests__/                 # Renderer process tests
│   │       └── example.test.tsx
│   ├── __mocks__/                     # Global mocks
│   │   ├── styleMock.js
│   │   └── fileMock.js
│   └── setupTests.ts                  # Test setup (renderer)
├── coverage/                          # Generated coverage reports (gitignored)
├── jest.config.js                     # Jest configuration
├── TESTING_GUIDE.md                   # Comprehensive testing guide
├── TESTING_QUICK_REFERENCE.md         # Quick reference
├── TESTING_INFRASTRUCTURE.md          # This file
└── package.json                       # Updated with test scripts

```

## Architecture

### Test Environments

The testing infrastructure uses Jest's multi-project configuration to handle the unique requirements of Electron applications:

1. **Main Process Tests** (Node environment)
   - Files: `src/main/**/*.test.ts`
   - Environment: Node.js
   - Mocks: Electron APIs via `__mocks__/electron.ts`
   - Use cases: Plugin management, workflow execution, file operations

2. **Renderer Process Tests** (jsdom environment)
   - Files: `src/renderer/**/*.test.tsx`
   - Environment: jsdom (simulated browser)
   - Mocks: Browser APIs, DOM, React components
   - Use cases: React components, UI interactions, user workflows

3. **Preload Process Tests** (Node environment)
   - Files: `src/preload/**/*.test.ts`
   - Environment: Node.js
   - Use cases: IPC bridge, context isolation

### Coverage Configuration

The project requires minimum 70% coverage across all metrics:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

Critical paths (workflow execution, plugin management, security) should aim for 90%+ coverage.

Coverage reports are generated in multiple formats:
- HTML: `coverage/index.html` (interactive browser view)
- LCOV: `coverage/lcov.info` (for CI/CD tools)
- Text: Terminal output

### Mocking Strategy

#### Electron APIs
Electron APIs are mocked via `src/main/__mocks__/electron.ts`. The mock file provides realistic implementations of:
- app.getPath() - Returns mock paths
- dialog methods - Return mock dialog results
- ipcMain handlers - Track registered handlers
- BrowserWindow - Mock window lifecycle

#### Static Assets
CSS and image imports are mocked via module name mapping:
- CSS files → `src/__mocks__/styleMock.js` (empty object)
- Images → `src/__mocks__/fileMock.js` (string stub)

#### IPC Communication
Renderer tests can mock IPC calls:
```typescript
const mockInvoke = window.electron.ipcRenderer.invoke as jest.Mock;
mockInvoke.mockResolvedValue({ success: true });
```

## Setup Instructions

### 1. Install Dependencies

The testing dependencies are already added to `package.json`. Install them:

```bash
npm install
```

### 2. Verify Installation

Run the example tests to verify setup:

```bash
npm test
```

You should see output showing all example tests passing.

### 3. Generate Coverage Report

```bash
npm run test:coverage
```

Open `coverage/index.html` in a browser to view the interactive coverage report.

### 4. Set Up VS Code Debugging (Optional)

The debug configurations are already in `.vscode/launch.json`. To use them:

1. Open a test file
2. Set a breakpoint (click left of line number)
3. Press F5 or go to Run & Debug panel
4. Select "Jest: Debug Current File"
5. Click the green play button

## Writing Your First Test

### Main Process Test

Create `src/main/__tests__/my-feature.test.ts`:

```typescript
import { app } from 'electron';

jest.mock('electron', () => require('../__mocks__/electron'));

describe('MyFeature', () => {
  it('should use app.getPath', () => {
    const userDataPath = app.getPath('userData');
    expect(userDataPath).toBe('/mock/userData');
  });
});
```

### Renderer Process Test

Create `src/renderer/__tests__/MyComponent.test.tsx`:

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../components/MyComponent';

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Integration with CI/CD

The test infrastructure is ready for CI/CD integration. Add to your workflow:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci
      - run: npm test -- --coverage --ci
      - run: npm run build  # Ensure tests don't break the build

      # Optional: Upload coverage to Codecov
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Best Practices

1. **Write tests first** (TDD approach recommended)
2. **Keep tests focused** - One test per behavior
3. **Use descriptive names** - Tests should document expected behavior
4. **Mock external dependencies** - Tests should be isolated
5. **Test edge cases** - null, undefined, empty arrays, errors
6. **Maintain coverage** - Aim for 70%+ minimum, 90%+ for critical paths
7. **Run tests before committing** - Use `npm run test:coverage`

## Common Workflows

### Adding a New Feature

1. Write failing test: `npm run test:watch`
2. Implement feature
3. See test pass
4. Check coverage: `npm run test:coverage`
5. Refactor if needed

### Debugging Failing Test

1. Open test file in VS Code
2. Set breakpoint at failing assertion
3. Press F5, select "Jest: Debug Current File"
4. Step through code to find issue
5. Fix and verify

### Before Committing

```bash
# Run all tests with coverage
npm run test:coverage

# Ensure build still works
npm run build

# Verify no issues
npm test
```

## Troubleshooting

### Tests Not Found
- Ensure test files match pattern: `**/__tests__/**/*.test.{ts,tsx}`
- Check jest.config.js `testMatch` pattern

### Module Not Found Errors
- Check `moduleNameMapper` in jest.config.js
- Ensure mocks exist for non-JS imports (CSS, images)

### Electron API Errors
- Add mock: `jest.mock('electron', () => require('../__mocks__/electron'));`
- Check that mock exports the required API

### React Component Errors
- Ensure using renderer test environment (jsdom)
- Import setupTests: Already configured in jest.config.js

### Coverage Not Meeting Threshold
- Run: `npm run test:coverage`
- Open: `coverage/index.html`
- Find uncovered lines (highlighted in red)
- Write tests for uncovered code

## Next Steps

1. **Install dependencies**: `npm install`
2. **Run example tests**: `npm test`
3. **Review documentation**: Read `TESTING_GUIDE.md`
4. **Write your first test**: Use templates in example files
5. **Set up CI/CD**: Add test workflow to `.github/workflows/`
6. **Maintain coverage**: Check coverage regularly

## Resources

- **Testing Guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Comprehensive guide
- **Quick Reference**: [TESTING_QUICK_REFERENCE.md](./TESTING_QUICK_REFERENCE.md) - Quick lookup
- **Jest Docs**: https://jestjs.io/
- **Testing Library**: https://testing-library.com/
- **Electron Testing**: https://www.electronjs.org/docs/latest/tutorial/automated-testing

## Support

For issues with the testing infrastructure:
1. Check [TESTING_GUIDE.md](./TESTING_GUIDE.md) Common Issues section
2. Review example tests in `src/**/__tests__/example.test.*`
3. Check Jest documentation: https://jestjs.io/
4. Review mock implementations in `src/**/__mocks__/`

---

**Testing Infrastructure Version**: 1.0.0
**Last Updated**: 2025-12-20
**Status**: Complete and ready to use
