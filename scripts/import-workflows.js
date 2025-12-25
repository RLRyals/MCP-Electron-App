/**
 * Import Workflow Script
 * Run this via the Electron app to import the new workflows into the database
 */

const fs = require('fs');
const path = require('path');

async function importWorkflows() {
  console.log('Importing workflows...');

  const workflowFiles = [
    'workflows/simple-test-workflow.json',
    'workflows/idea-to-series-workflow.json',
  ];

  for (const file of workflowFiles) {
    const fullPath = path.join(__dirname, '..', file);
    console.log(`\nReading: ${fullPath}`);

    if (!fs.existsSync(fullPath)) {
      console.error(`❌ File not found: ${fullPath}`);
      continue;
    }

    const workflowData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    console.log(`✓ Loaded: ${workflowData.name}`);
    console.log(`  - Version: ${workflowData.version}`);
    console.log(`  - Nodes: ${workflowData.graph_json?.nodes?.length || 0}`);
    console.log(`  - Edges: ${workflowData.graph_json?.edges?.length || 0}`);

    // In the Electron app, you would call:
    // await window.electronAPI.invoke('workflow:import-definition', workflowData);

    console.log(`\nTo import this workflow, run in the browser console:`);
    console.log(`await window.electronAPI.invoke('workflow:import-definition', ${JSON.stringify(workflowData, null, 2)})`);
  }
}

// If running directly in Node.js
if (require.main === module) {
  importWorkflows().catch(console.error);
}

module.exports = { importWorkflows };
