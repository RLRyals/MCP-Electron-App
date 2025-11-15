// server.js - MCP Server Orchestrator
const { spawn } = require('child_process');
const path = require('path');

// List of all MCP servers
const servers = [
  { name: 'book-planning', port: 3001, file: './src/mcps/book-planning-server/index.js' },
  { name: 'series-planning', port: 3002, file: './src/mcps/series-planning-server/index.js' },
  { name: 'chapter-planning', port: 3003, file: './src/mcps/chapter-planning-server/index.js' },
  { name: 'character-planning', port: 3004, file: './src/mcps/character-planning-server/index.js' },
  { name: 'scene', port: 3005, file: './src/mcps/scene-server/index.js' },
  { name: 'core-continuity', port: 3006, file: './src/mcps/core-continuity-server/index.js' },
  { name: 'review', port: 3007, file: './src/mcps/review-server/index.js' },
  { name: 'reporting', port: 3008, file: './src/mcps/reporting-server/index.js' },
  { name: 'author', port: 3009, file: './src/mcps/author-server/index.js' },
];

console.log('Starting MCP Server Orchestrator...');
console.log(`Managing ${servers.length} MCP servers\n`);

const childProcesses = [];

// Start all servers
servers.forEach(server => {
  console.log(`[${server.name}] Starting on port ${server.port}...`);

  const child = spawn('node', [server.file], {
    env: {
      ...process.env,
      PORT: server.port,
      SERVER_NAME: server.name
    },
    stdio: ['inherit', 'inherit', 'inherit']
  });

  childProcesses.push({ process: child, config: server });

  child.on('error', (error) => {
    console.error(`[${server.name}] Failed to start:`, error);
  });

  child.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`[${server.name}] Exited with code ${code}, signal ${signal}`);
      // Exit orchestrator if any server fails
      process.exit(code || 1);
    } else {
      console.log(`[${server.name}] Exited normally`);
    }
  });
});

console.log('\nAll servers started. Orchestrator running...');

// Graceful shutdown handler
function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  childProcesses.forEach(({ process, config }) => {
    console.log(`[${config.name}] Stopping...`);
    process.kill('SIGTERM');
  });

  // Give processes 5 seconds to shut down gracefully
  setTimeout(() => {
    console.log('Forcing shutdown...');
    childProcesses.forEach(({ process }) => {
      process.kill('SIGKILL');
    });
    process.exit(0);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Keep process alive
process.stdin.resume();
