# FictionLab Build Architecture

This document explains how FictionLab is built from multiple repositories and when you need to rebuild or reinstall components.

## Repository Overview

FictionLab is built from **three repositories**:

| Repository | Purpose | GitHub Actions |
|------------|---------|----------------|
| **MCP-Electron-App** | Main Electron desktop app | Yes (build + release) |
| **fictionlab-workflow** | Workflow execution packages | No (local builds only) |
| **MCP-Writing-Servers** | Database and MCP servers | Docker builds |

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FictionLab Architecture                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────┐                                               │
│   │  MCP-Electron-App   │ ◄─── Electron desktop app                     │
│   │  (GitHub Actions)   │      - Builds installers (.exe, .dmg, .deb)   │
│   └─────────┬───────────┘      - Contains plugin system                 │
│             │                                                            │
│             │ installs plugin via                                        │
│             │ userData/plugins/                                          │
│             ▼                                                            │
│   ┌─────────────────────┐                                               │
│   │ fictionlab-workflow │ ◄─── Workflow execution engine                │
│   │   (Local builds)    │      - @fictionlab/workflow-plugin            │
│   │                     │      - @fictionlab/workflow-runner            │
│   │                     │      - resources/ (agents, skills, genres)    │
│   └─────────┬───────────┘                                               │
│             │                                                            │
│             │ communicates via                                           │
│             │ JSON-RPC / IPC                                             │
│             ▼                                                            │
│   ┌─────────────────────┐                                               │
│   │ MCP-Writing-Servers │ ◄─── Database and MCP tools                   │
│   │   (Docker builds)   │      - PostgreSQL + PgBouncer                 │
│   │                     │      - MCP servers (ports 3001-3012)          │
│   └─────────────────────┘                                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Build Pipelines

### 1. MCP-Electron-App (Electron Desktop App)

**Location:** `c:\github\MCP-Electron-App`

#### GitHub Actions Workflows

| Workflow | Trigger | What It Does |
|----------|---------|--------------|
| `build.yml` | Push/PR to main/develop | Builds app for all platforms, uploads artifacts |
| `release.yml` | Git tag `v*.*.*` or manual | Creates GitHub Release with installers |

#### Local Build Commands

```bash
# Install dependencies
npm ci

# Build TypeScript and copy assets
npm run build

# Package for specific platform
npm run package:win    # Windows .exe
npm run package:mac    # macOS .dmg
npm run package:linux  # Linux .AppImage/.deb
```

#### Output Artifacts

Built installers go to `/out` directory:
- Windows: `FictionLab-Setup-x.x.x.exe`
- macOS: `FictionLab-x.x.x.dmg`, `FictionLab-x.x.x-mac.zip`
- Linux: `FictionLab-x.x.x.AppImage`, `fictionlab_x.x.x_amd64.deb`

---

### 2. fictionlab-workflow (Workflow Engine)

**Location:** `c:\github\fictionlab-workflow`

#### Package Structure (npm workspaces)

```
fictionlab-workflow/
├── packages/
│   ├── types/              → @fictionlab/types (shared TypeScript types)
│   ├── workflow-runner/    → @fictionlab/workflow-runner (execution engine)
│   └── workflow-plugin/    → @fictionlab/workflow-plugin (Electron plugin)
└── resources/              → Canonical agents, skills, genre-packs, templates
```

#### Local Build Commands

```bash
# Install all workspace dependencies
npm install

# Build all packages (in dependency order)
npm run build

# Clean build artifacts
npm run clean

# Run tests
npm run test
```

#### Build Order (Automatic)

The build script compiles packages in dependency order:
1. `@fictionlab/types` (no dependencies)
2. `@fictionlab/workflow-runner` (depends on types)
3. `@fictionlab/workflow-plugin` (depends on runner + types)

---

### 3. Plugin Installation

The workflow plugin is installed into the Electron app's plugin directory:

```
Windows: %APPDATA%\FictionLab\plugins\fictionlab-workflow\
macOS:   ~/Library/Application Support/FictionLab/plugins/fictionlab-workflow/
Linux:   ~/.config/FictionLab/plugins/fictionlab-workflow/
```

#### How Plugins Are Discovered

1. FictionLab starts and calls `PluginRegistry.discoverAndLoadAll()`
2. Scans `{userData}/plugins/` for directories with `manifest.json`
3. Validates each plugin's manifest and dependencies
4. Loads plugins in dependency order
5. Calls `plugin.activate(context)` for each plugin

#### Plugin IPC Prefix

The workflow plugin registers IPC handlers with prefix `plugin:fictionlab-workflow:`:
- `plugin:fictionlab-workflow:workflow:list`
- `plugin:fictionlab-workflow:workflow:execute`
- `plugin:fictionlab-workflow:workflow:get`
- etc.

---

## When Do I Need To Rebuild/Reinstall?

### Scenario Decision Matrix

| Change Made | Rebuild fictionlab-workflow? | Reinstall Plugin? | Rebuild MCP-Electron-App? |
|-------------|------------------------------|-------------------|---------------------------|
| Changed agent `.md` file | No | **YES** (copy to plugin) | No |
| Changed skill `.md` file | No | **YES** (copy to plugin) | No |
| Changed genre-pack content | No | **YES** (copy to plugin) | No |
| Changed workflow-runner TypeScript | **YES** | **YES** | No |
| Changed workflow-plugin TypeScript | **YES** | **YES** | No |
| Changed Electron app UI | No | No | **YES** |
| Changed Electron main process | No | No | **YES** |
| Changed plugin manifest.json | No | **YES** | No |
| Added new IPC handler to plugin | **YES** | **YES** | No |
| Added new IPC handler to Electron | No | No | **YES** |

### Quick Reference Commands

#### After changing resources (agents/skills/genre-packs):

```bash
# Resources are now in fictionlab-workflow/resources/
# They get copied to project folders when workflows run (via ResourceCopier)
# No reinstall needed - they're copied on-demand

# However, if you want to test manually:
cd c:\github\fictionlab-workflow
npm run build
# Then copy the built plugin to userData/plugins/
```

#### After changing workflow-plugin or workflow-runner:

```bash
# 1. Rebuild fictionlab-workflow
cd c:\github\fictionlab-workflow
npm run build

# 2. Reinstall the plugin
# Option A: Use FictionLab UI (Services tab → Plugins → Reinstall)
# Option B: Manually copy:
#   From: fictionlab-workflow/packages/workflow-plugin/
#   To:   %APPDATA%/FictionLab/plugins/fictionlab-workflow/
```

#### After changing MCP-Electron-App:

```bash
cd c:\github\MCP-Electron-App
npm run build

# For quick testing (development mode):
npm start

# For full package testing:
npm run package:win  # or :mac or :linux
```

---

## Resource Flow (New Architecture)

As of the recent changes, resources (agents, skills, genre-packs, templates) now flow like this:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Resource Flow                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   fictionlab-workflow/resources/                                 │
│   ├── agents/           ◄─── Canonical source (15 agents)       │
│   ├── skills/           ◄─── Canonical source (8 skills)        │
│   ├── genre-packs/      ◄─── Canonical source (2 packs)         │
│   └── templates/        ◄─── Canonical source (3 templates)     │
│            │                                                     │
│            │ When workflow executes,                             │
│            │ ResourceCopier extracts referenced                  │
│            │ resources and copies them                           │
│            ▼                                                     │
│   {projectFolder}/.claude/                                       │
│   ├── agents/           ◄─── Only agents used by workflow       │
│   ├── skills/           ◄─── Only skills used by workflow       │
│   ├── genre-packs/      ◄─── Only if genrePack specified        │
│   └── templates/        ◄─── Always copied                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Resources are NO LONGER bundled in MCP-Electron-App
- Resources are copied to project folders ON-DEMAND when workflows run
- Only referenced resources are copied (not all)
- User customizations in project folders are preserved (no overwrite)

---

## Common Issues & Solutions

### "Plugin not found" or "workflow:list failed"

**Cause:** Plugin not installed or failed to activate.

**Solution:**
1. Check if plugin directory exists: `%APPDATA%/FictionLab/plugins/fictionlab-workflow/`
2. Check if `manifest.json` exists in that directory
3. Restart FictionLab
4. Check logs in Services → Logs tab

### "Agent not found" when running workflow

**Cause:** ResourceCopier couldn't find the agent in `fictionlab-workflow/resources/agents/`.

**Solution:**
1. Verify agent exists: `fictionlab-workflow/resources/agents/{agent-name}.md`
2. Rebuild fictionlab-workflow: `npm run build`
3. Reinstall plugin

### "Workflow definition not found"

**Cause:** MCP server not running or workflow not imported.

**Solution:**
1. Check Docker containers are running: `docker ps`
2. Import workflow via FictionLab UI
3. Check database connection

### Changes not reflecting after build

**Cause:** Old plugin still loaded in memory.

**Solution:**
1. Fully quit FictionLab (not just close window)
2. Reinstall plugin
3. Restart FictionLab

---

## Version Compatibility

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| Node.js | 20.x | Required for builds |
| Electron | 28.x | Peer dependency of workflow-plugin |
| Docker | 20.x+ | For MCP servers |
| PostgreSQL | 16.x | In Docker container |

---

## Development Workflow

### Recommended Setup

1. Clone all three repos as siblings:
   ```
   github/
   ├── MCP-Electron-App/
   ├── fictionlab-workflow/
   └── MCP-Writing-Servers/
   ```

2. Install dependencies in each:
   ```bash
   cd MCP-Electron-App && npm ci
   cd ../fictionlab-workflow && npm install
   ```

3. Build workflow packages first:
   ```bash
   cd fictionlab-workflow && npm run build
   ```

4. Copy plugin to FictionLab (or use symlink for dev):
   ```bash
   # Windows example
   xcopy /E /I packages\workflow-plugin %APPDATA%\FictionLab\plugins\fictionlab-workflow
   ```

5. Start FictionLab in dev mode:
   ```bash
   cd MCP-Electron-App && npm start
   ```

### Hot Reload Limitations

- **Electron main process:** Requires restart
- **Renderer (React UI):** Hot reload works via Vite
- **Plugins:** Require full restart (no hot reload)
- **MCP servers:** Docker containers need restart

---

## Release Process

### Creating a New Release

1. **Update version numbers:**
   - `MCP-Electron-App/package.json`
   - `fictionlab-workflow/package.json` (and sub-packages)

2. **Commit and push changes:**
   ```bash
   git add .
   git commit -m "chore: bump version to x.x.x"
   git push
   ```

3. **Create and push tag (triggers release workflow):**
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. **GitHub Actions will:**
   - Build for Windows, macOS, Linux
   - Generate checksums
   - Create GitHub Release with installers
   - Auto-generate changelog from commits

### Pre-release Versions

Use semantic versioning suffixes:
- `v1.2.3-alpha.1` → Pre-release
- `v1.2.3-beta.1` → Pre-release
- `v1.2.3-rc.1` → Release candidate
- `v1.2.3` → Stable release
