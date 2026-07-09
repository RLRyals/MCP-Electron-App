/**
 * Unit tests for src/main/database-admin.ts -- the module backing the
 * `database-admin:*` IPC handlers registered in src/main/index.ts (issue #126,
 * Database Tab Foundation and IPC Handlers).
 *
 * These handlers are the foundation that #128 (batch ops UI), #129 (schema
 * explorer UI), and #130 (backup UI) build on top of, so this suite locks down
 * the JSON-RPC response parsing (both response shapes MCP-Writing-Servers can
 * return, plus plain-text and error responses), network-failure error
 * messages, and that each exported wrapper calls the correct MCP tool name
 * with the correct arguments.
 *
 * The database layer is fully mocked (axios + env-config) -- no real MCP
 * server or database connection is required.
 */

import axios from 'axios';

jest.mock('axios');
jest.mock('../logger', () => ({
  LogCategory: { SYSTEM: 'SYSTEM' },
  logWithCategory: jest.fn(),
}));

const mockLoadEnvConfig = jest.fn();
jest.mock('../env-config', () => ({
  loadEnvConfig: (...args: any[]) => mockLoadEnvConfig(...args),
}));

import * as databaseAdmin from '../database-admin';

const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Build a JSON-RPC-format MCP tool response: { jsonrpc, result: { content: [...] }, id }. */
function jsonRpcResponse(data: unknown, id: number = 1) {
  return {
    data: {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: JSON.stringify(data) }],
      },
    },
  };
}

/** Build a direct-format MCP tool response: { content: [...] } (no jsonrpc envelope). */
function directResponse(data: unknown) {
  return {
    data: {
      content: [{ type: 'text', text: JSON.stringify(data) }],
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadEnvConfig.mockResolvedValue({ DB_ADMIN_PORT: 3010 });
});

describe('database-admin response parsing (via queryRecords)', () => {
  it('parses a JSON-RPC-format response', async () => {
    mockedAxios.post.mockResolvedValue(jsonRpcResponse({ rows: [{ id: 1 }], totalCount: 1 }));

    const result = await databaseAdmin.queryRecords({ table: 'characters' });

    expect(result).toEqual({ success: true, data: { rows: [{ id: 1 }], totalCount: 1 } });
  });

  it('parses a direct-format response (no jsonrpc envelope)', async () => {
    mockedAxios.post.mockResolvedValue(directResponse({ ok: true }));

    const result = await databaseAdmin.queryRecords({ table: 'characters' });

    expect(result).toEqual({ success: true, data: { ok: true } });
  });

  it('strips a text header before the JSON payload', async () => {
    const payload = { count: 2 };
    mockedAxios.post.mockResolvedValue({
      data: {
        content: [
          {
            type: 'text',
            text: `Query Results from 'characters':\n\nRecords returned: 2\n\n${JSON.stringify(payload)}`,
          },
        ],
      },
    });

    const result = await databaseAdmin.queryRecords({ table: 'characters' });

    expect(result).toEqual({ success: true, data: payload });
  });

  it('returns plain text as data when the response body is not JSON', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { content: [{ type: 'text', text: 'OK, done.' }] },
    });

    const result = await databaseAdmin.queryRecords({ table: 'characters' });

    expect(result).toEqual({ success: true, data: 'OK, done.' });
  });

  it('surfaces a JSON-RPC error object as a failed result', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32000, message: 'Table does not exist', data: 'characters' },
      },
    });

    const result = await databaseAdmin.queryRecords({ table: 'characters' });

    expect(result).toEqual({ success: false, error: 'Table does not exist', data: 'characters' });
  });

  it('returns a clear error when the MCP server is not running (ECONNREFUSED)', async () => {
    mockedAxios.post.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

    const result = await databaseAdmin.queryRecords({ table: 'characters' });

    expect(result).toEqual({
      success: false,
      error: 'Database administration server is not running. Please start the MCP system first.',
    });
  });

  it('returns a timeout-specific error on ETIMEDOUT', async () => {
    mockedAxios.post.mockRejectedValue(Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ETIMEDOUT' }));

    const result = await databaseAdmin.queryRecords({ table: 'characters' });

    expect(result).toEqual({ success: false, error: 'Request timed out after 30 seconds' });
  });

  it('falls back to the raw error message for other failures', async () => {
    mockedAxios.post.mockRejectedValue(new Error('socket hang up'));

    const result = await databaseAdmin.queryRecords({ table: 'characters' });

    expect(result).toEqual({ success: false, error: 'socket hang up' });
  });

  it('calls the configured DB_ADMIN_PORT, falling back to 3010 if config load fails', async () => {
    mockLoadEnvConfig.mockRejectedValue(new Error('no config file'));
    mockedAxios.post.mockResolvedValue(directResponse([]));

    await databaseAdmin.queryRecords({ table: 'characters' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:3010/api/tool-call',
      expect.anything(),
      expect.anything()
    );
  });

  it('uses a custom DB_ADMIN_PORT from env config', async () => {
    mockLoadEnvConfig.mockResolvedValue({ DB_ADMIN_PORT: 4242 });
    mockedAxios.post.mockResolvedValue(directResponse([]));

    await databaseAdmin.queryRecords({ table: 'characters' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:4242/api/tool-call',
      expect.anything(),
      expect.anything()
    );
  });
});

describe('database-admin tool wrappers call the correct MCP tool + arguments', () => {
  beforeEach(() => {
    mockedAxios.post.mockResolvedValue(directResponse({}));
  });

  function toolCallBody() {
    return mockedAxios.post.mock.calls[0][1] as any;
  }

  it('queryRecords -> db_query_records', async () => {
    const params = { table: 'characters', limit: 10 };
    await databaseAdmin.queryRecords(params);
    expect(toolCallBody().params).toEqual({ name: 'db_query_records', arguments: params });
  });

  it('insertRecord -> db_insert_record', async () => {
    const params = { table: 'characters', data: { name: 'Mal' } };
    await databaseAdmin.insertRecord(params);
    expect(toolCallBody().params).toEqual({ name: 'db_insert_record', arguments: params });
  });

  it('updateRecords -> db_update_records', async () => {
    const params = { table: 'characters', data: { name: 'Mal' }, where: { id: 1 } };
    await databaseAdmin.updateRecords(params);
    expect(toolCallBody().params).toEqual({ name: 'db_update_records', arguments: params });
  });

  it('deleteRecords -> db_delete_records', async () => {
    const params = { table: 'characters', where: { id: 1 } };
    await databaseAdmin.deleteRecords(params);
    expect(toolCallBody().params).toEqual({ name: 'db_delete_records', arguments: params });
  });

  it('batchInsert -> db_batch_insert', async () => {
    const params = { table: 'characters', records: [{ name: 'Mal' }, { name: 'Jax' }] };
    await databaseAdmin.batchInsert(params);
    expect(toolCallBody().params).toEqual({ name: 'db_batch_insert', arguments: params });
  });

  it('batchUpdate -> db_batch_update', async () => {
    const params = { table: 'characters', updates: [{ where: { id: 1 }, data: { name: 'Mal' } }] };
    await databaseAdmin.batchUpdate(params);
    expect(toolCallBody().params).toEqual({ name: 'db_batch_update', arguments: params });
  });

  it('batchDelete -> db_batch_delete', async () => {
    const params = { table: 'characters', conditions: [{ id: 1 }] };
    await databaseAdmin.batchDelete(params);
    expect(toolCallBody().params).toEqual({ name: 'db_batch_delete', arguments: params });
  });

  it('getSchema -> db_get_schema', async () => {
    const params = { table: 'characters', includeConstraints: true };
    await databaseAdmin.getSchema(params);
    expect(toolCallBody().params).toEqual({ name: 'db_get_schema', arguments: params });
  });

  it('listTables -> db_list_tables with no arguments', async () => {
    await databaseAdmin.listTables();
    expect(toolCallBody().params).toEqual({ name: 'db_list_tables', arguments: {} });
  });

  it('getRelationships -> db_get_relationships', async () => {
    const params = { table: 'characters' };
    await databaseAdmin.getRelationships(params);
    expect(toolCallBody().params).toEqual({ name: 'db_get_relationships', arguments: params });
  });

  it('listColumns -> db_list_columns', async () => {
    const params = { table: 'characters' };
    await databaseAdmin.listColumns(params);
    expect(toolCallBody().params).toEqual({ name: 'db_list_columns', arguments: params });
  });

  it('queryAuditLogs -> db_query_audit_logs', async () => {
    const params = { table: 'characters', operation: 'UPDATE' as const };
    await databaseAdmin.queryAuditLogs(params);
    expect(toolCallBody().params).toEqual({ name: 'db_query_audit_logs', arguments: params });
  });

  it('getAuditSummary -> db_get_audit_summary', async () => {
    const params = { table: 'characters' };
    await databaseAdmin.getAuditSummary(params);
    expect(toolCallBody().params).toEqual({ name: 'db_get_audit_summary', arguments: params });
  });

  it('getServerInfo -> db_get_server_info with no arguments', async () => {
    await databaseAdmin.getServerInfo();
    expect(toolCallBody().params).toEqual({ name: 'db_get_server_info', arguments: {} });
  });
});

describe('checkConnection', () => {
  it('reports connected when /health responds 200', async () => {
    mockedAxios.get.mockResolvedValue({ status: 200 });

    const result = await databaseAdmin.checkConnection();

    expect(result).toEqual({ success: true, message: 'Connected to database administration server' });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('falls back to a real tool call when /health does not exist, and reports connected if it succeeds', async () => {
    mockedAxios.get.mockRejectedValue(new Error('404'));
    mockedAxios.post.mockResolvedValue(directResponse([]));

    const result = await databaseAdmin.checkConnection();

    expect(result).toEqual({ success: true, message: 'Connected to database administration server' });
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it('reports disconnected when both /health and the tool-call fallback fail', async () => {
    mockedAxios.get.mockRejectedValue(new Error('404'));
    mockedAxios.post.mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    );

    const result = await databaseAdmin.checkConnection();

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('reports disconnected when /health responds with a non-2xx status and the fallback also fails', async () => {
    mockedAxios.get.mockResolvedValue({ status: 503 });
    mockedAxios.post.mockRejectedValue(new Error('unreachable'));

    const result = await databaseAdmin.checkConnection();

    expect(result.success).toBe(false);
  });
});
