/**
 * Installation Wizard Module
 * Provides guided installation instructions for Docker Desktop
 * Platform-specific instructions for Windows, macOS, and Linux
 */

import { shell, clipboard } from 'electron';
import * as log from 'electron-log';
import { getPlatform, getPlatformInfo } from './prerequisites';

/**
 * Installation step interface
 */
export interface InstallationStep {
  stepNumber: number;
  title: string;
  description: string;
  command?: string;
  requiresAdmin?: boolean;
  requiresRestart?: boolean;
  estimatedTime?: string;
}

/**
 * Installation instructions interface
 */
export interface InstallationInstructions {
  platform: string;
  platformName: string;
  architecture: string;
  downloadUrl: string;
  totalSteps: number;
  steps: InstallationStep[];
  notes: string[];
  additionalInfo?: string;
}

/**
 * Get Docker Desktop download URL for the current platform and architecture
 */
export function getDockerDownloadUrl(): string {
  const platform = getPlatform();
  const arch = process.arch;

  log.info(`Getting Docker download URL for platform: ${platform}, arch: ${arch}`);

  switch (platform) {
    case 'windows':
      // Windows Docker Desktop (AMD64 only officially supported)
      return 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe';

    case 'macos':
      // macOS - different URLs for Intel and Apple Silicon
      if (arch === 'arm64') {
        return 'https://desktop.docker.com/mac/main/arm64/Docker.dmg';
      } else {
        return 'https://desktop.docker.com/mac/main/amd64/Docker.dmg';
      }

    case 'linux':
      // For Linux, we'll point to the official docs
      return 'https://docs.docker.com/engine/install/';

    default:
      log.warn(`Unknown platform: ${platform}`);
      return 'https://docs.docker.com/get-docker/';
  }
}

/**
 * Get platform-specific installation instructions
 */
export function getInstallationInstructions(): InstallationInstructions {
  const platformInfo = getPlatformInfo();
  const platform = platformInfo.platform;
  const downloadUrl = getDockerDownloadUrl();

  log.info(`Getting installation instructions for platform: ${platform}`);

  switch (platform) {
    case 'windows':
      return getWindowsInstructions(platformInfo, downloadUrl);

    case 'macos':
      return getMacOSInstructions(platformInfo, downloadUrl);

    case 'linux':
      return getLinuxInstructions(platformInfo, downloadUrl);

    default:
      return getGenericInstructions(platformInfo, downloadUrl);
  }
}

/**
 * Windows installation instructions
 */
function getWindowsInstructions(
  platformInfo: any,
  downloadUrl: string
): InstallationInstructions {
  return {
    platform: 'windows',
    platformName: 'Windows',
    architecture: platformInfo.arch,
    downloadUrl,
    totalSteps: 5,
    steps: [
      {
        stepNumber: 1,
        title: 'Download Docker Desktop for Windows',
        description: 'Click the button below to download Docker Desktop installer for Windows.',
        estimatedTime: '1-2 minutes',
      },
      {
        stepNumber: 2,
        title: 'Install WSL 2 (if needed)',
        description:
          'Docker Desktop requires Windows Subsystem for Linux 2 (WSL 2). Run this command in PowerShell as Administrator:',
        command: 'wsl --install',
        requiresAdmin: true,
        requiresRestart: true,
        estimatedTime: '5-10 minutes',
      },
      {
        stepNumber: 3,
        title: 'Run Docker Desktop Installer',
        description:
          'Double-click the downloaded Docker Desktop Installer.exe file and follow the installation wizard. Accept the default settings.',
        requiresAdmin: true,
        estimatedTime: '3-5 minutes',
      },
      {
        stepNumber: 4,
        title: 'Start Docker Desktop',
        description:
          'Launch Docker Desktop from the Start menu. You may be prompted to create a Docker Hub account (optional). Wait for Docker to start - you will see a whale icon in the system tray.',
        estimatedTime: '2-3 minutes',
      },
      {
        stepNumber: 5,
        title: 'Verify Installation',
        description:
          'Click the "Check Again" button below to verify Docker is installed and running correctly.',
        estimatedTime: '30 seconds',
      },
    ],
    notes: [
      'Administrator privileges are required for installation',
      'WSL 2 installation may require a system restart',
      'Virtualization must be enabled in your BIOS/UEFI settings',
      'Docker Desktop requires Windows 10/11 64-bit: Pro, Enterprise, or Education',
      'A Docker Hub account is optional but recommended for accessing public images',
    ],
    additionalInfo:
      'If you encounter issues with WSL 2, ensure virtualization is enabled in your BIOS settings.',
  };
}

/**
 * macOS installation instructions
 */
function getMacOSInstructions(
  platformInfo: any,
  downloadUrl: string
): InstallationInstructions {
  const isAppleSilicon = platformInfo.arch === 'arm64';

  return {
    platform: 'macos',
    platformName: 'macOS',
    architecture: isAppleSilicon ? 'Apple Silicon (M1/M2/M3)' : 'Intel',
    downloadUrl,
    totalSteps: 5,
    steps: [
      {
        stepNumber: 1,
        title: `Download Docker Desktop for Mac (${isAppleSilicon ? 'Apple Silicon' : 'Intel'})`,
        description: `Click the button below to download the correct Docker Desktop version for your ${isAppleSilicon ? 'Apple Silicon' : 'Intel'} Mac.`,
        estimatedTime: '1-2 minutes',
      },
      {
        stepNumber: 2,
        title: 'Install Docker.app',
        description:
          'Open the downloaded Docker.dmg file and drag the Docker icon to your Applications folder.',
        estimatedTime: '1 minute',
      },
      {
        stepNumber: 3,
        title: 'Open Docker from Applications',
        description:
          'Navigate to your Applications folder and double-click on Docker.app to launch it.',
        estimatedTime: '30 seconds',
      },
      {
        stepNumber: 4,
        title: 'Grant Necessary Permissions',
        description:
          'macOS will ask for permission to install networking components. Enter your password when prompted. You may also need to grant accessibility permissions.',
        requiresAdmin: true,
        estimatedTime: '1-2 minutes',
      },
      {
        stepNumber: 5,
        title: 'Wait for Docker to Start',
        description:
          'Docker Desktop will start automatically. Wait until you see the whale icon in the menu bar at the top of your screen. The icon will stop animating when Docker is ready.',
        estimatedTime: '1-2 minutes',
      },
    ],
    notes: [
      isAppleSilicon
        ? 'Apple Silicon Macs (M1/M2/M3) use the ARM64 version'
        : 'Intel Macs use the AMD64 version',
      'macOS 11 or newer is required',
      'At least 4GB of RAM is recommended',
      'A Docker Hub account is optional but recommended',
      'Docker Desktop runs in the background and starts automatically on login',
    ],
    additionalInfo:
      'After installation, Docker Desktop will appear in your menu bar. Click it to access preferences and settings.',
  };
}

/**
 * Linux installation instructions
 */
function getLinuxInstructions(
  platformInfo: any,
  downloadUrl: string
): InstallationInstructions {
  // Detect distribution (simplified - assumes Ubuntu/Debian)
  // In a real implementation, you would detect the actual distro
  const isUbuntuDebian = true; // Simplified for this example

  return {
    platform: 'linux',
    platformName: 'Linux',
    architecture: platformInfo.arch,
    downloadUrl,
    totalSteps: 5,
    steps: [
      {
        stepNumber: 1,
        title: 'Install Docker Engine',
        description: isUbuntuDebian
          ? 'Run these commands to install Docker on Ubuntu/Debian:'
          : 'Visit the Docker documentation for distribution-specific instructions:',
        command: isUbuntuDebian
          ? 'sudo apt-get update && sudo apt-get install -y docker.io'
          : undefined,
        requiresAdmin: true,
        estimatedTime: '3-5 minutes',
      },
      {
        stepNumber: 2,
        title: 'Add User to Docker Group',
        description:
          'Add your user to the docker group to run Docker without sudo:',
        command: 'sudo usermod -aG docker $USER',
        requiresAdmin: true,
        estimatedTime: '10 seconds',
      },
      {
        stepNumber: 3,
        title: 'Start Docker Service',
        description: 'Start the Docker service using systemd:',
        command: 'sudo systemctl start docker',
        requiresAdmin: true,
        estimatedTime: '10 seconds',
      },
      {
        stepNumber: 4,
        title: 'Enable Docker on Boot',
        description: 'Configure Docker to start automatically on system boot:',
        command: 'sudo systemctl enable docker',
        requiresAdmin: true,
        estimatedTime: '5 seconds',
      },
      {
        stepNumber: 5,
        title: 'Log Out and Back In',
        description:
          'Log out of your session and log back in for the group changes to take effect. Then click "Check Again" to verify installation.',
        requiresRestart: true,
        estimatedTime: '1 minute',
      },
    ],
    notes: [
      'These instructions are for Ubuntu/Debian-based distributions',
      'For other distributions (Fedora, Arch, etc.), visit docs.docker.com',
      'You must log out and back in after adding yourself to the docker group',
      'sudo privileges are required for installation',
      'Docker Desktop for Linux is available separately if you prefer a GUI',
    ],
    additionalInfo:
      'After installation, you can verify Docker is running with: docker ps',
  };
}

/**
 * Generic installation instructions (fallback)
 */
function getGenericInstructions(
  platformInfo: any,
  downloadUrl: string
): InstallationInstructions {
  return {
    platform: platformInfo.platform,
    platformName: 'Your Platform',
    architecture: platformInfo.arch,
    downloadUrl,
    totalSteps: 1,
    steps: [
      {
        stepNumber: 1,
        title: 'Visit Docker Documentation',
        description:
          'Please visit the official Docker documentation for installation instructions specific to your platform.',
        estimatedTime: 'Varies',
      },
    ],
    notes: ['Refer to official Docker documentation for your specific platform'],
  };
}

/**
 * Open the Docker download page in the default browser
 */
export async function openDownloadPage(): Promise<void> {
  const downloadUrl = getDockerDownloadUrl();

  log.info(`Opening Docker download page: ${downloadUrl}`);

  try {
    await shell.openExternal(downloadUrl);
    log.info('Download page opened successfully');
  } catch (error) {
    log.error('Error opening download page:', error);
    throw new Error('Failed to open download page');
  }
}

/**
 * Copy a command to the clipboard
 */
export function copyCommandToClipboard(command: string): boolean {
  try {
    clipboard.writeText(command);
    log.info(`Command copied to clipboard: ${command}`);
    return true;
  } catch (error) {
    log.error('Error copying command to clipboard:', error);
    return false;
  }
}

/**
 * Get a specific step's details
 */
export function getStep(stepNumber: number): InstallationStep | null {
  const instructions = getInstallationInstructions();

  if (stepNumber < 1 || stepNumber > instructions.totalSteps) {
    log.warn(`Invalid step number: ${stepNumber}`);
    return null;
  }

  return instructions.steps[stepNumber - 1] || null;
}

/**
 * Get "Why do I need this?" explanations
 */
export function getWhyDockerExplanation(): string {
  return `Docker is required for this application because:

• MCP (Model Context Protocol) servers run in isolated Docker containers
• Containers ensure consistent environments across different systems
• Docker provides security isolation for running untrusted code
• Containerization makes it easy to manage multiple MCP servers
• You can easily update, start, stop, and remove MCP servers without affecting your system

Think of Docker as a lightweight virtual machine that provides a safe, isolated environment for running MCP servers.`;
}

/**
 * Export all public functions and interfaces
 */
export default {
  getDockerDownloadUrl,
  getInstallationInstructions,
  openDownloadPage,
  copyCommandToClipboard,
  getStep,
  getWhyDockerExplanation,
};
