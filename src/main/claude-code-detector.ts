/**
 * Claude Code CLI Detector
 *
 * Detects if Claude Code CLI is installed and configured
 * Checks authentication status and user info
 */

import { spawn } from 'child_process';
import { logWithCategory, LogCategory } from './logger';

export interface ClaudeCodeStatus {
  installed: boolean;
  version?: string;
  loggedIn: boolean;
  userName?: string;
  error?: string;
}

export class ClaudeCodeDetector {
  private cachedStatus: ClaudeCodeStatus | null = null;
  private lastCheckTime: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Check if `claude` command exists and get version
   */
  async isInstalled(): Promise<boolean> {
    try {
      const version = await this.getVersion();
      return version !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Claude CLI version
   */
  async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const claude = spawn('claude', ['--version'], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      claude.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      claude.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          // Parse version from output (e.g., "claude-code v1.2.3" or "1.2.3")
          const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
          if (versionMatch) {
            logWithCategory('info', LogCategory.WORKFLOW,
              `Claude CLI detected: version ${versionMatch[1]}`);
            resolve(versionMatch[1]);
          } else {
            logWithCategory('warn', LogCategory.WORKFLOW,
              `Claude CLI found but version parse failed: ${stdout}`);
            resolve('unknown');
          }
        } else {
          resolve(null);
        }
      });

      claude.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          logWithCategory('info', LogCategory.WORKFLOW,
            'Claude CLI not found in PATH');
        } else {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `Error checking Claude CLI: ${error.message}`);
        }
        resolve(null);
      });
    });
  }

  /**
   * Check if user is authenticated to Claude
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      const userInfo = await this.getUserInfo();
      return userInfo !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get logged-in user info
   */
  async getUserInfo(): Promise<{ userName: string } | null> {
    return new Promise((resolve) => {
      // Try to get auth status
      // Note: The exact command may vary - adjust based on actual Claude CLI
      const claude = spawn('claude', ['auth', 'whoami'], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      claude.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      claude.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          // Parse user info from output
          // Format might be: "Logged in as: user@example.com" or similar
          const emailMatch = stdout.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
          if (emailMatch) {
            logWithCategory('info', LogCategory.WORKFLOW,
              `Claude user detected: ${emailMatch[1]}`);
            resolve({ userName: emailMatch[1] });
          } else {
            // If no email found, but command succeeded, user is logged in
            logWithCategory('info', LogCategory.WORKFLOW,
              'Claude user logged in (name unknown)');
            resolve({ userName: 'Claude User' });
          }
        } else {
          logWithCategory('info', LogCategory.WORKFLOW,
            'Claude auth check failed - not logged in');
          resolve(null);
        }
      });

      claude.on('error', (error) => {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `Error checking Claude auth: ${error.message}`);
        resolve(null);
      });
    });
  }

  /**
   * Get full Claude Code status (fast - only checks if installed)
   *
   * NOTE: We don't check authentication status anymore because:
   * 1. There's no `claude auth whoami` command - that was creating fake "auth" conversations
   * 2. The old check took 98 seconds and created empty chats in history
   * 3. If Claude isn't authenticated, it will prompt the user when actually run
   */
  async getStatus(): Promise<ClaudeCodeStatus> {
    // Return cached status if recent (within 30 seconds)
    const now = Date.now();
    if (this.cachedStatus && (now - this.lastCheckTime) < this.CACHE_DURATION) {
      logWithCategory('debug', LogCategory.WORKFLOW,
        'Using cached Claude Code status (age: ' + Math.round((now - this.lastCheckTime) / 1000) + 's)');
      return this.cachedStatus;
    }

    try {
      // Check installation only
      const version = await this.getVersion();
      const installed = version !== null;

      if (!installed) {
        const status: ClaudeCodeStatus = {
          installed: false,
          loggedIn: false,
          error: 'Claude Code CLI is not installed or not in PATH'
        };
        this.cachedStatus = status;
        this.lastCheckTime = now;
        return status;
      }

      // Assume logged in if installed (Claude CLI will handle auth if needed)
      const status: ClaudeCodeStatus = {
        installed: true,
        version,
        loggedIn: true,  // Assume true - CLI will prompt if not
        userName: 'Claude User'
      };

      // Cache the result
      this.cachedStatus = status;
      this.lastCheckTime = now;

      return status;

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Failed to get Claude Code status: ${error.message}`);

      const errorStatus: ClaudeCodeStatus = {
        installed: false,
        loggedIn: false,
        error: error.message
      };

      // Cache error status briefly (don't retry immediately)
      this.cachedStatus = errorStatus;
      this.lastCheckTime = now;

      return errorStatus;
    }
  }
}
