# FictionLab Project Architecture: Database + Files

## Overview

FictionLab uses a **hybrid architecture** combining PostgreSQL database (structured story data) with file system storage (working documents) to enable AI-powered multi-book series writing with perfect continuity.

## Why Both Database and Files?

### The Challenge
Writing a cohesive 5-book series requires:
- ✅ Tracking continuity across thousands of pages
- ✅ Querying story elements to fit in AI context window
- ✅ Storing drafts, research, images, notes
- ✅ Version control and backup
- ✅ Working with external tools (Obsidian, editors)

### The Solution: Hybrid Architecture

**Database (PostgreSQL)** = Structured, queryable story data
**Files (User's folder)** = Working documents, research, drafts

---

## Database Schema (PostgreSQL)

### What Goes in the Database

**Structured data that needs querying and continuity tracking:**

```sql
-- Projects (grouping for multiple series)
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  folder_path TEXT NOT NULL,  -- ~/Documents/My Writing Projects/
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

### Why Database?

**Continuity Queries:**
```sql
-- Which characters know about the villain's secret?
SELECT c.name FROM characters c
JOIN character_knowledge ck ON c.id = ck.character_id
WHERE ck.knowledge_item = 'villain secret identity'
AND ck.learned_book <= 2;  -- By end of Book 2

-- Active plot threads in Book 3
SELECT * FROM plot_threads
WHERE introduced_book <= 3
AND (resolved_book IS NULL OR resolved_book >= 3)
AND status = 'active';

```

**Context Window Optimization:**
- Query only relevant data for current chapter
- Pull character states at specific book/chapter
- Load plot threads that need advancement
- Fits in AI context window (few KB vs. hundreds of pages)

---

## File System Structure

### What Goes in Files

**Unstructured documents, research, media, exports:**

```
~/Documents/My Writing Projects/        # User-chosen location
└── Urban Fantasy Series/               # Project folder
    ├── .fictionlab/                    # App metadata (hidden)
    │   ├── project.json                # Project settings
    │   ├── workflow-history/           # Execution logs
    │   │   ├── series-plan-2025-12-15.json
    │   │   └── ch05-draft-2025-12-16.json
    │   └── exports/                    # Workflow exports
    │       ├── series-plan.md
    │       └── market-research.md
    │
    ├── Book 1 - Shadow Detective/      # Book folder
    │   ├── chapters/                   # Chapter drafts
    │   │   ├── ch01-draft.md
    │   │   ├── ch01-revised.md
    │   │   ├── ch01-final.md
    │   │   ├── ch02-draft.md
    │   │   └── ...
    │   ├── scenes/                     # Scene snippets
    │   │   ├── opening-hook.md
    │   │   └── climax-notes.md
    │   ├── research/                   # Book-specific research
    │   │   ├── police-procedures.pdf
    │   │   ├── chicago-map.png
    │   │   └── forensics-notes.md
    │   ├── character-notes/            # Unstructured notes
    │   │   ├── protagonist-voice.md
    │   │   └── villain-backstory.md
    │   ├── outline.md                  # Book outline
    │   └── synopsis.md                 # Book synopsis
    │
    ├── Book 2 - Blood Moon/
    │   └── (same structure)
    │
    ├── series-bible/                   # Series-wide reference
    │   ├── magic-system.md             # Detailed magic rules
    │   ├── world-map.png               # World map
    │   ├── timeline.md                 # Major events
    │   ├── character-relationships.md  # Relationship chart
    │   └── technology.md               # Tech level rules
    │
    ├── research/                       # Series-wide research
    │   ├── inspiration/
    │   │   ├── similar-books.md
    │   │   └── trope-analysis.md
    │   ├── references/
    │   │   ├── detective-work.pdf
    │   │   └── urban-setting-photos/
    │   └── market-research/
    │       └── genre-trends-2025.md
    │
    └── planning/                       # Series planning docs
        ├── series-arc.md
        ├── book-summaries.md
        └── theme-notes.md
```

### Why Files?

✅ **Easy backup** - Copy entire folder
✅ **Git version control** - Track changes to drafts
✅ **External tool compatibility** - Open in Obsidian, VS Code, Scrivener
✅ **Media storage** - Images, PDFs, audio notes
✅ **Human-browsable** - Authors understand folders
✅ **Portable** - Move to different computer
✅ **Shareable** - Send folder to beta readers

---

## How Database and Files Work Together

### Project Creation Flow

1. **User creates project in FictionLab**
   ```typescript
   // User clicks "New Project"
   const project = await createProject({
     name: "My Writing Projects"
   });

   // User selects folder location
   const folderPath = await dialog.showOpenDialog({
     properties: ['openDirectory', 'createDirectory']
   });
   // User chooses: ~/Documents/My Writing Projects/

   // Store in database
   await db.query(
     'UPDATE projects SET folder_path = $1 WHERE id = $2',
     [folderPath, project.id]
   );
   ```

### Workflow Execution Context

When a workflow runs, it receives **hybrid context**:

```typescript
interface WorkflowExecutionContext {
  // Database IDs (for queries)
  projectId: number;
  seriesId: number;
  bookId?: number;
  chapterId?: number;

  // File paths (for reading/writing)
  projectPath: string;      // ~/Documents/My Writing Projects/
  seriesPath: string;       // ~/Documents/.../Urban Fantasy Series/
  bookPath?: string;        // ~/Documents/.../Book 1 - Shadow Detective/
  chapterPath?: string;     // ~/Documents/.../chapters/ch05-draft.md

  // Retrieved from DATABASE (structured, queryable)
  characters: {
    id: number;
    name: string;
    knowledgeAtThisPoint: string[];
    relationshipsAtThisPoint: Relationship[];
  }[];

  plotThreads: {
    name: string;
    status: 'active' | 'resolved';
    needsAdvancement: boolean;
  }[];

  timeline: {
    dayNumber: number;
    event: string;
  }[];

  worldbuildingFacts: {
    category: string;
    fact: string;
  }[];

  // Retrieved from FILES (context, examples)
  previousChapters: string[];        // Paths to completed chapters
  characterVoiceExamples: string[];  // Paths to voice samples
  researchReferences: string[];      // Paths to research PDFs/images
  seriesBible: string[];             // Paths to worldbuilding docs
}
```

### Example: Writing Chapter 5, Book 2

**Workflow queries DATABASE:**
```typescript
// What does the protagonist know at this point?
const knowledge = await db.query(`
  SELECT knowledge_item
  FROM character_knowledge
  WHERE character_id = $1
  AND learned_book <= $2
  AND (learned_chapter IS NULL OR learned_chapter <= $3)
`, [protagonistId, 2, 5]);

// Active plot threads that need advancement
const threads = await db.query(`
  SELECT * FROM plot_threads
  WHERE series_id = $1
  AND introduced_book <= $2
  AND (resolved_book IS NULL OR resolved_book > $2)
  AND status = 'active'
`, [seriesId, 2]);

// Character relationships at this point
const relationships = await db.query(`
  SELECT * FROM character_relationships
  WHERE series_id = $1
  AND start_book <= $2
`, [seriesId, 2]);
```

**Workflow reads FILES:**
```typescript
// Read previous chapters for context
const ch04 = await fs.readFile(
  path.join(bookPath, 'chapters/ch04-final.md'),
  'utf-8'
);

// Read character voice examples from Book 1
const voiceExample = await fs.readFile(
  path.join(seriesPath, 'Book 1.../character-notes/protagonist-voice.md'),
  'utf-8'
);

// Read research on current scene setting
const mapImage = path.join(bookPath, 'research/location-map.png');
```

**Workflow writes FILES:**
```typescript
// Write chapter draft
await fs.writeFile(
  path.join(bookPath, 'chapters/ch05-draft.md'),
  generatedChapter
);

// Log execution
await fs.writeFile(
  path.join(seriesPath, '.fictionlab/workflow-history/ch05-2025-12-15.json'),
  JSON.stringify(executionLog)
);
```

**Workflow updates DATABASE:**
```typescript
// Update chapter status
await db.query(`
  UPDATE chapters
  SET status = 'drafted', word_count = $1
  WHERE id = $2
`, [wordCount, chapterId]);

// Add new timeline event
await db.query(`
  INSERT INTO timeline_events (series_id, event_description, day_number, book_id, chapter_id)
  VALUES ($1, $2, $3, $4, $5)
`, [seriesId, 'Major plot revelation', 47, bookId, chapterId]);

// Update character knowledge
await db.query(`
  INSERT INTO character_knowledge (character_id, knowledge_item, learned_book, learned_chapter)
  VALUES ($1, $2, $3, $4)
`, [protagonistId, 'Villain true identity', 2, 5]);
```

---

## Benefits of Hybrid Architecture

### For Authors

✅ **Perfect Continuity** - Database ensures facts stay consistent
✅ **Familiar Workflow** - Files work like Scrivener/normal writing
✅ **AI Context Optimization** - Only load relevant data
✅ **Research Organization** - Files for PDFs, images, notes
✅ **Version Control** - Git works on markdown files
✅ **Portable** - Copy folder to new computer
✅ **Tool Integration** - Use Obsidian, VS Code alongside FictionLab

### For Workflows

✅ **Smart Context** - Query exactly what's needed for current chapter
✅ **Continuity Checks** - Validate against database before writing
✅ **Character Consistency** - Know what each character knows/feels
✅ **Plot Thread Tracking** - Never forget unresolved threads
✅ **Timeline Validation** - Ensure events happen in correct order
✅ **Relationship Evolution** - Track how relationships change

### Technical Advantages

✅ **Fits in Context Window** - Query returns KB, not MB
✅ **Fast Queries** - Indexed database vs. grepping files
✅ **Backup Strategy** - Database dump + folder copy
✅ **Scalability** - Database handles 5-book series easily
✅ **External Access** - Files accessible to other tools

---

## Implementation Status

### ✅ Already Built (by Project Management Agent)

- Database tables: `projects`, `series`
- IPC handlers: `project:create`, `series:create`, etc.
- React dialogs: `ProjectCreationDialog`, `SeriesCreationDialog`
- TopBar integration: Real project selector
- App state: Active project/series tracking

### ❌ Need to Add

**Folder Management:**
1. **Folder picker** in project creation dialog
2. **Store `folder_path`** in projects table
3. **Create folder structure** when creating series/books
4. **Settings panel** to change project folder location

**Additional Database Tables:**
1. `books` table
2. `chapters` table
3. `characters` table (for continuity)
4. `character_relationships` table
5. `plot_threads` table
6. `timeline_events` table
7. `character_knowledge` table
8. `locations` table
9. `worldbuilding_facts` table

**File Operations:**
1. Create series folder structure
2. Create book folders with templates
3. Read/write chapter files
4. Store workflow outputs to files
5. Read research files for context

---

## Next Steps

1. **Keep the database tables** the agent already built ✅
2. **Add folder picker** to project creation
3. **Add folder structure creation** when creating series/books
4. **Extend database schema** with books, chapters, characters (Phase 2)
5. **Build continuity tracking UI** (Phase 3)
6. **Integrate with workflows** to use hybrid context

---

## Conclusion

FictionLab's hybrid architecture gives authors the best of both worlds:
- **Database** for perfect continuity and AI context optimization
- **Files** for writing workflow and tool compatibility

This enables writing complex multi-book series with AI assistance while maintaining the familiar comfort of files and folders.
