# Genre Packs for BQ-Studio

Welcome to the Genre Pack system! This folder contains genre-specific configurations that customize BQ-Studio's writing skills to match your specific genre conventions, tropes, and requirements.

---

## What Are Genre Packs?

Genre packs are modular collections of genre-specific resources that enhance BQ-Studio's planning and writing capabilities. Each pack contains:

- **Beat Sheets** - Story structure frameworks optimized for your genre
- **Style Guides** - Writing conventions, tone, and voice guidelines
- **Validation Rules** - Genre-specific quality checks and requirements
- **Templates** - Character profiles, world-building docs, and planning forms
- **Configuration** - Genre metadata and skill customizations

Think of a genre pack as a specialized toolkit that helps you write authentic, marketable books in your chosen genre.

---

## Why Use Genre Packs?

### For Authors
- **Genre Expertise** - Built-in knowledge of your genre's conventions and reader expectations
- **Consistent Quality** - Validation rules ensure you hit genre requirements
- **Faster Planning** - Templates and beat sheets designed for your specific story types
- **Market Alignment** - Stay competitive with current genre standards

### For Writing Teams
- **Shared Standards** - Everyone works from the same genre playbook
- **Easy Onboarding** - New team members get instant genre guidance
- **Brand Consistency** - All books in a penname follow the same quality bar

### For Multi-Genre Authors
- **Context Switching** - Easily switch between romance, thriller, fantasy mindsets
- **No Cross-Contamination** - Keep genre conventions separate and clear
- **Specialized Tools** - Each genre gets its own optimized workflow

---

## Available Genre Packs

### Official Genre Packs

**Urban Fantasy Police Procedural** (Built-in)
- Location: Built into core skills
- Focus: Supernatural crime, investigation procedures, magic forensics
- Best for: Police procedurals with magic systems

### Community Genre Packs

**_TEMPLATE_** (Not a real genre pack)
- Location: `.claude/genre-packs/_TEMPLATE_/`
- Purpose: Template and examples for creating your own genre pack
- **Do not use this for actual planning** - it's a teaching tool

---

## Quick Start: Using a Genre Pack

### Option 1: Use Built-in Genre (Urban Fantasy Police Procedural)
Just start using the planning skills - they're already configured!

```
/series-planning
```

### Option 2: Create Your Own Genre Pack
1. Read the detailed guide: [CREATING_YOUR_GENRE_PACK.md](CREATING_YOUR_GENRE_PACK.md)
2. Copy the `_TEMPLATE_/` folder and rename it to your genre
3. Customize the files for your genre
4. Reference your genre pack in planning sessions

**Example:**
```bash
# Create your genre pack
cp -r _TEMPLATE_ cozy-mystery

# Edit the files in cozy-mystery/
# Then use it in your planning!
```

---

## Genre Pack Structure

Each genre pack follows this structure:

```
genre-name/
├── manifest.json              # Genre metadata and configuration
├── README.md                  # Genre-specific documentation
├── beat-sheets/               # Story structure frameworks
│   ├── primary-structure.md
│   ├── alternative-structure.md
│   └── series-arc-framework.md
├── style-guides/              # Writing conventions
│   ├── voice-and-tone.md
│   ├── genre-conventions.md
│   └── common-tropes.md
├── validation-rules/          # Quality requirements
│   ├── genre-requirements.md
│   ├── trope-checklist.md
│   └── market-standards.md
└── templates/                 # Planning documents
    ├── character-template.md
    ├── world-template.md
    ├── plot-template.md
    └── series-bible-template.md
```

---

## How Genre Packs Work with Skills

BQ-Studio's skills (series-planning, book-planning, scene-writing, etc.) can automatically adapt to your genre pack:

### Automatic Integration
When you specify a genre, skills will:
1. **Load your beat sheets** when planning book structure
2. **Apply your validation rules** when reviewing content
3. **Reference your style guides** when writing scenes
4. **Use your templates** when creating planning documents

### Manual Integration
You can also reference genre pack content directly:

```
"Use the cozy mystery beat sheet from my genre pack"
"Validate this scene against the romance style guide"
"Create a character using the fantasy character template"
```

---

## Creating Your Own Genre Pack

Ready to create a genre pack for your specific genre? Here's the process:

### 1. Read the Guide
Start with the comprehensive guide: **[CREATING_YOUR_GENRE_PACK.md](CREATING_YOUR_GENRE_PACK.md)**

This guide walks you through:
- Prerequisites and preparation
- Step-by-step creation process
- Examples from multiple genres
- Common pitfalls and how to avoid them
- Testing and validation

### 2. Use the Template
The `_TEMPLATE_/` folder contains:
- Fully commented example files
- Instructions for each section
- Placeholder content to replace
- Best practices and tips

### 3. Customize for Your Genre
Replace template content with your genre-specific:
- Beat sheets (your genre's story structures)
- Style guidelines (your genre's writing conventions)
- Validation rules (your genre's quality standards)
- Templates (your genre's planning needs)

### 4. Test and Iterate
Use your genre pack with the planning skills and refine based on:
- What works well
- What's missing
- What needs clarification

---

## Genre Pack Best Practices

### Keep It Focused
- One genre pack = one specific genre/subgenre
- Don't try to make one pack do everything
- Create separate packs for different pennames/series

### Examples:
- **Good:** "Cozy Mystery" pack
- **Too Broad:** "Mystery" pack (too many subgenres)
- **Good:** "Paranormal Romance" and "Contemporary Romance" (separate packs)
- **Too Narrow:** "Small-town baker cozy mysteries with cats" (too specific)

### Stay Current
- Update your genre pack as market trends shift
- Add new beat sheets as you learn new structures
- Refine validation rules based on beta reader feedback
- Keep style guides aligned with current reader expectations

### Document Everything
- Write clear explanations in your files
- Include examples where helpful
- Link to external resources (craft books, blog posts)
- Note why you made specific choices

### Share with Your Team
- If you work with other authors in your genre, share your pack
- Collaborate on genre packs for shared pennames
- Create organization-wide packs for consistency

---

## Example Genre Packs to Inspire You

While these don't exist yet in this repo, here are genre pack ideas to spark your creativity:

### Romance Subgenres
- **Contemporary Romance** - Modern settings, realistic challenges
- **Historical Romance** - Period-specific beats and tropes
- **Paranormal Romance** - Fated mates, supernatural conflicts
- **Romantic Suspense** - Dual plot threads (romance + thriller)

### Mystery Subgenres
- **Cozy Mystery** - Amateur sleuths, low violence, small town
- **Police Procedural** - Realistic investigation, team dynamics
- **Private Investigator** - Hard-boiled tone, noir elements
- **Thriller** - High stakes, time pressure, twists

### Fantasy Subgenres
- **Epic Fantasy** - World-building, magic systems, prophecies
- **Urban Fantasy** - Modern settings, hidden magic, snark
- **Romantasy** - Romance + fantasy, relationship-driven
- **Grimdark** - Moral complexity, high violence, bleak tone

### Science Fiction Subgenres
- **Space Opera** - Large scale, multiple worlds, adventure
- **Cyberpunk** - Tech noir, corporate dystopia, hackers
- **Military SF** - Combat, strategy, chain of command
- **First Contact** - Alien encounters, communication challenges

---

## Getting Help

### Questions About Genre Packs?
- Read the detailed guide: [CREATING_YOUR_GENRE_PACK.md](CREATING_YOUR_GENRE_PACK.md)
- Examine the `_TEMPLATE_/` files for examples
- Ask Claude Code for help understanding specific sections

### Need Genre-Specific Guidance?
- Research your genre's conventions (craft books, writing blogs)
- Analyze bestsellers in your genre for patterns
- Join genre-specific writing groups for insights
- Study editorial guidelines from publishers in your genre

### Want to Share Your Genre Pack?
- Consider contributing to the BQ-Studio community
- Share on writing forums or social media
- Collaborate with other authors in your genre
- Create tutorials showing how you use your pack

---

## Roadmap: Future Genre Pack Features

These features are planned but not yet implemented:

- **Skill Auto-Detection** - Skills automatically detect genre from manifest
- **Genre Pack Validation** - Built-in checks for genre pack completeness
- **Pack Merging** - Combine elements from multiple packs
- **Version Management** - Track changes to genre packs over time
- **Community Repository** - Share and download community-created packs
- **AI Genre Analysis** - Analyze your existing books to suggest pack customizations

---

## Contributing

If you create a genre pack you'd like to share:

1. Ensure it's complete and well-documented
2. Test it with multiple series in your genre
3. Remove any proprietary/personal content
4. Add a clear README specific to your genre
5. Submit via pull request or share with the community

---

## License & Attribution

Genre packs you create are yours. If you share them:
- You retain all rights to your content
- Attribution appreciated but not required
- Others may adapt your packs for their use
- Consider adding a license file to your pack

---

**Ready to create your genre pack?**

Start here: [CREATING_YOUR_GENRE_PACK.md](CREATING_YOUR_GENRE_PACK.md)

Or explore the template: `.claude/genre-packs/_TEMPLATE_/`

Happy writing!
