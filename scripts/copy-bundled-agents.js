#!/usr/bin/env node
/**
 * Copy bundled agents to ~/.claude/agents/
 * Run this to populate the Claude Code agents directory with bundled agents
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function copyBundledAgents() {
  const homeDir = os.homedir();
  const targetDir = path.join(homeDir, '.claude', 'agents');
  const sourceDir = path.join(__dirname, '..', '.claude', 'agents');

  console.log('Copying bundled agents to Claude Code directory...');
  console.log(`Source: ${sourceDir}`);
  console.log(`Target: ${targetDir}`);

  // Check if source exists
  if (!await fs.pathExists(sourceDir)) {
    console.error(`Error: Source directory does not exist: ${sourceDir}`);
    process.exit(1);
  }

  // Create target directory if it doesn't exist
  await fs.ensureDir(targetDir);

  // Get list of agent files
  const files = await fs.readdir(sourceDir);
  const agentFiles = files.filter(file => file.endsWith('.md'));

  console.log(`Found ${agentFiles.length} agent files to copy`);

  // Copy each agent file
  for (const file of agentFiles) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);

    // Only copy if file doesn't exist in target (don't overwrite user customizations)
    if (!await fs.pathExists(targetPath)) {
      await fs.copy(sourcePath, targetPath);
      console.log(`  ✓ Copied ${file}`);
    } else {
      console.log(`  - Skipped ${file} (already exists)`);
    }
  }

  console.log('\n✓ Bundled agents copied successfully!');
  console.log(`\nAgents are now available in: ${targetDir}`);
}

// Run if called directly
if (require.main === module) {
  copyBundledAgents().catch(error => {
    console.error('Error copying bundled agents:', error);
    process.exit(1);
  });
}

module.exports = { copyBundledAgents };
