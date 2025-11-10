# Docker Image Pre-loading - Usage Examples

> **⚠️ FUTURE ENHANCEMENT - NOT CURRENTLY IMPLEMENTED**
>
> This document describes usage examples for a planned future feature.
>
> **Current Behavior:** The app currently pulls the PostgreSQL image from Docker Hub and builds MCP server images from source code during setup.
>
> **Future Enhancement:** This document provides examples for when pre-loading bundled Docker images is implemented.

---

This document provides practical examples of using the Docker image pre-loading system planned for the MCP Electron App.

## Basic Usage

### Loading All Bundled Images

```typescript
// In renderer process
async function loadAllImages() {
  try {
    // Check disk space first
    const diskSpace = await window.electronAPI.dockerImages.checkDiskSpace();

    if (!diskSpace.available) {
      console.error('Insufficient disk space!');
      console.log(`Need: ${diskSpace.requiredSpace / 1024 / 1024}MB`);
      console.log(`Available: ${diskSpace.freeSpace / 1024 / 1024}MB`);
      return;
    }

    // Listen for progress updates
    window.electronAPI.dockerImages.onProgress((progress) => {
      console.log(`[${progress.currentImage}/${progress.totalImages}] ${progress.imageName}`);
      console.log(`  Status: ${progress.step}`);
      console.log(`  Progress: ${progress.percent.toFixed(1)}%`);
      console.log(`  Message: ${progress.message}`);
    });

    // Load all images
    const result = await window.electronAPI.dockerImages.loadAll();

    if (result.success) {
      console.log('All images loaded successfully!');
      console.log(`Loaded: ${result.loaded.join(', ')}`);
      console.log(`Skipped: ${result.skipped.join(', ')}`);
    } else {
      console.error('Some images failed to load:');
      console.error(`Failed: ${result.failed.join(', ')}`);
      result.errors.forEach(error => console.error(`  - ${error}`));
    }

    // Clean up listener
    window.electronAPI.dockerImages.removeProgressListener();

  } catch (error) {
    console.error('Error loading images:', error);
  }
}
```

### Checking Image Status

```typescript
async function checkImageStatus() {
  try {
    // Get bundled image information
    const images = await window.electronAPI.dockerImages.getBundledImages();

    console.log('Bundled Images:');
    for (const image of images) {
      console.log(`\n${image.fullName}:`);
      console.log(`  File: ${image.fileName}`);
      console.log(`  Size: ${(image.size / 1024 / 1024).toFixed(0)}MB`);
      console.log(`  Exists: ${image.exists ? 'Yes' : 'No'}`);
    }

  } catch (error) {
    console.error('Error checking images:', error);
  }
}
```

### Loading a Specific Image

```typescript
async function loadSpecificImage(imagePath: string, imageName: string) {
  try {
    // Check if image already exists
    const exists = await window.electronAPI.dockerImages.checkExists(imageName);

    if (exists) {
      console.log(`Image ${imageName} already exists, skipping load`);
      return;
    }

    // Load the image
    console.log(`Loading ${imageName}...`);

    const result = await window.electronAPI.dockerImages.loadImage(
      imagePath,
      imageName
    );

    if (result.success) {
      console.log(`Successfully loaded ${imageName}`);
    } else {
      console.error(`Failed to load ${imageName}: ${result.error}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Listing All Docker Images

```typescript
async function listAllImages() {
  try {
    const result = await window.electronAPI.dockerImages.listImages();

    if (result.success) {
      console.log('Docker Images:');
      console.log('-'.repeat(80));

      for (const image of result.images) {
        console.log(`${image.repository}:${image.tag}`);
        console.log(`  ID: ${image.imageId}`);
        console.log(`  Size: ${image.size}`);
      }

      console.log(`\nTotal: ${result.images.length} images`);
    } else {
      console.error('Failed to list images:', result.error);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}
```

## UI Integration Examples

### Progress Dialog Component

```html
<!-- progress-dialog.html -->
<div id="imageLoadingDialog" class="dialog">
  <div class="dialog-content">
    <h2>Loading Docker Images</h2>

    <div class="progress-info">
      <p id="currentImage">Preparing...</p>
      <p id="statusMessage">Checking images...</p>
    </div>

    <div class="progress-bar-container">
      <div id="progressBar" class="progress-bar"></div>
    </div>

    <p id="progressPercent">0%</p>

    <div class="details">
      <p id="bytesInfo">0 MB / 0 MB</p>
      <p id="stepInfo">Initializing...</p>
    </div>

    <button id="cancelButton">Cancel</button>
  </div>
</div>
```

```typescript
// progress-dialog.ts
interface ProgressDialog {
  show(): void;
  hide(): void;
  update(progress: DockerImageProgress): void;
}

function createProgressDialog(): ProgressDialog {
  const dialog = document.getElementById('imageLoadingDialog');
  const progressBar = document.getElementById('progressBar') as HTMLDivElement;
  const progressPercent = document.getElementById('progressPercent');
  const currentImage = document.getElementById('currentImage');
  const statusMessage = document.getElementById('statusMessage');
  const bytesInfo = document.getElementById('bytesInfo');
  const stepInfo = document.getElementById('stepInfo');

  return {
    show() {
      dialog?.classList.add('visible');
    },

    hide() {
      dialog?.classList.remove('visible');
    },

    update(progress: DockerImageProgress) {
      // Update progress bar
      if (progressBar) {
        progressBar.style.width = `${progress.percent}%`;
      }

      // Update percent text
      if (progressPercent) {
        progressPercent.textContent = `${progress.percent.toFixed(1)}%`;
      }

      // Update current image
      if (currentImage) {
        currentImage.textContent = `[${progress.currentImage}/${progress.totalImages}] ${progress.imageName}`;
      }

      // Update status message
      if (statusMessage) {
        statusMessage.textContent = progress.message;
      }

      // Update bytes info
      if (bytesInfo) {
        const loadedMB = (progress.bytesLoaded / 1024 / 1024).toFixed(1);
        const totalMB = (progress.totalBytes / 1024 / 1024).toFixed(1);
        bytesInfo.textContent = `${loadedMB} MB / ${totalMB} MB`;
      }

      // Update step info
      if (stepInfo) {
        const stepLabels = {
          checking: 'Checking if image exists...',
          extracting: 'Extracting compressed image...',
          loading: 'Loading into Docker...',
          verifying: 'Verifying image...',
          complete: 'Complete!',
          error: 'Error occurred',
        };
        stepInfo.textContent = stepLabels[progress.step] || progress.step;
      }

      // Change color based on step
      if (progressBar) {
        progressBar.className = 'progress-bar';
        if (progress.step === 'error') {
          progressBar.classList.add('error');
        } else if (progress.step === 'complete') {
          progressBar.classList.add('success');
        }
      }
    }
  };
}

// Usage
async function showImageLoadingDialog() {
  const dialog = createProgressDialog();

  dialog.show();

  // Listen for progress
  window.electronAPI.dockerImages.onProgress((progress) => {
    dialog.update(progress);
  });

  try {
    const result = await window.electronAPI.dockerImages.loadAll();

    if (result.success) {
      setTimeout(() => dialog.hide(), 2000);
    } else {
      // Show error
      alert(`Failed to load images: ${result.errors.join('\n')}`);
    }
  } finally {
    window.electronAPI.dockerImages.removeProgressListener();
  }
}
```

### Status Card Component

```typescript
interface ImageStatusCard {
  imageName: string;
  exists: boolean;
  size: number;
}

function createImageStatusCard(info: DockerImageInfo): string {
  return `
    <div class="image-card ${info.exists ? 'loaded' : 'not-loaded'}">
      <div class="image-icon">
        ${info.exists ? '✓' : '○'}
      </div>
      <div class="image-info">
        <h3>${info.fullName}</h3>
        <p class="image-size">${(info.size / 1024 / 1024).toFixed(0)} MB</p>
        <p class="image-status">
          ${info.exists ? 'Loaded' : 'Not Loaded'}
        </p>
      </div>
      ${!info.exists ? `
        <button class="load-button" onclick="loadImage('${info.fileName}', '${info.fullName}')">
          Load Image
        </button>
      ` : ''}
    </div>
  `;
}

async function displayImageStatus() {
  const images = await window.electronAPI.dockerImages.getBundledImages();
  const container = document.getElementById('imageStatusContainer');

  if (container) {
    container.innerHTML = images.map(createImageStatusCard).join('');
  }
}
```

## Error Handling Examples

### Comprehensive Error Handling

```typescript
async function loadImagesWithErrorHandling() {
  try {
    // 1. Check Docker is running
    const dockerStatus = await window.electronAPI.docker.healthCheck();
    if (!dockerStatus.healthy) {
      throw new Error('Docker is not running. Please start Docker and try again.');
    }

    // 2. Check disk space
    const diskSpace = await window.electronAPI.dockerImages.checkDiskSpace();
    if (!diskSpace.available) {
      const needMB = (diskSpace.requiredSpace / 1024 / 1024).toFixed(0);
      const haveMB = (diskSpace.freeSpace / 1024 / 1024).toFixed(0);
      throw new Error(
        `Insufficient disk space. Need ${needMB}MB, but only ${haveMB}MB available.`
      );
    }

    // 3. Load images
    const result = await window.electronAPI.dockerImages.loadAll();

    // 4. Handle partial failures
    if (!result.success) {
      console.warn('Some images failed to load:');
      result.failed.forEach((imageName, index) => {
        console.error(`  ${imageName}: ${result.errors[index]}`);
      });

      // Decide whether to continue or abort
      if (result.loaded.length === 0) {
        throw new Error('Failed to load any images');
      } else {
        console.warn('Continuing with partially loaded images');
      }
    }

    return result;

  } catch (error) {
    console.error('Error loading Docker images:', error);

    // Show user-friendly error message
    if (error.message.includes('Docker')) {
      showError('Docker Error', error.message);
    } else if (error.message.includes('disk space')) {
      showError('Disk Space Error', error.message);
    } else {
      showError('Unknown Error', 'An unexpected error occurred while loading Docker images.');
    }

    throw error;
  }
}
```

### Retry Logic

```typescript
async function loadImagesWithRetry(maxRetries = 3, delayMs = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}...`);

      const result = await window.electronAPI.dockerImages.loadAll();

      if (result.success) {
        return result;
      }

      // Partial success - check if we should retry
      if (result.failed.length === 0) {
        return result;
      }

      if (attempt < maxRetries) {
        console.log(`Retrying in ${delayMs / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Failed to load images after maximum retries');
}
```

## Installation Wizard Integration

```typescript
// install-wizard.ts
class InstallationWizard {
  async runImageLoadingStep() {
    console.log('Step 3: Loading Docker Images');

    // Check prerequisites
    await this.checkPrerequisites();

    // Load images with progress
    const dialog = createProgressDialog();
    dialog.show();

    window.electronAPI.dockerImages.onProgress((progress) => {
      dialog.update(progress);
    });

    try {
      const result = await window.electronAPI.dockerImages.loadAll();

      if (result.success) {
        console.log('✓ Docker images loaded successfully');
        this.markStepComplete('images');
      } else {
        console.error('✗ Some images failed to load');
        this.markStepFailed('images', result.errors);
      }

      return result;

    } finally {
      dialog.hide();
      window.electronAPI.dockerImages.removeProgressListener();
    }
  }

  private async checkPrerequisites() {
    // Check Docker
    const dockerStatus = await window.electronAPI.docker.healthCheck();
    if (!dockerStatus.healthy) {
      throw new Error('Docker is required but not running');
    }

    // Check disk space
    const diskSpace = await window.electronAPI.dockerImages.checkDiskSpace();
    if (!diskSpace.available) {
      throw new Error('Insufficient disk space for Docker images');
    }
  }

  private markStepComplete(step: string) {
    // Update UI, save state, etc.
  }

  private markStepFailed(step: string, errors: string[]) {
    // Update UI, log errors, etc.
  }
}
```

## Testing Examples

```typescript
// Test image loading
async function testImageLoading() {
  console.log('=== Testing Docker Image Loading ===\n');

  // 1. Test getting bundled images
  console.log('1. Getting bundled images...');
  const images = await window.electronAPI.dockerImages.getBundledImages();
  console.log(`   Found ${images.length} bundled images`);

  // 2. Test checking image existence
  console.log('\n2. Checking image existence...');
  for (const image of images) {
    const exists = await window.electronAPI.dockerImages.checkExists(image.fullName);
    console.log(`   ${image.fullName}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
  }

  // 3. Test disk space check
  console.log('\n3. Checking disk space...');
  const diskSpace = await window.electronAPI.dockerImages.checkDiskSpace();
  console.log(`   Required: ${(diskSpace.requiredSpace / 1024 / 1024).toFixed(0)}MB`);
  console.log(`   Available: ${(diskSpace.freeSpace / 1024 / 1024).toFixed(0)}MB`);
  console.log(`   Sufficient: ${diskSpace.available ? 'YES' : 'NO'}`);

  // 4. Test listing images
  console.log('\n4. Listing all Docker images...');
  const list = await window.electronAPI.dockerImages.listImages();
  console.log(`   Total images: ${list.images.length}`);

  console.log('\n=== Test Complete ===');
}
```

## See Also

- [DOCKER-IMAGE-PRELOADING.md](./DOCKER-IMAGE-PRELOADING.md) - Complete documentation
- [ELECTRON-BUNDLE-CHECKLIST.md](./ELECTRON-BUNDLE-CHECKLIST.md) - Packaging checklist
- [ELECTRON-DEPLOYMENT.md](./ELECTRON-DEPLOYMENT.md) - Deployment guide
