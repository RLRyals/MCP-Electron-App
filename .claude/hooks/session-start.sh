#!/bin/bash

# FictionLab Session Start Hook
# Prepares the development environment for AI agents and developers

echo "🚀 FictionLab Development Environment Setup"
echo "==========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Not in FictionLab root directory!"
    exit 1
fi

# 1. Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null || echo "not found")
if [ "$NODE_VERSION" = "not found" ]; then
    print_error "Node.js is not installed!"
    echo "  Please install Node.js 18+ from https://nodejs.org/"
    exit 1
else
    print_success "Node.js version: $NODE_VERSION"
fi

# 2. Check for node_modules
print_status "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Dependencies may need installation."
    echo "  Note: npm install may fail for electron in sandboxed environments"
    echo "  The project can still build with existing dependencies"
else
    print_success "node_modules directory exists"
fi

# 3. Check for critical type definitions
print_status "Checking TypeScript type definitions..."
if [ ! -d "node_modules/@types/node" ]; then
    print_warning "@types/node is missing - required for TypeScript compilation"
    echo "  Attempting to install @types/node manually..."

    # Try to install just the types we need
    mkdir -p node_modules/@types
    if command -v curl &> /dev/null; then
        cd node_modules/@types
        curl -sL https://registry.npmjs.org/@types/node/-/node-20.19.25.tgz | tar xz
        if [ -d "package" ]; then
            mv package node
            print_success "Installed @types/node manually"
        else
            # Handle directory name variations
            for dir in node*; do
                if [ -d "$dir" ] && [ "$dir" != "node" ]; then
                    mv "$dir" node 2>/dev/null && print_success "Installed @types/node manually" && break
                fi
            done
        fi
        cd ../..
    else
        print_error "curl not available - cannot auto-install @types/node"
        echo "  Build may fail. Install manually or ensure npm install completes."
    fi
else
    print_success "@types/node is installed"
fi

# 4. Check if build is needed
print_status "Checking build status..."
BUILD_NEEDED=false

if [ ! -d "dist" ]; then
    print_warning "dist/ directory not found - build required"
    BUILD_NEEDED=true
elif [ ! -d "dist/renderer/components" ]; then
    print_warning "Renderer components not compiled - build required"
    BUILD_NEEDED=true
elif [ ! -f "dist/renderer/styles/tabs.css" ]; then
    print_warning "CSS assets not copied - build required"
    BUILD_NEEDED=true
else
    print_success "Build artifacts exist"

    # Check if source is newer than build
    if [ -n "$(find src -type f -newer dist/renderer/renderer.js 2>/dev/null | head -1)" ]; then
        print_warning "Source files are newer than build - rebuild recommended"
        BUILD_NEEDED=true
    fi
fi

# 5. Run build if needed
if [ "$BUILD_NEEDED" = true ]; then
    print_status "Building project..."
    echo ""

    # Build TypeScript
    print_status "Compiling TypeScript (main)..."
    npx tsc -p tsconfig.main.json 2>&1 | grep -v "^$"

    print_status "Compiling TypeScript (renderer)..."
    npx tsc -p tsconfig.renderer.json 2>&1 | grep -v "^$"

    # Copy assets
    print_status "Copying assets..."
    node scripts/copy-assets.js

    echo ""
    if [ -d "dist/renderer/components" ]; then
        print_success "Build completed successfully!"
    else
        print_error "Build failed - check errors above"
        exit 1
    fi
else
    print_success "Build is up to date"
fi

# 6. Display project status
echo ""
echo "📊 Project Status"
echo "================="
echo ""

# Check for Docker
if command -v docker &> /dev/null; then
    DOCKER_STATUS=$(docker info &> /dev/null && echo "running" || echo "not running")
    if [ "$DOCKER_STATUS" = "running" ]; then
        print_success "Docker: Running"
    else
        print_warning "Docker: Installed but not running"
    fi
else
    print_warning "Docker: Not installed (required for running the app)"
fi

# Check for Git
if command -v git &> /dev/null; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    print_success "Git: Available (branch: $CURRENT_BRANCH)"
else
    print_warning "Git: Not available"
fi

# Show key paths
echo ""
echo "📁 Key Directories"
echo "=================="
echo "  Source:       src/"
echo "  Compiled:     dist/"
echo "  Components:   src/renderer/components/"
echo "  Styles:       src/renderer/styles/"
echo "  Main process: src/main/"
echo "  Services:     src/services/"
echo ""

# Show useful commands
echo "🛠️  Useful Commands"
echo "===================="
echo "  npm run build     - Rebuild the application"
echo "  npm run dev       - Build and run in development"
echo "  npm start         - Start the application"
echo "  npm run clean     - Clean build artifacts"
echo ""

# Check for common issues
echo "⚠️  Known Issues"
echo "================"
if [ ! -d "node_modules/@types/node" ]; then
    echo "  • @types/node missing - TypeScript build will fail"
fi
if [ ! -f "dist/renderer/styles/tabs.css" ]; then
    echo "  • Tab styles not copied - UI will look broken"
fi
if [ ! -d "node_modules" ]; then
    echo "  • node_modules missing - run: npm install"
fi

echo ""
print_success "Environment ready for development!"
echo ""
echo "💡 Tip: This project uses Electron + TypeScript + MCP servers"
echo "   See README.md for architecture details"
echo ""
