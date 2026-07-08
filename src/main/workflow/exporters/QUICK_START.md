# Claude Code Exporter - Quick Start

## Basic Usage

### Export a Workflow

```typescript
import { ClaudeCodeExporter } from './exporters/claude-code-exporter';

const exporter = new ClaudeCodeExporter();

// Export with defaults (YAML, includes agents/skills)
const result = await exporter.export('12-phase-pipeline');

if (result.success) {
  console.log('Exported to:', result.outputPath);
  // Output: ~/.claude/exports/12-phase-pipeline-2025-12-15/
}
```

### From Renderer (IPC)

```typescript
// In renderer process
const result = await window.electron.ipcRenderer.invoke(
  'workflow:export-claude-code',
  '12-phase-pipeline'
);

if (result.success) {
  alert(`Exported to: ${result.outputPath}`);
}
```

## Export Options

### Custom Format

```typescript
// Export as JSON instead of YAML
const result = await exporter.export('workflow-id', {
  format: 'json'
});
```

### Custom Location

```typescript
// Export to specific directory
const result = await exporter.export('workflow-id', {
  outputPath: '/path/to/my/exports'
});
```

### Workflow Only (No Dependencies)

```typescript
// Export just the workflow, skip agents/skills
const result = await exporter.export('workflow-id', {
  includeAgents: false,
  includeSkills: false
});
```

### Specific Version

```typescript
// Export a specific version
const result = await exporter.export('workflow-id', {
  version: '2.1.0'
});
```

## List Workflows

### All Workflows

```typescript
const workflows = await exporter.listExportableWorkflows();

workflows.forEach(w => {
  console.log(`${w.name} - ${w.id} v${w.version}`);
});
```

### Filter by Tags

```typescript
// Get only fiction workflows
const workflows = await exporter.listExportableWorkflows({
  tags: ['fiction', 'writing']
});
```

### User Workflows Only

```typescript
// Exclude system workflows
const workflows = await exporter.listExportableWorkflows({
  is_system: false
});
```

## Validate Export

```typescript
const validation = await exporter.validateExport(
  '/path/to/export'
);

if (validation.valid) {
  console.log('Export is valid!');
} else {
  console.error('Errors:', validation.errors);
  console.warn('Warnings:', validation.warnings);
}
```

## Export Structure

```
~/.claude/exports/workflow-name-2025-12-15/
├── workflows/
│   └── workflow-id.yaml          # Workflow definition
├── agents/                        # Agent personas
│   ├── agent-1.md
│   ├── agent-2.md
│   └── ...
├── skills/                        # Executable skills
│   ├── skill-1.md
│   ├── skill-2.md
│   └── ...
└── README.md                      # Installation guide
```

## Common Patterns

### Export with Error Handling

```typescript
try {
  const result = await exporter.export('workflow-id');

  if (!result.success) {
    console.error('Export failed:', result.error);
    return;
  }

  console.log('Success!');
  console.log('Location:', result.outputPath);
  console.log('Agents:', result.exportedFiles.agents.length);
  console.log('Skills:', result.exportedFiles.skills.length);

} catch (error) {
  console.error('Unexpected error:', error);
}
```

### Batch Export

```typescript
async function exportAll() {
  const workflows = await exporter.listExportableWorkflows();

  for (const workflow of workflows) {
    console.log(`Exporting ${workflow.name}...`);
    const result = await exporter.export(workflow.id);

    if (result.success) {
      console.log(`  ✓ ${result.outputPath}`);
    } else {
      console.log(`  ✗ ${result.error}`);
    }
  }
}
```

### Export and Validate

```typescript
// Export workflow
const result = await exporter.export('workflow-id');

if (!result.success) {
  console.error('Export failed');
  return;
}

// Validate the export
const validation = await exporter.validateExport(result.outputPath);

if (!validation.valid) {
  console.warn('Export has issues:');
  validation.errors.forEach(e => console.error('  Error:', e));
  validation.warnings.forEach(w => console.warn('  Warning:', w));
}
```

## React Component Example

```typescript
import React, { useState } from 'react';

function ExportButton({ workflowId }: { workflowId: string }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);

    try {
      const result = await window.electron.ipcRenderer.invoke(
        'workflow:export-claude-code',
        workflowId
      );

      if (result.success) {
        alert(`Exported to: ${result.outputPath}`);
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      alert('Export failed unexpectedly');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button onClick={handleExport} disabled={exporting}>
      {exporting ? 'Exporting...' : 'Export to Claude Code'}
    </button>
  );
}
```

## IPC Handlers Available

### Export Workflow
```typescript
ipcMain.handle('workflow:export-claude-code', async (_event, workflowId, options) => {
  const exporter = new ClaudeCodeExporter();
  return await exporter.export(workflowId, options);
});
```

### List Workflows
```typescript
ipcMain.handle('workflow:list-exportable', async (_event, filters) => {
  const exporter = new ClaudeCodeExporter();
  return await exporter.listExportableWorkflows(filters);
});
```

### Validate Export
```typescript
ipcMain.handle('workflow:validate-export', async (_event, exportPath) => {
  const exporter = new ClaudeCodeExporter();
  return await exporter.validateExport(exportPath);
});
```

## Tips

1. **Default Location**: Exports go to `~/.claude/exports/` by default
2. **Date Stamps**: Export folders include date stamps (YYYY-MM-DD)
3. **Missing Dependencies**: Exporter warns but continues if files not found
4. **Validation**: Always validate exports before sharing
5. **Format Choice**: Use YAML for readability, JSON for programmatic use
6. **Version Control**: Consider exporting to a git repository

## Troubleshooting

### "Workflow not found"
- Check that workflow ID is correct
- Use `listExportableWorkflows()` to see available workflows

### "Some agents/skills not copied"
- Check logs for which files were missing
- Verify agents exist in userData/agents/
- Verify skills exist in ~/.claude/skills/

### "Export validation failed"
- Check validation.errors for specific issues
- Most common: missing workflow file in workflows/
- Warnings are usually okay (missing optional files)

### "Permission denied"
- Check write permissions on output directory
- Try custom outputPath with known writable location

## Need More Details?

- See `README.md` for full API documentation
- See `USAGE_EXAMPLES.md` for comprehensive examples
- See `../../../CLAUDE_CODE_EXPORTER_COMPLETE.md` for implementation details
