#!/bin/bash

# Build Verification Script
# Checks that all required build artifacts are present

echo "🔍 Verifying FictionLab Build"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

# Function to check file/directory exists
check_exists() {
    local path=$1
    local description=$2

    if [ -e "$path" ]; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description (MISSING: $path)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

echo "Checking main process build..."
check_exists "dist/main/index.js" "Main process entry"
check_exists "dist/main/database-admin.js" "Database admin IPC"
check_exists "dist/main/docker.js" "Docker IPC handler"
echo ""

echo "Checking renderer process build..."
check_exists "dist/renderer/renderer.js" "Renderer entry point"
check_exists "dist/renderer/index.html" "Main HTML file"
echo ""

echo "Checking UI components..."
check_exists "dist/renderer/components/TabNavigation.js" "Tab Navigation component"
check_exists "dist/renderer/components/DashboardTab.js" "Dashboard Tab component"
check_exists "dist/renderer/components/DatabaseTab.js" "Database Tab component"
check_exists "dist/renderer/components/ServicesTab.js" "Services Tab component"
check_exists "dist/renderer/components/LogsTab.js" "Logs Tab component"
check_exists "dist/renderer/components/SetupTab.js" "Setup Tab component"
echo ""

echo "Checking Database Admin components..."
check_exists "dist/renderer/components/DatabaseAdmin/CRUD" "CRUD components"
check_exists "dist/renderer/components/DatabaseAdmin/Batch" "Batch components"
check_exists "dist/renderer/components/DatabaseAdmin/Schema" "Schema components"
check_exists "dist/renderer/components/DatabaseAdmin/Backup" "Backup components"
echo ""

echo "Checking styles..."
check_exists "dist/renderer/styles/tabs.css" "Tab styles"
check_exists "dist/renderer/styles/schema.css" "Schema styles"
echo ""

echo "Checking assets..."
check_exists "dist/renderer/icon.png" "Application icon"
check_exists "dist/resources/icon.png" "Resources icon"
echo ""

echo "Checking renderer services..."
check_exists "dist/renderer/services/databaseService.js" "Database service"
echo ""

echo "Checking preload..."
check_exists "dist/preload/preload.js" "Preload script"
echo ""

# Summary
echo "================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ Build verification PASSED${NC}"
    echo "All required files are present."
    echo ""
    echo "Ready to run: npm start"
    exit 0
else
    echo -e "${RED}✗ Build verification FAILED${NC}"
    echo "Missing $ERRORS required file(s)."
    echo ""
    echo "Run: npm run build"
    exit 1
fi
