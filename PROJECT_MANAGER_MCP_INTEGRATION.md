# Project Manager - MCP Integration Complete

**Date:** 2025-12-16
**Status:** ✅ READY FOR TESTING (pending MCP server implementation)

---

## Summary

The ProjectManager in the Electron app has been successfully updated to use the MCP (Model Context Protocol) pattern for all database operations. It now communicates with the `project-manager-server` MCP via stdio instead of using direct PostgreSQL queries.

---

## Changes Made

### File: [src/main/project-manager.ts](src/main/project-manager.ts)

**Replaced:** Direct database queries via `getDatabasePool()`

**With:** MCP client pattern via stdio communication

### Architecture Pattern

```typescript
ProjectManager (Electron App)
    ↓ spawn node process
    ↓ JSON-RPC via stdio
project-manager-server (MCP)
    ↓ database queries
PostgreSQL (MCP-Writing-Servers)
```

---

## MCP Tools Used

The ProjectManager now calls these MCP tools:

1. **`create_project`** - Create new project folder reference
   ```typescript
   await this.callTool('create_project', {
     name: string,
     folder_path: string | null,
     author_id: number | null,
     series_id: number | null,
     book_id: number | null
   })
   ```

2. **`list_projects`** - List all projects
   ```typescript
   await this.callTool('list_projects', {})
   ```

3. **`get_project`** - Get project by ID
   ```typescript
   await this.callTool('get_project', { id: number })
   ```

4. **`update_project`** - Update project fields
   ```typescript
   await this.callTool('update_project', {
     id: number,
     name?: string,
     folder_path?: string,
     author_id?: number,
     series_id?: number,
     book_id?: number
   })
   ```

5. **`delete_project`** - Delete project reference
   ```typescript
   await this.callTool('delete_project', { id: number })
   ```

---

## MCP Server Path

```
{userData}/repositories/mcp-writing-servers/src/mcps/project-manager-server/index.js
```

**Environment Variables:**
- `MCP_STDIO_MODE=true` - Enables stdio communication
- `DATABASE_URL` - PostgreSQL connection string (from Electron app's database config)

---

## Communication Flow

### Example: Creating a Project

```typescript
// 1. User clicks "Create Project" in UI
const project = await projectManager.createProject({
  name: "My Novel Project",
  folder_path: "C:\\Users\\User\\Documents\\My Novels"
});

// 2. ProjectManager spawns MCP server
spawn('node', [mcpServerPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    MCP_STDIO_MODE: 'true',
    DATABASE_URL: 'postgresql://...'
  }
});

// 3. Sends JSON-RPC request via stdin
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_project",
    "arguments": {
      "name": "My Novel Project",
      "folder_path": "C:\\Users\\User\\Documents\\My Novels",
      "author_id": null,
      "series_id": null,
      "book_id": null
    }
  }
}

// 4. MCP server responds via stdout
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"id\":1,\"name\":\"My Novel Project\",\"folder_path\":\"C:\\\\Users\\\\User\\\\Documents\\\\My Novels\",...}"
      }
    ]
  }
}

// 5. ProjectManager parses response and returns Project object
return {
  id: 1,
  name: "My Novel Project",
  folder_path: "C:\\Users\\User\\Documents\\My Novels",
  ...
}
```

---

## Error Handling

The ProjectManager handles these error scenarios:

1. **MCP server not found** - Server path doesn't exist
2. **MCP server spawn failure** - Node.js process fails to start
3. **Database connection failure** - Can't get DATABASE_URL
4. **MCP server crash** - Process exits with non-zero code
5. **Invalid JSON-RPC response** - Malformed response from server
6. **Tool execution error** - MCP tool returns error object

All errors are logged via `logWithCategory()` and thrown as descriptive Error objects.

---

## Build Status

✅ **Compiled successfully** - TypeScript compilation passes with 0 errors

---

## Next Steps

### In MCP-Writing-Servers Repo:

1. **Implement the MCP server** following [C:\github\MCP-Writing-Servers\PROJECT_MANAGER_MCP_IMPLEMENTATION.md](C:\github\MCP-Writing-Servers\PROJECT_MANAGER_MCP_IMPLEMENTATION.md)

2. **Run database migration:**
   ```bash
   cd C:\github\MCP-Writing-Servers
   # Run migration 029_create_projects_table.sql
   ```

3. **Create the MCP server:**
   ```bash
   cd C:\github\MCP-Writing-Servers\src\mcps
   mkdir project-manager-server
   # Implement index.js following the documentation
   ```

4. **Test the MCP server independently:**
   ```bash
   cd C:\github\MCP-Writing-Servers
   node src/mcps/project-manager-server/index.js --test
   ```

### In Electron App:

5. **Test project creation:**
   - Launch app
   - Click "Create Project"
   - Select folder
   - Verify project appears in database

6. **Test all CRUD operations:**
   - Create project
   - List projects
   - Get project details
   - Update project folder
   - Delete project

---

## What Projects Are For

**Projects are NOT part of the series hierarchy.** They are:

- **Folder references** where users save their work
- **Optional links** to existing authors/series/books (but don't create them)
- **Independent entities** that survive when linked series/books are deleted (no cascade)

### Use Cases:

1. **Standalone projects** - Writer working on a single novel
2. **Series-linked projects** - Organize all files for a 5-book series
3. **Book-specific projects** - Separate folder for each book in a series
4. **Workflow-linked projects** - Save workflow outputs to a specific location

---

## Key Differences from Direct SQL

### Before (Direct SQL):
```typescript
const pool = getDatabasePool();
const result = await pool.query(
  'INSERT INTO projects (name, folder_path) VALUES ($1, $2) RETURNING *',
  [data.name, data.folder_path]
);
```

### After (MCP):
```typescript
const result = await this.callTool('create_project', {
  name: data.name,
  folder_path: data.folder_path
});
```

### Benefits:

1. **Decoupled** - Electron app doesn't need direct database access
2. **Portable** - MCP server can be used by other clients (CLI, web, etc.)
3. **Consistent** - Same pattern as workflow-manager MCP
4. **Maintainable** - Database logic lives in one place (MCP server)
5. **Secure** - Database credentials only in MCP server environment

---

## Testing Checklist

- [ ] MCP server implemented in MCP-Writing-Servers repo
- [ ] Database migration run successfully
- [ ] MCP server starts without errors
- [ ] Electron app can spawn MCP server
- [ ] Create project works
- [ ] List projects returns data
- [ ] Get project by ID works
- [ ] Update project works
- [ ] Delete project works
- [ ] Error handling works (missing server, bad data, etc.)
- [ ] Projects appear in UI
- [ ] Folder picker dialog works
- [ ] Projects persist across app restarts

---

## Related Files

**This Repo (MCP-Electron-App):**
- [src/main/project-manager.ts](src/main/project-manager.ts) - Updated MCP client
- [src/types/project.ts](src/types/project.ts) - Project type definitions
- [src/main/index.ts](src/main/index.ts) - IPC handler registration
- [src/renderer/components/ProjectCreationDialog.tsx](src/renderer/components/ProjectCreationDialog.tsx) - UI

**MCP-Writing-Servers Repo:**
- `PROJECT_MANAGER_MCP_IMPLEMENTATION.md` - Complete implementation guide
- `database-migrations/029_create_projects_table.sql` - Database schema
- `src/mcps/project-manager-server/index.js` - MCP server (to be created)

---

**Status:** ✅ Electron app ready, waiting for MCP server implementation
**Build:** ✅ Passing
**Next Action:** Implement MCP server in MCP-Writing-Servers repo
