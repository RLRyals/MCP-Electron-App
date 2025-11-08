# GitHub Issues for Build Automation Project

This directory contains 8 GitHub issues broken down from the Build Automation plan, organized for parallel development by multiple agents.

## Quick Start

### Option 1: Manual Creation (Web Interface)
1. Go to https://github.com/RLRyals/MCP-Electron-App/issues/new
2. Copy the content from each `.md` file
3. Create issues in order (1-8) to maintain proper dependency references

### Option 2: GitHub CLI (if properly configured)
```bash
# Create all issues at once
for file in issue-*.md; do
  gh issue create --repo RLRyals/MCP-Electron-App \
    --title "$(grep '^title:' "$file" | cut -d':' -f2- | xargs)" \
    --body-file "$file" \
    --label "$(grep '^labels:' "$file" | cut -d':' -f2- | xargs | tr ' ' ',')"
done
```

### Option 3: Fix GITHUB_TOKEN and Run Script
If you can get a working token with `repo` scope:
```bash
export GITHUB_TOKEN=your_new_token_here
./create-github-issues.sh
```

## Issues Overview

### Sprint 1 (No Dependencies - Start Immediately)
- **Issue #1**: Create Setup Configuration Schema
- **Issue #2**: Implement RepositoryManager Class
- **Issue #3**: Implement BuildOrchestrator Class

**Parallel Assignment**: 3 agents can work simultaneously

### Sprint 2 (After Sprint 1 Complete)
- **Issue #4**: Add IPC Handlers (needs #2)
- **Issue #5**: Docker Build Integration (needs #2, #3)
- **Issue #6**: Progress Tracking (needs #2, #3)

**Parallel Assignment**: 3 agents can work simultaneously once Sprint 1 is done

### Sprint 3 (After Sprint 2 Complete)
- **Issue #7**: Setup Wizard Integration (needs #2-6)
- **Issue #8**: Error Handling (incremental, can start in Sprint 2)

**Note**: Issue #8 can be worked on incrementally during Sprint 2

## Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                     Sprint 1 (Parallel)                  │
├─────────────────────────────────────────────────────────┤
│  #1 Config Schema    #2 RepositoryManager    #3 BuildOrchestrator  │
│      (No deps)            (No deps)               (No deps)        │
└──────┬──────────────────────┬─────────────────────┬─────┘
       │                      │                     │
       │                      ├─────────────────────┤
       │                      │                     │
┌──────┴──────────────────────┴─────────────────────┴─────┐
│                     Sprint 2 (Parallel)                  │
├─────────────────────────────────────────────────────────┤
│     #4 IPC Handlers   #5 Docker Build   #6 Progress Tracking     │
│        (needs #2)      (needs #2,#3)      (needs #2,#3)          │
└──────┬────────────────────┬────────────────────┬─────────┘
       │                    │                    │
       └────────────────────┴────────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────┐
│                     Sprint 3                             │
├──────────────────────────────────────────────────────────┤
│         #7 Setup Wizard Integration (needs #2-6)         │
│         #8 Error Handling (incremental from Sprint 2)    │
└──────────────────────────────────────────────────────────┘
```

## File Index

| Issue # | File | Complexity | Dependencies | Sprint |
|---------|------|------------|--------------|--------|
| 1 | `issue-01-config-schema.md` | Low-Medium | None | 1 |
| 2 | `issue-02-repository-manager.md` | Medium | None | 1 |
| 3 | `issue-03-build-orchestrator.md` | High | None | 1 |
| 4 | `issue-04-ipc-handlers.md` | Low-Medium | #2 | 2 |
| 5 | `issue-05-docker-build-integration.md` | Medium | #2, #3 | 2 |
| 6 | `issue-06-progress-tracking.md` | Medium | #2, #3 | 2 |
| 7 | `issue-07-setup-wizard-integration.md` | High | #2-6 | 3 |
| 8 | `issue-08-error-handling.md` | Medium-High | Incremental | 2-3 |

## Parallelization Strategy

### Maximum Parallelization
With 3 agents:
- **Week 1**: All agents work on Sprint 1 issues (#1, #2, #3)
- **Week 2**: All agents work on Sprint 2 issues (#4, #5, #6)
- **Week 3**: Main agent on #7, other agents help with #8 and testing
- **Week 4**: Integration testing, bug fixes, documentation

### Estimated Timeline
- Sprint 1: 3-5 days (parallel)
- Sprint 2: 4-6 days (parallel, after Sprint 1)
- Sprint 3: 5-7 days (#7 is complex integration)
- Polish & Testing: 2-3 days

**Total**: 14-21 days with 3 agents working in parallel

## Labels to Create (if not already exist)

```bash
gh label create "enhancement" --color 0E8A16 --description "New feature or request"
gh label create "phase-1-repository" --color 1D76DB --description "Phase 1: Repository Management"
gh label create "phase-2-build" --color 1D76DB --description "Phase 2: Build Orchestration"
gh label create "phase-3-docker" --color 1D76DB --description "Phase 3: Docker Integration"
gh label create "phase-4-wizard" --color 1D76DB --description "Phase 4: Setup Wizard"
gh label create "phase-5-configuration" --color 1D76DB --description "Phase 5: Configuration"
gh label create "ipc" --color FBCA04 --description "IPC communication"
gh label create "ui" --color FBCA04 --description "User interface"
gh label create "integration" --color D93F0B --description "Integration work"
gh label create "reliability" --color D93F0B --description "Error handling and reliability"
```

## Troubleshooting

### GitHub Token Issues
If you get "Bad credentials" errors:
1. Create a new Personal Access Token at: https://github.com/settings/tokens
2. Select scopes: `repo` (full control)
3. Export it: `export GITHUB_TOKEN=your_token_here`
4. Verify: `gh auth status` or `curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user`

### Alternative: Use GitHub's Issue Import
1. Go to repository Settings → Import & Export
2. Use the CSV format to bulk import
3. Reference the `.md` files for content

## Notes
- Each issue includes clear acceptance criteria
- Dependencies are explicitly stated
- Complexity estimates help with sprint planning
- File paths are specified to avoid confusion
- Test requirements included in each issue
