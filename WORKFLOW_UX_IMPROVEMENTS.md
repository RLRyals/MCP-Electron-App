# Workflow UX Improvements Summary

## Issues Fixed

### 1. ✅ Workflow Execution Stopping on Node Failure
**Problem**: When a workflow node failed (e.g., Claude CLI not available), the entire workflow stopped instead of continuing to the next node.

**Solution**: Added `continueOnError` flag support to workflow nodes in [workflow-executor.ts:663-697](src/main/workflow/workflow-executor.ts#L663-L697).

**Usage**:
```json
{
  "id": "some-node-id",
  "type": "planning",
  "name": "Process with AI",
  "continueOnError": true,  // <-- Add this to make node optional
  ...
}
```

When a node has `continueOnError: true`:
- If it fails, the workflow logs a warning but continues to the next node
- The node is still added to `completedNodes` for tracking
- Errors are displayed in the terminal with ⚠️ prefix

### 2. ✅ Error Display in Terminal
**Problem**: Workflow errors weren't being shown in the terminal panel.

**Solution**: Added `workflow:log` event listener to [TerminalPanel.tsx:228-258](src/renderer/components/TerminalPanel.tsx#L228-L258).

**Features**:
- Color-coded log levels:
  - 🔴 Red for errors
  - 🟡 Yellow for warnings
  - 🔵 Cyan for info
  - ⚫ Gray for debug
- Timestamps on all messages
- Supports emoji prefixes (✓, ✗, ⚠)

### 3. ✅ Visual Error Indicators on Canvas Nodes
**Status**: Already existed in [PhaseNode.tsx:52-62](src/renderer/components/nodes/PhaseNode.tsx#L52-L62).

**Features**:
- Nodes change border color based on status:
  - 🟢 Green = completed
  - 🔵 Blue = in_progress
  - 🔴 Red = failed
  - ⚪ Gray = pending
- Failed nodes show red border and "FAILED" status badge

### 4. ✅ Fixed MCP 500 Errors
**Problem**: LibraryView was querying `outlines` and `drafts` tables that don't exist in the database.

**Solution**: Commented out these queries in [LibraryView.ts:112-119](src/renderer/views/LibraryView.ts#L112-L119) with TODO to add them to the database schema later.

## Issues Requiring More Work

### 1. ⚠️ Tab Switching Resets Workflow State
**Problem**: When you switch tabs and return to Workflows, the terminal resets and workflow state is lost.

**Root Cause**: The TerminalPanel React component unmounts/remounts when switching views, even though the underlying PTY terminal is a singleton.

**Potential Solutions**:
1. Keep TerminalPanel mounted at app level (not view level)
2. Store workflow execution state in a global state manager
3. Reconnect terminal to existing PTY session on mount

**Recommendation**: This needs architectural changes to the view router system.

### 2. ❌ No UI for Viewing/Editing Agents and Skills
**Problem**: Non-technical users can't discover what agents or skills are available.

**Needed**:
- [ ] Agents library view (list all available agents)
- [ ] Skills library view (list all available skills)
- [ ] Import agent/skill wizard
- [ ] Agent/skill editor with validation

**Recommendation**: Create a new "Resources" tab with sub-tabs for Agents, Skills, and Plugins.

### 3. ❌ No Agent/Skill Dropdowns in Node Dialog
**Problem**: When editing a workflow node, users must manually type agent/skill names.

**Needed**:
- [ ] Dropdown list of available agents
- [ ] Dropdown list of available skills
- [ ] Filter/search in dropdowns
- [ ] Preview/description of selected agent/skill

**Recommendation**: Update the node editing dialog to fetch and display available options.

### 4. ❌ No Claude CLI Setup Helper
**Problem**: Error message "Claude Code CLI not found" isn't helpful for non-technical users.

**Needed**:
- [ ] Detect if Claude CLI is installed
- [ ] Show installation wizard if not found
- [ ] Platform-specific installation instructions (Windows/Mac/Linux)
- [ ] Verify installation after setup
- [ ] Option to use alternative providers (Claude API, OpenAI, etc.)

**Recommendation**: Create a setup wizard that runs on first launch or when Claude CLI errors occur.

## Claude CLI Installation (Manual)

Since the Claude CLI isn't currently available via npm, here are manual setup instructions:

### Windows (Current Environment)
```powershell
# Option 1: Install via npm (if/when available)
npm install -g @anthropic-ai/claude-code

# Option 2: Use Claude API provider instead
# Configure in workflow node:
{
  "provider": {
    "type": "claude-api",
    "config": {
      "apiKey": "your-api-key-here",
      "model": "claude-sonnet-4-5"
    }
  }
}
```

### Alternative: Configure Different LLM Provider

Edit your workflow to use a different provider:

**Claude API**:
```json
{
  "provider": {
    "type": "claude-api",
    "config": {
      "apiKey": "${ANTHROPIC_API_KEY}",
      "model": "claude-sonnet-4-5"
    }
  }
}
```

**OpenAI**:
```json
{
  "provider": {
    "type": "openai",
    "config": {
      "apiKey": "${OPENAI_API_KEY}",
      "model": "gpt-4"
    }
  }
}
```

**Local LLM (Ollama)**:
```json
{
  "provider": {
    "type": "local",
    "config": {
      "baseUrl": "http://localhost:11434",
      "model": "llama3"
    }
  }
}
```

## Next Steps

1. **Immediate**: Test the fixes by running `npm run dev`
2. **Short-term**: Add setup wizard for LLM providers
3. **Medium-term**: Create Resources tab with agents/skills library
4. **Long-term**: Fix tab switching state persistence

## Files Modified

- [src/main/workflow/workflow-executor.ts](src/main/workflow/workflow-executor.ts#L663-L697) - Added `continueOnError` support
- [src/renderer/components/TerminalPanel.tsx](src/renderer/components/TerminalPanel.tsx#L228-L258) - Added workflow log display
- [src/renderer/views/LibraryView.ts](src/renderer/views/LibraryView.ts#L112-L119) - Fixed MCP errors
