# Claude Code Configuration

This directory contains configuration and hooks to help AI agents work efficiently on the FictionLab project.

## Session Start Hook

The `hooks/session-start.sh` script automatically runs when an AI agent starts a new session. It:

1. ✅ Checks Node.js version
2. ✅ Verifies dependencies (node_modules)
3. ✅ Auto-installs @types/node if missing (required for TypeScript)
4. ✅ Detects if build is needed
5. ✅ Compiles TypeScript and copies assets automatically
6. ✅ Displays project status and useful information

### Manual Execution

You can run the hook manually:

```bash
./.claude/hooks/session-start.sh
```

## Settings

The `settings.json` file provides comprehensive project context including:

- **Architecture Overview** - How the Electron app is structured
- **Key Directories** - What each folder contains
- **UI Structure** - Tab-based navigation details
- **Build Process** - How TypeScript compiles to JavaScript
- **Known Issues** - Common problems and solutions
- **IPC Channels** - Communication between processes
- **Database Features** - Admin tools organization
- **Development Workflow** - Best practices

## Quick Reference

### Project Structure

```
FictionLab/
├── src/
│   ├── main/           - Electron main process (backend)
│   ├── renderer/       - UI code (frontend)
│   │   ├── components/ - UI components (Tabs, etc.)
│   │   └── styles/     - CSS stylesheets
│   ├── preload/        - IPC bridge (security)
│   └── services/       - Business logic
├── dist/               - Compiled output (generated)
├── resources/          - Static assets
└── config/             - Configuration templates
```

### Essential Commands

```bash
npm run build    # Compile TypeScript + copy assets
npm run dev      # Build and run
npm start        # Run the app
npm run clean    # Remove build artifacts
```

### Critical Build Requirements

1. **@types/node** - Must be present for TypeScript compilation
2. **styles/ directory** - Must be copied to dist/ for UI styling
3. **All tabs** - Must compile successfully for proper navigation

### Build Output Verification

After running `npm run build`, verify:

```bash
# Check compiled components
ls dist/renderer/components/
# Should show: DashboardTab.js, DatabaseTab.js, ServicesTab.js, LogsTab.js, TabNavigation.js

# Check copied styles
ls dist/renderer/styles/
# Should show: tabs.css, schema.css

# Check main HTML
ls dist/renderer/index.html
# Should exist
```

## Common Issues

### Issue: "Cannot find type definition file for node"

**Solution:** Session start hook auto-fixes this, or manually run:
```bash
mkdir -p node_modules/@types
cd node_modules/@types
curl -sL https://registry.npmjs.org/@types/node/-/node-20.19.25.tgz | tar xz
mv package node || mv "node v20.19" node
cd ../..
```

### Issue: UI shows one long page instead of tabs

**Solution:** Build not completed. Run:
```bash
npm run build
```

Verify `dist/renderer/components/` contains `.js` files.

### Issue: Tab styling broken

**Solution:** CSS not copied. Ensure `scripts/copy-assets.js` includes:
```javascript
// Copy styles directory
const srcStyles = path.join(srcRenderer, 'styles');
const distStyles = path.join(distRenderer, 'styles');
// ... copy logic
```

## Tips for AI Agents

1. **Always check build status first** - The session hook does this automatically
2. **Verify dist/ after TypeScript changes** - Ensure code compiled successfully
3. **Tab components are key** - Most functionality is in src/renderer/components/
4. **Database features are modular** - Located in DatabaseAdmin/ subdirectories
5. **IPC is the bridge** - Main/Renderer communicate via IPC channels
6. **Build before testing** - TypeScript must compile for changes to take effect

## Git Workflow

- Feature branches: `claude/<feature-name>-<session-id>`
- Always build before committing
- Test that the app runs before pushing
- Use conventional commits: `feat:`, `fix:`, `docs:`, etc.

## Architecture at a Glance

```
┌─────────────────────────────────────────┐
│        Renderer Process (UI)            │
│  ┌───────────────────────────────────┐  │
│  │     Tab Navigation System         │  │
│  │  Dashboard | Setup | Database |   │  │
│  │  Services  | Logs                 │  │
│  └───────────────────────────────────┘  │
│                  ↕ IPC                   │
│  ┌───────────────────────────────────┐  │
│  │        Preload Bridge             │  │
│  │     (Secure IPC exposure)         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                  ↕ IPC
┌─────────────────────────────────────────┐
│         Main Process (Backend)          │
│  ┌───────────────────────────────────┐  │
│  │        IPC Handlers               │  │
│  │   Docker | Database | MCP | etc.  │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │          Services                 │  │
│  │  Docker Management | DB Ops | ... │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────┐
│       Docker Containers                 │
│  PostgreSQL | MCP Servers | Typing Mind │
└─────────────────────────────────────────┘
```

## Getting Help

- Check `settings.json` for comprehensive project details
- Run session start hook for automatic environment setup
- Review main README.md for user-facing documentation
- Inspect TypeScript source for implementation details
