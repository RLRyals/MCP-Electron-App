---
name: market-research-skill
description: Genre fiction market research and analysis skill for FictionLab workflows
---

# Market Research Skill

This skill guides comprehensive market research for fiction projects. Use this when a workflow node requires market analysis, genre positioning, competitive landscape assessment, or audience identification.

## Conversation Protocol

Follow this structured approach to gather information and produce actionable market insights:

### Phase 1: Project Understanding

Begin by understanding the author's project:

```
1. Ask about the core concept:
   - "What's the central premise of your story?"
   - "What's the main conflict or hook?"

2. Identify initial genre placement:
   - "What genre do you see this fitting into?"
   - "Are there specific sub-genres you're targeting?"

3. Understand author goals:
   - "Are you targeting traditional publishing, indie, or hybrid?"
   - "What's your target word count range?"
   - "Is this a standalone or potential series?"
```

### Phase 2: Genre Deep Dive

Analyze genre categorization and sub-genre positioning:

```
1. Primary Genre Analysis:
   - Identify the main genre (Romance, Fantasy, Thriller, etc.)
   - Map to Amazon/BISAC categories
   - Note genre conventions and reader expectations

2. Sub-Genre Positioning:
   - Identify 2-3 relevant sub-genres
   - Assess sub-genre popularity and saturation
   - Evaluate cross-genre potential

3. Trope Identification:
   - List popular tropes in the target sub-genre
   - Identify which tropes the project uses
   - Note any trope subversions or fresh takes
```

### Phase 3: Comparable Titles Analysis

Research and present comp titles:

```
1. Identify 3-5 Comparable Titles:
   For each comp, analyze:
   - Title, author, publication date
   - Sales performance indicators (bestseller rank, reviews)
   - Key similarities to the project
   - Key differences or gaps

2. Comp Title Selection Criteria:
   - Published within last 3-5 years (freshness)
   - Similar tone, themes, or structure
   - Successful in target market
   - Mix of established and debut authors

3. Position Statement:
   - "[Project] is [Comp A] meets [Comp B]"
   - Explain the mashup appeal
```

### Phase 4: Target Audience Identification

Define the ideal reader:

```
1. Demographics:
   - Age range
   - Gender skew (if applicable to genre)
   - Reading habits and preferences

2. Psychographics:
   - What emotions do they seek?
   - What themes resonate?
   - What content do they avoid?

3. Reader Behaviors:
   - Where do they discover books?
   - Price sensitivity
   - Format preferences (ebook, audio, print)
   - Series vs standalone preference
```

### Phase 5: Market Trends Analysis

Assess current market conditions:

```
1. Trending Tropes:
   - What's currently popular in the sub-genre?
   - What's oversaturated?
   - What's emerging?

2. Market Opportunities:
   - Underserved niches
   - Cross-genre opportunities
   - Timing considerations

3. Reader Expectations:
   - Content expectations (heat level, violence, etc.)
   - Pacing expectations
   - Series structure expectations
```

### Phase 6: Competitive Landscape

Map the competitive environment:

```
1. Top Authors in Sub-Genre:
   - Who dominates the category?
   - What's their release cadence?
   - What makes them successful?

2. Market Saturation Assessment:
   - Category competitiveness rating (1-10)
   - Barrier to entry
   - Differentiation opportunities

3. Gap Analysis:
   - What's missing in the market?
   - What reader desires aren't being met?
   - Where can this project stand out?
```

---

## Required Outputs

Upon completing the research, produce these deliverables:

### 1. Market Analysis Summary

```markdown
## Market Analysis: [Project Title]

### Genre Position
- Primary Genre: [Genre]
- Sub-Genres: [Sub-genre 1], [Sub-genre 2]
- Amazon Categories: [Category path]

### Target Audience Profile
- Core Reader: [Description]
- Age Range: [Range]
- Key Desires: [What they seek]
- Content Preferences: [Specifics]

### Comparable Titles
| Title | Author | Why It's a Comp | Performance |
|-------|--------|-----------------|-------------|
| [Title] | [Author] | [Reason] | [Metrics] |

### Market Position Statement
"[Project] is [Comp A] meets [Comp B] for readers who love [specific appeal]."
```

### 2. Competitive Landscape Report

```markdown
## Competitive Landscape

### Category Health
- Saturation Level: [Low/Medium/High]
- Reader Demand: [Growing/Stable/Declining]
- Competition Rating: [1-10]

### Top Competitors
1. [Author] - [Why they dominate]
2. [Author] - [Their strength]
3. [Author] - [Their niche]

### Differentiation Opportunities
- [Opportunity 1]
- [Opportunity 2]
- [Opportunity 3]
```

### 3. Positioning Recommendations

```markdown
## Positioning Recommendations

### Recommended Approach
[Strategic positioning advice]

### Trope Utilization
- Must-Have Tropes: [List]
- Differentiating Tropes: [List]
- Avoid: [List]

### Marketing Angles
- Primary Hook: [Hook]
- Secondary Hooks: [List]
- Keywords: [List]

### Risk Assessment
- Risks: [List potential challenges]
- Mitigations: [How to address them]
```

---

## Approval Gate

Before saving results, present findings for user approval:

```
Present the complete market research:

"Here's the market research I've compiled for [Project]:

**Genre Position:** [Summary]

**Target Audience:** [Summary]

**Comp Titles:**
- [Comp 1] - [Brief reason]
- [Comp 2] - [Brief reason]
- [Comp 3] - [Brief reason]

**Market Position:** [Position statement]

**Key Opportunities:** [1-2 sentence summary]

**Key Risks:** [1-2 sentence summary]

Would you like to:
1. Approve this research and save to the project
2. Explore a different genre/sub-genre positioning
3. Add or swap comparable titles
4. Adjust the target audience profile
5. Request additional analysis on a specific area"
```

Only proceed to save after explicit user approval.

---

## MCP Save Operations (Optional)

When approved, research results can be stored in workflow variables for use by subsequent nodes:

### Variable Storage

```javascript
// Store structured results in workflow context
context.variables.marketResearch = {
  genrePosition: {
    primary: "[Genre]",
    subGenres: ["Sub-genre 1", "Sub-genre 2"],
    amazonCategories: ["Category path"]
  },
  targetAudience: {
    coreReader: "[Description]",
    ageRange: "[Range]",
    keyDesires: ["Desire 1", "Desire 2"],
    contentPreferences: ["Preference 1", "Preference 2"]
  },
  compTitles: [
    {
      title: "[Title]",
      author: "[Author]",
      reason: "[Why it's a comp]",
      performance: "[Metrics]"
    }
  ],
  positionStatement: "[Position statement]",
  opportunities: ["Opportunity 1", "Opportunity 2"],
  risks: ["Risk 1", "Risk 2"],
  recommendations: {
    mustHaveTropes: ["Trope 1", "Trope 2"],
    differentiatingTropes: ["Trope 1"],
    avoid: ["Trope to avoid"],
    marketingHooks: ["Hook 1", "Hook 2"],
    keywords: ["Keyword 1", "Keyword 2"]
  }
};
```

### File Output

Optionally write a markdown report to the workspace:

```
Path: {{projectFolder}}/research/market-analysis.md
Content: [Full market analysis report]
```

---

## Research Sources

When conducting research, reference these approaches:

1. **Amazon Best Seller Lists**
   - Check relevant category bestsellers
   - Note recurring themes and covers
   - Analyze review sentiment

2. **Goodreads**
   - Popular shelves and lists
   - Reader reviews for comp titles
   - "Readers also enjoyed" connections

3. **Industry Resources**
   - Publisher's Marketplace deals
   - Genre-specific blogs and newsletters
   - Author communities and forums

4. **Social Media**
   - BookTok/Bookstagram trends
   - Reader hashtags and discussions
   - Author marketing strategies

---

## Error Handling

### Insufficient Information
If the project concept is too vague:
```
"I need a bit more detail to conduct effective market research.
Could you tell me more about [specific aspect]?"
```

### No Clear Comps
If finding comparable titles is difficult:
```
"This concept is quite unique, which is both an opportunity and a challenge.
Let me approach comps from a few different angles:
- Thematic comps: [Books with similar themes]
- Structural comps: [Books with similar format]
- Tonal comps: [Books with similar voice/mood]"
```

### Saturated Market
If the market appears oversaturated:
```
"This sub-genre is quite competitive. Here are strategies to stand out:
- [Differentiation strategy 1]
- [Differentiation strategy 2]
Would you like to explore adjacent sub-genres with less competition?"
```

---

## Example Execution

```
User: "I'm writing a cozy fantasy romance about a witch who runs a tea shop."

[Phase 1: Understanding]
"A cozy fantasy romance sounds wonderful! Let me understand your vision better.
Is this set in our world with hidden magic, or a secondary fantasy world?
What's the central romantic conflict?"

[Phase 2-6: Research and Analysis]
[Conduct structured research following protocol]

[Approval Gate]
"Here's what I've found for your cozy fantasy romance:

**Genre Position:** Cozy Fantasy Romance / Romantasy (Light)
Targeting the intersection of cozy fantasy readers and romance readers.

**Target Audience:** Women 25-45 who enjoy low-stakes fantasy with
guaranteed HEA, prefer 'warm hug' books, active on BookTok.

**Comp Titles:**
- 'Legends & Lattes' by Travis Baldree - Cozy fantasy tone
- 'A Wizard's Guide to Defensive Baking' - Magical small business
- 'The Very Secret Society of Irregular Witches' - Witchy romance

**Position:** 'Legends & Lattes meets The Very Secret Society of
Irregular Witches for readers who want cozy magic and slow-burn romance.'

**Key Opportunity:** Cozy fantasy is trending; adding explicit romance
elements serves readers who want more than fade-to-black.

Shall I save this research to your project?"
```
