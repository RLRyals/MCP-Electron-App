# Release Process

This document outlines the process for creating and publishing releases of the MCP Electron App.

## Table of Contents

- [Overview](#overview)
- [Versioning](#versioning)
- [Pre-Release Checklist](#pre-release-checklist)
- [Creating a Release](#creating-a-release)
- [Automated Build Process](#automated-build-process)
- [Post-Release Steps](#post-release-steps)
- [Troubleshooting](#troubleshooting)

## Overview

The MCP Electron App uses GitHub Actions for automated multi-platform builds. When a version tag is pushed, the CI/CD pipeline automatically:

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

Test the application on multiple platforms:

- [ ] Windows 10/11
- [ ] macOS (Intel and Apple Silicon if possible)
- [ ] Linux (at least one major distribution)

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

Three jobs run simultaneously on different runners:

#### Windows Build (`windows-latest`)
- Builds NSIS installer (.exe)
- Generates SHA256 checksums
- Uploads to release

#### macOS Build (`macos-latest`)
- Builds DMG for Intel (x64) and Apple Silicon (arm64)
- Generates SHA256 checksums
- Uploads to release

#### Linux Build (`ubuntu-latest`)
- Builds AppImage
- Builds Debian package (.deb)
- Generates SHA256 checksums
- Uploads to release

### 3. Release Complete Job

- Verifies all platform builds succeeded
- Marks release as complete
- Sends notifications (if configured)

## Post-Release Steps

After a successful release:

### 1. Verify the Release

1. Go to the [Releases page](https://github.com/<username>/MCP-Electron-App/releases)
2. Check that all artifacts are present:
   - Windows: `MCP-Electron-App-Setup-vX.X.X.exe`
   - macOS: `MCP-Electron-App-vX.X.X.dmg`
   - Linux: `MCP-Electron-App-vX.X.X.AppImage` and `mcp-electron-app_vX.X.X_amd64.deb`
   - Checksum files for each platform

### 2. Test Downloads

Download and test the installer on each platform:

```bash
# Verify checksums
sha256sum MCP-Electron-App-vX.X.X.AppImage
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
