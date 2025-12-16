# FictionLab → Antigravity Workflow Export Guide

**Version:** 1.0
**Date:** 2025-12-16
**Status:** Implemented

---

## Overview

The Antigravity Workflow Export feature allows you to convert complex FictionLab workflows into Google Antigravity-compatible workflow files. This enables you to use FictionLab's sophisticated workflow designs in any Antigravity environment while maintaining integration with FictionLab MCP servers.

## Key Features

✅ **Automatic Splitting** - Workflows are intelligently split at quality gates and human approval points
✅ **MCP Integration** - Database operations reference FictionLab MCP tools
✅ **Workflow Continuity** - Each segment includes instructions for the next step
✅ **Multimodal Support** - Works with image generation and other multimodal workflows
✅ **Quality Gates** - Validation points are preserved with clear pass/fail criteria
✅ **Human Review** - Approval checkpoints stop workflow for user input
✅ **Installation Guide** - Auto-generated setup instructions included
✅ **Preview Mode** - See export results without writing files

---

## How It Works

### 1. Workflow Segmentation

FictionLab workflows are split into segments at:
- **Quality Gates** - Phases with validation requirements
- **Human Approval Points** - Phases requiring user review

Each segment becomes a separate Antigravity workflow file.

### Example:

```
Original Workflow (10 phases)
├── Phase 0-2: Planning & Concept
├── Phase 3: [Human Review Gate] ← SPLIT HERE
├── Phase 4-6: Image Generation & Quality Check
├── Phase 7: [Quality Gate] ← SPLIT HERE
├── Phase 8: Typography
└── Phase 9: [Final Approval] ← SPLIT HERE
    └── Phase 10: Export

Exported Workflows:
1. workflow-1-planning-concept.md (Phases 0-3)
2. workflow-2-image-generation.md (Phases 4-7)
3. workflow-3-typography.md (Phases 8-9)
4. workflow-4-export.md (Phase 10)
```

### 2. File Format

Each exported workflow file follows Antigravity's format:

```markdown
---
description: Workflow: Phase Name through Phase Name
---

## Prerequisites

This workflow requires the following MCP servers:
- series-planning-server
- visual-assets-server

---

## Step 1: Phase Name

**Agent:** agent-name
**Skill:** skill-name

[Phase description]

**Process:**
1. Step one
2. Step two
3. Step three

**Database Operations:**
Use the following MCP tools:
- `series-planning-server` tools for data operations

**Expected Output:**
Description of what this phase produces

---

## After Review

Once you've reviewed and approved the output, continue with:
`/workflow-2-next-phase`

This will begin: **Next Phase Name**
```

### 3. MCP Server Integration

Database operations are converted to MCP tool references:

**FictionLab Workflow Phase:**
```yaml
mcp: series-planning-server (read book metadata), visual-assets-server (store images)
```

**Antigravity Workflow Output:**
```markdown
**Database Operations:**
Use the following MCP tools:
- `series-planning-server` tools for data operations
- `visual-assets-server` tools for data operations

Read book metadata, store generated images
```

---

## Usage

### Method 1: From Workflow File

```typescript
import { WorkflowParser } from './parsers/workflow-parser';
import { AntigravityWorkflowExporter } from './exporters/antigravity-workflow-exporter';

// Parse workflow file (YAML, JSON, or HTML)
const parser = new WorkflowParser();
const workflow = await parser.parseWorkflow('./workflows/my-workflow.yaml');

// Export to Antigravity format
const exporter = new AntigravityWorkflowExporter();
const result = await exporter.exportWorkflow(workflow, './output/antigravity');

console.log(`Created ${result.workflows.length} workflow files`);
```

### Method 2: From Database

```typescript
// Via IPC from renderer process
const result = await window.electron.invoke('export:antigravity', workflowId, outputDir);

console.log(`Exported ${result.workflowCount} workflows to ${result.outputDir}`);
```

### Method 3: Preview Without Exporting

```typescript
// Preview export without writing files
const preview = await exporter.previewExport(workflow);

console.log('Workflow chain:', preview.workflowChain);
preview.workflows.forEach(wf => {
  console.log(`${wf.filename}: ${wf.size} chars`);
});
```

---

## IPC Handlers

### `export:antigravity`

Export a workflow from the database.

```typescript
await window.electron.invoke('export:antigravity', workflowId, outputDir?)
```

**Parameters:**
- `workflowId` (string) - Database workflow ID
- `outputDir` (string, optional) - Output directory (shows dialog if not provided)

**Returns:**
```typescript
{
  success: boolean;
  outputDir: string;
  workflowCount: number;
  workflows: Array<{
    filename: string;
    description: string;
  }>;
  workflowChain: string[];
}
```

### `export:antigravity:from-file`

Export a workflow from a file (YAML/JSON/HTML).

```typescript
await window.electron.invoke('export:antigravity:from-file', filePath, outputDir?)
```

**Parameters:**
- `filePath` (string) - Path to workflow file
- `outputDir` (string, optional) - Output directory (shows dialog if not provided)

**Returns:**
```typescript
{
  success: boolean;
  outputDir: string;
  workflowCount: number;
  workflows: Array<{
    filename: string;
    description: string;
    size: number;
  }>;
  workflowChain: string[];
}
```

### `export:antigravity:preview`

Preview export without writing files.

```typescript
await window.electron.invoke('export:antigravity:preview', filePath)
```

**Parameters:**
- `filePath` (string) - Path to workflow file

**Returns:**
```typescript
{
  success: boolean;
  workflowCount: number;
  workflows: Array<{
    filename: string;
    description: string;
    content: string;
    nextWorkflow?: string;
    dependencies: string[];
    size: number;
  }>;
  workflowChain: string[];
  installationGuide: string;
}
```

---

## Example Workflow: Book Cover Generation

See `examples/workflows/image-generation-workflow.yaml` for a complete example.

This workflow demonstrates:
- ✅ Multiple quality gates
- ✅ Human approval checkpoints
- ✅ Multimodal AI operations (image generation)
- ✅ MCP server integration
- ✅ Complex agent orchestration

**Exported Segments:**
1. `book-cover-image-generation-workflow-1-concept-development.md`
   - Phases: Concept Development → Prompt Engineering → Human Review
   - Ends: User approval required

2. `book-cover-image-generation-workflow-2-image-generation.md`
   - Phases: Image Generation → Quality Assessment → Image Selection → Final Review
   - Ends: User selects final image

3. `book-cover-image-generation-workflow-3-typography-design.md`
   - Phases: Typography Design → Final Approval
   - Ends: User approves complete design

4. `book-cover-image-generation-workflow-4-export-and-archive.md`
   - Phases: Export and Archive
   - Ends: Workflow complete

---

## Testing

Run the test script to see export in action:

```bash
npm run test:antigravity-export
```

Or manually:

```bash
npx ts-node examples/test-antigravity-export.ts
```

**Expected output:**
- Preview of workflow segmentation
- File listing with sizes
- Preview of first workflow content
- Installation guide preview

---

## Installing Exported Workflows in Antigravity

### 1. Copy Workflow Files

Copy all `.md` files to your Antigravity workflows directory:

```bash
cp output/antigravity-workflows/*.md ~/.agent/workflows/
```

### 2. Configure MCP Servers

Ensure all required MCP servers are configured in Antigravity settings.

**Check `INSTALLATION.md` for the list of required servers.**

### 3. Configure Agents & Skills

If the workflow requires custom agents or skills:

```bash
# Copy agents
cp agents/*.md .claude/agents/

# Copy skills
cp skills/* ~/.claude/skills/
```

### 4. Run the Workflow

Start the first workflow in the chain:

```
/book-cover-image-generation-workflow-1-concept-development
```

Follow the instructions provided by Antigravity. When you reach a review point, the workflow will tell you which command to run next.

---

## Advanced Features

### Turbo Mode

Workflows that are safe to auto-execute include a turbo mode hint:

```markdown
<!-- // turbo mode: Use turbo mode for faster execution of safe commands -->
```

**Note:** Turbo mode is only added to segments without human approval requirements.

### Custom Workflows

You can create custom workflows by:

1. **Creating a YAML file** with the FictionLab workflow format
2. **Adding phases** with agents, skills, and MCP references
3. **Marking quality gates** with `gate: true`
4. **Marking approval points** with `requiresApproval: true`
5. **Exporting** using the export tool

### Multimodal Support

Workflows that use multimodal AI (images, audio, video) work seamlessly:

```yaml
- id: 3
  name: Image Generation
  type: writing
  agent: image-generation-agent
  skill: multimodal-image-generation
  description: Generate cover images with DALL-E 3
  process:
    - Connect to image generation API
    - Generate 5-10 variations
    - Store with metadata
```

The exporter preserves multimodal instructions and includes appropriate MCP server references.

---

## Limitations

1. **Character Limit** - Antigravity has a 12,000 character limit per workflow
   - Large phases may need manual splitting
   - Warning logged if limit exceeded

2. **No State Persistence** - Unlike FictionLab's database tracking, Antigravity workflows don't persist state
   - Use MCP servers to maintain state across workflow segments

3. **Manual Continuation** - User must manually trigger next workflow after review
   - Each segment includes instructions for next step

4. **Database Workflows** - Current database workflows use step-based format
   - Best results with phase-based workflows from YAML/JSON/HTML files

---

## Troubleshooting

### "Workflow file not found"

Ensure the workflow file path is absolute and the file exists:

```typescript
const workflowPath = path.resolve('./workflows/my-workflow.yaml');
```

### "Content exceeds 12,000 character limit"

Split large phases into smaller sub-phases:

```yaml
phases:
  - id: 1
    name: Planning Part 1
    # ...
  - id: 2
    name: Planning Part 2
    # ...
```

### "MCP server not configured"

Check `INSTALLATION.md` for required MCP servers and add them to Antigravity settings.

### "Agent not found"

Copy required agent files to `.claude/agents/`:

```bash
cp .claude/agents/my-agent.md ~/.claude/agents/
```

---

## API Reference

### AntigravityWorkflowExporter

```typescript
class AntigravityWorkflowExporter {
  /**
   * Export workflow to Antigravity format
   */
  async exportWorkflow(
    workflow: WorkflowDefinition,
    outputDir: string
  ): Promise<AntigravityExportResult>

  /**
   * Preview export without writing files
   */
  async previewExport(
    workflow: WorkflowDefinition
  ): Promise<AntigravityExportResult>
}
```

### AntigravityExportResult

```typescript
interface AntigravityExportResult {
  workflows: AntigravityWorkflow[];
  installationGuide: string;
  workflowChain: string[];
}
```

### AntigravityWorkflow

```typescript
interface AntigravityWorkflow {
  filename: string;
  description: string;
  content: string;
  nextWorkflow?: string;
  dependencies: string[];
}
```

---

## Future Enhancements

- [ ] UI component for visual export workflow
- [ ] Automatic MCP server validation
- [ ] Workflow preview with graphical visualization
- [ ] Export templates for common patterns
- [ ] Bulk export of multiple workflows
- [ ] Direct integration with Antigravity Cloud
- [ ] Automatic workflow chaining in Antigravity

---

## Support

For issues or questions:
- Check that all required MCP servers are running
- Verify workflow file format is valid
- Review export logs for error details
- Check `INSTALLATION.md` in export output

---

## License

Part of the FictionLab MCP Electron App
© 2025 FictionLab
