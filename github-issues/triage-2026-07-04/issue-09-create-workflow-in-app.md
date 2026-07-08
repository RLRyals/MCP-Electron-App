# [Feature] Create new workflows in-app — "New Workflow" button opening a blank canvas

**Labels:** enhancement, feature, ui, complexity: high

## Context (verified)
Workflows can only be authored externally (YAML/JSON) and imported. In-app:
- Toolbar offers Import / Export / Start / Refresh / Hide-Panel only (`src/renderer/views/WorkflowsViewReact.tsx:657-692`). No create.
- The canvas editor is real and works — but only on an existing workflow: "+ Add Node" (`src/renderer/components/WorkflowCanvas.tsx:1005`), node config dialog, edge editing (`:1210`), all call `workflow:add-node`/`add-edge`/`update-*` with `workflow.id` (`WorkflowCanvas.tsx:472,863`; handlers in `src/main/handlers/workflow-handlers.ts:137-227`).
- The canvas renders only when `selectedWorkflow` exists (`WorkflowsViewReact.tsx:699`), else "Select a workflow from the panel to visualize" (`:773`).
- The only latent "create" plumbing was a dead preload stub (`electronAPI.workflows.create` → `workflows:create`, no handler) — being removed by the dashboard dead-buttons cleanup issue. Build fresh; don't resurrect it.
- Import path for reference: `workflow:import-from-folder` (`WorkflowsViewReact.tsx:377` → plugin `ipc-handlers.ts:77` → `workflow.importFromFolder`), plugin channels namespaced via `plugin-context.ts:742`. Workflow definitions persist in the `fictionlab` schema of `mcp_writing_db` (`fictionlab.workflow_definitions`, upsert keyed on `workflow_id, version`).

Most of the editing plumbing already exists — the missing piece is instantiating a blank workflow to edit.

## Implementation plan
1. **Backend — create verb.** Add a `workflow:create` handler (main app, alongside the existing `workflow:*` editing handlers in `workflow-handlers.ts` — same layer the canvas editing already uses). Input: `{name, description?}`. Behavior: generate a `workflow_id` (slug from name + uniqueness check), `version: '0.1.0'`, minimal valid definition (empty nodes/edges, or a single start node if the runner requires an entry node — check `@fictionlab/workflow-runner`'s validation in the workflow-runner package before deciding), insert via the same upsert path the importer uses (`INSERT … ON CONFLICT (workflow_id, version) DO UPDATE` into `fictionlab.workflow_definitions`). Return the created workflow in the same shape `workflow:get` returns.
2. **Preload bridge** for `workflow:create` next to the existing workflow bridges.
3. **UI:** add "🆕 New Workflow" to the toolbar (`WorkflowsViewReact.tsx:657-692`). Click → small dialog (name, optional description) → `workflow:create` → `loadWorkflows(true)` → select the new workflow so the canvas opens immediately with "+ Add Node" available.
4. **Editing loop sanity:** confirm `workflow:add-node`/`add-edge`/`update-positions`/`get-definition` (`workflow-handlers.ts:137-227`) work against a workflow with zero nodes (empty-graph edge cases: first node, first edge). Fix any assumption that a graph is non-empty.
5. **Runability:** a fresh workflow will fail validation until it has required structure — surface the runner's validation errors in the UI when Start is pressed rather than blocking creation. (Check how `workflow:execute` errors currently surface via `ipc-handlers.ts:67`.)
6. **Export round-trip:** verify the existing Export dialog produces valid YAML/JSON from a created-in-app workflow, so in-app authoring and the external authoring loop (`FictIonLab-Downloads`) stay interchangeable. This is the key acceptance test.

## Acceptance criteria
- [ ] "New Workflow" button → name dialog → blank workflow appears in the manager panel and opens on the canvas.
- [ ] Nodes and edges can be added/configured/connected starting from empty; positions persist across reload.
- [ ] Created workflow survives app restart (persisted in `fictionlab.workflow_definitions`).
- [ ] Export of a created workflow produces a folder/file that re-imports cleanly (round-trip).
- [ ] Starting an incomplete workflow shows a validation message, not a crash.
- [ ] Duplicate name → clear error or auto-suffixed id, no silent overwrite (respect the `(workflow_id, version)` uniqueness).

## Gotchas
- Decide main-app channel vs plugin-namespaced channel deliberately: the canvas EDITING channels are main-app (`workflow-handlers.ts`), while list/get/import/execute are plugin-namespaced. Creating via the main-app layer keeps it next to the editing verbs it must cooperate with; just make sure the plugin's `workflow:list` picks up the new row (it reads the same DB through the workflow-manager MCP).
- Version bumping on edit is out of scope — created workflows can stay at `0.1.0` until export.
- Coordinate with the dashboard dead-buttons cleanup (it deletes the old dead `workflows:*` preload surface — no conflict, different namespace, but rebase whichever lands second).
