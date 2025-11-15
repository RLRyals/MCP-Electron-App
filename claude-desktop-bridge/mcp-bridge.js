#!/usr/bin/env node

/**
 * MCP Bridge for Claude Desktop
 * Bridges stdio (Claude Desktop) to HTTP (Docker MCP Connector)
 *
 * This script allows Claude Desktop to connect to the MCP servers
 * running in Docker containers via the MCP Connector.
 */

const http = require('http');
const readline = require('readline');

// Configuration - these should match your .env file
const MCP_CONNECTOR_URL = process.env.MCP_CONNECTOR_URL || 'http://localhost:50880';
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';

// Logging to stderr (stdout is reserved for MCP protocol)
function log(message, ...args) {
  console.error(`[MCP Bridge] ${message}`, ...args);
}

// Make HTTP request to MCP Connector
function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, MCP_CONNECTOR_URL);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    // Add auth token if available
    if (MCP_AUTH_TOKEN) {
      options.headers['Authorization'] = `Bearer ${MCP_AUTH_TOKEN}`;
    }

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (error) {
          resolve(body);
        }
      });
    });

    req.on('error', (error) => {
      log('HTTP request error:', error.message);
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Process JSON-RPC messages from Claude Desktop
async function processMessage(message) {
  try {
    const request = JSON.parse(message);
    log('Received request:', request.method);

    // Forward the JSON-RPC request to the MCP Connector
    const response = await makeRequest('POST', '/mcp', request);

    // Send response back to Claude Desktop via stdout
    console.log(JSON.stringify(response));
  } catch (error) {
    log('Error processing message:', error.message);

    // Send error response
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: error.message
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
}

// Main function
async function main() {
  log('Starting MCP Bridge...');
  log('Connector URL:', MCP_CONNECTOR_URL);
  log('Auth Token:', MCP_AUTH_TOKEN ? '***configured***' : 'NOT SET');

  // Test connection to MCP Connector
  try {
    log('Testing connection to MCP Connector...');
    await makeRequest('GET', '/health');
    log('Connection successful!');
  } catch (error) {
    log('WARNING: Could not connect to MCP Connector:', error.message);
    log('Make sure the MCP system is running in Docker');
  }

  // Read JSON-RPC messages from stdin (from Claude Desktop)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    if (line.trim()) {
      await processMessage(line);
    }
  });

  rl.on('close', () => {
    log('Bridge closed');
    process.exit(0);
  });

  log('Bridge ready, waiting for requests from Claude Desktop...');
}

// Handle errors
process.on('uncaughtException', (error) => {
  log('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log('Unhandled rejection:', error);
  process.exit(1);
});

// Start the bridge
main().catch((error) => {
  log('Fatal error:', error);
  process.exit(1);
});
