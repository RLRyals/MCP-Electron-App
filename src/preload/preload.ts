/**
 * Preload script
 * This script runs in a privileged context before the renderer process loads
 * It exposes a limited, secure API to the renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Prerequisite status interface
 */
interface PrerequisiteStatus {
  installed: boolean;
  running?: boolean;
  version?: string;
  error?: string;
}

/**
 * Platform information interface
 */
interface PlatformInfo {
  platform: string;
  platformName: string;
  arch: string;
  nodeVersion: string;
}

/**
 * All prerequisites check result
 */
interface AllPrerequisitesResult {
  docker: PrerequisiteStatus;
  git: PrerequisiteStatus;
  wsl?: PrerequisiteStatus;
  platform: string;
}

/**
 * System test check result
 */
interface SystemCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

/**
 * System test result
 */
interface SystemTestResult {
  passed: boolean;
  systemInfo: any;
  checks: SystemCheck[];
}

/**
 * Diagnostic report result
 */
interface DiagnosticReportResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Expose a secure API to the renderer process
 * This API is the only way the renderer can communicate with the main process
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Send a ping to the main process and receive a pong
   */
  ping: (): Promise<string> => {
    return ipcRenderer.invoke('ping');
  },

  /**
   * Get the application version
   */
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('get-app-version');
  },

  /**
   * Get platform information
   */
  getPlatformInfo: (): Promise<{
    platform: string;
    arch: string;
    version: string;
  }> => {
    return ipcRenderer.invoke('get-platform-info');
  },

  /**
   * Prerequisites API
   */
  prerequisites: {
    /**
     * Check if Docker is installed
     */
    checkDocker: (): Promise<PrerequisiteStatus> => {
      return ipcRenderer.invoke('prerequisites:check-docker');
    },

    /**
     * Check if Docker is running
     */
    checkDockerRunning: (): Promise<PrerequisiteStatus> => {
      return ipcRenderer.invoke('prerequisites:check-docker-running');
    },

    /**
     * Get Docker version
     */
    getDockerVersion: (): Promise<PrerequisiteStatus> => {
      return ipcRenderer.invoke('prerequisites:get-docker-version');
    },

    /**
     * Check if Git is installed
     */
    checkGit: (): Promise<PrerequisiteStatus> => {
      return ipcRenderer.invoke('prerequisites:check-git');
    },

    /**
     * Check WSL status (Windows only)
     */
    checkWSL: (): Promise<PrerequisiteStatus> => {
      return ipcRenderer.invoke('prerequisites:check-wsl');
    },

    /**
     * Run all prerequisite checks
     */
    checkAll: (): Promise<AllPrerequisitesResult> => {
      return ipcRenderer.invoke('prerequisites:check-all');
    },

    /**
     * Get detailed platform information
     */
    getPlatformInfo: (): Promise<PlatformInfo> => {
      return ipcRenderer.invoke('prerequisites:get-platform-info');
    },
  },

  /**
   * Logging and diagnostics API
   */
  logger: {
    /**
     * Open the log file in default editor
     */
    openLogFile: (): Promise<void> => {
      return ipcRenderer.invoke('logger:open');
    },

    /**
     * Open the logs directory
     */
    openLogsDirectory: (): Promise<void> => {
      return ipcRenderer.invoke('logger:open-directory');
    },

    /**
     * Export diagnostic report
     */
    exportDiagnosticReport: (): Promise<DiagnosticReportResult> => {
      return ipcRenderer.invoke('logger:export');
    },

    /**
     * Run system tests
     */
    testSystem: (): Promise<SystemTestResult> => {
      return ipcRenderer.invoke('logger:test-system');
    },

    /**
     * Get recent log entries
     */
    getRecentLogs: (lines?: number): Promise<string[]> => {
      return ipcRenderer.invoke('logger:get-logs', lines);
    },

    /**
     * Generate GitHub issue template
     */
    generateIssueTemplate: (
      title: string,
      message: string,
      stack?: string
    ): Promise<string> => {
      return ipcRenderer.invoke('logger:generate-issue-template', title, message, stack);
    },

    /**
     * Open GitHub issue with pre-filled template
     */
    openGitHubIssue: (
      title: string,
      message: string,
      stack?: string
    ): Promise<void> => {
      return ipcRenderer.invoke('logger:open-github-issue', title, message, stack);
    },

    /**
     * Listen for system test results
     */
    onSystemTestResults: (callback: (results: SystemTestResult) => void): void => {
      ipcRenderer.on('system-test-results', (_, results) => callback(results));
    },
  },
});

console.log('Preload script loaded successfully');
