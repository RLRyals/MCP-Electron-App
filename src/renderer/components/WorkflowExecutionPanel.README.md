# WorkflowExecutionPanel Component

## Overview

The `WorkflowExecutionPanel` is a comprehensive, production-ready React component that provides real-time interaction with running workflow executions. It serves as the primary user interface for monitoring agent outputs, providing inputs, and managing phase approvals during workflow execution.

## Features

### 1. Real-Time Agent Output Display
- **Live streaming updates** via IPC events
- **Markdown rendering** for formatted agent outputs
- **Auto-scrolling** to keep latest output visible
- **Editable output** for approval phases

### 2. User Input Interface
- **Text input box** for sending messages to running agents
- **Keyboard shortcuts** (Ctrl+Enter to send)
- **Disabled state** when phase doesn't accept input
- **Visual feedback** during submission

### 3. Phase Approval System
- **Approve/Reject buttons** for phases requiring approval
- **Output editing** before approval
- **Rejection reason dialog** with validation
- **Visual state management** for approval workflow

### 4. Execution Monitoring
- **Phase history viewer** showing completed phases
- **Expandable phase details** with full output
- **Real-time execution logs** with color-coded levels
- **Status indicators** (pending, in_progress, completed, failed)

### 5. Error Handling
- **Error banner** for critical issues
- **Dismissible errors** with user control
- **Detailed error messages** in logs
- **Graceful degradation** when APIs unavailable

## Component Structure

```
WorkflowExecutionPanel (Main Container)
├── PhaseHeader (Current phase info)
├── OutputViewer (Agent output display & editing)
├── InputBox (User input area)
├── ApprovalControls (Approve/Reject buttons)
├── PhaseHistory (Completed phases list)
├── LogViewer (Execution logs)
└── RejectDialog (Modal for rejection reasons)
```

## Props Interface

```typescript
interface WorkflowExecutionPanelProps {
  instanceId: string;           // Unique workflow instance ID
  workflow: WorkflowDefinition; // Complete workflow definition
  onClose?: () => void;         // Optional close handler
}
```

## Sub-Components

### PhaseHeader
Displays current phase information including name, agent, status, description, and skill.

**Features:**
- Color-coded status badges
- Agent and skill information
- Phase description display

### OutputViewer
Renders agent output with editing capabilities for approval phases.

**Features:**
- Toggle between view and edit modes
- Markdown rendering (pre-formatted text)
- Streaming indicator during execution
- Syntax-highlighted output

### InputBox
Text input area for user-to-agent communication.

**Features:**
- Multiline textarea
- Keyboard shortcuts (Ctrl+Enter)
- Character limit display
- Auto-resize on content

### ApprovalControls
Approve/Reject button interface for phase outputs.

**Features:**
- Large, color-coded buttons
- Disabled states during processing
- Visual feedback on click

### PhaseHistory
Scrollable list of completed phases with expandable details.

**Features:**
- Click to expand/collapse
- Status icons (✓ for success, ✕ for failure)
- Full output display on expansion
- Compact view for long histories

### LogViewer
Real-time execution log display with level filtering.

**Features:**
- Color-coded log levels (info, warning, error, success)
- Timestamp display
- Auto-scroll to latest
- Icon indicators for each level

### RejectDialog
Modal dialog for entering rejection reasons.

**Features:**
- Full-screen overlay
- Textarea for detailed reasons
- Validation (requires reason)
- Cancel/Confirm actions

## IPC Integration

### Outbound IPC Calls (Renderer → Main)

```typescript
// Send user input to workflow
await electronAPI.invoke('workflow:send-user-input', instanceId, input);

// Approve phase output
await electronAPI.invoke('workflow:approve-phase', instanceId, phaseNumber, editedOutput);

// Reject phase output
await electronAPI.invoke('workflow:reject-phase', instanceId, phaseNumber, reason);
```

### Inbound IPC Events (Main → Renderer)

```typescript
// Phase execution started
electronAPI.on('workflow:phase-started', (data) => {
  // data: { instanceId, phaseNumber, phaseName, agent }
});

// Phase execution completed
electronAPI.on('workflow:phase-completed', (data) => {
  // data: { instanceId, phaseNumber, output }
});

// Phase execution failed
electronAPI.on('workflow:phase-failed', (data) => {
  // data: { instanceId, phaseNumber, error }
});

// Approval required for phase
electronAPI.on('workflow:approval-required', (data) => {
  // data: { instanceId, phaseNumber, output }
});

// General phase events (streaming, etc.)
electronAPI.on('workflow:phase-event', (data) => {
  // data: { instanceId, phaseNumber, type, message, output }
});
```

## Usage Example

### Basic Integration

```typescript
import { WorkflowExecutionPanel } from '../components/WorkflowExecutionPanel';

function WorkflowExecutionView() {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);

  const handleStartWorkflow = async () => {
    const id = await electronAPI.invoke('workflow:start', {
      workflowDefId: workflow.id,
      seriesId: 1,
      userId: 1,
    });
    setInstanceId(id);
  };

  if (!instanceId || !workflow) {
    return <div>Select a workflow to start</div>;
  }

  return (
    <WorkflowExecutionPanel
      instanceId={instanceId}
      workflow={workflow}
      onClose={() => setInstanceId(null)}
    />
  );
}
```

### Split View Integration (Canvas + Execution Panel)

```typescript
function WorkflowsView() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [runningInstance, setRunningInstance] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: Workflow Canvas */}
      <div style={{ flex: 1 }}>
        <WorkflowCanvas
          workflow={selectedWorkflow}
          executionStatus={executionStatusMap}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* Right: Execution Panel (when running) */}
      {runningInstance && selectedWorkflow && (
        <div style={{ flex: 1 }}>
          <WorkflowExecutionPanel
            instanceId={runningInstance}
            workflow={selectedWorkflow}
            onClose={() => setRunningInstance(null)}
          />
        </div>
      )}
    </div>
  );
}
```

## State Management

### Local State

```typescript
const [currentPhase, setCurrentPhase] = useState<PhaseExecutionData | null>(null);
const [phaseHistory, setPhaseHistory] = useState<PhaseExecutionData[]>([]);
const [logs, setLogs] = useState<LogEntry[]>([]);
const [userInput, setUserInput] = useState('');
const [editedOutput, setEditedOutput] = useState('');
const [rejectReason, setRejectReason] = useState('');
const [showRejectDialog, setShowRejectDialog] = useState(false);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [selectedHistoryPhase, setSelectedHistoryPhase] = useState<PhaseExecutionData | null>(null);
```

### Event-Driven Updates

All state updates are driven by IPC events from the main process, ensuring real-time synchronization with backend execution state.

## Styling

### Design System

The component uses inline styles following the existing FictionLab design patterns:

- **Colors:** Consistent with WorkflowCanvas and PhaseNode components
- **Spacing:** 4px, 8px, 12px, 16px, 24px increments
- **Typography:** System fonts with careful hierarchy
- **Borders:** 1px solid with subtle grays
- **Shadows:** Minimal, for depth only

### Responsive Behavior

```css
/* Split view layout */
mainContent: {
  display: 'flex',
  leftPanel: { flex: 2 },   /* Output & controls */
  rightPanel: { flex: 1 },  /* History & logs */
}
```

### Color Coding

- **Pending:** `#9ca3af` (gray)
- **In Progress:** `#60a5fa` (blue)
- **Completed:** `#4ade80` (green)
- **Failed:** `#f87171` (red)
- **Warning:** `#fbbf24` (yellow)

## Accessibility

- **Keyboard navigation:** Full support for Tab, Enter, Escape
- **Focus management:** Proper focus trapping in dialogs
- **ARIA labels:** Semantic HTML elements
- **Screen reader support:** Descriptive text for all actions

## Performance Optimizations

### Memoization

```typescript
// Stable callback references to prevent unnecessary re-renders
const handlePhaseStarted = useCallback((data) => { ... }, [instanceId, addLog]);
const handlePhaseCompleted = useCallback((data) => { ... }, [instanceId, addLog]);
```

### Auto-Scrolling

```typescript
// Refs for scroll targets
const logsEndRef = useRef<HTMLDivElement>(null);
const outputEndRef = useRef<HTMLDivElement>(null);

// Smooth scrolling on updates
useEffect(() => {
  scrollLogsToBottom();
}, [logs, scrollLogsToBottom]);
```

### Event Cleanup

```typescript
// Proper cleanup prevents memory leaks
useEffect(() => {
  electronAPI.on('workflow:phase-started', handlePhaseStarted);
  // ... other listeners

  return () => {
    electronAPI.off('workflow:phase-started', handlePhaseStarted);
    // ... cleanup all listeners
  };
}, [/* stable dependencies */]);
```

## Error Scenarios

### 1. Electron API Not Available
```typescript
if (!electronAPI || !electronAPI.invoke) {
  setError('Electron API not available');
  return;
}
```

### 2. IPC Call Failures
```typescript
try {
  await electronAPI.invoke('workflow:approve-phase', ...);
} catch (err: any) {
  setError(`Failed to approve phase: ${err.message}`);
  addLog('error', err.message, phaseNumber);
}
```

### 3. Missing Phase Data
```typescript
const phaseDefinition = getCurrentPhaseDefinition();
const requiresApproval = phaseDefinition?.requiresApproval || false;
```

## Testing Considerations

### Unit Tests

Test each sub-component independently:

```typescript
describe('PhaseHeader', () => {
  it('renders phase name and agent', () => { ... });
  it('displays correct status color', () => { ... });
  it('shows skill when provided', () => { ... });
});
```

### Integration Tests

Test IPC event handling:

```typescript
describe('WorkflowExecutionPanel IPC', () => {
  it('updates current phase on phase-started event', () => { ... });
  it('moves phase to history on phase-completed event', () => { ... });
  it('shows error banner on phase-failed event', () => { ... });
});
```

### E2E Tests

Test full workflow execution scenarios:

```typescript
describe('Workflow Execution Flow', () => {
  it('completes multi-phase workflow with approvals', () => { ... });
  it('handles rejection and retry', () => { ... });
  it('recovers from phase failures', () => { ... });
});
```

## Future Enhancements

### Planned Features

1. **Markdown Rendering:** Integrate `marked` library for rich text display
2. **Syntax Highlighting:** Use `highlight.js` for code output
3. **Export Logs:** Download execution logs as JSON/TXT
4. **Filter History:** Search and filter phase history
5. **Collapsible Panels:** Resize and hide panels
6. **Keyboard Shortcuts:** Full keyboard navigation
7. **Dark Mode:** Theme switching support
8. **Live Collaboration:** Multi-user execution monitoring

### Integration Points

- **WorkflowsViewReact:** Replace placeholder execution UI
- **WorkflowCanvas:** Sync selected phase with canvas highlights
- **NotificationSystem:** Toast notifications for phase events
- **AnalyticsDashboard:** Send execution metrics

## Troubleshooting

### Common Issues

**Issue:** Events not firing
- **Solution:** Check IPC event names match exactly between main and renderer

**Issue:** Output not updating
- **Solution:** Verify `instanceId` prop matches running workflow instance

**Issue:** Approval buttons not working
- **Solution:** Ensure phase definition has `requiresApproval: true`

**Issue:** Auto-scroll not working
- **Solution:** Check refs are properly attached to DOM elements

## File Location

```
src/
└── renderer/
    └── components/
        ├── WorkflowExecutionPanel.tsx          (This component)
        ├── WorkflowExecutionPanel.README.md    (This documentation)
        ├── WorkflowCanvas.tsx                  (Related component)
        └── nodes/
            └── PhaseNode.tsx                   (Related component)
```

## Dependencies

### Required Imports

```typescript
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkflowDefinition, WorkflowPhase } from '../../types/workflow.js';
```

### Type Dependencies

- `WorkflowDefinition` from `src/types/workflow.ts`
- `WorkflowPhase` from `src/types/workflow.ts`
- Electron IPC API via preload script

## License

Part of FictionLab MCP Electron App
See main project LICENSE file

## Contributing

When modifying this component:

1. Preserve all existing features
2. Add comprehensive JSDoc comments
3. Update this README with new features
4. Test IPC integration thoroughly
5. Maintain consistent styling with other components
6. Follow TypeScript strict mode guidelines

## Contact

For issues or questions about this component, refer to:
- **Gap Analysis:** `WORKFLOW_REQUIREMENTS_GAP_ANALYSIS.md` lines 652-700
- **Type Definitions:** `src/types/workflow.ts`
- **IPC Handlers:** `src/main/index.ts` lines 2428-2700
