---
title: Extend Docker Images Module for Build-from-Source Support
labels: enhancement, phase-3-docker
---

## Description
Enhance docker-images.ts to support building Docker images from downloaded source repositories.

## Tasks
- [ ] Extend `src/main/docker-images.ts` with:
  - `buildImageFromSource(repoPath: string, imageName: string, tag: string): Promise<void>`
  - `createDockerfileIfMissing(repoPath: string, template: string): Promise<void>`
  - Image tagging and caching logic
  - Fallback to pre-built images on build failure
- [ ] Integrate with RepositoryManager to access cloned repos
- [ ] Integrate with BuildOrchestrator for Docker builds
- [ ] Add build progress tracking
- [ ] Update Docker image verification logic
- [ ] Add tests for build-from-source scenarios

## Files to Modify
- `src/main/docker-images.ts`

## Files to Create
- `templates/Dockerfile.template` (if needed)
- `tests/main/docker-images-build.test.ts`

## Dependencies
⚠️ **Blocked by Issue #2** (RepositoryManager)
⚠️ **Blocked by Issue #3** (BuildOrchestrator)

## Estimated Complexity
Medium

## Sprint Assignment
**Sprint 2** - Can start after Issues #2 and #3 are complete

## Blocks
- Issue #7 (Setup Wizard Integration)
