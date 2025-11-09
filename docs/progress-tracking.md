# Progress Tracking System

## Overview

The Progress Tracking system provides unified progress tracking for repository cloning, npm installs, builds, and Docker operations within the Electron application's setup wizard (Step 5).

## Architecture

### Core Components

1. **Type Definitions** (`src/types/progress.ts`)
   - Defines all progress-related interfaces and enums
   - Provides type safety across the entire progress tracking system

2. **Progress Aggregator** (`src/utils/progress-aggregator.ts`)
   - Combines multiple operation events into a unified view
   - Manages progress state and console output
   - Provides log export functionality

3. **Progress Tracker UI** (`src/renderer/progress-tracker.ts`)
   - Handles all UI updates for Step 5
   - Manages DOM elements and user interactions
   - Provides visual feedback for operations

## Type Definitions

### ProgressPhase Enum

```typescript
enum ProgressPhase {
  INITIALIZING = 'initializing',
  IN_PROGRESS = 'in_progress',
  COMPLETING = 'completing',
  COMPLETE = 'complete',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
```

### OperationType Enum

```typescript
enum OperationType {
  REPOSITORY_CLONE = 'repository_clone',
  NPM_INSTALL = 'npm_install',
  NPM_BUILD = 'npm_build',
  DOCKER_BUILD = 'docker_build',
  CUSTOM_SCRIPT = 'custom_script',
  DOWNLOAD = 'download',
  ENVIRONMENT_SETUP = 'environment_setup',
}
```

### Key Interfaces

- **ProgressEvent**: Base progress event with operation info and percentage
- **DetailedProgressEvent**: Extended progress event with step information
- **ConsoleOutputEvent**: Console output from operations (stdout/stderr)
- **ErrorEvent**: Error information with retry capability
- **OperationStartEvent**: Operation initialization event
- **OperationCompleteEvent**: Operation completion event
- **AggregatedProgress**: Combined progress state for multiple operations
- **OperationProgress**: Individual operation progress state

## Progress Aggregator

The `ProgressAggregator` class manages progress across multiple concurrent operations.

### Key Features

- **Operation Registration**: Track new operations as they start
- **Progress Updates**: Update operation progress with throttling
- **Console Output**: Capture and manage stdout/stderr output
- **Error Handling**: Record and manage operation errors
- **Time Estimation**: Estimate remaining time for operations
- **Log Export**: Export logs in multiple formats (TEXT, JSON, CSV, HTML)

### Usage Example

```typescript
import { createProgressAggregator } from '../utils/progress-aggregator';
import { OperationType, ProgressPhase } from '../types/progress';

// Create aggregator with callbacks
const aggregator = createProgressAggregator({
  onStart: (event) => console.log('Started:', event.name),
  onProgress: (event) => console.log('Progress:', event.percent),
  onComplete: (event) => console.log('Complete:', event.success),
  onError: (event) => console.error('Error:', event.message),
});

// Start an operation
aggregator.startOperation({
  operationId: 'npm-install-1',
  operationType: OperationType.NPM_INSTALL,
  name: 'Installing dependencies',
  timestamp: new Date(),
});

// Update progress
aggregator.updateProgress({
  operationId: 'npm-install-1',
  operationType: OperationType.NPM_INSTALL,
  phase: ProgressPhase.IN_PROGRESS,
  percent: 50,
  message: 'Installing packages...',
  timestamp: new Date(),
});

// Complete operation
aggregator.completeOperation({
  operationId: 'npm-install-1',
  operationType: OperationType.NPM_INSTALL,
  success: true,
  message: 'Installation complete',
  timestamp: new Date(),
  duration: 30000,
});

// Get aggregated state
const state = aggregator.getAggregatedProgress();
console.log('Overall progress:', state.overallPercent);
```

## Progress Tracker UI

The `ProgressTrackerUI` class manages the visual representation of progress in Step 5.

### UI Components

1. **Overall Progress Bar**
   - Shows combined progress across all operations
   - Displays percentage and current operation

2. **Build Steps List**
   - Shows all operations with individual progress
   - Status indicators (icons and colors)
   - Progress bars for active operations
   - Error messages for failed operations

3. **Console Output Panel**
   - Timestamped logs from all operations
   - Color-coded stdout/stderr output
   - Auto-scrolling to latest output
   - Clear and export functionality

4. **Error Display**
   - Shows error details when operations fail
   - Retry, Skip, and Cancel All buttons
   - Recoverable error indication

### Key Methods

- `updateOverallProgress(aggregated)`: Update overall progress display
- `updateOperation(operation)`: Add or update an operation in the list
- `addConsoleOutput(event)`: Add console output line
- `showError(event)`: Display error message
- `hideError()`: Hide error display
- `reset()`: Reset all UI elements

### Usage Example

```typescript
import { ProgressTrackerUI } from './progress-tracker';
import { ProgressPhase, OperationType } from '../types/progress';

// Create UI instance
const ui = new ProgressTrackerUI();

// Update an operation
ui.updateOperation({
  operationId: 'build-1',
  operationType: OperationType.NPM_BUILD,
  name: 'Building application',
  phase: ProgressPhase.IN_PROGRESS,
  percent: 75,
  message: 'Compiling TypeScript...',
  startTime: new Date(),
});

// Add console output
ui.addConsoleOutput({
  operationId: 'build-1',
  timestamp: new Date(),
  stream: 'stdout',
  content: 'Successfully compiled 42 files',
});

// Show error
ui.showError({
  operationId: 'build-1',
  timestamp: new Date(),
  message: 'Build failed: Type error in main.ts',
  error: new Error('Type error'),
  recoverable: true,
  retryAction: 'Fix the type error and retry',
});
```

## Integration with Setup Wizard

The progress tracking system is integrated into Setup Wizard Step 5 (`initializeDownloadStep` function).

### Flow

1. **Initialization**: Create or reset ProgressTrackerUI instance
2. **Operation Planning**: Build list of operations to perform
3. **Execution**: Execute operations sequentially or in parallel
4. **Progress Updates**: Update UI as operations progress
5. **Completion**: Show completion message or error

### Example Integration

```typescript
async function initializeDownloadStep() {
  // Initialize UI
  if (!progressTrackerUI) {
    progressTrackerUI = new ProgressTrackerUI();
  } else {
    progressTrackerUI.reset();
  }

  // Define operations
  const operations = [
    { id: 'download-1', type: OperationType.DOWNLOAD, name: 'Downloading component' },
    { id: 'docker-1', type: OperationType.DOCKER_BUILD, name: 'Building Docker image' },
  ];

  // Execute operations with progress tracking
  for (const op of operations) {
    await executeOperationWithProgress(op);
  }
}
```

## Error Handling

### Recoverable Errors

Errors marked as `recoverable: true` allow users to:
- **Retry**: Attempt the operation again
- **Skip**: Skip the failed operation and continue
- **Cancel All**: Stop all remaining operations

### Non-Recoverable Errors

Errors marked as `recoverable: false` only allow:
- **Cancel All**: Stop and exit the setup process

## Log Export

Users can export logs in multiple formats:

- **TEXT**: Plain text format with timestamps
- **JSON**: Structured JSON format
- **CSV**: Comma-separated values format
- **HTML**: Formatted HTML with styling

### Export Example

```typescript
const logs = aggregator.exportLogs({
  format: LogExportFormat.HTML,
  operationType: OperationType.NPM_BUILD, // Optional filter
  severity: ProgressSeverity.ERROR,       // Optional filter
  includeConsoleOutput: true,
});

// Save to file or display to user
```

## Future Enhancements

1. **Real-time Progress Streaming**: Use WebSockets for real-time updates
2. **Operation Parallelization**: Support concurrent operations with dependency management
3. **Progress Persistence**: Save and restore progress state across restarts
4. **Enhanced Time Estimation**: Machine learning-based time predictions
5. **Custom Operation Types**: Allow plugins to define custom operation types
6. **Progress Notifications**: Desktop notifications for completed operations
7. **Progress Charts**: Visual charts showing operation timeline

## API Reference

### Progress Events

All progress events should follow these conventions:

1. **Unique Operation IDs**: Each operation must have a unique identifier
2. **Timestamp All Events**: Include timestamps for accurate tracking
3. **Meaningful Messages**: Provide clear, user-friendly progress messages
4. **Accurate Percentages**: Ensure percentages are between 0-100
5. **Phase Transitions**: Follow the correct phase progression

### Best Practices

1. **Throttle Updates**: Use the aggregator's built-in throttling (default 100ms)
2. **Limit Console Output**: Keep console output lines under 1000 (configurable)
3. **Handle Errors Gracefully**: Always provide error context and retry information
4. **Clean Up Resources**: Remove event listeners when operations complete
5. **Test Error Scenarios**: Ensure error handling works for all edge cases

## Testing

### Unit Tests

Test individual components:
- ProgressAggregator logic
- ProgressTrackerUI methods
- Event handling and callbacks

### Integration Tests

Test the complete flow:
- Multiple concurrent operations
- Error scenarios and recovery
- Log export functionality

### UI Tests

Test visual components:
- Progress bar animations
- Console output display
- Error message display
- Button interactions

## Troubleshooting

### Progress Not Updating

1. Check that operation IDs are consistent across events
2. Verify event listeners are properly attached
3. Ensure percentages are within valid range (0-100)
4. Check for throttling interval (may delay updates)

### Console Output Not Showing

1. Verify `captureConsoleOutput` is enabled
2. Check console output element exists in DOM
3. Ensure events have correct stream ('stdout' or 'stderr')
4. Check maximum console lines limit

### Errors Not Displaying

1. Verify error event includes required fields
2. Check error display element exists in DOM
3. Ensure `showError()` is called with valid event
4. Check console for JavaScript errors

## Support

For issues or questions about the progress tracking system:

1. Check this documentation
2. Review example code in `src/renderer/setup-wizard-handlers.ts`
3. Examine type definitions in `src/types/progress.ts`
4. Submit an issue on the project repository
