/**
 * PTY Manager
 * Manages pseudo-terminal sessions for embedded terminal applications
 *
 * Enables running CLI tools like Claude Code, Ollama, or shells within
 * the Electron app's terminal panel.
 */

import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as os from 'os';
import logger from './logger';

export interface TerminalOptions {
  id: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  cols?: number;
  rows?: number;
}

export class PTYManager extends EventEmitter {
  private terminals: Map<string, pty.IPty> = new Map();

  /**
   * Create a new PTY session
   */
  createTerminal(options: TerminalOptions): void {
    const { id, command, args, cwd, env, cols = 80, rows = 30 } = options;

    // Check if terminal already exists
    if (this.terminals.has(id)) {
      logger.warn(`[PTYManager] Terminal ${id} already exists, closing existing session`);
      this.closeTerminal(id);
    }

    logger.debug(`[PTYManager] Creating terminal ${id}: ${command} ${args.join(' ')}`);

    // Determine shell based on platform if command is 'shell'
    let shellCommand = command;
    let shellArgs = args;

    if (command === 'shell') {
      if (os.platform() === 'win32') {
        shellCommand = 'powershell.exe';
        shellArgs = [];
      } else {
        shellCommand = process.env.SHELL || '/bin/bash';
        shellArgs = [];
      }
    }

    try {
      let spawnOptions: any = {
        name: 'xterm-color',
        cols,
        rows,
        cwd: cwd || process.cwd(),
        env: env || process.env,
      };

      // Platform-specific handling for commands that need PATH resolution
      const needsShellWrapper = !shellCommand.includes('/') && !shellCommand.includes('\\') && !shellCommand.endsWith('.exe');

      if (needsShellWrapper) {
        if (os.platform() === 'win32') {
          // Windows: Use cmd.exe to execute .cmd files and resolve PATH
          const originalCommand = shellCommand;
          const originalArgs = shellArgs;

          // Build the full command string with proper escaping
          // Quote arguments that contain spaces or special characters
          const quotedArgs = originalArgs.map(arg => {
            // If arg contains spaces, quotes, or special chars, wrap in quotes
            if (arg.includes(' ') || arg.includes('"') || arg.includes('&') || arg.includes('|')) {
              // Escape internal quotes and wrap in quotes
              return `"${arg.replace(/"/g, '""')}"`;
            }
            return arg;
          });

          shellCommand = 'cmd.exe';
          shellArgs = ['/c', originalCommand, ...quotedArgs];
          logger.debug(`[PTYManager] Windows shell wrapper: ${shellCommand} /c ${originalCommand} ${quotedArgs.join(' ')}`);
        } else {
          // Unix/macOS: Commands in PATH work directly with node-pty
          // No wrapper needed - node-pty uses the system's PATH
          logger.debug(`[PTYManager] Unix/macOS: spawning ${shellCommand} directly`);
        }
      }

      const shell = pty.spawn(shellCommand, shellArgs, spawnOptions);

      // Handle data from PTY
      shell.onData((data) => {
        logger.debug(`[PTYManager] Received data from terminal ${id}:`, data.substring(0, 100));
        this.emit('terminal:data', { id, data });
      });

      // Handle PTY exit
      shell.onExit((exitInfo) => {
        logger.debug(`[PTYManager] Terminal ${id} exited with code ${exitInfo.exitCode}`);
        this.emit('terminal:exit', { id, exitCode: exitInfo.exitCode });
        this.terminals.delete(id);
      });

      this.terminals.set(id, shell);
      logger.debug(`[PTYManager] Terminal ${id} created successfully`);
    } catch (error: any) {
      logger.error(`[PTYManager] Failed to create terminal ${id}:`, error);

      // If claude command fails, try falling back to PowerShell on Windows
      if (command === 'claude' && os.platform() === 'win32') {
        logger.debug(`[PTYManager] Claude not found, falling back to PowerShell for terminal ${id}`);
        try {
          const fallbackShell = pty.spawn('powershell.exe', [], {
            name: 'xterm-color',
            cols,
            rows,
            cwd: cwd || process.cwd(),
            env: env || process.env,
          });

          fallbackShell.onData((data) => {
            logger.debug(`[PTYManager] Received data from fallback terminal ${id}:`, data.substring(0, 100));
            this.emit('terminal:data', { id, data });
          });

          fallbackShell.onExit((exitInfo) => {
            logger.debug(`[PTYManager] Terminal ${id} exited with code ${exitInfo.exitCode}`);
            this.emit('terminal:exit', { id, exitCode: exitInfo.exitCode });
            this.terminals.delete(id);
          });

          this.terminals.set(id, fallbackShell);

          // Send a message to the terminal about the fallback
          setTimeout(() => {
            this.emit('terminal:data', {
              id,
              data: '\r\n\x1b[33mClaude Code execution failed.\x1b[0m\r\n' +
                    '\x1b[90mFalling back to PowerShell. Make sure Claude CLI is properly installed:\x1b[0m\r\n' +
                    '\x1b[90m  npm install -g @anthropic-ai/claude-code\x1b[0m\r\n\r\n'
            });
          }, 100);

          logger.debug(`[PTYManager] Fallback terminal ${id} created successfully`);
          return; // Success with fallback
        } catch (fallbackError: any) {
          logger.error(`[PTYManager] Fallback also failed for terminal ${id}:`, fallbackError);
          this.emit('terminal:error', { id, error: `Failed to start terminal: ${fallbackError.message}` });
          throw fallbackError;
        }
      }

      this.emit('terminal:error', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Write data to a PTY session (user input)
   */
  writeToTerminal(id: string, data: string): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      logger.debug(`[PTYManager] Writing to terminal ${id}:`, data);
      terminal.write(data);
    } else {
      logger.warn(`[PTYManager] Terminal ${id} not found, cannot write data`);
      logger.warn(`[PTYManager] Active terminals:`, Array.from(this.terminals.keys()));
    }
  }

  /**
   * Resize a PTY session
   */
  resizeTerminal(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.resize(cols, rows);
      logger.debug(`[PTYManager] Terminal ${id} resized to ${cols}x${rows}`);
    } else {
      logger.warn(`[PTYManager] Terminal ${id} not found, cannot resize`);
    }
  }

  /**
   * Close a PTY session
   */
  closeTerminal(id: string): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      try {
        // Check if the terminal process is still alive before killing
        if (typeof (terminal as any).pid !== 'undefined') {
          terminal.kill();
          logger.debug(`[PTYManager] Terminal ${id} closed`);
        } else {
          logger.debug(`[PTYManager] Terminal ${id} already exited`);
        }
      } catch (error: any) {
        // Suppress errors during shutdown - terminal may already be closed
        logger.debug(`[PTYManager] Error closing terminal ${id} (likely already closed):`, error.message);
      } finally {
        this.terminals.delete(id);
      }
    } else {
      logger.debug(`[PTYManager] Terminal ${id} not found, already closed`);
    }
  }

  /**
   * Close all PTY sessions
   */
  closeAll(): void {
    logger.debug(`[PTYManager] Closing all ${this.terminals.size} terminals`);
    for (const [id] of this.terminals) {
      try {
        this.closeTerminal(id);
      } catch (error: any) {
        logger.error(`[PTYManager] Error closing terminal ${id} during cleanup:`, error);
      }
    }
  }

  /**
   * Get list of active terminal IDs
   */
  getActiveTerminals(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Check if a terminal exists
   */
  hasTerminal(id: string): boolean {
    return this.terminals.has(id);
  }
}
