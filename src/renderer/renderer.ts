/**
 * Renderer process script
 * This file runs in the renderer process and has access to the DOM
 * It communicates with the main process via IPC through the preload script
 */

// Type definitions for the API exposed by preload script
interface ElectronAPI {
  ping: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  getPlatformInfo: () => Promise<{
    platform: string;
    arch: string;
    version: string;
  }>;
}

// Access the API exposed through preload script
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

/**
 * Load and display application information
 */
async function loadAppInfo(): Promise<void> {
  try {
    // Get app version
    const version = await window.electronAPI.getAppVersion();
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
      versionElement.textContent = version;
    }

    // Get platform info
    const platformInfo = await window.electronAPI.getPlatformInfo();

    const platformElement = document.getElementById('platform');
    if (platformElement) {
      platformElement.textContent = platformInfo.platform;
    }

    const archElement = document.getElementById('architecture');
    if (archElement) {
      archElement.textContent = platformInfo.arch;
    }

    const nodeVersionElement = document.getElementById('node-version');
    if (nodeVersionElement) {
      nodeVersionElement.textContent = platformInfo.version;
    }

    console.log('App info loaded successfully');
  } catch (error) {
    console.error('Error loading app info:', error);
  }
}

/**
 * Test IPC communication with main process
 */
async function testIPC(): Promise<void> {
  const button = document.getElementById('test-ipc') as HTMLButtonElement;
  const result = document.getElementById('test-result');

  if (!button || !result) return;

  try {
    button.disabled = true;
    button.textContent = 'Testing...';

    const response = await window.electronAPI.ping();

    if (response === 'pong') {
      result.textContent = 'IPC communication successful!';
      result.style.background = 'rgba(0, 255, 0, 0.2)';
      result.classList.add('show');

      console.log('IPC test passed:', response);
    } else {
      throw new Error('Unexpected response from IPC');
    }
  } catch (error) {
    console.error('IPC test failed:', error);
    result.textContent = 'IPC communication failed!';
    result.style.background = 'rgba(255, 0, 0, 0.2)';
    result.classList.add('show');
  } finally {
    button.disabled = false;
    button.textContent = 'Test IPC Communication';
  }
}

/**
 * Initialize the renderer process
 */
function init(): void {
  console.log('Renderer process initialized');

  // Load app information
  loadAppInfo();

  // Set up event listeners
  const testButton = document.getElementById('test-ipc');
  if (testButton) {
    testButton.addEventListener('click', testIPC);
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export to make this a module (required for global augmentation)
export {};
