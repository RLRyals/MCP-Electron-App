# FictionLab App - Frequently Asked Questions (FAQ)

Quick answers to common questions about the FictionLab App.

## Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [Docker & Technical Requirements](#docker--technical-requirements)
- [AI Clients](#ai-clients)
- [Usage & Features](#usage--features)
- [Data & Privacy](#data--privacy)
- [Updates & Maintenance](#updates--maintenance)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

---

## General Questions

### What is the FictionLab App?

The FictionLab App is a desktop application that sets up and manages the MCP (Model Context Protocol) Writing System. It provides an easy-to-use graphical interface for running AI-powered writing tools without any technical configuration.

### Who is this app for?

Anyone who wants to use AI writing tools without dealing with technical setup! Perfect for:
- Writers and authors
- Researchers and students
- Content creators
- Professionals who need AI assistance
- Anyone who wants local AI context management

**No programming knowledge required!**

### Is this free?

Yes! The FictionLab App is **free and open-source**. However, you may need:
- **Docker Desktop:** Free for personal use (requires Docker Hub account)
- **AI Service API Keys:** If using services like OpenAI or Claude (usage-based pricing)

The app itself and all its features are completely free.

### Do I need to know how to code?

**No!** The app is designed for non-technical users. Everything is done through:
- Simple buttons and forms
- Step-by-step wizards
- Automatic configuration
- Visual status indicators

If you can use a web browser, you can use this app!

### What operating systems are supported?

- **Windows:** Windows 10 and 11 (64-bit)
- **macOS:** macOS 10.15 (Catalina) and later (Intel and Apple Silicon)
- **Linux:** Ubuntu 20.04+, Debian, and other major distributions

---

## Installation & Setup

### How do I install the app?

1. Download the installer for your OS from [GitHub Releases](https://github.com/RLRyals/MCP-Electron-App/releases)
2. Run the installer
3. Follow the installation wizard
4. Launch the app
5. Complete the first-time setup

See the [User Guide](USER-GUIDE.md#installation) for detailed instructions.

### Do I need to install Node.js or npm?

**No!** You do NOT need Node.js or npm. Those are only for developers who want to build the app from source code.

Regular users just download and run the installer - it's a complete standalone application!

### What prerequisites do I need?

The app requires:
- **Docker Desktop** - The app will guide you through installation if you don't have it
- **Git** - Used for downloading Typing Mind (app will help you install)

That's it! The app helps you install both if needed.

### How long does setup take?

**First-time setup:** 15-30 minutes
- Docker Desktop installation: 10-15 minutes
- MCP App setup wizard: 5-10 minutes
- Preparing Docker images: 5-10 minutes (pulling Postgres, building MCP servers)

**Subsequent starts:** 30-60 seconds
- Services start much faster after initial setup!

### Can I skip parts of the setup?

Yes! The setup wizard lets you:
- Skip client installation (configure later)
- Use default configuration (skip customization)
- Install only the clients you want

You can always come back and configure things later.

---

## Docker & Technical Requirements

### What is Docker and why do I need it?

Docker is a platform that runs applications in isolated "containers." Think of it as creating separate, self-contained environments for each component.

**Why we use Docker:**
- **Easy setup:** No manual configuration needed
- **Isolation:** Components don't interfere with your system
- **Consistency:** Works the same on all computers
- **Easy cleanup:** Remove everything cleanly when uninstalling

**You don't need to understand Docker** - the app handles everything automatically!

### Do I need Docker experience?

**No!** You don't need to know anything about Docker. The FictionLab App:
- Checks if Docker is installed
- Guides you through Docker installation if needed
- Manages all Docker commands automatically
- Handles all container configuration

You'll never need to type Docker commands yourself!

### How much disk space do I need?

**Total recommended:** 10GB free space

Breakdown:
- FictionLab App: ~200MB
- Docker Desktop: ~500MB
- Docker images (PostgreSQL, MCP): ~1-2GB
- Typing Mind (optional): ~100MB
- Working space and data: ~5-7GB

**Tip:** More space is better for storing your writing and data!

### How much RAM do I need?

**Minimum:** 4GB RAM
**Recommended:** 8GB or more

The MCP system uses:
- PostgreSQL: ~200-500MB
- MCP Servers: ~300-500MB
- Typing Mind: ~100-200MB
- Docker overhead: ~500MB

More RAM allows for better performance!

### Can I use this on a laptop?

Yes! The app works great on laptops. Just ensure:
- You meet the minimum requirements (4GB RAM, 10GB disk)
- Your laptop is plugged in during initial setup (downloads take time)
- You have stable internet for first-time setup

### Does this work on older computers?

If your computer meets the minimum requirements (see above), it should work fine!

**Older computers may experience:**
- Slower Docker container startup
- Longer download times
- Higher CPU usage during operations

Try it and see! The app is free, so there's no risk.

---

## AI Clients

### What's the difference between Typing Mind and Claude Desktop?

| Feature | Typing Mind | Claude Desktop |
|---------|-------------|----------------|
| Type | Web-based | Native desktop app |
| Installation | Automatic by MCP app | Manual download required |
| Setup | Fully automated | Semi-automated (app helps) |
| Interface | Browser-based | Native application |
| AI Providers | Multiple (OpenAI, Claude, etc.) | Claude only |
| Best for | Beginners, flexibility | Claude users, native feel |

**Both connect to the same MCP servers and database!**

### Can I use both Typing Mind and Claude Desktop?

**Yes!** You can install and use both simultaneously. They both connect to the same MCP system, so you can:
- Switch between interfaces
- Try different tools for different tasks
- Use whichever you prefer at the moment

### Which client should I choose?

**Choose Typing Mind if:**
- You're new to AI writing tools
- You want the easiest setup
- You want to try multiple AI providers
- You prefer browser-based tools

**Choose Claude Desktop if:**
- You primarily use Claude
- You prefer native desktop applications
- You want the official Anthropic client

**Choose both if:**
- You want maximum flexibility!
- You want to try different interfaces

### Do I need API keys?

**For Typing Mind:** Yes, you'll need API keys for your chosen AI service:
- OpenAI API key (for GPT models)
- Anthropic API key (for Claude)
- Other providers as supported

**For Claude Desktop:** You need an Anthropic account and Claude subscription.

**FictionLab App:** No API keys needed! The app generates all required tokens automatically.

### Where do I get API keys?

- **OpenAI:** https://platform.openai.com/api-keys
- **Anthropic (Claude):** https://console.anthropic.com/

Both require creating an account and adding payment information. API usage is typically pay-as-you-go.

---

## Usage & Features

### How do I start the system?

1. Open the FictionLab App
2. Make sure Docker Desktop is running
3. Click "Start System" on the dashboard
4. Wait 30-60 seconds for services to start
5. Status indicator turns green when ready
6. Open your AI client (Typing Mind or Claude Desktop)

### How do I stop the system?

Click "Stop System" on the dashboard. All services shut down gracefully.

**When to stop:**
- Before shutting down your computer (optional but recommended)
- When not using the system for a while
- When troubleshooting issues

### Do I need to start services every time?

**Yes**, services need to be started when:
- You first open the app
- After stopping services
- After restarting your computer

**No**, services stay running if:
- You just minimize the app
- You switch to other applications

**Tip:** Keep services running while actively writing!

### What ports does the system use?

Default ports:
- **PostgreSQL:** 5432
- **MCP Connector:** 50880
- **Typing Mind:** 3000

All ports can be changed in Environment Configuration if there are conflicts.

### Can I change the ports?

**Yes!** To change ports:
1. Go to Environment Configuration
2. Enter new port numbers
3. App checks if ports are available (shows ✓ or ✗)
4. Click "Save Configuration"
5. Restart services

**When to change ports:**
- Another app is using the default port
- Your firewall blocks certain ports
- Your network requires specific ports

### How do I access Typing Mind?

1. Ensure services are started
2. Click "Open Typing Mind" on dashboard
3. Or manually visit `http://localhost:3000` in your browser

**First time:** You'll need to configure Typing Mind with your AI provider and API keys.

### Can I use this offline?

**Partially:**
- MCP system can run offline
- Local database works offline
- You can start/stop services offline

**Requires internet:**
- AI services (OpenAI, Claude) need internet
- Downloading updates
- Initial setup and installation

**Typical workflow:** Setup online, then use mostly online (for AI), but core system works offline.

---

## Data & Privacy

### Where is my data stored?

**Configuration and logs:**
- Windows: `%APPDATA%\mcp-electron-app\`
- macOS: `~/Library/Application Support/mcp-electron-app/`
- Linux: `~/.config/mcp-electron-app/`

**Database and working files:**
- Windows: `%USERPROFILE%\mcp-writing-system\`
- macOS: `~/mcp-writing-system/`
- Linux: `~/mcp-writing-system/`

**Docker volumes:**
- Managed by Docker Desktop
- Contains PostgreSQL database

### Is my data private and secure?

**Yes!** All data is stored **locally on your computer**.

**What stays local:**
- Database content
- Configuration files
- Logs and diagnostic data
- MCP context and state

**What's transmitted:**
- AI client to AI service communication (OpenAI, Claude, etc.)
- Update checks to GitHub
- Docker image pulls (Postgres from Docker Hub)
- Repository cloning for MCP servers (via Git)

**The FictionLab App never sends your data anywhere!**

### Can I backup my data?

**Yes!** To backup:

**Method 1: Backup working directory**
1. Stop the system
2. Copy the MCP working directory (see locations above)
3. Store the copy somewhere safe (external drive, cloud storage)

**Method 2: Export database**
```bash
docker exec mcp-postgres pg_dump -U mcp_user mcp_writing > backup.sql
```

**To restore:**
- Copy backup back to working directory location
- Or import SQL dump to PostgreSQL

### How do I delete all my data?

See [TROUBLESHOOTING.md - Hard Reset](TROUBLESHOOTING.md#hard-reset-remove-everything)

This removes:
- Docker containers and volumes
- Configuration files
- Database
- Working directory
- All app data

**Warning:** This is permanent and cannot be undone!

---

## Updates & Maintenance

### How do I update the app?

**Automatic check:**
- App checks for updates on startup
- You'll see a notification if updates are available

**Manual check:**
1. Menu: **Help → Check for Updates**
2. Review available updates
3. Click "Update" for components you want to update

**What can be updated:**
- FictionLab App itself
- MCP Servers (Docker images)
- Typing Mind

### Will updates break my data?

No! Updates are designed to preserve your data and configuration.

**Before updating:**
- Backup is recommended (but usually not necessary)
- Updates may restart services
- Read release notes for breaking changes

**After updating:**
- Your data remains intact
- Configuration is preserved
- May need to restart services

### How often should I update?

**Recommended:**
- Check for updates monthly
- Update when you see notifications
- Update before reporting bugs (ensures you have latest fixes)

**Not required:**
- Updates are optional
- You can skip updates if everything works
- But security and bug fixes are important!

### Can I prevent automatic updates?

**The app doesn't automatically install updates** - it only checks if they're available.

You always control when updates are installed!

To disable update checks:
- Currently not configurable
- Feature may be added in future versions

---

## Troubleshooting

### Services won't start - what do I do?

**Quick fixes:**
1. Ensure Docker Desktop is running
2. Click "Restart System"
3. View logs for error messages
4. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**Common causes:**
- Docker not running
- Port conflicts
- Insufficient resources
- Old containers still running

### Docker says it's not installed but I have it

**Solutions:**
1. Ensure Docker Desktop is actually running (icon in system tray/menu bar)
2. Restart Docker Desktop
3. Check Docker is in system PATH
4. Try running `docker --version` in terminal

See [TROUBLESHOOTING.md - Docker Issues](TROUBLESHOOTING.md#docker-issues)

### Typing Mind won't download

**Common causes:**
- Git not installed
- No internet connection
- Firewall blocking Git
- Insufficient disk space

**Solutions:**
1. Ensure Git is installed: `git --version`
2. Check internet connection
3. Check firewall settings
4. Ensure 1GB+ free disk space

See [TROUBLESHOOTING.md - Typing Mind Issues](TROUBLESHOOTING.md#typing-mind-issues)

### Where can I find logs?

**App logs:**
- Menu: **Diagnostics → View Logs**
- Menu: **Diagnostics → Open Logs Directory**

**Service logs:**
- Click "View Logs" on any service card

**Export everything:**
- Menu: **Diagnostics → Export Diagnostic Report**

### How do I report a bug?

1. Export diagnostic report: **Diagnostics → Export Diagnostic Report**
2. Visit [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues)
3. Click "New Issue"
4. Use the bug report template
5. Attach diagnostic report
6. Describe the issue clearly

See [TROUBLESHOOTING.md - Getting Additional Help](TROUBLESHOOTING.md#getting-additional-help)

---

## Advanced Topics

### Can I run multiple instances?

**Not recommended.** The app is designed to run a single instance.

**If you really need to:**
- Would require changing all ports
- Separate working directories
- Complex configuration
- May cause conflicts

**Better alternatives:**
- Use both Typing Mind and Claude Desktop (same instance)
- Run in a virtual machine (separate computer)

### Can I customize the MCP servers?

**Currently:** Limited customization through environment variables.

**Future:** More customization options may be added.

**For developers:**
- Source code is open-source
- You can modify and rebuild
- See [CONTRIBUTING.md](CONTRIBUTING.md)

### How do I contribute to the project?

We welcome contributions!

1. Read [CONTRIBUTING.md](CONTRIBUTING.md)
2. Fork the repository
3. Make your changes
4. Submit a pull request

**Ways to contribute:**
- Report bugs
- Suggest features
- Improve documentation
- Submit code fixes
- Test new versions

### Where is the source code?

GitHub: https://github.com/RLRyals/MCP-Electron-App

**License:** MIT License - free and open-source!

### Can I use this for commercial purposes?

**Yes!** The MIT license allows:
- Personal use
- Commercial use
- Modification
- Distribution

**However:** AI service providers (OpenAI, Claude) have their own terms of service. Check with them regarding commercial API usage.

### How do I uninstall completely?

**Uninstall app:**
- Windows: Settings → Apps → Uninstall
- macOS: Drag to Trash
- Linux: `sudo apt remove mcp-electron-app` or delete AppImage

**Remove data:**
- Delete configuration directories
- Delete working directory
- Remove Docker containers: `docker rm $(docker ps -aq)`
- Remove Docker volumes: `docker volume prune`

See [USER-GUIDE.md - Uninstalling](USER-GUIDE.md#uninstalling) for detailed steps.

---

## Still Have Questions?

**Documentation:**
- [User Guide](USER-GUIDE.md) - Complete user documentation
- [Quick Start](QUICK-START.md) - Fast setup guide
- [Troubleshooting](TROUBLESHOOTING.md) - Problem-solving guide
- [Architecture](ARCHITECTURE.md) - Technical overview (for developers)

**Get Help:**
- [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues) - Report bugs, ask questions
- Read existing issues - your question may already be answered!

**Can't find your answer?** Create a new issue and ask! We're here to help.

---

**Happy Writing!** 🎉
