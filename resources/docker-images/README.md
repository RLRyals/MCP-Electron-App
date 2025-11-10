# Docker Images Directory

> **⚠️ FUTURE ENHANCEMENT - NOT CURRENTLY USED**
>
> This directory is reserved for a planned future feature to bundle pre-built Docker images with the application.
>
> **Current Behavior:** The app currently pulls the PostgreSQL image from Docker Hub and builds MCP server images from source code during setup. This directory is not currently used by the application.

---

This directory will contain pre-built Docker images that will be bundled with the application to provide faster, offline installation (planned future enhancement).

## Expected Files (For Future Implementation)

When this feature is implemented, the following Docker images should be placed in this directory before packaging the application:

1. **postgres-15.tar.gz** (or **postgres-16-alpine.tar.gz**) (~150MB)
   - PostgreSQL database image
   - **Current**: Pulled from Docker Hub during setup
   - **Future**: Pre-bundled with installer

2. **mcp-servers.tar.gz** (~200MB)
   - MCP servers custom image
   - **Current**: Built from cloned source code during setup
   - **Future**: Pre-built and bundled with installer

## How to Export Docker Images (For Future Implementation)

When implementing this feature, these image files can be created using:

```bash
# This script is prepared for the future feature
npm run export-docker-images
```

Or manually export using Docker:

```bash
# Export PostgreSQL image
docker pull postgres:15
docker save postgres:15 | gzip > postgres-15.tar.gz

# Export MCP servers image
# Note: Current implementation builds from cloned source, not local Dockerfile
docker build -t mcp-servers:latest .
docker save mcp-servers:latest | gzip > mcp-servers.tar.gz
```

## Build Process (Future Implementation)

When this feature is implemented, during the application packaging process (`npm run package`), these images will be:

1. Verified for existence (warning if missing)
2. Included in the app's resources directory
3. Loaded on first run or when requested by the user

**Current Process:**
- Images are NOT bundled with the installer
- PostgreSQL is pulled from Docker Hub during setup
- MCP servers are built from source during setup

## File Sizes (Future)

The bundled images will add approximately 350MB to the application package size. Users will benefit from:

- Faster installation (no image building required)
- Offline installation support
- Consistent versions across all deployments
- Reduced dependency on external services

## Current Behavior

Currently, this directory is not used. The application:

- ✅ Pulls PostgreSQL from Docker Hub automatically
- ✅ Clones MCP server repositories and builds images
- ✅ Works without any pre-bundled images
- ✅ Provides progress feedback during image preparation

## Notes

- Image files should be compressed with gzip (.tar.gz)
- File names must match exactly as specified above
- Images are loaded using `docker load` command
- Progress is reported during the loading process
