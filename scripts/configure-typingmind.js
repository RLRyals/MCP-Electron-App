#!/usr/bin/env node

/**
 * TypingMind Auto-Configuration Script
 * This script automatically configures TypingMind with the MCP Connector
 *
 * Usage:
 *   node scripts/configure-typingmind.js
 *   node scripts/configure-typingmind.js --url http://localhost:3000 --token YOUR_TOKEN
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Parse command line arguments
const args = process.argv.slice(2);
let customUrl = null;
let customToken = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    customUrl = args[i + 1];
    i++;
  } else if (args[i] === '--token' && args[i + 1]) {
    customToken = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
TypingMind Auto-Configuration Script
====================================

Usage:
  node scripts/configure-typingmind.js [options]

Options:
  --url URL      Custom server URL (default: http://localhost:50880)
  --token TOKEN  Custom auth token (default: from .env file)
  --help, -h     Show this help message

Examples:
  # Use default settings from .env
  node scripts/configure-typingmind.js

  # Use custom URL and token
  node scripts/configure-typingmind.js --url http://localhost:3000 --token YOUR_TOKEN
`);
    process.exit(0);
  }
}

// Get user data path
const userDataPath = app?.getPath('userData') || path.join(process.env.APPDATA || process.env.HOME, '.mcp-electron-app');

// Load .env file
function loadEnvConfig() {
  const envPath = path.join(userDataPath, '.env');

  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found at:', envPath);
    console.error('Please complete the app setup first.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const config = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      config[key] = value;
    }
  });

  return config;
}

// Main configuration function
function configureTypingMind() {
  console.log('TypingMind Auto-Configuration');
  console.log('============================\n');

  // Load environment config
  const envConfig = loadEnvConfig();

  // Determine URL and token
  const serverUrl = customUrl || `http://localhost:${envConfig.MCP_CONNECTOR_PORT || 50880}`;
  const authToken = customToken || envConfig.MCP_AUTH_TOKEN;

  if (!authToken) {
    console.error('Error: No auth token found.');
    console.error('Please provide --token or ensure MCP_AUTH_TOKEN is set in .env');
    process.exit(1);
  }

  // Create configuration
  const config = {
    enabled: true,
    serverUrl: serverUrl,
    authToken: authToken,
    autoConnect: true,
    configuredAt: new Date().toISOString(),
  };

  // Save configuration
  const configPath = path.join(userDataPath, 'typingmind-mcp-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  console.log('✓ Configuration saved successfully!\n');
  console.log('Configuration Details:');
  console.log('---------------------');
  console.log(`Server URL: ${config.serverUrl}`);
  console.log(`Auth Token: ${authToken.substring(0, 8)}...${authToken.substring(authToken.length - 8)}`);
  console.log(`Config File: ${configPath}\n`);

  console.log('Setup Instructions for TypingMind:');
  console.log('----------------------------------');
  console.log('1. Open TypingMind at: http://localhost:' + (envConfig.TYPING_MIND_PORT || 3000));
  console.log('2. Navigate to Settings → MCP Integration');
  console.log('3. Enter the following:');
  console.log(`   Server URL: ${config.serverUrl}`);
  console.log(`   Auth Token: ${authToken}`);
  console.log('4. Click "Connect" or "Save"\n');

  console.log('✓ Done! Your configuration is ready.');
}

// Run the script
try {
  configureTypingMind();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
