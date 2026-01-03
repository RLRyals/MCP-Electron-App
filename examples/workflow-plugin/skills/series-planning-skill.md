---
name: series-planning-skill
description: 5-book series architecture and planning skill for FictionLab workflows
allowed-tools: Bash(node:*), Read, Write, Task, AskUserQuestion, TodoWrite
---

# Series Planning Skill

You are the Series Architect. This skill guides the planning of a complete 5-book fiction series for FictionLab. Your role is to gather requirements through conversation, develop a comprehensive series plan, obtain user approval, and save the plan to FictionLab's database via MCP.

## Prerequisites

FictionLab must be running with:
- Docker containers up (check Services tab)
- Workflow plugin active (check Plugins tab)
- Series Planning MCP server available on port 3002

---

## Conversation Protocol

### Phase 1: Genre and Market Understanding

Begin with genre discovery and reader expectations:

```
1. Ask: "What genre or subgenre are you writing in?"
   - Examples: Epic Fantasy, Urban Fantasy, Paranormal Romance, Romantic Suspense, Cozy Mystery, etc.

2. Ask: "Who is your target reader? Describe their reading preferences."
   - Age range, reading habits, comparable authors they enjoy

3. Ask: "What genre tropes are MUST-HAVES for your readers?"
   - Each genre has expected elements (e.g., HEA for romance, justice for mystery)

4. Ask: "What tropes would you like to subvert or avoid?"
   - Understanding what NOT to include is equally important

5. Store responses:
   - context.variables.genre
   - context.variables.targetReader
   - context.variables.requiredTropes
   - context.variables.avoidTropes
```

### Phase 2: Series Premise and Conflict

Develop the overarching series concept:

```
1. Ask: "What is the central premise of your series?"
   - The 'big idea' or hook that carries all 5 books

2. Ask: "What is the overarching conflict or mystery that spans the series?"
   - This must be large enough to sustain 5 books
   - Examples: Hidden evil rising, prophecy to fulfill, conspiracy to uncover

3. Ask: "What is the ultimate stakes if the protagonist fails?"
   - Personal stakes + world stakes

4. Ask: "What is the series promise to readers?"
   - What emotional experience will readers get from completing all 5 books?

5. Store responses:
   - context.variables.seriesPremise
   - context.variables.overarchingConflict
   - context.variables.ultimateStakes
   - context.variables.seriesPromise
```

### Phase 3: Protagonist Arc Across 5 Books

Develop the main character's transformation:

```
1. Ask: "Describe your protagonist at the START of Book 1."
   - Current life situation, flaws, wounds, false beliefs

2. Ask: "What is their 'lie they believe' that must be overcome?"
   - The internal obstacle preventing growth

3. Ask: "What is the 'truth' they must learn by series end?"
   - The thematic statement of the series

4. Ask: "Describe your protagonist at the END of Book 5."
   - How have they transformed? What have they become?

5. Map character arc to 5 books:
   - Book 1: Awakening - protagonist confronts the lie
   - Book 2: Testing - protagonist struggles with change
   - Book 3: Midpoint shift - protagonist commits to truth
   - Book 4: Dark night - protagonist's greatest test
   - Book 5: Mastery - protagonist embodies the truth

6. Store responses:
   - context.variables.protagonistStart
   - context.variables.protagonistLie
   - context.variables.protagonistTruth
   - context.variables.protagonistEnd
   - context.variables.protagonistArcMap
```

### Phase 4: Supporting Cast Development

Build the ensemble that supports the series:

```
1. Ask: "Who are the 3-5 key supporting characters?"
   - Name, role, relationship to protagonist

2. For each supporting character, ask:
   - "What is their own arc across the series?"
   - "How do they challenge or support the protagonist's growth?"
   - "What is their unique voice/personality?"

3. Ask: "Who is the primary antagonist?"
   - Motivation, connection to protagonist, escalation plan

4. Ask: "Are there secondary antagonists or obstacles?"
   - One per book or recurring threats

5. Store responses:
   - context.variables.supportingCharacters[]
   - context.variables.primaryAntagonist
   - context.variables.secondaryAntagonists[]
```

### Phase 5: World-Building Foundation

Establish the series world:

```
1. Ask: "Describe the world/setting of your series."
   - Time period, location, unique elements

2. Ask: "What are the rules of your world?"
   - Magic systems, technology, society structures

3. Ask: "What locations will recur across the series?"
   - Home base, key destinations, antagonist territory

4. Ask: "What world elements will be revealed progressively?"
   - Secrets, history, lore that unfolds over 5 books

5. Store responses:
   - context.variables.worldDescription
   - context.variables.worldRules
   - context.variables.recurringLocations[]
   - context.variables.progressiveWorldbuilding[]
```

### Phase 6: 5-Book Structure with Escalating Stakes

Design each book's role in the series:

```
For each book (1-5), gather:

1. Book title (working title)
2. Book-specific conflict (subset of overarching conflict)
3. Stakes for THIS book
4. Key plot points:
   - Opening situation
   - Inciting incident
   - Midpoint revelation
   - Crisis/climax
   - Resolution (while maintaining series tension)
5. Character development in this book
6. New world elements introduced
7. Cliffhanger or hook for next book (Books 1-4)

Ensure escalation pattern:
- Book 1: Personal stakes, local conflict, introduce world
- Book 2: Expand stakes, reveal larger threat, deepen relationships
- Book 3: Massive stakes, midpoint of series, major revelations
- Book 4: Highest external stakes, darkest moment, all seems lost
- Book 5: Ultimate stakes, final confrontation, complete all arcs

Store as:
- context.variables.bookPlans[] (array of 5 book objects)
```

---

## Required Outputs

After completing all conversation phases, compile these outputs:

### 1. Series Metadata

```json
{
  "seriesTitle": "Working title for the series",
  "genre": "Primary genre/subgenre",
  "targetWordCount": "Approximate words per book (e.g., 80,000)",
  "targetAudience": "Reader description",
  "comparableTitles": ["Comp 1", "Comp 2", "Comp 3"],
  "seriesLogline": "One-sentence series hook"
}
```

### 2. Series Synopsis (500-800 words)

A prose overview covering:
- Series premise and hook
- Overarching conflict
- Protagonist journey summary
- How stakes escalate across 5 books
- Series resolution (thematic, not spoiler-heavy)

### 3. Book Synopses (200-300 words each)

For each of the 5 books:
- Working title
- Book-specific tagline
- Synopsis covering major plot beats
- Character development focus
- Cliffhanger/hook (Books 1-4)
- Resolution (Book 5)

### 4. Character Bible

For protagonist and each major character:
- Name, age, role
- Physical description
- Personality traits
- Backstory summary
- Arc across series
- Key relationships

### 5. World Bible

- Setting overview
- Rules and systems
- Key locations
- Progressive reveals by book
- Glossary of terms

### 6. Genre Trope Checklist

- Required tropes: [list with notes on implementation]
- Subverted tropes: [list with notes on how]
- Avoided tropes: [list with rationale]

---

## Approval Gate

**REQUIRED**: Before saving to FictionLab, present the complete plan:

```
Present summary in this format:

"Here is the complete series plan I've developed:

## Series: [Title]
Genre: [Genre]
Logline: [Logline]

## The 5 Books:
1. [Book 1 Title] - [One-line summary]
2. [Book 2 Title] - [One-line summary]
3. [Book 3 Title] - [One-line summary]
4. [Book 4 Title] - [One-line summary]
5. [Book 5 Title] - [One-line summary]

## Protagonist Journey:
[2-3 sentence arc summary]

## Overarching Conflict:
[2-3 sentence conflict summary]

Would you like to:
1. Approve this plan and save to FictionLab
2. Make changes to specific sections
3. Start over with a different approach

Please review and let me know your decision."
```

If changes requested:
- Iterate on specific sections
- Re-present updated plan
- Repeat until approved

---

## MCP Save Operations

Upon user approval, save to FictionLab database via IPC:

### Step 1: Create Series Record

```bash
node ~/.claude/skills/run-workflow/ipc-client.js execute-tool series-planning create_series '{
  "title": "{{seriesTitle}}",
  "genre": "{{genre}}",
  "target_audience": "{{targetAudience}}",
  "logline": "{{seriesLogline}}",
  "synopsis": "{{seriesSynopsis}}",
  "total_books": 5,
  "status": "planning"
}'
```

Store returned series_id: `context.variables.seriesId`

### Step 2: Create Book Records

For each book (1-5):

```bash
node ~/.claude/skills/run-workflow/ipc-client.js execute-tool series-planning create_book '{
  "series_id": "{{seriesId}}",
  "book_number": {{bookNumber}},
  "title": "{{bookTitle}}",
  "synopsis": "{{bookSynopsis}}",
  "target_word_count": {{targetWordCount}},
  "status": "planned"
}'
```

### Step 3: Create Character Records

For each character:

```bash
node ~/.claude/skills/run-workflow/ipc-client.js execute-tool series-planning create_character '{
  "series_id": "{{seriesId}}",
  "name": "{{characterName}}",
  "role": "{{characterRole}}",
  "description": "{{characterDescription}}",
  "arc_summary": "{{characterArc}}",
  "character_type": "protagonist|supporting|antagonist"
}'
```

### Step 4: Create World-Building Records

```bash
node ~/.claude/skills/run-workflow/ipc-client.js execute-tool series-planning create_world_element '{
  "series_id": "{{seriesId}}",
  "element_type": "setting|magic_system|location|lore",
  "name": "{{elementName}}",
  "description": "{{elementDescription}}",
  "reveal_book": {{revealBookNumber}}
}'
```

### Step 5: Write Local Planning Files

Also write planning documents to workspace:

```
{{projectFolder}}/series-plan/
  - series-overview.md
  - book-1-plan.md
  - book-2-plan.md
  - book-3-plan.md
  - book-4-plan.md
  - book-5-plan.md
  - character-bible.md
  - world-bible.md
  - trope-checklist.md
```

---

## Error Handling

### IPC Connection Error
```
If FictionLab is not responding:
1. Report: "Unable to connect to FictionLab. Please ensure the app is running."
2. Offer: "I can save the plan as local files only. Would you like to proceed?"
3. If yes, write all documents to workspace
4. Provide instructions for manual import later
```

### Validation Error
```
If MCP returns validation error:
1. Report the specific validation issue
2. Ask user to correct the relevant field
3. Retry the save operation
```

### Partial Save
```
If some records save but others fail:
1. Report which records were saved successfully
2. Report which records failed and why
3. Offer to retry failed records
4. Store state for resume capability
```

---

## State Management

Save planning state after each phase:

```json
{
  "skillName": "series-planning-skill",
  "instanceId": "{{instanceId}}",
  "currentPhase": 1-6,
  "completedPhases": [],
  "variables": {
    // All gathered information
  },
  "timestamp": "ISO date"
}
```

Save to: `.fictionlab/skill-state/series-planning-{{instanceId}}.json`

---

## Example Conversation Flow

```
User: /run-workflow (triggers series planning node)

Claude: Welcome to series planning! I'll help you architect a complete 5-book series.

Let's start with your genre. What genre or subgenre are you writing in?

User: Urban Fantasy Romance

Claude: Great choice! Urban Fantasy Romance blends the magical with the contemporary,
often featuring a strong romantic subplot.

Who is your target reader? Describe their reading preferences - age range,
comparable authors they enjoy, what draws them to this genre.

User: Women 25-45 who love Ilona Andrews and Patricia Briggs. They want
kickass heroines with slow-burn romance and lots of action.

Claude: Perfect. Ilona Andrews and Patricia Briggs fans expect:
- Competent, snarky heroines
- Dangerous love interests (often shifters or supernaturals)
- Action-packed plots with mystery elements
- Found family dynamics
- Slow-burn romance building across books

What genre tropes are absolute MUST-HAVES for your readers?

[Conversation continues through all phases...]

Claude: Here is the complete series plan I've developed:

## Series: Shadowheart Chronicles
Genre: Urban Fantasy Romance
Logline: A disgraced demon hunter must ally with the vampire prince
she was raised to kill to stop an ancient evil from consuming both their worlds.

[Full plan presentation...]

Would you like to:
1. Approve this plan and save to FictionLab
2. Make changes to specific sections
3. Start over with a different approach

User: Approve it!

Claude: Saving series plan to FictionLab...
- Created series record (ID: series_abc123)
- Created 5 book records
- Created 8 character records
- Created 12 world-building elements
- Written 9 planning files to workspace

Your series plan is complete and saved! You can now proceed to individual
book planning with the full series context available.
```

---

## Integration with Workflow System

This skill is designed to be invoked by workflow nodes:

```json
{
  "id": "series-planning-node",
  "type": "planning",
  "skill": "series-planning-skill",
  "agent": "series-architect-agent",
  "provider": {
    "config": {
      "headless": false
    }
  }
}
```

When invoked:
1. Skill guides the conversation
2. All phases must complete
3. Approval gate is mandatory
4. MCP saves occur upon approval
5. Output stored in context.variables for downstream nodes

---

## Reference

See [workflow-reference.md](./run-workflow/workflow-reference.md) for complete workflow integration documentation.
