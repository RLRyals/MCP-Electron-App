# Database CRUD Features Guide

## Overview
The MCP Electron App includes a comprehensive CRUD (Create, Read, Update, Delete) interface for database management. This guide explains all available features and how to use them.

> **⚠️ Important**: CRUD features require the MCP server bug to be fixed first. See [DATABASE_TAB_500_ERROR_FIX.md](DATABASE_TAB_500_ERROR_FIX.md) for details.

## How to Access CRUD Features

### Step 1: Open Database Tab
Navigate to the **Database** tab in the MCP Electron App.

### Step 2: Connect to Server
The app will automatically check the connection to the MCP database admin server (port 3010).
- Green indicator = Connected
- Red indicator = Not connected

### Step 3: List Tables
Click the **"List Tables"** button to load all available database tables.

### Step 4: Select a Table
Click on any table name in the left panel. This opens the table details view.

### Step 5: Switch to CRUD Tab
You'll see two tabs:
- **Schema**: Shows table structure (columns, types, constraints)
- **Data & CRUD**: Shows the full CRUD interface ← Click this!

## CRUD Features

### 1. Query Builder (READ)
Visual interface for building SELECT queries without writing SQL.

**Features:**
- **Column Selection**: Choose which columns to display
  - Select individual columns
  - Or select all columns (*)
- **WHERE Conditions**: Filter data with multiple conditions
  - AND/OR logic
  - Operators: `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `IN`
  - Add multiple conditions
- **ORDER BY**: Sort results
  - Choose column
  - Choose direction (ASC/DESC)
- **LIMIT/OFFSET**: Pagination controls
  - Set number of records per page
  - Navigate through pages

**Usage:**
1. Select columns to display
2. Add WHERE conditions (optional)
3. Set ORDER BY (optional)
4. Click "Execute Query"
5. Results appear in the Data Grid below

### 2. Data Grid (VIEW/EDIT/DELETE)
Displays query results in a formatted, interactive table.

**Features:**
- **View Data**: Results displayed in clean table format
- **Sort Columns**: Click column headers to sort
- **Select Rows**: Checkbox selection for bulk operations
- **Inline Edit**: Double-click cells to edit (if enabled)
- **Row Actions**: Edit or Delete individual rows
- **Pagination**: Navigate through large result sets
- **Export**: Export data to CSV or JSON (if implemented)

**Row-Level Operations:**
- **Edit Row**: Click edit button → Opens form → Modify values → Save
- **Delete Row**: Click delete button → Confirmation → Row deleted
- **Select Multiple**: Check boxes → Bulk delete

### 3. Insert New Records (CREATE)
Add new records to the table.

**Usage:**
1. Click **"Insert Row"** or **"Add Record"** button
2. Form appears with fields for all columns
3. Fill in values
4. Click **"Save"**
5. Record is inserted into the database

**Features:**
- Form validation
- Required field indicators
- Type-appropriate inputs (text, number, date, etc.)
- Cancel option

### 4. Update Records (UPDATE)
Modify existing records.

**Usage:**
1. Click **"Edit"** button on any row
2. Form appears pre-filled with current values
3. Modify values as needed
4. Click **"Save"**
5. Record is updated in the database

**Features:**
- Pre-filled form with current values
- Shows which fields can be edited
- Validation
- Cancel option

### 5. Delete Records (DELETE)

**Single Row Delete:**
1. Click **"Delete"** button on any row
2. Confirmation dialog appears
3. Confirm to delete
4. Record removed from database

**Bulk Delete:**
1. Select multiple rows using checkboxes
2. Click **"Delete Selected"** button
3. Confirmation dialog shows count
4. Confirm to delete all selected
5. Records removed from database

**Features:**
- Confirmation dialogs prevent accidental deletion
- Bulk operations for efficiency
- Soft delete support (if configured on server)

## MCP Tools Used

The CRUD interface uses these MCP database tools:

### Read Operations
- **`db_query_records`**: Execute SELECT queries
  - Parameters: `table`, `columns`, `where`, `orderBy`, `limit`, `offset`
  - Returns: Array of records + total count

- **`db_list_tables`**: Get list of all tables
  - Returns: Array of table names

- **`db_get_schema`**: Get table structure
  - Parameters: `table`, `includeConstraints`, `includeIndexes`
  - Returns: Column definitions, constraints, indexes

### Create Operations
- **`db_insert_record`**: Insert single record
  - Parameters: `table`, `data`, `returnRecord`
  - Returns: Inserted record (if requested)

- **`db_batch_insert`**: Insert multiple records
  - Parameters: `table`, `records[]`
  - Returns: Insert count

### Update Operations
- **`db_update_records`**: Update records
  - Parameters: `table`, `data`, `where`, `returnRecords`
  - Returns: Updated records (if requested)

- **`db_batch_update`**: Update multiple records
  - Parameters: `table`, `updates[]`
  - Returns: Update count

### Delete Operations
- **`db_delete_records`**: Delete records
  - Parameters: `table`, `where`, `softDelete`
  - Returns: Delete count

- **`db_batch_delete`**: Delete multiple sets of records
  - Parameters: `table`, `conditions[]`
  - Returns: Delete count

## Advanced Features

### Table Selector
Quick dropdown to switch between tables without going back to the list.

### Real-Time Status Messages
Activity log shows all operations with timestamps:
- Info messages (blue)
- Success messages (green)
- Warning messages (yellow)
- Error messages (red)

### Automatic Refresh
After insert/update/delete operations, the data grid automatically refreshes to show current data.

### Pagination
- Navigate large datasets efficiently
- Configurable page size (default 100 records)
- "First", "Previous", "Next", "Last" buttons
- Current page indicator

## Safety Features

### Confirmation Dialogs
All destructive operations (UPDATE, DELETE) require confirmation:
- Single delete: "Are you sure you want to delete this record?"
- Bulk delete: "Are you sure you want to delete N record(s)?"

### Error Handling
- Clear error messages for failed operations
- Transaction rollback on errors (server-side)
- Validation before sending to server

### Access Control
Server-side access control validates:
- Table access permissions
- Column visibility
- Operation permissions (READ, CREATE, UPDATE, DELETE)

## Component Architecture

The CRUD interface consists of these components:

1. **DatabaseTab**: Main container, manages views
2. **CRUDPanel**: Coordinates CRUD components
3. **TableSelector**: Table selection dropdown
4. **QueryBuilder**: Visual query builder
5. **DataGrid**: Results display and inline editing

### File Locations
```
src/renderer/components/
├── DatabaseTab.ts              # Main database tab
└── DatabaseAdmin/
    └── CRUD/
        ├── CRUDPanel.ts       # CRUD coordinator
        ├── TableSelector.ts   # Table selection
        ├── QueryBuilder.ts    # Query builder
        └── DataGrid.ts        # Data display/edit
```

## Known Limitations

### Current Issues
- ⏳ **MCP Server Bug**: The `http-sse-server.js` has a bug preventing tool execution
  - Error: "tool.handler is not a function"
  - See: [DATABASE_TAB_500_ERROR_FIX.md](DATABASE_TAB_500_ERROR_FIX.md)
  - Status: Waiting for upstream fix

### Design Limitations
- **No JOIN Support**: Single table queries only
- **Basic WHERE Clauses**: Complex nested conditions not supported in UI
- **No Raw SQL**: Interface only supports visual query building
  - For advanced queries, use another database client
- **File Upload**: Binary data (images, files) not supported in UI

## Future Enhancements

Planned features:
- [ ] Export to CSV/JSON
- [ ] Import from CSV/JSON
- [ ] Column filtering
- [ ] Search across all columns
- [ ] Saved queries
- [ ] Query history
- [ ] Keyboard shortcuts
- [ ] Batch edit mode
- [ ] Relationship visualization
- [ ] Foreign key navigation

## Troubleshooting

### CRUD Tab Not Appearing
**Problem**: Only Schema tab visible, no CRUD tab

**Solutions:**
1. Make sure you clicked on a table name first
2. Check that the table loaded successfully
3. Verify MCP server is connected (green indicator)
4. Check browser console for errors

### "List Tables" Button Not Working
**Problem**: Error when clicking "List Tables"

**Cause**: MCP server bug (tool.handler is not a function)

**Solution**: See [DATABASE_TAB_500_ERROR_FIX.md](DATABASE_TAB_500_ERROR_FIX.md)

### Changes Not Saving
**Problem**: Insert/Update operations fail

**Causes:**
1. Server-side validation errors
2. Required fields missing
3. Data type mismatches
4. Constraint violations (unique, foreign key)

**Solutions:**
1. Check error message in activity log
2. Verify all required fields are filled
3. Ensure data types match column definitions
4. Check foreign key constraints

### Slow Performance
**Problem**: Data grid loads slowly

**Solutions:**
1. Reduce LIMIT (page size)
2. Add WHERE clause to filter data
3. Add indexes on frequently queried columns (server-side)
4. Use pagination instead of loading all records

## Best Practices

### Query Optimization
- ✅ Use WHERE clauses to limit results
- ✅ Add appropriate LIMIT values
- ✅ Create indexes on frequently filtered columns
- ❌ Avoid loading entire large tables without filters

### Data Safety
- ✅ Always review WHERE conditions before UPDATE/DELETE
- ✅ Test updates on a single row first
- ✅ Use transactions for batch operations (server handles this)
- ❌ Don't bulk delete without careful review

### Performance
- ✅ Use pagination for large result sets
- ✅ Select only needed columns
- ✅ Use batch operations for multiple inserts/updates
- ❌ Don't repeatedly query the same data

## Support

For issues:
1. Check the activity log for error messages
2. Review [DATABASE_TAB_500_ERROR_FIX.md](DATABASE_TAB_500_ERROR_FIX.md)
3. Check browser console for JavaScript errors
4. Report bugs on the GitHub repository

---

**Last Updated:** 2025-11-21
**Status:** Implemented, awaiting MCP server fix
**Documentation:** Complete
