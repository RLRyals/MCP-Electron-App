# Code Signing Guide

This document explains how to set up code signing for the MCP Electron App to eliminate Windows SmartScreen warnings and improve user trust.

## Table of Contents

- [Why Code Signing?](#why-code-signing)
- [Windows Code Signing](#windows-code-signing)
- [macOS Code Signing](#macos-code-signing)
- [CI/CD Configuration](#cicd-configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Why Code Signing?

### The Problem

When users download and run your Electron app without code signing, they encounter security warnings:

**Windows SmartScreen:**
```
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
Running this app might put your PC at risk.

Publisher: Unknown publisher
```

**macOS Gatekeeper:**
```
"MCP Electron App" cannot be opened because the developer cannot be verified.
```

### The Solution

Code signing digitally signs your application with a certificate that:
- Verifies your identity as the publisher
- Ensures the app hasn't been tampered with
- Builds trust with operating system security features
- Eliminates scary security warnings for users

## Windows Code Signing

### 1. Obtain a Code Signing Certificate

You need an **EV (Extended Validation)** or **OV (Organization Validation)** code signing certificate from a trusted Certificate Authority (CA).

#### Recommended Certificate Authorities:

| Provider | Type | Approximate Cost | SmartScreen Reputation |
|----------|------|-----------------|----------------------|
| **DigiCert** | EV Code Signing | $400-500/year | Immediate (EV certs bypass SmartScreen) |
| **Sectigo** | EV Code Signing | $300-400/year | Immediate (EV certs bypass SmartScreen) |
| **SSL.com** | OV Code Signing | $200-300/year | Requires reputation building |
| **Certum** | OV Code Signing | $100-200/year | Requires reputation building |

#### Important Notes:

- **EV certificates** (more expensive) bypass SmartScreen immediately because they require hardware tokens
- **OV certificates** (less expensive) require building "reputation" with Microsoft:
  - Need thousands of downloads/installations over time
  - Users will still see warnings initially
  - Reputation builds as more users safely run your app

### 2. Certificate Formats

Windows code signing certificates come in different formats:

- **PFX/P12 file** (most common for CI/CD)
- **Hardware token** (USB device, required for EV certificates)
- **Cloud HSM** (Azure Key Vault, DigiCert ONE, etc.)

For CI/CD pipelines, you'll need the certificate in **PFX format** with a password.

### 3. Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
WIN_CSC_LINK          # Base64-encoded PFX certificate
WIN_CSC_KEY_PASSWORD  # Certificate password
```

#### Encoding your certificate:

**On Windows (PowerShell):**
```powershell
$cert = [Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\your\certificate.pfx"))
$cert | Out-File -FilePath encoded-cert.txt
```

**On macOS/Linux:**
```bash
base64 -i certificate.pfx -o encoded-cert.txt
# Or in one line:
cat certificate.pfx | base64
```

Copy the contents of `encoded-cert.txt` and add it as the `WIN_CSC_LINK` secret.

### 4. Configuration Details

The `package.json` has been configured with:

```json
"win": {
  "publisherName": "MCP Team",
  "certificateSubjectName": "MCP Team",
  "signingHashAlgorithms": ["sha256"],
  "signDlls": true,
  "rfc3161TimeStampServer": "http://timestamp.digicert.com"
}
```

**Important:** Update `"publisherName"` and `"certificateSubjectName"` to match the **Common Name (CN)** on your certificate exactly.

### 5. Building Reputation (for OV certificates)

If using an OV certificate (not EV), you need to build SmartScreen reputation:

1. **Submit to Microsoft SmartScreen:**
   - Go to: https://www.microsoft.com/en-us/wdsi/filesubmission
   - Submit your signed executable for analysis
   - Wait 24-48 hours for review

2. **Distribute and track:**
   - Need sustained downloads/installations (typically 1,000-10,000+)
   - Maintain low incident rate (no malware reports)
   - Process can take weeks to months

3. **Monitor reputation:**
   - Use telemetry to track SmartScreen warnings
   - Check with Windows Defender Security Intelligence

## macOS Code Signing

### 1. Obtain an Apple Developer Certificate

1. **Enroll in Apple Developer Program** ($99/year)
   - https://developer.apple.com/programs/

2. **Create Certificates:**
   - **Developer ID Application** certificate (for distribution outside Mac App Store)
   - **Developer ID Installer** certificate (for pkg installers)

3. **Export Certificate:**
   - Open Keychain Access
   - Find your "Developer ID Application" certificate
   - Right-click → Export
   - Save as `.p12` file with a password

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository:

```
MAC_CSC_LINK          # Base64-encoded P12 certificate
MAC_CSC_KEY_PASSWORD  # Certificate password
APPLE_ID              # Your Apple ID email (for notarization)
APPLE_APP_PASSWORD    # App-specific password (for notarization)
APPLE_TEAM_ID         # Your 10-character Team ID
```

#### Getting App-Specific Password:

1. Go to https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Under "Security" → "App-Specific Passwords" → Generate new password
4. Save it as `APPLE_APP_PASSWORD` secret

#### Finding your Team ID:

1. Go to https://developer.apple.com/account
2. Click "Membership" in the sidebar
3. Your Team ID is shown (10-character code like `ABCDE12345`)

### 3. Notarization (Optional but Recommended)

macOS Catalina (10.15+) requires apps to be **notarized** by Apple:

1. Update `package.json`:
   ```json
   "mac": {
     "notarize": true
   }
   ```

2. electron-builder will automatically notarize if credentials are set

## CI/CD Configuration

### GitHub Actions Workflow Updates

The workflows have been updated to support code signing via environment variables:

#### Windows Build:
```yaml
- name: Build Windows app
  run: npm run package:win
  env:
    CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

#### macOS Build:
```yaml
- name: Build macOS app
  run: npm run package:mac
  env:
    CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_APP_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

### How It Works

1. **If secrets are NOT set:** Builds will complete but apps will be unsigned
2. **If secrets ARE set:** electron-builder automatically signs the apps
3. **No code changes needed** - just add the secrets when ready

## Testing

### Test Locally (Windows)

1. Get your PFX certificate file
2. Set environment variables:
   ```powershell
   $env:CSC_LINK = "C:\path\to\certificate.pfx"
   $env:CSC_KEY_PASSWORD = "your_password"
   npm run package:win
   ```

3. Verify signature:
   ```powershell
   Get-AuthenticodeSignature "out\MCP Electron App Setup 0.1.0.exe"
   ```

   Should show:
   - `Status: Valid`
   - `SignerCertificate: CN=Your Company Name`

### Test Locally (macOS)

1. Get your P12 certificate file
2. Set environment variables:
   ```bash
   export CSC_LINK="/path/to/certificate.p12"
   export CSC_KEY_PASSWORD="your_password"
   npm run package:mac
   ```

3. Verify signature:
   ```bash
   codesign -dv --verbose=4 "out/MCP Electron App-0.1.0.dmg"
   spctl -a -vvv -t install "out/MCP Electron App-0.1.0.dmg"
   ```

   Should show:
   - `Authority=Developer ID Application: Your Name (TEAM_ID)`
   - `satisfies its Designated Requirement`

## Troubleshooting

### Windows

**Error: "No signing certificate found"**
- Check that `CSC_LINK` is base64-encoded
- Verify `CSC_KEY_PASSWORD` is correct
- Ensure certificate hasn't expired

**SmartScreen still shows warnings (OV certificates)**
- This is expected initially
- Submit to Microsoft: https://www.microsoft.com/en-us/wdsi/filesubmission
- Need to build reputation over time (weeks/months)
- Consider upgrading to EV certificate for immediate bypass

**Error: "SignTool Error: No certificates were found that met all the given criteria"**
- Check `certificateSubjectName` matches your certificate's CN exactly
- Use `certutil -dump certificate.pfx` to view certificate details

### macOS

**Error: "No identity found"**
- Ensure certificate is "Developer ID Application" type
- Check certificate hasn't expired
- Verify `CSC_KEY_PASSWORD` is correct

**Notarization fails**
- Verify `APPLE_ID`, `APPLE_APP_PASSWORD`, and `APPLE_TEAM_ID` are correct
- Check Apple ID has accepted latest agreements at https://developer.apple.com
- App-specific password must be fresh (they expire)

**Gatekeeper blocks app**
- Right-click → "Open" instead of double-clicking (first launch only)
- If notarized, this shouldn't be necessary

### General

**"CSC_IDENTITY_AUTO_DISCOVERY is false"**
- This is intentional for builds without certificates
- Remove or set to `true` when certificates are configured

**Build succeeds but app is unsigned**
- Check secrets are set in GitHub Actions
- Look for "Skipping code signing" in build logs
- Verify environment variables are set correctly

## Cost Summary

### Windows Code Signing

| Approach | Cost | SmartScreen Behavior | Best For |
|----------|------|---------------------|----------|
| **No certificate** | Free | Always shows warnings | Development/testing only |
| **OV Certificate** | $100-300/year | Warnings until reputation built | Budget-conscious, patient |
| **EV Certificate** | $400-500/year | No warnings immediately | Professional releases |

### macOS Code Signing

| Approach | Cost | User Experience |
|----------|------|-----------------|
| **No certificate** | Free | Gatekeeper blocks (can bypass manually) |
| **Developer ID** | $99/year | Signed, notarization optional |
| **Developer ID + Notarization** | $99/year | Smooth installation, no warnings |

## Recommended Approach

### For Open Source / Personal Projects:
1. Start **without certificates** for development
2. Add **OV certificate** for Windows when ready for wider release
3. Add **Apple Developer** account for macOS when budget allows
4. Accept that reputation building takes time

### For Commercial / Professional Projects:
1. Get **EV certificate** for Windows (immediate trust)
2. Get **Apple Developer** account with notarization
3. Set up certificates from day one
4. Include cost in project budget

## Next Steps

1. **Decide on certificate type** based on budget and timeline
2. **Purchase certificates** from chosen CA
3. **Add secrets** to GitHub repository
4. **Test locally** before pushing
5. **Create a release** to trigger signed builds
6. **Monitor** for any signing issues

## Additional Resources

- [electron-builder Code Signing Docs](https://www.electron.build/code-signing)
- [Microsoft SmartScreen](https://docs.microsoft.com/en-us/windows/security/threat-protection/microsoft-defender-smartscreen/microsoft-defender-smartscreen-overview)
- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
