/**
 * Claude Code Subscription Plugin - Implementation Class
 */

import type { PluginContext } from '../../../src/types/plugin-api';
import * as childProcess from 'child_process';
import { promisify } from 'util';

const exec = promisify(childProcess.exec);

export interface TaskFormData {
  prompt: string;
  context?: string;
  workingDirectory?: string;
  timeout?: number;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

export class ClaudeCodePlugin {
  private context!: PluginContext;

  /**
   * Plugin activation
   */
  async onActivate(context: PluginContext): Promise<void> {
    this.context = context;
    this.log('Activating Claude Code Subscription plugin...');

    // Register IPC handlers for menu actions
    this.registerHandlers();

    // Check if CLI is installed
    const installed = await this.isInstalled();
    if (installed) {
      this.log('Claude Code CLI detected');

      // Check authentication status
      const authed = await this.isAuthenticated();
      if (authed) {
        this.log('User is authenticated');
        await this.context.config.set('authenticated', true);
      } else {
        this.log('User is not authenticated');
        await this.context.config.set('authenticated', false);
      }
    } else {
      this.log('Claude Code CLI not installed');
    }

    this.log('Plugin activated successfully');
  }

  /**
   * Plugin deactivation
   */
  async onDeactivate(): Promise<void> {
    this.log('Plugin deactivated');
  }

  /**
   * Register IPC handlers
   */
  private registerHandlers(): void {
    this.context.ipc.handle('install-cli', async () => {
      return await this.installCLI();
    });

    this.context.ipc.handle('login', async () => {
      return await this.login();
    });

    this.context.ipc.handle('check-auth', async () => {
      return await this.checkAuth();
    });

    this.context.ipc.handle('run-task', async (event, formData: TaskFormData) => {
      return await this.runTask(formData);
    });

    this.log('Registered IPC handlers');
  }

  // ==================== Installation ====================

  /**
   * Install Claude Code CLI
   */
  private async installCLI(): Promise<{ success: boolean; message: string }> {
    try {
      const platform = process.platform;
      this.log(`Installing Claude Code CLI for ${platform}...`);

      // Show installation method dialog
      const result = await this.context.ui.showDialog({
        type: 'question',
        title: 'Choose Installation Method',
        message: 'How would you like to install Claude Code CLI?',
        detail: platform === 'darwin'
          ? 'Homebrew is recommended for macOS\nnpm works on all platforms'
          : 'npm is the recommended method for your platform',
        buttons: platform === 'darwin'
          ? ['Homebrew (Recommended)', 'npm', 'Manual', 'Cancel']
          : ['npm (Recommended)', 'Manual', 'Cancel'],
        defaultId: 0,
        cancelId: platform === 'darwin' ? 3 : 2
      });

      if (!result) {
        return { success: false, message: 'Installation cancelled' };
      }

      const buttonIndex = result.response || 0;
      let method: string;

      if (platform === 'darwin') {
        if (buttonIndex === 0) method = 'brew';
        else if (buttonIndex === 1) method = 'npm';
        else if (buttonIndex === 2) method = 'manual';
        else return { success: false, message: 'Installation cancelled' };
      } else {
        if (buttonIndex === 0) method = 'npm';
        else if (buttonIndex === 1) method = 'manual';
        else return { success: false, message: 'Installation cancelled' };
      }

      if (method === 'manual') {
        await this.showManualInstallInstructions();
        return { success: false, message: 'Manual installation instructions shown' };
      }

      // Install
      let installResult: string;
      if (method === 'npm') {
        installResult = await this.installViaNpm();
      } else {
        installResult = await this.installViaBrew();
      }

      this.context.ui.showNotification({
        type: 'success',
        message: 'Claude Code CLI installed successfully!'
      });

      this.log('Installation complete');

      // Prompt to login
      const loginPrompt = await this.context.ui.showDialog({
        type: 'question',
        title: 'Login to Anthropic?',
        message: 'Would you like to login to your Anthropic account now?',
        buttons: ['Yes', 'Later'],
        defaultId: 0
      });

      if (loginPrompt && loginPrompt.response === 0) {
        await this.login();
      }

      return { success: true, message: installResult };

    } catch (error: any) {
      this.log(`Installation failed: ${error.message}`, 'error');
      this.context.ui.showNotification({
        type: 'error',
        message: `Installation failed: ${error.message}`
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Install via npm
   */
  private async installViaNpm(): Promise<string> {
    this.log('Installing via npm...');

    try {
      await exec('npm --version');
    } catch (error) {
      throw new Error('npm is not installed. Please install Node.js first.');
    }

    const { stdout } = await exec('npm install -g @anthropic-ai/claude-code', {
      timeout: 120000
    });

    return stdout;
  }

  /**
   * Install via Homebrew
   */
  private async installViaBrew(): Promise<string> {
    this.log('Installing via Homebrew...');

    try {
      await exec('brew --version');
    } catch (error) {
      throw new Error('Homebrew is not installed. Visit https://brew.sh');
    }

    const { stdout } = await exec('brew install anthropic-ai/tap/claude-code', {
      timeout: 120000
    });

    return stdout;
  }

  /**
   * Show manual installation instructions
   */
  private async showManualInstallInstructions(): Promise<void> {
    const platform = process.platform;
    let instructions = '';

    if (platform === 'win32') {
      instructions = `1. Install Node.js from https://nodejs.org/
2. Open Command Prompt
3. Run: npm install -g @anthropic-ai/claude-code
4. Restart FictionLab
5. Menu → Claude Code → Login to Anthropic`;
    } else if (platform === 'darwin') {
      instructions = `1. Install Homebrew:
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

2. Run: brew install anthropic-ai/tap/claude-code
3. Restart FictionLab
4. Menu → Claude Code → Login to Anthropic`;
    } else {
      instructions = `1. Install via npm:
   npm install -g @anthropic-ai/claude-code

2. Or download from:
   https://github.com/anthropics/claude-code/releases

3. Restart FictionLab
4. Menu → Claude Code → Login to Anthropic`;
    }

    await this.context.ui.showDialog({
      type: 'info',
      title: 'Manual Installation Instructions',
      message: 'Follow these steps to install Claude Code CLI:',
      detail: instructions,
      buttons: ['Close']
    });
  }

  // ==================== Authentication ====================

  /**
   * Login to Anthropic
   */
  private async login(): Promise<{ success: boolean; message: string }> {
    try {
      this.log('Starting authentication...');

      // Check if CLI is installed
      if (!await this.isInstalled()) {
        const install = await this.context.ui.showDialog({
          type: 'question',
          title: 'Claude Code Not Installed',
          message: 'Claude Code CLI is not installed. Would you like to install it now?',
          buttons: ['Install', 'Cancel'],
          defaultId: 0
        });

        if (install && install.response === 0) {
          const installResult = await this.installCLI();
          if (!installResult.success) {
            return installResult;
          }
        } else {
          return { success: false, message: 'Installation cancelled' };
        }
      }

      // Show login instructions
      await this.context.ui.showDialog({
        type: 'info',
        title: 'Login to Anthropic',
        message: 'A browser window will open for authentication.',
        detail: 'Please login to your Anthropic account in the browser.\n\nOnce logged in, return to FictionLab and click OK.',
        buttons: ['OK']
      });

      // Run claude auth login (spawned to allow browser interaction)
      this.log('Running: claude auth login');

      const loginProcess = childProcess.spawn('claude', ['auth', 'login'], {
        stdio: 'inherit',
        shell: true
      });

      await new Promise<void>((resolve, reject) => {
        loginProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Login process exited with code ${code}`));
          }
        });

        loginProcess.on('error', (error) => {
          reject(error);
        });
      });

      // Verify authentication
      const authed = await this.isAuthenticated();
      if (authed) {
        await this.context.config.set('authenticated', true);
        this.context.ui.showNotification({
          type: 'success',
          message: 'Successfully authenticated with Anthropic!'
        });
        this.log('Authentication successful');
        return { success: true, message: 'Authenticated successfully' };
      } else {
        throw new Error('Authentication verification failed');
      }

    } catch (error: any) {
      this.log(`Login failed: ${error.message}`, 'error');
      this.context.ui.showNotification({
        type: 'error',
        message: `Login failed: ${error.message}`
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Check authentication status
   */
  private async checkAuth(): Promise<{ success: boolean; authenticated: boolean; message: string }> {
    try {
      const authed = await this.isAuthenticated();

      if (authed) {
        // Try to get user info
        try {
          const { stdout } = await exec('claude auth whoami', { timeout: 5000 });
          const message = `Authenticated: ${stdout.trim()}`;
          this.context.ui.showNotification({
            type: 'success',
            message
          });
          return { success: true, authenticated: true, message };
        } catch {
          this.context.ui.showNotification({
            type: 'success',
            message: 'You are authenticated with Anthropic'
          });
          return { success: true, authenticated: true, message: 'Authenticated' };
        }
      } else {
        const login = await this.context.ui.showDialog({
          type: 'question',
          title: 'Not Authenticated',
          message: 'You are not authenticated with Anthropic. Would you like to login now?',
          buttons: ['Login', 'Cancel'],
          defaultId: 0
        });

        if (login && login.response === 0) {
          const loginResult = await this.login();
          return {
            success: loginResult.success,
            authenticated: loginResult.success,
            message: loginResult.message
          };
        }

        return { success: true, authenticated: false, message: 'Not authenticated' };
      }
    } catch (error: any) {
      this.log(`Auth check failed: ${error.message}`, 'error');
      return { success: false, authenticated: false, message: error.message };
    }
  }

  /**
   * Check if user is authenticated
   */
  private async isAuthenticated(): Promise<boolean> {
    try {
      const { stdout } = await exec('claude auth status', { timeout: 5000 });
      return stdout.includes('authenticated') || stdout.includes('logged in');
    } catch (error) {
      return false;
    }
  }

  // ==================== Task Execution ====================

  /**
   * Run a Claude Code task
   */
  private async runTask(formData: TaskFormData): Promise<TaskResult> {
    try {
      // Check authentication
      if (!await this.isAuthenticated()) {
        const login = await this.context.ui.showDialog({
          type: 'question',
          title: 'Authentication Required',
          message: 'You must be logged in to run tasks. Login now?',
          buttons: ['Login', 'Cancel'],
          defaultId: 0
        });

        if (login && login.response === 0) {
          const loginResult = await this.login();
          if (!loginResult.success) {
            return {
              success: false,
              error: 'Authentication required',
              exitCode: 1
            };
          }
        } else {
          return {
            success: false,
            error: 'Authentication required',
            exitCode: 1
          };
        }
      }

      this.log(`Executing task: ${formData.prompt.substring(0, 50)}...`);

      // Build command
      let command = 'claude --headless';

      // Combine prompt and context
      let fullPrompt = formData.prompt;
      if (formData.context) {
        fullPrompt = `${formData.context}\n\n${formData.prompt}`;
      }

      // Escape and add prompt
      const escapedPrompt = fullPrompt.replace(/"/g, '\\"');
      command += ` "${escapedPrompt}"`;

      this.log(`Running: ${command.substring(0, 100)}...`);

      // Execute with timeout
      const { stdout, stderr } = await exec(command, {
        cwd: formData.workingDirectory || process.cwd(),
        timeout: (formData.timeout || 300) * 1000,
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });

      return {
        success: true,
        output: stdout,
        exitCode: 0
      };

    } catch (error: any) {
      this.log(`Task execution error: ${error.message}`, 'error');

      return {
        success: false,
        error: error.message,
        output: error.stdout || '',
        exitCode: error.code || 1
      };
    }
  }

  // ==================== Utilities ====================

  /**
   * Check if Claude Code CLI is installed
   */
  private async isInstalled(): Promise<boolean> {
    try {
      await exec('claude --version', { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Log message
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (level === 'error') {
      this.context.logger.error(message);
    } else if (level === 'warn') {
      this.context.logger.warn(message);
    } else {
      this.context.logger.info(message);
    }
  }
}
