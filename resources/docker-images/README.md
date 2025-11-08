# Docker Images Directory

This directory contains pre-built Docker images that are bundled with the application to avoid building on the user's machine.

## Expected Files

The following Docker images should be placed in this directory before packaging the application:

1. **postgres-15.tar.gz** (~150MB)
   - PostgreSQL 15 database image
   - Source: `postgres:15`

2. **mcp-servers.tar.gz** (~200MB)
   - MCP servers custom image
   - Source: `mcp-servers:latest`

## How to Export Docker Images

To create these image files for bundling, run the export script:

```bash
npm run export-docker-images
```

Or manually export using Docker:

```bash
# Export PostgreSQL image
docker pull postgres:15
docker save postgres:15 | gzip > postgres-15.tar.gz

# Export MCP servers image (after building)
docker build -t mcp-servers:latest .
docker save mcp-servers:latest | gzip > mcp-servers.tar.gz
```

## Build Process

During the application packaging process (`npm run package`), these images will be:

1. Verified for existence (warning if missing)
2. Included in the app's resources directory
3. Loaded on first run or when requested by the user

## File Sizes

The bundled images will add approximately 350MB to the application package size. Users will benefit from:

- Faster installation (no image building required)
- Offline installation support
- Consistent versions across all deployments
- No need for Docker Hub access

## Development

During development, if these files are not present:

- The application will still run
- Image loading will fail gracefully
- Users will need to pull/build images manually
- Warnings will be logged

## Production

For production builds:

1. Ensure both image files exist in this directory
2. Verify file sizes are reasonable
3. Test image loading after packaging
4. Consider hosting images separately for very large deployments

## Notes

- Image files should be compressed with gzip (.tar.gz)
- File names must match exactly as specified above
- Images are loaded using `docker load` command
- Progress is reported during the loading process
