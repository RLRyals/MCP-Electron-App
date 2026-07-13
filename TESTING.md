# Tester Checklist (bead mea-0um)

This is the manual test script for anyone doing real-machine testing of a
FictionLab installer -- Linux Mint (or any Debian/Ubuntu-family distro),
macOS (Apple Silicon), or Windows (x64 or ARM64). CI (`.github/workflows/release.yml`)
covers install/launch-level checks on hosted runners; it cannot cover Docker
Desktop setup, database initialization, or real hardware quirks. That's what
this checklist is for.

If you're reporting results, please use the
[Platform Test Report](../../issues/new?template=platform-test-report.yml)
issue form instead of (or alongside) this file -- it mirrors these steps as
structured checkboxes plus a log-attachment field.

## Before you start

- Note your exact OS version and CPU architecture (e.g. "Windows 11 24H2,
  ARM64" or "Linux Mint 21.3, x64" or "macOS 14.5, Apple Silicon"). You'll
  need this for the report.
- Have Docker Desktop **not** installed yet if you can manage it -- the
  first-run wizard's Docker-detection path is one of the things being tested.
  If Docker Desktop is already installed, that's fine too; just note it in
  your report.

## 1. Download and verify

- [ ] Download the installer for your platform from the release page.
  - Windows: `FictionLab Setup <version> x64.exe` or `... arm64.exe`
  - macOS: `FictionLab-<version>-arm64.dmg` (Apple Silicon)
  - Linux: `FictionLab-<version>.AppImage` or `fictionlab_<version>_amd64.deb`
- [ ] Verify the SHA256 checksum against the matching `checksums-*.txt` file
      in the release.
  - Windows (PowerShell): `Get-FileHash .\FictionLab*.exe -Algorithm SHA256`
  - macOS: `shasum -a 256 FictionLab*.dmg`
  - Linux: `sha256sum FictionLab*.AppImage` or `fictionlab*.deb`

## 2. Install

**Windows (x64 or ARM64):**
- [ ] Double-click the installer.
- [ ] SmartScreen will likely warn "Windows protected your PC" -- this build
      is unsigned (see "Known limitations" below). Click **More info** ->
      **Run anyway** to proceed. Note whether this warning appeared.
- [ ] Follow the install wizard (you may change the install directory).
- [ ] Launch from the Start Menu or the desktop shortcut.

**macOS (Apple Silicon):**
- [ ] Open the DMG, drag FictionLab to Applications.
- [ ] This build is unsigned and not notarized -- the first launch attempt
      via double-click will likely be **blocked outright** ("FictionLab is
      damaged and can't be opened" or similar), not just warned. Instead:
      **right-click (or Control-click) the app in Applications -> Open ->
      Open** in the confirmation dialog. This only needs to be done once.
  - If macOS still refuses: System Settings -> Privacy & Security -> scroll
    to the "FictionLab was blocked" notice -> **Open Anyway**.
- [ ] Note in your report exactly which of the above was required -- this is
      one of the things we don't yet know without real-machine testing on
      Apple Silicon.

**Linux (AppImage):**
- [ ] `chmod +x FictionLab-*.AppImage`
- [ ] Run it: `./FictionLab-*.AppImage`
- [ ] Note whether a sandboxing error occurs (some distros need
      `--no-sandbox` for unprivileged AppImage execution, or
      `sudo sysctl kernel.apparmor_restrict_unprivileged_userns=0` on newer
      Ubuntu/Mint releases with AppArmor userns restrictions) -- report the
      exact error text if so.

**Linux (.deb, Debian/Ubuntu/Mint):**
- [ ] `sudo dpkg -i fictionlab_*.deb` (or `sudo apt install ./fictionlab_*.deb`
      to auto-resolve dependencies)
- [ ] Launch from the applications menu, or `fictionlab` from a terminal.

## 3. First-run wizard

- [ ] The app opens to a first-run / setup flow (not a blank window, not a
      crash).
- [ ] **Docker detection**: if Docker Desktop is not installed, the app
      offers guided installation instructions rather than failing silently.
      If Docker Desktop **is** installed but not running, the app prompts
      you to start it.
- [ ] Once Docker Desktop is running, complete the setup wizard (client
      selection, etc.).

## 4. Database initialization

- [ ] The app initializes PostgreSQL (via Docker) without manual `psql`/SQL
      steps on your part.
- [ ] Settings > Database shows the database as connected/healthy once
      initialization completes.

## 5. Connector health (:50880)

- [ ] Settings > Services shows three containers: PostgreSQL, MCP Writing
      Servers, and the MCP Connector -- all reporting "running" once setup
      completes.
- [ ] The local TypingMind MCP Connector is reachable at
      `http://localhost:50880` (the app's own health/status indicator on the
      Services tab is sufficient; you do not need to curl it manually unless
      the in-app status looks wrong, in which case: `curl -i
      http://localhost:50880/health` or open it in a browser and report what
      you see).

## 6. Pluginless core check

FictionLab's core promise is that it is fully usable with **zero plugins
installed** -- Docker, the database, and the MCP Connector, nothing else
required (see `docs/CORE-VS-OPTIONAL-COMPONENTS.md`). On a fresh install,
before installing any plugin:

- [ ] The sidebar shows only core items: Dashboard, Settings (Setup,
      Database, Services, Logs), Plugins, Help/About. No "Workflows" entry,
      no plugin-named entries.
- [ ] Settings > Services and Settings > Setup are both reachable and show
      no "plugin not found" / "plugin required" errors anywhere on screen.
- [ ] The Plugins screen itself is reachable and lists what's available to
      install (this is how you'd add Workflows/Kanban capability later --
      not required for this checklist).

## 7. Update check (optional but useful)

- [ ] Settings > Setup > "Check for Updates" completes without error (it may
      correctly report "up to date" if you're on the newest release -- that's
      a pass, not a failure).

## 8. Uninstall

- [ ] Uninstall via the OS's normal mechanism (Windows: Add/Remove Programs;
      macOS: drag to Trash; Linux: `sudo dpkg -r fictionlab` or delete the
      AppImage) and confirm it does not error or leave the app unusable
      without a manual cleanup step.

## Known limitations (honest, as of this release)

- **No code signing on any platform.** Windows and macOS builds are
  unsigned; Linux packages are unsigned in the .deb sense too (no GPG-signed
  apt repo -- this is a standalone .deb, not a repository package). Expect
  SmartScreen (Windows) and Gatekeeper (macOS) warnings; see the install
  steps above for exactly how to get past them.
- **macOS is Apple Silicon (arm64) only** in this release's build matrix.
  There is no Intel (x64) macOS build.
- **Windows ARM64 is new** and has not yet been verified on real ARM64
  hardware -- only the CI runner's ARM64 build+launch. If you're testing on
  a Windows ARM64 device (e.g. Surface Pro X or similar), your report is
  the first real-hardware signal we'll have.
- **CI cannot test the full Docker/database/connector flow.** Hosted CI
  runners don't run Docker Desktop the way a real user's machine does, so
  the smoke tests in `.github/workflows/release.yml` only prove the app
  installs and its renderer boots -- not that setup-through-connector-health
  works end to end. That gap is exactly what sections 3-6 above are for.

## Reporting results

Please file a
[Platform Test Report](../../issues/new?template=platform-test-report.yml)
with your OS/arch, which steps passed or failed, and (if anything failed)
the app logs:

- Windows: `%USERPROFILE%\AppData\Roaming\fictionlab\logs`
- macOS: `~/Library/Logs/fictionlab`
- Linux: `~/.config/fictionlab/logs`
