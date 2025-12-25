# Agent and Skill Editing from Workflow Canvas

## Overview
Enhanced the workflow editing experience to allow editing agent and skill markdown files directly from the workflow canvas. Users can now click "Edit" buttons next to agent and skill fields in the phase editor to open and modify the underlying markdown files.

## New Features

### 1. Edit Agent Files
- **Edit button** appears next to the Agent field when an agent is specified
- Click to open full markdown editor for the agent file
- Located in `{userData}/agents/{agent-name}.md`
- Auto-saves to the correct location

### 2. Edit Skill Files
- **Edit button** appears next to the Skill field when a skill is specified
- Click to open full markdown editor for the skill file
- Supports both skill formats:
  - Single file: `~/.claude/skills/{skill-name}.md`
  - Directory: `~/.claude/skills/{skill-name}/SKILL.md`
- Auto-detects which format is in use

### 3. Full-Featured Markdown Editor
- Large, full-screen editing area
- Syntax highlighting-ready (monospace font)
- Unsaved changes indicator
- Keyboard shortcuts (Ctrl+S to save, Esc to cancel)
- Confirmation dialog if closing with unsaved changes
- File path display for reference

## Components

### 1. PhaseEditDialog (Enhanced)
Location: `src/renderer/components/dialogs/PhaseEditDialog.tsx`

**New Props:**
```typescript
interface PhaseEditDialogProps {
  // ... existing props
  onEditAgent?: (agentName: string) => void;
  onEditSkill?: (skillName: string) => void;
}
```

**UI Changes:**
- Agent and Skill fields now have a flex layout with "📝 Edit" button
- Edit button only appears when field has a value
- Styled with purple accent color for consistency

### 2. DocumentEditDialog (New)
Location: `src/renderer/components/dialogs/DocumentEditDialog.tsx`

**Purpose:** Unified editor for both agents and skills

**Features:**
- Large textarea with monospace font
- File path displayed in header
- Type-specific icons (🤖 for agents, ⚙️ for skills)
- Unsaved changes tracking
- Keyboard shortcuts
- Confirmation on close with unsaved changes

**Props:**
```typescript
interface DocumentEditDialogProps {
  type: 'agent' | 'skill';
  name: string;
  content: string;
  filePath: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}
```

### 3. WorkflowCanvas (Enhanced)
Location: `src/renderer/components/WorkflowCanvas.tsx`

**New State:**
```typescript
const [editingDocument, setEditingDocument] = useState<{
  type: 'agent' | 'skill';
  name: string;
  content: string;
  filePath: string;
} | null>(null);
```

**New Handlers:**
- `handleEditAgent(agentName)` - Loads agent file and opens editor
- `handleEditSkill(skillName)` - Loads skill file and opens editor
- `handleSaveDocument(content)` - Saves changes back to file

## Backend Integration

### IPC Handlers
Location: `src/main/index.ts` (lines ~2666-2770)

#### Read Agent File
```typescript
ipcMain.handle('document:read-agent', async (_event, agentName: string)
```
- Reads from `{userData}/agents/{agent-name}.md`
- Returns: `{ content: string, filePath: string }`

#### Write Agent File
```typescript
ipcMain.handle('document:write-agent', async (_event, agentName: string, content: string)
```
- Writes to `{userData}/agents/{agent-name}.md`
- Returns: `{ success: boolean, filePath: string }`

#### Read Skill File
```typescript
ipcMain.handle('document:read-skill', async (_event, skillName: string)
```
- Tries both skill formats:
  1. `~/.claude/skills/{skill-name}.md`
  2. `~/.claude/skills/{skill-name}/SKILL.md`
- Returns: `{ content: string, filePath: string }`

#### Write Skill File
```typescript
ipcMain.handle('document:write-skill', async (_event, skillName: string, content: string, filePath?: string)
```
- Uses provided filePath or auto-detects format
- Preserves existing format (single file vs directory)
- Returns: `{ success: boolean, filePath: string }`

## User Flow

### Editing an Agent

1. **Open Phase Editor:**
   - Double-click a workflow node OR click the ✏️ button

2. **Click Edit Agent:**
   - Type or select an agent name in the Agent field
   - Click the "📝 Edit" button that appears next to the field

3. **Edit in Full-Screen Editor:**
   - Large markdown editor opens with current agent content
   - File path shown in header (e.g., `C:\Users\...\agents\market-research-agent.md`)
   - Make changes to the markdown

4. **Save Changes:**
   - Press `Ctrl+S` or click "Save Changes"
   - Changes persist immediately to file
   - Editor closes automatically

5. **Continue Editing Phase:**
   - Back to phase editor
   - Make other changes if needed
   - Save phase changes

### Editing a Skill

Same flow as agents, but:
- Click "📝 Edit" next to Skill field
- File path shows `~/.claude/skills/...` location
- Supports both single-file and directory formats

## File Locations

### Agents
- **Format:** Single markdown file
- **Location:** `{userData}/agents/{agent-name}.md`
- **Example:** `C:\Users\YourName\AppData\Roaming\mcp-electron-app\agents\market-research-agent.md`

### Skills
- **Format 1 (Single File):**
  - Location: `~/.claude/skills/{skill-name}.md`
  - Example: `C:\Users\YourName\.claude\skills\market-driven-planning-skill.md`

- **Format 2 (Directory):**
  - Location: `~/.claude/skills/{skill-name}/SKILL.md`
  - Example: `C:\Users\YourName\.claude\skills\market-driven-planning-skill\SKILL.md`

The system auto-detects which format exists and uses it.

## Error Handling

### File Not Found
If an agent or skill file doesn't exist:
- Error alert shown to user
- Console error logged
- Editor doesn't open
- User can create file manually or fix the name

### Permission Errors
If file cannot be written:
- Error alert shown to user
- Changes not saved
- Editor remains open with content
- User can retry or copy content

### Missing Electron API
If running outside Electron context:
- Console error logged
- No edit buttons appear
- Graceful degradation

## Keyboard Shortcuts

### In Document Editor
- **Ctrl+S** (or Cmd+S on Mac): Save and close
- **Esc**: Cancel (confirms if unsaved changes)

### In Phase Editor
- **Ctrl+Enter**: Save phase changes
- **Esc**: Cancel phase editing

## UI/UX Details

### Visual Feedback
- **Unsaved changes:** Orange indicator "● Unsaved changes" in footer
- **Saving:** Button text changes to "Saving..."
- **Edit button:** Purple accent (#6366f1) to distinguish from other actions

### Responsiveness
- Document editor: 90vw × 85vh (responsive to screen size)
- Large textarea for comfortable editing
- Monospace font for markdown readability

### z-index Layering
- Phase Edit Dialog: z-index 2000
- Document Edit Dialog: z-index 3000 (appears above phase editor)

## Testing

### Manual Test Steps

1. **Test Agent Editing:**
   ```
   - Open workflow canvas
   - Double-click a phase node
   - Enter agent name (e.g., "market-research-agent")
   - Click "📝 Edit" button
   - Verify markdown editor opens with content
   - Make a change, save
   - Close phase editor
   - Reopen and edit again - verify changes persisted
   ```

2. **Test Skill Editing:**
   ```
   - Open workflow canvas
   - Double-click a phase node
   - Enter skill name (e.g., "market-driven-planning-skill")
   - Click "📝 Edit" button next to Skill field
   - Verify markdown editor opens
   - Check file path matches skill location
   - Make changes, save
   - Verify changes persisted
   ```

3. **Test Unsaved Changes Warning:**
   ```
   - Open agent/skill editor
   - Make changes
   - Press Esc or click Cancel
   - Verify confirmation dialog appears
   - Click Cancel on confirmation
   - Verify editor stays open
   - Click OK on confirmation
   - Verify editor closes without saving
   ```

4. **Test Non-Existent Files:**
   ```
   - Enter a non-existent agent name
   - Click Edit
   - Verify error message appears
   - Verify editor doesn't open
   ```

## Integration Points

### Parent Components
Any component using WorkflowCanvas must pass:
```typescript
<WorkflowCanvas
  workflow={workflow}
  availableWorkflows={workflows}
  onWorkflowChange={handleWorkflowChange}
  onOpenSubWorkflow={handleOpenSubWorkflow}
/>
```

No additional props needed for document editing - it's fully integrated.

### Phase Save Flow
1. User edits phase (including agent/skill names)
2. User optionally clicks Edit to modify agent/skill files
3. User saves phase changes
4. Phase updates trigger workflow update
5. Workflow cache invalidated
6. UI refreshes with new data

## Future Enhancements

1. **Syntax Highlighting:** Add CodeMirror or Monaco editor
2. **Preview Mode:** Markdown preview alongside editor
3. **Create New Files:** Button to create new agent/skill if doesn't exist
4. **Search & Replace:** Find/replace within document
5. **Recent Edits:** Show recently edited agents/skills
6. **Validation:** Check markdown structure on save
7. **Templates:** Quick-start templates for new agents/skills
8. **Version Control:** Git integration for agent/skill changes

## Files Modified/Created

### Created
- ✅ `src/renderer/components/dialogs/DocumentEditDialog.tsx`

### Modified
- ✅ `src/renderer/components/dialogs/PhaseEditDialog.tsx`
- ✅ `src/renderer/components/WorkflowCanvas.tsx`
- ✅ `src/main/index.ts` (IPC handlers)

## Known Limitations

1. **No Concurrent Editing:** If same file opened in multiple editors, last save wins
2. **No Auto-Save:** Must manually save (Ctrl+S)
3. **No Undo/Redo:** Browser's native undo only
4. **Large Files:** Performance may degrade with very large markdown files
5. **Format Detection:** Skills only - may fail if both formats exist

## Troubleshooting

### Edit Button Doesn't Appear
- Ensure agent/skill field has a value
- Check that WorkflowCanvas received `onWorkflowChange` prop
- Verify Electron API is available

### File Save Fails
- Check file permissions
- Verify directory exists
- Check disk space
- Look at console for detailed error

### Changes Don't Persist
- Ensure you clicked Save (not just closed editor)
- Check file permissions
- Verify file path in editor header
- Check console for save errors

---

**Complete!** You can now edit agents and skills directly from the workflow canvas without leaving the app.
