/**
 * mea-wg9: HTTP tool-call errors must carry the MCP server's error text
 * (JSON-RPC error.message + error.data), not axios's generic
 * "Request failed with status code 500".
 */

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => require('os').tmpdir()) },
  ipcMain: { handle: jest.fn() },
  BrowserWindow: { getAllWindows: jest.fn(() => []) },
}));
jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn(), get: jest.fn() } }));
jest.mock('pg', () => ({ Pool: jest.fn() }));
jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  existsSync: jest.fn(() => false),
  pathExistsSync: jest.fn(() => false),
}));
jest.mock('../logger', () => ({
  logWithCategory: jest.fn(),
  LogCategory: { SYSTEM: 'SYSTEM' },
}));
jest.mock('../plugin-data-paths', () => ({
  getPluginDataDir: jest.fn(() => '/tmp/plugin-data'),
  migrateLegacyConfigSync: jest.fn(() => false),
}));
jest.mock('../app-settings', () => ({ getCurrentUser: jest.fn() }));
jest.mock('../ipc-registry', () => ({ recordHandler: jest.fn(), unrecordHandler: jest.fn() }));
jest.mock('../workflow/persistent-mcp-client', () => ({ PersistentMCPClient: jest.fn() }));

import axios from 'axios';
import { createPluginContext, formatMcpErrorDetail } from '../plugin-context';

const post = (axios as any).post as jest.Mock;

function makeContext() {
  const manifest: any = {
    id: 'test-plugin',
    permissions: { mcp: { enabled: true, servers: ['book-planning'] } },
  };
  return createPluginContext('test-plugin', manifest, '/tmp/install', {} as any);
}

function axiosHttpError(status: number, body: any) {
  const err: any = new Error(`Request failed with status code ${status}`);
  err.response = { status, data: body };
  return err;
}

describe('plugin context HTTP callTool error text (mea-wg9)', () => {
  beforeEach(() => post.mockReset());

  it('includes error.data string from a 500 reply', async () => {
    post.mockRejectedValue(
      axiosHttpError(500, {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: 'Failed to create storyform: Storyform already exists for series 8 (book 9) -- use update_storyform',
        },
        id: 1,
      })
    );
    const ctx = makeContext();
    const p = ctx.services.mcp.callTool('book-planning', 'create_storyform', { x: 1 });
    await expect(p).rejects.toThrow(
      'Failed to call MCP tool create_storyform on book-planning: Internal error: Failed to create storyform: Storyform already exists for series 8 (book 9) -- use update_storyform (HTTP 500)'
    );
    await expect(p).rejects.toThrow(/already exist|use update_storyform/);
  });

  it('includes a JSON-stringified violations array from a 400 reply', async () => {
    const violations = [{ field: 'name', message: 'name is required' }];
    post.mockRejectedValue(
      axiosHttpError(400, { error: { code: -32602, message: 'name is required', data: violations } })
    );
    const ctx = makeContext();
    await expect(ctx.services.mcp.callTool('book-planning', 'create_storyform', {})).rejects.toThrow(
      `Failed to call MCP tool create_storyform on book-planning: name is required: ${JSON.stringify(violations)} (HTTP 400)`
    );
  });

  it('leaves the message unchanged for a network error with no response', async () => {
    post.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3001'));
    const ctx = makeContext();
    await expect(ctx.services.mcp.callTool('book-planning', 'create_storyform', {})).rejects.toThrow(
      /^Failed to call MCP tool create_storyform on book-planning: connect ECONNREFUSED 127\.0\.0\.1:3001$/
    );
  });

  it('includes error.data on a 200 reply carrying a JSON-RPC error', async () => {
    post.mockResolvedValue({ data: { error: { code: -32603, message: 'Internal error', data: 'real cause' } } });
    const ctx = makeContext();
    await expect(ctx.services.mcp.callTool('book-planning', 'x', {})).rejects.toThrow(
      'Failed to call MCP tool x on book-planning: MCP Error: Internal error: real cause'
    );
  });

  it('truncates very long data', () => {
    const out = formatMcpErrorDetail({ message: 'm', data: 'a'.repeat(5000) });
    expect(out.length).toBeLessThan(1100);
    expect(out.endsWith('...')).toBe(true);
  });
});
