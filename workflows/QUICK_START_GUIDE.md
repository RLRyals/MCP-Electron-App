# Quick Start Guide: 12-Phase Novel Series Workflow

This guide will get you writing your 5-book urban fantasy series in under 5 minutes.

## Prerequisites

Before you start, make sure you have:

- [ ] FictionLab app installed and running
- [ ] Claude Code CLI installed (or another LLM provider configured)
- [ ] A project folder created for your series
- [ ] Your book/series idea ready (at least a basic concept)

## Step 1: Import the Workflow (2 minutes)

### Option A: Via FictionLab UI (Easiest)

1. Open the FictionLab app
2. Click on the **Workflows** tab in the sidebar
3. Click the **Import Workflow** button
4. Navigate to the workflows folder and select `12-phase-novel-series.json`
5. Click **Open**

The app will:
- Parse the workflow definition
- Check for missing dependencies (agents, skills, MCP servers)
- Show you an installation plan
- Install any missing components automatically

6. Click **Install and Import** to complete

### Option B: Via File Menu

1. Open FictionLab
2. Go to **File → Import Workflow**
3. Select `workflows/12-phase-novel-series.json`
4. Follow the installation wizard

## Step 2: Create a New Series Project (1 minute)

1. Click **New Project** or **File → New Project**
2. Enter project details:
   - **Project Name:** "My Urban Fantasy Series" (or your title)
   - **Project Type:** Select "Novel Series"
   - **Workflow:** Select "12-Phase Novel Series Writing Workflow"
   - **Project Folder:** Choose where to save your work
3. Click **Create Project**

## Step 3: Start the Workflow (30 seconds)

1. With your project open, click **Start Workflow** button
2. The workflow will begin at Phase 0 (User Input)

## Step 4: Provide Your Book/Series Idea (2 minutes)

The first screen will ask for your book/series idea.

### What to Include

Write at least 50 characters describing:

**Required:**
- Genre (e.g., "urban fantasy")
- Main character concept (e.g., "a vampire detective")
- Setting (e.g., "modern-day New Orleans")

**Optional but helpful:**
- Key plot points
- Themes you want to explore
- Character conflicts
- World-building elements

### Example Input

```
Urban fantasy series about Maya Chen, a Chinese-American demon hunter
who discovers she's the last descendant of an ancient bloodline tasked
with protecting San Francisco from supernatural threats. She must
balance her corporate job at a tech startup with her secret life
hunting demons, vampires, and rogue fae. The series explores themes
of identity, family legacy, and the clash between the modern tech world
and ancient magic. Main conflict: a powerful demon lord is assembling
an army to tear down the veil between worlds.
```

Click **Submit** when ready.

## Step 5: Let the Workflow Run

The workflow will now automatically:

1. **Phase 1:** Research the urban fantasy market (3-5 minutes)
2. **Phase 2:** Design your 5-book series architecture (3-5 minutes)

After Phase 2 completes, you'll be asked to **review and approve** the series plan.

## Step 6: Review Series Plan (5-10 minutes)

You'll see:
- Overview of all 5 books
- Character arcs across the series
- World-building progression
- Key plot threads

**Options:**
- ✅ **Approve:** Click "Approve" to continue
- ✏️ **Revise:** Click "Request Revisions" and provide feedback
- 💬 **Comment:** Add notes without blocking progress

## Step 7: Let It Write Your First Book

After you approve the series plan, the workflow will:

1. **Phase 3:** Create detailed outline for Book 1 (you'll review this)
2. **Phase 4:** Validate the outline (NPE quality gate)
3. **Phase 5:** Write all 25-30 chapters (6-8 hours, runs automatically)
4. **Phase 6:** Assemble the complete manuscript
5. **Phase 7:** Perform developmental editing (you'll review suggestions)
6. **Phase 8:** Perform line editing (you'll review changes)
7. **Phase 9:** Final quality check (must score 90+ to pass)
8. **Phase 10:** Export publication-ready files

## Step 8: Review and Approve at Key Points

You'll be asked to review and approve at these points:

### Book 1:
1. After Series Plan (Phase 2)
2. After Book Outline (Phase 3)
3. After NPE Validation (Phase 4)
4. After Developmental Edit (Phase 7)
5. After Line Edit (Phase 8)
6. After Final Quality Check (Phase 9)

### Books 2-5:
- Same review points, repeated for each book

## Step 9: Get Your Publication-Ready Manuscript

When Book 1 is complete, you'll find:

```
your-project-folder/
  ├── Book1_Manuscript.txt       (Full manuscript)
  └── exports/
      ├── Book1_Final.txt        (Publication copy)
      ├── Book1_Final.docx       (Word format)
      ├── Book1_Final.pdf        (PDF format)
      └── Book1_Submission/      (Submission package)
```

## Step 10: Continue with Books 2-5

After Book 1 completes:
- Phase 11 checks if series is complete
- Since you're only 1/5 done, it loops back to Phase 3
- You'll plan, write, and edit Book 2
- Repeat for Books 3, 4, and 5

## Step 11: Series Completion

After all 5 books are done:
- Phase 12 generates series completion report
- You'll receive:
  - Statistics for all 5 books
  - Series marketing materials
  - Character and world bible
  - Publication timeline
  - Complete series package

## Tips for Success

### During Initial Setup
- ✅ Be specific in your initial idea (Phase 0)
- ✅ The more detail you provide, the better the output
- ✅ Include character motivations and conflicts

### During Series Planning (Phase 2)
- ✅ Review the series arc carefully
- ✅ Make sure character arcs make sense across all 5 books
- ✅ Check that each book has a satisfying ending
- ✅ Request revisions if something doesn't feel right

### During Book Planning (Phase 3)
- ✅ Review the chapter outline for pacing
- ✅ Make sure key scenes are where they should be
- ✅ Check that subplots have proper setup and resolution

### During NPE Validation (Phase 4)
- ✅ Take validation feedback seriously
- ✅ If score is low (<80), request revisions to the outline
- ✅ Better to fix issues now than after writing 90,000 words

### During Editing (Phases 7-8)
- ✅ Review all editing suggestions carefully
- ✅ Accept changes that improve the story
- ✅ Reject changes that don't match your voice
- ✅ Add your own notes and tweaks

### During Final Quality Check (Phase 9)
- ✅ If readiness score is low (<90), take it seriously
- ✅ Go back and address issues before exporting
- ✅ A high-quality Book 1 sets the standard for the series

## Monitoring Progress

### In the FictionLab UI

The workflow visualization shows:
- ✅ **Green nodes:** Completed phases
- 🔵 **Blue node:** Current phase (in progress)
- ⚪ **Gray nodes:** Pending phases
- 🔴 **Red node:** Failed phase (needs attention)
- 🟡 **Yellow node:** Waiting for approval

### In the Execution Panel

You can see:
- Current phase name and description
- Progress percentage
- Estimated time remaining
- Logs and output from each phase

## Pausing and Resuming

### To Pause
1. Click the **Pause** button in the execution panel
2. The workflow will pause after the current phase completes
3. Your progress is automatically saved

### To Resume
1. Click the **Resume** button
2. The workflow picks up exactly where it left off

## Troubleshooting

### "Workflow failed at NPE Validation"
**Cause:** Book outline has structural issues (score < 80)

**Solution:**
1. Click "View Validation Report"
2. Read the issues found
3. Click "Revise Outline" to go back to Phase 3
4. The agent will incorporate the feedback and try again

### "Workflow failed at Final Quality Gate"
**Cause:** Manuscript quality below publication threshold (readiness < 90)

**Solution:**
1. Review the quality report
2. Note which areas scored low
3. Click "Return to Editing" to loop back to Phase 7
4. The editors will address the issues

### "Chapter writing is taking too long"
**Cause:** LLM provider is slow or timing out

**Solutions:**
- Check your internet connection
- Verify Claude Code CLI is working: `claude-code --version`
- Try switching to a different LLM provider in settings
- Increase timeout in workflow settings

### "Missing agent or skill errors"
**Cause:** Required dependencies not installed

**Solution:**
1. Go to **Workflows → Manage Dependencies**
2. Click **Check All Workflows**
3. Click **Install Missing Dependencies**
4. Restart the workflow

## Getting Help

### Documentation
- See `README.md` for complete workflow documentation
- See `12-phase-novel-series-diagram.md` for visual flow diagram

### Community
- FictionLab Discord server: [link]
- Community forum: [link]

### Support
- GitHub Issues: [link]
- Email support: support@fictionlab.app

## What's Next?

After completing your 5-book series:

1. **Professional Polish**
   - Consider hiring a human editor for final pass
   - Beta readers can provide valuable feedback

2. **Formatting**
   - Use Vellum, Atticus, or similar tools
   - Format for ebook (EPUB, MOBI) and print (PDF)

3. **Cover Design**
   - Hire a professional cover designer
   - Ensure series branding is consistent

4. **Publishing**
   - Upload to Amazon KDP, IngramSpark, etc.
   - Set up series page linking all 5 books

5. **Marketing**
   - Use the series marketing materials from Phase 12
   - Build an email list
   - Run launch promotions

## Estimated Timeline

**First Book:**
- Setup and import: 5 minutes
- Initial planning (Phases 1-4): 2-4 hours
- Chapter writing (Phase 5): 6-8 hours
- Editing and QA (Phases 6-10): 2-3 hours
- **Total: ~10-15 hours**

**Books 2-5:**
- Planning: 2-3 hours each
- Writing: 6-8 hours each
- Editing: 2-3 hours each
- **Total per book: ~10-14 hours**

**Complete Series:**
- **Total: ~50-75 hours** (about 2-3 weeks of part-time work)

## Ready to Start?

You now have everything you need to write your 5-book urban fantasy series!

Click **Start Workflow** and begin your journey from idea to published series.

Good luck, and happy writing! ✍️

---

**Quick Start Guide Version:** 1.0.0
**Last Updated:** 2025-12-20
**For:** 12-Phase Novel Series Writing Workflow
