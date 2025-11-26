# FictionLab App - Quick Start Guide

**For experienced users who want to get up and running fast.**

This is a condensed setup guide. For detailed explanations, see the [User Guide](USER-GUIDE.md).

---

## Prerequisites

Before starting, ensure you have:
- **Docker Desktop** installed and running
- **Git** installed (for Typing Mind download)
- **10GB free disk space**
- **4GB+ RAM** (8GB recommended)

---

## 5-Minute Setup

### 1. Download and Install

Download the installer for your OS from [GitHub Releases](https://github.com/RLRyals/MCP-Electron-App/releases):

- **Windows:** `MCP-Electron-App-Setup.exe`
- **macOS:** `MCP-Electron-App.dmg`
- **Linux:** `MCP-Electron-App.AppImage` or `.deb`

Run the installer and complete the installation wizard.

### 2. Launch and Run Setup Wizard

Open the FictionLab App. The first-time setup wizard will guide you through 7 steps:

1. **Welcome** → Click "Get Started"
2. **Prerequisites Check** → Verify Docker and Git (install if prompted)
3. **Environment Configuration** → Review defaults, click "Save Configuration"
4. **Client Selection** → Choose Typing Mind, Claude Desktop, or both
5. **Download Docker Images** → Wait for download (5-15 min)
6. **Install Typing Mind** → Auto-download (if selected, ~2-5 min)
7. **Setup Complete** → Click "Start Services"

### 3. Start Using

Once services start (30-60 seconds):

**For Typing Mind:**
- Click "Open Typing Mind" or visit `http://localhost:3000`
- Configure AI provider and API keys
- Start writing!

**For Claude Desktop:**
- Download from [Anthropic](https://www.anthropic.com)
- Install and launch
- Already configured automatically!

---

## Default Configuration

The setup wizard uses these defaults (all customizable):

```
PostgreSQL:
  Database: mcp_writing
  User: mcp_user
  Password: (auto-generated 32 chars)
  Port: 5432

MCP Connector:
  Port: 50880
  Auth Token: (auto-generated)

Typing Mind:
  Port: 3000
```

---

## Common Commands

### Using the Dashboard

- **Start System:** Launches all services (PostgreSQL, MCP Servers, optional Typing Mind)
- **Stop System:** Gracefully shuts down all services
- **Restart System:** Stops then starts all services
- **Refresh Status:** Updates service status display

### Menu Options

- **Diagnostics → View Logs:** View application logs
- **Diagnostics → Export Diagnostic Report:** Create ZIP with logs and system info
- **Diagnostics → Test System:** Run all diagnostic tests
- **Help → Check for Updates:** Check for app and component updates

---

## File Locations

### Configuration and Logs

**Windows:**
```
%APPDATA%\mcp-electron-app\
%APPDATA%\mcp-electron-app\logs\
```

**macOS:**
```
~/Library/Application Support/mcp-electron-app/
~/Library/Logs/mcp-electron-app/
```

**Linux:**
```
~/.config/mcp-electron-app/
~/.local/share/mcp-electron-app/logs/
```

### MCP Working Directory

**Windows:** `%USERPROFILE%\mcp-writing-system\`
**macOS:** `~/mcp-writing-system/`
**Linux:** `~/mcp-writing-system/`

### Claude Desktop Config

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

---

## Quick Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
docker --version
docker ps

# Restart Docker Desktop
# Then click "Restart System" in MCP app
```

### Port Conflicts

1. Go to Environment Configuration
2. Change conflicting ports:
   - PostgreSQL: Try 5433, 5434
   - MCP Connector: Try 50881, 50882
   - Typing Mind: Try 3001, 3002
3. Save and restart services

### Check Logs

```
Menu → Diagnostics → View Logs
or
Menu → Diagnostics → Open Logs Directory
```

### Reset Everything

```bash
# Stop services in app first, then:

# Remove Docker containers
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)

# Remove volumes
docker volume prune

# Delete app data
# Windows: rmdir /s %APPDATA%\mcp-electron-app
# macOS/Linux: rm -rf ~/Library/Application\ Support/mcp-electron-app

# Delete MCP working directory
# Windows: rmdir /s %USERPROFILE%\mcp-writing-system
# macOS/Linux: rm -rf ~/mcp-writing-system

# Restart app - will run setup wizard again
```

---

## Updating

**Check for updates:**
```
Menu → Help → Check for Updates
```

**Available updates:**
- FictionLab App (installer)
- MCP Servers (Docker images)
- Typing Mind (Git pull)

**Install updates:**
- Click "Update" next to component
- Or "Update All" for everything
- May require service restart

---

## API Keys Setup

### Typing Mind

1. Open Typing Mind: `http://localhost:3000`
2. Settings → AI Providers
3. Add provider (OpenAI, Claude, etc.)
4. Enter API key
5. Save

**Get API keys:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/

### Claude Desktop

Claude Desktop requires an Anthropic account and subscription. The MCP app automatically creates the config file - no additional setup needed!

---

## Docker Commands (Optional)

If you want to manage containers manually:

```bash
# List running containers
docker ps

# View service logs
docker logs mcp-postgres
docker logs mcp-servers
docker logs typing-mind

# Stop specific container
docker stop mcp-postgres

# Remove specific container
docker rm mcp-postgres

# View Docker images
docker images

# Clean up unused resources
docker system prune
```

**Note:** The app manages Docker automatically - manual commands usually not needed!

---

## Environment Variables

Configuration is stored in `.env` file in the MCP working directory.

**View/edit via app:** Environment Configuration screen

**Manual edit (not recommended):**
```bash
# Location varies by OS (see File Locations above)
# Edit ~/mcp-writing-system/.env (macOS/Linux)
# Edit %USERPROFILE%\mcp-writing-system\.env (Windows)

# After editing, restart services
```

**Available variables:**
```
POSTGRES_DB=mcp_writing
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=(auto-generated)
POSTGRES_PORT=5432
MCP_CONNECTOR_PORT=50880
TYPING_MIND_PORT=3000
MCP_AUTH_TOKEN=(auto-generated)
```

---

## Backup and Restore

### Backup

**Method 1: Copy working directory**
```bash
# Stop services first
# Then copy entire working directory
# macOS/Linux:
cp -r ~/mcp-writing-system ~/mcp-writing-system-backup

# Windows:
xcopy %USERPROFILE%\mcp-writing-system %USERPROFILE%\mcp-writing-system-backup /E /I
```

**Method 2: Database export**
```bash
docker exec mcp-postgres pg_dump -U mcp_user mcp_writing > backup.sql
```

### Restore

**Method 1: Restore directory**
```bash
# Stop services
# Delete current directory
# Copy backup to original location
# Start services
```

**Method 2: Database import**
```bash
cat backup.sql | docker exec -i mcp-postgres psql -U mcp_user -d mcp_writing
```

---

## Uninstall

### Quick Uninstall (keep data)

**Windows:** Settings → Apps → Uninstall "FictionLab App"
**macOS:** Drag app to Trash
**Linux:** `sudo apt remove mcp-electron-app` or delete AppImage

### Complete Removal (delete everything)

```bash
# Stop services in app first

# Remove containers
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker volume prune

# Remove app data (see File Locations above)
# Remove working directory (see File Locations above)

# Uninstall app (see Quick Uninstall above)
```

---

## System Requirements Summary

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Win10/macOS 10.15/Ubuntu 20.04 | Latest stable |
| RAM | 4GB | 8GB+ |
| Disk | 10GB free | 20GB+ free |
| CPU | Dual-core | Quad-core+ |
| Internet | Required for setup | Required for AI |

---

## Next Steps

- **Full documentation:** [User Guide](USER-GUIDE.md)
- **Problems?** [Troubleshooting Guide](TROUBLESHOOTING.md)
- **Questions?** [FAQ](FAQ.md)
- **Report bugs:** [GitHub Issues](https://github.com/RLRyals/MCP-Electron-App/issues)

---

**That's it!** You should now have a fully functional MCP Writing System.

If you run into issues, check the [Troubleshooting Guide](TROUBLESHOOTING.md) or [open an issue](https://github.com/RLRyals/MCP-Electron-App/issues).

**Happy Writing!** 🚀
