# Creating Releases

This guide explains how to create releases for the MCP Electron App.

## Understanding Builds vs Releases

### Builds (Artifacts)
- Created automatically on every push to `main` or `develop`
- Stored as GitHub Actions **Artifacts** (temporary, 7-day retention)
- Accessible from: Actions → [Workflow Run] → Artifacts section
- **Not** visible in the Releases tab
- Useful for testing and CI/CD validation

### Releases
- Created when you push a **git tag** matching `v*.*.*` (e.g., `v0.1.0`)
- Published to GitHub **Releases** tab (permanent)
- Downloadable by users from the Releases page
- Include release notes, checksums, and platform-specific installers
- The official way to distribute your app

## Quick Start: Create Your First Release

### Option 1: Using Git Tags (Recommended)

1. **Ensure your code is ready:**
   ```bash
   git status  # Check everything is committed
   ```

2. **Update version in package.json (optional):**
   ```json
   {
     "version": "0.1.0"
   }
   ```

3. **Create and push a git tag:**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. **Monitor the release workflow:**
   - Go to: Actions → Release Electron App
   - Watch the build progress for Windows, macOS, and Linux
   - Takes approximately 10-15 minutes

5. **Check the Releases tab:**
   - Once complete, go to: Releases
   - Your new release should be visible with downloadable installers

### Option 2: Manual Workflow Dispatch

1. Go to: **Actions** → **Release Electron App**
2. Click **"Run workflow"** button
3. Enter version (e.g., `v0.1.0`)
4. Click **"Run workflow"** to start

This is useful if you want to create a release without creating a git tag first.

## Version Numbering

Follow [Semantic Versioning](https://semver.org/) (SemVer):

```
v<MAJOR>.<MINOR>.<PATCH>[-PRERELEASE]
```

### Examples:

- `v0.1.0` - Initial release
- `v0.2.0` - Minor update (new features)
- `v0.2.1` - Patch update (bug fixes)
- `v1.0.0` - First stable release
- `v1.0.0-alpha.1` - Alpha prerelease
- `v1.0.0-beta.2` - Beta prerelease
- `v1.0.0-rc.1` - Release candidate

**Note:** Versions containing `alpha`, `beta`, or `rc` are marked as **prereleases** in GitHub.

## Step-by-Step Release Process

### 1. Prepare the Release

```bash
# Ensure you're on the main branch
git checkout main
git pull origin main

# Update version in package.json
# Edit version field: "0.1.0" → "0.2.0"

# Commit version bump
git add package.json
git commit -m "Bump version to 0.2.0"
git push origin main
```

### 2. Create the Tag

```bash
# Create an annotated tag with a message
git tag -a v0.2.0 -m "Release version 0.2.0"

# Or create a lightweight tag
git tag v0.2.0

# Push the tag to trigger the release workflow
git push origin v0.2.0
```

### 3. Monitor the Build

1. Go to **Actions** tab in GitHub
2. Click on **"Release Electron App"** workflow
3. You'll see three parallel builds:
   - **Build Windows** - Creates `.exe` installer
   - **Build macOS** - Creates `.dmg` installer
   - **Build Linux** - Creates `.AppImage` and `.deb` packages

### 4. Verify the Release

Once the workflow completes:

1. Go to **Releases** tab
2. Your release should appear with:
   - Release title (e.g., "MCP Electron App v0.2.0")
   - Auto-generated release notes (commits since last release)
   - Platform-specific installers:
     - `MCP-Electron-App-Setup-v0.2.0.exe` (Windows)
     - `MCP-Electron-App-v0.2.0.dmg` (macOS)
     - `MCP-Electron-App-v0.2.0.AppImage` (Linux)
     - `mcp-electron-app_v0.2.0_amd64.deb` (Debian/Ubuntu)
   - Checksum files for verification

### 5. Test the Release

Download and test installers on each platform:

**Windows:**
```powershell
# Download MCP-Electron-App-Setup-v0.2.0.exe
# Run the installer
# Verify the app launches correctly
```

**macOS:**
```bash
# Download MCP-Electron-App-v0.2.0.dmg
# Mount and drag to Applications
# Verify the app launches
```

**Linux:**
```bash
# AppImage
chmod +x MCP-Electron-App-v0.2.0.AppImage
./MCP-Electron-App-v0.2.0.AppImage

# Or Debian package
sudo dpkg -i mcp-electron-app_v0.2.0_amd64.deb
```

## Release Workflow Details

### What Happens When You Create a Release?

1. **Create Release Job**
   - Generates release notes from git commits
   - Creates a GitHub Release (draft or published)
   - Provides upload URL for artifacts

2. **Platform Builds** (run in parallel)
   - Windows: Builds NSIS installer (`.exe`)
   - macOS: Builds DMG installer (`.dmg`)
   - Linux: Builds AppImage and Debian package

3. **Upload Assets**
   - Each platform uploads its installer to the release
   - Checksums are generated and uploaded
   - Assets become downloadable

4. **Code Signing** (if configured)
   - Windows: Signs with certificate from `WIN_CSC_LINK`
   - macOS: Signs with certificate from `MAC_CSC_LINK`
   - See [CODE_SIGNING.md](./CODE_SIGNING.md) for details

## Customizing Release Notes

By default, release notes are auto-generated from commits. To customize:

### Option 1: Edit After Creation

1. Go to **Releases** tab
2. Click **"Edit"** on your release
3. Modify the description
4. Click **"Update release"**

### Option 2: Create Draft Release

Modify `.github/workflows/release.yml`:

```yaml
- name: Create Release
  uses: actions/create-release@v1
  with:
    draft: true  # Change to true
    prerelease: false
```

This creates a draft release that you can edit before publishing.

### Option 3: Use Conventional Commits

Structure commit messages for better release notes:

```bash
git commit -m "feat: Add dark mode support"
git commit -m "fix: Resolve connection timeout issue"
git commit -m "docs: Update installation guide"
```

## Troubleshooting

### Release Not Appearing

**Problem:** Pushed a tag but no release created

**Solutions:**
- Check tag format matches `v*.*.*` (e.g., `v0.1.0`)
- Go to Actions tab and check for workflow errors
- Verify repository permissions allow creating releases

### Build Fails

**Problem:** Release workflow fails during build

**Solutions:**
- Check Actions logs for specific error
- Common issues:
  - TypeScript compilation errors → Run `npm run build` locally first
  - Missing dependencies → Ensure `package-lock.json` is committed
  - Icon files missing → Check `resources/` directory

### Assets Not Uploading

**Problem:** Release created but installers missing

**Solutions:**
- Check individual build job logs
- Verify file paths in workflow match actual output
- Look for "Upload Release Asset" step failures

### Code Signing Errors

**Problem:** Build fails with signing errors

**Solutions:**
- If you don't have certificates yet, the build should still succeed (unsigned)
- Check that `CSC_IDENTITY_AUTO_DISCOVERY` logic is correct
- See [CODE_SIGNING.md](./CODE_SIGNING.md) for certificate setup

## Deleting/Recreating a Release

### Delete a Release

1. Go to **Releases** tab
2. Click on the release to delete
3. Click **"Delete"** button (top right)
4. Confirm deletion

**Note:** This does NOT delete the git tag!

### Delete the Tag

```bash
# Delete local tag
git tag -d v0.1.0

# Delete remote tag
git push origin :refs/tags/v0.1.0
```

### Recreate a Release

If you need to redo a release:

```bash
# Delete the tag (see above)

# Make necessary fixes
git add .
git commit -m "Fix release issues"
git push origin main

# Create tag again
git tag v0.1.0
git push origin v0.1.0
```

## Best Practices

1. **Test before releasing:**
   - Run local builds: `npm run package:win`, `npm run package:mac`, `npm run package:linux`
   - Test the app thoroughly

2. **Use meaningful version numbers:**
   - Follow Semantic Versioning
   - Update `package.json` version to match tag

3. **Write good release notes:**
   - Highlight new features
   - List bug fixes
   - Mention breaking changes
   - Include upgrade instructions if needed

4. **Verify checksums:**
   - Download installers
   - Verify SHA256 checksums match `checksums-*.txt` files

5. **Announce the release:**
   - Update documentation
   - Notify users
   - Share on social media/forums

## Automated Release Strategy

For a more automated approach, consider:

1. **Conventional Commits** + **semantic-release**
   - Auto-generate version numbers
   - Auto-create tags and releases
   - Auto-generate changelogs

2. **Release Drafter**
   - Auto-draft releases on tag push
   - Categorize PRs automatically
   - Template-based release notes

3. **Scheduled Releases**
   - Weekly/monthly release cadence
   - Automated changelog generation
   - Version bumping via CI/CD

## Next Steps

1. **Create your first release:**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **Set up code signing** (optional but recommended)
   - Follow [CODE_SIGNING.md](./CODE_SIGNING.md)
   - Add certificates to GitHub Secrets
   - Eliminate security warnings

3. **Customize release notes**
   - Edit release description
   - Add screenshots
   - Include installation instructions

4. **Monitor downloads**
   - Check release asset download counts
   - Gather user feedback
   - Plan next release

## Additional Resources

- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [electron-builder Publishing Docs](https://www.electron.build/configuration/publish)
