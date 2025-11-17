# MCP-Electron Frontend Implementation Plan
## Database Admin Tools UI Dashboard

This document outlines the implementation plan for creating a comprehensive UI dashboard in the MCP-Electron-App repository to manage the 25 database admin tools from MCP-Writing-Servers.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Feature Requirements](#feature-requirements)
4. [UI Components](#ui-components)
5. [Implementation Phases](#implementation-phases)
6. [Technical Stack](#technical-stack)
7. [File Structure](#file-structure)
8. [Component Specifications](#component-specifications)

---

## Overview

### Goals

Create an intuitive, feature-rich dashboard in the MCP-Electron-App for managing all 25 database admin tools:

**Tool Categories:**
- 🔍 **CRUD Operations** (4 tools): Query, Insert, Update, Delete
- 📦 **Batch Operations** (3 tools): Batch Insert, Update, Delete
- 🏗️ **Schema Tools** (4 tools): Schema, Tables, Relationships, Columns
- 📊 **Audit Tools** (2 tools): Query Logs, Audit Summary
- 💾 **Backup/Restore** (12 tools): Full/Table/Incremental backup, Export/Import, Manage

### User Experience Goals

- 🎯 **Intuitive**: Easy to use for both technical and non-technical users
- ⚡ **Fast**: Real-time operations with loading states
- 🔒 **Safe**: Confirmation dialogs for destructive operations
- 📱 **Responsive**: Works on different screen sizes
- 🎨 **Modern**: Clean, professional UI with dark/light mode

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              MCP-Electron-App (Main Process)            │
│  ┌──────────────────────────────────────────────────┐  │
│  │           IPC Handler Layer                      │  │
│  │  - Tool invocation                               │  │
│  │  - Error handling                                │  │
│  │  - Response formatting                           │  │
│  └─────────────────┬────────────────────────────────┘  │
└────────────────────┼───────────────────────────────────┘
                     │ IPC
┌────────────────────▼───────────────────────────────────┐
│          Renderer Process (React/Vue UI)               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Dashboard Layout                                │  │
│  │  ├── Navigation Sidebar                          │  │
│  │  ├── Tool Category Tabs                          │  │
│  │  ├── Main Content Area                           │  │
│  │  └── Status/Notification Bar                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Tool Components                                 │  │
│  │  ├── CRUD Operations Panel                       │  │
│  │  ├── Batch Operations Panel                      │  │
│  │  ├── Schema Explorer                             │  │
│  │  ├── Audit Log Viewer                            │  │
│  │  └── Backup Manager                              │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬───────────────────────────────────┘
                     │ HTTP/stdio
┌────────────────────▼───────────────────────────────────┐
│         MCP-Writing-Servers (database-admin)           │
│                    Port 3010                           │
└────────────────────────────────────────────────────────┘
```

---

## Feature Requirements

### Phase 1: Core Dashboard (Week 1-2)

#### Navigation & Layout
- [ ] Left sidebar navigation with tool categories
- [ ] Breadcrumb navigation
- [ ] Top bar with connection status indicator
- [ ] Quick search for tables
- [ ] Dark/Light mode toggle

#### CRUD Operations Panel
- [ ] Table selector dropdown (populated from `db_list_tables`)
- [ ] Query Builder interface
  - Column selection (multi-select)
  - WHERE clause builder (field, operator, value)
  - ORDER BY selector
  - Limit/Offset pagination controls
- [ ] Results table with sorting
- [ ] Insert record form (dynamic based on schema)
- [ ] Edit record modal (inline editing)
- [ ] Delete confirmation dialog
- [ ] Export results to CSV/JSON

### Phase 2: Advanced Features (Week 3-4)

#### Batch Operations Panel
- [ ] Bulk insert interface
  - CSV upload and parse
  - Manual entry grid (spreadsheet-like)
  - JSON paste area
  - Template download
- [ ] Bulk update interface
  - Select records to update
  - Apply changes to selection
  - Preview before execution
- [ ] Bulk delete interface
  - Filter selection
  - Preview affected records
  - Confirmation with record count

#### Schema Explorer
- [ ] Table list with search/filter
- [ ] Table details view
  - Column list with types, constraints
  - Primary/Foreign keys highlighted
  - Indexes visualization
- [ ] Relationship diagram (visual ERD)
  - Interactive table nodes
  - Relationship lines
  - Zoom/pan controls
- [ ] Column details sidebar
  - Data type info
  - Constraints
  - Default values
  - Sample data preview

### Phase 3: Audit & Monitoring (Week 5)

#### Audit Log Viewer
- [ ] Date range picker
- [ ] Filter by:
  - Operation type (CREATE, READ, UPDATE, DELETE)
  - Table name
  - User (if applicable)
  - Success/Failure
- [ ] Log entry details modal
  - Before/After comparison (for updates)
  - Execution time
  - Client info
- [ ] Export audit logs
- [ ] Audit summary dashboard
  - Operations per hour chart
  - Most accessed tables
  - Error rate graph
  - Top users (if multi-user)

### Phase 4: Backup & Restore (Week 6-7)

#### Backup Manager
- [ ] Backup creation wizard
  - Full database backup
  - Table selection (multi-select)
  - Incremental backup
  - Schedule backup (cron-like UI)
- [ ] Backup list/gallery
  - Card view with metadata
  - Size, date, type badges
  - Search/filter backups
- [ ] Backup actions
  - Download backup file
  - Validate backup integrity
  - Delete with confirmation
  - Restore from backup
- [ ] Restore wizard
  - Select backup file
  - Preview restore contents
  - Conflict resolution options
  - Progress indicator

#### Export/Import Tools
- [ ] Export interface
  - Table selector
  - Format selector (JSON/CSV)
  - Filter options
  - Download generated file
- [ ] Import interface
  - File upload (drag & drop)
  - Format auto-detection
  - Column mapping interface
  - Conflict resolution options
  - Preview before import
  - Progress indicator with row count

---

## UI Components

### Component Library

Use a modern React/Vue component library:
- **Recommended**: Ant Design, Material-UI, or Shadcn/UI
- **Icons**: Lucide React or Heroicons
- **Charts**: Recharts or Chart.js
- **Tables**: TanStack Table (React Table v8)
- **Forms**: React Hook Form or Formik

### Custom Components

#### 1. DatabaseConnectionStatus
```jsx
<DatabaseConnectionStatus
  server="database-admin"
  port={3010}
  onReconnect={handleReconnect}
/>
```
- Green/Red indicator
- Connection latency
- Reconnect button

#### 2. TableSelector
```jsx
<TableSelector
  onSelect={handleTableSelect}
  selectedTable="books"
  showRecordCount={true}
/>
```
- Dropdown with search
- Table icons
- Record counts

#### 3. QueryBuilder
```jsx
<QueryBuilder
  table="books"
  onExecute={handleQuery}
  maxRows={1000}
/>
```
- Visual query construction
- SQL preview
- Execute button

#### 4. DataGrid
```jsx
<DataGrid
  data={queryResults}
  columns={columns}
  onEdit={handleEdit}
  onDelete={handleDelete}
  pagination={true}
  editable={true}
/>
```
- Sortable columns
- Inline editing
- Pagination
- Row selection

#### 5. SchemaVisualization
```jsx
<SchemaVisualization
  tables={tables}
  relationships={relationships}
  onTableClick={handleTableClick}
/>
```
- Interactive ERD
- Zoom/pan
- Minimap

#### 6. BackupCard
```jsx
<BackupCard
  backup={backupInfo}
  onRestore={handleRestore}
  onDelete={handleDelete}
  onDownload={handleDownload}
/>
```
- Metadata display
- Action buttons
- Status badges

#### 7. AuditLogTimeline
```jsx
<AuditLogTimeline
  logs={auditLogs}
  onEntryClick={handleLogClick}
  groupBy="hour"
/>
```
- Chronological display
- Grouping options
- Filtering

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Deliverables:**
- [ ] Project structure setup
- [ ] Component library integration
- [ ] IPC handler implementation
- [ ] Basic dashboard layout
- [ ] Navigation system
- [ ] CRUD Operations Panel (basic)
- [ ] Connection status monitoring

**Files to Create:**
```
src/
  renderer/
    components/
      DatabaseAdmin/
        Dashboard.jsx
        Navigation.jsx
        ConnectionStatus.jsx
        CRUDPanel.jsx
    services/
      mcpClient.js
    stores/
      databaseStore.js
  main/
    ipc/
      databaseHandlers.js
```

### Phase 2: CRUD & Batch (Week 3-4)
**Deliverables:**
- [ ] Complete CRUD interface
- [ ] Query builder component
- [ ] Batch operations UI
- [ ] CSV upload/parsing
- [ ] Data grid with editing
- [ ] Form validation
- [ ] Error handling & notifications

**Files to Create:**
```
src/
  renderer/
    components/
      DatabaseAdmin/
        QueryBuilder.jsx
        DataGrid.jsx
        BatchInsertPanel.jsx
        BatchUpdatePanel.jsx
        BatchDeletePanel.jsx
        CSVUploader.jsx
        RecordEditor.jsx
```

### Phase 3: Schema Explorer (Week 5)
**Deliverables:**
- [ ] Schema explorer interface
- [ ] Table list with details
- [ ] Relationship diagram
- [ ] ERD visualization
- [ ] Column details viewer
- [ ] Schema caching

**Files to Create:**
```
src/
  renderer/
    components/
      DatabaseAdmin/
        SchemaExplorer.jsx
        TableList.jsx
        TableDetails.jsx
        RelationshipDiagram.jsx
        ERDVisualization.jsx
        ColumnDetails.jsx
```

### Phase 4: Audit & Monitoring (Week 6)
**Deliverables:**
- [ ] Audit log viewer
- [ ] Log filtering UI
- [ ] Audit summary dashboard
- [ ] Charts and graphs
- [ ] Export audit logs
- [ ] Real-time log updates

**Files to Create:**
```
src/
  renderer/
    components/
      DatabaseAdmin/
        AuditViewer.jsx
        AuditFilters.jsx
        AuditSummary.jsx
        AuditCharts.jsx
        LogEntryDetail.jsx
```

### Phase 5: Backup & Restore (Week 7-8)
**Deliverables:**
- [ ] Backup creation wizard
- [ ] Backup list/manager
- [ ] Restore wizard
- [ ] Export/Import UI
- [ ] File upload/download
- [ ] Progress indicators
- [ ] Validation UI

**Files to Create:**
```
src/
  renderer/
    components/
      DatabaseAdmin/
        BackupManager.jsx
        BackupWizard.jsx
        BackupList.jsx
        BackupCard.jsx
        RestoreWizard.jsx
        ExportPanel.jsx
        ImportPanel.jsx
        FileUploader.jsx
```

### Phase 6: Polish & Testing (Week 9-10)
**Deliverables:**
- [ ] UI/UX refinements
- [ ] Loading states
- [ ] Error boundaries
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Documentation
- [ ] User guide

---

## Technical Stack

### Frontend Framework
**Option A: React (Recommended)**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-table": "^8.10.0",
    "@tanstack/react-query": "^5.12.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",
    "recharts": "^2.10.0",
    "lucide-react": "^0.294.0"
  }
}
```

**Option B: Vue 3**
```json
{
  "dependencies": {
    "vue": "^3.3.0",
    "vue-router": "^4.2.0",
    "pinia": "^2.1.0",
    "vueuse": "^10.6.0",
    "@tanstack/vue-table": "^8.10.0"
  }
}
```

### UI Component Library

**Shadcn/UI (React - Recommended)**
- Modern, accessible components
- Tailwind CSS based
- Customizable
- TypeScript support

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add select
npx shadcn-ui@latest add tabs
```

**Alternative: Ant Design**
```json
{
  "dependencies": {
    "antd": "^5.12.0"
  }
}
```

### State Management
- **React**: Zustand or Jotai (lightweight) or Redux Toolkit (complex)
- **Vue**: Pinia

### Styling
- **Tailwind CSS** (utility-first, recommended)
- **CSS Modules** (scoped styles)
- **Styled Components** (CSS-in-JS)

---

## File Structure

```
MCP-Electron-App/
├── package.json
├── main.js                           # Electron main process
├── preload.js                        # Preload script
├── servers/
│   └── mcp-writing/                 # Git submodule
│       └── (MCP-Writing-Servers)
│
├── src/
│   ├── main/                        # Main process code
│   │   ├── index.js
│   │   ├── ipc/
│   │   │   ├── databaseHandlers.js  # IPC handlers for DB tools
│   │   │   ├── serverManager.js     # MCP server lifecycle
│   │   │   └── index.js
│   │   └── config/
│   │       └── servers.js           # Server port mappings
│   │
│   └── renderer/                    # Renderer process (UI)
│       ├── index.html
│       ├── index.jsx
│       ├── App.jsx
│       │
│       ├── components/
│       │   ├── DatabaseAdmin/       # NEW: DB Admin Dashboard
│       │   │   ├── index.jsx
│       │   │   ├── Dashboard.jsx
│       │   │   ├── Layout/
│       │   │   │   ├── Sidebar.jsx
│       │   │   │   ├── TopBar.jsx
│       │   │   │   ├── StatusBar.jsx
│       │   │   │   └── Breadcrumbs.jsx
│       │   │   │
│       │   │   ├── CRUD/
│       │   │   │   ├── CRUDPanel.jsx
│       │   │   │   ├── QueryBuilder.jsx
│       │   │   │   ├── DataGrid.jsx
│       │   │   │   ├── RecordEditor.jsx
│       │   │   │   ├── InsertForm.jsx
│       │   │   │   └── DeleteConfirmation.jsx
│       │   │   │
│       │   │   ├── Batch/
│       │   │   │   ├── BatchPanel.jsx
│       │   │   │   ├── BatchInsert.jsx
│       │   │   │   ├── BatchUpdate.jsx
│       │   │   │   ├── BatchDelete.jsx
│       │   │   │   ├── CSVUploader.jsx
│       │   │   │   └── DataGrid.jsx
│       │   │   │
│       │   │   ├── Schema/
│       │   │   │   ├── SchemaExplorer.jsx
│       │   │   │   ├── TableList.jsx
│       │   │   │   ├── TableDetails.jsx
│       │   │   │   ├── ColumnDetails.jsx
│       │   │   │   ├── RelationshipDiagram.jsx
│       │   │   │   └── ERDCanvas.jsx
│       │   │   │
│       │   │   ├── Audit/
│       │   │   │   ├── AuditViewer.jsx
│       │   │   │   ├── AuditFilters.jsx
│       │   │   │   ├── AuditSummary.jsx
│       │   │   │   ├── LogEntryCard.jsx
│       │   │   │   ├── AuditCharts.jsx
│       │   │   │   └── LogTimeline.jsx
│       │   │   │
│       │   │   ├── Backup/
│       │   │   │   ├── BackupManager.jsx
│       │   │   │   ├── BackupWizard.jsx
│       │   │   │   ├── BackupList.jsx
│       │   │   │   ├── BackupCard.jsx
│       │   │   │   ├── RestoreWizard.jsx
│       │   │   │   ├── ExportPanel.jsx
│       │   │   │   ├── ImportPanel.jsx
│       │   │   │   └── FileUploader.jsx
│       │   │   │
│       │   │   └── Shared/
│       │   │       ├── ConnectionStatus.jsx
│       │   │       ├── TableSelector.jsx
│       │   │       ├── LoadingSpinner.jsx
│       │   │       ├── ErrorBoundary.jsx
│       │   │       ├── Notification.jsx
│       │   │       └── ConfirmDialog.jsx
│       │   │
│       │   └── (other existing components)
│       │
│       ├── services/
│       │   ├── mcpClient.js         # MCP tool invocation
│       │   ├── databaseService.js   # DB operations wrapper
│       │   ├── backupService.js     # Backup operations
│       │   └── auditService.js      # Audit operations
│       │
│       ├── stores/
│       │   ├── databaseStore.js     # Database state management
│       │   ├── schemaStore.js       # Schema cache
│       │   ├── auditStore.js        # Audit logs state
│       │   └── backupStore.js       # Backup list state
│       │
│       ├── hooks/
│       │   ├── useDatabaseTools.js  # Custom hook for DB tools
│       │   ├── useTableSchema.js    # Schema fetching
│       │   ├── useQueryBuilder.js   # Query building logic
│       │   └── useBackupManager.js  # Backup management
│       │
│       ├── utils/
│       │   ├── queryBuilder.js      # Query construction helpers
│       │   ├── csvParser.js         # CSV parsing utilities
│       │   ├── dataValidation.js    # Input validation
│       │   └── formatters.js        # Data formatting
│       │
│       └── styles/
│           ├── globals.css
│           ├── database-admin.css
│           └── themes/
│               ├── dark.css
│               └── light.css
│
├── tests/
│   ├── unit/
│   │   └── database-admin/
│   ├── integration/
│   │   └── database-admin/
│   └── e2e/
│       └── database-admin/
│
└── docs/
    └── database-admin-ui.md         # UI documentation
```

---

## Component Specifications

### 1. Dashboard.jsx
**Purpose:** Main container for database admin tools

```jsx
import { useState } from 'react';
import Sidebar from './Layout/Sidebar';
import TopBar from './Layout/TopBar';
import CRUDPanel from './CRUD/CRUDPanel';
import BatchPanel from './Batch/BatchPanel';
import SchemaExplorer from './Schema/SchemaExplorer';
import AuditViewer from './Audit/AuditViewer';
import BackupManager from './Backup/BackupManager';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('crud');

  const renderContent = () => {
    switch (activeTab) {
      case 'crud': return <CRUDPanel />;
      case 'batch': return <BatchPanel />;
      case 'schema': return <SchemaExplorer />;
      case 'audit': return <AuditViewer />;
      case 'backup': return <BackupManager />;
      default: return <CRUDPanel />;
    }
  };

  return (
    <div className="database-admin-dashboard">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="main-content">
        <TopBar />
        {renderContent()}
      </div>
    </div>
  );
}
```

### 2. QueryBuilder.jsx
**Purpose:** Visual SQL query builder

```jsx
import { useState, useEffect } from 'react';
import { Select, Input, Button } from '@/components/ui';
import { useTableSchema } from '@/hooks/useTableSchema';

export default function QueryBuilder({ table, onExecute }) {
  const { columns, loading } = useTableSchema(table);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [whereClause, setWhereClause] = useState([]);
  const [orderBy, setOrderBy] = useState([]);
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  const addWhereCondition = () => {
    setWhereClause([...whereClause, { column: '', operator: '=', value: '' }]);
  };

  const executeQuery = async () => {
    const params = {
      table,
      columns: selectedColumns.length > 0 ? selectedColumns : undefined,
      where: buildWhereObject(whereClause),
      orderBy: orderBy.map(o => ({ column: o.column, direction: o.direction })),
      limit,
      offset
    };

    await onExecute(params);
  };

  return (
    <div className="query-builder">
      <div className="section">
        <label>Select Columns</label>
        <Select
          multiple
          options={columns}
          value={selectedColumns}
          onChange={setSelectedColumns}
          placeholder="All columns"
        />
      </div>

      <div className="section">
        <label>WHERE Conditions</label>
        {whereClause.map((condition, index) => (
          <WhereConditionRow
            key={index}
            condition={condition}
            columns={columns}
            onChange={(updated) => updateWhereCondition(index, updated)}
            onRemove={() => removeWhereCondition(index)}
          />
        ))}
        <Button onClick={addWhereCondition}>Add Condition</Button>
      </div>

      <div className="section">
        <label>ORDER BY</label>
        <OrderByBuilder
          columns={columns}
          value={orderBy}
          onChange={setOrderBy}
        />
      </div>

      <div className="section pagination">
        <Input
          type="number"
          label="Limit"
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value))}
          min={1}
          max={1000}
        />
        <Input
          type="number"
          label="Offset"
          value={offset}
          onChange={(e) => setOffset(parseInt(e.target.value))}
          min={0}
        />
      </div>

      <div className="actions">
        <Button onClick={executeQuery} variant="primary">
          Execute Query
        </Button>
        <Button onClick={resetQuery} variant="secondary">
          Reset
        </Button>
      </div>

      <div className="sql-preview">
        <pre>{generateSQLPreview(params)}</pre>
      </div>
    </div>
  );
}
```

### 3. BackupManager.jsx
**Purpose:** Manage database backups

```jsx
import { useState, useEffect } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { useBackupManager } from '@/hooks/useBackupManager';
import BackupWizard from './BackupWizard';
import BackupCard from './BackupCard';

export default function BackupManager() {
  const { backups, loading, createBackup, deleteBackup, restoreBackup } = useBackupManager();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);

  return (
    <div className="backup-manager">
      <div className="header">
        <h2>Backup Manager</h2>
        <Button onClick={() => setShowWizard(true)}>
          Create New Backup
        </Button>
      </div>

      <div className="backup-grid">
        {backups.map(backup => (
          <BackupCard
            key={backup.id}
            backup={backup}
            onRestore={() => handleRestore(backup)}
            onDelete={() => handleDelete(backup)}
            onDownload={() => handleDownload(backup)}
          />
        ))}
      </div>

      {showWizard && (
        <BackupWizard
          onClose={() => setShowWizard(false)}
          onComplete={handleBackupComplete}
        />
      )}
    </div>
  );
}
```

---

## IPC Handler Implementation

### databaseHandlers.js (Main Process)

```javascript
const { ipcMain } = require('electron');
const fetch = require('node-fetch');

const DB_ADMIN_PORT = 3010;
const BASE_URL = `http://localhost:${DB_ADMIN_PORT}`;

// Generic MCP tool call handler
ipcMain.handle('db:call-tool', async (event, { toolName, params }) => {
  try {
    const response = await fetch(`${BASE_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params
        }
      })
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  } catch (error) {
    console.error(`DB tool call failed (${toolName}):`, error);
    throw error;
  }
});

// Specific handlers for common operations
ipcMain.handle('db:query-records', async (event, params) => {
  return await callDbTool('db_query_records', params);
});

ipcMain.handle('db:insert-record', async (event, params) => {
  return await callDbTool('db_insert_record', params);
});

ipcMain.handle('db:update-records', async (event, params) => {
  return await callDbTool('db_update_records', params);
});

ipcMain.handle('db:delete-records', async (event, params) => {
  return await callDbTool('db_delete_records', params);
});

ipcMain.handle('db:list-tables', async (event, params) => {
  return await callDbTool('db_list_tables', params || {});
});

ipcMain.handle('db:get-schema', async (event, params) => {
  return await callDbTool('db_get_schema', params);
});

ipcMain.handle('db:backup-full', async (event, params) => {
  return await callDbTool('db_backup_full', params || {});
});

// Helper function
async function callDbTool(toolName, params) {
  const response = await fetch(`${BASE_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: params }
    })
  });

  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return result.result;
}

// Health check
ipcMain.handle('db:health-check', async () => {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    return { healthy: false, error: error.message };
  }
});
```

---

## Service Layer (Renderer)

### databaseService.js

```javascript
const { ipcRenderer } = window.electron || {};

class DatabaseService {
  // CRUD operations
  async queryRecords(table, options = {}) {
    return await ipcRenderer.invoke('db:query-records', {
      table,
      ...options
    });
  }

  async insertRecord(table, data) {
    return await ipcRenderer.invoke('db:insert-record', {
      table,
      data
    });
  }

  async updateRecords(table, data, where) {
    return await ipcRenderer.invoke('db:update-records', {
      table,
      data,
      where
    });
  }

  async deleteRecords(table, where) {
    return await ipcRenderer.invoke('db:delete-records', {
      table,
      where
    });
  }

  // Schema operations
  async listTables() {
    return await ipcRenderer.invoke('db:list-tables');
  }

  async getTableSchema(table) {
    return await ipcRenderer.invoke('db:get-schema', { table });
  }

  async getRelationships(table) {
    return await ipcRenderer.invoke('db:call-tool', {
      toolName: 'db_get_relationships',
      params: { table }
    });
  }

  // Batch operations
  async batchInsert(table, records) {
    return await ipcRenderer.invoke('db:call-tool', {
      toolName: 'db_batch_insert',
      params: { table, records }
    });
  }

  // Backup operations
  async createBackup(options = {}) {
    return await ipcRenderer.invoke('db:backup-full', options);
  }

  async listBackups() {
    return await ipcRenderer.invoke('db:call-tool', {
      toolName: 'db_list_backups',
      params: {}
    });
  }

  async restoreBackup(backupFile, options = {}) {
    return await ipcRenderer.invoke('db:call-tool', {
      toolName: 'db_restore_full',
      params: { backupFile, ...options }
    });
  }

  // Health check
  async checkHealth() {
    return await ipcRenderer.invoke('db:health-check');
  }
}

export default new DatabaseService();
```

---

## Next Steps

### Week 1: Setup
1. Clone this plan into MCP-Electron-App repo
2. Install dependencies
3. Set up component library (Shadcn/UI)
4. Create basic file structure
5. Implement IPC handlers

### Week 2-3: Core Features
1. Build CRUD panel
2. Implement query builder
3. Create data grid
4. Add batch operations

### Week 4-5: Advanced Features
1. Schema explorer
2. Relationship diagram
3. Audit viewer
4. Charts and graphs

### Week 6-7: Backup System
1. Backup wizard
2. Restore functionality
3. Export/Import tools
4. File management

### Week 8-9: Polish
1. Error handling
2. Loading states
3. Animations
4. Accessibility

### Week 10: Testing & Documentation
1. Write tests
2. Create user guide
3. Record demo videos
4. Deploy to production

---

## Success Criteria

✅ All 25 tools accessible via UI
✅ Intuitive navigation between features
✅ Real-time data updates
✅ Error handling with user-friendly messages
✅ Responsive design (works on different screen sizes)
✅ Dark/Light mode support
✅ < 2 second response time for queries
✅ Backup/Restore works reliably
✅ 90%+ test coverage
✅ Complete user documentation

---

**Document Version:** 1.0
**Last Updated:** 2025-11-17
**Author:** Claude AI Assistant
