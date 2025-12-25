# Testing Guide

## Overview

This project uses Jest as the testing framework with TypeScript support. The testing infrastructure is designed to handle the unique requirements of an Electron application with separate main, renderer, and preload processes.

### Test Types

1. **Unit Tests** - Test individual functions, classes, and utilities in isolation
2. **Integration Tests** - Test interactions between components and modules
3. **Accessibility Tests** - Test UI components for accessibility compliance

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
Run tests in watch mode for active development:
```bash
npm run test:watch
```

### Coverage Report
Generate code coverage report:
```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory and include:
- HTML report: `coverage/index.html`
- LCOV report: `coverage/lcov.info`
- Text summary in terminal

### Specific Test Suites
```bash
# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only accessibility tests
npm run test:a11y
```

### Run Tests by Pattern
```bash
# Run tests matching a file pattern
npm test -- --testPathPattern=plugin

# Run tests matching a test name
npm test -- --testNamePattern="should handle errors"
```

## Project Structure

```
src/
├── main/
│   ├── __tests__/              # Main process tests
│   ├── __mocks__/              # Main process mocks
│   │   └── electron.ts         # Electron API mocks
│   └── ...
├── renderer/
│   ├── __tests__/              # Renderer process tests
│   └── ...
├── preload/
│   ├── __tests__/              # Preload process tests
│   └── ...
├── __mocks__/                  # Global mocks
│   ├── styleMock.js           # CSS imports mock
│   └── fileMock.js            # Asset imports mock
└── setupTests.ts              # Test setup (renderer only)
```

## Writing Tests

### Basic Test Structure

```typescript
import { functionToTest } from '../module';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should perform expected behavior', () => {
      // Arrange
      const input = 'test data';
      const expected = 'expected result';

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('should handle edge cases', () => {
      expect(() => functionToTest(null)).toThrow();
    });
  });
});
```

### Main Process Tests

Main process tests run in a Node environment and have access to Electron APIs through mocks.

```typescript
// src/main/__tests__/plugin-manager.test.ts
import { PluginManager } from '../plugin-manager';
import { app, dialog } from 'electron';

// Mock electron module
jest.mock('electron', () => require('../__mocks__/electron'));

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with empty plugin list', () => {
    expect(pluginManager.getPlugins()).toEqual([]);
  });

  it('should load plugins from directory', async () => {
    // Mock fs operations
    const mockFs = require('fs-extra');
    mockFs.readdir.mockResolvedValue(['plugin1', 'plugin2']);

    await pluginManager.loadPlugins();

    expect(mockFs.readdir).toHaveBeenCalled();
  });
});
```

### Renderer Process Tests

Renderer tests run in a jsdom environment and have access to DOM APIs and React testing utilities.

```typescript
// src/renderer/__tests__/TopBar.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '../components/TopBar';

describe('TopBar', () => {
  it('should render navigation items', () => {
    render(<TopBar />);

    expect(screen.getByText('Workflows')).toBeInTheDocument();
    expect(screen.getByText('Plugins')).toBeInTheDocument();
  });

  it('should handle navigation clicks', () => {
    const onNavigate = jest.fn();
    render(<TopBar onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText('Workflows'));

    expect(onNavigate).toHaveBeenCalledWith('workflows');
  });

  it('should display current view as active', () => {
    render(<TopBar currentView="workflows" />);

    const workflowsTab = screen.getByText('Workflows');
    expect(workflowsTab).toHaveClass('active');
  });
});
```

### Integration Tests

Integration tests verify interactions between multiple modules.

```typescript
// src/main/__tests__/integration/workflow-execution.test.ts
import { WorkflowExecutor } from '../../workflow/workflow-executor';
import { MCPWorkflowClient } from '../../workflow/mcp-workflow-client';
import { PluginManager } from '../../plugin-manager';

describe('Workflow Execution Integration', () => {
  let executor: WorkflowExecutor;
  let client: MCPWorkflowClient;
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
    client = new MCPWorkflowClient();
    executor = new WorkflowExecutor(client, pluginManager);
  });

  it('should execute workflow with multiple phases', async () => {
    const workflow = {
      id: 'test-workflow',
      phases: [
        { id: 'phase1', type: 'prompt', config: {} },
        { id: 'phase2', type: 'transform', config: {} },
      ],
    };

    const result = await executor.execute(workflow);

    expect(result.success).toBe(true);
    expect(result.phases).toHaveLength(2);
  });
});
```

### Accessibility Tests

Accessibility tests ensure UI components are usable by everyone.

```typescript
// src/renderer/__tests__/a11y/WorkflowCanvas.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { WorkflowCanvas } from '../../components/WorkflowCanvas';

expect.extend(toHaveNoViolations);

describe('WorkflowCanvas Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<WorkflowCanvas />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels', () => {
    const { getByLabelText } = render(<WorkflowCanvas />);

    expect(getByLabelText('Workflow canvas')).toBeInTheDocument();
  });
});
```

## Mocking

### Mocking Electron APIs

Electron APIs are automatically mocked for main process tests:

```typescript
import { app, dialog } from 'electron';

// These are automatically mocked when you import from 'electron'
app.getPath('userData'); // Returns '/mock/userData'
dialog.showOpenDialog(); // Returns mock dialog result
```

### Mocking Node Modules

```typescript
// Mock fs-extra
jest.mock('fs-extra', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  readdir: jest.fn(),
  ensureDir: jest.fn(),
}));

// Use the mock
import fs from 'fs-extra';
(fs.readFile as jest.Mock).mockResolvedValue('file contents');
```

### Mocking IPC Communication

```typescript
// In renderer tests
const mockInvoke = window.electron.ipcRenderer.invoke as jest.Mock;
mockInvoke.mockResolvedValue({ success: true });

// Call code that uses IPC
await someFunction();

// Verify IPC was called
expect(mockInvoke).toHaveBeenCalledWith('channel-name', expectedArgs);
```

### Mocking React Flow

```typescript
jest.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
  useNodesState: () => [[], jest.fn(), jest.fn()],
  useEdgesState: () => [[], jest.fn(), jest.fn()],
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
}));
```

### Mocking Timers

```typescript
describe('Timer tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should delay execution', () => {
    const callback = jest.fn();

    setTimeout(callback, 1000);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalled();
  });
});
```

## Test Utilities

### Custom Test Utilities

```typescript
// src/test-utils/render.tsx
import React from 'react';
import { render as rtlRender } from '@testing-library/react';

export function render(ui: React.ReactElement, options = {}) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <TestProviders>{children}</TestProviders>
    ),
    ...options,
  });
}

export { screen, fireEvent, waitFor } from '@testing-library/react';
```

### Async Utilities

```typescript
import { flushPromises, waitForNextUpdate } from '../setupTests';

// Wait for all promises to resolve
await flushPromises();

// Wait for next microtask
await waitForNextUpdate();
```

## Coverage Requirements

### Minimum Coverage Thresholds

The project requires minimum coverage of **70%** for all metrics:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Critical Path Coverage

Components and functions on critical paths should aim for **90%+ coverage**:
- Workflow execution
- Plugin management
- Data persistence
- Error handling
- Security-related code

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report in browser
# Windows
start coverage/index.html

# macOS
open coverage/index.html

# Linux
xdg-open coverage/index.html
```

## Best Practices

### 1. Test Organization

- **One test file per source file**: `plugin-manager.ts` → `__tests__/plugin-manager.test.ts`
- **Group related tests**: Use `describe` blocks to organize tests
- **Clear test names**: Use descriptive test names that explain the expected behavior

### 2. Test Independence

- **No shared state**: Each test should be independent
- **Clean up**: Use `beforeEach` and `afterEach` to reset state
- **No test order dependency**: Tests should pass in any order

### 3. Arrange-Act-Assert Pattern

```typescript
it('should calculate total correctly', () => {
  // Arrange - Set up test data
  const items = [1, 2, 3];

  // Act - Execute the function
  const total = calculateTotal(items);

  // Assert - Verify the result
  expect(total).toBe(6);
});
```

### 4. Test Edge Cases

- **Null/undefined**: Test with missing data
- **Empty collections**: Test with empty arrays/objects
- **Boundaries**: Test min/max values
- **Error conditions**: Test error handling

### 5. Use Meaningful Assertions

```typescript
// Good - Specific assertions
expect(result).toEqual({ id: 1, name: 'Test' });
expect(array).toHaveLength(3);
expect(element).toHaveTextContent('Expected text');

// Avoid - Vague assertions
expect(result).toBeTruthy();
expect(array.length > 0).toBe(true);
```

### 6. Mock External Dependencies

- **Mock file system**: Use `fs-extra` mocks
- **Mock network**: Mock axios or fetch calls
- **Mock Electron**: Use provided electron mocks
- **Mock timers**: Use `jest.useFakeTimers()` for time-dependent code

### 7. Avoid Implementation Details

```typescript
// Good - Test behavior
expect(screen.getByText('Submit')).toBeInTheDocument();
fireEvent.click(screen.getByText('Submit'));

// Avoid - Test implementation
expect(component.state.isSubmitting).toBe(true);
expect(component.handleSubmit).toHaveBeenCalled();
```

## Debugging Tests

### Running Single Test

```bash
# Run a specific test file
npm test -- plugin-manager.test.ts

# Run a specific test by name
npm test -- --testNamePattern="should load plugins"
```

### Debugging in VS Code

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
    "--testPathPattern=${fileBasenameNoExtension}"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen",
  "disableOptimisticBPs": true,
  "windows": {
    "program": "${workspaceFolder}/node_modules/jest/bin/jest"
  }
}
```

### Verbose Output

```bash
# Show all test output
npm test -- --verbose

# Show each test as it runs
npm test -- --verbose --no-coverage
```

### Debug Console Output

```typescript
// These are mocked by default, but you can unmock for debugging
console.log = jest.fn();  // Mocked
console.log.mockRestore(); // Restore for debugging
```

## Common Issues

### Issue: Module not found

**Solution**: Check `moduleNameMapper` in `jest.config.js` and ensure imports match.

### Issue: Unexpected token (CSS/images)

**Solution**: CSS and image imports are mocked. If you need specific mocks, update `styleMock.js` or `fileMock.js`.

### Issue: Cannot find module 'electron'

**Solution**: Ensure you're using the mock:
```typescript
jest.mock('electron', () => require('../__mocks__/electron'));
```

### Issue: Async test timeout

**Solution**: Increase timeout or ensure promises resolve:
```typescript
it('should complete', async () => {
  // ... test code
}, 10000); // 10 second timeout
```

### Issue: React Flow errors

**Solution**: Mock React Flow components as they require browser APIs not available in jsdom.

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-commit hooks (optional)

### CI Configuration

Tests must pass before merging:
```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test -- --coverage --ci
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library Documentation](https://testing-library.com/)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Contributing

When adding new features:
1. Write tests first (TDD approach recommended)
2. Ensure tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Add integration tests for new workflows
5. Update this guide if adding new testing patterns
