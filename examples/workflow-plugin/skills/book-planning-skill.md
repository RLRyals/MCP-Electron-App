---
name: book-planning-skill
description: Individual book planning and structure skill for FictionLab workflows. Plan a single book within a series, developing plot structure, chapter breakdown, and character arcs. Use when the user wants to plan a new book, create chapter outlines, develop three-act structure, or map character journeys for a specific book. Triggers include phrases like "plan book 2," "outline the next book," "develop book structure," or requests for chapter-by-chapter planning.
metadata:
  version: "1.0"
  phase: "planning"
  mcps: ["book-planning-server", "series-planning-server", "character-planning-server"]
---

# Book Planning Skill

Structured workflow for planning an individual book within a series. This skill guides the development of book structure, three-act plot, chapter breakdown, character arcs, and series continuity elements.

---

## Conversation Protocol

### Session Start

When beginning book planning:

1. **Identify Book Context**
   - Which book in the series is being planned?
   - What is the series arc phase (early/middle/late)?
   - What happened in the previous book (if applicable)?
   - What must this book set up for future books?

2. **Establish Book Goals**
   - What is the primary theme of this book?
   - Which character(s) have the main arc?
   - What series-level threads advance in this book?
   - What is the standalone hook that makes this book satisfying on its own?

3. **Load Series Context**
   ```
   MCP READ Operations (no permission required):
   - series-planning-server: get_series_overview()
   - series-planning-server: get_series_arcs()
   - book-planning-server: list_books() - for previous books
   - character-planning-server: list_characters()
   ```

### Conversation Flow

The planning conversation should progress through these stages:

1. **Book Foundation** (10-15 minutes)
   - Discuss book's role in series arc
   - Establish thematic focus
   - Identify protagonist goals and obstacles
   - Determine book's emotional journey

2. **Structure Development** (15-20 minutes)
   - Define three-act structure with major beats
   - Identify inciting incident, midpoint, and climax
   - Map character turning points
   - Establish stakes escalation

3. **Chapter Breakdown** (20-30 minutes)
   - Create ~20-25 chapter outline
   - Assign scenes to chapters
   - Balance pacing across acts
   - Identify chapter hooks and cliffhangers

4. **Character Arc Mapping** (15-20 minutes)
   - Define character goals per book
   - Map internal/external obstacles
   - Plan relationship developments
   - Track character knowledge states

5. **Series Continuity** (10-15 minutes)
   - Verify series arc advancement
   - Check character continuity
   - Plan cliffhanger or resolution
   - Set up hooks for next book

---

## Required Outputs

### 1. Book Synopsis

A comprehensive summary that includes:

```markdown
# Book [N]: [Title]

## Logline
One-sentence hook that captures the book's core conflict.

## Synopsis (2-3 paragraphs)
Overview of the book's main plot, character journey, and stakes.

## Book's Role in Series
- Series arc phase: [early/middle/late]
- Series threads advanced: [list threads]
- Setup for future books: [key elements planted]

## Thematic Focus
Primary theme and how it manifests in the story.

## Emotional Journey
The protagonist's emotional arc from start to finish.
```

### 2. Three-Act Structure

Detailed breakdown of the plot structure:

```markdown
# Three-Act Structure: Book [N]

## Act 1: Setup (0-25%)
### Opening (0-5%)
- Scene: [Opening scene description]
- Establishes: [World, character, normal life]

### Inciting Incident (10-15%)
- Event: [What disrupts normal life]
- Stakes: [Initial stakes introduced]
- Character response: [Protagonist's initial reaction]

### First Plot Point (20-25%)
- Turning point: [Point of no return]
- Commitment: [Protagonist commits to goal]
- New world: [Entry into unfamiliar territory]

## Act 2A: Rising Action (25-50%)
### First Pinch Point (35-40%)
- Antagonist presence: [Force opposition felt]
- Complications: [Obstacles encountered]

### Midpoint (50%)
- Revelation: [Major information/shift]
- Stakes raise: [Consequences escalate]
- Protagonist shift: [From reactive to proactive]

## Act 2B: Complications (50-75%)
### Second Pinch Point (60-65%)
- Setback: [Major obstacle or loss]
- Doubt: [Protagonist questions path]

### Dark Night of the Soul (70-75%)
- Crisis: [Lowest point for protagonist]
- Internal conflict: [Core belief challenged]
- Decision: [Choice that defines character]

## Act 3: Resolution (75-100%)
### Second Plot Point (75-80%)
- New information: [Final piece of puzzle]
- Galvanized: [Protagonist gains clarity]

### Climax (85-95%)
- Confrontation: [Face antagonist/obstacle]
- Sacrifice/Choice: [Protagonist proves growth]
- Resolution: [Conflict resolved]

### Denouement (95-100%)
- New normal: [Changed world/character]
- Series hook: [Setup for next book]
- Emotional landing: [Reader satisfaction]
```

### 3. Chapter Breakdown

Target 20-25 chapters with clear objectives:

```markdown
# Chapter Breakdown: Book [N]

## ACT 1 (Chapters 1-6)

### Chapter 1: [Chapter Title]
- POV: [Character]
- Location: [Setting]
- Time: [When in timeline]
- Objectives:
  - Plot: [What happens]
  - Character: [What develops]
  - Reader: [What's revealed/hooked]
- Chapter hook: [Ending that pulls reader forward]

### Chapter 2: [Chapter Title]
[Same structure...]

## ACT 2A (Chapters 7-12)
[Continue pattern...]

## ACT 2B (Chapters 13-18)
[Continue pattern...]

## ACT 3 (Chapters 19-25)
[Continue pattern...]

---

## Chapter Pacing Summary
- Action/Tension chapters: [list]
- Relationship/Character chapters: [list]
- Information/Setup chapters: [list]
- Climax sequence: Chapters [X-Y]

## Scene Count per Chapter
Average: [X] scenes
Range: [Min] - [Max] scenes
Total scenes: [N]
```

### 4. Character Arcs for This Book

For each major character in the book:

```markdown
# Character Arcs: Book [N]

## [Protagonist Name]

### Book Entry State
- Emotional state: [Where they are at book start]
- Belief/Flaw: [Limiting belief or character flaw]
- Goal: [What they want]
- Need: [What they actually need]

### Obstacles
- External: [External forces opposing goal]
- Internal: [Internal barriers to growth]
- Relationship: [Interpersonal conflicts]

### Key Turning Points
1. Chapter [X]: [Description of turning point]
2. Chapter [Y]: [Description of turning point]
3. Chapter [Z]: [Description of turning point]

### Book Exit State
- Growth: [How they've changed]
- New belief: [What they now understand]
- Unresolved: [What carries forward]
- Setup: [Where they're headed in next book]

## [Supporting Character Name]
[Same structure for each major character...]

---

## Relationship Progressions

### [Character A] & [Character B]
- Book start: [Relationship status]
- Key moments: [List chapter beats]
- Book end: [New relationship status]
- Tension/Growth: [What developed]
```

---

## Approval Gate

### Before MCP Save Operations

Present the complete book plan for user approval:

```
I've developed the following book plan for Book [N]: [Title]

BOOK SYNOPSIS:
[2-3 sentence summary]

THREE-ACT STRUCTURE:
- Act 1 (Chapters 1-[X]): [Brief summary]
- Act 2A (Chapters [X]-[Y]): [Brief summary]
- Act 2B (Chapters [Y]-[Z]): [Brief summary]
- Act 3 (Chapters [Z]-[N]): [Brief summary]

CHAPTER BREAKDOWN:
- Total chapters: [N]
- Key chapters: [List 3-4 pivotal chapters]

CHARACTER ARCS:
- [Protagonist]: [One-line arc summary]
- [Supporting characters]: [One-line each]

SERIES CONTINUITY:
- Advances: [Which series arcs]
- Sets up: [What for future books]
- Resolves: [What from previous books]

Would you like to approve this plan, or should I make changes?
```

### Approval Response Handling

**If approved:**
- Proceed to MCP save operations
- Confirm each save operation completed
- Provide summary of saved data

**If changes requested:**
- Clarify which section needs revision
- Discuss specific changes needed
- Revise and re-present for approval
- Iterate until approved

**If rejected:**
- Understand user's concerns
- Discuss alternative approaches
- Start fresh or modify substantially
- Re-present completely new plan

---

## MCP Save Operations

### Required Permission Protocol

**CRITICAL: ALWAYS ASK PERMISSION before any MCP create/add/update operation**

Before executing ANY write operation:
1. Present what will be created/updated
2. Show the data structure
3. Wait for explicit "approved" confirmation
4. Only then execute the operation
5. Report success or failure

### Save Sequence (After Approval)

```
I'm ready to save the book plan to FictionLab. This involves:

1. book-planning-server: create_book()
   - Book number: [N]
   - Title: "[Title]"
   - Target word count: [X]

2. book-planning-server: add_beat_point() (multiple)
   - [X] beat points for three-act structure

3. book-planning-server: add_chapter() (multiple)
   - [N] chapters with objectives

4. character-planning-server: update_character_arc() (multiple)
   - [X] character arcs for this book

5. series-planning-server: update_series_arc()
   - Update series arc progress for book [N]

May I proceed with saving to FictionLab?
```

### MCP Operations Reference

**book-planning-server Operations:**

Read (no permission needed):
- `get_book(book_id)` - Retrieve book details
- `list_books()` - List all books in series
- `get_book_beats(book_id)` - Get beat structure
- `get_chapters(book_id)` - Get chapter list

Write (REQUIRES PERMISSION):
- `create_book(data)` - Create new book entry
- `update_book(book_id, data)` - Update book metadata
- `add_beat_point(book_id, beat_data)` - Add story beat
- `add_chapter(book_id, chapter_data)` - Add chapter outline
- `update_chapter(chapter_id, data)` - Update chapter

**series-planning-server Operations:**

Read (no permission needed):
- `get_series_overview()` - Series summary
- `get_series_arcs()` - All story arcs
- `get_timeline()` - Series chronology

Write (REQUIRES PERMISSION):
- `update_series_arc(arc_id, data)` - Advance arc status

**character-planning-server Operations:**

Read (no permission needed):
- `list_characters()` - All characters
- `get_character(character_id)` - Character details
- `get_character_arc(character_id, book_number)` - Character's book arc

Write (REQUIRES PERMISSION):
- `update_character_arc(character_id, book_number, data)` - Set character arc

---

## IPC Communication

For saving to FictionLab via the workflow runner:

```bash
# Save book plan
node ~/.claude/skills/run-workflow/ipc-client.js save-book <book-data-json>

# Save chapters
node ~/.claude/skills/run-workflow/ipc-client.js save-chapters <book-id> <chapters-json>

# Update character arcs
node ~/.claude/skills/run-workflow/ipc-client.js update-character-arc <character-id> <arc-data-json>
```

---

## Automatic ID Management

### ID Discovery on Session Start

**Skills automatically handle ID resolution - users never interact with IDs directly.**

When a session starts:
1. Query MCP servers for existing entities
2. Cache IDs in session memory
3. Build human-readable mappings (name to ID)

**Cached IDs for Book Planning:**
- `series_id` - Current series identifier
- `book_id` - Book being planned (or new)
- `character_ids` - Map of character names to IDs
- `arc_ids` - Map of series arc names to IDs
- `previous_book_id` - Previous book for continuity

### Transparent ID Resolution

**Users interact with names, skills handle ID translation.**

When user says: "Plan book 3 for the Morgan series"

The skill:
1. Resolves "Morgan series" to `series_id`
2. Checks existing books, determines `book_number = 3`
3. Creates book with proper series linkage
4. Caches new `book_id` for subsequent operations
5. Responds: "Starting book 3 planning for the Morgan series."

**User never sees** internal IDs.

---

## Book Planning Workflow Phases

### Phase 1: Book Foundation

**Objectives:**
- Establish book's place in series
- Define book-level theme and goals
- Identify protagonist's journey for this book

**Questions to Explore:**
1. What is the central conflict of this book?
2. Who is the primary POV character?
3. What does the protagonist want vs. need?
4. What is the book's theme statement?
5. How does this book advance the series arc?

**Output:** Book foundation document with synopsis draft

### Phase 2: Three-Act Structure

**Objectives:**
- Define major plot beats
- Map protagonist's emotional journey
- Identify key turning points

**Beat Points to Define:**
- Opening image/scene
- Inciting incident (10-15%)
- First plot point/break into Act 2 (~25%)
- B-story introduction (30%)
- Midpoint revelation/shift (50%)
- Bad guys close in (55-70%)
- All is lost moment (75%)
- Dark night of the soul (75-80%)
- Break into Act 3 (80%)
- Finale sequence (80-95%)
- Closing image (100%)

**Output:** Complete beat sheet with percentage markers

### Phase 3: Chapter Breakdown

**Objectives:**
- Create 20-25 chapter outline
- Assign scenes to chapters
- Balance pacing and tension

**Chapter Planning Template:**
- Chapter number and title
- POV character
- Location(s)
- Timeline position
- Plot objectives (what happens)
- Character objectives (what develops)
- Information reveals (what reader learns)
- Chapter hook (ending pull)

**Output:** Complete chapter-by-chapter breakdown

### Phase 4: Character Arcs

**Objectives:**
- Map each character's journey through this book
- Define goals, obstacles, and growth
- Track relationship progressions

**Per Character:**
- Entry state (emotional, relational, situational)
- Book goal (what they pursue)
- Internal obstacle (what holds them back)
- External obstacle (what opposes them)
- Key turning points (chapter references)
- Exit state (how they've changed)

**Output:** Character arc documents for all major characters

### Phase 5: Series Continuity

**Objectives:**
- Verify alignment with series arc
- Check character continuity
- Plan series hooks and setup

**Continuity Checks:**
- [ ] Character states match end of previous book
- [ ] Series arc threads are properly advanced
- [ ] World-building is consistent
- [ ] Timeline is coherent
- [ ] Future book setup is planted

**Output:** Series continuity notes and verification checklist

### Phase 6: Validation and Approval

**Objectives:**
- Present complete book plan
- Get user approval
- Save to FictionLab

**Validation Checklist:**
- [ ] Book synopsis is compelling
- [ ] Three-act structure is balanced
- [ ] Chapter breakdown has good pacing
- [ ] Character arcs are complete
- [ ] Series continuity is maintained
- [ ] All major elements are documented

**Output:** Approved book plan saved to MCP servers

---

## Key Plot Points and Turning Points

### Essential Plot Points

Every book should include these structural elements:

1. **Opening Hook** (Chapter 1)
   - Immediate engagement
   - Character in their world
   - Hint of coming disruption

2. **Inciting Incident** (Chapters 2-3)
   - Event that disrupts normal life
   - Cannot be ignored or undone
   - Forces protagonist into action

3. **First Plot Point** (Chapters 5-6)
   - Point of no return
   - Protagonist commits to goal
   - Stakes become personal

4. **Midpoint** (Chapters 12-13)
   - Major revelation or shift
   - From reactive to proactive
   - Stakes escalate significantly

5. **Dark Night** (Chapters 18-19)
   - Lowest point emotionally
   - Seems like all is lost
   - Internal crisis peaks

6. **Climax** (Chapters 22-24)
   - Final confrontation
   - Protagonist proves growth
   - Central conflict resolved

7. **Resolution** (Chapter 25)
   - New normal established
   - Character arc completed
   - Series hook for next book

### Cliffhanger vs. Resolution Balance

**For Series Continuity:**

**Standalone Satisfaction:**
- Primary plot conflict must resolve
- Character achieves or learns something meaningful
- Reader feels the book is complete

**Series Hooks:**
- One major question left unanswered
- New threat or opportunity introduced
- Character relationship tension for next book
- World-building element teased

**Balance Formula:**
- 80% resolution (this book's story wraps)
- 20% setup (hooks for next book planted)

---

## Genre-Specific Considerations

### Urban Fantasy
- Magic system consistency with series
- Supernatural world-building integration
- Balance of fantasy and real-world elements

### Romance
- Relationship beat sheet integration
- Emotional turning points mapped to plot points
- Heat level progression if applicable

### Mystery/Thriller
- Clue planting and fair play
- Red herrings appropriately placed
- Revelation timing for maximum impact

### Police Procedural
- Investigation structure overlay
- Procedural accuracy (within genre)
- Case-of-the-book with series thread

---

## Validation Checklist

### Book Structure
- [ ] Book number and title defined
- [ ] Target word count set
- [ ] Book synopsis written
- [ ] Three-act structure complete with percentages
- [ ] All major beat points defined

### Chapter Breakdown
- [ ] 20-25 chapters outlined
- [ ] Each chapter has clear objectives
- [ ] Pacing is balanced across acts
- [ ] Chapter hooks are engaging
- [ ] Scene distribution is appropriate

### Character Arcs
- [ ] Protagonist arc fully mapped
- [ ] Supporting character arcs defined
- [ ] Entry and exit states clear
- [ ] Turning points linked to chapters
- [ ] Relationship progressions tracked

### Series Continuity
- [ ] Previous book continuity verified
- [ ] Series arc advancement planned
- [ ] Character states are consistent
- [ ] World-building is coherent
- [ ] Next book hooks are planted

### Quality Gates
- [ ] Book has standalone satisfaction
- [ ] Theme is woven throughout
- [ ] Stakes escalate appropriately
- [ ] Climax is earned and impactful
- [ ] Resolution is satisfying

---

## Error Handling

### If Series Context Missing
```
I need to load series context before planning this book.
Please confirm:
1. Which series is this book for?
2. What book number is this?
3. Is there a previous book I should reference?
```

### If Character Arc Conflicts
```
I noticed a potential continuity issue:
- [Character] ended Book [N-1] in [state]
- But the planned entry state for Book [N] shows [different state]

How would you like to resolve this?
A) Update this book's entry state to match previous book
B) Add bridging explanation for the change
C) The previous book ending needs revision
```

### If MCP Save Fails
```
The save operation to [server] failed.
Error: [error message]

Options:
1. Retry the save operation
2. Save locally and sync later
3. Continue without saving (data will be lost)

What would you like to do?
```

---

## Communication Style

### Throughout the Conversation

**Be collaborative:**
- "Let's develop the midpoint together..."
- "What do you envision for the climax?"
- "How does this chapter breakdown feel to you?"

**Be specific:**
- Reference chapter numbers and beat percentages
- Name characters explicitly
- Quote user's previous decisions

**Be organized:**
- Progress through phases sequentially
- Summarize before moving to next phase
- Check for approval at phase transitions

**Be thorough:**
- Don't skip required elements
- Validate continuity throughout
- Ensure all outputs are complete

### When Presenting Plans

**Structure clearly:**
- Use headers and bullet points
- Group related information
- Provide summaries for long sections

**Make it actionable:**
- Chapter breakdowns should be writeable from
- Character arcs should guide scene writing
- Beat sheet should be a roadmap

---

## Version History

### Version 1.0 (2026-01-02)
**Initial Release:**
- Complete book planning workflow (6 phases)
- Three-act structure development
- Chapter breakdown template (20-25 chapters)
- Character arc mapping
- Series continuity validation
- MCP integration via IPC
- Approval gate protocol

---

**Last Updated:** 2026-01-02
**Version:** 1.0
**Phase:** Planning
**MCP Servers:** book-planning-server, series-planning-server, character-planning-server
