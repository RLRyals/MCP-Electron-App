# Database Error Fix - Setup Guide

This document explains how to fix the database connection errors you encountered.

## Errors Fixed

1. **Docker logs**: `FATAL: database "writer" does not exist`
2. **Claude Desktop**: `Error executing list_authors: Failed to list authors: connect ECONNREFUSED ::1:6432`
3. **Typing Mind**: Not opening

## Root Causes

1. **Missing .env file** - Docker Compose couldn't load environment variables
2. **Incorrect PgBouncer configuration** - Using wrong environment variable format
3. **Wrong database initialization path** - init.sql was pointing to wrong location

## What Was Changed

### 1. Created `.env` file
- Copied from `.env.test` with Linux-compatible paths
- **IMPORTANT**: You need to update this file with your actual paths and credentials

### 2. Fixed PgBouncer Configuration
- Created `pgbouncer.ini` with proper database configuration
- Created `userlist.txt` for authentication
- Updated `docker-compose.yml` to mount these files

### 3. Fixed Database Initialization
- Updated `docker-compose.yml` to use local `./init.sql` instead of external path

### 4. Created Setup Script
- `setup-pgbouncer.sh` - Automatically generates correct password hashes

## Setup Instructions

### Step 1: Create and Configure .env File

First, create your `.env` file from the example:

```bash
cd /home/user/MCP-Electron-App
cp .env.example .env
```

Then edit `.env` and update these values:

```bash
# MCP_WRITING_SERVERS_DIR - The Electron app automatically clones this repo to:
# - Linux: ~/.config/mcp-electron-app/repositories/mcp-writing-servers
# - macOS: ~/Library/Application Support/mcp-electron-app/repositories/mcp-writing-servers
# - Windows: %APPDATA%\mcp-electron-app\repositories\mcp-writing-servers
#
# The default .env is already configured for Linux.
# Only change this if you're using a different location or OS.

# REQUIRED: Set a secure password
POSTGRES_PASSWORD=your_secure_password_here

# Optional: Update TypingMind path if you have it
TYPING_MIND_DIR=/path/to/typingmind

# REQUIRED: Set a secure auth token
MCP_AUTH_TOKEN=your-secure-token-here
```

**Important Notes:**
- The MCP-Writing-Servers repository is **automatically cloned** by the Electron app on first run
- The `.env` file already points to the correct location for Linux: `~/.config/mcp-electron-app/repositories/mcp-writing-servers`
- If the repo hasn't been cloned yet, you can either:
  1. Run the Electron app first (it will clone it automatically), OR
  2. Manually create the directory structure and clone it yourself

### Step 2: Run Setup Script

```bash
cd /home/user/MCP-Electron-App
./setup-pgbouncer.sh
```

This script will:
- Validate your .env file exists
- Generate the correct MD5 password hash for PgBouncer
- Update `userlist.txt` with the hash
- Update `pgbouncer.ini` with the correct database name

### Step 3: Start Services

```bash
docker-compose down  # Stop any existing containers
docker-compose up -d  # Start all services
```

### Step 4: Verify Services

Check that all services are running:

```bash
docker-compose ps
```

You should see:
- `writing-postgres` - healthy
- `writing-pgbouncer` - running
- `mcp-writing-servers` - running
- `mcp-connector` - running (if MCP_WRITING_SERVERS_DIR exists)
- `typingmind` - running (if TYPING_MIND_DIR exists)

### Step 5: Test Database Connection

Test PostgreSQL directly:
```bash
docker exec -it writing-postgres psql -U postgres -d writing_db -c "SELECT 1;"
```

Test PgBouncer:
```bash
docker exec -it writing-postgres psql -h localhost -p 6432 -U postgres -d writing_db -c "SELECT 1;"
```

### Step 6: Test MCP Servers

If you have MCP-Writing-Servers set up:
```bash
curl http://localhost:3001/health
```

## Troubleshooting

### Issue: "MCP_WRITING_SERVERS_DIR not found"

The Electron app automatically clones MCP-Writing-Servers on first run. If you want to use Docker services before running the Electron app:

**Option 1: Run the Electron app first (Recommended)**
```bash
# The app will automatically clone the repo to the correct location
# Then start Docker services
./setup-pgbouncer.sh
docker-compose up -d
```

**Option 2: Manually clone the repository**
```bash
# Create the directory structure
mkdir -p ~/.config/mcp-electron-app/repositories

# Clone the repo
git clone https://github.com/RLRyals/MCP-Writing-Servers.git \
  ~/.config/mcp-electron-app/repositories/mcp-writing-servers

# The .env file is already configured with this path
# Run setup
./setup-pgbouncer.sh
docker-compose up -d
```

**Option 3: Use a custom location**
```bash
# Clone it to any location you prefer
git clone https://github.com/RLRyals/MCP-Writing-Servers.git /your/custom/path

# Update .env with your custom path
sed -i 's|MCP_WRITING_SERVERS_DIR=.*|MCP_WRITING_SERVERS_DIR=/your/custom/path|' .env

# Run setup
./setup-pgbouncer.sh
docker-compose up -d
```

### Issue: "Port already in use"

Check what's using the ports:
```bash
sudo lsof -i :5432  # PostgreSQL
sudo lsof -i :6432  # PgBouncer
```

Stop conflicting services or change ports in docker-compose.yml.

### Issue: "Password authentication failed"

1. Make sure you ran `setup-pgbouncer.sh` after updating the .env file
2. Check that userlist.txt was generated correctly:
   ```bash
   cat userlist.txt
   ```
3. Restart the pgbouncer service:
   ```bash
   docker-compose restart pgbouncer
   ```

### Issue: "Database does not exist"

The database is created automatically from init.sql. If it's not created:

1. Check PostgreSQL logs:
   ```bash
   docker logs writing-postgres
   ```

2. Manually create it:
   ```bash
   docker exec -it writing-postgres psql -U postgres -c "CREATE DATABASE writing_db;"
   ```

## Claude Desktop Configuration

To fix the Claude Desktop connection:

1. The database should now be accessible on `localhost:6432`
2. Use this connection string:
   ```
   postgresql://postgres:YOUR_PASSWORD@localhost:6432/writing_db
   ```

3. Make sure Claude Desktop is configured to use the correct port (6432, not 5432)

## Next Steps

Once everything is working:

1. Test creating an author:
   ```bash
   docker exec -it writing-postgres psql -U postgres -d writing_db -c "INSERT INTO authors (name, email) VALUES ('Test Author', 'test@example.com');"
   ```

2. Test listing authors through MCP:
   - Use Claude Desktop with the configured MCP server
   - Run: "List all authors"

3. Test TypingMind:
   - Open http://localhost:8080 in your browser
   - Connect to the MCP server

## Files Changed

- ✅ `.env` - Created from .env.test
- ✅ `pgbouncer.ini` - Created with proper configuration
- ✅ `userlist.txt` - Created (will be regenerated by setup script)
- ✅ `docker-compose.yml` - Fixed pgbouncer and postgres volumes
- ✅ `setup-pgbouncer.sh` - Created for easy setup

## Need Help?

If you're still having issues:

1. Check the logs:
   ```bash
   docker-compose logs -f
   ```

2. Check specific service logs:
   ```bash
   docker logs writing-postgres
   docker logs writing-pgbouncer
   docker logs mcp-writing-servers
   ```

3. Verify your .env file has correct values:
   ```bash
   cat .env
   ```
