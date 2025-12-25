/**
 * Claude Code Executor
 *
 * Executes Claude Code skills headlessly via the Claude CLI
 * Tracks sessions and parses JSON output for workflow integration
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logWithCategory, LogCategory } from '../logger';
import { ClaudeCodeDetector } from '../claude-code-detector';
import type { PTYManager } from '../pty-manager';

export interface ClaudeCodeSession {
  id: string;
  phaseNumber: number;
  skillName: string;
  process?: ChildProcess;
  ptyId?: string;  // For interactive sessions using PTY
  output: string[];
  status: 'running' | 'completed' | 'failed';
}

export interface ClaudeCodeResult {
  success: boolean;
  output: object;
  error?: string;
  session_id: string;
}

export class ClaudeCodeExecutor extends EventEmitter {
  private static instance?: ClaudeCodeExecutor;
  private sessions: Map<string, ClaudeCodeSession> = new Map();
  private detector: ClaudeCodeDetector;
  private ptyManager?: PTYManager;

  constructor(ptyManager?: PTYManager) {
    super();
    this.detector = new ClaudeCodeDetector();
    this.ptyManager = ptyManager;
  }

  /**
   * Get or create singleton instance
   * This ensures all parts of the app use the same executor
   */
  static getInstance(ptyManager?: PTYManager): ClaudeCodeExecutor {
    if (!ClaudeCodeExecutor.instance) {
      ClaudeCodeExecutor.instance = new ClaudeCodeExecutor(ptyManager);
    } else if (ptyManager && !ClaudeCodeExecutor.instance.ptyManager) {
      // If PTY manager is provided later, update the instance
      ClaudeCodeExecutor.instance.ptyManager = ptyManager;
    }
    return ClaudeCodeExecutor.instance;
  }

  /**
   * Execute a skill with Claude Code
   */
  async executeSkill(
    skillName: string,
    phaseNumber: number,
    prompt: string,
    context?: object,
    headless: boolean = true
  ): Promise<ClaudeCodeResult> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: ClaudeCodeSession = {
      id: sessionId,
      phaseNumber,
      skillName,
      output: [],
      status: 'running'
    };

    this.sessions.set(sessionId, session);

    logWithCategory('info', LogCategory.WORKFLOW,
      `Starting Claude Code session: ${sessionId} for skill: ${skillName}`);

    try {
      // Execute Claude Code with skill
      const result = await this.runClaudeCode(prompt, skillName, session, context, headless);

      session.status = 'completed';
      logWithCategory('info', LogCategory.WORKFLOW,
        `Completed Claude Code session: ${sessionId}`);

      return {
        success: true,
        output: result,
        session_id: sessionId
      };

    } catch (error: any) {
      session.status = 'failed';
      logWithCategory('error', LogCategory.WORKFLOW,
        `Claude Code session failed: ${sessionId} - ${error.message}`);

      return {
        success: false,
        output: {},
        error: error.message,
        session_id: sessionId
      };
    }
  }

  /**
   * Run Claude Code CLI
   * Checks if Claude is installed and user is logged in before executing
   */
  private async runClaudeCode(
    prompt: string,
    skillName: string,
    session: ClaudeCodeSession,
    context?: object,
    headless: boolean = true
  ): Promise<object> {
    // 1. Check if Claude CLI is available
    const status = await this.detector.getStatus();

    if (!status.installed) {
      logWithCategory('warn', LogCategory.WORKFLOW,
        'Claude Code CLI is not installed');

      // Emit event to trigger setup wizard
      this.emit('claude-setup-required', {
        reason: 'not_installed',
        status
      });

      throw new Error(
        'Claude Code CLI is not installed.\n\n' +
        'A setup wizard will guide you through installation.'
      );
    }

    if (!status.loggedIn) {
      logWithCategory('warn', LogCategory.WORKFLOW,
        'User is not logged in to Claude');

      // Emit event to trigger login prompt
      this.emit('claude-setup-required', {
        reason: 'not_logged_in',
        status
      });

      throw new Error(
        'You are not logged in to Claude.\n\n' +
        'Please log in through the setup wizard.'
      );
    }

    logWithCategory('info', LogCategory.WORKFLOW,
      `Claude Code ready - version ${status.version}, user: ${status.userName}`);

    // 2. All checks passed - execute command
    return new Promise((resolve, reject) => {
      // Construct Claude Code command
      const args = [];

      if (skillName) {
        args.push('--skill', skillName);
      }

      // Headless mode: add --print for non-interactive JSON output
      // Interactive mode: pass prompt as argument for conversation
      if (headless) {
        args.push('--print');
        args.push('--output-format', 'json');
      }

      // CRITICAL: Interactive mode needs 'inherit' stdio to allow user interaction
      // Headless mode uses 'pipe' to capture JSON output
      let claudeProcess: ChildProcess;
      let stdout = '';
      let stderr = '';

      if (headless) {
        // Extract project folder from context for workspace setup
        const projectFolder = (context as any)?.projectFolder;
        const workingDir = projectFolder || process.cwd();

        // Headless mode: pipe stdio to capture output, prompt via stdin
        logWithCategory('info', LogCategory.WORKFLOW,
          `Spawning Claude Code in HEADLESS mode: claude ${args.join(' ')} (prompt via stdin, length: ${prompt.length} chars)`);
        logWithCategory('info', LogCategory.WORKFLOW,
          `Claude Code workspace: ${workingDir}${projectFolder ? ' (from workflow)' : ' (default)'}`);

        claudeProcess = spawn('claude', args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
          cwd: workingDir
        });

        session.process = claudeProcess;

        // Write prompt to stdin
        try {
          claudeProcess.stdin?.write(prompt);
          claudeProcess.stdin?.end();
        } catch (error: any) {
          logWithCategory('error', LogCategory.WORKFLOW,
            `Failed to write prompt to stdin: ${error.message}`);
          reject(new Error(`Failed to write prompt to stdin: ${error.message}`));
          return;
        }

        // Capture output
        claudeProcess.stdout?.on('data', (data: Buffer) => {
          const output = data.toString();
          stdout += output;
          session.output.push(output);

          logWithCategory('debug', LogCategory.WORKFLOW,
            `Claude Code stdout: ${output.substring(0, 200)}...`);

          // Stream output to terminal in real-time
          this.emit('claude-output', {
            sessionId: session.id,
            data: output,
            stream: 'stdout'
          });
        });

        claudeProcess.stderr?.on('data', (data: Buffer) => {
          const error = data.toString();
          stderr += error;

          logWithCategory('debug', LogCategory.WORKFLOW,
            `Claude Code stderr: ${error}`);

          // Stream stderr to terminal in real-time
          this.emit('claude-output', {
            sessionId: session.id,
            data: error,
            stream: 'stderr'
          });
        });
      } else {
        // Interactive mode: use PTY for terminal interaction
        if (!this.ptyManager) {
          reject(new Error('Interactive mode requires PTY manager, but none was provided'));
          return;
        }

        // Add prompt as final argument
        args.push(prompt);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
        // Use the standard terminal ID that the UI expects
        const ptyId = 'claude-code-terminal';

        logWithCategory('info', LogCategory.WORKFLOW,
          `Starting Claude Code in INTERACTIVE mode via PTY: claude ${args.slice(0, -1).join(' ')} "<prompt>" (length: ${prompt.length} chars)`);
        logWithCategory('info', LogCategory.WORKFLOW,
          'Interactive mode: User will see prompt and can have conversation');
        logWithCategory('info', LogCategory.WORKFLOW,
          `Transcript will be saved as: transcript_${timestamp}.md`);
        logWithCategory('info', LogCategory.WORKFLOW,
          `PTY terminal ID: ${ptyId}`);

        // Store PTY ID and timestamp in session
        session.ptyId = ptyId;
        (session as any).transcriptTimestamp = timestamp;

        // Extract project folder from context for workspace setup
        const projectFolder = (context as any)?.projectFolder;
        const workingDir = projectFolder || process.cwd();

        logWithCategory('info', LogCategory.WORKFLOW,
          `Claude Code workspace: ${workingDir}${projectFolder ? ' (from workflow)' : ' (default)'}`);

        // Create PTY terminal for interactive Claude session
        try {
          this.ptyManager.createTerminal({
            id: ptyId,
            command: 'claude',
            args: args,
            cwd: workingDir
          });

          // Listen for PTY exit
          const exitHandler = (data: { id: string; exitCode: number }) => {
            if (data.id === ptyId) {
              logWithCategory('info', LogCategory.WORKFLOW,
                `Interactive Claude session exited with code ${data.exitCode}`);

              session.status = data.exitCode === 0 ? 'completed' : 'failed';

              // Remove listener
              this.ptyManager?.off('terminal:exit', exitHandler);

              if (data.exitCode === 0) {
                resolve({
                  interactive: true,
                  message: 'Interactive conversation completed. Transcript saved.',
                  skill: skillName,
                  session_id: session.id,
                  transcript_file: `transcript_${timestamp}.md`,
                  raw_output: `Interactive session completed.\nTranscript saved as: transcript_${timestamp}.md`
                });
              } else {
                reject(new Error(`Claude Code exited with code ${data.exitCode}`));
              }
            }
          };

          this.ptyManager.on('terminal:exit', exitHandler);

          logWithCategory('info', LogCategory.WORKFLOW,
            `Interactive PTY terminal created: ${ptyId}`);

          // Don't wait for close event - PTY exit handler will resolve/reject
          return;

        } catch (error: any) {
          logWithCategory('error', LogCategory.WORKFLOW,
            `Failed to create PTY terminal: ${error.message}`);
          reject(new Error(`Failed to start interactive session: ${error.message}`));
          return;
        }
      }

      // Only headless mode uses claudeProcess close/error handlers
      // Interactive mode uses PTY exit handler (registered above)
      if (headless) {
        claudeProcess.on('close', (code: number) => {
          if (code === 0) {
            // Headless mode: parse JSON output
            try {
              // Parse JSON output
              // Claude Code may output multiple JSON objects or mixed output
              // Try to extract JSON from the output
              const jsonMatch = stdout.match(/\{[\s\S]*\}/);

              if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                resolve(result);
              } else {
                // If no JSON found, return raw output wrapped in object
                resolve({
                  raw_output: stdout.trim(),
                  skill: skillName,
                  session_id: session.id
                });
              }
            } catch (error) {
              logWithCategory('warn', LogCategory.WORKFLOW,
                `Failed to parse Claude Code JSON output, returning raw: ${error}`);

              // Return raw output if JSON parsing fails
              resolve({
                raw_output: stdout.trim(),
                skill: skillName,
                session_id: session.id,
                parse_error: String(error)
              });
            }
          } else {
            reject(new Error(`Claude Code exited with code ${code}: ${stderr || 'No error output'}`));
          }
        });

        claudeProcess.on('error', (error: Error) => {
          reject(new Error(`Failed to start Claude Code: ${error.message}`));
        });
      }
    });
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ClaudeCodeSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Cancel session
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session && session.process) {
      session.process.kill();
      session.status = 'failed';

      logWithCategory('info', LogCategory.WORKFLOW,
        `Cancelled Claude Code session: ${sessionId}`);

      return true;
    }
    return false;
  }

  /**
   * Clean up old sessions (keep only last 100)
   */
  cleanupSessions(): void {
    const sessions = Array.from(this.sessions.entries());

    if (sessions.length > 100) {
      // Keep only the most recent 100 sessions
      const toDelete = sessions
        .sort((a, b) => {
          // Extract timestamp from session ID
          const tsA = parseInt(a[0].split('-')[1]);
          const tsB = parseInt(b[0].split('-')[1]);
          return tsA - tsB;
        })
        .slice(0, sessions.length - 100);

      toDelete.forEach(([sessionId]) => {
        this.sessions.delete(sessionId);
      });

      logWithCategory('debug', LogCategory.WORKFLOW,
        `Cleaned up ${toDelete.length} old Claude Code sessions`);
    }
  }
}
