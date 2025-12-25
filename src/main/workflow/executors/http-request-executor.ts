/**
 * HTTP Request Executor
 *
 * Executes HTTP request nodes with support for:
 * - All HTTP methods (GET, POST, PUT, PATCH, DELETE)
 * - Multiple authentication types (none, basic, bearer, api-key)
 * - Variable substitution in URL, headers, and body
 * - Response parsing based on content-type
 * - Retry logic with exponential backoff
 * - Timeout handling
 */

import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { NodeExecutor } from './base-executor';
import { WorkflowNode, NodeOutput, HttpRequestNode, isHttpRequestNode } from '../../../types/workflow-nodes';
import { ContextManager } from '../context-manager';
import { logWithCategory, LogCategory } from '../../logger';

export class HttpRequestExecutor implements NodeExecutor {
  readonly nodeType = 'http';
  private contextManager: ContextManager;

  constructor() {
    this.contextManager = new ContextManager();
  }

  async execute(node: WorkflowNode, context: any): Promise<NodeOutput> {
    const startTime = Date.now();

    // Type guard
    if (!isHttpRequestNode(node)) {
      return this.createFailedOutput(node, 'Invalid node type for HttpRequestExecutor');
    }

    logWithCategory('info', LogCategory.WORKFLOW, `Executing HTTP request node: ${node.name}`);

    try {
      // Substitute variables in URL
      const url = this.contextManager.substitute(node.url, context);
      logWithCategory('debug', LogCategory.WORKFLOW, `Substituted URL: ${url}`);

      // Prepare headers with variable substitution
      const headers = this.prepareHeaders(node, context);

      // Prepare body with variable substitution
      const body = this.prepareBody(node, context);

      // Prepare auth configuration
      const authConfig = this.prepareAuth(node, context);

      // Build axios config
      const axiosConfig: AxiosRequestConfig = {
        method: node.method,
        url,
        headers,
        timeout: node.timeoutMs || 30000, // Default 30s timeout
        validateStatus: () => true, // Don't throw on any status code
      };

      // Add authentication
      if (authConfig) {
        Object.assign(axiosConfig, authConfig);
      }

      // Add body for methods that support it
      if (body !== undefined && ['POST', 'PUT', 'PATCH'].includes(node.method)) {
        axiosConfig.data = body;
      }

      // Set response type
      if (node.responseType === 'buffer') {
        axiosConfig.responseType = 'arraybuffer';
      } else if (node.responseType === 'text') {
        axiosConfig.responseType = 'text';
      } else {
        axiosConfig.responseType = 'json';
      }

      // Execute request with retry logic
      const response = await this.executeWithRetry(node, axiosConfig);

      // Parse response
      const parsedResponse = this.parseResponse(response, node.responseType);

      // Check if response indicates success
      const isSuccess = response.status >= 200 && response.status < 300;

      if (!isSuccess) {
        logWithCategory('warn', LogCategory.WORKFLOW,
          `HTTP request returned non-success status: ${response.status}`);
      }

      const executionTime = Date.now() - startTime;
      logWithCategory('info', LogCategory.WORKFLOW,
        `HTTP request completed in ${executionTime}ms with status ${response.status}`);

      return {
        nodeId: node.id,
        nodeName: node.name,
        timestamp: new Date(),
        status: isSuccess ? 'success' : 'failed',
        output: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: parsedResponse,
          executionTimeMs: executionTime,
        },
        variables: {
          status: response.status,
          statusText: response.statusText,
          data: parsedResponse,
          headers: response.headers,
        },
        error: isSuccess ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logWithCategory('error', LogCategory.WORKFLOW,
        `HTTP request failed: ${error.message}`, { nodeId: node.id, error: error.stack });

      return {
        nodeId: node.id,
        nodeName: node.name,
        timestamp: new Date(),
        status: 'failed',
        output: {
          error: error.message,
          executionTimeMs: executionTime,
        },
        variables: {},
        error: error.message,
        errorStack: error.stack,
      };
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(
    node: HttpRequestNode,
    config: AxiosRequestConfig
  ): Promise<AxiosResponse> {
    const maxRetries = node.retryConfig?.maxRetries || 0;
    const retryDelay = node.retryConfig?.retryDelayMs || 1000;
    const backoffMultiplier = node.retryConfig?.backoffMultiplier || 2;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = retryDelay * Math.pow(backoffMultiplier, attempt - 1);
          logWithCategory('info', LogCategory.WORKFLOW,
            `Retrying HTTP request (attempt ${attempt}/${maxRetries}) after ${delay}ms`);
          await this.sleep(delay);
        }

        const response = await axios(config);

        // Consider 5xx errors as retriable
        if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `HTTP ${response.status} error, will retry`);
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          continue;
        }

        return response;

      } catch (error: any) {
        lastError = error;

        // Don't retry on 4xx errors (client errors)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `HTTP ${error.response.status} client error, not retrying`);
          return error.response;
        }

        // Retry on network errors or 5xx errors
        if (attempt < maxRetries) {
          logWithCategory('warn', LogCategory.WORKFLOW,
            `HTTP request failed: ${error.message}, will retry`);
          continue;
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error('HTTP request failed after all retries');
  }

  /**
   * Prepare headers with variable substitution
   */
  private prepareHeaders(node: HttpRequestNode, context: any): Record<string, string> {
    const headers: Record<string, string> = {};

    if (node.headers) {
      for (const [key, value] of Object.entries(node.headers)) {
        headers[key] = this.contextManager.substitute(value, context);
      }
    }

    return headers;
  }

  /**
   * Prepare request body with variable substitution
   */
  private prepareBody(node: HttpRequestNode, context: any): any {
    if (!node.body) {
      return undefined;
    }

    // If body is a string, perform variable substitution
    if (typeof node.body === 'string') {
      const substituted = this.contextManager.substitute(node.body, context);

      // Try to parse as JSON if it looks like JSON
      if (substituted.trim().startsWith('{') || substituted.trim().startsWith('[')) {
        try {
          return JSON.parse(substituted);
        } catch {
          // If parsing fails, return as string
          return substituted;
        }
      }

      return substituted;
    }

    // If body is an object, recursively substitute variables in values
    if (typeof node.body === 'object' && node.body !== null) {
      return this.substituteInObject(node.body, context);
    }

    return node.body;
  }

  /**
   * Recursively substitute variables in an object
   */
  private substituteInObject(obj: any, context: any): any {
    if (typeof obj === 'string') {
      return this.contextManager.substitute(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.substituteInObject(item, context));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteInObject(value, context);
      }
      return result;
    }

    return obj;
  }

  /**
   * Prepare authentication configuration
   */
  private prepareAuth(node: HttpRequestNode, context: any): Partial<AxiosRequestConfig> | null {
    if (!node.auth || node.auth.type === 'none') {
      return null;
    }

    const authConfig: Partial<AxiosRequestConfig> = {};

    switch (node.auth.type) {
      case 'basic':
        // Basic auth: username and password
        const username = this.contextManager.substitute(
          node.auth.config.username || '',
          context
        );
        const password = this.contextManager.substitute(
          node.auth.config.password || '',
          context
        );
        authConfig.auth = { username, password };
        break;

      case 'bearer':
        // Bearer token
        const token = this.contextManager.substitute(
          node.auth.config.token || '',
          context
        );
        authConfig.headers = {
          'Authorization': `Bearer ${token}`,
        };
        break;

      case 'api-key':
        // API key in header
        const headerName = this.contextManager.substitute(
          node.auth.config.headerName || 'X-API-Key',
          context
        );
        const apiKey = this.contextManager.substitute(
          node.auth.config.apiKey || '',
          context
        );
        authConfig.headers = {
          [headerName]: apiKey,
        };
        break;
    }

    return authConfig;
  }

  /**
   * Parse response based on content-type or configured responseType
   */
  private parseResponse(response: AxiosResponse, expectedType: string): any {
    // If response is already parsed (JSON), return as-is
    if (expectedType === 'json') {
      return response.data;
    }

    // If expecting text, return as string
    if (expectedType === 'text') {
      return String(response.data);
    }

    // If expecting buffer, return as-is
    if (expectedType === 'buffer') {
      return response.data;
    }

    // Fallback: try to determine from content-type header
    const contentType = response.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      return response.data;
    }

    if (contentType.includes('text/')) {
      return String(response.data);
    }

    // Default: return as-is
    return response.data;
  }

  /**
   * Helper to create a failed output
   */
  private createFailedOutput(node: WorkflowNode, error: string): NodeOutput {
    return {
      nodeId: node.id,
      nodeName: node.name,
      timestamp: new Date(),
      status: 'failed',
      output: { error },
      variables: {},
      error,
    };
  }

  /**
   * Helper to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
