# Plan: rebuild FictionLab in Rust

**Status:** PROPOSED, for Rebecca's review. Planning deliverable only: no code, no repo renames, no beads created.
**Bead:** mea-1y4 (kanban card 5524f8ec-b186-42c6-a627-8ba170674ad3)
**Date:** 2026-10-10
**Scope of the ask:** MCP-Electron-App, MCP-Writing-Servers and fictionlab-workflow, rebuilt in Rust where it earns its keep; repos restructured and renamed as FictionLab; separate releases per plugin; core app and plugin extensibility retained; hosting need not be GitHub.

How to read this: section 0 is the whole recommendation on one page. Sections 1 to 9 follow the nine questions in the bead, in the bead's order, each with a recommended option. Section 10 lists the open questions for Rebecca separately. Section 11 lists proposed child beads (not created, awaiting approval). The appendix says how the numbers were gathered and where they are soft.

---

## 0. Summary

**Recommendation: yes, but as a staged strangler migration with a stop point after every phase, not as a rewrite of everything.** Do the language-agnostic restructuring first (it delivers two of the three things asked for with zero Rust risk), then replace the servers and database behind their existing ports, then the plugin boundary, and the desktop shell last.

**The honest finding that shapes the plan: speed is not the reason.** I measured the live stack before recommending anything (section 0.2). An MCP tool call takes 3.9 ms at the median over loopback. The whole database is 33 MB and about 12,000 rows. The four containers idle at about 390 MB of RAM. Nothing in the current system is slow where it matters; the slow parts are LLM calls and local-model swaps, which Rust does not touch. What Rust buys here is **operations and correctness**:

- It removes the Docker dependency (about 1.1 GB of images, WSL2 cold-start failures, a 120 s health wait, and an update path that runs `docker build` on the user's machine with a 5-minute timeout).
- It replaces three hand-maintained copies of "which tool lives on which port" with one typed registry.
- It gives plugins a real permission boundary (today they are `require()`d into the host process and the permissions are advisory).

If the goal were only speed, the right answer would be to fix the 26 candidate N+1 query loops in Node and stop.

### 0.1 Decisions at a glance

| # | Question | Recommendation | Confidence |
|---|---|---|---|
| 1 | Desktop shell | **Tauri 2, sequenced last, behind a spike gate.** Electron (upgraded) plus the Rust daemon is the explicit fallback and a good place to stop. | Medium |
| 2 | MCP servers | **One Rust daemon (`fictionlabd`) on the official `rmcp` SDK**, one binary serving the same 16 ports plus stdio, ported one server at a time with a per-server cutover switch. Start with `author`, then `kanban`. | High |
| 3 | Database | **Keep Postgres through the server port, then move to SQLite (WAL)**, gated on a spike. Fallback: embedded Postgres. Drop pgbouncer after verifying it is not needed. | Medium |
| 4 | Plugins | **Out-of-process sidecar plugins over JSON-RPC (ABI v2)**, with a Node-compat sidecar that runs today's v1 plugins unchanged. Optional WASM tier later. | High |
| 5 | Repos | **Two product repos**: `FictionLab` (the existing MCP-Electron-App renamed in place, plus MCP-Writing-Servers imported with history) and `FictionLab-Plugins` (fictionlab-workflow renamed). FictIonLab-Downloads and FictionLab-Online stay as they are. | Medium |
| 6 | Per-plugin releases | **Keep the ratified `<plugin>-vX.Y.Z` tag scheme.** Add a signed, static **update feed** so update discovery stops depending on GitHub's "latest release". One reusable release workflow replaces seven copied jobs. | High |
| 7 | Hosting | **Stay on GitHub; make leaving a config change** (feed, forge adapter, portable CI). Revisit on a trigger, not on a schedule. | Medium |
| 8 | Phasing | Six phases (P0 to P5) plus a deferred P6. About **376 points nominal, plan on about 490**. | Low (estimates) |
| 9 | Ripple | 10 fleet scripts, 84 files in FictIonLab-Downloads, FictionLab-Online, the `run-workflow` skill, 10 scheduled tasks and 3 client configs depend on current names, paths, ports or container names. Section 9 lists them. | High |

### 0.2 What I measured (live stack, 2026-10-10)

| Measure | Result | How |
|---|---|---|
| MCP tool-call latency (kanban `list_boards`, HTTP loopback, n=30) | **min 3.5 ms, p50 3.9 ms, p95 4.7 ms, max 12.5 ms** | `curl` loop against `:3015/api/tool-call` |
| `/health` on all 7 probed ports | 2.7 to 3.4 ms | `curl` |
| Database size | **33 MB**, about **12,110 rows** total; largest table 4,494 rows | `psql` in `fictionlab-postgres` |
| Schema | **109 tables, 9 views, 400 indexes, 21 functions, 59 triggers**, one extension (plpgsql) | `psql` |
| Idle RAM | postgres 101 MB, mcp-servers 187 MB, connector 104 MB, pgbouncer 2 MB = **about 394 MB** | `docker stats` |
| Image sizes | mcp-servers 256 MB, postgres:16 641 MB, node:18-alpine 181 MB, pgbouncer 22 MB = **about 1.1 GB** | `docker images` |

What is **not** measured anywhere, in any of the three repos: app start-to-usable time, first-run time, update time, workflow run durations, IPC overhead, installer size. The docs quote figures (first-time setup 15 to 30 min, later starts 30 to 60 s, app about 200 MB) but they are estimates. Bead P0-6 captures real numbers before any Rust is written, so the "after" has a "before" to be compared with.

### 0.3 Constraint from the ratified priority plan: this needs Rebecca's call before it starts

`configs/priority-plan-2026-09.md` (ratified 2026-09-12) names "meta-work substitution (rebuilding pipelines instead of running them)" as a cause of the stall, and proposes "no new lanes until the book 1 draft is done" (projected mid-January 2027, with the draft passing about 80% around early December 2026). A Rust rebuild is exactly that kind of work. It is also about 375 points of PRs, and Rebecca's merge is the approval step, so **her review time is the real throughput limit, not agent capacity**.

My recommendation is to run only P0 now (measurement and harness; no behavior change, little review load), and hold P1 onward until the draft passes about 80%. This is open question Q1; it is her decision, not mine.

### 0.4 Where it is safe to stop

| After phase | What exists | Worth stopping here? |
|---|---|---|
| P1 | Renamed repos, signed update feed, per-plugin releases that work, one source of truth for the server/port contract | **Yes.** This answers the rename and per-plugin-release asks with no Rust risk. |
| P3 | Docker-free headless daemon in Rust on SQLite; app still Electron | **Yes, and this is the biggest user-visible win** (no Docker Desktop). |
| P4 | Plugins run out-of-process with enforced permissions | Yes. |
| P5 | Tauri shell | Optional. Only if the spike passes. |

---

## 1. Baseline: what exists today

All counts are from read-only inventories of the working trees on 2026-10-10 unless marked "live".

### 1.1 Surface

| | MCP-Electron-App | MCP-Writing-Servers | fictionlab-workflow |
|---|---|---|---|
| Language | TypeScript, Electron ^28.3.3, React 19 islands in a vanilla-TS renderer | **Plain JavaScript (ESM). No TypeScript, no zod, no build step** | TypeScript, React 19, esbuild |
| Size | main 33.6k LOC, renderer 32.7k, preload 2.6k, types 4.0k, utils 2.4k (non-test); 718 commits | 163 files, 47.9k LOC; 250 commits | 64.4k LOC under `packages/`; 316 commits; 67 tags |
| Tests | 78 files, about 817 cases | 33 files, about 300 cases; no per-tool contract tests | 89 files, about 877 cases |
| Boundary | **259 static IPC channels** (all request/response), 15 push channels, plus dynamic `plugin:<id>:<channel>` | **16 servers on ports 3001 to 3016; 257 tool registrations, 242 unique names** | **7 plugins**, a 13-node-type workflow runner (11.7k LOC) |
| Data | none (uses Postgres via `pg`) | init.sql plus 35 migrations | no direct SQL in the runner; plugins use host services |

Related repos: FictIonLab-Downloads (GitHub name `FictionLab-Downloads`; the workflow YAML source-control repo: 26 workflow dirs, 51 `workflow.yaml`, 566 nodes, 623 edges) and FictionLab-Online (private, 21.5k LOC zero-dependency Node, must run with the Electron app closed).

### 1.2 Findings that change the plan

1. **MCP-Writing-Servers is JavaScript, not TypeScript, and has no "99 tools".** `projects.md` and the `mcp-tool-grouping` note say 99. The real figures: 264 tools across the 22 domain modules, 170 across the 12 phase aggregators, **286 unique names in the union**, 242 unique names actually served. Those documents are stale and should be corrected (ripple, section 9).
2. **The wire contract is not uniform.** 37 of 60 handler files return the MCP envelope `{content:[{type:'text',…}]}` and 44 return plain objects. SSE, `/api/tool-call` and the `/mcp` route each wrap differently. `canon-db-architecture.md` already records "double- vs single-wrapped" response shapes per server family. A Rust port must pick one envelope and the parity harness must normalize the rest.
3. **Parity traps in the current servers:** `scene` advertises `get_writing_progress` with no handler; `relationship` advertises `update_relationship_arc` with no handler; the standalone `TropeMCPServer` throws in its constructor; 12 tool names are registered on more than one port (15 extra registrations).
4. **There is no shared tool registry.** Each name is a string literal in both the schema list and the handler map. The host app has its own hardcoded 12-server port map; `mcp-config.json` lists 12 servers while the stack serves 16; docs say 10, 13 and 16 ports in different places. This is the root of the `mea-006`/`mea-72q`/`flw-d0h` class of bugs (a tool exists but is unreachable through the port map).
5. **The plugin system is in-process and advisory.** Plugin main code is CommonJS `require()`d into the Electron main process. Permissions are enforced only by service wrappers; a plugin can `import … from 'electron'` and several do (5 files). `vm2` is declared but never imported by the app; the workflow runner does use it for code nodes.
6. **Only about 9 members of the plugin API are actually used** by the 7 plugins (`ipc.handle`, `mcp.callTool/listServers`, `database.query/pool.connect`, `fileSystem`, `workflow`, `environment.getUserDataPath`, `workspace.getPluginDataPath`, `config.get/set`, `logger`). The rest of the 904-line typed contract (`ui.*`, `docker`, `identity`, `transaction`, `onConfigChange`, `settingsPanel`, and more) is declared and unused. ABI v2 can be much smaller than ABI v1.
7. **Two copies of the same plugin.** `fictionlab-chapter-editor` exists in `MCP-Electron-App/packages/chapter-editor-plugin` (0.1.0, added by PR #254) **and** in `fictionlab-workflow/packages/chapter-editor-plugin` (0.3.0, with a working release job). The app copy points its `updateSource` at the app repo with a tag prefix that no workflow publishes. The `dev-work-tracking.md` registry says the plugin lives in fictionlab-workflow. Needs one home (P1-4).
8. **Two diverged copies of `plugin-api.ts`** (904 lines in fictionlab-workflow, 973 in the app, 82 diff lines apart). The "ABI" is currently a copy-paste.
9. **The kanban plugin does use `LISTEN`/`NOTIFY`** (`LISTEN kanban_changed`, `index.ts:105-129`), even though the server inventory found no listener in the app source. Any database change must keep a change feed.
10. **Direct SQL consumers outside the servers:** the business plugin (27 `database.query` sites on `fictionlab.biz_*`), the workflow-skills reader, and, in the fleet, the kanban poller, the merge-watcher, the nightly backup and two FictIonLab-Downloads tools (`docker exec fictionlab-postgres psql -U writer -d mcp_writing_db`). The container name, user and database name are hardcoded in all of them.
11. **Security posture (verified live, relevant to any rebuild):** 13 MCP ports (3001 to 3005 and 3009 to 3016, including 3010 `database-admin`), Postgres 5432, pgbouncer 6432 and the connector 50880 are all published on `0.0.0.0` (`docker port` on each container); the MCP servers have **no authentication** (`MCP_AUTH_TOKEN` is declared and never read; CORS is `*`); the plugin renderer bridge `window.electronAPI.invoke(channel, …)` has no channel allowlist; Electron is ^28 (long out of support); both Dockerfiles and the connector container use `node:18-alpine` (end of life); installers are unsigned. Windows Firewall may be limiting real exposure; I did not check. Rebecca's own convention for the desktop machine is "tailnet IP only, never `0.0.0.0`" (`machine-fleet.md`). Bead P0-9 is a small fix that does not wait for the rewrite.
12. **The credential store is tied to Electron.** `llm-providers.enc.json` is written with Electron `safeStorage`. A Tauri build cannot read it; a one-time migration is required (P5-6).
13. **Update discovery is tied to GitHub's "latest release".** Installed apps use `electron-updater` with the `github` provider on `RLRyals/MCP-Electron-App`. If plugin releases were ever published into the app repo, "latest" could point at a release with no `latest.yml` and break app updates for the installed base. This is the same class of bug as mea-tp3. It is why section 6 recommends a feed.
14. **The servers are shipped by `docker build` on the end user's machine** from the HEAD of `main` of MCP-Writing-Servers (0 tags, 0 releases), with a 5-minute timeout. A Rust build cannot happen inside that step, so a prebuilt-binary pipeline is a prerequisite, not an option.

### 1.3 Where Rust would and would not move a needle

| Area | Evidence | Does Rust help? |
|---|---|---|
| Tool-call latency | 3.9 ms p50 (measured) | No. LLM calls take seconds. |
| Database throughput | 33 MB, 12k rows | No. Fix 26 N+1 loops in Node if wanted. |
| Workflow engine | LLM-bound; local generation is serialized machine-wide with an 8 s settle and a swap probe of up to 3 min | No. |
| Agent Factory dashboard | each `bd` spawn is 1 to 3 s, 26.8 s for a full 7-repo sweep (measured by flw-9e6) | No; the cost is the `bd`/Dolt CLI. A native reader would help, separately from this plan. |
| Cold start and first run | Docker Desktop required; cold WSL2 backend routinely exceeded the old 20 s check; 120 s health wait; first setup quoted at 15 to 30 min | **Yes**, by removing Docker. |
| Update path | `docker build` on the user's machine, 5-minute timeout | **Yes** (prebuilt binary). |
| Footprint | about 1.1 GB images, about 390 MB idle RAM, plus Electron | **Yes.** |
| Contract drift and dead surface | see findings 2 to 4 | **Yes** (one typed registry). |
| Permission boundary | advisory permissions, in-process plugins | **Yes** (sidecars plus a capability broker). |

---

## 2. Desktop shell (bead item 1)

**Recommendation: Tauri 2, built last (P5), behind a three-risk spike. Until then, keep Electron, upgrade it, and let it talk to the Rust daemon over loopback exactly as it talks to the Node servers today.**

### Options

| Option | Verdict |
|---|---|
| A. Keep Electron, upgrade ^28 to current, add the Rust daemon | **The holding position and the fallback.** Lowest risk. Keeps Chromium everywhere (one rendering engine to test), keeps Playwright e2e. Costs: installer size and RAM stay Electron-sized, Node stays in the shell. |
| B. **Tauri 2** | **Recommended end state.** Small installers, system webview, a capability system that replaces the unrestricted `invoke`, updater with signature verification that works from any static host, sidecar support. |
| C. Native Rust GUI (egui, iced, Slint, Dioxus-desktop) | Reject. The renderer is about 33k LOC of web UI and plugin UIs are web bundles (Tiptap, xterm.js, an xyflow canvas). A native GUI is a total UI rewrite and cannot host plugin bundles. |
| D. Electron plus napi-rs native modules | Reject. Keeps the whole Electron cost and adds a native-addon build matrix for little gain. |

### Why Tauri is sequenced last

The renderer is web technology either way, so the rewrite risk is not in the UI. It is in the 259-channel main-process surface and in three platform risks. The daemon (P2/P3) and the plugin boundary (P4) are both shell-agnostic, so they can be built and shipped on Electron first. If the spike fails, the result is still Electron plus a Rust daemon, which is a good outcome, not a failure.

### The 259 channels do not all need porting

Counting by namespace from the inventory (estimates, from prefix counts):

| Class | Channels | Fate |
|---|---|---|
| Tied to Docker, compose, DB migrations and the wizards (`docker` 7, `docker-images` 6, `mcp-system` 11, `prerequisites` 7, `migrations` 7, `database-backup` 10, `wizard` 12, `setup-wizard` 16) | about **76 (29%)** | **Redesigned, not ported.** They disappear or collapse when Docker leaves. |
| Thin glue (workflow 27, database-admin 15, document 13, env 12, logger 11, client 11, plugin 11, typingmind 8, claude-desktop 7, project 7, updater 6, and the small groups) | about **183 (71%)** | Port as Tauri commands, typed. |

Also: 16 preload-invoked channels have no main-process handler (`build:*`, `pipeline:*`, `repository:*`), and three plugin-loading paths exist (active `import()`, a legacy `<webview>`, a deprecated BrowserWindow). Only the active path is carried forward.

### Spike gate (P5-1). Pass criteria, all three on the real renderer

1. **Linux WebKitGTK** renders the existing renderer and the Tiptap, xterm.js and xyflow plugin UIs without regressions. The app ships an AppImage and a deb, so this matters.
2. **macOS self-update works with an unsigned build.** Today macOS cannot self-update (electron-updater needs a signed build), so the app only shows a notify-and-link prompt. Tauri's updater verifies its own minisign signature, but whether Gatekeeper accepts the replaced bundle is not something I could verify from here. This could be a net improvement or a blocker.
3. **An end-to-end test strategy exists.** Playwright drives Electron today (4 specs). `tauri-driver` has no macOS support, so the plan is: run the renderer in a browser against a mocked bridge for the bulk of coverage, and use native smoke tests on Windows and Linux.

### Renderer migration

Introduce a typed `bridge` adapter (P5-2) that replaces direct `window.electronAPI` use across the 32 preload namespaces. Ship it on Electron first with an Electron implementation; add a Tauri implementation later. The renderer source then changes almost not at all in P5. Plugin bundles keep their contract (default-exported class with `mount(container)`); only the loading mechanism changes, from `file://` `import()` to a host-served `plugin://<id>/` scheme (also fixes the path-containment story).

### Constraints to carry

- The user-data directory must stay `%APPDATA%\fictionlab` (and the platform equivalents). Tauri derives its data dir from the bundle identifier by default; override it explicitly. Plugins, `plugin-data`, the settings, and the repository clones live there.
- `fictionlab-media://` (CSP-privileged scheme for plugin images) becomes a Tauri custom protocol. Per the plugin-containment ruling, the capability grant belongs to the shell.
- Multiple webviews in one Tauri window sit behind an unstable flag; do not depend on them.
- Terminal: `node-pty` becomes `portable-pty` (P5-5).

---

## 3. MCP servers in Rust (bead item 2)

**Recommendation: one Rust daemon, `fictionlabd`, built on `rmcp` (the official Rust MCP SDK), serving the same 16 ports plus stdio from a single binary. Port one server at a time; each server has a cutover switch back to the Node implementation.**

### SDK

`rmcp` is the official Rust SDK. `docs.rs` shows a stable 3.x line (3.1.0 documented; a 3.5.1 page also exists, so confirm the exact version in P2-1). It supports stdio and **streamable HTTP**, with tools declared via `#[tool]` macros, and states support for the 2026-07-28 spec revision. It does not list the legacy SSE transport, so the daemon needs a small shim for the existing SSE and `POST /api/tool-call` endpoints (FictionLab-Online, Electron and the TypingMind connector use them). Alternatives (`mcpkit` and others) are less established; I recommend against them.

### Architecture

| Today | Daemon |
|---|---|
| 16 servers, 12 aggregators, 3 per-server stdio adapters, a socat bridge, a `docker exec -i … node /app/src/config-mcps/<name>/index.js` per Claude Desktop entry, 190 `MCP_STDIO_MODE` references, six entrypoints (one stale) | **One binary.** `fictionlabd serve --all` (HTTP on the same ports), `fictionlabd stdio --server <name>`. No Docker exec, no adapters. |
| Two groupings (by-table: 22 modules; by-writing-step: 12 aggregators) hand-bound in each aggregator | **One tool registry** where each tool is registered once and carries `groups = […]` and an alias table. "Two groupings over one codebase" (an intentional design) becomes explicit data instead of duplicated wiring. |
| Hand-written JSON Schema and hand-written validation per handler | Types generate the schemas; deserialization is the validation. |
| Three response envelopes | One MCP envelope plus `structuredContent`. The legacy `/api/tool-call` shim re-wraps to what Electron and FictionLab-Online parse today, verified by the parity harness. |
| Singleton `Server` per port with `connect()` per SSE session (concurrent SSE sessions not truly supported) | Per-session services under streamable HTTP. |

The daemon is also the database owner and a long-lived process independent of the desktop shell, which preserves the "must run with the Electron app closed" requirement of FictionLab-Online and the fleet.

### Port order (strangler)

Order is by stability, self-containment and test value, not by size.

| Step | Server (port, tools) | Why here |
|---|---|---|
| 1 | `author` (3009, 4) | Walking skeleton: proves toolchain, CI, packaging, the harness and the cutover switch on the smallest surface. |
| 2 | `kanban` (3015, 15) | Self-contained, already has live-DB tests (20-way concurrent-claim race), used by the fleet, FictionLab-Online and the kanban plugin. Includes the change feed and the GitHub-sync poller. |
| 3 | `workflow-manager` (3012, 33) | Central, but its guarded import, versioning and restore rules are well specified (`workflow-definition-lifecycle.md`). Port once the harness is mature. Split in two beads. |
| 4 | `outline` (3013, 24) | Recursive CTEs; actively evolving through the canon-DB flips, so port after those settle. |
| 5 | `biz` (3014, 14) | **Hold until the S15 business tracker stabilizes** (`area:business-tracker` is still moving). |
| 6 | Domain servers and phase groups (3001 to 3008) | Mostly CRUD (about 60 to 65% of the code) over a stable schema; five slices, plus the phase groupings as declarative data. |
| 7 | `npe` (3011, 20) and `story-analysis` (3016, 7) | The "logic" is thin (boolean-flag ratios and thresholds, no NLP; the validators are argument-shape checks), so these are easier than they look. |
| 8 | `database-admin` (3010, 25) | Depends on the database decision (Postgres catalog introspection and `pg_dump` shell-outs become PRAGMA and `VACUUM INTO`); port with P3. |

Real logic is only about 7.5 to 9k LOC (16 to 19%) of 47.9k; 223 of 357 methods are query-then-shape CRUD. This is a port, not a redesign.

### Parity testing (P0 builds this before any Rust is written)

1. **Tool-surface snapshot.** Instantiate every server class, dump names, schemas, groups and duplicates into `contracts/tools.json`. The Rust registry must reproduce it exactly (or the contract is amended with a recorded reason).
2. **Recorded traffic.** Tee `/api/tool-call` and stdio for about two weeks to capture the real call mix and the envelope each consumer parses. This also produces the call-frequency telemetry that does not exist today.
3. **Differential replay.** Run Node and Rust against the same seeded database, replay the corpus, normalize envelopes, compare responses and compare database end state. The seed is a synthetic fixture: **no manuscript text or author canon may enter a repo fixture** (`author-manuscript-never-goes-into-a-repo`).
4. **Per-server soak.** A server's Node implementation is deleted only after two weeks of Rebecca's real workflows with no rollback.

### Risks and tripwires

- **Moving target.** Active areas (business tracker, canon-DB flips, outline) keep changing Node servers while the port runs. Rule: a server is ported only after its contract is quiet, and once ported, new tools are written only in Rust.
- **Hidden wire dependents** (FictionLab-Online, `run-workflow`'s `ipc-client.js`, the workflow runner's canon bindings). The recorder and the harness are the defence.
- Tripwire: if the walking skeleton (P2-3) plus `kanban` (P2-4) cost more than twice their estimates, stop and re-plan before going further.

---

## 4. Database (bead item 3)

**Recommendation: keep Postgres while the servers are ported (sqlx against the existing database, SQL nearly verbatim), then move to SQLite in WAL mode, gated on a spike. Fallback if the spike fails: embedded Postgres. Drop pgbouncer early if verification shows it is not needed.**

### What the data says

| Fact (live database unless noted) | Meaning |
|---|---|
| 33 MB, about 12,110 rows, largest table 4,494 rows | Nothing here needs a server database for scale. |
| 109 tables in two schemas (`public` 84, `fictionlab` 25), 9 views | Moderate port. |
| Extensions: only plpgsql. No FTS/tsvector, no generated columns, no RLS, no advisory locks, no partitioning | No exotic blockers. |
| **55 array columns** (36 `text[]`, 16 `int4[]`, 3 `varchar[]`), **36 jsonb**, 5 GIN indexes | The real porting cost. Array operators in handlers: `&&` overlap, `= ANY`, `unnest`, `\|\|` append. |
| 59 triggers (58 are updated-at timestamp triggers), 21 plpgsql functions (7 workflow-graph helpers are never called) | Mostly mechanical. `kanban_enforce_human_reserve` is the one real trigger. |
| 188 foreign keys, 59 CHECKs, 7 DEFERRABLE constraints | SQLite supports all three. |
| 145 timestamps without tz and 43 with | Needs one stated ISO-8601 convention. |
| 1 `pg_notify` call, **plus a listener in the kanban plugin** | Replace with an in-daemon change feed (SSE/event). |
| 2 `FOR UPDATE` sites, 14 recursive-CTE sites, 146 `RETURNING`, 33 `ON CONFLICT` | `RETURNING`, `ON CONFLICT` and CTEs work in SQLite. The two `FOR UPDATE` sites become `BEGIN IMMEDIATE`. |
| pgbouncer is **in the data path** (`DATABASE_URL` points at `fictionlab-pgbouncer:6432`, transaction pooling; migrations and LISTEN use `DIRECT_DATABASE_URL`) | It was added after a connection-exhaustion incident that the singleton shared pool (max 10) already fixed. Likely vestigial, but verify before removing (P0-8c). |

### Options

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| A. Keep Postgres 16 in Docker | Zero migration | Docker stays mandatory; the 1.1 GB footprint and update fragility remain | Status quo through P2 only |
| B. Embedded Postgres without Docker (`postgresql_embedded` and similar) | SQL, arrays, jsonb, triggers and plpgsql all unchanged; psql-style tooling can survive | Still a server process with initdb, ports, major-version upgrades, and 60 to 100 MB of binaries per platform; whether `psql` ships in the bundle is not verified | **Fallback** if SQLite's dialect cost is too high |
| C. **SQLite, WAL mode** (`sqlx` or `rusqlite`) | No process, one file; backup is `VACUUM INTO` or a file copy; the restore drill and off-machine sync get simpler; matches single-user local use | Rewrite of array/jsonb queries and triggers; one writer at a time; every external `docker exec psql` user must be rewired | **Recommended target**, gated |
| D. PGlite/WASM-style Postgres (`oliphaunt-wasix` etc.) | Postgres semantics without a server | Young; no evidence of production use here | Reject for now |
| E. Embedded KV (redb, LMDB) | Fast | The data is relational with 188 FKs | Reject |

### Why SQLite is viable here despite single-writer

All writers can go through the daemon. The only writers that bypass it today are scripts, and they should not be bypassing it: the kanban poller's own header comments say an `update_card`/`add_card_link` tool call "would be strictly better than psql". P3-6 moves them onto MCP tools. The atomic-claim pattern in `kanban` (`UPDATE … WHERE … RETURNING`) is preserved with `BEGIN IMMEDIATE`.

### Migration of existing canon data

This is a platform-engine migration run by a tool, not hand-loading canon, so it should not fall under the "no ingest/backfill beads" ruling (07-19, clarified 09-20, which bans one-off hand-loading outside a workflow). I am flagging that interpretation in Q5 rather than assuming it.

1. A one-shot `fictionlab db migrate-from-pg` in Rust, table by table, verifying row counts, per-table checksums and foreign-key integrity.
2. Rehearse first against a restored nightly backup, using the existing `RESTORE-RUNBOOK.md` drill.
3. **Shadow period.** Postgres stays the system of record; SQLite is rebuilt nightly and the parity harness runs against both.
4. Cutover is a flip; rollback is a reverse export (`fictionlab db export --pg`), rehearsed before cutover (P3-7).
5. Schema baseline comes from the **live** database, not `init.sql` or the local migration tree. The live database has 109 tables; counting migrations in a working tree gave about 101, and the local checkout was 6 commits behind origin.

### Spike gate (P3-1). Pass criteria

- All 109 tables port; the parity harness is green on the top 20 tools by recorded call volume.
- p95 latency on those tools within 2x of Postgres (they are at 4 ms today, so this is generous).
- No handler needs a Postgres-only feature that costs more than 5 points to emulate. If more than a handful do, take option B.

---

## 5. Plugin architecture (bead item 4)

**Recommendation: ABI v2 is an out-of-process sidecar model speaking JSON-RPC (MCP-shaped) over stdio, with a host-side capability broker. A Node-compat sidecar runs existing v1 plugins unchanged. WASM is an optional later tier for sandboxed compute plugins.**

### What exists (v1)

- Manifest `plugin.json`: `id`, `name`, `version`, `fictionLabVersion` (a range checked against the **app** version), `pluginType`, `entry.main`, `entry.renderer`, `permissions`, `dependencies`, `updateSource{repo,assetPattern,private,tagPrefix}`, `ui{mainView,menuItems,dashboardWidget}`. Real manifests drift from the typed contract (object-form permissions, off-type `menuItems`, `dependencies: []`), so the host must parse leniently.
- Lifecycle: a default-exported class with `onActivate(PluginContext)` and `onDeactivate()`; `require(entry.main)` in the host process; no hot reload (the app prompts for a restart).
- Install: a zip containing `dist/`, `dist-renderer/`, `plugin.json`, a generated `package.json` and `bundled/<pkg>` (the workflow plugin bundles `@fictionlab/workflow-runner`). Updates swap through `<id>.staging` and `<id>.bak` with recovery on launch. Plugin settings live in `<userData>/plugin-data/<id>`.
- UI: the renderer bundle's default export is a class with `mount(container, params)`, loaded into the privileged main window.

### Options

| Option | Verdict |
|---|---|
| A. In-process dynamic libraries (`cdylib`, `abi_stable`) | Reject. No stable Rust ABI, no sandbox, a plugin crash takes down the host, and it cannot run the existing TypeScript plugins. |
| B. WASM components (wasmtime, WIT) | **Later tier.** Real sandbox and typed interfaces, but none of the 7 plugins can run unchanged (they use `pg`, `fs`, `child_process`, `electron`). |
| C. **Sidecar process, JSON-RPC over stdio, host-mediated capabilities** | **Recommended.** Language-agnostic, crash-isolated, hot-reloadable, and permissions become real because the host brokers database, filesystem, MCP and process access. Matches how the rest of the system already works (MCP). |
| D. Keep a Node host for plugins forever | Reject as the end state, but option C's compat sidecar is a bounded version of it. |

### ABI v2 contract (to be specified in P4-1)

| Piece | v2 |
|---|---|
| Manifest | `plugin.json` v2: adds `abi: 2`, `runtime: node \| native \| wasm`, `entry.sidecar`, an explicit `capabilities` list, and `fictionLabApi` (a **plugin-API** semver range, separate from the app version). v1 manifests keep loading. A JSON Schema published with `@fictionlab/plugin-api`. |
| Host services (about 9, the set actually used) | `ipc.handle` (channel naming unchanged: `plugin:<id>:<channel>`), `mcp.callTool/listServers`, `fs`, `config`, `logger`, `paths` (`getPluginDataPath`, `getUserDataPath`), `workflow`, `events.emit` (replaces plugins importing `BrowserWindow` to push `webContents.send`), `process.spawn` (capability-gated; needed by agent-factory's `bd` calls and the online plugin's `start.ps1`). |
| Database | **No raw SQL in v2.** Plugin-owned storage is a per-plugin SQLite file; shared data is reached through MCP tools. The business plugin (27 raw-SQL sites on `fictionlab.biz_*`) moves to the `biz` server's tools. |
| Permissions | Declared capabilities are enforced by the broker: every host call is checked; sidecars get no ambient authority. This fixes "permissions are advisory". |
| UI | Same renderer contract (ESM bundle, default-exported class with `mount`). Loaded from `plugin://<id>/…` served by the host (with the path-traversal guard), and the plugin receives a **scoped `bridge`** instead of the unrestricted `window.electronAPI.invoke`. |
| Lifecycle | `activate` / `deactivate` as RPC; the host can restart one plugin without restarting the app. |
| Versioning | Semver on the plugin API. v1 supported for a stated window after v2 GA (Q10). |

### Compatibility with the 7 existing plugins

| Plugin | Uses today | Difficulty | Migration points |
|---|---|---|---|
| `fictionlab-chapter-editor` | 4 `chapter-editor:*` channels, filesystem | Low | 2 |
| `fictionlab-terminal` | renderer only; host owns the PTY | Low | 2 |
| `fictionlab-online` | dashboard widget, probes `:8090`, spawns `start.ps1` | Low (needs `process.spawn` and `network`) | 1 |
| `fictionlab-kanban` | 15 `board:*` handlers, `mcp.callTool('kanban')`, `LISTEN kanban_changed`, `BrowserWindow` push | Medium (change feed) | 3 |
| `fictionlab-agent-factory` | 27 `factory:*` channels, `config`, shells `bd` | Low to Medium (`process.spawn`) | 3 |
| `broadquill-business` | 27 raw SQL sites, `mcp` | Medium to High (SQL to tools) | 5 |
| `fictionlab-workflow` | 17 channels, the runner, a named-pipe IDE server, installs `~/.claude/skills/run-workflow`, `BrowserWindow` push, vm2 code nodes | **High** | 8 |

Until each plugin is migrated, the **Node-compat sidecar** (P4-3) hosts it unchanged: it implements `PluginContext` over RPC. Node is downloaded on demand only when a v1 or Node-runtime plugin is installed, so users who run no such plugin do not pay for a Node runtime. At least one third-party plugin exists (the themes plugin evaluated 2026-09-19, pinned to FictionLab 0.9.x), so the compatibility promise has a real audience.

### The workflow runner stays TypeScript

It is 11.7k LOC, has no direct database access (everything is 13 workflow-manager tools plus about 45 canon tools through the host MCP client), and no cloud SDK. Its hard parts for a port are JavaScript evaluation (six `eval`/`new Function` sites plus vm2 code nodes) and the serial local-generation queue semantics. It is LLM-bound, so Rust buys nothing, and the executor redesign (`2026-07-14-local-executor-redesign`) is still changing it. It runs in the Node sidecar. Revisit in P6 only if that changes (Q2).

---

## 6. Repo layout and naming (bead item 5)

**Recommendation: two product repos plus the two repos that already stand alone.**

| Today | Becomes | How |
|---|---|---|
| `RLRyals/MCP-Electron-App` (public) | **`RLRyals/FictionLab`** (public) | **Rename in place.** Keeps its 190 PRs, 16 releases and the Pages site, and GitHub redirects the old name for installed apps (their `app-update.yml` hardcodes the old owner/repo). |
| `RLRyals/MCP-Writing-Servers` (public, 0 tags) | imported into `FictionLab` | `git filter-repo --to-subdirectory-filter servers-legacy`, then merge with `--allow-unrelated-histories`; the old repo is frozen as a `git subtree split` mirror so installed apps' "Update MCP-Writing-Servers" button keeps working until the installed base has moved. Never archive it before then. |
| `RLRyals/fictionlab-workflow` (private, 67 tags) | **`RLRyals/FictionLab-Plugins`** (private) | Rename in place; keeps tags, releases and its working release pipeline. |
| `FictIonLab-Downloads` (GitHub: `FictionLab-Downloads`, private) | unchanged | Workflow YAML is the ratified "source control, DB is truth" repo. Renaming it costs 84 file references for no product benefit. |
| `FictionLab-Online` (private) | unchanged | Already correctly named; a separate consumer of the port contract by design. |

Dead folders (not repos to migrate): `fictionlab-workflow-kanban` and `fictionlab-workflow-utf8` are stale worktrees of fictionlab-workflow; `fictionlab-app` and `fictionlab-starter` are residue of the abandoned web version.

### Why merge the servers into the app repo

The app and the servers are one product that ships together, and today they are version-unlinked: the servers have no tags and the app pulls `main` HEAD. The drift evidence is concrete: three tool-to-port inventories, the 12-vs-16 port mismatch, and the `mea-006`/`mea-72q`/`flw-d0h` bug family. One repo allows one `contracts/servers.json` that generates the host port map, `mcp-config.json` and the docs.

### Why plugins stay separate

The plugin-containment ruling (07-09) says plugin code lives in the plugin and updates without an app release. A separate repo enforces that physically, supports third-party authors against a versioned `@fictionlab/plugin-api` package, and keeps private plugins private (fictionlab-workflow is private; the app repo is public, and a monorepo cannot mix visibility). It also keeps plugin tags out of the app repo, which matters for finding 13.

### Proposed layout

```
FictionLab/                        public, renamed MCP-Electron-App
  apps/desktop/                    Electron now, Tauri later (renderer TS shared)
  crates/fictionlab-core           paths (%APPDATA%\fictionlab), config, logging
  crates/fictionlab-db             schema, migrations, query layer
  crates/fictionlab-mcp            registry, transports, envelope, groups/aliases
  crates/fictionlab-servers        the 16 servers' handlers (feature-gated)
  crates/fictionlab-plugin-host    sidecar broker, manifest, capabilities
  crates/fictionlabd               the daemon binary
  packages/plugin-api              @fictionlab/plugin-api (TS types + JSON Schema)
  contracts/                       tools.json, servers.json, ipc-channels.json, manifest.schema.json
  servers-legacy/                  Node servers, deleted per server after soak
  docs/  specs/  site/

FictionLab-Plugins/                private, renamed fictionlab-workflow
  plugins/<id>/                    one folder per plugin, own version and tags
  packages/workflow-runner/
  .github/workflows/release-plugin.yml   one reusable workflow
```

### History, beads and in-flight work

- Use `git filter-repo`; do not copy files. PR and issue numbers cannot be preserved for the imported repo, so MCP-Writing-Servers stays readable and referenced from a `MIGRATION.md`.
- **In-flight PRs and review cards key on `owner/repo#N`.** Freeze and merge or close open PRs for each repo before its cutover, and record an id map.
- **Beads:** the fleet discovers `C:\github\<repo>\.beads` per repo, with prefixes `mea`, `mws`, `flw`. Whether `bd` can host several prefixes in one database is unverified. The safe default is: new work in the merged repos uses a new prefix (`fl-`), old beads finish in their old databases, and a mapping lets `Closes bead:` lines keep resolving (P1-10, Q13).
- **Remote rename is not local rename.** `gh` derives `owner/repo` from the remote URL and follows GitHub's redirect, so the fleet keeps working after the remote rename; local directories are renamed in one coordinated window afterwards (section 9).
- Never create a new repository that reuses an old name; it would break the redirect that installed apps depend on.

---

## 7. Independent per-plugin versioning and releases (bead item 6)

**Recommendation: keep the ratified `<plugin-dir>-vX.Y.Z` tag scheme and the automatic-release rule; add a signed static update feed; collapse the seven copied release jobs into one reusable workflow.**

### Current state (it already mostly works)

Per-plugin tags (`workflow-plugin-v1.10.1`, `kanban-plugin-v1.3.0`, …) each run only their own job (`flw-2t6`); guards check that the packaged `plugin.json` version equals the tag, that `plugin.json` and `package.json` agree, that source changes carry a version bump, and that a merged bump is auto-tagged and dispatched. The app's updater picks the **highest semver** release whose tag starts with the plugin's prefix (`mea-tp3`).

### Gaps this plan closes

| Gap | Fix |
|---|---|
| Update discovery walks the GitHub Releases API (30 per page, 10 pages) and needs a personal token (`GITHUB_PLUGINS_TOKEN`) for the private repo | A static feed (below). |
| `KNOWN_PLUGIN_UPDATE_SOURCES` hardcodes three plugins inside the app | Sources come from the manifest and the feed only. |
| `release-plugin.yml` is 1,098 lines, seven copy-pasted jobs, inconsistent asset names (`fictionlab-chapter-editor-vX.zip` versus `fictionlab-<x>-plugin-vX.zip`) | One reusable workflow with a matrix generated from the plugin manifests; one asset-name rule. |
| `chapter-editor` has a release job in one repo and an unpublished `updateSource` in the other | P1-4 picks one home. |
| Plugin zips have only a `.sha256` sidecar, yet execute code in the host | Signature verification (ed25519/minisign) in the host. |
| Version lives in two files and in a hardcoded class field (these have drifted) | `plugin.json` is the single source; `package.json` is generated. |
| Plugin compatibility is checked against the **app** version | `fictionLabApi` range on the plugin API, plus feed-side `min_host_api`/`max_host_api` so an update never lands where it cannot run. |

### The update feed

```
<feed-root>/v1/<component>/<channel>.json
{ "component": "fictionlab-kanban", "channel": "stable",
  "version": "1.3.0", "pub_date": "2026-10-04T…Z", "notes": "…",
  "host_api": { "min": "2.0", "max": "2.x" },
  "assets": [ { "name": "…zip", "url": "…", "sha256": "…", "size": 123456 } ],
  "signature": "…" }
```

- `component` is the app or any plugin id. `channel` is `stable` or `beta`.
- It can be served from GitHub Pages today and any static host later, so **update discovery stops depending on GitHub's "latest release"**, which is the lock-in and the hazard in finding 13.
- Releases remain the artifact store. The feed is generated by CI after a successful release job.
- The app updater (Electron `electron-updater` generic provider now; `tauri-plugin-updater`, which uses the same static-JSON-with-signature model, later) and the plugin updater both read the feed and fall back to the GitHub Releases path during the transition.

### Rules

- **Never publish a plugin release into the app repo** until every supported installed app reads the feed. That keeps the installed base's `latest.yml` lookup safe.
- Keep "releases are automatic": the auto-tag job fires only on a version-file change in a merged PR, and a behavior change without a bump ships silently. The bump rule applies to Rust crates (`Cargo.toml`) as well as `plugin.json`.
- Rollback: keep the `.bak` swap and recovery; add a user-visible "pin / roll back to previous version".
- Verify before relying on it: P1-2 includes a test that a v0.10.x installed app still updates after the rename and the feed change.

---

## 8. Hosting (bead item 7)

**Recommendation: stay on GitHub. Make leaving a configuration change by removing five hard couplings now. Revisit only on a trigger (cost, a sustained outage record, or a policy change).**

### Options

| Option | Notes |
|---|---|
| **GitHub (status quo)** | Public app repo means free Actions minutes and hosted Windows, macOS and Linux runners, including `windows-11-arm`; Pages and Releases already used. No Mac hardware is recorded in `machine-fleet.md`. |
| Forgejo / Gitea, self-hosted | Forgejo Actions reads GitHub-style workflows (copy `.github/workflows` to `.forgejo/workflows`; marketplace actions resolve through `DEFAULT_ACTIONS_URL`). **You supply every runner**: no hosted macOS or Windows runners, so building the installers needs your own Mac and Windows boxes. Another server to patch, back up and keep reachable. |
| GitLab (SaaS or self-hosted) | Different CI syntax (a rewrite of all workflows), same runner problem for macOS. |
| GitHub plus a self-hosted mirror | Cheap insurance for access and backup without moving CI. Optional (Q11). |

### What breaks if the forge changes (all verified in the scripts)

| Component | Dependency |
|---|---|
| `merge-watcher.ps1` | `gh pr list --state merged --json …`; matches `Closes bead:` in the PR body and `owner/repo#N` on review cards; `gh pr view` |
| `pr-check-watcher.ps1` | `gh pr list --state open` with `statusCheckRollup`, `gh api repos/…/commits`, `gh repo view` |
| `factory-dispatch.ps1` | `gh repo view` (default branch, which is `develop` here and `main` in the local cache), `gh pr list`, `gh api` (comments), `gh pr comment`; dispatch prompt steps call `gh pr create/view` and `gh run view` |
| `worktree-janitor.ps1`, `beads-kanban-poller.ps1` | `gh pr list --head`, `gh pr list --state open` |
| Dispatch prompt discipline | PR-conflict check (`gh pr view --json mergeable`), CI polling, "Closes bead" convention |
| CI | `build.yml` (3-OS matrix), `release.yml` (4 build jobs, `softprops/action-gh-release@v2`), `pages.yml` (`actions/deploy-pages`), `test.yml`, `release-plugin.yml`, `build-plugin.yml`; `GITHUB_TOKEN`, `github.repository`, `gh workflow run` (needed because tags pushed with `GITHUB_TOKEN` do not trigger workflows) |
| Updaters | `electron-updater` `github` provider; `plugin-github-updater.ts` and `release-notes.ts` (Releases API); `GITHUB_PLUGINS_TOKEN`; `github-credential-manager.ts` |
| Other | `scripts/pages/generate.sh`, the in-app help and about links, the kanban server's GitHub-sync poller, `close-migrated-gh-issues.sh`, the `RLRyals/claude-skills` and `claude-shared` repos, and `gh` authentication as `RLRyals` everywhere |

The ratified rule "GitHub = code, PRs and CI only" (dev-work-tracking) already keeps issues and project management off GitHub, which makes a move cheaper than it would otherwise be.

### The five decoupling steps (all in P1, none require leaving)

1. Update feed (section 7) replaces Releases-API discovery.
2. A small `forge` adapter library for the fleet scripts: one place that knows how to list merged PRs, open PRs, default branch and comments. Today seven scripts each call `gh` directly.
3. CI written against reusable workflows with no GitHub-only features beyond runners and `GITHUB_TOKEN`, so porting to `.forgejo/workflows` is a copy.
4. No app code that parses `github.com` URLs except through the feed and the adapter.
5. Optional nightly mirror, using the existing off-machine backup pattern.

---

## 9. Ripple map (bead item 9)

What depends on the current names, paths, ports or container names, and what each phase must change. "Remote rename" is cheap because of GitHub redirects; the **local directory rename** is the expensive part.

### A. Fleet scripts in `~/.claude/shared/scripts`

| File | Depends on | Changes in |
|---|---|---|
| `factory-dispatch.ps1` | repo path list (fictionlab-workflow, MCP-Writing-Servers, MCP-Electron-App, FictIonLab-Downloads, FictionLab-Online, BookWorld), `gh` calls, a per-repo file map for `fictionlab-workflow` (`packages/workflow-plugin/skills/run-workflow/ipc-client.js`), prompt text that names the version-bump rules per repo | P1-9 |
| `merge-watcher.ps1` | `C:\github` auto-discovery of `.beads`, `gh pr list --state merged`, `docker exec fictionlab-postgres psql` for kanban card closing | P1-9, P3-6 |
| `pr-check-watcher.ps1`, `worktree-janitor.ps1`, `Get-Predecessor.ps1` | the repo path lists, `gh` | P1-9 |
| `beads-kanban-poller.ps1` | `docker exec -i fictionlab-postgres psql -U writer -d mcp_writing_db`, port `3015` note, `gh pr list` | P3-6 |
| `dispatcher-heartbeat.ps1`, `run-hidden.vbs` | `C:\github\fictionlab-workflow\scripts\factory-fiction-dispatch.ps1` and `fiction-watcher.ps1` | P1-8 |
| `backup-fictionlab-db.ps1`, `sync-offmachine.ps1`, `RESTORE-RUNBOOK.md` | `pg_dump` of the container | P3-6 |
| `verify-task-paths.ps1` | the 8 registered tasks (Dispatcher Heartbeat, Beads Off-Peak Dispatch, FictionLab DB Daily Backup, Hermes Daily Backup, Beads Kanban Poller, Beads Merge Watcher, Newsletter Reminder, PR Check Watcher) plus fictionlab-workflow's Fiction Watcher and Factory Fiction Dispatch | run after every rename |

### B. Shared configs and docs to update

`projects.md` (the "99 tools" claim, roles, the ripple line about `docker-compose.yml` port publishing), `dev-work-tracking.md` (29 references, the area-label registry including `area:plugin-release`, the version-bump rules), `canon-db-architecture.md` (9), `pgbouncer-image.md` (7), `workflow-definition-lifecycle.md`, `fictionlab-online.md`, `claude-skills-repo.md`, `INDEX.md` pointers, and the `mcp-tool-grouping` and `plugin-containment-principle` entries in `solved-problems.md`.

### C. Skills

`~/.claude/skills/run-workflow` (`ipc-client.js`, `skill.ts`, `SKILL.md`, `workflow-reference.md`): the named pipe `\\.\pipe\fictionlab-workflow-runner` (Unix socket `/tmp/fictionlab-workflow-runner.sock`), 12 methods. **This pipe protocol is a public interface of the app**; every shell and plugin-host change must keep it, and it is the only way the Claude Code harness reaches the engine.

### D. FictIonLab-Downloads (84 files reference these names)

- `tools/import-workflow.js` hardcodes `C:\github\fictionlab-workflow\node_modules\js-yaml`, `C:\github\MCP-Writing-Servers\node_modules\@modelcontextprotocol\sdk\…` and `…\src\mcps\workflow-manager-server\stdio-adapter.js`.
- `tools/export-workflow.js` runs `docker exec fictionlab-postgres psql`.
- `.mcp.json` points at the same stdio adapter.
- `schemas/workflow.schema.json`, `tools/harness/*`, specs and docs.

### E. FictionLab-Online

`lib/biz-server-client.js`, README, tests and design docs; hardcoded ports **3001, 3002, 3003, 3005, 3009, 3014, 3015** (never 3010) over `POST /api/tool-call`; `fictionlab-online-plugin` spawns `C:\github\FictionLab-Online\start.ps1`. The contract with it is the port numbers and the `/api/tool-call` shape, both preserved by the daemon.

### F. Client configs

Claude Desktop `claude_desktop_config.json` (9 entries run `docker exec -i -e MCP_STDIO_MODE=true fictionlab-mcp-servers node /app/src/config-mcps/<name>/index.js`; the app writes this file, so P2-16 changes the generator), the TypingMind connector config, Claude Code `.mcp.json`/settings stdio entries.

### G. Path-keyed state on this machine

- Claude Code per-project data is **keyed by directory path** (`~/.claude/projects/C--github-MCP-Electron-App`, including the auto-memory) and `~/.claude.json` project entries. Renaming `C:\github\MCP-Electron-App` orphans them unless moved with the folder.
- `FictionLab-All.code-workspace`, Casey's `additionalDirectories`.
- `%APPDATA%\fictionlab\`: `plugins/`, `plugin-data/`, `repositories/mcp-writing-servers` (a git clone and its Docker build context), `docker/` (generated pgbouncer config), `agent-factory/`, `media/`, `app-settings.json`, `llm-providers.enc.json` (Electron safeStorage; see finding 12).

### H. The app itself

`APP_REPO`, `build.publish`, `scripts/pages/generate.sh`, the help and about links, `KNOWN_PLUGIN_UPDATE_SOURCES` (workflow, kanban, agent-factory), the 12-server port map in `plugin-context.ts`, `docker-images.ts` (expects `postgres:15`; compose uses 16), the container names `fictionlab-postgres`, `fictionlab-pgbouncer`, `fictionlab-mcp-servers`, `fictionlab-mcp-connector`.

### I. Not affected

AuthorWebsite, BookWorld and the Series directories (no references found). Ink-N-Code/MegaCore references the names in analysis notes only.

---

## 10. Phased migration (bead item 8)

Strangler order, with a gate after every phase. Points are the dispatch convention (Fibonacci 1/2/3/5/8; complexity plus risk plus review burden, not wall-clock). An 8-point bead dispatches alone. Beads listed in section 11.

| Phase | Theme | Points | Gate to proceed | Rollback |
|---|---|---|---|---|
| **P0** | Measure, freeze contracts, build the parity harness, hygiene quick wins. | 40 | Harness green Node-vs-Node; baseline numbers recorded; contracts committed | Nothing to roll back |
| **P1** | Rename, import servers, single-source contracts, update feed, per-plugin release workflow, fleet re-pointing. **No Rust.** | 54 | An installed v0.10.x app still updates; one full dispatch cycle runs green on the new names | Rename back (while the old name is unreused); the frozen MWS mirror keeps old installs working |
| **P2** | Rust daemon, server by server, still on Postgres. | 94 | Per server: contract parity, two weeks of real use, zero rollbacks | Per-server switch back to the Node container; Node code kept until soak ends |
| **P3** | Database: SQLite spike, migrator, dialect port, fleet off `psql`, cutover. Docker becomes optional. | 53 | Spike criteria met; shadow period clean; reverse export rehearsed | Reverse export to Postgres; Postgres container retained for the shadow period |
| **P4** | Plugin ABI v2 on Electron; compat sidecar; migrate the 7 plugins. | 53 | All 7 plugins run under v2 or the compat sidecar with enforced permissions | Compat sidecar keeps v1 behavior; v1 loader retained one release |
| **P5** | Tauri shell: spike, bridge, port channels, updater, installers, dual-channel rollout. | 82 | Spike criteria (section 2); two releases on a beta channel | Reinstall the Electron build; it stays published for two releases |
| **P6** | Deferred, no estimate: workflow runner in Rust, WASM plugin tier, code signing, a plugin registry. | n/a | Own go/no-go | n/a |

**Total: 376 points nominal (40 + 54 + 94 + 53 + 53 + 82). Plan on about 490 with 30% contingency.** At the 8-point off-peak session budget that is roughly 47 sessions nominal, run mostly serially because same-area beads collide on shared files (the `test.yml` and server-registration hotspots). The estimate is low-confidence; **re-estimate after P2-3 and P2-4**, the first real Rust work.

### Critical path and parallelism

P0 gates everything. P1 and the Electron-side parts of P2 can overlap after P0. P3 depends on P2's server coverage and on the harness. P4 can start once P1-3 (plugin API package) is done and does not depend on P2 or P3, except that the business plugin's migration to `biz` tools wants P2-8. P5 depends on P2 to P4 being shell-agnostic and on the spike.

### Parity testing, summarized

Tool-surface snapshot (every phase), recorded-traffic replay (P2/P3), database end-state diffs (P3), manifest and IPC-channel contract files (P4/P5), and the app's existing 78 test files, of which the injectable ones (plugin-update-swap, plugin-github-updater, release-notes, ipc-registry, compose-sync, `verify-release-assets.js`) are written as fixtures a Rust implementation can run.

### Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Rebecca's review capacity is the bottleneck (about 375 points of PRs; merge is approval) | High | High | Make "parity harness green" the review criterion; batch merges per phase; hold P1+ until the draft is done (Q1) |
| R2 | Servers keep changing in Node during the port | High | Medium | Port only quiet servers; once ported, Rust-only for new tools; `biz` and `outline` late |
| R3 | Hidden consumers of wire behavior | Medium | High | Recorded traffic; the pipe protocol and `/api/tool-call` shapes are frozen contracts |
| R4 | Fleet breakage (hardcoded paths, `gh`, `psql`) | High | High | P1-9 and P3-6 are explicit beads; run one dispatch cycle on the new names before proceeding |
| R5 | Tauri webview variance (Linux), macOS update, e2e | Medium | Medium | Spike gate; fallback is Electron plus daemon |
| R6 | Installed-base update continuity (rename, feed, unsigned Electron to Tauri) | Medium | High | Redirect-safe rename, never reuse old names, installed-app update test in P1-2, dual-channel rollout |
| R7 | Database migration data loss | Low | Very high | Verified migrator, restore-drill rehearsal, shadow period, reverse export, existing nightly off-machine backups |
| R8 | Rust toolchain not in place: **`cargo` is not installed on this machine** (checked) | Certain | Low | P0-7; Windows needs the MSVC build tools; CI cache from day one |
| R9 | Node-compat sidecar keeps a Node runtime alive and erodes the footprint win | Medium | Low | On-demand download; plugin-by-plugin migration; measure in P4 |
| R10 | Scope creep to "Rust everything" (runner, FictionLab-Online) | Medium | High | Explicit non-goals below |
| R11 | Beads id and PR-ref continuity across merged repos | Medium | Medium | Freeze windows; id map; verify `bd` multi-prefix support first (P1-10) |
| R12 | Security regression during the move, or the existing exposure persists | Medium | High | P0-9 now; token auth in P2-2 |

### Explicit non-goals

The workflow runner stays TypeScript. FictionLab-Online stays zero-dependency Node. The renderer stays TypeScript and React. Workflow YAML stays in FictIonLab-Downloads. No changes to canon content, the Series directories or the fiction lane.

---

## 11. Proposed child beads (NOT created; awaiting Rebecca's approval)

Each would be one bead with one `area:` label and a points estimate. `repo` is where the work lands. `deps` are within this list.

### P0: measure and freeze (40)

| ID | Title | Pts | Repo | Deps |
|---|---|---|---|---|
| P0-1 | Dump the 16-server tool surface to `contracts/tools.json` (names, schemas, groups, duplicates) | 3 | MWS | none |
| P0-2 | Traffic recorder on `/api/tool-call` and stdio; two-week capture | 3 | MWS | none |
| P0-3 | Synthetic seed-database fixture and restore script (no manuscript text) | 5 | MWS | none |
| P0-4 | Differential parity harness (replay, envelope normalizer, database end-state diff) | 8 | MEA | P0-1, P0-3 |
| P0-5 | Resolve dead and duplicate tools (`get_writing_progress`, `update_relationship_arc`, `TropeMCPServer`, 12 multi-port names) or declare them dropped | 3 | MWS | P0-1 |
| P0-6 | Baseline measurements: start to usable UI, first run, update flow, RAM, disk, installer size; write `docs/perf-baseline.md` | 3 | MEA | none |
| P0-7 | Rust toolchain on the dev box, CI cache, and fleet dispatch-prompt guidance for `cargo` | 3 | shared | none |
| P0-8a | Upgrade Electron ^28 to a supported major | 5 | MEA | none |
| P0-8b | Remove unused deps (`vm2`, `simple-git`, `dotenv`, `@xyflow/react`, `jsonpath`) from the app; fix the dead import-map entry and the 16 handler-less preload channels; correct port-count docs | 2 | MEA | none |
| P0-8c | Verify whether pgbouncer is needed; remove it if not (re-point `DATABASE_URL`; keep `DIRECT_DATABASE_URL`) | 2 | MEA | none |
| P0-9 | Bind published ports to `127.0.0.1` (after confirming no remote consumer) and add a token check for the MCP servers | 3 | MEA + MWS | none |

### P1: restructure, no Rust (54)

| ID | Title | Pts | Repo | Deps |
|---|---|---|---|---|
| P1-1 | Update-feed spec, signing key handling, feed generator in CI | 5 | MEA | none |
| P1-2 | App and plugin updaters read the feed with a GitHub-Releases fallback; test that an installed v0.10.x app still updates | 8 | MEA | P1-1 |
| P1-3 | `@fictionlab/plugin-api` as a single source plus the manifest JSON Schema; remove the two diverged copies | 5 | MEA + FLW | none |
| P1-4 | Resolve the duplicate `chapter-editor` plugin: one home, one release job | 2 | MEA + FLW | none |
| P1-5 | One reusable plugin-release workflow (matrix from manifests), normalized asset names, existing guards kept | 5 | FLW | P1-3 |
| P1-6 | Rename MCP-Electron-App to FictionLab in place; fix the in-app constants, `build.publish`, Pages and docs | 5 | MEA | P1-2 |
| P1-7 | Import MWS history into `servers-legacy/`; single-source `contracts/servers.json` generating the port map, `mcp-config.json` and docs; frozen subtree-split mirror for old installs | 8 | MEA | P1-6, P0-1 |
| P1-8 | Rename fictionlab-workflow to FictionLab-Plugins; repoint the scheduled-task scripts it hosts | 3 | FLW + shared | P1-5 |
| P1-9 | Fleet, skills and FictIonLab-Downloads rewiring (ripple map A to E), including the `forge` adapter library | 8 | shared | P1-6, P1-8 |
| P1-10 | Beads continuity: verify multi-prefix support, id map, freeze and merge in-flight PRs | 5 | shared | none |

### P2: Rust daemon on Postgres (94)

| ID | Title | Pts | Deps |
|---|---|---|---|
| P2-1 | Cargo workspace, CI matrix, per-target-triple release artifacts | 8 | P0-7, P1-7 |
| P2-2 | MCP framework: registry with groups and aliases; stdio, streamable HTTP, legacy SSE and `/api/tool-call` shims; `/health`, `/info`, `/tools`; one envelope | 8 | P2-1, P0-1 |
| P2-3 | Walking skeleton: `author` server end to end behind a flag | 3 | P2-2, P0-4 |
| P2-4 | `kanban` server (15 tools, claim race, change feed, GitHub-sync poller) | 8 | P2-3 |
| P2-5 | `workflow-manager` part 1: definitions, versions, guarded import, restore | 8 | P2-4 |
| P2-6 | `workflow-manager` part 2: graph operations, active-workflow lifecycle | 5 | P2-5 |
| P2-7 | `outline` server (24 tools, recursive CTEs) | 5 | P2-4 |
| P2-8 | `biz` server (14 tools); hold until S15 stabilizes | 3 | P2-4 |
| P2-9 | Domain slice (a): series, book, metadata | 5 | P2-4 |
| P2-10 | Domain slice (b): character, relationship, plot | 5 | P2-4 |
| P2-11 | Domain slice (c): world, timeline, trope | 8 | P2-4 |
| P2-12 | Domain slice (d): writing, project-manager, reporting | 5 | P2-4 |
| P2-13 | Phase groupings (12 aggregators) as declarative data plus the alias table | 5 | P2-9..P2-12 |
| P2-14 | `npe` (20) and `story-analysis` (7) servers | 5 | P2-4 |
| P2-15 | Per-server cutover switch in the host port map, with rollback | 5 | P2-3 |
| P2-16 | Host-binary supervisor; Claude Desktop and Claude Code entries launch the binary (replaces `docker exec -i`, three stdio adapters and the socat bridge) | 5 | P2-2 |
| P2-17 | Retire each Node server after soak | 3 | per server |

### P3: database (53)

| ID | Title | Pts | Deps |
|---|---|---|---|
| P3-1 | SQLite spike and decision record (criteria in section 4) | 8 | P2-4 |
| P3-2 | `fictionlab-db`: baseline schema from the live database; migration runner replacing the psql-based migrator | 8 | P3-1 |
| P3-3 | PG to SQLite migrator with verification; rehearsal against a restored backup | 8 | P3-2 |
| P3-4 | Dialect port: arrays, jsonb, `ILIKE`, interval, `FOR UPDATE`; change feed replaces `LISTEN`/`NOTIFY` | 8 | P3-2 |
| P3-5 | `database-admin` server on SQLite (PRAGMA introspection, `VACUUM INTO` backup) | 5 | P3-2 |
| P3-6 | Move the fleet off `docker exec psql`: poller and merge-watcher via MCP tools; backup and off-machine sync; `export-workflow.js`; update `RESTORE-RUNBOOK.md` | 8 | P3-4 |
| P3-7 | Cutover with shadow period; rehearse the reverse export | 5 | P3-3, P3-6 |
| P3-8 | Remove the postgres, pgbouncer and connector containers; Docker becomes optional | 3 | P3-7 |

### P4: plugin ABI v2 (53)

| ID | Title | Pts | Deps |
|---|---|---|---|
| P4-1 | ABI v2 specification: manifest v2, capabilities, RPC protocol, versioning and deprecation policy | 8 | P1-3 |
| P4-2 | Host broker in Electron main: sidecar spawn, capability enforcement, push-event API | 8 | P4-1 |
| P4-3 | Node-compat sidecar for v1 plugins; on-demand Node runtime | 8 | P4-2 |
| P4-4 | `plugin://` scheme and the scoped `bridge` replacing `file://` `import()` and open `invoke` | 5 | P4-2 |
| P4-5a to g | Migrate the 7 plugins: chapter-editor 2, terminal 2, online 1, kanban 3, agent-factory 3, business 5, workflow 8 | 24 | P4-3, P4-4 (business also P2-8) |

### P5: Tauri shell (82)

| ID | Title | Pts | Deps |
|---|---|---|---|
| P5-1 | Spike on Windows, macOS and Linux (criteria in section 2) and decision record | 8 | P0-6 |
| P5-2 | Typed renderer `bridge` adapter, shipped on Electron first | 8 | none |
| P5-3a to d | Port the thin IPC channels as Tauri commands, four slices | 32 | P5-1, P5-2 |
| P5-4 | Docker-free setup wizard redesign | 8 | P3-8 |
| P5-5 | PTY on `portable-pty` and the terminal host | 5 | P5-1 |
| P5-6 | Credential-store migration from `safeStorage` to the OS keyring | 5 | P5-1 |
| P5-7 | Updater, installers, signing keys, Electron-to-Tauri in-place migration preserving `%APPDATA%\fictionlab` | 8 | P1-2, P5-1 |
| P5-8 | End-to-end strategy (browser with mocked bridge; `tauri-driver` on Windows and Linux) | 5 | P5-2 |
| P5-9 | Dual-channel rollout and Electron retirement | 3 | P5-7 |

Per the split rule: if any phase ships in slices, every dependent bead must be re-pointed onto the follow-up bead in the same step.

---

## 12. Open questions for Rebecca

Each has my recommended default so a quick "yes" unblocks work.

| # | Question | Default if you say "go" |
|---|---|---|
| **Q1** | **Timing.** The 09-12 priority plan says "no new lanes until the book 1 draft is done" and names rebuilding pipelines as a stall cause. Start P0 now and hold P1 onward until the draft passes about 80% (about early December), or start earlier? | P0 now; P1 in December; P2 from January |
| Q2 | **Scope of "Rust".** Daemon, database layer, plugin host and shell only, with the workflow runner staying TypeScript (it is LLM-bound and still changing)? | Yes, runner stays TS |
| Q3 | **Visibility and licence.** The app repo is public with `UNLICENSED` in `package.json`. Keep `FictionLab` public? Choose a licence? Which plugins are private (business and fictionlab-workflow are private today)? | `FictionLab` public, `FictionLab-Plugins` private, licence deferred |
| Q4 | **Names.** `FictionLab` and `FictionLab-Plugins`? Leave `FictIonLab-Downloads` alone? | Yes to both |
| Q5 | **Database.** SQLite as the target, gated by a spike, with embedded Postgres as the fallback? And does the platform DB-engine migration (a tool run, not hand-loading canon) sit outside the "no ingest/backfill beads" ruling? | Yes to SQLite-gated; yes it is outside |
| Q6 | **Is "no Docker required" a hard goal?** It drives P3 and P5-4. | Yes |
| Q7 | **Platforms.** Windows x64, macOS arm64 and Linux AppImage first-class; Windows ARM and macOS Intel best-effort (Windows ARM may fail the release today without blocking it)? | Yes |
| Q8 | **Signing.** Installers are unsigned today. Buy an Apple Developer account and Windows signing for the Tauri build? This changes the macOS update story and SmartScreen warnings. | Defer; ask after the P5 spike |
| Q9 | **Connectors.** Is TypingMind still used? The connector container runs `npm i -g @typingmind/mcp@latest` at every start, which does not fit a Docker-free design. Keep Claude Desktop and Claude Code via the stdio binary. | Drop TypingMind unless used |
| Q10 | **Plugin compatibility window.** How long must ABI v1 plugins keep working after v2 ships, given at least one third-party plugin exists? | Six months |
| Q11 | **Mirror.** Want a nightly self-hosted mirror of the repos as insurance, or rely on the existing off-machine backup? | Rely on backups for now |
| Q12 | **Approval to create the beads in section 11,** and to file the cross-repo ones (`shared`, MWS, FLW) in their own repos. | Create P0 only, on your word |
| Q13 | **Bead prefixes** after the merge: new `fl-` prefix with old beads finishing in place (default), or migrate the old ones? | New prefix |
| Q14 | **P0-9 (loopback binding and MCP auth) can ship without the rewrite.** Do it now? Is any other machine (the desktop) reading the laptop's MCP ports or Postgres? | Yes, after you confirm no remote consumer |
| Q15 | **Where does chapter-editor live** (finding 7)? | `FictionLab-Plugins` |

---

## Appendix: method and caveats

**Measurements (reproducible).** Database: `psql` inside `fictionlab-postgres` (user `writer`, database `mcp_writing_db`) with read-only queries against `information_schema`, `pg_stat_user_tables`, `pg_extension`, `pg_proc`, `pg_trigger`, `pg_constraint`. Latency: 30 sequential `curl` `POST` calls of `{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_boards","arguments":{}}}` to `http://127.0.0.1:3015/api/tool-call`; sorted for percentiles. Containers and images: `docker stats --no-stream`, `docker images`, `docker port`. A single read-only tool on one server is a floor for protocol overhead, not a profile of the heavy handlers (`get_scene_brief` runs 8 queries; `generate_report` is 620 LOC).

**Inventories.** Three read-only code inventories (MCP-Electron-App, MCP-Writing-Servers, fictionlab-workflow) plus direct checks of `docker-compose.yml`, the credential store, the plugin copies and the fleet scripts. Counts from regexes are estimates; they are marked "about" where so.

**Where the numbers are soft or stale.**
- The local MCP-Writing-Servers checkout was 6 commits behind origin/main and the local fictionlab-workflow checkout was 12 commits behind (workflow plugin 1.6.3 local versus 1.10.1 on origin). The live database figures are authoritative where they differ from migration counts (109 tables live versus about 101 counted).
- Read/write ratios of tools are by name only; there is no call-frequency telemetry (P0-2 creates it).
- Channel classes in section 2 are prefix counts, not a per-channel audit.
- I did not install a Rust toolchain (`cargo` is absent), so no Rust prototype or benchmark was produced. All Rust-side claims are about the ecosystem, from `docs.rs` and Tauri's documentation on 2026-10-10, not from running code.
- I did not verify: whether Windows Firewall blocks the published ports; whether `bd` supports several prefixes in one database; whether `psql` ships in embedded-Postgres bundles; whether an unsigned macOS bundle can be replaced by the Tauri updater; how GitHub's atom feed treats interleaved plugin releases for `electron-updater`.

**Sources consulted (external).** rmcp on docs.rs (3.1.0 README); Tauri 2 documentation (webview versions, updater, sidecars); Forgejo documentation and 2026 migration write-ups; wasmtime/WASI component-model and Extism comparisons; `postgresql_embedded` and the SQLite-vs-Postgres comparisons. Internal: `configs/canon-db-architecture.md`, `pgbouncer-image.md`, `workflow-definition-lifecycle.md`, `dev-work-tracking.md`, `priority-plan-2026-09.md`, `machine-fleet.md`, `fictionlab-online.md`, `projects.md`, `solved-problems.md` (plugin-containment, plugin-release-tag-vs-manifest), and the fleet scripts under `shared/scripts`.
