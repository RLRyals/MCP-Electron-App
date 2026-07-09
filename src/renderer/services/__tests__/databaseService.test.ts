/**
 * Tests for databaseService.getCount() (surfaced while implementing Issue
 * #129, the Database Schema Explorer, whose "record counts" acceptance
 * criterion depends on it).
 *
 * Bug fixed here: getCount() read `result.data.totalCount` (camelCase), but
 * the MCP database-admin server's db_query_records tool actually returns
 * `total_count` (snake_case) -- see
 * MCP-Writing-Servers/src/mcps/database-admin-server/handlers/database-handlers.js
 * (`{ table, count, total_count, records }`). getCount() therefore always
 * returned 0 previously. It's also now passed `limit: 1` so the server
 * computes the count via a cheap COUNT(*) query instead of fetching every
 * row just to measure the response length.
 */

import { databaseService } from '../databaseService';

describe('databaseService.getCount', () => {
  beforeEach(() => {
    (window as any).electronAPI = {
      databaseAdmin: {
        queryRecords: jest.fn(),
      },
    };
  });

  it('passes limit: 1 so the server computes an accurate total via COUNT(*)', async () => {
    (window as any).electronAPI.databaseAdmin.queryRecords.mockResolvedValue({
      success: true,
      data: { table: 'authors', count: 1, total_count: 250, records: [{ id: 1 }] },
    });

    const count = await databaseService.getCount('authors');

    expect((window as any).electronAPI.databaseAdmin.queryRecords).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'authors', limit: 1 })
    );
    expect(count).toBe(250);
  });

  it('falls back to totalCount (camelCase) if present', async () => {
    (window as any).electronAPI.databaseAdmin.queryRecords.mockResolvedValue({
      success: true,
      data: { totalCount: 12 },
    });

    expect(await databaseService.getCount('authors')).toBe(12);
  });

  it('falls back to count if neither total_count nor totalCount is present', async () => {
    (window as any).electronAPI.databaseAdmin.queryRecords.mockResolvedValue({
      success: true,
      data: { count: 3 },
    });

    expect(await databaseService.getCount('authors')).toBe(3);
  });

  it('returns 0 when the query fails', async () => {
    (window as any).electronAPI.databaseAdmin.queryRecords.mockResolvedValue({
      success: false,
      error: 'boom',
    });

    expect(await databaseService.getCount('authors')).toBe(0);
  });

  it('forwards the where clause unchanged', async () => {
    (window as any).electronAPI.databaseAdmin.queryRecords.mockResolvedValue({
      success: true,
      data: { total_count: 1 },
    });

    await databaseService.getCount('authors', { status: 'active' });

    expect((window as any).electronAPI.databaseAdmin.queryRecords).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'authors', where: { status: 'active' }, limit: 1 })
    );
  });
});
