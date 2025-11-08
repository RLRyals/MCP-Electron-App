# Quick Start Guide - Build Automation Issues

## TL;DR - Start Working NOW

### If You're Agent/Developer #1
**Start immediately on:** `issue-01-config-schema.md` OR `issue-02-repository-manager.md`

No dependencies! Pick whichever matches your expertise:
- Config Schema = TypeScript types, JSON schema validation
- RepositoryManager = Git operations, Node.js child processes

### If You're Agent/Developer #2
**Start immediately on:** `issue-03-build-orchestrator.md`

No dependencies! This is the most complex issue - needs experience with:
- npm, Docker, build systems
- Process management and output streaming
- Error handling

### If You're Agent/Developer #3
**Start immediately on:** `issue-01-config-schema.md` (if not taken)

This is the quickest issue. Once done, help with #2 or #3, or start planning #4-6.

---

## Creating the Issues on GitHub

### Method 1: Copy-Paste (Fastest - 5 minutes)

1. Go to: https://github.com/RLRyals/MCP-Electron-App/issues/new
2. For each `issue-XX-*.md` file:
   - Copy the **title** from the `title:` line
   - Copy everything **after** the `---` frontmatter as the body
   - Click "Submit new issue"

Do this 8 times (one per issue).

### Method 2: GitHub CLI (If working)

```bash
cd /home/user/MCP-Electron-App/github-issues

# Test if gh works
gh auth status

# If working, create all issues:
gh issue create --repo RLRyals/MCP-Electron-App \
  --title "Create Setup Configuration Schema and Initial Config File" \
  --body-file issue-01-config-schema.md \
  --label enhancement

# Repeat for issues 2-8
```

### Method 3: Fix Token & Run Script

```bash
# Get new token from: https://github.com/settings/tokens
# Needs 'repo' scope
export GITHUB_TOKEN=github_pat_XXXXX

# Run the script
cd /home/user/MCP-Electron-App
./create-github-issues.sh
```

---

## Work Breakdown

### Sprint 1 - Foundation (Week 1)
**Goal**: Build core infrastructure components

| Issue | Title | Complexity | Estimated Time | Can Start |
|-------|-------|------------|----------------|-----------|
| #1 | Config Schema | Low-Medium | 1-2 days | ✅ Now |
| #2 | RepositoryManager | Medium | 3-5 days | ✅ Now |
| #3 | BuildOrchestrator | High | 4-6 days | ✅ Now |

**Exit Criteria**: All 3 issues complete, PRs merged

---

### Sprint 2 - Integration (Week 2)
**Goal**: Connect components and add UI

| Issue | Title | Complexity | Estimated Time | Requires |
|-------|-------|------------|----------------|----------|
| #4 | IPC Handlers | Low-Medium | 2-3 days | Issue #2 ✅ |
| #5 | Docker Build | Medium | 3-4 days | Issues #2, #3 ✅ |
| #6 | Progress Tracking | Medium | 3-4 days | Issues #2, #3 ✅ |

**Exit Criteria**: All 3 issues complete, individual features testable

---

### Sprint 3 - Final Integration (Week 3)
**Goal**: Wire everything together in Setup Wizard

| Issue | Title | Complexity | Estimated Time | Requires |
|-------|-------|------------|----------------|----------|
| #7 | Setup Wizard Integration | High | 5-7 days | Issues #2-6 ✅ |
| #8 | Error Handling | Medium-High | 3-5 days | Incremental |

**Exit Criteria**: Full pipeline working end-to-end

---

## Daily Standup Template

Use this in your team channel:

```
🤖 Agent/Developer: [Your Name]
📅 Date: [Today's Date]

✅ COMPLETED YESTERDAY:
- [Task 1]
- [Task 2]

🚧 WORKING ON TODAY:
- [Current Issue #X: Title]
- [Specific task from checklist]

🚫 BLOCKERS:
- [None / Issue #X is blocking me]
- [Need code review on PR #Y]

⏱️ ESTIMATED COMPLETION:
- [Current issue: X days remaining]
```

---

## Code Quality Checklist

Before marking an issue "Done":

### For All Issues:
- [ ] All tasks in issue checklist completed
- [ ] TypeScript types are properly defined (no `any`)
- [ ] Functions have JSDoc comments
- [ ] Error cases are handled (try/catch, validation)
- [ ] Unit tests written and passing
- [ ] No lint errors or warnings
- [ ] Code follows existing project style

### For Backend Issues (#2, #3, #4, #5):
- [ ] IPC channels are type-safe
- [ ] Async operations use proper error handling
- [ ] Progress callbacks are implemented
- [ ] Timeouts are configurable

### For UI Issues (#6, #7):
- [ ] Loading states are shown
- [ ] Error messages are user-friendly
- [ ] Cancel/retry options available
- [ ] Responsive design maintained

### For Integration Issues (#7):
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Documentation updated

---

## Common Pitfalls

### Issue #2 (RepositoryManager)
❌ **Don't**: Use `git` CLI directly with `exec()`
✅ **Do**: Use `simple-git` or `nodegit` library

❌ **Don't**: Clone to hardcoded paths
✅ **Do**: Use configurable base path from config

### Issue #3 (BuildOrchestrator)
❌ **Don't**: Run npm without timeout
✅ **Do**: Set reasonable timeout (10 min default)

❌ **Don't**: Ignore build output
✅ **Do**: Stream output to logs and UI

### Issue #7 (Setup Wizard)
❌ **Don't**: Run all builds sequentially
✅ **Do**: Use dependency graph to parallelize

❌ **Don't**: Stop on first error
✅ **Do**: Continue with optional components, fail on critical ones

---

## Getting Unblocked

### "I'm waiting on Issue #X"
1. Check if you can mock the interface
2. Define the API contract with the other developer
3. Write tests against the mocked interface
4. Switch to helping with Issue #8 (Error Handling)

### "I don't understand the requirements"
1. Read the original plan in the project root
2. Check `DEPENDENCY_GRAPH.md` for context
3. Ask in team channel with specific questions
4. Start with the simplest task from the checklist

### "The issue is bigger than I thought"
1. Break it into sub-issues in GitHub
2. Complete core functionality first
3. Mark advanced features as "nice to have"
4. Communicate new timeline in standup

---

## Success Metrics

### Sprint 1 Success:
- [ ] Can clone a repo programmatically
- [ ] Can run npm install and build
- [ ] Configuration schema is validated

### Sprint 2 Success:
- [ ] Renderer can trigger clone via IPC
- [ ] Progress shows in UI
- [ ] Docker image builds from source

### Sprint 3 Success:
- [ ] Setup Wizard Step 5 completes full pipeline
- [ ] Errors are caught and retried
- [ ] User sees real-time progress

### Final Success:
- [ ] Fresh install → complete setup → working app
- [ ] Takes < 10 minutes on good internet
- [ ] Errors are recoverable without restart

---

## Tips for Efficient Parallel Work

### DO:
✅ Create feature branches: `feature/issue-2-repository-manager`
✅ Make small, focused commits
✅ Open PRs early for feedback
✅ Communicate API changes immediately
✅ Write interface definitions first
✅ Mock dependencies while waiting

### DON'T:
❌ Wait for perfect code before committing
❌ Work on same files simultaneously without coordination
❌ Make breaking changes without discussion
❌ Skip writing tests "for now"
❌ Hardcode values that should be configurable

---

## Emergency Contacts

### Build Issues:
- Check Docker logs: `docker logs <container>`
- Check npm logs: `cat npm-debug.log`
- Check electron logs: Dev Console in app

### Git Issues:
- Branch conflicts: `git fetch origin && git rebase origin/main`
- Wrong branch: `git checkout -b correct-branch && git cherry-pick <commits>`

### Can't Run Tests:
```bash
npm install
npm run test
# If that fails:
rm -rf node_modules package-lock.json
npm install
npm run test
```

---

## Next Steps

1. **Right now**: Create the 8 issues on GitHub (5 min)
2. **Assign issues**: Tag agents/developers on issues
3. **Create branches**: Each agent creates their feature branch
4. **Start coding**: Begin with Sprint 1 issues
5. **First standup**: Tomorrow, share progress

**Estimated completion**: 3-4 weeks with 3 agents working in parallel

---

Good luck! 🚀
