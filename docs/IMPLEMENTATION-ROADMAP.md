# FictionLab Tab-Based Redesign - Implementation Roadmap

## Overview

This document provides a roadmap for redesigning FictionLab from a single-page scrollable layout to a modern tab-based interface with integrated database admin tools.

**GitHub Issues Created:** 12 issues ready for parallel development
**View Issues:** https://github.com/RLRyals/MCP-Electron-App/issues

---

## Tab Structure Design

### Final Tab Organization

```
┌─────────────────────────────────────────────────────────┐
│ [Dashboard] [Setup] [Database] [Services] [Logs]        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│         Content area for selected tab                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Tab Breakdown

#### 1. **Dashboard Tab** (Default)
**Purpose:** Quick overview and common actions

**Content:**
- System status indicator (green/yellow/red)
- Quick actions: Start/Stop/Restart System
- **Prominent "Open Typing Mind" button**
- Service status summary cards (simplified):
  - PostgreSQL: Status + Port
  - MCP Servers: Status + Version
  - Typing Mind: Status + "Open" button
- Recent activity (last 5 events)
- Error notifications

**Key Difference from Services Tab:** Dashboard shows *summary view*, Services tab shows *detailed controls*

#### 2. **Setup Tab**
**Purpose:** One-time configuration and ongoing updates

**Content:**
- **Client Setup Section:**
  - Install/Configure Typing Mind
  - Configure Claude Desktop
  - Client selection checkboxes

- **Update Tools Section:**
  - Update MCP-Writing-Servers (git pull)
  - Update Typing Mind
  - Check for FictionLab updates
  - Show current versions

- **Prerequisites Check:**
  - Docker Desktop status
  - Git installation
  - WSL status (Windows only)
  - Disk space check

#### 3. **Database Tab**
**Purpose:** Database management and admin tools

**Content:**
- **Quick Backup/Restore Actions**
- **Database Admin Tools** (NEW):
  - CRUD Operations Panel (query builder, data grid)
  - Batch Operations (CSV upload, bulk insert/update/delete)
  - Schema Explorer (tables, relationships, ERD)
  - Audit Logs Viewer
  - Backup Management (create, restore, list backups)

#### 4. **Services Tab**
**Purpose:** Detailed service monitoring and control

**Content:**
- **Detailed Service Cards:**
  - PostgreSQL: Start/Stop/Restart, logs, connection info
  - MCP Servers: Individual server status, start/stop, logs
  - Typing Mind: Start/Stop/Restart, logs, open browser
  - Docker Desktop: Status, start/stop, health check
- **Resource Monitoring:** CPU/Memory usage per service
- **Quick Log Viewer:** Per-service log access

#### 5. **Logs Tab**
**Purpose:** Troubleshooting and diagnostics

**Content:**
- **Application Logs:**
  - Real-time log viewer
  - Filter by level (error, warn, info, debug)
  - Search functionality
  - Export logs

- **Service Log Selector:**
  - Dropdown to switch between services
  - PostgreSQL, MCP Servers, Typing Mind, Docker logs

- **Diagnostics Tools:**
  - Run system test
  - Export diagnostic report
  - Clear logs
  - Open logs folder

---

## GitHub Issues Summary

### Phase 0: Quick Fixes (Can Start Immediately)

| Issue # | Title | Priority | Estimated Time |
|---------|-------|----------|----------------|
| #121 | Desktop Taskbar Icon Appears Too Small | High | 30 mins |
| #122 | Typing Mind Right-Click Context Menu Not Working | High | 1 hour |

**Can be worked on immediately by any agent**

### Phase 1: Tab Navigation Foundation (Week 1-2)

| Issue # | Title | Dependencies | Estimated Time |
|---------|-------|--------------|----------------|
| #131 | Implement Tab-Based Navigation System | None | 2-3 days |
| #132 | Migrate Dashboard Card to Dashboard Tab | #131 | 2-3 days |
| #123 | Create Setup Tab | #131 | 2 days |
| #124 | Create Services Tab | #131 | 2 days |
| #125 | Create Logs Tab | #131 | 2 days |

**Development Strategy:**
1. Start with #131 (Tab Navigation) - **FOUNDATION**
2. Once #131 is complete, #132, #123, #124, #125 can be done **IN PARALLEL**

### Phase 2: Database Admin Tools (Week 3-5)

| Issue # | Title | Dependencies | Estimated Time |
|---------|-------|--------------|----------------|
| #126 | Database Tab Foundation and IPC Handlers | #131 | 2-3 days |
| #127 | Database CRUD Operations UI | #126 | 3-4 days |
| #128 | Database Batch Operations UI | #126 | 3-4 days |
| #129 | Database Schema Explorer UI | #126 | 3-4 days |
| #130 | Database Backup Management UI | #126 | 2-3 days |

**Development Strategy:**
1. Start with #126 (Database Foundation) - **FOUNDATION**
2. Once #126 is complete, #127, #128, #129, #130 can be done **IN PARALLEL**

---

## Parallel Development Strategy

### Week 1-2: Foundation + Bug Fixes

**Simultaneous Work:**
- **Agent 1:** #131 - Tab Navigation System (CRITICAL PATH)
- **Agent 2:** #121 - Icon Fix
- **Agent 3:** #122 - Context Menu Fix

**Once #131 is complete:**

### Week 2-3: Tab Migration (All Parallel)

- **Agent 1:** #132 - Dashboard Tab
- **Agent 2:** #123 - Setup Tab
- **Agent 3:** #124 - Services Tab
- **Agent 4:** #125 - Logs Tab

### Week 3-4: Database Foundation

**Sequential Work:**
- **Agent 1:** #126 - Database Tab Foundation (IPC handlers)

**Once #126 is complete:**

### Week 4-6: Database Admin UI (All Parallel)

- **Agent 1:** #127 - CRUD Operations
- **Agent 2:** #128 - Batch Operations
- **Agent 3:** #129 - Schema Explorer
- **Agent 4:** #130 - Backup Management

---

## Technical Architecture

### New File Structure

```
src/
├── main/
│   ├── ipc/
│   │   └── databaseHandlers.ts          # NEW: Database admin IPC handlers
│   └── index.ts                          # MODIFY: Register new handlers
│
├── renderer/
│   ├── components/
│   │   ├── TabNavigation.ts              # NEW: Tab system
│   │   ├── DashboardTab.ts               # NEW: Dashboard content
│   │   ├── SetupTab.ts                   # NEW: Setup content
│   │   ├── DatabaseTab.ts                # NEW: Database content
│   │   ├── ServicesTab.ts                # NEW: Services content
│   │   ├── LogsTab.ts                    # NEW: Logs content
│   │   │
│   │   └── DatabaseAdmin/                # NEW: Database admin components
│   │       ├── CRUD/
│   │       │   ├── CRUDPanel.ts
│   │       │   ├── QueryBuilder.ts
│   │       │   └── DataGrid.ts
│   │       ├── Batch/
│   │       │   ├── BatchPanel.ts
│   │       │   └── CSVUploader.ts
│   │       ├── Schema/
│   │       │   ├── SchemaExplorer.ts
│   │       │   └── TableDetails.ts
│   │       ├── Backup/
│   │       │   ├── BackupManager.ts
│   │       │   └── BackupWizard.ts
│   │       └── Shared/
│   │           ├── ConnectionStatus.ts
│   │           └── TableSelector.ts
│   │
│   ├── services/
│   │   └── databaseService.ts            # NEW: Database operations wrapper
│   │
│   ├── styles/
│   │   └── tabs.css                      # NEW: Tab styling
│   │
│   ├── index.html                        # MODIFY: Restructure for tabs
│   └── renderer.ts                       # MODIFY: Initialize tabs
│
└── preload/
    └── preload.ts                        # MODIFY: Add database IPC channels
```

### Integration with MCP-Writing-Servers

**Connection:**
- MCP-Writing-Servers runs on port 3010 (configurable)
- Provides 25 database admin tools via MCP protocol
- Tools accessible via JSON-RPC calls

**Tool Categories:**
- CRUD Operations (4 tools)
- Batch Operations (3 tools)
- Schema Tools (4 tools)
- Audit Tools (2 tools)
- Backup/Restore (12 tools)

**Communication Flow:**
```
Renderer (UI)
  → IPC Call
    → Main Process (databaseHandlers.ts)
      → HTTP Request to MCP-Writing-Servers
        → Database Operations
```

---

## Bug Fixes Included

### 1. Desktop Taskbar Icon Too Small (#121)

**Problem:** Icon appears smaller than other apps in Windows taskbar

**Solution:**
1. Ensure icon.ico contains sizes: 16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256
2. Use electron-icon-builder with 1024x1024 source
3. Set app user model ID: `app.setAppUserModelId('net.fictionlab.studio')`
4. Clear Windows icon cache after rebuild

### 2. Typing Mind Right-Click Menu Not Working (#122)

**Problem:** Context menu (needed for spell check) doesn't appear

**Solution:**
Add context menu handler to Typing Mind window:

```typescript
typingMindWindow.webContents.on('context-menu', (event, params) => {
  if (params.isEditable || params.selectionText) {
    const menu = new Menu();
    // Add spelling suggestions
    if (params.misspelledWord) {
      params.dictionarySuggestions.forEach(suggestion => {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => typingMindWindow.webContents.replaceMisspelling(suggestion)
        }));
      });
    }
    menu.append(new MenuItem({ label: 'Cut', role: 'cut' }));
    menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
    menu.append(new MenuItem({ label: 'Paste', role: 'paste' }));
    menu.popup();
  }
});
```

---

## Testing Strategy

### Unit Testing
- Each tab component independently
- Database service methods
- IPC handler responses

### Integration Testing
- Tab switching
- IPC communication main ↔ renderer
- Database tool invocation
- Service status updates

### E2E Testing
- Complete user workflows
- Start system → Use Typing Mind
- Create database backup → Restore
- CRUD operations on test data

### Performance Testing
- Tab switching speed
- Large data grid rendering
- Batch operation handling (1000+ records)
- Memory usage monitoring

---

## Success Criteria

### Phase 1 Complete When:
- [ ] All 5 tabs implemented and functional
- [ ] Tab navigation smooth and responsive
- [ ] All existing features migrated to tabs
- [ ] No regression in functionality
- [ ] Icon and context menu bugs fixed

### Phase 2 Complete When:
- [ ] All 25 database tools accessible via UI
- [ ] CRUD operations work correctly
- [ ] Batch operations handle 100+ records
- [ ] Schema explorer shows relationships
- [ ] Backup/restore functional
- [ ] Error handling comprehensive

### Overall Success:
- [ ] Non-technical users can navigate easily
- [ ] All features from original design work
- [ ] Performance meets targets (<2s query response)
- [ ] UI responsive on all screen sizes
- [ ] Documentation complete

---

## Risk Mitigation

### Potential Issues:

1. **Breaking Existing Functionality**
   - Mitigation: Keep old code until new tabs verified
   - Use feature flags if needed

2. **IPC Handler Conflicts**
   - Mitigation: Namespace all database handlers with 'db:' prefix
   - Document all channels in preload.ts

3. **Large Data Grid Performance**
   - Mitigation: Implement virtual scrolling
   - Pagination for results over 100 rows

4. **MCP Server Connection Issues**
   - Mitigation: Health check before operations
   - Clear error messages for connection failures
   - Retry logic with exponential backoff

---

## Next Steps

1. **Immediate Actions:**
   - Assign issues to Claude Code Web Agents
   - Start with Phase 0 bug fixes (#121, #122)
   - Begin Phase 1 foundation (#131)

2. **Monitor Progress:**
   - Track issue status on GitHub
   - Test each PR before merging
   - Update this roadmap as needed

3. **Documentation:**
   - Update user guide with new tab structure
   - Document database admin tool usage
   - Create troubleshooting guide

---

**Document Version:** 1.0
**Last Updated:** 2025-01-18
**Status:** Ready for Implementation
**Total Issues:** 12
**Estimated Timeline:** 6-8 weeks
