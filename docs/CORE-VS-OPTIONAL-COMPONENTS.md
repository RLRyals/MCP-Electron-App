# Core vs. Optional Components

FictionLab's core promise: set up Docker, the database, and the local
TypingMind MCP Connector container -- with **zero plugins installed**.
Plugins (workflow, kanban, ...) add capability on top of that core; they are
never required for the app to install, boot, and be usable. This is enforced
by `e2e/pluginless.spec.ts` (bead mea-eed), which launches the app with an
empty/absent plugins directory and fails if a core screen ends up with a
dangling reference to a plugin-owned view.

## Core (bare install -- no plugins)

Everything below installs and starts with zero plugins present. Container
list is the authoritative source: `docker-compose.yml` at the repo root.

| Component | Container name | Role |
|---|---|---|
| PostgreSQL | `fictionlab-postgres` | Primary datastore for the app and all MCP servers |
| PgBouncer | `fictionlab-pgbouncer` | Connection pooling in front of PostgreSQL |
| MCP Writing Servers | `fictionlab-mcp-servers` | The set of MCP servers (DB admin, NPE, workflow manager, outline, kanban, etc. -- see `mcp-writing-servers` service definition) that the connector fronts |
| MCP Connector | `fictionlab-mcp-connector` | The **local** TypingMind MCP Connector (`@typingmind/mcp`), listening on `:50880`, that bridges MCP clients to the writing servers. This is the local Docker container the Electron app orchestrates -- not TypingMind's cloud connector. |

Core renderer surfaces that must always be reachable pluginless:

- **Dashboard** (`data-view-id="dashboard"`) -- Running/Next/Blocked cockpit
- **Settings > Setup** (`data-view-id="settings-setup"`) -- the setup-wizard path (Docker/client detection, env config)
- **Settings > Database** (`data-view-id="settings-database"`)
- **Settings > Services** (`data-view-id="settings-services"`) -- the container list above, with start/stop/restart controls and live status
- **Settings > Logs** (`data-view-id="settings-logs"`)
- **Plugins** (`data-view-id="plugins"`) -- browse/install plugins from here; this is how a bare install gains optional capability
- **Help** / **About**

The sidebar (`src/renderer/components/Sidebar.ts`, `createNavigationTree()`)
only ever adds the following on top of the list above, and only when the
corresponding plugin is actually installed and active:

- a `workflows` nav entry (host-bundled `WorkflowsViewReact`), gated on
  `fictionlab-workflow` being installed
- one nav entry per plugin-provided view (`plugin-<id>`), populated from
  each active plugin's manifest by `Sidebar.setPluginNavItems()`

## Optional (added by plugins)

| Plugin | Adds |
|---|---|
| `fictionlab-workflow` | The Workflows nav view/tab (FictionLab workflow execution UI) |
| `fictionlab-kanban` | The Kanban board view (plugin-owned since `fictionlab-workflow` 1.1.0's containment migration -- the app no longer host-bundles this view; the plugin ships its own renderer bundle, loaded via `pluginViewLoader`) |

Plugins are discovered from `{userData}/plugins` (see `plugin-loader.ts`,
`plugin-manager.ts`) and require the database to be initialized before
`pluginManager.initialize()` runs discovery/activation -- this is why the
pluginless E2E profile (which skips the Docker/DB readiness gate, see
`e2e/smoke.spec.ts`'s header comment) never calls it: with no plugins
present the observed behavior is identical either way (`pluginManager.
getAllPlugins()` returns `[]` regardless of whether discovery ran against an
empty directory or was skipped entirely).

## Containment rule

Plugin-specific code (including UI views) lives in the plugin package, not
in this app. A hard/static reference from core code to a plugin-owned
module is the regression class `e2e/pluginless.spec.ts` guards against --
it would either throw during renderer module evaluation (caught by the
zero-console-error assertion during boot) or leave a dangling nav entry /
"plugin not found" text on a core screen (caught by the sidebar and
Services/Setup assertions).
