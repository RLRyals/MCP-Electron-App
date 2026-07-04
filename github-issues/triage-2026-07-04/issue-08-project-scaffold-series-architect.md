# [BUG] Project workspace init creates folders Series Architect never uses — align scaffold with SA v2 layout

**Labels:** bug, setup, configuration, complexity: medium

## Symptom
"Create New Project" (with Initialize Workspace checked) succeeds, but the folder structure it creates is not what the Series Architect workflows use. SA output lands in folders the scaffold never created, and the scaffolded folders stay empty — misleading for users and for any workflow step that READS an expected path.

## Root cause (verified — do not re-investigate)
**What init creates** — `project:initialize-workspace` handler, `src/main/index.ts:2382-2431`:
- `.claude/`, `planning/`, `planning/character-profiles/`, `planning/world-building/`, `books/`, `exports/` (`:2392-2397`), `.claude/settings.json` (`:2400`), a `CLAUDE.md` template copy (`:2407-2416`).
- Genre pack step is a **log-only stub**: `:2421-2423` ("will be copied when workflow runs").
- The dialog's helper text advertises this structure (`src/renderer/components/ProjectCreationDialog.tsx:316-318`).
- Note `project:create` itself (`index.ts:2319` → `project-manager.ts:168` → MCP `create_project`) only writes a DB row — all disk scaffolding is in initialize-workspace.

**What SA v2 actually uses** (from `C:\github\FictIonLab-Downloads`):
- Everything under **`{{projectFolder}}/outputs/`**: `intake_form.md` (`workflows/series-architect-intake/workflow.yaml:247`), `INDEX.md` + `series_bible.md` (`series-architect-output/workflow.yaml:259,276`), `market_research.md` + `genre_pack.json` (`series-architect-research/workflow.yaml:290,307`), `series_framework.md` (`series-architect-framework/workflow.yaml:362`), world/character files flat in `outputs/` (`dramatica-storyform/workflow.yaml:52-62`), per-book `outputs/book_{{currentBookNumber}}/…` (`dramatica-storyform/workflow.yaml:135,148`; `series-architect-development/workflow.yaml:431-516`).
- The SA agent additionally expects **`series-planning/`** (`series-architect-agent.md:22`, `:930`).
- Intake declares a tiered structure `world/ characters/ continuity/ books/` (`series-architect-intake/workflow.yaml:214`).

**Why nothing crashes today:** workflow file-writes self-create parent dirs — `FileOperationExecutor.executeWrite` always calls `fs.ensureDir(path.dirname(finalPath))` (`file-operation-executor.ts:280`). The node-level `createDirectories` flag is a no-op (never read; corroborated by `FictIonLab-Downloads/WORKFLOW-FIXES.md:78`). The damage is: reads of expected-but-absent paths, and a scaffold that actively misleads.

## Implementation plan
1. **Decide the canonical scaffold with the SA v2 layout as source of truth.** Cross-check the WutheringDragons testbed `START-HERE.md` checklist (the canonical empty-project test for this flow) before coding. Proposed:
   - `outputs/` (SA writes here — create it so users see where results will land)
   - `series-planning/` (SA agent workspace)
   - `.claude/` + settings + CLAUDE.md (keep as-is)
   - Keep `books/` and `exports/` ONLY if a current workflow or doc references them; otherwise drop. Drop `planning/character-profiles/` and `planning/world-building/` (nothing writes there).
2. Update the folder list in `index.ts:2392-2397` and the dialog helper text (`ProjectCreationDialog.tsx:316-318`) to match.
3. **Implement the genre-pack step** (replacing the log stub at `:2421-2423`): if a pack id was selected, invoke the existing copy logic (`ResourceCopier`, `resource-copier.ts:208-243` in the workflow-runner package) at init time, OR keep run-time copy but write a marker (e.g. store the chosen pack id in project config) so the workflow run picks it up — match whatever the genre-packs-dropdown fix (separate issue) establishes as the id flow.
4. Optional but cheap: drop a `README.md` into the project root describing each created folder, so an empty `outputs/` isn't mysterious.

## Acceptance criteria
- [ ] A newly initialized project contains exactly the documented scaffold, including `outputs/` and `series-planning/`.
- [ ] Running the SA intake workflow against a fresh project writes into pre-existing folders (no structure invented at runtime for the standard flow).
- [ ] Dialog text matches reality.
- [ ] Genre pack selection results in the pack actually reaching the project (at init or verified at first run), not a log line.
- [ ] Existing projects are unaffected (init only runs for new projects).

## Coordination
- Depends on / relates to the genre-packs-dropdown issue (the pack id must exist to be copied).
- The SA workflows themselves are authored in `FictIonLab-Downloads` — if step 1 reveals a disagreement between workflows (`outputs/` flat vs tiered `world/characters/continuity/books`), resolve it THERE first and scaffold to the resolved layout. Flag it rather than guessing.
