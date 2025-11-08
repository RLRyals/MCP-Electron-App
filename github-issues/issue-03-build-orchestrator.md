---
title: Implement BuildOrchestrator Class
labels: enhancement, phase-2-build
---

## Description
Create a BuildOrchestrator class to execute npm install, npm build, and docker build commands with progress tracking.

## Tasks
- [ ] Create `src/main/build-orchestrator.ts`
- [ ] Implement methods:
  - `npmInstall(repoPath: string, options?: NpmOptions): Promise<void>`
  - `npmBuild(repoPath: string, buildScript?: string): Promise<void>`
  - `dockerBuild(dockerfile: string, imageName: string, buildArgs?: Record<string, string>): Promise<void>`
  - `executeBuildChain(steps: BuildStep[]): Promise<void>`
- [ ] Add progress callbacks and output streaming
- [ ] Capture stdout/stderr for debugging
- [ ] Add timeout handling
- [ ] Support build configuration files (`build.config.json`)
- [ ] Add unit tests for BuildOrchestrator

## Files to Create
- `src/main/build-orchestrator.ts`
- `src/types/build.ts`
- `tests/main/build-orchestrator.test.ts`

## Dependencies
None ✅ - Can start immediately

## Estimated Complexity
High

## Sprint Assignment
**Sprint 1** - Can start immediately

## Blocks
- Issue #5 (Docker Build Integration)
- Issue #6 (Progress Tracking)
- Issue #7 (Setup Wizard Integration)
