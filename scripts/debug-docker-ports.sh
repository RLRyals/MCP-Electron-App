#!/bin/bash
# Debug Docker Port Conflicts
# This script helps diagnose and fix Docker port conflicts for the MCP system

set -e

echo "🔍 Docker Port Conflict Diagnostic Tool"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "1. Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "   Please start Docker Desktop and try again"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Check for MCP containers
echo "2. Checking for MCP containers..."
MCP_CONTAINERS=$(docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}")
if [ -z "$MCP_CONTAINERS" ]; then
    echo -e "${GREEN}✓ No MCP containers found${NC}"
else
    echo -e "${YELLOW}Found MCP containers:${NC}"
    echo "$MCP_CONTAINERS" | while IFS=$'\t' read -r id name status ports; do
        echo "   Container: $name"
        echo "   ID: $id"
        echo "   Status: $status"
        echo "   Ports: ${ports:-none}"
        echo ""
    done
fi
echo ""

# Check port usage
echo "3. Checking port usage..."
PORTS=(5432 50880 3000)
PORT_NAMES=("PostgreSQL" "MCP Connector" "HTTP/SSE Server")

for i in "${!PORTS[@]}"; do
    PORT="${PORTS[$i]}"
    NAME="${PORT_NAMES[$i]}"

    echo "   Checking port $PORT ($NAME)..."

    # Check host port
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        PROCESS=$(lsof -Pi :$PORT -sTCP:LISTEN | tail -n 1)
        echo -e "   ${RED}⚠ Port $PORT is in use on host:${NC}"
        echo "   $PROCESS"
    else
        echo -e "   ${GREEN}✓ Port $PORT is available on host${NC}"
    fi

    # Check Docker containers using this port
    CONTAINERS_ON_PORT=$(docker ps --format "{{.ID}}\t{{.Names}}\t{{.Ports}}" | grep ":$PORT->" || true)
    if [ ! -z "$CONTAINERS_ON_PORT" ]; then
        echo -e "   ${YELLOW}Docker containers using port $PORT:${NC}"
        echo "$CONTAINERS_ON_PORT" | while IFS=$'\t' read -r id name ports; do
            echo "      $name (ID: $id)"
        done
    fi
    echo ""
done
echo ""

# Check Docker networks
echo "4. Checking Docker networks..."
DOCKER_NETWORKS=$(docker network ls --filter "name=mcp" --format "{{.ID}}\t{{.Name}}")
if [ -z "$DOCKER_NETWORKS" ]; then
    echo -e "${GREEN}✓ No MCP networks found${NC}"
else
    echo -e "${YELLOW}Found MCP networks:${NC}"
    echo "$DOCKER_NETWORKS"
fi
echo ""

# Offer cleanup options
echo "5. Cleanup Options"
echo "=================="
echo ""
if [ ! -z "$MCP_CONTAINERS" ]; then
    echo -e "${YELLOW}Would you like to clean up MCP containers? (y/n)${NC}"
    read -r CLEANUP
    if [ "$CLEANUP" = "y" ] || [ "$CLEANUP" = "Y" ]; then
        echo "Stopping MCP containers..."
        docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q | xargs -r docker stop
        echo "Removing MCP containers..."
        docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q | xargs -r docker rm -f
        echo -e "${GREEN}✓ Cleanup complete${NC}"

        # Wait for ports to be released
        echo "Waiting 3 seconds for ports to be released..."
        sleep 3

        echo ""
        echo "6. Re-checking port status..."
        for i in "${!PORTS[@]}"; do
            PORT="${PORTS[$i]}"
            NAME="${PORT_NAMES[$i]}"

            if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
                echo -e "   ${RED}⚠ Port $PORT ($NAME) is still in use${NC}"
            else
                echo -e "   ${GREEN}✓ Port $PORT ($NAME) is now available${NC}"
            fi
        done
    fi
else
    echo -e "${GREEN}No cleanup needed - no MCP containers found${NC}"
fi

echo ""
echo "=========================================="
echo "Diagnostic complete!"
echo ""
echo "If you're still experiencing port conflicts:"
echo "1. Restart Docker Desktop"
echo "2. Run this script again"
echo "3. Check for other applications using ports 5432, 50880, or 3000"
echo ""
