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

    // Copy HTML, CSS, and JSON files (like import-map.json)
    const files = fs.readdirSync(srcRenderer);
    for (const file of files) {
      if (file.endsWith('.html') || file.endsWith('.css') || file.endsWith('.json')) {
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

    // Copy xterm assets (JS and CSS)
    try {
      const xtermPkgPath = path.join(__dirname, '..', 'node_modules', '@xterm', 'xterm');
      const fitPkgPath = path.join(__dirname, '..', 'node_modules', '@xterm', 'addon-fit');
      const webLinksPkgPath = path.join(__dirname, '..', 'node_modules', '@xterm', 'addon-web-links');
      const distStyles = path.join(distRenderer, 'styles');
      const distVendor = path.join(distRenderer, 'vendor');

      ensureDirSync(distStyles);
      ensureDirSync(distVendor);

      // 1. Copy xterm CSS
      if (fs.existsSync(xtermPkgPath)) {
        const xtermCssSrc = path.join(xtermPkgPath, 'css', 'xterm.css');
        const xtermCssDest = path.join(distStyles, 'xterm.css');
        if (fs.existsSync(xtermCssSrc)) {
          fs.copyFileSync(xtermCssSrc, xtermCssDest);
          console.log('  ✓ Copied xterm.css from node_modules');
        }

        // Copy xterm.js (UMD) and create wrapper
        const xtermJsSrc = path.join(xtermPkgPath, 'lib', 'xterm.js');
        const xtermJsDest = path.join(distVendor, 'xterm.umd.js');
        if (fs.existsSync(xtermJsSrc)) {
          fs.copyFileSync(xtermJsSrc, xtermJsDest);
          console.log('  ✓ Copied xterm.js from node_modules');

          const wrapperPath = path.join(distVendor, 'xterm.js');
          const wrapperContent = `import './xterm.umd.js';\nexport const Terminal = window.Terminal;`;
          fs.writeFileSync(wrapperPath, wrapperContent);
          console.log('  ✓ Generated vendor/xterm.js wrapper');
        }
      }

      // 2. Copy addon-fit
      if (fs.existsSync(fitPkgPath)) {
        const fitJsSrc = path.join(fitPkgPath, 'lib', 'addon-fit.js');
        const fitJsDest = path.join(distVendor, 'addon-fit.umd.js');
        if (fs.existsSync(fitJsSrc)) {
          fs.copyFileSync(fitJsSrc, fitJsDest);
          console.log('  ✓ Copied addon-fit.js from node_modules');

          // Create a wrapper that handles different UMD export styles
          const wrapperPath = path.join(distVendor, 'addon-fit.js');
          // Check if it's exported as default or named export
          const wrapperContent = `
import './addon-fit.umd.js';
// The UMD build might export to window.FitAddon directly or window.FitAddon.FitAddon
const Plugin = window.FitAddon;
export const FitAddon = (Plugin.FitAddon || Plugin.default || Plugin);
`;
          fs.writeFileSync(wrapperPath, wrapperContent);
          console.log('  ✓ Generated vendor/addon-fit.js wrapper');
        }
      }

      // 3. Copy addon-web-links
      if (fs.existsSync(webLinksPkgPath)) {
        const linksJsSrc = path.join(webLinksPkgPath, 'lib', 'addon-web-links.js');
        const linksJsDest = path.join(distVendor, 'addon-web-links.umd.js');
        if (fs.existsSync(linksJsSrc)) {
          fs.copyFileSync(linksJsSrc, linksJsDest);
          console.log('  ✓ Copied addon-web-links.js from node_modules');

          const wrapperPath = path.join(distVendor, 'addon-web-links.js');
          const wrapperContent = `
import './addon-web-links.umd.js';
const Plugin = window.WebLinksAddon;
export const WebLinksAddon = (Plugin.WebLinksAddon || Plugin.default || Plugin);
`;
          fs.writeFileSync(wrapperPath, wrapperContent);
          console.log('  ✓ Generated vendor/addon-web-links.js wrapper');
        }
      }
    } catch (err) {
      console.warn('  ⚠ Failed to copy xterm assets:', err.message);
    }

    // Copy ReactFlow from node_modules
    try {
      const reactFlowPath = path.join(__dirname, '..', 'node_modules', 'reactflow', 'dist');
      if (fs.existsSync(reactFlowPath)) {
        ensureDirSync(distVendor);

        // Copy UMD build
        const rfUmdSrc = path.join(reactFlowPath, 'umd', 'index.js');
        const rfUmdDest = path.join(distVendor, 'reactflow.umd.js');
        if (fs.existsSync(rfUmdSrc)) {
          fs.copyFileSync(rfUmdSrc, rfUmdDest);
          console.log('  ✓ Copied reactflow.umd.js from node_modules');
        }

        // Copy CSS
        const rfCssSrc = path.join(reactFlowPath, 'style.css');
        const distStyles = path.join(distRenderer, 'styles');
        const rfCssDest = path.join(distStyles, 'reactflow.css');
        if (fs.existsSync(rfCssSrc)) {
          ensureDirSync(distStyles);
          fs.copyFileSync(rfCssSrc, rfCssDest);
          console.log('  ✓ Copied reactflow.css from node_modules');
        }

        // Generate ESM wrapper for ReactFlow
        const rfWrapperPath = path.join(distVendor, 'reactflow.js');
        const rfWrapperContent = `
// ReactFlow UMD build exports to window.ReactFlow
const ReactFlowLib = window.ReactFlow;

// The default export should be the main ReactFlow component
// In UMD build, the main component might be at ReactFlowLib.default or just ReactFlowLib
export default ReactFlowLib.default || ReactFlowLib;

// Export named exports from the library
export const Controls = ReactFlowLib.Controls;
export const Background = ReactFlowLib.Background;
export const Handle = ReactFlowLib.Handle;
export const Position = ReactFlowLib.Position;
export const useNodesState = ReactFlowLib.useNodesState;
export const useEdgesState = ReactFlowLib.useEdgesState;
export const addEdge = ReactFlowLib.addEdge;
export const BackgroundVariant = ReactFlowLib.BackgroundVariant;
export const MarkerType = ReactFlowLib.MarkerType;
export const Node = ReactFlowLib.Node;
export const Edge = ReactFlowLib.Edge;
export const Connection = ReactFlowLib.Connection;
export const NodeProps = ReactFlowLib.NodeProps;
`;
        fs.writeFileSync(rfWrapperPath, rfWrapperContent);
        console.log('  ✓ Generated vendor/reactflow.js wrapper');
      } else {
        console.warn('  ⚠ Warning: node_modules/reactflow not found');
      }
    } catch (err) {
      console.warn('  ⚠ Failed to copy ReactFlow assets:', err.message);
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
