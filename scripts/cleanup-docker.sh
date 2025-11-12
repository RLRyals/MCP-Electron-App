#!/bin/bash
# MCP Docker Cleanup Script
# This script helps resolve Docker port conflicts by stopping and removing ONLY MCP-related containers
#
# IMPORTANT: This script ONLY affects containers with names starting with:
#   - mcp-
#   - typing-mind-
#
# Other Docker containers on your system will NOT be affected.

echo "MCP Docker Cleanup Script"
echo "========================="
echo ""
echo "⚠️  WARNING: This will stop and remove MCP-related containers only."
echo "    Other Docker containers will NOT be affected."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "🔍 Finding MCP-related containers..."
CONTAINERS=$(docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" --format "{{.Names}}")

if [ -z "$CONTAINERS" ]; then
    echo "✅ No MCP containers found. System is clean."
    exit 0
fi

echo "Found containers:"
echo "$CONTAINERS"
echo ""

# Stop containers
echo "🛑 Stopping containers..."
docker stop $(docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q) 2>/dev/null
echo "✅ Containers stopped"

# Remove containers
echo "🗑️  Removing containers..."
docker rm $(docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q) 2>/dev/null
echo "✅ Containers removed"

# Optional: Clean up volumes (uncomment if needed)
# echo "🗑️  Removing volumes..."
# docker volume rm $(docker volume ls -q --filter "name=mcp-" --filter "name=postgres-data") 2>/dev/null
# echo "✅ Volumes removed"

echo ""
echo "✅ Cleanup complete! You can now restart the MCP system."
