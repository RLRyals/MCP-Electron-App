# Creating Your Own Genre Pack - Complete Guide

This guide will walk you through creating a custom genre pack for BQ-Studio, step by step. By the end, you'll have a complete, working genre pack tailored to your specific writing needs.

---

## Table of Contents

1. [Before You Start](#before-you-start)
2. [Step 1: Create Folder Structure](#step-1-create-folder-structure)
3. [Step 2: Fill in manifest.json](#step-2-fill-in-manifestjson)
4. [Step 3: Add Beat Sheets](#step-3-add-beat-sheets-for-your-genre)
5. [Step 4: Write Style Guides](#step-4-write-style-guides)
6. [Step 5: Define Validation Rules](#step-5-define-validation-rules)
7. [Step 6: Create Templates](#step-6-create-templates)
8. [Step 7: Test Your Genre Pack](#step-7-test-with-skills)
9. [Examples by Genre](#examples-by-genre)
10. [Validation Checklist](#validation-checklist)
11. [Common Pitfalls](#common-pitfalls-and-troubleshooting)
12. [Advanced Customizations](#advanced-customizations)

---

## Before You Start

### Prerequisites

**You should have:**
- A clear understanding of your genre's conventions
- Familiarity with story structure frameworks (3-act, Save the Cat, etc.)
- Examples of successful books in your genre to reference
- A text editor (any will work - VS Code, Notepad, TextEdit)

**You should know:**
- Your genre's typical word count range
- Common tropes and reader expectations
- Market standards for your genre
- Where your genre falls on various spectrums (heat level, violence, etc.)

**Helpful but not required:**
- Markdown formatting basics
- JSON syntax (we provide heavily commented examples)
- Experience with BQ-Studio's planning skills

### Time Estimate

Creating a genre pack from scratch typically takes:
- **Minimal viable pack:** 1-2 hours (basic beat sheets and style guide)
- **Complete pack:** 4-6 hours (all components with examples)
- **Comprehensive pack:** 8-12 hours (multiple beat sheets, detailed guides)

Start with a minimal pack and expand it over time as you use it!

### Gather Your Resources

Before you start, collect:
1. **Craft books** for your genre (for beat sheet ideas)
2. **Bestselling books** in your genre (for style analysis)
3. **Editorial guidelines** from publishers in your genre
4. **Trope lists** common to your genre
5. **Your own notes** from writing in this genre

---

## Step 1: Create Folder Structure

### Quick Method (Copy Template)

```bash
# Navigate to genre-packs folder
cd /home/user/BQ-Studio/.claude/genre-packs/

# Copy the template and rename it
cp -r _TEMPLATE_ your-genre-name

# Example for cozy mystery
cp -r _TEMPLATE_ cozy-mystery
```

**Naming conventions:**
- Use lowercase
- Separate words with hyphens
- Be specific but not overly narrow
- Examples: `cozy-mystery`, `paranormal-romance`, `epic-fantasy`, `contemporary-romance`

### Manual Method (Create from Scratch)

```bash
# Create genre pack folder
mkdir your-genre-name

# Create subfolders
cd your-genre-name
mkdir beat-sheets
mkdir style-guides
mkdir validation-rules
mkdir templates
```

### Verify Your Structure

Your folder should look like this:

```
your-genre-name/
├── manifest.json              # (you'll create this next)
├── README.md                  # (optional but recommended)
├── beat-sheets/
├── style-guides/
├── validation-rules/
└── templates/
```

---

## Step 2: Fill in manifest.json

The manifest is your genre pack's configuration file. It tells BQ-Studio what your pack contains and how to use it.

### Create manifest.json

Open your genre pack folder and create a file called `manifest.json`.

### Basic Template

```json
{
  "name": "Your Genre Name",
  "version": "1.0.0",
  "description": "A brief description of what this genre pack supports",
  "author": "Your Name",
  "created": "2025-11-21",
  "genre": {
    "primary": "Primary Genre",
    "subgenre": "Specific Subgenre",
    "tags": ["tag1", "tag2", "tag3"]
  },
  "content_ratings": {
    "violence": "none|low|medium|high",
    "heat_level": "none|sweet|warm|hot|explicit",
    "language": "clean|moderate|explicit",
    "dark_themes": false
  },
  "structure": {
    "typical_word_count": {
      "min": 50000,
      "max": 90000,
      "target": 70000
    },
    "typical_chapter_count": {
      "min": 15,
      "max": 30,
      "target": 20
    },
    "series_structure": "standalone|duet|trilogy|ongoing"
  },
  "files": {
    "beat_sheets": [
      "beat-sheets/primary-structure.md",
      "beat-sheets/alternative-structure.md"
    ],
    "style_guides": [
      "style-guides/genre-conventions.md",
      "style-guides/voice-and-tone.md"
    ],
    "validation_rules": [
      "validation-rules/genre-requirements.md"
    ],
    "templates": [
      "templates/character-template.md",
      "templates/world-template.md"
    ]
  },
  "skills_integration": {
    "series_planning": true,
    "book_planning": true,
    "chapter_planning": true,
    "scene_writing": true,
    "review_qa": true
  }
}
```

### Field Explanations

**name**: Display name for your genre pack (e.g., "Cozy Mystery", "Paranormal Romance")

**version**: Version number (start with "1.0.0", increment as you update)

**description**: 1-2 sentences explaining what this pack is for

**author**: Your name or penname (optional)

**created**: Date you created the pack (ISO format: YYYY-MM-DD)

**genre.primary**: Broad category (Romance, Mystery, Fantasy, Science Fiction, Thriller)

**genre.subgenre**: Specific type (Cozy Mystery, Paranormal Romance, Epic Fantasy)

**genre.tags**: Keywords that describe your genre (["small-town", "amateur-sleuth", "culinary"] for cozy mystery)

**content_ratings**: Set expectations for content levels
- `violence`: How graphic is violence? (cozy mystery = "none", thriller = "high")
- `heat_level`: Romance/intimacy level (cozy = "none", romance varies)
- `language`: Profanity level (cozy = "clean", urban fantasy = "moderate")
- `dark_themes`: Contains trauma, abuse, mental health struggles? (true/false)

**structure.typical_word_count**: Standard length for books in your genre
- Cozy mystery: 60k-80k
- Romance: 50k-90k
- Epic fantasy: 100k-150k
- Thriller: 80k-100k

**structure.typical_chapter_count**: How many chapters are typical
- Varies by genre and author preference
- Used for pacing estimates

**structure.series_structure**: How books in this genre are typically published
- `standalone`: Each book is complete (some romance, thrillers)
- `duet`: Two-book stories (some dark romance)
- `trilogy`: Three-book arcs (common in fantasy)
- `ongoing`: Open-ended series (cozy mystery, urban fantasy)

**files**: Lists your genre pack files (update as you create them)

**skills_integration**: Which BQ-Studio skills should use this pack
- Usually all set to `true`
- Set to `false` if a particular skill doesn't apply

### Example: Cozy Mystery Manifest

```json
{
  "name": "Cozy Mystery",
  "version": "1.0.0",
  "description": "Genre pack for traditional cozy mysteries with amateur sleuths, small-town settings, and low violence.",
  "author": "Jane Author",
  "created": "2025-11-21",
  "genre": {
    "primary": "Mystery",
    "subgenre": "Cozy Mystery",
    "tags": ["amateur-sleuth", "small-town", "low-violence", "quirky-characters", "culinary", "crafting"]
  },
  "content_ratings": {
    "violence": "low",
    "heat_level": "none",
    "language": "clean",
    "dark_themes": false
  },
  "structure": {
    "typical_word_count": {
      "min": 60000,
      "max": 80000,
      "target": 70000
    },
    "typical_chapter_count": {
      "min": 20,
      "max": 30,
      "target": 25
    },
    "series_structure": "ongoing"
  },
  "files": {
    "beat_sheets": [
      "beat-sheets/cozy-mystery-structure.md",
      "beat-sheets/series-arc-light.md"
    ],
    "style_guides": [
      "style-guides/cozy-conventions.md",
      "style-guides/voice-and-tone.md",
      "style-guides/common-tropes.md"
    ],
    "validation_rules": [
      "validation-rules/cozy-requirements.md",
      "validation-rules/market-standards.md"
    ],
    "templates": [
      "templates/amateur-sleuth-character.md",
      "templates/small-town-setting.md",
      "templates/series-bible.md"
    ]
  },
  "skills_integration": {
    "series_planning": true,
    "book_planning": true,
    "chapter_planning": true,
    "scene_writing": true,
    "review_qa": true
  }
}
```

---

## Step 3: Add Beat Sheets for Your Genre

Beat sheets are the heart of your genre pack. They define the story structure that works for your genre.

### How Many Beat Sheets?

**Minimum:** 1 primary beat sheet
**Recommended:** 2-3 beat sheets
- Primary structure (most common)
- Alternative structure (for variety)
- Series arc framework (if writing series)

### Beat Sheet Format

Use the BQ-Studio beat sheet format (see `_TEMPLATE_/beat-sheets/example-beat-sheet.md`).

### Creating Your Primary Beat Sheet

**Step 3.1: Choose Your Foundation**

Start with a proven structure:
- **3-Act Structure** - Flexible, works for most genres
- **Save the Cat** - Commercial fiction, clear beats
- **Hero's Journey** - Fantasy, adventure, transformation
- **Romance Beats** - Romance genre (all subgenres)
- **Mystery/Thriller Beats** - Investigation structure

**Step 3.2: Add Genre-Specific Beats**

Overlay your genre's unique requirements:

**For Mystery/Cozy:**
- Body discovery beat (10-15%)
- Clue discovery beats (spread throughout)
- Red herring beats (35%, 60%)
- Sleuth in danger beat (75%)
- Reveal and justice beat (90%)

**For Romance:**
- Meet-cute (0-10%)
- First kiss (35-40%)
- "I love you" moment (85-90%)
- HEA/HFN resolution (95-100%)

**For Fantasy:**
- Magic system introduction (early)
- Mentor/training sequence (20-40%)
- Power growth moments (spread throughout)
- Final confrontation using learned powers (90%)

**Step 3.3: Define Beat Details**

For each beat, specify:

```markdown
### Beat Name (Chapter Range or Percentage)
**Target Word Count:** X-Y%
**Estimated Chapter(s):** [Chapter numbers]

**Purpose:**
[Why this beat exists, what it accomplishes]

**Key Elements:**
- [Element 1]: [Why it matters]
- [Element 2]: [Why it matters]
- [Element 3]: [Why it matters]

**Genre-Specific Notes:**
[Special considerations for your genre]

**Common Mistakes to Avoid:**
[Pitfalls specific to this beat in your genre]

**Examples from Published Books:**
[Optional: reference specific books that do this well]
```

### Example Beat Sheet: Cozy Mystery

Create a file: `beat-sheets/cozy-mystery-structure.md`

```markdown
# Cozy Mystery Beat Sheet

**Genre:** Cozy Mystery
**Structure Type:** Mystery Investigation with Character Development
**Typical Length:** 60,000-80,000 words
**Typical Chapters:** 20-30

---

## Act 1: Setup & Murder (0-25%)

### Beat 1: Ordinary World (Chapters 1-2, 0-8%)
**Target Word Count:** 0-5,000 words

**Purpose:**
Establish protagonist's normal life, relationships, and quirky small-town setting before murder disrupts everything.

**Key Elements:**
- **Protagonist Introduction**: Show amateur sleuth's occupation, personality, charm
- **Setting**: Establish small-town atmosphere, community relationships
- **Supporting Cast**: Introduce recurring characters (best friend, love interest potential, town gossip)
- **Protagonist's Skill**: Hint at qualities that make them good at sleuthing (curiosity, people skills, local knowledge)

**Genre-Specific Notes:**
- Keep tone light and cozy despite upcoming murder
- Establish what makes this town/setting special
- Show protagonist's connection to community
- Include quirky small-town details (festivals, local businesses, eccentric characters)

**Common Mistakes to Avoid:**
- Too much backstory dump
- Making protagonist too perfect (needs quirks and flaws)
- Ignoring the setting (cozy readers love the town)

---

### Beat 2: Murder Discovery (Chapters 2-3, 8-15%)
**Target Word Count:** 5,000-10,000 words

**Purpose:**
The body is discovered, disrupting the protagonist's life and drawing them into the investigation.

**Key Elements:**
- **Discovery Scene**: How protagonist finds body or learns of murder (shouldn't be too graphic)
- **Victim Introduction**: Who was the victim? (If not already established)
- **Initial Reaction**: Protagonist and town's response to murder
- **Police Involvement**: Introduction of official investigator (often dismissive of protagonist)

**Genre-Specific Notes:**
- Death should be "clean" (poisoning, blow to head) not graphic
- Victim should have connections to protagonist or community
- Establish why protagonist cares about solving this
- Police detective should have reason to tolerate/resist amateur involvement

**Common Mistakes to Avoid:**
- Making murder too dark/violent for cozy genre
- Protagonist immediately starting to investigate without believable motivation
- Forgetting protagonist should be shaken by finding body

---

[Continue with remaining beats...]

## Act 2: Investigation & Complications (25-75%)

### Beat 3: Commitment to Investigate (Chapter 4, 15-20%)
[Details...]

### Beat 4: Gathering Suspects & Clues (Chapters 5-10, 20-40%)
[Details...]

### Beat 5: First Red Herring (Chapter 11, 40-45%)
[Details...]

### Beat 6: Midpoint Revelation (Chapters 12-13, 45-55%)
[Details...]

### Beat 7: Complications & Second Red Herring (Chapters 14-17, 55-70%)
[Details...]

### Beat 8: Sleuth in Danger (Chapters 18-19, 70-75%)
[Details...]

## Act 3: Resolution (75-100%)

### Beat 9: Final Clue & Realization (Chapter 20, 75-80%)
[Details...]

### Beat 10: Confrontation & Reveal (Chapters 21-22, 80-90%)
[Details...]

### Beat 11: Justice & Wrap-Up (Chapters 23-25, 90-100%)
[Details...]

---

## Cozy-Specific Requirements Checklist

Use this to ensure your book hits cozy genre markers:

- [ ] Amateur sleuth (not professional detective)
- [ ] Small-town or close-knit community setting
- [ ] Murder happens "off-page" or isn't graphically described
- [ ] No explicit sexual content
- [ ] No strong profanity
- [ ] Quirky supporting characters
- [ ] Romantic subplot (optional but common)
- [ ] Hobby or occupation theme (culinary, crafting, bookstore, etc.)
- [ ] Cozy tone maintained throughout (even when discussing murder)
- [ ] Justice served by book's end (no ambiguous endings)
- [ ] Protagonist grows but isn't traumatized
- [ ] Community restored to harmony

---

## Clue Planting Strategy

**Plant 5-7 legitimate clues:**
1. Early clue (15-20%) - establishes victim's connections
2. Misdirection clue (25-30%) - points to wrong suspect
3. Crucial clue (40-50%) - significant but protagonist doesn't realize yet
4. Character clue (55-65%) - reveals motive or opportunity
5. Physical evidence (65-75%) - ties everything together
6. Final puzzle piece (75-80%) - allows protagonist to solve

**Plant 2-3 red herrings:**
- Make them believable but ultimately explained away
- Ensure fair play - reader can distinguish on re-read

---

## Series Considerations

**Book 1 Setup:**
- Establish recurring setting and supporting cast
- Introduce potential long-term romance arc
- Create signature elements (protagonist's cat, bakery, whatever makes series unique)
- Leave series hooks without cliffhangers

**Subsequent Books:**
- Advance long-term relationships slowly
- Deepen supporting character development
- Escalate stakes slightly while maintaining cozy tone
- Reference previous books without requiring readers to have read them
```

### Tips for Creating Great Beat Sheets

1. **Study Bestsellers**: Analyze 3-5 popular books in your genre, note where major beats fall
2. **Be Specific**: Don't just say "rising action" - define what that means for your genre
3. **Include Percentages**: Help authors pace their books correctly
4. **Add Examples**: Reference published books that do beats well
5. **Note Pitfalls**: Warn about common mistakes in your genre
6. **Provide Flexibility**: Beats are guidelines, not rigid rules

---

## Step 4: Write Style Guides

Style guides help maintain your genre's voice, tone, and conventions. Create at least one comprehensive style guide, or break it into multiple focused guides.

### Recommended Style Guide Files

1. **genre-conventions.md** - Core genre requirements
2. **voice-and-tone.md** - Writing style guidelines
3. **common-tropes.md** - Genre tropes and how to use them

### Creating genre-conventions.md

This file defines what makes your genre distinct.

**Template:**

```markdown
# [Your Genre] Conventions

This guide defines the core conventions that readers expect from [your genre] books.

---

## Genre Definition

**What is [Your Genre]?**
[2-3 sentence explanation of your genre]

**Reader Expectations:**
Readers of [genre] expect:
- [Expectation 1]
- [Expectation 2]
- [Expectation 3]
- [Expectation 4]

**What Makes a Book [Genre] vs [Similar Genre]?**
[Explanation of distinctions]

---

## Required Elements

These elements MUST be present for a book to qualify as [genre]:

### Element 1: [Name]
**Description:** [What this is]
**Why It Matters:** [Why readers expect this]
**How to Include:** [Practical implementation]
**Examples:** [Published books that do this well]

### Element 2: [Name]
[Same structure]

[Continue for all required elements]

---

## Optional But Common Elements

These elements appear frequently and readers enjoy them:

### Element 1: [Name]
**Description:** [What this is]
**Usage:** [When and how to use]
**Pros:** [Why it works]
**Cons:** [Potential pitfalls]

[Continue for all common elements]

---

## Content Boundaries

### What's Expected
- [Genre-appropriate content level 1]
- [Genre-appropriate content level 2]

### What's Discouraged
- [Content that doesn't fit genre]
- [Why readers might reject this]

### Gray Areas
- [Borderline content]: [How to handle]

---

## Subgenre Variations

**[Subgenre 1]:**
- Distinguishing features
- How it modifies base genre

**[Subgenre 2]:**
[Same structure]

---

## Market Positioning

**Current Trends:** [What's popular now in this genre]
**Evergreen Elements:** [What always works]
**Oversaturated Tropes:** [What to avoid or give fresh twist]

---

## Reader Demographics

**Typical Reader:**
- Age range: [X-Y years]
- Reading preferences: [Other genres they read]
- What they're looking for: [Comfort, escape, romance, puzzles, etc.]

**Implications for Writing:**
[How reader demographics affect your writing choices]
```

### Example: Cozy Mystery Conventions

```markdown
# Cozy Mystery Conventions

This guide defines the core conventions that readers expect from cozy mystery books.

---

## Genre Definition

**What is Cozy Mystery?**
Cozy mystery is a subgenre of crime fiction in which sex and violence occur off-page, the detective is an amateur sleuth, and the crime takes place in a small, socially intimate community. The tone is light, the setting is charming, and justice always prevails.

**Reader Expectations:**
Readers of cozy mysteries expect:
- An amateur sleuth (not a professional detective)
- A small-town or close-knit community setting
- Murder that isn't graphically violent
- No explicit sexual content
- No strong profanity
- Quirky, lovable characters
- A puzzle they can solve alongside the protagonist
- Justice served and community restored by book's end

**What Makes a Book Cozy vs Hard-Boiled or Police Procedural?**
- **Cozy**: Amateur sleuth, light tone, clean content, community focus
- **Hard-Boiled**: Professional detective, dark tone, violence/sex on-page, cynical worldview
- **Police Procedural**: Professional law enforcement, realistic procedures, can be dark or light

---

## Required Elements

These elements MUST be present for a book to qualify as cozy mystery:

### Element 1: Amateur Sleuth
**Description:** Protagonist is not a professional detective - they have another occupation and solve crimes through curiosity, local knowledge, and people skills.
**Why It Matters:** Core to genre identity. Readers want relatable protagonists, not jaded professionals.
**How to Include:**
- Give protagonist a distinct occupation (baker, librarian, craft store owner, teacher)
- Show why their civilian status gives them advantages (locals trust them, they notice details pros miss)
- Create believable motivation for investigating (personal connection to victim, sense of justice, protecting community)
**Examples:**
- Agatha Raisin (public relations)
- Hannah Swensen (baker)
- Goldy Schulz (caterer)

### Element 2: Small-Town or Close-Knit Setting
**Description:** Action takes place in a community where everyone knows everyone, creating intimacy and stakes.
**Why It Matters:** Setting is crucial to cozy appeal - readers want to escape to charming locales.
**How to Include:**
- Establish recurring locations (coffee shop, town square, protagonist's business)
- Create a cast of recurring townspeople
- Show how community interconnections affect the investigation
- Make setting a character in itself
**Examples:**
- Cabot Cove (Murder, She Wrote)
- Ashton Corners (Book Club Mysteries)
- Any small town with personality and recurring characters

### Element 3: Clean Content
**Description:** Violence, sex, and profanity are minimal or off-page.
**Why It Matters:** Cozy readers want comfort reading, not graphic content.
**How to Include:**
- Murder discovered after the fact, not witnessed
- Death methods: poisoning, blow to head, stabbing (described minimally)
- Romance can be present but stays closed-door
- Profanity limited to "damn" or "hell" at most
**Examples:** Most traditional cozy series maintain clean content standards

### Element 4: Justice Served
**Description:** Murderer is caught, community is restored to harmony, no ambiguous endings.
**Why It Matters:** Readers want satisfaction and moral clarity.
**How to Include:**
- Murderer identified and apprehended
- Justice system will handle punishment (no vigilante justice usually)
- Loose ends tied up
- Community healing shown
**Examples:** Every successful cozy ends with resolution

---

## Optional But Common Elements

These elements appear frequently and readers enjoy them:

### Element 1: Hobby or Occupation Theme
**Description:** Protagonist's job or hobby is integral to series identity (culinary cozies, craft cozies, bookish cozies)
**Usage:** Weave occupation into every book - recipes, craft projects, book recommendations
**Pros:** Creates series branding, gives unique flavor, allows for niche marketing
**Cons:** Requires research to maintain authenticity
**Examples:**
- Culinary Cozies: Include recipes
- Craft Cozies: Include craft project descriptions
- Bookish Cozies: Include reading recommendations

### Element 2: Romantic Subplot
**Description:** Slow-burn romance between protagonist and recurring love interest
**Usage:** Develop over series (will-they-won't-they tension)
**Pros:** Gives series arc, appeals to romance readers too
**Cons:** Must be slow enough for multi-book series, never overshadows mystery
**Examples:** Most modern cozies include romantic elements

### Element 3: Quirky Supporting Cast
**Description:** Eccentric townspeople who help or hinder investigation
**Usage:** Create distinct personalities - gossipy neighbor, wise mentor, comic relief friend
**Pros:** Provides humor, red herrings, and series continuity
**Cons:** Can become caricatures if not careful
**Examples:**
- Nosy neighbor who sees everything
- Best friend who gets sleuth into trouble
- Wise elder who offers cryptic advice

### Element 4: Pet Sidekick
**Description:** Cat, dog, or other animal companion
**Usage:** Animal can provide comic relief, clues (by acting strange around killer), emotional support
**Pros:** Huge reader appeal, series branding
**Cons:** Can be gimmicky if poorly done
**Examples:**
- Isis (cat in Cabot Cove mysteries)
- Numerous cat-sleuth series

---

## Content Boundaries

### What's Expected
- Murder happens but isn't graphically described
- Romance can be present but closed-door (fade to black)
- Mild peril for protagonist (they can be threatened but not brutalized)
- Profanity very limited ("damn" OK, f-bombs not OK)
- Light tone even when discussing death

### What's Discouraged
- Graphic violence or gore
- Explicit sexual content
- Serial killers (too dark)
- Torture
- Child/animal victims
- Heavy profanity
- Cynical or bleak worldview

### Gray Areas
- **Secondary character death:** Sometimes multiple victims occur, but keep off-page and not too frequent
- **Alcohol:** Characters can drink, but protagonist usually doesn't overindulge (can have alcohol-themed cozy like wine or cocktail themed)
- **Dark backstories:** Protagonist can have past trauma, but it doesn't make book feel dark
- **Incompetent police:** Police can be dismissive of amateur sleuth, but shouldn't be corrupt or evil (usually)

---

## Market Positioning

**Current Trends:**
- Holiday-themed cozies (Christmas, Halloween, etc.)
- Diverse protagonists (LGBTQ+, BIPOC, neurodiverse)
- Pandemic-aware settings (post-2020 many cozies acknowledge COVID)
- Strong female friendships
- Small business owner protagonists

**Evergreen Elements:**
- Amateur sleuth solving crime
- Small-town charm
- Quirky characters
- Comfort reading

**Oversaturated Tropes:**
- Cat cozies (still sell, but market crowded)
- Bakery cozies (very crowded, needs unique hook)
- Generic small-town settings without distinct flavor

**Fresh Approaches:**
- Unusual occupations (florist, yoga instructor, food truck owner)
- Underrepresented settings (non-US small towns, diverse communities)
- Disability representation
- Intergenerational friendships

---

## Reader Demographics

**Typical Reader:**
- Age range: 35-65 years (but varying)
- Gender: Predominantly women (but men read cozies too)
- Reading preferences: Also read romance, women's fiction, some fantasy
- What they're looking for: Comfort, escapism, puzzles to solve, characters they'd want as friends

**Implications for Writing:**
- Maintain comforting tone even in murder mystery
- Create likable, relatable protagonist
- Provide fair-play clues so readers can solve alongside sleuth
- Build series for long-term reader investment
- Create settings readers want to visit
- Include found family / community themes
```

### Creating voice-and-tone.md

This guide focuses on writing style, narrative voice, and tone appropriate for your genre.

**Template:**

```markdown
# [Genre] Voice and Tone Guide

This guide defines the writing style, narrative voice, and tone that works for [genre].

---

## Overall Tone

**General Feeling:**
[Describe the emotional atmosphere readers should experience]

**Tone Spectrum:**
Where does your genre fall on these scales?

- **Light ←→ Dark:** [Where on spectrum]
- **Humorous ←→ Serious:** [Where on spectrum]
- **Fast-paced ←→ Contemplative:** [Where on spectrum]
- **Action-driven ←→ Character-driven:** [Where on spectrum]

---

## Narrative Voice

**POV Conventions:**
- **Most Common:** [First person, third person limited, etc.]
- **Less Common:** [Other POVs and when they're used]
- **Avoid:** [POVs that don't work for this genre]

**Tense:**
- **Standard:** [Past tense, present tense]
- **Why:** [Explanation of why this works]

**Voice Characteristics:**
- [Characteristic 1]: [Description]
- [Characteristic 2]: [Description]
- [Characteristic 3]: [Description]

---

## Sentence Structure & Pacing

**Sentence Length:**
[Guidance on sentence variety and length for your genre]

**Paragraph Length:**
[How long should paragraphs be?]

**Pacing Techniques:**
- **Action Scenes:** [How to pace these]
- **Dialogue Scenes:** [How to pace these]
- **Emotional Scenes:** [How to pace these]
- **Description:** [How much and when]

---

## Dialogue Style

**Dialogue Characteristics:**
- [Characteristic 1]: [How dialogue should sound]
- [Characteristic 2]: [Example]

**Dialogue Tags:**
[Your genre's conventions for "said" vs alternatives]

**Internal Monologue:**
[How much and in what style]

---

## Vocabulary & Language

**Vocabulary Level:**
[Accessible, literary, technical, etc.]

**Jargon:**
[Genre-specific terminology and how to handle it]

**Profanity:**
[Genre standards for swearing]

**Humor:**
[Role of humor in your genre, types that work]

---

## Description Balance

**Setting Description:**
[How much detail, when to provide it]

**Character Description:**
[How to describe characters in your genre]

**Action Description:**
[How detailed to be with action sequences]

---

## Emotional Depth

**Emotional Range:**
[What emotions should books evoke]

**Showing vs Telling:**
[Your genre's approach]

**Vulnerability:**
[How vulnerable should POV character be]

---

## Genre-Specific Style Elements

[Unique style elements for your genre]

---

## Examples

**Strong Example:**
[Quote from published book showing great voice for genre]

**What Makes It Work:**
[Analysis]

**Weak Example:**
[Quote showing voice that doesn't fit genre]

**Why It Doesn't Work:**
[Analysis]

---

## Common Voice Mistakes

[List of voice/tone errors common in your genre]
```

---

## Step 5: Define Validation Rules

Validation rules help ensure your books meet genre standards and market expectations. Think of them as quality checklists.

### Creating validation-rules/genre-requirements.md

```markdown
# [Genre] Requirements Validation

Use this checklist during planning and revision to ensure your book meets [genre] standards.

---

## Genre Identity Validation

A book qualifies as [genre] if it has:

- [ ] [Required element 1]
- [ ] [Required element 2]
- [ ] [Required element 3]
- [ ] [Required element 4]

**If missing any required elements:** This may not be marketable as [genre].

---

## Structure Validation

### Beat Sheet Compliance

- [ ] Follows genre-appropriate beat structure
- [ ] Major turning points at expected percentages
- [ ] Genre-specific beats included ([list specific beats])
- [ ] Pacing appropriate for genre (not too slow/fast)

### Act Structure

- [ ] Act 1 establishes genre conventions clearly
- [ ] Act 2 delivers on genre promises
- [ ] Act 3 provides genre-appropriate resolution

---

## Character Validation

### Protagonist

- [ ] Fits genre archetype or has compelling twist on it
- [ ] Has agency (makes things happen, not passive)
- [ ] Shows growth appropriate to genre
- [ ] Likable/relatable to target audience

### Supporting Cast

- [ ] Includes genre-expected character types
- [ ] Characters serve distinct purposes
- [ ] No extraneous characters

### Antagonist

- [ ] Motivation makes sense for genre
- [ ] Threat level appropriate to genre
- [ ] Resolution fits genre expectations

---

## Content Validation

### Content Ratings

- [ ] Violence level matches genre standards
- [ ] Heat level matches genre standards
- [ ] Language matches genre standards
- [ ] Dark themes handled appropriately for genre

### Tone Consistency

- [ ] Maintains genre-appropriate tone throughout
- [ ] No jarring tonal shifts
- [ ] Emotional beats land as intended

---

## Trope Validation

### Expected Tropes

Check that you include genre-expected tropes:
- [ ] [Trope 1]: [How it appears in your book]
- [ ] [Trope 2]: [How it appears in your book]
- [ ] [Trope 3]: [How it appears in your book]

### Avoided Tropes

Check that you avoid problematic/overdone tropes:
- [ ] Not using [problematic trope 1]
- [ ] Not using [overdone trope 2]
- [ ] Fresh take on [common trope]

---

## Market Standards

### Length

- [ ] Word count in acceptable range ([X-Y words])
- [ ] Chapter count typical for genre ([X-Y chapters])
- [ ] Pacing maintains reader engagement

### Series Considerations (if applicable)

- [ ] Book works as standalone (even if part of series)
- [ ] Series hooks present but not cliffhanger
- [ ] Recurring elements established for series
- [ ] Character arcs have book-level AND series-level progression

### Cover Copy / Marketing

- [ ] Story delivers on genre promises
- [ ] Includes marketable elements (tropes readers search for)
- [ ] Clear genre positioning

---

## Reader Expectations

### Satisfaction Factors

- [ ] Delivers on genre promise (mystery solved, romance HEA, etc.)
- [ ] Emotional payoff appropriate to genre
- [ ] No unfulfilled expectations
- [ ] Ending feels complete (even if series)

### Fair Play (for Mystery/Thriller)

- [ ] Clues presented fairly to reader
- [ ] Solution makes sense in retrospect
- [ ] No deus ex machina
- [ ] Reader could solve alongside protagonist

### Romance Arc (if applicable)

- [ ] Clear romantic progression
- [ ] HEA or HFN delivered
- [ ] No breakup in epilogue
- [ ] Relationship earned, not forced

---

## Quality Standards

### Writing Quality

- [ ] Voice consistent and appropriate
- [ ] Prose polished (no repetitive errors)
- [ ] Dialogue sounds natural
- [ ] Description balanced

### Story Coherence

- [ ] Plot has no major holes
- [ ] Character behavior consistent
- [ ] World rules don't contradict
- [ ] Timeline makes sense

### Emotional Impact

- [ ] Characters feel real
- [ ] Emotional beats land
- [ ] Reader cares about outcome
- [ ] Satisfying emotional arc

---

## Red Flags

These issues suggest the book may not succeed in [genre]:

**Critical Issues:**
- Missing required genre elements
- Tone completely wrong for genre
- Ending doesn't deliver genre promise
- Content rating mismatch (too graphic or too tame)

**Warning Signs:**
- Pacing too slow/fast for genre
- Protagonist too passive
- Overuse of tired tropes without fresh twist
- Unclear genre positioning

**Minor Concerns:**
- Word count slightly outside ideal range
- Some expected tropes missing (but strong execution otherwise)
- Voice occasionally wavers

---

## Revision Priorities

**If failing validation:**

1. **Fix Critical Issues First**
   - Genre identity problems
   - Major plot holes
   - Wrong protagonist type
   - Ending doesn't deliver

2. **Address Warning Signs**
   - Pacing issues
   - Trope execution
   - Character agency

3. **Polish Minor Concerns**
   - Voice consistency
   - Word count adjustments
   - Optional tropes

---

## Comparative Analysis

**Compare your book to:**
- [ ] 3-5 bestsellers in genre
- [ ] Recent releases (past 2 years)
- [ ] Books in same subgenre niche

**Questions:**
- Does your book feel like it belongs on the same shelf?
- Would readers of those books enjoy yours?
- What makes yours stand out while fitting in?

---

## Final Validation

**Before publishing/submitting:**

- [ ] Passes all critical requirements
- [ ] Addresses warning signs
- [ ] Polished to professional standard
- [ ] Beta readers from target audience approve
- [ ] Comp titles identified and book aligns
- [ ] Genre positioning clear

**Ready for next steps:** [ ] Yes [ ] No - [Issues to fix:]
```

---

## Step 6: Create Templates

Templates help with series planning and book development. Create templates for common planning documents.

### Essential Templates

1. **character-template.md** - Character profile questions
2. **world-template.md** - World-building framework
3. **plot-template.md** or **series-bible-template.md** - Planning documents

### Creating character-template.md

Customize character questions for your genre:

```markdown
# [Genre] Character Profile Template

Use this template to develop characters for your [genre] book or series.

---

## Basic Information

**Name:** [Full name, nicknames]
**Age:** [Age]
**Occupation:** [Job/role]
**Role in Story:** [Protagonist, antagonist, sidekick, love interest, etc.]

---

## Physical Description

**Appearance:**
[Description - keep brief unless POV character]

**Distinguishing Features:**
[What makes them memorable]

**Mannerisms:**
[Physical habits, gestures]

---

## Personality

**Core Traits:**
1. [Trait]
2. [Trait]
3. [Trait]

**Strengths:**
- [Strength 1]
- [Strength 2]
- [Strength 3]

**Flaws:**
- [Flaw 1]
- [Flaw 2]
- [Flaw 3]

**Quirks:**
[Unique behaviors or preferences]

---

## Background

**Backstory:**
[Relevant history]

**Family:**
[Relationships with family members]

**Education:**
[Relevant education/training]

**Key Life Events:**
[Formative experiences]

---

## [Genre-Specific Section]

[Add sections specific to your genre]

**For Cozy Mystery:**

### Sleuthing Skills
**Why They're Good at Investigating:**
[Natural talents that help them solve crimes]

**Local Connections:**
[Who they know and why it helps]

**Occupation/Hobby Tie-In:**
[How their day job helps with sleuthing]

**For Romance:**

### Romantic Arc
**Wound/Baggage:**
[Past hurt affecting relationships]

**What They Want in a Partner:**
[Conscious desires]

**What They Actually Need:**
[Often different from what they want]

**Growth Required:**
[What must they overcome for HEA]

**For Fantasy:**

### Magical Abilities
**Powers:**
[What they can do]

**Limitations:**
[What they can't do, costs of using power]

**Growth Potential:**
[How powers develop over series]

---

## Character Arc

**Book 1 (or This Book) Arc:**
**Starting Point:** [Who they are at start]
**Journey:** [What they go through]
**Transformation:** [Who they become]
**Ending Point:** [Changed how]

**Series Arc (if applicable):**
[Long-term character development across multiple books]

---

## Relationships

**With Protagonist (if not protagonist):**
[Relationship dynamic]

**With Other Characters:**
- [Character Name]: [Relationship]
- [Character Name]: [Relationship]

**Potential Romance:**
[If romantic potential exists]

---

## Voice & Dialogue

**Speaking Style:**
[How they talk - formal, casual, uses slang, etc.]

**Verbal Tics:**
[Repeated phrases or expressions]

**Topics They Avoid:**
[What they don't talk about]

---

## Motivations & Goals

**External Goal (Plot Level):**
[What they want to achieve in story]

**Internal Goal (Character Level):**
[What they need emotionally/psychologically]

**Conflict Between Goals:**
[How external and internal goals clash]

---

## Character Function

**Story Purpose:**
[Why this character exists in the story]

**Theme Connection:**
[How they relate to book's themes]

**Reader Connection:**
[What makes readers care about them]

---

## Notes

[Additional thoughts, ideas, or reminders about this character]
```

### Creating world-template.md

For genres with significant world-building (fantasy, sci-fi, paranormal):

```markdown
# [Genre] World-Building Template

Use this template to develop the world for your [genre] book or series.

---

## World Overview

**World Name/Setting:**
[Name if fictional world, or real-world location if contemporary]

**Time Period:**
[When story takes place]

**Type:**
- [ ] Contemporary with magical overlay
- [ ] Alternate history
- [ ] Completely fictional world
- [ ] Future Earth
- [ ] Other: __________

**Scope:**
- [ ] Single town/city
- [ ] Region/country
- [ ] Multiple countries/continents
- [ ] Multiple worlds/dimensions

---

## [Genre-Specific System]

**For Fantasy: Magic System**

### Magic Basics
**Source of Magic:**
[Where does magic come from?]

**Who Has Magic:**
[Innate, learned, gifted, stolen?]

**Cost/Limitations:**
[What are the constraints? What does magic cost?]

**For Paranormal/Urban Fantasy: Supernatural Rules**

### Supernatural Population
**Species Present:**
- [Species 1]: [Description, abilities, weaknesses]
- [Species 2]: [Description, abilities, weaknesses]

**Masquerade/Secrecy:**
- [ ] Hidden from humans
- [ ] Known to humans
- [ ] Partially known

**For Science Fiction: Technology**

### Tech Level
**Available Technology:**
[What exists in this world]

**Key Innovations:**
[Unique technology that affects plot]

**Limitations:**
[What technology can't do]

---

## Society & Culture

### Social Structure
**Power Structure:**
[Who's in charge, how is society organized]

**Class System:**
[Social stratification if relevant]

**Cultural Norms:**
[Important social expectations]

### Laws & Governance
**Legal System:**
[How laws work]

**Law Enforcement:**
[How crimes are handled]

**Magical/Supernatural Regulation:**
[If applicable - how is magic/powers regulated]

---

## Geography

**Key Locations:**

### Location 1: [Name]
**Description:** [What it's like]
**Significance:** [Why it matters to story]
**Who Goes There:** [Which characters frequent this place]

### Location 2: [Name]
[Same structure]

**Map/Layout:**
[Sketch or description of how places relate geographically]

---

## History

**Relevant Historical Events:**
[Past events that affect current story]

**Recent History:**
[Events within living memory]

**Secrets/Hidden History:**
[What characters might discover]

---

## Daily Life

**Typical Day:**
[What does normal life look like]

**Technology/Magic in Daily Life:**
[How do people use magic/tech day-to-day]

**Economy:**
[How does commerce work]

**Communication:**
[How do people stay in touch]

---

## Conflict & Tension

**Current Conflicts:**
[Ongoing tensions in world]

**Factions:**
- [Faction 1]: [Goals, methods]
- [Faction 2]: [Goals, methods]

**Threats:**
[What dangers exist in this world]

---

## Rules & Limitations

**What's Possible:**
[List what can happen in your world]

**What's Impossible:**
[Critical - define limits so you don't break them]

**Gray Areas:**
[Things that might be possible under specific circumstances]

---

## Sensory Details

**Visual:**
[How does this world look]

**Sounds:**
[What do characters hear]

**Smells:**
[Important scents]

**Feel:**
[Textures, temperature, atmosphere]

---

## Series Evolution

**Book 1 World State:**
[What world is like at start of series]

**Planned Changes:**
[How world will evolve across series]

**World-Level Stakes:**
[What could change the whole world]

---

## Consistency Notes

**Rules to Remember:**
[Important rules you must not break]

**Common Mistakes to Avoid:**
[Things you might forget or get wrong]

**Reference Materials:**
[Where you track world details]

---

## Notes

[Additional world-building thoughts and ideas]
```

---

## Step 7: Test with Skills

Once you've created your genre pack, test it with BQ-Studio's planning skills.

### Testing Process

1. **Start a Test Planning Session**
   ```
   /series-planning
   ```

2. **Reference Your Genre Pack**
   When asked about genre, specify your custom pack:
   ```
   "I'm planning a cozy mystery series. Use the beat sheets and guidelines
   from .claude/genre-packs/cozy-mystery/"
   ```

3. **Verify Integration**
   Check that skills:
   - Reference your beat sheets when planning book structure
   - Apply your validation rules during review
   - Use your templates for character/world development
   - Match your style guidelines in tone recommendations

4. **Collect Feedback**
   Note:
   - What works well
   - What's confusing
   - What's missing
   - What needs better explanation

5. **Iterate**
   Update your genre pack based on testing:
   - Clarify unclear sections
   - Add missing elements
   - Improve examples
   - Refine validation rules

### Test Checklist

- [ ] Beat sheets load correctly
- [ ] Style guidelines are clear
- [ ] Validation rules catch genre deviations
- [ ] Templates cover all needed planning areas
- [ ] Genre-specific terminology is correct
- [ ] Examples are helpful
- [ ] Instructions are easy to follow

---

## Examples by Genre

### Example 1: Cozy Mystery Genre Pack Highlights

**What Makes It Distinct:**
- Amateur sleuth (not professional detective)
- Small-town setting with recurring characters
- Clean content (no graphic violence, profanity, or sex)
- Light tone even when discussing murder

**Key Beat Sheet Elements:**
```
- Murder Discovery (10-15%) - body found, protagonist drawn in
- Clue Gathering (20-60%) - interviewing suspects, collecting evidence
- Sleuth in Danger (70-75%) - killer threatens protagonist
- Reveal & Justice (85-95%) - solution revealed, killer caught
```

**Style Guide Highlights:**
- First person POV very common (reader solves alongside sleuth)
- Conversational, warm narrative voice
- Humor important (quirky characters, funny observations)
- Setting descriptions rich and inviting

**Validation Rules:**
- Must have amateur sleuth
- Death must occur off-page or be non-graphic
- No profanity stronger than "damn"
- Justice must be served (no ambiguous endings)
- Community restored to harmony

---

### Example 2: Epic Fantasy Genre Pack Highlights

**What Makes It Distinct:**
- Complex magic system with clear rules
- Large-scale world-building (multiple nations, cultures, species)
- High stakes (world-ending threats)
- Ensemble cast or multiple POVs

**Key Beat Sheet Elements:**
```
- Ordinary World (0-5%) - Introduce normal before adventure
- Call to Adventure (10-15%) - Prophecy, quest, or threat emerges
- Training/Allies (20-40%) - Gather party, learn powers
- Midpoint Revelation (50%) - Major truth about quest/world
- Dark Night (75%) - Seems hopeless, sacrifice required
- Final Battle (85-95%) - Epic confrontation with dark lord/threat
```

**Style Guide Highlights:**
- Third person multiple POV common
- More formal/elevated prose than contemporary genres
- Rich description of world, magic, battles
- Balance action, world-building, character development

**Validation Rules:**
- Magic system must have clear rules and costs
- World-building must be comprehensive but not overwhelming
- Multiple POVs should each have distinct voice
- Stakes must be genuinely high (not just personal)
- Word count typically 100k-150k+

---

### Example 3: Contemporary Romance Genre Pack Highlights

**What Makes It Distinct:**
- Modern, realistic setting
- Romance is THE plot (not subplot)
- HEA (Happily Ever After) required
- Heat level varies (from sweet to explicit)

**Key Beat Sheet Elements:**
```
- Meet-Cute (5-10%) - Memorable first encounter
- No Way (10-15%) - Reasons they can't be together
- Attraction Building (15-35%) - Chemistry develops
- First Kiss (35-40%) - Physical intimacy begins
- Deepening (40-60%) - Emotional intimacy, may include intimate scenes
- Black Moment (70-80%) - Relationship seems doomed
- Grand Gesture (80-85%) - One proves their love
- HEA/HFN (90-100%) - Happily Ever After or For Now
```

**Style Guide Highlights:**
- First or third person (often heroine POV or dual POV)
- Emotional, intimate narrative voice
- Focus on internal thoughts and feelings
- Dialogue-heavy (banter, conflict, declarations)

**Validation Rules:**
- Must end in HEA or HFN (no sad endings)
- Both protagonists must have character arc
- External plot cannot overshadow romance
- Heat level must match subgenre expectations (sweet, steamy, etc.)
- Word count typically 50k-90k

---

## Validation Checklist

Use this to ensure your genre pack is complete and ready to use:

### Structure & Organization
- [ ] Genre pack folder created with appropriate name
- [ ] All required subfolders created (beat-sheets, style-guides, validation-rules, templates)
- [ ] Files organized logically
- [ ] Naming conventions consistent

### manifest.json
- [ ] All required fields completed
- [ ] Genre accurately described
- [ ] Content ratings specified
- [ ] Typical word count and structure defined
- [ ] All files listed in manifest
- [ ] JSON syntax valid (no errors)

### Beat Sheets
- [ ] At least one primary beat sheet created
- [ ] Beats have clear percentage markers
- [ ] Genre-specific beats included
- [ ] Examples or explanations provided for each beat
- [ ] Alternative structures provided (if applicable)
- [ ] Series arc framework (if applicable)

### Style Guides
- [ ] Genre conventions documented
- [ ] Voice and tone guidelines clear
- [ ] Common tropes identified
- [ ] Content boundaries specified
- [ ] Examples from published books (optional but helpful)
- [ ] Market positioning discussed

### Validation Rules
- [ ] Required genre elements listed
- [ ] Content validation criteria defined
- [ ] Trope checklist provided
- [ ] Market standards specified
- [ ] Red flags identified
- [ ] Reader expectations documented

### Templates
- [ ] Character template customized for genre
- [ ] World template (if applicable) provided
- [ ] Plot or series bible template included
- [ ] Templates have clear instructions
- [ ] Genre-specific sections added

### Testing
- [ ] Tested with at least one planning skill
- [ ] Beat sheets work as expected
- [ ] Style guidelines are clear when referenced
- [ ] Validation rules catch deviations
- [ ] Templates cover all planning needs

### Documentation
- [ ] README.md for genre pack (optional but recommended)
- [ ] Instructions clear and beginner-friendly
- [ ] Examples provided where helpful
- [ ] Any genre-specific terminology explained

### Quality
- [ ] No typos or obvious errors
- [ ] Consistent formatting throughout
- [ ] Examples are relevant and helpful
- [ ] Instructions are actionable
- [ ] Genre expertise is evident

---

## Common Pitfalls and Troubleshooting

### Pitfall 1: Being Too Broad

**Problem:** Creating a "mystery" pack instead of "cozy mystery" pack
**Why It's a Problem:** Different mystery subgenres have very different conventions
**Solution:** Focus on a specific subgenre. Create separate packs for different types.

**Example:**
- Bad: "Mystery" (too broad - includes cozy, thriller, police procedural, noir)
- Good: "Cozy Mystery," "Police Procedural," "Hard-Boiled Detective"

---

### Pitfall 2: Being Too Specific

**Problem:** Creating "small-town baker cozy mysteries with cats" pack
**Why It's a Problem:** Too narrow - won't help with other cozy mysteries you write
**Solution:** Create for the subgenre level, not the series level

**Example:**
- Too Narrow: "Culinary cozy mysteries set in fictional Georgia town"
- Just Right: "Cozy Mystery" (works for culinary, craft, bookish, etc.)

---

### Pitfall 3: Copying Without Customizing

**Problem:** Using template files without adapting to your genre
**Why It's a Problem:** Generic advice doesn't help with genre-specific planning
**Solution:** Replace all placeholder content with your genre's actual conventions

**Example:**
- Bad: Leaving "[Genre]" placeholders in files
- Good: Replacing with specific genre ("Contemporary Romance," "Epic Fantasy")

---

### Pitfall 4: Incomplete Beat Sheets

**Problem:** Beat sheet lists beats but doesn't explain them
**Why It's a Problem:** Authors need guidance on what each beat means for their genre
**Solution:** For each beat, include purpose, key elements, and genre-specific notes

**Example:**
- Incomplete: "Midpoint (50%)"
- Complete: "Midpoint (50%) - Purpose: Major revelation that changes protagonist's understanding. Key Elements: False victory or devastating setback, stakes raise, series arc significant development. Genre Notes: For cozy mystery, this is often when sleuth realizes case is more complex than originally thought."

---

### Pitfall 5: Unrealistic Validation Rules

**Problem:** Setting rules that even bestsellers don't follow
**Why It's a Problem:** Creates anxiety and hinders creativity
**Solution:** Study actual published books in genre, set realistic standards

**Example:**
- Too Strict: "Protagonist must NEVER make a mistake"
- Realistic: "Protagonist should demonstrate growth, which often comes from learning from mistakes"

---

### Pitfall 6: Missing Content Ratings

**Problem:** Not specifying heat level, violence level, etc.
**Why It's a Problem:** Authors need to know genre content boundaries
**Solution:** Clearly define what's expected, discouraged, and in gray areas

**Example:**
Add to style guide:
```
Violence: Low (death occurs off-page, not graphically described)
Heat Level: None (no intimate scenes, romance closed-door)
Language: Clean (no profanity stronger than "damn")
```

---

### Pitfall 7: Ignoring Market Trends

**Problem:** Genre pack based on outdated genre conventions
**Why It's a Problem:** Books won't meet current reader expectations
**Solution:** Research current bestsellers, update pack regularly

**Example:**
- Outdated: "Historical romance heroines must be virginal"
- Current: "Historical romance heroines can have varied backgrounds; reader expectations have evolved"

---

### Pitfall 8: No Examples

**Problem:** Abstract rules without concrete examples
**Why It's a Problem:** Hard to understand what guidelines mean in practice
**Solution:** Include examples from published books or hypothetical scenarios

**Example:**
- Abstract: "Maintain genre-appropriate tone"
- Concrete: "Maintain genre-appropriate tone - even when discussing murder, keep voice light and focus on puzzle rather than violence. Example: 'The victim was sprawled behind the bakery counter, a rolling pin beside her. Not exactly how I'd planned to start my Monday.' (Note the matter-of-fact delivery with a hint of dry humor.)"

---

### Pitfall 9: Overwhelming Detail

**Problem:** 50-page style guide that no one will read
**Why It's a Problem:** Genre pack becomes intimidating rather than helpful
**Solution:** Start with essentials, can expand over time

**Recommended Lengths:**
- manifest.json: 1-2 pages
- Primary beat sheet: 3-8 pages
- Style guide: 4-10 pages
- Validation rules: 3-6 pages
- Character template: 2-4 pages

---

### Pitfall 10: Static Genre Pack

**Problem:** Creating pack once and never updating
**Why It's a Problem:** Genre conventions evolve, your understanding deepens
**Solution:** Treat genre pack as living document - update after each book

**Iteration Schedule:**
- After first use: Major updates based on what worked/didn't
- After each book: Small refinements
- Every 6 months: Review for market changes
- Annually: Major review and update

---

## Troubleshooting

### "My beat sheet doesn't fit my story"

**Remember:** Beat sheets are guidelines, not rigid formulas
**Solution:** Adapt beats to your story's needs. Not every beat is required.
**Example:** Some romance beats can be compressed or skipped if you have strong external plot

### "I'm not sure what heat level my genre requires"

**Solution:** Research current bestsellers in your specific subgenre
**Resources:**
- Read 5-10 recent releases
- Check Goodreads reviews for content mentions
- Join genre-specific reader groups
- Study publisher guidelines

### "My genre has too many variations"

**Solution:** Create a base genre pack, add variant notes
**Example:** Contemporary romance base pack with notes on:
- Sports romance variations
- Workplace romance variations
- Small-town romance variations

### "Skills aren't using my genre pack"

**Solution:** Explicitly reference it in planning sessions
**Example:** "Use the beat sheets from .claude/genre-packs/cozy-mystery/ for this book structure"

### "I write multiple genres - do I need multiple packs?"

**Yes!** Create separate pack for each distinct genre
**Benefits:**
- Clear context switching between genres
- No confusion about which rules apply
- Each genre gets appropriate depth

---

## Advanced Customizations

### Multiple Beat Sheets for Different Story Types

Create beat sheet variations for different plot structures:

**Example: Romance Genre Pack**
- `beat-sheets/contemporary-romance-primary.md` - Standard romance
- `beat-sheets/romantic-suspense.md` - Romance + thriller plot
- `beat-sheets/slow-burn-romance.md` - Extended attraction building
- `beat-sheets/friends-to-lovers.md` - Trope-specific structure

### Trope-Specific Guidance

Add files for common tropes in your genre:

**Example: Cozy Mystery**
- `style-guides/culinary-cozy-specifics.md` - For food-themed cozies
- `style-guides/craft-cozy-specifics.md` - For craft-themed cozies
- `style-guides/paranormal-cozy-specifics.md` - For supernatural elements

### Series vs Standalone Frameworks

If your genre does both:

**Example:**
- `beat-sheets/standalone-structure.md` - Complete story in one book
- `beat-sheets/series-book-1.md` - First in series with hooks
- `beat-sheets/series-middle-book.md` - Advancing series arcs
- `beat-sheets/series-finale.md` - Wrapping up long-term threads

### Mood/Tone Variations

For genres with wide emotional range:

**Example: Fantasy**
- `style-guides/light-fantasy-tone.md` - Cozy fantasy, hopeful
- `style-guides/dark-fantasy-tone.md` - Grimdark, morally complex
- `style-guides/epic-fantasy-tone.md` - Grand scale, heroic

### Audience-Specific Variants

If you write for different audiences in same genre:

**Example: Mystery**
- `validation-rules/traditional-mystery.md` - Older readers, classic style
- `validation-rules/contemporary-mystery.md` - Modern sensibilities
- `validation-rules/ya-mystery.md` - Young adult conventions

---

## Next Steps

### After Creating Your Genre Pack

1. **Test Thoroughly**
   - Use it to plan at least one complete book
   - Note what works and what doesn't
   - Refine based on experience

2. **Share with Critique Partners**
   - If you work with other authors in your genre
   - Get feedback on whether guidelines match their understanding
   - Collaborate on improvements

3. **Keep Learning**
   - Read new releases in your genre
   - Study craft books specific to your genre
   - Update pack as you learn more

4. **Create Additional Packs**
   - If you write multiple genres
   - Each genre gets its own customized toolkit

5. **Contribute to Community**
   - Consider sharing your pack (if comfortable)
   - Help other authors in your genre
   - Collaborate on shared resources

---

## Resources for Genre Research

### Craft Books by Genre

**Romance:**
- "Romancing the Beat" by Gwen Hayes
- "On Writing Romance" by Leigh Michaels

**Mystery:**
- "Howdunit: Book of Poisons" - Serita Stevens & Anne Bannon
- "Writing the Cozy Mystery" by Nancy J. Cohen

**Fantasy:**
- "Wonderbook" by Jeff VanderMeer
- "The Fantasy Fiction Formula" by Deborah Chester

**General:**
- "Save the Cat! Writes a Novel" by Jessica Brody
- "Story Genius" by Lisa Cron

### Market Research

- **Amazon Top 100** in your genre/subgenre
- **Goodreads lists** for your genre
- **Publisher guidelines** (Harlequin for romance, Kensington for cozy, etc.)
- **Genre-specific blogs and podcasts**

### Author Communities

- **Genre-specific forums** (Absolute Write, KBoards, etc.)
- **Facebook groups** for your genre
- **Discord servers** for writers in your genre
- **Genre-specific conferences** and workshops

---

## Final Thoughts

Creating a genre pack is an investment in your craft and productivity. It might feel like a lot of work upfront, but once you have it:

- **Planning goes faster** (you're not reinventing the wheel)
- **Quality stays consistent** (you have standards to reference)
- **Revision is easier** (clear validation criteria)
- **Series continuity improves** (documented world and character rules)
- **Genre mastery deepens** (documenting forces you to understand conventions)

Start with a minimal viable pack and expand it as you learn. Every book you write will teach you something to add to your genre pack, making it more valuable over time.

**Your genre pack grows with you - it's a living representation of your expertise.**

Happy writing!

---

**Questions or stuck?**

Ask Claude Code for help:
- "Explain how to create a beat sheet for [genre]"
- "What should I include in a [genre] style guide?"
- "Help me define validation rules for [genre]"

**Ready to start?**

1. Copy the `_TEMPLATE_` folder
2. Rename it to your genre
3. Start with manifest.json
4. Work through the steps in this guide

You've got this!
