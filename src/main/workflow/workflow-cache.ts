/**
 * Workflow Cache
 *
 * In-memory cache for workflow definitions with TTL-based expiry
 * Reduces redundant MCP server calls for frequently accessed workflows
 */

import { logWithCategory, LogCategory } from '../logger';
import { WorkflowDefinition } from './mcp-workflow-client';

interface CacheEntry {
  data: WorkflowDefinition;
  timestamp: number;
  version: string;
}

interface ListCacheEntry {
  data: WorkflowDefinition[];
  timestamp: number;
}

export class WorkflowCache {
  private definitionsCache: Map<string, CacheEntry> = new Map();
  private listCache: ListCacheEntry | null = null;
  private readonly TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * Cache a workflow definition
   */
  set(workflowId: string, version: string, data: WorkflowDefinition): void {
    this.definitionsCache.set(workflowId, {
      data,
      timestamp: Date.now(),
      version,
    });

    logWithCategory('debug', LogCategory.WORKFLOW,
      `Cached workflow: ${workflowId} (version: ${version})`);
  }

  /**
   * Get workflow definition from cache
   * Returns null if expired or not found
   */
  get(workflowId: string, version?: string): WorkflowDefinition | null {
    const entry = this.definitionsCache.get(workflowId);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `Cache expired for workflow: ${workflowId}`);
      this.definitionsCache.delete(workflowId);
      return null;
    }

    // Check version match if specified
    if (version && entry.version !== version) {
      logWithCategory('debug', LogCategory.WORKFLOW,
        `Cache version mismatch for workflow: ${workflowId} (cached: ${entry.version}, requested: ${version})`);
      return null;
    }

    logWithCategory('debug', LogCategory.WORKFLOW,
      `Cache hit for workflow: ${workflowId}`);
    return entry.data;
  }

  /**
   * Invalidate specific workflow (e.g., on position update)
   */
  invalidate(workflowId: string): void {
    this.definitionsCache.delete(workflowId);
    logWithCategory('debug', LogCategory.WORKFLOW,
      `Invalidated cache for workflow: ${workflowId}`);
  }

  /**
   * Invalidate entire cache (e.g., on import or delete)
   */
  invalidateAll(): void {
    this.definitionsCache.clear();
    this.listCache = null;
    logWithCategory('debug', LogCategory.WORKFLOW,
      'Invalidated entire workflow cache');
  }

  /**
   * Get list of workflows from cache
   * Returns null if expired or not found
   */
  getList(): WorkflowDefinition[] | null {
    if (!this.listCache) {
      return null;
    }

    // Check if expired
    if (Date.now() - this.listCache.timestamp > this.TTL) {
      logWithCategory('debug', LogCategory.WORKFLOW,
        'Cache expired for workflow list');
      this.listCache = null;
      return null;
    }

    logWithCategory('debug', LogCategory.WORKFLOW,
      `Cache hit for workflow list (${this.listCache.data.length} items)`);
    return this.listCache.data;
  }

  /**
   * Cache list of workflows
   */
  setList(workflows: WorkflowDefinition[]): void {
    this.listCache = {
      data: workflows,
      timestamp: Date.now(),
    };

    logWithCategory('debug', LogCategory.WORKFLOW,
      `Cached workflow list (${workflows.length} items)`);
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): {
    definitionsCacheSize: number;
    listCacheSize: number;
    oldestEntry: number | null;
  } {
    let oldestTimestamp: number | null = null;

    for (const entry of this.definitionsCache.values()) {
      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }

    return {
      definitionsCacheSize: this.definitionsCache.size,
      listCacheSize: this.listCache ? this.listCache.data.length : 0,
      oldestEntry: oldestTimestamp,
    };
  }
}

// Singleton instance
export const workflowCache = new WorkflowCache();
