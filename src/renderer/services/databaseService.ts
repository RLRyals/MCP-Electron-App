/**
 * Database Service
 * Wrapper for database administration operations in the renderer process
 * Provides access to all MCP database tools
 */

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
 * Query parameters for database records
 */
export interface QueryParams {
  table: string;
  columns?: string[];
  where?: Record<string, any>;
  orderBy?: Array<{ column: string; direction: 'ASC' | 'DESC' }>;
  limit?: number;
  offset?: number;
}

/**
 * Insert parameters
 */
export interface InsertParams {
  table: string;
  data: Record<string, any>;
  returnRecord?: boolean;
}

/**
 * Update parameters
 */
export interface UpdateParams {
  table: string;
  data: Record<string, any>;
  where: Record<string, any>;
  returnRecords?: boolean;
}

/**
 * Delete parameters
 */
export interface DeleteParams {
  table: string;
  where: Record<string, any>;
  softDelete?: boolean;
}

/**
 * Batch insert parameters
 */
export interface BatchInsertParams {
  table: string;
  records: Array<Record<string, any>>;
}

/**
 * Batch update parameters
 */
export interface BatchUpdateParams {
  table: string;
  updates: Array<{
    where: Record<string, any>;
    data: Record<string, any>;
  }>;
}

/**
 * Batch delete parameters
 */
export interface BatchDeleteParams {
  table: string;
  conditions: Array<Record<string, any>>;
}

/**
 * Schema parameters
 */
export interface SchemaParams {
  table: string;
  includeConstraints?: boolean;
  includeIndexes?: boolean;
}

/**
 * Audit log query parameters
 */
export interface AuditLogParams {
  table?: string;
  operation?: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Audit summary parameters
 */
export interface AuditSummaryParams {
  table?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Database Service Class
 * Provides a clean API for database operations in the renderer process
 */
export class DatabaseService {
  /**
   * Check connection to database admin server
   */
  async checkConnection(): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.checkConnection();
  }

  /**
   * Get database server info
   */
  async getServerInfo(): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.getServerInfo();
  }

  // ===================
  // CRUD Operations
  // ===================

  /**
   * Query records from a table
   */
  async queryRecords(params: QueryParams): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.queryRecords(params);
  }

  /**
   * Insert a record into a table
   */
  async insertRecord(params: InsertParams): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.insertRecord(params);
  }

  /**
   * Update records in a table
   */
  async updateRecords(params: UpdateParams): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.updateRecords(params);
  }

  /**
   * Delete records from a table
   */
  async deleteRecords(params: DeleteParams): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.deleteRecords(params);
  }

  // ===================
  // Batch Operations
  // ===================

  /**
   * Batch insert multiple records
   */
  async batchInsert(params: BatchInsertParams): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.batchInsert(params);
  }

  /**
   * Batch update multiple records
   */
  async batchUpdate(params: BatchUpdateParams): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.batchUpdate(params);
  }

  /**
   * Batch delete multiple sets of records
   */
  async batchDelete(params: BatchDeleteParams): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.batchDelete(params);
  }

  // ===================
  // Schema Management
  // ===================

  /**
   * Get schema information for a table
   */
  async getSchema(params: SchemaParams): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.getSchema(params);
  }

  /**
   * List all available tables
   */
  async listTables(): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.listTables();
  }

  /**
   * Get table relationships
   */
  async getRelationships(table?: string): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.getRelationships({ table });
  }

  /**
   * List columns for a table
   */
  async listColumns(table: string): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.listColumns({ table });
  }

  // ===================
  // Audit Functions
  // ===================

  /**
   * Query audit logs
   */
  async queryAuditLogs(params: AuditLogParams): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.queryAuditLogs(params);
  }

  /**
   * Get audit summary
   */
  async getAuditSummary(params: AuditSummaryParams): Promise<DatabaseOperationResult> {
    return window.electronAPI.databaseAdmin.getAuditSummary(params);
  }

  // ===================
  // Helper Methods
  // ===================

  /**
   * Execute a simple query and return data
   */
  async simpleQuery(table: string, where?: Record<string, any>): Promise<any[]> {
    const result = await this.queryRecords({ table, where });
    if (result.success && result.data?.data) {
      return result.data.data;
    }
    return [];
  }

  /**
   * Get count of records in a table
   */
  async getCount(table: string, where?: Record<string, any>): Promise<number> {
    const result = await this.queryRecords({ table, where });
    if (result.success && result.data?.totalCount !== undefined) {
      return result.data.totalCount;
    }
    return 0;
  }

  /**
   * Check if a record exists
   */
  async recordExists(table: string, where: Record<string, any>): Promise<boolean> {
    const count = await this.getCount(table, where);
    return count > 0;
  }
}

/**
 * Create and export a singleton instance
 */
export const databaseService = new DatabaseService();

/**
 * Export as default for convenient importing
 */
export default databaseService;
