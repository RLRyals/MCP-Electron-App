# [Cleanup] Remove dead TypingMind local-install machinery (update button, downloader, container controls) — keep cloud connector wiring

**Labels:** cleanup, typing-mind, complexity: medium

## Context
TypingMind was originally run locally; it now runs at typingmind.com (cloud). The local-install machinery remains: health checks for a local container that never exists, a "Check for Updates" button for a local install that's never present, a downloader module, and one **actively broken** code path. This is dead weight and user-visible confusion (an Offline card, a button that always says "not installed").

Every line below was verified 2026-07-04. This is a deletion map — follow it rather than re-grepping from scratch, but DO grep for stragglers after each removal (`typingmind|typing-mind|typing_mind`, case-insensitive).

## DELETE — dead local-install chain

**A. "Check for Updates" button + updater chain**
- `src/renderer/views/SetupView.ts:122-126` — button + status div in Setup UI.
- `src/renderer/components/SetupTab.ts:77-79` (wiring), `:281-350` (`handleUpdateTypingMind`).
- `src/preload/preload.ts:1818-1820, 1839-1840` — `checkTypingMind`/`updateTypingMind` bridges.
- `src/main/index.ts:1234-1236, 1265-1275` — `updater:check-typing-mind`/`updater:update-typing-mind` handlers.
- `src/main/updater.ts:295-331` (`checkForTypingMindUpdate`), `:813-885` (`updateTypingMind`), the `typingMind` branches in `checkForAllUpdates` (`:339-374`) and the update-all flow (`:984-992`), `typingMind` fields on result interfaces (`:56,81,95`), import at `:13`.
- `src/renderer/renderer.ts:381,384` — dead type decls.

**B. Local downloader**
- `src/main/typingmind-downloader.ts` — entire module.
- `src/main/index.ts:20` (import), `:840-914` — the 7 `typingmind:*` IPC handlers (download, cancel-download, is-installed, get-version, uninstall, check-updates, get-install-path).
- `src/preload/preload.ts:1200-1243` (bridges), `:1305-1313` (progress listeners), `:289-354, 474, 498, 542` (types/fields).
- `src/main/update-manager.ts:70-82, 173-174` — TM repo git-pull path.
- `scripts/debug-metadata.js:26-52`, `scripts/linux-verification.sh:48-60` — local-install diagnostics.

**C. Local container controls / health rendering**
- `src/renderer/components/ServicesTab.ts:324-381` (`updateTypingMindCard` container-health version), `:152-165, 191, 502-529, 548, 681` — Start/Stop/Restart/View-Logs handlers and maps. KEEP Open-Browser/Configure (cloud).
- `src/renderer/views/ServicesView.ts:55, 131-157` — card's Start/Stop/Restart/View Logs buttons, "Port: 8080" label. Keep the card only if reduced to cloud link + configure.
- **Actively broken:** `src/main/mcp-system.ts:1201-1221` — `execDockerCompose(coreFile, 'up', ['-d','typingmind'])`: no `typingmind` service exists in `docker-compose.yml`; contradicts the comment at `mcp-system.ts:626-627`. Delete the branch; simplify `services.typingMind` selection (`:598-627`) accordingly.
- `src/main/mcp-system.ts:1614-1629` — log fetch mapping `'typing-mind'` → container `fictionlab-typingmind` (doesn't exist).
- Logs plumbing for the dead service: `src/renderer/components/LogsTab.ts:34,120,1104-1108,1283` (dropdown option + maps), `src/preload/preload.ts:1507`, `src/renderer/renderer.ts:326`, `src/main/index.ts:1089` (serviceName unions), `dashboard-handlers.ts:861-865`, `ServicesTab.ts:681`.

**D. Dead config/env**
- `TYPING_MIND_PORT` (default 8080): `src/main/env-config.ts:32,49`; wizard field `#typing-mind-port` (`src/renderer/setup-wizard-handlers.ts:596,674,729`); `.env.test:17,19-20`; type fields in `ServicesTab.ts:37,51`, `dashboard-handlers.ts:22,43`, `renderer.ts:72,185`.
- `config/setup-config.json:26-29,38,42,66-68,94-99` — `typing-mind` clone/build entries (the LOCAL app repo). **KEEP lines 17-20,57-59 (`typingmind-mcp`)** — that's the connector.
- `src/main/client-selection.ts:65-84` — keep the `'typingmind'` client (cloud is a real client) but remove the vestigial `repoUrl` (only the deleted downloader used it).
- `src/types/wizard.ts:50` + `setup-wizard-handlers.ts:898-925,1219` — `typingMindCompleted` download-gate (already neutralized; remove).
- `scripts/debug-docker-ports.{bat,sh}` — `typing-mind-` container filters (bat:23,81,90,93; sh:29,96,98).

## KEEP — live cloud wiring (do not touch except noted)
- `@typingmind/mcp` connector: `docker-compose.yml:52-68`, `docker/connector-entrypoint.sh`.
- `src/main/typingmind-auto-config.ts`, `src/main/mcp-config-generator.ts`, `scripts/configure-typingmind.js` — **fix stale instruction strings** telling users to open `http://localhost:${TYPING_MIND_PORT}` (`mcp-config-generator.ts:226`, `configure-typingmind.js:123`, and the instruction text near `typingmind-auto-config.ts:395`) → point at `https://www.typingmind.com`.
- Cloud open/configure buttons + "Ready" card: `dashboard-handlers.ts:578-605, 128-192, 793-821`, `DashboardTab.ts:130-133, 252-267`.
- Workflow source tag `'typingmind'` + "TM" badge: `src/types/workflow.ts:291`, `workflow-handlers.ts:778`, `persistent-mcp-client.ts:834`, `ActiveWorkflowCard.tsx:26-27`.
- `mcp-system.ts:1249-1267` (auto-config generation) and `:1455-1457` (cloud URL).

## Acceptance criteria
- [ ] Setup tab has no TypingMind "Check for Updates" button; Services shows (at most) a cloud card with Open/Configure — no Offline badge, no Start/Stop/Restart.
- [ ] `grep -ri "typingmind\|typing-mind\|typing_mind" src/ config/ scripts/` returns only the KEEP list above.
- [ ] `checkForAllUpdates()` no longer reports a typingMind component; update-all works.
- [ ] MCP config generation still works and its instructions reference typingmind.com, not localhost:8080.
- [ ] App boots, wizard completes, `npm run build` + tests pass.

## Coordination
- Ports issue: `TYPING_MIND_PORT` removal overlaps `env-config.ts` — land this first or rebase.
- Do this as ONE PR — partial removal leaves dangling references across preload/renderer type surfaces (they typecheck as a unit).
