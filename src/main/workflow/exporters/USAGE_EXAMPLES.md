# Claude Code Exporter - Usage Examples

## Basic Export

Export a workflow with default settings (includes agents and skills, YAML format):

```typescript
import { ClaudeCodeExporter } from './exporters/claude-code-exporter';

const exporter = new ClaudeCodeExporter();

const result = await exporter.export('12-phase-pipeline');

if (result.success) {
  console.log(`Exported to: ${result.outputPath}`);
  // Output: ~/.claude/exports/12-phase-pipeline-2025-12-15/
}
```

## Custom Output Path

Export to a specific directory:

```typescript
const result = await exporter.export('12-phase-pipeline', {
  outputPath: '/Users/john/Desktop/my-workflow-export'
});
```

## JSON Format

Export as JSON instead of YAML:

```typescript
const result = await exporter.export('12-phase-pipeline', {
  format: 'json'
});
// Creates: workflows/12-phase-pipeline.json
```

## Workflow Only (No Dependencies)

Export just the workflow definition without agents or skills:

```typescript
const result = await exporter.export('12-phase-pipeline', {
  includeAgents: false,
  includeSkills: false
});
// Only creates: workflows/12-phase-pipeline.yaml and README.md
```

## Specific Version

Export a specific version of a workflow:

```typescript
const result = await exporter.export('12-phase-pipeline', {
  version: '2.1.0'
});
```

## List Exportable Workflows

Get all workflows available for export:

```typescript
const workflows = await exporter.listExportableWorkflows();

console.log('Available workflows:');
workflows.forEach(w => {
  console.log(`- ${w.name} (${w.id}) v${w.version}`);
});
```

## Filter Workflows

List workflows by tags or system flag:

```typescript
// Get only user-created workflows
const userWorkflows = await exporter.listExportableWorkflows({
  is_system: false
});

// Get workflows with specific tags
const fictionWorkflows = await exporter.listExportableWorkflows({
  tags: ['fiction', 'writing']
});
```

## Validate Export

Check if an exported package is valid:

```typescript
const validation = await exporter.validateExport(
  '/Users/john/.claude/exports/12-phase-pipeline-2025-12-15'
);

if (validation.valid) {
  console.log('Export package is valid');
} else {
  console.log('Errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
}
```

## Complete Example with Error Handling

```typescript
import { ClaudeCodeExporter } from './exporters/claude-code-exporter';

async function exportWorkflow(workflowId: string) {
  const exporter = new ClaudeCodeExporter();

  try {
    // Export the workflow
    const result = await exporter.export(workflowId, {
      format: 'yaml',
      includeAgents: true,
      includeSkills: true
    });

    if (!result.success) {
      console.error('Export failed:', result.error);
      return;
    }

    console.log('Export successful!');
    console.log('Output directory:', result.outputPath);
    console.log('\nExported files:');
    console.log('- Workflow:', result.exportedFiles.workflow);
    console.log('- Agents:', result.exportedFiles.agents.length);
    console.log('- Skills:', result.exportedFiles.skills.length);
    console.log('- README:', result.exportedFiles.readme);

    // Validate the export
    const validation = await exporter.validateExport(result.outputPath);

    if (!validation.valid) {
      console.warn('Warning: Export validation found issues');
      validation.errors.forEach(e => console.error('  Error:', e));
      validation.warnings.forEach(w => console.warn('  Warning:', w));
    }

    // List files in export
    console.log('\nAgent files:');
    result.exportedFiles.agents.forEach(a => {
      const filename = path.basename(a);
      console.log(`  - ${filename}`);
    });

    console.log('\nSkill files:');
    result.exportedFiles.skills.forEach(s => {
      const filename = path.basename(s);
      console.log(`  - ${filename}`);
    });

    return result;

  } catch (error) {
    console.error('Unexpected error during export:', error);
    throw error;
  }
}

// Usage
exportWorkflow('12-phase-pipeline').then(() => {
  console.log('Export complete!');
});
```

## IPC Usage (From Renderer Process)

### Export Workflow

```typescript
// In renderer process
const result = await window.electron.ipcRenderer.invoke(
  'workflow:export-claude-code',
  '12-phase-pipeline',
  {
    format: 'yaml',
    includeAgents: true,
    includeSkills: true
  }
);

if (result.success) {
  alert(`Workflow exported to: ${result.outputPath}`);
}
```

### List Exportable Workflows

```typescript
// In renderer process
const workflows = await window.electron.ipcRenderer.invoke(
  'workflow:list-exportable'
);

console.log('Available workflows:', workflows);
```

### Validate Export

```typescript
// In renderer process
const validation = await window.electron.ipcRenderer.invoke(
  'workflow:validate-export',
  '/path/to/export'
);

if (!validation.valid) {
  console.error('Export is invalid:', validation.errors);
}
```

## React Component Example

```typescript
import React, { useState } from 'react';

const WorkflowExportButton: React.FC<{ workflowId: string }> = ({ workflowId }) => {
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportResult = await window.electron.ipcRenderer.invoke(
        'workflow:export-claude-code',
        workflowId,
        {
          format: 'yaml',
          includeAgents: true,
          includeSkills: true
        }
      );

      setResult(exportResult);

      if (exportResult.success) {
        alert(`Export successful!\n\nLocation: ${exportResult.outputPath}`);
      } else {
        alert(`Export failed: ${exportResult.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed unexpectedly');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="btn btn-primary"
      >
        {exporting ? 'Exporting...' : 'Export to Claude Code'}
      </button>

      {result && result.success && (
        <div className="export-result">
          <h4>Export Complete</h4>
          <p>Location: {result.outputPath}</p>
          <ul>
            <li>Workflow: {path.basename(result.exportedFiles.workflow)}</li>
            <li>Agents: {result.exportedFiles.agents.length} files</li>
            <li>Skills: {result.exportedFiles.skills.length} files</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default WorkflowExportButton;
```

## Batch Export Example

Export multiple workflows at once:

```typescript
async function batchExport(workflowIds: string[]) {
  const exporter = new ClaudeCodeExporter();
  const results = [];

  for (const id of workflowIds) {
    console.log(`Exporting ${id}...`);
    const result = await exporter.export(id);
    results.push({ id, result });

    if (result.success) {
      console.log(`  ✓ Exported to ${result.outputPath}`);
    } else {
      console.log(`  ✗ Failed: ${result.error}`);
    }
  }

  return results;
}

// Export all user workflows
const workflows = await exporter.listExportableWorkflows({ is_system: false });
const ids = workflows.map(w => w.id);
await batchExport(ids);
```

## Export with Progress Tracking

```typescript
import { EventEmitter } from 'events';

class ExportProgressTracker extends EventEmitter {
  async exportWithProgress(exporter: ClaudeCodeExporter, workflowId: string) {
    this.emit('start', { workflowId });

    try {
      this.emit('progress', { step: 'Fetching workflow definition...' });

      const result = await exporter.export(workflowId);

      if (result.success) {
        this.emit('progress', { step: 'Export complete' });
        this.emit('complete', result);
      } else {
        this.emit('error', result.error);
      }

      return result;

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
}

// Usage
const tracker = new ExportProgressTracker();

tracker.on('start', (data) => console.log('Starting export:', data.workflowId));
tracker.on('progress', (data) => console.log('Progress:', data.step));
tracker.on('complete', (result) => console.log('Complete:', result.outputPath));
tracker.on('error', (error) => console.error('Error:', error));

const exporter = new ClaudeCodeExporter();
await tracker.exportWithProgress(exporter, '12-phase-pipeline');
```

## Tips

1. **Default Location**: Exports go to `~/.claude/exports/` by default
2. **Date Stamps**: Export folders include date stamps to prevent overwrites
3. **Missing Dependencies**: Exporter warns but continues if agents/skills not found
4. **Validation**: Always validate exports before sharing
5. **Format Choice**: Use YAML for human readability, JSON for programmatic use
6. **Version Control**: Consider exporting to a git repository for version tracking
