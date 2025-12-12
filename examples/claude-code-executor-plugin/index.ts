/**
 * Claude Code Executor Plugin
 *
 * Executes Claude Code CLI skills in headless mode for AI-powered writing workflows.
 * This plugin provides actions that workflows can call to execute skills.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { PluginContext } from '../../src/types/plugin-api';

interface ExecuteSkillConfig {
  skillPath: string;
  phase?: number;
  seriesId?: string;
  bookId?: string;
  bookNumber?: number;
  previousPhaseOutput?: string;
  userInput?: string;
  workspace?: string;
}

interface ExecutionResult {
  success: boolean;
  result?: {
    book_id?: string;
    outputs?: string[];
    metadata?: Record<string, any>;
  };
  error?: string;
}

/**
 * Claude Code Executor Plugin
 */
export class ClaudeCodeExecutorPlugin {
  private context!: PluginContext;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private claudeCodePath: string = 'claude-code';
  private defaultWorkspace: string = '';

  /**
   * Plugin activation
   */
  async onActivate(context: PluginContext): Promise<void> {
    this.context = context;

    // Load configuration
    const config = await context.config.get('claudeCodePath');
    if (config) {
      this.claudeCodePath = config;
    }

    const workspace = await context.config.get('defaultWorkspace');
    this.defaultWorkspace = workspace || path.join(os.homedir(), 'FictionLab');

    context.logger.info('Claude Code Executor plugin activated');
    context.logger.info(`Claude Code path: ${this.claudeCodePath}`);
    context.logger.info(`Default workspace: ${this.defaultWorkspace}`);

    // Register IPC handlers for workflow actions
    this.registerActions();

    // Verify Claude Code CLI is installed
    await this.verifyClaudeCodeInstalled();
  }

  /**
   * Plugin deactivation
   */
  async onDeactivate(): Promise<void> {
    // Cancel all active processes
    for (const [jobId, process] of this.activeProcesses.entries()) {
      this.context.logger.info(`Killing active process: ${jobId}`);
      process.kill();
    }
    this.activeProcesses.clear();

    this.context.logger.info('Claude Code Executor plugin deactivated');
  }

  /**
   * Register plugin actions that workflows can call
   */
  private registerActions(): void {
    // Action: execute-skill
    this.context.ipc.handle('execute-skill', async (event, config: ExecuteSkillConfig) => {
      return await this.executeSkill(config);
    });

    // Action: check-status
    this.context.ipc.handle('check-status', async (event, jobId: string) => {
      return {
        running: this.activeProcesses.has(jobId),
        activeJobs: this.activeProcesses.size,
      };
    });

    // Action: cancel
    this.context.ipc.handle('cancel', async (event, jobId: string) => {
      return await this.cancelExecution(jobId);
    });

    this.context.logger.info('Registered IPC handlers: execute-skill, check-status, cancel');
  }

  /**
   * Verify Claude Code CLI is installed and accessible
   */
  private async verifyClaudeCodeInstalled(): Promise<void> {
    return new Promise((resolve, reject) => {
      const versionCheck = spawn(this.claudeCodePath, ['--version'], {
        shell: process.platform === 'win32',
      });

      let output = '';
      versionCheck.stdout?.on('data', (data) => {
        output += data.toString();
      });

      versionCheck.on('close', (code) => {
        if (code === 0) {
          this.context.logger.info(`Claude Code CLI found: ${output.trim()}`);
          resolve();
        } else {
          this.context.logger.warn('Claude Code CLI not found or not accessible');
          this.context.ui.showNotification({
            type: 'warning',
            title: 'Claude Code CLI Not Found',
            message: 'Please install Claude Code CLI or set the path in plugin settings',
          });
          resolve(); // Don't reject - plugin can still be useful for configuration
        }
      });

      versionCheck.on('error', (err) => {
        this.context.logger.error('Error checking Claude Code CLI:', err);
        resolve(); // Don't reject
      });
    });
  }

  /**
   * Execute a Claude Code skill
   */
  private async executeSkill(config: ExecuteSkillConfig): Promise<ExecutionResult> {
    const jobId = `job-${Date.now()}`;
    this.context.logger.info(`Executing skill: ${config.skillPath} (job: ${jobId})`);

    // Determine workspace
    const workspace = config.workspace || this.defaultWorkspace;

    // Build arguments for Claude Code CLI
    const args: string[] = ['execute-skill'];

    // Extract skill name from path
    const skillName = path.basename(config.skillPath, '.md');
    args.push(skillName);

    // Add phase if specified
    if (config.phase) {
      args.push('--phase', config.phase.toString());
    }

    // Build input context
    const inputContext: string[] = [];
    if (config.seriesId) {
      inputContext.push(`Series ID: ${config.seriesId}`);
    }
    if (config.bookId) {
      inputContext.push(`Book ID: ${config.bookId}`);
    }
    if (config.bookNumber) {
      inputContext.push(`Book Number: ${config.bookNumber}`);
    }
    if (config.previousPhaseOutput) {
      inputContext.push(`Previous Phase Output: ${config.previousPhaseOutput}`);
    }
    if (config.userInput) {
      inputContext.push(`User Input: ${config.userInput}`);
    }

    if (inputContext.length > 0) {
      args.push('--input', inputContext.join('\n'));
    }

    this.context.logger.debug(`Claude Code args: ${JSON.stringify(args)}`);

    return new Promise((resolve) => {
      try {
        // Spawn Claude Code CLI
        const claudeCode = spawn(this.claudeCodePath, args, {
          cwd: workspace,
          env: {
            ...process.env,
            // Session token should be read from user's Claude config
          },
          shell: process.platform === 'win32',
        });

        this.activeProcesses.set(jobId, claudeCode);

        let stdoutData = '';
        let stderrData = '';
        const outputs: string[] = [];
        const metadata: Record<string, any> = {};

        // Handle stdout
        claudeCode.stdout?.on('data', (data: Buffer) => {
          const output = data.toString();
          stdoutData += output;
          this.context.logger.debug(`[${jobId}] ${output}`);

          // Parse for created files
          const fileMatch = output.match(/Created file: (.+)/);
          if (fileMatch) {
            outputs.push(fileMatch[1]);
          }

          // Parse for metadata
          const metadataMatch = output.match(/Metadata: (.+)/);
          if (metadataMatch) {
            try {
              Object.assign(metadata, JSON.parse(metadataMatch[1]));
            } catch (e) {
              // Ignore parse errors
            }
          }
        });

        // Handle stderr
        claudeCode.stderr?.on('data', (data: Buffer) => {
          const output = data.toString();
          stderrData += output;
          this.context.logger.warn(`[${jobId}] STDERR: ${output}`);
        });

        // Handle process exit
        claudeCode.on('close', (code: number | null) => {
          this.activeProcesses.delete(jobId);

          if (code === 0) {
            this.context.logger.info(`Skill execution completed successfully: ${jobId}`);

            // Extract book_id from output or generate
            let bookId = metadata.book_id || config.bookId;
            if (!bookId && outputs.length > 0) {
              // Try to extract from first output filename
              const match = outputs[0].match(/book[_-](\d+)/i);
              if (match) {
                bookId = `book-${match[1]}`;
              }
            }

            resolve({
              success: true,
              result: {
                book_id: bookId,
                outputs,
                metadata,
              },
            });
          } else {
            this.context.logger.error(`Skill execution failed: ${jobId}, code: ${code}`);
            resolve({
              success: false,
              error: stderrData || `Execution failed with exit code ${code}`,
            });
          }
        });

        // Handle errors
        claudeCode.on('error', (err: Error) => {
          this.activeProcesses.delete(jobId);
          this.context.logger.error(`Skill execution error: ${jobId}`, err);
          resolve({
            success: false,
            error: err.message,
          });
        });

      } catch (error: any) {
        this.context.logger.error('Error spawning Claude Code:', error);
        resolve({
          success: false,
          error: error.message,
        });
      }
    });
  }

  /**
   * Cancel a running execution
   */
  private async cancelExecution(jobId: string): Promise<{ success: boolean }> {
    const process = this.activeProcesses.get(jobId);

    if (!process) {
      return { success: false };
    }

    process.kill();
    this.activeProcesses.delete(jobId);
    this.context.logger.info(`Cancelled execution: ${jobId}`);

    return { success: true };
  }
}

// Export plugin factory
export default {
  id: 'claude-code-executor',
  name: 'Claude Code Executor',
  version: '1.0.0',

  async onActivate(context: PluginContext): Promise<void> {
    const plugin = new ClaudeCodeExecutorPlugin();
    await plugin.onActivate(context);

    // Store instance for deactivation
    (context as any)._pluginInstance = plugin;
  },

  async onDeactivate(context: PluginContext): Promise<void> {
    const plugin = (context as any)._pluginInstance;
    if (plugin) {
      await plugin.onDeactivate();
    }
  },
};
