# [BUG] Port conflicts abort startup instead of auto-remapping (breaks Linux); no way to see/change ports — add a Ports settings panel

**Labels:** bug, docker, configuration, linux, complexity: medium

## Symptom
On Linux, FictionLab fails because the system already runs PostgreSQL on 5432 and the FictionLab container tries to publish the same port. There is no UI to see which ports FictionLab uses or to change them (outside the setup wizard's one-time conflict prompt).

## Root cause (verified — do not re-investigate)
**Detection already exists and is Linux-aware** — the gap is remediation and coverage:
- Default `POSTGRES_PORT` is **5432** (`src/main/env-config.ts:43`), published host-side by `docker-compose.yml:23-24` (`${POSTGRES_PORT}:5432`) → collides with native Postgres on Linux.
- Probes that already work: `checkPortOnHost()` (`env-config.ts:204-224`, Node `net` probe), `checkPortAvailableLinuxSS/Netstat()` (`:231-294`), `checkPortAvailable()` (`:302-338`, probes both `0.0.0.0` and `127.0.0.1`), `findNextAvailablePort()` (`:345-356`), `checkAllPortsAndSuggestAlternatives()` (`:436-531`, builds conflict list + `suggestedConfig`).
- **Startup does not remediate:** `startMCPSystem` (`src/main/mcp-system.ts:1007-1059`) checks conflicts, tries `stopExistingContainers()`, then aborts with `PORT_CONFLICT`. Only the setup wizard's "Use Suggested Ports" button applies `suggestedConfig` (`src/renderer/setup-wizard-handlers.ts:569-573,590`).
- **Unprobed hardcoded ports:** NPE **3011** and Workflow Manager **3012** are literal in `docker-compose.yml:94-95` and absent from the probe list (`env-config.ts:451-456`) — collisions surface only as compose "port is already allocated" errors (`mcp-system.ts:1126`).
- **PgBouncer 6432 is effectively fixed:** compose maps `${PGBOUNCER_PORT}:${PGBOUNCER_PORT}` (`docker-compose.yml:42-43`) and MCP servers hardwire `fictionlab-pgbouncer:6432` internally; `mcp-system.ts:1037-1040` warns it "cannot be changed."
- `formatEnvFile` (`env-config.ts:709-733`) does not persist all port vars (missing `TYPING_MIND_PORT`, no vars exist yet for 3011/3012).

**Full current port map (host side):** Postgres 5432, PgBouncer 6432, MCP Connector 51300 (`MCP_CONNECTOR_PORT`), HTTP/SSE 3001, DB-Admin 3010, NPE 3011 (hardcoded), Workflow Manager 3012 (hardcoded).

## Implementation plan
1. **Parameterize the hardcoded ports:** add `NPE_PORT` (default 3011) and `WORKFLOW_MANAGER_PORT` (default 3012) to `DEFAULT_CONFIG` (`env-config.ts:39-51`), `docker-compose.yml:94-95` (`${NPE_PORT}:3011` style — container side stays fixed), `formatEnvFile`, and the env injection in `execDockerCompose` (`mcp-system.ts:664-683`).
2. **Add them to the probe list** in `checkAllPortsAndSuggestAlternatives()` (`env-config.ts:451-456`). Exclude `PGBOUNCER_PORT` from "suggestable" (it can't actually move — see above) or fix the compose mapping to `${PGBOUNCER_PORT}:6432` so the host side CAN move while the container network stays 6432. Prefer the latter — it's a one-line compose change that makes 6432 remappable.
3. **Auto-remediate at startup:** in `startMCPSystem` (`mcp-system.ts:1007-1059`), when conflicts persist after `stopExistingContainers()`, apply `suggestedConfig` (persist via the existing env-config save path), log prominently which ports moved, and retry once. Only return `PORT_CONFLICT` if the retry also fails. Gate this behind a config flag if cautious, but default it ON for Linux.
4. **Ports settings panel (UI):** add a "Ports" section (Settings or Services tab):
   - Table: service name, current port, editable field, live in-use status (reuse `checkPortAvailable()` per row; mark "in use by FictionLab" vs "in use by another process" — the Linux `ss`/`lsof` path already returns process info).
   - "Check all" button → `checkAllPortsAndSuggestAlternatives()`; "Use suggested" → apply `suggestedConfig` (reuse wizard logic from `setup-wizard-handlers.ts:590`).
   - Save → persist `.env` (userData `.env`, `env-config.ts:56-60`) and prompt to restart services.
   - New IPC handlers as needed (`env:*` group already exists at `index.ts:568-651` — extend it).
5. **Linux default:** consider defaulting `POSTGRES_PORT` to 5433 on Linux only (first-run), since a native 5432 Postgres is the common case. Auto-remap (step 3) covers it either way; the changed default just avoids the first failed attempt.

## Acceptance criteria
- [ ] On a Linux host with native Postgres on 5432: FictionLab starts successfully with no wizard interaction; logs show the remapped port; connections work through the remapped value.
- [ ] Occupying 3011 or 3012 before startup is detected pre-flight (named conflict, suggestion offered) instead of a raw compose error.
- [ ] Ports panel lists all seven ports with live status, allows editing, persists, and services restart onto the new ports.
- [ ] Windows behavior unchanged when no conflicts exist.
- [ ] `linux-db-diagnostic.sh` updated if it assumes fixed ports (`PORTS=(5432 6432 3001 50880)` at line 86 — read from `.env` instead, or document).

## Gotchas / coordination
- The container-internal wiring must keep `fictionlab-pgbouncer:6432` and postgres `5432` — only HOST-side publishes move. Compose changes must preserve `host:container` shape with fixed container side.
- MCP connector config generation hardcodes server ports 3001-3009 (`src/main/mcp-config-generator.ts:59-115`) — if HTTP_SSE_PORT moves, verify generated client configs pick up the new value.
- Coordinate with the Docker-launch-gate issue: the gate will call the container-start path and must surface (not swallow) any remaining `PORT_CONFLICT`.
- `TYPING_MIND_PORT` (8080) is dead config being removed by the TypingMind cleanup issue — don't add it to the panel.
