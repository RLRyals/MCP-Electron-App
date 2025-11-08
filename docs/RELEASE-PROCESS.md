# MCP Electron App - Release Process

This document describes the process for creating and publishing releases of the MCP Electron App.

## Table of Contents

- [Release Schedule](#release-schedule)
- [Version Numbering](#version-numbering)
- [Pre-Release Checklist](#pre-release-checklist)
- [Creating a Release](#creating-a-release)
- [Automated Release Workflow](#automated-release-workflow)
- [Manual Release Steps](#manual-release-steps)
- [Post-Release Tasks](#post-release-tasks)
- [Hotfix Releases](#hotfix-releases)
- [Troubleshooting Release Issues](#troubleshooting-release-issues)

---

## Release Schedule

### Release Types

**Major Releases (X.0.0)**
- Significant new features
- Breaking changes
- Major architectural changes
- Release schedule: As needed (typically 6-12 months)

**Minor Releases (0.X.0)**
- New features
- Enhancements to existing features
- Non-breaking changes
- Release schedule: Monthly or as needed

**Patch Releases (0.0.X)**
- Bug fixes
- Security patches
- Minor improvements
- Release schedule: As needed (usually within days of discovering critical bugs)

### Pre-Release Versions

**Alpha (X.Y.Z-alpha.N)**
- Early development
- Unstable, for testing only
- Features may be incomplete

**Beta (X.Y.Z-beta.N)**
- Feature complete
- Needs testing and bug fixes
- May have known issues

**Release Candidate (X.Y.Z-rc.N)**
- Final testing before release
- No new features
- Bug fixes only
- Becomes final release if no critical bugs found

---

## Version Numbering

We follow [Semantic Versioning](https://semver.org/) (SemVer):

**Format:** `MAJOR.MINOR.PATCH`

**MAJOR** - Incremented when:
- Breaking changes
- Incompatible API changes
- Major architectural rewrites

**MINOR** - Incremented when:
- New features (backwards compatible)
- Significant enhancements
- Deprecated features

**PATCH** - Incremented when:
- Bug fixes
- Security patches
- Minor improvements

**Examples:**
- `1.0.0` - First stable release
- `1.1.0` - Added new feature (client selection)
- `1.1.1` - Fixed bug in client selection
- `2.0.0` - Breaking change (new config format)
- `1.2.0-beta.1` - Beta version of 1.2.0

---

## Pre-Release Checklist

Before creating a release, ensure:

### Code Quality

- [ ] All tests pass (when implemented)
- [ ] TypeScript compiles without errors
- [ ] No linting errors
- [ ] Code reviewed and approved
- [ ] All CI checks pass

### Documentation

- [ ] README updated with new features
- [ ] USER-GUIDE.md updated if needed
- [ ] CHANGELOG.md updated (or draft ready)
- [ ] API changes documented
- [ ] Screenshots updated if UI changed

### Features

- [ ] All planned features implemented
- [ ] All known bugs fixed (or documented as known issues)
- [ ] Performance tested
- [ ] Security reviewed

### Platform Testing

- [ ] Tested on Windows 10/11
- [ ] Tested on macOS (Intel and Apple Silicon if possible)
- [ ] Tested on Linux (Ubuntu/Debian)
- [ ] Installer tested on each platform
- [ ] Upgrade from previous version tested

### Dependencies

- [ ] Dependencies up to date (check for security vulnerabilities)
- [ ] No unnecessary dependencies
- [ ] All dependencies properly licensed

---

## Creating a Release

### Method 1: Automated Release (Recommended)

The automated workflow builds for all platforms and creates the GitHub Release.

**Step 1: Update Version**

Edit `package.json`:
```json
{
  "version": "1.2.0"
}
```

**Step 2: Update Documentation**

Create or update `CHANGELOG.md`:
```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added
- New feature: Client selection UI
- Support for Claude Desktop configuration
- Automatic update checking

### Changed
- Improved Docker health checking
- Enhanced error messages

### Fixed
- Fixed port conflict detection
- Fixed Typing Mind download on Windows
```

**Step 3: Commit Changes**

```bash
git add package.json CHANGELOG.md
git commit -m "Bump version to 1.2.0"
git push origin main
```

**Step 4: Create and Push Tag**

```bash
# Create annotated tag
git tag -a v1.2.0 -m "Release version 1.2.0"

# Push tag to trigger release workflow
git push origin v1.2.0
```

**Step 5: Monitor Workflow**

1. Go to GitHub Actions tab
2. Watch the "Release Electron App" workflow
3. Ensure all jobs complete successfully
4. Check the created release on GitHub Releases page

**Done!** The workflow will:
- Build for Windows, macOS, and Linux
- Generate checksums
- Create GitHub Release
- Upload all installers
- Generate release notes

### Method 2: Manual Workflow Trigger

If you need to trigger a release manually:

1. Go to GitHub Actions tab
2. Select "Release Electron App" workflow
3. Click "Run workflow"
4. Enter the version (e.g., `v1.2.0`)
5. Click "Run workflow"

---

## Automated Release Workflow

The GitHub Actions workflow (`.github/workflows/release.yml`) performs:

### 1. Create Release Job

**Triggers on:**
- Push of tag matching `v*.*.*`
- Manual workflow dispatch

**Steps:**
- Checkout code
- Extract version from tag
- Generate release notes from commits
- Create GitHub Release (draft for pre-releases)

### 2. Build Windows Job

**Runs on:** `windows-latest`

**Steps:**
1. Checkout code
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Build TypeScript (`npm run build`)
5. Build Windows installer (`npm run package:win`)
6. Generate SHA256 checksums
7. Upload `.exe` installer to release
8. Upload checksums file

**Output:**
- `MCP-Electron-App-Setup-{version}.exe`
- `checksums-windows.txt`

### 3. Build macOS Job

**Runs on:** `macos-latest`

**Steps:**
1. Checkout code
2. Setup Node.js 20
3. Install dependencies
4. Build TypeScript
5. Build macOS app (`npm run package:mac`)
6. Generate checksums
7. Upload `.dmg` to release
8. Upload checksums file

**Output:**
- `MCP-Electron-App-{version}.dmg` (Universal: Intel + Apple Silicon)
- `checksums-macos.txt`

### 4. Build Linux Job

**Runs on:** `ubuntu-latest`

**Steps:**
1. Checkout code
2. Setup Node.js 20
3. Install dependencies
4. Build TypeScript
5. Build Linux packages (`npm run package:linux`)
6. Generate checksums
7. Upload `.AppImage` and `.deb` to release
8. Upload checksums file

**Output:**
- `MCP-Electron-App-{version}.AppImage`
- `mcp-electron-app_{version}_amd64.deb`
- `checksums-linux.txt`

### Workflow Outputs

After successful completion:
- GitHub Release created with all assets
- Release notes auto-generated from commits
- All platforms built and uploaded
- Checksums verified and published

---

## Manual Release Steps

If you need to build manually (not recommended for releases):

### Build Locally

**Prerequisites:**
- Node.js 18+ installed
- npm installed
- Platform-specific build tools (see CONTRIBUTING.md)

**Build for Current Platform:**
```bash
# Update version in package.json first!

# Install dependencies
npm install

# Build TypeScript
npm run build

# Build installer
npm run package

# Output in out/ directory
```

**Build for Specific Platform:**
```bash
# Windows (from Windows)
npm run package:win

# macOS (from macOS)
npm run package:mac

# Linux (from Linux)
npm run package:linux
```

**Build for All Platforms** (from macOS or Linux with docker):
```bash
npm run package:all
```

**Note:** Cross-platform building has limitations. Use GitHub Actions for official releases!

### Create Release Manually

1. **Build all platforms** (or use GitHub Actions artifacts)

2. **Generate checksums:**
   ```bash
   # macOS/Linux
   shasum -a 256 *.{dmg,exe,AppImage,deb} > checksums.txt

   # Windows PowerShell
   Get-FileHash -Algorithm SHA256 *.exe | Format-List
   ```

3. **Create GitHub Release:**
   - Go to GitHub Releases page
   - Click "Draft a new release"
   - Choose tag (create new if needed)
   - Enter release title: `MCP Electron App v1.2.0`
   - Write release notes
   - Upload all installers
   - Upload checksums files
   - Click "Publish release"

---

## Post-Release Tasks

After publishing a release:

### 1. Verify Release

- [ ] Download installers from GitHub Releases
- [ ] Verify checksums match
- [ ] Test installation on each platform
- [ ] Verify app works correctly

### 2. Update Documentation

- [ ] Ensure README reflects latest version
- [ ] Update any documentation links
- [ ] Add release to CHANGELOG.md (if not done pre-release)

### 3. Announce Release

- [ ] Create GitHub Discussions post announcing release
- [ ] Tweet about release (if applicable)
- [ ] Notify community channels (if applicable)
- [ ] Update website (if applicable)

### 4. Monitor for Issues

- [ ] Watch GitHub Issues for bug reports
- [ ] Monitor error logs (if crash reporting implemented)
- [ ] Be ready to create hotfix if needed

### 5. Plan Next Release

- [ ] Create milestone for next version
- [ ] Triage issues for next release
- [ ] Update roadmap

---

## Hotfix Releases

For critical bugs discovered after release:

### Process

1. **Create hotfix branch:**
   ```bash
   git checkout v1.2.0
   git checkout -b hotfix/1.2.1
   ```

2. **Fix the bug:**
   - Make minimal changes
   - Focus on the critical bug only
   - Test thoroughly

3. **Update version:**
   - Bump PATCH version in `package.json`
   - Update CHANGELOG.md

4. **Commit and merge:**
   ```bash
   git commit -m "Fix critical bug: description"
   git checkout main
   git merge hotfix/1.2.1
   ```

5. **Tag and release:**
   ```bash
   git tag -a v1.2.1 -m "Hotfix release 1.2.1"
   git push origin v1.2.1
   ```

6. **Workflow runs automatically**

### Hotfix Criteria

Create hotfix release for:
- **Critical bugs** affecting core functionality
- **Security vulnerabilities**
- **Data loss issues**
- **App crashes** on startup or common operations

**Do NOT create hotfix for:**
- Minor bugs that don't block usage
- Feature requests
- Cosmetic issues
- Issues with workarounds

---

## Troubleshooting Release Issues

### Build Fails on GitHub Actions

**Check:**
- All dependencies in `package.json`
- TypeScript compiles locally
- No platform-specific code errors

**Fix:**
- Review GitHub Actions logs
- Reproduce build locally
- Fix errors and push again

### Installer Won't Run on Target Platform

**Windows - "Unknown Publisher" warning:**
- Expected - we don't have code signing certificate yet
- Users must click "More info" → "Run anyway"
- TODO: Add code signing in future

**macOS - "App can't be opened":**
- Expected - app not notarized
- Users must right-click → "Open" → "Open"
- TODO: Add notarization in future

**Linux - Permission denied:**
- Make AppImage executable: `chmod +x *.AppImage`
- For .deb: Use `sudo dpkg -i *.deb`

### Tag Already Exists

**Error:**
```
fatal: tag 'v1.2.0' already exists
```

**Fix:**
```bash
# Delete local tag
git tag -d v1.2.0

# Delete remote tag
git push origin :refs/tags/v1.2.0

# Create new tag
git tag -a v1.2.0 -m "Release 1.2.0"
git push origin v1.2.0
```

### Workflow Doesn't Trigger

**Check:**
- Tag matches pattern `v*.*.*`
- Tag was pushed: `git push origin v1.2.0`
- GitHub Actions enabled in repository settings

**Fix:**
- Ensure tag format is correct
- Try manual workflow trigger

### Assets Not Uploading

**Check:**
- Build jobs completed successfully
- Asset paths are correct
- Asset names match expected format

**Fix:**
- Review workflow logs
- Check if files exist in build output
- Verify upload steps succeeded

---

## Release Checklist Template

Copy this checklist for each release:

```markdown
## Release v1.X.X Checklist

### Pre-Release
- [ ] All features implemented
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Tested on Windows
- [ ] Tested on macOS
- [ ] Tested on Linux
- [ ] Upgrade path tested

### Release
- [ ] Committed version changes
- [ ] Created tag v1.X.X
- [ ] Pushed tag to GitHub
- [ ] GitHub Actions workflow succeeded
- [ ] Release created on GitHub
- [ ] All assets uploaded

### Post-Release
- [ ] Downloaded and verified installers
- [ ] Tested installers on each platform
- [ ] Verified checksums
- [ ] Announced release
- [ ] Monitored for issues
- [ ] Created milestone for next version
```

---

## Future Improvements

### Code Signing

**Windows:**
- Acquire code signing certificate
- Configure in GitHub Actions
- Sign .exe files

**macOS:**
- Join Apple Developer Program
- Create Developer ID certificate
- Notarize app
- Sign .dmg files

### Auto-Update

- Implement electron-updater
- Configure update server
- Add update notifications in app
- Allow auto-download and install

### Release Notes Automation

- Use conventional commits
- Auto-generate CHANGELOG.md
- Better release note formatting
- Include screenshots in releases

---

## Questions?

- **Build issues:** See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Feature planning:** Create GitHub Discussion
- **Bug reports:** Create GitHub Issue

---

**Happy Releasing!** 🚀
