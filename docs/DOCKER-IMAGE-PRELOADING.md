# Docker Image Pre-loading System

> **⚠️ FUTURE ENHANCEMENT - NOT CURRENTLY IMPLEMENTED**
>
> This document describes a planned future feature for pre-loading bundled Docker images with the application installer.
>
> **Current Behavior:** The app currently pulls the PostgreSQL image from Docker Hub and builds MCP server images from source code during setup.
>
> **Future Enhancement:** This document outlines the design for bundling pre-built Docker images as tar.gz files with the application to provide faster, offline installation.

---

This document describes the Docker image pre-loading system planned for the MCP Electron App. This feature will allow bundling pre-built Docker images with the application to provide a faster, more reliable installation experience.

## Overview

The Docker image pre-loading system enables the application to:

1. **Bundle Docker images** - Package pre-built images with the application installer
2. **Load on demand** - Load images when needed or on first run
3. **Track progress** - Show detailed progress during image loading
4. **Handle errors** - Gracefully handle missing files, disk space issues, and Docker problems
5. **Skip existing** - Automatically skip images that are already loaded

## Architecture

### Components

1. **docker-images.ts** - Core module handling image operations
   - `/home/user/MCP-Electron-App/src/main/docker-images.ts`

2. **IPC Handlers** - Main process handlers in `index.ts`
   - `docker-images:load-all` - Load all bundled images
   - `docker-images:load-image` - Load a specific image
   - `docker-images:check-exists` - Check if image exists
   - `docker-images:list` - List all Docker images
   - `docker-images:get-bundled` - Get bundled image information
   - `docker-images:check-disk-space` - Check available disk space

3. **Preload API** - Exposed to renderer via `electronAPI.dockerImages`

4. **Resources Directory** - Contains bundled image files
   - `/resources/docker-images/postgres-15.tar.gz`
   - `/resources/docker-images/mcp-servers.tar.gz`

5. **Export Script** - Generates image files for bundling
   - `/scripts/export-docker-images.sh`

## Bundled Images (Planned)

### postgres:15 (or postgres:16-alpine)
- **File**: `postgres-15.tar.gz` (or `postgres-16-alpine.tar.gz`)
- **Size**: ~150MB compressed
- **Purpose**: PostgreSQL database for MCP servers
- **Current**: Pulled from Docker Hub during setup
- **Future**: Pre-bundled in application installer

### mcp-servers:latest
- **File**: `mcp-servers.tar.gz`
- **Size**: ~200MB compressed
- **Purpose**: Custom MCP servers container
- **Current**: Built from cloned source code during setup
- **Future**: Pre-built and bundled in application installer

## Usage

### For End Users

Images are loaded automatically during installation or can be loaded on demand through the UI:

```javascript
// Load all bundled images
const result = await window.electronAPI.dockerImages.loadAll();

// Check if an image exists
const exists = await window.electronAPI.dockerImages.checkExists('postgres:15');

// Get bundled image information
const images = await window.electronAPI.dockerImages.getBundledImages();

// Listen for progress updates
window.electronAPI.dockerImages.onProgress((progress) => {
  console.log(`Loading ${progress.imageName}: ${progress.percent}%`);
});
```

### For Developers

#### Building the Application

1. **Export Docker images** (one-time per release):
   ```bash
   npm run export-docker-images
   ```

2. **Verify images exist**:
   ```bash
   ls -lh resources/docker-images/
   ```

3. **Package the application**:
   ```bash
   npm run package
   ```

#### Manual Image Export (For Future Implementation)

If you prefer manual control when implementing this feature:

```bash
# Export PostgreSQL image
docker pull postgres:15
docker save postgres:15 | gzip > resources/docker-images/postgres-15.tar.gz

# Build and export MCP servers
# Note: Current implementation builds from source, not from local Dockerfile
docker build -t mcp-servers:latest .
docker save mcp-servers:latest | gzip > resources/docker-images/mcp-servers.tar.gz
```

## API Reference

### Main Process API

#### `loadAllDockerImages(progressCallback?)`

Load all bundled Docker images.

```typescript
interface AllImagesLoadResult {
  success: boolean;
  loaded: string[];      // Successfully loaded images
  skipped: string[];     // Already existing images
  failed: string[];      // Failed to load images
  errors: string[];      // Error messages
}
```

**Example:**
```typescript
import * as dockerImages from './docker-images';

const result = await dockerImages.loadAllDockerImages((progress) => {
  console.log(`[${progress.currentImage}/${progress.totalImages}] ${progress.message}`);
});

console.log(`Loaded: ${result.loaded.length}, Skipped: ${result.skipped.length}`);
```

#### `loadImage(imagePath, imageName, progressCallback?)`

Load a single Docker image from a tar.gz file.

```typescript
interface ImageLoadResult {
  success: boolean;
  imageName: string;
  message: string;
  error?: string;
}
```

**Example:**
```typescript
const result = await dockerImages.loadImage(
  '/path/to/postgres-15.tar.gz',
  'postgres:15',
  (progress) => {
    console.log(`${progress.percent}% - ${progress.message}`);
  }
);
```

#### `checkImageExists(imageName)`

Check if a Docker image exists locally.

```typescript
const exists = await dockerImages.checkImageExists('postgres:15');
console.log(`Image exists: ${exists}`);
```

#### `getImageList()`

Get a list of all Docker images on the system.

```typescript
interface ImageListResult {
  success: boolean;
  images: Array<{
    repository: string;
    tag: string;
    imageId: string;
    size: string;
  }>;
  error?: string;
}
```

#### `getBundledImages()`

Get information about images configured for bundling.

```typescript
interface DockerImageInfo {
  name: string;
  tag: string;
  fullName: string;
  fileName: string;
  size?: number;
  exists: boolean;
}

const images = await dockerImages.getBundledImages();
```

#### `checkDiskSpace()`

Check if there's enough disk space to load the images.

```typescript
interface DiskSpaceResult {
  available: boolean;
  freeSpace: number;
  requiredSpace: number;
  error?: string;
}
```

### Renderer Process API

All APIs are accessible via `window.electronAPI.dockerImages`:

```typescript
interface DockerImagesAPI {
  loadAll(): Promise<AllImagesLoadResult>;
  loadImage(imagePath: string, imageName: string): Promise<ImageLoadResult>;
  checkExists(imageName: string): Promise<boolean>;
  listImages(): Promise<ImageListResult>;
  getBundledImages(): Promise<DockerImageInfo[]>;
  checkDiskSpace(): Promise<DiskSpaceResult>;
  onProgress(callback: (progress: DockerImageProgress) => void): void;
  removeProgressListener(): void;
}
```

## Progress Updates

Progress is reported through the `docker-images:progress` IPC channel with the following structure:

```typescript
interface DockerImageProgress {
  imageName: string;           // Name of image being loaded
  currentImage: number;         // Current image number (1-based)
  totalImages: number;          // Total number of images
  percent: number;              // Progress percentage (0-100)
  bytesLoaded: number;          // Bytes processed
  totalBytes: number;           // Total bytes to process
  step: 'checking' | 'extracting' | 'loading' | 'verifying' | 'complete' | 'error';
  message: string;              // Human-readable status message
}
```

**Progress Steps:**

1. **checking** - Checking if image already exists
2. **extracting** - Decompressing the tar.gz file
3. **loading** - Loading the image into Docker
4. **verifying** - Verifying the image was loaded successfully
5. **complete** - Image loaded successfully
6. **error** - An error occurred

## Error Handling

The system handles various error conditions:

### Docker Not Running
```typescript
if (!dockerRunning) {
  return {
    success: false,
    error: 'Docker is not running. Please start Docker and try again.'
  };
}
```

### Insufficient Disk Space
```typescript
const diskSpace = await dockerImages.checkDiskSpace();
if (!diskSpace.available) {
  return {
    success: false,
    error: `Insufficient disk space. Need ${diskSpace.requiredSpace}MB, have ${diskSpace.freeSpace}MB`
  };
}
```

### Missing Image Files
```typescript
if (!imageFileExists) {
  return {
    success: false,
    error: 'Bundled image file not found. The application may not have been packaged correctly.'
  };
}
```

### Image Already Exists
```typescript
if (imageExists) {
  return {
    success: true,
    skipped: [imageName],
    message: 'Image already exists, skipped loading'
  };
}
```

## Configuration

To add or modify bundled images, edit the `BUNDLED_IMAGES` array in `docker-images.ts`:

```typescript
const BUNDLED_IMAGES = [
  {
    name: 'postgres',
    tag: '15',
    fullName: 'postgres:15',
    fileName: 'postgres-15.tar.gz',
    size: 150 * 1024 * 1024, // ~150MB
  },
  {
    name: 'mcp-servers',
    tag: 'latest',
    fullName: 'mcp-servers:latest',
    fileName: 'mcp-servers.tar.gz',
    size: 200 * 1024 * 1024, // ~200MB
  },
  // Add more images here
];
```

## Build Process Integration

The image files are bundled through electron-builder's `extraResources` configuration in `package.json`:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "resources",
        "to": "resources",
        "filter": ["**/*"]
      }
    ]
  }
}
```

This ensures the `resources/docker-images/` directory and its contents are included in the packaged application.

## Platform Considerations

### Windows
- Uses `C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe` for Docker
- Disk space checked via `wmic logicaldisk`
- Uses PowerShell for decompression if needed

### macOS
- Uses Docker.app
- Disk space checked via `df` command
- Native gzip/gunzip support

### Linux
- Uses Docker service (systemd or init.d)
- Disk space checked via `df` command
- Native gzip/gunzip support

## Performance

### Streaming Decompression
The system uses streaming decompression to minimize memory usage:

```typescript
const gunzip = spawn('gunzip', ['-c', imagePath]);
const dockerLoad = spawn('docker', ['load']);
gunzip.stdout.pipe(dockerLoad.stdin);
```

This approach:
- Doesn't require loading entire file into memory
- Provides real-time progress updates
- Can be cancelled mid-stream

### Parallel Loading
Currently, images are loaded sequentially to avoid overwhelming the system. Future enhancements could include parallel loading for independent images.

## Testing

### Manual Testing

1. **Test with existing images**:
   ```bash
   docker pull postgres:15
   npm run dev
   # Try loading - should skip existing image
   ```

2. **Test with missing images**:
   ```bash
   docker rmi postgres:15
   npm run dev
   # Try loading - should load from bundle
   ```

3. **Test export script**:
   ```bash
   npm run export-docker-images
   ls -lh resources/docker-images/
   ```

### Automated Testing

Create test images for CI/CD:

```bash
# Create a small test image
echo "FROM alpine" | docker build -t test-image:latest -
docker save test-image:latest | gzip > resources/docker-images/test-image.tar.gz
```

## Troubleshooting

### Images not loading
1. Check Docker is running: `docker ps`
2. Check image files exist: `ls -lh resources/docker-images/`
3. Check logs: Diagnostics > View Logs

### Out of disk space
1. Check available space: `df -h`
2. Clean up Docker: `docker system prune -a`
3. Remove unused images: `docker image prune -a`

### Slow loading
1. Verify files are compressed (.tar.gz)
2. Check network if pulling images
3. Monitor system resources during load

## Implementation Status

**Current Status:** Planning/Design Phase

This entire document describes a future enhancement. The current application:
- ✅ Pulls PostgreSQL from Docker Hub automatically
- ✅ Clones MCP server repositories and builds images from source
- ❌ Does NOT bundle pre-built images with the installer
- ❌ Does NOT include tar.gz image files in the application package

## Future Enhancements (After Base Feature Implementation)

Once the base pre-loading feature is implemented, these additional enhancements could be added:

1. **Delta updates** - Only download image changes
2. **Parallel loading** - Load independent images simultaneously
3. **Resume support** - Resume interrupted downloads
4. **CDN hosting** - Host images on CDN for faster downloads
5. **Integrity checks** - Verify image checksums
6. **Incremental loading** - Load images in chunks

## References

- Docker image documentation: https://docs.docker.com/engine/reference/commandline/save/
- Electron resource bundling: https://www.electron.build/configuration/contents
- Issue #10: Docker Image Pre-loading Implementation

## Support

For issues related to Docker image pre-loading:

1. Check the logs: Diagnostics > View Logs
2. Run system tests: Diagnostics > Test System
3. Export diagnostic report: Diagnostics > Export Diagnostic Report
4. Report issues via Help > Report Issue
