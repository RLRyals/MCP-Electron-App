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

export interface ClaudeCodeSession {
  id: string;
  phaseNumber: number;
  skillName: string;
  process?: ChildProcess;
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

  constructor() {
    super();
    this.detector = new ClaudeCodeDetector();
  }

  /**
   * Get or create singleton instance
   * This ensures all parts of the app use the same executor
   */
  static getInstance(): ClaudeCodeExecutor {
    if (!ClaudeCodeExecutor.instance) {
      ClaudeCodeExecutor.instance = new ClaudeCodeExecutor();
    }
    return ClaudeCodeExecutor.instance;
  }

  /**
   * Execute Claude Code with optional agent (headless only)
   */
  async executeSkill(
    agentName: string | null,
    phaseNumber: number,
    prompt: string,
    context?: object
  ): Promise<ClaudeCodeResult> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: ClaudeCodeSession = {
      id: sessionId,
      phaseNumber,
      skillName: agentName || '',
      output: [],
      status: 'running'
    };

    this.sessions.set(sessionId, session);

    logWithCategory('info', LogCategory.WORKFLOW,
      `Starting Claude Code session: ${sessionId}${agentName ? ` with agent: ${agentName}` : ''}`);

    try {
      // Execute Claude Code with optional agent
      const result = await this.runClaudeCode(prompt, agentName, session, context);

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
   * Run Claude Code CLI in headless mode
   * Checks if Claude is installed before executing
   */
  private async runClaudeCode(
    prompt: string,
    agentName: string | null,
    session: ClaudeCodeSession,
    context?: object
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

    logWithCategory('info', LogCategory.WORKFLOW,
      `Claude Code ready - version ${status.version}`);

    // 2. All checks passed - execute command
    return new Promise((resolve, reject) => {
      // Construct Claude Code command for headless mode
      const args = ['--print', '--output-format', 'json'];

      if (agentName) {
        args.push('--agent', agentName);
      }

      // Extract project folder from context for workspace setup
      const projectFolder = (context as any)?.projectFolder;
      const workingDir = projectFolder || process.cwd();

      logWithCategory('info', LogCategory.WORKFLOW,
        `Spawning Claude Code in HEADLESS mode: claude ${args.join(' ')} (prompt via stdin, length: ${prompt.length} chars)`);
      logWithCategory('info', LogCategory.WORKFLOW,
        `Claude Code workspace: ${workingDir}${projectFolder ? ' (from workflow)' : ' (default)'}`);

      const claudeProcess = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        cwd: workingDir
      });

      session.process = claudeProcess;

      let stdout = '';
      let stderr = '';

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
      });

      claudeProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        stderr += error;

        logWithCategory('debug', LogCategory.WORKFLOW,
          `Claude Code stderr: ${error}`);
      });

      claudeProcess.on('close', (code: number) => {
        if (code === 0) {
          try {
            // Parse JSON output
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);
              resolve(result);
            } else {
              // If no JSON found, return raw output wrapped in object
              resolve({
                raw_output: stdout.trim(),
                agent: agentName,
                session_id: session.id
              });
            }
          } catch (error) {
            logWithCategory('warn', LogCategory.WORKFLOW,
              `Failed to parse Claude Code JSON output, returning raw: ${error}`);

            // Return raw output if JSON parsing fails
            resolve({
              raw_output: stdout.trim(),
              agent: agentName,
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
