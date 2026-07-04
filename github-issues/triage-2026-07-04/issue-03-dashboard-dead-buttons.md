# [BUG] Workflow dashboard: TopBar Import/Refresh buttons are no-op duplicates; dead `workflows:*` API surface

**Labels:** bug, ui, cleanup, ipc, complexity: low

## Symptom
The workflow dashboard shows Import and Refresh buttons in two places. The in-view toolbar buttons work; the TopBar copies do nothing when clicked.

## Root cause (verified — do not re-investigate)
1. **TopBar no-ops:** `getTopBarConfig()` in `src/renderer/views/WorkflowsViewReact.tsx:846-864` declares actions `{id:'import'}` and `{id:'refresh'}` (lines 850-851), duplicating the working toolbar buttons at lines 658 and 678. Their dispatcher `handleAction(actionId)` (lines 860-864) **only calls `console.log`** — no dispatch.
2. **Dead API surface:** `src/preload/preload.ts:2449-2526` exposes `electronAPI.workflows.*` invoking channels `workflows:list/get/execute/cancel/get-runs/delete/create/update` (plural namespace). **No `ipcMain.handle` exists for ANY `workflows:*` channel** — the entire surface is dead.
3. **Duplicate plugin IPC registrations (dead):** the plugin registers namespaced copies of the active-workflow controls in `fictionlab-workflow/packages/workflow-plugin/src/ipc-handlers.ts` — `workflow:list-active` (:139), `pause` (:150), `resume` (:162), `cancel` (:174), `jump-to-node` (:186). The dashboard actually calls the non-namespaced main-app versions in `src/main/handlers/workflow-handlers.ts:671-753` (call sites: `WorkflowManagerPanel.tsx:91,186,196,208,216`; `WorkflowsViewReact.tsx:467`). The plugin copies are registered but never invoked by any UI.

## Implementation plan
1. **Fix the TopBar buttons** (preferred over removing them): in `WorkflowsViewReact.tsx` `handleAction()`, dispatch `'import'` → `setShowImportDialog(true)` and `'refresh'` → `loadWorkflows(true)` — the same functions the toolbar buttons call (lines 658, 678). If the team prefers a single location instead, delete the two TopBar action declarations (lines 850-851) — pick ONE, don't leave both unwired.
2. **Delete the dead `electronAPI.workflows.*` surface** in `src/preload/preload.ts:2449-2526` and any renderer type declarations referencing it. Grep for `electronAPI.workflows.` in the renderer first to confirm zero call sites (the investigation found none).
3. **Remove the plugin's duplicate active-workflow IPC registrations** (`ipc-handlers.ts:139-186` in fictionlab-workflow) OR document why they stay (e.g. reserved for external plugin consumers). If removed, also remove the plugin's duplicate `broadcastWorkflowUpdate` (`ipc-handlers.ts:18`) if nothing else uses it. Note this touches the **fictionlab-workflow repo**, not this repo — split into a companion PR there if needed.

## Acceptance criteria
- [ ] TopBar Import opens the import dialog; TopBar Refresh reloads the workflow list (or the TopBar duplicates are gone entirely).
- [ ] No `console.log`-only action dispatch remains in `handleAction`.
- [ ] `electronAPI.workflows` no longer exists in preload; renderer typechecks clean.
- [ ] Pause/Resume/Cancel/Jump on active workflow cards still work (they use `workflow-handlers.ts:671-753` — untouched).
- [ ] `npm run build` + tests pass in both repos if the plugin cleanup is included.

## Gotchas / coordination
- **Do not delete `workflow:*` (singular) channels** — those are the live ones.
- The dead `workflows:create` stub (preload:2517) is also referenced by the "create workflows in-app" feature issue. That feature will build its own path; deleting the dead stub here does not conflict.
