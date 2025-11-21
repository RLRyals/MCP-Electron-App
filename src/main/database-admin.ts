/**
 * Database Administration Module
 * Handles communication with MCP-Writing-Servers database administration tools
 * Uses JSON-RPC 2.0 protocol over HTTP
 */

import axios, { AxiosError } from 'axios';
import { logWithCategory, LogCategory } from './logger';
import * as envConfig from './env-config';

/**
 * Database operation result
 */
export interface DatabaseOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * MCP Tool call request (JSON-RPC 2.0)
 */
interface MCPToolRequest {
  jsonrpc: '2.0';
  method: 'tools/call';
  params: {
    name: string;
    arguments: any;
  };
  id: string | number;
}

/**
 * MCP Tool call response (JSON-RPC 2.0)
 */
interface MCPToolResponse {
  jsonrpc: '2.0';
  result?: {
    content: Array<{
      type: 'text';
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

/**
 * Get the MCP server base URL
 */
async function getMCPServerUrl(): Promise<string> {
  try {
    const config = await envConfig.loadEnvConfig();
    const port = config.DB_ADMIN_PORT; // Database admin server port
    return `http://localhost:${port}`;
  } catch (error) {
    // Default to port 3010 if config fails
    return 'http://localhost:3010';
  }
}

/**
 * Call an MCP tool using JSON-RPC 2.0 protocol
 */
async function callMCPTool(toolName: string, args: any): Promise<DatabaseOperationResult> {
  logWithCategory('info', LogCategory.SYSTEM, `Calling MCP tool: ${toolName}`);

  const baseUrl = await getMCPServerUrl();

  try {
    const requestId = Date.now();

    const request: MCPToolRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
      id: requestId,
    };

    logWithCategory('info', LogCategory.SYSTEM, `MCP Request to ${baseUrl}/api/tool-call`, {
      tool: toolName,
      args: JSON.stringify(args).substring(0, 200),
    });

    const response = await axios.post<MCPToolResponse>(`${baseUrl}/api/tool-call`, request, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const mcpResponse = response.data;

    // Check for JSON-RPC error
    if (mcpResponse.error) {
      logWithCategory('error', LogCategory.SYSTEM, 'MCP tool call failed', mcpResponse.error);
      return {
        success: false,
        error: mcpResponse.error.message,
        data: mcpResponse.error.data,
      };
    }

    // Extract result from JSON-RPC response
    if (mcpResponse.result?.content?.[0]?.text) {
      try {
        const resultData = JSON.parse(mcpResponse.result.content[0].text);
        logWithCategory('info', LogCategory.SYSTEM, `MCP tool ${toolName} completed successfully`);
        return {
          success: true,
          data: resultData,
        };
      } catch (parseError) {
        // If not JSON, return as plain text
        return {
          success: true,
          data: mcpResponse.result.content[0].text,
        };
      }
    }

    // No result content
    return {
      success: true,
      data: null,
      message: 'Tool executed successfully with no data returned',
    };

  } catch (error: any) {
    const axiosError = error as AxiosError;

    if (axiosError.code === 'ECONNREFUSED') {
      // Extract port from baseUrl for error message
      const portMatch = baseUrl.match(/:(\d+)$/);
      const port = portMatch ? portMatch[1] : '3010';
      logWithCategory('error', LogCategory.SYSTEM, 'Cannot connect to MCP database server', {
        message: `Server not running on port ${port}`,
      });
      return {
        success: false,
        error: 'Database administration server is not running. Please start the MCP system first.',
      };
    }

    if (axiosError.code === 'ETIMEDOUT') {
      logWithCategory('error', LogCategory.SYSTEM, 'MCP tool call timed out', { tool: toolName });
      return {
        success: false,
        error: 'Request timed out after 30 seconds',
      };
    }

    const errorMessage = error.message || String(error);
    logWithCategory('error', LogCategory.SYSTEM, `Error calling MCP tool ${toolName}`, {
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ===================
// CRUD Operations
// ===================

/**
 * Query records from a table
 */
export async function queryRecords(params: {
  table: string;
  columns?: string[];
  where?: Record<string, any>;
  orderBy?: Array<{ column: string; direction: 'ASC' | 'DESC' }>;
  limit?: number;
  offset?: number;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_query_records', params);
}

/**
 * Insert a record into a table
 */
export async function insertRecord(params: {
  table: string;
  data: Record<string, any>;
  returnRecord?: boolean;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_insert_record', params);
}

/**
 * Update records in a table
 */
export async function updateRecords(params: {
  table: string;
  data: Record<string, any>;
  where: Record<string, any>;
  returnRecords?: boolean;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_update_records', params);
}

/**
 * Delete records from a table
 */
export async function deleteRecords(params: {
  table: string;
  where: Record<string, any>;
  softDelete?: boolean;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_delete_records', params);
}

// ===================
// Batch Operations
// ===================

/**
 * Batch insert multiple records
 */
export async function batchInsert(params: {
  table: string;
  records: Array<Record<string, any>>;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_batch_insert', params);
}

/**
 * Batch update multiple records
 */
export async function batchUpdate(params: {
  table: string;
  updates: Array<{
    where: Record<string, any>;
    data: Record<string, any>;
  }>;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_batch_update', params);
}

/**
 * Batch delete multiple sets of records
 */
export async function batchDelete(params: {
  table: string;
  conditions: Array<Record<string, any>>;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_batch_delete', params);
}

// ===================
// Schema Management
// ===================

/**
 * Get schema information for a table
 */
export async function getSchema(params: {
  table: string;
  includeConstraints?: boolean;
  includeIndexes?: boolean;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_get_schema', params);
}

/**
 * List all available tables
 */
export async function listTables(): Promise<DatabaseOperationResult> {
  return callMCPTool('db_list_tables', {});
}

/**
 * Get table relationships
 */
export async function getRelationships(params: {
  table?: string;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_get_relationships', params);
}

/**
 * List columns for a table
 */
export async function listColumns(params: {
  table: string;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_list_columns', params);
}

// ===================
// Audit Functions
// ===================

/**
 * Query audit logs
 */
export async function queryAuditLogs(params: {
  table?: string;
  operation?: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_query_audit_logs', params);
}

/**
 * Get audit summary
 */
export async function getAuditSummary(params: {
  table?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DatabaseOperationResult> {
  return callMCPTool('db_get_audit_summary', params);
}

// ===================
// Connection Status
// ===================

/**
 * Check if database admin server is accessible
 */
export async function checkConnection(): Promise<DatabaseOperationResult> {
  try {
    const baseUrl = await getMCPServerUrl();

    // Try a simple health check or list tables
    const response = await axios.get(`${baseUrl}/health`, {
      timeout: 5000,
    }).catch(() => {
      // If /health doesn't exist, try calling a simple tool
      return callMCPTool('db_list_tables', {});
    });

    return {
      success: true,
      message: 'Connected to database administration server',
    };
  } catch (error: any) {
    return {
      success: false,
      error: 'Cannot connect to database administration server',
    };
  }
}

/**
 * Get database server info
 */
export async function getServerInfo(): Promise<DatabaseOperationResult> {
  return callMCPTool('db_get_server_info', {});
}
