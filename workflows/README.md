# 12-Phase Novel Series Writing Workflow

A complete, production-ready workflow for writing a 5-book urban fantasy series from initial idea to publication-ready manuscript.

## Overview

This workflow guides non-technical fiction authors through the entire process of creating a professional 5-book series, including:

- Market research and competitive analysis
- Series architecture and planning
- Detailed book outlining
- Quality gates to prevent common errors
- Automated chapter writing with loops
- Professional editing (developmental and line editing)
- Final quality validation
- Export preparation for publication
- Series progression tracking

## Files in this Workflow

### `12-phase-novel-series.json`
The base workflow definition in JSON format, compatible with the FictionLab workflow parser. This file includes:
- 13 phases (User Input + 12 processing phases)
- Phase metadata (agents, skills, descriptions)
- Graph visualization data
- Dependency declarations

### `12-phase-novel-series-enhanced.ts`
Enhanced TypeScript definition using the new WorkflowNode type system. This file includes:
- Full node configurations with all features
- User input node with validation
- Loop node for chapter iteration
- File operation nodes for manuscript assembly
- Quality gate nodes with conditions
- Retry configurations
- Context mapping (simple mode)

## Workflow Phases

### Phase 0: User Input - Book/Series Idea Capture
**Type:** `user-input`

Captures the author's initial idea through a textarea input.

**Configuration:**
- Minimum length: 50 characters
- Maximum length: 5000 characters
- Required field: Yes

**Output:** User's book/series idea with genre, characters, setting, and themes

---

### Phase 1: Market Research
**Type:** `planning`
**Agent:** `market-research-agent`
**Skill:** `urban-fantasy-market-analysis`

Analyzes current market trends in urban fantasy, identifies comparable titles, and defines target audience.

**Output:** Market analysis report with:
- 5-10 comp titles
- Trending tropes
- Target audience profile
- Positioning recommendations

---

### Phase 2: Series Architecture
**Type:** `planning`
**Agent:** `series-architect-agent`
**Skill:** `five-book-series-planning`

Plans the overall structure for all 5 books including character arcs and world progression.

**Requires Approval:** Yes (author should review series plan)

**Output:** Series bible containing:
- 5-book series arc structure
- Protagonist character arc across all books
- Supporting character arcs
- World-building progression
- One-paragraph summary for each book

---

### Phase 3: Book 1 Planning
**Type:** `planning`
**Agent:** `book-planner-agent`
**Skill:** `detailed-book-planning`

Creates a detailed outline for Book 1 with chapter-by-chapter breakdown.

**Requires Approval:** Yes (author should review book outline)

**Output:** Detailed outline with:
- 3-act structure
- 25-30 chapter breakdown
- Scene cards for each chapter
- Character profiles
- Subplot tracking

---

### Phase 4: NPE Validation (Quality Gate)
**Type:** `gate`
**Agent:** `npe-validator-agent`
**Skill:** `validate-novel-structure`

Validates planning quality using the No Pulp Errors (NPE) checklist.

**Gate Condition:** `$.score >= 80`
**Requires Approval:** Yes

**Checks:**
- Plot holes and inconsistencies
- Character motivation clarity
- Pacing and structure balance
- World-building coherence
- Genre convention adherence

**Output:** Validation report with score (0-100) and recommendations

**If Failed:** Workflow loops back to Phase 3 (Book 1 Planning) for revision

---

### Phase 5: Chapter Writing Loop
**Type:** `loop`
**Loop Type:** `forEach`
**Collection:** `$.book1Planning.chapters`

Iteratively writes each chapter of Book 1 (25-30 chapters).

**Iterator Variables:**
- `currentChapter`: Current chapter data
- `chapterIndex`: Chapter number (0-based)

**Per Chapter:**
- Loads chapter outline and scene cards
- Loads character profiles
- References previous chapter for continuity
- Generates 3000-5000 word chapter
- Validates chapter quality

**Output:** Array of 25-30 completed chapters (~90,000 words total)

---

### Phase 6: Manuscript Assembly
**Type:** `file`
**Operation:** `write`
**Target Path:** `{{projectFolder}}/Book1_Manuscript.txt`

Assembles all chapters into a complete manuscript file.

**Process:**
- Loads all chapters in order
- Adds front matter (title page, copyright)
- Formats chapter headers and breaks
- Generates table of contents
- Calculates word count statistics

**Output:** Complete manuscript file and statistics report

---

### Phase 7: Developmental Edit
**Type:** `writing`
**Agent:** `developmental-editor-agent`
**Skill:** `manuscript-dev-edit`

High-level structural editing for story, pacing, and character arcs.

**Requires Approval:** Yes (author reviews suggestions)

**Analyzes:**
- Overall story structure and pacing
- Character development and arcs
- Plot consistency and logic
- Scene flow and transitions
- Weak or unnecessary scenes

**Output:** Developmental edit report with revision recommendations

---

### Phase 8: Line Edit
**Type:** `writing`
**Agent:** `line-editor-agent`
**Skill:** `manuscript-line-edit`

Sentence-level editing for style, clarity, and grammar.

**Requires Approval:** Yes (author reviews changes)

**Improves:**
- Sentence clarity and style
- Grammar and punctuation
- Word choice (eliminates clichés)
- Dialogue tags and beats
- Prose tightness
- Voice and tone consistency

**Output:** Line-edited manuscript with change log

---

### Phase 9: Final Quality Gate
**Type:** `gate`
**Agent:** `final-validator-agent`
**Skill:** `manuscript-quality-check`

Final validation before publication.

**Gate Condition:** `$.readiness >= 90`
**Requires Approval:** Yes

**Validates:**
- Plot consistency and resolution
- Character arc completion
- Prose quality and readability
- Genre expectations met
- Formatting and typos

**Output:** Readiness score (0-100) and final recommendations

**If Failed:** Workflow loops back to Phase 7 (Developmental Edit)

---

### Phase 10: Export for Publication
**Type:** `file`
**Operation:** `copy`
**Source:** `{{projectFolder}}/Book1_Manuscript.txt`
**Target:** `{{projectFolder}}/exports/Book1_Final.txt`

Copies final manuscript to export folder for publication.

**Also Creates:**
- Multiple formats (TXT, DOCX, PDF)
- Submission package with metadata
- Cover letter template
- Backup copies
- Export manifest

**Output:** Publication-ready files in exports folder

---

### Phase 11: Series Progression Check
**Type:** `conditional`
**Condition:** `$.currentBookNumber < 5`

Determines if more books need to be written.

**Logic:**
- If `currentBookNumber < 5`: Loop back to Phase 3 for next book
- If `currentBookNumber >= 5`: Proceed to Phase 12 (Series Completion)

**Output:** Next action decision

---

### Phase 12: Series Completion
**Type:** `planning`
**Agent:** `series-completion-agent`
**Skill:** `series-wrap-up`

Generates final series completion report.

**Requires Approval:** Yes

**Generates:**
- Statistics for all 5 books
- Series completion report
- Marketing materials
- Character and world bible
- Publication timeline
- Author notes and appendices

**Output:** Complete series package ready for publication

---

## Dependencies

### Agents Required (12)
1. `market-research-agent` - Market analysis
2. `series-architect-agent` - Series planning
3. `book-planner-agent` - Book outlining
4. `npe-validator-agent` - Quality validation
5. `chapter-writer-agent` - Chapter writing
6. `manuscript-assembler-agent` - File assembly
7. `developmental-editor-agent` - Structural editing
8. `line-editor-agent` - Line editing
9. `final-validator-agent` - Final validation
10. `export-manager-agent` - Export preparation
11. `series-progression-agent` - Progress tracking
12. `series-completion-agent` - Series wrap-up

### Skills Required (12)
1. `urban-fantasy-market-analysis`
2. `five-book-series-planning`
3. `detailed-book-planning`
4. `validate-novel-structure`
5. `chapter-writing`
6. `manuscript-assembly`
7. `manuscript-dev-edit`
8. `manuscript-line-edit`
9. `manuscript-quality-check`
10. `export-preparation`
11. `series-progression-check`
12. `series-wrap-up`

### MCP Servers Required (2)
1. `workflow-manager` - Workflow state and data persistence
2. `file-system` - File read/write operations

## How to Import

### Option 1: Via FictionLab UI
1. Open FictionLab app
2. Navigate to Workflows tab
3. Click "Import Workflow"
4. Select `12-phase-novel-series.json`
5. Review dependency installation plan
6. Click "Install and Import"

### Option 2: Via Workflow Parser
```typescript
import { WorkflowParser } from '../src/main/parsers/workflow-parser';
import { FolderImporter } from '../src/main/workflow/folder-importer';

const importer = new FolderImporter();
const result = await importer.importFromFolder('./workflows/12-phase-novel-series');
```

### Option 3: Programmatic (Enhanced Nodes)
```typescript
import { twelvePhaseNovelSeriesWorkflow } from './workflows/12-phase-novel-series-enhanced';

// Use enhanced workflow definition with full node configurations
const workflow = twelvePhaseNovelSeriesWorkflow;
```

## Usage for Non-Technical Authors

This workflow is designed for ease of use:

### Simple Mode (Default)
- **Automatic context passing**: Each phase automatically receives relevant data from previous phases
- **No manual configuration required**: All agents and skills are pre-configured
- **Guided input**: Clear prompts at each step
- **Approval gates**: Author reviews key decisions at critical points

### What Authors Need to Provide

1. **Initial Idea** (Phase 0): Describe your book/series idea
2. **Series Plan Review** (Phase 2): Approve or revise the 5-book series structure
3. **Book Outline Review** (Phase 3): Approve or revise the detailed Book 1 outline
4. **NPE Validation** (Phase 4): Review validation results and approve or request revisions
5. **Dev Edit Review** (Phase 7): Review structural editing suggestions
6. **Line Edit Review** (Phase 8): Review line editing changes
7. **Final Quality Review** (Phase 9): Final approval before export
8. **Series Completion** (Phase 12): Review final series package

### Estimated Timeline

For a complete 5-book series (~450,000 words total):

- **Phase 0-4** (Planning & Validation): 2-4 hours per book
- **Phase 5** (Chapter Writing): ~6-8 hours per book (assuming 1-2 min/chapter)
- **Phase 6-10** (Assembly & Editing): 2-3 hours per book
- **Total per book**: ~10-15 hours
- **Total for 5 books**: ~50-75 hours

*Note: Actual time depends on LLM provider speed, review time, and revision cycles*

## Advanced Configuration

### Using Different LLM Providers

The enhanced TypeScript version allows per-node LLM provider selection:

```typescript
// Change provider for specific node
enhancedNodes[1].provider = {
  type: 'claude-api',
  name: 'My Claude API',
  config: {
    apiKey: 'your-api-key',
    model: 'claude-sonnet-4-5',
    maxTokens: 4096
  }
};
```

### Customizing Retry Behavior

```typescript
// Increase retries for validation gate
enhancedNodes[4].retryConfig = {
  maxRetries: 10,
  retryDelayMs: 3000,
  backoffMultiplier: 2
};
```

### Adjusting Loop Parameters

```typescript
// Change chapter writing loop
const chapterLoop = enhancedNodes[5] as LoopNode;
chapterLoop.maxIterations = 100; // Allow up to 100 chapters
chapterLoop.collection = '$.bookPlanning.chapters'; // Different data source
```

## Troubleshooting

### Workflow Fails at NPE Validation (Phase 4)
- **Cause**: Book outline has structural issues (score < 80)
- **Solution**: Review validation report, improve outline in Phase 3, retry

### Workflow Fails at Final Quality Gate (Phase 9)
- **Cause**: Manuscript quality below publication threshold (readiness < 90)
- **Solution**: Review quality report, apply editing suggestions in Phases 7-8

### Chapter Writing Loop Times Out
- **Cause**: Individual chapters taking too long to generate
- **Solution**: Increase `timeoutMs` for Phase 5, check LLM provider performance

### Missing Agent or Skill Errors
- **Cause**: Required dependencies not installed
- **Solution**: Run dependency check, install missing components from workflow folder

### File Write Errors (Phase 6, Phase 10)
- **Cause**: Project folder not set, permissions issue
- **Solution**: Set `{{projectFolder}}` variable, check write permissions

## Next Steps

After completing this workflow:

1. **Review all 5 books** in the exports folder
2. **Hire a human editor** for final professional polish (recommended)
3. **Format for publication** using tools like Vellum or Atticus
4. **Upload to publishing platforms** (Amazon KDP, IngramSpark, etc.)
5. **Launch marketing campaign** using series marketing materials

## Support

For issues or questions:
- Check the FictionLab documentation
- Review agent and skill markdown files in `.claude/` folder
- Join the FictionLab community forum
- Submit issues on GitHub

## License

This workflow is provided as part of FictionLab and is licensed under the same terms as the main application.

---

**Version:** 1.0.0
**Last Updated:** 2025-12-20
**Author:** FictionLab Team
