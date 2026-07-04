# [Feature] IPC help/introspection — `help` channel enumerating registered channels + `--help` CLI flag

**Labels:** enhancement, ipc, help, complexity: low

## Context (verified)
There is no way to discover the app's IPC surface or CLI flags:
- The only argv flag parsed anywhere is `--dev` (`src/main/index.ts:288,334,382`). No commander/yargs/minimist, no `bin` field in package.json — `-help`/`--help` do nothing.
- The IPC surface is ~20 groups of `ipcMain.handle` channels registered flat in `setupIPC()` (first handler `'ping'` at `src/main/index.ts:430`; groups include `window:*`, `prerequisites:*`, `logger:*`, `env:*`, `docker:*`, `wizard:*`, `client:*`, plugin/build/LLM channels, plus `workflow:*` in `src/main/handlers/workflow-handlers.ts` and plugin-namespaced channels via `src/main/plugin-context.ts:742`). Nothing enumerates them.
- External consumers exist: the `run-workflow` skill drives the app via `ipc-client.js` and has no discovery mechanism.

## Implementation plan
1. **Registration wrapper:** add a small module (e.g. `src/main/ipc-registry.ts`) exporting `registerHandler(channel, description, handler)` that calls `ipcMain.handle(channel, handler)` AND records `{channel, description}` in a registry array. Migrate registrations to it incrementally — start by wrapping `ipcMain.handle` calls in `setupIPC()` and `workflow-handlers.ts` mechanically (description can default to `''`; fill in the important ones). Plugin-namespaced registrations go through `plugin-context.ts:742` — hook the registry there too so plugin channels are captured with their `plugin:<id>:` prefix.
2. **`help` channel:** `registerHandler('help', ...)` returning the sorted registry: `[{channel, description, source: 'app'|'plugin:<id>'}]`. Include a `help <prefix>` filter arg (e.g. `help('docker')` → only `docker:*`).
3. **`--help` flag:** in the main entry before `app.whenReady()`, if `process.argv` includes `--help` or `-help`, print usage (app name/version, supported flags: `--dev`, `--help`) plus a note that IPC channel listing is available via the `help` IPC channel, then `app.quit()` / `process.exit(0)`. Note: a packaged Electron app can't print to the parent console on Windows without attach tricks — write to stdout anyway (works when launched from a shell in dev; document the limitation).
4. **Wire the external client:** if in scope, add a `help` verb to the run-workflow skill's `ipc-client.js` consumer path (that client lives at `~/.claude/skills/run-workflow/ipc-client.js` outside this repo — at minimum, ensure the channel it would call exists and is documented in this repo's README/docs).

## Acceptance criteria
- [ ] Invoking the `help` IPC channel returns every registered channel, including plugin-namespaced ones, with descriptions for at least the `workflow:*`, `docker:*`, `env:*`, and `project:*` groups.
- [ ] `help('workflow')` (or equivalent filter arg) returns only matching channels.
- [ ] `electron . --help` in dev prints usage and exits 0 without opening a window.
- [ ] No behavior change for any existing channel (wrapper is pass-through).
- [ ] `npm run build` + tests pass.

## Gotchas
- Don't try to introspect `ipcMain` internals for already-registered channels — Electron doesn't expose a supported handler list; the registry wrapper is the reliable way.
- Renderer-exposed API (preload contextBridge) is a separate surface from main-process channels; the help output should reflect main-process channels (what an IPC client can actually call).
