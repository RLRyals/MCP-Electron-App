# Release Process

This document outlines the process for creating and publishing releases of the FictionLab App.

> **Releases are automatic (mea-36t).** You no longer create or push the
> `vX.X.X` tag yourself -- `.github/workflows/build.yml`'s `auto-tag-release`
> job does it for you the moment a `package.json` version bump lands on
> `develop` and its build goes green. Bump the version, merge to `develop`,
> done. See the [README's "Releases Are Automatic" section](README.md#releases-are-automatic-mea-36t)
> for the full explanation. The manual `git tag` / `git push origin vX.X.X`
> steps still described below are what CI now performs *for* you, not
> something you run yourself -- do not follow them by hand, and never file
> a bead asking someone to push a tag.

## Table of Contents

- [Overview](#overview)
- [Versioning](#versioning)
- [Pre-Release Checklist](#pre-release-checklist)
- [Creating a Release](#creating-a-release)
- [Automated Build Process](#automated-build-process)
- [Post-Release Steps](#post-release-steps)
- [Troubleshooting](#troubleshooting)

## Overview

The FictionLab App uses GitHub Actions for automated multi-platform builds. When a version tag is pushed, the CI/CD pipeline automatically:

1. Builds the application for Windows, macOS, and Linux
2. Generates SHA256 checksums for all artifacts
3. Creates a GitHub Release with all binaries
4. Generates release notes from commit history

## Versioning

We follow [Semantic Versioning](https://semver.org/) (SemVer):

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Incompatible API changes or major feature overhauls
- **MINOR**: New features added in a backwards-compatible manner
- **PATCH**: Backwards-compatible bug fixes

### Version Examples

- `v1.0.0` - First stable release
- `v1.1.0` - New feature added
- `v1.1.1` - Bug fix
- `v2.0.0` - Breaking changes
- `v1.0.0-alpha.1` - Alpha pre-release
- `v1.0.0-beta.1` - Beta pre-release
- `v1.0.0-rc.1` - Release candidate

### Pre-Release Tags

- **alpha**: Early testing, unstable, may have incomplete features
- **beta**: Feature complete, but may have bugs
- **rc**: Release candidate, stable and ready for final testing

## Pre-Release Checklist

Before creating a release, ensure the following:

### 1. Code Quality

- [ ] All tests pass locally
- [ ] No lint errors or warnings
- [ ] Code builds successfully on your platform
- [ ] All dependencies are up to date (or documented reasons for older versions)

### 2. Version Update

Update the version in `package.json`:

```bash
# For a patch release (1.0.0 -> 1.0.1)
npm version patch

# For a minor release (1.0.0 -> 1.1.0)
npm version minor

# For a major release (1.0.0 -> 2.0.0)
npm version major

# For a pre-release (1.0.0 -> 1.0.1-alpha.0)
npm version prerelease --preid=alpha
```

**Note**: `npm version` automatically creates a git commit and tag, but we'll use a different approach for more control.

### 3. Update CHANGELOG

If you maintain a CHANGELOG.md, update it with:

- New features
- Bug fixes
- Breaking changes
- Known issues
- Migration guides (for major versions)

### 4. Documentation

- [ ] README.md is up to date
- [ ] All new features are documented
- [ ] Installation instructions are current
- [ ] Screenshots/demos are updated (if applicable)

### 5. Testing

Test the application on multiple platforms (see [TESTING.md](TESTING.md) for
the full tester checklist -- Docker detection, DB init, connector health,
pluginless core check):

- [ ] Windows x64
- [ ] Windows ARM64
- [ ] macOS (Apple Silicon)
- [ ] Linux (Ubuntu/Debian/Mint or another major distribution)

### 6. Clean State

Ensure your working directory is clean:

```bash
git status
# Should show: "nothing to commit, working tree clean"
```

## Creating a Release

### Method 1: Automatic Release (Recommended)

1. **Update version in package.json** (don't use `npm version`):

```json
{
  "version": "1.0.0"
}
```

2. **Commit the version change**:

```bash
git add package.json
git commit -m "Bump version to 1.0.0"
```

3. **Create and push a git tag**:

```bash
# Create the tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push the tag to GitHub
git push origin v1.0.0
```

4. **GitHub Actions takes over**:

The release workflow automatically:
- Builds for all platforms
- Generates checksums
- Creates GitHub Release
- Uploads all artifacts

### Method 2: Manual Workflow Dispatch

For testing or creating releases without a tag:

1. Go to GitHub Actions: `https://github.com/<username>/MCP-Electron-App/actions`
2. Select "Release Electron App" workflow
3. Click "Run workflow"
4. Enter the version (e.g., `v1.0.0`)
5. Click "Run workflow"

### Release Tag Format

Always use the format: `v<MAJOR>.<MINOR>.<PATCH>`

Examples:
- ✅ `v1.0.0`
- ✅ `v2.1.3`
- ✅ `v1.0.0-beta.1`
- ❌ `1.0.0` (missing 'v' prefix)
- ❌ `release-1.0.0` (wrong format)

## Automated Build Process

When a version tag is pushed, the following happens:

### 1. Create Release Job

- Extracts version from tag
- Generates release notes from commits since last tag
- Creates a GitHub Release (draft or published)

### 2. Build Jobs (Parallel)

Four jobs run simultaneously on different runners (bead mea-0um added the
Windows ARM64 leg):

#### Windows x64 Build (`windows-latest`)
- Runs `npm run test:ci` (required gate) + the Playwright Electron E2E smoke
  suite (`e2e/smoke.spec.ts` + `e2e/pluginless.spec.ts`)
- Builds NSIS installer (.exe), x64
- Generates SHA256 checksums
- Uploads to release

#### Windows ARM64 Build (`windows-11-arm`)
- Same test/smoke gate as the x64 job
- Builds NSIS installer (.exe), arm64, via `npm run package:win-arm64`
- Generates SHA256 checksums
- Uploads to release
- **Not required for the release to publish.** This is the newest, least-proven
  leg of the matrix (a brand-new hosted runner class this workflow has never
  exercised) -- `create-release` waits for it but does not block on its
  success, so a win-arm64 failure ships the other three platforms without the
  ARM64 asset rather than blocking everyone. Check the workflow run if the
  ARM64 installer is missing from a release.

#### macOS Build (`macos-latest`)
- Same test/smoke gate as the Windows jobs (macOS CI runners are GUI-capable
  without xvfb)
- Builds DMG for Apple Silicon (arm64) -- **no Intel/x64 build**
- Generates SHA256 checksums
- Uploads to release

#### Linux Build (`ubuntu-latest`)
- Same test gate; the E2E smoke suite runs under `xvfb-run` since
  `ubuntu-latest` is headless
- Builds AppImage (x64)
- Builds Debian package (.deb, x64)
- Generates SHA256 checksums
- Uploads to release

### Code signing status (honest, as of this release)

**No platform is code-signed.** `CSC_IDENTITY_AUTO_DISCOVERY: false` is set
on every build job, and no signing secrets are configured. Concretely:

- **Windows** (both x64 and ARM64): unsigned. Users hit a SmartScreen
  "Windows protected your PC" warning and must click through "More info" →
  "Run anyway".
- **macOS**: unsigned and not notarized. Users hit Gatekeeper's harder block
  ("...is damaged and can't be opened") and must right-click → Open, or use
  System Settings → Privacy & Security → "Open Anyway".
- **Linux**: no GPG-signed apt repository; the `.deb` is a standalone package
  installed directly with `dpkg`, and the AppImage is unsigned (AppImage has
  no standard code-signing mechanism in wide use).

See [TESTING.md](TESTING.md) for the exact tester-facing click-through steps,
and the "Code Signing Issues" section below for how to actually turn signing
on when certificates are available.

### 3. Release Complete Job

- Verifies all platform builds succeeded
- Marks release as complete
- Sends notifications (if configured)

## Post-Release Steps

After a successful release:

### 1. Verify the Release

1. Go to the [Releases page](https://github.com/<username>/MCP-Electron-App/releases)
2. Check that all artifacts are present:
   - Windows x64: `FictionLab Setup X.X.X x64.exe`
   - Windows ARM64: `FictionLab Setup X.X.X arm64.exe` (best-effort -- see the
     "Windows ARM64 Build" note above; may be absent on a given release)
   - macOS: `FictionLab-X.X.X-arm64.dmg`
   - Linux: `FictionLab-X.X.X.AppImage` and `fictionlab_X.X.X_amd64.deb`
   - Checksum files for each platform (`checksums-windows.txt`,
     `checksums-windows-arm64.txt`, `checksums-macos.txt`,
     `checksums-linux.txt`)

### 2. Test Downloads

Download and test the installer on each platform (see
[TESTING.md](TESTING.md) for the full checklist):

```bash
# Verify checksums
sha256sum FictionLab-X.X.X.AppImage
# Compare with checksums-linux.txt
```

### 3. Update Documentation

If needed:
- Update website with download links
- Announce on social media/blog
- Update package managers (if applicable)
- Notify users via email/newsletter

### 4. Monitor Issues

Watch for issues reported by early adopters:
- Check GitHub Issues
- Monitor community channels
- Be ready to create a patch release if critical bugs are found

### 5. Create Next Milestone

Create a milestone for the next version in GitHub Issues.

## Troubleshooting

### Build Fails on One Platform

If a platform build fails:

1. Check the GitHub Actions logs
2. Common issues:
   - Missing dependencies
   - Platform-specific code errors
   - electron-builder configuration issues

3. Fix the issue and re-run:
   - Delete the failed tag: `git tag -d vX.X.X && git push origin :refs/tags/vX.X.X`
   - Fix the code
   - Create the tag again

### Release Already Exists

If you need to recreate a release:

1. Delete the release on GitHub
2. Delete the tag locally and remotely:
```bash
git tag -d vX.X.X
git push origin :refs/tags/vX.X.X
```
3. Create the release again

### Code Signing Issues

Currently, code signing is disabled (`CSC_IDENTITY_AUTO_DISCOVERY: false`).

To enable code signing:

#### Windows (Authenticode)

1. Obtain a code signing certificate
2. Add secrets to GitHub:
   - `WIN_CSC_LINK`: Base64-encoded certificate
   - `WIN_CSC_KEY_PASSWORD`: Certificate password

3. Update workflow:
```yaml
env:
  CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
  CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

#### macOS (Apple Developer)

1. Join Apple Developer Program
2. Create signing certificates
3. Add secrets to GitHub:
   - `MAC_CSC_LINK`: Base64-encoded certificate
   - `MAC_CSC_KEY_PASSWORD`: Certificate password
   - `APPLE_ID`: Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password

4. Update workflow:
```yaml
env:
  CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
  CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
```

### Workflow Doesn't Trigger

If the workflow doesn't start after pushing a tag:

1. Verify tag format: `v*.*.*`
2. Check workflow file syntax: Use a YAML validator
3. Ensure workflows are enabled in repository settings
4. Check branch protection rules

### Large Artifact Sizes

If artifacts are too large:

- Review `extraResources` in package.json
- Consider excluding unnecessary files
- Use `.asar` archives (electron-builder does this by default)
- Compress resources before bundling

## Version Timeline Example

```
v0.1.0-alpha.1  → First alpha release
v0.1.0-alpha.2  → Alpha bug fixes
v0.1.0-beta.1   → Beta release (feature complete)
v0.1.0-rc.1     → Release candidate
v0.1.0          → First stable release
v0.1.1          → Patch release (bug fix)
v0.2.0          → Minor release (new feature)
v1.0.0          → Major release (stable API)
```

## Best Practices

1. **Test Before Tagging**: Always test thoroughly before creating a release tag
2. **Small, Frequent Releases**: Release often to get feedback quickly
3. **Clear Release Notes**: Write helpful release notes that explain changes
4. **Semantic Versioning**: Stick to SemVer strictly
5. **Changelog**: Maintain a CHANGELOG.md for users to track changes
6. **Security Patches**: Release security fixes as soon as possible
7. **Deprecation Warnings**: Give advance notice before removing features
8. **Migration Guides**: Provide clear upgrade instructions for breaking changes

## Resources

- [Semantic Versioning](https://semver.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [electron-builder Documentation](https://www.electron.build/)
- [Keep a Changelog](https://keepachangelog.com/)

## Support

For questions about the release process:
- Create an issue on GitHub
- Check existing documentation
- Review recent releases for examples
