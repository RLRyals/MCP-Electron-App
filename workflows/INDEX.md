# 12-Phase Novel Series Workflow - File Index

**Version:** 1.0.0
**Created:** 2025-12-20
**Total Files:** 7
**Total Lines:** 3,116

## Quick Navigation

### For Users (Start Here)
1. [QUICK_START_GUIDE.md](#quick-start-guide) - Get started in 5 minutes
2. [README.md](#readme) - Complete workflow documentation
3. [12-phase-novel-series-diagram.md](#workflow-diagram) - Visual flow diagram

### For Developers
1. [12-phase-novel-series.json](#workflow-definition-json) - Base workflow definition
2. [12-phase-novel-series-enhanced.ts](#enhanced-typescript-version) - TypeScript implementation
3. [node-examples.json](#node-examples) - Example configurations

### For Reference
1. [WORKFLOW_CREATION_SUMMARY.md](#creation-summary) - Technical summary
2. [INDEX.md](#this-file) - This file

---

## File Details

### QUICK_START_GUIDE.md
**342 lines | 9.9 KB | For Users**

Step-by-step guide to import and use the workflow in under 5 minutes.

**Contents:**
- Prerequisites checklist
- Import instructions (UI and file menu)
- Project creation steps
- How to provide input at each phase
- Tips for success at each phase
- Monitoring progress
- Pause/resume instructions
- Common troubleshooting
- What to do after completion
- Timeline estimates

**Start here if:** You're a fiction author ready to write your series

---

### README.md
**467 lines | 13 KB | For Users & Developers**

Complete documentation for the workflow including all phases, dependencies, and usage instructions.

**Contents:**
- Workflow overview
- File descriptions
- Detailed phase documentation (13 phases)
- Dependency lists (agents, skills, MCPs)
- Import instructions (3 methods)
- Usage guide for non-technical authors
- Timeline estimates
- Advanced configuration options
- Troubleshooting guide
- Next steps after completion

**Start here if:** You want comprehensive workflow documentation

---

### 12-phase-novel-series-diagram.md
**421 lines | 31 KB | For Users (Visual Learners)**

Visual ASCII diagram showing the complete workflow flow with all nodes, edges, loops, and gates.

**Contents:**
- Complete workflow flow diagram
- Two major loops illustrated
- Two quality gates with pass/fail branches
- Six approval points marked
- Data flow diagram
- Context variables reference
- Execution timeline breakdown
- Legend for diagram symbols

**Start here if:** You want to visualize how the workflow flows

---

### 12-phase-novel-series.json
**571 lines | 20 KB | Import Format**

The base workflow definition in JSON format, ready to import into FictionLab.

**Structure:**
```json
{
  "id": "12-phase-novel-series",
  "name": "12-Phase Novel Series Writing Workflow",
  "version": "1.0.0",
  "description": "...",
  "metadata": { ... },
  "dependencies": {
    "agents": [...],
    "skills": [...],
    "mcpServers": [...]
  },
  "phases": [
    { "id": 0, "type": "user", ... },
    { "id": 1, "type": "planning", ... },
    ...
  ],
  "graph_json": {
    "nodes": [...],
    "edges": [...]
  }
}
```

**Use this file to:** Import the workflow into FictionLab via UI

---

### 12-phase-novel-series-enhanced.ts
**405 lines | 13 KB | TypeScript Implementation**

Enhanced TypeScript implementation using the new WorkflowNode type system with full configuration support.

**Features:**
- Full type safety with TypeScript
- Enhanced node definitions (UserInputNode, AgentWorkflowNode, LoopNode, etc.)
- LLM provider configurations
- Retry configurations
- Context mapping (simple mode)
- User input validation
- File operation nodes
- Quality gate nodes with conditions
- Exported constant for programmatic use

**Example:**
```typescript
import { twelvePhaseNovelSeriesWorkflow } from './workflows/12-phase-novel-series-enhanced';

// Use in code
const workflow = twelvePhaseNovelSeriesWorkflow;
```

**Use this file to:** Import workflow programmatically or customize node configurations

---

### node-examples.json
**564 lines | 16 KB | Reference & Examples**

Detailed examples of each node type configuration with explanations and use cases.

**Contents:**
- User Input Node example
- Planning Agent Node example
- Gate Node example (with conditions)
- Loop Node example (forEach)
- File Write Node example
- File Copy Node example
- Conditional Node example
- Advanced context mapping example
- Alternative LLM provider examples
- Edge examples (sequential, conditional, loop)
- Workflow context example
- Execution flow example

**Use this file to:** Learn how to configure different node types

---

### WORKFLOW_CREATION_SUMMARY.md
**346 lines | 12 KB | Technical Reference**

Technical summary of the workflow creation, features, and implementation details.

**Contents:**
- Overview of what was created
- Files created with descriptions
- Complete feature list (13 phases, node types)
- Two major loops explained
- Two quality gates explained
- Six approval points listed
- Context management details
- Retry configurations
- LLM provider support
- Complete dependency lists
- Timeline estimates
- Output deliverables
- Technical implementation notes
- Testing recommendations
- Known limitations
- Support resources

**Use this file to:** Understand the technical implementation and architecture

---

## Workflow Statistics

### Size and Complexity
- **Total Files:** 7
- **Total Lines:** 3,116
- **Total Size:** ~124 KB
- **Documentation:** 75% (5 docs, 2 code files)

### Workflow Phases
- **Total Phases:** 13 (Node 0 + Phases 1-12)
- **Planning Phases:** 5 (Phases 1, 2, 3, 11, 12)
- **Writing Phases:** 4 (Phases 5, 6, 7, 8)
- **Gate Phases:** 2 (Phases 4, 9)
- **User Input Phases:** 1 (Phase 0)
- **Conditional Phases:** 1 (Phase 11)

### Node Types Used
- **User Input Nodes:** 1
- **Agent Nodes:** 9
- **Loop Nodes:** 1
- **File Operation Nodes:** 2
- **Conditional Nodes:** 1

### Dependencies
- **Agents Required:** 12
- **Skills Required:** 12
- **MCP Servers Required:** 2

### Approval Points
- **Total:** 7 (out of 13 phases)
- **Planning:** 2 (Phases 2, 3)
- **Quality Gates:** 2 (Phases 4, 9)
- **Editing:** 2 (Phases 7, 8)
- **Completion:** 1 (Phase 12)

### Loops and Branching
- **Book Loop:** Phases 3-11 (repeats 5 times)
- **Chapter Loop:** Phase 5 (25-30 iterations)
- **Quality Gate 1:** Phase 4 (loops back to Phase 3 if failed)
- **Quality Gate 2:** Phase 9 (loops back to Phase 7 if failed)
- **Series Progression:** Phase 11 (branches to Phase 3 or 12)

## Usage Recommendations

### For Fiction Authors (Non-Technical)
**Start with:** QUICK_START_GUIDE.md
**Then read:** README.md (Phase descriptions section)
**Refer to:** 12-phase-novel-series-diagram.md (visual reference)

### For Technical Users
**Start with:** README.md
**Then explore:** 12-phase-novel-series-enhanced.ts
**Refer to:** node-examples.json (configuration examples)

### For Developers Integrating the Workflow
**Start with:** WORKFLOW_CREATION_SUMMARY.md
**Import using:** 12-phase-novel-series-enhanced.ts
**Reference:** node-examples.json (advanced configurations)

### For Workflow Designers
**Start with:** 12-phase-novel-series.json (base structure)
**Study:** 12-phase-novel-series-enhanced.ts (advanced features)
**Reference:** node-examples.json (node type examples)

## Import Methods

### Method 1: FictionLab UI (Easiest)
```
1. Open FictionLab
2. Workflows tab → Import Workflow
3. Select: 12-phase-novel-series.json
4. Click: Install and Import
```

### Method 2: File Menu
```
1. File → Import Workflow
2. Select: workflows/12-phase-novel-series.json
3. Follow installation wizard
```

### Method 3: Programmatic (TypeScript)
```typescript
import { twelvePhaseNovelSeriesWorkflow } from
  './workflows/12-phase-novel-series-enhanced';

const workflow = twelvePhaseNovelSeriesWorkflow;
// Use workflow in code
```

## Timeline Estimates

### Per Book (90,000 words)
- Planning & Validation: 2-4 hours
- Chapter Writing: 6-8 hours
- Editing & QA: 2-3 hours
- **Total: ~10-15 hours per book**

### Complete 5-Book Series (450,000 words)
- **Total: ~50-75 hours**
- **Equivalent: 2-3 weeks of part-time work**

*Note: Actual time varies based on LLM provider speed and review time*

## Output Deliverables

### Per Book
```
your-project-folder/
  ├── BookN_Manuscript.txt        (~90,000 words)
  └── exports/
      ├── BookN_Final.txt
      ├── BookN_Final.docx
      └── BookN_Final.pdf
```

### Series Completion (After Book 5)
- Series completion report
- Marketing materials
- Character and world bible
- Publication timeline
- Complete series package

## Support Resources

### Documentation
- This INDEX.md - Navigation guide
- QUICK_START_GUIDE.md - Step-by-step setup
- README.md - Complete reference
- 12-phase-novel-series-diagram.md - Visual flow

### Examples
- node-examples.json - Configuration examples
- 12-phase-novel-series-enhanced.ts - TypeScript implementation

### Technical
- WORKFLOW_CREATION_SUMMARY.md - Implementation details

### Community
- FictionLab Discord server
- Community forum
- GitHub Issues
- Email: support@fictionlab.app

## Version History

### Version 1.0.0 (2025-12-20)
- Initial release
- Complete 13-phase workflow
- 12 agents and 12 skills defined
- Full documentation suite
- TypeScript implementation
- Node examples and reference

## License

This workflow is provided as part of FictionLab and is licensed under the same terms as the main application.

---

**Index Version:** 1.0.0
**Workflow Version:** 1.0.0
**Last Updated:** 2025-12-20
**Status:** Production Ready ✅
