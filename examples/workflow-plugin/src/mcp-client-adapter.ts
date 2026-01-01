import { IMCPClient } from '../bundled/workflow-runner/dist';
import { PluginContext } from './types/plugin-api';

/**
 * Adapter that wraps FictionLab's PersistentMCPClient
 * Implements IMCPClient interface for workflow-runner
 */
export class MCPClientAdapter implements IMCPClient {
  constructor(private context: PluginContext) {}

  async start(): Promise<void> {
    // FictionLab's MCP client is already running
    // Just verify connection
    const servers = await this.context.services.mcp.listServers();
    if (!servers.includes('workflow-manager')) {
      throw new Error('workflow-manager MCP server not available');
    }
  }

  async callTool<T = any>(toolName: string, args: any): Promise<T> {
    // Direct passthrough to FictionLab's MCP service
    return this.context.services.mcp.callTool<T>('workflow-manager', toolName, args);
  }

  async shutdown(): Promise<void> {
    // Don't shutdown - FictionLab owns the connection
    // Just a no-op
  }

  get started(): boolean {
    // Always return true - FictionLab manages the connection
    return true;
  }
}
