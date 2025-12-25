#!/usr/bin/env node
/**
 * Check workflow definition in database
 */

const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');

const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appDataPath, 'fictionlab', 'fictionlab.db');

console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });

  const row = db.prepare('SELECT graph_json FROM workflow_definitions WHERE workflow_def_id = ?').get('idea-to-series');

  if (!row) {
    console.log('Workflow not found in database');
    process.exit(1);
  }

  const graph = JSON.parse(row.graph_json);
  const firstNode = graph.nodes.find(n => n.id === '1');

  console.log('\nFirst node (ID: 1):');
  console.log(JSON.stringify(firstNode, null, 2));

  db.close();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
