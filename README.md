# MCP Electron App

A modern, cross-platform desktop application built with Electron and TypeScript, designed to integrate the Model Context Protocol (MCP) for enhanced AI capabilities.

## Overview

This application provides a robust foundation for building Electron applications with:
- TypeScript support for type-safe development
- Secure IPC communication between main and renderer processes
- Cross-platform build support (Windows, macOS, Linux)
- Modern security best practices
- Production-ready build configuration

## Features

- **TypeScript**: Full TypeScript support for type safety and better developer experience
- **Security First**: Context isolation, sandboxing, and secure IPC communication
- **Cross-Platform**: Build for Windows (NSIS), macOS (DMG), and Linux (AppImage, deb)
- **Modern Architecture**: Separate main, renderer, and preload processes
- **Development Tools**: Hot reload support and DevTools integration
- **Logging**: Built-in logging with electron-log

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher (comes with Node.js)
- **Git**: For version control

### Platform-Specific Requirements

#### Windows
- No additional requirements

#### macOS
- Xcode Command Line Tools (for building native modules)
  ```bash
  xcode-select --install
  ```

#### Linux
- Standard build tools
  ```bash
  sudo apt-get install build-essential
  ```

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd MCP-Electron-App
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Project Structure

```
MCP-Electron-App/
├── src/
│   ├── main/              # Main process code (Node.js environment)
│   │   └── index.ts       # Main process entry point
│   ├── renderer/          # Renderer process code (Browser environment)
│   │   ├── index.html     # Main HTML file
│   │   └── renderer.ts    # Renderer process script
│   └── preload/           # Preload scripts (Bridge between main and renderer)
│       └── preload.ts     # Secure IPC bridge
├── resources/             # Static assets and build resources
├── dist/                  # Compiled TypeScript output (gitignored)
├── out/                   # Built application packages (gitignored)
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## Development

### Running in Development Mode

Start the application in development mode with DevTools enabled:

```bash
npm run dev
```

This command will:
1. Compile TypeScript code
2. Launch the Electron application
3. Open DevTools automatically

### Watch Mode

For continuous development, you can run TypeScript in watch mode:

```bash
# Terminal 1: Watch and compile TypeScript
npm run build:watch

# Terminal 2: Run the application
npm start
```

### Development Scripts

- `npm run dev` - Build and start the app with DevTools
- `npm run build` - Compile TypeScript to JavaScript
- `npm run build:watch` - Watch mode for TypeScript compilation
- `npm start` - Start the compiled application
- `npm run clean` - Remove build artifacts

## Building for Production

### Build for Current Platform

Build the application for your current platform:

```bash
npm run package
```

### Build for Specific Platforms

Build for specific platforms:

```bash
# Windows (NSIS installer)
npm run package:win

# macOS (DMG)
npm run package:mac

# Linux (AppImage and deb)
npm run package:linux
```

### Build for All Platforms

Build for all platforms (requires appropriate platform or CI/CD):

```bash
npm run package:all
```

### Build Outputs

Built applications will be placed in the `out/` directory:
- **Windows**: `out/MCP Electron App Setup.exe`
- **macOS**: `out/MCP Electron App.dmg`
- **Linux**: `out/MCP Electron App.AppImage`, `out/mcp-electron-app.deb`

## CI/CD and Releases

This project uses GitHub Actions for automated builds and releases.

### Continuous Integration

Every push to `main` or `develop` branches and all pull requests trigger automated builds on:
- Windows (latest)
- macOS (latest)
- Linux (Ubuntu latest)

The CI pipeline:
1. Installs dependencies
2. Builds TypeScript
3. Packages the Electron app for each platform
4. Generates SHA256 checksums
5. Uploads build artifacts (retained for 7 days)

### Creating a Release

To create a new release:

1. Update the version in `package.json`
2. Commit the change: `git commit -am "Bump version to X.X.X"`
3. Create a git tag: `git tag -a vX.X.X -m "Release version X.X.X"`
4. Push the tag: `git push origin vX.X.X`

The release workflow will automatically:
- Build for all platforms (Windows, macOS, Linux)
- Generate checksums for all artifacts
- Create a GitHub Release with release notes
- Upload all installers and checksums

### Release Artifacts

Each release includes:
- **Windows**: NSIS installer (.exe)
- **macOS**: DMG with universal binary (Intel + Apple Silicon)
- **Linux**: AppImage and Debian package (.deb)
- **Checksums**: SHA256 checksums for all artifacts

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., v1.2.3)
- Pre-releases: `v1.0.0-alpha.1`, `v1.0.0-beta.1`, `v1.0.0-rc.1`

For detailed release instructions, see [RELEASE.md](RELEASE.md).

## Architecture

### Main Process (`src/main/`)
The main process is the application's entry point and runs in a Node.js environment. It:
- Creates and manages application windows
- Handles system-level operations
- Manages IPC communication with renderer processes
- Controls the application lifecycle

### Renderer Process (`src/renderer/`)
The renderer process runs in a Chromium browser environment. It:
- Renders the user interface
- Handles user interactions
- Communicates with the main process via IPC
- Runs in a sandboxed environment for security

### Preload Script (`src/preload/`)
The preload script acts as a secure bridge between main and renderer processes. It:
- Exposes a limited API to the renderer process
- Uses `contextBridge` for secure communication
- Prevents direct access to Node.js APIs from the renderer

## Security

This application follows Electron security best practices:

1. **Context Isolation**: Enabled to separate preload and renderer contexts
2. **Node Integration**: Disabled in renderer processes
3. **Sandbox**: Enabled for renderer processes
4. **Content Security Policy**: Implemented to prevent XSS attacks
5. **Secure IPC**: All communication goes through the preload script

## Configuration

### TypeScript Configuration

TypeScript settings can be modified in `tsconfig.json`. Key settings:
- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Source maps generated for debugging

### Electron Builder Configuration

Build settings are configured in `package.json` under the `build` key. You can customize:
- Application ID and product name
- Build targets and architectures
- File inclusions/exclusions
- Platform-specific settings
- Installer options

## Troubleshooting

### Common Issues

**Issue**: Application won't start
- **Solution**: Ensure you've run `npm run build` to compile TypeScript

**Issue**: Build fails on macOS
- **Solution**: Install Xcode Command Line Tools: `xcode-select --install`

**Issue**: Missing dependencies
- **Solution**: Delete `node_modules` and run `npm install` again

**Issue**: TypeScript errors
- **Solution**: Check `tsconfig.json` and ensure all dependencies are installed

### Logs

Application logs are stored in:
- **Windows**: `%USERPROFILE%\AppData\Roaming\mcp-electron-app\logs`
- **macOS**: `~/Library/Logs/mcp-electron-app`
- **Linux**: `~/.config/mcp-electron-app/logs`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Electron Builder](https://www.electron.build/)
- [Electron Security](https://www.electronjs.org/docs/tutorial/security)
- [Release Process](RELEASE.md) - Detailed release instructions
- [GitHub Actions Workflows](.github/workflows/) - CI/CD configuration

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing documentation
- Review Electron security guidelines

## Version History

### 0.1.0 (Current)
- Initial project setup
- Basic Electron application structure
- TypeScript configuration
- Cross-platform build support
- Security best practices implemented
