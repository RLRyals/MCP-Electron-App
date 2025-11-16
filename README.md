# FictionLab - Your AI-Powered Writing Laboratory

A professional desktop application that sets up and manages an AI-powered writing workspace with advanced context management capabilities. No terminal commands required - just download, install, and start writing with AI!

## What Is This?

FictionLab is an installer and management tool that sets up everything you need to use an AI-powered writing system with clients like Typing Mind or Claude Desktop. It handles all the technical setup automatically through an easy-to-use graphical interface.

**Perfect for:** Writers, researchers, students, professionals, or anyone who wants to use AI-powered writing tools without dealing with technical configuration.

**Key Benefit:** You don't need any programming knowledge, terminal experience, or technical expertise. Just download the installer and click through the setup wizard!

---

## For End Users

### Download & Install

#### Where to Download

Download the latest installer for your operating system from the [GitHub Releases](../../releases) page:

- **Windows:** `FictionLab-Setup.exe` (Windows 10/11, 64-bit)
- **macOS:** `FictionLab.dmg` (macOS 10.15+, Intel and Apple Silicon)
- **Linux:** `FictionLab.AppImage` or `fictionlab.deb` (Ubuntu 20.04+, Debian, other distros)

#### Installation Steps

**Windows:**
1. Download `FictionLab-Setup.exe`
2. Double-click the installer
3. Follow the installation wizard (choose installation folder if desired)
4. Click "Install" and wait for completion
5. Launch the app from your Start Menu or Desktop shortcut

**macOS:**
1. Download `FictionLab.dmg`
2. Open the downloaded DMG file
3. Drag the FictionLab icon to your Applications folder
4. Open from Applications (you may need to allow the app in Security & Privacy settings)

**Linux:**
1. Download `FictionLab.AppImage` or `fictionlab.deb`
2. For AppImage: Make it executable (`chmod +x FictionLab.AppImage`) and run it
3. For .deb: Install with `sudo dpkg -i fictionlab.deb`
4. Launch from your applications menu

### What the App Does For You

FictionLab automatically sets up and manages:

1. **PostgreSQL Database** - Stores your writing data and context
2. **Context Servers** - Powers the AI integration and context management
3. **Docker Containers** - Runs the database and servers (managed automatically)
4. **AI Client Integration** - Connects with your choice of AI interface

All of this happens through the app's graphical interface - no configuration files to edit, no terminal commands to type!

### What You Get

#### PostgreSQL Database
- Automatically configured and started
- Secure password generation
- No manual setup required
- Runs in Docker (managed by the app)

#### Context Servers
- Pre-configured and ready to use
- Automatic startup and health monitoring
- Easy start/stop controls from the app

#### Choice of AI Clients

**Option 1: Typing Mind (Recommended for Beginners)**
- Web-based interface (runs in your browser)
- Automatic download and setup by the app
- No additional installation needed
- Start using immediately after setup

**Option 2: Claude Desktop**
- Native desktop application
- Manual installation with guided instructions from the app
- Requires separate download from Anthropic
- The app helps you configure it correctly

**You can use both!** The app supports setting up multiple clients if you want to try different interfaces.

### Features

- **One-Click Installation** - Download and run the installer, that's it!
- **Docker Desktop Guidance** - Step-by-step wizard if Docker isn't installed
- **Automatic Environment Setup** - No .env files to edit manually
- **Typing Mind Download** - Automatically downloads and configures Typing Mind
- **System Health Monitoring** - Dashboard shows status of all components
- **Easy Start/Stop Controls** - Manage services with simple buttons
- **Update Notifications** - Get notified when updates are available
- **Cross-Platform** - Works on Windows, macOS, and Linux

### System Requirements

**Minimum Requirements:**
- **OS:** Windows 10/11 (64-bit), macOS 10.15+, or Linux (Ubuntu 20.04+)
- **RAM:** 4GB minimum (8GB recommended)
- **Disk Space:** 10GB free space (for Docker images and databases)
- **Internet:** Required for initial setup and downloading components

**Required Software (App Will Help You Install):**
- **Docker Desktop** - The app will guide you through installation if you don't have it
- **Git** - Used for downloading Typing Mind (app will help you install if needed)

**Note:** You do NOT need to install Node.js, npm, or any development tools. This is a complete standalone application!

### Getting Started

1. **Download** the installer for your operating system (see "Download & Install" section above)

2. **Run the Installer** and follow the installation wizard

3. **Launch the App** - It will appear in your Start Menu (Windows), Applications folder (macOS), or applications menu (Linux)

4. **First-Time Setup Wizard** - The app will guide you through:
   - Checking for Docker Desktop (and helping you install it if needed)
   - Checking for Git (and helping you install it if needed)
   - Configuring your database settings (automatic, just review and accept)
   - Choosing your AI client (Typing Mind, Claude Desktop, or both)
   - Downloading and setting up your chosen client(s)

5. **Start Using!** - Once setup is complete:
   - Click "Start Services" to launch FictionLab
   - Open your AI client (Typing Mind or Claude Desktop)
   - Begin writing with AI assistance

### Common First-Time Questions

**Q: Do I need to know how to code?**
A: No! This app is designed for non-technical users. Everything is done through buttons and forms.

**Q: Do I need to install Node.js or npm?**
A: No! Those are only for developers who want to build the app from source. Regular users just download and run the installer.

**Q: What if I don't have Docker Desktop?**
A: The app will detect this and show you a step-by-step guide to install Docker Desktop. Just follow the on-screen instructions.

**Q: How much does this cost?**
A: FictionLab is free and open-source. However, you may need:
- Docker Desktop (free for personal use; a Docker Hub account is optional)
- API credits for AI services (Claude, ChatGPT, etc.) depending on your chosen client

**Q: Can I uninstall it later?**
A: Yes! Just uninstall like any other application. Your data is stored separately and won't be deleted.

---

## Screenshots & Features Overview

### Setup Wizard
The first-time setup wizard guides you through every step, from checking prerequisites to choosing your AI client.

### System Dashboard
Monitor the health of your writing system at a glance:
- PostgreSQL database status
- Context servers status
- Docker container health
- Quick start/stop controls

### Client Selection
Choose between Typing Mind (automatic setup) or Claude Desktop (guided manual setup), or install both to try different interfaces.

### Docker Installation Guide
If Docker Desktop isn't installed, the app provides a comprehensive step-by-step wizard with download links and installation instructions.

---

## Support & Help

### Documentation

**For End Users:**
- **[User Guide](docs/USER-GUIDE.md)** - Complete installation and usage guide
- **[Quick Start](docs/QUICK-START.md)** - Fast setup for experienced users
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Solutions to common problems
- **[FAQ](docs/FAQ.md)** - Frequently asked questions

**For Developers:**
- **[Architecture](docs/ARCHITECTURE.md)** - Technical architecture overview
- **[Contributing](docs/CONTRIBUTING.md)** - How to contribute to the project
- **[Release Process](docs/RELEASE-PROCESS.md)** - How releases are created

**Additional Resources:**
- **[Video Tutorial Script](docs/VIDEO-SCRIPT.md)** - Guide for creating tutorial videos
- **In-App Help:** Menu: Help → User Guide, Troubleshooting, FAQ

### Getting Help

**If you encounter issues:**

1. **Check the App Logs**
   - Windows: `%USERPROFILE%\AppData\Roaming\fictionlab\logs`
   - macOS: `~/Library/Logs/fictionlab`
   - Linux: `~/.config/fictionlab/logs`

2. **Review Prerequisites**
   - Ensure Docker Desktop is installed and running
   - Ensure you have at least 10GB free disk space
   - Check that your antivirus isn't blocking the app

3. **Submit an Issue**
   - Visit our [GitHub Issues](../../issues) page
   - Click "New Issue"
   - Describe your problem and include relevant log files
   - We'll help you resolve it!

### Frequently Asked Questions

**The app says "Docker not running" - what do I do?**
- Open Docker Desktop manually from your applications
- Wait for it to fully start (the Docker icon should be steady, not spinning)
- Click "Check Again" in FictionLab

**Typing Mind won't download - why?**
- Ensure Git is installed (the app can guide you through this)
- Check your internet connection
- Verify you have write permissions in the installation directory

**Can I move the installation to a different folder?**
- Yes! Uninstall the app, then reinstall and choose a different location
- Your data and configuration can be backed up and restored

**Does this work offline after setup?**
- FictionLab can run offline
- However, AI clients need internet to communicate with AI services (Claude, ChatGPT, etc.)

---

## For Developers

**The following section is ONLY for developers who want to build, modify, or contribute to FictionLab itself. Regular users do NOT need to read this section.**

---

### Development Setup

If you want to build the app from source or contribute to development:

#### Prerequisites for Development
- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Git** for version control

#### Platform-Specific Development Requirements

**Windows:**
- No additional requirements for development

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`

**Linux:**
- Build tools: `sudo apt-get install build-essential`

#### Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd MCP-Electron-App

# Install dependencies
npm install

# Build TypeScript code
npm run build
```

### Development Commands

```bash
# Run in development mode with DevTools
npm run dev

# Compile TypeScript
npm run build

# Watch mode (auto-compile on changes)
npm run build:watch

# Run the compiled app
npm start

# Clean build artifacts
npm run clean
```

### Building for Production

#### Build for Current Platform
```bash
npm run package
```

#### Build for Specific Platforms
```bash
# Windows (NSIS installer)
npm run package:win

# macOS (DMG)
npm run package:mac

# Linux (AppImage and deb)
npm run package:linux

# All platforms
npm run package:all
```

#### Build Outputs

Built applications are placed in the `out/` directory:
- **Windows:** `out/FictionLab Setup.exe`
- **macOS:** `out/FictionLab.dmg`
- **Linux:** `out/FictionLab.AppImage`, `out/fictionlab.deb`

### Project Structure

```
FictionLab/
├── config/                # Configuration files
│   └── setup-config.json  # Build automation setup configuration
├── src/
│   ├── main/              # Main process (Node.js environment)
│   │   └── index.ts       # Main process entry point
│   ├── renderer/          # Renderer process (Browser environment)
│   │   ├── index.html     # Main HTML file
│   │   └── renderer.ts    # Renderer process script
│   ├── preload/           # Preload scripts (IPC bridge)
│   │   └── preload.ts     # Secure IPC bridge
│   ├── types/             # TypeScript type definitions
│   │   └── setup-config.ts # Configuration schema interfaces
│   └── utils/             # Utility modules
│       └── config-validator.ts # Configuration validation
├── resources/             # Static assets and build resources
├── dist/                  # Compiled TypeScript output (gitignored)
├── out/                   # Built application packages (gitignored)
├── docs/                  # Developer documentation
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

### Setup Configuration

The application uses a configuration system defined in `config/setup-config.json` to manage build automation and repository management.

#### Configuration Schema

The setup configuration defines:

1. **Repositories** - List of git repositories to clone and manage
   - Repository URL, local clone path, branch/version
   - Optional flag for non-essential repositories
   - Description and metadata

2. **Build Order** - Sequence of repository builds
   - Ordered list of repositories to build
   - Dependencies between repositories
   - Parallel build support configuration

3. **Build Steps** - Individual build commands
   - Custom shell commands per repository
   - Working directory and environment variables
   - Error handling and timeout configuration

4. **Docker Images** - Docker image naming and build config
   - Repository-to-image mapping
   - Tag naming conventions
   - Dockerfile path configuration

5. **Components** - Feature flags and optional components
   - Component enablement toggles
   - Repository grouping by functionality
   - Descriptions for UI presentation

#### Configuration Files

- **`config/setup-config.json`** - The primary configuration file with all setup parameters
- **`src/types/setup-config.ts`** - TypeScript interfaces defining the configuration schema
- **`src/utils/config-validator.ts`** - Configuration validation and loading utilities

#### Using the Configuration

To load and validate the setup configuration in your code:

```typescript
import { validateSetupConfig, loadAndValidateConfig } from './src/utils/config-validator';
import { SetupConfig } from './src/types/setup-config';

// Option 1: Load from file and validate
const { config, validation } = loadAndValidateConfig('./config/setup-config.json');

if (validation.valid) {
  const setupConfig: SetupConfig = config!;
  // Use the configuration
} else {
  console.error('Configuration errors:', validation.errors);
  console.warn('Configuration warnings:', validation.warnings);
}

// Option 2: Validate a configuration object
const result = validateSetupConfig(configObject);
if (result.valid) {
  // Configuration is valid
} else {
  // Handle validation errors
}
```

#### Configuration Example

See `config/setup-config.json` for a complete example configuration including:
- Multiple repository definitions
- Build order with dependencies
- Custom build steps for each repository
- Docker image configurations
- Optional component flags

### Architecture

#### Main Process (`src/main/`)
- Application entry point, runs in Node.js environment
- Creates and manages application windows
- Handles system-level operations (Docker checks, file operations)
- Manages IPC communication with renderer processes
- Controls application lifecycle

#### Renderer Process (`src/renderer/`)
- Runs in Chromium browser environment
- Renders the user interface (setup wizard, dashboard, etc.)
- Handles user interactions
- Communicates with main process via IPC
- Sandboxed for security

#### Preload Script (`src/preload/`)
- Secure bridge between main and renderer processes
- Exposes limited API to renderer using `contextBridge`
- Prevents direct access to Node.js APIs from renderer
- Follows Electron security best practices

### Security

This application follows Electron security best practices:
- **Context Isolation:** Enabled to separate preload and renderer contexts
- **Node Integration:** Disabled in renderer processes
- **Sandbox:** Enabled for renderer processes
- **Content Security Policy:** Implemented to prevent XSS attacks
- **Secure IPC:** All communication goes through the preload script

### CI/CD and Releases

#### Continuous Integration
Every push to `main` or `develop` branches and all pull requests trigger automated builds on Windows, macOS, and Linux.

The CI pipeline:
1. Installs dependencies
2. Builds TypeScript
3. Packages the Electron app for each platform
4. Generates SHA256 checksums
5. Uploads build artifacts (retained for 7 days)

#### Creating a Release

1. Update the version in `package.json`
2. Commit: `git commit -am "Bump version to X.X.X"`
3. Create tag: `git tag -a vX.X.X -m "Release version X.X.X"`
4. Push tag: `git push origin vX.X.X`

The release workflow will automatically:
- Build for all platforms
- Generate checksums
- Create a GitHub Release
- Upload all installers and checksums

See [RELEASE.md](RELEASE.md) for detailed release instructions.

### Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -am 'Add new feature'`
5. Push to the branch: `git push origin feature/my-feature`
6. Submit a pull request

**Contribution Guidelines:**
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure builds pass on all platforms
- Follow Electron security best practices

### Developer Documentation

Complete developer documentation is available in the `docs/` directory:

**Core Documentation:**
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture and design
- **[CONTRIBUTING.md](docs/CONTRIBUTING.md)** - How to contribute (setup, coding standards, PR process)
- **[RELEASE-PROCESS.md](docs/RELEASE-PROCESS.md)** - Release workflow and version management

**Implementation Details:**
- [ELECTRON-APP-REQUIREMENTS.md](docs/ELECTRON-APP-REQUIREMENTS.md) - Technical requirements
- [ELECTRON-BUNDLE-CHECKLIST.md](docs/ELECTRON-BUNDLE-CHECKLIST.md) - Bundling checklist
- [ELECTRON-DEPLOYMENT.md](docs/ELECTRON-DEPLOYMENT.md) - Deployment details
- [DOCKER-IMAGE-PRELOADING.md](docs/DOCKER-IMAGE-PRELOADING.md) - Docker image bundling
- [GITHUB-ISSUES-ELECTRON-APP.md](docs/GITHUB-ISSUES-ELECTRON-APP.md) - Issue templates

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for complete development setup instructions.

### Troubleshooting Development Issues

**TypeScript compilation errors:**
- Ensure all dependencies are installed: `npm install`
- Check `tsconfig.json` configuration
- Clear build artifacts: `npm run clean` then `npm run build`

**Build fails on macOS:**
- Install Xcode Command Line Tools: `xcode-select --install`
- Ensure you have proper code signing certificates (for distribution builds)

**Electron won't start:**
- Ensure you've built TypeScript: `npm run build`
- Check console output for errors
- Try cleaning and rebuilding: `npm run clean && npm run build`

### Resources for Developers

- [Electron Documentation](https://www.electronjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Electron Builder](https://www.electron.build/)
- [Electron Security](https://www.electronjs.org/docs/tutorial/security)
- [GitHub Actions Workflows](.github/workflows/) - CI/CD configuration

---

## License

MIT License - see LICENSE file for details.

---

## Version History

### 0.1.0 (Current)
- Initial release
- Basic installer functionality
- Docker Desktop detection and installation guidance
- PostgreSQL setup and management
- MCP servers integration
- Typing Mind automatic download
- Claude Desktop configuration support
- Cross-platform support (Windows, macOS, Linux)
- First-time setup wizard
- System health monitoring dashboard

---

**Remember:** If you're an end user, you only need to download the installer from the Releases page and run it. All the development setup, npm commands, and technical details above are only for developers who want to modify the app itself!
