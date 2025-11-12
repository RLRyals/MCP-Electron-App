#!/bin/bash
set -e

#
# MCP Writing System - Custom Connector Entrypoint
# This script launches the MCP Connector with the mcp-config.json file
# as recommended by TypingMind
#

echo "=========================================="
echo "MCP Writing System - Starting with Config"
echo "=========================================="

# Validate required environment variables
if [ -z "$MCP_AUTH_TOKEN" ]; then
  echo "ERROR: MCP_AUTH_TOKEN environment variable is required"
  exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "ERROR: POSTGRES_PASSWORD environment variable is required"
  exit 1
fi

# Set default values for optional environment variables
HTTP_SSE_PORT=${HTTP_SSE_PORT:-3000}
MCP_CONNECTOR_PORT=${MCP_CONNECTOR_PORT:-50880}
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_USER=${POSTGRES_USER:-writer}
POSTGRES_DB=${POSTGRES_DB:-mcp_writing_db}

echo "Environment Configuration:"
echo "  - HTTP/SSE Port: $HTTP_SSE_PORT"
echo "  - MCP Connector Port: $MCP_CONNECTOR_PORT"
echo "  - PostgreSQL Host: $POSTGRES_HOST"
echo "  - PostgreSQL Database: $POSTGRES_DB"
echo ""

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; then
    echo "✓ PostgreSQL is ready"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "  Attempt $RETRY_COUNT/$MAX_RETRIES - PostgreSQL not ready yet, waiting..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: PostgreSQL did not become ready in time"
  exit 1
fi

# Start HTTP/SSE Server in the background
echo ""
echo "Starting HTTP/SSE Server on port $HTTP_SSE_PORT..."
HTTP_SSE_PORT=$HTTP_SSE_PORT node /app/src/http-sse-server.js &
HTTP_SSE_PID=$!

# Give the HTTP/SSE server a moment to start
sleep 3

# Verify HTTP/SSE server is running
if ! ps -p $HTTP_SSE_PID > /dev/null; then
  echo "ERROR: HTTP/SSE Server failed to start"
  exit 1
fi

echo "✓ HTTP/SSE Server started (PID: $HTTP_SSE_PID)"

# Start MCP Connector with config file
echo ""
echo "Starting MCP Connector on port $MCP_CONNECTOR_PORT..."

# Check if mcp-config.json exists
if [ -f "/app/mcp-config.json" ]; then
  echo "✓ Using MCP config file: /app/mcp-config.json"

  # Show config file contents for debugging
  echo "Config file contents:"
  cat /app/mcp-config.json | head -20
  echo ""

  # Launch connector with config file
  exec npx @typingmind/mcp@latest "$MCP_AUTH_TOKEN" --config /app/mcp-config.json
else
  echo "⚠ MCP config file not found at /app/mcp-config.json"
  echo "  Falling back to default connector mode (no config file)"

  # Launch connector without config file (fallback mode)
  exec npx @typingmind/mcp@latest "$MCP_AUTH_TOKEN"
fi
