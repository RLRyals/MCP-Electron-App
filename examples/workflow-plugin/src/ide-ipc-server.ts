import * as net from 'net';
import { WorkflowRunner } from '@fictionlab/workflow-runner';

/**
 * IDE IPC Server
 *
 * Listens for workflow execution requests from Claude Code skill.
 * Uses Unix domain socket (or named pipe on Windows) for IPC.
 */
export class IDEIPCServer {
  private server: net.Server | null = null;
  private socketPath: string;
  private runner: WorkflowRunner;

  constructor(runner: WorkflowRunner) {
    this.runner = runner;

    // Use named pipe on Windows, Unix socket on Unix-like systems
    if (process.platform === 'win32') {
      this.socketPath = '\\\\.\\pipe\\fictionlab-workflow-runner';
    } else {
      this.socketPath = '/tmp/fictionlab-workflow-runner.sock';
    }
  }

  /**
   * Start the IPC server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        console.log('[IDE IPC Server] Client connected');

        let buffer = '';

        socket.on('data', async (data) => {
          buffer += data.toString();

          // Process complete JSON messages (newline-delimited)
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const request = JSON.parse(line);
              const response = await this.handleRequest(request);
              socket.write(JSON.stringify(response) + '\n');
            } catch (error) {
              const errorResponse = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
              socket.write(JSON.stringify(errorResponse) + '\n');
            }
          }
        });

        socket.on('end', () => {
          console.log('[IDE IPC Server] Client disconnected');
        });

        socket.on('error', (err) => {
          console.error('[IDE IPC Server] Socket error:', err);
        });
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error('[IDE IPC Server] Socket already in use, cleaning up...');
          // Try to remove old socket and retry
          if (process.platform !== 'win32') {
            try {
              require('fs').unlinkSync(this.socketPath);
              this.start().then(resolve).catch(reject);
            } catch (e) {
              reject(err);
            }
          } else {
            reject(err);
          }
        } else {
          reject(err);
        }
      });

      this.server.listen(this.socketPath, () => {
        console.log(`[IDE IPC Server] Listening on ${this.socketPath}`);
        resolve();
      });
    });
  }

  /**
   * Handle incoming IPC request
   */
  private async handleRequest(request: any): Promise<any> {
    const { method, params } = request;

    switch (method) {
      case 'workflow:list':
        return await this.runner.listWorkflows(params?.filters);

      case 'workflow:get':
        return await this.runner.getWorkflow(params?.id, params?.version);

      case 'workflow:execute':
        return await this.runner.execute(params?.workflowId, params?.options);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Stop the IPC server
   */
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[IDE IPC Server] Server closed');

          // Clean up socket file on Unix-like systems
          if (process.platform !== 'win32') {
            try {
              require('fs').unlinkSync(this.socketPath);
            } catch (e) {
              // Ignore errors
            }
          }

          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
