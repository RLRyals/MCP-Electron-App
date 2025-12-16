# Workflow Exporters

This directory contains exporters for converting FictionLab workflows to various formats.

## Claude Code Exporter

**File**: `claude-code-exporter.ts`

Exports workflows in Claude Code format with full agent + skill + workflow structure. This allows users to "pack up their toys" and use workflows in different AI tools.

### Export Structure

```
~/.claude/
  agents/
    {agent-name}.md (all referenced agents)
  skills/
    {skill-name}.md (all referenced skills)
  workflows/
    {workflow-name}.yaml (workflow definition)
  README.md (workflow overview)
```

### Usage

```typescript
import { ClaudeCodeExporter } from './exporters/claude-code-exporter';

const exporter = new ClaudeCodeExporter();

// Export a workflow
const result = await exporter.export('workflow-id', {
  version: '1.0.0',
  includeAgents: true,
  includeSkills: true,
  format: 'yaml',
  outputPath: '/path/to/export'
});

if (result.success) {
  console.log('Exported to:', result.outputPath);
  console.log('Files:', result.exportedFiles);
} else {
  console.error('Export failed:', result.error);
}
```

### Features

- ✅ Exports workflow definition as YAML or JSON
- ✅ Copies all referenced agent markdown files
- ✅ Copies all referenced skill files (both single-file and directory formats)
- ✅ Generates comprehensive README with installation instructions
- ✅ Validates export package structure
- ✅ Lists all exportable workflows
- ✅ Error handling and logging

### Export Options

```typescript
interface ExportOptions {
  version?: string;           // Specific workflow version to export
  includeAgents?: boolean;    // Include agent files (default: true)
  includeSkills?: boolean;    // Include skill files (default: true)
  format?: 'yaml' | 'json';   // Export format (default: 'yaml')
  outputPath?: string;        // Custom output path (default: ~/.claude/exports/{workflow-name}-{date})
}
```

### Export Result

```typescript
interface ExportResult {
  success: boolean;
  outputPath: string;
  message: string;
  exportedFiles: {
    workflow: string;         // Path to workflow file
    agents: string[];         // Paths to copied agent files
    skills: string[];         // Paths to copied skill files
    readme: string;           // Path to README.md
  };
  error?: string;
}
```

### Methods

#### `export(workflowId: string, options?: ExportOptions): Promise<ExportResult>`

Export a workflow to Claude Code format.

#### `listExportableWorkflows(filters?): Promise<WorkflowDefinition[]>`

Get a list of all workflows available for export.

#### `validateExport(exportPath: string): Promise<ValidationResult>`

Validate an exported workflow package structure.

### File Locations

- **Agents**: Read from `{userData}/agents/`
- **Skills**: Read from `~/.claude/skills/`
- **Workflow Definitions**: Retrieved from MCP workflow-manager server
- **Export Output**: Default to `~/.claude/exports/{workflow-name}-{date}/`

### Next Steps

1. ✅ Core exporter implementation complete
2. ⏳ Add IPC handler for renderer process
3. ⏳ Create UI component for export dialog
4. ⏳ Add export to main workflow view
5. ⏳ Test with real workflows
6. ⏳ Add batch export functionality
7. ⏳ Add export to marketplace format (Option A/B)

## Future Exporters

Additional exporters will be added for:
- Marketplace JSON format (Option A)
- Marketplace ZIP package (Option B)
- GitHub repository structure
- Custom formats
