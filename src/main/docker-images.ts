/**
 * Docker Image Pre-loading Module
 * Handles loading pre-built Docker images from bundled tar.gz files
 * Provides progress tracking and error handling
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { getPlatform, getFixedEnv } from './prerequisites';
import { LogCategory, logWithCategory } from './logger';
import {
  BuildError,
  BuildErrorCode,
  ErrorHandler,
} from '../utils/error-handler';
import { RetryStrategy } from '../utils/retry-strategy';

const promisifiedExec = promisify(exec);
const execAsync = async (command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> => {
  return promisifiedExec(command, {
    ...options,
    encoding: 'utf8',
    env: getFixedEnv(),
  }) as unknown as Promise<{ stdout: string; stderr: string }>;
};

/**
 * Progress callback for image loading operations
 */
export type ImageProgressCallback = (progress: {
  imageName: string;
  currentImage: number;
  totalImages: number;
  percent: number;
  bytesLoaded: number;
  totalBytes: number;
  step: 'checking' | 'extracting' | 'loading' | 'verifying' | 'complete' | 'error';
  message: string;
}) => void;

/**
 * Docker image information
 */
export interface DockerImageInfo {
  name: string;
  tag: string;
  fullName: string;
  fileName: string;
  size?: number;
  exists: boolean;
}

/**
 * Image loading result
 */
export interface ImageLoadResult {
  success: boolean;
  imageName: string;
  message: string;
  error?: string;
}

/**
 * Image list result
 */
export interface ImageListResult {
  success: boolean;
  images: Array<{
    repository: string;
    tag: string;
    imageId: string;
    size: string;
  }>;
  error?: string;
}

/**
 * Configuration for bundled images
 */
const BUNDLED_IMAGES: Array<Omit<DockerImageInfo, 'exists'>> = [
  {
    name: 'postgres',
    tag: '15',
    fullName: 'postgres:15',
    fileName: 'postgres-15.tar.gz',
    size: 150 * 1024 * 1024, // ~150MB
  },
  {
    name: 'mcp-writing-servers',
    tag: 'latest',
    fullName: 'mcp-writing-servers:latest',
    fileName: 'mcp-writing-servers.tar.gz',
    size: 200 * 1024 * 1024, // ~200MB
  },
];

/**
 * Get the path to the resources directory containing bundled Docker images
 */
function getResourcesPath(): string {
  // In development, use the project's resources directory
  // In production, use the app's resources directory
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    return path.join(process.cwd(), 'resources', 'docker-images');
  } else {
    return path.join(process.resourcesPath, 'resources', 'docker-images');
  }
}

/**
 * Get the path to a bundled image file
 */
function getImagePath(fileName: string): string {
  return path.join(getResourcesPath(), fileName);
}

/**
 * Check if an image file exists in the resources
 */
function imageFileExists(fileName: string): boolean {
  const imagePath = getImagePath(fileName);
  return fs.existsSync(imagePath);
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Check if a Docker image exists locally with retry logic
 */
export async function checkImageExists(imageName: string): Promise<boolean> {
  logWithCategory('info', LogCategory.DOCKER_IMAGE, `Checking if image exists: ${imageName}`);

  const retryStrategy = new RetryStrategy({
    maxAttempts: 2,
    initialDelay: 1000,
    maxDelay: 5000,
  });

  const result = await retryStrategy.execute(
    async () => {
      const { stdout } = await execAsync(`docker images -q ${imageName}`, { timeout: 5000 });
      return stdout.trim().length > 0;
    },
    { operation: 'check-image', imageName }
  );

  if (result.success) {
    logWithCategory('info', LogCategory.DOCKER_IMAGE, `Image ${imageName} exists: ${result.result}`);
    return result.result!;
  }

  logWithCategory('error', LogCategory.DOCKER_IMAGE, `Error checking image ${imageName}`, {
    error: result.error?.message,
  });
  return false;
}

/**
 * Get list of all Docker images
 */
export async function getImageList(): Promise<ImageListResult> {
  logWithCategory('info', LogCategory.DOCKER_IMAGE, 'Getting Docker image list...');

  try {
    const { stdout } = await execAsync(
      'docker images --format "{{.Repository}}|{{.Tag}}|{{.ID}}|{{.Size}}"',
      { timeout: 5000 }
    );

    const images = stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => {
        const [repository, tag, imageId, size] = line.split('|');
        return { repository, tag, imageId, size };
      });

    logWithCategory('info', LogCategory.DOCKER_IMAGE, `Found ${images.length} Docker images`);

    return {
      success: true,
      images,
    };

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.DOCKER_IMAGE, 'Error getting image list', { error: errorMessage });

    return {
      success: false,
      images: [],
      error: errorMessage,
    };
  }
}

/**
 * Load a single Docker image from a tar.gz file with retry logic
 */
export async function loadImage(
  imagePath: string,
  imageName: string,
  progressCallback?: ImageProgressCallback
): Promise<ImageLoadResult> {
  logWithCategory('info', LogCategory.DOCKER_IMAGE, `Loading Docker image: ${imageName} from ${imagePath}`);

  const retryStrategy = new RetryStrategy({
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 16000,
    backoffMultiplier: 2,
    onRetry: (error, attempt, delay) => {
      logWithCategory(
        'warn',
        LogCategory.DOCKER_IMAGE,
        `Retrying Docker image load (attempt ${attempt}) after ${delay}ms`,
        { imageName, error: error instanceof Error ? error.message : String(error) }
      );

      if (progressCallback) {
        progressCallback({
          imageName,
          currentImage: 1,
          totalImages: 1,
          percent: 0,
          bytesLoaded: 0,
          totalBytes: 0,
          step: 'loading',
          message: `Retrying... (attempt ${attempt})`,
        });
      }
    },
  });

  const result = await retryStrategy.execute(
    () => executeImageLoad(imagePath, imageName, progressCallback),
    { operation: 'load-image', imagePath, imageName }
  );

  if (result.success) {
    return {
      success: true,
      imageName,
      message: `Successfully loaded ${imageName}`,
    };
  }

  return {
    success: false,
    imageName,
    message: 'Failed to load image',
    error: result.error?.message || 'Unknown error',
  };
}

/**
 * Internal image load execution (wrapped by retry logic)
 */
async function executeImageLoad(
  imagePath: string,
  imageName: string,
  progressCallback?: ImageProgressCallback
): Promise<void> {
  // Check if file exists
  if (!fs.existsSync(imagePath)) {
    throw ErrorHandler.createError(
      BuildErrorCode.DOCKER_IMAGE_NOT_FOUND,
      new Error(`Image file not found: ${imagePath}`),
      { imagePath, imageName }
    );
  }

    // Get file size for progress tracking
    const fileSize = getFileSize(imagePath);
    logWithCategory('info', LogCategory.DOCKER_IMAGE, `Image file size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    if (progressCallback) {
      progressCallback({
        imageName,
        currentImage: 1,
        totalImages: 1,
        percent: 0,
        bytesLoaded: 0,
        totalBytes: fileSize,
        step: 'extracting',
        message: `Extracting ${imageName}...`,
      });
    }

    // Load the image using gunzip and docker load
    // We use spawn to have better control over the process
    return await new Promise<void>((resolve, reject) => {
      // Create gunzip process
      const gunzip = spawn('gunzip', ['-c', imagePath], { env: getFixedEnv() });

      // Create docker load process
      const dockerLoad = spawn('docker', ['load'], { env: getFixedEnv() });

      let output = '';
      let errorOutput = '';
      let bytesProcessed = 0;

      // Pipe gunzip output to docker load
      gunzip.stdout.pipe(dockerLoad.stdin);

      // Track progress on gunzip output
      gunzip.stdout.on('data', (chunk: Buffer) => {
        bytesProcessed += chunk.length;
        const percent = Math.min(95, (bytesProcessed / fileSize) * 100);

        if (progressCallback) {
          progressCallback({
            imageName,
            currentImage: 1,
            totalImages: 1,
            percent,
            bytesLoaded: bytesProcessed,
            totalBytes: fileSize,
            step: 'loading',
            message: `Loading ${imageName}... ${percent.toFixed(0)}%`,
          });
        }
      });

      // Capture docker load output
      dockerLoad.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      dockerLoad.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      // Handle gunzip errors
      gunzip.on('error', (error) => {
        logWithCategory('error', LogCategory.DOCKER_IMAGE, `gunzip error for ${imageName}`, { error: error.message });
        reject(error);
      });

      gunzip.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      // Handle docker load completion
      dockerLoad.on('close', (code) => {
        if (code === 0) {
          logWithCategory('info', LogCategory.DOCKER_IMAGE, `Successfully loaded image: ${imageName}`);

          if (progressCallback) {
            progressCallback({
              imageName,
              currentImage: 1,
              totalImages: 1,
              percent: 100,
              bytesLoaded: fileSize,
              totalBytes: fileSize,
              step: 'complete',
              message: `Successfully loaded ${imageName}`,
            });
          }

          resolve();
        } else {
          const error = ErrorHandler.createError(
            BuildErrorCode.DOCKER_BUILD_FAILED,
            new Error(`Docker load failed with code ${code}: ${errorOutput}`),
            { imageName, code, errorOutput }
          );

          logWithCategory('error', LogCategory.DOCKER_IMAGE, error.getLogMessage());

          if (progressCallback) {
            progressCallback({
              imageName,
              currentImage: 1,
              totalImages: 1,
              percent: 100,
              bytesLoaded: 0,
              totalBytes: fileSize,
              step: 'error',
              message: `Failed to load ${imageName}`,
            });
          }

          reject(error);
        }
      });

      // Handle docker load errors
      dockerLoad.on('error', (error) => {
        const buildError = ErrorHandler.classify(error, {
          operation: 'docker-load',
          imageName,
        });

        logWithCategory('error', LogCategory.DOCKER_IMAGE, `Docker load error for ${imageName}`, { error: error.message });

        if (progressCallback) {
          progressCallback({
            imageName,
            currentImage: 1,
            totalImages: 1,
            percent: 100,
            bytesLoaded: 0,
            totalBytes: fileSize,
            step: 'error',
            message: `Failed to load ${imageName}`,
          });
        }

        reject(buildError);
      });
    });
}

/**
 * Get information about bundled images
 */
export async function getBundledImages(): Promise<DockerImageInfo[]> {
  logWithCategory('info', LogCategory.DOCKER_IMAGE, 'Getting bundled images information...');

  const images: DockerImageInfo[] = [];

  for (const imageConfig of BUNDLED_IMAGES) {
    const exists = await checkImageExists(imageConfig.fullName);
    images.push({
      ...imageConfig,
      exists,
    });
  }

  return images;
}

/**
 * Load all bundled Docker images
 */
export async function loadAllDockerImages(
  progressCallback?: ImageProgressCallback
): Promise<{
  success: boolean;
  loaded: string[];
  skipped: string[];
  failed: string[];
  errors: string[];
}> {
  logWithCategory('info', LogCategory.DOCKER_IMAGE, 'Loading all bundled Docker images...');

  const loaded: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  const errors: string[] = [];

  const totalImages = BUNDLED_IMAGES.length;
  let currentImageIndex = 0;

  for (const imageConfig of BUNDLED_IMAGES) {
    currentImageIndex++;
    const { fullName, fileName } = imageConfig;

    logWithCategory('info', LogCategory.DOCKER_IMAGE, `Processing image ${currentImageIndex}/${totalImages}: ${fullName}`);

    // Report checking status
    if (progressCallback) {
      progressCallback({
        imageName: fullName,
        currentImage: currentImageIndex,
        totalImages,
        percent: 0,
        bytesLoaded: 0,
        totalBytes: imageConfig.size || 0,
        step: 'checking',
        message: `Checking ${fullName}...`,
      });
    }

    // Check if image already exists
    const exists = await checkImageExists(fullName);
    if (exists) {
      logWithCategory('info', LogCategory.DOCKER_IMAGE, `Image ${fullName} already exists, skipping...`);
      skipped.push(fullName);

      if (progressCallback) {
        progressCallback({
          imageName: fullName,
          currentImage: currentImageIndex,
          totalImages,
          percent: 100,
          bytesLoaded: imageConfig.size || 0,
          totalBytes: imageConfig.size || 0,
          step: 'complete',
          message: `${fullName} already exists`,
        });
      }

      continue;
    }

    // Check if bundled file exists
    const imagePath = getImagePath(fileName);
    if (!imageFileExists(fileName)) {
      const error = `Bundled image file not found: ${fileName}`;
      logWithCategory('warn', LogCategory.DOCKER_IMAGE, error);
      failed.push(fullName);
      errors.push(error);

      if (progressCallback) {
        progressCallback({
          imageName: fullName,
          currentImage: currentImageIndex,
          totalImages,
          percent: 100,
          bytesLoaded: 0,
          totalBytes: 0,
          step: 'error',
          message: `File not found: ${fileName}`,
        });
      }

      continue;
    }

    // Load the image
    const result = await loadImage(imagePath, fullName, (progress) => {
      if (progressCallback) {
        progressCallback({
          ...progress,
          currentImage: currentImageIndex,
          totalImages,
        });
      }
    });

    if (result.success) {
      loaded.push(fullName);
    } else {
      failed.push(fullName);
      if (result.error) {
        errors.push(result.error);
      }
    }
  }

  const allSuccess = failed.length === 0;
  const summary = `Loaded: ${loaded.length}, Skipped: ${skipped.length}, Failed: ${failed.length}`;

  logWithCategory('info', LogCategory.DOCKER_IMAGE, `Image loading complete. ${summary}`);

  return {
    success: allSuccess,
    loaded,
    skipped,
    failed,
    errors,
  };
}

/**
 * Check disk space available for loading images
 */
export async function checkDiskSpace(): Promise<{
  available: boolean;
  freeSpace: number;
  requiredSpace: number;
  error?: string;
}> {
  logWithCategory('info', LogCategory.DOCKER_IMAGE, 'Checking available disk space...');

  try {
    // Calculate total required space
    const requiredSpace = BUNDLED_IMAGES.reduce((total, img) => total + (img.size || 0), 0);

    // Get available disk space (platform-specific)
    let freeSpace = 0;

    if (process.platform === 'win32') {
      // Windows: Use wmic
      const { stdout } = await execAsync('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace', { timeout: 5000 });
      const match = stdout.match(/\d+/);
      if (match) {
        freeSpace = parseInt(match[0], 10);
      }
    } else {
      // Unix-like: Use df
      const { stdout } = await execAsync('df -k / | tail -1 | awk \'{print $4}\'', { timeout: 5000 });
      freeSpace = parseInt(stdout.trim(), 10) * 1024; // Convert KB to bytes
    }

    const available = freeSpace > requiredSpace * 1.5; // Require 1.5x the space for safety

    logWithCategory('info', LogCategory.DOCKER_IMAGE, `Disk space check: Required=${(requiredSpace / 1024 / 1024).toFixed(0)}MB, Free=${(freeSpace / 1024 / 1024).toFixed(0)}MB, Available=${available}`);

    return {
      available,
      freeSpace,
      requiredSpace,
    };

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.DOCKER_IMAGE, 'Error checking disk space', { error: errorMessage });

    return {
      available: true, // Assume available if we can't check
      freeSpace: 0,
      requiredSpace: 0,
      error: errorMessage,
    };
  }
}
