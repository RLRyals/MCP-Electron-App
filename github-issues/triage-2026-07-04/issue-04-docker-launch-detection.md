# [BUG] Launch falsely reports Docker down and exits — needs pipe-level probe, retries, and container startup in the launch gate

**Labels:** bug, docker, startup, reliability, windows, priority: high, complexity: medium

## Symptom
On Windows, launching FictionLab while Docker Desktop IS running (or still initializing) shows the "Docker Required / failed to start / please start Docker Desktop manually" error and exits. Desired behavior: detect the daemon properly; if truly down, start Docker Desktop (tray-only, no dashboard window), then start the FictionLab postgres container, then verify everything before the UI proceeds.

## Root cause (verified — do not re-investigate)
The launch gate is `src/main/index.ts:2707-2786` (in `app.whenReady()`):
1. `prerequisites.checkDockerInstalled()` (`:2713`) → `docker --version`, disk fallback.
2. `docker.checkDockerHealth()` (`:2743`) is the ONLY liveness gate → `checkDockerRunning()` (`src/main/prerequisites.ts:212-305`: `docker info` 20s, fallback `docker ps` 20s) then a second `docker info` 20s (`src/main/docker.ts:455`).
3. On failure → `startAndWaitForDocker()` (`docker.ts:551-597`); if that fails → error box + `app.quit()` (`index.ts:2756-2767`).

Failure modes:
- **CLI-only detection, no daemon probe.** Everything is `child_process.exec` of the `docker` CLI. `dockerode` is already a dependency but only used post-launch (`src/main/update-manager.ts:9,41`). If the CLI is slow or not on PATH, a live daemon reads as down.
- **Single-shot 20s `docker info`, no retry.** A cold WSL2 backend routinely exceeds 20s on first call after boot.
- **PATH shim assumes default install.** `getFixedEnv()` (`prerequisites.ts:63-102`) only appends `%ProgramFiles%\Docker\...` paths — non-default installs fail every exec check.
- **Gate never checks the process first.** `isDockerDesktopProcessRunning()` (`docker.ts:54-120`, `tasklist` on Windows) exists but the gate calls `checkDockerHealth()` directly, so running-but-initializing Docker Desktop is treated as "not running" and the app tries to relaunch it.
- **Start opens the full GUI**: `docker.ts:145-154` launches `Docker Desktop.exe` plainly.
- **Container startup is NOT in the launch gate.** `docker compose up` lives in `startMCPSystem` (`src/main/mcp-system.ts:1117`) and only runs from the setup wizard / dashboard. After the Docker gate, launch proceeds straight to first-run check / DB pool init (`index.ts:2793-2803`) — so a machine with Docker up but containers down still lands in a broken state.

## Implementation plan
1. **Add a daemon-level probe with retries** in `src/main/docker.ts`:
   - New `pingDockerDaemon()`: on Windows use dockerode with `socketPath: '//./pipe/docker_engine'`; on macOS/Linux `/var/run/docker.sock`. `await docker.ping()` with a short (~3s) timeout per attempt.
   - Retry loop: e.g. 5 attempts × 3s backoff before declaring the daemon down. Only fall back to the CLI checks if the pipe/socket probe errors in a way that suggests the CLI would still work (unlikely — treat the probe as authoritative, keep CLI as secondary confirmation).
2. **Reorder the gate** (`index.ts:2707+`):
   a. `pingDockerDaemon()` — success → daemon up, skip to step (d).
   b. `isDockerDesktopProcessRunning()` — if the process is running, poll `pingDockerDaemon()` up to ~90s (initializing case). Do NOT relaunch.
   c. Not running → `startDockerDesktop()` then poll ping up to ~120s.
   d. **Start required containers:** call the postgres/pgbouncer portion of `startMCPSystem` (or a new narrower `ensureCoreContainers()` extracted from `mcp-system.ts:1117` area) so the DB is up before `index.ts:2793` initializes the pool.
   e. Verify: ping DB (existing pool init already does this) and surface a progress UI instead of a modal error until the timeout truly expires.
3. **Tray-only start on Windows:** launch `Docker Desktop.exe` as today — the dashboard window is controlled by Docker Desktop's own "Open Dashboard at startup" setting; there is no supported fully-headless mode. Do NOT block on window state; the daemon ping is the readiness signal. (Keep the existing macOS `open -a Docker` / Linux `systemctl start docker` paths.)
4. **Widen PATH resolution:** in `getFixedEnv()`, also honor a `DOCKER_HOME`-style env/config override and try `where docker` before giving up (log which path was used).
5. Replace the exit-on-failure error box with a dialog offering Retry / Open Docker Desktop / Quit.

## Acceptance criteria
- [ ] Launching while Docker Desktop is running → no restart prompt, app proceeds (test on cold boot where first `docker info` is slow).
- [ ] Launching while Docker Desktop is initializing → app waits (with progress feedback) instead of relaunching or exiting.
- [ ] Launching with Docker fully stopped → Docker Desktop is started, daemon pinged until ready, postgres container comes up, DB pool initializes — no wizard interaction required.
- [ ] Docker genuinely unavailable → Retry/Open/Quit dialog, not an immediate quit.
- [ ] Existing `docker:*` IPC handlers (`index.ts:658-724`) still work.

## Gotchas
- dockerode named-pipe path on Windows is `//./pipe/docker_engine` (works in Node as `\\\\.\\pipe\\docker_engine` too — test both forms; pass via `socketPath`).
- Don't call the full `startMCPSystem` in the gate if it drags in wizard-only assumptions — extract the container-up + health-check core. Port-conflict handling in that path is covered by the ports issue (coordinate; the gate should surface `PORT_CONFLICT` results, not swallow them).
- Keep the 60s `waitForDockerReady` CLI poller (`docker.ts:221-289`) only as fallback; primary readiness = daemon ping.
