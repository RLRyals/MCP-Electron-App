#!/bin/bash

# Quick Start Script for FictionLab Development
# Ensures environment is ready and starts the app

set -e  # Exit on error

echo "🚀 FictionLab Quick Start"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if session start hook exists and run it
if [ -f ".claude/hooks/session-start.sh" ]; then
    echo "Running session start hook..."
    bash .claude/hooks/session-start.sh

    if [ $? -ne 0 ]; then
        echo -e "${RED}Environment setup failed. Please check errors above.${NC}"
        exit 1
    fi
else
    # Fallback: Basic checks
    echo "Checking environment..."

    # Check for dist directory
    if [ ! -d "dist" ] || [ ! -d "dist/renderer/components" ]; then
        echo -e "${YELLOW}Build needed. Running npm run build...${NC}"
        npm run build

        if [ $? -ne 0 ]; then
            echo -e "${RED}Build failed!${NC}"
            exit 1
        fi
    fi

    echo -e "${GREEN}✓ Environment ready${NC}"
fi

echo ""
echo "Starting FictionLab..."
echo ""

# Start the application
npm start
