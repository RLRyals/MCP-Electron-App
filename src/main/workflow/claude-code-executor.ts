/**
 * Claude Code Executor
 *
 * Executes Claude Code skills headlessly via the Claude CLI
 * Tracks sessions and parses JSON output for workflow integration
 */

import { spawn, ChildProcess } from 'child_process';
import { logWithCategory, LogCategory } from '../logger';

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

export class ClaudeCodeExecutor {
  private sessions: Map<string, ClaudeCodeSession> = new Map();

  /**
   * Execute a skill with Claude Code
   */
  async executeSkill(
    skillName: string,
    phaseNumber: number,
    prompt: string,
    context?: object
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
      const result = await this.runClaudeCode(prompt, skillName, session, context);

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
   * Command: claude -p "prompt" --skill skillName --output-format json
   */
  private async runClaudeCode(
    prompt: string,
    skillName: string,
    session: ClaudeCodeSession,
    context?: object
  ): Promise<object> {
    return new Promise((resolve, reject) => {
      // Construct Claude Code command
      const args = [
        '-p', prompt,
        '--skill', skillName,
        '--output-format', 'json'
      ];

      logWithCategory('debug', LogCategory.WORKFLOW,
        `Spawning Claude Code: claude ${args.join(' ')}`);

      const claudeProcess = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true // Use shell to ensure PATH is respected
      });

      session.process = claudeProcess;

      let stdout = '';
      let stderr = '';

      claudeProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        session.output.push(output);

        logWithCategory('debug', LogCategory.WORKFLOW,
          `Claude Code stdout: ${output.substring(0, 200)}...`);
      });

      claudeProcess.stderr?.on('data', (data) => {
        const error = data.toString();
        stderr += error;

        logWithCategory('debug', LogCategory.WORKFLOW,
          `Claude Code stderr: ${error}`);
      });

      claudeProcess.on('close', (code) => {
        if (code === 0) {
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

      claudeProcess.on('error', (error) => {
        reject(new Error(`Failed to start Claude Code: ${error.message}. Ensure 'claude' CLI is installed and in PATH.`));
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
