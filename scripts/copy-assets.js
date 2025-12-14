/**
 * Copy static assets (HTML, CSS, etc.) from src to dist
 */

const fs = require('fs');
const path = require('path');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyAssets() {
  const srcRenderer = path.join(__dirname, '..', 'src', 'renderer');
  const distRenderer = path.join(__dirname, '..', 'dist', 'renderer');

  try {
    console.log('Copying renderer assets...');

    // Ensure dist/renderer directory exists
    ensureDirSync(distRenderer);

    // Copy HTML and CSS files
    const files = fs.readdirSync(srcRenderer);
    for (const file of files) {
      if (file.endsWith('.html') || file.endsWith('.css')) {
        const srcPath = path.join(srcRenderer, file);
        const destPath = path.join(distRenderer, file);
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✓ Copied ${file}`);
      }
    }

    // Copy styles directory
    const srcStyles = path.join(srcRenderer, 'styles');
    const distStyles = path.join(distRenderer, 'styles');
    if (fs.existsSync(srcStyles)) {
      ensureDirSync(distStyles);
      const styleFiles = fs.readdirSync(srcStyles);
      for (const file of styleFiles) {
        if (file.endsWith('.css')) {
          const srcPath = path.join(srcStyles, file);
          const destPath = path.join(distStyles, file);
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ✓ Copied styles/${file}`);
        }
      }
    }

    // Copy icon.png from resources to dist/renderer
    const iconSrc = path.join(__dirname, '..', 'resources', 'icon.png');
    const iconDest = path.join(distRenderer, 'icon.png');
    if (fs.existsSync(iconSrc)) {
      fs.copyFileSync(iconSrc, iconDest);
      console.log(`  ✓ Copied icon.png`);
    } else {
      console.warn(`  ⚠ Warning: icon.png not found at ${iconSrc}`);
    }

    // Copy vendor directory (React bundles for offline use)
    const srcVendor = path.join(srcRenderer, 'vendor');
    const distVendor = path.join(distRenderer, 'vendor');
    if (fs.existsSync(srcVendor)) {
      ensureDirSync(distVendor);
      const vendorFiles = fs.readdirSync(srcVendor);
      for (const file of vendorFiles) {
        if (file.endsWith('.js')) {
          const srcPath = path.join(srcVendor, file);
          const destPath = path.join(distVendor, file);
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ✓ Copied vendor/${file}`);
        }
      }
    }

    // Copy all icon files from resources to dist/resources
    console.log('Copying resources directory...');
    const srcResources = path.join(__dirname, '..', 'resources');
    const distResources = path.join(__dirname, '..', 'dist', 'resources');

    if (fs.existsSync(srcResources)) {
      ensureDirSync(distResources);
      const resourceFiles = ['icon.png', 'icon.ico', 'icon.icns'];

      for (const file of resourceFiles) {
        const srcPath = path.join(srcResources, file);
        if (fs.existsSync(srcPath)) {
          const destPath = path.join(distResources, file);
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ✓ Copied resources/${file}`);
        }
      }
    }

    // Also copy preload assets if they exist
    const srcPreload = path.join(__dirname, '..', 'src', 'preload');
    const distPreload = path.join(__dirname, '..', 'dist', 'preload');

    if (fs.existsSync(srcPreload)) {
      ensureDirSync(distPreload);
      const preloadFiles = fs.readdirSync(srcPreload);
      for (const file of preloadFiles) {
        if (file.endsWith('.html') || file.endsWith('.css')) {
          const srcPath = path.join(srcPreload, file);
          const destPath = path.join(distPreload, file);
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ✓ Copied preload/${file}`);
        }
      }
    }

    // Copy config directory
    console.log('Copying config directory...');
    const srcConfig = path.join(__dirname, '..', 'config');
    const distConfig = path.join(__dirname, '..', 'dist', 'config');

    if (fs.existsSync(srcConfig)) {
      ensureDirSync(distConfig);
      const configFiles = fs.readdirSync(srcConfig);
      for (const file of configFiles) {
        const srcPath = path.join(srcConfig, file);
        const destPath = path.join(distConfig, file);

        // Check if it's a file (not a directory)
        const stat = fs.statSync(srcPath);
        if (stat.isFile()) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ✓ Copied config/${file}`);
        }
      }
    }

    console.log('✓ Asset copying complete!');
  } catch (error) {
    console.error('Error copying assets:', error);
    process.exit(1);
  }
}

copyAssets();
