# FictionLab bug triage — 2026-07-04

User-reported issues, each verified against the codebase by Casey (code investigation,
not guesses). File:line pointers are to source as of this date. Ordered by
effort-vs-impact within each tier.

---

## Tier 1 — small fixes, high impact

### 1. Electron submenus don't work (menus visible, clicks do nothing)
**Root cause found.** The original menu template in `src/main/index.ts:86-250`
(`createMenu()`) is correct and self-contained — all `click:` handlers live in the main
process. But `updatePluginMenu()` in `src/main/plugin-manager.ts:179` (called on every
plugin load/activation at lines 112, 124, 148) rebuilds the app menu by passing live
`MenuItem` instances from `Menu.getApplicationMenu().items` back into
`Menu.buildFromTemplate()` (lines 257-281). `buildFromTemplate` expects plain
`MenuItemConstructorOptions`; feeding it live instances drops the submenu `click`
callbacks while keeping top-level labels visible. `role:`-based items (Edit/View) keep
working natively, which makes the breakage look partial.
**Fix:** keep the constructor-options template from `createMenu()` as the source of
truth; splice the Plugins submenu into *that* template and rebuild, instead of
round-tripping live `MenuItem` instances.

### 2. Genre packs dropdown is empty
**Root cause found — hardcoded stub.** The dropdown loads via `project:list-genre-packs`,
whose handler at `src/main/index.ts:2437-2442` **unconditionally returns `[]`** (comment:
"genre packs are no longer bundled with the Electron app"). Meanwhile two valid packs
exist at `C:\github\fictionlab-workflow\resources\genre-packs\` (`gothic-romance-horror`,
`urban-fantasy-police-procedural`), and a working scanner already exists:
`ResourceCopier.listAvailableGenrePacks()` (`resource-copier.ts:410-444`) — it's just
never called by the handler.
**Fix:** wire the handler to the existing scanner. Note the pack copy only happens at
workflow-run time (`resource-copier.ts:208-243`) and needs the pack id the dropdown
supplies, so fixing the list fixes the chain.

### 3. Workflow dashboard: duplicate buttons that do nothing
**Root cause found.** The TopBar declares `import` and `refresh` actions
(`src/renderer/views/WorkflowsViewReact.tsx:850-851`) that duplicate the working in-view
toolbar buttons — but their dispatcher `handleAction()` (lines 860-864) only does
`console.log`. These are the visible dead duplicates.
**Fix:** either wire `handleAction('import')`/`('refresh')` to `setShowImportDialog(true)`
/ `loadWorkflows(true)`, or remove the TopBar actions.
**Related dead code (cleanup, same PR or later):**
- The plugin-namespaced copies of `workflow:list-active/pause/resume/cancel/jump-to-node`
  in `fictionlab-workflow/packages/workflow-plugin/src/ipc-handlers.ts:139-186` are never
  invoked by the UI (it calls the non-namespaced main-app versions in
  `workflow-handlers.ts:671-753`).
- The entire `electronAPI.workflows.*` preload surface (`src/preload/preload.ts:2449-2526`,
  channels `workflows:list/get/execute/cancel/get-runs/delete/create/update`) has **no
  registered ipcMain handlers at all** — dead API.

---

## Tier 2 — medium efforts

### 4. Docker not detected at launch → "restart" prompt
**Root cause found — CLI-only, single-shot detection.** The launch gate
(`src/main/index.ts:2707-2786`) calls `checkDockerHealth()` (`src/main/docker.ts:421-491`),
which shells out to `docker info` / `docker ps` with a single 20s timeout and **no
retry, no dockerode ping, no named-pipe probe**. Failure modes on Windows:
- Cold WSL2 backend: first `docker info` after boot routinely exceeds 20s → classified
  unhealthy → gate fires the start/exit path.
- PATH shim (`prerequisites.ts:63-102`) only injects the default
  `C:\Program Files\Docker\...` paths — non-default installs make every exec check fail.
- The gate never checks `isDockerDesktopProcessRunning()` first, so a
  running-but-initializing Docker Desktop is treated as down.
- dockerode is already a dependency but only used post-launch (`update-manager.ts:9,41`).
**Desired flow is only partially implemented:** daemon check + auto-start + 60s wait
exist (`docker.ts:551-597`), but (a) Windows start opens the full GUI
(`docker.ts:145-154`) — Docker Desktop has no true headless mode; closest is launching
the exe with "Open Dashboard at startup" off so it goes to tray; (b) **container startup
is not in the launch gate at all** — `docker compose up` lives in
`startMCPSystem` (`mcp-system.ts:1117`) and only runs from the wizard/dashboard.
**Fix:** (1) probe the daemon with dockerode `.ping()` against
`//./pipe/docker_engine` with retries before falling back to CLI; (2) check the
Desktop process before declaring "not running"; (3) after daemon-up, run the postgres
container start + verify inside the launch sequence.

### 5. Port conflicts (Linux build failure) + no port visibility/edit UI
**Diagnosis confirmed:** default `POSTGRES_PORT` is 5432 (`env-config.ts:43`,
`docker-compose.yml:23-24`) and collides with a system Postgres on Linux.
**Surprise: detection already exists and is Linux-aware** —
`checkPortAvailable()` (`env-config.ts:302-338`, ss/netstat/lsof + dual-interface Node
probe) and `checkAllPortsAndSuggestAlternatives()` (`env-config.ts:436-531`). What's
missing is remediation outside the setup wizard:
- `startMCPSystem` aborts with `PORT_CONFLICT` (`mcp-system.ts:1007-1059`) instead of
  applying `suggestedConfig`; only the wizard's "Use Suggested Ports" button
  (`setup-wizard-handlers.ts:569-573`) applies it.
- Ports **3011 (NPE) and 3012 (Workflow Manager) are hardcoded** in
  `docker-compose.yml:94-95` and are NOT in the pre-flight probe list
  (`env-config.ts:451-456`) — collisions there surface only as compose
  "port is already allocated" errors.
- PgBouncer 6432 is effectively unchangeable (compose maps
  `${PGBOUNCER_PORT}:${PGBOUNCER_PORT}` and MCP servers hardwire
  `fictionlab-pgbouncer:6432`; warning comment at `mcp-system.ts:1037-1040`).
**Full port map** (host side): Postgres 5432, PgBouncer 6432, MCP Connector 51300,
HTTP/SSE 3001, DB-Admin 3010, NPE 3011*, Workflow Mgr 3012* (*hardcoded).
Note `formatEnvFile` (`env-config.ts:709-733`) doesn't persist all of these.
**Fix:** (1) auto-apply `suggestedConfig` in the non-wizard startup path (or at minimum
on Linux); (2) parameterize 3011/3012 in compose + add to the probe list; (3) add a
"Ports" settings panel that lists every port above with live in-use status (the probe
functions already exist) and lets the user edit + persist them.

### 6. TypingMind local-install remnants (dead checks + dead update button)
**Confirmed dead** (TypingMind is cloud-only now). Dead chain to remove:
- "Check for Updates" button: `src/renderer/views/SetupView.ts:122-126` →
  `SetupTab.ts:77-79, 281-350` → preload `preload.ts:1818-1840` → handlers
  `index.ts:1234-1236, 1265-1275` → `updater.ts:295-331, 813-885` (+ typingMind fields
  in `checkForAllUpdates` `updater.ts:339-374`).
- Entire `src/main/typingmind-downloader.ts` module + its 7 IPC handlers
  (`index.ts:840-914`) + preload bridges (`preload.ts:1200-1243, 289-354`).
- Local-container health cards + Start/Stop/Restart/Logs controls:
  `ServicesTab.ts:152-165, 324-381, 502-529`; `ServicesView.ts:55, 131-157`;
  LogsTab `typing-mind` option (`LogsTab.ts:34,120,1104-1108`).
- **Actively broken branch:** `mcp-system.ts:1201-1221` runs
  `docker compose up -d typingmind` — no such service exists in docker-compose.yml
  (would fail if `services.typingMind` were ever true). Contradicts its own comment at
  `mcp-system.ts:626-627`.
- `TYPING_MIND_PORT` (8080) reserved but unused: `env-config.ts:32,49`, wizard field
  `setup-wizard-handlers.ts:596,674,729`, `.env.test:17-20`.
- `config/setup-config.json` `typing-mind` clone entries (lines 26-29, 38, 42, 66-68,
  94-99) and `client-selection.ts:65-84` vestigial `repoUrl`.
**Keep (live cloud wiring):** the `@typingmind/mcp` connector (docker-compose.yml:52-68,
`docker/connector-entrypoint.sh`), `typingmind-auto-config.ts`, `mcp-config-generator.ts`
(fix stale "Open TypingMind at http://localhost:PORT" instruction strings at
`mcp-config-generator.ts:226`, `configure-typingmind.js:123`), the Open/Configure
buttons pointing at typingmind.com, and the `'typingmind'` workflow-source tag/badge.

### 7. IPC `-help` not set up
**Confirmed.** The only argv flag parsed anywhere is `--dev` (`index.ts:288,334,382`).
No commander/yargs/minimist, no `bin` field, no help channel. The IPC surface is ~20
groups of `ipcMain.handle` channels starting at `index.ts:430` with no
enumeration/introspection.
**Fix:** add an `ipcMain.handle('help', ...)` that returns the registered channel list
(collect channel names at registration time), and/or parse `--help` in main. The
run-workflow skill's `ipc-client.js` would be the immediate consumer.

---

## Tier 3 — larger features

### 8. Create-project doesn't create the folders Series Architect needs
**Confirmed mismatch.** `project:initialize-workspace` (`index.ts:2382-2431`) creates
`.claude/`, `planning/`, `planning/character-profiles/`, `planning/world-building/`,
`books/`, `exports/` — but the SA v2 pipeline writes everything under
**`{{projectFolder}}/outputs/`** (intake_form.md, series_bible.md, market_research.md,
genre_pack.json, series_framework.md, `outputs/book_N/…` — see
`FictIonLab-Downloads/workflows/series-architect-*/workflow.yaml` and
`dramatica-storyform/workflow.yaml:52-148`), and the SA agent also expects
`series-planning/` (`series-architect-agent.md:22,930`). None of the created folders
are used by SA; the ones SA is organized around are absent. The genre-pack step of
init is a log-only stub (`index.ts:2421-2423`).
Mitigating: SA file-writes self-create dirs (`file-operation-executor.ts:280`
`fs.ensureDir`), so writes don't fail — the breakage is reads of expected paths and
the scaffold being misleading. (`createDirectories` node flag is a no-op —
`WORKFLOW-FIXES.md:78`.)
**Fix:** align the init scaffold with the SA v2 layout (`outputs/`, `series-planning/`)
— cross-check the WutheringDragons testbed START-HERE.md checklist, which is the
canonical empty-project test for this exact flow.

### 9. No way to create a new workflow in-app (import only)
**Confirmed.** Toolbar offers Import/Export/Start/Refresh/Hide only
(`WorkflowsViewReact.tsx:657-692`); the canvas editor (`+ Add Node`, edge editing)
operates only on an existing workflow (`WorkflowCanvas.tsx:472,863,1005`); the latent
`electronAPI.workflows.create` stub (`preload.ts:2517` → `workflows:create`) has no
handler. Workflows must be authored externally (YAML/JSON) and imported
(`workflow:import-from-folder`, or the direct DB importer
`FictIonLab-Downloads/tools/import-workflow.js`).
**Fix:** a "New Workflow" button that creates a blank workflow row (name + empty
graph) and opens it in the existing canvas editor — most of the editing plumbing
(add-node/add-edge IPC in `workflow-handlers.ts:137-227`) already exists.

---

## Cross-cutting observations
- Several bugs share one shape: **a working implementation exists but the entry point
  is a stub** (genre packs handler returns `[]` while the scanner exists; port
  suggestion exists but startup won't apply it; TopBar actions log instead of dispatch;
  `workflows:create` exposed but unhandled). Grep for handler stubs before writing new
  code.
- The plugin menu rebuild (issue 1) and the duplicate plugin IPC registrations
  (issue 3) both come from the plugin layer re-wrapping app-level machinery — worth a
  design pass on what the plugin layer owns vs. delegates.
