# Docker MCP Gateway Setup Guide

This guide explains how to connect Claude Desktop to your MCP Writing Servers using Docker Desktop's MCP Toolkit and Gateway.

## Overview

The **Docker MCP Gateway** is a new feature in Docker Desktop that simplifies connecting Claude Desktop to MCP servers running in Docker containers. Instead of manually configuring `claude_desktop_config.json`, the gateway acts as a central router that automatically manages the connection.

### Architecture

```
Claude Desktop
    ↓
Docker MCP Gateway (auto-configured)
    ↓
Your Docker Containers
    ├─ MCP Writing Servers (ports 3001-3009)
    ├─ PostgreSQL Database
    └─ MCP Connector (port 50880)
```

### Benefits

- ✅ **Automatic Configuration**: No need to manually edit config files
- ✅ **Secure Connection**: Gateway manages authentication and routing
- ✅ **Reproducible**: Works consistently across different machines
- ✅ **Real-time Updates**: Changes to containers are automatically reflected
- ✅ **Multi-client Support**: Same gateway can serve multiple AI clients

## Prerequisites

Before you begin, ensure you have:

1. **Docker Desktop** (version 4.27.0 or later with MCP Toolkit support)
   - Download: https://www.docker.com/products/docker-desktop/
   - Must be running and signed in

2. **Claude Desktop** (latest version)
   - Download: https://www.anthropic.com/claude
   - Requires Anthropic account (free or paid)

3. **MCP Electron App** (this application)
   - MCP Writing Servers must be built and ready to start
   - Database and containers should be set up

## Step-by-Step Setup

### Step 1: Install Docker Desktop with MCP Toolkit

1. Download and install Docker Desktop from https://www.docker.com/products/docker-desktop/
2. Launch Docker Desktop
3. Sign in with your Docker account (create one if needed)
4. Verify MCP Toolkit is available:
   - Open a terminal
   - Run: `docker mcp --version`
   - You should see version information

**Troubleshooting:**
- If `docker mcp` is not recognized, you may need to update Docker Desktop
- Ensure you're using Docker Desktop 4.27.0 or later
- On Windows, you may need to restart your terminal after installation

### Step 2: Install Claude Desktop

1. Download Claude Desktop from https://www.anthropic.com/claude
2. Install it on your computer
3. Launch Claude Desktop
4. Sign in with your Anthropic account
5. Close Claude Desktop (you'll restart it later)

### Step 3: Configure Docker Desktop

1. Open Docker Desktop
2. Click the **Settings** icon (gear icon in the top-right)
3. Navigate to **Resources → MCP Toolkit** (or similar - exact menu location may vary)
4. Select **"Claude Desktop"** as your MCP client
5. Click **"Apply & Restart"**
6. Wait for Docker Desktop to restart

**Note:** The exact location of the MCP Toolkit settings may vary depending on your Docker Desktop version. Look for:
- Settings → AI/MCP section
- Settings → Resources → MCP
- Settings → Extensions → MCP

### Step 4: Start Your MCP Writing System

Use the MCP Electron App to start your services:

1. Open the **MCP Electron App**
2. Click **"Start System"** button
3. Wait for all services to show **"healthy"** status:
   - ✅ PostgreSQL (port 5432)
   - ✅ MCP Connector (port 50880)
   - ✅ MCP Writing Servers (ports 3001-3009)
   - ✅ TypingMind (port 8080) - if installed

4. Verify all containers are running:
   ```bash
   docker ps
   ```

You should see containers named:
- `writing-postgres`
- `mcp-connector`
- `mcp-writing-servers`
- `typingmind` (if installed)

### Step 5: Start the Docker MCP Gateway

The gateway is the bridge between Claude Desktop and your MCP servers.

**Option A: Using the MCP Electron App (Recommended)**

1. In the MCP Electron App, go to the **Claude Desktop** section
2. Click **"Start Docker MCP Gateway"**
3. Wait for the status to show **"Gateway Running"**

**Option B: Using Terminal**

Open a terminal and run:

```bash
docker mcp gateway run
```

This command will:
- Start the MCP Gateway service in the background
- Automatically detect your running MCP containers
- Create a connection endpoint for Claude Desktop
- Keep running until you stop it

**Expected Output:**
```
Starting Docker MCP Gateway...
Gateway listening on unix socket
Connected to 9 MCP servers
Ready for Claude Desktop connection
```

**Note:** The gateway runs in the background. You can close the terminal window - it will keep running.

### Step 6: Restart Claude Desktop

This is **critical** - Claude Desktop must be restarted after the gateway starts:

1. **Completely close Claude Desktop**:
   - On Mac: Quit from the menu bar (Claude → Quit)
   - On Windows: Right-click system tray icon → Exit
   - On Linux: Close all windows and check for background processes

2. **Wait 5 seconds**

3. **Reopen Claude Desktop**

4. **Wait 10-15 seconds** for the MCP connection to initialize

### Step 7: Verify the Connection

#### Method 1: Check Claude Desktop Settings

1. Open Claude Desktop
2. Go to **Settings** or **Preferences** (depends on version)
3. Look for an **MCP** or **Integrations** section
4. Verify you see **"MCP_DOCKER"** listed
5. Status should show **"Connected"** or **"Active"**

#### Method 2: Check Configuration File

You can verify the configuration was created:

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

Open this file and look for:
```json
{
  "mcpServers": {
    "MCP_DOCKER": {
      "command": "docker",
      "args": ["mcp", "gateway", "stdio"],
      "env": {}
    }
  }
}
```

#### Method 3: Test in a Conversation

1. Start a new conversation in Claude Desktop
2. Try these test prompts:

   **Test 1: List available servers**
   ```
   What MCP servers are available?
   ```

   **Test 2: Query the database**
   ```
   Can you check if the book_planning database table exists?
   ```

   **Test 3: Use a specific server**
   ```
   Use the book-planning server to create a new book outline
   ```

**Expected Response:**
- Claude should acknowledge the MCP servers
- It should list the 9 writing servers (book-planning, series-planning, etc.)
- It should be able to interact with your database

## Using Claude Desktop with Your MCP Servers

Once connected, you can interact with all your MCP Writing Servers:

### Available Servers

Your Claude Desktop now has access to:

1. **book-planning** (port 3001) - Book structure and planning
2. **series-planning** (port 3002) - Series-level planning
3. **chapter-planning** (port 3003) - Chapter outlines
4. **character-planning** (port 3004) - Character development
5. **scene** (port 3005) - Scene management
6. **core-continuity** (port 3006) - Story continuity tracking
7. **review** (port 3007) - Content review and feedback
8. **reporting** (port 3008) - Analytics and reports
9. **author** (port 3009) - Author profile management

### Example Prompts

**Book Planning:**
```
Create a new book outline for a fantasy novel about a magical library
```

**Character Development:**
```
Help me develop a character profile for the protagonist
```

**Scene Writing:**
```
I need help writing a dramatic confrontation scene between the hero and villain
```

**Continuity Check:**
```
Review my story for any continuity errors or plot holes
```

## Troubleshooting

### Gateway Won't Start

**Symptoms:** `docker mcp gateway run` fails or times out

**Solutions:**

1. **Ensure Docker Desktop is running:**
   ```bash
   docker --version
   docker ps
   ```

2. **Check if gateway is already running:**
   ```bash
   docker mcp gateway status
   ```

3. **Stop existing gateway and restart:**
   ```bash
   docker mcp gateway stop
   docker mcp gateway run
   ```

4. **Check Docker Desktop logs:**
   - Open Docker Desktop
   - Go to Settings → Troubleshoot
   - View logs for MCP-related errors

### Claude Desktop Doesn't Show MCP_DOCKER

**Symptoms:** Settings show no MCP servers or MCP_DOCKER is missing

**Solutions:**

1. **Verify gateway is running:**
   ```bash
   docker mcp gateway status
   ```
   Should show "running"

2. **Completely restart Claude Desktop:**
   - Close ALL Claude windows
   - Check Task Manager (Windows) or Activity Monitor (Mac) for Claude processes
   - Kill any remaining Claude processes
   - Wait 10 seconds
   - Reopen Claude Desktop

3. **Check the configuration file:**
   - Location varies by OS (see Step 7 above)
   - Verify it contains the MCP_DOCKER entry
   - If missing, the gateway may not have configured it properly

4. **Manually trigger configuration:**
   ```bash
   docker mcp gateway stop
   docker mcp gateway run
   ```
   Then restart Claude Desktop

### MCP Servers Show as Unavailable

**Symptoms:** Claude Desktop connects but can't access servers

**Solutions:**

1. **Verify MCP containers are running:**
   ```bash
   docker ps | grep mcp
   ```
   Should show:
   - `mcp-connector`
   - `mcp-writing-servers`

2. **Check container health:**
   ```bash
   docker inspect mcp-writing-servers | grep -A 5 Health
   ```

3. **Restart MCP services via the app:**
   - Open MCP Electron App
   - Click "Stop System"
   - Wait 5 seconds
   - Click "Start System"
   - Wait for all services to be healthy

4. **Check container logs:**
   ```bash
   docker logs mcp-writing-servers
   docker logs mcp-connector
   ```

5. **Verify ports are accessible:**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:50880/health
   ```

### Connection Drops or Becomes Unstable

**Symptoms:** MCP works initially but stops responding

**Solutions:**

1. **Check Docker Desktop is still running:**
   - Docker Desktop sometimes goes to sleep
   - Open Docker Desktop to wake it up

2. **Restart the gateway:**
   ```bash
   docker mcp gateway stop
   docker mcp gateway run
   ```

3. **Check system resources:**
   - Docker containers need adequate RAM and CPU
   - Close unnecessary applications
   - Check Docker Desktop resource limits in Settings

4. **Review Docker logs:**
   ```bash
   docker logs mcp-writing-servers --tail 50
   ```

### Firewall or Network Issues

**Symptoms:** Gateway runs but Claude can't connect

**Solutions:**

1. **Check firewall settings:**
   - Windows: Allow Docker Desktop through Windows Firewall
   - Mac: System Preferences → Security → Firewall → Allow Docker
   - Linux: Check iptables rules

2. **Verify no VPN interference:**
   - Some VPNs block local Docker connections
   - Try disabling VPN temporarily

3. **Check antivirus software:**
   - Some antivirus programs block Docker socket connections
   - Add Docker Desktop to exclusions

## Stopping the Gateway

When you're done using Claude Desktop with your MCP servers:

**Option 1: Via MCP Electron App**
1. Open the app
2. Go to Claude Desktop section
3. Click "Stop Gateway"

**Option 2: Via Terminal**
```bash
docker mcp gateway stop
```

**Note:** Your MCP Writing Servers will continue running. This only stops the gateway connection to Claude Desktop.

## Using Both TypingMind and Claude Desktop

You can use both AI clients simultaneously! They both connect to the same MCP servers and database:

### Setup Both Clients

1. **TypingMind**: Accessed via browser at `http://localhost:8080`
   - Connects via MCP Connector (port 50880)
   - Configuration is automatic

2. **Claude Desktop**: Native app
   - Connects via Docker MCP Gateway
   - Configuration managed by Docker

### Benefits of Using Both

- **Different interfaces** for different tasks
- **Shared data** - same database and servers
- **Independent** - one can run while the other is closed
- **Same features** - all 9 MCP servers available in both

### Switching Between Clients

No special setup needed - just open whichever client you want to use. Your data and settings are shared through the PostgreSQL database.

## Advanced Configuration

### Custom Gateway Settings

The gateway can be configured with environment variables:

```bash
# Custom gateway port
export MCP_GATEWAY_PORT=8765
docker mcp gateway run

# Enable debug logging
export MCP_GATEWAY_DEBUG=true
docker mcp gateway run
```

### Running Gateway as Background Service

**Linux/Mac (systemd):**

Create `/etc/systemd/system/docker-mcp-gateway.service`:

```ini
[Unit]
Description=Docker MCP Gateway
After=docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/local/bin/docker mcp gateway run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable docker-mcp-gateway
sudo systemctl start docker-mcp-gateway
```

**Windows (Task Scheduler):**

1. Open Task Scheduler
2. Create new task
3. Trigger: At startup
4. Action: `docker mcp gateway run`
5. Conditions: Start only if Docker Desktop is running

### Monitoring Gateway Status

Check gateway status programmatically:

```bash
# Status check
docker mcp gateway status

# View logs
docker logs docker-mcp-gateway

# List connected servers
docker mcp gateway servers
```

## Alternative: Manual Configuration

If the Docker MCP Gateway doesn't work for your setup, you can manually configure Claude Desktop. See:
- [Manual Claude Desktop Configuration Guide](./CLAUDE_DESKTOP_MANUAL_CONFIG.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md#claude-desktop-issues)

## Resources

### Official Documentation

- **Docker MCP Toolkit**: https://docs.docker.com/ai/mcp-catalog-and-toolkit/
- **Docker Blog**: https://www.docker.com/blog/connect-mcp-servers-to-claude-desktop-with-mcp-toolkit/
- **Model Context Protocol**: https://modelcontextprotocol.io/
- **Claude Desktop**: https://www.anthropic.com/claude

### MCP Electron App Documentation

- [Quick Start Guide](./QUICK-START.md)
- [User Guide](./USER-GUIDE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [MCP Configuration](./MCP_CONFIGURATION.md)

### Getting Help

If you encounter issues:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review Docker Desktop logs
3. Check MCP Electron App logs
4. Open an issue on GitHub: https://github.com/RLRyals/MCP-Electron-App/issues

## Changelog

- **2025-01-15**: Initial documentation for Docker MCP Gateway integration
