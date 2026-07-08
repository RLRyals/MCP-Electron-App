# [BUG] Genre packs dropdown is always empty — IPC handler is a hardcoded `return []`

**Labels:** bug, ui, configuration, priority: high, complexity: low

## Symptom
In the "Create New Project" dialog, the Genre Pack dropdown only ever shows "None". Real genre packs exist on disk but never appear.

## Root cause (verified — do not re-investigate)
- The dropdown loads via `electronAPI.project.listGenrePacks()` (`src/renderer/components/ProjectCreationDialog.tsx:38-43`) → preload `project:list-genre-packs` (`src/preload/preload.ts:1593`).
- The main-process handler at `src/main/index.ts:2437-2442` **unconditionally returns `[]`**, with a comment saying genre packs are no longer bundled with the Electron app.
- But the packs exist and a working scanner exists:
  - Packs: `C:\github\fictionlab-workflow\packages\...\resources\genre-packs\` — currently `gothic-romance-horror/` and `urban-fantasy-police-procedural/`, each with a `manifest.json`. (In the installed app these resources ship with the workflow plugin — resolve the path the same way `ResourceCopier` does.)
  - Scanner: `ResourceCopier.listAvailableGenrePacks()` in the workflow-runner package (`resource-copier.ts:410-444`) — reads the `genre-packs` dir, keeps subdirs containing `manifest.json`, skips `_`-prefixed dirs. It is never called by this handler.
- Downstream, the genre pack is copied into the project at workflow-run time by `resource-copier.ts:208-243`, keyed by the pack id the dropdown supplies — so fixing the list fixes the whole chain.

## Implementation plan
1. Replace the stub at `src/main/index.ts:2437-2442` with a call into the existing scanner. Either:
   - import/instantiate `ResourceCopier` from `@fictionlab/workflow-runner` and call `listAvailableGenrePacks()`, or
   - if the Electron main process shouldn't depend on the runner package directly, route through the workflow plugin (it already has an IPC surface — see `fictionlab-workflow/packages/workflow-plugin/src/ipc-handlers.ts`) and have the renderer call the plugin channel.
   Prefer whichever direction the codebase already uses for `ResourceCopier` at run time (the run-time copy path resolves the resources dir — reuse that path resolution, do not hardcode a dev-machine path).
2. Return shape must match what `ProjectCreationDialog.tsx:331-334` renders (id + display name from `manifest.json`).
3. Handle the missing-directory case gracefully (return `[]`, log a warning) so a broken install doesn't crash the dialog.

## Acceptance criteria
- [ ] Create Project dialog lists `gothic-romance-horror` and `urban-fantasy-police-procedural` (display names from their manifests) plus "None".
- [ ] Selecting a pack and creating a project stores the pack id so the run-time copy (`resource-copier.ts:208-243`) receives it.
- [ ] Empty/missing genre-packs directory → dropdown shows only "None", no error dialog.
- [ ] `npm run build` passes.

## Gotchas
- Do NOT reintroduce bundling packs inside the Electron app — the comment in the stub reflects a real decision. The packs live with the workflow plugin resources; list them from there.
- Related: the project-init "genre pack" step is currently a log-only stub (`src/main/index.ts:2421-2423`) — that's tracked in the project-scaffold issue, not this one.
