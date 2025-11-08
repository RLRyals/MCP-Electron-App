---
title: Add IPC Handlers for Repository Operations
labels: enhancement, phase-1-repository, ipc
---

## Description
Add IPC communication layer to expose RepositoryManager functionality to the renderer process.

## Tasks
- [ ] Add IPC handlers in `src/main/index.ts` for:
  - `repository:clone`
  - `repository:checkout-version`
  - `repository:get-status`
  - `repository:clone-progress` (event)
- [ ] Add corresponding IPC invocations in renderer
- [ ] Add type-safe IPC channel definitions
- [ ] Add integration tests for IPC handlers

## Files to Modify
- `src/main/index.ts`
- `src/renderer/setup-wizard-handlers.ts`
- `src/types/ipc.ts`

## Dependencies
⚠️ **Blocked by Issue #2** (RepositoryManager must exist first)

## Estimated Complexity
Low-Medium

## Sprint Assignment
**Sprint 2** - Can start after Issue #2 is complete

## Blocks
- Issue #7 (Setup Wizard Integration)
