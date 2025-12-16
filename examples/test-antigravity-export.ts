/**
 * Test script for Antigravity Workflow Export
 *
 * Demonstrates how to export a FictionLab workflow to Antigravity format
 * Run with: npx ts-node examples/test-antigravity-export.ts
 */

import * as path from 'path';
import { WorkflowParser } from '../src/main/parsers/workflow-parser';
import { AntigravityWorkflowExporter } from '../src/main/exporters/antigravity-workflow-exporter';

async function main() {
  console.log('🚀 Testing FictionLab → Antigravity Workflow Export\n');

  // Path to example workflow
  const workflowPath = path.join(__dirname, 'workflows', 'image-generation-workflow.yaml');
  const outputDir = path.join(__dirname, 'output', 'antigravity-workflows');

  console.log(`📂 Input workflow: ${workflowPath}`);
  console.log(`📂 Output directory: ${outputDir}\n`);

  try {
    // Step 1: Parse the workflow
    console.log('📖 Step 1: Parsing workflow...');
    const parser = new WorkflowParser();
    const workflow = await parser.parseWorkflow(workflowPath);
    console.log(`   ✅ Parsed workflow: "${workflow.name}"`);
    console.log(`   📊 Phases: ${workflow.phases.length}`);
    console.log(`   🔧 Dependencies: ${workflow.dependencies.mcpServers.length} MCP servers\n`);

    // Step 2: Preview the export
    console.log('👀 Step 2: Previewing export...');
    const exporter = new AntigravityWorkflowExporter();
    const preview = await exporter.previewExport(workflow);
    console.log(`   ✅ Preview complete`);
    console.log(`   📝 Workflows to create: ${preview.workflowCount}`);
    console.log(`   📋 Workflow chain:`);
    preview.workflowChain.forEach((filename, index) => {
      console.log(`      ${index + 1}. ${filename}`);
    });
    console.log();

    // Show workflow details
    console.log('📄 Workflow Segments:\n');
    preview.workflows.forEach((wf, index) => {
      console.log(`   ${index + 1}. ${wf.filename}`);
      console.log(`      Description: ${wf.description}`);
      console.log(`      Size: ${wf.size} characters`);
      console.log(`      Dependencies: ${wf.dependencies.join(', ')}`);
      if (wf.nextWorkflow) {
        console.log(`      Next workflow: ${wf.nextWorkflow}`);
      } else {
        console.log(`      Next workflow: [Final step]`);
      }
      console.log();
    });

    // Step 3: Export the workflow
    console.log('💾 Step 3: Exporting to files...');
    const result = await exporter.exportWorkflow(workflow, outputDir);
    console.log(`   ✅ Export complete!`);
    console.log(`   📁 Created ${result.workflows.length} workflow files`);
    console.log(`   📍 Location: ${outputDir}\n`);

    // Show file listing
    console.log('📋 Created files:\n');
    result.workflows.forEach((wf, index) => {
      console.log(`   ${index + 1}. ${wf.filename}`);
    });
    console.log(`   ${result.workflows.length + 1}. INSTALLATION.md`);
    console.log();

    // Show preview of first workflow
    console.log('📖 Preview of first workflow:\n');
    console.log('─'.repeat(80));
    console.log(preview.workflows[0].content.substring(0, 800) + '...');
    console.log('─'.repeat(80));
    console.log();

    // Show installation guide preview
    console.log('📖 Installation Guide Preview:\n');
    console.log('─'.repeat(80));
    console.log(preview.installationGuide.substring(0, 1000) + '...');
    console.log('─'.repeat(80));
    console.log();

    console.log('✨ Export successful! Check the output directory for files.\n');
    console.log('📝 To use in Antigravity:');
    console.log('   1. Copy all .md files to .agent/workflows/');
    console.log('   2. Configure required MCP servers');
    console.log(`   3. Run: /${result.workflowChain[0].replace('.md', '')}`);
    console.log();

  } catch (error) {
    console.error('❌ Export failed:', error);
    if (error instanceof Error) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
