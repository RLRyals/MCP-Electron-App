# FictionLab App - Troubleshooting Guide

This guide helps you diagnose and fix common issues with the FictionLab App.

## Quick Links to Specific Issues

- **[404 Errors in Docker (SSE/HTTP errors)](./TROUBLESHOOTING_404_ERRORS.md)** - If you're seeing "Non-200 status code (404)" or "Failed to initialize client" errors

## Table of Contents

- [General Troubleshooting Steps](#general-troubleshooting-steps)
- [Installation Issues](#installation-issues)
- [Docker Issues](#docker-issues)
- [Service Issues](#service-issues)
- [Typing Mind Issues](#typing-mind-issues)
- [Claude Desktop Issues](#claude-desktop-issues)
- [Port Conflicts](#port-conflicts)
- [Update Issues](#update-issues)
- [Performance Issues](#performance-issues)
- [Log Files and Diagnostics](#log-files-and-diagnostics)
- [How to Reset and Start Over](#how-to-reset-and-start-over)
- [Getting Additional Help](#getting-additional-help)

---

## General Troubleshooting Steps

Before diving into specific issues, try these general steps:

### 1. Check System Status

Look at the dashboard status indicator:
- **Green:** All systems operational
- **Yellow:** System starting or degraded
- **Red:** System offline or error

### 2. View Logs

Logs contain detailed error messages:
- Menu: **Diagnostics → View Logs**
- Or click "View Logs" on any service card

### 3. Restart the System

Many issues can be fixed with a restart:
1. Click "Stop System"
2. Wait for all services to stop
3. Click "Start System"
4. Wait for services to fully start

### 4. Restart the App

Sometimes restarting the FictionLab App itself helps:
1. Close the app completely
2. Reopen it
3. Check if the issue persists

### 5. Restart Docker Desktop

If services won't start:
1. Close the FictionLab App
2. Quit Docker Desktop
3. Wait 30 seconds
4. Start Docker Desktop
5. Wait for Docker to be fully running
6. Start the FictionLab App

---

## Installation Issues

### App won't install on Windows

**Symptoms:** Installer fails or shows errors

**Solutions:**

1. **Run as Administrator:**
   - Right-click the installer
   - Select "Run as administrator"
   - Try installation again

2. **Antivirus blocking:**
   - Temporarily disable antivirus
   - Install the app
   - Re-enable antivirus
   - Add app to antivirus whitelist

3. **Previous installation exists:**
   - Uninstall old version first
   - Delete `%APPDATA%\mcp-electron-app\` folder
   - Try installing again

4. **Not enough disk space:**
   - Ensure you have at least 10GB free
   - Clear temp files if needed
   - Try again

### App won't open on macOS

**Symptoms:** "App can't be opened" or security warnings

**Solutions:**

1. **Security settings:**
   - Right-click the app
   - Select "Open"
   - Click "Open" in security dialog
   - Or: System Preferences → Security & Privacy → Allow app

2. **Quarantine flag:**
   ```bash
   xattr -d com.apple.quarantine /Applications/MCP\ Electron\ App.app
   ```

3. **Permissions:**
   - Ensure app has necessary permissions
   - System Preferences → Security & Privacy → Privacy
   - Grant access for "Full Disk Access" if prompted

### AppImage won't run on Linux

**Symptoms:** Double-clicking does nothing

**Solutions:**

1. **Make executable:**
   ```bash
   chmod +x MCP-Electron-App.AppImage
   ```

2. **Run from terminal:**
   ```bash
   ./MCP-Electron-App.AppImage
   ```
   - Check for error messages

3. **Install FUSE:**
   ```bash
   sudo apt install fuse libfuse2
   ```

4. **Try .deb package instead:**
   ```bash
   sudo dpkg -i mcp-electron-app.deb
   ```

---

## Docker Issues

### Docker Desktop not detected

**Symptoms:** App says "Docker not installed" but you have Docker

**Solutions:**

1. **Check Docker is actually running:**
   - Look for Docker icon in system tray (Windows/macOS) or top bar (Linux)
   - Icon should be steady, not spinning

2. **Verify Docker command works:**
   ```bash
   docker --version
   ```
   - If this fails, Docker isn't properly installed

3. **Restart Docker Desktop:**
   - Quit Docker Desktop completely
   - Wait 30 seconds
   - Start Docker Desktop
   - Wait for it to fully start (can take 1-2 minutes)
   - Click "Check Again" in MCP app

4. **Check PATH variable:**
   - Docker must be in your system PATH
   - Windows: `docker` command should work in Command Prompt
   - macOS/Linux: `docker` command should work in Terminal

### Docker won't start

**Symptoms:** Docker Desktop shows errors when starting

**Solutions:**

1. **Windows - WSL2 issues:**
   - Ensure WSL2 is installed
   - Run: `wsl --update` in PowerShell (as admin)
   - Restart computer
   - Try Docker Desktop again

2. **Windows - Hyper-V issues:**
   - Ensure Hyper-V is enabled
   - Control Panel → Programs → Turn Windows features on or off
   - Enable "Hyper-V" and "Windows Hypervisor Platform"
   - Restart computer

3. **macOS - Virtualization issues:**
   - Ensure virtualization is enabled in BIOS/firmware
   - For M1/M2 Macs: Rosetta should be installed
   - System Settings → General → About → System Report → Software

4. **Linux - permissions:**
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```
   - Log out and log back in

5. **Resource allocation:**
   - Docker Desktop → Settings → Resources
   - Ensure sufficient RAM (4GB minimum)
   - Ensure sufficient disk space

6. **Reset Docker Desktop:**
   - Docker Desktop → Troubleshoot → Reset to factory defaults
   - Warning: This removes all containers and images!

### Docker commands fail

**Symptoms:** Docker runs but commands don't work

**Solutions:**

1. **Check Docker daemon:**
   ```bash
   docker info
   ```
   - Should show system information
   - If error, Docker daemon isn't running

2. **Restart Docker daemon:**
   - Windows/macOS: Restart Docker Desktop
   - Linux: `sudo systemctl restart docker`

3. **Permission denied errors:**
   - Linux: Add user to docker group (see above)
   - Windows: Run Docker Desktop as administrator

---

## Service Issues

### Services won't start

**Symptoms:** Click "Start System" but services stay offline

**Solutions:**

1. **Check Docker is running:**
   - Docker Desktop must be running first
   - See Docker Issues section above

2. **Check port conflicts:**
   - Menu: **Diagnostics → Test System**
   - Look for "Port already in use" errors
   - See Port Conflicts section below

3. **View service logs:**
   - Click "View Logs" on the service that won't start
   - Look for error messages
   - Address specific errors

4. **Check disk space:**
   - Ensure you have at least 5GB free
   - Docker needs space for containers and volumes

5. **Remove old containers:**
   ```bash
   docker ps -a
   docker rm $(docker ps -aq)
   ```
   - Removes all stopped containers
   - Then try starting services again

### PostgreSQL won't start

**Symptoms:** PostgreSQL service shows "Offline" or errors

**Solutions:**

1. **Port 5432 in use:**
   - Another PostgreSQL instance may be running
   - Windows: Stop PostgreSQL service in Services
   - macOS: `brew services stop postgresql`
   - Linux: `sudo systemctl stop postgresql`
   - Or change port in Environment Configuration

2. **Data directory issues:**
   - Remove old data: `docker volume prune`
   - Warning: This deletes database data!
   - Restart services

3. **Check container logs:**
   - Click "View Logs" on PostgreSQL service card
   - Look for initialization errors
   - Check password is correct

4. **Container name conflict:**
   ```bash
   docker rm mcp-postgres
   ```
   - Then start services again

### MCP Servers won't start

**Symptoms:** MCP Servers service shows "Offline"

**Solutions:**

1. **PostgreSQL must start first:**
   - Ensure PostgreSQL is running (green status)
   - MCP Servers depend on the database
   - If PostgreSQL is down, fix that first

2. **Environment variables:**
   - Go to Environment Configuration
   - Click "Use Defaults" then "Save Configuration"
   - Restart services

3. **Check container logs:**
   - Click "View Logs" on MCP Servers card
   - Look for connection errors to PostgreSQL
   - Look for missing environment variables

4. **Network issues:**
   ```bash
   docker network ls
   docker network prune
   ```
   - Recreate Docker networks
   - Restart services

### Services start but show unhealthy

**Symptoms:** Services show "Online" but status indicator is yellow

**Solutions:**

1. **Wait longer:**
   - Services can take 1-2 minutes to fully initialize
   - Especially on first start
   - Check again after waiting

2. **View logs:**
   - Check for error messages in logs
   - Look for initialization warnings

3. **Check resource usage:**
   - Docker Desktop → Settings → Resources
   - Ensure sufficient RAM allocated
   - Ensure CPU isn't maxed out

---

## Typing Mind Issues

### Typing Mind won't download

**Symptoms:** Download fails or times out

**Solutions:**

1. **Check Git is installed:**
   ```bash
   git --version
   ```
   - Should show Git version
   - If not, install Git first

2. **Check internet connection:**
   - Ensure stable internet
   - Try: `ping github.com`

3. **Firewall blocking Git:**
   - Windows: Allow Git through Windows Firewall
   - macOS: System Preferences → Security & Privacy → Firewall
   - Linux: Check `ufw` or `iptables` rules

4. **GitHub access issues:**
   - Try accessing https://github.com in browser
   - GitHub may be temporarily down
   - Try download again later

5. **Disk space:**
   - Ensure at least 1GB free
   - Typing Mind needs ~100MB

6. **Manual download:**
   ```bash
   cd ~/mcp-writing-system
   git clone https://github.com/TypeMind/TypeMind.git typing-mind
   ```

### Can't access Typing Mind in browser

**Symptoms:** Browser shows "Can't connect" at localhost:3000

**Solutions:**

1. **Check service is running:**
   - Dashboard should show Typing Mind as "Online"
   - If offline, start the system

2. **Wrong port:**
   - Check what port Typing Mind is using
   - Service card shows port number
   - Use that port in browser: `http://localhost:PORT`

3. **Firewall blocking:**
   - Windows: Allow port 3000 through firewall
   - macOS: System Preferences → Security & Privacy → Firewall
   - Linux: `sudo ufw allow 3000`

4. **Try different browser:**
   - Some browsers have strict localhost policies
   - Try Chrome, Firefox, or Edge

5. **Check logs:**
   - Click "View Logs" on Typing Mind card
   - Look for startup errors
   - Look for port binding errors

6. **Container not running:**
   ```bash
   docker ps
   ```
   - Should show typing-mind container
   - If not, check why it failed to start

### Typing Mind interface loads but doesn't work

**Symptoms:** Page loads but can't use features

**Solutions:**

1. **Configure AI provider:**
   - Typing Mind needs API keys for AI services
   - Click settings in Typing Mind
   - Add your OpenAI, Claude, or other API key

2. **MCP connection:**
   - Typing Mind should connect to MCP servers
   - Check MCP Servers service is running
   - Check MCP Connector service is running

3. **Browser console errors:**
   - Press F12 in browser
   - Check Console tab for errors
   - Look for network errors

---

## Claude Desktop Issues

### Claude Desktop won't connect to MCP

**Symptoms:** Claude Desktop doesn't show MCP features

**Solutions:**

1. **Check config file exists:**
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Verify config file content:**
   ```json
   {
     "mcpServers": {
       "mcp-writing-system": {
         "url": "http://localhost:50880",
         "token": "YOUR_AUTH_TOKEN_HERE"
       }
     }
   }
   ```

3. **Check MCP Connector is running:**
   - Dashboard should show MCP Connector as "Online"
   - Port should match config file (default: 50880)

4. **Restart Claude Desktop:**
   - Close Claude Desktop completely
   - Wait 10 seconds
   - Reopen Claude Desktop
   - Should reconnect to MCP

5. **Check auth token:**
   - Token in config must match token in `.env` file
   - View token: Environment Configuration screen
   - Copy correct token to Claude Desktop config

6. **Port mismatch:**
   - Ensure port in config matches MCP Connector port
   - Check Environment Configuration for correct port

### Claude Desktop crashes when using MCP

**Symptoms:** Claude Desktop closes unexpectedly

**Solutions:**

1. **Check Claude Desktop logs:**
   - Windows: `%APPDATA%\Claude\logs\`
   - macOS: `~/Library/Logs/Claude/`
   - Linux: `~/.config/Claude/logs/`

2. **Update Claude Desktop:**
   - Download latest version from Anthropic
   - Install update
   - Try again

3. **MCP server errors:**
   - Check MCP Servers logs for errors
   - Restart MCP system
   - Try Claude Desktop again

---

## Port Conflicts

### "Port already in use" errors

**Symptoms:** Services won't start, logs show port in use

**Solutions:**

1. **Find what's using the port:**

   **Windows:**
   ```cmd
   netstat -ano | findstr :5432
   ```
   - Note the PID (last number)
   - Task Manager → Details tab → End process

   **macOS/Linux:**
   ```bash
   lsof -i :5432
   ```
   - Note the PID
   - `kill <PID>`

2. **Change the port:**
   - Go to Environment Configuration
   - Change the conflicting port number
   - Common alternatives:
     - PostgreSQL: 5433, 5434
     - MCP Connector: 50881, 50882
     - Typing Mind: 3001, 3002
   - Save configuration
   - Restart services

3. **Stop other PostgreSQL instances:**
   - Windows: Services → PostgreSQL → Stop
   - macOS: `brew services stop postgresql`
   - Linux: `sudo systemctl stop postgresql`

### Multiple port conflicts

**Symptoms:** Several ports are in use

**Solutions:**

1. **Use "Check Port" feature:**
   - Go to Environment Configuration
   - App checks each port
   - Shows ✓ (available) or ✗ (in use)
   - Change unavailable ports

2. **Reset to defaults:**
   - Stop all MCP services
   - Stop other apps using common ports
   - Environment Configuration → "Use Defaults"
   - Check all ports are available
   - Save and start services

---

## Update Issues

### Update check fails

**Symptoms:** "Failed to check for updates" message

**Solutions:**

1. **Check internet connection:**
   - Try opening a website
   - Ensure firewall isn't blocking

2. **GitHub access:**
   - Try accessing https://github.com in browser
   - GitHub API may have rate limits
   - Wait a few minutes and try again

3. **Manual check:**
   - Visit [GitHub Releases](https://github.com/RLRyals/MCP-Electron-App/releases)
   - Check for new versions manually

### Update download fails

**Symptoms:** Update starts but fails to complete

**Solutions:**

1. **Network interrupted:**
   - Ensure stable internet connection
   - Try download again

2. **Disk space:**
   - Ensure sufficient free space (5GB+)
   - Clear temp files
   - Try again

3. **Antivirus blocking:**
   - Temporarily disable antivirus
   - Try update again
   - Re-enable antivirus

4. **Manual update:**
   - Download latest installer from GitHub Releases
   - Install manually over existing installation

### Update installs but doesn't work

**Symptoms:** Update completes but app has issues

**Solutions:**

1. **Restart required:**
   - Close app completely
   - Reopen app
   - Check version in Help → About

2. **Services need restart:**
   - Stop system
   - Wait 30 seconds
   - Start system
   - Check services

3. **Clear cache:**
   - Delete cache files:
     - Windows: `%APPDATA%\mcp-electron-app\cache\`
     - macOS: `~/Library/Application Support/mcp-electron-app/cache/`
     - Linux: `~/.config/mcp-electron-app/cache/`
   - Restart app

---

## Performance Issues

### App is slow or laggy

**Solutions:**

1. **Check system resources:**
   - Windows: Task Manager → Performance
   - macOS: Activity Monitor
   - Linux: `htop` or `top`
   - Close other resource-intensive apps

2. **Docker resource allocation:**
   - Docker Desktop → Settings → Resources
   - Allocate more RAM if available (6-8GB recommended)
   - Allocate more CPU cores if available

3. **Restart Docker:**
   - Stop MCP services
   - Quit Docker Desktop
   - Wait 30 seconds
   - Start Docker Desktop
   - Start MCP services

4. **Clear Docker cache:**
   ```bash
   docker system prune
   ```
   - Frees up disk space
   - Removes unused containers and images

### Services take long to start

**Solutions:**

1. **First start is always slower:**
   - Services need to initialize
   - Can take 2-3 minutes on first start
   - Subsequent starts are faster

2. **Check disk I/O:**
   - Slow hard drive can cause delays
   - SSD recommended for better performance

3. **Reduce Docker overhead:**
   - Close other Docker containers
   - Docker Desktop → Settings → Resources
   - Ensure enough resources allocated

---

## Log Files and Diagnostics

### Viewing Logs

**App Logs:**
- Menu: **Diagnostics → View Logs**
- Or: **Diagnostics → Open Logs Directory**

**Locations:**
- Windows: `%APPDATA%\mcp-electron-app\logs\`
- macOS: `~/Library/Logs/mcp-electron-app/`
- Linux: `~/.local/share/mcp-electron-app/logs/`

**Service Logs:**
- Dashboard → Click "View Logs" on service card
- Or use Docker: `docker logs <container-name>`

### Understanding Log Levels

- **INFO:** Normal operations
- **WARN:** Potential issues, not critical
- **ERROR:** Something went wrong
- **DEBUG:** Detailed diagnostic information

### Exporting Diagnostic Report

For bug reports or support:

1. Menu: **Diagnostics → Export Diagnostic Report**
2. Choose save location
3. ZIP file created with:
   - All log files
   - System information
   - Configuration (passwords removed)
   - Docker status
   - Service status

### Testing System

Run comprehensive tests:

1. Menu: **Diagnostics → Test System**
2. App runs all diagnostic tests
3. Results show:
   - Docker status
   - Service connectivity
   - Port availability
   - File permissions
   - Configuration validity

---

## How to Reset and Start Over

### Soft Reset (Keep Settings)

1. Stop all services
2. Restart the app
3. Start services again

### Medium Reset (Reset Configuration)

1. Stop all services
2. Close the app
3. Delete config file:
   - Windows: `%APPDATA%\mcp-electron-app\config.json`
   - macOS: `~/Library/Application Support/mcp-electron-app/config.json`
   - Linux: `~/.config/mcp-electron-app/config.json`
4. Restart app
5. Go through setup wizard again

### Hard Reset (Remove Everything)

**Warning:** This deletes all data, containers, and configuration!

1. Stop all services
2. Close the app
3. Remove Docker containers:
   ```bash
   docker stop $(docker ps -aq)
   docker rm $(docker ps -aq)
   ```
4. Remove Docker volumes:
   ```bash
   docker volume prune
   ```
5. Delete app data:
   - Windows: Delete `%APPDATA%\mcp-electron-app\`
   - macOS: Delete `~/Library/Application Support/mcp-electron-app/`
   - Linux: Delete `~/.config/mcp-electron-app/`
6. Delete MCP working directory:
   - Windows: Delete `%USERPROFILE%\mcp-writing-system\`
   - macOS: Delete `~/mcp-writing-system/`
   - Linux: Delete `~/mcp-writing-system/`
7. Restart app
8. Complete setup wizard from scratch

---

## Getting Additional Help

### Before Asking for Help

1. **Read this guide** - Your issue may be covered above
2. **Check logs** - Error messages provide clues
3. **Export diagnostic report** - You'll need this for bug reports
4. **Try basic troubleshooting** - Restart app, restart Docker

### Where to Get Help

**GitHub Issues:**
- [Create an issue](https://github.com/RLRyals/MCP-Electron-App/issues)
- Use the bug report template
- Attach your diagnostic report
- Describe what you were doing when the issue occurred

**Check Existing Issues:**
- Someone may have had the same problem
- Look for solutions in closed issues

### What to Include in Bug Reports

1. **Description:** What were you trying to do?
2. **Steps to reproduce:** How can we recreate the issue?
3. **Expected behavior:** What should have happened?
4. **Actual behavior:** What actually happened?
5. **Environment:**
   - Operating system and version
   - FictionLab App version
   - Docker Desktop version
6. **Logs:** Export and attach diagnostic report
7. **Screenshots:** If relevant

---

## Common Error Messages

### "ECONNREFUSED" or "Connection refused"

**Meaning:** Can't connect to a service

**Solutions:**
- Check the service is running
- Check the port is correct
- Check firewall isn't blocking

### "EADDRINUSE" or "Address already in use"

**Meaning:** Port is already taken

**Solutions:**
- See "Port Conflicts" section above
- Change port or stop other app using it

### "ENOENT" or "No such file or directory"

**Meaning:** Missing file or folder

**Solutions:**
- File was deleted or moved
- Reinstall the component
- Check file permissions

### "Permission denied" or "EACCES"

**Meaning:** No permission to access file/folder

**Solutions:**
- Run app as administrator (Windows)
- Check file/folder permissions
- Docker user group membership (Linux)

### "Cannot connect to Docker daemon"

**Meaning:** Docker isn't running

**Solutions:**
- Start Docker Desktop
- Check Docker is in system PATH
- Restart Docker service

---

**Still stuck?** Don't hesitate to [create an issue](https://github.com/RLRyals/MCP-Electron-App/issues) - we're here to help!
