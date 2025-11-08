---
title: Integrate Full Build Pipeline into Setup Wizard Step 5
labels: enhancement, phase-4-wizard, integration
---

## Description
Wire all components together in Setup Wizard Step 5 to provide the complete automated setup experience.

## Tasks
- [ ] Update Step 5 (Download & Setup) to orchestrate:
  - Download all repositories defined in setup-config.json
  - Run npm install for each repository in dependency order
  - Execute npm builds for each repository
  - Build Docker images from source
  - Verify all build artifacts
- [ ] Implement build order resolution based on dependencies
- [ ] Add "skip optional components" functionality
- [ ] Integrate progress tracking UI
- [ ] Add comprehensive error handling
- [ ] Create integration tests for full pipeline
- [ ] Update setup wizard documentation

## Files to Modify
- `src/renderer/setup-wizard-handlers.ts`
- `src/main/index.ts` (IPC orchestration)

## Dependencies
⚠️ **Blocked by Issue #2** (RepositoryManager)
⚠️ **Blocked by Issue #3** (BuildOrchestrator)
⚠️ **Blocked by Issue #4** (IPC Handlers)
⚠️ **Blocked by Issue #5** (Docker Build Integration)
⚠️ **Blocked by Issue #6** (Progress Tracking)

## Estimated Complexity
High

## Sprint Assignment
**Sprint 3** - Can start after Sprint 2 is complete

## Note
This is the final integration issue that brings all components together. It should be the last major development task before testing and polish.
