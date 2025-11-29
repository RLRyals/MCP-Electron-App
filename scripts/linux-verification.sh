#!/bin/bash

echo "=== Linux Verification Script ==="
echo "Running on: $(uname -a)"

if [ -n "$APPIMAGE" ]; then
    echo "✅ Running inside AppImage: $APPIMAGE"
    echo "AppImage Mount Point: $APPDIR"
else
    echo "ℹ️ Not running inside AppImage (or APPIMAGE env var not set)"
fi

# Check for resources path logic simulation
echo ""
echo "Checking path resolution logic..."

# Simulate the logic used in the app
if [ -n "$APPDIR" ]; then
    RESOURCES_PATH="$APPDIR/resources"
    echo "Expected resources path: $RESOURCES_PATH"
    
    if [ -d "$RESOURCES_PATH" ]; then
        echo "✅ Resources directory exists at expected location"
    else
        echo "❌ Resources directory NOT found at $RESOURCES_PATH"
    fi
    
    DOCKER_COMPOSE="$RESOURCES_PATH/docker-compose.yml"
    if [ -f "$DOCKER_COMPOSE" ]; then
        echo "✅ docker-compose.yml found at $DOCKER_COMPOSE"
    else
        # Try alternative location (sometimes it's in app/resources or similar depending on builder config)
        echo "⚠️ docker-compose.yml not found at $DOCKER_COMPOSE"
        echo "Checking alternative locations..."
        
        find "$APPDIR" -name "docker-compose.yml"
    fi
else
    echo "Skipping AppImage specific checks."
fi

echo ""
echo "=== Docker Mount Path Checks ==="
# These are the paths the app will try to validate/create
# Adjust these paths based on where the app is actually running/installed if needed
USER_DATA_DIR="$HOME/.config/FictionLab"
MCP_REPO_DIR="$USER_DATA_DIR/repositories/mcp-writing-servers"
TYPING_MIND_DIR="$USER_DATA_DIR/repositories/typing-mind/src"

echo "Checking if application directories exist (after running the app):"
if [ -d "$MCP_REPO_DIR" ]; then
    echo "✅ MCP Repository Directory exists: $MCP_REPO_DIR"
else
    echo "❌ MCP Repository Directory does NOT exist: $MCP_REPO_DIR"
fi

if [ -d "$TYPING_MIND_DIR" ]; then
    echo "✅ Typing Mind Directory exists: $TYPING_MIND_DIR"
else
    echo "❌ Typing Mind Directory does NOT exist: $TYPING_MIND_DIR"
fi

echo ""
echo "=== Instructions ==="
echo "1. Run the AppImage: ./FictionLab-*.AppImage"
echo "2. Watch the logs for 'Using Linux resourcesPath'"
echo "3. Run this script again to verify directories were created"
