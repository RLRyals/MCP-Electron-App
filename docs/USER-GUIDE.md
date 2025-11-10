# MCP Electron App - User Guide

Welcome to the MCP Electron App! This guide will walk you through everything you need to know to install, set up, and use the MCP Writing System.

## Table of Contents

- [Introduction](#introduction)
- [What This App Does](#what-this-app-does)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [First-Time Setup](#first-time-setup)
- [Using the Dashboard](#using-the-dashboard)
- [Managing Services](#managing-services)
- [Using AI Clients](#using-ai-clients)
- [Updating the System](#updating-the-system)
- [Troubleshooting](#troubleshooting)
- [Uninstalling](#uninstalling)
- [Frequently Asked Questions](#frequently-asked-questions)

---

## Introduction

The MCP Electron App is a **user-friendly desktop application** that sets up and manages the MCP (Model Context Protocol) Writing System. It provides everything you need to use AI-powered writing tools without any technical configuration or terminal commands.

**Perfect for:** Writers, researchers, students, professionals, or anyone who wants AI assistance without dealing with technical setup.

**Key Benefit:** No programming knowledge required - just download, install, and start using!

---

## What This App Does

The MCP Electron App automatically sets up and manages:

1. **PostgreSQL Database** - Stores your writing data and context
2. **MCP Servers** - Powers AI integration and context management
3. **Docker Containers** - Runs the database and servers (managed automatically)
4. **AI Client Integration** - Connects with Typing Mind or Claude Desktop

All through a simple graphical interface - no configuration files to edit!

---

## System Requirements

### Minimum Requirements

- **Operating System:**
  - Windows 10 or 11 (64-bit)
  - macOS 10.15 (Catalina) or later
  - Linux: Ubuntu 20.04+ or equivalent

- **Hardware:**
  - 4GB RAM minimum (8GB recommended)
  - 10GB free disk space
  - Internet connection for setup

### Required Software

The app will help you install these if you don't have them:

- **Docker Desktop** - The app will guide you through installation
- **Git** - Used for downloading Typing Mind (app will help you install)

**Note:** You do NOT need Node.js, npm, or any development tools!

---

## Installation

### Step 1: Download the Installer

Visit the [GitHub Releases page](https://github.com/RLRyals/MCP-Electron-App/releases) and download the installer for your operating system:

- **Windows:** `MCP-Electron-App-Setup.exe`
- **macOS:** `MCP-Electron-App.dmg`
- **Linux:** `MCP-Electron-App.AppImage` or `mcp-electron-app.deb`

### Step 2: Install the Application

**On Windows:**

1. Double-click `MCP-Electron-App-Setup.exe`
2. Follow the installation wizard
3. Choose your installation folder (or use the default)
4. Click "Install" and wait for completion
5. Launch from Start Menu or Desktop shortcut

**On macOS:**

1. Open the downloaded `MCP-Electron-App.dmg` file
2. Drag the MCP Electron App icon to your Applications folder
3. Open Applications and find MCP Electron App
4. Right-click and select "Open" (first time only, to bypass security)
5. Click "Open" in the security dialog

**On Linux:**

For AppImage:
```bash
chmod +x MCP-Electron-App.AppImage
./MCP-Electron-App.AppImage
```

For .deb package:
```bash
sudo dpkg -i mcp-electron-app.deb
```

Then launch from your applications menu.

---

## First-Time Setup

When you first launch the app, it will guide you through a 7-step setup wizard:

### Step 1: Welcome Screen

Read the introduction and click "Get Started"

### Step 2: Prerequisites Check

The app checks if Docker Desktop and Git are installed.

**If Docker Desktop is not installed:**
- The app will show detailed installation instructions
- Click "Download Docker Desktop" to open the download page
- Follow the Docker installation wizard
- Return to the MCP app and click "Check Again"

**If Git is not installed:**
- The app will provide download links and instructions
- Install Git for your operating system
- Return and click "Check Again"

**What is Docker?** Think of Docker as a virtual container system that keeps all the technical parts organized and isolated. You don't need to understand how it works - the app handles everything!

### Step 3: Environment Configuration

Configure your database and service settings.

**What you'll see:**
- Database Name (default: `mcp_writing`)
- Database User (default: `mcp_user`)
- Database Password (auto-generated for security)
- PostgreSQL Port (default: `5432`)
- MCP Connector Port (default: `50880`)
- Typing Mind Port (default: `3000`)
- MCP Auth Token (auto-generated)

**What to do:**
- Review the default settings (they work for most users)
- If you want to change ports, enter new values
- The app will check if ports are available
- Click "Save Configuration" to continue

**Tip:** Keep the auto-generated password and token as-is - they're secure and you won't need to remember them!

### Step 4: Client Selection

Choose which AI client(s) you want to use.

**Option 1: Typing Mind (Recommended for Beginners)**
- Web-based interface that runs in your browser
- Automatically downloaded and configured by the app
- No additional installation needed
- Start using immediately after setup

**Option 2: Claude Desktop**
- Native desktop application
- Manual installation required (app provides guidance)
- Need to download separately from Anthropic
- The app helps you configure it

**You can select both!** Many users install both to try different interfaces.

**What to do:**
- Check the box next to your preferred client(s)
- Click "Save Selection"

### Step 5: Prepare Docker Images

The app will prepare necessary Docker images (PostgreSQL is pulled from Docker Hub, MCP Servers are built from source).

**What happens:**
- Progress bar shows preparation status
- PostgreSQL image is pulled from Docker Hub
- MCP Server code is downloaded and image is built locally
- This may take 5-15 minutes depending on your internet speed
- You can see which image is currently being prepared

**Note:** This only happens once! The images are saved on your computer for future use.

### Step 6: Install Typing Mind (if selected)

If you selected Typing Mind, the app will download and set it up.

**What happens:**
- The app uses Git to download Typing Mind
- Progress bar shows download status
- Takes 2-5 minutes
- Automatic configuration

**If it fails:** Check the troubleshooting section below.

### Step 7: Setup Complete!

Congratulations! Your MCP Writing System is ready.

**What to do next:**
1. Click "Start Services" to launch the system
2. Open your AI client (Typing Mind or Claude Desktop)
3. Begin writing with AI assistance!

---

## Using the Dashboard

After setup, you'll see the main dashboard. This is your control center for the MCP system.

### Dashboard Overview

**Status Indicator (top right):**
- Green dot: System running and healthy
- Yellow dot: System starting or partially running
- Red dot: System offline or error

**Quick Actions:**
- **Start System:** Launches all services (PostgreSQL, MCP Servers)
- **Stop System:** Shuts down all services
- **Restart System:** Stops and starts all services
- **Open Typing Mind:** Opens Typing Mind in your browser
- **Refresh Status:** Updates service status display

### Service Cards

Each service shows:
- Status (Online/Offline)
- Port number
- Actions (View Logs, etc.)

**Services you'll see:**
- **PostgreSQL:** Your database
- **MCP Servers:** The AI context engine
- **Typing Mind:** Web-based AI interface (if installed)

---

## Managing Services

### Starting the System

1. Click "Start System" on the dashboard
2. Wait for all services to start (takes 30-60 seconds)
3. Status indicator turns green when ready
4. You can now use your AI client

### Stopping the System

1. Click "Stop System" on the dashboard
2. All services shut down gracefully
3. Status indicator turns red
4. Safe to close the app or shut down your computer

### Restarting the System

Use "Restart System" if:
- Services are not responding
- You changed configuration settings
- You're troubleshooting an issue

### Viewing Logs

If something isn't working:

1. Click "View Logs" on any service card
2. See recent activity and error messages
3. Copy logs to share with support

Or use the menu: **Diagnostics → View Logs**

---

## Using AI Clients

### Using Typing Mind

1. Make sure the system is started (green status)
2. Click "Open Typing Mind" on the dashboard
3. Your browser opens to `http://localhost:3000`
4. The Typing Mind interface loads
5. Start chatting with AI!

**First-time Typing Mind setup:**
- Configure your AI provider (OpenAI, Claude, etc.)
- Add your API keys
- Choose your preferred model
- Start writing!

### Using Claude Desktop

If you selected Claude Desktop during setup:

1. Download Claude Desktop from [Anthropic's website](https://www.anthropic.com)
2. Install it on your computer
3. Open the Claude Desktop app
4. The app is already configured to connect to your MCP servers
5. Start chatting!

**Configuration details:**
- The MCP app automatically creates the config file
- Located at:
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`

### Switching Between Clients

You can use both Typing Mind and Claude Desktop simultaneously! They both connect to the same MCP servers and database.

---

## Updating the System

The app can check for and install updates for:
- MCP Servers
- Typing Mind
- The MCP Electron App itself

### Checking for Updates

**Automatic checks:**
- The app checks for updates when you start it
- You'll see a notification if updates are available

**Manual checks:**
1. Menu: **Help → Check for Updates**
2. Review what updates are available
3. Choose which components to update
4. Click "Update All" or update individually

### Installing Updates

1. Click "Update" for the component you want to update
2. Progress bar shows download and installation status
3. Some updates may require restarting the system
4. Follow any on-screen prompts

**Update preferences:**
- Automatic update checks: On by default
- You control when updates are installed
- Updates never install without your permission

---

## Troubleshooting

### Common Issues

**"Docker not running"**
- Open Docker Desktop from your applications
- Wait for it to fully start (icon stops spinning)
- Click "Check Again" in the MCP app

**"Port already in use"**
- Another application is using the port
- Go to Environment Configuration
- Change the port number
- Restart the system

**Services won't start**
- Check Docker Desktop is running
- View logs to see specific errors
- Try restarting the system
- See detailed troubleshooting guide

**Typing Mind won't download**
- Ensure Git is installed
- Check internet connection
- Check firewall isn't blocking Git
- Try downloading again

**Can't access Typing Mind in browser**
- Check Typing Mind service is running (green status)
- Try `http://localhost:3000` manually
- Check port 3000 isn't blocked
- View Typing Mind logs for errors

**Update fails**
- Check internet connection
- Ensure you have disk space
- Check antivirus isn't blocking downloads
- Try again later

### Getting Help

**View Logs:**
- Menu: **Diagnostics → View Logs**
- Shows detailed error messages

**Export Diagnostic Report:**
- Menu: **Diagnostics → Export Diagnostic Report**
- Creates a ZIP file with logs and system info
- Attach to bug reports

**Get Support:**
- Visit our [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues)
- Include your diagnostic report
- Describe what you were doing when the issue occurred

For more detailed troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## Uninstalling

### Uninstall the App

**Windows:**
1. Settings → Apps → Apps & features
2. Find "MCP Electron App"
3. Click "Uninstall"
4. Follow the prompts

**macOS:**
1. Open Applications folder
2. Drag "MCP Electron App" to Trash
3. Empty Trash

**Linux:**
For .deb:
```bash
sudo apt remove mcp-electron-app
```

For AppImage:
- Simply delete the AppImage file

### Remove Data and Configuration

The app stores data in these locations:

**Windows:**
- Config: `%APPDATA%\mcp-electron-app\`
- Logs: `%APPDATA%\mcp-electron-app\logs\`
- MCP Working Directory: `%USERPROFILE%\mcp-writing-system\`

**macOS:**
- Config: `~/Library/Application Support/mcp-electron-app/`
- Logs: `~/Library/Logs/mcp-electron-app/`
- MCP Working Directory: `~/mcp-writing-system/`

**Linux:**
- Config: `~/.config/mcp-electron-app/`
- Logs: `~/.local/share/mcp-electron-app/logs/`
- MCP Working Directory: `~/mcp-writing-system/`

**To completely remove everything:**
1. Uninstall the app
2. Stop Docker containers: `docker stop $(docker ps -aq)`
3. Remove containers: `docker rm $(docker ps -aq)`
4. Delete the directories listed above

---

## Frequently Asked Questions

### Do I need to know how to code?

No! This app is designed for non-technical users. Everything is done through buttons and forms.

### Is this free?

Yes, the MCP Electron App is free and open-source. However, you may need:
- API credits for AI services (Claude, ChatGPT, etc.) depending on your client
- Docker Desktop (free for personal use; a Docker Hub account is optional)

### What is Docker and why do I need it?

Docker is a platform that runs applications in isolated containers. The MCP system uses Docker to run the database and servers. You don't need to understand how Docker works - the app handles everything automatically!

### What's the difference between Typing Mind and Claude Desktop?

- **Typing Mind:** Web-based, runs in your browser, automatically set up by the app
- **Claude Desktop:** Native app, manual installation, official Anthropic client

Both connect to the same MCP servers. Choose based on your preference!

### Can I use both clients?

Yes! You can install and use both Typing Mind and Claude Desktop simultaneously.

### How much disk space do I need?

- App: ~200MB
- Docker images: ~1-2GB
- Typing Mind: ~100MB
- Working space: 5GB recommended

Total: **~10GB** to be safe.

### Can I use this offline?

The MCP system can run offline after initial setup. However, AI clients need internet to communicate with AI services (Claude, ChatGPT, etc.).

### How do I update MCP servers?

Menu: **Help → Check for Updates**, then click "Update" next to MCP Servers.

### How do I update Typing Mind?

Menu: **Help → Check for Updates**, then click "Update" next to Typing Mind.

### How do I backup my data?

Your data is stored in the PostgreSQL database. To backup:
1. Stop the system
2. Copy the MCP Working Directory (locations listed in Uninstalling section)
3. Store the copy somewhere safe

To restore: Copy the backup back to the MCP Working Directory location.

### What ports are used?

Default ports:
- PostgreSQL: 5432
- MCP Connector: 50880
- Typing Mind: 3000

### Can I change the ports?

Yes! Go to Environment Configuration and change any port. The app will check if the new port is available.

### Is my data private?

Yes! All data is stored locally on your computer. The only network communication is:
- Downloading Docker images (one-time)
- Downloading Typing Mind (one-time)
- Your AI client communicating with AI services (when you use it)

### Where are files stored?

See the "Uninstalling" section above for all file locations.

### I'm getting an error - what should I do?

1. Check the Troubleshooting section in this guide
2. View the logs: **Diagnostics → View Logs**
3. Export a diagnostic report: **Diagnostics → Export Diagnostic Report**
4. If still stuck, visit our [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues)

---

## Need More Help?

- **Quick Start Guide:** See [QUICK-START.md](QUICK-START.md) for a condensed guide
- **Troubleshooting:** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed problem-solving
- **FAQ:** See [FAQ.md](FAQ.md) for more questions and answers
- **Report a Bug:** [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues)

---

**Happy Writing!** 🎉

The MCP Electron App team
