/**
 * Claude Code CLI Adapter
 *
 * Adapter for executing Claude Code via CLI (headless mode)
 * Uses existing ClaudeCodeExecutor wrapped in the adapter interface
 */

import { LLMProviderAdapter } from '../provider-manager';
import { LLMRequest, LLMResponse, ProviderValidationResult, ClaudeCodeCLIProvider } from '../../../types/llm-providers';
import { ClaudeCodeExecutor } from '../../workflow/claude-code-executor';
import { logWithCategory, LogCategory } from '../../logger';

export class ClaudeCodeCLIAdapter implements LLMProviderAdapter {
  type: ClaudeCodeCLIProvider['type'] = 'claude-code-cli';
  streamSupport = true;
  private executor: ClaudeCodeExecutor;

  constructor() {
    this.executor = new ClaudeCodeExecutor();

    // Forward claude-setup-required events from executor to provider manager
    // This allows the main process to catch and forward to renderer
    this.executor.on('claude-setup-required', (data) => {
      // Re-emit on global event bus
      const { getProviderManager } = require('../provider-manager');
      const manager = getProviderManager();
      manager.emit('claude-setup-required', data);
    });
  }

  /**
   * Execute request with Claude Code CLI
   */
  async execute(request: LLMRequest): Promise<LLMResponse> {
    const provider = request.provider as ClaudeCodeCLIProvider;

    try {
      // Extract skill from context if available
      const skill = request.context?.skill || null;
      const phaseNumber = request.context?.phaseNumber || 0;

      logWithCategory('info', LogCategory.WORKFLOW,
        `Executing Claude Code CLI with skill: ${skill || 'none'}`);

      // Execute via existing ClaudeCodeExecutor
      const result = await this.executor.executeSkill(
        skill,
        phaseNumber,
        request.prompt
      );

      if (!result.success) {
        return {
          success: false,
          output: null,
          error: result.error || 'Execution failed',
        };
      }

      return {
        success: true,
        output: result.output,
        model: provider.config?.model || 'claude-sonnet-4-5',
      };

    } catch (error: any) {
      logWithCategory('error', LogCategory.WORKFLOW,
        `Claude Code CLI execution failed: ${error.message}`);

      return {
        success: false,
        output: null,
        error: error.message,
      };
    }
  }

  /**
   * Validate Claude Code CLI is available
   */
  async validateCredentials(credentials: any): Promise<ProviderValidationResult> {
    try {
      // Check if Claude CLI is available by running --version
      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const claude = spawn('claude', ['--version']);

        let output = '';

        claude.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        claude.stderr.on('data', (data: Buffer) => {
          output += data.toString();
        });

        claude.on('close', (code: number) => {
          if (code === 0) {
            resolve({
              valid: true,
              model: 'Claude Code CLI installed',
            });
          } else {
            resolve({
              valid: false,
              error: 'Claude Code CLI not found. Please install it first.',
            });
          }
        });

        claude.on('error', (error: Error) => {
          resolve({
            valid: false,
            error: `Claude Code CLI not available: ${error.message}`,
          });
        });
      });

    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }
}
