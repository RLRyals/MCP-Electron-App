#!/bin/bash

#
# Export Docker Images Script
# This script exports pre-built Docker images to tar.gz files for bundling with the application
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCES_DIR="resources/docker-images"
POSTGRES_IMAGE="postgres:15"
POSTGRES_FILE="postgres-15.tar.gz"
MCP_SERVERS_IMAGE="mcp-servers:latest"
MCP_SERVERS_FILE="mcp-servers.tar.gz"

# Helper functions
echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_docker() {
    echo_info "Checking if Docker is installed and running..."
    if ! command -v docker &> /dev/null; then
        echo_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! docker ps &> /dev/null; then
        echo_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    echo_success "Docker is ready"
}

check_image() {
    local image=$1
    echo_info "Checking if image '$image' exists..."

    if docker images -q "$image" 2> /dev/null | grep -q .; then
        echo_success "Image '$image' found"
        return 0
    else
        echo_warning "Image '$image' not found locally"
        return 1
    fi
}

pull_image() {
    local image=$1
    echo_info "Pulling image '$image'..."

    if docker pull "$image"; then
        echo_success "Successfully pulled '$image'"
        return 0
    else
        echo_error "Failed to pull '$image'"
        return 1
    fi
}

export_image() {
    local image=$1
    local output_file=$2
    local output_path="$RESOURCES_DIR/$output_file"

    echo_info "Exporting image '$image' to '$output_file'..."

    # Create a temporary file for the tar archive
    local temp_tar="/tmp/${output_file%.gz}"

    # Export the image to tar
    if docker save "$image" -o "$temp_tar"; then
        echo_info "Compressing image..."

        # Compress with gzip and show progress
        if gzip -c "$temp_tar" > "$output_path"; then
            # Clean up temp file
            rm -f "$temp_tar"

            # Get file size
            local size=$(du -h "$output_path" | cut -f1)
            echo_success "Exported '$image' to '$output_file' (${size})"
            return 0
        else
            echo_error "Failed to compress image"
            rm -f "$temp_tar"
            return 1
        fi
    else
        echo_error "Failed to export image '$image'"
        return 1
    fi
}

# Main script
echo ""
echo "=========================================="
echo "  Docker Image Export Script"
echo "=========================================="
echo ""

# Check Docker
check_docker

# Create resources directory if it doesn't exist
if [ ! -d "$RESOURCES_DIR" ]; then
    echo_info "Creating resources directory: $RESOURCES_DIR"
    mkdir -p "$RESOURCES_DIR"
fi

echo ""
echo "------------------------------------------"
echo "Exporting PostgreSQL Image"
echo "------------------------------------------"
echo ""

# Check and pull PostgreSQL image if needed
if ! check_image "$POSTGRES_IMAGE"; then
    if ! pull_image "$POSTGRES_IMAGE"; then
        echo_error "Failed to pull PostgreSQL image. Aborting."
        exit 1
    fi
fi

# Export PostgreSQL image
if ! export_image "$POSTGRES_IMAGE" "$POSTGRES_FILE"; then
    echo_error "Failed to export PostgreSQL image. Aborting."
    exit 1
fi

echo ""
echo "------------------------------------------"
echo "Exporting MCP Servers Image"
echo "------------------------------------------"
echo ""

# Check MCP servers image
if ! check_image "$MCP_SERVERS_IMAGE"; then
    echo_warning "MCP servers image not found."
    echo_info "You need to build the MCP servers image first:"
    echo_info "  docker build -t mcp-servers:latest /path/to/mcp-servers"
    echo ""
    echo_info "Skipping MCP servers export for now."
    echo_warning "You can run this script again after building the image."
else
    # Export MCP servers image
    if ! export_image "$MCP_SERVERS_IMAGE" "$MCP_SERVERS_FILE"; then
        echo_error "Failed to export MCP servers image."
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "  Export Complete"
echo "=========================================="
echo ""

# List exported files
echo_info "Exported files in $RESOURCES_DIR:"
ls -lh "$RESOURCES_DIR"/*.tar.gz 2>/dev/null || echo_warning "No .tar.gz files found"

echo ""
echo_success "Docker image export completed!"
echo_info "These images will be bundled with the application during packaging."
echo ""
