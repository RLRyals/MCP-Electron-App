/**
 * HTTP Request Executor Tests
 *
 * Tests for HTTP requests, authentication, variable substitution,
 * retry logic, and timeout handling.
 */

import { HttpRequestExecutor } from '../http-request-executor';
import { HttpRequestNode } from '../../../../types/workflow-nodes';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HttpRequestExecutor', () => {
  let executor: HttpRequestExecutor;

  beforeEach(() => {
    executor = new HttpRequestExecutor();
    jest.clearAllMocks();
  });

  describe('GET requests', () => {
    it('should execute GET request successfully', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'Success', count: 42 },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Get Data',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/data',
        responseType: 'json',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.status).toBe(200);
      expect(result.variables.data).toEqual({ message: 'Success', count: 42 });
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.com/data',
        })
      );
    });

    it('should substitute variables in URL', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { id: 123 },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Get Data',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: '{{baseUrl}}/users/{{userId}}',
        responseType: 'json',
      };

      const context = {
        projectFolder: '/test',
        variables: {
          baseUrl: 'https://api.example.com',
          userId: 123,
        },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/users/123',
        })
      );
    });
  });

  describe('POST requests', () => {
    it('should execute POST request with JSON body', async () => {
      const mockResponse = {
        status: 201,
        statusText: 'Created',
        headers: {},
        data: { id: 456, created: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Create User',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'POST',
        url: 'https://api.example.com/users',
        body: { name: 'John Doe', email: 'john@example.com' },
        responseType: 'json',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.status).toBe(201);
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: { name: 'John Doe', email: 'john@example.com' },
        })
      );
    });

    it('should substitute variables in request body', async () => {
      const mockResponse = {
        status: 201,
        statusText: 'Created',
        headers: {},
        data: { success: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Create User',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'POST',
        url: 'https://api.example.com/users',
        body: { name: '{{userName}}', email: '{{userEmail}}' },
        responseType: 'json',
      };

      const context = {
        projectFolder: '/test',
        variables: {
          userName: 'Jane Smith',
          userEmail: 'jane@example.com',
        },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'Jane Smith', email: 'jane@example.com' },
        })
      );
    });

    it('should parse string body as JSON if it looks like JSON', async () => {
      const mockResponse = {
        status: 201,
        statusText: 'Created',
        headers: {},
        data: { success: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Create User',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'POST',
        url: 'https://api.example.com/users',
        body: '{"name": "John", "age": 30}',
        responseType: 'json',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'John', age: 30 },
        })
      );
    });
  });

  describe('PUT and PATCH requests', () => {
    it('should execute PUT request', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { updated: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Update User',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'PUT',
        url: 'https://api.example.com/users/123',
        body: { name: 'Updated Name' },
        responseType: 'json',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          data: { name: 'Updated Name' },
        })
      );
    });

    it('should execute PATCH request', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { patched: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Patch User',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'PATCH',
        url: 'https://api.example.com/users/123',
        body: { email: 'newemail@example.com' },
        responseType: 'json',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('DELETE requests', () => {
    it('should execute DELETE request', async () => {
      const mockResponse = {
        status: 204,
        statusText: 'No Content',
        headers: {},
        data: null,
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Delete User',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'DELETE',
        url: 'https://api.example.com/users/123',
        responseType: 'json',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.status).toBe(204);
    });
  });

  describe('authentication', () => {
    it('should support basic authentication', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { authenticated: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Authenticated Request',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/protected',
        responseType: 'json',
        auth: {
          type: 'basic',
          config: {
            username: 'user123',
            password: 'pass456',
          },
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            username: 'user123',
            password: 'pass456',
          },
        })
      );
    });

    it('should support bearer token authentication', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { authenticated: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Authenticated Request',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/protected',
        responseType: 'json',
        auth: {
          type: 'bearer',
          config: {
            token: 'abc123token',
          },
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer abc123token',
          }),
        })
      );
    });

    it('should support API key authentication', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { authenticated: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Authenticated Request',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/protected',
        responseType: 'json',
        auth: {
          type: 'api-key',
          config: {
            headerName: 'X-API-Key',
            apiKey: 'my-secret-key',
          },
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'my-secret-key',
          }),
        })
      );
    });

    it('should substitute variables in auth config', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Authenticated Request',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/data',
        responseType: 'json',
        auth: {
          type: 'bearer',
          config: {
            token: '{{apiToken}}',
          },
        },
      };

      const context = {
        projectFolder: '/test',
        variables: {
          apiToken: 'secret-token-123',
        },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-token-123',
          }),
        })
      );
    });
  });

  describe('headers', () => {
    it('should send custom headers', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Request with Headers',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {
          'X-Custom-Header': 'CustomValue',
          'Accept-Language': 'en-US',
        },
        responseType: 'json',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'CustomValue',
            'Accept-Language': 'en-US',
          }),
        })
      );
    });

    it('should substitute variables in headers', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Request with Headers',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {
          'X-User-ID': '{{userId}}',
        },
        responseType: 'json',
      };

      const context = {
        projectFolder: '/test',
        variables: {
          userId: 'user-12345',
        },
      };

      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-User-ID': 'user-12345',
          }),
        })
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on 5xx errors', async () => {
      const error500Response = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        data: null,
      };

      const successResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: true },
      };

      mockedAxios
        .mockResolvedValueOnce(error500Response as any)
        .mockResolvedValueOnce(successResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Request with Retry',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/data',
        responseType: 'json',
        retryConfig: {
          maxRetries: 2,
          retryDelayMs: 100,
          backoffMultiplier: 2,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(mockedAxios).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors', async () => {
      const error404Response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        data: null,
      };

      mockedAxios.mockResolvedValueOnce(error404Response as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Request with Retry',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/data',
        responseType: 'json',
        retryConfig: {
          maxRetries: 2,
          retryDelayMs: 100,
          backoffMultiplier: 2,
        },
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(mockedAxios).toHaveBeenCalledTimes(1);
    });
  });

  describe('response types', () => {
    it('should handle JSON response', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'JSON data' },
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Get JSON',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/data',
        responseType: 'json',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.data).toEqual({ message: 'JSON data' });
    });

    it('should handle text response', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        data: 'Plain text response',
      };

      mockedAxios.mockResolvedValueOnce(mockResponse as any);

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Get Text',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/text',
        responseType: 'text',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('success');
      expect(result.variables.data).toBe('Plain text response');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockedAxios.mockRejectedValueOnce(new Error('Network error'));

      const node: HttpRequestNode = {
        id: 'http-1',
        name: 'Failing Request',
        description: 'Test HTTP request',
        type: 'http',
        position: { x: 0, y: 0 },
        requiresApproval: false,
        contextConfig: { mode: 'simple' },
        method: 'GET',
        url: 'https://api.example.com/data',
        responseType: 'json',
      };

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Network error');
    });

    it('should handle invalid node type', async () => {
      const node = {
        id: 'http-1',
        name: 'Invalid Node',
        type: 'invalid-type',
      } as any;

      const context = { projectFolder: '/test' };
      const result = await executor.execute(node, context);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Invalid node type');
    });
  });
});
